#!/usr/bin/env node
/**
 * Demonstration Script for Isolated Test Process Spawning
 * Epic 3, Story 3.2: Create Isolated Test Process Spawning
 * 
 * Quick demonstration of the IsolatedTestRunner capabilities
 */

import { Logger } from '../logger';
import IsolatedTestRunner from './IsolatedTestRunner';

async function runDemonstration() {
  console.log('🚀 Isolated Test Process Spawning Demo');
  console.log('======================================\n');

  const logger = new Logger('demo', { essentialMode: true, enableFileLogging: false });
  const runner = new IsolatedTestRunner(logger, {
    maxConcurrentProcesses: 2,
    processTimeout: 10000,
    enableProcessLogging: true
  });

  try {
    console.log('1. Basic Process Isolation Test');
    console.log('------------------------------');
    
    const basicTest = async (testInstance: any) => {
      return {
        message: 'Hello from isolated process!',
        pid: process.pid,
        sessionId: testInstance.sessionId,
        memoryUsage: process.memoryUsage().heapUsed
      };
    };

    const result1 = await runner.runIsolatedTest(basicTest);
    console.log(`✅ Success: ${result1.success}`);
    console.log(`⏱️ Duration: ${result1.duration}ms`);
    console.log(`🆔 Process ID: ${result1.testResults?.result?.pid}`);
    console.log(`💾 Memory Used: ${Math.round((result1.testResults?.result?.memoryUsage || 0) / 1024 / 1024)}MB`);
    console.log(`📊 Spawn Time: ${result1.spawnTime}ms\n`);

    console.log('2. Error Handling Test');
    console.log('---------------------');
    
    const errorTest = async (testInstance: any) => {
      throw new Error('Intentional test error for demonstration');
    };

    const result2 = await runner.runIsolatedTest(errorTest);
    console.log(`❌ Success: ${result2.success}`);
    console.log(`🚨 Error: ${result2.error}`);
    console.log(`⏱️ Duration: ${result2.duration}ms\n`);

    console.log('3. Concurrent Process Test');
    console.log('--------------------------');
    
    const concurrentTest = async (id: number, testInstance: any) => {
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
      return {
        testId: id,
        pid: process.pid,
        completedAt: new Date().toISOString()
      };
    };

    const startTime = Date.now();
    const promises = [
      runner.runIsolatedTest(concurrentTest, [1]),
      runner.runIsolatedTest(concurrentTest, [2]),
      runner.runIsolatedTest(concurrentTest, [3])
    ];

    const results = await Promise.all(promises);
    const totalTime = Date.now() - startTime;
    
    console.log(`✅ All 3 tests completed in ${totalTime}ms`);
    results.forEach((result, index) => {
      if (result.success) {
        console.log(`   Test ${index + 1}: PID ${result.testResults?.result?.pid}, Duration ${result.duration}ms`);
      }
    });
    console.log('');

    console.log('4. Handle Tracking Integration');
    console.log('------------------------------');
    
    const handleTest = async (testInstance: any) => {
      const tracker = testInstance.handleTracker;
      
      // Create some handles
      const timer = setTimeout(() => {}, 5000);
      const interval = setInterval(() => {}, 1000);
      
      tracker.registerHandle('timeout', timer, 'demo-timer');
      tracker.registerHandle('interval', interval, 'demo-interval');
      
      const stats = tracker.getStatistics();
      return {
        pid: process.pid,
        initialHandles: stats.totalHandles,
        handleTypes: stats.handlesByType
      };
    };

    const result4 = await runner.runIsolatedTest(handleTest);
    if (result4.success) {
      console.log(`✅ Handle tracking working`);
      console.log(`🔧 Initial handles: ${result4.testResults?.result?.initialHandles}`);
      console.log(`🧹 Cleanup stats: ${JSON.stringify(result4.handleStats, null, 2)}`);
    }
    console.log('');

    // Get final statistics
    console.log('5. Runner Statistics');
    console.log('-------------------');
    const stats = runner.getStatistics();
    console.log(`📊 Total processes spawned: ${stats.totalProcessesSpawned}`);
    console.log(`✅ Successful tests: ${stats.successfulTests}`);
    console.log(`❌ Failed tests: ${stats.failedTests}`);
    console.log(`⏱️ Average spawn time: ${Math.round(stats.averageSpawnTime)}ms`);
    console.log(`⏱️ Average execution time: ${Math.round(stats.averageExecutionTime)}ms`);
    console.log(`💾 Peak memory usage: ${Math.round(stats.peakMemoryUsage / 1024 / 1024)}MB`);
    console.log(`🏃 Max concurrent processes: ${stats.maxConcurrentProcesses}`);

  } catch (error) {
    console.error('❌ Demo failed:', error);
  } finally {
    await runner.shutdown();
    console.log('\n🏁 Demo completed - all processes cleaned up');
  }
}

// Run demo if this file is executed directly
if (require.main === module) {
  runDemonstration().catch(console.error);
}

export { runDemonstration };