import { Logger } from '../logger';

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

  constructor(logger: Logger) {
    this.logger = logger;
    // Initialize SDK asynchronously without blocking constructor
    this.initializeSDK().catch(() => {
      // Initialization failed, will retry during execution
      this.isSDKAvailable = false;
    });
  }

  /**
   * Initialize the Claude Code SDK
   */
  private async initializeSDK(): Promise<void> {
    try {
      // Try to require the globally installed SDK
      const globalPath = require.resolve('@anthropic-ai/claude-code', { 
        paths: [
          process.env.npm_config_prefix ? `${process.env.npm_config_prefix}/lib/node_modules` : '',
          `${process.env.APPDATA || process.env.HOME}/.npm-global/lib/node_modules`,
          'C:\\Users\\yossi\\AppData\\Roaming\\npm\\node_modules',
          '/usr/local/lib/node_modules',
          '/usr/lib/node_modules'
        ].filter(Boolean)
      });
      claudeSDK = require(globalPath);
      this.isSDKAvailable = true;
      this.logger.debug('Claude Code SDK loaded successfully');
    } catch (error) {
      // Try dynamic import as fallback
      try {
        const sdkModule = await import('@anthropic-ai/claude-code').catch(() => null);
        if (sdkModule) {
          claudeSDK = sdkModule;
          this.isSDKAvailable = true;
          this.logger.debug('Claude Code SDK loaded via dynamic import');
        } else {
          throw new Error('SDK module not found');
        }
      } catch (importError) {
        this.logger.debug(`SDK dynamic import failed: ${importError}`);
        this.logger.warning('Claude Code SDK not available. Install with: npm install -g @anthropic-ai/claude-code');
        this.isSDKAvailable = false;
      }
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

    if (!claudeSDK || !claudeSDK.query) {
      throw new Error('Claude Code SDK query function not available');
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

        // Use the SDK's query function
        const messages = claudeSDK.query({
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
   * Check if SDK is available
   */
  isAvailable(): boolean {
    return this.isSDKAvailable;
  }
}