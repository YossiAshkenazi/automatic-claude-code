/**
 * Claude Code SDK Client
 * Main interface for interacting with Claude Code CLI
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import os from 'os';
import { ClaudeSession, ClaudeSessionOptions, ClaudeSessionResult, ClaudeMessage } from './index';

export interface ClaudeCodeOptions extends ClaudeSessionOptions {
  claude_cli_path?: string;
  environment?: Record<string, string>;
  shell?: string;
  debug?: boolean;
}

export interface ExecutionOptions {
  prompt: string;
  options?: ClaudeCodeOptions;
  stream?: boolean;
  on_message?: (message: ClaudeMessage) => void;
  on_progress?: (progress: string) => void;
}

export class ClaudeCodeError extends Error {
  constructor(message: string, public exitCode?: number, public stderr?: string) {
    super(message);
    this.name = 'ClaudeCodeError';
  }
}

export class ClaudeCodeClient extends EventEmitter {
  private options: ClaudeCodeOptions;
  private activeProcesses: Map<string, ChildProcess> = new Map();

  constructor(options: ClaudeCodeOptions = {}) {
    super();
    this.options = {
      model: 'sonnet',
      max_turns: 10,
      timeout: 300000,
      working_directory: process.cwd(),
      verbose: false,
      claude_cli_path: this.findClaudeCLI(),
      ...options
    };
  }

  /**
   * Find Claude CLI installation
   */
  private findClaudeCLI(): string {
    const possiblePaths = [
      'claude', // Global installation
      'npx @anthropic-ai/claude-code',
      path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'claude.cmd'),
      path.join(os.homedir(), '.npm-global', 'bin', 'claude'),
      '/usr/local/bin/claude',
      '/usr/bin/claude'
    ];

    // For now, return the first option - we'll implement detection later
    return 'claude';
  }

  /**
   * Execute a single prompt with Claude Code
   */
  async execute(executionOptions: ExecutionOptions): Promise<ClaudeSessionResult> {
    const session = new ClaudeSession(executionOptions.options);
    const { prompt, options = {}, stream = false, on_message, on_progress } = executionOptions;

    session.addUserMessage(prompt);

    try {
      const result = await this.runClaudeProcess(session, {
        prompt,
        stream,
        on_message,
        on_progress,
        ...options
      });

      session.addAssistantMessage(result.output);
      return await session.execute();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      session.addError(errorMessage);
      
      throw new ClaudeCodeError(
        `Claude Code execution failed: ${errorMessage}`,
        error instanceof ClaudeCodeError ? error.exitCode : 1
      );
    }
  }

  /**
   * Create a new interactive session
   */
  createSession(options?: ClaudeSessionOptions): ClaudeSession {
    return new ClaudeSession({
      ...this.options,
      ...options
    });
  }

  /**
   * Execute multiple turns in a session
   */
  async executeSession(session: ClaudeSession, prompts: string[]): Promise<ClaudeSessionResult> {
    for (const prompt of prompts) {
      session.addUserMessage(prompt);
      
      try {
        const result = await this.runClaudeProcess(session, { prompt });
        session.addAssistantMessage(result.output);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        session.addError(errorMessage);
        break; // Stop on first error
      }
    }

    return await session.execute();
  }

  /**
   * Run the actual Claude Code process
   */
  private async runClaudeProcess(
    session: ClaudeSession, 
    options: { prompt: string; stream?: boolean; on_message?: (message: ClaudeMessage) => void; on_progress?: (progress: string) => void; [key: string]: any }
  ): Promise<{ output: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const { prompt, stream, on_message, on_progress } = options;
      const sessionInfo = session.getSessionInfo();

      // Build Claude CLI command
      const args = this.buildClaudeArgs(options);
      const claudePath = this.options.claude_cli_path || 'claude';

      if (this.options.debug) {
        console.log('Running Claude CLI:', claudePath, args);
      }

      // Spawn Claude process with filtered environment to prevent authentication conflicts
      const filteredEnv = { ...process.env };
      
      // Remove conflicting environment variables that cause nested session issues
      delete filteredEnv.CLAUDECODE;
      delete filteredEnv.CLAUDE_CODE_ENTRYPOINT;
      
      // Remove potentially invalid API keys that cause authentication failures
      if (filteredEnv.ANTHROPIC_API_KEY && (
        filteredEnv.ANTHROPIC_API_KEY === 'invalid-key-placeholder' ||
        filteredEnv.ANTHROPIC_API_KEY.length < 10
      )) {
        delete filteredEnv.ANTHROPIC_API_KEY;
      }
      
      const claudeProcess = spawn(claudePath, args, {
        cwd: this.options.working_directory,
        env: { 
          ...filteredEnv, 
          ...this.options.environment 
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.activeProcesses.set(sessionInfo.session_id, claudeProcess);

      let stdout = '';
      let stderr = '';

      // Handle stdout
      claudeProcess.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stdout += chunk;

        if (stream && on_progress) {
          on_progress(chunk);
        }

        // Try to parse as messages if streaming
        if (stream && on_message) {
          this.parseStreamingOutput(chunk, on_message);
        }
      });

      // Handle stderr
      claudeProcess.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stderr += chunk;
        
        if (this.options.verbose) {
          console.error('Claude stderr:', chunk);
        }
      });

      // Send prompt to Claude
      claudeProcess.stdin?.write(prompt);
      claudeProcess.stdin?.end();

      // Handle process completion
      claudeProcess.on('close', (exitCode) => {
        this.activeProcesses.delete(sessionInfo.session_id);

        if (exitCode === 0) {
          resolve({
            output: stdout.trim(),
            exitCode: 0
          });
        } else {
          reject(new ClaudeCodeError(
            `Claude process exited with code ${exitCode}`,
            exitCode ?? 1,
            stderr
          ));
        }
      });

      // Handle process errors
      claudeProcess.on('error', (error) => {
        this.activeProcesses.delete(sessionInfo.session_id);
        reject(new ClaudeCodeError(`Failed to start Claude process: ${error.message}`));
      });

      // Handle timeout
      if (this.options.timeout) {
        setTimeout(() => {
          if (this.activeProcesses.has(sessionInfo.session_id)) {
            claudeProcess.kill('SIGTERM');
            reject(new ClaudeCodeError(`Claude execution timed out after ${this.options.timeout}ms`));
          }
        }, this.options.timeout);
      }
    });
  }

  /**
   * Parse streaming output into messages
   */
  private parseStreamingOutput(chunk: string, onMessage: (message: ClaudeMessage) => void): void {
    // Simple parsing - in a real implementation, you'd parse actual Claude output format
    if (chunk.includes('Tool:') || chunk.includes('using tool')) {
      onMessage({
        type: 'tool_use',
        content: chunk.trim(),
        timestamp: new Date()
      });
    } else if (chunk.includes('Error:') || chunk.includes('error')) {
      onMessage({
        type: 'error',
        content: chunk.trim(),
        error: chunk.trim(),
        timestamp: new Date()
      });
    } else if (chunk.trim()) {
      onMessage({
        type: 'assistant',
        content: chunk.trim(),
        timestamp: new Date()
      });
    }
  }

  /**
   * Build Claude CLI arguments
   */
  private buildClaudeArgs(options: any): string[] {
    const args: string[] = [];

    if (options.model && options.model !== 'sonnet') {
      args.push('--model', options.model);
    }

    if (options.max_turns && options.max_turns !== 10) {
      args.push('--max-turns', options.max_turns.toString());
    }

    if (options.allow_tools && options.allow_tools.length > 0) {
      args.push('--allow-tools', options.allow_tools.join(','));
    }

    if (options.verbose) {
      args.push('--verbose');
    }

    return args;
  }

  /**
   * Kill all active processes
   */
  killAllProcesses(): void {
    for (const [sessionId, process] of this.activeProcesses) {
      try {
        process.kill('SIGTERM');
        this.activeProcesses.delete(sessionId);
      } catch (error) {
        console.error(`Failed to kill process for session ${sessionId}:`, error);
      }
    }
  }

  /**
   * Get status of active processes
   */
  getActiveProcesses(): string[] {
    return Array.from(this.activeProcesses.keys());
  }
}

export default ClaudeCodeClient;