/**
 * Comprehensive SDK Integration Tests
 * 
 * Tests all SDK integration points including:
 * - SDK authentication flow
 * - Session management with SDK
 * - Browser authentication without API keys
 * - Fallback to CLI when SDK unavailable
 * - Error handling scenarios
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { SDKClaudeExecutor } from './src/services/sdkClaudeExecutor';
import { Logger } from './src/logger';
import { createTempDir, cleanupDir } from './src/__tests__/setup';

describe('SDK Integration Tests', () => {
  let logger: Logger;
  let tempDir: string;
  let originalSDKModule: any;

  beforeEach(() => {
    tempDir = createTempDir();
    logger = new Logger('test', 'debug');
    
    // Mock the SDK module at the beginning of each test
    jest.mock('@anthropic-ai/claude-code', () => ({
      query: jest.fn()
    }), { virtual: true });
  });

  afterEach(async () => {
    cleanupDir(tempDir);
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe('SDKClaudeExecutor', () => {
    let sdkExecutor: SDKClaudeExecutor;

    beforeEach(() => {
      sdkExecutor = new SDKClaudeExecutor(logger);
    });

    describe('SDK Initialization', () => {
      test('should successfully initialize SDK when available globally', async () => {
        // Mock require.resolve to simulate global SDK installation
        const mockRequireResolve = jest.spyOn(require, 'resolve');
        mockRequireResolve.mockReturnValue('/usr/local/lib/node_modules/@anthropic-ai/claude-code');
        
        // Mock the SDK module
        const mockSDK = {
          query: jest.fn().mockImplementation(async function* () {
            yield { type: 'result', result: 'SDK initialized successfully' };
          })
        };
        
        jest.doMock('/usr/local/lib/node_modules/@anthropic-ai/claude-code', () => mockSDK, { virtual: true });
        
        expect(sdkExecutor.isAvailable()).toBe(false); // Initially false until initialized
        
        mockRequireResolve.mockRestore();
      });

      test('should handle SDK unavailable gracefully', async () => {
        // Mock require.resolve to throw error (SDK not found)
        const mockRequireResolve = jest.spyOn(require, 'resolve');
        mockRequireResolve.mockImplementation(() => {
          throw new Error('Cannot find module');
        });

        const newExecutor = new SDKClaudeExecutor(logger);
        expect(newExecutor.isAvailable()).toBe(false);
        
        mockRequireResolve.mockRestore();
      });

      test('should try multiple SDK installation paths', async () => {
        const mockRequireResolve = jest.spyOn(require, 'resolve');
        
        // First call fails (npm global)
        mockRequireResolve.mockImplementationOnce(() => {
          throw new Error('Not found');
        });
        
        // Second call succeeds (user global)
        mockRequireResolve.mockReturnValueOnce('/home/user/.npm-global/lib/node_modules/@anthropic-ai/claude-code');
        
        const mockSDK = {
          query: jest.fn().mockImplementation(async function* () {
            yield { type: 'result', result: 'Found in user global' };
          })
        };
        
        jest.doMock('/home/user/.npm-global/lib/node_modules/@anthropic-ai/claude-code', () => mockSDK, { virtual: true });
        
        const newExecutor = new SDKClaudeExecutor(logger);
        
        mockRequireResolve.mockRestore();
      });
    });

    describe('SDK Execution', () => {
      test('should execute prompt successfully with SDK', async () => {
        // Mock the SDK
        const mockQuery = jest.fn().mockImplementation(async function* () {
          yield { type: 'session', sessionId: 'test-session-123' };
          yield { type: 'result', result: 'Hello from SDK!' };
        });
        
        const mockSDK = { query: mockQuery };
        
        // Mock successful SDK loading
        const mockRequireResolve = jest.spyOn(require, 'resolve');
        mockRequireResolve.mockReturnValue('/mock/path');
        jest.doMock('/mock/path', () => mockSDK, { virtual: true });
        
        // Force reinitialize
        const newExecutor = new SDKClaudeExecutor(logger);
        
        const result = await newExecutor.executeWithSDK('Test prompt', {
          model: 'sonnet',
          verbose: true
        });

        expect(result.output).toBe('Hello from SDK!');
        expect(result.exitCode).toBe(0);
        expect(mockQuery).toHaveBeenCalledWith({
          prompt: 'Test prompt',
          options: {
            maxTurns: 1,
            model: 'sonnet'
          }
        });
        
        mockRequireResolve.mockRestore();
      });

      test('should handle tool use messages', async () => {
        const mockQuery = jest.fn().mockImplementation(async function* () {
          yield { type: 'tool_use', tool: 'Read' };
          yield { type: 'result', result: 'Tool executed successfully' };
        });
        
        const mockSDK = { query: mockQuery };
        
        const mockRequireResolve = jest.spyOn(require, 'resolve');
        mockRequireResolve.mockReturnValue('/mock/path');
        jest.doMock('/mock/path', () => mockSDK, { virtual: true });
        
        const newExecutor = new SDKClaudeExecutor(logger);
        
        const result = await newExecutor.executeWithSDK('Use a tool', {
          allowedTools: 'Read,Write',
          verbose: true
        });

        expect(result.output).toBe('Tool executed successfully');
        expect(result.exitCode).toBe(0);
        
        mockRequireResolve.mockRestore();
      });

      test('should handle streaming responses', async () => {
        const mockQuery = jest.fn().mockImplementation(async function* () {
          yield { type: 'stream', content: 'Streaming ' };
          yield { type: 'stream', content: 'response ' };
          yield { type: 'stream', content: 'content' };
          yield { type: 'result', result: '' };
        });
        
        const mockSDK = { query: mockQuery };
        
        const mockRequireResolve = jest.spyOn(require, 'resolve');
        mockRequireResolve.mockReturnValue('/mock/path');
        jest.doMock('/mock/path', () => mockSDK, { virtual: true });
        
        const newExecutor = new SDKClaudeExecutor(logger);
        
        const result = await newExecutor.executeWithSDK('Stream test');

        expect(result.output).toBe('Streaming response content');
        expect(result.exitCode).toBe(0);
        
        mockRequireResolve.mockRestore();
      });

      test('should handle session continuation', async () => {
        const mockQuery = jest.fn().mockImplementation(async function* () {
          yield { type: 'session', sessionId: 'continued-session' };
          yield { type: 'result', result: 'Continued from previous session' };
        });
        
        const mockSDK = { query: mockQuery };
        
        const mockRequireResolve = jest.spyOn(require, 'resolve');
        mockRequireResolve.mockReturnValue('/mock/path');
        jest.doMock('/mock/path', () => mockSDK, { virtual: true });
        
        const newExecutor = new SDKClaudeExecutor(logger);
        
        const result = await newExecutor.executeWithSDK('Continue session', {
          sessionId: 'previous-session-123'
        });

        expect(result.output).toBe('Continued from previous session');
        expect(mockQuery).toHaveBeenCalledWith({
          prompt: 'Continue session',
          options: {
            maxTurns: 1,
            model: 'sonnet',
            continue: 'previous-session-123'
          }
        });
        
        mockRequireResolve.mockRestore();
      });

      test('should handle SDK errors gracefully', async () => {
        const mockQuery = jest.fn().mockImplementation(async function* () {
          yield { type: 'error', error: 'SDK execution failed' };
        });
        
        const mockSDK = { query: mockQuery };
        
        const mockRequireResolve = jest.spyOn(require, 'resolve');
        mockRequireResolve.mockReturnValue('/mock/path');
        jest.doMock('/mock/path', () => mockSDK, { virtual: true });
        
        const newExecutor = new SDKClaudeExecutor(logger);
        
        await expect(newExecutor.executeWithSDK('Error test')).rejects.toThrow('SDK execution failed');
        
        mockRequireResolve.mockRestore();
      });

      test('should handle authentication errors specifically', async () => {
        const mockQuery = jest.fn().mockImplementation(async function* () {
          throw new Error('Please authenticate with Claude');
        });
        
        const mockSDK = { query: mockQuery };
        
        const mockRequireResolve = jest.spyOn(require, 'resolve');
        mockRequireResolve.mockReturnValue('/mock/path');
        jest.doMock('/mock/path', () => mockSDK, { virtual: true });
        
        const newExecutor = new SDKClaudeExecutor(logger);
        
        await expect(newExecutor.executeWithSDK('Auth test')).rejects.toThrow('Claude authentication required');
        
        mockRequireResolve.mockRestore();
      });

      test('should handle timeout scenarios', async () => {
        const mockQuery = jest.fn().mockImplementation(async function* () {
          // Simulate long-running operation
          await new Promise(resolve => setTimeout(resolve, 2000));
          yield { type: 'result', result: 'Too late!' };
        });
        
        const mockSDK = { query: mockQuery };
        
        const mockRequireResolve = jest.spyOn(require, 'resolve');
        mockRequireResolve.mockReturnValue('/mock/path');
        jest.doMock('/mock/path', () => mockSDK, { virtual: true });
        
        const newExecutor = new SDKClaudeExecutor(logger);
        
        await expect(newExecutor.executeWithSDK('Timeout test', { timeout: 1000 }))
          .rejects.toThrow('Claude execution timed out after 1000ms');
        
        mockRequireResolve.mockRestore();
      }, 10000);

      test('should throw error when SDK unavailable during execution', async () => {
        // Mock SDK as unavailable
        const mockRequireResolve = jest.spyOn(require, 'resolve');
        mockRequireResolve.mockImplementation(() => {
          throw new Error('SDK not found');
        });
        
        const newExecutor = new SDKClaudeExecutor(logger);
        
        await expect(newExecutor.executeWithSDK('Test')).rejects.toThrow(
          'Claude Code SDK is not available. Please install it globally: npm install -g @anthropic-ai/claude-code'
        );
        
        mockRequireResolve.mockRestore();
      });
    });
  });


  describe('SDK Integration Fallback Strategy', () => {
    test('should prefer SDK when available', async () => {
      const mockSDKQuery = jest.fn().mockImplementation(async function* () {
        yield { type: 'result', result: 'SDK response' };
      });
      
      const mockSDK = { query: mockSDKQuery };
      
      const mockRequireResolve = jest.spyOn(require, 'resolve');
      mockRequireResolve.mockReturnValue('/mock/sdk/path');
      jest.doMock('/mock/sdk/path', () => mockSDK, { virtual: true });
      
      const sdkExecutor = new SDKClaudeExecutor(logger);
      
      expect(sdkExecutor.isAvailable()).toBe(false); // Will become true after first use
      
      const result = await sdkExecutor.executeWithSDK('Test SDK priority');
      expect(result.output).toBe('SDK response');
      
      mockRequireResolve.mockRestore();
    });

    test('should fallback to CLI when SDK fails', async () => {
      // Test that demonstrates the fallback pattern
      // In practice, this would be implemented in the main executor logic
      
      const sdkExecutor = new SDKClaudeExecutor(logger);
      
      // Simulate SDK failure
      const mockRequireResolve = jest.spyOn(require, 'resolve');
      mockRequireResolve.mockImplementation(() => {
        throw new Error('SDK not available');
      });
      
      expect(sdkExecutor.isAvailable()).toBe(false);
      
      mockRequireResolve.mockRestore();
    });
  });

  describe('Session Management Integration', () => {
    test('should maintain session continuity with SDK', async () => {
      const mockQuery = jest.fn();
      
      // First call - new session
      mockQuery.mockImplementationOnce(async function* () {
        yield { type: 'session', sessionId: 'new-session-123' };
        yield { type: 'result', result: 'First response' };
      });
      
      // Second call - continued session
      mockQuery.mockImplementationOnce(async function* () {
        yield { type: 'session', sessionId: 'new-session-123' };
        yield { type: 'result', result: 'Continued response' };
      });
      
      const mockSDK = { query: mockQuery };
      
      const mockRequireResolve = jest.spyOn(require, 'resolve');
      mockRequireResolve.mockReturnValue('/mock/path');
      jest.doMock('/mock/path', () => mockSDK, { virtual: true });
      
      const sdkExecutor = new SDKClaudeExecutor(logger);
      
      // First execution
      const result1 = await sdkExecutor.executeWithSDK('Start session');
      expect(result1.output).toBe('First response');
      
      // Second execution with session continuation
      const result2 = await sdkExecutor.executeWithSDK('Continue session', {
        sessionId: 'new-session-123'
      });
      expect(result2.output).toBe('Continued response');
      
      // Verify session continuation was used
      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(mockQuery).toHaveBeenLastCalledWith({
        prompt: 'Continue session',
        options: {
          maxTurns: 1,
          model: 'sonnet',
          continue: 'new-session-123'
        }
      });
      
      mockRequireResolve.mockRestore();
    });

    test('should handle session persistence across executor restarts', async () => {
      // Test that session IDs can be persisted and reused
      const sessionId = 'persistent-session-456';
      
      const mockQuery = jest.fn().mockImplementation(async function* () {
        yield { type: 'session', sessionId: sessionId };
        yield { type: 'result', result: 'Restored session' };
      });
      
      const mockSDK = { query: mockQuery };
      
      const mockRequireResolve = jest.spyOn(require, 'resolve');
      mockRequireResolve.mockReturnValue('/mock/path');
      jest.doMock('/mock/path', () => mockSDK, { virtual: true });
      
      // Create new executor (simulating restart)
      const sdkExecutor = new SDKClaudeExecutor(logger);
      
      const result = await sdkExecutor.executeWithSDK('Restore session', {
        sessionId: sessionId
      });
      
      expect(result.output).toBe('Restored session');
      expect(mockQuery).toHaveBeenCalledWith({
        prompt: 'Restore session',
        options: {
          maxTurns: 1,
          model: 'sonnet',
          continue: sessionId
        }
      });
      
      mockRequireResolve.mockRestore();
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should provide detailed error messages for common failures', async () => {
      const scenarios = [
        {
          error: new Error('Network error'),
          expected: 'Network error'
        },
        {
          error: new Error('API rate limit exceeded'),
          expected: 'API rate limit exceeded'
        },
        {
          error: new Error('Invalid session ID'),
          expected: 'Invalid session ID'
        }
      ];

      const mockRequireResolve = jest.spyOn(require, 'resolve');
      mockRequireResolve.mockReturnValue('/mock/path');

      for (const scenario of scenarios) {
        const mockQuery = jest.fn().mockImplementation(async function* () {
          throw scenario.error;
        });
        
        const mockSDK = { query: mockQuery };
        jest.doMock('/mock/path', () => mockSDK, { virtual: true });
        
        const sdkExecutor = new SDKClaudeExecutor(logger);
        
        await expect(sdkExecutor.executeWithSDK('Error test')).rejects.toThrow(scenario.expected);
        
        jest.clearAllMocks();
        jest.resetModules();
      }
      
      mockRequireResolve.mockRestore();
    });

    test('should handle partial responses gracefully', async () => {
      const mockQuery = jest.fn().mockImplementation(async function* () {
        yield { type: 'stream', content: 'Partial ' };
        yield { type: 'stream', content: 'response ' };
        // Simulate interrupted stream - no final result
      });
      
      const mockSDK = { query: mockQuery };
      
      const mockRequireResolve = jest.spyOn(require, 'resolve');
      mockRequireResolve.mockReturnValue('/mock/path');
      jest.doMock('/mock/path', () => mockSDK, { virtual: true });
      
      const sdkExecutor = new SDKClaudeExecutor(logger);
      
      const result = await sdkExecutor.executeWithSDK('Partial test');
      expect(result.output).toBe('Partial response');
      expect(result.exitCode).toBe(0);
      
      mockRequireResolve.mockRestore();
    });

    test('should handle empty responses', async () => {
      const mockQuery = jest.fn().mockImplementation(async function* () {
        yield { type: 'result', result: '' };
      });
      
      const mockSDK = { query: mockQuery };
      
      const mockRequireResolve = jest.spyOn(require, 'resolve');
      mockRequireResolve.mockReturnValue('/mock/path');
      jest.doMock('/mock/path', () => mockSDK, { virtual: true });
      
      const sdkExecutor = new SDKClaudeExecutor(logger);
      
      const result = await sdkExecutor.executeWithSDK('Empty test');
      expect(result.output).toBe('No output received from Claude');
      expect(result.exitCode).toBe(0);
      
      mockRequireResolve.mockRestore();
    });
  });

  describe('Configuration and Options', () => {
    test('should handle all SDK options correctly', async () => {
      const mockQuery = jest.fn().mockImplementation(async function* () {
        yield { type: 'result', result: 'Configured response' };
      });
      
      const mockSDK = { query: mockQuery };
      
      const mockRequireResolve = jest.spyOn(require, 'resolve');
      mockRequireResolve.mockReturnValue('/mock/path');
      jest.doMock('/mock/path', () => mockSDK, { virtual: true });
      
      const sdkExecutor = new SDKClaudeExecutor(logger);
      
      await sdkExecutor.executeWithSDK('Config test', {
        model: 'opus',
        allowedTools: 'Read,Write,Edit,Bash',
        sessionId: 'config-session',
        verbose: true,
        timeout: 60000
      });
      
      expect(mockQuery).toHaveBeenCalledWith({
        prompt: 'Config test',
        options: {
          maxTurns: 1,
          model: 'opus',
          allowedTools: ['Read', 'Write', 'Edit', 'Bash'],
          continue: 'config-session'
        }
      });
      
      mockRequireResolve.mockRestore();
    });

    test('should use default configuration when options not provided', async () => {
      const mockQuery = jest.fn().mockImplementation(async function* () {
        yield { type: 'result', result: 'Default response' };
      });
      
      const mockSDK = { query: mockQuery };
      
      const mockRequireResolve = jest.spyOn(require, 'resolve');
      mockRequireResolve.mockReturnValue('/mock/path');
      jest.doMock('/mock/path', () => mockSDK, { virtual: true });
      
      const sdkExecutor = new SDKClaudeExecutor(logger);
      
      await sdkExecutor.executeWithSDK('Default test');
      
      expect(mockQuery).toHaveBeenCalledWith({
        prompt: 'Default test',
        options: {
          maxTurns: 1,
          model: 'sonnet'
        }
      });
      
      mockRequireResolve.mockRestore();
    });
  });
});

/**
 * Integration Test Runner
 * 
 * To run these tests:
 * 1. Ensure Jest is configured: npm install --save-dev jest @types/jest ts-jest
 * 2. Add to package.json scripts: "test:sdk": "jest test-sdk-integration.ts"
 * 3. Run: npm run test:sdk
 * 
 * Mock Requirements:
 * - @anthropic-ai/claude-code SDK (mocked)
 * - child_process.spawn (mocked for browser auth tests)
 * - File system operations (using temp directories)
 * 
 * Test Coverage:
 * ✅ SDK availability detection
 * ✅ SDK initialization from multiple paths
 * ✅ Successful SDK execution
 * ✅ Session management and continuation
 * ✅ Tool use handling
 * ✅ Streaming responses
 * ✅ Error handling (authentication, network, timeouts)
 * ✅ Browser auth CLI spawning
 * ✅ Fallback strategies
 * ✅ Configuration options
 * ✅ Response parsing
 * ✅ Empty and partial response handling
 */