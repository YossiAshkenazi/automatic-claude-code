import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Logger } from '../logger';

export interface OAuthCredentials {
  oauth_token?: string;
  session_token?: string;
  refresh_token?: string;
  expires_at?: string;
}

export interface OAuthExtractionResult {
  token: string | null;
  source: 'environment' | 'windows_credential_manager' | 'macos_keychain' | 'file_system' | 'session_exists' | 'none';
  cached: boolean;
  expires_at?: string;
  error?: string;
}

/**
 * OAuth Token Extractor for Claude Code
 * Handles extraction from multiple sources with fallback chain and caching
 */
export class OAuthExtractor {
  private logger: Logger;
  private tokenCache: Map<string, { token: string; timestamp: number; expires_at?: string }> = new Map();
  private cacheExpiryMs: number = 5 * 60 * 1000; // 5 minutes
  
  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
  }

  /**
   * Extract OAuth token from various sources with fallback chain
   */
  async extractOAuthToken(): Promise<OAuthExtractionResult> {
    // Check cache first
    const cacheKey = 'oauth_token';
    const cached = this.tokenCache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      this.logger.debug('Using cached OAuth token');
      return {
        token: cached.token,
        source: 'environment', // Cached tokens retain original source info
        cached: true,
        expires_at: cached.expires_at
      };
    }

    // 1. Environment variable override (highest priority)
    const envToken = await this.extractFromEnvironment();
    if (envToken.token) {
      this.cacheToken(cacheKey, envToken.token, envToken.expires_at);
      return envToken;
    }

    // 2. Windows Credential Manager
    if (process.platform === 'win32') {
      const winToken = await this.extractFromWindowsCredentialManager();
      if (winToken.token) {
        this.cacheToken(cacheKey, winToken.token, winToken.expires_at);
        return winToken;
      }
    }

    // 3. macOS Keychain
    if (process.platform === 'darwin') {
      const macToken = await this.extractFromMacOSKeychain();
      if (macToken.token) {
        this.cacheToken(cacheKey, macToken.token, macToken.expires_at);
        return macToken;
      }
    }

    // 4. File system credentials (cross-platform)
    const fileToken = await this.extractFromFileSystem();
    if (fileToken.token) {
      this.cacheToken(cacheKey, fileToken.token, fileToken.expires_at);
      return fileToken;
    }

    // 5. Check for existing Claude sessions
    const sessionToken = await this.checkExistingSessions();
    if (sessionToken.token) {
      return sessionToken;
    }

    // No token found
    return {
      token: null,
      source: 'none',
      cached: false,
      error: 'No OAuth token found in any source'
    };
  }

  /**
   * Extract token from environment variables with multiple fallbacks
   */
  private async extractFromEnvironment(): Promise<OAuthExtractionResult> {
    try {
      // Priority order of environment variables
      const envVarNames = [
        'CLAUDE_CODE_OAUTH_TOKEN',    // Primary override
        'CLAUDE_OAUTH_TOKEN',         // Alternative naming
        'ANTHROPIC_OAUTH_TOKEN',      // Anthropic-specific
        'CLAUDE_TOKEN',               // Simple naming
        'ANTHROPIC_TOKEN',            // Alternative Anthropic
        'CLAUDE_API_TOKEN',           // API-specific naming
        'ANTHROPIC_API_TOKEN',        // Alternative API naming
        'CLAUDE_AUTH_TOKEN',          // Auth-specific
        'ANTHROPIC_AUTH_TOKEN',       // Alternative auth
        'CLAUDE_SESSION_TOKEN',       // Session-specific
        'ANTHROPIC_SESSION_TOKEN'     // Alternative session
      ];

      this.logger.debug(`Checking ${envVarNames.length} environment variables for OAuth token`);

      for (const envVar of envVarNames) {
        const token = process.env[envVar];
        if (token && token.trim()) {
          const trimmedToken = token.trim();
          
          // Validate the token format
          if (this.isValidTokenFormat(trimmedToken)) {
            this.logger.debug(`OAuth token found in environment variable: ${envVar}`);
            
            // Additional security validation for environment tokens
            const securityCheck = this.validateTokenSecurity(trimmedToken);
            if (!securityCheck.isValid) {
              this.logger.warning(`Token from ${envVar} failed security validation: ${securityCheck.issues.join(', ')}`);
              // Continue to next env var instead of failing completely
              continue;
            }

            return {
              token: trimmedToken,
              source: 'environment',
              cached: false
            };
          } else {
            this.logger.debug(`Token found in ${envVar} but format appears invalid`);
          }
        }
      }

      // Additional check for base64 encoded tokens
      for (const envVar of envVarNames.map(name => name + '_B64')) {
        const encodedToken = process.env[envVar];
        if (encodedToken && encodedToken.trim()) {
          try {
            const decodedToken = Buffer.from(encodedToken.trim(), 'base64').toString('utf8');
            if (this.isValidTokenFormat(decodedToken)) {
              this.logger.debug(`OAuth token found in base64-encoded environment variable: ${envVar}`);
              return {
                token: decodedToken,
                source: 'environment',
                cached: false
              };
            }
          } catch (e) {
            this.logger.debug(`Failed to decode base64 token from ${envVar}: ${e}`);
          }
        }
      }

      // Check for file path in environment variables
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
            if (fs.existsSync(tokenFilePath.trim())) {
              const fileToken = fs.readFileSync(tokenFilePath.trim(), 'utf8').trim();
              if (fileToken && this.isValidTokenFormat(fileToken)) {
                this.logger.debug(`OAuth token found in file specified by ${fileVar}: ${tokenFilePath}`);
                return {
                  token: fileToken,
                  source: 'environment',
                  cached: false
                };
              }
            }
          } catch (e) {
            this.logger.debug(`Failed to read token file from ${fileVar}: ${e}`);
          }
        }
      }

      this.logger.debug('No valid OAuth token found in any environment variable');

    } catch (error) {
      this.logger.debug(`Failed to extract OAuth token from environment: ${error}`);
    }

    return { token: null, source: 'environment', cached: false };
  }

  /**
   * Extract token from Windows Credential Manager
   */
  private async extractFromWindowsCredentialManager(): Promise<OAuthExtractionResult> {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      // Try multiple credential names that Claude Code might use
      const credentialNames = [
        'Claude Code',
        'Claude Code-credentials',
        'claude-code',
        'anthropic-claude-code',
        'claude-ai',
        'anthropic',
        'anthropic-ai-claude-code'
      ];

      // First attempt: PowerShell with CredentialManager module
      for (const credName of credentialNames) {
        try {
          const { stdout } = await execAsync(
            `powershell.exe -Command "if (Get-Module -ListAvailable -Name CredentialManager) { Import-Module CredentialManager; $cred = Get-StoredCredential -Target '${credName}' -ErrorAction SilentlyContinue; if ($cred) { ConvertTo-Json @{UserName=$cred.UserName; Password=$cred.GetNetworkCredential().Password; Target='${credName}'} } }"`
          );
          
          if (stdout.trim()) {
            const cred = JSON.parse(stdout);
            if (cred && cred.Password) {
              this.logger.debug(`OAuth token found in Windows Credential Manager: ${credName}`);
              return {
                token: cred.Password,
                source: 'windows_credential_manager',
                cached: false
              };
            }
          }
        } catch (e) {
          // Continue to next credential name
          this.logger.debug(`No PowerShell credential found for: ${credName}`);
        }
      }

      // Second attempt: Traditional PowerShell Get-StoredCredential
      for (const credName of credentialNames) {
        try {
          const { stdout } = await execAsync(
            `powershell.exe -Command "$ErrorActionPreference='SilentlyContinue'; $cred = Get-StoredCredential -Target '${credName}'; if ($cred) { ConvertTo-Json @{UserName=$cred.UserName; Password=[System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($cred.Password)); Target='${credName}'} }"`
          );
          
          if (stdout.trim()) {
            const cred = JSON.parse(stdout);
            if (cred && cred.Password) {
              this.logger.debug(`OAuth token found via PowerShell: ${credName}`);
              return {
                token: cred.Password,
                source: 'windows_credential_manager',
                cached: false
              };
            }
          }
        } catch (e) {
          this.logger.debug(`PowerShell credential access failed for ${credName}: ${e}`);
        }
      }

      // Third attempt: Windows Credential Manager Win32 API via PowerShell
      for (const credName of credentialNames) {
        try {
          const { stdout } = await execAsync(
            `powershell.exe -Command "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; using System.Text; public class CredMan { [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] public struct Credential { public uint Flags; public uint Type; public string TargetName; public string Comment; public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten; public uint CredentialBlobSize; public IntPtr CredentialBlob; public uint Persist; public uint AttributeCount; public IntPtr Attributes; public string TargetAlias; public string UserName; } [DllImport(\"advapi32.dll\", SetLastError = true, CharSet = CharSet.Unicode)] public static extern bool CredRead(string target, uint type, uint reservedFlag, out IntPtr credentialPtr); [DllImport(\"advapi32.dll\")] public static extern void CredFree(IntPtr cred); public static string GetCredential(string target) { IntPtr credPtr; if (CredRead(target, 1, 0, out credPtr)) { var credential = (Credential)Marshal.PtrToStructure(credPtr, typeof(Credential)); var password = Marshal.PtrToStringUni(credential.CredentialBlob, (int)credential.CredentialBlobSize / 2); CredFree(credPtr); return password; } return null; } }'; try { [CredMan]::GetCredential('${credName}') } catch { $null }"`
          );
          
          const password = stdout.trim();
          if (password && password !== 'null' && password.length > 10) {
            this.logger.debug(`OAuth token found via Win32 API: ${credName}`);
            return {
              token: password,
              source: 'windows_credential_manager',
              cached: false
            };
          }
        } catch (e) {
          this.logger.debug(`Win32 API credential access failed for ${credName}: ${e}`);
        }
      }

      // Fallback: cmdkey detection and registry parsing
      try {
        const { stdout } = await execAsync('cmdkey /list');
        const lines = stdout.split('\n');
        
        for (const line of lines) {
          if (line.includes('Target:') && credentialNames.some(name => line.toLowerCase().includes(name.toLowerCase()))) {
            const target = line.split('Target:')[1]?.trim();
            if (target) {
              this.logger.debug(`Claude credentials detected in Windows Credential Manager: ${target}`);
              // Try to extract from registry
              try {
                const regResult = await execAsync(
                  `powershell.exe -Command "$target='${target}'; $regPath='HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings\\Credentials'; if (Test-Path $regPath) { $creds = Get-ChildItem $regPath -ErrorAction SilentlyContinue | Where-Object { $_.Name -like '*' + $target + '*' }; if ($creds) { 'registry-detected' } }"`
                );
                if (regResult.stdout.includes('registry-detected')) {
                  this.logger.debug('Credentials found in registry but extraction not implemented');
                }
              } catch (regError) {
                this.logger.debug(`Registry access failed: ${regError}`);
              }
            }
          }
        }
      } catch (e) {
        this.logger.debug('cmdkey command failed');
      }

    } catch (error) {
      this.logger.debug(`Failed to extract OAuth token from Windows Credential Manager: ${error}`);
    }

    return { token: null, source: 'windows_credential_manager', cached: false };
  }

  /**
   * Extract token from macOS Keychain
   */
  private async extractFromMacOSKeychain(): Promise<OAuthExtractionResult> {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      // Try multiple service names that Claude Code might use
      const serviceNames = [
        'Claude Code-credentials',
        'Claude Code',
        'claude-code',
        'anthropic-claude-code'
      ];

      for (const serviceName of serviceNames) {
        try {
          const { stdout } = await execAsync(
            `security find-generic-password -s "${serviceName}" -w`
          );
          
          const token = stdout.trim();
          if (token && token.length > 10) { // Basic validation
            this.logger.debug(`OAuth token found in macOS Keychain: ${serviceName}`);
            return {
              token,
              source: 'macos_keychain',
              cached: false
            };
          }
        } catch (e) {
          this.logger.debug(`No keychain entry found for: ${serviceName}`);
        }
      }

    } catch (error) {
      this.logger.debug(`Failed to extract OAuth token from macOS Keychain: ${error}`);
    }

    return { token: null, source: 'macos_keychain', cached: false };
  }

  /**
   * Extract token from file system credentials
   */
  private async extractFromFileSystem(): Promise<OAuthExtractionResult> {
    try {
      const homeDir = os.homedir();
      
      // Comprehensive list of possible credential file locations
      const possiblePaths = [
        // Primary Claude configuration paths
        path.join(homeDir, '.claude', '.credentials.json'),
        path.join(homeDir, '.claude', 'credentials.json'),
        path.join(homeDir, '.claude', 'config', 'credentials.json'),
        path.join(homeDir, '.claude', 'auth', 'credentials.json'),
        
        // Standard XDG config paths
        path.join(homeDir, '.config', 'claude', 'credentials.json'),
        path.join(homeDir, '.config', 'claude', '.credentials.json'),
        path.join(homeDir, '.config', 'claude-code', 'credentials.json'),
        path.join(homeDir, '.config', 'anthropic', 'credentials.json'),
        
        // Legacy Anthropic paths
        path.join(homeDir, '.anthropic', 'credentials.json'),
        path.join(homeDir, '.anthropic', '.credentials.json'),
        path.join(homeDir, '.anthropic-ai', 'credentials.json'),
        
        // Windows AppData paths
        process.platform === 'win32' ? path.join(homeDir, 'AppData', 'Roaming', 'Claude', 'credentials.json') : null,
        process.platform === 'win32' ? path.join(homeDir, 'AppData', 'Local', 'Claude', 'credentials.json') : null,
        process.platform === 'win32' ? path.join(homeDir, 'AppData', 'Roaming', 'Anthropic', 'credentials.json') : null,
        
        // macOS-specific paths
        process.platform === 'darwin' ? path.join(homeDir, 'Library', 'Application Support', 'Claude', 'credentials.json') : null,
        process.platform === 'darwin' ? path.join(homeDir, 'Library', 'Preferences', 'claude', 'credentials.json') : null,
        process.platform === 'darwin' ? path.join(homeDir, 'Library', 'Application Support', 'Anthropic', 'credentials.json') : null,
        
        // Linux system paths
        process.platform === 'linux' ? '/etc/claude/credentials.json' : null,
        process.platform === 'linux' ? path.join(homeDir, '.local', 'share', 'claude', 'credentials.json') : null,
        process.platform === 'linux' ? path.join(homeDir, '.local', 'share', 'anthropic', 'credentials.json') : null,
        
        // Alternative naming conventions
        path.join(homeDir, '.claude-code', 'credentials.json'),
        path.join(homeDir, '.anthropic-claude', 'credentials.json'),
        path.join(homeDir, 'claude', 'credentials.json'),
        path.join(homeDir, 'claude-credentials.json'),
        path.join(homeDir, '.claude-credentials.json')
      ].filter(Boolean) as string[];

      // Additional environment-based paths
      if (process.env.CLAUDE_CONFIG_DIR) {
        possiblePaths.unshift(
          path.join(process.env.CLAUDE_CONFIG_DIR, 'credentials.json'),
          path.join(process.env.CLAUDE_CONFIG_DIR, '.credentials.json')
        );
      }

      if (process.env.XDG_CONFIG_HOME) {
        possiblePaths.push(
          path.join(process.env.XDG_CONFIG_HOME, 'claude', 'credentials.json'),
          path.join(process.env.XDG_CONFIG_HOME, 'anthropic', 'credentials.json')
        );
      }

      this.logger.debug(`Checking ${possiblePaths.length} potential credential file locations`);

      for (const credPath of possiblePaths) {
        if (fs.existsSync(credPath)) {
          this.logger.debug(`Found credential file: ${credPath}`);
          
          try {
            const credContent = fs.readFileSync(credPath, 'utf8');
            
            // Handle empty files
            if (!credContent.trim()) {
              this.logger.debug(`Credential file is empty: ${credPath}`);
              continue;
            }

            const creds: OAuthCredentials = JSON.parse(credContent);
            
            // Check for various token field names with priority order
            const tokenFields = [
              'oauth_token',
              'access_token', 
              'session_token',
              'auth_token',
              'token',
              'claude_token',
              'anthropic_token',
              'api_token'
            ];

            let token: string | undefined;
            let tokenField: string | undefined;

            for (const field of tokenFields) {
              if (creds[field as keyof OAuthCredentials]) {
                token = creds[field as keyof OAuthCredentials] as string;
                tokenField = field;
                break;
              }
            }

            if (token && token.trim()) {
              this.logger.debug(`OAuth token found in file: ${credPath} (field: ${tokenField})`);
              
              // Additional validation for token format
              if (this.isValidTokenFormat(token)) {
                return {
                  token: token.trim(),
                  source: 'file_system',
                  cached: false,
                  expires_at: creds.expires_at
                };
              } else {
                this.logger.debug(`Token found but format appears invalid: ${credPath}`);
              }
            } else {
              this.logger.debug(`No valid token found in file: ${credPath}`);
            }
          } catch (e) {
            this.logger.debug(`Failed to parse credentials file: ${credPath}, error: ${e}`);
            
            // Try to read as plain text token (fallback)
            try {
              const rawContent = fs.readFileSync(credPath, 'utf8').trim();
              if (rawContent && this.isValidTokenFormat(rawContent)) {
                this.logger.debug(`Plain text token found in file: ${credPath}`);
                return {
                  token: rawContent,
                  source: 'file_system',
                  cached: false
                };
              }
            } catch (rawError) {
              this.logger.debug(`Failed to read file as plain text: ${credPath}, error: ${rawError}`);
            }
          }
        }
      }

    } catch (error) {
      this.logger.debug(`Failed to extract OAuth token from file system: ${error}`);
    }

    return { token: null, source: 'file_system', cached: false };
  }

  /**
   * Validate token format (basic checks)
   */
  private isValidTokenFormat(token: string): boolean {
    if (!token || token.trim().length < 10) {
      return false;
    }

    // Check for common invalid patterns
    const invalidPatterns = [
      /^(null|undefined|none|empty)$/i,
      /^(test|demo|example|placeholder)$/i,
      /^\s*$/,
      /^[0-9]+$/, // Only numbers
      /^[a-zA-Z]+$/ // Only letters (tokens usually have mixed characters)
    ];

    return !invalidPatterns.some(pattern => pattern.test(token.trim()));
  }

  /**
   * Check for existing Claude sessions that might indicate authentication
   */
  private async checkExistingSessions(): Promise<OAuthExtractionResult> {
    try {
      const sessionsPath = path.join(os.homedir(), '.claude', 'projects');
      if (fs.existsSync(sessionsPath)) {
        const sessionFiles = fs.readdirSync(sessionsPath);
        
        for (const sessionFile of sessionFiles) {
          const sessionPath = path.join(sessionsPath, sessionFile, 'conversation.jsonl');
          if (fs.existsSync(sessionPath)) {
            const stats = fs.statSync(sessionPath);
            const hoursSinceModified = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
            
            // Only consider recent sessions (within 24 hours)
            if (hoursSinceModified < 24) {
              this.logger.debug(`Found recent active session: ${sessionFile}`);
              return {
                token: 'session-exists',
                source: 'session_exists',
                cached: false
              };
            }
          }
        }
      }

    } catch (error) {
      this.logger.debug(`Failed to check existing sessions: ${error}`);
    }

    return { token: null, source: 'session_exists', cached: false };
  }

  /**
   * Validate token format and expiry with comprehensive checks
   */
  validateToken(token: string, expiresAt?: string): boolean {
    if (!token || token.trim().length === 0) {
      this.logger.debug('Token validation failed: empty token');
      return false;
    }

    const trimmedToken = token.trim();

    // Special case for session indicator
    if (trimmedToken === 'session-exists') {
      return true;
    }

    // Basic length validation
    if (trimmedToken.length < 10) {
      this.logger.debug('Token validation failed: too short');
      return false;
    }

    if (trimmedToken.length > 2048) {
      this.logger.debug('Token validation failed: too long');
      return false;
    }

    // Format validation using the helper method
    if (!this.isValidTokenFormat(trimmedToken)) {
      this.logger.debug('Token validation failed: invalid format');
      return false;
    }

    // Advanced token format checks
    if (!this.isValidTokenStructure(trimmedToken)) {
      this.logger.debug('Token validation failed: invalid structure');
      return false;
    }

    // Check expiry if provided
    if (expiresAt) {
      if (!this.isTokenNotExpired(expiresAt)) {
        this.logger.debug('Token validation failed: expired');
        return false;
      }
    }

    this.logger.debug('Token validation passed');
    return true;
  }

  /**
   * Advanced token structure validation
   */
  private isValidTokenStructure(token: string): boolean {
    // Check for common OAuth token patterns
    const validPatterns = [
      // JWT tokens (header.payload.signature)
      /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
      
      // Bearer tokens (typically base64 or hex)
      /^[A-Za-z0-9+/=_-]{20,}$/,
      
      // API keys with prefixes
      /^(sk|pk|ak|at|bt|ct|dt)[-_][A-Za-z0-9+/=_-]{10,}$/i,
      
      // UUID-like tokens
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      
      // Base64-encoded tokens
      /^[A-Za-z0-9+/]{16,}={0,2}$/,
      
      // Hex tokens
      /^[0-9a-f]{20,}$/i,
      
      // Mixed alphanumeric with special chars (common for session tokens)
      /^[A-Za-z0-9._-]{20,}$/
    ];

    return validPatterns.some(pattern => pattern.test(token));
  }

  /**
   * Check if token is not expired with buffer time
   */
  private isTokenNotExpired(expiresAt: string, bufferMinutes: number = 5): boolean {
    try {
      const expiryDate = new Date(expiresAt);
      
      // Check if the date is valid
      if (isNaN(expiryDate.getTime())) {
        this.logger.debug(`Invalid expiry date format: ${expiresAt}`);
        return true; // Assume valid if we can't parse the date
      }

      // Add buffer time to current date to ensure token won't expire immediately
      const now = new Date();
      const bufferTime = new Date(now.getTime() + bufferMinutes * 60 * 1000);
      
      if (expiryDate <= bufferTime) {
        this.logger.debug(`Token expires at ${expiresAt}, which is within ${bufferMinutes} minutes`);
        return false;
      }

      const timeUntilExpiry = expiryDate.getTime() - now.getTime();
      const hoursUntilExpiry = timeUntilExpiry / (1000 * 60 * 60);
      
      this.logger.debug(`Token expires in ${hoursUntilExpiry.toFixed(2)} hours`);
      return true;
      
    } catch (e) {
      this.logger.debug(`Error checking token expiry: ${e}`);
      return true; // Assume valid if we can't check expiry
    }
  }

  /**
   * Enhanced token validation with security checks
   */
  validateTokenSecurity(token: string): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];
    
    if (!token || token.trim().length === 0) {
      issues.push('Token is empty');
      return { isValid: false, issues };
    }

    const trimmedToken = token.trim();

    // Check for common security issues
    if (trimmedToken === 'session-exists') {
      return { isValid: true, issues: [] }; // Special case
    }

    // Length checks
    if (trimmedToken.length < 10) {
      issues.push('Token is too short (minimum 10 characters)');
    }

    if (trimmedToken.length > 2048) {
      issues.push('Token is too long (maximum 2048 characters)');
    }

    // Entropy check (basic randomness)
    if (this.hasLowEntropy(trimmedToken)) {
      issues.push('Token appears to have low entropy (not random enough)');
    }

    // Common weak patterns
    if (/^(1234|test|demo|sample|example)/i.test(trimmedToken)) {
      issues.push('Token appears to be a test or example token');
    }

    // Repeated characters
    if (/(.)\1{10,}/.test(trimmedToken)) {
      issues.push('Token contains too many repeated characters');
    }

    // Only printable ASCII characters
    if (!/^[\x20-\x7E]+$/.test(trimmedToken)) {
      issues.push('Token contains non-printable or non-ASCII characters');
    }

    // Structure validation
    if (!this.isValidTokenStructure(trimmedToken)) {
      issues.push('Token does not match any known token format patterns');
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * Simple entropy check for token randomness
   */
  private hasLowEntropy(token: string): boolean {
    const charCounts = new Map<string, number>();
    
    for (const char of token) {
      charCounts.set(char, (charCounts.get(char) || 0) + 1);
    }

    // Calculate Shannon entropy approximation
    let entropy = 0;
    const len = token.length;
    
    for (const count of charCounts.values()) {
      const probability = count / len;
      entropy -= probability * Math.log2(probability);
    }

    // Consider entropy less than 3.0 as low (rule of thumb)
    return entropy < 3.0;
  }

  /**
   * Refresh token if possible
   */
  async refreshToken(refreshToken?: string): Promise<OAuthExtractionResult> {
    if (!refreshToken) {
      return { token: null, source: 'none', cached: false, error: 'No refresh token provided' };
    }

    try {
      // This would typically make an API call to refresh the token
      // For now, we'll just return an error as the actual refresh logic
      // would depend on Claude Code's authentication service
      this.logger.debug('Token refresh not implemented yet');
      return {
        token: null,
        source: 'none',
        cached: false,
        error: 'Token refresh not implemented'
      };
    } catch (error) {
      return {
        token: null,
        source: 'none',
        cached: false,
        error: `Token refresh failed: ${error}`
      };
    }
  }

  /**
   * Cache token with expiry
   */
  private cacheToken(key: string, token: string, expiresAt?: string): void {
    this.tokenCache.set(key, {
      token,
      timestamp: Date.now(),
      expires_at: expiresAt
    });
  }

  /**
   * Check if cached token is still valid
   */
  private isCacheValid(cached: { token: string; timestamp: number; expires_at?: string }): boolean {
    // Check cache expiry
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
        // Invalid date format, consider invalid
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
  }

  /**
   * Get cache status for debugging
   */
  getCacheStatus(): { size: number; entries: Array<{ key: string; timestamp: Date; expires_at?: string }> } {
    const entries = Array.from(this.tokenCache.entries()).map(([key, value]) => ({
      key,
      timestamp: new Date(value.timestamp),
      expires_at: value.expires_at
    }));

    return { size: this.tokenCache.size, entries };
  }
}