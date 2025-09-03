/**
 * Claude Code Query Interface
 * High-level interface similar to Python SDK's query function
 */

import ClaudeCodeClient, { ClaudeCodeOptions, ExecutionOptions } from './client';
import { ClaudeSessionResult, ClaudeMessage } from './index';

export interface QueryOptions extends ClaudeCodeOptions {
  stream?: boolean;
  return_messages?: boolean;
}

export interface QueryResult {
  content: string;
  messages?: ClaudeMessage[];
  session_id: string;
  success: boolean;
  execution_time: number;
  total_turns: number;
}

/**
 * Simple query function - equivalent to Python SDK's claude_code.query()
 */
export async function query(
  prompt: string, 
  options: QueryOptions = {}
): Promise<QueryResult> {
  const client = new ClaudeCodeClient(options);
  
  try {
    const result = await client.execute({
      prompt,
      options,
      stream: options.stream
    });

    return {
      content: result.final_message,
      messages: options.return_messages ? result.messages : undefined,
      session_id: result.session_id,
      success: result.success,
      execution_time: result.execution_time,
      total_turns: result.total_turns
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return {
      content: `Error: ${errorMessage}`,
      session_id: 'error-session',
      success: false,
      execution_time: 0,
      total_turns: 0
    };
  }
}

/**
 * Streaming query function with callback support
 */
export async function queryStream(
  prompt: string,
  onMessage: (message: ClaudeMessage) => void,
  onProgress?: (progress: string) => void,
  options: QueryOptions = {}
): Promise<QueryResult> {
  const client = new ClaudeCodeClient(options);
  
  try {
    const result = await client.execute({
      prompt,
      options: { ...options },
      stream: true,
      on_message: onMessage,
      on_progress: onProgress
    });

    return {
      content: result.final_message,
      messages: options.return_messages ? result.messages : undefined,
      session_id: result.session_id,
      success: result.success,
      execution_time: result.execution_time,
      total_turns: result.total_turns
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return {
      content: `Error: ${errorMessage}`,
      session_id: 'error-session',
      success: false,
      execution_time: 0,
      total_turns: 0
    };
  }
}

/**
 * Multi-turn conversation function
 */
export async function conversation(
  prompts: string[],
  options: QueryOptions = {}
): Promise<QueryResult> {
  const client = new ClaudeCodeClient(options);
  const session = client.createSession(options);
  
  try {
    const result = await client.executeSession(session, prompts);
    
    return {
      content: result.final_message,
      messages: options.return_messages ? result.messages : undefined,
      session_id: result.session_id,
      success: result.success,
      execution_time: result.execution_time,
      total_turns: result.total_turns
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return {
      content: `Error: ${errorMessage}`,
      session_id: 'error-session',
      success: false,
      execution_time: 0,
      total_turns: 0
    };
  }
}

/**
 * Utility function to check if Claude CLI is available
 */
export async function checkClaude(): Promise<{
  available: boolean;
  version?: string;
  path?: string;
  error?: string;
}> {
  const { spawn } = await import('child_process');
  
  return new Promise((resolve) => {
    const claudeProcess = spawn('claude', ['--version'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    claudeProcess.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    claudeProcess.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    claudeProcess.on('close', (exitCode) => {
      if (exitCode === 0 && stdout.trim()) {
        resolve({
          available: true,
          version: stdout.trim(),
          path: 'claude'
        });
      } else {
        resolve({
          available: false,
          error: stderr || 'Claude CLI not found or returned error'
        });
      }
    });

    claudeProcess.on('error', (error) => {
      resolve({
        available: false,
        error: error.message
      });
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      claudeProcess.kill();
      resolve({
        available: false,
        error: 'Claude CLI check timed out'
      });
    }, 5000);
  });
}

export default { query, queryStream, conversation, checkClaude };