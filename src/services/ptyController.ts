// DEPRECATED: PTY Controller removed in SDK-only architecture (Story 1.4)
// This file has been deprecated and is no longer used.
// The SDK-only architecture uses direct Claude SDK calls instead of PTY processes.
// 
// Migration: Use SDKClaudeExecutor directly for all Claude Code execution.

export class ClaudeCodePTYController {
  constructor() {
    throw new Error('PTY Controller is deprecated. Use SDKClaudeExecutor instead.');
  }
}

export class ACCPTYManager {
  constructor() {
    throw new Error('PTY Manager is deprecated. Use SDKClaudeExecutor instead.');
  }
}