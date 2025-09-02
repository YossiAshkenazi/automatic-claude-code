/**
 * Usage Examples for Isolated Test Process Spawning
 * Epic 3, Story 3.2: Create Isolated Test Process Spawning
 * 
 * Demonstrates practical usage patterns for IsolatedTestRunner with TestSDKFactory integration.
 */

import { Logger } from '../logger';
import IsolatedTestRunner, { IsolatedTestOptions } from './IsolatedTestRunner';
import { TestSDKFactory, TestSDKOptions } from './TestSDKFactory';

/**
 * Example 1: Basic Isolated Integration Test
 * Demonstrates simple isolated test execution with SDK integration
 */
export async function basicIsolatedIntegrationTest() {
  const logger = new Logger('example-test', { essentialMode: true, enableFileLogging: false });
  const runner = new IsolatedTestRunner(logger);

  try {
    // Define a test that uses the SDK
    const integrationTest = async (testInstance: any) => {
      const { sdk, sessionId, handleTracker } = testInstance;
      
      // Simulate SDK operation
      const result = await sdk.executeWithSDK('test prompt', { timeout: 5000 });
      
      // Verify isolation
      const processInfo = {
        pid: process.pid,
        sessionId,
        sdkAvailable: !!sdk,
        handleTrackerActive: !!handleTracker
      };

      return { result, processInfo };
    };

    // Run the isolated test
    const testResult = await runner.runIsolatedTest(integrationTest);
    
    console.log('Integration test result:', {
      success: testResult.success,
      duration: testResult.duration,
      processId: testResult.processId,
      testResults: testResult.testResults
    });

    return testResult;
  } finally {
    await runner.shutdown();
  }
}

/**
 * Example 2: High-Concurrency Integration Testing
 * Demonstrates running multiple isolated tests concurrently
 */
export async function concurrentIntegrationTests() {
  const logger = new Logger('concurrent-tests', { essentialMode: true, enableFileLogging: false });
  const runner = new IsolatedTestRunner(logger, {
    maxConcurrentProcesses: 3,
    processTimeout: 15000
  });

  try {
    // Define different test scenarios
    const tests = [
      {
        name: 'Authentication Test',
        test: async (testInstance: any) => {
          const authResult = await testInstance.sdk.checkBrowserAuthentication();
          return { testName: 'auth', authResult, pid: process.pid };
        }
      },
      {
        name: 'Session Detection Test', 
        test: async (testInstance: any) => {
          const detector = testInstance.sdk.getSessionDetector();
          const sessionResult = detector.detectNestedSession();
          return { testName: 'session', sessionResult, pid: process.pid };
        }
      },
      {
        name: 'Handle Tracking Test',
        test: async (testInstance: any) => {
          const stats = testInstance.handleTracker.getStatistics();
          return { testName: 'handles', stats, pid: process.pid };
        }
      }
    ];

    // Run all tests concurrently
    const promises = tests.map((testCase, index) => 
      runner.runIsolatedTest(testCase.test, [], {
        testSDKOptions: {
          mockLevel: 'full_mock',
          sessionBehavior: 'isolated',
          authentication: 'mock',
          processIsolation: true,
          enableHandleTracking: true
        }
      })
    );

    const results = await Promise.all(promises);
    
    console.log('Concurrent test results:', {
      totalTests: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      averageDuration: results.reduce((sum, r) => sum + r.duration, 0) / results.length,
      uniqueProcesses: new Set(results.map(r => r.processId)).size
    });

    return results;
  } finally {
    await runner.shutdown();
  }
}

/**
 * Example 3: Process Isolation Verification
 * Demonstrates complete state isolation between test processes
 */
export async function processIsolationVerification() {
  const logger = new Logger('isolation-test', { essentialMode: true, enableFileLogging: false });
  const runner = new IsolatedTestRunner(logger);

  try {
    // Global state in parent process
    (global as any).testCounter = 0;
    (global as any).parentProcessId = process.pid;

    const isolationTest = async (expectedCounter: number, testInstance: any) => {
      // Check that global state doesn't leak
      const globalCounter = (global as any).testCounter || 0;
      const parentPid = (global as any).parentProcessId;
      const currentPid = process.pid;
      
      // Set global state in child process
      (global as any).testCounter = 999;
      
      return {
        globalCounterInChild: globalCounter,
        expectedCounter,
        parentPid,
        currentPid,
        isolated: parentPid !== currentPid,
        sessionId: testInstance.sessionId
      };
    };

    // Run multiple tests with different expected values
    const test1 = await runner.runIsolatedTest(isolationTest, [0]); // Should start with 0
    (global as any).testCounter = 50; // Change parent state
    const test2 = await runner.runIsolatedTest(isolationTest, [0]); // Should still start with 0
    
    console.log('Isolation test results:', {
      test1: test1.testResults?.result,
      test2: test2.testResults?.result,
      parentCounterAfter: (global as any).testCounter // Should still be 50
    });

    return [test1, test2];
  } finally {
    await runner.shutdown();
  }
}

/**
 * Example 4: Error Handling and Recovery
 * Demonstrates how the runner handles various failure scenarios
 */
export async function errorHandlingDemo() {
  const logger = new Logger('error-demo', { essentialMode: true, enableFileLogging: false });
  const runner = new IsolatedTestRunner(logger, {
    processTimeout: 3000,
    cleanupTimeout: 2000
  });

  try {
    const results = [];

    // Test 1: Successful test for comparison
    const successTest = async (testInstance: any) => {
      return { success: true, pid: process.pid };
    };
    results.push(await runner.runIsolatedTest(successTest));

    // Test 2: Throwing an error
    const errorTest = async (testInstance: any) => {
      throw new Error('Intentional test error');
    };
    results.push(await runner.runIsolatedTest(errorTest));

    // Test 3: Process timeout
    const timeoutTest = async (testInstance: any) => {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Longer than 3 second timeout
      return { completed: true };
    };
    results.push(await runner.runIsolatedTest(timeoutTest));

    // Test 4: Memory-intensive test
    const memoryTest = async (testInstance: any) => {
      const bigArray = new Array(1000000).fill('memory-test');
      return { arraySize: bigArray.length, memoryUsage: process.memoryUsage() };
    };
    results.push(await runner.runIsolatedTest(memoryTest));

    console.log('Error handling results:', {
      totalTests: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      timeouts: results.filter(r => r.duration >= 3000).length,
      results: results.map(r => ({
        success: r.success,
        exitCode: r.exitCode,
        duration: r.duration,
        error: r.error
      }))
    });

    return results;
  } finally {
    await runner.shutdown();
  }
}

/**
 * Example 5: Custom Test SDK Configuration
 * Demonstrates different SDK configurations for various test scenarios
 */
export async function customSDKConfigurationTests() {
  const logger = new Logger('sdk-config-tests', { essentialMode: true, enableFileLogging: false });
  const runner = new IsolatedTestRunner(logger);

  try {
    const configurations = [
      {
        name: 'Full Mock Configuration',
        options: {
          testSDKOptions: {
            mockLevel: 'full_mock' as const,
            sessionBehavior: 'bypass' as const,
            authentication: 'mock' as const,
            processIsolation: true,
            enableHandleTracking: true
          }
        }
      },
      {
        name: 'Session Only Mock',
        options: {
          testSDKOptions: {
            mockLevel: 'session_only' as const,
            sessionBehavior: 'isolated' as const,
            authentication: 'mock' as const,
            processIsolation: true,
            enableHandleTracking: true
          }
        }
      },
      {
        name: 'Integration Test Config',
        options: {
          testSDKOptions: {
            mockLevel: 'none' as const,
            sessionBehavior: 'isolated' as const,
            authentication: 'real' as const,
            processIsolation: true,
            enableLogging: true,
            logLevel: 'info' as const,
            timeoutMs: 10000,
            enableHandleTracking: true
          },
          processTimeout: 15000
        }
      }
    ];

    const configTest = async (configName: string, testInstance: any) => {
      const mockLayer = testInstance.getMockLayer ? testInstance.getMockLayer() : null;
      const sessionDetector = testInstance.sdk.getSessionDetector();
      
      return {
        configName,
        pid: process.pid,
        sessionId: testInstance.sessionId,
        hasMockLayer: !!mockLayer,
        sessionDetection: sessionDetector.detectNestedSession(),
        handleTrackerStats: testInstance.handleTracker?.getStatistics()
      };
    };

    const results = [];
    for (const config of configurations) {
      const result = await runner.runIsolatedTest(
        configTest, 
        [config.name], 
        config.options as Partial<IsolatedTestOptions>
      );
      results.push(result);
    }

    console.log('SDK configuration test results:', {
      configurations: configurations.length,
      results: results.map(r => ({
        success: r.success,
        configName: r.testResults?.result?.configName,
        hasMockLayer: r.testResults?.result?.hasMockLayer,
        sessionId: r.testResults?.result?.sessionId,
        handleCount: r.testResults?.result?.handleTrackerStats?.totalHandles
      }))
    });

    return results;
  } finally {
    await runner.shutdown();
  }
}

/**
 * Example 6: Process Handle Tracking Integration
 * Demonstrates integration with ProcessHandleTracker for resource management
 */
export async function handleTrackingIntegrationDemo() {
  const logger = new Logger('handle-tracking-demo', { essentialMode: true, enableFileLogging: false });
  const runner = new IsolatedTestRunner(logger, {
    cleanupTimeout: 5000,
    testSDKOptions: {
      mockLevel: 'session_only',
      sessionBehavior: 'isolated', 
      authentication: 'mock',
      processIsolation: true,
      enableHandleTracking: true,
      handleTrackingOptions: {
        enableLeakDetection: true,
        handleLimit: 50,
        maxHandleAge: 10000
      }
    }
  });

  try {
    const handleTest = async (testInstance: any) => {
      const { handleTracker } = testInstance;
      
      // Create various types of handles
      const timer1 = setTimeout(() => console.log('Timer 1'), 10000);
      const timer2 = setInterval(() => console.log('Interval'), 1000);
      const immediate = setImmediate(() => console.log('Immediate'));
      
      // Register handles for tracking
      handleTracker.registerHandle('timeout', timer1, 'test-timer');
      handleTracker.registerHandle('interval', timer2, 'test-interval');
      handleTracker.registerHandle('immediate', immediate, 'test-immediate');
      
      // Get initial statistics
      const initialStats = handleTracker.getStatistics();
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get final statistics
      const finalStats = handleTracker.getStatistics();
      
      return {
        pid: process.pid,
        initialHandles: initialStats.totalHandles,
        finalHandles: finalStats.totalHandles,
        handlesByType: finalStats.handlesByType,
        leakedHandles: finalStats.leakedHandles,
        isTracking: finalStats.isTracking
      };
    };

    const result = await runner.runIsolatedTest(handleTest);
    
    console.log('Handle tracking integration result:', {
      success: result.success,
      duration: result.duration,
      handleStats: result.handleStats,
      testResults: result.testResults?.result
    });

    return result;
  } finally {
    await runner.shutdown();
  }
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  console.log('Running Isolated Test Process Spawning Examples...\n');
  
  try {
    console.log('1. Basic Integration Test:');
    await basicIsolatedIntegrationTest();
    
    console.log('\n2. Concurrent Integration Tests:');
    await concurrentIntegrationTests();
    
    console.log('\n3. Process Isolation Verification:');
    await processIsolationVerification();
    
    console.log('\n4. Error Handling Demo:');
    await errorHandlingDemo();
    
    console.log('\n5. Custom SDK Configuration Tests:');
    await customSDKConfigurationTests();
    
    console.log('\n6. Handle Tracking Integration Demo:');
    await handleTrackingIntegrationDemo();
    
    console.log('\nAll examples completed successfully!');
    
  } catch (error) {
    console.error('Example execution failed:', error);
  } finally {
    // Final cleanup
    await TestSDKFactory.cleanupAll();
  }
}

// If run directly, execute all examples
if (require.main === module) {
  runAllExamples().catch(console.error);
}