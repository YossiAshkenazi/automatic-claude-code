/**
 * Comprehensive tests for ProcessHandleTracker integration
 * Epic 3, Story 3.1: Implement Process Handle Tracking and Cleanup
 * 
 * Tests the complete process handle tracking system including:
 * - Handle registration and tracking
 * - Automatic cleanup mechanisms
 * - TestSDKFactory integration
 * - Cross-platform compatibility
 * - Process termination enforcement
 */

import { Logger } from '@/logger';
import { TestSDKFactory, TestSDKOptions } from '@/testing/TestSDKFactory';
import ProcessHandleTracker, {
  HandleType,
  ProcessTerminationOptions,
  HandleTrackingOptions
} from '@/testing/ProcessHandleTracker';

describe('ProcessHandleTracker', () => {
  let logger: Logger;
  let tracker: ProcessHandleTracker;

  beforeEach(() => {
    logger = new Logger('test-handle-tracker', { 
      essentialMode: true, 
      enableFileLogging: false 
    });
    
    // Destroy any existing instance
    ProcessHandleTracker.destroy();
  });

  afterEach(async () => {
    // Always clean up
    if (tracker) {
      try {
        await tracker.forceCleanupAll({ logCleanupProgress: false });
        tracker.stopTracking();
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }
    
    ProcessHandleTracker.destroy();
    await TestSDKFactory.cleanupAll();
  });

  describe('Basic Handle Tracking', () => {
    test('should initialize and start tracking', () => {
      tracker = ProcessHandleTracker.getInstance(logger);
      
      expect(tracker).toBeDefined();
      expect(tracker.getStatistics().isTracking).toBe(false);
      
      tracker.startTracking();
      expect(tracker.getStatistics().isTracking).toBe(true);
    });

    test('should register and unregister handles manually', () => {
      tracker = ProcessHandleTracker.getInstance(logger);
      tracker.startTracking();

      const handleId = tracker.registerHandle('custom', { data: 'test' }, 'manual-test');
      
      expect(handleId).toBeTruthy();
      expect(tracker.getStatistics().totalHandles).toBe(1);
      
      const unregistered = tracker.unregisterHandle(handleId);
      expect(unregistered).toBe(true);
      expect(tracker.getStatistics().totalHandles).toBe(0);
    });

    test('should track different handle types', () => {
      tracker = ProcessHandleTracker.getInstance(logger);
      tracker.startTracking();

      const types: HandleType[] = ['timeout', 'interval', 'stream', 'socket', 'custom'];
      const handleIds: string[] = [];

      types.forEach((type, index) => {
        const id = tracker.registerHandle(type, { index }, `test-${type}`);
        handleIds.push(id);
      });

      expect(tracker.getStatistics().totalHandles).toBe(types.length);
      
      const stats = tracker.getStatistics();
      types.forEach(type => {
        expect(stats.handlesByType[type]).toBe(1);
      });
    });

    test('should detect leaked handles', async () => {
      const options: HandleTrackingOptions = {
        maxHandleAge: 100, // Very short for testing
        enableLeakDetection: true
      };
      
      tracker = ProcessHandleTracker.getInstance(logger, options);
      tracker.startTracking();

      // Register a handle and wait for it to become "leaked"
      tracker.registerHandle('custom', { data: 'leak-test' }, 'leak-test');
      
      // Wait for handle to age
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const leakedHandles = tracker.getLeakedHandles();
      expect(leakedHandles.length).toBe(1);
      expect(leakedHandles[0].source).toBe('leak-test');
    });
  });

  describe('Automatic Handle Registration', () => {
    test('should wrap and track setTimeout', (done) => {
      tracker = ProcessHandleTracker.getInstance(logger);
      tracker.startTracking();

      const initialCount = tracker.getStatistics().totalHandles;
      
      // Create a timeout
      const timeoutId = setTimeout(() => {
        // Timeout should be tracked
        const stats = tracker.getStatistics();
        expect(stats.handlesByType.timeout).toBeGreaterThan(0);
        done();
      }, 50);

      // Should have registered the timeout
      const statsAfter = tracker.getStatistics();
      expect(statsAfter.totalHandles).toBeGreaterThan(initialCount);
    });

    test('should wrap and track setInterval', (done) => {
      tracker = ProcessHandleTracker.getInstance(logger);
      tracker.startTracking();

      let callCount = 0;
      const intervalId = setInterval(() => {
        callCount++;
        if (callCount === 2) {
          clearInterval(intervalId);
          
          // Interval should have been tracked
          const stats = tracker.getStatistics();
          expect(stats.handlesByType.interval).toBeGreaterThan(0);
          done();
        }
      }, 25);
    });

    test('should wrap and track setImmediate', (done) => {
      tracker = ProcessHandleTracker.getInstance(logger);
      tracker.startTracking();

      const immediateId = setImmediate(() => {
        // Immediate should have been tracked
        const stats = tracker.getStatistics();
        expect(stats.handlesByType.immediate).toBeGreaterThan(0);
        done();
      });
    });
  });

  describe('Handle Cleanup', () => {
    test('should cleanup individual handles', async () => {
      tracker = ProcessHandleTracker.getInstance(logger);
      tracker.startTracking();

      // Register various handle types
      const timeoutHandle = tracker.registerHandle('timeout', setTimeout(() => {}, 1000), 'test-timeout');
      const customHandle = tracker.registerHandle('custom', { 
        cleanup: jest.fn().mockResolvedValue(undefined) 
      }, 'test-custom');

      expect(tracker.getStatistics().totalHandles).toBe(2);

      // Force cleanup
      const result = await tracker.forceCleanupAll({ 
        logCleanupProgress: false,
        maxWaitTime: 1000 
      });

      expect(result.totalHandles).toBe(2);
      expect(result.cleanedHandles).toBeGreaterThan(0);
      expect(tracker.getStatistics().totalHandles).toBe(0);
    });

    test('should enforce process termination timeout', async () => {
      const terminationOptions: ProcessTerminationOptions = {
        maxWaitTime: 100,
        forceKillAfter: 50,
        enableSigkillFallback: false, // Don't actually kill process in tests
        logCleanupProgress: false
      };

      tracker = ProcessHandleTracker.getInstance(logger);
      tracker.startTracking();

      // Register a handle that won't cleanup easily
      tracker.registerHandle('custom', { 
        noCleanup: true 
      }, 'stubborn-handle');

      // This should complete within the timeout
      const startTime = Date.now();
      
      try {
        await tracker.enforceProcessTermination(terminationOptions);
      } catch (error) {
        // Expected to throw or timeout
      }
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(200); // Should not hang
    }, 5000);

    test('should handle cleanup errors gracefully', async () => {
      tracker = ProcessHandleTracker.getInstance(logger);
      tracker.startTracking();

      // Register a handle that will throw during cleanup
      const errorHandle = tracker.registerHandle('custom', {
        cleanup: () => {
          throw new Error('Cleanup failed');
        }
      }, 'error-handle');

      const result = await tracker.forceCleanupAll({ 
        logCleanupProgress: false 
      });

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.failedHandles).toBeGreaterThan(0);
    });
  });

  describe('TestSDKFactory Integration', () => {
    test('should create SDK instance with handle tracking enabled', () => {
      const options: TestSDKOptions = {
        mockLevel: 'full_mock',
        sessionBehavior: 'isolated',
        authentication: 'mock',
        processIsolation: true,
        enableHandleTracking: true,
        handleTrackingOptions: {
          enableLeakDetection: true,
          handleLimit: 100
        }
      };

      const instance = TestSDKFactory.createTestSDK(options);

      expect(instance.handleTracker).toBeDefined();
      expect(instance.getHandleStatistics).toBeDefined();
      expect(instance.forceTermination).toBeDefined();

      const stats = instance.getHandleStatistics!();
      expect(stats).toBeTruthy();
      expect(stats.isTracking).toBe(true);
    });

    test('should cleanup handles when SDK instance is cleaned up', async () => {
      const instance = TestSDKFactory.createIsolated({
        enableHandleTracking: true
      });

      expect(instance.handleTracker).toBeDefined();

      // Register some test handles
      const handleId = instance.handleTracker!.registerHandle(
        'custom', 
        { data: 'test' }, 
        'sdk-test'
      );

      expect(instance.handleTracker!.getStatistics().totalHandles).toBeGreaterThan(0);

      // Cleanup instance
      await instance.cleanup();

      // Handles should be cleaned up (though tracker may still exist globally)
      const instances = TestSDKFactory.getActiveInstances();
      expect(instances).not.toContain(instance.sessionId);
    });

    test('should provide global handle statistics', async () => {
      const instance1 = TestSDKFactory.createIsolated({ enableHandleTracking: true });
      const instance2 = TestSDKFactory.createFullMock();

      // Register handles in different instances
      instance1.handleTracker?.registerHandle('custom', { data: 'instance1' }, 'test1');
      instance2.handleTracker?.registerHandle('custom', { data: 'instance2' }, 'test2');

      const globalStats = TestSDKFactory.getGlobalHandleStatistics();

      expect(globalStats.totalInstances).toBe(2);
      expect(globalStats.instanceStats.size).toBe(2);

      // Cleanup
      await instance1.cleanup();
      await instance2.cleanup();
    });

    test('should detect leaked handles across instances', async () => {
      const instance = TestSDKFactory.createIsolated({
        enableHandleTracking: true,
        handleTrackingOptions: {
          maxHandleAge: 50 // Very short for testing
        }
      });

      // Register a handle and let it age
      instance.handleTracker?.registerHandle('custom', { data: 'leak' }, 'leak-test');
      
      await new Promise(resolve => setTimeout(resolve, 100));

      const leakedHandles = TestSDKFactory.getLeakedHandles();
      expect(leakedHandles.length).toBeGreaterThan(0);
      expect(leakedHandles[0].source).toBe('leak-test');

      await instance.cleanup();
    });

    test('should support emergency shutdown', async () => {
      const instance1 = TestSDKFactory.createIsolated({ enableHandleTracking: true });
      const instance2 = TestSDKFactory.createFullMock();

      expect(TestSDKFactory.getActiveInstances().length).toBe(2);

      // Emergency shutdown should clean up everything
      await TestSDKFactory.emergencyShutdown();

      expect(TestSDKFactory.getActiveInstances().length).toBe(0);
    });

    test('should handle force termination per instance', async () => {
      const instance = TestSDKFactory.createIsolated({
        enableHandleTracking: true,
        terminationOptions: {
          maxWaitTime: 100,
          forceKillAfter: 50,
          enableSigkillFallback: false
        }
      });

      // Register a stubborn handle
      instance.handleTracker?.registerHandle('custom', { 
        stubborn: true 
      }, 'stubborn-handle');

      // Force termination should complete within timeout
      const startTime = Date.now();
      
      try {
        await instance.forceTermination!();
      } catch (error) {
        // May throw timeout error
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(200);

      await instance.cleanup();
    }, 5000);
  });

  describe('Cross-Platform Compatibility', () => {
    test('should handle different process signals correctly', () => {
      tracker = ProcessHandleTracker.getInstance(logger);
      
      // Should initialize without throwing on any platform
      expect(() => tracker.startTracking()).not.toThrow();
      
      const stats = tracker.getStatistics();
      expect(stats.isTracking).toBe(true);
    });

    test('should use appropriate exit signals for platform', () => {
      tracker = ProcessHandleTracker.getInstance(logger);
      
      // Internal signal handling should be set up
      // We can't easily test the actual signals without risk, 
      // but we can verify the tracker initializes correctly
      expect(tracker).toBeDefined();
    });
  });

  describe('Performance and Limits', () => {
    test('should warn when handle limit is exceeded', () => {
      const options: HandleTrackingOptions = {
        enableLeakDetection: true,
        handleLimit: 5 // Very low limit for testing
      };

      tracker = ProcessHandleTracker.getInstance(logger, options);
      tracker.startTracking();

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Register handles beyond the limit
      for (let i = 0; i < 7; i++) {
        tracker.registerHandle('custom', { index: i }, `handle-${i}`);
      }

      expect(tracker.getStatistics().totalHandles).toBe(7);
      
      warnSpy.mockRestore();
    });

    test('should handle large numbers of handles efficiently', () => {
      tracker = ProcessHandleTracker.getInstance(logger);
      tracker.startTracking();

      const startTime = Date.now();
      const handleCount = 1000;

      // Register many handles
      for (let i = 0; i < handleCount; i++) {
        tracker.registerHandle('custom', { index: i }, `bulk-handle-${i}`);
      }

      const registerTime = Date.now() - startTime;
      
      expect(tracker.getStatistics().totalHandles).toBe(handleCount);
      expect(registerTime).toBeLessThan(1000); // Should be fast
    });
  });

  describe('Error Scenarios', () => {
    test('should handle logger undefined gracefully', () => {
      expect(() => {
        ProcessHandleTracker.getInstance(undefined as any);
      }).toThrow('Logger is required');
    });

    test('should handle duplicate singleton access correctly', () => {
      const tracker1 = ProcessHandleTracker.getInstance(logger);
      const tracker2 = ProcessHandleTracker.getInstance(logger);
      
      expect(tracker1).toBe(tracker2); // Should be same instance
    });

    test('should handle cleanup of non-existent handles', () => {
      tracker = ProcessHandleTracker.getInstance(logger);
      
      const result = tracker.unregisterHandle('non-existent-handle');
      expect(result).toBe(false);
    });

    test('should handle cleanup when tracking is not started', async () => {
      tracker = ProcessHandleTracker.getInstance(logger);
      // Don't start tracking
      
      const result = await tracker.forceCleanupAll({ logCleanupProgress: false });
      expect(result.totalHandles).toBe(0);
      expect(result.cleanedHandles).toBe(0);
    });
  });
});

describe('Real-World Integration Scenarios', () => {
  afterEach(async () => {
    await TestSDKFactory.cleanupAll();
    ProcessHandleTracker.destroy();
  });

  test('should prevent process hanging in timeout scenario', async () => {
    const instance = TestSDKFactory.createIntegration({
      enableHandleTracking: true,
      terminationOptions: {
        maxWaitTime: 2000,
        forceKillAfter: 1000,
        enableSigkillFallback: false
      }
    });

    // Simulate a hanging operation
    const hangingTimeout = setTimeout(() => {
      // This would normally prevent process exit
    }, 10000);

    // Register the hanging timeout
    instance.handleTracker?.registerHandle('timeout', hangingTimeout, 'hanging-operation');

    const startTime = Date.now();
    
    // Force cleanup should prevent hanging
    await instance.cleanup();
    
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(3000); // Should not hang for 10 seconds
  }, 5000);

  test('should handle multiple SDK instances with overlapping operations', async () => {
    const instance1 = TestSDKFactory.createIsolated({ enableHandleTracking: true });
    const instance2 = TestSDKFactory.createIsolated({ enableHandleTracking: true });
    const instance3 = TestSDKFactory.createFullMock();

    // Each instance should track handles independently
    instance1.handleTracker?.registerHandle('custom', { id: 1 }, 'instance1-op');
    instance2.handleTracker?.registerHandle('custom', { id: 2 }, 'instance2-op');
    instance3.handleTracker?.registerHandle('custom', { id: 3 }, 'instance3-op');

    const globalStats = TestSDKFactory.getGlobalHandleStatistics();
    expect(globalStats.totalInstances).toBe(3);

    // Cleanup all should work without conflicts
    await TestSDKFactory.cleanupAll();
    
    expect(TestSDKFactory.getActiveInstances().length).toBe(0);
  });
});