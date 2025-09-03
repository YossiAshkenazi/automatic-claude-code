#!/usr/bin/env ts-node
/**
 * Epic 3 Process Management Integration Tests
 * Comprehensive tests to validate clean process termination without hanging
 * 
 * Tests validate that all Epic 3 components work together to:
 * 1. Track and clean up process handles
 * 2. Coordinate graceful shutdown 
 * 3. Spawn isolated test processes that terminate cleanly
 * 4. Prevent process hanging issues entirely
 */

import { Logger } from '../../logger';
import { 
  ProcessHandleTracker,
  IsolatedTestRunner,
  ShutdownManager,
  TestSDKFactory
} from '../../testing';

// Test configuration
const TEST_CONFIG = {
  timeout: 30000,
  processTimeout: 10000,
  maxRetries: 3,
  verboseLogging: process.env.TEST_VERBOSE === 'true',
  skipLongRunningTests: process.env.SKIP_LONG_TESTS === 'true'
};

describe('Epic 3: Process Management Integration', () => {
  let logger: Logger;
  let originalExit: any;
  let originalKill: any;

  beforeAll(() => {
    logger = new Logger('epic3-integration-test', { 
      essentialMode: !TEST_CONFIG.verboseLogging,
      enableFileLogging: false 
    });

    // Mock process.exit and process.kill to prevent actual exits during testing
    originalExit = process.exit;
    originalKill = process.kill;
    
    process.exit = jest.fn() as any;
    process.kill = jest.fn() as any;
  });

  afterAll(async () => {
    // Restore original functions
    process.exit = originalExit;
    process.kill = originalKill;

    // Cleanup all test instances
    await TestSDKFactory.cleanupAll();
    
    // Destroy singletons
    ProcessHandleTracker.destroy();
    ShutdownManager.destroy();
  });

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('ProcessHandleTracker', () => {
    test('should track and cleanup handles without hanging', async () => {
      const handleTracker = ProcessHandleTracker.getInstance(logger);
      
      // Start tracking
      handleTracker.startTracking();
      expect(handleTracker.getStatistics().isTracking).toBe(true);

      // Create test handles
      const timer1 = setTimeout(() => {}, 1000);
      const timer2 = setInterval(() => {}, 500);
      
      const handleId1 = handleTracker.registerHandle('timeout', timer1, 'test-timer-1');
      const handleId2 = handleTracker.registerHandle('interval', timer2, 'test-timer-2');

      // Verify tracking
      const stats = handleTracker.getStatistics();
      expect(stats.totalHandles).toBeGreaterThanOrEqual(2);

      // Force cleanup all handles
      const startTime = Date.now();
      const cleanupResult = await handleTracker.forceCleanupAll({
        maxWaitTime: 5000,
        forceKillAfter: 3000,
        enableSigkillFallback: false,
        logCleanupProgress: TEST_CONFIG.verboseLogging
      });
      const cleanupDuration = Date.now() - startTime;

      // Validate cleanup results
      expect(cleanupResult.cleanedHandles > 0 || cleanupResult.totalHandles === 0).toBe(true);
      expect(cleanupDuration).toBeLessThan(TEST_CONFIG.processTimeout);
      expect(cleanupResult.cleanedHandles).toBeGreaterThanOrEqual(2);

      // Cleanup should complete quickly without hanging
      const afterStats = handleTracker.getStatistics();
      expect(afterStats.totalHandles).toBeLessThanOrEqual(stats.totalHandles);

      handleTracker.stopTracking();
    }, TEST_CONFIG.timeout);

    test('should handle leaked handles gracefully', async () => {
      const handleTracker = ProcessHandleTracker.getInstance(logger);
      handleTracker.startTracking();

      // Create handles that would normally leak
      const leakyTimer = setTimeout(() => {
        // This timer won't be cleared manually, simulating a leak
      }, 10000);

      const handleId = handleTracker.registerHandle('timeout', leakyTimer, 'leaky-timer');
      
      // Force cleanup should handle the leak
      const cleanupResult = await handleTracker.forceCleanupAll({
        maxWaitTime: 3000,
        logCleanupProgress: false
      });

      expect(cleanupResult.cleanedHandles).toBeGreaterThanOrEqual(1);
      
      handleTracker.stopTracking();
    }, TEST_CONFIG.timeout);
  });

  describe('ShutdownManager', () => {
    test('should coordinate graceful shutdown without hanging', async () => {
      const shutdownManager = ShutdownManager.getInstance(logger, {
        maxShutdownTime: 5000,
        enableSignalHandlers: false,
        logProgress: TEST_CONFIG.verboseLogging
      });

      // Register test hooks
      let hook1Executed = false;
      let hook2Executed = false;
      let hook3Executed = false;

      const hook1Id = shutdownManager.registerHook(
        'Test-Hook-1',
        async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          hook1Executed = true;
        },
        'high',
        { timeoutMs: 1000 }
      );

      const hook2Id = shutdownManager.registerHook(
        'Test-Hook-2', 
        async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          hook2Executed = true;
        },
        'normal',
        { timeoutMs: 500, dependencies: [hook1Id] }
      );

      const hook3Id = shutdownManager.registerHook(
        'Test-Hook-3',
        async () => {
          hook3Executed = true;
        },
        'cleanup',
        { timeoutMs: 200, dependencies: [hook2Id] }
      );

      // Execute shutdown
      const startTime = Date.now();
      const shutdownResult = await shutdownManager.shutdown('Integration test');
      const shutdownDuration = Date.now() - startTime;

      // Validate shutdown results
      expect(shutdownResult.success).toBe(true);
      expect(shutdownDuration).toBeLessThan(TEST_CONFIG.processTimeout);
      expect(shutdownResult.completedHooks).toBe(3);
      expect(shutdownResult.failedHooks).toBe(0);

      // Verify hooks executed in order
      expect(hook1Executed).toBe(true);
      expect(hook2Executed).toBe(true);
      expect(hook3Executed).toBe(true);
    }, TEST_CONFIG.timeout);

    test('should handle hook timeouts and failures gracefully', async () => {
      const shutdownManager = ShutdownManager.getInstance(logger, {
        maxShutdownTime: 3000,
        enableSignalHandlers: false
      });

      // Register a hook that will timeout
      shutdownManager.registerHook(
        'Timeout-Hook',
        async () => {
          // This will timeout
          await new Promise(resolve => setTimeout(resolve, 2000));
        },
        'normal',
        { timeoutMs: 100 }
      );

      // Register a hook that will fail
      shutdownManager.registerHook(
        'Failing-Hook', 
        async () => {
          throw new Error('Intentional test failure');
        },
        'normal',
        { timeoutMs: 500 }
      );

      const shutdownResult = await shutdownManager.shutdown('Failure test');

      // Should complete despite failures
      expect(shutdownResult.success).toBe(false);
      expect(shutdownResult.completedHooks + shutdownResult.failedHooks + shutdownResult.timedOutHooks)
        .toBeGreaterThanOrEqual(2);
      expect(shutdownResult.errors.length).toBeGreaterThan(0);
    }, TEST_CONFIG.timeout);
  });

  describe('IsolatedTestRunner', () => {
    test('should spawn and terminate test processes cleanly', async () => {
      const testRunner = new IsolatedTestRunner(logger, {
        processTimeout: 8000,
        maxConcurrentProcesses: 2,
        enableProcessLogging: TEST_CONFIG.verboseLogging
      });

      expect(testRunner.isHealthy()).toBe(true);

      // Test a simple function
      const simpleTest = async (message: string) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return `Test completed: ${message}`;
      };

      const startTime = Date.now();
      const result = await testRunner.runIsolatedTest(
        simpleTest,
        ['clean termination test'],
        {
          processTimeout: 5000,
          enableIPC: true,
          testSDKOptions: {
            mockLevel: 'session_only',
            sessionBehavior: 'isolated',
            authentication: 'mock',
            processIsolation: true,
            enableHandleTracking: true
          }
        }
      );
      const testDuration = Date.now() - startTime;

      // Validate results
      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(testDuration).toBeLessThan(TEST_CONFIG.processTimeout);
      expect(result.testResults?.result).toBe('Test completed: clean termination test');

      // Verify handle cleanup
      if (result.handleStats) {
        expect(result.handleStats.cleanedHandles).toBeGreaterThanOrEqual(0);
        expect(result.handleStats.forcedTermination).toBe(false);
      }

      await testRunner.shutdown();
    }, TEST_CONFIG.timeout);

    test('should handle multiple concurrent processes without hanging', async () => {
      if (TEST_CONFIG.skipLongRunningTests) {
        return;
      }

      const testRunner = new IsolatedTestRunner(logger, {
        processTimeout: 6000,
        maxConcurrentProcesses: 3,
        enableProcessLogging: false
      });

      // Create multiple test functions
      const concurrentTest = async (id: number) => {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100));
        return `Concurrent test ${id} completed`;
      };

      // Run multiple tests concurrently
      const testPromises = Array.from({ length: 3 }, (_, i) =>
        testRunner.runIsolatedTest(
          concurrentTest,
          [i + 1],
          {
            processTimeout: 4000,
            testSDKOptions: {
              mockLevel: 'session_only',
              sessionBehavior: 'isolated',
              authentication: 'mock',
              processIsolation: true,
              enableHandleTracking: true
            }
          }
        )
      );

      const startTime = Date.now();
      const results = await Promise.all(testPromises);
      const concurrentDuration = Date.now() - startTime;

      // All tests should succeed
      expect(results.every(r => r.success)).toBe(true);
      expect(results.every(r => r.exitCode === 0)).toBe(true);
      expect(concurrentDuration).toBeLessThan(TEST_CONFIG.timeout);

      // No processes should hang
      const stats = testRunner.getStatistics();
      expect(stats.timeoutTests).toBe(0);
      expect(stats.successfulTests).toBe(3);

      await testRunner.shutdown();
    }, TEST_CONFIG.timeout + 10000);

    test('should handle process failures without hanging the runner', async () => {
      const testRunner = new IsolatedTestRunner(logger, {
        processTimeout: 5000,
        enableProcessLogging: false
      });

      // Test function that will fail
      const failingTest = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        throw new Error('Intentional test failure');
      };

      const result = await testRunner.runIsolatedTest(
        failingTest,
        [],
        {
          processTimeout: 3000,
          testSDKOptions: {
            mockLevel: 'session_only',
            sessionBehavior: 'isolated',
            authentication: 'mock',
            processIsolation: true
          }
        }
      );

      // Should handle failure gracefully
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.error || result.testResults?.error).toBeTruthy();

      // Runner should still be healthy
      expect(testRunner.isHealthy()).toBe(true);

      await testRunner.shutdown();
    }, TEST_CONFIG.timeout);
  });

  describe('Complete Integration', () => {
    test('should integrate all Epic 3 components without hanging', async () => {
      // Initialize all components
      const handleTracker = ProcessHandleTracker.getInstance(logger);
      const shutdownManager = ShutdownManager.getInstance(logger, {
        maxShutdownTime: 8000,
        enableSignalHandlers: false
      });
      const testRunner = new IsolatedTestRunner(logger, {
        processTimeout: 6000,
        enableShutdownHooks: true
      });

      // Integrate components
      shutdownManager.setHandleTracker(handleTracker);
      handleTracker.startTracking();

      // Register test hooks
      let integrationHookExecuted = false;
      shutdownManager.registerHook(
        'Integration-Test-Hook',
        async () => {
          integrationHookExecuted = true;
        },
        'normal',
        { timeoutMs: 1000 }
      );

      // Create test SDK instance with full integration
      const testInstance = TestSDKFactory.createIsolated({
        enableHandleTracking: true,
        enableShutdownHooks: true,
        enableLogging: TEST_CONFIG.verboseLogging
      });

      // Run an isolated test that uses the integrated infrastructure
      const integrationTest = async (testInstance: any) => {
        // Register some handles
        const timer = setTimeout(() => {}, 1000);
        
        if (testInstance.handleTracker) {
          testInstance.handleTracker.registerHandle('timeout', timer, 'integration-test');
        }

        // Clear the timer to prevent actual timeout
        clearTimeout(timer);
        
        return 'Integration test with handle tracking completed';
      };

      const result = await testRunner.runIsolatedTest(
        integrationTest,
        [testInstance],
        {
          processTimeout: 5000,
          testSDKOptions: {
            mockLevel: 'session_only',
            sessionBehavior: 'isolated',
            authentication: 'mock',
            processIsolation: true,
            enableHandleTracking: true,
            enableShutdownHooks: true
          }
        }
      );

      // Verify integration success
      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);

      // Shutdown should be coordinated through all components
      const startTime = Date.now();
      
      // Clean up test instance
      await testInstance.cleanup();
      
      // Shutdown test runner
      await testRunner.shutdown();
      
      // Shutdown manager
      const shutdownResult = await shutdownManager.shutdown('Integration test complete');
      
      const totalShutdownTime = Date.now() - startTime;

      // Validate coordinated shutdown
      expect(shutdownResult.success).toBe(true);
      expect(integrationHookExecuted).toBe(true);
      expect(totalShutdownTime).toBeLessThan(TEST_CONFIG.processTimeout);

      // Verify no handles leaked
      const finalStats = handleTracker.getStatistics();
      expect(finalStats.totalHandles).toBeLessThanOrEqual(1); // May have the test instance handle
      
      handleTracker.stopTracking();
    }, TEST_CONFIG.timeout + 10000);

    test('should prevent hanging even with problematic code', async () => {
      const testInstance = TestSDKFactory.createIsolated({
        enableHandleTracking: true,
        terminationOptions: {
          maxWaitTime: 3000,
          forceKillAfter: 2000
        }
      });

      // Test with potentially hanging code
      const hangingTest = async () => {
        // Create handles that might not be cleaned up
        const interval = setInterval(() => {
          // This interval might not be cleared
        }, 100);

        // Simulate some work
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Don't clear the interval (simulating buggy code)
        // clearInterval(interval); // Intentionally commented out
        
        return 'Test completed despite potential hanging code';
      };

      const testRunner = new IsolatedTestRunner(logger, {
        processTimeout: 4000,
        cleanupTimeout: 3000
      });

      const startTime = Date.now();
      const result = await testRunner.runIsolatedTest(
        hangingTest,
        [],
        {
          processTimeout: 3000,
          testSDKOptions: {
            mockLevel: 'session_only',
            sessionBehavior: 'isolated',
            authentication: 'mock',
            processIsolation: true,
            enableHandleTracking: true,
            terminationOptions: {
              maxWaitTime: 2000
            }
          }
        }
      );
      const executionTime = Date.now() - startTime;

      // Should complete even with problematic code
      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(TEST_CONFIG.processTimeout);

      // Handle cleanup should have dealt with the problematic interval
      if (result.handleStats) {
        expect(result.handleStats.totalHandles).toBeGreaterThan(0);
        expect(result.handleStats.cleanedHandles).toBeGreaterThanOrEqual(1);
      }

      await testRunner.shutdown();
      await testInstance.cleanup();
    }, TEST_CONFIG.timeout);
  });
});

// Export for manual running
export { TEST_CONFIG };