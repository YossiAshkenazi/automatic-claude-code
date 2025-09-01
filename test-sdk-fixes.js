#!/usr/bin/env node

// Quick test script to verify SDK path detection fixes
const { spawn } = require('child_process');
const path = require('path');

console.log('🔍 Testing SDK path detection fixes...\n');

// Test 1: Check if build succeeds
console.log('Test 1: Building TypeScript project...');
const buildProcess = spawn('pnpm', ['run', 'build'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

buildProcess.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Build successful!\n');
    
    // Test 2: Try to run a simple command
    console.log('Test 2: Testing Claude CLI detection...');
    const testProcess = spawn('node', ['dist/index.js', '--version'], {
      cwd: __dirname,
      stdio: 'inherit'
    });
    
    testProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ CLI version check successful!\n');
        console.log('🎉 All basic tests passed!');
      } else {
        console.log('❌ CLI version check failed');
      }
    });
    
    testProcess.on('error', (err) => {
      console.log('❌ CLI test error:', err.message);
    });
    
  } else {
    console.log('❌ Build failed');
  }
});

buildProcess.on('error', (err) => {
  console.log('❌ Build error:', err.message);
});