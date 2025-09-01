import * as pty from '@lydell/node-pty';
import stripAnsi from 'strip-ansi';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import { Logger } from '../logger';
import { ClaudeUtils } from '../claudeUtils';

// Global shutdown management
interface GlobalShutdownManager {
  controllers: Set<ClaudeCodePTYController>;
  managers: Set<ACCPTYManager>;
  isShuttingDown: boolean;
  signalHandlersRegistered: boolean;
}

const globalShutdown: GlobalShutdownManager = {
  controllers: new Set(),
  managers: new Set(),
  isShuttingDown: false,
  signalHandlersRegistered: false
};

// Type definitions for enhanced buffer management
interface ClaudeMessage {
  type: string;
  content?: string;
  data?: any;
  error?: string;
  message?: string;
  tool?: string;
  parameters?: any;
  [key: string]: any;
}

interface BufferExtractionResult {
  found: boolean;
  message?: ClaudeMessage;
  line?: string;
  endIndex: number;
}

interface BufferStats {
  bufferSize: number;
  jsonBufferSize: number;
  responseBufferSize: number;
  pendingMessages: number;
  malformedAttempts: number;
}

interface StreamingJsonResult {
  complete: boolean;
  messages: ClaudeMessage[];
}

/**
 * PTY Controller for interactive Claude Code control with enhanced shutdown and cleanup
 * Alternative to headless mode that uses subscription authentication
 */
export class ClaudeCodePTYController extends EventEmitter {
  private ptyProcess?: pty.IPty;
  private buffer: string = '';
  private sessionId?: string;
  private logger: Logger;
  private responseBuffer: string = '';
  private isReady: boolean = false;
  private currentPromptResolve?: (value: string) => void;
  private currentPromptReject?: (reason: any) => void;
  private oauthToken?: string;
  
  // Enhanced buffer management properties
  private jsonBuffer: string = '';
  private pendingMessages: ClaudeMessage[] = [];
  private lastProcessedIndex: number = 0;
  private malformedJsonAttempts: number = 0;
  private maxMalformedAttempts: number = 3;
  private healthCheckInterval?: NodeJS.Timeout;
  
  // Enhanced shutdown and cleanup properties
  private isShuttingDown: boolean = false;
  private isDisposed: boolean = false;
  private activePromises: Set<Promise<any>> = new Set();
  private eventListeners: Map<string, ((...args: any[]) => void)[]> = new Map();
  private cleanup: (() => void)[] = [];
  private shutdownTimeout?: NodeJS.Timeout;
  private processExitHandler?: () => void;
  private errorHandler?: (error: Error) => void;

  constructor(options: any = {}) {
    super();
    this.logger = options.logger || new Logger();
    this.sessionId = options.sessionId;
    this.oauthToken = options.oauthToken;
    
    // Initialize enhanced buffer management
    this.resetBuffers();
    
    // Register this controller globally for shutdown handling
    globalShutdown.controllers.add(this);
    this.registerGlobalSignalHandlers();
    
    // Set up error handling for unhandled errors
    this.setupErrorHandling();
    
    // Track event listeners for cleanup
    this.setupEventListenerTracking();
  }

  /**
   * Start periodic buffer health monitoring
   */
  private startBufferHealthMonitoring(): void {
    // Perform health check every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      this.performBufferHealthCheck();
    }, 30000);
  }

  /**
   * Stop buffer health monitoring
   */
  private stopBufferHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  /**
   * Reset all buffer states
   */
  private resetBuffers(): void {
    this.buffer = '';
    this.jsonBuffer = '';
    this.responseBuffer = '';
    this.pendingMessages = [];
    this.lastProcessedIndex = 0;
    this.malformedJsonAttempts = 0;
  }

  /**
   * Initialize the PTY process with Claude Code in interactive mode
   */
  async initialize(workDir?: string): Promise<void> {
    const cwd = workDir || process.cwd();
    
    // Extract OAuth token if not provided
    if (!this.oauthToken) {
      this.oauthToken = await this.extractOAuthToken();
    }

    // Build command arguments - NO -p flag for interactive mode
    const args = [
      '--continue',  // Resume most recent session
      '--model', 'sonnet',
      '--dangerously-skip-permissions',
      '--output-format', 'stream-json',  // Structured output
      '--max-turns', '10'  // Limit for automation
    ];

    if (this.sessionId) {
      args.push('--resume', this.sessionId);
    }

    // Setup environment without API key to force subscription auth
    const env: Record<string, string> = {
      ...process.env as Record<string, string>
    };
    
    // Remove API key to force OAuth/subscription auth
    delete env.ANTHROPIC_API_KEY;
    
    // Add OAuth token if available
    if (this.oauthToken) {
      env.CLAUDE_CODE_OAUTH_TOKEN = this.oauthToken;
    }
    
    // Disable AWS Bedrock and telemetry
    env.CLAUDE_CODE_USE_BEDROCK = '0';
    env.CLAUDE_CODE_ENABLE_TELEMETRY = '0';

    try {
      const { command } = ClaudeUtils.getClaudeCommand();
      
      this.logger.info(`Initializing PTY with Claude in interactive mode`);
      this.logger.debug(`Command: ${command} ${args.join(' ')}`);

      // Create PTY process with Claude Code in interactive mode
      this.ptyProcess = pty.spawn(command, args, {
        name: 'xterm-color',
        cols: 120,
        rows: 30,
        cwd: cwd,
        env: env as { [key: string]: string }
      });
      
      this.logger.debug(`PTY process spawned with PID: ${this.ptyProcess.pid}`);

      this.setupEventHandlers();
      
      // Wait for initial ready state
      await this.waitForReady();
      
      // Start periodic buffer health checks
      this.startBufferHealthMonitoring();
      
    } catch (error) {
      this.logger.error(`Failed to initialize PTY: ${error}`);
      throw error;
    }
  }

  /**
   * Setup event handlers for PTY process
   */
  private setupEventHandlers(): void {
    if (!this.ptyProcess) return;

    this.ptyProcess.onData((data: string) => {
      this.buffer += data;
      this.processBuffer();
    });

    this.ptyProcess.onExit(({ exitCode, signal }: { exitCode: number, signal?: number }) => {
      this.logger.info(`PTY process exited with code ${exitCode}, signal ${signal}`);
      this.emit('exit', { exitCode, signal });
      
      if (this.currentPromptReject) {
        this.currentPromptReject(new Error(`Process exited unexpectedly: ${exitCode}`));
      }
    });
  }

  /**
   * Process the buffer to extract messages with enhanced buffer management
   */
  private processBuffer(): void {
    // Strip ANSI escape sequences from the entire buffer
    const cleanBuffer = stripAnsi(this.buffer);
    
    // Accumulate clean data to JSON buffer
    this.jsonBuffer += cleanBuffer;
    
    // Process complete JSON messages and text lines
    this.extractCompleteMessages();
    
    // Clear the raw buffer after processing
    this.buffer = '';
  }

  /**
   * Extract complete messages from the JSON buffer
   */
  private extractCompleteMessages(): void {
    let startIndex = 0;
    const bufferLength = this.jsonBuffer.length;
    
    while (startIndex < bufferLength) {
      // Try to find JSON message boundaries
      const jsonResult = this.tryExtractJsonMessage(startIndex);
      
      if (jsonResult.found) {
        // Successfully parsed JSON message
        this.handleJsonMessage(jsonResult.message);
        startIndex = jsonResult.endIndex;
        this.malformedJsonAttempts = 0; // Reset malformed counter
        continue;
      }
      
      // If no JSON found, try to extract text line
      const lineResult = this.tryExtractTextLine(startIndex);
      
      if (lineResult.found && lineResult.line) {
        this.handleTextLine(lineResult.line);
        startIndex = lineResult.endIndex;
        continue;
      }
      
      // No complete message found, break to preserve partial data
      break;
    }
    
    // Keep unprocessed portion in buffer
    if (startIndex > 0) {
      this.jsonBuffer = this.jsonBuffer.substring(startIndex);
      this.lastProcessedIndex = 0;
    }
    
    // Handle buffer overflow protection
    this.handleBufferOverflow();
  }

  /**
   * Try to extract a JSON message starting from the given index
   */
  private tryExtractJsonMessage(startIndex: number): BufferExtractionResult {
    const remaining = this.jsonBuffer.substring(startIndex);
    
    // Look for JSON object start
    const jsonStartMatch = remaining.match(/^\s*\{/);
    if (!jsonStartMatch || jsonStartMatch.index === undefined) {
      return { found: false, endIndex: startIndex };
    }
    
    const jsonStart = startIndex + jsonStartMatch.index;
    let braceCount = 0;
    let inString = false;
    let escapeNext = false;
    let jsonEnd = -1;
    
    // Find the end of the JSON object by counting braces
    for (let i = jsonStart; i < this.jsonBuffer.length; i++) {
      const char = this.jsonBuffer[i];
      
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      
      if (char === '"') {
        inString = !inString;
        continue;
      }
      
      if (inString) {
        continue;
      }
      
      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          jsonEnd = i + 1;
          break;
        }
      }
    }
    
    if (jsonEnd === -1) {
      // Incomplete JSON, wait for more data
      return { found: false, endIndex: startIndex };
    }
    
    const jsonText = this.jsonBuffer.substring(jsonStart, jsonEnd);
    
    try {
      const message = JSON.parse(jsonText);
      return { found: true, message, endIndex: jsonEnd };
    } catch (error) {
      this.malformedJsonAttempts++;
      this.logger.warning(`Malformed JSON detected (attempt ${this.malformedJsonAttempts}/${this.maxMalformedAttempts}): ${jsonText.substring(0, 100)}...`);
      
      if (this.malformedJsonAttempts >= this.maxMalformedAttempts) {
        // Skip this malformed JSON and continue processing
        this.logger.error(`Skipping malformed JSON after ${this.maxMalformedAttempts} attempts`);
        this.malformedJsonAttempts = 0;
        
        // Attempt buffer recovery
        this.recoverFromMalformedBuffer();
        return { found: false, endIndex: jsonEnd };
      }
      
      return { found: false, endIndex: startIndex };
    }
  }

  /**
   * Try to extract a text line starting from the given index
   */
  private tryExtractTextLine(startIndex: number): BufferExtractionResult {
    const remaining = this.jsonBuffer.substring(startIndex);
    const newlineIndex = remaining.indexOf('\n');
    
    if (newlineIndex === -1) {
      // No complete line found
      return { found: false, endIndex: startIndex };
    }
    
    const line = remaining.substring(0, newlineIndex).trim();
    const endIndex = startIndex + newlineIndex + 1;
    
    if (line.length > 0) {
      return { found: true, line, endIndex };
    }
    
    // Empty line, skip it
    return { found: false, endIndex: endIndex };
  }

  /**
   * Handle buffer overflow protection
   */
  private handleBufferOverflow(): void {
    const maxBufferSize = 1024 * 1024; // 1MB max buffer size
    
    if (this.jsonBuffer.length > maxBufferSize) {
      this.logger.warning(`Buffer overflow detected. Buffer size: ${this.jsonBuffer.length}. Truncating...`);
      
      // Keep only the last portion of the buffer
      const keepSize = Math.floor(maxBufferSize / 2);
      this.jsonBuffer = this.jsonBuffer.substring(this.jsonBuffer.length - keepSize);
      this.lastProcessedIndex = 0;
      this.malformedJsonAttempts = 0;
    }
  }

  /**
   * Handle JSON messages from Claude with enhanced validation
   */
  private handleJsonMessage(message: any): void {
    // Validate message before processing
    if (!this.validateJsonMessage(message)) {
      this.logger.warning('Discarding invalid JSON message');
      return;
    }

    this.emit('message', message);
    
    switch (message.type) {
      case 'result':
        this.handleResult(message);
        break;
      case 'error':
        this.handleError(message);
        break;
      case 'ready':
        this.isReady = true;
        this.emit('ready');
        break;
      case 'tool_use':
        this.emit('tool_use', message);
        break;
      case 'stream':
      case 'progress':
      case 'status':
        // Handle streaming and progress messages
        this.emit(message.type, message);
        break;
      default:
        this.logger.debug(`Received message type: ${message.type}`);
        this.emit('unknown_message', message);
    }
  }

  /**
   * Handle text lines from Claude
   */
  private handleTextLine(line: string): void {
    if (!line) return;
    
    // Check for ready state patterns
    if (line.includes('Ready') || line.includes('Claude>') || line.includes('>>>')) {
      this.isReady = true;
      this.emit('ready');
    }
    
    // Accumulate response
    this.responseBuffer += line + '\n';
    
    // Check for completion patterns
    if (this.isResponseComplete(line)) {
      this.completeCurrentPrompt(this.responseBuffer);
      this.responseBuffer = '';
    }
  }

  /**
   * Check if response is complete with enhanced pattern detection
   */
  private isResponseComplete(line: string): boolean {
    const trimmedLine = line.trim();
    
    // Enhanced completion patterns
    const completionPatterns = [
      />>>$/,                                  // Standard prompt ending
      /Claude>\s*$/,                          // Claude prompt
      /Ready for next prompt/i,               // Ready message
      /Finished\.|Complete\.|Done\./,         // Explicit completion words
      /\[DONE\]|\[COMPLETE\]|\[FINISHED\]/i, // Bracketed completion indicators
      /^---\s*$/,                            // Separator line
      /^\*\*\* End of response \*\*\*$/,     // Explicit end marker
    ];
    
    // Check against all regex patterns
    for (const pattern of completionPatterns) {
      if (pattern.test(trimmedLine)) {
        return true;
      }
    }
    
    // Check for empty line after substantial content
    if (trimmedLine === '' && this.responseBuffer.length > 100) {
      return true;
    }
    
    // Check for response timeout completion
    if (this.responseBuffer.length > 10000) { // Large response threshold
      const lastLines = this.responseBuffer.split('\n').slice(-3);
      const hasRepeatedEmptyLines = lastLines.every(l => l.trim() === '');
      if (hasRepeatedEmptyLines) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Handle result messages
   */
  private handleResult(message: any): void {
    if (this.currentPromptResolve) {
      this.currentPromptResolve(message.content || JSON.stringify(message));
      this.currentPromptResolve = undefined;
      this.currentPromptReject = undefined;
    }
  }

  /**
   * Handle error messages
   */
  private handleError(message: any): void {
    const error = new Error(message.error || 'Unknown error');
    
    if (this.currentPromptReject) {
      this.currentPromptReject(error);
      this.currentPromptResolve = undefined;
      this.currentPromptReject = undefined;
    } else {
      this.emit('error', error);
    }
  }

  /**
   * Complete the current prompt with accumulated response
   */
  private completeCurrentPrompt(response: string): void {
    if (this.currentPromptResolve) {
      this.currentPromptResolve(response.trim());
      this.currentPromptResolve = undefined;
      this.currentPromptReject = undefined;
    }
  }

  /**
   * Wait for ready state
   */
  private async waitForReady(timeout: number = 10000): Promise<void> {
    if (this.isReady) return;
    
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        reject(new Error('Timeout waiting for Claude to be ready'));
      }, timeout);
      
      const readyHandler = () => {
        clearTimeout(timeoutHandle);
        resolve();
      };
      
      this.once('ready', readyHandler);
    });
  }

  // This method is replaced by the enhanced version above

  /**
   * Extract OAuth token from system credentials
   */
  private async extractOAuthToken(): Promise<string | undefined> {
    try {
      if (process.platform === 'darwin') {
        // macOS Keychain extraction
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        
        try {
          const { stdout } = await execAsync(
            'security find-generic-password -s "Claude Code-credentials" -w'
          );
          return stdout.trim();
        } catch (e) {
          this.logger.debug('No OAuth token found in macOS Keychain');
        }
      } else {
        // Windows credential file
        if (process.platform === 'win32') {
          const credPath = path.join(os.homedir(), '.claude', '.credentials.json');
          if (fs.existsSync(credPath)) {
            const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));
            return creds.oauth_token;
          }
        }
        
        // Linux credential file and session tokens
        const credPath = path.join(os.homedir(), '.claude', '.credentials.json');
        if (fs.existsSync(credPath)) {
          const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));
          return creds.oauth_token || creds.session_token;
        }
        
        // Try to extract from existing session files
        const sessionsPath = path.join(os.homedir(), '.claude', 'projects');
        if (fs.existsSync(sessionsPath)) {
          const sessionFiles = fs.readdirSync(sessionsPath);
          for (const sessionFile of sessionFiles) {
            try {
              const sessionPath = path.join(sessionsPath, sessionFile, 'conversation.jsonl');
              if (fs.existsSync(sessionPath)) {
                // Found active session, can proceed without explicit token
                return 'session-exists';
              }
            } catch (e) {
              // Continue to next session
            }
          }
        }
      }
    } catch (error) {
      this.logger.debug(`Failed to extract OAuth token: ${error}`);
    }
    
    // Check environment variables as last resort
    return process.env.CLAUDE_CODE_OAUTH_TOKEN || process.env.CLAUDE_SESSION_TOKEN;
  }

  /**
   * Handle buffer recovery from malformed data
   */
  private recoverFromMalformedBuffer(): void {
    this.logger.warning('Attempting buffer recovery from malformed data');
    
    // Try to find the last valid position
    let lastValidPos = 0;
    const cleanBuffer = this.jsonBuffer;
    
    for (let i = cleanBuffer.length - 1; i >= 0; i--) {
      const char = cleanBuffer[i];
      if (char === '}' || char === '\n') {
        lastValidPos = i + 1;
        break;
      }
    }
    
    if (lastValidPos > 0) {
      this.logger.info(`Recovered buffer from position ${lastValidPos}`);
      this.jsonBuffer = cleanBuffer.substring(lastValidPos);
    } else {
      this.logger.warning('Full buffer reset required');
      this.resetBuffers();
    }
  }

  /**
   * Get buffer statistics for debugging
   */
  getBufferStats(): BufferStats {
    return {
      bufferSize: this.buffer.length,
      jsonBufferSize: this.jsonBuffer.length,
      responseBufferSize: this.responseBuffer.length,
      pendingMessages: this.pendingMessages.length,
      malformedAttempts: this.malformedJsonAttempts,
    };
  }

  /**
   * Force flush all buffers and emit pending messages
   */
  flushBuffers(): void {
    this.logger.debug('Force flushing all buffers');
    
    // Process any remaining data in buffers
    if (this.jsonBuffer.trim().length > 0) {
      this.extractCompleteMessages();
    }
    
    // Complete any pending response if it exists
    if (this.responseBuffer.trim().length > 0 && this.currentPromptResolve) {
      this.completeCurrentPrompt(this.responseBuffer);
      this.responseBuffer = '';
    }
    
    // Emit any pending messages
    for (const message of this.pendingMessages) {
      this.emit('message', message);
    }
    this.pendingMessages = [];
  }

  /**
   * Validate JSON structure and content
   */
  private validateJsonMessage(message: any): boolean {
    // Basic structure validation
    if (typeof message !== 'object' || message === null) {
      return false;
    }

    // Required fields validation (adjust based on Claude's actual output format)
    const validTypes = ['result', 'error', 'ready', 'tool_use', 'stream', 'progress', 'status'];
    if (!message.type || !validTypes.includes(message.type)) {
      this.logger.debug(`Invalid message type: ${message.type}`);
      return false;
    }

    // Additional validation based on message type
    switch (message.type) {
      case 'result':
        return message.hasOwnProperty('content') || message.hasOwnProperty('data');
      case 'error':
        return message.hasOwnProperty('error') || message.hasOwnProperty('message');
      case 'tool_use':
        return message.hasOwnProperty('tool') && message.hasOwnProperty('parameters');
      default:
        return true; // Allow other types to pass through
    }
  }

  /**
   * Handle streaming JSON data that may be split across multiple buffers
   */
  private handleStreamingJson(jsonText: string): StreamingJsonResult {
    const messages: ClaudeMessage[] = [];
    let remaining = jsonText;
    
    while (remaining.length > 0) {
      const trimmed = remaining.trim();
      if (!trimmed.startsWith('{')) {
        break;
      }
      
      let depth = 0;
      let inString = false;
      let escaped = false;
      let messageEnd = -1;
      
      for (let i = 0; i < trimmed.length; i++) {
        const char = trimmed[i];
        
        if (escaped) {
          escaped = false;
          continue;
        }
        
        if (char === '\\') {
          escaped = true;
          continue;
        }
        
        if (char === '"') {
          inString = !inString;
          continue;
        }
        
        if (inString) {
          continue;
        }
        
        if (char === '{') {
          depth++;
        } else if (char === '}') {
          depth--;
          if (depth === 0) {
            messageEnd = i + 1;
            break;
          }
        }
      }
      
      if (messageEnd === -1) {
        // Incomplete message, return what we have
        break;
      }
      
      const messageText = trimmed.substring(0, messageEnd);
      try {
        const message = JSON.parse(messageText);
        if (this.validateJsonMessage(message)) {
          messages.push(message);
        } else {
          this.logger.warning(`Invalid message structure: ${messageText.substring(0, 100)}...`);
        }
      } catch (error) {
        this.logger.warning(`Failed to parse streaming JSON: ${error}`);
        break;
      }
      
      remaining = trimmed.substring(messageEnd);
    }
    
    return { complete: remaining.trim().length === 0, messages };
  }

  /**
   * Perform comprehensive buffer health check and cleanup
   */
  performBufferHealthCheck(): void {
    const stats = this.getBufferStats();
    
    this.logger.debug('Buffer health check: ' + JSON.stringify(stats));
    
    // Check for excessive buffer sizes
    const warningThreshold = 512 * 1024; // 512KB warning
    const errorThreshold = 1024 * 1024;  // 1MB error
    
    if (stats.jsonBufferSize > errorThreshold) {
      this.logger.error(`JSON buffer size critical: ${stats.jsonBufferSize} bytes. Performing emergency cleanup.`);
      this.recoverFromMalformedBuffer();
    } else if (stats.jsonBufferSize > warningThreshold) {
      this.logger.warning(`JSON buffer size high: ${stats.jsonBufferSize} bytes. Consider flushing.`);
    }
    
    // Check for excessive malformed attempts
    if (stats.malformedAttempts >= this.maxMalformedAttempts - 1) {
      this.logger.warning(`Malformed JSON attempts high: ${stats.malformedAttempts}/${this.maxMalformedAttempts}`);
    }
    
    // Check for stuck pending messages
    if (stats.pendingMessages > 10) {
      this.logger.warning(`High number of pending messages: ${stats.pendingMessages}. Consider flushing.`);
    }
    
    // Force cleanup if necessary
    if (stats.jsonBufferSize > errorThreshold || stats.pendingMessages > 50) {
      this.logger.info('Performing automatic buffer cleanup');
      this.flushBuffers();
    }
  }

  /**
   * Graceful shutdown with comprehensive cleanup
   */
  async shutdown(timeout: number = 10000): Promise<void> {
    if (this.isShuttingDown || this.isDisposed) {
      return;
    }
    
    this.isShuttingDown = true;
    this.logger.info('Initiating graceful shutdown of PTY controller');
    
    // Set a timeout for the shutdown process
    const shutdownPromise = this.performShutdown();
    const timeoutPromise = new Promise<void>((_, reject) => {
      this.shutdownTimeout = setTimeout(() => {
        reject(new Error(`Shutdown timeout after ${timeout}ms`));
      }, timeout);
    });
    
    try {
      await Promise.race([shutdownPromise, timeoutPromise]);
      this.logger.info('PTY controller shutdown completed successfully');
    } catch (error) {
      this.logger.error(`PTY controller shutdown error: ${error}`);
      await this.forceCleanup();
    } finally {
      this.markAsDisposed();
    }
  }
  
  /**
   * Perform the actual shutdown process
   */
  private async performShutdown(): Promise<void> {
    const shutdownSteps: (() => Promise<void>)[] = [
      () => this.stopAcceptingNewRequests(),
      () => this.waitForActivePromisesToComplete(),
      () => this.stopHealthMonitoring(),
      () => this.flushAndClearBuffers(),
      () => this.closeProcessGracefully(),
      () => this.cleanupEventListeners(),
      () => this.runCustomCleanupHandlers(),
      () => this.unregisterFromGlobal()
    ];
    
    for (const [index, step] of shutdownSteps.entries()) {
      try {
        await step();
        this.logger.debug(`Shutdown step ${index + 1}/${shutdownSteps.length} completed`);
      } catch (error) {
        this.logger.error(`Shutdown step ${index + 1} failed: ${error}`);
        // Continue with remaining steps
      }
    }
  }
  
  /**
   * Stop accepting new requests
   */
  private async stopAcceptingNewRequests(): Promise<void> {
    this.isReady = false;
    
    // Reject any pending prompts
    if (this.currentPromptReject) {
      this.currentPromptReject(new Error('PTY controller shutting down'));
      this.currentPromptResolve = undefined;
      this.currentPromptReject = undefined;
    }
  }
  
  /**
   * Wait for active promises to complete
   */
  private async waitForActivePromisesToComplete(timeout: number = 5000): Promise<void> {
    if (this.activePromises.size === 0) {
      return;
    }
    
    this.logger.debug(`Waiting for ${this.activePromises.size} active promises to complete`);
    
    const activePromiseArray = Array.from(this.activePromises);
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(resolve, timeout);
    });
    
    try {
      await Promise.race([
        Promise.allSettled(activePromiseArray),
        timeoutPromise
      ]);
    } catch (error) {
      this.logger.warning(`Some promises failed during shutdown: ${error}`);
    }
    
    // Clear the set regardless of outcome
    this.activePromises.clear();
  }
  
  /**
   * Stop health monitoring
   */
  private async stopHealthMonitoring(): Promise<void> {
    this.stopBufferHealthMonitoring();
  }
  
  /**
   * Flush and clear all buffers
   */
  private async flushAndClearBuffers(): Promise<void> {
    try {
      this.flushBuffers();
    } finally {
      this.resetBuffers();
    }
  }
  
  /**
   * Close the PTY process gracefully
   */
  private async closeProcessGracefully(): Promise<void> {
    if (!this.ptyProcess) {
      return;
    }
    
    const process = this.ptyProcess;
    this.ptyProcess = undefined;
    
    return new Promise<void>((resolve) => {
      const pid = process.pid;
      let resolved = false;
      
      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };
      
      // Set up timeout for forceful kill
      const forceTimeout = setTimeout(() => {
        if (!resolved) {
          this.logger.warning(`Force killing PTY process ${pid}`);
          try {
            process.kill('SIGKILL');
          } catch (error) {
            this.logger.error(`Error force killing process: ${error}`);
          }
          cleanup();
        }
      }, 3000);
      
      // Listen for process exit
      const exitHandler = () => {
        clearTimeout(forceTimeout);
        cleanup();
      };
      
      try {
        process.onExit(exitHandler);
        
        // Try graceful termination first
        process.kill('SIGTERM');
        
        // If still alive after 1 second, try SIGINT
        setTimeout(() => {
          if (!resolved) {
            try {
              process.kill('SIGINT');
            } catch (error) {
              // Process might already be dead
            }
          }
        }, 1000);
        
      } catch (error) {
        this.logger.error(`Error during graceful process termination: ${error}`);
        cleanup();
      }
    });
  }
  
  /**
   * Clean up all event listeners
   */
  private async cleanupEventListeners(): Promise<void> {
    // Remove all tracked event listeners
    for (const [event, listeners] of this.eventListeners.entries()) {
      for (const listener of listeners) {
        this.removeListener(event, listener);
      }
    }
    this.eventListeners.clear();
    
    // Remove all listeners from this EventEmitter
    this.removeAllListeners();
  }
  
  /**
   * Run custom cleanup handlers
   */
  private async runCustomCleanupHandlers(): Promise<void> {
    for (const cleanupHandler of this.cleanup.reverse()) {
      try {
        cleanupHandler();
      } catch (error) {
        this.logger.error(`Cleanup handler failed: ${error}`);
      }
    }
    this.cleanup = [];
  }
  
  /**
   * Unregister from global shutdown management
   */
  private async unregisterFromGlobal(): Promise<void> {
    globalShutdown.controllers.delete(this);
  }
  
  /**
   * Force cleanup when graceful shutdown fails
   */
  private async forceCleanup(): Promise<void> {
    this.logger.warning('Performing force cleanup');
    
    // Kill process immediately
    if (this.ptyProcess) {
      try {
        this.ptyProcess.kill('SIGKILL');
      } catch (error) {
        // Ignore errors during force cleanup
      }
      this.ptyProcess = undefined;
    }
    
    // Clear all timeouts
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.shutdownTimeout) {
      clearTimeout(this.shutdownTimeout);
    }
    
    // Clear all data structures
    this.resetBuffers();
    this.activePromises.clear();
    this.cleanup = [];
    this.removeAllListeners();
  }
  
  /**
   * Mark the controller as disposed
   */
  private markAsDisposed(): void {
    this.isDisposed = true;
    this.isShuttingDown = false;
    
    if (this.shutdownTimeout) {
      clearTimeout(this.shutdownTimeout);
      this.shutdownTimeout = undefined;
    }
  }
  
  /**
   * Legacy close method - now delegates to graceful shutdown
   */
  close(): void {
    if (!this.isShuttingDown && !this.isDisposed) {
      this.shutdown().catch(error => {
        this.logger.error(`Error during close: ${error}`);
      });
    }
  }

  /**
   * Register global signal handlers for graceful shutdown
   */
  private registerGlobalSignalHandlers(): void {
    if (globalShutdown.signalHandlersRegistered) {
      return;
    }
    
    globalShutdown.signalHandlersRegistered = true;
    
    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      this.logger.info('Received SIGINT, initiating graceful shutdown...');
      this.handleGlobalShutdown('SIGINT');
    });
    
    // Handle SIGTERM (process termination)
    process.on('SIGTERM', () => {
      this.logger.info('Received SIGTERM, initiating graceful shutdown...');
      this.handleGlobalShutdown('SIGTERM');
    });
    
    // Handle process exit
    process.on('exit', (code) => {
      this.logger.info(`Process exiting with code ${code}`);
      // Perform synchronous cleanup only
      this.synchronousCleanup();
    });
    
    // Handle unhandled errors
    process.on('uncaughtException', (error) => {
      this.logger.error(`Uncaught exception: ${error}`);
      this.handleGlobalShutdown('uncaughtException');
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error(`Unhandled promise rejection: ${reason}`);
      // Don't exit immediately, just log
    });
  }
  
  /**
   * Handle global shutdown for all controllers and managers
   */
  private async handleGlobalShutdown(signal: string): Promise<void> {
    if (globalShutdown.isShuttingDown) {
      return;
    }
    
    globalShutdown.isShuttingDown = true;
    console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
    
    const shutdownPromises: Promise<void>[] = [];
    
    // Shutdown all controllers
    for (const controller of globalShutdown.controllers) {
      shutdownPromises.push(
        controller.shutdown(5000).catch(error => {
          console.error(`Controller shutdown error: ${error}`);
        })
      );
    }
    
    // Shutdown all managers
    for (const manager of globalShutdown.managers) {
      shutdownPromises.push(
        manager.shutdown(5000).catch(error => {
          console.error(`Manager shutdown error: ${error}`);
        })
      );
    }
    
    // Wait for all shutdowns to complete or timeout
    const globalTimeout = setTimeout(() => {
      console.log('⚠️ Global shutdown timeout, force exiting...');
      process.exit(1);
    }, 10000);
    
    try {
      await Promise.allSettled(shutdownPromises);
      clearTimeout(globalTimeout);
      console.log('✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      clearTimeout(globalTimeout);
      console.error(`Global shutdown error: ${error}`);
      process.exit(1);
    }
  }
  
  /**
   * Synchronous cleanup for process exit
   */
  private synchronousCleanup(): void {
    // Only do synchronous cleanup here
    try {
      if (this.ptyProcess) {
        // Try to kill the process synchronously
        try {
          process.kill(this.ptyProcess.pid!, 'SIGKILL');
        } catch (error) {
          // Ignore errors during emergency cleanup
        }
      }
      
      // Clear intervals
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }
      if (this.shutdownTimeout) {
        clearTimeout(this.shutdownTimeout);
      }
    } catch (error) {
      // Ignore all errors during emergency cleanup
    }
  }
  
  /**
   * Set up error handling for the controller
   */
  private setupErrorHandling(): void {
    this.errorHandler = (error: Error) => {
      this.logger.error(`PTY Controller error: ${error}`);
      this.emit('controller_error', error);
    };
    
    this.on('error', this.errorHandler);
  }
  
  /**
   * Set up event listener tracking for proper cleanup
   */
  private setupEventListenerTracking(): void {
    const originalOn = this.on.bind(this);
    const originalAddListener = this.addListener.bind(this);
    
    // Override on/addListener to track listeners
    this.on = (event: string | symbol, listener: (...args: any[]) => void) => {
      const eventStr = String(event);
      if (!this.eventListeners.has(eventStr)) {
        this.eventListeners.set(eventStr, []);
      }
      this.eventListeners.get(eventStr)!.push(listener);
      return originalOn(event, listener);
    };
    
    this.addListener = this.on;
  }
  
  /**
   * Add a cleanup handler to run during shutdown
   */
  public addCleanupHandler(handler: () => void): void {
    this.cleanup.push(handler);
  }
  
  /**
   * Track a promise for cleanup during shutdown
   */
  private trackPromise<T>(promise: Promise<T>): Promise<T> {
    this.activePromises.add(promise);
    
    const cleanup = () => {
      this.activePromises.delete(promise);
    };
    
    promise.then(cleanup, cleanup);
    
    return promise;
  }
  
  /**
   * Enhanced sendPrompt with promise tracking
   */
  async sendPrompt(prompt: string): Promise<string> {
    if (this.isShuttingDown || this.isDisposed) {
      throw new Error('PTY controller is shutting down or disposed');
    }
    
    if (!this.ptyProcess) {
      throw new Error('PTY process not initialized');
    }
    
    if (!this.isReady) {
      await this.waitForReady();
    }
    
    const promptPromise = new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Prompt timeout'));
      }, 30000);
      
      this.currentPromptResolve = (value: string) => {
        clearTimeout(timeout);
        resolve(value);
      };
      
      this.currentPromptReject = (reason: any) => {
        clearTimeout(timeout);
        reject(reason);
      };
      
      // Send prompt to PTY
      this.ptyProcess!.write(prompt + '\n');
    });
    
    return this.trackPromise(promptPromise);
  }
  
  /**
   * Check if the controller is in a usable state
   */
  public isUsable(): boolean {
    return !this.isShuttingDown && !this.isDisposed && this.ptyProcess !== undefined;
  }
  
  /**
   * Get current session ID
   */
  getSessionId(): string | undefined {
    return this.sessionId;
  }

  /**
   * Resize the PTY
   */
  resize(cols: number, rows: number): void {
    if (this.ptyProcess) {
      this.ptyProcess.resize(cols, rows);
    }
  }
}

/**
 * Manager class for multiple PTY controllers with enhanced shutdown handling
 */
export class ACCPTYManager {
  private controllers: Map<string, ClaudeCodePTYController> = new Map();
  private logger: Logger;
  private isShuttingDown: boolean = false;
  private isDisposed: boolean = false;
  private sessionCleanupInterval?: NodeJS.Timeout;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
    
    // Register this manager globally
    globalShutdown.managers.add(this);
    
    // Start periodic session cleanup
    this.startSessionCleanup();
  }
  
  /**
   * Start periodic cleanup of inactive sessions
   */
  private startSessionCleanup(): void {
    this.sessionCleanupInterval = setInterval(() => {
      this.cleanupInactiveSessions();
    }, 60000); // Cleanup every minute
  }
  
  /**
   * Clean up inactive or disposed sessions
   */
  private cleanupInactiveSessions(): void {
    const inactiveSessions: string[] = [];
    
    for (const [sessionId, controller] of this.controllers.entries()) {
      if (!controller.isUsable()) {
        inactiveSessions.push(sessionId);
      }
    }
    
    for (const sessionId of inactiveSessions) {
      this.logger.debug(`Cleaning up inactive session: ${sessionId}`);
      this.closeSession(sessionId);
    }
  }

  /**
   * Create a new PTY session
   */
  async createSession(projectPath: string, sessionId?: string): Promise<string> {
    if (this.isShuttingDown || this.isDisposed) {
      throw new Error('Manager is shutting down or disposed');
    }
    
    const controller = new ClaudeCodePTYController({
      logger: this.logger,
      sessionId: sessionId
    });
    
    try {
      await controller.initialize(projectPath);
      
      const id = sessionId || this.generateSessionId();
      this.controllers.set(id, controller);
      
      this.logger.info(`Created PTY session: ${id}`);
      return id;
    } catch (error) {
      // Clean up the controller if initialization failed
      controller.close();
      throw error;
    }
  }

  /**
   * Get a controller by session ID
   */
  getController(sessionId: string): ClaudeCodePTYController | undefined {
    return this.controllers.get(sessionId);
  }

  /**
   * Send prompt to a specific session
   */
  async sendPrompt(sessionId: string, prompt: string): Promise<string> {
    if (this.isShuttingDown || this.isDisposed) {
      throw new Error('Manager is shutting down or disposed');
    }
    
    const controller = this.controllers.get(sessionId);
    if (!controller) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    if (!controller.isUsable()) {
      throw new Error(`Session ${sessionId} is not in a usable state`);
    }
    
    return controller.sendPrompt(prompt);
  }

  /**
   * Close a session gracefully
   */
  async closeSession(sessionId: string, timeout: number = 5000): Promise<void> {
    const controller = this.controllers.get(sessionId);
    if (controller) {
      try {
        await controller.shutdown(timeout);
        this.logger.info(`Closed PTY session: ${sessionId}`);
      } catch (error) {
        this.logger.error(`Error closing session ${sessionId}: ${error}`);
      } finally {
        this.controllers.delete(sessionId);
      }
    }
  }
  
  /**
   * Close a session synchronously (legacy method)
   */
  closeSessions(sessionId: string): void {
    this.closeSession(sessionId).catch(error => {
      this.logger.error(`Async close failed for ${sessionId}: ${error}`);
    });
  }

  /**
   * Close all sessions gracefully
   */
  async closeAllSessions(timeout: number = 10000): Promise<void> {
    if (this.controllers.size === 0) {
      return;
    }
    
    this.logger.info(`Closing ${this.controllers.size} sessions`);
    
    const shutdownPromises: Promise<void>[] = [];
    
    for (const [sessionId, controller] of this.controllers.entries()) {
      shutdownPromises.push(
        controller.shutdown(timeout / 2).catch(error => {
          this.logger.error(`Error closing session ${sessionId}: ${error}`);
        })
      );
    }
    
    try {
      await Promise.allSettled(shutdownPromises);
      this.logger.info('All sessions closed successfully');
    } catch (error) {
      this.logger.error(`Error during session cleanup: ${error}`);
    } finally {
      this.controllers.clear();
    }
  }
  
  /**
   * Graceful shutdown of the manager
   */
  async shutdown(timeout: number = 15000): Promise<void> {
    if (this.isShuttingDown || this.isDisposed) {
      return;
    }
    
    this.isShuttingDown = true;
    this.logger.info('Shutting down PTY Manager');
    
    try {
      // Stop accepting new sessions
      this.stopSessionCleanup();
      
      // Close all existing sessions
      await this.closeAllSessions(timeout - 1000);
      
      // Unregister from global
      globalShutdown.managers.delete(this);
      
      this.isDisposed = true;
      this.logger.info('PTY Manager shutdown completed');
    } catch (error) {
      this.logger.error(`PTY Manager shutdown error: ${error}`);
      throw error;
    }
  }
  
  /**
   * Stop session cleanup interval
   */
  private stopSessionCleanup(): void {
    if (this.sessionCleanupInterval) {
      clearInterval(this.sessionCleanupInterval);
      this.sessionCleanupInterval = undefined;
    }
  }
  
  /**
   * Check if the manager is in a usable state
   */
  public isUsable(): boolean {
    return !this.isShuttingDown && !this.isDisposed;
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.controllers.size;
  }
  
  /**
   * Get all session IDs
   */
  getSessionIds(): string[] {
    return Array.from(this.controllers.keys());
  }
  
  /**
   * Get statistics about sessions
   */
  getSessionStats(): { total: number; usable: number; shutting_down: number; disposed: number } {
    let usable = 0;
    let shuttingDown = 0;
    let disposed = 0;
    
    for (const controller of this.controllers.values()) {
      if (controller.isUsable()) {
        usable++;
      } else if (controller['isShuttingDown']) {
        shuttingDown++;
      } else {
        disposed++;
      }
    }
    
    return {
      total: this.controllers.size,
      usable,
      shutting_down: shuttingDown,
      disposed
    };
  }

  /**
   * Force shutdown all sessions (emergency)
   */
  public emergencyShutdown(): void {
    this.logger.warning('Emergency shutdown initiated');
    
    // Stop cleanup interval immediately
    this.stopSessionCleanup();
    
    // Force close all controllers
    for (const [sessionId, controller] of this.controllers.entries()) {
      try {
        controller.close(); // Use legacy close for immediate shutdown
        this.logger.debug(`Emergency closed session: ${sessionId}`);
      } catch (error) {
        this.logger.error(`Error during emergency close of ${sessionId}: ${error}`);
      }
    }
    
    this.controllers.clear();
    globalShutdown.managers.delete(this);
    
    this.isDisposed = true;
    this.isShuttingDown = false;
    
    this.logger.warning('Emergency shutdown completed');
  }
  
  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Global cleanup function for emergency situations
 */
export function emergencyCleanup(): void {
  console.log('🚨 Emergency cleanup initiated');
  
  // Force cleanup all controllers
  for (const controller of globalShutdown.controllers) {
    try {
      controller['synchronousCleanup']();
    } catch (error) {
      // Ignore errors during emergency cleanup
    }
  }
  
  // Force cleanup all managers
  for (const manager of globalShutdown.managers) {
    try {
      if (manager['sessionCleanupInterval']) {
        clearInterval(manager['sessionCleanupInterval']);
      }
      manager['controllers'].clear();
    } catch (error) {
      // Ignore errors during emergency cleanup
    }
  }
  
  globalShutdown.controllers.clear();
  globalShutdown.managers.clear();
  
  console.log('🚨 Emergency cleanup completed');
}

/**
 * Get global shutdown status
 */
export function getGlobalShutdownStatus(): { isShuttingDown: boolean; controllerCount: number; managerCount: number } {
  return {
    isShuttingDown: globalShutdown.isShuttingDown,
    controllerCount: globalShutdown.controllers.size,
    managerCount: globalShutdown.managers.size
  };
}