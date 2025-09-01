#!/usr/bin/env node

/**
 * Test script to demonstrate error capture from headless Claude mode
 * This will attempt to use Claude with -p flag and capture the authentication errors
 */

const { ClaudeExecutor } = require('./dist/services/claudeExecutor');

async function testHeadlessMode() {
  const executor = new ClaudeExecutor();
  
  console.log('\n=== Testing Headless Mode Error Capture ===\n');
  console.log('Attempting to run Claude in headless mode (-p flag)...');
  console.log('This should fail and capture authentication errors.\n');
  
  try {
    const result = await executor.executeClaudeCode(
      'Create a simple hello world function',
      {
        model: 'sonnet',
        verbose: true,
        timeout: 10000 // 10 seconds timeout for quick failure
      }
    );
    
    console.log('Unexpected success:', result);
  } catch (error) {
    console.log('\n=== Error Captured Successfully! ===\n');
    console.log('Error Type:', error.name);
    console.log('Error Message:', error.message);
    
    // Check which type of error we caught
    if (error.name === 'APIKeyRequiredError') {
      console.log('\n✅ API Key error detected correctly!');
      console.log('This confirms headless mode requires API keys.');
    } else if (error.name === 'AuthenticationError') {
      console.log('\n✅ Authentication error detected!');
      console.log('This confirms subscription auth is not working in headless mode.');
    } else if (error.name === 'HeadlessModeError') {
      console.log('\n✅ Headless mode specific error detected!');
      console.log('This confirms -p flag is not working without API keys.');
    } else if (error.name === 'ClaudeInstallationError') {
      console.log('\n⚠️ Claude CLI not found or not installed');
      console.log('Please ensure Claude Code is installed.');
    } else {
      console.log('\n⚠️ Other error type detected');
      console.log('This might be a different issue.');
    }
    
    // Show full error stack in verbose mode
    if (process.argv.includes('--verbose')) {
      console.log('\n=== Full Error Stack ===');
      console.log(error.stack);
    }
  }
  
  console.log('\n=== Test Complete ===\n');
}

// Send test results to monitoring if available
async function sendToMonitoring(errorType, message) {
  try {
    const response = await fetch('http://localhost:4001/api/monitoring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentType: 'test',
        messageType: 'error',
        message: message,
        metadata: {
          eventType: 'HEADLESS_MODE_TEST',
          errorType: errorType,
          timestamp: new Date().toISOString()
        },
        sessionInfo: {
          task: 'Testing Headless Mode Error Capture',
          workDir: process.cwd()
        }
      })
    });
    
    if (response.ok) {
      console.log('✅ Error sent to monitoring system');
    }
  } catch (e) {
    console.log('ℹ️ Monitoring system not available');
  }
}

// Run the test
testHeadlessMode().catch(console.error);