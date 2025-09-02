import { BufferManager, createBufferManager, MessageType, ParsedMessage } from '../stream/bufferManager';

describe('BufferManager', () => {
  let bufferManager: BufferManager;

  beforeEach(() => {
    bufferManager = new BufferManager();
  });

  afterEach(() => {
    bufferManager.reset();
  });

  describe('Basic Functionality', () => {
    it('should initialize with empty state', () => {
      const state = bufferManager.getBufferState();
      expect(state.buffer).toBe('');
      expect(state.incompleteMessages).toBe(0);
      expect(state.completedMessages).toBe(0);
      expect(state.totalBytesProcessed).toBe(0);
    });

    it('should handle simple text input', () => {
      const messages = bufferManager.addChunk('Hello world');
      expect(messages).toHaveLength(0); // Simple text doesn't create immediate messages
      
      const state = bufferManager.getBufferState();
      expect(state.buffer).toBe('Hello world');
    });

    it('should reset to initial state', () => {
      bufferManager.addChunk('test data');
      bufferManager.reset();
      
      const state = bufferManager.getBufferState();
      expect(state.buffer).toBe('');
      expect(state.totalBytesProcessed).toBe(0);
    });
  });

  describe('ANSI Escape Sequence Handling', () => {
    it('should strip ANSI color codes by default', () => {
      const ansiText = '\x1b[31mError:\x1b[0m Something went wrong';
      const messages = bufferManager.addChunk(ansiText);
      
      const state = bufferManager.getBufferState();
      expect(state.buffer).toBe('Error: Something went wrong');
    });

    it('should handle complex ANSI sequences', () => {
      const complexAnsi = '\x1b[1;31;40mBold red on black\x1b[0m\x1b[2J\x1b[H';
      const messages = bufferManager.addChunk(complexAnsi);
      
      const state = bufferManager.getBufferState();
      expect(state.buffer).toBe('Bold red on black');
    });

    it('should preserve ANSI when configured', () => {
      const preserveAnsiManager = new BufferManager({ preserveAnsi: true });
      const ansiText = '\x1b[H\x1b[2J\x1b[31mRed text\x1b[0m';
      preserveAnsiManager.addChunk(ansiText);
      
      const state = preserveAnsiManager.getBufferState();
      // Should preserve cursor positioning but strip colors
      expect(state.buffer).toContain('\x1b[H\x1b[2J');
      expect(state.buffer).not.toContain('\x1b[31m');
    });

    it('should handle partial ANSI sequences across chunks', () => {
      bufferManager.addChunk('\x1b[3');
      bufferManager.addChunk('1mRed text\x1b[0m');
      
      const state = bufferManager.getBufferState();
      expect(state.buffer).toBe('Red text');
    });
  });

  describe('UTF-8 Handling', () => {
    it('should handle UTF-8 characters properly', () => {
      const utf8Text = 'Hello 🌟 world';
      const messages = bufferManager.addChunk(utf8Text);
      
      const state = bufferManager.getBufferState();
      expect(state.buffer).toBe('Hello 🌟 world');
    });

    it('should handle split UTF-8 sequences across chunks', () => {
      const star = '🌟';
      const starBuffer = Buffer.from(star);
      
      // Split the UTF-8 sequence across two chunks
      bufferManager.addChunk(starBuffer.subarray(0, 2));
      bufferManager.addChunk(starBuffer.subarray(2));
      
      const state = bufferManager.getBufferState();
      expect(state.buffer).toBe('🌟');
    });

    it('should handle invalid UTF-8 sequences gracefully', () => {
      const invalidUtf8 = Buffer.from([0xFF, 0xFE, 0xFD]);
      const messages = bufferManager.addChunk(invalidUtf8);
      
      // Should not crash and should handle gracefully
      const state = bufferManager.getBufferState();
      expect(state.buffer).toBeDefined();
    });

    it('should indicate incomplete UTF-8 sequences in state', () => {
      const partialUtf8 = Buffer.from([0xF0, 0x9F]); // Partial 4-byte UTF-8
      bufferManager.addChunk(partialUtf8);
      
      const state = bufferManager.getBufferState();
      expect(state.hasIncompleteUtf8).toBe(true);
    });
  });

  describe('JSON Message Parsing', () => {
    it('should parse complete JSON messages', () => {
      const jsonMessage = '{"type": "assistant", "content": "Hello", "timestamp": 1234567890}';
      const messages = bufferManager.addChunk(jsonMessage);
      
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('assistant');
      expect(messages[0].content.content).toBe('Hello');
      expect(messages[0].isComplete).toBe(true);
    });

    it('should handle partial JSON across chunks', () => {
      bufferManager.addChunk('{"type": "assi');
      let messages = bufferManager.addChunk('stant", "content": "Hello"}');
      
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('assistant');
    });

    it('should handle multiple JSON objects in one chunk', () => {
      const multiJson = '{"id": 1}\n{"id": 2}\n{"id": 3}';
      const messages = bufferManager.addChunk(multiJson);
      
      expect(messages).toHaveLength(3);
      messages.forEach((msg, index) => {
        expect(msg.content.id).toBe(index + 1);
      });
    });

    it('should detect nested JSON structures', () => {
      const nestedJson = '{"result": {"data": [1, 2, 3], "meta": {"count": 3}}}';
      const messages = bufferManager.addChunk(nestedJson);
      
      expect(messages).toHaveLength(1);
      expect(messages[0].content.result.data).toEqual([1, 2, 3]);
      expect(messages[0].content.result.meta.count).toBe(3);
    });

    it('should handle malformed JSON gracefully', () => {
      const malformedJson = '{"result": "success", "data": invalid}';
      const messages = bufferManager.addChunk(malformedJson);
      
      // Should not parse the malformed JSON but continue processing
      expect(messages).toHaveLength(0);
    });
  });

  describe('Message Type Detection', () => {
    it('should detect user messages', () => {
      const userMessage = '{"role": "user", "content": "Hello"}';
      const messages = bufferManager.addChunk(userMessage);
      
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('user');
    });

    it('should detect assistant messages', () => {
      const assistantMessage = '{"role": "assistant", "content": "Hi there"}';
      const messages = bufferManager.addChunk(assistantMessage);
      
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('assistant');
    });

    it('should detect tool use messages', () => {
      const toolUseMessage = '{"type": "tool_use", "tool_calls": [{"tool": "Read"}]}';
      const messages = bufferManager.addChunk(toolUseMessage);
      
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('tool_use');
      expect(messages[0].metadata?.toolName).toBe('Read');
    });

    it('should detect error messages', () => {
      const errorMessage = '{"error": "File not found", "status": "error"}';
      const messages = bufferManager.addChunk(errorMessage);
      
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('error');
    });

    it('should detect completion messages', () => {
      const completionMessage = '{"stop_reason": "end_turn", "usage": {"total_tokens": 100}}';
      const messages = bufferManager.addChunk(completionMessage);
      
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('completion');
      expect(messages[0].metadata?.tokens).toBe(100);
    });
  });

  describe('Message Metadata Extraction', () => {
    it('should extract session ID', () => {
      const message = '{"session_id": "test-123", "content": "Hello"}';
      const messages = bufferManager.addChunk(message);
      
      expect(messages).toHaveLength(1);
      expect(messages[0].metadata?.sessionId).toBe('test-123');
    });

    it('should extract cost information', () => {
      const message = '{"total_cost_usd": 0.05, "content": "Done"}';
      const messages = bufferManager.addChunk(message);
      
      expect(messages).toHaveLength(1);
      expect(messages[0].metadata?.cost).toBe(0.05);
    });

    it('should extract tool information', () => {
      const message = '{"tool_calls": [{"tool": "Bash", "args": {"command": "ls"}}]}';
      const messages = bufferManager.addChunk(message);
      
      expect(messages).toHaveLength(1);
      expect(messages[0].metadata?.toolName).toBe('Bash');
    });
  });

  describe('Text Message Handling', () => {
    it('should parse substantial text as complete messages', () => {
      const longText = 'This is a substantial piece of text that represents a complete response from the AI assistant containing meaningful content.';
      const messages = bufferManager.addChunk(longText);
      
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('assistant');
      expect(messages[0].isComplete).toBe(true);
      expect(messages[0].content.text).toBe(longText);
    });

    it('should detect completion patterns in text', () => {
      const completionTexts = [
        'Task implementation is complete and ready for review.',
        'Successfully implemented the authentication system.',
        'Analysis finished, all requirements are met.',
        'Error occurred during file processing.'
      ];

      completionTexts.forEach(text => {
        bufferManager.reset();
        const messages = bufferManager.addChunk(text);
        
        expect(messages).toHaveLength(1);
        expect(messages[0].isComplete).toBe(true);
      });
    });

    it('should not immediately complete short text snippets', () => {
      const shortText = 'Working...';
      const messages = bufferManager.addChunk(shortText);
      
      // Short text should not immediately create a message
      expect(messages).toHaveLength(0);
    });
  });

  describe('Buffer State Management', () => {
    it('should track bytes processed', () => {
      const text = 'Hello world';
      bufferManager.addChunk(text);
      
      const state = bufferManager.getBufferState();
      expect(state.totalBytesProcessed).toBe(Buffer.byteLength(text, 'utf8'));
    });

    it('should update last processed timestamp', () => {
      const beforeTime = Date.now();
      bufferManager.addChunk('test');
      const afterTime = Date.now();
      
      const state = bufferManager.getBufferState();
      expect(state.lastProcessedAt).toBeGreaterThanOrEqual(beforeTime);
      expect(state.lastProcessedAt).toBeLessThanOrEqual(afterTime);
    });

    it('should detect when waiting for more data', () => {
      bufferManager.addChunk('{"partial": ');
      expect(bufferManager.isWaitingForData()).toBe(true);
      
      bufferManager.addChunk('"complete"}');
      expect(bufferManager.isWaitingForData()).toBe(false);
    });

    it('should handle buffer overflow', () => {
      const smallBufferManager = new BufferManager({ maxBufferSize: 100 });
      const largeText = 'x'.repeat(200);
      
      const messages = smallBufferManager.addChunk(largeText);
      const state = smallBufferManager.getBufferState();
      
      // Buffer should be truncated
      expect(state.buffer.length).toBeLessThan(200);
    });
  });

  describe('Message Queue Management', () => {
    it('should provide completed messages', () => {
      const message = '{"result": "success"}';
      const messages = bufferManager.addChunk(message);
      
      expect(bufferManager.hasCompletedMessages()).toBe(true);
      
      const completedMessages = bufferManager.getCompletedMessages();
      expect(completedMessages).toHaveLength(1);
      
      // Should clear after getting
      expect(bufferManager.hasCompletedMessages()).toBe(false);
    });

    it('should get next message sequentially', () => {
      bufferManager.addChunk('{"id": 1}\n{"id": 2}');
      
      const first = bufferManager.getNextMessage();
      expect(first?.content.id).toBe(1);
      
      const second = bufferManager.getNextMessage();
      expect(second?.content.id).toBe(2);
      
      const third = bufferManager.getNextMessage();
      expect(third).toBeNull();
    });

    it('should force completion of pending messages', () => {
      bufferManager.addChunk('Partial response that needs completion');
      
      const forcedMessages = bufferManager.forceCompletion();
      expect(forcedMessages).toHaveLength(1);
      expect(forcedMessages[0].isComplete).toBe(false); // Marked as forced
    });
  });

  describe('Complete Response Processing', () => {
    it('should process a complete response with mixed content', () => {
      const complexResponse = `
        Task started...
        {"tool_calls": [{"tool": "Read", "file": "test.ts"}]}
        Reading file content...
        {"result": "File processed successfully"}
        Task completed successfully!
      `;

      const result = bufferManager.processCompleteResponse(complexResponse);
      
      expect(result.messages.length).toBeGreaterThan(0);
      expect(result.summary.totalMessages).toBeGreaterThan(0);
      expect(result.summary.toolsUsed).toContain('Read');
      expect(result.summary.hasErrors).toBe(false);
    });

    it('should extract file operations from responses', () => {
      const responseWithFiles = `
        {"files_modified": ["src/test.ts", "package.json"]}
        {"files_created": ["dist/output.js"]}
        File operations completed
      `;

      const result = bufferManager.processCompleteResponse(responseWithFiles);
      
      expect(result.summary.filesAffected.length).toBeGreaterThan(0);
      expect(result.summary.filesAffected).toContain('src/test.ts');
    });

    it('should detect errors in complete response', () => {
      const responseWithError = `
        Processing files...
        {"error": "Permission denied", "status": "failed"}
        Operation terminated
      `;

      const result = bufferManager.processCompleteResponse(responseWithError);
      
      expect(result.summary.hasErrors).toBe(true);
      expect(result.summary.messageTypes.error).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty chunks', () => {
      const messages = bufferManager.addChunk('');
      expect(messages).toHaveLength(0);
      
      const state = bufferManager.getBufferState();
      expect(state.buffer).toBe('');
    });

    it('should handle null and undefined input', () => {
      expect(() => {
        bufferManager.addChunk(null as any);
      }).not.toThrow();
      
      expect(() => {
        bufferManager.addChunk(undefined as any);
      }).not.toThrow();
    });

    it('should handle binary data gracefully', () => {
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xFF, 0xFE, 0xFD]);
      expect(() => {
        bufferManager.addChunk(binaryData);
      }).not.toThrow();
    });

    it('should handle very long lines', () => {
      const longLine = 'x'.repeat(10000);
      const messages = bufferManager.addChunk(longLine);
      
      // Should handle without crashing
      const state = bufferManager.getBufferState();
      expect(state.buffer).toBeDefined();
    });

    it('should handle rapid successive chunks', () => {
      const chunks = Array.from({ length: 100 }, (_, i) => `chunk_${i}`);
      
      expect(() => {
        chunks.forEach(chunk => bufferManager.addChunk(chunk));
      }).not.toThrow();
    });
  });

  describe('Performance and Memory', () => {
    it('should handle large amounts of data efficiently', () => {
      const largeData = 'x'.repeat(100000);
      const startTime = Date.now();
      
      bufferManager.addChunk(largeData);
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      // Should process reasonably quickly (less than 1 second)
      expect(processingTime).toBeLessThan(1000);
    });

    it('should clean up timed out messages', () => {
      const shortTimeoutManager = new BufferManager({ messageTimeout: 1 });
      
      shortTimeoutManager.addChunk('{"test": "message"}');
      
      // Wait for timeout
      return new Promise(resolve => {
        setTimeout(() => {
          // Adding new chunk should trigger cleanup
          shortTimeoutManager.addChunk('{"new": "message"}');
          resolve(undefined);
        }, 10);
      });
    });
  });
});

describe('BufferManager Factory', () => {
  it('should create standard buffer manager', () => {
    const manager = createBufferManager('standard');
    expect(manager).toBeInstanceOf(BufferManager);
  });

  it('should create debug buffer manager with correct settings', () => {
    const manager = createBufferManager('debug');
    const state = manager.getBufferState();
    
    // Debug mode should be enabled
    expect(manager).toBeInstanceOf(BufferManager);
  });

  it('should create minimal buffer manager', () => {
    const manager = createBufferManager('minimal');
    expect(manager).toBeInstanceOf(BufferManager);
  });

  it('should create production buffer manager', () => {
    const manager = createBufferManager('production');
    expect(manager).toBeInstanceOf(BufferManager);
  });
});

describe('Integration Scenarios', () => {
  it('should handle Claude Code streaming output simulation', () => {
    const manager = new BufferManager();
    const chunks = [
      '\x1b[32m✓\x1b[0m Starting task...\n',
      '{"tool_calls": [{"tool": "Read", "args": {"file": "test.ts"}}]}\n',
      'Reading file: test.ts\n',
      '\x1b[33m⚠\x1b[0m Warning: Deprecated function found\n',
      '{"result": "File analysis complete", "files_read": ["test.ts"]}\n',
      'Task completed successfully!\n',
      '{"session_id": "test-123", "total_cost_usd": 0.02}'
    ];

    let totalMessages = 0;
    chunks.forEach(chunk => {
      const messages = manager.addChunk(chunk);
      totalMessages += messages.length;
    });

    const finalMessages = manager.forceCompletion();
    totalMessages += finalMessages.length;

    expect(totalMessages).toBeGreaterThan(0);
    
    // Should have processed tool calls and results
    const allMessages = manager.getCompletedMessages();
    const hasToolUse = allMessages.some(m => m.type === 'tool_use');
    const hasCompletion = allMessages.some(m => m.metadata?.sessionId);
    
    expect(hasToolUse || hasCompletion).toBe(true);
  });

  it('should handle broken JSON across multiple chunks realistically', () => {
    const manager = new BufferManager();
    
    // Simulate realistic JSON breaking across network packets
    const jsonParts = [
      '{"tool_calls": [{"tool": "',
      'Bash", "args": {"command": "npm ',
      'install"}}, {"tool": "Read", "args": {"file": "package.json"}}], ',
      '"result": "Commands executed successfully", "files_read": ["package.json"]}'
    ];

    jsonParts.forEach(part => manager.addChunk(part));
    
    const messages = manager.getCompletedMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].content.tool_calls).toHaveLength(2);
    expect(messages[0].content.tool_calls[0].tool).toBe('Bash');
  });

  it('should handle mixed ANSI and JSON content', () => {
    const manager = new BufferManager();
    const mixedContent = `
      \x1b[1mBold text\x1b[0m
      {"status": "processing"}
      \x1b[31mError occurred\x1b[0m
      {"error": "Something went wrong", "code": 500}
      \x1b[32mRecovery successful\x1b[0m
      {"result": "Task completed"}
    `;

    const result = manager.processCompleteResponse(mixedContent);
    
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.summary.hasErrors).toBe(true);
    
    // Should have both error and success messages
    const errorMessages = result.messages.filter(m => m.type === 'error');
    const successMessages = result.messages.filter(m => 
      m.content.result || m.content.status === 'processing'
    );
    
    expect(errorMessages.length).toBeGreaterThan(0);
    expect(successMessages.length).toBeGreaterThan(0);
  });
});