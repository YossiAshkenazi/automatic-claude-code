import { spawn, ChildProcess } from 'child_process';
import * as readline from 'readline';
import { Logger } from '../logger';
import chalk from 'chalk';

export interface BrowserAuthClaudeOptions {
  model?: 'sonnet' | 'opus';
  workDir?: string;
  sessionId?: string;
  verbose?: boolean;
  timeout?: number;
}

/**
 * Executor for browser-authenticated Claude
 * Runs Claude interactively but sends commands programmatically
 * Handles authentication prompts by pausing for user interaction
 */
export class BrowserAuthClaudeExecutor {
  private logger: Logger;
  private claudeProcess: ChildProcess | null = null;
  private isAuthenticated: boolean = false;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Execute Claude with browser authentication
   * This runs Claude interactively but sends the prompt immediately
   */
  async executeBrowserAuthClaude(
    prompt: string,
    options: BrowserAuthClaudeOptions = {}
  ): Promise<{ output: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const args: string[] = [];
      
      // Build arguments - NO -p flag!
      if (options.model) {
        args.push('--model', options.model);
      }
      
      // Only use --resume after first iteration
      if (options.sessionId) {
        args.push('--resume', options.sessionId);
      }

      const workingDir = options.workDir || process.cwd();
      const timeout = options.timeout || 300000; // 5 minutes for auth

      let output = '';
      let errorOutput = '';
      let timeoutHandle: NodeJS.Timeout | undefined;
      let authDetected = false;
      let promptSent = false;
      let responseStarted = false;
      let responseBuffer = '';

      try {
        if (options.verbose) {
          this.logger.debug(`Starting Claude with args: claude ${args.join(' ')}`);
        }

        // Start Claude process
        this.claudeProcess = spawn('claude', args, {
          cwd: workingDir,
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: true,
          env: { ...process.env }
        });

        // Set longer timeout for authentication
        timeoutHandle = setTimeout(() => {
          if (this.claudeProcess) {
            this.claudeProcess.kill('SIGTERM');
            reject(new Error('Claude execution timed out'));
          }
        }, timeout);

        // Create readline interface for stdout
        const rlOut = readline.createInterface({
          input: this.claudeProcess.stdout!,
          crlfDelay: Infinity
        });

        // Create readline interface for stderr
        const rlErr = readline.createInterface({
          input: this.claudeProcess.stderr!,
          crlfDelay: Infinity
        });

        // Handle stdout line by line
        rlOut.on('line', (line) => {
          if (options.verbose) {
            console.log(chalk.gray(`[Claude]: ${line}`));
          }

          // Check for authentication prompts
          if (line.includes('Sign in') || 
              line.includes('authenticate') || 
              line.includes('login') ||
              line.includes('Visit') ||
              line.includes('https://') && line.includes('auth')) {
            
            if (!authDetected) {
              authDetected = true;
              console.log(chalk.yellow('\n🔐 Authentication required!'));
              console.log(chalk.cyan('Claude needs authentication. Please:'));
              console.log(chalk.white('1. Look for the browser window that may have opened'));
              console.log(chalk.white('2. Or visit the URL shown above'));
              console.log(chalk.white('3. Complete the authentication'));
              console.log(chalk.white('4. Return here when done\n'));
              console.log(chalk.gray(line));
            } else {
              console.log(chalk.gray(line));
            }
          }

          // Check if Claude is ready for input
          if (!promptSent && (
            line.includes('Type your message') ||
            line.includes('You:') ||
            line.includes('Human:') ||
            line.includes('>>>') ||
            line.includes('Ready') ||
            (authDetected && line.includes('Authenticated')) ||
            line.trim() === ''
          )) {
            // Send the prompt after a short delay to ensure Claude is ready
            setTimeout(() => {
              if (!promptSent && this.claudeProcess && this.claudeProcess.stdin) {
                promptSent = true;
                if (options.verbose) {
                  this.logger.debug('Sending prompt to Claude...');
                }
                // Send prompt with extra newline to ensure it's submitted
                this.claudeProcess.stdin.write(prompt + '\n');
                // Don't send extra newlines or end stdin yet
                responseStarted = false;
                responseBuffer = '';
              }
            }, 500);
          }

          // Capture response
          if (promptSent) {
            // Skip the echoed prompt
            if (line.includes(prompt.substring(0, 50))) {
              responseStarted = true;
              return;
            }

            // Collect response lines
            if (responseStarted || line.startsWith('Assistant:') || line.startsWith('Claude:')) {
              responseStarted = true;
              
              // Skip UI elements
              if (!line.includes('>>>') && 
                  !line.includes('Type your message') &&
                  !line.includes('Human:') &&
                  !line.includes('You:')) {
                responseBuffer += line + '\n';
                // Reset response timer when we get new content
                waitForResponse();
              }
            }
          }

          output += line + '\n';
        });

        // Handle stderr
        rlErr.on('line', (line) => {
          errorOutput += line + '\n';
          
          // Check for critical errors
          if (line.includes('Invalid API key') || 
              line.includes('Authentication failed')) {
            // These aren't errors in browser auth mode
            if (options.verbose) {
              this.logger.debug(`Auth-related message: ${line}`);
            }
          } else if (line.includes('Error') || line.includes('error')) {
            this.logger.error(`Claude error: ${line}`);
          }
        });

        // Add a response completion timer
        let responseTimer: NodeJS.Timeout | undefined;
        const waitForResponse = () => {
          if (responseTimer) clearTimeout(responseTimer);
          responseTimer = setTimeout(() => {
            // After no new output for 3 seconds, consider response complete
            if (promptSent && responseBuffer.trim()) {
              if (timeoutHandle) clearTimeout(timeoutHandle);
              if (this.claudeProcess) {
                this.claudeProcess.kill('SIGTERM');
              }
              resolve({
                output: responseBuffer.trim(),
                exitCode: 0
              });
            }
          }, 3000);
        };

        // Handle process exit
        this.claudeProcess.on('exit', (code, signal) => {
          if (timeoutHandle) clearTimeout(timeoutHandle);
          if (responseTimer) clearTimeout(responseTimer);
          
          // If we got a response, use it
          const finalOutput = responseBuffer.trim() || this.extractResponse(output) || output;
          
          if (options.verbose) {
            this.logger.debug(`Claude exited with code ${code}`);
          }

          // Exit code 0 or if we got a response, consider it success
          if (code === 0 || responseBuffer.trim()) {
            resolve({
              output: finalOutput,
              exitCode: 0
            });
          } else if (authDetected && !responseBuffer) {
            reject(new Error('Authentication required. Please authenticate and try again.'));
          } else {
            resolve({
              output: finalOutput,
              exitCode: code || 1
            });
          }
        });

        // Handle process errors
        this.claudeProcess.on('error', (error) => {
          if (timeoutHandle) clearTimeout(timeoutHandle);
          
          // Check if it's a command not found error
          if (error.message.includes('ENOENT') || error.message.includes('command not found')) {
            reject(new Error('Claude CLI not found. Please ensure "claude" command is available in PATH'));
          } else {
            reject(error);
          }
        });

        // Send prompt immediately if Claude seems ready (for resumed sessions)
        setTimeout(() => {
          if (!promptSent && !authDetected && this.claudeProcess && this.claudeProcess.stdin) {
            promptSent = true;
            if (options.verbose) {
              this.logger.debug('Sending prompt immediately (resumed session)...');
            }
            // Send prompt
            this.claudeProcess.stdin.write(prompt + '\n');
          }
        }, 2000);

      } catch (error) {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        reject(error);
      }
    });
  }

  /**
   * Extract Claude's response from the full output
   */
  private extractResponse(output: string): string {
    // Remove ANSI codes
    let clean = output.replace(/\x1b\[[0-9;]*m/g, '');
    
    // Split into lines
    const lines = clean.split('\n');
    const responseLines: string[] = [];
    let inResponse = false;
    
    for (const line of lines) {
      // Start capturing after Assistant/Claude marker
      if (line.startsWith('Assistant:') || line.startsWith('Claude:')) {
        inResponse = true;
        continue;
      }
      
      // Stop at next prompt
      if (inResponse && (
        line.includes('Human:') || 
        line.includes('You:') || 
        line.includes('>>>') ||
        line.includes('Type your message')
      )) {
        break;
      }
      
      // Collect response lines
      if (inResponse && line.trim()) {
        responseLines.push(line);
      }
    }
    
    return responseLines.join('\n').trim();
  }

  /**
   * Kill the Claude process if it's running
   */
  cleanup(): void {
    if (this.claudeProcess) {
      this.claudeProcess.kill('SIGTERM');
      this.claudeProcess = null;
    }
  }
}