/**
 * ShutdownManager Usage Examples
 * Epic 3, Story 3.3: Implement Graceful Shutdown Hooks
 * 
 * Comprehensive examples demonstrating practical usage patterns for the
 * graceful shutdown hooks system in real-world scenarios.
 */

import { Logger } from '../logger';
import ShutdownManager from './ShutdownManager';
import ProcessHandleTracker from './ProcessHandleTracker';
import { TestSDKFactory } from './TestSDKFactory';
import IsolatedTestRunner from './IsolatedTestRunner';

/**
 * Example 1: Basic Shutdown Hook Registration
 */
export async function basicShutdownExample(): Promise<void> {
  console.log('\n=== Basic Shutdown Hook Example ===');

  const logger = new Logger('basic-example', { 
    essentialMode: true, 
    enableFileLogging: false 
  });

  // Create shutdown manager
  ShutdownManager.destroy(); // Ensure clean state
  const manager = ShutdownManager.getInstance(logger, {
    maxShutdownTime: 5000,
    gracefulTimeout: 3000,
    enableSignalHandlers: false, // Don't interfere with main process
    logProgress: true
  });

  // Register cleanup hooks with different priorities
  manager.registerHook(
    'Critical-Resource-Cleanup',
    async () => {
      console.log('🔴 Cleaning up critical resources (file handles, sockets)');
      await simulateCleanup(200);
    },
    'critical',
    {
      timeoutMs: 1000,
      description: 'Clean up file handles and network sockets'
    }
  );

  manager.registerHook(
    'Database-Connection-Cleanup',
    async () => {
      console.log('🟡 Closing database connections');
      await simulateCleanup(300);
    },
    'high',
    {
      timeoutMs: 2000,
      description: 'Close all database connections gracefully'
    }
  );

  manager.registerHook(
    'Cache-Flush',
    async () => {
      console.log('🟢 Flushing application cache');
      await simulateCleanup(150);
    },
    'normal',
    {
      timeoutMs: 1000,
      description: 'Flush in-memory cache to disk'
    }
  );

  manager.registerHook(
    'Log-Flush',
    async () => {
      console.log('🔵 Flushing remaining logs');
      await simulateCleanup(100);
    },
    'cleanup',
    {
      timeoutMs: 500,
      description: 'Flush any remaining log entries'
    }
  );

  // Trigger shutdown
  const result = await manager.shutdown('Basic example shutdown');
  
  console.log(`\n✅ Shutdown completed: ${result.success ? 'SUCCESS' : 'FAILED'}`);
  console.log(`   Total time: ${result.totalTime}ms`);
  console.log(`   Completed: ${result.completedHooks}, Failed: ${result.failedHooks}`);

  ShutdownManager.destroy();
}

/**
 * Example 2: Dependency-Based Shutdown Order
 */
export async function dependencyShutdownExample(): Promise<void> {
  console.log('\n=== Dependency-Based Shutdown Example ===');

  const logger = new Logger('dependency-example', { 
    essentialMode: true, 
    enableFileLogging: false 
  });

  ShutdownManager.destroy();
  const manager = ShutdownManager.getInstance(logger, {
    maxShutdownTime: 6000,
    enableSignalHandlers: false,
    logProgress: true
  });

  // Create dependency chain: API -> Cache -> Database -> Logs
  const dbHookId = manager.registerHook(
    'Database-Shutdown',
    async () => {
      console.log('📊 Shutting down database connections');
      await simulateCleanup(250);
    },
    'high',
    {
      timeoutMs: 2000,
      description: 'Shutdown database layer'
    }
  );

  const cacheHookId = manager.registerHook(
    'Cache-Shutdown',
    async () => {
      console.log('💾 Shutting down cache layer');
      await simulateCleanup(200);
    },
    'high',
    {
      timeoutMs: 1500,
      description: 'Shutdown cache layer',
      dependencies: [dbHookId] // Cache depends on database being closed first
    }
  );

  const apiHookId = manager.registerHook(
    'API-Server-Shutdown',
    async () => {
      console.log('🌐 Shutting down API server');
      await simulateCleanup(300);
    },
    'high',
    {
      timeoutMs: 2000,
      description: 'Shutdown API server',
      dependencies: [cacheHookId] // API depends on cache being closed first
    }
  );

  manager.registerHook(
    'Final-Cleanup',
    async () => {
      console.log('🧹 Performing final cleanup');
      await simulateCleanup(100);
    },
    'cleanup',
    {
      timeoutMs: 1000,
      description: 'Final cleanup tasks',
      dependencies: [apiHookId] // Final cleanup depends on API being closed
    }
  );

  const result = await manager.shutdown('Dependency example shutdown');
  
  console.log(`\n✅ Dependency shutdown: ${result.success ? 'SUCCESS' : 'FAILED'}`);
  console.log(`   Execution order was enforced by dependencies`);

  ShutdownManager.destroy();
}

/**
 * Example 3: Integration with ProcessHandleTracker
 */
export async function handleTrackerIntegrationExample(): Promise<void> {
  console.log('\n=== ProcessHandleTracker Integration Example ===');

  const logger = new Logger('handle-tracker-example', { 
    essentialMode: true, 
    enableFileLogging: false 
  });

  // Create handle tracker
  const handleTracker = ProcessHandleTracker.getInstance(logger);
  handleTracker.startTracking();

  // Simulate some tracked resources
  const timer1 = setInterval(() => {}, 1000);
  const timer2 = setTimeout(() => {}, 5000);
  
  handleTracker.registerHandle('custom', {
    cleanup: async () => {
      console.log('🔧 Cleaning up custom resource 1');
      await simulateCleanup(100);
    }
  }, 'custom-resource-1');

  handleTracker.registerHandle('custom', {
    cleanup: async () => {
      console.log('🔧 Cleaning up custom resource 2');
      await simulateCleanup(150);
    }
  }, 'custom-resource-2');

  console.log(`📊 Tracked handles before shutdown: ${handleTracker.getTrackedHandles().length}`);

  // Create shutdown manager with handle tracker integration
  ShutdownManager.destroy();
  const manager = ShutdownManager.getInstance(logger, {
    maxShutdownTime: 5000,
    enableSignalHandlers: false,
    logProgress: true
  });

  // Integration: Handle tracker cleanup will be registered automatically
  manager.setHandleTracker(handleTracker);

  // Add some additional application-specific hooks
  manager.registerHook(
    'Application-State-Cleanup',
    async () => {
      console.log('📱 Cleaning up application state');
      await simulateCleanup(200);
    },
    'normal',
    {
      timeoutMs: 1000,
      description: 'Clean up application state'
    }
  );

  const result = await manager.shutdown('Handle tracker integration');
  
  console.log(`\n✅ Handle tracker integration: ${result.success ? 'SUCCESS' : 'FAILED'}`);
  console.log(`📊 Tracked handles after shutdown: ${handleTracker.getTrackedHandles().length}`);

  // Cleanup timers
  clearInterval(timer1);
  clearTimeout(timer2);

  handleTracker.stopTracking();
  ProcessHandleTracker.destroy();
  ShutdownManager.destroy();
}

/**
 * Example 4: TestSDK Integration with Automatic Shutdown
 */
export async function testSDKIntegrationExample(): Promise<void> {
  console.log('\n=== TestSDK Integration Example ===');

  // Create test SDK with shutdown hooks enabled
  const testInstance = TestSDKFactory.createIsolated({
    enableShutdownHooks: true,
    enableLogging: true,
    logLevel: 'info',
    shutdownOptions: {
      maxShutdownTime: 4000,
      gracefulTimeout: 3000,
      logProgress: true
    }
  });

  console.log('🧪 Test SDK instance created with shutdown hooks enabled');

  // Check shutdown manager is available
  if (testInstance.shutdownManager) {
    console.log('✅ ShutdownManager is integrated with TestSDK');
    
    // Register test-specific cleanup hooks
    testInstance.shutdownManager.registerHook(
      'Test-Data-Cleanup',
      async () => {
        console.log('🗑️ Cleaning up test data');
        await simulateCleanup(150);
      },
      'normal',
      {
        description: 'Clean up test-specific data'
      }
    );

    testInstance.shutdownManager.registerHook(
      'Mock-Service-Cleanup',
      async () => {
        console.log('🎭 Cleaning up mock services');
        await simulateCleanup(100);
      },
      'low',
      {
        description: 'Clean up mock service instances'
      }
    );

    // Get status before shutdown
    const status = testInstance.getShutdownStatus!();
    console.log(`📊 Shutdown status: ${status.phase}, Hooks: ${status.progress.total}`);

    // Trigger graceful shutdown
    await testInstance.gracefulShutdown!('Test SDK integration example');
  }

  // Cleanup
  await testInstance.cleanup();
  console.log('✅ TestSDK integration example completed');
}

/**
 * Example 5: IsolatedTestRunner with Shutdown Management
 */
export async function isolatedTestRunnerExample(): Promise<void> {
  console.log('\n=== IsolatedTestRunner with Shutdown Management Example ===');

  const logger = new Logger('test-runner-example', { 
    essentialMode: true, 
    enableFileLogging: false 
  });

  // Create test runner with shutdown hooks enabled
  const testRunner = new IsolatedTestRunner(logger, {
    maxConcurrentProcesses: 2,
    enableShutdownHooks: true,
    shutdownOptions: {
      maxShutdownTime: 8000,
      gracefulTimeout: 6000,
      logProgress: true
    }
  });

  // Example test function to run in isolation
  const exampleTestFunction = async (sdk: any) => {
    console.log('🧪 Running example test in isolated process');
    
    // Simulate some test work
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return { success: true, message: 'Test completed successfully' };
  };

  try {
    // Run a few isolated tests
    console.log('🚀 Starting isolated test processes...');
    
    const testPromises = [
      testRunner.runIsolatedTest(exampleTestFunction, [], {
        processTimeout: 5000,
        enableShutdownHooks: true
      }),
      testRunner.runIsolatedTest(exampleTestFunction, [], {
        processTimeout: 5000,
        enableShutdownHooks: true
      })
    ];

    const results = await Promise.all(testPromises);
    
    console.log(`✅ Completed ${results.length} isolated tests`);
    results.forEach((result, index) => {
      console.log(`   Test ${index + 1}: ${result.success ? 'PASSED' : 'FAILED'} (${result.duration}ms)`);
    });

  } catch (error: any) {
    console.log(`❌ Test runner error: ${error.message}`);
  } finally {
    // Shutdown test runner (will use graceful shutdown hooks)
    console.log('🛑 Shutting down test runner with graceful hooks...');
    await testRunner.shutdown();
    console.log('✅ Test runner shutdown completed');
  }
}

/**
 * Example 6: Error Handling and Recovery
 */
export async function errorHandlingExample(): Promise<void> {
  console.log('\n=== Error Handling and Recovery Example ===');

  const logger = new Logger('error-example', { 
    essentialMode: true, 
    enableFileLogging: false 
  });

  ShutdownManager.destroy();
  const manager = ShutdownManager.getInstance(logger, {
    maxShutdownTime: 4000,
    gracefulTimeout: 3000,
    enableSignalHandlers: false,
    logProgress: true
  });

  // Register hooks with various failure modes
  manager.registerHook(
    'Successful-Hook',
    async () => {
      console.log('✅ This hook will succeed');
      await simulateCleanup(100);
    },
    'high'
  );

  manager.registerHook(
    'Timeout-Hook',
    async () => {
      console.log('⏱️ This hook will timeout');
      await simulateCleanup(2000); // Will timeout
    },
    'high',
    {
      timeoutMs: 500 // Short timeout to force failure
    }
  );

  manager.registerHook(
    'Error-Hook',
    async () => {
      console.log('❌ This hook will throw an error');
      throw new Error('Simulated hook error');
    },
    'normal'
  );

  manager.registerHook(
    'Recovery-Hook',
    async () => {
      console.log('🔄 This hook will succeed despite other failures');
      await simulateCleanup(100);
    },
    'low'
  );

  const result = await manager.shutdown('Error handling example');
  
  console.log(`\n📊 Error handling results:`);
  console.log(`   Success: ${result.success}`);
  console.log(`   Completed: ${result.completedHooks}`);
  console.log(`   Failed: ${result.failedHooks}`);
  console.log(`   Timed out: ${result.timedOutHooks}`);
  console.log(`   Errors: ${result.errors.length}`);
  
  result.errors.forEach((error, index) => {
    console.log(`   Error ${index + 1}: ${error}`);
  });

  ShutdownManager.destroy();
}

/**
 * Example 7: Real-World Application Shutdown Pattern
 */
export async function realWorldApplicationExample(): Promise<void> {
  console.log('\n=== Real-World Application Shutdown Pattern ===');

  const logger = new Logger('real-world-app', { 
    essentialMode: true, 
    enableFileLogging: false 
  });

  // Simulate a complete application with multiple subsystems
  class MockWebServer {
    async close() {
      console.log('🌐 Closing web server...');
      await simulateCleanup(300);
    }
  }

  class MockDatabase {
    async disconnect() {
      console.log('🗄️ Disconnecting from database...');
      await simulateCleanup(400);
    }
  }

  class MockQueue {
    async drain() {
      console.log('📬 Draining message queue...');
      await simulateCleanup(200);
    }
  }

  class MockMetrics {
    async flush() {
      console.log('📊 Flushing metrics...');
      await simulateCleanup(150);
    }
  }

  // Create application components
  const webServer = new MockWebServer();
  const database = new MockDatabase();
  const messageQueue = new MockQueue();
  const metrics = new MockMetrics();

  // Setup handle tracking
  const handleTracker = ProcessHandleTracker.getInstance(logger);
  handleTracker.startTracking();

  // Create shutdown manager
  ShutdownManager.destroy();
  const manager = ShutdownManager.getInstance(logger, {
    maxShutdownTime: 10000,
    gracefulTimeout: 8000,
    forceKillTimeout: 2000,
    enableSignalHandlers: true, // Enable signal handling for real app
    logProgress: true,
    enableEscalation: false, // Disable for example
    parallelExecution: true
  });

  manager.setHandleTracker(handleTracker);

  // Register shutdown hooks in logical order
  
  // Phase 1: Stop accepting new requests
  const webHookId = manager.registerHook(
    'WebServer-Shutdown',
    () => webServer.close(),
    'critical',
    {
      timeoutMs: 3000,
      description: 'Stop web server and close connections'
    }
  );

  // Phase 2: Finish processing existing requests and drain queues
  const queueHookId = manager.registerHook(
    'MessageQueue-Drain',
    () => messageQueue.drain(),
    'high',
    {
      timeoutMs: 5000,
      description: 'Drain message queue',
      dependencies: [webHookId]
    }
  );

  // Phase 3: Close database connections
  const dbHookId = manager.registerHook(
    'Database-Disconnect',
    () => database.disconnect(),
    'high',
    {
      timeoutMs: 4000,
      description: 'Disconnect from database',
      dependencies: [queueHookId]
    }
  );

  // Phase 4: Final cleanup and metrics
  manager.registerHook(
    'Metrics-Flush',
    () => metrics.flush(),
    'normal',
    {
      timeoutMs: 2000,
      description: 'Flush final metrics',
      dependencies: [dbHookId]
    }
  );

  // Simulate application startup
  console.log('🚀 Application started, components initialized');
  console.log('📊 Registered shutdown hooks for graceful shutdown');

  // Simulate running for a short time
  await new Promise(resolve => setTimeout(resolve, 500));

  // Simulate shutdown trigger (could be signal, health check failure, etc.)
  console.log('\n🛑 Shutdown initiated...');
  const result = await manager.shutdown('Application shutdown');

  console.log(`\n📊 Application shutdown completed:`);
  console.log(`   Success: ${result.success ? '✅ YES' : '❌ NO'}`);
  console.log(`   Total time: ${result.totalTime}ms`);
  console.log(`   Completed hooks: ${result.completedHooks}`);
  console.log(`   Failed hooks: ${result.failedHooks}`);
  
  if (result.errors.length > 0) {
    console.log(`   Errors:`);
    result.errors.forEach(error => console.log(`     • ${error}`));
  }

  // Cleanup
  handleTracker.stopTracking();
  ProcessHandleTracker.destroy();
  ShutdownManager.destroy();
}

/**
 * Utility function to simulate cleanup work
 */
async function simulateCleanup(durationMs: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, durationMs));
}

/**
 * Run all examples
 */
export async function runAllShutdownExamples(): Promise<void> {
  console.log('🎯 ShutdownManager Examples - Comprehensive Demonstration\n');

  try {
    await basicShutdownExample();
    await dependencyShutdownExample();
    await handleTrackerIntegrationExample();
    await testSDKIntegrationExample();
    await isolatedTestRunnerExample();
    await errorHandlingExample();
    await realWorldApplicationExample();

    console.log('\n🎉 All ShutdownManager examples completed successfully!');
    
  } catch (error: any) {
    console.error(`\n❌ Example failed: ${error.message}`);
    console.error(error.stack);
  }
}

// Auto-run examples if this file is executed directly
if (require.main === module) {
  runAllShutdownExamples().catch(console.error);
}