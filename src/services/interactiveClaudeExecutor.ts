import { spawn, ChildProcess } from 'child_process';
import { Logger } from '../logger';

export interface InteractiveClaudeOptions {
  model?: 'sonnet' | 'opus';
  workDir?: string;
  sessionId?: string;
  verbose?: boolean;
  timeout?: number;
}

/**
 * Executor for browser-authenticated Claude (no API key needed)
 * Uses interactive mode instead of headless -p mode
 */
export class InteractiveClaudeExecutor {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Execute Claude in interactive mode (browser auth)
   */
  async executeClaudeInteractive(
    prompt: string,
    options: InteractiveClaudeOptions = {}
  ): Promise<{ output: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const args: string[] = [];
      
      // Build arguments for interactive mode (no -p flag!)
      if (options.model) {
        args.push('--model', options.model);
      }
      
      // For first iteration, don't use --resume
      if (options.sessionId) {
        args.push('--resume', options.sessionId);
      }

      const workingDir = options.workDir || process.cwd();
      const timeout = options.timeout || 120000;

      let output = '';
      let claudeProcess: ChildProcess;
      let timeoutHandle: NodeJS.Timeout | undefined;
      let promptSent = false;

      try {
        // Use claude directly (browser authenticated)
        claudeProcess = spawn('claude', args, {
          cwd: workingDir,
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: true
        });

        // Set timeout
        timeoutHandle = setTimeout(() => {
          if (claudeProcess) {
            claudeProcess.kill('SIGTERM');
            reject(new Error('Claude execution timed out'));
          }
        }, timeout);

        // Handle stdout
        claudeProcess.stdout?.on('data', (data) => {
          const chunk = data.toString();
          output += chunk;
          
          // Send prompt when Claude is ready
          if (!promptSent && (chunk.includes('>>>') || chunk.includes('Ready') || chunk.includes('Type'))) {
            promptSent = true;
            claudeProcess.stdin?.write(prompt + '\n');
          }
          
          if (options.verbose) {
            this.logger.debug(`Claude output: ${chunk}`);
          }
        });

        // Handle stderr
        claudeProcess.stderr?.on('data', (data) => {
          const error = data.toString();
          if (options.verbose) {
            this.logger.debug(`Claude stderr: ${error}`);
          }
          // Don't reject on stderr as Claude may output warnings there
          output += error;
        });

        // Handle process exit
        claudeProcess.on('exit', (code) => {
          if (timeoutHandle) clearTimeout(timeoutHandle);
          
          // Clean up the output
          const cleanOutput = this.cleanOutput(output, prompt);
          
          resolve({
            output: cleanOutput,
            exitCode: code || 0
          });
        });

        // Handle process errors
        claudeProcess.on('error', (error) => {
          if (timeoutHandle) clearTimeout(timeoutHandle);
          reject(error);
        });

        // If Claude is immediately ready (e.g., in continuation mode)
        setTimeout(() => {
          if (!promptSent) {
            promptSent = true;
            claudeProcess.stdin?.write(prompt + '\n');
          }
        }, 1000);

      } catch (error) {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        reject(error);
      }
    });
  }

  /**
   * Clean up interactive output to get just the response
   */
  private cleanOutput(output: string, prompt: string): string {
    // Remove ANSI escape codes
    let clean = output.replace(/\x1b\[[0-9;]*m/g, '');
    
    // Remove common Claude prompts and UI elements
    clean = clean.replace(/>>>/g, '')
                 .replace(/Claude>/g, '')
                 .replace(/Type your message/g, '')
                 .replace(/Press Enter to send/g, '');
    
    // Try to extract just the response part
    const lines = clean.split('\n');
    const responseLines: string[] = [];
    let inResponse = false;
    
    for (const line of lines) {
      // Start capturing after we see the prompt echoed
      if (line.includes(prompt.substring(0, 50))) {
        inResponse = true;
        continue;
      }
      
      if (inResponse && line.trim()) {
        responseLines.push(line);
      }
    }
    
    return responseLines.join('\n').trim() || clean.trim();
  }
}