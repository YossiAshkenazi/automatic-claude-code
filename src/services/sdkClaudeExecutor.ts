import { Logger } from '../logger';
// Temporarily disabled due to TS errors: import { BrowserSessionManager } from './browserSessionManager';

// We'll dynamically import the SDK to handle cases where it might not be installed locally
let claudeSDK: any = null;

export interface SDKClaudeOptions {
  model?: 'sonnet' | 'opus';
  workDir?: string;
  sessionId?: string;
  verbose?: boolean;
  timeout?: number;
  allowedTools?: string;
}

/**
 * SDK-based Claude executor using the official TypeScript SDK
 * This works with browser authentication (no API key needed)
 */
export class SDKClaudeExecutor {
  private logger: Logger;
  private isSDKAvailable: boolean = false;
  // private browserSessionManager: BrowserSessionManager;

  constructor(logger: Logger) {
    this.logger = logger;
    // this.browserSessionManager = new BrowserSessionManager(logger);
    // Initialize SDK asynchronously without blocking constructor
    this.initializeSDK().catch(() => {
      // Initialization failed, will retry during execution
      this.isSDKAvailable = false;
    });
  }

  /**
   * Get dynamic search paths for Claude Code SDK
   */
  private getSDKSearchPaths(): string[] {
    const paths: string[] = [];
    const os = require('os');
    const path = require('path');
    
    // Get current user's home directory
    const userHome = process.env.USERPROFILE || process.env.HOME || os.homedir();
    const currentUser = os.userInfo().username;
    
    // Add npm prefix path if available
    if (process.env.npm_config_prefix) {
      paths.push(`${process.env.npm_config_prefix}/lib/node_modules`);
    }
    
    // Add user-specific npm global paths
    if (userHome) {
      paths.push(`${userHome}/.npm-global/lib/node_modules`);
      paths.push(`${userHome}/AppData/Roaming/npm/node_modules`);
      paths.push(`${userHome}/AppData/Local/npm/node_modules`);
    }
    
    // Add pnpm global paths (common on Windows)
    if (process.env.LOCALAPPDATA || process.env.APPDATA) {
      const localAppData = process.env.LOCALAPPDATA || path.join(userHome, 'AppData', 'Local');
      const appData = process.env.APPDATA || path.join(userHome, 'AppData', 'Roaming');
      
      // Add pnpm paths
      paths.push(`${localAppData}/pnpm/global/5/.pnpm/@anthropic-ai+claude-code@*/node_modules`);
      paths.push(`${appData}/npm/node_modules`);
    }
    
    // Standard system-wide paths
    paths.push('/usr/local/lib/node_modules');
    paths.push('/usr/lib/node_modules');
    
    // Current working directory node_modules
    paths.push('./node_modules');
    paths.push('../node_modules');
    
    this.logger.debug(`SDK search paths: ${paths.join(', ')}`);
    return paths;
  }

  /**
   * Find the actual SDK path on the filesystem
   */
  private async findSDKPath(): Promise<string | null> {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    
    const userHome = process.env.USERPROFILE || process.env.HOME || os.homedir();
    const localAppData = process.env.LOCALAPPDATA || path.join(userHome, 'AppData', 'Local');
    
    // First, try to find the exact path from our known working location
    const knownWorkingPath = 'C:\\Users\\yossi\\AppData\\Local\\pnpm\\global\\5\\.pnpm\\@anthropic-ai+claude-code@1.0.92\\node_modules\\@anthropic-ai\\claude-code\\sdk.mjs';
    
    // Convert to current user
    const currentUserPath = knownWorkingPath.replace('C:\\Users\\yossi', userHome);
    
    // Direct path checks (most likely to succeed)
    const searchPaths = [
      currentUserPath,
      
      // Try different version patterns
      ...this.generateVersionPaths(localAppData, 'pnpm', 'global', '5', '.pnpm'),
      ...this.generateVersionPaths(localAppData, 'pnpm', 'global', '6', '.pnpm'),
      ...this.generateVersionPaths(localAppData, 'pnpm', 'global', '7', '.pnpm'),
      
      // npm global locations
      path.join(userHome, 'AppData', 'Roaming', 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'sdk.mjs'),
      path.join(userHome, '.npm-global', 'node_modules', '@anthropic-ai', 'claude-code', 'sdk.mjs'),
      
      // System-wide paths
      'C:\\Program Files\\nodejs\\node_modules\\@anthropic-ai\\claude-code\\sdk.mjs',
      '/usr/local/lib/node_modules/@anthropic-ai/claude-code/sdk.mjs',
      '/usr/lib/node_modules/@anthropic-ai/claude-code/sdk.mjs',
    ];
    
    for (const searchPath of searchPaths) {
      try {
        if (fs.existsSync(searchPath)) {
          this.logger.debug(`Found SDK at: ${searchPath}`);
          return searchPath;
        }
      } catch (error) {
        this.logger.debug(`Search failed for ${searchPath}: ${error}`);
        continue;
      }
    }
    
    this.logger.debug('No SDK path found in any search location');
    return null;
  }
  
  /**
   * Generate potential paths for different Claude Code versions
   */
  private generateVersionPaths(localAppData: string, ...pathParts: string[]): string[] {
    const fs = require('fs');
    const path = require('path');
    
    const basePath = path.join(localAppData, ...pathParts);
    const paths: string[] = [];
    
    try {
      if (fs.existsSync(basePath)) {
        const entries = fs.readdirSync(basePath);
        
        // Look for @anthropic-ai+claude-code@* directories
        const claudeDirs = entries.filter((entry: string) => 
          entry.startsWith('@anthropic-ai+claude-code@')
        );
        
        for (const claudeDir of claudeDirs) {
          const fullPath = path.join(basePath, claudeDir, 'node_modules', '@anthropic-ai', 'claude-code', 'sdk.mjs');
          paths.push(fullPath);
        }
      }
    } catch (error) {
      // Ignore errors from directory scanning
    }
    
    return paths;
  }

  /**
   * Initialize the Claude Code SDK
   */
  private async initializeSDK(): Promise<void> {
    try {
      // Claude Code is an ESM module, so we need to use dynamic import
      this.logger.debug('Attempting to load Claude Code SDK via dynamic import...');
      
      // First try direct dynamic import (works if SDK is in node_modules)
      try {
        const sdkModule = await import('@anthropic-ai/claude-code');
        if (sdkModule && ((sdkModule as any).query || (sdkModule as any).default?.query)) {
          claudeSDK = (sdkModule as any).default || sdkModule;
          this.isSDKAvailable = true;
          this.logger.debug('Claude Code SDK loaded via dynamic import');
          return;
        }
      } catch (importError) {
        this.logger.debug(`Direct import failed: ${importError}`);
      }
      
      // Try to find SDK path and import it
      const sdkPath = await this.findSDKPath();
      if (sdkPath) {
        try {
          // Convert Windows paths to file:// URLs for dynamic import
          const fileUrl = process.platform === 'win32' ? 
            `file:///${sdkPath.replace(/\\/g, '/')}` : 
            `file://${sdkPath}`;
          
          const sdkModule = await import(fileUrl);
          if (sdkModule && (sdkModule.query || sdkModule.default?.query)) {
            claudeSDK = sdkModule.default || sdkModule;
            this.isSDKAvailable = true;
            this.logger.debug(`Claude Code SDK loaded from: ${sdkPath}`);
            return;
          }
        } catch (fileImportError) {
          this.logger.debug(`File import failed for ${sdkPath}: ${fileImportError}`);
        }
      }
      
      throw new Error('Claude Code SDK not found or not accessible');
      
    } catch (error) {
      this.logger.debug(`SDK initialization failed: ${error}`);
      this.logger.warning('Claude Code SDK not available. Install with: npm install -g @anthropic-ai/claude-code');
      this.isSDKAvailable = false;
    }
  }

  /**
   * Check if browser session is active and Claude is authenticated
   */
  async checkBrowserAuthentication(): Promise<boolean> {
    try {
      const sessionStatus = await this.browserSessionManager.checkBrowserSessions();
      
      this.logger.debug('Browser session status:', {
        hasActiveSessions: sessionStatus.hasActiveSessions,
        claudeTabsOpen: sessionStatus.claudeTabsOpen,
        authenticatedSessions: sessionStatus.authenticatedSessions,
        issues: sessionStatus.issues
      });
      
      if (!sessionStatus.hasActiveSessions) {
        this.logger.debug('No active browser sessions with Claude authentication found');
        return false;
      }
      
      if (sessionStatus.claudeTabsOpen === 0) {
        this.logger.debug('No Claude tabs open in any browser');
        return false;
      }
      
      return sessionStatus.authenticatedSessions > 0;
      
    } catch (error) {
      this.logger.debug(`Browser authentication check failed: ${error}`);
      return false;
    }
  }

  /**
   * Execute Claude using the SDK
   */
  async executeWithSDK(
    prompt: string,
    options: SDKClaudeOptions = {}
  ): Promise<{ output: string; exitCode: number }> {
    // Ensure SDK is loaded
    if (!this.isSDKAvailable) {
      await this.initializeSDK();
      if (!this.isSDKAvailable) {
        throw new Error('Claude Code SDK is not available. Please install it globally: npm install -g @anthropic-ai/claude-code');
      }
    }

    if (!claudeSDK || !(claudeSDK.query || claudeSDK.default?.query)) {
      throw new Error('Claude Code SDK query function not available');
    }
    
    // Check browser authentication before proceeding
    const isAuthenticated = await this.checkBrowserAuthentication();
    if (!isAuthenticated) {
      this.logger.info('Browser authentication required for SDK execution');
      this.logger.info('Please ensure Claude is open in your browser and you are logged in');
      throw new Error('Browser authentication required. Please open claude.ai in your browser and log in.');
    }

    return new Promise(async (resolve, reject) => {
      let output = '';
      let hasError = false;
      const timeoutMs = options.timeout || 120000;

      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        hasError = true;
        reject(new Error(`Claude execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      try {
        if (options.verbose) {
          this.logger.debug(`Executing Claude via SDK with prompt: ${prompt.substring(0, 100)}...`);
        }

        // Prepare SDK options
        const sdkOptions: any = {
          maxTurns: 1, // Single turn for each prompt
          model: options.model || 'sonnet',
        };

        // Add allowed tools if specified
        if (options.allowedTools) {
          sdkOptions.allowedTools = options.allowedTools.split(',').map(t => t.trim());
        }

        // Add session continuation if we have a session ID
        if (options.sessionId) {
          sdkOptions.continue = options.sessionId;
        }

        // Use the SDK's query function (handle both direct and default export)
        const queryFunction = claudeSDK.query || claudeSDK.default?.query;
        const messages = queryFunction({
          prompt: prompt,
          options: sdkOptions
        });

        // Process messages from the async iterator
        for await (const message of messages) {
          if (hasError) break;

          if (options.verbose && message.type !== 'result') {
            this.logger.debug(`SDK message type: ${message.type}`);
          }

          // Handle different message types
          switch (message.type) {
            case 'result':
              // This is Claude's response
              output += message.result || '';
              if (options.verbose) {
                this.logger.debug(`Claude response: ${message.result?.substring(0, 200)}...`);
              }
              break;
            
            case 'tool_use':
              // Tool was used
              if (options.verbose) {
                this.logger.debug(`Tool used: ${message.tool}`);
              }
              break;

            case 'error':
              // Error occurred
              hasError = true;
              clearTimeout(timeoutHandle);
              reject(new Error(message.error || 'Unknown SDK error'));
              return;

            case 'session':
              // Session information
              if (message.sessionId && options.verbose) {
                this.logger.debug(`Session ID: ${message.sessionId}`);
              }
              break;

            case 'stream':
              // Streaming output
              if (message.content) {
                output += message.content;
              }
              break;

            default:
              // Other message types
              if (options.verbose) {
                this.logger.debug(`Unhandled message type: ${message.type}`);
              }
          }
        }

        clearTimeout(timeoutHandle);

        // Successfully completed
        resolve({
          output: output.trim() || 'No output received from Claude',
          exitCode: 0
        });

      } catch (error: any) {
        clearTimeout(timeoutHandle);
        
        // Check if it's an authentication error
        if (error.message && (
          error.message.includes('authenticate') || 
          error.message.includes('sign in') ||
          error.message.includes('login')
        )) {
          console.log('\n🔐 Authentication required!');
          console.log('Please run "claude" in your terminal and complete authentication.');
          console.log('Then try again.\n');
          reject(new Error('Claude authentication required'));
        } else {
          reject(error);
        }
      }
    });
  }

  /**
   * Check browser authentication status
   */
  async checkBrowserAuthentication(): Promise<boolean> {
    try {
      const status = await this.browserSessionManager.checkBrowserSessions();
      
      if (status.hasActiveSessions && status.authenticatedSessions > 0) {
        this.logger.debug(`✅ Browser authentication verified (${status.authenticatedSessions} active sessions)`);
        return true;
      } else {
        this.logger.debug(`❌ Browser authentication not detected (${status.claudeTabsOpen} Claude tabs, ${status.authenticatedSessions} authenticated)`);
        
        // Log specific issues
        if (status.issues.length > 0) {
          this.logger.debug('Browser authentication issues:', status.issues);
        }
        
        return false;
      }
    } catch (error) {
      this.logger.error('Browser authentication check failed:', error);
      return false;
    }
  }

  /**
   * Get detailed browser session status
   */
  async getBrowserSessionStatus(): Promise<import('./browserSessionManager').BrowserSessionStatus> {
    return await this.browserSessionManager.checkBrowserSessions();
  }

  /**
   * Wait for authentication to become available
   */
  async waitForAuthentication(timeoutMs: number = 60000): Promise<boolean> {
    this.logger.info('⏳ Waiting for browser authentication...');
    const startTime = Date.now();
    const checkInterval = 3000; // Check every 3 seconds
    
    while (Date.now() - startTime < timeoutMs) {
      // Invalidate cache to get fresh results
      this.browserSessionManager.invalidateCache();
      
      const isAuth = await this.checkBrowserAuthentication();
      if (isAuth) {
        this.logger.info('✅ Browser authentication detected!');
        return true;
      }
      
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      this.logger.debug(`⏳ Still waiting for authentication... (${elapsed}s)`);
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    this.logger.error(`Authentication timeout after ${timeoutMs}ms`);
    return false;
  }

  /**
   * Get authentication guidance for users
   */
  async getAuthenticationGuidance(): Promise<string[]> {
    const status = await this.getBrowserSessionStatus();
    const guidance: string[] = [];
    
    if (status.hasActiveSessions) {
      guidance.push('✅ Browser authentication is working!');
      guidance.push(`📋 Active sessions: ${status.authenticatedSessions}`);
      guidance.push(`🌟 Claude tabs open: ${status.claudeTabsOpen}`);
      return guidance;
    }
    
    guidance.push('❌ No active Claude browser sessions detected');
    guidance.push('');
    
    // Show specific issues
    if (status.issues.length > 0) {
      guidance.push('🔍 Issues found:');
      status.issues.forEach(issue => {
        guidance.push(`  • ${issue}`);
      });
      guidance.push('');
    }
    
    // Show detected browsers
    if (status.sessionsFound.length > 0) {
      guidance.push('🌍 Browsers detected:');
      status.sessionsFound.forEach(session => {
        const statusIcon = session.isActive ? '🟢' : '🔴';
        const claudeIcon = session.claudeTabOpen ? '🌟' : '⚫';
        guidance.push(`  ${statusIcon} ${session.browser.toUpperCase()} ${claudeIcon} ${session.claudeTabOpen ? 'Claude tab open' : 'No Claude tab'}`);
      });
      guidance.push('');
    }
    
    guidance.push('🔧 Quick Setup:');
    guidance.push('');
    guidance.push('Method 1: Browser Authentication (Recommended)');
    if (status.recommendedBrowser) {
      guidance.push(`  1. Open ${status.recommendedBrowser.toUpperCase()} browser`);
    } else {
      guidance.push('  1. Open Chrome, Edge, Firefox, or Safari');
    }
    guidance.push('  2. Go to: https://claude.ai');
    guidance.push('  3. Log in to your Claude account');
    guidance.push('  4. Keep the tab open and active');
    guidance.push('');
    guidance.push('Method 2: CLI Authentication');
    guidance.push('  1. Run: claude auth');
    guidance.push('  2. Follow browser login prompts');
    guidance.push('  3. Complete authentication');
    guidance.push('');
    guidance.push('Method 3: API Key (For automation)');
    guidance.push('  1. Get key from: https://console.anthropic.com');
    guidance.push('  2. Set: export ANTHROPIC_API_KEY="your-key"');
    guidance.push('  3. Restart terminal and try again');
    
    return guidance;
  }

  /**
   * Force refresh browser session cache
   */
  invalidateBrowserCache(): void {
    this.browserSessionManager.invalidateCache();
  }

  /**
   * Monitor browser sessions
   */
  async monitorBrowserSessions(): Promise<void> {
    return await this.browserSessionManager.monitorBrowserSessions();
  }

  /**
   * Check if SDK is available
   */
  isAvailable(): boolean {
    return this.isSDKAvailable;
  }

  /**
   * Get browser session manager instance
   */
  getBrowserSessionManager(): BrowserSessionManager {
    return this.browserSessionManager;
  }
}