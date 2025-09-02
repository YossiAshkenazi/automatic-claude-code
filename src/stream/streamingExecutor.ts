import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { BufferManager, ParsedMessage, MessageType, createBufferManager } from './bufferManager';
import { Logger } from '../logger';

/**
 * Streaming execution options
 */
export interface StreamingExecutorOptions {
  bufferPreset?: 'standard' | 'debug' | 'minimal' | 'production';
  timeout?: number;
  enableRealTimeProcessing?: boolean;
  onMessage?: (message: ParsedMessage) => void;
  onProgress?: (progress: StreamingProgress) => void;
  onError?: (error: Error) => void;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Progress information for streaming execution
 */
export interface StreamingProgress {
  totalMessages: number;
  messagesByType: Record<MessageType, number>;
  bytesProcessed: number;
  elapsedTime: number;
  isComplete: boolean;
  currentPhase: 'starting' | 'processing' | 'completing' | 'done';
}

/**
 * Result of streaming execution
 */
export interface StreamingResult {
  success: boolean;
  messages: ParsedMessage[];
  summary: {
    totalMessages: number;
    messageTypes: Record<MessageType, number>;
    hasErrors: boolean;
    toolsUsed: string[];
    filesAffected: string[];
    executionTime: number;
    totalCost?: number;
    sessionId?: string;
  };
  rawOutput?: string;
  error?: Error;
}

/**
 * Enhanced streaming executor that uses BufferManager for processing Claude Code output
 */
export class StreamingExecutor extends EventEmitter {
  private bufferManager: BufferManager;
  private logger: Logger;
  private startTime: number = 0;
  private options: Required<StreamingExecutorOptions>;
  private currentProcess: ChildProcess | null = null;

  constructor(options: StreamingExecutorOptions = {}) {
    super();
    
    this.options = {
      bufferPreset: options.bufferPreset ?? 'standard',
      timeout: options.timeout ?? 300000, // 5 minutes
      enableRealTimeProcessing: options.enableRealTimeProcessing ?? true,
      onMessage: options.onMessage ?? (() => {}),
      onProgress: options.onProgress ?? (() => {}),
      onError: options.onError ?? (() => {}),
      logLevel: options.logLevel ?? 'info'
    };

    this.bufferManager = createBufferManager(this.options.bufferPreset);
    this.logger = new Logger('StreamingExecutor', this.options.logLevel);
  }

  /**
   * Execute a Claude Code command with streaming output processing
   */
  async executeCommand(command: string, args: string[] = []): Promise<StreamingResult> {
    this.startTime = Date.now();
    this.logger.info(`Executing command: ${command} ${args.join(' ')}`);

    return new Promise((resolve, reject) => {
      const result: StreamingResult = {
        success: false,
        messages: [],
        summary: {
          totalMessages: 0,
          messageTypes: {
            user: 0, assistant: 0, tool_use: 0, tool_result: 0,
            error: 0, system: 0, completion: 0
          },
          hasErrors: false,
          toolsUsed: [],
          filesAffected: [],
          executionTime: 0
        }
      };

      let rawOutput = '';
      let timeout: NodeJS.Timeout | null = null;

      // Set up timeout
      if (this.options.timeout > 0) {
        timeout = setTimeout(() => {
          this.logger.warn('Command execution timeout');
          this.cleanup();
          result.error = new Error(`Command execution timeout after ${this.options.timeout}ms`);
          resolve(result);
        }, this.options.timeout);
      }

      try {
        // Spawn the process
        this.currentProcess = spawn(command, args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: true
        });

        // Handle stdout (main output)
        this.currentProcess.stdout?.on('data', (chunk: Buffer) => {
          const chunkText = chunk.toString();
          rawOutput += chunkText;

          if (this.options.enableRealTimeProcessing) {
            this.processChunk(chunk, result);
          }
        });

        // Handle stderr (errors and status)
        this.currentProcess.stderr?.on('data', (chunk: Buffer) => {
          const chunkText = chunk.toString();
          rawOutput += chunkText;
          
          this.logger.debug('stderr:', chunkText);
          
          if (this.options.enableRealTimeProcessing) {
            this.processChunk(chunk, result);
          }
        });

        // Handle process completion
        this.currentProcess.on('close', (code) => {
          if (timeout) clearTimeout(timeout);
          
          this.logger.info(`Command completed with code: ${code}`);
          
          // Process any remaining buffer content
          const finalMessages = this.bufferManager.forceCompletion();
          result.messages.push(...finalMessages);

          // If real-time processing was disabled, process all output now
          if (!this.options.enableRealTimeProcessing && rawOutput) {
            const completeResult = this.bufferManager.processCompleteResponse(rawOutput);
            result.messages = completeResult.messages;
            Object.assign(result.summary, completeResult.summary);
          }

          // Finalize result
          result.success = code === 0 && !result.summary.hasErrors;
          result.summary.executionTime = Date.now() - this.startTime;
          result.rawOutput = rawOutput;

          // Extract additional metadata
          this.extractFinalMetadata(result);

          this.emit('complete', result);
          this.logger.info(`Execution completed: ${result.success ? 'success' : 'failed'}`);
          
          resolve(result);
        });

        // Handle process errors
        this.currentProcess.on('error', (error) => {
          if (timeout) clearTimeout(timeout);
          
          this.logger.error('Process error:', error);
          result.error = error;
          result.summary.hasErrors = true;
          
          this.options.onError(error);
          resolve(result);
        });

        this.emit('started', { command, args });

      } catch (error) {
        if (timeout) clearTimeout(timeout);
        
        const execError = error instanceof Error ? error : new Error(String(error));
        this.logger.error('Failed to start command:', execError);
        
        result.error = execError;
        this.options.onError(execError);
        resolve(result);
      }
    });
  }

  /**
   * Process a chunk of data through the buffer manager
   */
  private processChunk(chunk: Buffer, result: StreamingResult): void {
    try {
      const messages = this.bufferManager.addChunk(chunk);
      
      if (messages.length > 0) {
        result.messages.push(...messages);
        
        // Update summary statistics
        messages.forEach(msg => {
          result.summary.messageTypes[msg.type]++;
          result.summary.totalMessages++;
          
          if (msg.type === 'error') {
            result.summary.hasErrors = true;
          }

          // Extract tools and files
          if (msg.metadata?.toolName && !result.summary.toolsUsed.includes(msg.metadata.toolName)) {
            result.summary.toolsUsed.push(msg.metadata.toolName);
          }

          // Process file references in content
          if (msg.content) {
            const contentStr = JSON.stringify(msg.content);
            const fileMatches = contentStr.match(/"([^"]*\.(ts|js|json|md|txt|py|java|cpp|cs))[^"]*"/g);
            if (fileMatches) {
              const files = fileMatches.map(m => m.replace(/"/g, ''));
              files.forEach(file => {
                if (!result.summary.filesAffected.includes(file)) {
                  result.summary.filesAffected.push(file);
                }
              });
            }
          }

          // Notify message callback
          this.options.onMessage(msg);
        });

        // Emit progress
        this.emitProgress(result);
      }
    } catch (error) {
      this.logger.error('Error processing chunk:', error);
    }
  }

  /**
   * Emit progress information
   */
  private emitProgress(result: StreamingResult): void {
    const bufferState = this.bufferManager.getBufferState();
    const progress: StreamingProgress = {
      totalMessages: result.summary.totalMessages,
      messagesByType: { ...result.summary.messageTypes },
      bytesProcessed: bufferState.totalBytesProcessed,
      elapsedTime: Date.now() - this.startTime,
      isComplete: false,
      currentPhase: this.determineCurrentPhase(result)
    };

    this.options.onProgress(progress);
    this.emit('progress', progress);
  }

  /**
   * Determine current execution phase based on messages
   */
  private determineCurrentPhase(result: StreamingResult): StreamingProgress['currentPhase'] {
    const { messageTypes } = result.summary;
    
    if (messageTypes.completion > 0) return 'completing';
    if (messageTypes.tool_use > 0 || messageTypes.tool_result > 0) return 'processing';
    if (result.summary.totalMessages > 0) return 'processing';
    
    return 'starting';
  }

  /**
   * Extract final metadata from completed execution
   */
  private extractFinalMetadata(result: StreamingResult): void {
    // Extract session ID and cost from the last completion message
    const completionMessages = result.messages.filter(m => m.type === 'completion');
    if (completionMessages.length > 0) {
      const lastCompletion = completionMessages[completionMessages.length - 1];
      if (lastCompletion.metadata?.sessionId) {
        result.summary.sessionId = lastCompletion.metadata.sessionId;
      }
      if (lastCompletion.metadata?.cost) {
        result.summary.totalCost = lastCompletion.metadata.cost;
      }
    }

    // Look for session info in any message
    if (!result.summary.sessionId) {
      for (const message of result.messages) {
        if (message.metadata?.sessionId) {
          result.summary.sessionId = message.metadata.sessionId;
          break;
        }
      }
    }

    // Look for cost info in any message
    if (!result.summary.totalCost) {
      for (const message of result.messages) {
        if (message.metadata?.cost) {
          result.summary.totalCost = message.metadata.cost;
          break;
        }
      }
    }
  }

  /**
   * Stop the current execution
   */
  stop(): void {
    if (this.currentProcess) {
      this.logger.info('Stopping command execution');
      this.currentProcess.kill('SIGTERM');
      
      // Force kill after 5 seconds if not terminated
      setTimeout(() => {
        if (this.currentProcess && !this.currentProcess.killed) {
          this.logger.warn('Force killing process');
          this.currentProcess.kill('SIGKILL');
        }
      }, 5000);
    }
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    if (this.currentProcess) {
      this.currentProcess.removeAllListeners();
      if (!this.currentProcess.killed) {
        this.currentProcess.kill('SIGTERM');
      }
      this.currentProcess = null;
    }
    
    this.bufferManager.reset();
  }

  /**
   * Get current buffer state for debugging
   */
  getBufferState() {
    return this.bufferManager.getBufferState();
  }

  /**
   * Reset the buffer manager
   */
  reset(): void {
    this.bufferManager.reset();
  }

  /**
   * Dispose of the executor and clean up resources
   */
  dispose(): void {
    this.cleanup();
    this.removeAllListeners();
  }
}

/**
 * Convenience function to execute a command with streaming processing
 */
export async function executeWithStreaming(
  command: string,
  args: string[] = [],
  options: StreamingExecutorOptions = {}
): Promise<StreamingResult> {
  const executor = new StreamingExecutor(options);
  try {
    return await executor.executeCommand(command, args);
  } finally {
    executor.dispose();
  }
}

/**
 * Create a streaming executor for Claude Code commands
 */
export function createStreamingExecutor(options: StreamingExecutorOptions = {}): StreamingExecutor {
  return new StreamingExecutor(options);
}