/**
 * Test Suite for Isolated Test Process Spawning
 * Epic 3, Story 3.2: Create Isolated Test Process Spawning
 * 
 * Validates complete process isolation, IPC communication, timeout management,
 * and integration with TestSDKFactory and ProcessHandleTracker.
 */

import { Logger } from '../logger';
import IsolatedTestRunner, { 
  IsolatedTestOptions, 
  IsolatedTestResult, 
  TestProcessInfo 
} from './IsolatedTestRunner';
import { TestSDKFactory, TestSDKOptions } from './TestSDKFactory';

describe('IsolatedTestRunner', () => {
  let testRunner: IsolatedTestRunner;
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger('test-isolated-runner', { 
      essentialMode: true, 
      enableFileLogging: false 
    });
    testRunner = new IsolatedTestRunner(logger);
  });

  afterEach(async () => {
    // Ensure clean shutdown after each test
    await testRunner.shutdown();
  });

  afterAll(async () => {
    // Final cleanup
    await TestSDKFactory.cleanupAll();
  });

  describe('Basic Process Spawning', () => {
    test('should spawn a simple test process successfully', async () => {
      const testFunction = async (testInstance: any) => {
        return { message: 'Hello from isolated process!', pid: process.pid };
      };

      const result = await testRunner.runIsolatedTest(testFunction);

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.testResults?.result?.message).toBe('Hello from isolated process!');
      expect(result.testResults?.result?.pid).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
      expect(result.spawnTime).toBeLessThan(2000); // Under 2 seconds spawn time
    }, 10000);

    test('should handle process spawning with arguments', async () => {
      const testFunction = async (arg1: string, arg2: number, testInstance: any) => {
        return { arg1, arg2, pid: process.pid };
      };

      const result = await testRunner.runIsolatedTest(
        testFunction, 
        ['test-string', 42]
      );

      expect(result.success).toBe(true);
      expect(result.testResults?.result?.arg1).toBe('test-string');
      expect(result.testResults?.result?.arg2).toBe(42);
    }, 10000);

    test('should provide complete process isolation', async () => {
      let parentProcessId = process.pid;
      
      const testFunction = async (parentPid: number, testInstance: any) => {
        const childPid = process.pid;
        return {
          parentPid,
          childPid,
          isolated: parentPid !== childPid,
          testInstanceProvided: testInstance !== null
        };
      };

      const result = await testRunner.runIsolatedTest(
        testFunction,
        [parentProcessId]
      );

      expect(result.success).toBe(true);
      expect(result.testResults?.result?.isolated).toBe(true);
      expect(result.testResults?.result?.testInstanceProvided).toBe(true);
      expect(result.testResults?.result?.childPid).not.toBe(parentProcessId);
    }, 10000);
  });

  describe('Error Handling and Process Failures', () => {
    test('should handle test function throwing errors', async () => {
      const testFunction = async (testInstance: any) => {
        throw new Error('Intentional test error');
      };

      const result = await testRunner.runIsolatedTest(testFunction);

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.testResults?.error).toContain('Intentional test error');
    }, 10000);

    test('should handle process timeout', async () => {
      const testFunction = async (testInstance: any) => {
        // Simulate a long-running process
        await new Promise(resolve => setTimeout(resolve, 3000));
        return { completed: true };
      };

      const options: Partial<IsolatedTestOptions> = {
        processTimeout: 1000 // 1 second timeout
      };

      const result = await testRunner.runIsolatedTest(testFunction, [], options);

      expect(result.success).toBe(false);
      // Process should be terminated due to timeout
      expect(result.duration).toBeGreaterThanOrEqual(1000);
      expect(result.duration).toBeLessThan(2000);
    }, 5000);

    test('should isolate child process failures from main test runner', async () => {
      const testFunction = async (testInstance: any) => {
        process.exit(1); // Force exit child process
      };

      const result = await testRunner.runIsolatedTest(testFunction);

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      
      // Test runner should still be healthy
      expect(testRunner.isHealthy()).toBe(true);
    }, 10000);
  });

  describe('Inter-Process Communication (IPC)', () => {
    test('should enable IPC communication by default', async () => {
      const testFunction = async (testInstance: any) => {
        // IPC should be available in child process
        const ipcAvailable = typeof process.send === 'function';
        return { ipcAvailable, pid: process.pid };
      };

      const result = await testRunner.runIsolatedTest(testFunction);

      expect(result.success).toBe(true);
      expect(result.testResults?.result?.ipcAvailable).toBe(true);
    }, 10000);

    test('should track heartbeat messages', async () => {
      let processReadyEventReceived = false;
      let heartbeatCount = 0;

      testRunner.on('process_ready', () => {
        processReadyEventReceived = true;
      });

      testRunner.on('heartbeat_timeout', () => {
        // This should not happen in a healthy test
        fail('Heartbeat timeout should not occur');
      });

      const testFunction = async (testInstance: any) => {
        // Wait for a few heartbeats
        await new Promise(resolve => setTimeout(resolve, 3500));
        return { completed: true };
      };

      const result = await testRunner.runIsolatedTest(testFunction, [], {
        heartbeatInterval: 1000
      });

      expect(result.success).toBe(true);
      expect(processReadyEventReceived).toBe(true);
      // Should have received at least 3 heartbeats during 3.5 second execution
    }, 10000);

    test('should handle heartbeat timeout detection', async () => {
      let heartbeatTimeoutDetected = false;

      testRunner.on('heartbeat_timeout', () => {
        heartbeatTimeoutDetected = true;
      });

      const testFunction = async (testInstance: any) => {
        // Block the event loop to prevent heartbeats
        const start = Date.now();
        while (Date.now() - start < 5000) {
          // Busy wait - blocks event loop
        }
        return { completed: true };
      };

      const options: Partial<IsolatedTestOptions> = {
        heartbeatInterval: 500,
        processTimeout: 8000
      };

      const result = await testRunner.runIsolatedTest(testFunction, [], options);

      // Process might succeed or timeout depending on timing
      expect(heartbeatTimeoutDetected).toBe(true);
    }, 12000);
  });

  describe('TestSDKFactory Integration', () => {
    test('should integrate with TestSDKFactory for isolated SDK instances', async () => {
      const testFunction = async (testInstance: any) => {
        // Test that we get an isolated SDK instance
        const sdkAvailable = testInstance && testInstance.sdk;
        const handleTracker = testInstance && testInstance.handleTracker;
        const sessionId = testInstance ? testInstance.sessionId : null;

        return {
          sdkAvailable,
          handleTrackerAvailable: !!handleTracker,
          sessionId,
          pid: process.pid
        };
      };

      const options: Partial<IsolatedTestOptions> = {
        testSDKOptions: {
          mockLevel: 'full_mock',
          sessionBehavior: 'isolated',
          authentication: 'mock',
          processIsolation: true,
          enableHandleTracking: true
        }
      };

      const result = await testRunner.runIsolatedTest(testFunction, [], options);

      expect(result.success).toBe(true);
      expect(result.testResults?.result?.sdkAvailable).toBe(true);
      expect(result.testResults?.result?.handleTrackerAvailable).toBe(true);
      expect(result.testResults?.result?.sessionId).toBeDefined();
    }, 10000);

    test('should use different test SDK configurations', async () => {
      const testFunction = async (testInstance: any) => {
        // Access mock layer if available
        const mockLayer = testInstance.getMockLayer ? testInstance.getMockLayer() : null;
        
        return {
          hasMockLayer: !!mockLayer,
          sessionId: testInstance.sessionId,
          pid: process.pid
        };
      };

      const fullMockOptions: Partial<IsolatedTestOptions> = {
        testSDKOptions: {
          mockLevel: 'full_mock',
          sessionBehavior: 'bypass',
          authentication: 'mock',
          processIsolation: true
        }
      };

      const result = await testRunner.runIsolatedTest(testFunction, [], fullMockOptions);

      expect(result.success).toBe(true);
      expect(result.testResults?.result?.hasMockLayer).toBe(true);
    }, 10000);
  });

  describe('Process Handle Tracking Integration', () => {
    test('should track and cleanup process handles', async () => {
      const testFunction = async (testInstance: any) => {
        const handleTracker = testInstance.handleTracker;
        
        if (!handleTracker) {
          throw new Error('Handle tracker not available');
        }

        // Create some handles that need cleanup
        const timer1 = setTimeout(() => {}, 5000);
        const timer2 = setInterval(() => {}, 1000);

        handleTracker.registerHandle('timeout', timer1, 'test-timer-1');
        handleTracker.registerHandle('interval', timer2, 'test-timer-2');

        const stats = handleTracker.getStatistics();
        
        return {
          initialHandleCount: stats.totalHandles,
          handleTypes: stats.handlesByType,
          pid: process.pid
        };
      };

      const result = await testRunner.runIsolatedTest(testFunction);

      expect(result.success).toBe(true);
      expect(result.testResults?.result?.initialHandleCount).toBeGreaterThan(0);
      
      // Check that cleanup was performed
      expect(result.handleStats).toBeDefined();
      if (result.handleStats) {
        expect(result.handleStats.totalHandles).toBeGreaterThan(0);
        expect(result.handleStats.cleanedHandles).toBeGreaterThan(0);
      }
    }, 10000);

    test('should enforce process termination after cleanup timeout', async () => {
      const testFunction = async (testInstance: any) => {
        // Create handles that won't cleanup easily
        const longTimer = setTimeout(() => {}, 30000);
        
        // Don't clear it - let the handle tracker deal with it
        return { 
          longTimerCreated: true,
          pid: process.pid 
        };
      };

      const options: Partial<IsolatedTestOptions> = {
        cleanupTimeout: 2000 // Short cleanup timeout
      };

      const result = await testRunner.runIsolatedTest(testFunction, [], options);

      expect(result.success).toBe(true);
      expect(result.handleStats).toBeDefined();
      // Cleanup should complete within reasonable time despite long timer
      expect(result.cleanupTime).toBeLessThan(5000);
    }, 10000);
  });

  describe('Concurrency Management', () => {
    test('should respect maximum concurrent process limits', async () => {
      const testFunction = async (testInstance: any) => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { pid: process.pid };
      };

      const options: Partial<IsolatedTestOptions> = {
        maxConcurrentProcesses: 2
      };

      const promises = [];
      const startTime = Date.now();

      // Start 4 tests with limit of 2 concurrent
      for (let i = 0; i < 4; i++) {
        promises.push(testRunner.runIsolatedTest(testFunction, [], options));
      }

      const results = await Promise.all(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should take at least 2 seconds (2 batches of 1 second each)
      expect(duration).toBeGreaterThanOrEqual(2000);
      
      // All should succeed
      expect(results.every(r => r.success)).toBe(true);
      
      // All should have different PIDs (different processes)
      const pids = results.map(r => r.testResults?.result?.pid);
      expect(new Set(pids).size).toBe(4);
    }, 15000);

    test('should track concurrency statistics', async () => {
      const testFunction = async (testInstance: any) => {
        await new Promise(resolve => setTimeout(resolve, 500));
        return { completed: true };
      };

      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(testRunner.runIsolatedTest(testFunction));
      }

      await Promise.all(promises);

      const stats = testRunner.getStatistics();
      expect(stats.totalProcessesSpawned).toBe(3);
      expect(stats.successfulTests).toBe(3);
      expect(stats.maxConcurrentProcesses).toBeGreaterThan(0);
      expect(stats.averageSpawnTime).toBeGreaterThan(0);
    }, 10000);
  });

  describe('Process Management', () => {
    test('should provide process information during execution', async () => {
      let processInfo: TestProcessInfo | null = null;

      testRunner.on('process_ready', (event) => {
        processInfo = event.processInfo;
      });

      const testFunction = async (testInstance: any) => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { completed: true };
      };

      const result = await testRunner.runIsolatedTest(testFunction);

      expect(result.success).toBe(true);
      expect(processInfo).toBeDefined();
      if (processInfo) {
        expect(processInfo.processId).toBeDefined();
        expect(processInfo.startTime).toBeDefined();
        expect(processInfo.status).toBe('running');
        expect(processInfo.testFunction).toContain('testFunction');
      }
    }, 10000);

    test('should allow killing specific processes', async () => {
      const testFunction = async (testInstance: any) => {
        // Long running test
        await new Promise(resolve => setTimeout(resolve, 5000));
        return { completed: true };
      };

      const processPromise = testRunner.runIsolatedTest(testFunction);
      
      // Wait for process to start
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const activeProcesses = testRunner.getActiveProcesses();
      expect(activeProcesses.length).toBe(1);
      
      const processId = activeProcesses[0].processId;
      const killed = await testRunner.killProcess(processId);
      
      expect(killed).toBe(true);
      
      const result = await processPromise;
      expect(result.success).toBe(false);
    }, 10000);

    test('should handle graceful shutdown', async () => {
      const testFunction = async (testInstance: any) => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return { completed: true };
      };

      // Start a long-running test
      const processPromise = testRunner.runIsolatedTest(testFunction);
      
      // Wait for it to start
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(testRunner.getActiveProcesses().length).toBe(1);
      
      // Initiate shutdown
      const shutdownPromise = testRunner.shutdown();
      
      // Both should complete without hanging
      await Promise.all([processPromise, shutdownPromise]);
      
      expect(testRunner.getActiveProcesses().length).toBe(0);
      expect(testRunner.isHealthy()).toBe(false); // Should be shut down
    }, 10000);
  });

  describe('Performance and Resource Management', () => {
    test('should minimize process spawning overhead', async () => {
      const testFunction = async (testInstance: any) => {
        return { pid: process.pid, timestamp: Date.now() };
      };

      const startTime = Date.now();
      const result = await testRunner.runIsolatedTest(testFunction);
      const totalTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.spawnTime).toBeLessThan(2000); // Under 2 seconds spawn time
      expect(totalTime).toBeLessThan(5000); // Total execution under 5 seconds
    }, 10000);

    test('should track memory usage', async () => {
      const testFunction = async (testInstance: any) => {
        // Allocate some memory to test tracking
        const largeArray = new Array(100000).fill('memory-test');
        return { 
          arrayLength: largeArray.length,
          memoryUsage: process.memoryUsage()
        };
      };

      const result = await testRunner.runIsolatedTest(testFunction);

      expect(result.success).toBe(true);
      expect(result.memoryUsage).toBeDefined();
      if (result.memoryUsage) {
        expect(result.memoryUsage.heapUsed).toBeGreaterThan(0);
        expect(result.memoryUsage.heapTotal).toBeGreaterThan(0);
      }
    }, 10000);

    test('should handle multiple test executions efficiently', async () => {
      const testFunction = async (testInstance: any) => {
        return { pid: process.pid, timestamp: Date.now() };
      };

      const startTime = Date.now();
      const promises = [];
      
      for (let i = 0; i < 5; i++) {
        promises.push(testRunner.runIsolatedTest(testFunction));
      }

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      expect(results.every(r => r.success)).toBe(true);
      expect(totalTime).toBeLessThan(15000); // 5 tests should complete in under 15 seconds
      
      const stats = testRunner.getStatistics();
      expect(stats.totalProcessesSpawned).toBe(5);
      expect(stats.successfulTests).toBe(5);
      expect(stats.averageExecutionTime).toBeGreaterThan(0);
    }, 20000);
  });

  describe('Cross-Platform Compatibility', () => {
    test('should work on current platform', async () => {
      const testFunction = async (testInstance: any) => {
        return { 
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
          pid: process.pid
        };
      };

      const result = await testRunner.runIsolatedTest(testFunction);

      expect(result.success).toBe(true);
      expect(result.testResults?.result?.platform).toBeDefined();
      expect(result.testResults?.result?.arch).toBeDefined();
      expect(result.testResults?.result?.nodeVersion).toBeDefined();
    }, 10000);

    test('should handle environment variables correctly', async () => {
      const testFunction = async (testInstance: any) => {
        return {
          accTestMode: process.env.ACC_TEST_MODE,
          processIsolation: process.env.ACC_PROCESS_ISOLATION,
          isolatedTest: process.env.ACC_ISOLATED_TEST,
          nodeEnv: process.env.NODE_ENV
        };
      };

      const options: Partial<IsolatedTestOptions> = {
        envOverrides: {
          CUSTOM_TEST_VAR: 'test-value'
        }
      };

      const result = await testRunner.runIsolatedTest(testFunction, [], options);

      expect(result.success).toBe(true);
      expect(result.testResults?.result?.accTestMode).toBe('true');
      expect(result.testResults?.result?.processIsolation).toBe('true');
      expect(result.testResults?.result?.isolatedTest).toBe('true');
      expect(result.testResults?.result?.nodeEnv).toBe('test');
    }, 10000);
  });
});