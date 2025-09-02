/**
 * Integration tests for SDK backward compatibility
 * Validates that SDK components maintain compatibility with existing PTY-based code
 */

import { Logger } from '../../logger';
import { SDKClaudeExecutor } from '../../services/sdkClaudeExecutor';
import { SDKAutopilotEngine } from '../../core/SDKAutopilotEngine';
import { SimplifiedSessionManager } from '../../core/SimplifiedSessionManager';
import { TaskCompletionAnalyzer } from '../../core/TaskCompletionAnalyzer';
import { SessionManager } from '../../sessionManager';

// Mock external dependencies
jest.mock('../../logger');
jest.mock('../../sessionManager');
jest.mock('fs/promises');

describe('SDK Backward Compatibility', () => {
  let logger: jest.Mocked<Logger>;
  let sdkExecutor: SDKClaudeExecutor;
  let autopilotEngine: SDKAutopilotEngine;
  let sessionManager: SimplifiedSessionManager;
  let completionAnalyzer: TaskCompletionAnalyzer;

  beforeEach(() => {
    logger = new Logger() as jest.Mocked<Logger>;
    sdkExecutor = new SDKClaudeExecutor(logger);
    autopilotEngine = new SDKAutopilotEngine(logger);
    sessionManager = new SimplifiedSessionManager('.test-sessions', logger);
    completionAnalyzer = new TaskCompletionAnalyzer(logger);

    // Mock basic SDK availability
    jest.spyOn(sdkExecutor, 'isAvailable').mockReturnValue(true);
    jest.spyOn(sdkExecutor, 'checkBrowserAuthentication').mockResolvedValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('SDKClaudeExecutor PTY Compatibility', () => {
    test('should provide PTY session interface', async () => {
      const sessionId = 'pty-compat-session';
      
      // Test creating PTY session
      const session = await sdkExecutor.getOrCreatePTYSession(sessionId, 'echo hello');
      
      expect(session).toBeDefined();
      expect(session.sessionId).toBe(sessionId);
      expect(session.type).toBe('sdk-session');
      expect(session.active).toBe(true);
    });

    test('should handle PTY send operations through SDK', async () => {
      const sessionId = 'pty-send-session';
      
      // Mock SDK response
      jest.spyOn(sdkExecutor, 'executeWithSDK').mockResolvedValue({
        output: 'Hello from SDK',
        exitCode: 0,
        sessionId,
        messages: [],
        hasError: false,
        executionTime: 1000
      });

      const result = await sdkExecutor.sendToPTYSession(sessionId, 'echo hello');
      
      expect(result).toBe('Hello from SDK');
      expect(sdkExecutor.executeWithSDK).toHaveBeenCalledWith('echo hello', { sessionId });
    });

    test('should handle PTY session closure', async () => {
      const sessionId = 'pty-close-session';
      
      // Create session first
      await sdkExecutor.getOrCreatePTYSession(sessionId);
      
      // Close session
      await sdkExecutor.closePTYSession(sessionId);
      
      // Session should no longer be active
      expect(sdkExecutor.isSessionActive(sessionId)).toBe(false);
    });

    test('should list active PTY sessions', () => {
      const sessions = sdkExecutor.getActivePTYSessions();
      
      expect(Array.isArray(sessions)).toBe(true);
    });

    test('should shutdown gracefully', async () => {
      await sdkExecutor.shutdown();
      
      expect(logger.debug).toHaveBeenCalledWith('SDK executor shutting down');
    });
  });

  describe('Session Format Compatibility', () => {
    test('should maintain session data structure compatibility', async () => {
      const sessionId = await sessionManager.createSession(
        'Compatibility test task',
        '/test/workspace',
        'sdk'
      );

      // Add iteration in old format
      await sessionManager.addIteration({
        iteration: 1,
        prompt: 'Test prompt',
        output: {
          result: 'Test result',
          error: null,
          files: ['src/test.ts'],
          commands: ['npm test'],
          totalCost: 0.002
        },
        exitCode: 0,
        duration: 3000,
        // SDK-specific fields should work alongside old ones
        sdkSessionId: 'sdk-session-123',
        authMethod: 'browser'
      });

      const summary = await sessionManager.getSummary();
      
      // Should maintain old summary structure
      expect(summary).toHaveProperty('totalIterations', 1);
      expect(summary).toHaveProperty('totalDuration', 3000);
      expect(summary).toHaveProperty('successRate', 100);
      expect(summary).toHaveProperty('totalCost', 0.002);
      expect(summary).toHaveProperty('filesModified');
      expect(summary).toHaveProperty('commandsExecuted');
      
      expect(summary.filesModified).toContain('src/test.ts');
      expect(summary.commandsExecuted).toContain('npm test');
    });

    test('should generate compatible session reports', async () => {
      // Mock session data
      const mockFs = require('fs/promises');
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        id: 'compat-session',
        startTime: new Date().toISOString(),
        initialPrompt: 'Compatibility test',
        workDir: '/test/workspace',
        status: 'completed',
        executionMode: 'sdk',
        iterations: [
          {
            iteration: 1,
            prompt: 'Test step',
            output: {
              result: 'Step completed',
              error: null,
              files: ['output.txt'],
              commands: ['touch output.txt']
            },
            exitCode: 0,
            duration: 2000,
            timestamp: new Date().toISOString(),
            executionMode: 'sdk'
          }
        ]
      }));

      const report = await sessionManager.getSessionReport('compat-session');
      
      // Should contain all expected sections from old format
      expect(report).toContain('# Session Report:');
      expect(report).toContain('**Status:**');
      expect(report).toContain('**Execution Mode:**');
      expect(report).toContain('## Summary');
      expect(report).toContain('## Files Modified');
      expect(report).toContain('## Commands Executed');
      expect(report).toContain('## Iteration Details');
    });
  });

  describe('Autopilot Interface Compatibility', () => {
    test('should provide execute method for backward compatibility', async () => {
      // Mock SDK execution
      jest.spyOn(sdkExecutor, 'executeWithSDK').mockResolvedValue({
        output: 'Task completed via compatibility layer',
        exitCode: 0,
        sessionId: 'compat-session',
        messages: [],
        hasError: false,
        executionTime: 2000
      });

      // Replace internal executor with mock
      (autopilotEngine as any).sdkExecutor = sdkExecutor;

      const result = await autopilotEngine.execute('Compatible task', {
        maxIterations: 3,
        verbose: true
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Task completed via compatibility layer');
      expect(result.coordinationType).toBe('SINGLE_AGENT');
    });

    test('should maintain AutopilotResult interface', async () => {
      jest.spyOn(sdkExecutor, 'executeWithSDK').mockResolvedValue({
        output: 'Interface compatibility test',
        exitCode: 0,
        sessionId: 'interface-session',
        messages: [],
        hasError: false,
        executionTime: 1500
      });

      (autopilotEngine as any).sdkExecutor = sdkExecutor;

      const result = await autopilotEngine.execute('Interface test');

      // Verify all required AutopilotResult properties exist
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('iterations');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('totalDuration');
      expect(result).toHaveProperty('output');
      expect(result).toHaveProperty('sessionId');
      expect(result).toHaveProperty('coordinationType');
      expect(result).toHaveProperty('executionMethod');
      expect(result).toHaveProperty('successRate');
      expect(result).toHaveProperty('modelUsed');
      expect(result).toHaveProperty('totalTokens');
      expect(result).toHaveProperty('toolsInvoked');
      expect(result).toHaveProperty('qualityScore');
    });
  });

  describe('Task Completion Analysis Compatibility', () => {
    test('should work with both old and new response formats', async () => {
      // Test with old-style result
      const oldStyleResult = {
        output: 'Task completed successfully! All tests passing.',
        exitCode: 0,
        sessionId: 'old-style-session',
        messages: [],
        hasError: false,
        executionTime: 3000
      };

      const oldAnalysis = await completionAnalyzer.analyzeCompletion(oldStyleResult, {
        originalRequest: 'Test task',
        currentWorkDir: '/test/workspace',
        sessionId: 'old-style-session',
        executionHistory: [],
        preferences: {
          preferredModel: 'sonnet',
          maxIterations: 10,
          timeoutMs: 120000,
          verboseLogging: false,
          continuationThreshold: 0.7,
          enableDualAgent: false
        }
      });

      expect(oldAnalysis.isComplete).toBe(true);
      expect(oldAnalysis.confidence).toBeGreaterThan(0.7);
      expect(oldAnalysis.continuationNeeded).toBe(false);

      // Test with new SDK-style result
      const newStyleResult = {
        output: 'Implementation in progress. Next step: add validation.',
        exitCode: 0,
        sessionId: 'new-style-session',
        messages: [
          { type: 'tool_use', tool: 'edit', timestamp: new Date() },
          { type: 'result', content: 'File modified', timestamp: new Date() }
        ],
        hasError: false,
        executionTime: 4000
      };

      const newAnalysis = await completionAnalyzer.analyzeCompletion(newStyleResult, {
        originalRequest: 'Test task',
        currentWorkDir: '/test/workspace',
        sessionId: 'new-style-session',
        executionHistory: [],
        preferences: {
          preferredModel: 'sonnet',
          maxIterations: 10,
          timeoutMs: 120000,
          verboseLogging: false,
          continuationThreshold: 0.7,
          enableDualAgent: false
        }
      });

      expect(newAnalysis.isComplete).toBe(false);
      expect(newAnalysis.continuationNeeded).toBe(true);
    });

    test('should maintain shouldContinue interface', () => {
      const mockAnalysis = {
        isComplete: false,
        confidence: 0.6,
        continuationNeeded: true,
        detectedPatterns: [],
        qualityScore: 0.7
      };

      const mockContext = {
        sessionId: 'test-session',
        taskDescription: 'Test task',
        currentIteration: 3,
        maxIterations: 10,
        workDir: '/test/workspace',
        startTime: new Date(),
        lastExecutionTime: new Date(),
        totalExecutionTime: 15000,
        model: 'sonnet' as const,
        verbose: false,
        isFirstIteration: false
      };

      const shouldContinue = completionAnalyzer.shouldContinue(mockAnalysis, mockContext);
      
      expect(typeof shouldContinue).toBe('boolean');
    });
  });

  describe('Error Handling Compatibility', () => {
    test('should maintain error type compatibility', () => {
      const { 
        AuthenticationError,
        BrowserAuthRequiredError,
        SDKNotInstalledError,
        NetworkError,
        APIKeyRequiredError,
        RetryExhaustedError
      } = require('../../services/sdkClaudeExecutor');

      // Test that error types can be instantiated and have correct names
      const authError = new AuthenticationError('Auth failed');
      expect(authError.name).toBe('AuthenticationError');
      expect(authError.message).toBe('Auth failed');

      const browserError = new BrowserAuthRequiredError('Browser needed');
      expect(browserError.name).toBe('BrowserAuthRequiredError');

      const sdkError = new SDKNotInstalledError('SDK missing');
      expect(sdkError.name).toBe('SDKNotInstalledError');

      const networkError = new NetworkError('Network issue');
      expect(networkError.name).toBe('NetworkError');

      const apiKeyError = new APIKeyRequiredError('Key needed');
      expect(apiKeyError.name).toBe('APIKeyRequiredError');

      const retryError = new RetryExhaustedError('Max retries');
      expect(retryError.name).toBe('RetryExhaustedError');
    });

    test('should handle errors gracefully in compatibility mode', async () => {
      // Mock SDK failure
      jest.spyOn(sdkExecutor, 'executeWithSDK').mockRejectedValue(
        new Error('SDK execution failed')
      );

      (autopilotEngine as any).sdkExecutor = sdkExecutor;

      const result = await autopilotEngine.execute('Failing task');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.coordinationType).toBe('SINGLE_AGENT');
    });
  });

  describe('Configuration Compatibility', () => {
    test('should accept old configuration formats', async () => {
      // Old-style options
      const oldOptions = {
        workDir: '/old/workspace',
        maxIterations: 5,
        verbose: true,
        timeout: 60000,
        continueOnError: false,
        allowedTools: 'bash,edit,read',
        model: 'sonnet' as const
      };

      // Should not throw when using old option structure
      expect(() => {
        return autopilotEngine.execute('Old options test', oldOptions);
      }).not.toThrow();
    });

    test('should handle mixed old and new options', async () => {
      const mixedOptions = {
        // Old options
        workDir: '/mixed/workspace',
        maxIterations: 3,
        verbose: true,
        
        // New SDK options
        dualAgent: false,
        enableHooks: true,
        enableMonitoring: true,
        managerModel: 'opus' as const,
        workerModel: 'sonnet' as const
      };

      jest.spyOn(sdkExecutor, 'executeWithSDK').mockResolvedValue({
        output: 'Mixed options test completed',
        exitCode: 0,
        sessionId: 'mixed-session',
        messages: [],
        hasError: false,
        executionTime: 2000
      });

      (autopilotEngine as any).sdkExecutor = sdkExecutor;

      const result = await autopilotEngine.execute('Mixed options test', mixedOptions);
      
      expect(result.success).toBe(true);
      expect(result.coordinationType).toBe('SINGLE_AGENT');
    });
  });

  describe('Legacy Method Signatures', () => {
    test('should maintain SessionManager compatibility', async () => {
      // Test that SimplifiedSessionManager can be used as SessionManager
      const legacySessionManager: any = sessionManager;
      
      // Should have methods that legacy code expects
      expect(typeof legacySessionManager.createSession).toBe('function');
      expect(typeof legacySessionManager.addIteration).toBe('function');
      expect(typeof legacySessionManager.completeSession).toBe('function');
      expect(typeof legacySessionManager.getSummary).toBe('function');
      expect(typeof legacySessionManager.loadSession).toBe('function');
      expect(typeof legacySessionManager.listSessions).toBe('function');
    });

    test('should maintain executor interface compatibility', () => {
      // Test that SDKClaudeExecutor maintains expected interface
      expect(typeof sdkExecutor.isAvailable).toBe('function');
      expect(typeof sdkExecutor.executeWithSDK).toBe('function');
      expect(typeof sdkExecutor.getSessionHistory).toBe('function');
      expect(typeof sdkExecutor.clearSession).toBe('function');
      expect(typeof sdkExecutor.shutdown).toBe('function');
      
      // PTY compatibility methods
      expect(typeof sdkExecutor.getOrCreatePTYSession).toBe('function');
      expect(typeof sdkExecutor.sendToPTYSession).toBe('function');
      expect(typeof sdkExecutor.closePTYSession).toBe('function');
      expect(typeof sdkExecutor.getActivePTYSessions).toBe('function');
    });
  });

  describe('Type Alias Compatibility', () => {
    test('should maintain type alias exports', () => {
      const { SDKExecutionOptions } = require('../../services/sdkClaudeExecutor');
      
      // SDKExecutionOptions should be an alias for SDKClaudeOptions
      // This is verified by TypeScript at compile time, but we can test it exists
      expect(SDKExecutionOptions).toBeDefined();
    });
  });
});
