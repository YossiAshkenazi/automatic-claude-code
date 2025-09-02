import stripAnsi from 'strip-ansi';

/**
 * Represents different types of messages that can be processed
 */
export type MessageType = 'user' | 'assistant' | 'tool_use' | 'tool_result' | 'error' | 'system' | 'completion';

/**
 * Parsed message structure
 */
export interface ParsedMessage {
  type: MessageType;
  content: any;
  timestamp: number;
  isComplete: boolean;
  metadata?: {
    sessionId?: string;
    toolName?: string;
    cost?: number;
    tokens?: number;
  };
}

/**
 * Buffer state for debugging and monitoring
 */
export interface BufferState {
  buffer: string;
  incompleteMessages: number;
  completedMessages: number;
  totalBytesProcessed: number;
  lastProcessedAt: number;
  hasIncompleteUtf8: boolean;
}

/**
 * Configuration options for BufferManager
 */
export interface BufferManagerOptions {
  maxBufferSize?: number;
  preserveAnsi?: boolean;
  enableUtf8Handling?: boolean;
  messageTimeout?: number;
  debugMode?: boolean;
}

/**
 * BufferManager - Advanced buffer management for streaming Claude Code responses
 * 
 * Features:
 * - ANSI escape sequence stripping with selective preservation
 * - JSON message boundary detection and parsing
 * - Partial message reassembly with proper UTF-8 handling
 * - Multi-part response state management
 * - Edge case handling for incomplete sequences
 */
export class BufferManager {
  private buffer: string = '';
  private utf8Buffer: Buffer = Buffer.alloc(0);
  private pendingMessages: ParsedMessage[] = [];
  private completedMessages: ParsedMessage[] = [];
  private messageQueue: { chunk: string; timestamp: number }[] = [];
  
  private totalBytesProcessed: number = 0;
  private lastProcessedAt: number = 0;
  private options: Required<BufferManagerOptions>;

  // ANSI escape sequence patterns
  private readonly ansiPatterns = {
    // Complete ANSI escape sequences
    complete: /\x1b\[[0-9;]*[a-zA-Z]/g,
    // Important terminal control codes to preserve
    preserve: /\x1b\[(2J|H|[0-9]+;[0-9]+H)/g,
    // Cursor movement and positioning
    cursor: /\x1b\[([ABCD]|[0-9]+[ABCD]|[0-9]+;[0-9]+[Hf])/g,
    // Color codes
    color: /\x1b\[([0-9]+;)*[0-9]*m/g,
    // Clear screen sequences
    clear: /\x1b\[([0-2]J|[0-2]K)/g
  };

  // JSON message boundary patterns
  private readonly jsonPatterns = {
    // Complete JSON object (basic)
    simple: /^\s*\{.*\}\s*$/,
    // JSON with potential nesting
    nested: /\{(?:[^{}]*|\{[^{}]*\})*\}/g,
    // Streaming JSON start
    streamStart: /^\s*\{\s*"[^"]+"\s*:/,
    // JSON end patterns
    streamEnd: /\}\s*$/
  };

  // Message type detection patterns
  private readonly messageTypePatterns = {
    user: /("role"\s*:\s*"user")|("type"\s*:\s*"user")/,
    assistant: /("role"\s*:\s*"assistant")|("type"\s*:\s*"assistant")/,
    tool_use: /("type"\s*:\s*"tool_use")|("tool_calls")/,
    tool_result: /("type"\s*:\s*"tool_result")|("tool_result")/,
    error: /("error"|"status"\s*:\s*"error")/,
    system: /("type"\s*:\s*"system")|("system")/,
    completion: /("stop_reason"|"usage"|"total_cost")/
  };

  constructor(options: BufferManagerOptions = {}) {
    this.options = {
      maxBufferSize: options.maxBufferSize ?? 1024 * 1024, // 1MB default
      preserveAnsi: options.preserveAnsi ?? false,
      enableUtf8Handling: options.enableUtf8Handling ?? true,
      messageTimeout: options.messageTimeout ?? 30000, // 30 seconds
      debugMode: options.debugMode ?? false
    };
  }

  /**
   * Add a chunk of streaming data to the buffer
   */
  addChunk(chunk: string | Buffer): ParsedMessage[] {
    // Handle null/undefined input
    if (chunk == null) {
      return [];
    }

    let textChunk: string;

    // Handle Buffer input with UTF-8 handling
    if (Buffer.isBuffer(chunk)) {
      if (this.options.enableUtf8Handling) {
        textChunk = this.handleUtf8Buffer(chunk);
      } else {
        textChunk = chunk.toString('utf8');
      }
    } else {
      textChunk = String(chunk);
    }

    // Handle empty chunks
    if (!textChunk) {
      return [];
    }

    // Update statistics
    this.totalBytesProcessed += Buffer.byteLength(textChunk, 'utf8');
    this.lastProcessedAt = Date.now();

    // Add to message queue for timeout handling
    this.messageQueue.push({ chunk: textChunk, timestamp: Date.now() });

    // Process ANSI sequences
    const cleanChunk = this.processAnsiSequences(textChunk);

    // Add to buffer
    this.buffer += cleanChunk;

    // Check buffer size limits
    if (this.buffer.length > this.options.maxBufferSize) {
      this.handleBufferOverflow();
    }

    // Process the buffer to extract complete messages
    return this.processBuffer();
  }

  /**
   * Handle UTF-8 buffer sequences that may be split across chunks
   */
  private handleUtf8Buffer(chunk: Buffer): string {
    // Combine with any pending UTF-8 bytes
    const combined = Buffer.concat([this.utf8Buffer, chunk]);
    let result = '';
    let validEnd = 0;

    // Find the end of the last valid UTF-8 character
    for (let i = combined.length - 1; i >= 0; i--) {
      try {
        result = combined.subarray(0, i + 1).toString('utf8');
        // If no replacement characters, we found valid end
        if (!result.includes('\uFFFD')) {
          validEnd = i + 1;
          break;
        }
      } catch {
        continue;
      }
    }

    if (validEnd > 0) {
      result = combined.subarray(0, validEnd).toString('utf8');
      this.utf8Buffer = combined.subarray(validEnd);
    } else {
      // Keep everything in buffer if no valid UTF-8 found
      this.utf8Buffer = combined;
      result = '';
    }

    return result;
  }

  /**
   * Process ANSI escape sequences
   */
  private processAnsiSequences(text: string): string {
    if (this.options.preserveAnsi) {
      // Only strip color codes and formatting, preserve cursor movements
      return text
        .replace(this.ansiPatterns.color, '')
        .replace(/\x1b\[[0-9]*m/g, '') // Additional color cleanup
        .replace(/\x1b\[0m/g, ''); // Reset codes
    } else {
      // Strip all ANSI sequences
      return stripAnsi(text);
    }
  }

  /**
   * Handle buffer overflow by keeping recent data
   */
  private handleBufferOverflow(): void {
    const keepSize = Math.floor(this.options.maxBufferSize * 0.7);
    this.buffer = this.buffer.substring(this.buffer.length - keepSize);
    
    if (this.options.debugMode) {
      console.warn(`BufferManager: Buffer overflow, truncated to ${keepSize} characters`);
    }
  }

  /**
   * Process the buffer to extract complete messages
   */
  private processBuffer(): ParsedMessage[] {
    const newMessages: ParsedMessage[] = [];

    // First, try to parse the entire buffer as a single JSON
    const singleMessage = this.tryParseCompleteMessage(this.buffer);
    if (singleMessage) {
      newMessages.push(singleMessage);
      this.buffer = '';
      this.completedMessages.push(...newMessages);
      return newMessages;
    }

    // Extract complete JSON objects from the buffer
    const jsonMessages = this.extractJsonMessages();
    newMessages.push(...jsonMessages);

    // Clean up old pending messages based on timeout
    this.cleanupTimedOutMessages();

    // Store new messages
    this.completedMessages.push(...newMessages);

    return newMessages;
  }

  /**
   * Try to parse the complete buffer as a single message
   */
  private tryParseCompleteMessage(text: string): ParsedMessage | null {
    const trimmed = text.trim();
    if (!trimmed) return null;

    try {
      const jsonData = JSON.parse(trimmed);
      const messageType = this.detectMessageType(trimmed);
      
      return {
        type: messageType,
        content: jsonData,
        timestamp: Date.now(),
        isComplete: true,
        metadata: this.extractMetadata(jsonData)
      };
    } catch {
      // Not valid JSON, might be partial or text-based message
      return this.tryParseTextMessage(trimmed);
    }
  }

  /**
   * Try to parse as text-based message
   */
  private tryParseTextMessage(text: string): ParsedMessage | null {
    // Check for completion indicators
    const completionPatterns = [
      /(?:task|implementation|analysis).*(?:complete|finished|done)/i,
      /successfully.*(?:implemented|created|completed|executed)/i,
      /(?:ready|available).*(?:for|to).*(?:review|test|use)/i,
      /error.*(?:occurred|found|detected)/i,
      /session.*(?:ended|terminated|completed)/i
    ];

    const isComplete = completionPatterns.some(pattern => pattern.test(text));

    if (isComplete || text.length > 100) { // Consider substantial text as complete
      return {
        type: text.toLowerCase().includes('error') ? 'error' : 'assistant',
        content: { text, result: text },
        timestamp: Date.now(),
        isComplete: true,
        metadata: {}
      };
    }

    return null;
  }

  /**
   * Extract JSON messages from the buffer
   */
  private extractJsonMessages(): ParsedMessage[] {
    const messages: ParsedMessage[] = [];
    let remainingBuffer = this.buffer;

    // Find JSON objects using regex
    const matches = Array.from(remainingBuffer.matchAll(this.jsonPatterns.nested));
    
    for (const match of matches) {
      if (match[0]) {
        const messageResult = this.tryParseCompleteMessage(match[0]);
        if (messageResult) {
          messages.push(messageResult);
          // Remove processed JSON from buffer
          remainingBuffer = remainingBuffer.replace(match[0], '');
        }
      }
    }

    // Try line-by-line parsing for JSONL format
    const lines = remainingBuffer.split('\n');
    let processedLines = 0;

    for (let i = 0; i < lines.length - 1; i++) { // Keep last line as it might be incomplete
      const line = lines[i].trim();
      if (line) {
        const lineMessage = this.tryParseCompleteMessage(line);
        if (lineMessage) {
          messages.push(lineMessage);
          processedLines = i + 1;
        }
      }
    }

    // Update buffer with unprocessed content
    if (processedLines > 0) {
      this.buffer = lines.slice(processedLines).join('\n');
    } else if (matches.length > 0) {
      this.buffer = remainingBuffer;
    }

    return messages;
  }

  /**
   * Detect the type of message based on content
   */
  private detectMessageType(content: string): MessageType {
    for (const [type, pattern] of Object.entries(this.messageTypePatterns)) {
      if (pattern.test(content)) {
        return type as MessageType;
      }
    }

    // Default detection based on content
    if (content.includes('"error"') || content.includes('ERROR')) return 'error';
    if (content.includes('"tool_calls"') || content.includes('tool_use')) return 'tool_use';
    if (content.includes('"result"') || content.includes('tool_result')) return 'tool_result';
    if (content.includes('"role": "user"')) return 'user';
    if (content.includes('"stop_reason"') || content.includes('usage')) return 'completion';
    
    return 'assistant'; // Default
  }

  /**
   * Extract metadata from parsed JSON
   */
  private extractMetadata(jsonData: any): ParsedMessage['metadata'] {
    const metadata: ParsedMessage['metadata'] = {};

    // Session information
    if (jsonData.session_id || jsonData.sessionId) {
      metadata.sessionId = jsonData.session_id || jsonData.sessionId;
    }

    // Tool information
    if (jsonData.tool_calls && jsonData.tool_calls.length > 0) {
      metadata.toolName = jsonData.tool_calls[0].tool;
    } else if (jsonData.tool) {
      metadata.toolName = jsonData.tool;
    }

    // Cost information
    if (jsonData.total_cost_usd || jsonData.totalCost) {
      metadata.cost = jsonData.total_cost_usd || jsonData.totalCost;
    }

    // Token information
    if (jsonData.usage && jsonData.usage.total_tokens) {
      metadata.tokens = jsonData.usage.total_tokens;
    }

    return metadata;
  }

  /**
   * Clean up timed out messages
   */
  private cleanupTimedOutMessages(): void {
    const now = Date.now();
    this.messageQueue = this.messageQueue.filter(
      msg => now - msg.timestamp < this.options.messageTimeout
    );

    this.pendingMessages = this.pendingMessages.filter(
      msg => now - msg.timestamp < this.options.messageTimeout
    );
  }

  /**
   * Get all completed messages and clear the queue
   */
  getCompletedMessages(): ParsedMessage[] {
    const messages = [...this.completedMessages];
    this.completedMessages = [];
    return messages;
  }

  /**
   * Check if there are any completed messages waiting
   */
  hasCompletedMessages(): boolean {
    return this.completedMessages.length > 0;
  }

  /**
   * Get the next completed message
   */
  getNextMessage(): ParsedMessage | null {
    return this.completedMessages.shift() || null;
  }

  /**
   * Get current buffer state for debugging
   */
  getBufferState(): BufferState {
    return {
      buffer: this.buffer,
      incompleteMessages: this.pendingMessages.length,
      completedMessages: this.completedMessages.length,
      totalBytesProcessed: this.totalBytesProcessed,
      lastProcessedAt: this.lastProcessedAt,
      hasIncompleteUtf8: this.utf8Buffer.length > 0
    };
  }

  /**
   * Force completion of pending messages (useful for timeouts)
   */
  forceCompletion(): ParsedMessage[] {
    const forcedMessages: ParsedMessage[] = [];

    // Try to parse the current buffer as a partial message
    if (this.buffer.trim()) {
      const partialMessage = this.tryParseTextMessage(this.buffer);
      if (partialMessage) {
        partialMessage.isComplete = false; // Mark as forced completion
        forcedMessages.push(partialMessage);
      }
    }

    // Clear buffers
    this.buffer = '';
    this.utf8Buffer = Buffer.alloc(0);
    this.pendingMessages = [];

    this.completedMessages.push(...forcedMessages);
    return forcedMessages;
  }

  /**
   * Reset the buffer manager to initial state
   */
  reset(): void {
    this.buffer = '';
    this.utf8Buffer = Buffer.alloc(0);
    this.pendingMessages = [];
    this.completedMessages = [];
    this.messageQueue = [];
    this.totalBytesProcessed = 0;
    this.lastProcessedAt = 0;
  }

  /**
   * Check if the current buffer might be waiting for more data
   */
  isWaitingForData(): boolean {
    // Check for incomplete JSON structures
    const openBraces = (this.buffer.match(/\{/g) || []).length;
    const closeBraces = (this.buffer.match(/\}/g) || []).length;
    
    if (openBraces > closeBraces) return true;

    // Check for incomplete UTF-8 sequences
    if (this.utf8Buffer.length > 0) return true;

    // Check if buffer ends with incomplete JSON patterns
    const trimmed = this.buffer.trim();
    if (trimmed.endsWith(',') || trimmed.endsWith(':')) return true;

    // Check for streaming JSON start without end
    if (this.jsonPatterns.streamStart.test(trimmed) && !this.jsonPatterns.streamEnd.test(trimmed)) {
      return true;
    }

    return false;
  }

  /**
   * Process a complete response and extract all meaningful content
   */
  processCompleteResponse(response: string): {
    messages: ParsedMessage[];
    summary: {
      totalMessages: number;
      messageTypes: Record<MessageType, number>;
      hasErrors: boolean;
      toolsUsed: string[];
      filesAffected: string[];
    };
  } {
    // Reset state for fresh processing
    this.reset();

    // Process the complete response
    const messages = this.addChunk(response);

    // Force completion of any remaining buffer content
    const finalMessages = this.forceCompletion();
    messages.push(...finalMessages);

    // Generate summary
    const messageTypes: Record<MessageType, number> = {
      user: 0, assistant: 0, tool_use: 0, tool_result: 0,
      error: 0, system: 0, completion: 0
    };
    
    const toolsUsed: string[] = [];
    const filesAffected: string[] = [];
    let hasErrors = false;

    messages.forEach(msg => {
      messageTypes[msg.type]++;
      
      if (msg.type === 'error') hasErrors = true;
      
      if (msg.metadata?.toolName) {
        toolsUsed.push(msg.metadata.toolName);
      }

      // Extract file operations from content
      if (msg.content) {
        const content = JSON.stringify(msg.content);
        const fileMatches = content.match(/"([^"]*\.(ts|js|json|md|txt|py|java|cpp|cs))"/g);
        if (fileMatches) {
          filesAffected.push(...fileMatches.map(m => m.replace(/"/g, '')));
        }
      }
    });

    return {
      messages,
      summary: {
        totalMessages: messages.length,
        messageTypes,
        hasErrors,
        toolsUsed: Array.from(new Set(toolsUsed)),
        filesAffected: Array.from(new Set(filesAffected))
      }
    };
  }
}

/**
 * Utility function to create a BufferManager with common configurations
 */
export function createBufferManager(preset: 'standard' | 'debug' | 'minimal' | 'production'): BufferManager {
  const configs = {
    standard: {
      maxBufferSize: 1024 * 1024,
      preserveAnsi: false,
      enableUtf8Handling: true,
      messageTimeout: 30000,
      debugMode: false
    },
    debug: {
      maxBufferSize: 2 * 1024 * 1024,
      preserveAnsi: true,
      enableUtf8Handling: true,
      messageTimeout: 60000,
      debugMode: true
    },
    minimal: {
      maxBufferSize: 512 * 1024,
      preserveAnsi: false,
      enableUtf8Handling: false,
      messageTimeout: 15000,
      debugMode: false
    },
    production: {
      maxBufferSize: 4 * 1024 * 1024,
      preserveAnsi: false,
      enableUtf8Handling: true,
      messageTimeout: 45000,
      debugMode: false
    }
  };

  return new BufferManager(configs[preset]);
}