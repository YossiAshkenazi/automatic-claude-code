#!/usr/bin/env node

// Quick test script for Claude CLI path detection
const { ClaudeUtils } = require('./temp-test/claudeUtils.js');

console.log('Testing Claude CLI path detection...\n');

// Enable debug logging
process.env.DEBUG_CLAUDE_PATH = 'true';

try {
  const result = ClaudeUtils.getClaudeCommand();
  console.log('\n✅ SUCCESS: Found Claude CLI!');
  console.log(`Command: ${result.command}`);
  console.log(`Base Args: ${result.baseArgs.join(' ')}`);
} catch (error) {
  console.log('\n❌ FAILED: Claude CLI not found');
  console.log(`Error: ${error.message}`);
}