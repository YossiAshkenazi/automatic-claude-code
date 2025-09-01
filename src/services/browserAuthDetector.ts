import { execSync } from 'child_process';
import { Logger } from '../logger';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface BrowserAuthStatus {
  isAuthenticated: boolean;
  authMethod: 'browser' | 'api_key' | 'none';
  sessionActive: boolean;
  details: string;
  lastChecked: Date;
}

/**
 * Browser Authentication Detector
 * Detects and validates Claude browser authentication status
 */
export class BrowserAuthDetector {
  private logger: Logger;
  private lastAuthCheck?: BrowserAuthStatus;
  private cacheTimeout = 30000; // 30 seconds cache

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Comprehensive browser authentication detection
   */
  async detectBrowserAuth(): Promise<BrowserAuthStatus> {
    // Use cached result if recent and valid
    if (this.lastAuthCheck && 
        (Date.now() - this.lastAuthCheck.lastChecked.getTime()) < this.cacheTimeout) {
      this.logger.debug('Using cached browser auth status');
      return this.lastAuthCheck;
    }

    this.logger.debug('Checking browser authentication status...');
    
    const status: BrowserAuthStatus = {
      isAuthenticated: false,
      authMethod: 'none',
      sessionActive: false,
      details: 'Checking...',
      lastChecked: new Date()
    };

    try {
      // Method 1: Check if API key is available (highest priority)
      if (await this.checkAPIKeyAuth()) {
        status.isAuthenticated = true;
        status.authMethod = 'api_key';
        status.sessionActive = true;
        status.details = 'API key authentication available';
        this.logger.debug('✅ API key authentication detected');
      }
      // Method 2: Check Claude CLI authentication status
      else if (await this.checkCLIAuth()) {
        status.isAuthenticated = true;
        status.authMethod = 'browser';
        status.sessionActive = true;
        status.details = 'Claude CLI browser authentication verified';
        this.logger.debug('✅ Claude CLI browser authentication verified');
      }
      // Method 3: Check browser session files
      else if (await this.checkBrowserSessionFiles()) {
        status.isAuthenticated = true;
        status.authMethod = 'browser';
        status.sessionActive = true;
        status.details = 'Browser session files detected';
        this.logger.debug('✅ Browser session files detected');
      }
      // Method 4: Test with a simple Claude command
      else if (await this.testClaudeConnection()) {
        status.isAuthenticated = true;
        status.authMethod = 'browser';
        status.sessionActive = true;
        status.details = 'Claude connection test successful';
        this.logger.debug('✅ Claude connection test successful');
      }
      else {
        status.details = 'No authentication method available. Please authenticate Claude CLI or set API key.';
        this.logger.debug('❌ No authentication method detected');
      }
    } catch (error) {
      status.details = `Authentication check failed: ${error instanceof Error ? error.message : String(error)}`;
      this.logger.debug(`❌ Browser auth detection failed: ${status.details}`);
    }

    this.lastAuthCheck = status;
    return status;
  }

  /**
   * Check if API key is available in environment
   */
  private async checkAPIKeyAuth(): Promise<boolean> {
    const hasApiKey = !!(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY);
    if (hasApiKey) {
      this.logger.debug('API key found in environment variables');
      return true;
    }
    
    // Check .env files in current directory
    try {
      const envFiles = ['.env', '.env.local', '.env.production'];
      for (const envFile of envFiles) {
        if (fs.existsSync(envFile)) {
          const content = fs.readFileSync(envFile, 'utf-8');
          if (content.includes('ANTHROPIC_API_KEY') || content.includes('CLAUDE_API_KEY')) {
            this.logger.debug(`API key found in ${envFile}`);
            return true;
          }
        }
      }
    } catch (error) {
      this.logger.debug('Error checking .env files:', error);
    }

    return false;
  }

  /**
   * Check Claude CLI authentication status
   */
  private async checkCLIAuth(): Promise<boolean> {
    try {
      // Try to run a simple authenticated command
      const result = execSync('claude --version', { 
        stdio: 'pipe', 
        timeout: 10000,
        encoding: 'utf-8'
      });
      
      if (result && !result.toLowerCase().includes('error')) {
        // Try a simple test command that requires authentication
        try {
          const testResult = execSync('claude -p "Hello, just respond with OK"', {
            stdio: 'pipe',
            timeout: 15000,
            encoding: 'utf-8'
          });
          
          const isAuthenticated = testResult.toLowerCase().includes('ok') || 
                                testResult.toLowerCase().includes('hello');
          
          this.logger.debug(`Claude CLI test result: ${testResult.substring(0, 100)}...`);
          return isAuthenticated;
        } catch (testError) {
          this.logger.debug('Claude CLI test command failed:', testError);
          return false;
        }
      }
      
      return false;
    } catch (error) {
      this.logger.debug('Claude CLI version check failed:', error);
      return false;
    }
  }

  /**
   * Check for browser session files in common locations
   */
  private async checkBrowserSessionFiles(): Promise<boolean> {
    const homeDir = os.homedir();
    const possibleSessionPaths = [
      // Claude CLI config paths
      path.join(homeDir, '.claude'),
      path.join(homeDir, '.claude', 'config'),
      path.join(homeDir, '.config', 'claude'),
      
      // Browser session paths (common locations)
      path.join(homeDir, '.anthropic'),
      path.join(homeDir, 'AppData', 'Local', 'Claude'),
      path.join(homeDir, 'Library', 'Application Support', 'Claude'),
      
      // Alternative config locations
      path.join(process.cwd(), '.claude'),
      '/tmp/.claude',
    ];

    for (const sessionPath of possibleSessionPaths) {
      try {
        if (fs.existsSync(sessionPath)) {
          const stats = fs.statSync(sessionPath);
          if (stats.isDirectory()) {
            // Check for config files or tokens
            const files = fs.readdirSync(sessionPath);
            const hasSessionFiles = files.some(file => 
              file.includes('config') || 
              file.includes('token') || 
              file.includes('session') ||
              file.includes('auth')
            );
            
            if (hasSessionFiles) {
              this.logger.debug(`Session files found in: ${sessionPath}`);
              return true;
            }
          } else if (stats.isFile()) {
            // Check if it's a config file
            if (sessionPath.includes('config') || sessionPath.includes('auth')) {
              this.logger.debug(`Session config file found: ${sessionPath}`);
              return true;
            }
          }
        }
      } catch (error) {
        // Silently continue to next path
        continue;
      }
    }

    return false;
  }

  /**
   * Test Claude connection with a simple command
   */
  private async testClaudeConnection(): Promise<boolean> {
    try {
      // Test different Claude command variations
      const testCommands = [
        'claude --version',
        'npx @anthropic-ai/claude-code --version',
        'claude-code --version'
      ];

      for (const command of testCommands) {
        try {
          const result = execSync(command, {
            stdio: 'pipe',
            timeout: 10000,
            encoding: 'utf-8'
          });

          if (result && result.includes('claude')) {
            this.logger.debug(`Successful command: ${command}`);
            return true;
          }
        } catch (cmdError) {
          // Continue to next command
          continue;
        }
      }

      return false;
    } catch (error) {
      this.logger.debug('Claude connection test failed:', error);
      return false;
    }
  }

  /**
   * Force refresh authentication status (bypass cache)
   */
  async refreshAuthStatus(): Promise<BrowserAuthStatus> {
    this.lastAuthCheck = undefined;
    return this.detectBrowserAuth();
  }

  /**
   * Get authentication guidance based on current status
   */
  getAuthGuidance(status: BrowserAuthStatus): string[] {
    const guidance: string[] = [];

    if (status.isAuthenticated) {
      guidance.push('✅ Authentication is working');
      guidance.push(`📋 Method: ${status.authMethod.replace('_', ' ').toUpperCase()}`);
      return guidance;
    }

    // Provide specific guidance based on what's missing
    guidance.push('❌ No authentication detected');
    guidance.push('');
    guidance.push('🔧 Setup Options:');
    guidance.push('');
    guidance.push('Option 1 (Recommended): Browser Authentication');
    guidance.push('  1. Run: claude auth');
    guidance.push('  2. Follow the browser login prompts');
    guidance.push('  3. Keep browser session active');
    guidance.push('');
    guidance.push('Option 2: API Key Authentication');
    guidance.push('  1. Get API key from: https://console.anthropic.com');
    guidance.push('  2. Set: export ANTHROPIC_API_KEY="your-key-here"');
    guidance.push('  3. Or create .env file with API key');
    guidance.push('');
    guidance.push('Option 3: Install Claude CLI');
    guidance.push('  1. npm install -g @anthropic-ai/claude-code');
    guidance.push('  2. Run: claude auth');

    return guidance;
  }

  /**
   * Wait for authentication to become available
   */
  async waitForAuth(timeoutMs: number = 60000): Promise<BrowserAuthStatus> {
    const startTime = Date.now();
    const checkInterval = 2000; // Check every 2 seconds

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.refreshAuthStatus();
      
      if (status.isAuthenticated) {
        this.logger.info('✅ Authentication detected!');
        return status;
      }

      this.logger.debug(`⏳ Waiting for authentication... (${Math.round((Date.now() - startTime) / 1000)}s)`);
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    throw new Error(`Authentication timeout after ${timeoutMs}ms`);
  }

  /**
   * Clear authentication cache
   */
  clearCache(): void {
    this.lastAuthCheck = undefined;
  }
}