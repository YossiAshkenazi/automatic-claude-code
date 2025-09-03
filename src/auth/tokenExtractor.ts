/**
 * OAuth Token Extractor for Subscription Authentication
 * Consolidated cross-platform OAuth token extraction system for Claude Pro/Max subscription tokens
 * Supports macOS Keychain, Windows Credential Store, Linux credential files with comprehensive fallbacks
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Logger } from '../logger';

const execAsync = promisify(exec);

/**
 * OAuth token extraction result with comprehensive metadata
 */
export interface OAuthExtractionResult {
  token: string | null;
  source: 'environment' | 'windows_credential_manager' | 'macos_keychain' | 'linux_credentials' | 'file_system' | 'session_exists' | 'none';
  cached: boolean;
  expires_at?: string;
  error?: string;
  provider?: string;
  metadata?: {
    extraction_method?: string;
    validation_score?: number;
    security_flags?: string[];
  };
}

/**
 * OAuth credentials structure
 */
export interface OAuthCredentials {
  oauth_token?: string;
  access_token?: string;
  session_token?: string;
  refresh_token?: string;
  expires_at?: string;
  token_type?: string;
  scope?: string;
}

/**
 * Token validation result with detailed security analysis
 */
export interface TokenValidationResult {
  isValid: boolean;
  issues: string[];
  securityScore: number;
  format: 'jwt' | 'bearer' | 'api_key' | 'session' | 'uuid' | 'base64' | 'hex' | 'unknown';
  entropy: number;
}

/**
 * Cache entry structure for token caching
 */
interface TokenCacheEntry {
  token: string;
  timestamp: number;
  expires_at?: string;
  source: string;
  validation_score?: number;
}

/**
 * Cross-platform OAuth Token Extractor
 * Provides comprehensive token extraction with platform-specific optimizations and fallbacks
 */
export class OAuthTokenExtractor {
  private logger: Logger;
  private tokenCache: Map<string, TokenCacheEntry> = new Map();
  private cacheExpiryMs: number = 5 * 60 * 1000; // 5 minutes default
  
  constructor(logger?: Logger, cacheExpiryMs?: number) {
    this.logger = logger || new Logger();
    if (cacheExpiryMs !== undefined) {
      this.cacheExpiryMs = cacheExpiryMs;
    }
  }

  /**
   * Main entry point - Extract OAuth token with comprehensive fallback chain
   */
  async extractOAuthToken(): Promise<OAuthExtractionResult> {
    try {
      // Step 1: Check cache first
      const cacheResult = this.getCachedToken('oauth_token');
      if (cacheResult.token) {
        this.logger.debug('Using cached OAuth token');
        return cacheResult;
      }

      // Step 2: Environment variables (highest priority - allows override)
      const envResult = await this.extractFromEnvironment();
      if (envResult.token) {
        this.cacheToken('oauth_token', envResult);
        return envResult;
      }

      // Step 3: Platform-specific credential stores
      let platformResult: OAuthExtractionResult;
      switch (process.platform) {
        case 'win32':
          platformResult = await this.extractFromWindowsCredentialManager();
          break;
        case 'darwin':
          platformResult = await this.extractFromMacOSKeychain();
          break;
        case 'linux':
          platformResult = await this.extractFromLinuxCredentials();
          break;
        default:
          platformResult = { token: null, source: 'none', cached: false };
      }

      if (platformResult.token) {
        this.cacheToken('oauth_token', platformResult);
        return platformResult;
      }

      // Step 4: Cross-platform file system fallback
      const fileResult = await this.extractFromFileSystem();
      if (fileResult.token) {
        this.cacheToken('oauth_token', fileResult);
        return fileResult;
      }

      // Step 5: Check for existing Claude sessions
      const sessionResult = await this.checkExistingClaudeSessions();
      if (sessionResult.token) {
        return sessionResult;
      }

      // No token found anywhere
      return {
        token: null,
        source: 'none',
        cached: false,
        error: 'No OAuth token found in any source (environment, credential stores, file system, or sessions)'
      };

    } catch (error) {
      this.logger.error(`OAuth token extraction failed: ${error}`);
      return {
        token: null,
        source: 'none',
        cached: false,
        error: `Extraction error: ${error}`
      };
    }
  }

  /**
   * Extract token from environment variables with comprehensive fallbacks
   */
  private async extractFromEnvironment(): Promise<OAuthExtractionResult> {
    try {
      // Comprehensive list of environment variable names in priority order
      const envVarNames = [
        // Primary Claude-specific variables
        'CLAUDE_CODE_OAUTH_TOKEN',
        'CLAUDE_OAUTH_TOKEN', 
        'CLAUDE_SESSION_TOKEN',
        'CLAUDE_AUTH_TOKEN',
        'CLAUDE_TOKEN',
        
        // Anthropic-specific variables
        'ANTHROPIC_OAUTH_TOKEN',
        'ANTHROPIC_SESSION_TOKEN', 
        'ANTHROPIC_AUTH_TOKEN',
        'ANTHROPIC_TOKEN',
        'ANTHROPIC_API_KEY',
        
        // Generic patterns
        'CLAUDE_API_TOKEN',
        'ANTHROPIC_API_TOKEN',
        'CLAUDE_BEARER_TOKEN',
        'ANTHROPIC_BEARER_TOKEN',
        
        // Alternative naming conventions
        'CLAUDE_ACCESS_TOKEN',
        'ANTHROPIC_ACCESS_TOKEN'
      ];

      this.logger.debug(`Checking ${envVarNames.length} environment variables for OAuth token`);

      for (const envVar of envVarNames) {
        const token = process.env[envVar];
        if (token && token.trim()) {
          const trimmedToken = token.trim();
          const validation = this.validateTokenComprehensive(trimmedToken);
          
          if (validation.isValid) {
            this.logger.debug(`Valid OAuth token found in environment variable: ${envVar} (score: ${validation.securityScore})`);
            return {
              token: trimmedToken,
              source: 'environment',
              cached: false,
              metadata: {
                extraction_method: envVar,
                validation_score: validation.securityScore,
                security_flags: validation.issues.length > 0 ? validation.issues : ['passed_validation']
              }
            };
          } else {
            this.logger.debug(`Token found in ${envVar} but validation failed: ${validation.issues.join(', ')}`);
          }
        }
      }

      // Check for base64-encoded tokens
      for (const envVar of envVarNames.map(name => name + '_B64')) {
        const encodedToken = process.env[envVar];
        if (encodedToken && encodedToken.trim()) {
          try {
            const decodedToken = Buffer.from(encodedToken.trim(), 'base64').toString('utf8');
            const validation = this.validateTokenComprehensive(decodedToken);
            
            if (validation.isValid) {
              this.logger.debug(`Valid OAuth token found in base64-encoded environment variable: ${envVar}`);
              return {
                token: decodedToken,
                source: 'environment',
                cached: false,
                metadata: {
                  extraction_method: `${envVar} (base64-decoded)`,
                  validation_score: validation.securityScore
                }
              };
            }
          } catch (e) {
            this.logger.debug(`Failed to decode base64 token from ${envVar}: ${e}`);
          }
        }
      }

      // Check for token file paths in environment variables
      const tokenFileVars = [
        'CLAUDE_TOKEN_FILE',
        'CLAUDE_OAUTH_TOKEN_FILE',
        'ANTHROPIC_TOKEN_FILE',
        'ANTHROPIC_OAUTH_TOKEN_FILE'
      ];

      for (const fileVar of tokenFileVars) {
        const tokenFilePath = process.env[fileVar];
        if (tokenFilePath && tokenFilePath.trim()) {
          try {
            const resolvedPath = path.resolve(tokenFilePath.trim());
            if (fs.existsSync(resolvedPath)) {
              const fileToken = fs.readFileSync(resolvedPath, 'utf8').trim();
              const validation = this.validateTokenComprehensive(fileToken);
              
              if (validation.isValid) {
                this.logger.debug(`Valid OAuth token found in file specified by ${fileVar}: ${resolvedPath}`);
                return {
                  token: fileToken,
                  source: 'environment',
                  cached: false,
                  metadata: {
                    extraction_method: `${fileVar} -> ${resolvedPath}`,
                    validation_score: validation.securityScore
                  }
                };
              }
            }
          } catch (e) {
            this.logger.debug(`Failed to read token file from ${fileVar}: ${e}`);
          }
        }
      }

    } catch (error) {
      this.logger.debug(`Environment variable extraction failed: ${error}`);
    }

    return { token: null, source: 'environment', cached: false };
  }

  /**
   * Extract token from Windows Credential Manager with multiple methods
   */
  private async extractFromWindowsCredentialManager(): Promise<OAuthExtractionResult> {
    if (process.platform !== 'win32') {
      return { token: null, source: 'windows_credential_manager', cached: false };
    }

    try {
      // Service names that Claude Code might use
      const serviceNames = [
        'Claude Code',
        'Claude Code-credentials',
        'claude-code',
        'anthropic-claude-code',
        'claude-ai',
        'anthropic',
        'anthropic-ai-claude-code',
        'Claude Pro',
        'Claude Max'
      ];

      // Method 1: PowerShell with CredentialManager module
      for (const serviceName of serviceNames) {
        try {
          const { stdout } = await execAsync(
            `powershell.exe -Command "` +
            `try { ` +
              `Import-Module CredentialManager -ErrorAction SilentlyContinue; ` +
              `$cred = Get-StoredCredential -Target '${serviceName}' -ErrorAction SilentlyContinue; ` +
              `if ($cred) { ` +
                `ConvertTo-Json @{UserName=$cred.UserName; Password=$cred.GetNetworkCredential().Password; Target='${serviceName}'} ` +
              `} ` +
            `} catch { Write-Output 'null' }"`
          );
          
          if (stdout.trim() && stdout.trim() !== 'null') {
            const cred = JSON.parse(stdout.trim());
            if (cred && cred.Password) {
              const validation = this.validateTokenComprehensive(cred.Password);
              
              if (validation.isValid) {
                this.logger.debug(`Valid OAuth token found in Windows Credential Manager: ${serviceName}`);
                return {
                  token: cred.Password,
                  source: 'windows_credential_manager',
                  cached: false,
                  provider: 'PowerShell CredentialManager',
                  metadata: {
                    extraction_method: `PowerShell CredentialManager: ${serviceName}`,
                    validation_score: validation.securityScore
                  }
                };
              }
            }
          }
        } catch (e) {
          this.logger.debug(`PowerShell CredentialManager failed for ${serviceName}: ${e}`);
        }
      }

      // Method 2: Direct Win32 API via PowerShell
      for (const serviceName of serviceNames) {
        try {
          const { stdout } = await execAsync(
            `powershell.exe -Command "` +
            `Add-Type -TypeDefinition '` +
              `using System; ` +
              `using System.Runtime.InteropServices; ` +
              `using System.Text; ` +
              `public class CredMan { ` +
                `[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] ` +
                `public struct Credential { ` +
                  `public uint Flags; public uint Type; public string TargetName; ` +
                  `public string Comment; public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten; ` +
                  `public uint CredentialBlobSize; public IntPtr CredentialBlob; ` +
                  `public uint Persist; public uint AttributeCount; public IntPtr Attributes; ` +
                  `public string TargetAlias; public string UserName; ` +
                `} ` +
                `[DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)] ` +
                `public static extern bool CredRead(string target, uint type, uint reservedFlag, out IntPtr credentialPtr); ` +
                `[DllImport("advapi32.dll")] public static extern void CredFree(IntPtr cred); ` +
                `public static string GetCredential(string target) { ` +
                  `IntPtr credPtr; ` +
                  `if (CredRead(target, 1, 0, out credPtr)) { ` +
                    `var credential = (Credential)Marshal.PtrToStructure(credPtr, typeof(Credential)); ` +
                    `var password = Marshal.PtrToStringUni(credential.CredentialBlob, (int)credential.CredentialBlobSize / 2); ` +
                    `CredFree(credPtr); return password; ` +
                  `} return null; ` +
                `} ` +
              `}'; ` +
            `try { [CredMan]::GetCredential('${serviceName}') } catch { $null }"`
          );
          
          const password = stdout.trim();
          if (password && password !== 'null' && password.length > 10) {
            const validation = this.validateTokenComprehensive(password);
            
            if (validation.isValid) {
              this.logger.debug(`Valid OAuth token found via Win32 API: ${serviceName}`);
              return {
                token: password,
                source: 'windows_credential_manager',
                cached: false,
                provider: 'Win32 API',
                metadata: {
                  extraction_method: `Win32 API: ${serviceName}`,
                  validation_score: validation.securityScore
                }
              };
            }
          }
        } catch (e) {
          this.logger.debug(`Win32 API credential access failed for ${serviceName}: ${e}`);
        }
      }

      // Method 3: cmdkey detection (informational only)
      try {
        const { stdout } = await execAsync('cmdkey /list');
        const detectedServices = serviceNames.filter(name => 
          stdout.toLowerCase().includes(name.toLowerCase())
        );
        
        if (detectedServices.length > 0) {
          this.logger.debug(`Detected Claude credentials in Windows Credential Manager: ${detectedServices.join(', ')}`);
          // Note: cmdkey cannot retrieve passwords directly, only indicates presence
        }
      } catch (e) {
        this.logger.debug('cmdkey detection failed');
      }

    } catch (error) {
      this.logger.debug(`Windows Credential Manager extraction failed: ${error}`);
    }

    return { token: null, source: 'windows_credential_manager', cached: false };
  }

  /**
   * Extract token from macOS Keychain with comprehensive service name matching
   */
  private async extractFromMacOSKeychain(): Promise<OAuthExtractionResult> {
    if (process.platform !== 'darwin') {
      return { token: null, source: 'macos_keychain', cached: false };
    }

    try {
      // Service names that Claude Code might use in Keychain
      const serviceNames = [
        'Claude Code',
        'Claude Code-credentials',
        'claude-code',
        'anthropic-claude-code',
        'Claude Pro',
        'Claude Max',
        'anthropic',
        'claude-ai'
      ];

      // Account names to try
      const accountNames = ['default', 'oauth', 'session', 'token'];

      for (const serviceName of serviceNames) {
        for (const accountName of accountNames) {
          try {
            const { stdout } = await execAsync(
              `security find-generic-password -s "${serviceName}" -a "${accountName}" -w`
            );
            
            const token = stdout.trim();
            if (token && token.length > 10) {
              const validation = this.validateTokenComprehensive(token);
              
              if (validation.isValid) {
                this.logger.debug(`Valid OAuth token found in macOS Keychain: ${serviceName}:${accountName}`);
                return {
                  token,
                  source: 'macos_keychain',
                  cached: false,
                  provider: 'security command',
                  metadata: {
                    extraction_method: `Keychain: ${serviceName}:${accountName}`,
                    validation_score: validation.securityScore
                  }
                };
              }
            }
          } catch (e) {
            // Continue to next combination
          }
        }
      }

      // Fallback: try without account specification
      for (const serviceName of serviceNames) {
        try {
          const { stdout } = await execAsync(
            `security find-generic-password -s "${serviceName}" -w`
          );
          
          const token = stdout.trim();
          if (token && token.length > 10) {
            const validation = this.validateTokenComprehensive(token);
            
            if (validation.isValid) {
              this.logger.debug(`Valid OAuth token found in macOS Keychain (no account): ${serviceName}`);
              return {
                token,
                source: 'macos_keychain',
                cached: false,
                provider: 'security command',
                metadata: {
                  extraction_method: `Keychain: ${serviceName}`,
                  validation_score: validation.securityScore
                }
              };
            }
          }
        } catch (e) {
          // Continue to next service
        }
      }

    } catch (error) {
      this.logger.debug(`macOS Keychain extraction failed: ${error}`);
    }

    return { token: null, source: 'macos_keychain', cached: false };
  }

  /**
   * Extract token from Linux credential files and secret services
   */
  private async extractFromLinuxCredentials(): Promise<OAuthExtractionResult> {
    if (process.platform !== 'linux') {
      return { token: null, source: 'linux_credentials', cached: false };
    }

    try {
      const homeDir = os.homedir();
      
      // Linux-specific credential file locations
      const linuxPaths = [
        // Standard XDG locations
        path.join(homeDir, '.config', 'claude', 'credentials.json'),
        path.join(homeDir, '.config', 'claude-code', 'credentials.json'),
        path.join(homeDir, '.config', 'anthropic', 'credentials.json'),
        
        // Hidden files in home directory
        path.join(homeDir, '.claude', 'credentials.json'),
        path.join(homeDir, '.claude-code', 'credentials.json'),
        path.join(homeDir, '.anthropic', 'credentials.json'),
        
        // User-specific application data
        path.join(homeDir, '.local', 'share', 'claude', 'credentials.json'),
        path.join(homeDir, '.local', 'share', 'anthropic', 'credentials.json'),
        
        // System-wide locations (if readable)
        '/etc/claude/credentials.json',
        '/etc/anthropic/credentials.json',
        
        // Environment-specific paths
        process.env.XDG_CONFIG_HOME ? path.join(process.env.XDG_CONFIG_HOME, 'claude', 'credentials.json') : null,
        process.env.CLAUDE_CONFIG_DIR ? path.join(process.env.CLAUDE_CONFIG_DIR, 'credentials.json') : null,
      ].filter(Boolean) as string[];

      this.logger.debug(`Checking ${linuxPaths.length} Linux credential file locations`);

      for (const credPath of linuxPaths) {
        if (fs.existsSync(credPath)) {
          try {
            // Check file permissions for security
            const stats = fs.statSync(credPath);
            if ((stats.mode & 0o077) !== 0) {
              this.logger.warning(`Credential file has overly permissive permissions: ${credPath}`);
            }

            const credContent = fs.readFileSync(credPath, 'utf8');
            if (!credContent.trim()) continue;

            const creds: OAuthCredentials = JSON.parse(credContent);
            
            // Check for various token field names
            const tokenFields = [
              'oauth_token',
              'access_token',
              'session_token',
              'auth_token',
              'token',
              'claude_token',
              'anthropic_token',
              'api_token',
              'bearer_token'
            ];

            for (const field of tokenFields) {
              const token = creds[field as keyof OAuthCredentials];
              if (token && typeof token === 'string' && token.trim()) {
                const validation = this.validateTokenComprehensive(token.trim());
                
                if (validation.isValid) {
                  this.logger.debug(`Valid OAuth token found in Linux credentials file: ${credPath} (field: ${field})`);
                  return {
                    token: token.trim(),
                    source: 'linux_credentials',
                    cached: false,
                    expires_at: creds.expires_at,
                    provider: 'file system',
                    metadata: {
                      extraction_method: `${credPath}:${field}`,
                      validation_score: validation.securityScore
                    }
                  };
                }
              }
            }
          } catch (e) {
            this.logger.debug(`Failed to parse Linux credential file: ${credPath}, error: ${e}`);
          }
        }
      }

      // Try to access Linux secret service if available (libsecret)
      try {
        // Check if secret-tool is available
        await execAsync('which secret-tool');
        
        const serviceNames = ['claude-code', 'anthropic', 'claude'];
        for (const serviceName of serviceNames) {
          try {
            const { stdout } = await execAsync(
              `secret-tool lookup service ${serviceName} 2>/dev/null || true`
            );
            
            const token = stdout.trim();
            if (token && token.length > 10) {
              const validation = this.validateTokenComprehensive(token);
              
              if (validation.isValid) {
                this.logger.debug(`Valid OAuth token found in Linux secret service: ${serviceName}`);
                return {
                  token,
                  source: 'linux_credentials',
                  cached: false,
                  provider: 'secret-tool',
                  metadata: {
                    extraction_method: `secret-tool: ${serviceName}`,
                    validation_score: validation.securityScore
                  }
                };
              }
            }
          } catch (e) {
            // Continue to next service
          }
        }
      } catch (e) {
        this.logger.debug('secret-tool not available');
      }

    } catch (error) {
      this.logger.debug(`Linux credentials extraction failed: ${error}`);
    }

    return { token: null, source: 'linux_credentials', cached: false };
  }

  /**
   * Extract token from cross-platform file system locations
   */
  private async extractFromFileSystem(): Promise<OAuthExtractionResult> {
    try {
      const homeDir = os.homedir();
      
      // Comprehensive cross-platform file locations
      const possiblePaths = [
        // Primary Claude configuration paths
        path.join(homeDir, '.claude', 'credentials.json'),
        path.join(homeDir, '.claude', '.credentials.json'),
        path.join(homeDir, '.claude', 'config', 'credentials.json'),
        path.join(homeDir, '.claude', 'auth', 'credentials.json'),
        
        // Standard configuration directories
        path.join(homeDir, '.config', 'claude', 'credentials.json'),
        path.join(homeDir, '.config', 'claude-code', 'credentials.json'),
        path.join(homeDir, '.config', 'anthropic', 'credentials.json'),
        
        // Legacy and alternative paths
        path.join(homeDir, '.anthropic', 'credentials.json'),
        path.join(homeDir, '.claude-code', 'credentials.json'),
        path.join(homeDir, '.anthropic-ai', 'credentials.json'),
        
        // Platform-specific application data paths
        ...(process.platform === 'win32' ? [
          path.join(homeDir, 'AppData', 'Roaming', 'Claude', 'credentials.json'),
          path.join(homeDir, 'AppData', 'Local', 'Claude', 'credentials.json'),
          path.join(homeDir, 'AppData', 'Roaming', 'Anthropic', 'credentials.json'),
        ] : []),
        
        ...(process.platform === 'darwin' ? [
          path.join(homeDir, 'Library', 'Application Support', 'Claude', 'credentials.json'),
          path.join(homeDir, 'Library', 'Preferences', 'claude', 'credentials.json'),
          path.join(homeDir, 'Library', 'Application Support', 'Anthropic', 'credentials.json'),
        ] : []),
        
        // Environment variable paths
        ...(process.env.CLAUDE_CONFIG_DIR ? [
          path.join(process.env.CLAUDE_CONFIG_DIR, 'credentials.json'),
          path.join(process.env.CLAUDE_CONFIG_DIR, '.credentials.json')
        ] : []),
        
        ...(process.env.XDG_CONFIG_HOME ? [
          path.join(process.env.XDG_CONFIG_HOME, 'claude', 'credentials.json'),
          path.join(process.env.XDG_CONFIG_HOME, 'anthropic', 'credentials.json')
        ] : [])
      ];

      this.logger.debug(`Checking ${possiblePaths.length} cross-platform credential file locations`);

      for (const credPath of possiblePaths) {
        if (fs.existsSync(credPath)) {
          try {
            const credContent = fs.readFileSync(credPath, 'utf8');
            if (!credContent.trim()) continue;

            // Try parsing as JSON first
            let creds: OAuthCredentials;
            try {
              creds = JSON.parse(credContent);
            } catch (jsonError) {
              // Try reading as plain text token
              const plainToken = credContent.trim();
              if (plainToken.length > 10) {
                const validation = this.validateTokenComprehensive(plainToken);
                if (validation.isValid) {
                  this.logger.debug(`Valid plain text token found: ${credPath}`);
                  return {
                    token: plainToken,
                    source: 'file_system',
                    cached: false,
                    provider: 'plain text file',
                    metadata: {
                      extraction_method: `plain_text: ${credPath}`,
                      validation_score: validation.securityScore
                    }
                  };
                }
              }
              continue;
            }
            
            // Check for various token field names in priority order
            const tokenFields = [
              'oauth_token',
              'access_token',
              'session_token',
              'auth_token',
              'token',
              'claude_token',
              'anthropic_token',
              'api_token',
              'bearer_token',
              'subscription_token'
            ];

            for (const field of tokenFields) {
              const token = creds[field as keyof OAuthCredentials];
              if (token && typeof token === 'string' && token.trim()) {
                const validation = this.validateTokenComprehensive(token.trim());
                
                if (validation.isValid) {
                  this.logger.debug(`Valid OAuth token found in file: ${credPath} (field: ${field})`);
                  return {
                    token: token.trim(),
                    source: 'file_system',
                    cached: false,
                    expires_at: creds.expires_at,
                    provider: 'JSON file',
                    metadata: {
                      extraction_method: `${credPath}:${field}`,
                      validation_score: validation.securityScore
                    }
                  };
                }
              }
            }
          } catch (e) {
            this.logger.debug(`Failed to process credential file: ${credPath}, error: ${e}`);
          }
        }
      }

    } catch (error) {
      this.logger.debug(`File system extraction failed: ${error}`);
    }

    return { token: null, source: 'file_system', cached: false };
  }

  /**
   * Check for existing Claude sessions that might indicate active authentication
   */
  private async checkExistingClaudeSessions(): Promise<OAuthExtractionResult> {
    try {
      const homeDir = os.homedir();
      
      // Possible Claude session directories
      const sessionPaths = [
        path.join(homeDir, '.claude', 'projects'),
        path.join(homeDir, '.config', 'claude', 'projects'),
        path.join(homeDir, 'Library', 'Application Support', 'Claude', 'projects'), // macOS
        path.join(homeDir, 'AppData', 'Roaming', 'Claude', 'projects'), // Windows
      ];

      let recentSessions = 0;
      let mostRecentSession: { file: string; age: number } | null = null;

      for (const sessionsPath of sessionPaths) {
        if (fs.existsSync(sessionsPath)) {
          try {
            const sessionFiles = fs.readdirSync(sessionsPath);
            
            for (const sessionFile of sessionFiles) {
              const conversationPath = path.join(sessionsPath, sessionFile, 'conversation.jsonl');
              if (fs.existsSync(conversationPath)) {
                const stats = fs.statSync(conversationPath);
                const hoursSinceModified = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
                
                // Consider sessions active within 24 hours
                if (hoursSinceModified < 24) {
                  recentSessions++;
                  
                  if (!mostRecentSession || hoursSinceModified < mostRecentSession.age) {
                    mostRecentSession = { file: sessionFile, age: hoursSinceModified };
                  }
                }
              }
            }
          } catch (e) {
            this.logger.debug(`Failed to read sessions directory: ${sessionsPath}, error: ${e}`);
          }
        }
      }

      if (recentSessions > 0) {
        this.logger.debug(`Found ${recentSessions} recent Claude sessions, most recent: ${mostRecentSession?.file} (${mostRecentSession?.age.toFixed(1)}h ago)`);
        return {
          token: 'session-exists',
          source: 'session_exists',
          cached: false,
          metadata: {
            extraction_method: `detected_active_sessions`,
            validation_score: 85, // High confidence if sessions exist
            security_flags: [`${recentSessions}_recent_sessions`, `most_recent_${mostRecentSession?.age.toFixed(1)}h_ago`]
          }
        };
      }

    } catch (error) {
      this.logger.debug(`Session detection failed: ${error}`);
    }

    return { token: null, source: 'session_exists', cached: false };
  }

  /**
   * Comprehensive token validation with detailed analysis
   */
  private validateTokenComprehensive(token: string): TokenValidationResult {
    const result: TokenValidationResult = {
      isValid: false,
      issues: [],
      securityScore: 0,
      format: 'unknown',
      entropy: 0
    };

    if (!token || token.trim().length === 0) {
      result.issues.push('Token is empty');
      return result;
    }

    const trimmedToken = token.trim();

    // Special case for session indicator
    if (trimmedToken === 'session-exists') {
      return {
        isValid: true,
        issues: [],
        securityScore: 85,
        format: 'session',
        entropy: 0
      };
    }

    // Length validation
    if (trimmedToken.length < 10) {
      result.issues.push('Token too short (minimum 10 characters)');
    }
    if (trimmedToken.length > 2048) {
      result.issues.push('Token too long (maximum 2048 characters)');
    }

    // Format detection and validation
    result.format = this.detectTokenFormat(trimmedToken);
    result.entropy = this.calculateEntropy(trimmedToken);

    // Entropy validation
    if (result.entropy < 3.0) {
      result.issues.push('Token has low entropy (not random enough)');
    }

    // Pattern-based validation
    if (/^(1234|test|demo|sample|example|placeholder)/i.test(trimmedToken)) {
      result.issues.push('Token appears to be a test or example token');
    }

    if (/(.)\1{10,}/.test(trimmedToken)) {
      result.issues.push('Token contains too many repeated characters');
    }

    if (!/^[\x20-\x7E]+$/.test(trimmedToken)) {
      result.issues.push('Token contains non-printable or non-ASCII characters');
    }

    // Calculate security score
    result.securityScore = this.calculateSecurityScore(trimmedToken, result.format, result.entropy);

    // Token is valid if no critical issues and decent security score
    result.isValid = result.issues.length === 0 && result.securityScore >= 60;

    return result;
  }

  /**
   * Detect token format based on structure
   */
  private detectTokenFormat(token: string): TokenValidationResult['format'] {
    // JWT tokens (header.payload.signature)
    if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
      return 'jwt';
    }
    
    // API keys with prefixes
    if (/^(sk|pk|ak|at|bt|ct|dt)[-_][A-Za-z0-9+/=_-]{10,}$/i.test(token)) {
      return 'api_key';
    }
    
    // UUID format
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
      return 'uuid';
    }
    
    // Base64 format
    if (/^[A-Za-z0-9+/]{16,}={0,2}$/.test(token)) {
      return 'base64';
    }
    
    // Hex format
    if (/^[0-9a-f]{20,}$/i.test(token)) {
      return 'hex';
    }
    
    // Bearer token format (alphanumeric + common special chars)
    if (/^[A-Za-z0-9._-]{20,}$/.test(token)) {
      return 'bearer';
    }

    return 'unknown';
  }

  /**
   * Calculate Shannon entropy for token randomness
   */
  private calculateEntropy(token: string): number {
    const charCounts = new Map<string, number>();
    
    for (const char of token) {
      charCounts.set(char, (charCounts.get(char) || 0) + 1);
    }

    let entropy = 0;
    const len = token.length;
    
    for (const count of charCounts.values()) {
      const probability = count / len;
      entropy -= probability * Math.log2(probability);
    }

    return entropy;
  }

  /**
   * Calculate comprehensive security score (0-100)
   */
  private calculateSecurityScore(token: string, format: TokenValidationResult['format'], entropy: number): number {
    let score = 0;

    // Length score (0-25 points)
    if (token.length >= 20) score += 25;
    else if (token.length >= 15) score += 20;
    else if (token.length >= 10) score += 15;
    else score += 5;

    // Format score (0-25 points)
    const formatScores = {
      'jwt': 25,
      'api_key': 25, 
      'bearer': 20,
      'base64': 20,
      'uuid': 15,
      'hex': 15,
      'session': 20,
      'unknown': 5
    };
    score += formatScores[format];

    // Entropy score (0-25 points)
    if (entropy >= 4.0) score += 25;
    else if (entropy >= 3.5) score += 20;
    else if (entropy >= 3.0) score += 15;
    else if (entropy >= 2.5) score += 10;
    else score += 5;

    // Character diversity score (0-25 points)
    const hasLower = /[a-z]/.test(token);
    const hasUpper = /[A-Z]/.test(token);
    const hasDigits = /[0-9]/.test(token);
    const hasSpecial = /[^a-zA-Z0-9]/.test(token);
    
    let diversityScore = 0;
    if (hasLower) diversityScore += 6;
    if (hasUpper) diversityScore += 6;
    if (hasDigits) diversityScore += 6;
    if (hasSpecial) diversityScore += 7;
    
    score += diversityScore;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Store token in platform-appropriate credential store
   */
  async storeOAuthToken(token: string, service: string = 'Claude Code', account: string = 'default'): Promise<void> {
    try {
      const validation = this.validateTokenComprehensive(token);
      if (!validation.isValid) {
        throw new Error(`Token validation failed: ${validation.issues.join(', ')}`);
      }

      switch (process.platform) {
        case 'win32':
          await execAsync(`cmdkey /generic:"${service}" /user:"${account}" /pass:"${token}"`);
          break;
          
        case 'darwin':
          await execAsync(`security add-generic-password -s "${service}" -a "${account}" -w "${token}" -U`);
          break;
          
        case 'linux':
          // Try secret-tool first
          try {
            await execAsync(`echo "${token}" | secret-tool store --label="Claude OAuth Token" service "${service}" account "${account}"`);
          } catch {
            // Fallback to file storage
            const credDir = path.join(os.homedir(), '.config', 'claude');
            fs.mkdirSync(credDir, { recursive: true, mode: 0o700 });
            
            const credFile = path.join(credDir, 'credentials.json');
            const creds: OAuthCredentials = fs.existsSync(credFile) 
              ? JSON.parse(fs.readFileSync(credFile, 'utf8'))
              : {};
            
            creds.oauth_token = token;
            creds.expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h default
            
            fs.writeFileSync(credFile, JSON.stringify(creds, null, 2), { mode: 0o600 });
          }
          break;
      }

      this.clearCache();
      this.logger.info(`OAuth token stored successfully for ${service}:${account}`);
      
    } catch (error) {
      this.logger.error(`Failed to store OAuth token: ${error}`);
      throw error;
    }
  }

  /**
   * Delete stored OAuth token
   */
  async deleteOAuthToken(service: string = 'Claude Code', account: string = 'default'): Promise<void> {
    try {
      switch (process.platform) {
        case 'win32':
          await execAsync(`cmdkey /delete:"${service}"`);
          break;
          
        case 'darwin':
          await execAsync(`security delete-generic-password -s "${service}" -a "${account}"`);
          break;
          
        case 'linux':
          try {
            await execAsync(`secret-tool clear service "${service}" account "${account}"`);
          } catch {
            // Also try file deletion
            const credFile = path.join(os.homedir(), '.config', 'claude', 'credentials.json');
            if (fs.existsSync(credFile)) {
              fs.unlinkSync(credFile);
            }
          }
          break;
      }

      this.clearCache();
      this.logger.info(`OAuth token deleted successfully for ${service}:${account}`);
      
    } catch (error) {
      this.logger.error(`Failed to delete OAuth token: ${error}`);
      throw error;
    }
  }

  /**
   * Get cached token if available and valid
   */
  private getCachedToken(key: string): OAuthExtractionResult {
    const cached = this.tokenCache.get(key);
    if (cached && this.isCacheEntryValid(cached)) {
      return {
        token: cached.token,
        source: cached.source as any,
        cached: true,
        expires_at: cached.expires_at,
        metadata: {
          validation_score: cached.validation_score
        }
      };
    }
    return { token: null, source: 'none', cached: false };
  }

  /**
   * Cache token with metadata
   */
  private cacheToken(key: string, result: OAuthExtractionResult): void {
    if (result.token) {
      this.tokenCache.set(key, {
        token: result.token,
        timestamp: Date.now(),
        expires_at: result.expires_at,
        source: result.source,
        validation_score: result.metadata?.validation_score
      });
    }
  }

  /**
   * Check if cache entry is still valid
   */
  private isCacheEntryValid(cached: TokenCacheEntry): boolean {
    // Check cache age
    if (Date.now() - cached.timestamp > this.cacheExpiryMs) {
      return false;
    }

    // Check token expiry if available
    if (cached.expires_at) {
      try {
        const expiryDate = new Date(cached.expires_at);
        if (expiryDate <= new Date()) {
          return false;
        }
      } catch (e) {
        return false;
      }
    }

    return true;
  }

  /**
   * Clear token cache
   */
  clearCache(): void {
    this.tokenCache.clear();
    this.logger.debug('Token cache cleared');
  }

  /**
   * Get cache status for debugging
   */
  getCacheStatus(): { size: number; entries: Array<{ key: string; timestamp: Date; expires_at?: string; source: string }> } {
    const entries = Array.from(this.tokenCache.entries()).map(([key, value]) => ({
      key,
      timestamp: new Date(value.timestamp),
      expires_at: value.expires_at,
      source: value.source
    }));

    return { size: this.tokenCache.size, entries };
  }

  /**
   * Run comprehensive diagnostics
   */
  async runDiagnostics(): Promise<{
    platform: string;
    environment: { available: boolean; variables: string[] };
    credentialStore: { available: boolean; method?: string; error?: string };
    fileSystem: { available: boolean; paths: Record<string, boolean> };
    sessions: { available: boolean; recentCount: number };
    cache: { size: number; entries: number };
    recommendations: string[];
  }> {
    const diagnostics = {
      platform: process.platform,
      environment: { available: false, variables: [] as string[] },
      credentialStore: { available: false } as any,
      fileSystem: { available: false, paths: {} as Record<string, boolean> },
      sessions: { available: false, recentCount: 0 },
      cache: { size: this.tokenCache.size, entries: this.tokenCache.size },
      recommendations: [] as string[]
    };

    // Test environment variables
    const envVars = [
      'CLAUDE_CODE_OAUTH_TOKEN', 'CLAUDE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY',
      'CLAUDE_TOKEN', 'ANTHROPIC_TOKEN'
    ];
    
    for (const envVar of envVars) {
      if (process.env[envVar]) {
        diagnostics.environment.available = true;
        diagnostics.environment.variables.push(envVar);
      }
    }

    // Test credential store
    try {
      switch (process.platform) {
        case 'win32':
          await execAsync('cmdkey /?');
          diagnostics.credentialStore = { available: true, method: 'Windows Credential Manager' };
          break;
        case 'darwin':
          await execAsync('security -h');
          diagnostics.credentialStore = { available: true, method: 'macOS Keychain' };
          break;
        case 'linux':
          try {
            await execAsync('which secret-tool');
            diagnostics.credentialStore = { available: true, method: 'libsecret' };
          } catch {
            diagnostics.credentialStore = { available: true, method: 'file system' };
          }
          break;
      }
    } catch (error) {
      diagnostics.credentialStore = { available: false, error: String(error) };
    }

    // Test file system paths
    const testPaths = [
      path.join(os.homedir(), '.claude', 'credentials.json'),
      path.join(os.homedir(), '.config', 'claude', 'credentials.json'),
      path.join(os.homedir(), '.anthropic', 'credentials.json'),
    ];

    for (const testPath of testPaths) {
      diagnostics.fileSystem.paths[testPath] = fs.existsSync(testPath);
      if (fs.existsSync(testPath)) {
        diagnostics.fileSystem.available = true;
      }
    }

    // Test sessions
    try {
      const sessionResult = await this.checkExistingClaudeSessions();
      if (sessionResult.token === 'session-exists') {
        diagnostics.sessions.available = true;
        diagnostics.sessions.recentCount = parseInt(
          sessionResult.metadata?.security_flags?.[0]?.replace('_recent_sessions', '') || '0'
        );
      }
    } catch (error) {
      // Session check failed
    }

    // Generate recommendations
    if (!diagnostics.environment.available && !diagnostics.credentialStore.available && !diagnostics.fileSystem.available) {
      diagnostics.recommendations.push('No OAuth token sources found. Set CLAUDE_CODE_OAUTH_TOKEN environment variable.');
    }

    if (diagnostics.credentialStore.available && !diagnostics.fileSystem.available) {
      diagnostics.recommendations.push('Consider storing tokens in credential store for better security.');
    }

    if (diagnostics.fileSystem.available) {
      diagnostics.recommendations.push('Ensure credential files have restrictive permissions (600).');
    }

    return diagnostics;
  }
}

/**
 * Default token extractor instance for easy usage
 */
export const tokenExtractor = new OAuthTokenExtractor();

/**
 * Convenience function for quick token extraction
 */
export async function extractOAuthToken(): Promise<OAuthExtractionResult> {
  return await tokenExtractor.extractOAuthToken();
}

/**
 * Convenience function for token validation
 */
export function validateToken(token: string): TokenValidationResult {
  const extractor = new OAuthTokenExtractor();
  return (extractor as any).validateTokenComprehensive(token);
}