import { StreamJsonParser } from '../outputParser';
import stripAnsi from 'strip-ansi';

describe('StreamJsonParser', () => {
  let parser: StreamJsonParser;

  beforeEach(() => {
    parser = new StreamJsonParser();
  });

  describe('ANSI stripping', () => {
    it('should strip ANSI escape codes from output', () => {
      const inputWithAnsi = '\x1b[31mError:\x1b[0m Something went wrong';
      const expected = 'Error: Something went wrong';
      
      const result = parser.stripAnsi(inputWithAnsi);
      expect(result).toBe(expected);
    });

    it('should handle complex ANSI sequences', () => {
      const inputWithAnsi = '\x1b[1;31;40mBold red text on black background\x1b[0m';
      const expected = 'Bold red text on black background';
      
      const result = parser.stripAnsi(inputWithAnsi);
      expect(result).toBe(expected);
    });

    it('should handle output without ANSI codes', () => {
      const input = 'Normal text without ANSI codes';
      const result = parser.stripAnsi(input);
      expect(result).toBe(input);
    });

    it('should handle empty string', () => {
      const result = parser.stripAnsi('');
      expect(result).toBe('');
    });
  });

  describe('JSON stream parsing', () => {
    it('should parse complete JSON objects', () => {
      const jsonStr = '{"result": "success", "sessionId": "abc123"}';
      const result = parser.parseJsonChunk(jsonStr);
      
      expect(result.isComplete).toBe(true);
      expect(result.data).toEqual({ result: 'success', sessionId: 'abc123' });
    });

    it('should handle partial JSON chunks', () => {
      const partialJson = '{"result": "success", "sessionId"';
      const result = parser.parseJsonChunk(partialJson);
      
      expect(result.isComplete).toBe(false);
      expect(result.data).toBeNull();
    });

    it('should handle multiple complete JSON objects', () => {
      const multiJson = '{"id": 1}\n{"id": 2}\n{"id": 3}';
      const chunks = multiJson.split('\n');
      
      chunks.forEach((chunk, index) => {
        const result = parser.parseJsonChunk(chunk);
        expect(result.isComplete).toBe(true);
        expect(result.data).toEqual({ id: index + 1 });
      });
    });

    it('should handle malformed JSON gracefully', () => {
      const malformedJson = '{"result": "success", "sessionId": abc123}';
      const result = parser.parseJsonChunk(malformedJson);
      
      expect(result.isComplete).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
    });
  });

  describe('Stream buffering and reassembly', () => {
    it('should buffer partial messages', () => {
      const part1 = '{"result": "suc';
      const part2 = 'cess", "sessionId": "abc123"}';
      
      parser.addChunk(part1);
      expect(parser.hasCompleteMessage()).toBe(false);
      
      parser.addChunk(part2);
      expect(parser.hasCompleteMessage()).toBe(true);
      
      const message = parser.getCompleteMessage();
      expect(message).toEqual({ result: 'success', sessionId: 'abc123' });
    });

    it('should handle multiple buffered chunks', () => {
      const chunks = ['{"re', 'sult": "suc', 'cess", "data":', ' [1, 2, 3]}'];
      
      chunks.forEach((chunk, index) => {
        parser.addChunk(chunk);
        if (index < chunks.length - 1) {
          expect(parser.hasCompleteMessage()).toBe(false);
        }
      });
      
      expect(parser.hasCompleteMessage()).toBe(true);
      const message = parser.getCompleteMessage();
      expect(message).toEqual({ result: 'success', data: [1, 2, 3] });
    });

    it('should handle mixed complete and partial messages', () => {
      const input = '{"id": 1}\n{"incomplete": "mes';
      parser.addChunk(input);
      
      expect(parser.getCompleteMessages()).toHaveLength(1);
      expect(parser.getCompleteMessages()[0]).toEqual({ id: 1 });
      expect(parser.hasCompleteMessage()).toBe(false);
    });
  });

  describe('Response completion detection', () => {
    it('should detect completion markers in text output', () => {
      const completedOutput = 'Task completed successfully\nFiles modified: 2\n';
      expect(parser.isResponseComplete(completedOutput)).toBe(true);
    });

    it('should detect completion in JSON output', () => {
      const jsonOutput = { result: 'Task completed', status: 'success' };
      expect(parser.isResponseComplete(JSON.stringify(jsonOutput))).toBe(true);
    });

    it('should detect error completion', () => {
      const errorOutput = 'Error: Failed to execute command\nExecution terminated';
      expect(parser.isResponseComplete(errorOutput)).toBe(true);
    });

    it('should not detect completion for partial responses', () => {
      const partialOutput = 'Working on task...';
      expect(parser.isResponseComplete(partialOutput)).toBe(false);
    });

    it('should detect session termination patterns', () => {
      const sessionEnd = 'Session ended. Total cost: $0.05';
      expect(parser.isResponseComplete(sessionEnd)).toBe(true);
    });
  });

  describe('Tool usage extraction', () => {
    it('should extract tool usage from JSON output', () => {
      const jsonOutput = {
        tools_used: ['Read', 'Write', 'Edit'],
        tool_calls: [
          { tool: 'Bash', parameters: { command: 'ls -la' } },
          { tool: 'Grep', parameters: { pattern: 'error' } }
        ]
      };

      const tools = parser.extractToolUsage(JSON.stringify(jsonOutput));
      expect(tools).toContain('Read');
      expect(tools).toContain('Write');
      expect(tools).toContain('Edit');
      expect(tools).toContain('Bash');
      expect(tools).toContain('Grep');
    });

    it('should extract tool usage from text output', () => {
      const textOutput = `
        Using the Read tool to examine file.ts
        Invoking Edit tool to modify content
        Running Bash command: npm install
      `;

      const tools = parser.extractToolUsage(textOutput);
      expect(tools).toContain('Read');
      expect(tools).toContain('Edit');
      expect(tools).toContain('Bash');
    });

    it('should handle output with no tools', () => {
      const output = 'This is just regular text with no tool usage';
      const tools = parser.extractToolUsage(output);
      expect(tools).toHaveLength(0);
    });
  });

  describe('Error message extraction', () => {
    it('should extract error messages from JSON output', () => {
      const jsonOutput = {
        error: 'File not found',
        result: 'Failed to read file.txt'
      };

      const errors = parser.extractErrors(JSON.stringify(jsonOutput));
      expect(errors).toContain('File not found');
    });

    it('should extract error messages from text output', () => {
      const textOutput = `
        Error: Cannot access file
        ERROR: Permission denied
        Failed to execute command
        Unable to connect to server
      `;

      const errors = parser.extractErrors(textOutput);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('Cannot access file'))).toBe(true);
      expect(errors.some(e => e.includes('Permission denied'))).toBe(true);
    });

    it('should handle output with no errors', () => {
      const output = 'Everything is working fine';
      const errors = parser.extractErrors(output);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Response data extraction', () => {
    it('should extract file operations', () => {
      const jsonOutput = {
        files_modified: ['src/test.ts', 'package.json'],
        files_created: ['src/new.ts'],
        files_read: ['README.md']
      };

      const files = parser.extractFileOperations(JSON.stringify(jsonOutput));
      expect(files.modified).toContain('src/test.ts');
      expect(files.modified).toContain('package.json');
      expect(files.created).toContain('src/new.ts');
      expect(files.read).toContain('README.md');
    });

    it('should extract command executions', () => {
      const jsonOutput = {
        commands_executed: ['npm install', 'git add .'],
        bash_commands: ['ls -la', 'pwd']
      };

      const commands = parser.extractCommands(JSON.stringify(jsonOutput));
      expect(commands).toContain('npm install');
      expect(commands).toContain('git add .');
      expect(commands).toContain('ls -la');
      expect(commands).toContain('pwd');
    });

    it('should extract session metadata', () => {
      const jsonOutput = {
        session_id: 'test-session-123',
        total_cost_usd: 0.05,
        timestamp: '2024-01-01T12:00:00Z'
      };

      const metadata = parser.extractSessionMetadata(JSON.stringify(jsonOutput));
      expect(metadata.sessionId).toBe('test-session-123');
      expect(metadata.totalCost).toBe(0.05);
      expect(metadata.timestamp).toBe('2024-01-01T12:00:00Z');
    });
  });

  describe('Stream processing integration', () => {
    it('should handle real-time Claude Code output simulation', () => {
      const chunks = [
        '\x1b[32m✓\x1b[0m Reading file: src/test.ts\n',
        '{"tools_used": ["Read"], "files_read": ["src/test.ts"]}\n',
        'Analyzing file content...\n',
        '\x1b[33m⚠\x1b[0m Warning: Deprecated function found\n',
        '{"result": "Analysis complete", "status": "success"}\n'
      ];

      chunks.forEach(chunk => parser.addChunk(chunk));
      
      const completeMessages = parser.getCompleteMessages();
      expect(completeMessages.length).toBeGreaterThan(0);
      
      const lastMessage = completeMessages[completeMessages.length - 1];
      expect(lastMessage.result).toBe('Analysis complete');
    });

    it('should handle broken JSON across chunks', () => {
      const chunks = [
        '{"tools_u',
        'sed": ["Read", "Wri',
        'te"], "result": "File',
        's processed"}',
        '\n'
      ];

      chunks.forEach(chunk => parser.addChunk(chunk));
      
      expect(parser.hasCompleteMessage()).toBe(true);
      const message = parser.getCompleteMessage();
      expect(message.tools_used).toEqual(['Read', 'Write']);
      expect(message.result).toBe('Files processed');
    });
  });

  describe('Error resilience', () => {
    it('should recover from malformed chunks', () => {
      parser.addChunk('{"malformed": json}');
      parser.addChunk('{"valid": "json"}');
      
      const messages = parser.getCompleteMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({ valid: 'json' });
    });

    it('should handle mixed text and JSON output', () => {
      parser.addChunk('Some text output\n');
      parser.addChunk('{"json_data": "value"}\n');
      parser.addChunk('More text\n');
      
      const messages = parser.getCompleteMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({ json_data: 'value' });
    });

    it('should maintain buffer integrity after errors', () => {
      parser.addChunk('{"partial":');
      parser.addChunk('invalid}');
      parser.addChunk('{"valid": "complete"}');
      
      const messages = parser.getCompleteMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({ valid: 'complete' });
    });
  });
});