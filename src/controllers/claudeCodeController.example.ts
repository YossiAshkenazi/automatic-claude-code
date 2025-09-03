/**
 * ClaudeCodeController Usage Examples
 * 
 * Demonstrates various ways to use the ClaudeCodeController
 * for interactive Claude Code control via PTY processes.
 */

import { ClaudeCodeController, ClaudeCodeEvent, ClaudeCodeResponse } from './claudeCodeController';

/**
 * Example 1: Basic Interactive Session
 */
async function basicInteractiveSession() {
  console.log('🚀 Starting basic interactive session example...\n');
  
  const controller = new ClaudeCodeController({
    workingDirectory: process.cwd(),
    timeout: 30000,
    preserveAnsi: false // Strip ANSI for cleaner output
  });

  try {
    // Set up event listeners
    controller.on('spawn', (event: ClaudeCodeEvent) => {
      console.log(`✅ Process spawned with PID: ${event.data.pid}`);
    });

    controller.on('data', (event: ClaudeCodeEvent) => {
      console.log(`📤 Output: ${event.data.clean.trim()}`);
    });

    controller.on('error', (event: ClaudeCodeEvent) => {
      console.log(`❌ Error: ${event.data.clean.trim()}`);
    });

    controller.on('exit', (event: ClaudeCodeEvent) => {
      console.log(`🏁 Process exited with code: ${event.data.exitCode}`);
    });

    // Start the interactive session
    await controller.start();
    console.log('🎯 Controller started successfully');

    // Send some commands
    console.log('📝 Sending command: help');
    const helpResponse = await controller.sendCommand('help');
    console.log(`📖 Help response: ${helpResponse.output.trim()}`);

    // Send another command
    console.log('📝 Sending command: version');
    const versionResponse = await controller.sendCommand('version');
    console.log(`📊 Version response: ${versionResponse.output.trim()}`);

    // Graceful shutdown
    console.log('🔒 Stopping controller...');
    await controller.stop();
    console.log('✅ Controller stopped gracefully');

  } catch (error) {
    console.error('💥 Error in basic session:', error);
  } finally {
    controller.dispose();
    console.log('🧹 Resources cleaned up');
  }
}

/**
 * Example 2: Advanced Session with Buffer Management
 */
async function advancedSessionWithBuffering() {
  console.log('🚀 Starting advanced session with buffer management...\n');
  
  const controller = new ClaudeCodeController({
    workingDirectory: process.cwd(),
    timeout: 60000,
    bufferSize: 2048, // 2KB buffer
    preserveAnsi: true // Keep ANSI codes for rich output
  });

  try {
    let outputCount = 0;
    let errorCount = 0;

    // Advanced event handling
    controller.on('spawn', (event: ClaudeCodeEvent) => {
      console.log(`✅ Process spawned at ${event.timestamp.toISOString()}`);
      const processInfo = controller.getProcessInfo();
      console.log(`📊 Process info:`, processInfo);
    });

    controller.on('data', (event: ClaudeCodeEvent) => {
      outputCount++;
      console.log(`📤 Output #${outputCount}:`);
      console.log(`   Raw: ${JSON.stringify(event.data.raw.substring(0, 50))}...`);
      console.log(`   Clean: ${event.data.clean.substring(0, 50)}...`);
      console.log(`   Buffer size: ${event.data.buffer.length} chars`);
    });

    controller.on('error', (event: ClaudeCodeEvent) => {
      errorCount++;
      console.log(`❌ Error #${errorCount}: ${event.data.clean}`);
    });

    // Start session
    await controller.start();
    
    // Monitor buffer sizes
    const monitorInterval = setInterval(() => {
      console.log(`📊 Buffer status:`);
      console.log(`   Output buffer: ${controller.getOutputBuffer().length} chars`);
      console.log(`   Error buffer: ${controller.getErrorBuffer().length} chars`);
      console.log(`   Process active: ${controller.isActive()}`);
    }, 2000);

    // Send complex commands
    await controller.sendRawInput('# This is a comment\n');
    await controller.sendCommand('ls -la');
    
    // Wait a bit for processing
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Clear buffers periodically
    console.log('🧹 Clearing output buffer...');
    controller.clearOutputBuffer();
    
    clearInterval(monitorInterval);
    await controller.stop();

  } catch (error) {
    console.error('💥 Error in advanced session:', error);
  } finally {
    controller.dispose();
  }
}

/**
 * Example 3: Error Handling and Recovery
 */
async function errorHandlingExample() {
  console.log('🚀 Starting error handling and recovery example...\n');
  
  const controller = new ClaudeCodeController({
    claudeCommand: 'nonexistent-command',
    timeout: 5000
  });

  try {
    // Set up comprehensive error tracking
    const errors: ClaudeCodeEvent[] = [];
    
    controller.on('error', (event: ClaudeCodeEvent) => {
      errors.push(event);
      console.log(`❌ Captured error: ${event.data.error || event.data.clean}`);
    });

    controller.on('exit', (event: ClaudeCodeEvent) => {
      console.log(`🏁 Process exited: code=${event.data.exitCode}, signal=${event.data.signal}`);
    });

    try {
      await controller.start();
      console.log('🎯 Controller started unexpectedly!');
    } catch (startError) {
      console.log(`✅ Expected start error caught: ${startError}`);
    }

    console.log(`📊 Total errors captured: ${errors.length}`);
    
    // Demonstrate recovery with a valid command
    console.log('🔄 Attempting recovery with valid command...');
    const recoveryController = new ClaudeCodeController({
      claudeCommand: 'echo',
      additionalArgs: ['Recovery successful!']
    });

    try {
      await recoveryController.start();
      console.log('✅ Recovery controller started successfully');
      
      const response = await recoveryController.sendRawInput('\n');
      console.log('📤 Recovery response received');
      
      await recoveryController.stop();
      console.log('✅ Recovery completed');
      
    } finally {
      recoveryController.dispose();
    }

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  } finally {
    controller.dispose();
  }
}

/**
 * Example 4: Multi-Controller Coordination
 */
async function multiControllerExample() {
  console.log('🚀 Starting multi-controller coordination example...\n');
  
  const controllers = [
    new ClaudeCodeController({
      claudeCommand: 'echo',
      additionalArgs: ['Controller 1']
    }),
    new ClaudeCodeController({
      claudeCommand: 'echo', 
      additionalArgs: ['Controller 2']
    }),
    new ClaudeCodeController({
      claudeCommand: 'echo',
      additionalArgs: ['Controller 3']
    })
  ];

  try {
    // Start all controllers concurrently
    console.log('🚀 Starting all controllers...');
    await Promise.all(controllers.map((controller, index) => {
      controller.on('spawn', () => console.log(`✅ Controller ${index + 1} spawned`));
      controller.on('exit', () => console.log(`🏁 Controller ${index + 1} exited`));
      return controller.start();
    }));

    console.log('✅ All controllers started');

    // Send commands to all controllers
    console.log('📤 Sending commands to all controllers...');
    const responses = await Promise.all(
      controllers.map((controller, index) => 
        controller.sendRawInput(`Message from controller ${index + 1}\n`)
      )
    );

    console.log(`📊 Received ${responses.length} responses`);

    // Stop all controllers
    console.log('🔒 Stopping all controllers...');
    await Promise.all(controllers.map(controller => controller.stop()));
    
    console.log('✅ All controllers stopped');

  } catch (error) {
    console.error('💥 Error in multi-controller example:', error);
  } finally {
    // Cleanup all controllers
    controllers.forEach(controller => controller.dispose());
    console.log('🧹 All controllers disposed');
  }
}

/**
 * Main demo runner
 */
async function runExamples() {
  console.log('🎯 ClaudeCodeController Examples\n');
  console.log('=' .repeat(50));

  try {
    await basicInteractiveSession();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await advancedSessionWithBuffering();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await errorHandlingExample();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await multiControllerExample();
    
  } catch (error) {
    console.error('💥 Fatal error in examples:', error);
  }
  
  console.log('\n✅ All examples completed!');
}

// Export examples for testing and usage
export {
  basicInteractiveSession,
  advancedSessionWithBuffering,
  errorHandlingExample,
  multiControllerExample,
  runExamples
};

// Run examples if this file is executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}