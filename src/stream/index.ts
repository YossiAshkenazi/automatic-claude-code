/**
 * Stream Processing Module
 * 
 * Provides advanced buffer management for streaming responses from Claude Code,
 * including ANSI escape sequence handling, JSON message parsing, and UTF-8 support.
 */

export {
  BufferManager,
  createBufferManager,
  type MessageType,
  type ParsedMessage,
  type BufferState,
  type BufferManagerOptions
} from './bufferManager';

export {
  StreamingExecutor,
  executeWithStreaming,
  createStreamingExecutor,
  type StreamingExecutorOptions,
  type StreamingProgress,
  type StreamingResult
} from './streamingExecutor';

// Re-export existing functionality for backward compatibility
export {
  StreamJsonParser,
  OutputParser,
  type ParsedOutput,
  type JsonParseResult,
  type FileOperations,
  type SessionMetadata
} from '../outputParser';