/**
 * ClaudeCodeController - Interactive Claude Code Controller
 * 
 * Uses Node.js child_process to spawn Claude Code in interactive mode
 * without API key requirements through subscription authentication.
 * 
 * Features:
 * - Interactive mode spawning without -p flag
 * - PTY-like process management with proper lifecycle
 * - Event handlers for data, exit, and error events
 * - Buffer management for partial outputs
 * - ANSI escape sequence handling
 * - Graceful cleanup and termination
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import stripAnsi from 'strip-ansi';

export interface ClaudeCodeControllerOptions {
  workingDirectory?: string;
  timeout?: number;
  bufferSize?: number;
  preserveAnsi?: boolean;
  claudeCommand?: string;
  additionalArgs?: string[];
}

export interface ClaudeCodeResponse {
  output: string;
  error?: string;
  exitCode?: number;
  timestamp: Date;
}

export interface ClaudeCodeEvent {
  type: 'data' | 'error' | 'exit' | 'spawn' | 'close';
  data: any;
  timestamp: Date;
}

export class ClaudeCodeController extends EventEmitter {
  private process: ChildProcess | null = null;
  private isRunning: boolean = false;
  private outputBuffer: string = '';
  private errorBuffer: string = '';
  private options: Required<ClaudeCodeControllerOptions>;
  private responsePromises: Map<string, {
    resolve: (response: ClaudeCodeResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private commandCounter: number = 0;

  constructor(options: ClaudeCodeControllerOptions = {}) {
    super();
    
    this.options = {
      workingDirectory: options.workingDirectory || process.cwd(),
      timeout: options.timeout || 30000, // 30 seconds
      bufferSize: options.bufferSize || 1024 * 1024, // 1MB
      preserveAnsi: options.preserveAnsi ?? false,
      claudeCommand: options.claudeCommand || 'claude',
      additionalArgs: options.additionalArgs || []
    };
  }

  /**
   * Start the Claude Code interactive session
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Claude Code controller is already running');
    }

    return new Promise((resolve, reject) => {
      try {
        // Spawn Claude Code in interactive mode without -p flag
        // This bypasses API key requirements using subscription authentication
        const args = [
          // Interactive mode - no -p flag to avoid API key requirement
          '--interactive',
          ...this.options.additionalArgs
        ];

        this.process = spawn(this.options.claudeCommand, args, {
          cwd: this.options.workingDirectory,
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            // Ensure interactive mode
            FORCE_COLOR: '1',
            NODE_ENV: 'development'
          }
        });

        this.setupEventHandlers();
        this.isRunning = true;

        // Wait for initial startup
        this.once('spawn', () => {
          resolve();
        });

        this.once('error', (error) => {
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Setup event handlers for the spawned process
   */
  private setupEventHandlers(): void {
    if (!this.process) return;

    // Handle process spawn
    this.process.on('spawn', () => {
      const event: ClaudeCodeEvent = {
        type: 'spawn',
        data: { pid: this.process?.pid },
        timestamp: new Date()
      };
      this.emit('spawn', event);
    });

    // Handle stdout data
    this.process.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      this.outputBuffer += output;
      
      // Manage buffer size
      if (this.outputBuffer.length > this.options.bufferSize) {
        this.outputBuffer = this.outputBuffer.slice(-this.options.bufferSize);
      }

      const event: ClaudeCodeEvent = {
        type: 'data',
        data: {
          raw: output,
          clean: this.options.preserveAnsi ? output : stripAnsi(output),
          buffer: this.outputBuffer
        },
        timestamp: new Date()
      };
      
      this.emit('data', event);
      this.processOutput(output);
    });

    // Handle stderr data
    this.process.stderr?.on('data', (data: Buffer) => {
      const error = data.toString();
      this.errorBuffer += error;
      
      // Manage error buffer size
      if (this.errorBuffer.length > this.options.bufferSize) {
        this.errorBuffer = this.errorBuffer.slice(-this.options.bufferSize);
      }

      const event: ClaudeCodeEvent = {
        type: 'error',
        data: {
          raw: error,
          clean: this.options.preserveAnsi ? error : stripAnsi(error),
          buffer: this.errorBuffer
        },
        timestamp: new Date()
      };
      
      this.emit('error', event);
    });

    // Handle process exit
    this.process.on('exit', (code, signal) => {
      this.isRunning = false;
      
      const event: ClaudeCodeEvent = {
        type: 'exit',
        data: { exitCode: code, signal },
        timestamp: new Date()
      };
      
      this.emit('exit', event);
      this.cleanup();
    });

    // Handle process close
    this.process.on('close', (code, signal) => {
      const event: ClaudeCodeEvent = {
        type: 'close',
        data: { exitCode: code, signal },
        timestamp: new Date()
      };
      
      this.emit('close', event);
    });

    // Handle process errors
    this.process.on('error', (error) => {
      const event: ClaudeCodeEvent = {
        type: 'error',
        data: { error: error.message, stack: error.stack },
        timestamp: new Date()
      };
      
      this.emit('error', event);
    });
  }

  /**
   * Send a command to Claude Code and wait for response
   */
  async sendCommand(command: string): Promise<ClaudeCodeResponse> {
    if (!this.isRunning || !this.process || !this.process.stdin) {
      throw new Error('Claude Code controller is not running');
    }

    const commandId = `cmd_${++this.commandCounter}_${Date.now()}`;
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.responsePromises.delete(commandId);
        reject(new Error(`Command timeout after ${this.options.timeout}ms: ${command}`));
      }, this.options.timeout);

      this.responsePromises.set(commandId, {
        resolve,
        reject,
        timeout
      });

      try {
        // Send command to Claude Code
        this.process!.stdin!.write(command + '\n');
      } catch (error) {
        clearTimeout(timeout);
        this.responsePromises.delete(commandId);
        reject(error);
      }
    });
  }

  /**
   * Process output and resolve pending command promises
   */
  private processOutput(output: string): void {
    // Simple response processing - in a real implementation, 
    // you'd need more sophisticated parsing to match commands to responses
    if (this.responsePromises.size > 0) {
      const firstPromise = Array.from(this.responsePromises.values())[0];
      const commandId = Array.from(this.responsePromises.keys())[0];
      
      if (firstPromise && commandId) {
        clearTimeout(firstPromise.timeout);
        this.responsePromises.delete(commandId);
        
        firstPromise.resolve({
          output: this.options.preserveAnsi ? output : stripAnsi(output),
          timestamp: new Date()
        });
      }
    }
  }

  /**
   * Send raw input to the process stdin
   */
  async sendRawInput(input: string): Promise<void> {
    if (!this.isRunning || !this.process || !this.process.stdin) {
      throw new Error('Claude Code controller is not running');
    }

    this.process.stdin.write(input);
  }

  /**
   * Get the current output buffer
   */
  getOutputBuffer(): string {
    return this.options.preserveAnsi ? this.outputBuffer : stripAnsi(this.outputBuffer);
  }

  /**
   * Get the current error buffer
   */
  getErrorBuffer(): string {
    return this.options.preserveAnsi ? this.errorBuffer : stripAnsi(this.errorBuffer);
  }

  /**
   * Clear the output buffer
   */
  clearOutputBuffer(): void {
    this.outputBuffer = '';
  }

  /**
   * Clear the error buffer
   */
  clearErrorBuffer(): void {
    this.errorBuffer = '';
  }

  /**
   * Check if the controller is running
   */
  isActive(): boolean {
    return this.isRunning && this.process !== null && !this.process.killed;
  }

  /**
   * Get process information
   */
  getProcessInfo(): {
    pid?: number;
    killed: boolean;
    exitCode?: number;
    signalCode?: string;
  } | null {
    if (!this.process) return null;
    
    return {
      pid: this.process.pid,
      killed: this.process.killed,
      exitCode: this.process.exitCode ?? undefined,
      signalCode: this.process.signalCode ?? undefined
    };
  }

  /**
   * Graceful shutdown
   */
  async stop(timeout: number = 5000): Promise<void> {
    if (!this.isRunning || !this.process) {
      return;
    }

    return new Promise((resolve, reject) => {
      const killTimeout = setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL');
        }
        reject(new Error('Failed to gracefully stop Claude Code controller'));
      }, timeout);

      this.process!.once('exit', () => {
        clearTimeout(killTimeout);
        resolve();
      });

      // Try graceful shutdown first
      if (this.process!.stdin) {
        this.process!.stdin.end();
      }
      
      // Then send SIGTERM
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGTERM');
        }
      }, 1000);
    });
  }

  /**
   * Force kill the process
   */
  forceKill(): void {
    if (this.process && !this.process.killed) {
      this.process.kill('SIGKILL');
    }
    this.cleanup();
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    // Clear all pending promises
    for (const [commandId, promise] of Array.from(this.responsePromises.entries())) {
      clearTimeout(promise.timeout);
      promise.reject(new Error('Process terminated'));
    }
    this.responsePromises.clear();

    // Reset state
    this.isRunning = false;
    this.process = null;
    this.outputBuffer = '';
    this.errorBuffer = '';
  }

  /**
   * Dispose of the controller and cleanup all resources
   */
  dispose(): void {
    if (this.isRunning) {
      this.forceKill();
    }
    this.cleanup();
    this.removeAllListeners();
  }
}

export default ClaudeCodeController;