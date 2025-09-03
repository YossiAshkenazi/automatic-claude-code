/**
 * Unit tests for SDKAutopilotEngine
 * Tests SDK-based autopilot execution and dual-agent coordination
 */

import { EventEmitter } from 'events';
import { Logger } from '@/logger';
import { SDKAutopilotEngine, AutopilotOptions, AutopilotResult } from '@/core/SDKAutopilotEngine';
import { SDKClaudeExecutor } from '@/services/sdkClaudeExecutor';
import { TaskCompletionAnalyzer } from '@/core/TaskCompletionAnalyzer';
import { SessionManager } from '@/sessionManager';
import { SDKDualAgentCoordinator } from '@/agents/SDKDualAgentCoordinator';

// Mock dependencies
jest.mock('@/logger');
jest.mock('@/services/sdkClaudeExecutor');
jest.mock('@/core/TaskCompletionAnalyzer');
jest.mock('@/sessionManager');
jest.mock('@/agents/SDKDualAgentCoordinator');

describe('SDKAutopilotEngine', () => {
  let engine: SDKAutopilotEngine;
  let mockLogger: jest.Mocked<Logger>;
  let mockSDKExecutor: jest.Mocked<SDKClaudeExecutor>;
  let mockCompletionAnalyzer: jest.Mocked<TaskCompletionAnalyzer>;
  let mockSessionManager: jest.Mocked<SessionManager>;
  let mockDualAgentCoordinator: jest.Mocked<SDKDualAgentCoordinator>;

  beforeEach(() => {
    // Create mocked instances
    mockLogger = new Logger() as jest.Mocked<Logger>;
    mockSDKExecutor = new SDKClaudeExecutor(mockLogger) as jest.Mocked<SDKClaudeExecutor>;
    mockCompletionAnalyzer = new TaskCompletionAnalyzer(mockLogger) as jest.Mocked<TaskCompletionAnalyzer>;
    mockSessionManager = new SessionManager() as jest.Mocked<SessionManager>;
    mockDualAgentCoordinator = new SDKDualAgentCoordinator({} as any) as jest.Mocked<SDKDualAgentCoordinator>;

    // Setup default mock behaviors
    mockSDKExecutor.isAvailable.mockReturnValue(true);
    mockSessionManager.createSession.mockResolvedValue('test-session-123');
    mockCompletionAnalyzer.analyzeCompletion.mockResolvedValue({
      isComplete: true,
      confidence: 0.8,
      continuationNeeded: false,
      detectedPatterns: [],
      qualityScore: 0.7
    });
    mockCompletionAnalyzer.shouldContinue.mockReturnValue(false);

    engine = new SDKAutopilotEngine(mockLogger);
    
    // Replace internal dependencies with mocks
    (engine as any).sdkExecutor = mockSDKExecutor;
    (engine as any).completionAnalyzer = mockCompletionAnalyzer;
    (engine as any).sessionManager = mockSessionManager;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    test('should initialize with logger', () => {
      expect(engine).toBeInstanceOf(SDKAutopilotEngine);
      expect(engine).toBeInstanceOf(EventEmitter);
      expect(mockLogger.info).toHaveBeenCalledWith('SDKAutopilotEngine initialized');
    });

    test('should initialize without logger (use default)', () => {
      const engineWithoutLogger = new SDKAutopilotEngine();
      expect(engineWithoutLogger).toBeInstanceOf(SDKAutopilotEngine);
    });
  });

  describe('runAutopilotLoop', () => {
    test('should run single-agent autopilot successfully', async () => {
      mockSDKExecutor.executeWithSDK.mockResolvedValue({
        output: 'Task completed successfully!',
        exitCode: 0,
        sessionId: 'test-session',
        messages: [],
        hasError: false,
        executionTime: 5000
      });

      const options: AutopilotOptions = {
        maxIterations: 3,
        verbose: true,
        model: 'sonnet'
      };

      const result = await engine.runAutopilotLoop('Implement authentication', options);

      expect(result.success).toBe(true);
      expect(result.coordinationType).toBe('SINGLE_AGENT');
      expect(result.iterations).toBe(1);
      expect(result.sessionId).toBe('test-session-123');
      expect(mockSDKExecutor.executeWithSDK).toHaveBeenCalled();
    });

    test('should run dual-agent autopilot successfully', async () => {
      const options: AutopilotOptions = {
        dualAgent: true,
        maxIterations: 5,
        managerModel: 'opus',
        workerModel: 'sonnet'
      };

      // Mock dual agent coordinator
      mockDualAgentCoordinator.startCoordination.mockResolvedValue(undefined);
      mockDualAgentCoordinator.getHandoffMetrics.mockReturnValue({
        totalHandoffs: 3,
        averageHandoffTime: 2000,
        handoffSuccessRate: 100,
        lastHandoffTime: new Date()
      });
      mockDualAgentCoordinator.getWorkflowState.mockReturnValue({
        currentPhase: 'completion',
        activeAgent: 'manager',
        completedWorkItems: 2,
        pendingWorkItems: 0,
        totalWorkItems: 2,
        qualityMetrics: {
          averageScore: 0.85,
          lastScore: 0.9,
          scoreTrend: 'improving'
        },
        coordinationHealth: {
          communicationLatency: 500,
          handoffSuccess: true,
          lastCoordinationTime: new Date()
        }
      });

      const result = await engine.runAutopilotLoop('Build microservice', options);

      expect(result.success).toBe(true);
      expect(result.coordinationType).toBe('DUAL_AGENT_SDK');
      expect(result.dualAgentMetrics).toBeDefined();
      expect(result.dualAgentMetrics?.handoffCount).toBe(3);
    });

    test('should handle SDK unavailable error', async () => {
      mockSDKExecutor.isAvailable.mockReturnValue(false);

      const result = await engine.runAutopilotLoop('Test task');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Claude Code SDK is not available');
    });

    test('should handle execution errors gracefully', async () => {
      mockSDKExecutor.executeWithSDK.mockRejectedValue(new Error('Execution failed'));

      const result = await engine.runAutopilotLoop('Failing task');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Execution failed');
      expect(result.coordinationType).toBe('SINGLE_AGENT');
    });

    test('should respect maxIterations limit', async () => {
      // Mock multiple iterations needed
      mockCompletionAnalyzer.shouldContinue.mockReturnValue(true);
      mockSDKExecutor.executeWithSDK.mockResolvedValue({
        output: 'Step completed, continue...',
        exitCode: 0,
        sessionId: 'test-session',
        messages: [],
        hasError: false,
        executionTime: 2000
      });

      const options: AutopilotOptions = {
        maxIterations: 2
      };

      const result = await engine.runAutopilotLoop('Long task', options);

      expect(result.iterations).toBe(2);
      expect(mockSDKExecutor.executeWithSDK).toHaveBeenCalledTimes(2);
    });

    test('should handle continueOnError option', async () => {
      let callCount = 0;
      mockSDKExecutor.executeWithSDK.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('First attempt failed'));
        }
        return Promise.resolve({
          output: 'Recovered successfully',
          exitCode: 0,
          sessionId: 'test-session',
          messages: [],
          hasError: false,
          executionTime: 3000
        });
      });

      mockCompletionAnalyzer.shouldContinue
        .mockReturnValueOnce(true)  // Continue after error
        .mockReturnValueOnce(false); // Stop after recovery

      const options: AutopilotOptions = {
        continueOnError: true,
        maxIterations: 3
      };

      const result = await engine.runAutopilotLoop('Error-prone task', options);

      expect(result.success).toBe(true);
      expect(result.iterations).toBe(2);
      expect(result.output).toContain('Recovered successfully');
    });
  });

  describe('executeTask', () => {
    test('should execute single task successfully', async () => {
      mockSDKExecutor.executeWithSDK.mockResolvedValue({
        output: 'Single task completed',
        exitCode: 0,
        sessionId: 'task-session',
        messages: [],
        hasError: false,
        executionTime: 1500
      });

      const result = await engine.executeTask('Create component', {
        model: 'sonnet',
        timeout: 30000
      });

      expect(result.result).toBe('Single task completed');
      expect(result.exitCode).toBe(0);
      expect(result.error).toBeUndefined();
    });

    test('should handle task execution errors', async () => {
      mockSDKExecutor.executeWithSDK.mockRejectedValue(new Error('Task failed'));

      const result = await engine.executeTask('Failing task');

      expect(result.result).toBe('');
      expect(result.exitCode).toBe(1);
      expect(result.error).toBe('Task failed');
    });
  });

  describe('State Management', () => {
    test('should track running state correctly', async () => {
      expect(engine.isActive()).toBe(false);

      const executionPromise = engine.runAutopilotLoop('Test task');
      
      // Give it a moment to start
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await executionPromise;
      
      expect(engine.isActive()).toBe(false); // Should be false after completion
    });

    test('should provide current session information', () => {
      const sessionInfo = engine.getCurrentSession();
      
      expect(sessionInfo).toHaveProperty('sessionId');
      expect(sessionInfo).toHaveProperty('isRunning');
      expect(sessionInfo.isRunning).toBe(false);
    });

    test('should stop execution when requested', async () => {
      // Start a long-running task
      mockCompletionAnalyzer.shouldContinue.mockReturnValue(true);
      mockSDKExecutor.executeWithSDK.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
          output: 'Processing...',
          exitCode: 0,
          sessionId: 'test-session',
          messages: [],
          hasError: false,
          executionTime: 100
        };
      });

      const executionPromise = engine.runAutopilotLoop('Long task', { maxIterations: 10 });
      
      // Stop after a brief moment
      setTimeout(() => engine.stop(), 50);
      
      const result = await executionPromise;
      
      expect(result).toBeDefined();
      expect(engine.isActive()).toBe(false);
    });
  });

  describe('Health Metrics', () => {
    test('should provide health metrics', async () => {
      const metrics = await engine.getHealthMetrics();
      
      expect(metrics).toHaveProperty('isRunning');
      expect(metrics).toHaveProperty('sessionId');
      expect(metrics).toHaveProperty('lastActivity');
      expect(metrics).toHaveProperty('status');
      expect(metrics).toHaveProperty('browserHealth');
      expect(metrics).toHaveProperty('sdkHealth');
      expect(metrics).toHaveProperty('preferredMethod', 'SDK');
      
      expect(metrics.sdkHealth).toHaveProperty('available');
      expect(metrics.sdkHealth).toHaveProperty('status');
    });
  });

  describe('Dual Agent Quality Validation', () => {
    test('should validate dual-agent quality when coordinator exists', () => {
      // Set up mock dual agent coordinator
      (engine as any).dualAgentCoordinator = mockDualAgentCoordinator;
      
      mockDualAgentCoordinator.validateSDKHandoffExecution.mockReturnValue({
        coordinationType: 'SDK_BASED',
        handoffsTriggered: true,
        workerExecutions: true,
        managerReviews: true,
        communicationFlow: true,
        issues: []
      });
      
      mockDualAgentCoordinator.getHandoffMetrics.mockReturnValue({
        totalHandoffs: 5,
        lastHandoffTime: new Date(),
        handoffRate: 2.5
      });
      
      mockDualAgentCoordinator.getWorkflowState.mockReturnValue({
        currentPhase: 'completion',
        activeAgent: 'worker',
        completedWorkItems: 3,
        pendingWorkItems: 0,
        totalWorkItems: 3,
        qualityMetrics: {
          averageScore: 0.88,
          gatesPassed: 15,
          gatesFailed: 2,
          criticalIssues: 0
        },
        coordinationHealth: {
          communicationLatency: 300,
          handoffSuccess: true,
          lastCoordinationTime: new Date()
        }
      });
      
      const validation = engine.validateDualAgentQuality();
      
      expect(validation.sdkCoordinationWorking).toBe(true);
      expect(validation.handoffQuality).toBeGreaterThan(0.5);
      expect(validation.communicationEfficiency).toBeGreaterThan(0.5);
      expect(validation.overallQuality).toBeGreaterThan(0.5);
      expect(validation.issues).toEqual([]);
    });

    test('should handle missing dual-agent coordinator', () => {
      (engine as any).dualAgentCoordinator = undefined;
      
      const validation = engine.validateDualAgentQuality();
      
      expect(validation.sdkCoordinationWorking).toBe(false);
      expect(validation.handoffQuality).toBe(0);
      expect(validation.communicationEfficiency).toBe(0);
      expect(validation.overallQuality).toBe(0);
      expect(validation.issues).toContain('Dual-agent coordinator not initialized');
    });
  });

  describe('Event Emission', () => {
    test('should emit iteration_complete events', async () => {
      const eventSpy = jest.fn();
      engine.on('iteration_complete', eventSpy);
      
      mockSDKExecutor.executeWithSDK.mockResolvedValue({
        output: 'Iteration completed',
        exitCode: 0,
        sessionId: 'test-session',
        messages: [],
        hasError: false,
        executionTime: 2000
      });

      await engine.runAutopilotLoop('Test task');

      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        iteration: 1,
        output: 'Iteration completed',
        shouldContinue: false
      }));
    });
  });

  describe('Prompt Building', () => {
    test('should build appropriate prompts for iterations', async () => {
      mockCompletionAnalyzer.shouldContinue
        .mockReturnValueOnce(true)   // Continue after first iteration
        .mockReturnValueOnce(false); // Stop after second iteration
      
      mockSDKExecutor.executeWithSDK.mockResolvedValue({
        output: 'Step completed',
        exitCode: 0,
        sessionId: 'test-session',
        messages: [],
        hasError: false,
        executionTime: 1000
      });

      await engine.runAutopilotLoop('Build feature', { maxIterations: 3 });

      expect(mockSDKExecutor.executeWithSDK).toHaveBeenCalledTimes(2);
      
      // First call should have the original prompt
      expect(mockSDKExecutor.executeWithSDK).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('Build feature'),
        expect.any(Object)
      );
      
      // Second call should have continuation prompt with previous output
      expect(mockSDKExecutor.executeWithSDK).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('Continuing work on this task'),
        expect.any(Object)
      );
    });
  });

  describe('Cleanup and Shutdown', () => {
    test('should cleanup resources on completion', async () => {
      mockSessionManager.saveSession.mockResolvedValue(undefined);
      
      await engine.runAutopilotLoop('Test task');
      
      expect(mockSessionManager.saveSession).toHaveBeenCalled();
    });

    test('should shutdown dual-agent coordinator when stopping', async () => {
      (engine as any).dualAgentCoordinator = mockDualAgentCoordinator;
      mockDualAgentCoordinator.shutdown.mockResolvedValue(undefined);
      
      await engine.stop();
      
      expect(mockDualAgentCoordinator.shutdown).toHaveBeenCalled();
    });
  });

  describe('Compatibility', () => {
    test('should provide execute method for backward compatibility', async () => {
      mockSDKExecutor.executeWithSDK.mockResolvedValue({
        output: 'Compatible execution',
        exitCode: 0,
        sessionId: 'compat-session',
        messages: [],
        hasError: false,
        executionTime: 1500
      });

      const result = await engine.execute('Compatible task');

      expect(result.success).toBe(true);
      expect(result.output).toContain('Compatible execution');
      expect(result.coordinationType).toBe('SINGLE_AGENT');
    });
  });
});
