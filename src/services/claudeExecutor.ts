import { spawn, ChildProcess } from 'child_process';
import chalk from 'chalk';
import { ClaudeUtils } from '../claudeUtils';
import { Logger } from '../logger';
import { ACCPTYManager } from './ptyController';
import { SDKClaudeExecutor } from './sdkClaudeExecutor';

/**
 * Custom error types for type-driven error handling
 */
export class ProcessTimeoutError extends Error {
  constructor(timeout: number) {
    super(`Claude process timed out after ${timeout}ms`);
    this.name = 'ProcessTimeoutError';
  }
}

export class ModelQuotaError extends Error {
  constructor(model: string) {
    super(`Model quota exceeded for ${model}`);
    this.name = 'ModelQuotaError';
  }
}

export class FileAccessError extends Error {
  constructor(path: string) {
    super(`File access denied: ${path}`);
    this.name = 'FileAccessError';
  }
}

export class ClaudeInstallationError extends Error {
  constructor() {
    super('Claude CLI not found or not properly installed');
    this.name = 'ClaudeInstallationError';
  }
}

export class NetworkError extends Error {
  constructor(details: string) {
    super(`Network error: ${details}`);
    this.name = 'NetworkError';
  }
}

export class AuthenticationError extends Error {
  constructor(details: string) {
    super(`Authentication error: ${details}`);
    this.name = 'AuthenticationError';
  }
}

export class HeadlessModeError extends Error {
  constructor(details: string) {
    super(`Headless mode (-p flag) error: ${details}`);
    this.name = 'HeadlessModeError';
  }
}

export class APIKeyRequiredError extends Error {
  constructor() {
    super('API key required for headless mode. Set ANTHROPIC_API_KEY environment variable or use interactive mode.');
    this.name = 'APIKeyRequiredError';
  }
}

export class SDKNotInstalledError extends Error {
  constructor() {
    super('Claude Code SDK not installed. Please install with: npm install -g @anthropic-ai/claude-code');
    this.name = 'SDKNotInstalledError';
  }
}

export class BrowserAuthRequiredError extends Error {
  constructor() {
    super('Browser authentication required. Please authenticate Claude in your browser first.');
    this.name = 'BrowserAuthRequiredError';
  }
}

export class RetryExhaustedError extends Error {
  constructor(maxRetries: number, lastError: string) {
    super(`Failed after ${maxRetries} attempts. Last error: ${lastError}`);
    this.name = 'RetryExhaustedError';
  }
}

/**
 * Execution options for Claude Code
 */
export interface ClaudeExecutionOptions {
  model?: string;
  workDir?: string;
  allowedTools?: string;
  sessionId?: string;
  verbose?: boolean;
  continueOnError?: boolean;
  timeout?: number;
}

/**
 * Execution result from Claude Code
 */
export interface ClaudeExecutionResult {
  output: string;
  exitCode: number;
  sessionId?: string;
}

/**
 * Centralized Claude Code execution service
 * Consolidates all process management and provides type-driven error handling
 */
export class ClaudeExecutor {
  private logger: Logger;
  private ptyManager: ACCPTYManager;
  private sdkExecutor: SDKClaudeExecutor;
  private activePTYSessions: Map<string, string> = new Map();
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // ms

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
    this.ptyManager = new ACCPTYManager(this.logger);
    this.sdkExecutor = new SDKClaudeExecutor(this.logger);
  }

  /**
   * Execute Claude Code with the given prompt and options
   * @param prompt The prompt to send to Claude
   * @param options Execution options
   * @returns Promise with structured result
   */
  async executeClaudeCode(
    prompt: string, 
    options: ClaudeExecutionOptions = {}
  ): Promise<ClaudeExecutionResult> {
    return this.executeWithRetry(prompt, options, 0);
  }

  /**
   * Execute Claude with automatic retry logic and progressive fallback
   * Priority: SDK (browser auth) -> CLI with API key -> CLI interactive
   */
  private async executeWithRetry(
    prompt: string,
    options: ClaudeExecutionOptions,
    attempt: number
  ): Promise<ClaudeExecutionResult> {
    try {
      this.logSDKFlow(`Starting execution attempt ${attempt + 1}/${this.maxRetries + 1}`, {
        hasApiKey: !!(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY),
        workDir: options.workDir,
        model: options.model,
        sdkAvailable: this.sdkExecutor.isAvailable()
      });

      // Priority 1: Try SDK execution (works with browser auth, no API key needed)
      try {
        this.logger.debug('Attempting SDK execution (browser auth)');
        
        const result = await this.sdkExecutor.executeWithSDK(prompt, {
          model: options.model as 'sonnet' | 'opus' | undefined,
          workDir: options.workDir,
          sessionId: options.sessionId,
          verbose: options.verbose,
          timeout: options.timeout,
          allowedTools: options.allowedTools
        });
        
        this.logSDKFlow('SDK execution successful', { outputLength: result.output.length });
        return {
          output: result.output,
          exitCode: result.exitCode,
          sessionId: options.sessionId
        };
      } catch (sdkError: any) {
        this.logger.warning(`SDK execution failed: ${sdkError.message}`);
        this.logSDKFlow('SDK execution failed, falling back to CLI', { error: sdkError.message });
        
        // If it's an authentication error and no API key fallback, provide clear guidance
        const hasApiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
        if (sdkError.message && sdkError.message.includes('authentication') && !hasApiKey) {
          throw new AuthenticationError(
            `SDK authentication required and no API key set for CLI fallback.\n` +
            `Please either:\n` +
            `1. Run 'claude auth' to authenticate Claude CLI\n` +
            `2. Set ANTHROPIC_API_KEY environment variable`
          );
        }
      }

      // Priority 2: CLI with API key (headless mode) 
      const hasApiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
      if (hasApiKey) {
        this.logger.debug('API key found, using CLI headless mode');
        return await this.executeHeadless(prompt, options);
      }

      // Priority 3: CLI interactive mode (fallback)
      this.logger.debug('No API key found, attempting CLI interactive mode');
      return await this.executeWithBrowserAuth(prompt, options, attempt);
      
    } catch (error: any) {
      return this.handleExecutionError(error, prompt, options, attempt);
    }
  }

  /**
   * Execute with browser authentication (no API key required)
   */
  private async executeWithBrowserAuth(
    prompt: string,
    options: ClaudeExecutionOptions,
    attempt: number
  ): Promise<ClaudeExecutionResult> {
    try {
      // First try SDK approach (preferred)
      if (await this.isSDKAvailable()) {
        this.logSDKFlow('Using Claude SDK for execution');
        const result = await this.sdkExecutor.executeWithSDK(prompt, {
          model: options.model as 'sonnet' | 'opus' | undefined,
          workDir: options.workDir,
          sessionId: options.sessionId,
          verbose: options.verbose,
          timeout: options.timeout,
          allowedTools: options.allowedTools
        });
        
        this.logSDKFlow('SDK execution successful', { outputLength: result.output.length });
        return {
          output: result.output,
          exitCode: result.exitCode,
          sessionId: options.sessionId
        };
      }
      
      // Fallback to browser auth
      this.logAuthFlow('Starting browser-authenticated Claude session');
      if (attempt === 0) {
        this.logger.info('📋 Please ensure you are logged into Claude in your browser');
        this.logger.info('⚡ The session will start automatically once authentication is detected');
      }
      
      // Use CLI in interactive mode (no -p flag, no API key needed)
      const result = await this.executeCLI(prompt, { 
        ...options,
        headless: false  // Force interactive mode
      });
      
      this.logAuthFlow('CLI interactive execution completed successfully');
      return result;
      
    } catch (error: any) {
      this.logAuthFlow('Browser auth execution failed', { error: error.message });
      
      if (error.message?.includes('Authentication required') || 
          error.message?.includes('Please log in')) {
        throw new BrowserAuthRequiredError();
      }
      throw error;
    }
  }

  /**
   * Execute in headless mode (requires API key)
   */
  private async executeHeadless(
    prompt: string,
    options: ClaudeExecutionOptions
  ): Promise<ClaudeExecutionResult> {
    this.logger.debug('🗝️  Executing in headless mode with API key');
    
    // Try CLI headless mode with -p flag
    return this.executeCLI(prompt, { ...options, headless: true });
  }

  /**
   * Execute using CLI method (both headless and interactive)
   */
  private async executeCLI(
    prompt: string,
    options: ClaudeExecutionOptions & { headless?: boolean } = {}
  ): Promise<ClaudeExecutionResult> {
    // Build command arguments
    const args: string[] = [];
    
    // Use headless mode (-p flag) if API key is available and not explicitly disabled
    const hasApiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    const useHeadless = options.headless !== false && hasApiKey;
    
    if (useHeadless) {
      args.push('-p', prompt);
      this.logger.debug('Using CLI headless mode with -p flag');
    } else {
      // Interactive mode - Claude will open in browser or prompt for auth
      args.push(prompt);
      this.logger.debug('Using CLI interactive mode');
    }
    
    // Build arguments array
    if (options.model) {
      args.push('--model', options.model);
    }
    
    if (options.allowedTools) {
      args.push('--allowedTools', options.allowedTools);
    }
    
    if (options.sessionId) {
      args.push('--resume', options.sessionId);
    }
    
    if (options.verbose) {
      args.push('--verbose');
    }

    const workingDir = options.workDir || process.cwd();
    const timeout = options.timeout || 120000; // 2 minutes default

    return new Promise((resolve, reject) => {
      let claudeProcess: ChildProcess;
      let timeoutHandle: NodeJS.Timeout | undefined = undefined;

      try {
        const { command, baseArgs } = ClaudeUtils.getClaudeCommand();
        const allArgs = [...baseArgs, ...args];
        
        // Only log debug info if verbose mode is enabled
        if (options.verbose) {
          this.logger.debug(`Using Claude command: ${command} ${allArgs.join(' ')}`);
        }
        
        // Intelligent shell detection (from index.ts implementation)
        const useShell = command === 'npx' || 
                        command.includes('npx') || 
                        command.endsWith('.CMD') || 
                        command.endsWith('.cmd');
        
        claudeProcess = spawn(command, allArgs, {
          shell: useShell,
          env: { ...process.env, PATH: process.env.PATH },
          cwd: workingDir,
          stdio: ['ignore', 'pipe', 'pipe'] // Ignore stdin to prevent hanging
        });

        let output = '';
        let errorOutput = '';

        // Handle stdout with intelligent logging (from index.ts implementation)
        claudeProcess.stdout?.on('data', (data) => {
          const chunk = data.toString();
          output += chunk;
          
          // Separate Claude's work output from system logs
          const lines = chunk.split('\n').filter((line: string) => line.trim());
          lines.forEach((line: string) => {
            // Check if this is Claude's actual work or system message
            if (this.isClaudeWork(line)) {
              // Log to work file
              this.logger.logClaudeWork(line);
            } else if (this.isSystemMessage(line)) {
              // Log to session file only
              this.logger.debug(`System: ${line.substring(0, 200)}`);
            } else if (line.trim()) {
              // Default to work output for non-empty lines
              this.logger.logClaudeWork(line);
            }
          });
          
          if (options.verbose) {
            process.stdout.write(chalk.gray(chunk));
          }
        });

        // Handle stderr with error categorization
        claudeProcess.stderr?.on('data', (data) => {
          const chunk = data.toString();
          errorOutput += chunk;
          
          // Log errors in real-time with special handling for headless mode errors
          if (this.isHeadlessModeError(chunk)) {
            this.logger.error(`[HEADLESS MODE ERROR] ${chunk}`);
            // Send to monitoring system if available
            this.notifyMonitoring('headless_error', chunk);
          } else {
            this.logger.error(`Claude error: ${chunk}`);
          }
          
          if (options.verbose) {
            process.stderr.write(chalk.red(chunk));
          }
        });

        // Handle process completion
        claudeProcess.on('close', (code) => {
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
          }
          
          if (code !== 0 && !options.continueOnError) {
            const error = this.categorizeError(errorOutput, code || 0);
            reject(error);
          } else {
            resolve({ output, exitCode: code || 0 });
          }
        });

        // Handle process errors
        claudeProcess.on('error', (err) => {
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
          }
          
          const categorizedError = this.categorizeProcessError(err);
          reject(categorizedError);
        });

        // Setup timeout handling
        timeoutHandle = setTimeout(() => {
          claudeProcess.kill('SIGTERM');
          reject(new ProcessTimeoutError(timeout));
        }, timeout);

      } catch (err) {
        if (timeoutHandle !== undefined) {
          clearTimeout(timeoutHandle);
        }
        
        const categorizedError = this.categorizeProcessError(err as Error);
        reject(categorizedError);
      }
    });
  }

  /**
   * Categorize errors based on output and exit code for type-driven handling
   */
  private categorizeError(errorOutput: string, exitCode: number): Error {
    const lowerError = errorOutput.toLowerCase();
    
    // API Key and Authentication errors (specific to headless mode)
    if (lowerError.includes('api key') || 
        lowerError.includes('api_key') ||
        lowerError.includes('anthropic_api_key') ||
        lowerError.includes('missing api key') ||
        lowerError.includes('no api key found')) {
      return new APIKeyRequiredError();
    }
    
    // Authentication errors
    if (lowerError.includes('authentication') || 
        lowerError.includes('unauthorized') ||
        lowerError.includes('401') ||
        lowerError.includes('forbidden') ||
        lowerError.includes('invalid token') ||
        lowerError.includes('token expired')) {
      return new AuthenticationError(errorOutput.trim());
    }
    
    // Headless mode specific errors
    if ((lowerError.includes('headless') || 
         lowerError.includes('-p flag') ||
         lowerError.includes('print mode')) &&
        (lowerError.includes('error') || 
         lowerError.includes('failed') ||
         lowerError.includes('not supported'))) {
      return new HeadlessModeError(errorOutput.trim());
    }
    
    // Network-related errors
    if (lowerError.includes('network') || 
        lowerError.includes('connection') || 
        lowerError.includes('timeout') ||
        lowerError.includes('econnrefused') ||
        lowerError.includes('enotfound')) {
      return new NetworkError(errorOutput.trim());
    }
    
    // Model quota/rate limit errors
    if (lowerError.includes('quota') || 
        lowerError.includes('rate limit') || 
        lowerError.includes('model') ||
        lowerError.includes('billing')) {
      return new ModelQuotaError(errorOutput.trim());
    }
    
    // File access errors
    if (lowerError.includes('permission') || 
        lowerError.includes('access') || 
        lowerError.includes('enoent') ||
        lowerError.includes('eacces')) {
      return new FileAccessError(errorOutput.trim());
    }
    
    // Claude installation errors
    if (lowerError.includes('claude') || 
        lowerError.includes('spawn') || 
        lowerError.includes('command not found')) {
      return new ClaudeInstallationError();
    }
    
    // Generic error with exit code
    return new Error(`Claude Code exited with code ${exitCode}: ${errorOutput}`);
  }

  /**
   * Categorize process spawn errors
   */
  private categorizeProcessError(err: Error): Error {
    const message = err.message.toLowerCase();
    
    if (message.includes('enoent')) {
      return new ClaudeInstallationError();
    }
    
    if (message.includes('eacces')) {
      return new FileAccessError('Process execution permissions');
    }
    
    return err; // Return original error if not categorizable
  }

  /**
   * Check if a line represents Claude's actual work output
   * (Logic from index.ts implementation)
   */
  private isClaudeWork(line: string): boolean {
    // Skip empty lines
    if (!line.trim()) return false;
    
    // Skip debug/system messages
    if (line.includes('[DEBUG]') || 
        line.includes('[INFO]') || 
        line.includes('[WARN]') ||
        line.includes('claude-code:')) return false;
    
    // Skip timestamps and session IDs
    if (line.match(/^\d{4}-\d{2}-\d{2}/) || 
        line.includes('session-')) return false;
    
    return true;
  }

  /**
   * Check if a line represents a system message
   * (Logic from index.ts implementation)
   */
  private isSystemMessage(line: string): boolean {
    return line.includes('[DEBUG]') || 
           line.includes('[INFO]') || 
           line.includes('[WARN]') ||
           line.includes('claude-code:') ||
           line.match(/^\d{4}-\d{2}-\d{2}/) !== null ||
           line.includes('session-');
  }

  /**
   * Check if error is related to headless mode
   */
  private isHeadlessModeError(error: string): boolean {
    const lowerError = error.toLowerCase();
    return lowerError.includes('api key') ||
           lowerError.includes('api_key') ||
           lowerError.includes('headless') ||
           lowerError.includes('-p flag') ||
           lowerError.includes('print mode') ||
           lowerError.includes('authentication') ||
           lowerError.includes('unauthorized');
  }

  /**
   * Notify monitoring system about errors
   */
  private notifyMonitoring(errorType: string, message: string): void {
    // Send to monitoring endpoint if available
    const monitoringUrl = 'http://localhost:4001/api/monitoring';
    
    fetch(monitoringUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentType: 'system',
        messageType: 'error',
        message: message,
        metadata: {
          eventType: 'HEADLESS_MODE_ERROR',
          errorType: errorType,
          timestamp: new Date().toISOString()
        },
        sessionInfo: {
          task: 'Claude Code Execution',
          workDir: process.cwd()
        }
      })
    }).catch(() => {
      // Silently fail if monitoring is not available
    });
  }

  /**
   * Get or create PTY session for agent role
   */
  async getOrCreatePTYSession(
    agentRole: 'manager' | 'worker',
    workDir?: string,
    sessionId?: string
  ): Promise<string> {
    const sessionKey = `${agentRole}-${workDir || process.cwd()}`;
    let ptySessionId = this.activePTYSessions.get(sessionKey);
    
    if (!ptySessionId) {
      const finalSessionId = sessionId || `${agentRole}-${Date.now()}`;
      ptySessionId = await this.ptyManager.createSession(
        workDir || process.cwd(),
        finalSessionId
      );
      this.activePTYSessions.set(sessionKey, ptySessionId);
      
      this.logger.info('Created PTY session for agent', {
        agentRole,
        sessionId: ptySessionId,
        workDir: workDir || process.cwd()
      });
    }
    
    return ptySessionId;
  }

  /**
   * Send prompt to specific PTY session
   */
  async sendToPTYSession(sessionId: string, prompt: string): Promise<string> {
    try {
      const response = await this.ptyManager.sendPrompt(sessionId, prompt);
      
      // Log the interaction for monitoring
      this.logger.debug('PTY interaction', {
        sessionId,
        promptLength: prompt.length,
        responseLength: response.length
      });
      
      return response;
      
    } catch (error) {
      this.logger.error('PTY session interaction failed', { sessionId, error });
      throw error;
    }
  }

  /**
   * Close PTY session
   */
  closePTYSession(sessionId: string): void {
    this.ptyManager.closeSession(sessionId);
    
    // Remove from active sessions
    for (const [key, value] of this.activePTYSessions.entries()) {
      if (value === sessionId) {
        this.activePTYSessions.delete(key);
        break;
      }
    }
    
    this.logger.debug('Closed PTY session', { sessionId });
  }

  /**
   * Close all PTY sessions
   */
  closeAllPTYSessions(): void {
    this.ptyManager.closeAllSessions();
    this.activePTYSessions.clear();
    this.logger.info('Closed all PTY sessions');
  }

  /**
   * Get active PTY sessions
   */
  getActivePTYSessions(): Array<{ key: string; sessionId: string }> {
    return Array.from(this.activePTYSessions.entries()).map(([key, sessionId]) => ({
      key,
      sessionId
    }));
  }

  /**
   * Enhanced error handling with user-friendly prompts and retry logic
   */
  private async handleExecutionError(
    error: any, 
    prompt: string, 
    options: ClaudeExecutionOptions, 
    attempt: number
  ): Promise<ClaudeExecutionResult> {
    this.logger.error(`Execution attempt ${attempt + 1} failed:`, error.message);

    // Check for specific error types and provide user guidance
    if (error instanceof AuthenticationError || error instanceof BrowserAuthRequiredError) {
      this.logger.promptUser('Authentication Required', [
        'Open your browser and go to claude.ai',
        'Log in to your Claude account',
        'Keep the browser tab open',
        'Try running the command again'
      ]);
      
      if (attempt < this.maxRetries) {
        this.logger.logRetryAttempt(attempt + 2, this.maxRetries + 1, 'Authentication issue');
        await this.delay(this.retryDelay);
        return this.executeWithRetry(prompt, options, attempt + 1);
      }
      throw new RetryExhaustedError(this.maxRetries, error.message);
    }

    if (error instanceof SDKNotInstalledError || error instanceof ClaudeInstallationError) {
      this.logger.error('📦 Claude Installation Issue');
      this.logger.info('💡 Installation options:');
      this.logger.info('   Option 1 (Recommended): npm install -g @anthropic-ai/claude-code');
      this.logger.info('   Option 2: curl -sL https://claude.ai/install.sh | sh');
      this.logger.info('   Option 3: Download from https://claude.ai/download');
      
      throw error; // Don't retry installation issues
    }

    if (error instanceof NetworkError) {
      this.logger.error('🌐 Network Issue Detected');
      this.logger.info('🔧 Network troubleshooting:');
      this.logger.info('   1. Check your internet connection');
      this.logger.info('   2. Verify firewall/proxy settings');
      this.logger.info('   3. Try again in a few moments');
      
      if (attempt < this.maxRetries) {
        const exponentialDelay = this.retryDelay * Math.pow(2, attempt);
        this.logger.info(`⏳ Retrying in ${exponentialDelay}ms (${attempt + 2}/${this.maxRetries + 1})...`);
        await this.delay(exponentialDelay);
        return this.executeWithRetry(prompt, options, attempt + 1);
      }
    }

    if (error instanceof APIKeyRequiredError) {
      this.logger.error('🗝️  API Key Required');
      this.logger.info('💡 API Key setup options:');
      this.logger.info('   Option 1: export ANTHROPIC_API_KEY="your-key-here"');
      this.logger.info('   Option 2: Set CLAUDE_API_KEY environment variable');
      this.logger.info('   Option 3: Use browser authentication (interactive mode)');
      
      throw error; // Don't retry API key issues without user action
    }

    if (error instanceof ModelQuotaError) {
      this.logger.error('⚡ Model Quota/Rate Limit Exceeded');
      this.logger.info('🕐 Rate limit suggestions:');
      this.logger.info('   1. Wait a few minutes before retrying');
      this.logger.info('   2. Check your usage at https://console.anthropic.com');
      this.logger.info('   3. Consider upgrading your plan if needed');
      
      if (attempt < this.maxRetries) {
        const quotaDelay = this.retryDelay * 5; // Longer delay for quota issues
        this.logger.info(`⏳ Waiting ${quotaDelay}ms before retry...`);
        await this.delay(quotaDelay);
        return this.executeWithRetry(prompt, options, attempt + 1);
      }
    }

    // For unrecognized errors, provide generic retry logic
    if (attempt < this.maxRetries && !this.isNonRetryableError(error)) {
      this.logger.warning(`🔄 Retrying execution (${attempt + 2}/${this.maxRetries + 1})`);
      await this.delay(this.retryDelay);
      return this.executeWithRetry(prompt, options, attempt + 1);
    }

    throw new RetryExhaustedError(this.maxRetries, error.message);
  }

  /**
   * Check if SDK is available
   */
  private async isSDKAvailable(): Promise<boolean> {
    try {
      return this.sdkExecutor.isAvailable();
    } catch (error) {
      this.logger.debug('SDK availability check failed', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  /**
   * Check if error should not be retried
   */
  private isNonRetryableError(error: any): boolean {
    return error instanceof ClaudeInstallationError ||
           error instanceof SDKNotInstalledError ||
           error instanceof APIKeyRequiredError ||
           error instanceof FileAccessError ||
           (error instanceof AuthenticationError && error.message.includes('invalid token'));
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Enhanced logging for SDK flow debugging
   */
  private logSDKFlow(step: string, details?: any): void {
    this.logger.logSDKOperation(step, details);
    
    // Send to monitoring if available
    this.notifyMonitoring('sdk_flow', `${step}: ${details ? JSON.stringify(details) : 'completed'}`);
  }

  /**
   * Enhanced logging for authentication flow debugging  
   */
  private logAuthFlow(step: string, details?: any): void {
    this.logger.logAuthStep(step, details);
    
    // Send to monitoring if available
    this.notifyMonitoring('auth_flow', `${step}: ${details ? JSON.stringify(details) : 'completed'}`);
  }

  /**
   * Cleanup resources on shutdown
   */
  async shutdown(): Promise<void> {
    this.closeAllPTYSessions();
    this.logger.info('ClaudeExecutor shutdown completed');
  }
}