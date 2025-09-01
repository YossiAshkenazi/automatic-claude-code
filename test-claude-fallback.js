#!/usr/bin/env node

// Test script for Claude CLI fallback path detection
const { ClaudeUtils } = require('./temp-test/claudeUtils.js');

console.log('Testing Claude CLI fallback path detection...\n');

// Enable debug logging
process.env.DEBUG_CLAUDE_PATH = 'true';

// Remove claude from PATH to test fallback methods
const originalPath = process.env.PATH;
process.env.PATH = process.env.PATH.replace(/[^;]*claude[^;]*/gi, '');

console.log('Simulating environment where claude is not in PATH...\n');

try {
  const result = ClaudeUtils.getClaudeCommand();
  console.log('\n✅ SUCCESS: Found Claude CLI via fallback detection!');
  console.log(`Command: ${result.command}`);
  console.log(`Base Args: ${result.baseArgs.join(' ')}`);
} catch (error) {
  console.log('\n❌ FAILED: Claude CLI not found even with fallback');
  console.log(`Error: ${error.message}`);
} finally {
  // Restore original PATH
  process.env.PATH = originalPath;
}