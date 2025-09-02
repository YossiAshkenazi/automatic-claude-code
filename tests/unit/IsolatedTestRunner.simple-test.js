/**
 * Simple JavaScript test to verify IsolatedTestRunner basic functionality
 */

const { Logger } = require('../../dist/logger');
const IsolatedTestRunner = require('../../dist/testing/IsolatedTestRunner').default;

async function simpleTest() {
  console.log('🧪 Simple Isolated Test Runner Verification');
  console.log('==========================================\n');

  try {
    const logger = new Logger('simple-test', { 
      essentialMode: true, 
      enableFileLogging: false 
    });
    
    const runner = new IsolatedTestRunner(logger, {
      processTimeout: 5000,
      maxConcurrentProcesses: 1
    });

    console.log('✅ IsolatedTestRunner created successfully');

    // Test basic functionality
    const testFunction = async (testInstance) => {
      return {
        message: 'Hello from isolated process!',
        pid: process.pid,
        nodeVersion: process.version
      };
    };

    console.log('🚀 Running basic isolated test...');
    const result = await runner.runIsolatedTest(testFunction);

    console.log(`✅ Test completed successfully: ${result.success}`);
    console.log(`⏱️ Duration: ${result.duration}ms`);
    console.log(`🆔 Child PID: ${result.testResults?.result?.pid}`);
    console.log(`🆔 Parent PID: ${process.pid}`);
    console.log(`🔄 Process Isolation: ${result.testResults?.result?.pid !== process.pid}`);

    await runner.shutdown();
    console.log('\n🏁 Test completed - runner shutdown successfully');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

if (require.main === module) {
  simpleTest().catch(console.error);
}

module.exports = { simpleTest };