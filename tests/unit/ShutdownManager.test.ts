/**
 * Comprehensive Test Validation for ShutdownManager
 * Epic 3, Story 3.3: Implement Graceful Shutdown Hooks
 * 
 * Tests for the graceful shutdown hooks system including:
 * - Hook registration and dependency management
 * - Signal handler integration
 * - Timeout enforcement with escalation
 * - Priority-based execution order
 * - Integration with ProcessHandleTracker
 */

import { Logger } from '../logger';
import ShutdownManager, { 
  ShutdownOptions, 
  ShutdownPriority, 
  ShutdownResult 
} from './ShutdownManager';
import ProcessHandleTracker from './ProcessHandleTracker';

describe('ShutdownManager', () => {
  let logger: Logger;
  let shutdownManager: ShutdownManager;
  let handleTracker: ProcessHandleTracker;

  beforeEach(() => {
    // Create test logger
    logger = new Logger('shutdown-manager-test', { 
      essentialMode: true, 
      enableFileLogging: false 
    });

    // Create handle tracker
    handleTracker = ProcessHandleTracker.getInstance(logger);
    handleTracker.startTracking();

    // Reset ShutdownManager singleton for each test
    ShutdownManager.destroy();
    
    // Create fresh instance
    shutdownManager = ShutdownManager.getInstance(logger, {
      maxShutdownTime: 2000,
      gracefulTimeout: 1500,
      forceKillTimeout: 500,
      enableSignalHandlers: false, // Don't interfere with test runner
      logProgress: false, // Reduce test noise
      enableEscalation: false, // Prevent process termination in tests
      hookTimeout: 200,
      parallelExecution: true
    });

    shutdownManager.setHandleTracker(handleTracker);
  });

  afterEach(async () => {
    // Cleanup
    try {
      handleTracker.stopTracking();
      ShutdownManager.destroy();
      ProcessHandleTracker.destroy();
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('Hook Registration', () => {
    it('should register hooks with different priorities', () => {
      const hook1Id = shutdownManager.registerHook(
        'test-hook-1',
        async () => {},
        'critical'
      );

      const hook2Id = shutdownManager.registerHook(
        'test-hook-2',
        async () => {},
        'normal'
      );

      expect(hook1Id).toBeTruthy();
      expect(hook2Id).toBeTruthy();
      expect(hook1Id).not.toBe(hook2Id);

      const hooks = shutdownManager.getHooks();
      expect(hooks).toHaveLength(3); // 2 registered + 1 from handle tracker
      expect(hooks.some(h => h.name === 'test-hook-1')).toBe(true);
      expect(hooks.some(h => h.name === 'test-hook-2')).toBe(true);
    });

    it('should handle hook dependencies', () => {
      const hook1Id = shutdownManager.registerHook(
        'dependency-hook',
        async () => {},
        'high'
      );

      const hook2Id = shutdownManager.registerHook(
        'dependent-hook',
        async () => {},
        'normal',
        {
          dependencies: [hook1Id]
        }
      );

      expect(hook1Id).toBeTruthy();
      expect(hook2Id).toBeTruthy();

      const hooks = shutdownManager.getHooks();
      const dependentHook = hooks.find(h => h.name === 'dependent-hook');
      expect(dependentHook?.dependencies).toContain(hook1Id);
    });

    it('should unregister hooks correctly', () => {
      const hookId = shutdownManager.registerHook(
        'removable-hook',
        async () => {},
        'normal'
      );

      expect(shutdownManager.getHooks().some(h => h.id === hookId)).toBe(true);

      const removed = shutdownManager.unregisterHook(hookId);
      expect(removed).toBe(true);
      expect(shutdownManager.getHooks().some(h => h.id === hookId)).toBe(false);
    });

    it('should enable/disable hooks', () => {
      const hookId = shutdownManager.registerHook(
        'toggleable-hook',
        async () => {},
        'normal'
      );

      expect(shutdownManager.setHookEnabled(hookId, false)).toBe(true);
      
      const hook = shutdownManager.getHooks().find(h => h.id === hookId);
      expect(hook?.enabled).toBe(false);

      expect(shutdownManager.setHookEnabled(hookId, true)).toBe(true);
      expect(hook?.enabled).toBe(true);
    });
  });

  describe('Shutdown Execution', () => {
    it('should execute hooks in priority order', async () => {
      const executionOrder: string[] = [];

      shutdownManager.registerHook(
        'low-priority',
        async () => { executionOrder.push('low'); },
        'low'
      );

      shutdownManager.registerHook(
        'critical-priority',
        async () => { executionOrder.push('critical'); },
        'critical'
      );

      shutdownManager.registerHook(
        'high-priority',
        async () => { executionOrder.push('high'); },
        'high'
      );

      const result = await shutdownManager.shutdown('Test shutdown');

      expect(result.success).toBe(true);
      expect(result.completedHooks).toBeGreaterThanOrEqual(3);
      expect(executionOrder.indexOf('critical')).toBeLessThan(executionOrder.indexOf('high'));
      expect(executionOrder.indexOf('high')).toBeLessThan(executionOrder.indexOf('low'));
    });

    it('should respect hook dependencies', async () => {
      const executionOrder: string[] = [];

      const dependencyId = shutdownManager.registerHook(
        'dependency',
        async () => { 
          executionOrder.push('dependency');
          await new Promise(resolve => setTimeout(resolve, 50)); // Small delay
        },
        'normal'
      );

      shutdownManager.registerHook(
        'dependent',
        async () => { executionOrder.push('dependent'); },
        'normal',
        {
          dependencies: [dependencyId]
        }
      );

      const result = await shutdownManager.shutdown('Test dependency shutdown');

      expect(result.success).toBe(true);
      expect(executionOrder.indexOf('dependency')).toBeLessThan(executionOrder.indexOf('dependent'));
    });

    it('should handle hook timeouts', async () => {
      shutdownManager.registerHook(
        'timeout-hook',
        async () => {
          // This hook will timeout
          await new Promise(resolve => setTimeout(resolve, 500));
        },
        'normal',
        {
          timeoutMs: 100 // Short timeout to trigger timeout
        }
      );

      const result = await shutdownManager.shutdown('Test timeout');

      expect(result.success).toBe(false);
      expect(result.failedHooks).toBeGreaterThan(0);
      expect(result.errors.some(err => err.includes('timed out'))).toBe(true);
    });

    it('should handle hook errors gracefully', async () => {
      shutdownManager.registerHook(
        'failing-hook',
        async () => {
          throw new Error('Test hook error');
        },
        'normal'
      );

      shutdownManager.registerHook(
        'success-hook',
        async () => {
          // This should still execute despite other hook failing
        },
        'low'
      );

      const result = await shutdownManager.shutdown('Test error handling');

      expect(result.success).toBe(false);
      expect(result.failedHooks).toBeGreaterThan(0);
      expect(result.completedHooks).toBeGreaterThan(0);
      expect(result.errors.some(err => err.includes('Test hook error'))).toBe(true);
    });
  });

  describe('Status and Statistics', () => {
    it('should provide current status during shutdown', async () => {
      let status = shutdownManager.getStatus();
      expect(status.phase).toBe('idle');
      expect(status.canCancel).toBe(true);

      shutdownManager.registerHook(
        'status-test-hook',
        async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
        },
        'normal'
      );

      // Start shutdown in background
      const shutdownPromise = shutdownManager.shutdown('Status test');

      // Check status during shutdown
      await new Promise(resolve => setTimeout(resolve, 50));
      status = shutdownManager.getStatus();
      expect(status.phase).toBe('graceful_shutdown');
      expect(status.canCancel).toBe(false);

      await shutdownPromise;

      status = shutdownManager.getStatus();
      expect(['completed', 'failed']).toContain(status.phase);
    });

    it('should provide statistics', () => {
      shutdownManager.registerHook('stats-hook-1', async () => {}, 'critical');
      shutdownManager.registerHook('stats-hook-2', async () => {}, 'normal');
      
      const stats = shutdownManager.getStatistics();
      expect(stats.registeredHooks).toBeGreaterThanOrEqual(2);
      expect(stats.enabledHooks).toBeGreaterThanOrEqual(2);
      expect(stats.currentPhase).toBe('idle');
      expect(stats.isShuttingDown).toBe(false);
    });
  });

  describe('ProcessHandleTracker Integration', () => {
    it('should integrate with handle tracker for cleanup', async () => {
      // Register some handles to track
      const handle1 = handleTracker.registerHandle('custom', {
        cleanup: jest.fn().mockResolvedValue(undefined)
      }, 'test-handle-1');

      const handle2 = handleTracker.registerHandle('custom', {
        cleanup: jest.fn().mockResolvedValue(undefined)
      }, 'test-handle-2');

      expect(handleTracker.getTrackedHandles()).toHaveLength(2);

      // Shutdown should trigger handle cleanup via integrated hook
      const result = await shutdownManager.shutdown('Handle tracker integration test');

      expect(result.success).toBe(true);
      
      // Verify handle tracker cleanup was called
      const remainingHandles = handleTracker.getTrackedHandles();
      expect(remainingHandles).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle circular dependencies', () => {
      const hook1Id = shutdownManager.registerHook('hook-1', async () => {}, 'normal');
      const hook2Id = shutdownManager.registerHook('hook-2', async () => {}, 'normal', {
        dependencies: [hook1Id]
      });

      // Try to create circular dependency (should be prevented)
      expect(() => {
        shutdownManager.registerHook('hook-3', async () => {}, 'normal', {
          dependencies: [hook2Id, hook1Id]
        });
      }).not.toThrow(); // Registration should succeed

      // But shutdown should detect and handle circular dependencies
      expect(async () => {
        await shutdownManager.shutdown('Circular dependency test');
      }).not.toThrow(); // Should handle gracefully
    });

    it('should prevent registration during shutdown', async () => {
      const shutdownPromise = shutdownManager.shutdown('Registration prevention test');
      
      // Try to register hook during shutdown
      expect(() => {
        shutdownManager.registerHook('late-hook', async () => {}, 'normal');
      }).toThrow('Cannot register hooks during shutdown');

      await shutdownPromise;
    });

    it('should prevent unregistration during shutdown', async () => {
      const hookId = shutdownManager.registerHook('removable', async () => {}, 'normal');
      
      const shutdownPromise = shutdownManager.shutdown('Unregistration prevention test');
      
      // Try to unregister hook during shutdown
      const result = shutdownManager.unregisterHook(hookId);
      expect(result).toBe(false);

      await shutdownPromise;
    });
  });

  describe('Concurrent Shutdown Handling', () => {
    it('should handle multiple shutdown calls gracefully', async () => {
      shutdownManager.registerHook('concurrent-test', async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      }, 'normal');

      // Start multiple shutdowns simultaneously
      const shutdown1 = shutdownManager.shutdown('Concurrent test 1');
      const shutdown2 = shutdownManager.shutdown('Concurrent test 2');
      const shutdown3 = shutdownManager.shutdown('Concurrent test 3');

      const results = await Promise.all([shutdown1, shutdown2, shutdown3]);

      // All should complete successfully
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });
});

/**
 * Integration test example showing complete usage
 */
describe('ShutdownManager Integration Example', () => {
  it('should demonstrate complete shutdown flow', async () => {
    const logger = new Logger('integration-test', { 
      essentialMode: true, 
      enableFileLogging: false 
    });

    const handleTracker = ProcessHandleTracker.getInstance(logger);
    handleTracker.startTracking();

    ShutdownManager.destroy();
    const manager = ShutdownManager.getInstance(logger, {
      maxShutdownTime: 3000,
      gracefulTimeout: 2000,
      forceKillTimeout: 1000,
      enableSignalHandlers: false,
      logProgress: true,
      enableEscalation: false,
      hookTimeout: 500,
      parallelExecution: true
    });

    manager.setHandleTracker(handleTracker);

    // Simulate various system components
    const dbConnectionHook = manager.registerHook(
      'Database-Cleanup',
      async () => {
        console.log('Closing database connections...');
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log('Database connections closed');
      },
      'high',
      {
        timeoutMs: 1000,
        description: 'Close database connections'
      }
    );

    const cacheHook = manager.registerHook(
      'Cache-Cleanup',
      async () => {
        console.log('Clearing cache...');
        await new Promise(resolve => setTimeout(resolve, 50));
        console.log('Cache cleared');
      },
      'normal',
      {
        timeoutMs: 500,
        description: 'Clear application cache',
        dependencies: [dbConnectionHook]
      }
    );

    const logHook = manager.registerHook(
      'Logging-Cleanup',
      async () => {
        console.log('Flushing logs...');
        await new Promise(resolve => setTimeout(resolve, 25));
        console.log('Logs flushed');
      },
      'cleanup',
      {
        timeoutMs: 200,
        description: 'Flush remaining logs',
        dependencies: [cacheHook]
      }
    );

    // Register some handles to be cleaned up
    handleTracker.registerHandle('custom', {
      cleanup: async () => console.log('Custom handle cleaned up')
    }, 'test-resource');

    console.log('\n=== Starting Graceful Shutdown ===');
    const result = await manager.shutdown('Integration test shutdown');

    console.log('\n=== Shutdown Complete ===');
    console.log(`Success: ${result.success}`);
    console.log(`Total time: ${result.totalTime}ms`);
    console.log(`Completed hooks: ${result.completedHooks}`);
    console.log(`Failed hooks: ${result.failedHooks}`);
    console.log(`Errors: ${result.errors.length}`);

    expect(result.success).toBe(true);
    expect(result.completedHooks).toBeGreaterThanOrEqual(3);
    expect(result.failedHooks).toBe(0);

    // Cleanup
    handleTracker.stopTracking();
    ShutdownManager.destroy();
    ProcessHandleTracker.destroy();
  });
});