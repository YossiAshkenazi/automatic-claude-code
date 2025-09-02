#!/usr/bin/env node

/**
 * Direct test of Claude CLI without PTY
 * This bypasses all the ACC complexity and tests Claude directly
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Testing Claude CLI directly (no PTY)...\n');

// Test task
const prompt = 'create a simple hello world javascript file';

// Find claude command
const claudeCommand = 'claude';

// Build command arguments
const args = [prompt, '--model', 'sonnet'];

console.log(`📝 Command: ${claudeCommand} ${args.join(' ')}\n`);
console.log('⏳ Executing Claude... (this may take a moment)\n');

// Execute claude
const claudeProcess = spawn(claudeCommand, args, {
  shell: true,
  stdio: 'pipe',
  env: { ...process.env }
});

let output = '';
let errorOutput = '';

// Capture stdout
claudeProcess.stdout.on('data', (data) => {
  const text = data.toString();
  output += text;
  process.stdout.write(text);
});

// Capture stderr
claudeProcess.stderr.on('data', (data) => {
  const text = data.toString();
  errorOutput += text;
  process.stderr.write(text);
});

// Handle completion
claudeProcess.on('close', (code) => {
  console.log('\n' + '═'.repeat(60));
  console.log(`\n✅ Claude process completed with exit code: ${code}`);
  
  if (code === 0) {
    console.log('\n🎉 SUCCESS! Claude executed without errors.');
    console.log('📊 Output length:', output.length, 'characters');
  } else {
    console.log('\n❌ Claude execution failed.');
    if (errorOutput) {
      console.log('📋 Error output:', errorOutput);
    }
  }
  
  process.exit(code);
});

// Handle errors
claudeProcess.on('error', (err) => {
  console.error('\n❌ Failed to start Claude process:', err);
  process.exit(1);
});

// Timeout after 2 minutes
setTimeout(() => {
  console.log('\n⏰ Timeout: Killing Claude process after 2 minutes');
  claudeProcess.kill();
  process.exit(1);
}, 120000);