import { spawn, ChildProcess } from 'child_process';
import chalk from 'chalk';
import { ClaudeUtils } from '../claudeUtils';
import { Logger } from '../logger';

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

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
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
    const args = ['-p', prompt];
    
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
    const timeout = options.timeout || 120000; // 2 minutes default (reduced from 30 minutes)

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
}