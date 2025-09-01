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
   * Extract token from environment variables
   */
  private async extractFromEnvironment(): Promise<OAuthExtractionResult> {
    try {
      const token = process.env.CLAUDE_CODE_OAUTH_TOKEN;
      if (token && token.trim()) {
        this.logger.debug('OAuth token found in environment variable');
        return {
          token: token.trim(),
          source: 'environment',
          cached: false
        };
      }
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
        'anthropic-claude-code'
      ];

      for (const credName of credentialNames) {
        try {
          const { stdout } = await execAsync(
            `powershell.exe -Command "Get-StoredCredential -Target '${credName}' | ConvertTo-Json"`
          );
          
          const cred = JSON.parse(stdout);
          if (cred && cred.Password) {
            this.logger.debug(`OAuth token found in Windows Credential Manager: ${credName}`);
            return {
              token: cred.Password,
              source: 'windows_credential_manager',
              cached: false
            };
          }
        } catch (e) {
          // Continue to next credential name
          this.logger.debug(`No credential found for: ${credName}`);
        }
      }

      // Fallback: Try cmdkey command
      try {
        const { stdout } = await execAsync('cmdkey /list | findstr "Claude"');
        if (stdout.includes('Claude')) {
          this.logger.debug('Claude credentials detected in Windows Credential Manager');
          // This indicates presence but we'd need the actual token extraction
        }
      } catch (e) {
        this.logger.debug('No Claude credentials in Windows Credential Manager');
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
      const possiblePaths = [
        path.join(os.homedir(), '.claude', '.credentials.json'),
        path.join(os.homedir(), '.config', 'claude', 'credentials.json'),
        path.join(os.homedir(), '.anthropic', 'credentials.json'),
      ];

      for (const credPath of possiblePaths) {
        if (fs.existsSync(credPath)) {
          try {
            const credContent = fs.readFileSync(credPath, 'utf8');
            const creds: OAuthCredentials = JSON.parse(credContent);
            
            // Check for various token fields
            const token = creds.oauth_token || creds.session_token;
            if (token) {
              this.logger.debug(`OAuth token found in file: ${credPath}`);
              return {
                token,
                source: 'file_system',
                cached: false,
                expires_at: creds.expires_at
              };
            }
          } catch (e) {
            this.logger.debug(`Failed to parse credentials file: ${credPath}, error: ${e}`);
          }
        }
      }

    } catch (error) {
      this.logger.debug(`Failed to extract OAuth token from file system: ${error}`);
    }

    return { token: null, source: 'file_system', cached: false };
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
   * Validate token format and expiry
   */
  validateToken(token: string, expiresAt?: string): boolean {
    if (!token || token.trim().length === 0) {
      return false;
    }

    // Special case for session indicator
    if (token === 'session-exists') {
      return true;
    }

    // Basic token format validation
    if (token.length < 10) {
      return false;
    }

    // Check expiry if provided
    if (expiresAt) {
      try {
        const expiryDate = new Date(expiresAt);
        if (expiryDate <= new Date()) {
          this.logger.debug('Token has expired');
          return false;
        }
      } catch (e) {
        this.logger.debug(`Invalid expiry date format: ${expiresAt}`);
      }
    }

    return true;
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