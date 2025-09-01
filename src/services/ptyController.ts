// Optional import for node-pty (fallback if not available)
let pty: any = null;
try {
  pty = require('node-pty');
} catch (error) {
  // node-pty not available, will use fallback implementation
}
import stripAnsi from 'strip-ansi';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import { Logger } from '../logger';
import { ClaudeUtils } from '../claudeUtils';
import { spawn } from 'child_process';

/**
 * PTY Controller for interactive Claude Code control
 * Alternative to headless mode that uses subscription authentication
 */
export class ClaudeCodePTYController extends EventEmitter {
  private ptyProcess?: any; // IPty type when node-pty is available
  private buffer: string = '';
  private sessionId?: string;
  private logger: Logger;
  private responseBuffer: string = '';
  private isReady: boolean = false;
  private currentPromptResolve?: (value: string) => void;
  private currentPromptReject?: (reason: any) => void;
  private oauthToken?: string;

  constructor(options: any = {}) {
    super();
    this.logger = options.logger || new Logger();
    this.sessionId = options.sessionId;
    this.oauthToken = options.oauthToken;
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
      if (!pty) {
        throw new Error('node-pty module not available. Install with: pnpm add node-pty');
      }
      
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
   * Process the buffer to extract messages
   */
  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i];
      const cleanLine = stripAnsi(line).trim();
      
      if (cleanLine.startsWith('{')) {
        try {
          const message = JSON.parse(cleanLine);
          this.handleJsonMessage(message);
        } catch (e) {
          // Not JSON, process as text
          this.handleTextLine(cleanLine);
        }
      } else {
        this.handleTextLine(cleanLine);
      }
    }
    
    // Keep the last incomplete line in buffer
    this.buffer = lines[lines.length - 1];
  }

  /**
   * Handle JSON messages from Claude
   */
  private handleJsonMessage(message: any): void {
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
        // Execute pre-tool-use hook
        this.executeHook('pre-tool-use-hook', {
          tool: message.tool || message.name,
          parameters: message.parameters || message.input,
          message
        }).catch(() => {}); // Don't break execution on hook failure
        
        this.emit('tool_use', message);
        break;
      case 'tool_result':
        // Execute post-tool-use hook
        this.executeHook('post-tool-use-hook', {
          tool: message.tool || message.name,
          result: message.result || message.output,
          message
        }).catch(() => {}); // Don't break execution on hook failure
        
        this.emit('tool_result', message);
        break;
      default:
        this.logger.debug(`Received message type: ${message.type}`);
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
   * Check if response is complete
   */
  private isResponseComplete(line: string): boolean {
    // Look for common completion patterns
    return line.endsWith('>>>') ||
           line.endsWith('Claude>') ||
           line.includes('Ready for next prompt') ||
           (this.responseBuffer.length > 0 && line === '');
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

  /**
   * Send a prompt to Claude
   */
  async sendPrompt(prompt: string): Promise<string> {
    if (!this.ptyProcess) {
      throw new Error('PTY process not initialized');
    }
    
    if (!this.isReady) {
      await this.waitForReady();
    }
    
    // Execute pre-prompt hooks
    await this.executeHook('user-prompt-submit-hook', { prompt });
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Prompt timeout'));
      }, 30000);
      
      this.currentPromptResolve = async (value: string) => {
        clearTimeout(timeout);
        
        // Execute post-response hooks if needed
        await this.executeHook('notification-hook', {
          type: 'response_received',
          prompt,
          response: value
        });
        
        resolve(value);
      };
      
      this.currentPromptReject = (reason: any) => {
        clearTimeout(timeout);
        reject(reason);
      };
      
      // Send prompt to PTY
      this.ptyProcess!.write(prompt + '\n');
    });
  }

  /**
   * Extract OAuth token from system credentials using centralized extractor
   */
  private async extractOAuthToken(): Promise<string | undefined> {
    try {
      const { OAuthExtractor } = await import('./oauthExtractor');
      const extractor = new OAuthExtractor(this.logger);
      const result = await extractor.extractOAuthToken();
      
      if (result.token) {
        this.logger.debug(`OAuth token extracted from: ${result.source}${result.cached ? ' (cached)' : ''}`);
        return result.token;
      } else {
        this.logger.debug(`No OAuth token found: ${result.error || 'No token available'}`);
        return undefined;
      }
    } catch (error) {
      this.logger.debug(`Failed to extract OAuth token: ${error}`);
      return undefined;
    }
  }

  /**
   * Close the PTY process
   */
  close(): void {
    if (this.ptyProcess) {
      // Execute stop hook before closing
      this.executeHook('stop-hook', {
        sessionId: this.sessionId,
        reason: 'session_closed'
      }).catch(() => {}); // Don't break closure on hook failure
      
      this.ptyProcess.kill();
      this.ptyProcess = undefined;
    }
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

  /**
   * Execute Claude Code hooks to maintain compatibility with existing hook system
   */
  private async executeHook(hookName: string, data: any): Promise<void> {
    try {
      const claudeDir = this.findClaudeDirectory();
      if (!claudeDir) {
        return; // No .claude directory found, skip hooks
      }

      const hookPath = path.join(claudeDir, 'hooks', `${hookName}.js`);
      
      if (!fs.existsSync(hookPath)) {
        return; // Hook doesn't exist, skip silently
      }

      // Execute the hook as a subprocess
      const hookProcess = spawn('node', [hookPath, JSON.stringify(data)], {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 5000 // 5 second timeout for hooks
      });

      let stdout = '';
      let stderr = '';

      hookProcess.stdout?.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      hookProcess.stderr?.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      await new Promise((resolve, reject) => {
        hookProcess.on('close', (code) => {
          if (code !== 0) {
            this.logger.debug(`Hook ${hookName} failed`, { code, stderr });
          } else {
            this.logger.debug(`Hook ${hookName} executed successfully`, { stdout });
          }
          resolve(void 0);
        });

        hookProcess.on('error', (error) => {
          this.logger.debug(`Hook ${hookName} execution error`, { error });
          resolve(void 0); // Don't fail PTY execution due to hook errors
        });
      });

    } catch (error) {
      this.logger.debug(`Failed to execute hook ${hookName}`, { error });
      // Don't throw - hooks should not break PTY execution
    }
  }

  /**
   * Find .claude directory by traversing up the directory tree
   */
  private findClaudeDirectory(): string | null {
    let currentDir = process.cwd();
    
    while (currentDir !== path.dirname(currentDir)) {
      const claudeDir = path.join(currentDir, '.claude');
      if (fs.existsSync(claudeDir) && fs.statSync(claudeDir).isDirectory()) {
        return claudeDir;
      }
      currentDir = path.dirname(currentDir);
    }
    
    return null;
  }
}

/**
 * Manager class for multiple PTY controllers
 */
export class ACCPTYManager {
  private controllers: Map<string, ClaudeCodePTYController> = new Map();
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
  }

  /**
   * Create a new PTY session
   */
  async createSession(projectPath: string, sessionId?: string): Promise<string> {
    const controller = new ClaudeCodePTYController({
      logger: this.logger,
      sessionId: sessionId
    });
    
    await controller.initialize(projectPath);
    
    const id = sessionId || this.generateSessionId();
    this.controllers.set(id, controller);
    
    return id;
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
    const controller = this.controllers.get(sessionId);
    if (!controller) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    return controller.sendPrompt(prompt);
  }

  /**
   * Close a session
   */
  closeSession(sessionId: string): void {
    const controller = this.controllers.get(sessionId);
    if (controller) {
      controller.close();
      this.controllers.delete(sessionId);
    }
  }

  /**
   * Close all sessions
   */
  closeAllSessions(): void {
    for (const controller of this.controllers.values()) {
      controller.close();
    }
    this.controllers.clear();
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    // Generate a proper UUID v4 format that Claude CLI expects
    return crypto.randomUUID();
  }
}