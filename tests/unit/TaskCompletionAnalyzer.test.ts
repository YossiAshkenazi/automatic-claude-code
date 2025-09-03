/**
 * Unit tests for TaskCompletionAnalyzer
 * Tests the core logic for SDK response analysis in Story 1.2
 */

import { Logger } from '@/logger';
import { TaskCompletionAnalyzer } from '@/core/TaskCompletionAnalyzer';
import {
  SDKResult,
  SDKResponse,
  TaskContext,
  ExecutionContext,
  CompletionAnalysis,
  CompletionPattern
} from '@/types';

describe('TaskCompletionAnalyzer', () => {
  let analyzer: TaskCompletionAnalyzer;
  let logger: Logger;
  let mockTaskContext: TaskContext;
  let mockExecutionContext: ExecutionContext;

  beforeEach(() => {
    logger = new Logger() as jest.Mocked<Logger>;
    analyzer = new TaskCompletionAnalyzer(logger);
    
    mockTaskContext = {
      originalRequest: 'Test task implementation',
      executionHistory: [],
      currentWorkDir: '/test/workspace',
      sessionId: 'test-session-123',
      preferences: {
        preferredModel: 'sonnet',
        maxIterations: 10,
        timeoutMs: 300000,
        verboseLogging: true,
        continuationThreshold: 0.7,
        enableDualAgent: false
      }
    };

    mockExecutionContext = {
      sessionId: 'test-session-123',
      taskDescription: 'Test task',
      currentIteration: 1,
      maxIterations: 10,
      workDir: '/test/workspace',
      startTime: new Date(),
      lastExecutionTime: new Date(),
      totalExecutionTime: 5000,
      model: 'sonnet',
      verbose: false,
      isFirstIteration: true
    };
  });

  describe('analyzeCompletion', () => {
    test('should identify explicit completion patterns', async () => {
      const sdkResult: SDKResult = {
        output: 'The task has been completed successfully! All tests are passing and the feature is ready for production.',
        exitCode: 0,
        sessionId: 'test-session',
        messages: [],
        hasError: false,
        executionTime: 3000
      };

      const analysis = await analyzer.analyzeCompletion(sdkResult, mockTaskContext);

      expect(analysis.isComplete).toBe(true);
      expect(analysis.confidence).toBeGreaterThan(0.7);
      expect(analysis.continuationNeeded).toBe(false);
      
      const completionPattern = analysis.detectedPatterns.find(p => p.type === 'explicit_completion');
      expect(completionPattern).toBeDefined();
      expect(completionPattern!.confidence).toBeGreaterThan(0);
      expect(completionPattern!.evidence).toContain(expect.stringMatching(/completed|successfully|ready/i));
    });

    test('should identify task pending patterns', async () => {
      const sdkResult: SDKResult = {
        output: 'I have set up the database connection. Next, I need to create the user authentication middleware and then configure the API routes.',
        exitCode: 0,
        sessionId: 'test-session',
        messages: [],
        hasError: false,
        executionTime: 2000
      };

      const analysis = await analyzer.analyzeCompletion(sdkResult, mockTaskContext);

      expect(analysis.isComplete).toBe(false);
      expect(analysis.continuationNeeded).toBe(true);
      expect(analysis.reasonForContinuation).toContain('Additional tasks');
      
      const pendingPattern = analysis.detectedPatterns.find(p => p.type === 'task_pending');
      expect(pendingPattern).toBeDefined();
      expect(pendingPattern!.evidence).toContain(expect.stringMatching(/next|need|then/i));
    });

    test('should identify error patterns', async () => {
      const sdkResult: SDKResult = {
        output: 'Error: Failed to install dependencies. npm install returned with exit code 1. Permission denied when accessing node_modules.',
        exitCode: 1,
        sessionId: 'test-session',
        messages: [
          {
            type: 'error',
            error: 'npm install failed',
            timestamp: new Date()
          }
        ],
        hasError: true,
        executionTime: 5000
      };

      const analysis = await analyzer.analyzeCompletion(sdkResult, mockTaskContext);

      expect(analysis.isComplete).toBe(false);
      expect(analysis.continuationNeeded).toBe(true);
      expect(analysis.reasonForContinuation).toContain('Errors were detected');
      expect(analysis.suggestedNextAction).toContain('Fix the identified errors');
      
      const errorPattern = analysis.detectedPatterns.find(p => p.type === 'error_needs_fixing');
      expect(errorPattern).toBeDefined();
      expect(errorPattern!.evidence).toContain(expect.stringMatching(/error|failed|permission denied/i));
    });

    test('should identify clarification needed patterns', async () => {
      const sdkResult: SDKResult = {
        output: 'I need more information to proceed. Which database should I use for this project? MySQL or PostgreSQL? Also, what authentication method do you prefer?',
        exitCode: 0,
        sessionId: 'test-session',
        messages: [],
        hasError: false,
        executionTime: 1000
      };

      const analysis = await analyzer.analyzeCompletion(sdkResult, mockTaskContext);

      expect(analysis.isComplete).toBe(false);
      expect(analysis.continuationNeeded).toBe(true);
      expect(analysis.reasonForContinuation).toContain('clarification');
      
      const clarificationPattern = analysis.detectedPatterns.find(p => p.type === 'clarification_needed');
      expect(clarificationPattern).toBeDefined();
      expect(clarificationPattern!.evidence).toContain(expect.stringMatching(/\?|which|what|need more/i));
    });

    test('should identify iterative improvement patterns', async () => {
      const sdkResult: SDKResult = {
        output: 'The basic implementation is working. However, we could improve the performance by optimizing the database queries and enhance the user experience.',
        exitCode: 0,
        sessionId: 'test-session',
        messages: [],
        hasError: false,
        executionTime: 2500
      };

      const analysis = await analyzer.analyzeCompletion(sdkResult, mockTaskContext);

      expect(analysis.continuationNeeded).toBe(true);
      
      const improvementPattern = analysis.detectedPatterns.find(p => p.type === 'iterative_improvement');
      expect(improvementPattern).toBeDefined();
      expect(improvementPattern!.evidence).toContain(expect.stringMatching(/improve|optimize|enhance/i));
    });

    test('should handle mixed patterns correctly', async () => {
      const sdkResult: SDKResult = {
        output: 'Task completed successfully! All core features are working. However, there is one small error in the validation logic that needs to be fixed.',
        exitCode: 0,
        sessionId: 'test-session',
        messages: [],
        hasError: false,
        executionTime: 4000
      };

      const analysis = await analyzer.analyzeCompletion(sdkResult, mockTaskContext);

      // Should detect both completion and error patterns
      const completionPattern = analysis.detectedPatterns.find(p => p.type === 'explicit_completion');
      const errorPattern = analysis.detectedPatterns.find(p => p.type === 'error_needs_fixing');
      
      expect(completionPattern).toBeDefined();
      expect(errorPattern).toBeDefined();
      
      // Error pattern should influence continuation decision
      expect(analysis.continuationNeeded).toBe(true);
    });

    test('should calculate quality scores appropriately', async () => {
      // High quality response
      const highQualityResult: SDKResult = {
        output: 'Implementation completed successfully with comprehensive testing. All 25 test cases pass, code coverage is 95%, and performance benchmarks show 40% improvement over the previous version.',
        exitCode: 0,
        sessionId: 'test-session',
        messages: [],
        hasError: false,
        executionTime: 8000
      };

      const highQualityAnalysis = await analyzer.analyzeCompletion(highQualityResult, mockTaskContext);
      expect(highQualityAnalysis.qualityScore).toBeGreaterThan(0.7);

      // Low quality response
      const lowQualityResult: SDKResult = {
        output: 'Error occurred. Failed.',
        exitCode: 1,
        sessionId: 'test-session',
        messages: [],
        hasError: true,
        executionTime: 500
      };

      const lowQualityAnalysis = await analyzer.analyzeCompletion(lowQualityResult, mockTaskContext);
      expect(lowQualityAnalysis.qualityScore).toBeLessThan(0.5);
    });

    test('should handle empty or minimal output gracefully', async () => {
      const minimalResult: SDKResult = {
        output: '',
        exitCode: 0,
        sessionId: 'test-session',
        messages: [],
        hasError: false,
        executionTime: 100
      };

      const analysis = await analyzer.analyzeCompletion(minimalResult, mockTaskContext);

      expect(analysis).toBeDefined();
      expect(analysis.confidence).toBeLessThan(0.7); // Low confidence for minimal output
      expect(analysis.detectedPatterns).toEqual([]);
    });

    test('should handle analysis errors gracefully', async () => {
      // Create a result that might cause analysis issues
      const problematicResult: SDKResult = {
        output: null as any, // Invalid output
        exitCode: 0,
        sessionId: 'test-session',
        messages: [],
        hasError: false,
        executionTime: 1000
      };

      const analysis = await analyzer.analyzeCompletion(problematicResult, mockTaskContext);

      // Should return safe defaults
      expect(analysis.isComplete).toBe(false);
      expect(analysis.confidence).toBeLessThan(0.5);
      expect(analysis.continuationNeeded).toBe(true);
      expect(analysis.reasonForContinuation).toBeDefined();
    });
  });

  describe('shouldContinue', () => {
    test('should stop on high confidence completion', () => {
      const highConfidenceAnalysis: CompletionAnalysis = {
        isComplete: true,
        confidence: 0.9,
        continuationNeeded: false,
        detectedPatterns: [],
        qualityScore: 0.85
      };

      const result = analyzer.shouldContinue(highConfidenceAnalysis, mockExecutionContext);
      expect(result).toBe(false);
    });

    test('should continue on error detection', () => {
      const errorAnalysis: CompletionAnalysis = {
        isComplete: false,
        confidence: 0.4,
        continuationNeeded: true,
        reasonForContinuation: 'Errors detected',
        detectedPatterns: [{
          type: 'error_needs_fixing',
          confidence: 0.8,
          evidence: ['Error occurred'],
          weight: 0.7
        }],
        qualityScore: 0.3
      };

      const result = analyzer.shouldContinue(errorAnalysis, mockExecutionContext);
      expect(result).toBe(true);
    });

    test('should stop at maximum iterations', () => {
      const maxIterationContext: ExecutionContext = {
        ...mockExecutionContext,
        currentIteration: 10,
        maxIterations: 10
      };

      const continuationAnalysis: CompletionAnalysis = {
        isComplete: false,
        confidence: 0.6,
        continuationNeeded: true,
        detectedPatterns: [],
        qualityScore: 0.5
      };

      const result = analyzer.shouldContinue(continuationAnalysis, maxIterationContext);
      expect(result).toBe(false);
    });

    test('should continue for low quality scores early in execution', () => {
      const earlyContext: ExecutionContext = {
        ...mockExecutionContext,
        currentIteration: 2,
        maxIterations: 10
      };

      const lowQualityAnalysis: CompletionAnalysis = {
        isComplete: false,
        confidence: 0.6,
        continuationNeeded: false,
        detectedPatterns: [],
        qualityScore: 0.3 // Low quality should trigger continuation
      };

      const result = analyzer.shouldContinue(lowQualityAnalysis, earlyContext);
      expect(result).toBe(true);
    });

    test('should stop for uncertain completion late in execution', () => {
      const lateContext: ExecutionContext = {
        ...mockExecutionContext,
        currentIteration: 9,
        maxIterations: 10
      };

      const uncertainAnalysis: CompletionAnalysis = {
        isComplete: false,
        confidence: 0.3,
        continuationNeeded: false,
        detectedPatterns: [],
        qualityScore: 0.5
      };

      const result = analyzer.shouldContinue(uncertainAnalysis, lateContext);
      expect(result).toBe(false);
    });

    test('should handle timeout scenarios', () => {
      // Simulate long running context
      const longRunningContext: ExecutionContext = {
        ...mockExecutionContext,
        startTime: new Date(Date.now() - 6 * 60 * 1000), // 6 minutes ago
      };

      const anyAnalysis: CompletionAnalysis = {
        isComplete: false,
        confidence: 0.8,
        continuationNeeded: true,
        detectedPatterns: [],
        qualityScore: 0.7
      };

      const result = analyzer.shouldContinue(anyAnalysis, longRunningContext);
      expect(result).toBe(false); // Should stop due to timeout
    });

    test('should handle continuation decision errors gracefully', () => {
      const invalidContext = null as any;
      const validAnalysis: CompletionAnalysis = {
        isComplete: false,
        confidence: 0.5,
        continuationNeeded: true,
        detectedPatterns: [],
        qualityScore: 0.5
      };

      const result = analyzer.shouldContinue(validAnalysis, invalidContext);
      expect(result).toBe(false); // Should default to false for safety
    });
  });

  describe('Pattern Detection', () => {
    test('should weight different patterns correctly', async () => {
      const mixedResult: SDKResult = {
        output: 'Task completed! However, there is an error in the logging module that needs improvement.',
        exitCode: 0,
        sessionId: 'test-session',
        messages: [],
        hasError: false,
        executionTime: 3000
      };

      const analysis = await analyzer.analyzeCompletion(mixedResult, mockTaskContext);

      const patterns = analysis.detectedPatterns;
      
      // Should detect multiple pattern types
      expect(patterns.length).toBeGreaterThan(1);
      
      // Completion pattern should have high weight
      const completionPattern = patterns.find(p => p.type === 'explicit_completion');
      expect(completionPattern?.weight).toBe(0.9);
      
      // Error pattern should have medium-high weight
      const errorPattern = patterns.find(p => p.type === 'error_needs_fixing');
      expect(errorPattern?.weight).toBe(0.7);
      
      // Improvement pattern should have lower weight
      const improvementPattern = patterns.find(p => p.type === 'iterative_improvement');
      expect(improvementPattern?.weight).toBe(0.5);
    });

    test('should provide meaningful evidence for patterns', async () => {
      const evidenceResult: SDKResult = {
        output: 'Implementation finished successfully! All unit tests are passing. Next, we should optimize the database queries and improve error handling.',
        exitCode: 0,
        sessionId: 'test-session',
        messages: [],
        hasError: false,
        executionTime: 4000
      };

      const analysis = await analyzer.analyzeCompletion(evidenceResult, mockTaskContext);

      // Check completion pattern evidence
      const completionPattern = analysis.detectedPatterns.find(p => p.type === 'explicit_completion');
      expect(completionPattern?.evidence).toContain(expect.stringMatching(/finished|successfully/i));
      
      // Check pending task pattern evidence
      const pendingPattern = analysis.detectedPatterns.find(p => p.type === 'task_pending');
      expect(pendingPattern?.evidence).toContain(expect.stringMatching(/next|should/i));
      
      // Check improvement pattern evidence
      const improvementPattern = analysis.detectedPatterns.find(p => p.type === 'iterative_improvement');
      expect(improvementPattern?.evidence).toContain(expect.stringMatching(/optimize|improve/i));
    });

    test('should limit evidence collection appropriately', async () => {
      // Create output with many matching patterns
      const verboseOutput = Array(20).fill('We need to improve and optimize this further. ').join('');
      
      const verboseResult: SDKResult = {
        output: verboseOutput,
        exitCode: 0,
        sessionId: 'test-session',
        messages: [],
        hasError: false,
        executionTime: 1000
      };

      const analysis = await analyzer.analyzeCompletion(verboseResult, mockTaskContext);

      const improvementPattern = analysis.detectedPatterns.find(p => p.type === 'iterative_improvement');
      expect(improvementPattern?.evidence.length).toBeLessThanOrEqual(5); // Should limit evidence
    });
  });
});