import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Logger } from '../logger';
import { CredentialManager } from './credentialProviders';

export interface OAuthCredentials {
  oauth_token?: string;
  session_token?: string;
  refresh_token?: string;
  expires_at?: string;
}

export interface OAuthExtractionResult {
  token: string | null;
  source: 'environment' | 'credential_manager' | 'file_system' | 'session_exists' | 'none';
  cached: boolean;
  expires_at?: string;
  error?: string;
  provider?: string;
}

/**
 * Enhanced OAuth Token Extractor for Claude Code
 * Uses multiple credential providers with graceful fallbacks
 */
export class EnhancedOAuthExtractor {
  private logger: Logger;
  private credentialManager: CredentialManager;
  private tokenCache: Map<string, { token: string; timestamp: number; expires_at?: string }> = new Map();
  private cacheExpiryMs: number = 5 * 60 * 1000; // 5 minutes
  
  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
    this.credentialManager = new CredentialManager(this.logger);
  }

  /**
   * Extract OAuth token with enhanced provider support
   */
  async extractOAuthToken(): Promise<OAuthExtractionResult> {
    // Check cache first
    const cacheKey = 'oauth_token';
    const cached = this.tokenCache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      this.logger.debug('Using cached OAuth token');
      return {
        token: cached.token,
        source: 'environment',
        cached: true,
        expires_at: cached.expires_at
      };
    }

    // 1. Environment variable override (highest priority)
    const envResult = await this.extractFromEnvironment();
    if (envResult.token) {
      this.cacheToken(cacheKey, envResult.token, envResult.expires_at);
      return envResult;
    }

    // 2. Enhanced credential manager (keytar, platform-specific, file system)
    const credResult = await this.extractFromCredentialManager();
    if (credResult.token) {
      this.cacheToken(cacheKey, credResult.token, credResult.expires_at);
      return credResult;
    }

    // 3. Legacy file system credentials
    const fileResult = await this.extractFromFileSystem();
    if (fileResult.token) {
      this.cacheToken(cacheKey, fileResult.token, fileResult.expires_at);
      return fileResult;
    }

    // 4. Check for existing Claude sessions
    const sessionResult = await this.checkExistingSessions();
    if (sessionResult.token) {
      return sessionResult;
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
      const token = process.env.CLAUDE_CODE_OAUTH_TOKEN || process.env.ANTHROPIC_API_KEY;
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
   * Extract token using enhanced credential manager
   */
  private async extractFromCredentialManager(): Promise<OAuthExtractionResult> {
    try {
      const services = [
        'Claude Code',
        'claude-code',
        'anthropic-claude-code',
        'Claude Code-credentials'
      ];

      const accounts = ['default', 'oauth', 'session'];

      for (const service of services) {
        for (const account of accounts) {
          try {
            const token = await this.credentialManager.getToken(service, account);
            if (token && token.length > 10) {
              const providers = this.credentialManager.getProviders();
              const providerName = providers.length > 0 ? providers[0].name : 'unknown';
              
              this.logger.debug(`OAuth token found via credential manager: ${service}:${account} (${providerName})`);
              return {
                token,
                source: 'credential_manager',
                cached: false,
                provider: providerName
              };
            }
          } catch (error) {
            this.logger.debug(`Credential manager lookup failed for ${service}:${account}: ${error}`);
          }
        }
      }

    } catch (error) {
      this.logger.debug(`Enhanced credential manager extraction failed: ${error}`);
    }

    return { token: null, source: 'credential_manager', cached: false };
  }

  /**
   * Extract token from file system credentials (legacy support)
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
   * Check for existing Claude sessions
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
   * Store OAuth token using credential manager
   */
  async storeOAuthToken(token: string, service: string = 'Claude Code', account: string = 'default'): Promise<void> {
    try {
      await this.credentialManager.setToken(service, account, token);
      this.logger.info(`OAuth token stored via credential manager`);
      
      // Clear cache to force fresh lookup next time
      this.clearCache();
    } catch (error) {
      this.logger.error(`Failed to store OAuth token: ${error}`);
      throw error;
    }
  }

  /**
   * Delete OAuth token from credential manager
   */
  async deleteOAuthToken(service: string = 'Claude Code', account: string = 'default'): Promise<void> {
    try {
      await this.credentialManager.deleteToken(service, account);
      this.logger.info(`OAuth token deleted from credential manager`);
      
      // Clear cache
      this.clearCache();
    } catch (error) {
      this.logger.error(`Failed to delete OAuth token: ${error}`);
      throw error;
    }
  }

  /**
   * List all stored OAuth tokens
   */
  async listStoredTokens(): Promise<{ service: string; accounts: string[] }[]> {
    const services = [
      'Claude Code',
      'claude-code',
      'anthropic-claude-code',
      'Claude Code-credentials'
    ];

    const results: { service: string; accounts: string[] }[] = [];

    for (const service of services) {
      try {
        const accounts = await this.credentialManager.listAccounts(service);
        if (accounts.length > 0) {
          results.push({ service, accounts });
        }
      } catch (error) {
        this.logger.debug(`Failed to list accounts for ${service}: ${error}`);
      }
    }

    return results;
  }

  /**
   * Test all credential providers
   */
  async testCredentialProviders(): Promise<Record<string, boolean>> {
    return await this.credentialManager.testProviders();
  }

  /**
   * Get available credential providers
   */
  getAvailableProviders(): string[] {
    return this.credentialManager.getProviders().map(p => p.name);
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
   * Refresh token if possible (placeholder for future implementation)
   */
  async refreshToken(refreshToken?: string): Promise<OAuthExtractionResult> {
    if (!refreshToken) {
      return { token: null, source: 'none', cached: false, error: 'No refresh token provided' };
    }

    try {
      // This would typically make an API call to refresh the token
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

  /**
   * Run comprehensive diagnostics
   */
  async runDiagnostics(): Promise<{
    environment: boolean;
    credentialProviders: Record<string, boolean>;
    fileSystemPaths: Record<string, boolean>;
    activeSessions: number;
    cacheStatus: { size: number; entries: any[] };
  }> {
    const diagnostics = {
      environment: !!process.env.CLAUDE_CODE_OAUTH_TOKEN || !!process.env.ANTHROPIC_API_KEY,
      credentialProviders: await this.testCredentialProviders(),
      fileSystemPaths: {} as Record<string, boolean>,
      activeSessions: 0,
      cacheStatus: this.getCacheStatus()
    };

    // Test file system paths
    const possiblePaths = [
      path.join(os.homedir(), '.claude', '.credentials.json'),
      path.join(os.homedir(), '.config', 'claude', 'credentials.json'),
      path.join(os.homedir(), '.anthropic', 'credentials.json'),
    ];

    for (const credPath of possiblePaths) {
      diagnostics.fileSystemPaths[credPath] = fs.existsSync(credPath);
    }

    // Count active sessions
    try {
      const sessionsPath = path.join(os.homedir(), '.claude', 'projects');
      if (fs.existsSync(sessionsPath)) {
        const sessionFiles = fs.readdirSync(sessionsPath);
        for (const sessionFile of sessionFiles) {
          const conversationPath = path.join(sessionsPath, sessionFile, 'conversation.jsonl');
          if (fs.existsSync(conversationPath)) {
            const stats = fs.statSync(conversationPath);
            const hoursSinceModified = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
            if (hoursSinceModified < 24) {
              diagnostics.activeSessions++;
            }
          }
        }
      }
    } catch (error) {
      this.logger.debug(`Session counting failed: ${error}`);
    }

    return diagnostics;
  }
}