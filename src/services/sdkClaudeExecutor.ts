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
export class SDKClaudeExecutor {
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
   * Initialize the Claude Code SDK with comprehensive availability checking
   */
  private async initializeSDK(): Promise<void> {
    this.initializationAttempted = true;
    
    try {
      // Use the new SDK checker for comprehensive availability testing
      this.sdkStatus = await this.sdkChecker.checkSDKAvailability();
      
      if (!this.sdkStatus.isAvailable) {
        this.logger.warning('Claude Code SDK not available', { 
          issues: this.sdkStatus.issues,
          recommendations: this.sdkStatus.recommendations 
        });
        this.isSDKAvailable = false;
        return;
      }

      this.logger.debug('SDK availability confirmed, attempting to load...');
      
      // First try direct dynamic import (works if SDK is in node_modules)
      try {
        const sdkModule = await import('@anthropic-ai/claude-code') as any;
        if (sdkModule && (sdkModule.query || sdkModule.default?.query)) {
          claudeSDK = sdkModule.default || sdkModule;
          this.isSDKAvailable = true;
          this.logger.debug('Claude Code SDK loaded via dynamic import');
          return;
        }
      } catch (importError) {
        this.logger.debug(`Direct import failed: ${String(importError)}`);
      }
      
      // Try to find SDK path and import it using the new checker
      const sdkPath = this.sdkStatus.sdkPath || await this.findSDKPath();
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
          this.logger.debug(`File import failed for ${sdkPath}: ${String(fileImportError)}`);
        }
      }
      
      throw new SDKNotInstalledError('Claude Code SDK not found or not accessible after comprehensive search');
      
    } catch (error) {
      this.logger.debug(`SDK initialization failed: ${String(error)}`);
      
      // Provide user-friendly error message based on the type of issue
      if (error instanceof SDKNotInstalledError) {
        this.logger.error('Claude Code SDK is not properly installed', { 
          error: error.message,
          installationGuidance: this.sdkChecker.getInstallationGuidance().slice(0, 5) // First 5 lines
        });
      } else {
        this.logger.warning('Claude Code SDK initialization failed', { error: String(error) });
      }
      
      this.isSDKAvailable = false;
    }
  }

  /**
   * Check if browser session is active and Claude is authenticated
   * TODO: Re-enable when browser session manager TS errors are fixed
   */
  async checkBrowserAuthentication(): Promise<boolean> {
    this.logger.debug('Browser authentication check temporarily disabled');
    // For now, assume browser authentication is available
    // This will be properly implemented once browser session manager TS issues are resolved
    return true;
  }

  /**
   * Execute Claude using the SDK with comprehensive fallback handling
   */
  async executeWithSDK(
    prompt: string,
    options: SDKClaudeOptions = {}
  ): Promise<SDKResult> {
    // Ensure SDK is loaded with retry mechanism
    if (!this.isSDKAvailable) {
      if (!this.initializationAttempted) {
        this.logger.info('First-time SDK initialization...');
        await this.initializeSDK();
      } else {
        // Re-attempt initialization after failure
        this.logger.info('Re-attempting SDK initialization...');
        await this.initializeSDK();
      }
      
      if (!this.isSDKAvailable) {
        return this.createSDKUnavailableResult(options);
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
    this.failureCount = 0;
    this.circuitBreakerOpen = false;
  }

  /**
   * Record failed execution for circuit breaker logic
   */
  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    // Open circuit breaker after 5 consecutive failures
    if (this.failureCount >= 5) {
      this.circuitBreakerOpen = true;
      this.logger.warning(`SDK circuit breaker opened after ${this.failureCount} failures`);
    }
  }

  /**
   * Determine if execution should be retried
   */
  private shouldRetry(error: any, attempt: number): boolean {
    if (attempt >= this.maxRetries) return false;
    if (this.circuitBreakerOpen) return false;
    
    const errorMessage = error?.message?.toLowerCase() || '';
    
    // Don't retry installation or authentication errors
    if (errorMessage.includes('not installed') || 
        errorMessage.includes('api key') ||
        errorMessage.includes('unauthorized')) {
      return false;
    }
    
    // Retry network, timeout, and temporary errors
    if (errorMessage.includes('timeout') ||
        errorMessage.includes('network') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('temporary')) {
      return true;
    }
    
    return false;
  }

  /**
   * Enhance error with context and user guidance
   */
  private enhanceError(error: any, context: any): Error {
    const originalMessage = error?.message || 'Unknown error';
    
    let enhancedMessage = `SDK Execution Failed: ${originalMessage}`;
    
    if (context.browserUsed) {
      enhancedMessage += `\nBrowser used: ${context.browserUsed}`;
    }
    
    if (context.attempt > 1) {
      enhancedMessage += `\nFailed after ${context.attempt} attempts`;
    }
    
    // Add troubleshooting suggestions
    if (originalMessage.toLowerCase().includes('authentication')) {
      enhancedMessage += '\n\nTroubleshooting:';
      enhancedMessage += '\n1. Ensure you are logged into Claude in your browser';
      enhancedMessage += '\n2. Try refreshing the Claude tab';
      enhancedMessage += '\n3. Clear browser cache if issues persist';
    } else if (originalMessage.toLowerCase().includes('timeout')) {
      enhancedMessage += '\n\nTroubleshooting:';
      enhancedMessage += '\n1. Try a simpler task first';
      enhancedMessage += '\n2. Increase timeout with --timeout option';
      enhancedMessage += '\n3. Check your internet connection';
    }
    
    const enhancedError = new Error(enhancedMessage);
    enhancedError.name = error?.name || 'SDKExecutionError';
    enhancedError.stack = error?.stack;
    
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
  async executeAutopilot(
    initialPrompt: string,
    options: SDKClaudeOptions & { maxIterations?: number; continueOnError?: boolean }
  ): Promise<{
    results: SDKExecutionResult[];
    totalTokens: number;
    totalDuration: number;
    success: boolean;
  }> {
    const maxIterations = options.maxIterations || 10;
    const results: SDKExecutionResult[] = [];
    let totalTokens = 0;
    let totalDuration = 0;
    let currentPrompt = initialPrompt;
    let sessionId = options.sessionId;
    
    this.logger.info(`Starting SDK autopilot mode with max ${maxIterations} iterations`);
    
    for (let i = 0; i < maxIterations; i++) {
      this.logger.debug(`Autopilot iteration ${i + 1}/${maxIterations}`);
      
      try {
        const result = await this.executeWithSDK(currentPrompt, {
          ...options,
          sessionId
        });
        
        results.push(result);
        totalTokens += result.executionTime || 0;
        totalDuration += result.executionTime || 0;
        sessionId = result.sessionId || sessionId;
        
        // Check if task is complete
        const isComplete = this.isTaskComplete(result.output);
        if (isComplete) {
          this.logger.info(`Task completed in ${i + 1} iterations`);
          return {
            results,
            totalTokens,
            totalDuration,
            success: true
          };
        }
        
        // Generate next prompt based on current result
        currentPrompt = this.generateNextPrompt(result.output, initialPrompt);
        
      } catch (error) {
        this.logger.error(`Autopilot iteration ${i + 1} failed:`, error instanceof Error ? error.message : String(error));
        
        if (!options.continueOnError) {
          return {
            results,
            totalTokens,
            totalDuration,
            success: false
          };
        }
        
        // Generate error recovery prompt
        currentPrompt = this.generateErrorRecoveryPrompt(error, initialPrompt);
      }
      
      // Small delay between iterations
      if (i < maxIterations - 1) {
        await this.delay(1000);
      }
    }
    
    this.logger.warning(`Autopilot reached max iterations (${maxIterations}) without completion`);
    
    return {
      results,
      totalTokens,
      totalDuration,
      success: false
    };
  }

  /**
   * Check if task appears to be complete
   */
  private isTaskComplete(output: string): boolean {
    const lowerOutput = output.toLowerCase();
    const completionIndicators = [
      'task completed',
      'successfully implemented',
      'all tests pass',
      'build successful',
      'deployment complete',
      'feature implemented',
      'bug fixed',
      'task finished',
      'implementation complete'
    ];
    
    return completionIndicators.some(indicator => lowerOutput.includes(indicator));
  }

  /**
   * Generate next prompt based on current result
   */
  private generateNextPrompt(currentOutput: string, originalPrompt: string): string {
    // Simple continuation logic - could be enhanced with AI analysis
    if (currentOutput.toLowerCase().includes('error') || currentOutput.toLowerCase().includes('failed')) {
      return `The previous attempt encountered issues. Please fix the errors and continue with: ${originalPrompt}`;
    }
    
    return `Continue with the task. Previous output: ${currentOutput.substring(0, 500)}... Please proceed with the next steps.`;
  }

  /**
   * Generate error recovery prompt
   */
  private generateErrorRecoveryPrompt(error: any, originalPrompt: string): string {
    const errorMessage = error?.message || 'Unknown error';
    return `The previous attempt failed with error: ${errorMessage}. Please try a different approach for: ${originalPrompt}`;
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