// import * as pty from 'node-pty'; // Temporarily disabled - will use after dependency fix
// import * as stripAnsi from 'strip-ansi'; // Temporarily disabled - will use after dependency fix
const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, ''); // Temporary replacement
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import { Logger } from '../logger';
import { ClaudeUtils } from '../claudeUtils';

/**
 * PTY Controller for interactive Claude Code control
 * Alternative to headless mode that uses subscription authentication
 */
export class ClaudeCodePTYController extends EventEmitter {
  private ptyProcess?: any; // pty.IPty - temporarily using any until dependency fixed
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

      // Create PTY process - temporarily disabled until node-pty dependency is fixed
      // this.ptyProcess = pty.spawn(command, args, {
      //   name: 'xterm-color',
      //   cols: 120,
      //   rows: 30,
      //   cwd: cwd,
      //   env: env as { [key: string]: string }
      // });
      
      // For now, throw an error to demonstrate error handling
      throw new Error('PTY mode not yet available - node-pty dependency needs to be installed');

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
        this.emit('tool_use', message);
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
    
    return new Promise((resolve, reject) => {
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
  }

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
        // Linux/Windows credential file
        const credPath = path.join(os.homedir(), '.claude', '.credentials.json');
        if (fs.existsSync(credPath)) {
          const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));
          return creds.oauth_token;
        }
      }
    } catch (error) {
      this.logger.debug(`Failed to extract OAuth token: ${error}`);
    }
    
    return undefined;
  }

  /**
   * Close the PTY process
   */
  close(): void {
    if (this.ptyProcess) {
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
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}