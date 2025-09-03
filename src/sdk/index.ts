/**
 * Claude Code TypeScript SDK
 * A TypeScript implementation inspired by the Python SDK
 */

export interface ClaudeMessage {
  type: 'user' | 'assistant' | 'tool_use' | 'tool_result' | 'error';
  content: string;
  tool?: string;
  tool_input?: Record<string, any>;
  tool_result?: any;
  error?: string;
  timestamp: Date;
}

export interface ClaudeSessionOptions {
  model?: 'sonnet' | 'opus' | 'haiku';
  max_turns?: number;
  timeout?: number;
  working_directory?: string;
  allow_tools?: string[];
  verbose?: boolean;
}

export interface ClaudeSessionResult {
  messages: ClaudeMessage[];
  final_message: string;
  session_id: string;
  total_turns: number;
  success: boolean;
  execution_time: number;
}

export class ClaudeSession {
  private sessionId: string;
  private messages: ClaudeMessage[] = [];
  private options: ClaudeSessionOptions;
  private startTime: number;

  constructor(options: ClaudeSessionOptions = {}) {
    this.sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.options = {
      model: 'sonnet',
      max_turns: 10,
      timeout: 300000, // 5 minutes
      working_directory: process.cwd(),
      allow_tools: [],
      verbose: false,
      ...options
    };
    this.startTime = Date.now();
  }

  /**
   * Add a user message to the session
   */
  addUserMessage(content: string): void {
    this.messages.push({
      type: 'user',
      content,
      timestamp: new Date()
    });
  }

  /**
   * Add an assistant message to the session
   */
  addAssistantMessage(content: string): void {
    this.messages.push({
      type: 'assistant',
      content,
      timestamp: new Date()
    });
  }

  /**
   * Add a tool use message
   */
  addToolUse(tool: string, tool_input: Record<string, any>): void {
    this.messages.push({
      type: 'tool_use',
      content: `Using tool: ${tool}`,
      tool,
      tool_input,
      timestamp: new Date()
    });
  }

  /**
   * Add a tool result message
   */
  addToolResult(tool_result: any): void {
    this.messages.push({
      type: 'tool_result',
      content: 'Tool execution completed',
      tool_result,
      timestamp: new Date()
    });
  }

  /**
   * Add an error message
   */
  addError(error: string): void {
    this.messages.push({
      type: 'error',
      content: error,
      error,
      timestamp: new Date()
    });
  }

  /**
   * Get all messages in the session
   */
  getMessages(): ClaudeMessage[] {
    return [...this.messages];
  }

  /**
   * Get the last message
   */
  getLastMessage(): ClaudeMessage | null {
    return this.messages.length > 0 ? this.messages[this.messages.length - 1] : null;
  }

  /**
   * Get session metadata
   */
  getSessionInfo() {
    return {
      session_id: this.sessionId,
      message_count: this.messages.length,
      start_time: new Date(this.startTime),
      duration: Date.now() - this.startTime,
      options: this.options
    };
  }

  /**
   * Execute the session and return results
   */
  async execute(): Promise<ClaudeSessionResult> {
    const executionTime = Date.now() - this.startTime;
    const finalMessage = this.getLastMessage();

    return {
      messages: this.getMessages(),
      final_message: finalMessage?.content || '',
      session_id: this.sessionId,
      total_turns: this.messages.filter(m => m.type === 'assistant').length,
      success: !this.messages.some(m => m.type === 'error'),
      execution_time: executionTime
    };
  }

  /**
   * Clear all messages from the session
   */
  clear(): void {
    this.messages = [];
    this.startTime = Date.now();
  }
}

export default ClaudeSession;