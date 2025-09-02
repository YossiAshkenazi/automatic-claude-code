// DEPRECATED: Claude Executor removed in SDK-only architecture (Story 1.4)
// This file has been deprecated and is no longer used.
// The SDK-only architecture uses SDKClaudeExecutor directly instead of this orchestration layer.
// 
// Migration: Use SDKClaudeExecutor directly for all Claude Code execution.

// Re-export error types for backward compatibility
export {
  AuthenticationError,
  BrowserAuthRequiredError,
  SDKNotInstalledError,
  ClaudeInstallationError,
  NetworkError,
  APIKeyRequiredError,
  ModelQuotaError,
  RetryExhaustedError
} from './sdkClaudeExecutor';

export interface ClaudeExecutionOptions {
  model?: string;
  workDir?: string;
  allowedTools?: string;
  sessionId?: string;
  verbose?: boolean;
  continueOnError?: boolean;
  timeout?: number;
}

export interface ClaudeExecutionResult {
  output: string;
  exitCode: number;
  sessionId?: string;
}

export class ClaudeExecutor {
  constructor() {
    throw new Error('ClaudeExecutor is deprecated. Use SDKClaudeExecutor directly instead.');
  }
}