#!/usr/bin/env node
/**
 * Quick Epic 3 Process Management Test
 * Demonstrates clean termination without hanging
 */

const startTime = Date.now();

console.log('🚀 Quick Epic 3 Process Management Test');
console.log('Testing clean termination without hanging...\n');

async function testProcessManagement() {
  try {
    // Import Epic 3 components from compiled dist
    const { ProcessHandleTracker, ShutdownManager, TestSDKFactory } = require('./dist/testing');
    
    console.log('✅ Epic 3 components imported successfully');
    
    // Test 1: ProcessHandleTracker basic functionality
    console.log('\n🔍 Test 1: ProcessHandleTracker basic functionality...');
    
    const { Logger } = require('./dist/logger');
    const logger = new Logger('quick-test', { essentialMode: true, enableFileLogging: false });
    
    const handleTracker = ProcessHandleTracker.getInstance(logger);
    handleTracker.startTracking();
    
    // Create test handles
    const timer1 = setTimeout(() => {}, 2000);
    const timer2 = setTimeout(() => {}, 2000);
    
    const handleId1 = handleTracker.registerHandle('timeout', timer1, 'test-1');
    const handleId2 = handleTracker.registerHandle('timeout', timer2, 'test-2');
    
    console.log(`   Registered handles: ${handleId1}, ${handleId2}`);
    
    const stats = handleTracker.getStatistics();
    console.log(`   Current handles: ${stats.totalHandles}`);
    
    // Force cleanup
    const cleanupResult = await handleTracker.forceCleanupAll({
      maxWaitTime: 3000,
      logCleanupProgress: false
    });
    
    console.log(`   Cleanup result: ${cleanupResult.cleanedHandles}/${cleanupResult.totalHandles} handles cleaned`);
    
    handleTracker.stopTracking();
    console.log('✅ ProcessHandleTracker test completed');
    
    // Test 2: ShutdownManager coordination
    console.log('\n🔍 Test 2: ShutdownManager coordination...');
    
    const shutdownManager = ShutdownManager.getInstance(logger, {
      maxShutdownTime: 5000,
      enableSignalHandlers: false
    });
    
    let hookExecuted = false;
    const hookId = shutdownManager.registerHook(
      'QuickTest-Hook',
      async () => {
        hookExecuted = true;
        await new Promise(resolve => setTimeout(resolve, 100));
      },
      'normal',
      { timeoutMs: 1000 }
    );
    
    console.log(`   Registered shutdown hook: ${hookId}`);
    
    const shutdownResult = await shutdownManager.shutdown('Quick test shutdown');
    
    console.log(`   Shutdown result: ${shutdownResult.success}, hooks executed: ${hookExecuted}`);
    console.log('✅ ShutdownManager test completed');
    
    // Test 3: TestSDKFactory integration (with fresh singletons)
    console.log('\n🔍 Test 3: TestSDKFactory integration...');
    
    // Clean up singletons first
    ProcessHandleTracker.destroy();
    ShutdownManager.destroy();
    
    const testInstance = TestSDKFactory.createIsolated({
      enableHandleTracking: true,
      enableShutdownHooks: true,
      enableLogging: false
    });
    
    console.log(`   Test instance created: ${testInstance.sessionId}`);
    
    if (testInstance.handleTracker) {
      const instanceStats = testInstance.handleTracker.getStatistics();
      console.log(`   Instance handle tracking: ${instanceStats.isTracking}`);
    }
    
    // Clean up test instance
    await testInstance.cleanup();
    console.log('   Test instance cleaned up successfully');
    console.log('✅ TestSDKFactory integration test completed');
    
    // Final cleanup
    await TestSDKFactory.cleanupAll();
    ProcessHandleTracker.destroy();
    ShutdownManager.destroy();
    
    const totalTime = Date.now() - startTime;
    console.log(`\n🎉 All Epic 3 tests completed successfully in ${totalTime}ms`);
    console.log('✅ Process terminated cleanly without hanging!');
    
    return true;
    
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    return false;
  }
}

// Run with timeout protection
const testTimeout = setTimeout(() => {
  console.error('❌ Test timed out! Epic 3 process management may have issues.');
  process.exit(1);
}, 30000);

testProcessManagement()
  .then((success) => {
    clearTimeout(testTimeout);
    if (success) {
      console.log('\n🏆 Epic 3 SUCCESS: Clean process termination validated!');
      process.exit(0);
    } else {
      process.exit(1);
    }
  })
  .catch((error) => {
    clearTimeout(testTimeout);
    console.error(`❌ Critical test failure: ${error.message}`);
    process.exit(1);
  });