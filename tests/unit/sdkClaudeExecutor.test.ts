/**
 * Unit tests for SDKClaudeExecutor
 * Tests SDK-based Claude execution functionality
 */

import { Logger } from '../../logger';
import {
  SDKClaudeExecutor,
  SDKClaudeOptions,
  AuthenticationError,
  BrowserAuthRequiredError,
  SDKNotInstalledError,
  NetworkError,
  APIKeyRequiredError,
  RetryExhaustedError
} from '../../services/sdkClaudeExecutor';
import { SDKResult } from '../../types';

// Mock the logger
jest.mock('../../logger');

// Mock dynamic imports
const mockSDK = {
  query: jest.fn(),
  default: {
    query: jest.fn()
  }
};

// Mock fs and path modules
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readdirSync: jest.fn()
}));

jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  basename: jest.fn((path) => path.split('/').pop())
}));

jest.mock('os', () => ({
  homedir: jest.fn(() => '/home/test')
}));

describe('SDKClaudeExecutor', () => {
  let executor: SDKClaudeExecutor;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockLogger = new Logger() as jest.Mocked<Logger>;
    executor = new SDKClaudeExecutor(mockLogger);
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Reset dynamic import mock
    jest.doMock('@anthropic-ai/claude-code', () => mockSDK, { virtual: true });
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('Constructor and Initialization', () => {
    test('should initialize with logger', () => {
      expect(executor).toBeInstanceOf(SDKClaudeExecutor);
      expect(mockLogger).toBeDefined();
    });

    test('should attempt SDK initialization without blocking', () => {
      // Constructor should complete even if SDK init fails
      expect(() => new SDKClaudeExecutor(mockLogger)).not.toThrow();
    });

    test('should handle SDK initialization failure gracefully', async () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValue(false);
      
      const newExecutor = new SDKClaudeExecutor(mockLogger);
      expect(newExecutor.isAvailable()).toBe(false);
    });
  });

  describe('SDK Path Discovery', () => {
    test('should search multiple SDK paths', () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValue(false);
      
      // Should not throw even when SDK paths don't exist
      expect(() => new SDKClaudeExecutor(mockLogger)).not.toThrow();
    });

    test('should find SDK when available in expected location', () => {
      const fs = require('fs');
      fs.existsSync.mockImplementation((path) => {
        return path.includes('claude-code/sdk.mjs');
      });
      
      const newExecutor = new SDKClaudeExecutor(mockLogger);
      // Initialization is async, so we can't test availability immediately
      expect(newExecutor).toBeInstanceOf(SDKClaudeExecutor);
    });
  });

  describe('executeWithSDK', () => {
    test('should execute simple prompts successfully', async () => {
      // Mock SDK as available
      (executor as any).isSDKAvailable = true;
      (executor as any).claudeSDK = mockSDK;
      
      // Mock browser auth check
      jest.spyOn(executor, 'checkBrowserAuthentication').mockResolvedValue(true);
      
      // Mock SDK query response
      const mockMessages = [
        { type: 'result', result: 'Task completed successfully!' }
      ];
      mockSDK.query.mockReturnValue(mockMessages);
      
      const result = await executor.executeWithSDK('Test prompt');
      
      expect(result.output).toContain('Task completed successfully!');
      expect(result.exitCode).toBe(0);
      expect(result.hasError).toBe(false);
    });

    test('should handle SDK unavailable error', async () => {
      (executor as any).isSDKAvailable = false;
      
      await expect(executor.executeWithSDK('Test prompt'))
        .rejects.toThrow('Claude Code SDK is not available');
    });

    test('should handle browser authentication failure', async () => {
      (executor as any).isSDKAvailable = true;
      jest.spyOn(executor, 'checkBrowserAuthentication').mockResolvedValue(false);
      
      await expect(executor.executeWithSDK('Test prompt'))
        .rejects.toThrow('Browser authentication required');
    });

    test('should handle SDK timeout', async () => {
      (executor as any).isSDKAvailable = true;
      jest.spyOn(executor, 'checkBrowserAuthentication').mockResolvedValue(true);
      
      // Mock SDK that never resolves
      const neverEndingMessages = (async function* () {
        yield { type: 'stream', content: 'Starting...' };
        // Never finish
        await new Promise(() => {});
      })();
      
      mockSDK.query.mockReturnValue(neverEndingMessages);
      
      const options: SDKClaudeOptions = {
        timeout: 100 // Very short timeout
      };
      
      await expect(executor.executeWithSDK('Test prompt', options))
        .rejects.toThrow('timed out');
    }, 1000);

    test('should handle different message types from SDK', async () => {
      (executor as any).isSDKAvailable = true;
      jest.spyOn(executor, 'checkBrowserAuthentication').mockResolvedValue(true);
      
      const mockMessages = [
        { type: 'session', sessionId: 'test-session-123' },
        { type: 'tool_use', tool: 'bash' },
        { type: 'stream', content: 'Processing...' },
        { type: 'result', result: 'Final result' }
      ];
      
      mockSDK.query.mockReturnValue(mockMessages);
      
      const result = await executor.executeWithSDK('Test prompt', { verbose: true });
      
      expect(result.output).toContain('Processing...');
      expect(result.output).toContain('Final result');
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Tool used: bash'));
    });

    test('should handle SDK error messages', async () => {
      (executor as any).isSDKAvailable = true;
      jest.spyOn(executor, 'checkBrowserAuthentication').mockResolvedValue(true);
      
      const mockMessages = [
        { type: 'error', error: 'Authentication failed' }
      ];
      
      mockSDK.query.mockReturnValue(mockMessages);
      
      await expect(executor.executeWithSDK('Test prompt'))
        .rejects.toThrow('Authentication failed');
    });

    test('should respect session continuity', async () => {
      (executor as any).isSDKAvailable = true;
      jest.spyOn(executor, 'checkBrowserAuthentication').mockResolvedValue(true);
      
      const mockMessages = [
        { type: 'result', result: 'Session continued' }
      ];
      
      mockSDK.query.mockReturnValue(mockMessages);
      
      const options: SDKClaudeOptions = {
        sessionId: 'existing-session-123',
        enableSessionContinuity: true
      };
      
      await executor.executeWithSDK('Continue task', options);
      
      expect(mockSDK.query).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            continue: 'existing-session-123'
          })
        })
      );
    });

    test('should handle allowed tools configuration', async () => {
      (executor as any).isSDKAvailable = true;
      jest.spyOn(executor, 'checkBrowserAuthentication').mockResolvedValue(true);
      
      const mockMessages = [
        { type: 'result', result: 'Tools configured' }
      ];
      
      mockSDK.query.mockReturnValue(mockMessages);
      
      const options: SDKClaudeOptions = {
        allowedTools: 'bash,edit,read'
      };
      
      await executor.executeWithSDK('Use tools', options);
      
      expect(mockSDK.query).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            allowedTools: ['bash', 'edit', 'read']
          })
        })
      );
    });
  });

  describe('Session Management', () => {
    test('should track session history', () => {
      const sessionId = 'test-session';
      const history = executor.getSessionHistory(sessionId);
      
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBe(0); // Empty initially
    });

    test('should clear session data', () => {
      const sessionId = 'test-session';
      executor.clearSession(sessionId);
      
      expect(executor.isSessionActive(sessionId)).toBe(false);
      expect(executor.getSessionHistory(sessionId)).toEqual([]);
    });

    test('should list active sessions', () => {
      const sessionIds = executor.getActiveSessionIds();
      
      expect(Array.isArray(sessionIds)).toBe(true);
    });
  });

  describe('Autopilot Mode', () => {
    test('should execute autopilot with multiple iterations', async () => {
      (executor as any).isSDKAvailable = true;
      jest.spyOn(executor, 'checkBrowserAuthentication').mockResolvedValue(true);
      
      let callCount = 0;
      const mockMessages = () => {
        callCount++;
        if (callCount === 1) {
          return [{ type: 'result', result: 'Step 1 completed. Next step needed.' }];
        } else {
          return [{ type: 'result', result: 'Task completed successfully!' }];
        }
      };
      
      mockSDK.query.mockImplementation(mockMessages);
      
      // Mock task completion detection
      jest.spyOn(executor as any, 'isTaskComplete')
        .mockReturnValueOnce(false) // First iteration not complete
        .mockReturnValueOnce(true);  // Second iteration complete
      
      const result = await executor.executeAutopilot('Build a simple app', {
        maxIterations: 3,
        continueOnError: true
      });
      
      expect(result.success).toBe(true);
      expect(result.results.length).toBe(2);
      expect(callCount).toBe(2);
    });

    test('should handle autopilot errors gracefully', async () => {
      (executor as any).isSDKAvailable = true;
      jest.spyOn(executor, 'checkBrowserAuthentication').mockResolvedValue(true);
      
      mockSDK.query.mockImplementation(() => {
        throw new Error('SDK execution failed');
      });
      
      const result = await executor.executeAutopilot('Test task', {
        maxIterations: 2,
        continueOnError: true
      });
      
      expect(result.success).toBe(false);
      expect(result.results.length).toBe(0);
    });

    test('should stop autopilot on task completion', async () => {
      (executor as any).isSDKAvailable = true;
      jest.spyOn(executor, 'checkBrowserAuthentication').mockResolvedValue(true);
      
      const mockMessages = [{ type: 'result', result: 'Task completed successfully!' }];
      mockSDK.query.mockReturnValue(mockMessages);
      
      // Mock task completion detection
      jest.spyOn(executor as any, 'isTaskComplete').mockReturnValue(true);
      
      const result = await executor.executeAutopilot('Simple task', {
        maxIterations: 5
      });
      
      expect(result.success).toBe(true);
      expect(result.results.length).toBe(1); // Should stop after first iteration
    });
  });

  describe('Error Handling', () => {
    test('should throw appropriate error types', () => {
      expect(() => {
        throw new AuthenticationError('Auth failed');
      }).toThrow(AuthenticationError);
      
      expect(() => {
        throw new BrowserAuthRequiredError('Browser auth needed');
      }).toThrow(BrowserAuthRequiredError);
      
      expect(() => {
        throw new SDKNotInstalledError('SDK not found');
      }).toThrow(SDKNotInstalledError);
      
      expect(() => {
        throw new NetworkError('Network issue');
      }).toThrow(NetworkError);
      
      expect(() => {
        throw new APIKeyRequiredError('API key needed');
      }).toThrow(APIKeyRequiredError);
      
      expect(() => {
        throw new RetryExhaustedError('Max retries reached');
      }).toThrow(RetryExhaustedError);
    });
  });

  describe('Health and Diagnostics', () => {
    test('should report SDK status', async () => {
      jest.spyOn(executor, 'checkBrowserAuthentication').mockResolvedValue(true);
      
      const status = await executor.getSDKStatus();
      
      expect(status).toHaveProperty('sdkAvailable');
      expect(status).toHaveProperty('browserAuth');
      expect(status).toHaveProperty('circuitBreakerOpen');
      expect(status).toHaveProperty('executionStats');
      expect(status.executionStats).toHaveProperty('attempts');
      expect(status.executionStats).toHaveProperty('failures');
      expect(status.executionStats).toHaveProperty('successRate');
    });

    test('should reset statistics', () => {
      executor.resetStats();
      
      // Should not throw and should reset internal counters
      expect(() => executor.resetStats()).not.toThrow();
    });

    test('should refresh browser sessions', async () => {
      await expect(executor.refreshBrowserSession()).resolves.not.toThrow();
      expect(mockLogger.info).toHaveBeenCalledWith('Browser sessions refreshed successfully');
    });
  });

  describe('Backward Compatibility', () => {
    test('should provide PTY session compatibility methods', async () => {
      const session = await executor.getOrCreatePTYSession('test-session', 'echo hello');
      
      expect(session).toHaveProperty('sessionId');
      expect(session).toHaveProperty('type', 'sdk-session');
      expect(session).toHaveProperty('active', true);
    });

    test('should handle PTY send operations', async () => {
      (executor as any).isSDKAvailable = true;
      jest.spyOn(executor, 'checkBrowserAuthentication').mockResolvedValue(true);
      
      const mockMessages = [{ type: 'result', result: 'Command executed' }];
      mockSDK.query.mockReturnValue(mockMessages);
      
      const result = await executor.sendToPTYSession('test-session', 'ls -la');
      
      expect(result).toContain('Command executed');
    });

    test('should handle PTY session cleanup', async () => {
      await executor.closePTYSession('test-session');
      
      // Should complete without error
      expect(mockLogger.debug).toHaveBeenCalledWith('PTY close compatibility layer - clearing SDK session');
    });

    test('should list active PTY sessions', () => {
      const sessions = executor.getActivePTYSessions();
      
      expect(Array.isArray(sessions)).toBe(true);
    });

    test('should shutdown cleanly', async () => {
      await executor.shutdown();
      
      expect(mockLogger.debug).toHaveBeenCalledWith('SDK executor shutting down');
    });
  });
});
