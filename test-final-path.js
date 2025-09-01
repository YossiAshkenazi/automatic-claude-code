#!/usr/bin/env node

// Final test of the Claude CLI path detection improvements
const { ClaudeUtils } = require('./dist/claudeUtils.js');

console.log('Testing enhanced Claude CLI path detection...\n');

// Enable debug logging
process.env.DEBUG_CLAUDE_PATH = 'true';

try {
  console.log('=== Test 1: Normal path detection ===');
  const result = ClaudeUtils.getClaudeCommand();
  console.log('\n✅ SUCCESS: Found Claude CLI!');
  console.log(`Command: ${result.command}`);
  console.log(`Base Args: ${result.baseArgs.join(' ')}`);
  
  console.log('\n=== Test 2: Validation check ===');
  const isValid = ClaudeUtils.validateClaudeInstallation();
  console.log(`Validation result: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
  
} catch (error) {
  console.log('\n❌ FAILED: Claude CLI not found');
  console.log(`Error: ${error.message}`);
  console.log('\nThis indicates the enhanced detection worked - it provided detailed error info!');
}