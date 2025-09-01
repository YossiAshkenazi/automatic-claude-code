import { spawn, ChildProcess } from 'child_process';
import chalk from 'chalk';
import { ClaudeUtils } from '../claudeUtils';
import { Logger } from '../logger';
import { ACCPTYManager } from './ptyController';
import { SDKClaudeExecutor } from './sdkClaudeExecutor';

/**
 * Circuit breaker pattern for preventing cascading failures
 */
export class CircuitBreaker {
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private readonly failureThreshold: number = 5;
  private readonly recoveryTimeoutMs: number = 60000; // 1 minute
  private readonly halfOpenMaxAttempts: number = 1;
  private halfOpenAttempts: number = 0;

  canExecute(): boolean {
    const now = Date.now();
    
    switch (this.state) {
      case 'CLOSED':
        return true;
      case 'OPEN':
        if (now - this.lastFailureTime >= this.recoveryTimeoutMs) {
          this.state = 'HALF_OPEN';
          this.halfOpenAttempts = 0;
          return true;
        }
        return false;
      case 'HALF_OPEN':
        return this.halfOpenAttempts < this.halfOpenMaxAttempts;
    }
  }

  recordSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
    this.halfOpenAttempts = 0;
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
    } else if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
    
    if (this.state !== 'OPEN') {
      // This was just changed to OPEN above, don't increment attempts
    }
  }

  getState(): string {
    return this.state;
  }
}

/**
 * Execution attempt tracking
 */
interface ExecutionAttempt {
  timestamp: number;
  success: boolean;
  error?: string;
  duration: number;
}

/**
 * Enhanced timeout error with more context
 */
export class ExecutionTimeoutError extends Error {
  constructor(timeout: number, phase: string) {
    super(`Execution timed out after ${timeout}ms during ${phase} phase`);
    this.name = 'ExecutionTimeoutError';
  }
}

/**
 * Circuit breaker open error
 */
export class CircuitBreakerOpenError extends Error {
  constructor(failureCount: number) {
    super(`Circuit breaker is OPEN after ${failureCount} consecutive failures. Execution blocked to prevent cascading failures.`);
    this.name = 'CircuitBreakerOpenError';
  }
}

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
  private circuitBreaker: CircuitBreaker = new CircuitBreaker();
  private executionHistory: ExecutionAttempt[] = [];

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
    const startTime = Date.now();
    
    // Check circuit breaker before attempting execution
    if (!this.circuitBreaker.canExecute()) {
      const error = new CircuitBreakerOpenError(this.circuitBreaker['failureCount']);
      this.recordExecutionAttempt(startTime, false, error.message);
      throw error;
    }
    
    // Enforce absolute maximum timeout
    const absoluteTimeout = options.timeout || 300000; // 5 minutes max
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new ExecutionTimeoutError(absoluteTimeout, `attempt ${attempt + 1}`));
      }, absoluteTimeout);
    });
    
    try {
      this.logSDKFlow(`Starting execution attempt ${attempt + 1}/${this.maxRetries + 1}`, {
        hasApiKey: !!(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY),
        workDir: options.workDir,
        model: options.model,
        sdkAvailable: this.sdkExecutor.isAvailable(),
        circuitBreakerState: this.circuitBreaker.getState()
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
        const result = await Promise.race([
          this.executeHeadless(prompt, options),
          timeoutPromise
        ]);
        this.recordExecutionAttempt(startTime, true);
        this.circuitBreaker.recordSuccess();
        return result;
      }

      // Priority 3: CLI interactive mode (fallback)
      this.logger.debug('No API key found, attempting CLI interactive mode');
      const result = await Promise.race([
        this.executeWithBrowserAuth(prompt, options, attempt),
        timeoutPromise
      ]);
      this.recordExecutionAttempt(startTime, true);
      this.circuitBreaker.recordSuccess();
      return result;
      
    } catch (error: any) {
      this.recordExecutionAttempt(startTime, false, error.message);
      this.circuitBreaker.recordFailure();
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
      let resolved = false; // Prevent multiple resolutions
      
      const cleanup = () => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = undefined;
        }
        if (claudeProcess && !claudeProcess.killed) {
          claudeProcess.kill('SIGTERM');
          // Force kill after 5 seconds if process doesn't respond
          setTimeout(() => {
            if (!claudeProcess.killed) {
              claudeProcess.kill('SIGKILL');
            }
          }, 5000);
        }
      };
      
      const safeResolve = (result: any) => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(result);
        }
      };
      
      const safeReject = (error: any) => {
        if (!resolved) {
          resolved = true;
          cleanup();
          reject(error);
        }
      };

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
        let lastOutputTime = Date.now();

        // Handle stdout with intelligent logging and stall detection
        claudeProcess.stdout?.on('data', (data) => {
          lastOutputTime = Date.now();
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
          lastOutputTime = Date.now();
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
          if (code !== 0 && !options.continueOnError) {
            const error = this.categorizeError(errorOutput, code || 0);
            safeReject(error);
          } else {
            safeResolve({ output, exitCode: code || 0 });
          }
        });

        // Handle process errors
        claudeProcess.on('error', (err) => {
          const categorizedError = this.categorizeProcessError(err);
          safeReject(categorizedError);
        });

        // Setup dual timeout handling: absolute timeout + stall detection
        timeoutHandle = setTimeout(() => {
          this.logger.warning(`Process timed out after ${timeout}ms`);
          safeReject(new ProcessTimeoutError(timeout));
        }, timeout);
        
        // Stall detection - if no output for extended period, consider it stalled
        const stallCheckInterval = Math.min(30000, timeout / 4); // Check every 30s or 1/4 of timeout
        const stallTimeout = Math.min(120000, timeout / 2); // Stall after 2min or 1/2 of timeout
        
        const stallChecker = setInterval(() => {
          const timeSinceLastOutput = Date.now() - lastOutputTime;
          if (timeSinceLastOutput > stallTimeout) {
            clearInterval(stallChecker);
            this.logger.warning(`Process appears stalled (no output for ${timeSinceLastOutput}ms)`);
            safeReject(new ProcessTimeoutError(timeSinceLastOutput));
          }
        }, stallCheckInterval);
        
        // Clean up stall checker when process completes
        claudeProcess.on('close', () => clearInterval(stallChecker));
        claudeProcess.on('error', () => clearInterval(stallChecker));

      } catch (err) {
        const categorizedError = this.categorizeProcessError(err as Error);
        safeReject(categorizedError);
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
   * Record execution attempt for analytics and circuit breaker
   */
  private recordExecutionAttempt(startTime: number, success: boolean, error?: string): void {
    this.executionHistory.push({
      timestamp: startTime,
      success,
      error,
      duration: Date.now() - startTime
    });
    
    // Keep only last 100 attempts
    if (this.executionHistory.length > 100) {
      this.executionHistory.shift();
    }
  }

  /**
   * Enhanced error handling with user-friendly prompts and circuit breaker logic
   */
  private async handleExecutionError(
    error: any, 
    prompt: string, 
    options: ClaudeExecutionOptions, 
    attempt: number
  ): Promise<ClaudeExecutionResult> {
    this.logger.error(`Execution attempt ${attempt + 1} failed:`, error.message);
    
    // Handle circuit breaker errors with clear user guidance
    if (error instanceof CircuitBreakerOpenError) {
      this.logger.error('🔴 Circuit Breaker Protection Activated');
      this.logger.info('💡 The system has temporarily stopped execution to prevent cascading failures.');
      this.logger.info('   This happens after multiple consecutive failures.');
      this.logger.info('   Wait 1 minute and try again, or check system health.');
      throw error; // Don't retry when circuit breaker is open
    }
    
    // Handle timeout errors with actionable guidance
    if (error instanceof ExecutionTimeoutError || error instanceof ProcessTimeoutError) {
      this.logger.error('⏰ Execution Timeout');
      this.logger.info('💡 Timeout troubleshooting:');
      this.logger.info('   1. Try a simpler task first');
      this.logger.info('   2. Increase timeout with --timeout <minutes>');
      this.logger.info('   3. Check if Claude is responsive in browser');
      this.logger.info('   4. Verify network connectivity');
      
      // Don't retry timeouts immediately - they indicate deeper issues
      if (attempt >= this.maxRetries) {
        throw new RetryExhaustedError(this.maxRetries, error.message);
      }
      
      // Exponential backoff for timeouts
      const timeoutDelay = this.retryDelay * Math.pow(2, attempt) * 2; // Double delay for timeouts
      this.logger.info(`⏳ Waiting ${timeoutDelay}ms before retry due to timeout...`);
      await this.delay(timeoutDelay);
      return this.executeWithRetry(prompt, options, attempt + 1);
    }

    // Check for specific error types and provide user guidance
    if (error instanceof AuthenticationError || error instanceof BrowserAuthRequiredError) {
      this.logger.promptUser('Authentication Required', [
        'Open your browser and go to claude.ai',
        'Log in to your Claude account',
        'Keep the browser tab open',
        'Try running the command again'
      ]);
      
      // Authentication errors should not exhaust retries quickly
      if (attempt < Math.min(this.maxRetries, 2)) { // Limit auth retries to 2
        this.logger.logRetryAttempt(attempt + 2, this.maxRetries + 1, 'Authentication issue');
        await this.delay(this.retryDelay * 3); // Longer delay for auth issues
        return this.executeWithRetry(prompt, options, attempt + 1);
      }
      throw new RetryExhaustedError(attempt + 1, `Authentication failed after ${attempt + 1} attempts. Please ensure you are logged into Claude in your browser.`);
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
      this.logger.info('   4. Check https://status.anthropic.com for service status');
      
      if (attempt < this.maxRetries) {
        const exponentialDelay = Math.min(this.retryDelay * Math.pow(2, attempt), 30000); // Cap at 30s
        this.logger.info(`⏳ Retrying in ${exponentialDelay}ms (${attempt + 2}/${this.maxRetries + 1})...`);
        await this.delay(exponentialDelay);
        return this.executeWithRetry(prompt, options, attempt + 1);
      }
      throw new RetryExhaustedError(this.maxRetries, `Network issues persisted after ${this.maxRetries} attempts. Please check your connection and try again later.`);
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
      this.logger.info('   4. Try using "sonnet" model instead of "opus"');
      
      if (attempt < this.maxRetries) {
        const quotaDelay = Math.min(this.retryDelay * 10 * (attempt + 1), 300000); // Progressive delay, cap at 5 minutes
        this.logger.info(`⏳ Waiting ${quotaDelay}ms before retry due to quota limits...`);
        await this.delay(quotaDelay);
        return this.executeWithRetry(prompt, options, attempt + 1);
      }
      throw new RetryExhaustedError(this.maxRetries, `Rate limits persisted after ${this.maxRetries} attempts. Please wait longer or check your quota at console.anthropic.com`);
    }

    // For unrecognized errors, provide generic retry logic with improved guidance
    if (attempt < this.maxRetries && !this.isNonRetryableError(error)) {
      this.logger.warning(`🔄 Retrying execution (${attempt + 2}/${this.maxRetries + 1})`);
      this.logger.info('💡 Generic retry troubleshooting:');
      this.logger.info('   1. Try a simpler or more specific prompt');
      this.logger.info('   2. Check that Claude is responding in your browser');
      this.logger.info('   3. Verify system resources (CPU, memory)');
      this.logger.info('   4. Consider restarting the process');
      
      const adaptiveDelay = this.retryDelay + (attempt * 1000); // Gentle progressive delay
      await this.delay(adaptiveDelay);
      return this.executeWithRetry(prompt, options, attempt + 1);
    }

    // Final failure with comprehensive error message
    const errorSummary = this.generateErrorSummary(error, attempt + 1);
    throw new RetryExhaustedError(this.maxRetries, errorSummary);
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
           error instanceof CircuitBreakerOpenError ||
           (error instanceof AuthenticationError && error.message.includes('invalid token'));
  }
  
  /**
   * Generate comprehensive error summary for final failure
   */
  private generateErrorSummary(error: any, totalAttempts: number): string {
    const recentFailures = this.executionHistory
      .filter(attempt => !attempt.success && (Date.now() - attempt.timestamp) < 300000) // Last 5 minutes
      .slice(-5); // Last 5 failures
    
    let summary = `Execution failed after ${totalAttempts} attempts. Last error: ${error.message}`;
    
    if (recentFailures.length > 1) {
      summary += `\n\nRecent failure pattern (last ${recentFailures.length} failures):`;
      recentFailures.forEach((failure, index) => {
        const timeAgo = Math.round((Date.now() - failure.timestamp) / 1000);
        summary += `\n  ${index + 1}. ${timeAgo}s ago: ${failure.error?.substring(0, 100) || 'Unknown error'}`;
      });
    }
    
    summary += `\n\nCircuit breaker state: ${this.circuitBreaker.getState()}`;
    summary += `\n\nNext steps:`;
    summary += `\n  1. Wait a few minutes before retrying`;
    summary += `\n  2. Check system health and Claude browser session`;
    summary += `\n  3. Try a simpler task to verify basic functionality`;
    summary += `\n  4. Use --verbose flag for detailed debugging`;
    
    return summary;
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
   * Get execution statistics for monitoring
   */
  public getExecutionStats(): {
    totalAttempts: number;
    successRate: number;
    averageDuration: number;
    circuitBreakerState: string;
    recentFailures: number;
  } {
    const total = this.executionHistory.length;
    const successful = this.executionHistory.filter(a => a.success).length;
    const averageDuration = total > 0 
      ? Math.round(this.executionHistory.reduce((sum, a) => sum + a.duration, 0) / total)
      : 0;
    const recentFailures = this.executionHistory
      .filter(a => !a.success && (Date.now() - a.timestamp) < 300000) // Last 5 minutes
      .length;
    
    return {
      totalAttempts: total,
      successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
      averageDuration,
      circuitBreakerState: this.circuitBreaker.getState(),
      recentFailures
    };
  }
  
  /**
   * Reset circuit breaker (for administrative use)
   */
  public resetCircuitBreaker(): void {
    this.circuitBreaker = new CircuitBreaker();
    this.logger.info('Circuit breaker manually reset');
  }

  /**
   * Cleanup resources on shutdown
   */
  async shutdown(): Promise<void> {
    this.closeAllPTYSessions();
    
    const stats = this.getExecutionStats();
    this.logger.info('ClaudeExecutor shutdown completed', {
      finalStats: stats,
      totalExecutions: this.executionHistory.length
    });
  }
}