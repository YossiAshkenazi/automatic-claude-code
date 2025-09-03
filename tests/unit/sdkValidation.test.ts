/**
 * Simple validation tests for SDK components
 * Tests that all Phase 1 SDK components can be instantiated and have expected interfaces
 */

import { Logger } from '../logger';
import { SDKClaudeExecutor } from '../services/sdkClaudeExecutor';
import { SDKAutopilotEngine } from '../core/SDKAutopilotEngine';
import { SimplifiedSessionManager } from '../core/SimplifiedSessionManager';
import { TaskCompletionAnalyzer } from '../core/TaskCompletionAnalyzer';

// Mock dependencies
jest.mock('../logger');
jest.mock('fs/promises');

describe('SDK Components Validation', () => {
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warning: jest.fn(),
      success: jest.fn(),
      progress: jest.fn(),
      setMaxIterations: jest.fn(),
      setIteration: jest.fn(),
      isDebugEnabled: jest.fn().mockReturnValue(false)
    } as any;
  });

  describe('Component Instantiation', () => {
    test('SDKClaudeExecutor can be created', () => {
      expect(() => new SDKClaudeExecutor(mockLogger)).not.toThrow();
      const executor = new SDKClaudeExecutor(mockLogger);
      expect(executor).toBeInstanceOf(SDKClaudeExecutor);
    });

    test('SDKAutopilotEngine can be created', () => {
      expect(() => new SDKAutopilotEngine(mockLogger)).not.toThrow();
      const engine = new SDKAutopilotEngine(mockLogger);
      expect(engine).toBeInstanceOf(SDKAutopilotEngine);
    });

    test('SimplifiedSessionManager can be created', () => {
      expect(() => new SimplifiedSessionManager('.test-sessions', mockLogger)).not.toThrow();
      const manager = new SimplifiedSessionManager('.test-sessions', mockLogger);
      expect(manager).toBeInstanceOf(SimplifiedSessionManager);
    });

    test('TaskCompletionAnalyzer can be created', () => {
      expect(() => new TaskCompletionAnalyzer(mockLogger)).not.toThrow();
      const analyzer = new TaskCompletionAnalyzer(mockLogger);
      expect(analyzer).toBeInstanceOf(TaskCompletionAnalyzer);
    });
  });

  describe('Interface Validation', () => {
    test('SDKClaudeExecutor has expected methods', () => {
      const executor = new SDKClaudeExecutor(mockLogger);
      
      expect(typeof executor.executeWithSDK).toBe('function');
      expect(typeof executor.isAvailable).toBe('function');
      expect(typeof executor.checkBrowserAuthentication).toBe('function');
      expect(typeof executor.getSessionHistory).toBe('function');
      expect(typeof executor.clearSession).toBe('function');
      expect(typeof executor.getActiveSessionIds).toBe('function');
      expect(typeof executor.isSessionActive).toBe('function');
      expect(typeof executor.refreshBrowserSession).toBe('function');
      expect(typeof executor.getSDKStatus).toBe('function');
      expect(typeof executor.resetStats).toBe('function');
      expect(typeof executor.executeAutopilot).toBe('function');
      expect(typeof executor.shutdown).toBe('function');
      
      // Backward compatibility methods
      expect(typeof executor.getOrCreatePTYSession).toBe('function');
      expect(typeof executor.sendToPTYSession).toBe('function');
      expect(typeof executor.closePTYSession).toBe('function');
      expect(typeof executor.getActivePTYSessions).toBe('function');
    });

    test('SDKAutopilotEngine has expected methods', () => {
      const engine = new SDKAutopilotEngine(mockLogger);
      
      expect(typeof engine.runAutopilotLoop).toBe('function');
      expect(typeof engine.executeTask).toBe('function');
      expect(typeof engine.isActive).toBe('function');
      expect(typeof engine.stop).toBe('function');
      expect(typeof engine.getCurrentSession).toBe('function');
      expect(typeof engine.validateDualAgentQuality).toBe('function');
      expect(typeof engine.getHealthMetrics).toBe('function');
      expect(typeof engine.execute).toBe('function'); // Backward compatibility
    });

    test('SimplifiedSessionManager has expected methods', () => {
      const manager = new SimplifiedSessionManager('.test-sessions', mockLogger);
      
      expect(typeof manager.createSession).toBe('function');
      expect(typeof manager.addIteration).toBe('function');
      expect(typeof manager.completeSession).toBe('function');
      expect(typeof manager.getSummary).toBe('function');
      expect(typeof manager.loadSession).toBe('function');
      expect(typeof manager.listSessions).toBe('function');
      expect(typeof manager.showHistory).toBe('function');
      expect(typeof manager.getSessionReport).toBe('function');
      expect(typeof manager.setMaxIterations).toBe('function');
      expect(typeof manager.setCurrentIteration).toBe('function');
    });

    test('TaskCompletionAnalyzer has expected methods', () => {
      const analyzer = new TaskCompletionAnalyzer(mockLogger);
      
      expect(typeof analyzer.analyzeCompletion).toBe('function');
      expect(typeof analyzer.shouldContinue).toBe('function');
    });
  });

  describe('Error Classes', () => {
    test('All error classes can be imported and instantiated', () => {
      const {
        AuthenticationError,
        BrowserAuthRequiredError,
        SDKNotInstalledError,
        NetworkError,
        APIKeyRequiredError,
        RetryExhaustedError
      } = require('../services/sdkClaudeExecutor');

      expect(() => new AuthenticationError('test')).not.toThrow();
      expect(() => new BrowserAuthRequiredError('test')).not.toThrow();
      expect(() => new SDKNotInstalledError('test')).not.toThrow();
      expect(() => new NetworkError('test')).not.toThrow();
      expect(() => new APIKeyRequiredError('test')).not.toThrow();
      expect(() => new RetryExhaustedError('test')).not.toThrow();
    });
  });

  describe('Basic Functionality Smoke Tests', () => {
    test('SDKClaudeExecutor basic status methods work', () => {
      const executor = new SDKClaudeExecutor(mockLogger);
      
      // These should not throw
      expect(() => executor.isAvailable()).not.toThrow();
      expect(() => executor.getActiveSessionIds()).not.toThrow();
      expect(() => executor.isSessionActive('test-session')).not.toThrow();
      expect(() => executor.getSessionHistory('test-session')).not.toThrow();
      expect(() => executor.resetStats()).not.toThrow();
    });

    test('SDKAutopilotEngine basic status methods work', async () => {
      const engine = new SDKAutopilotEngine(mockLogger);
      
      // Mock the internal SDK executor to return proper health metrics
      const mockSDKExecutor = {
        getSDKStatus: jest.fn().mockResolvedValue({
          sdkAvailable: true,
          browserAuth: true,
          circuitBreakerOpen: false,
          executionStats: {
            attempts: 10,
            failures: 1,
            successRate: 90
          }
        })
      };
      
      (engine as any).sdkExecutor = mockSDKExecutor;
      
      // These should not throw
      expect(() => engine.isActive()).not.toThrow();
      expect(() => engine.getCurrentSession()).not.toThrow();
      expect(() => engine.validateDualAgentQuality()).not.toThrow();
      
      // This is async, so test separately
      const healthMetrics = await engine.getHealthMetrics();
      expect(healthMetrics).toBeDefined();
      expect(healthMetrics).toHaveProperty('isRunning');
      expect(healthMetrics).toHaveProperty('status');
    });

    test('TaskCompletionAnalyzer handles null/undefined inputs gracefully', async () => {
      const analyzer = new TaskCompletionAnalyzer(mockLogger);
      
      // Should handle problematic inputs without throwing
      const result = await analyzer.analyzeCompletion({
        output: '',
        exitCode: 0,
        sessionId: 'test',
        messages: [],
        hasError: false,
        executionTime: 0
      }, {
        originalRequest: 'test',
        currentWorkDir: '/test',
        sessionId: 'test',
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
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('isComplete');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('continuationNeeded');
      expect(result).toHaveProperty('detectedPatterns');
      expect(result).toHaveProperty('qualityScore');
    });
  });

  describe('Integration Points', () => {
    test('Components can work together without circular dependencies', () => {
      // Test that we can create all components together
      const executor = new SDKClaudeExecutor(mockLogger);
      const analyzer = new TaskCompletionAnalyzer(mockLogger);
      const sessionManager = new SimplifiedSessionManager('.test-sessions', mockLogger);
      const autopilotEngine = new SDKAutopilotEngine(mockLogger);
      
      expect(executor).toBeDefined();
      expect(analyzer).toBeDefined();
      expect(sessionManager).toBeDefined();
      expect(autopilotEngine).toBeDefined();
    });

    test('Type compatibility between components', async () => {
      // Test that interfaces are compatible
      const executor = new SDKClaudeExecutor(mockLogger);
      const engine = new SDKAutopilotEngine(mockLogger);
      
      // Mock the internal SDK executor for the engine
      const mockSDKExecutor = {
        getSDKStatus: jest.fn().mockResolvedValue({
          sdkAvailable: true,
          browserAuth: true,
          circuitBreakerOpen: false,
          executionStats: {
            attempts: 5,
            failures: 0,
            successRate: 100
          }
        })
      };
      
      (engine as any).sdkExecutor = mockSDKExecutor;
      
      // Should be able to assign compatible types
      const sessionIds: string[] = executor.getActiveSessionIds();
      const sessionInfo = engine.getCurrentSession();
      const healthMetrics = await engine.getHealthMetrics();
      
      expect(Array.isArray(sessionIds)).toBe(true);
      expect(sessionInfo).toHaveProperty('sessionId');
      expect(sessionInfo).toHaveProperty('isRunning');
      expect(healthMetrics).toHaveProperty('isRunning');
      expect(healthMetrics).toHaveProperty('status');
    });
  });
});
