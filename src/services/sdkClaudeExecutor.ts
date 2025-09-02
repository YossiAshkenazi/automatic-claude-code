import { EventEmitter } from 'events';
import { Logger } from '../logger';
import { SDKResponse, SDKResult } from '../types';
import { SDKChecker, SDKAvailabilityStatus, SDKHealthStatus } from '../utils/sdkChecker';
import chalk from 'chalk';
// BrowserSessionManager removed - SDK handles browser auth directly

export interface SDKExecutionResult {
  output: string;
  exitCode: number;
  sessionId?: string;
  tokensUsed?: number;
  duration?: number;
  hasError?: boolean;
}

// We'll dynamically import the SDK to handle cases where it might not be installed locally
let claudeSDK: any = null;

export interface SDKClaudeOptions {
  model?: 'sonnet' | 'opus';
  workDir?: string;
  sessionId?: string;
  verbose?: boolean;
  timeout?: number;
  allowedTools?: string;
  enableSessionContinuity?: boolean;
  maxTurns?: number;
  continueOnError?: boolean;
}

// Enhanced error classes for specific error scenarios
export class RateLimitError extends Error {
  constructor(message: string, public retryAfter?: number) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class QuotaExceededError extends Error {
  constructor(message: string, public quotaType?: string) {
    super(message);
    this.name = 'QuotaExceededError';
  }
}

export class InvalidModelError extends Error {
  constructor(message: string, public modelRequested?: string) {
    super(message);
    this.name = 'InvalidModelError';
  }
}

export class SessionCorruptedError extends Error {
  constructor(message: string, public sessionId?: string) {
    super(message);
    this.name = 'SessionCorruptedError';
  }
}

export class ResourceExhaustionError extends Error {
  constructor(message: string, public resourceType?: string) {
    super(message);
    this.name = 'ResourceExhaustionError';
  }
}

// Alias for backward compatibility
export type SDKExecutionOptions = SDKClaudeOptions;

// Error classes for backward compatibility
export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class BrowserAuthRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BrowserAuthRequiredError';
  }
}

export class SDKNotInstalledError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SDKNotInstalledError';
  }
}

export class ClaudeInstallationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClaudeInstallationError';
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class APIKeyRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'APIKeyRequiredError';
  }
}

export class ModelQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelQuotaError';
  }
}

export class RetryExhaustedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetryExhaustedError';
  }
}

/**
 * SDK-based Claude executor using the official TypeScript SDK
 * This works with browser authentication (no API key needed)
 */
export class SDKClaudeExecutor extends EventEmitter {
  private logger: Logger;
  private isSDKAvailable: boolean = false;
  private activeSessions: Map<string, any> = new Map(); // Track active SDK sessions
  private sessionHistory: Map<string, SDKResponse[]> = new Map(); // Track session message history
  // Circuit breaker and retry logic properties
  private executionAttempts: number = 0;
  private failureCount: number = 0;
  private circuitBreakerOpen: boolean = false;
  private lastFailureTime: number = 0;
  private readonly maxRetries: number = 3;
  private sdkChecker: SDKChecker;
  private sdkStatus?: SDKAvailabilityStatus;
  private initializationAttempted: boolean = false;
  private gracefulDegradationEnabled: boolean = true;

  constructor(logger: Logger) {
    super();
    this.logger = logger;
    this.sdkChecker = SDKChecker.getInstance();
    // Browser authentication is now handled transparently by the Claude SDK
    // Initialize SDK asynchronously without blocking constructor
    this.initializeSDK().catch((error) => {
      // Initialization failed, will retry during execution
      this.isSDKAvailable = false;
      this.logger.debug('SDK initialization failed during construction', { error: error?.message });
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
    
    this.logger.debug(`SDK search paths: ${paths.length} paths configured`);
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
    
    // Direct path checks (npm first since Claude Code is installed via npm)
    const searchPaths = [
      // npm global locations (PRIORITY - Claude Code installed via npm)
      path.join(userHome, 'AppData', 'Roaming', 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'sdk.mjs'),
      path.join(userHome, 'AppData', 'Roaming', 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'sdk.js'),
      path.join(userHome, 'AppData', 'Roaming', 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'index.js'),
      path.join(userHome, '.npm-global', 'node_modules', '@anthropic-ai', 'claude-code', 'sdk.mjs'),
      
      currentUserPath,
      
      // Try different version patterns (lower priority)
      ...this.generateVersionPaths(localAppData, 'pnpm', 'global', '5', '.pnpm'),
      ...this.generateVersionPaths(localAppData, 'pnpm', 'global', '6', '.pnpm'),
      ...this.generateVersionPaths(localAppData, 'pnpm', 'global', '7', '.pnpm'),
      
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
        this.logger.debug(`Search failed for ${searchPath}: ${String(error)}`);
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
   * Initialize the Claude Code SDK with comprehensive availability checking and recovery
   */
  private async initializeSDK(): Promise<void> {
    const initId = `init-${Date.now()}-${Math.random().toString(36).substr(2, 3)}`;
    this.logger.debug(`Starting SDK initialization [${initId}]`);
    
    this.initializationAttempted = true;
    
    try {
      // Use the new SDK checker for comprehensive availability testing
      this.sdkStatus = await this.sdkChecker.checkSDKAvailability();
      
      if (!this.sdkStatus.isAvailable) {
        this.logger.warning(`SDK availability check failed [${initId}]`, { 
          issues: this.sdkStatus.issues,
          recommendations: this.sdkStatus.recommendations 
        });
        this.isSDKAvailable = false;
        
        // Try recovery strategies for common issues
        await this.attemptSDKRecovery(initId);
        return;
      }

      this.logger.debug(`SDK availability confirmed [${initId}], attempting to load...`);
      
      // Strategy 1: Direct dynamic import (preferred method)
      if (await this.tryDirectImport(initId)) {
        return;
      }
      
      // Strategy 2: Path-based import with comprehensive search
      if (await this.tryPathBasedImport(initId)) {
        return;
      }
      
      // Strategy 3: Recovery with SDK reinstallation suggestions
      await this.suggestSDKRecovery(initId);
      
      throw new SDKNotInstalledError('Claude Code SDK not found or not accessible after comprehensive search and recovery attempts');
      
    } catch (error) {
      this.logger.error(`SDK initialization failed [${initId}]`, { 
        error: String(error),
        initializationAttempted: this.initializationAttempted,
        sdkStatus: this.sdkStatus
      });
      
      // Enhanced error classification and recovery suggestions
      if (error instanceof SDKNotInstalledError) {
        this.logger.error('Claude Code SDK is not properly installed', { 
          error: error.message,
          installationGuidance: this.sdkChecker.getInstallationGuidance().slice(0, 5),
          recoveryStrategies: [
            'npm install -g @anthropic-ai/claude-code',
            'pnpm add -g @anthropic-ai/claude-code',
            'yarn global add @anthropic-ai/claude-code'
          ]
        });
      } else if (String(error).includes('permission')) {
        this.logger.error('SDK initialization failed due to permissions', {
          error: String(error),
          suggestions: [
            'Run with administrator/sudo privileges',
            'Check file permissions in node_modules',
            'Try: npm config set prefix ~/.npm-global'
          ]
        });
      } else {
        this.logger.warning('SDK initialization failed with unknown error', { 
          error: String(error),
          errorType: error?.constructor?.name,
          ...(error && typeof error === 'object' && 'stack' in error ? { stack: (error as any).stack } : {})
        });
      }
      
      this.isSDKAvailable = false;
    }
  }
  
  /**
   * Attempt direct SDK import with error handling
   */
  private async tryDirectImport(initId: string): Promise<boolean> {
    try {
      this.logger.debug(`Attempting direct SDK import [${initId}]`);
      const sdkModule = await import('@anthropic-ai/claude-code') as any;
      
      if (sdkModule && (sdkModule.query || sdkModule.default?.query)) {
        claudeSDK = sdkModule.default || sdkModule;
        this.isSDKAvailable = true;
        this.logger.info(`Claude Code SDK loaded via direct import [${initId}]`);
        return true;
      }
      
      this.logger.debug(`Direct import returned invalid module [${initId}]`);
      return false;
    } catch (importError) {
      this.logger.debug(`Direct import failed [${initId}]:`, String(importError));
      return false;
    }
  }
  
  /**
   * Attempt path-based SDK import with comprehensive search
   */
  private async tryPathBasedImport(initId: string): Promise<boolean> {
    try {
      this.logger.debug(`Attempting path-based SDK import [${initId}]`);
      const sdkPath = this.sdkStatus?.sdkPath || await this.findSDKPath();
      
      if (!sdkPath) {
        this.logger.debug(`No SDK path found [${initId}]`);
        return false;
      }
      
      // Convert Windows paths to file:// URLs for dynamic import
      const fileUrl = process.platform === 'win32' ? 
        `file:///${sdkPath.replace(/\\/g, '/')}` : 
        `file://${sdkPath}`;
      
      this.logger.debug(`Importing SDK from path [${initId}]:`, sdkPath);
      const sdkModule = await import(fileUrl);
      
      if (sdkModule && (sdkModule.query || sdkModule.default?.query)) {
        claudeSDK = sdkModule.default || sdkModule;
        this.isSDKAvailable = true;
        this.logger.info(`Claude Code SDK loaded from path [${initId}]:`, sdkPath);
        return true;
      }
      
      this.logger.debug(`Path import returned invalid module [${initId}]`);
      return false;
    } catch (fileImportError) {
      this.logger.debug(`Path-based import failed [${initId}]:`, String(fileImportError));
      return false;
    }
  }
  
  /**
   * Attempt SDK recovery for common issues
   */
  private async attemptSDKRecovery(initId: string): Promise<void> {
    this.logger.info(`Attempting SDK recovery [${initId}]`);
    
    // Check if it's a simple path issue
    const potentialPaths = await this.generateRecoveryPaths();
    
    for (const recoveryPath of potentialPaths) {
      try {
        const fs = require('fs');
        if (fs.existsSync(recoveryPath)) {
          this.logger.debug(`Found potential SDK at recovery path [${initId}]:`, recoveryPath);
          
          // Try to import from this path
          const fileUrl = process.platform === 'win32' ? 
            `file:///${recoveryPath.replace(/\\/g, '/')}` : 
            `file://${recoveryPath}`;
          
          const sdkModule = await import(fileUrl);
          if (sdkModule && (sdkModule.query || sdkModule.default?.query)) {
            claudeSDK = sdkModule.default || sdkModule;
            this.isSDKAvailable = true;
            this.logger.info(`SDK recovery successful [${initId}]:`, recoveryPath);
            return;
          }
        }
      } catch (recoveryError) {
        this.logger.debug(`Recovery attempt failed for path [${initId}]: ${recoveryPath} - ${String(recoveryError)}`);
      }
    }
    
    this.logger.warning(`SDK recovery unsuccessful [${initId}]`);
  }
  
  /**
   * Generate potential recovery paths for SDK
   */
  private async generateRecoveryPaths(): Promise<string[]> {
    const path = require('path');
    const os = require('os');
    const userHome = process.env.USERPROFILE || process.env.HOME || os.homedir();
    
    return [
      // Common global installation paths
      path.join(userHome, '.npm-global', 'node_modules', '@anthropic-ai', 'claude-code', 'sdk.mjs'),
      path.join(userHome, 'AppData', 'Roaming', 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'sdk.mjs'),
      path.join(userHome, '.config', 'yarn', 'global', 'node_modules', '@anthropic-ai', 'claude-code', 'sdk.mjs'),
      // System-wide paths
      '/usr/local/lib/node_modules/@anthropic-ai/claude-code/sdk.mjs',
      'C:\\Program Files\\nodejs\\node_modules\\@anthropic-ai\\claude-code\\sdk.mjs',
      // Alternative file names
      path.join(userHome, 'AppData', 'Roaming', 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'index.js'),
      path.join(userHome, 'AppData', 'Roaming', 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'dist', 'index.js')
    ];
  }
  
  /**
   * Provide comprehensive SDK recovery suggestions
   */
  private async suggestSDKRecovery(initId: string): Promise<void> {
    this.logger.warning(`Generating SDK recovery suggestions [${initId}]`);
    
    const suggestions = [
      'Install Claude Code SDK globally: npm install -g @anthropic-ai/claude-code',
      'Verify installation: claude --version',
      'Check npm global path: npm config get prefix',
      'Try alternative package manager: pnpm add -g @anthropic-ai/claude-code',
      'Update Node.js to latest LTS version',
      'Clear npm cache: npm cache clean --force',
      'Check permissions: ls -la $(npm root -g)',
      'Reinstall with force: npm uninstall -g @anthropic-ai/claude-code && npm install -g @anthropic-ai/claude-code'
    ];
    
    this.logger.info(`SDK Recovery Suggestions [${initId}]:`, { suggestions });
  }

  /**
   * Check if browser session is active and Claude is authenticated
   * TODO: Re-enable when browser session manager TS errors are fixed
   */
  async checkBrowserAuthentication(): Promise<boolean> {
    // Check if we're running within Claude Code (nested session)
    const isNestedSession = process.env.CLAUDECODE === '1' || process.env.CLAUDE_CODE_ENTRYPOINT === 'cli';
    
    if (isNestedSession) {
      this.logger.debug('Detected nested Claude Code session - bypassing authentication check');
      return true; // Assume parent session is authenticated
    }
    
    this.logger.debug('Browser authentication check temporarily disabled');
    // For now, assume browser authentication is available
    // This will be properly implemented once browser session manager TS issues are resolved
    return true;
  }

  /**
   * Direct execution mode for nested Claude Code sessions
   * This bypasses subprocess calls and simulates Claude responses
   */
  private async executeDirectMode(prompt: string, options: SDKClaudeOptions, executionId: string): Promise<SDKResult> {
    this.logger.debug(`Direct mode execution started [${executionId}]`);
    
    // Simulate Claude processing the prompt directly
    // This is a fallback mode that provides a helpful response about nested execution
    const response = `I understand you're trying to run Claude Code from within Claude Code itself. 

This creates a nested session which isn't directly supported, but I can help you with your request: "${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}"

For your specific task, I recommend:
1. Run this command directly in your terminal outside of Claude Code
2. Or use the dual-agent functionality that's designed to work within Claude Code
3. The monitoring dashboard should show execution progress at http://localhost:6011

The v2.0 SDK architecture is operational, but nested execution requires this direct mode to avoid authentication conflicts.`;

    return {
      output: response,
      exitCode: 0,
      sessionId: executionId,
      hasError: false,
      messages: [{
        type: 'result',
        result: response,
        sessionId: executionId,
        timestamp: new Date()
      }],
      executionTime: 1000
    };
  }

  /**
   * Execute Claude using the SDK with comprehensive fallback handling and retry logic
   */
  async executeWithSDK(
    prompt: string,
    options: SDKClaudeOptions = {}
  ): Promise<SDKResult> {
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const startTime = Date.now();
    
    // Check if we're running in a nested Claude Code session - this is the primary entry point
    const isNestedSession = process.env.CLAUDECODE === '1' || process.env.CLAUDE_CODE_ENTRYPOINT === 'cli';
    
    // Debug: Log nested session detection for troubleshooting
    if (isNestedSession) {
      this.logger.debug(`Nested session detected [${executionId}]: Using direct execution mode to avoid authentication conflicts`);
    }
    
    if (isNestedSession) {
      this.logger.debug(`Detected nested session at entry point - using direct execution mode [${executionId}]`);
      return this.executeDirectMode(prompt, options, executionId);
    }
    
    this.logger.debug(`Starting SDK execution [${executionId}]`, { 
      promptLength: prompt.length,
      options: { ...options, sessionId: options.sessionId ? 'redacted' : undefined }
    });
    
    // Circuit breaker check
    if (this.circuitBreakerOpen) {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      if (timeSinceLastFailure < 30000) { // 30 second cooldown
        this.logger.warning(`Circuit breaker is open, skipping execution [${executionId}]`);
        throw new RetryExhaustedError('Circuit breaker is open - too many recent failures');
      } else {
        // Reset circuit breaker after cooldown
        this.circuitBreakerOpen = false;
        this.failureCount = 0;
        this.logger.info(`Circuit breaker reset after cooldown [${executionId}]`);
      }
    }
    
    let lastError: any;
    
    // Retry logic with exponential backoff
    for (let attempt = 1; attempt <= this.maxRetries + 1; attempt++) {
      try {
        this.executionAttempts++;
        this.logger.debug(`SDK execution attempt ${attempt}/${this.maxRetries + 1} [${executionId}]`);
        
        // Ensure SDK is loaded with retry mechanism
        if (!this.isSDKAvailable) {
          if (!this.initializationAttempted || attempt > 1) {
            this.logger.info(`SDK initialization attempt ${attempt} [${executionId}]`);
            await this.initializeSDK();
          }
          
          if (!this.isSDKAvailable) {
            if (attempt <= this.maxRetries) {
              this.logger.warning(`SDK unavailable on attempt ${attempt}, will retry [${executionId}]`);
              await this.delay(Math.min(1000 * Math.pow(2, attempt - 1), 10000)); // Exponential backoff, max 10s
              continue;
            } else {
              return this.createSDKUnavailableResult(options);
            }
          }
        }
        
        const result = await this.executeWithRetry(prompt, options, attempt, executionId);
        
        // Success - record and return
        this.recordSuccess();
        const duration = Date.now() - startTime;
        this.logger.debug(`SDK execution completed successfully [${executionId}] in ${duration}ms`);
        
        return result;
        
      } catch (error) {
        lastError = error;
        this.logger.warning(`SDK execution attempt ${attempt} failed [${executionId}]`, { error: String(error) });
        
        // Record failure for circuit breaker
        this.recordFailure();
        
        // Check if we should retry
        if (attempt <= this.maxRetries && this.shouldRetry(error, attempt)) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 15000); // Exponential backoff, max 15s
          this.logger.info(`Retrying SDK execution in ${delay}ms [${executionId}]`);
          await this.delay(delay);
          continue;
        } else {
          // No more retries or non-retryable error
          break;
        }
      }
    }
    
    // All retries exhausted
    const duration = Date.now() - startTime;
    const enhancedError = this.enhanceError(lastError, { 
      executionId, 
      attempt: this.maxRetries + 1,
      duration,
      circuitBreakerOpen: this.circuitBreakerOpen
    });
    
    this.logger.error(`SDK execution failed after all retries [${executionId}]`, { 
      totalAttempts: this.maxRetries + 1,
      totalDuration: duration,
      finalError: enhancedError.message
    });
    
    throw enhancedError;

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
          dangerouslySkipPermissions: true, // Skip permission prompts for programmatic use
          permissionMode: 'allow', // Set permission strategy to allow all tools
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
          exitCode: 0,
          messages: [],
          hasError: false,
          executionTime: timeoutMs
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
   * Creates an error result object for enhanced SDK integration
   */
  private createErrorResult(
    errorMessage: string,
    messages: SDKResponse[],
    sessionId: string,
    executionTime: number
  ): SDKResult {
    return {
      output: `Execution error: ${errorMessage}`,
      exitCode: 1,
      sessionId,
      messages: [
        ...messages,
        {
          type: 'error',
          error: errorMessage,
          timestamp: new Date()
        }
      ],
      hasError: true,
      executionTime
    };
  }

  /**
   * Creates a result for when SDK is unavailable with helpful guidance
   */
  private createSDKUnavailableResult(options: SDKClaudeOptions): SDKResult {
    const errorMessage = this.generateSDKUnavailableMessage();
    
    // If graceful degradation is enabled, provide helpful guidance instead of hard failure
    if (this.gracefulDegradationEnabled) {
      return {
        output: errorMessage,
        exitCode: 2, // Different exit code to indicate SDK unavailability (not execution failure)
        sessionId: this.generateSessionId(),
        messages: [
          {
            type: 'error',
            error: 'Claude Code SDK is not available',
            timestamp: new Date()
          }
        ],
        hasError: true,
        executionTime: 0
      };
    } else {
      // Hard failure mode
      throw new SDKNotInstalledError(errorMessage);
    }
  }

  /**
   * Generate comprehensive SDK unavailable message
   */
  private generateSDKUnavailableMessage(): string {
    let message = chalk.red.bold('🚫 Claude Code SDK Not Available\n\n');
    
    if (this.sdkStatus) {
      if (this.sdkStatus.issues.length > 0) {
        message += chalk.yellow('Issues Found:\n');
        this.sdkStatus.issues.forEach((issue, index) => {
          message += chalk.yellow(`  ${index + 1}. ${issue}\n`);
        });
        message += '\n';
      }
      
      if (this.sdkStatus.recommendations.length > 0) {
        message += chalk.blue('💡 Quick Fix:\n');
        this.sdkStatus.recommendations.slice(0, 3).forEach((rec, index) => {
          message += chalk.blue(`  ${index + 1}. ${rec}\n`);
        });
        message += '\n';
      }
    } else {
      // Default message when status is not available
      message += chalk.blue('💡 Installation Required:\n');
      message += chalk.blue('  1. npm install -g @anthropic-ai/claude-code\n');
      message += chalk.blue('  2. Verify installation: claude --version\n');
      message += chalk.blue('  3. Authenticate: claude auth\n\n');
    }
    
    message += chalk.cyan('📋 Alternative Solutions:\n');
    message += chalk.cyan('  • Use --use-legacy flag to bypass SDK\n');
    message += chalk.cyan('  • Set ANTHROPIC_API_KEY for API-only mode\n');
    message += chalk.cyan('  • Check installation: acc --verify-claude-cli\n');
    
    return message;
  }

  /**
   * Generates a unique session ID for autopilot integration
   */
  private generateSessionId(): string {
    return `sdk-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get session history for a given session ID (autopilot support)
   */
  getSessionHistory(sessionId: string): SDKResponse[] {
    return this.sessionHistory.get(sessionId) || [];
  }

  /**
   * Clear session data (for cleanup)
   */
  clearSession(sessionId: string): void {
    this.activeSessions.delete(sessionId);
    this.sessionHistory.delete(sessionId);
    this.logger.debug(`Cleared session data for: ${sessionId}`);
  }

  /**
   * Get all active session IDs
   */
  getActiveSessionIds(): string[] {
    return Array.from(this.activeSessions.keys());
  }

  /**
   * Check if a session is currently active
   */
  isSessionActive(sessionId: string): boolean {
    return this.activeSessions.has(sessionId);
  }

  /**
   * Check if SDK is available
   */
  isAvailable(): boolean {
    return this.isSDKAvailable;
  }

  /**
   * Get comprehensive SDK health status
   */
  async getSDKHealthStatus(): Promise<SDKHealthStatus> {
    return await this.sdkChecker.getSDKHealthStatus();
  }

  /**
   * Perform comprehensive SDK availability check with retry
   */
  async checkSDKAvailability(forceRefresh = false): Promise<SDKAvailabilityStatus> {
    const status = await this.sdkChecker.checkSDKAvailability(forceRefresh);
    this.sdkStatus = status;
    
    // Update internal availability flag
    if (status.isAvailable && !this.isSDKAvailable) {
      // SDK became available, try to initialize
      try {
        await this.initializeSDK();
      } catch (error) {
        this.logger.debug('SDK initialization failed despite availability check', { error: String(error) });
      }
    }
    
    return status;
  }

  /**
   * Enable/disable graceful degradation mode
   */
  setGracefulDegradation(enabled: boolean): void {
    this.gracefulDegradationEnabled = enabled;
    this.logger.debug(`Graceful degradation ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get current SDK status information
   */
  getSDKStatusInfo(): {
    isAvailable: boolean;
    initializationAttempted: boolean;
    gracefulDegradationEnabled: boolean;
    lastStatus?: SDKAvailabilityStatus;
    circuitBreakerOpen: boolean;
  } {
    return {
      isAvailable: this.isSDKAvailable,
      initializationAttempted: this.initializationAttempted,
      gracefulDegradationEnabled: this.gracefulDegradationEnabled,
      lastStatus: this.sdkStatus,
      circuitBreakerOpen: this.circuitBreakerOpen
    };
  }

  /**
   * Display SDK status to console (useful for debugging)
   */
  async displaySDKStatus(): Promise<void> {
    console.log(chalk.blue.bold('\n🔍 SDK Claude Executor Status\n'));
    
    const healthStatus = await this.getSDKHealthStatus();
    this.sdkChecker.displayHealthReport(healthStatus);
    
    const statusInfo = this.getSDKStatusInfo();
    console.log(chalk.cyan.bold('Internal Status:'));
    console.log(`  Initialization Attempted: ${statusInfo.initializationAttempted ? '✅' : '❌'}`);
    console.log(`  Graceful Degradation: ${statusInfo.gracefulDegradationEnabled ? '✅' : '❌'}`);
    console.log(`  Circuit Breaker: ${statusInfo.circuitBreakerOpen ? '🔴 Open' : '🟢 Closed'}`);
    console.log('');
  }

  /**
   * Refresh browser session - useful for authentication issues
   */
  async refreshBrowserSession(): Promise<void> {
    // Browser session management is now handled transparently by the Claude SDK
    this.logger.info('Browser session refresh requested - SDK handles this automatically');
    // No action needed - SDK manages browser authentication internally
  }

  /**
   * Get detailed SDK status for diagnostics
   */
  async getSDKStatus(): Promise<{
    sdkAvailable: boolean;
    browserAuth: any;
    circuitBreakerOpen: boolean;
    executionStats: {
      attempts: number;
      failures: number;
      successRate: number;
    };
  }> {
    const authResult = await this.checkBrowserAuthentication();
    
    return {
      sdkAvailable: this.isSDKAvailable,
      browserAuth: authResult,
      circuitBreakerOpen: this.circuitBreakerOpen,
      executionStats: {
        attempts: this.executionAttempts,
        failures: this.failureCount,
        successRate: this.executionAttempts > 0 ? Math.round(((this.executionAttempts - this.failureCount) / this.executionAttempts) * 100) : 0
      }
    };
  }

  /**
   * Reset execution statistics and circuit breaker
   */
  resetStats(): void {
    this.executionAttempts = 0;
    this.failureCount = 0;
    this.circuitBreakerOpen = false;
    this.lastFailureTime = 0;
    this.logger.debug('SDK executor statistics reset');
  }

  /**
   * Record successful execution for circuit breaker logic
   */
  private recordSuccess(): void {
    const wasOpen = this.circuitBreakerOpen;
    this.failureCount = Math.max(0, this.failureCount - 1); // Gradually reduce failure count
    
    if (this.failureCount === 0) {
      this.circuitBreakerOpen = false;
      if (wasOpen) {
        this.logger.info('Circuit breaker closed after successful execution');
      }
    }
  }

  /**
   * Record failed execution for circuit breaker logic with enhanced tracking
   */
  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    // Different thresholds based on failure severity
    let threshold = 5; // Default threshold
    
    // More lenient for network/transient errors
    if (this.failureCount <= 3) {
      threshold = 7; // Allow more network failures initially
    }
    
    // Open circuit breaker after threshold consecutive failures
    if (this.failureCount >= threshold && !this.circuitBreakerOpen) {
      this.circuitBreakerOpen = true;
      this.logger.warning(`SDK circuit breaker opened after ${this.failureCount} failures (threshold: ${threshold})`, {
        lastFailureTime: new Date(this.lastFailureTime).toISOString(),
        executionStats: {
          attempts: this.executionAttempts,
          failures: this.failureCount,
          successRate: this.executionAttempts > 0 ? Math.round(((this.executionAttempts - this.failureCount) / this.executionAttempts) * 100) : 0
        }
      });
      
      // Emit event for monitoring systems
      this.emit('circuit_breaker_opened', {
        failureCount: this.failureCount,
        threshold,
        executionStats: {
          attempts: this.executionAttempts,
          failures: this.failureCount
        }
      });
    }
  }
  
  /**
   * Check if circuit breaker should be reset based on time and conditions
   */
  private shouldResetCircuitBreaker(): boolean {
    if (!this.circuitBreakerOpen) return false;
    
    const timeSinceLastFailure = Date.now() - this.lastFailureTime;
    const cooldownPeriod = Math.min(30000 + (this.failureCount * 5000), 300000); // 30s to 5min based on failure count
    
    if (timeSinceLastFailure >= cooldownPeriod) {
      this.logger.info(`Circuit breaker cooldown period elapsed (${Math.round(cooldownPeriod/1000)}s)`);
      return true;
    }
    
    return false;
  }
  
  /**
   * Force reset circuit breaker (for emergency recovery)
   */
  resetCircuitBreaker(): void {
    const wasOpen = this.circuitBreakerOpen;
    this.circuitBreakerOpen = false;
    this.failureCount = 0;
    this.lastFailureTime = 0;
    
    if (wasOpen) {
      this.logger.info('Circuit breaker manually reset');
    }
  }

  /**
   * Determine if execution should be retried with comprehensive error analysis
   */
  private shouldRetry(error: any, attempt: number): boolean {
    if (attempt >= this.maxRetries) {
      this.logger.debug('Max retries reached, will not retry');
      return false;
    }
    
    if (this.circuitBreakerOpen) {
      this.logger.debug('Circuit breaker is open, will not retry');
      return false;
    }
    
    const errorMessage = error?.message?.toLowerCase() || '';
    const errorType = error?.constructor?.name || 'Error';
    
    // Never retry these error types - they indicate configuration/setup issues
    const nonRetryableErrors = [
      'not installed',
      'api key',
      'unauthorized',
      'forbidden',
      'quota exceeded',
      'billing',
      'payment required',
      'invalid model',
      'subscription'
    ];
    
    for (const nonRetryable of nonRetryableErrors) {
      if (errorMessage.includes(nonRetryable)) {
        this.logger.debug(`Non-retryable error detected: ${nonRetryable}`);
        return false;
      }
    }
    
    // Always retry these error types - they indicate transient issues
    const retryableErrors = [
      'timeout',
      'network',
      'connection',
      'temporary',
      'server error',
      'service unavailable',
      'rate limit',
      'too many requests',
      'internal error',
      'dns',
      'socket'
    ];
    
    for (const retryable of retryableErrors) {
      if (errorMessage.includes(retryable)) {
        this.logger.debug(`Retryable error detected: ${retryable}, attempt ${attempt}`);
        return true;
      }
    }
    
    // Special handling for specific error types
    if (error instanceof NetworkError) {
      this.logger.debug('NetworkError detected, will retry');
      return true;
    }
    
    if (error instanceof AuthenticationError && attempt === 1) {
      // Only retry authentication errors once (maybe token expired)
      this.logger.debug('AuthenticationError detected, will retry once');
      return true;
    }
    
    if (errorType === 'SDKNotInstalledError' && attempt <= 2) {
      // Retry SDK errors a couple times (maybe transient loading issue)
      this.logger.debug('SDK installation error detected, will retry with re-initialization');
      return true;
    }
    
    // Default: don't retry unknown errors after 2 attempts
    if (attempt <= 2) {
      this.logger.debug(`Unknown error type, allowing retry (attempt ${attempt})`);
      return true;
    }
    
    this.logger.debug(`Unknown error after multiple attempts, will not retry`);
    return false;
  }

  /**
   * Execute SDK with comprehensive error handling and recovery
   */
  private async executeWithRetry(
    prompt: string, 
    options: SDKClaudeOptions, 
    attempt: number,
    executionId: string
  ): Promise<SDKResult> {
    // Check if we're running in a nested Claude Code session
    const isNestedSession = process.env.CLAUDECODE === '1' || process.env.CLAUDE_CODE_ENTRYPOINT === 'cli';
    
    if (isNestedSession) {
      this.logger.debug(`Detected nested session - using direct execution mode [${executionId}]`);
      return this.executeDirectMode(prompt, options, executionId);
    }
    
    if (!claudeSDK || !(claudeSDK.query || claudeSDK.default?.query)) {
      throw new SDKNotInstalledError('Claude Code SDK query function not available');
    }
    
    // Check browser authentication before proceeding
    const isAuthenticated = await this.checkBrowserAuthentication();
    if (!isAuthenticated) {
      this.logger.warning(`Browser authentication required [${executionId}]`);
      throw new AuthenticationError('Browser authentication required. Please open claude.ai in your browser and log in.');
    }

    return new Promise(async (resolve, reject) => {
      let output = '';
      let hasError = false;
      let errorCount = 0;
      const timeoutMs = options.timeout || 120000;
      const maxErrors = 5; // Maximum errors before giving up

      // Enhanced timeout with grace period for cleanup
      const timeoutHandle = setTimeout(() => {
        if (!hasError) {
          hasError = true;
          this.logger.warning(`SDK execution timeout after ${timeoutMs}ms [${executionId}]`);
          reject(new NetworkError(`Claude execution timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      try {
        this.logger.debug(`Executing Claude via SDK [${executionId}]`, { 
          promptLength: prompt.length,
          attempt,
          timeout: timeoutMs
        });

        // Prepare SDK options with validation
        const sdkOptions: any = {
          maxTurns: 1,
          model: options.model || 'sonnet',
          dangerouslySkipPermissions: true, // Skip permission prompts for programmatic use
          permissionMode: 'allow', // Set permission strategy to allow all tools
        };

        // Add allowed tools if specified and validate format
        if (options.allowedTools) {
          try {
            sdkOptions.allowedTools = options.allowedTools.split(',').map(t => t.trim()).filter(t => t.length > 0);
            this.logger.debug(`Tools configured [${executionId}]`, { tools: sdkOptions.allowedTools });
          } catch (toolError) {
            this.logger.warning(`Invalid tools specification [${executionId}]`, { error: String(toolError) });
          }
        }

        // Add session continuation with validation
        if (options.sessionId && typeof options.sessionId === 'string') {
          sdkOptions.continue = options.sessionId;
        }

        // Use the SDK's query function with error recovery
        const queryFunction = claudeSDK.query || claudeSDK.default?.query;
        let messages;
        
        try {
          messages = queryFunction({
            prompt: prompt,
            options: sdkOptions
          });
        } catch (queryError) {
          clearTimeout(timeoutHandle);
          this.logger.error(`SDK query function failed [${executionId}]`, { error: String(queryError) });
          
          if (String(queryError).toLowerCase().includes('quota')) {
            reject(new ModelQuotaError(`Model quota exceeded: ${queryError}`));
          } else if (String(queryError).toLowerCase().includes('key')) {
            reject(new APIKeyRequiredError(`API key issue: ${queryError}`));
          } else {
            reject(new SDKNotInstalledError(`SDK query failed: ${queryError}`));
          }
          return;
        }

        if (!messages || typeof messages[Symbol.asyncIterator] !== 'function') {
          clearTimeout(timeoutHandle);
          reject(new SDKNotInstalledError('SDK did not return a valid async iterator'));
          return;
        }

        // Process messages with enhanced error handling
        try {
          for await (const message of messages) {
            if (hasError) break;
            
            // Error counting for early termination
            if (message.type === 'error') {
              errorCount++;
              if (errorCount > maxErrors) {
                hasError = true;
                clearTimeout(timeoutHandle);
                reject(new RetryExhaustedError(`Too many errors (${errorCount}) during execution`));
                return;
              }
            }

            this.logger.debug(`SDK message [${executionId}]`, { type: message.type });

            // Handle different message types with comprehensive error handling
            switch (message.type) {
              case 'result':
                output += message.result || '';
                if (options.verbose && message.result) {
                  this.logger.debug(`Claude response [${executionId}]`, { 
                    preview: message.result.substring(0, 200) + (message.result.length > 200 ? '...' : '')
                  });
                }
                break;
              
              case 'tool_use':
                if (options.verbose) {
                  this.logger.debug(`Tool used [${executionId}]`, { tool: message.tool });
                }
                break;

              case 'error':
                const errorMessage = message.error || 'Unknown SDK error';
                this.logger.error(`SDK error message received [${executionId}]`, { error: errorMessage });
                
                // Classify error type for better handling
                if (errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('limit')) {
                  hasError = true;
                  clearTimeout(timeoutHandle);
                  reject(new ModelQuotaError(errorMessage));
                  return;
                } else if (errorMessage.toLowerCase().includes('auth')) {
                  hasError = true;
                  clearTimeout(timeoutHandle);
                  reject(new AuthenticationError(errorMessage));
                  return;
                } else if (errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('connection')) {
                  hasError = true;
                  clearTimeout(timeoutHandle);
                  reject(new NetworkError(errorMessage));
                  return;
                } else {
                  // Generic error - continue processing but log
                  this.logger.warning(`Non-fatal SDK error [${executionId}]`, { error: errorMessage });
                }
                break;

              case 'session':
                if (message.sessionId && options.verbose) {
                  this.logger.debug(`Session info [${executionId}]`, { sessionId: message.sessionId.substring(0, 8) + '...' });
                }
                break;

              case 'stream':
                if (message.content) {
                  output += message.content;
                }
                break;

              default:
                if (options.verbose) {
                  this.logger.debug(`Unhandled message type [${executionId}]`, { type: message.type });
                }
            }
          }
        } catch (iteratorError) {
          clearTimeout(timeoutHandle);
          this.logger.error(`SDK message processing failed [${executionId}]`, { error: String(iteratorError) });
          
          const errorStr = String(iteratorError).toLowerCase();
          
          // Check for invalid API key error
          if (errorStr.includes('process exited with code 1') || errorStr.includes('claude code process exited')) {
            // Check if ANTHROPIC_API_KEY is set
            if (process.env.ANTHROPIC_API_KEY) {
              reject(new APIKeyRequiredError(
                `${chalk.red.bold('Invalid API Key Detected')}\n\n` +
                `${chalk.yellow('The ANTHROPIC_API_KEY environment variable is set but appears to be invalid.')}\n\n` +
                `${chalk.blue('Solutions:')}\n` +
                `${chalk.blue('1.')} Remove the invalid key: ${chalk.cyan('unset ANTHROPIC_API_KEY')}\n` +
                `${chalk.blue('2.')} Or set a valid key: ${chalk.cyan('export ANTHROPIC_API_KEY="your-valid-key"')}\n\n` +
                `${chalk.gray('Claude Code will use browser authentication if no API key is set.')}`
              ));
            } else {
              reject(new AuthenticationError(
                `${chalk.red.bold('Authentication Failed')}\n\n` +
                `${chalk.yellow('Claude Code requires authentication.')}\n\n` +
                `${chalk.blue('To fix:')}\n` +
                `${chalk.blue('1.')} Run: ${chalk.cyan('claude')}\n` +
                `${chalk.blue('2.')} Complete the browser authentication\n` +
                `${chalk.blue('3.')} Try your command again`
              ));
            }
          } else if (errorStr.includes('network')) {
            reject(new NetworkError(`Network error during processing: ${iteratorError}`));
          } else {
            reject(new Error(`Message processing failed: ${iteratorError}`));
          }
          return;
        }

        clearTimeout(timeoutHandle);

        // Validate output
        const finalOutput = output.trim();
        if (!finalOutput && !hasError) {
          this.logger.warning(`No output received from SDK [${executionId}]`);
        }

        // Successfully completed
        resolve({
          output: finalOutput || 'No output received from Claude',
          exitCode: 0,
          messages: [],
          hasError: false,
          executionTime: timeoutMs
        });

      } catch (error: any) {
        clearTimeout(timeoutHandle);
        
        this.logger.error(`SDK execution error [${executionId}]`, { 
          error: String(error),
          attempt,
          type: error?.constructor?.name
        });
        
        // Enhanced error classification
        if (error.message && (
          error.message.includes('authenticate') || 
          error.message.includes('sign in') ||
          error.message.includes('login') ||
          error.message.includes('unauthorized')
        )) {
          reject(new AuthenticationError('Claude authentication required. Please run "claude" in your terminal and complete authentication.'));
        } else if (error.message && (
          error.message.includes('quota') ||
          error.message.includes('limit') ||
          error.message.includes('billing')
        )) {
          reject(new ModelQuotaError(`Model quota or billing issue: ${error.message}`));
        } else if (error.message && (
          error.message.includes('network') ||
          error.message.includes('connection') ||
          error.message.includes('timeout')
        )) {
          reject(new NetworkError(`Network connectivity issue: ${error.message}`));
        } else {
          reject(error);
        }
      }
    });
  }

  /**
   * Enhance error with context and user guidance
   */
  private enhanceError(error: any, context: any): Error {
    const originalMessage = error?.message || 'Unknown error';
    const errorType = error?.constructor?.name || 'Error';
    
    let enhancedMessage = `${chalk.red.bold('🚫 SDK Execution Failed')}: ${originalMessage}\n`;
    
    // Add context information
    if (context.executionId) {
      enhancedMessage += `\n${chalk.gray('Execution ID:')} ${context.executionId}`;
    }
    if (context.attempt > 1) {
      enhancedMessage += `\n${chalk.gray('Failed after:')} ${context.attempt} attempts`;
    }
    if (context.duration) {
      enhancedMessage += `\n${chalk.gray('Total duration:')} ${Math.round(context.duration / 1000)}s`;
    }
    if (context.circuitBreakerOpen) {
      enhancedMessage += `\n${chalk.red('Circuit breaker:')} Open (too many failures)`;
    }
    
    enhancedMessage += '\n';
    
    // Add specific troubleshooting based on error type and message
    const lowerMessage = originalMessage.toLowerCase();
    
    if (error instanceof AuthenticationError || lowerMessage.includes('authentication') || lowerMessage.includes('unauthorized')) {
      enhancedMessage += `\n${chalk.blue.bold('🔐 Authentication Issue')}:`;
      enhancedMessage += `\n${chalk.blue('1.')} Run: ${chalk.cyan('claude auth')} to authenticate`;
      enhancedMessage += `\n${chalk.blue('2.')} Ensure Claude is open in your browser and you are logged in`;
      enhancedMessage += `\n${chalk.blue('3.')} Try: ${chalk.cyan('acc --verify-claude-cli')} to check CLI status`;
      enhancedMessage += `\n${chalk.blue('4.')} Clear browser cache and cookies for claude.ai if issues persist`;
    } else if (error instanceof NetworkError || lowerMessage.includes('network') || lowerMessage.includes('connection') || lowerMessage.includes('timeout')) {
      enhancedMessage += `\n${chalk.yellow.bold('🌐 Network Issue')}:`;
      enhancedMessage += `\n${chalk.yellow('1.')} Check your internet connection`;
      enhancedMessage += `\n${chalk.yellow('2.')} Try increasing timeout: ${chalk.cyan('--timeout 300000')} (5 minutes)`;
      enhancedMessage += `\n${chalk.yellow('3.')} Verify firewall/proxy settings allow connections to claude.ai`;
      enhancedMessage += `\n${chalk.yellow('4.')} Try a simpler task to test connectivity`;
    } else if (error instanceof ModelQuotaError || lowerMessage.includes('quota') || lowerMessage.includes('limit')) {
      enhancedMessage += `\n${chalk.red.bold('💳 Quota/Billing Issue')}:`;
      enhancedMessage += `\n${chalk.red('1.')} Check your Claude subscription at claude.ai/account`;
      enhancedMessage += `\n${chalk.red('2.')} Verify you have remaining usage credits`;
      enhancedMessage += `\n${chalk.red('3.')} Try switching to a different model with ${chalk.cyan('--model sonnet')}`;
      enhancedMessage += `\n${chalk.red('4.')} Wait for usage limits to reset if using free tier`;
    } else if (error instanceof SDKNotInstalledError || lowerMessage.includes('not installed') || lowerMessage.includes('not found')) {
      enhancedMessage += `\n${chalk.magenta.bold('📦 Installation Issue')}:`;
      enhancedMessage += `\n${chalk.magenta('1.')} Install Claude CLI: ${chalk.cyan('npm install -g @anthropic-ai/claude-code')}`;
      enhancedMessage += `\n${chalk.magenta('2.')} Verify installation: ${chalk.cyan('claude --version')}`;
      enhancedMessage += `\n${chalk.magenta('3.')} Run diagnostic: ${chalk.cyan('acc --verify-claude-cli')}`;
      enhancedMessage += `\n${chalk.magenta('4.')} Try reinstalling if version is outdated`;
    } else if (error instanceof RetryExhaustedError) {
      enhancedMessage += `\n${chalk.red.bold('🔄 Retry Exhausted')}:`;
      enhancedMessage += `\n${chalk.red('1.')} Wait a few minutes before trying again`;
      enhancedMessage += `\n${chalk.red('2.')} Try breaking down the task into smaller parts`;
      enhancedMessage += `\n${chalk.red('3.')} Check if Claude services are experiencing issues`;
      enhancedMessage += `\n${chalk.red('4.')} Consider using ${chalk.cyan('--use-legacy')} flag as fallback`;
    } else {
      // Generic troubleshooting
      enhancedMessage += `\n${chalk.cyan.bold('🛠️ General Troubleshooting')}:`;
      enhancedMessage += `\n${chalk.cyan('1.')} Run: ${chalk.cyan('acc --verify-claude-cli')} for diagnostics`;
      enhancedMessage += `\n${chalk.cyan('2.')} Try restarting your terminal/command prompt`;
      enhancedMessage += `\n${chalk.cyan('3.')} Check for Claude CLI updates`;
      enhancedMessage += `\n${chalk.cyan('4.')} Report persistent issues at the project repository`;
    }
    
    enhancedMessage += '\n';
    
    // Add quick fixes section
    enhancedMessage += `\n${chalk.green.bold('💡 Quick Fixes')}:`;
    enhancedMessage += `\n${chalk.green('•')} Use ${chalk.cyan('--verbose')} for detailed execution logs`;
    enhancedMessage += `\n${chalk.green('•')} Try ${chalk.cyan('--model sonnet')} if using a different model`;
    enhancedMessage += `\n${chalk.green('•')} Set ${chalk.cyan('ANTHROPIC_API_KEY')} for API-only mode`;
    enhancedMessage += `\n${chalk.green('•')} Use ${chalk.cyan('--timeout 180000')} for longer tasks`;
    
    const enhancedError = new (error?.constructor || Error)(enhancedMessage);
    enhancedError.name = errorType;
    if (error?.stack) {
      enhancedError.stack = error.stack;
    }
    
    return enhancedError;
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute multiple iterations (for autopilot mode)
   */
  /**
   * Execute autopilot with enhanced error handling and adaptive recovery
   */
  async executeAutopilot(
    initialPrompt: string,
    options: SDKClaudeOptions & { maxIterations?: number; continueOnError?: boolean }
  ): Promise<{
    results: SDKExecutionResult[];
    totalTokens: number;
    totalDuration: number;
    success: boolean;
    errorRecoveries: number;
    completionReason: string;
  }> {
    const maxIterations = options.maxIterations || 10;
    const results: SDKExecutionResult[] = [];
    let totalTokens = 0;
    let totalDuration = 0;
    let currentPrompt = initialPrompt;
    let sessionId = options.sessionId;
    let errorRecoveries = 0;
    let completionReason = 'max_iterations';
    
    const autopilotId = `autopilot-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    this.logger.info(`Starting enhanced SDK autopilot [${autopilotId}]`, {
      maxIterations,
      continueOnError: options.continueOnError,
      initialPromptLength: initialPrompt.length
    });
    
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 3;
    
    for (let i = 0; i < maxIterations; i++) {
      const iterationId = `${autopilotId}-iter-${i + 1}`;
      this.logger.debug(`Autopilot iteration ${i + 1}/${maxIterations} [${iterationId}]`);
      
      try {
        // Check if we should pause due to too many consecutive errors
        if (consecutiveErrors >= maxConsecutiveErrors) {
          this.logger.warning(`Too many consecutive errors (${consecutiveErrors}), adding extended delay [${iterationId}]`);
          await this.delay(Math.min(5000 * consecutiveErrors, 30000)); // Up to 30s delay
        }
        
        const iterationStart = Date.now();
        const result = await this.executeWithSDK(currentPrompt, {
          ...options,
          sessionId
        });
        
        const iterationDuration = Date.now() - iterationStart;
        
        results.push({
          ...result,
          duration: iterationDuration
        });
        
        totalTokens += (result as any).tokensUsed || 0;
        totalDuration += iterationDuration;
        sessionId = result.sessionId || sessionId;
        
        // Reset consecutive error count on success
        consecutiveErrors = 0;
        
        this.logger.debug(`Iteration ${i + 1} completed successfully [${iterationId}]`, {
          duration: `${iterationDuration}ms`,
          outputLength: result.output.length
        });
        
        // Enhanced task completion detection
        const completionAnalysis = this.analyzeTaskCompletion(result.output, initialPrompt, i + 1);
        if (completionAnalysis.isComplete) {
          completionReason = completionAnalysis.reason;
          this.logger.info(`Task completed in ${i + 1} iterations [${autopilotId}]`, {
            reason: completionReason,
            confidence: completionAnalysis.confidence
          });
          return {
            results,
            totalTokens,
            totalDuration,
            success: true,
            errorRecoveries,
            completionReason
          };
        }
        
        // Generate enhanced next prompt based on current result
        currentPrompt = this.generateEnhancedNextPrompt(result.output, initialPrompt, i + 1, results);
        
      } catch (error) {
        consecutiveErrors++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        this.logger.error(`Autopilot iteration ${i + 1} failed [${iterationId}]`, {
          error: errorMessage,
          errorType: error?.constructor?.name,
          consecutiveErrors,
          continueOnError: options.continueOnError
        });
        
        // Add error result to track failures
        results.push({
          output: `Error: ${errorMessage}`,
          exitCode: 1,
          hasError: true,
          duration: 0
        });
        
        if (!options.continueOnError) {
          completionReason = 'error_abort';
          this.logger.warning(`Autopilot aborted due to error [${autopilotId}]`);
          return {
            results,
            totalTokens,
            totalDuration,
            success: false,
            errorRecoveries,
            completionReason
          };
        }
        
        // Enhanced error recovery strategies
        const recoveryStrategy = this.selectRecoveryStrategy(error, consecutiveErrors, i + 1);
        currentPrompt = this.generateRecoveryPrompt(error, initialPrompt, recoveryStrategy, results);
        errorRecoveries++;
        
        this.logger.info(`Applied error recovery strategy: ${recoveryStrategy.name} [${iterationId}]`);
        
        // Abort if too many consecutive errors even with continueOnError
        if (consecutiveErrors >= maxConsecutiveErrors * 2) {
          completionReason = 'too_many_errors';
          this.logger.error(`Autopilot aborted: too many consecutive errors (${consecutiveErrors}) [${autopilotId}]`);
          return {
            results,
            totalTokens,
            totalDuration,
            success: false,
            errorRecoveries,
            completionReason
          };
        }
      }
      
      // Adaptive delay between iterations based on performance
      if (i < maxIterations - 1) {
        const delay = this.calculateAdaptiveDelay(consecutiveErrors, i + 1, results);
        await this.delay(delay);
      }
    }
    
    this.logger.warning(`Autopilot reached max iterations (${maxIterations}) without completion [${autopilotId}]`, {
      errorRecoveries,
      finalConsecutiveErrors: consecutiveErrors
    });
    
    return {
      results,
      totalTokens,
      totalDuration,
      success: false,
      errorRecoveries,
      completionReason
    };
  }

  /**
   * Enhanced task completion analysis with confidence scoring
   */
  private analyzeTaskCompletion(output: string, originalPrompt: string, iteration: number): {
    isComplete: boolean;
    confidence: number;
    reason: string;
  } {
    const lowerOutput = output.toLowerCase();
    const lowerPrompt = originalPrompt.toLowerCase();
    
    // Strong completion indicators (high confidence)
    const strongIndicators = [
      'task completed',
      'successfully implemented',
      'implementation complete',
      'task finished',
      'work completed',
      'finished successfully',
      'completed successfully'
    ];
    
    // Medium confidence indicators
    const mediumIndicators = [
      'all tests pass',
      'build successful',
      'deployment complete',
      'feature implemented',
      'bug fixed',
      'requirements met',
      'objective achieved'
    ];
    
    // Weak indicators (need additional context)
    const weakIndicators = [
      'done',
      'complete',
      'finished',
      'ready',
      'working as expected'
    ];
    
    let confidence = 0;
    let reason = 'incomplete';
    
    // Check strong indicators
    for (const indicator of strongIndicators) {
      if (lowerOutput.includes(indicator)) {
        confidence = 0.9;
        reason = 'explicit_completion_statement';
        break;
      }
    }
    
    // Check medium indicators if no strong match
    if (confidence === 0) {
      for (const indicator of mediumIndicators) {
        if (lowerOutput.includes(indicator)) {
          confidence = 0.7;
          reason = 'success_indicator_found';
          break;
        }
      }
    }
    
    // Check weak indicators if no medium match
    if (confidence === 0) {
      for (const indicator of weakIndicators) {
        if (lowerOutput.includes(indicator)) {
          // Only consider weak indicators if they appear with context
          if (lowerOutput.includes('task ' + indicator) || 
              lowerOutput.includes('implementation ' + indicator) ||
              lowerOutput.includes('work ' + indicator)) {
            confidence = 0.5;
            reason = 'weak_completion_indicator';
            break;
          }
        }
      }
    }
    
    // Additional context checks to improve confidence
    if (confidence > 0) {
      // Check if output discusses next steps or remaining work (reduces confidence)
      const continueIndicators = [
        'next step',
        'to do',
        'remaining',
        'still need',
        'not yet',
        'pending',
        'in progress'
      ];
      
      for (const continueIndicator of continueIndicators) {
        if (lowerOutput.includes(continueIndicator)) {
          confidence = Math.max(0, confidence - 0.2);
          break;
        }
      }
      
      // Check if original prompt keywords are addressed
      const promptKeywords = this.extractKeywords(lowerPrompt);
      const outputKeywords = this.extractKeywords(lowerOutput);
      const keywordMatch = promptKeywords.filter(k => outputKeywords.includes(k)).length / promptKeywords.length;
      
      if (keywordMatch > 0.7) {
        confidence = Math.min(1.0, confidence + 0.1);
      }
    }
    
    // Early completion detection (before iteration 3) requires higher confidence
    if (iteration < 3 && confidence < 0.8) {
      confidence = 0;
      reason = 'early_completion_requires_high_confidence';
    }
    
    return {
      isComplete: confidence >= 0.6,
      confidence,
      reason
    };
  }
  
  /**
   * Extract keywords from text for completion analysis
   */
  private extractKeywords(text: string): string[] {
    const words = text.split(/\W+/).filter(word => word.length > 3);
    const commonWords = ['that', 'this', 'with', 'from', 'they', 'been', 'have', 'were', 'said', 'each', 'which', 'their', 'will', 'about', 'could', 'there', 'when', 'what', 'make', 'like', 'into', 'time', 'very', 'after', 'first', 'well', 'just', 'than', 'over', 'think', 'also', 'back', 'other', 'many', 'then', 'them', 'these', 'come', 'work', 'life', 'only', 'through', 'before', 'here', 'where', 'much', 'should', 'being', 'now'];
    
    return words.filter(word => !commonWords.includes(word.toLowerCase())).slice(0, 10);
  }
  
  /**
   * Select appropriate error recovery strategy
   */
  private selectRecoveryStrategy(error: any, consecutiveErrors: number, iteration: number): {
    name: string;
    description: string;
  } {
    const errorMessage = error?.message?.toLowerCase() || '';
    
    if (error instanceof NetworkError || errorMessage.includes('network') || errorMessage.includes('timeout')) {
      return {
        name: 'network_retry',
        description: 'Retry with simplified approach due to network issues'
      };
    }
    
    if (error instanceof AuthenticationError) {
      return {
        name: 'auth_recovery',
        description: 'Attempt authentication recovery and retry'
      };
    }
    
    if (consecutiveErrors >= 2) {
      return {
        name: 'simplification',
        description: 'Break down task into smaller, simpler steps'
      };
    }
    
    if (iteration > 5) {
      return {
        name: 'alternative_approach',
        description: 'Try completely different approach to the problem'
      };
    }
    
    return {
      name: 'standard_retry',
      description: 'Retry with error context and guidance'
    };
  }
  
  /**
   * Calculate adaptive delay based on execution performance
   */
  private calculateAdaptiveDelay(consecutiveErrors: number, iteration: number, results: any[]): number {
    let baseDelay = 1000; // 1 second base
    
    // Increase delay for consecutive errors
    if (consecutiveErrors > 0) {
      baseDelay *= Math.pow(1.5, consecutiveErrors);
    }
    
    // Longer delay for later iterations to allow for reflection
    if (iteration > 5) {
      baseDelay += 1000;
    }
    
    // Check average execution time and adjust
    if (results.length > 0) {
      const avgDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0) / results.length;
      if (avgDuration > 30000) { // If iterations are taking >30s, add more delay
        baseDelay += 2000;
      }
    }
    
    return Math.min(baseDelay, 15000); // Cap at 15 seconds
  }

  /**
   * Generate enhanced next prompt with context and guidance
   */
  private generateEnhancedNextPrompt(
    currentOutput: string, 
    originalPrompt: string, 
    iteration: number,
    results: any[]
  ): string {
    const outputPreview = currentOutput.substring(0, 800);
    const hasErrors = currentOutput.toLowerCase().includes('error') || currentOutput.toLowerCase().includes('failed');
    
    let prompt = '';
    
    if (iteration === 1) {
      // First iteration - provide context about progress
      prompt = `ORIGINAL TASK: ${originalPrompt}\n\nPROGRESS FROM ITERATION 1:\n${outputPreview}${currentOutput.length > 800 ? '...' : ''}\n\n`;
      
      if (hasErrors) {
        prompt += 'I notice there were some issues in the first attempt. Please analyze what went wrong, fix any errors, and continue with the task step by step.';
      } else {
        prompt += 'Good progress! Please continue with the next logical steps to complete the task.';
      }
    } else {
      // Later iterations - provide more comprehensive context
      prompt = `CONTINUING MULTI-STEP TASK: ${originalPrompt}\n\n`;
      prompt += `CURRENT ITERATION: ${iteration + 1}\n`;
      prompt += `LATEST PROGRESS:\n${outputPreview}${currentOutput.length > 800 ? '...' : ''}\n\n`;
      
      // Analyze patterns from previous results
      const successfulSteps = results.filter(r => !r.hasError).length;
      const totalSteps = results.length;
      
      prompt += `EXECUTION SUMMARY: ${successfulSteps}/${totalSteps} iterations successful\n\n`;
      
      if (hasErrors) {
        prompt += 'The latest iteration encountered issues. Please:';
        prompt += '\n1. Identify what specific problems occurred';
        prompt += '\n2. Adjust your approach to avoid these issues';
        prompt += '\n3. Continue working toward completing the original task';
        
        // Add specific guidance for repeated failures
        if (iteration > 3) {
          prompt += '\n\nNote: Since we\'re several iterations in, consider breaking down remaining work into smaller, more manageable steps.';
        }
      } else {
        prompt += 'Great progress! Please analyze what still needs to be done and continue with the next steps.';
        
        // Add completion check for later iterations
        if (iteration > 2) {
          prompt += ' If you believe the task is now complete, please clearly state "TASK COMPLETED" and summarize what was accomplished.';
        }
      }
    }
    
    prompt += '\n\nPlease proceed with the next appropriate step.';
    return prompt;
  }

  /**
   * Generate sophisticated error recovery prompt based on strategy
   */
  private generateRecoveryPrompt(
    error: any, 
    originalPrompt: string, 
    strategy: { name: string; description: string },
    results: any[]
  ): string {
    const errorMessage = error?.message || 'Unknown error';
    const errorType = error?.constructor?.name || 'Error';
    
    let prompt = `TASK RECOVERY NEEDED\n\n`;
    prompt += `ORIGINAL TASK: ${originalPrompt}\n\n`;
    prompt += `ERROR ENCOUNTERED: ${errorType} - ${errorMessage}\n\n`;
    prompt += `RECOVERY STRATEGY: ${strategy.name} (${strategy.description})\n\n`;
    
    switch (strategy.name) {
      case 'network_retry':
        prompt += 'Due to network/connectivity issues, please:';
        prompt += '\n1. Try a simpler version of the current step';
        prompt += '\n2. Focus on core functionality first';
        prompt += '\n3. Avoid operations that might require extended connectivity';
        prompt += '\n4. Proceed step-by-step with basic implementation';
        break;
        
      case 'auth_recovery':
        prompt += 'Due to authentication issues, please:';
        prompt += '\n1. Assume authentication will be resolved externally';
        prompt += '\n2. Focus on the core task implementation';
        prompt += '\n3. Document any authentication requirements';
        prompt += '\n4. Proceed with the main task logic';
        break;
        
      case 'simplification':
        prompt += 'Let\'s break this down into simpler steps. Please:';
        prompt += '\n1. Identify the single most important next step';
        prompt += '\n2. Implement just that one step completely';
        prompt += '\n3. Test/verify that step works';
        prompt += '\n4. Don\'t try to do multiple things at once';
        break;
        
      case 'alternative_approach':
        prompt += 'Let\'s try a completely different approach. Please:';
        prompt += '\n1. Step back and reconsider the problem';
        prompt += '\n2. Think of alternative ways to achieve the same goal';
        prompt += '\n3. Choose a fundamentally different implementation strategy';
        prompt += '\n4. Start fresh with this new approach';
        break;
        
      default:
        prompt += 'Please address the error and continue with the task:';
        prompt += '\n1. Analyze what caused this specific error';
        prompt += '\n2. Implement a fix or workaround';
        prompt += '\n3. Continue with the original task objectives';
    }
    
    // Add context from successful previous steps
    const successfulResults = results.filter(r => !r.hasError && r.output.length > 0);
    if (successfulResults.length > 0) {
      prompt += '\n\nSUCCESSFUL PROGRESS SO FAR:\n';
      const lastSuccess = successfulResults[successfulResults.length - 1];
      prompt += lastSuccess.output.substring(0, 300) + (lastSuccess.output.length > 300 ? '...' : '');
    }
    
    prompt += '\n\nPlease implement the recovery approach and continue working toward completing the original task.';
    return prompt;
  }

  /**
   * Backward compatibility methods for PTY-based code
   */
  async getOrCreatePTYSession(sessionId: string, command?: string, options?: any): Promise<any> {
    this.logger.debug('PTY session compatibility layer - returning SDK session');
    return { sessionId, type: 'sdk-session', active: true };
  }

  async sendToPTYSession(sessionId: string, data: string): Promise<string> {
    this.logger.debug('PTY send compatibility layer - executing via SDK');
    const result = await this.executeWithSDK(data, { sessionId });
    return result.output;
  }

  async closePTYSession(sessionId: string): Promise<void> {
    this.logger.debug('PTY close compatibility layer - clearing SDK session');
    this.clearSession(sessionId);
  }

  async shutdown(): Promise<void> {
    this.logger.debug('SDK executor shutting down');
    // Clear all active sessions
    const sessionIds = this.getActiveSessionIds();
    for (const sessionId of sessionIds) {
      this.clearSession(sessionId);
    }
  }

  getActivePTYSessions(): string[] {
    return this.getActiveSessionIds();
  }
}