/**
 * Claude Session Management System
 * 
 * This module provides comprehensive session management that:
 * 1. Manipulates Claude's native session files in ~/.claude/projects/
 * 2. Encodes directory paths using Claude's exact encoding method
 * 3. Reads and writes JSONL session files maintaining format compatibility
 * 4. Provides methods for creating, loading, appending, listing, and cleaning sessions
 * 5. Enables true persistence across Claude invocations
 */

// Core session management
export { 
  ClaudeSessionManager,
  ClaudePathEncoder,
  ClaudeMessage,
  SessionMetadata,
  CreateSessionOptions
} from './sessionManager';

// Integration with existing systems
export { SessionIntegration } from './sessionIntegration';

// Example usage
export { demonstrateSessionManagement } from './example';

// Types for TypeScript users
export type {
  ClaudeMessage as ClaudeMessageType,
  SessionMetadata as SessionMetadataType,
  CreateSessionOptions as CreateSessionOptionsType
} from './sessionManager';