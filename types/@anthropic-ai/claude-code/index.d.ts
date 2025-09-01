declare module '@anthropic-ai/claude-code' {
  export interface ClaudeCodeOptions {
    model?: string;
    apiKey?: string;
    baseURL?: string;
    timeout?: number;
    maxRetries?: number;
  }

  export interface ClaudeCodeResponse {
    success: boolean;
    content?: string;
    error?: string;
    metadata?: Record<string, unknown>;
  }

  export interface ClaudeCodeMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    metadata?: Record<string, unknown>;
  }

  export interface ClaudeCodeSession {
    id: string;
    messages: ClaudeCodeMessage[];
    created: Date;
    updated: Date;
  }

  export class ClaudeCode {
    constructor(options?: ClaudeCodeOptions);
    
    execute(prompt: string, options?: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
    }): Promise<ClaudeCodeResponse>;
    
    createSession(): ClaudeCodeSession;
    getSession(id: string): ClaudeCodeSession | null;
    deleteSession(id: string): boolean;
  }

  export default ClaudeCode;
}