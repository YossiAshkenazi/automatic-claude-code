#!/usr/bin/env node
/**
 * Environment Variable Propagation Test
 * Tests how CLAUDECODE and CLAUDE_CODE_ENTRYPOINT propagate through different execution contexts
 */

const { spawn, exec } = require('child_process');
const path = require('path');

console.log('=== Environment Variable Propagation Analysis ===\n');

// Test 1: Direct process environment
console.log('1. Direct Process Environment:');
console.log(`   CLAUDECODE: ${process.env.CLAUDECODE}`);
console.log(`   CLAUDE_CODE_ENTRYPOINT: ${process.env.CLAUDE_CODE_ENTRYPOINT}`);

// Test 2: Spawn with inherited environment (like SDK client does)
console.log('\n2. Spawn with {...process.env} (SDK Client pattern):');
const testSpawnInherited = spawn('node', ['-e', 'console.log("CLAUDECODE=" + process.env.CLAUDECODE + ", CLAUDE_CODE_ENTRYPOINT=" + process.env.CLAUDE_CODE_ENTRYPOINT)'], {
  env: { ...process.env },
  stdio: 'pipe'
});

testSpawnInherited.stdout.on('data', (data) => {
  console.log(`   Result: ${data.toString().trim()}`);
});

// Test 3: Spawn with inherited environment plus additional vars (like monitoring manager)
console.log('\n3. Spawn with {...process.env, EXTRA_VAR} (Monitoring Manager pattern):');
const testSpawnExtra = spawn('node', ['-e', 'console.log("CLAUDECODE=" + process.env.CLAUDECODE + ", CLAUDE_CODE_ENTRYPOINT=" + process.env.CLAUDE_CODE_ENTRYPOINT + ", NODE_ENV=" + process.env.NODE_ENV)'], {
  env: { ...process.env, NODE_ENV: 'test' },
  stdio: 'pipe'
});

testSpawnExtra.stdout.on('data', (data) => {
  console.log(`   Result: ${data.toString().trim()}`);
});

// Test 4: Spawn without explicit env (system default inheritance)
console.log('\n4. Spawn without explicit env (default inheritance):');
const testSpawnDefault = spawn('node', ['-e', 'console.log("CLAUDECODE=" + process.env.CLAUDECODE + ", CLAUDE_CODE_ENTRYPOINT=" + process.env.CLAUDE_CODE_ENTRYPOINT)'], {
  stdio: 'pipe'
});

testSpawnDefault.stdout.on('data', (data) => {
  console.log(`   Result: ${data.toString().trim()}`);
});

// Test 5: Exec with shell (alternative execution method)
console.log('\n5. Exec with shell:');
exec('node -e "console.log(\\"CLAUDECODE=\\" + process.env.CLAUDECODE + \\", CLAUDE_CODE_ENTRYPOINT=\\" + process.env.CLAUDE_CODE_ENTRYPOINT)"', (error, stdout, stderr) => {
  if (error) {
    console.log(`   Error: ${error.message}`);
  } else {
    console.log(`   Result: ${stdout.trim()}`);
  }
});

// Test 6: Test nested session detection logic (simulating SDK executor logic)
console.log('\n6. Nested Session Detection Logic (SDK Executor pattern):');
const isNestedSession = process.env.CLAUDECODE === '1' || process.env.CLAUDE_CODE_ENTRYPOINT === 'cli';
console.log(`   isNestedSession: ${isNestedSession}`);
console.log(`   Logic: process.env.CLAUDECODE === '1' (${process.env.CLAUDECODE === '1'}) || process.env.CLAUDE_CODE_ENTRYPOINT === 'cli' (${process.env.CLAUDE_CODE_ENTRYPOINT === 'cli'})`);

// Test 7: Test subprocess with modified environment (isolation test)
console.log('\n7. Subprocess with isolated environment:');
const testIsolated = spawn('node', ['-e', 'console.log("CLAUDECODE=" + process.env.CLAUDECODE + ", CLAUDE_CODE_ENTRYPOINT=" + process.env.CLAUDE_CODE_ENTRYPOINT)'], {
  env: { PATH: process.env.PATH }, // Only PATH, no Claude vars
  stdio: 'pipe'
});

testIsolated.stdout.on('data', (data) => {
  console.log(`   Result (isolated): ${data.toString().trim()}`);
});

// Test 8: Test process inheritance chain
console.log('\n8. Process inheritance chain test:');
const testChain = spawn('node', ['-e', `
  const { spawn } = require('child_process');
  const child = spawn('node', ['-e', 'console.log("NESTED_CLAUDECODE=" + process.env.CLAUDECODE + ", NESTED_CLAUDE_CODE_ENTRYPOINT=" + process.env.CLAUDE_CODE_ENTRYPOINT)'], {
    env: { ...process.env },
    stdio: 'pipe'
  });
  child.stdout.on('data', (data) => {
    console.log(data.toString().trim());
  });
`], {
  env: { ...process.env },
  stdio: 'pipe'
});

testChain.stdout.on('data', (data) => {
  console.log(`   Chain result: ${data.toString().trim()}`);
});

setTimeout(() => {
  console.log('\n=== Analysis Complete ===');
  console.log('\nKey Findings:');
  console.log('- Environment variables are set in the current Claude Code session');
  console.log('- They should propagate to child processes when using {...process.env}');
  console.log('- The SDK executor checks these variables at three key points:');
  console.log('  1. checkBrowserAuthentication()');
  console.log('  2. executeWithSDK() entry point'); 
  console.log('  3. executeWithRetry() method');
  console.log('- Variables are available for nested session detection');
}, 2000);