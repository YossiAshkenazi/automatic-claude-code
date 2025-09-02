/**
 * Integration tests for SDK-based autopilot functionality
 * Tests for Story 1.2: SDK-Based Autopilot Logic
 */

import { Logger } from '../../logger';
import { TaskCompletionAnalyzer } from '../../core/TaskCompletionAnalyzer';
import { SDKAutopilotEngine } from '../../core/SDKAutopilotEngine';
import { SDKClaudeExecutor } from '../../services/sdkClaudeExecutor';
import {
  SDKResult,
  SDKResponse,
  CompletionAnalysis,
  TaskContext,
  ExecutionContext,
  AutopilotOptions
} from '../../types';

// Mock the SDK executor for testing
class MockSDKClaudeExecutor extends SDKClaudeExecutor {
  private mockResponses: SDKResult[] = [];
  private responseIndex = 0;

  constructor(logger: Logger, mockResponses: SDKResult[] = []) {
    super(logger);
    this.mockResponses = mockResponses;
  }

  async executeWithSDK(prompt: string, options: any = {}): Promise<SDKResult> {
    if (this.responseIndex >= this.mockResponses.length) {
      throw new Error('No more mock responses available');
    }
    
    const response = this.mockResponses[this.responseIndex++];
    // Add session continuity
    if (options.sessionId && response.sessionId) {
      response.sessionId = options.sessionId;
    }
    
    return response;
  }

  isAvailable(): boolean {
    return true;
  }
}

describe('SDK Autopilot Integration Tests', () => {
  let logger: Logger;
  let completionAnalyzer: TaskCompletionAnalyzer;
  
  beforeEach(() => {
    logger = new Logger({ level: 'debug' });
    completionAnalyzer = new TaskCompletionAnalyzer(logger);
  });

  afterEach(() => {
    // Clean up any resources
  });

  describe('TaskCompletionAnalyzer', () => {
    test('should detect explicit completion patterns', async () => {
      const mockResult: SDKResult = {
        output: 'Task completed successfully! All tests are passing and the feature is ready.',
        exitCode: 0,
        sessionId: 'test-session',
        messages: [{
          type: 'result',
          result: 'Task completed successfully!',
          timestamp: new Date()
        }],
        hasError: false,
        executionTime: 5000
      };

      const taskContext: TaskContext = {
        originalRequest: 'Implement authentication system',
        executionHistory: [],
        currentWorkDir: process.cwd(),
        sessionId: 'test-session',
        preferences: {
          preferredModel: 'sonnet',
          maxIterations: 10,
          timeoutMs: 300000,
          verboseLogging: true,
          continuationThreshold: 0.7,
          enableDualAgent: false
        }
      };

      const analysis = await completionAnalyzer.analyzeCompletion(mockResult, taskContext);

      expect(analysis.isComplete).toBe(true);
      expect(analysis.confidence).toBeGreaterThan(0.7);
      expect(analysis.continuationNeeded).toBe(false);
      expect(analysis.detectedPatterns).toContainEqual(
        expect.objectContaining({
          type: 'explicit_completion',
          confidence: expect.any(Number)
        })
      );
    });

    test('should detect continuation needed patterns', async () => {
      const mockResult: SDKResult = {
        output: 'I have started implementing the authentication system. Next, I need to create the database schema and configure the middleware.',
        exitCode: 0,
        sessionId: 'test-session',
        messages: [{
          type: 'result',
          result: 'I have started implementing the authentication system. Next, I need to create the database schema.',
          timestamp: new Date()
        }],
        hasError: false,
        executionTime: 3000
      };

      const taskContext: TaskContext = {
        originalRequest: 'Implement authentication system',
        executionHistory: [],
        currentWorkDir: process.cwd(),
        sessionId: 'test-session',
        preferences: {
          preferredModel: 'sonnet',
          maxIterations: 10,
          timeoutMs: 300000,
          verboseLogging: true,
          continuationThreshold: 0.7,
          enableDualAgent: false
        }
      };

      const analysis = await completionAnalyzer.analyzeCompletion(mockResult, taskContext);

      expect(analysis.isComplete).toBe(false);
      expect(analysis.continuationNeeded).toBe(true);
      expect(analysis.reasonForContinuation).toContain('Additional tasks');
      expect(analysis.detectedPatterns).toContainEqual(
        expect.objectContaining({
          type: 'task_pending'
        })
      );
    });

    test('should detect error patterns requiring fixes', async () => {
      const mockResult: SDKResult = {
        output: 'Error: Failed to connect to database. Connection timeout after 30 seconds.',
        exitCode: 1,
        sessionId: 'test-session',
        messages: [{
          type: 'error',
          error: 'Failed to connect to database',
          timestamp: new Date()
        }],
        hasError: true,
        executionTime: 30000
      };

      const taskContext: TaskContext = {
        originalRequest: 'Setup database connection',
        executionHistory: [],
        currentWorkDir: process.cwd(),
        sessionId: 'test-session',
        preferences: {
          preferredModel: 'sonnet',
          maxIterations: 10,
          timeoutMs: 300000,
          verboseLogging: true,
          continuationThreshold: 0.7,
          enableDualAgent: false
        }
      };

      const analysis = await completionAnalyzer.analyzeCompletion(mockResult, taskContext);

      expect(analysis.isComplete).toBe(false);
      expect(analysis.continuationNeeded).toBe(true);
      expect(analysis.reasonForContinuation).toContain('Errors were detected');
      expect(analysis.detectedPatterns).toContainEqual(
        expect.objectContaining({
          type: 'error_needs_fixing'
        })
      );
      expect(analysis.suggestedNextAction).toContain('Fix the identified errors');
    });

    test('should handle continuation decision logic', () => {
      const executionContext: ExecutionContext = {
        sessionId: 'test-session',
        taskDescription: 'Test task',
        currentIteration: 3,
        maxIterations: 10,
        workDir: process.cwd(),
        startTime: new Date(),
        lastExecutionTime: new Date(),
        totalExecutionTime: 15000,
        model: 'sonnet',
        verbose: true,
        isFirstIteration: false
      };

      // Test case 1: High confidence completion should stop
      const highConfidenceAnalysis: CompletionAnalysis = {
        isComplete: true,
        confidence: 0.9,
        continuationNeeded: false,
        detectedPatterns: [{
          type: 'explicit_completion',
          confidence: 0.9,
          evidence: ['Task completed successfully'],
          weight: 0.9
        }],
        qualityScore: 0.8
      };

      expect(completionAnalyzer.shouldContinue(highConfidenceAnalysis, executionContext)).toBe(false);

      // Test case 2: Errors detected should continue
      const errorAnalysis: CompletionAnalysis = {
        isComplete: false,
        confidence: 0.4,
        continuationNeeded: true,
        reasonForContinuation: 'Errors detected',
        detectedPatterns: [{
          type: 'error_needs_fixing',
          confidence: 0.8,
          evidence: ['Connection failed'],
          weight: 0.7
        }],
        qualityScore: 0.3
      };

      expect(completionAnalyzer.shouldContinue(errorAnalysis, executionContext)).toBe(true);

      // Test case 3: Max iterations reached should stop
      const maxIterationContext: ExecutionContext = {
        ...executionContext,
        currentIteration: 10,
        maxIterations: 10
      };

      expect(completionAnalyzer.shouldContinue(errorAnalysis, maxIterationContext)).toBe(false);
    });
  });

  describe('SDKAutopilotEngine', () => {
    test('should execute autopilot loop with successful completion', async () => {
      const mockResponses: SDKResult[] = [
        {
          output: 'Starting to implement the feature. I will create the necessary files.',
          exitCode: 0,
          sessionId: 'autopilot-session-1',
          messages: [{ type: 'result', result: 'Starting implementation', timestamp: new Date() }],
          hasError: false,
          executionTime: 2000
        },
        {
          output: 'Files created successfully. Now configuring the settings.',
          exitCode: 0,
          sessionId: 'autopilot-session-1',
          messages: [{ type: 'result', result: 'Files created', timestamp: new Date() }],
          hasError: false,
          executionTime: 3000
        },
        {
          output: 'Implementation completed successfully! All tests are passing.',
          exitCode: 0,
          sessionId: 'autopilot-session-1',
          messages: [{ type: 'result', result: 'Implementation completed successfully', timestamp: new Date() }],
          hasError: false,
          executionTime: 2500
        }
      ];

      const mockExecutor = new MockSDKClaudeExecutor(logger, mockResponses);
      const autopilotEngine = new SDKAutopilotEngine(logger, mockExecutor);

      const options: AutopilotOptions = {
        model: 'sonnet',
        maxIterations: 5,
        timeout: 60000,
        verbose: true,
        workDir: process.cwd()
      };

      const result = await autopilotEngine.runAutopilotLoop('Implement a new feature', options);

      expect(result.exitCode).toBe(0);
      expect(result.hasError).toBe(false);
      expect(result.output).toContain('Implementation completed successfully');
      
      const session = autopilotEngine.getCurrentSession();
      expect(session).toBeTruthy();
      expect(session!.iterations).toHaveLength(3);
      expect(session!.endTime).toBeTruthy();
    });

    test('should handle maximum iterations limit', async () => {
      // Create responses that never indicate completion
      const mockResponses: SDKResult[] = Array(5).fill(null).map((_, index) => ({
        output: `Working on step ${index + 1}. More work needed.`,
        exitCode: 0,
        sessionId: 'max-iteration-session',
        messages: [{ type: 'result', result: `Step ${index + 1}`, timestamp: new Date() }],
        hasError: false,
        executionTime: 1000
      }));

      const mockExecutor = new MockSDKClaudeExecutor(logger, mockResponses);
      const autopilotEngine = new SDKAutopilotEngine(logger, mockExecutor);

      const options: AutopilotOptions = {
        model: 'sonnet',
        maxIterations: 3, // Limit to 3 iterations
        timeout: 60000,
        verbose: true
      };

      const result = await autopilotEngine.runAutopilotLoop('Complex task', options);

      const session = autopilotEngine.getCurrentSession();
      expect(session!.iterations).toHaveLength(3); // Should stop at max iterations
      
      const metrics = autopilotEngine.calculateMetrics();
      expect(metrics!.completionType).toBe('max_iterations');
    });

    test('should handle error recovery', async () => {
      const mockResponses: SDKResult[] = [
        {
          output: 'Error: File not found. Cannot proceed with the task.',
          exitCode: 1,
          sessionId: 'error-recovery-session',
          messages: [{ type: 'error', error: 'File not found', timestamp: new Date() }],
          hasError: true,
          executionTime: 1000
        },
        {
          output: 'Created the missing file. Now proceeding with the task.',
          exitCode: 0,
          sessionId: 'error-recovery-session',
          messages: [{ type: 'result', result: 'File created', timestamp: new Date() }],
          hasError: false,
          executionTime: 2000
        },
        {
          output: 'Task completed successfully after error recovery.',
          exitCode: 0,
          sessionId: 'error-recovery-session',
          messages: [{ type: 'result', result: 'Task completed', timestamp: new Date() }],
          hasError: false,
          executionTime: 1500
        }
      ];

      const mockExecutor = new MockSDKClaudeExecutor(logger, mockResponses);
      const autopilotEngine = new SDKAutopilotEngine(logger, mockExecutor);

      const options: AutopilotOptions = {
        model: 'sonnet',
        maxIterations: 10,
        timeout: 60000,
        verbose: true
      };

      const result = await autopilotEngine.runAutopilotLoop('Task with error', options);

      expect(result.exitCode).toBe(0);
      expect(result.hasError).toBe(false);
      
      const session = autopilotEngine.getCurrentSession();
      expect(session!.iterations).toHaveLength(3);
      
      // First iteration should have error
      expect(session!.iterations[0].response.hasError).toBe(true);
      expect(session!.iterations[0].completionAnalysis.continuationNeeded).toBe(true);
      
      // Last iteration should be successful
      expect(session!.iterations[2].response.hasError).toBe(false);
      expect(session!.iterations[2].completionAnalysis.isComplete).toBe(true);
    });

    test('should generate appropriate continuation prompts', async () => {
      const mockResponses: SDKResult[] = [
        {
          output: 'I need to install dependencies first. Let me do that.',
          exitCode: 0,
          sessionId: 'continuation-test',
          messages: [{ type: 'result', result: 'Need to install dependencies', timestamp: new Date() }],
          hasError: false,
          executionTime: 1000
        },
        {
          output: 'Dependencies installed. Task completed successfully!',
          exitCode: 0,
          sessionId: 'continuation-test',
          messages: [{ type: 'result', result: 'Task completed successfully', timestamp: new Date() }],
          hasError: false,
          executionTime: 3000
        }
      ];

      const mockExecutor = new MockSDKClaudeExecutor(logger, mockResponses);
      const autopilotEngine = new SDKAutopilotEngine(logger, mockExecutor);

      const options: AutopilotOptions = {
        model: 'sonnet',
        maxIterations: 5,
        verbose: true
      };

      const result = await autopilotEngine.runAutopilotLoop('Setup project', options);

      const session = autopilotEngine.getCurrentSession();
      expect(session!.iterations).toHaveLength(2);
      
      // First iteration should indicate continuation needed
      expect(session!.iterations[0].completionAnalysis.continuationNeeded).toBe(true);
      
      // Second iteration should be complete
      expect(session!.iterations[1].completionAnalysis.isComplete).toBe(true);
    });

    test('should track session metrics correctly', async () => {
      const mockResponses: SDKResult[] = [
        {
          output: 'Step 1 completed',
          exitCode: 0,
          sessionId: 'metrics-test',
          messages: [{ type: 'result', result: 'Step 1', timestamp: new Date() }],
          hasError: false,
          executionTime: 1000
        },
        {
          output: 'All steps completed successfully!',
          exitCode: 0,
          sessionId: 'metrics-test',
          messages: [{ 
            type: 'result', 
            result: 'All steps completed', 
            timestamp: new Date() 
          }],
          hasError: false,
          executionTime: 2000
        }
      ];

      const mockExecutor = new MockSDKClaudeExecutor(logger, mockResponses);
      const autopilotEngine = new SDKAutopilotEngine(logger, mockExecutor);

      const options: AutopilotOptions = {
        model: 'sonnet',
        maxIterations: 5,
        verbose: true
      };

      await autopilotEngine.runAutopilotLoop('Test metrics', options);

      const metrics = autopilotEngine.calculateMetrics();
      
      expect(metrics).toBeTruthy();
      expect(metrics!.totalIterations).toBe(2);
      expect(metrics!.totalExecutionTime).toBeGreaterThan(0);
      expect(metrics!.averageIterationTime).toBeGreaterThan(0);
      expect(metrics!.qualityScores).toHaveLength(2);
      expect(metrics!.completionType).toBe('natural');
      expect(metrics!.sessionId).toBe('metrics-test');
    });
  });

  describe('Session Continuity', () => {
    test('should maintain session ID across iterations', async () => {
      const sessionId = 'continuity-test-session';
      const mockResponses: SDKResult[] = [
        {
          output: 'First response',
          exitCode: 0,
          sessionId,
          messages: [{ type: 'result', result: 'First response', timestamp: new Date() }],
          hasError: false,
          executionTime: 1000
        },
        {
          output: 'Task completed successfully!',
          exitCode: 0,
          sessionId,
          messages: [{ type: 'result', result: 'Task completed', timestamp: new Date() }],
          hasError: false,
          executionTime: 1500
        }
      ];

      const mockExecutor = new MockSDKClaudeExecutor(logger, mockResponses);
      const autopilotEngine = new SDKAutopilotEngine(logger, mockExecutor);

      const options: AutopilotOptions = {
        model: 'sonnet',
        maxIterations: 5,
        sessionId: sessionId
      };

      const result = await autopilotEngine.runAutopilotLoop('Test session continuity', options);

      expect(result.sessionId).toBe(sessionId);
      
      const session = autopilotEngine.getCurrentSession();
      expect(session!.sessionId).toContain('sdk-autopilot-'); // Engine generates its own ID
      expect(session!.iterations[0].response.sessionId).toBe(sessionId); // But SDK calls use provided ID
      expect(session!.iterations[1].response.sessionId).toBe(sessionId);
    });
  });
});