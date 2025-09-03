// Type declarations for @anthropic-ai/claude-code
declare module '@anthropic-ai/claude-code' {
  export interface ClaudeSDKResponse {
    output: string;
    exitCode: number;
    sessionId?: string;
    tokensUsed?: number;
    duration?: number;
    hasError?: boolean;
  }

  export interface ClaudeSDKOptions {
    timeout?: number;
    retries?: number;
    sessionId?: string;
    debug?: boolean;
  }

  export function query(
    prompt: string, 
    options?: ClaudeSDKOptions
  ): Promise<ClaudeSDKResponse>;

  // Default export compatibility
  const _default: {
    query: typeof query;
  };
  export default _default;
}