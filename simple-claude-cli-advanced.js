#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Enhanced version with better error handling and session management
async function runClaudeTask(prompt, options = {}) {
  console.log('🚀 Starting Claude CLI task...');
  console.log(`📋 Task: ${prompt}\n`);
  
  const {
    timeout = 60000, // 60 second timeout
    verbose = false,
    model = 'sonnet' // or 'opus', 'haiku'
  } = options;
  
  return new Promise((resolve, reject) => {
    // Build Claude CLI command with options
    const args = [prompt];
    
    // Add model selection if specified
    if (model && model !== 'sonnet') {
      args.unshift(`--model=${model}`);
    }
    
    if (verbose) {
      console.log(`🔧 Running: claude ${args.join(' ')}`);
    }
    
    // Spawn Claude Code CLI process
    const claude = spawn('claude', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      cwd: process.cwd()
    });

    let output = '';
    let errorOutput = '';
    let isResolved = false;

    // Set timeout
    const timeoutId = setTimeout(() => {
      if (!isResolved) {
        console.log('\n⏰ Task timeout - terminating...');
        claude.kill('SIGTERM');
        reject(new Error(`Task timed out after ${timeout}ms`));
        isResolved = true;
      }
    }, timeout);

    // Handle stdout (real-time streaming)
    claude.stdout.on('data', (data) => {
      const text = data.toString();
      
      // Filter out Claude CLI metadata if needed
      if (!text.includes('Claude Code') || verbose) {
        process.stdout.write(text);
      }
      
      output += text;
    });

    // Handle stderr
    claude.stderr.on('data', (data) => {
      const text = data.toString();
      
      // Only show errors, not Claude CLI status messages
      if (text.toLowerCase().includes('error') || verbose) {
        console.error(text);
      }
      
      errorOutput += text;
    });

    // Handle process completion
    claude.on('close', (code) => {
      clearTimeout(timeoutId);
      
      if (isResolved) return;
      
      console.log('\n---');
      if (code === 0) {
        console.log('✅ Task completed successfully!');
        resolve({ output, code, error: errorOutput });
        isResolved = true;
      } else {
        console.error(`❌ Claude CLI exited with code ${code}`);
        if (errorOutput && verbose) {
          console.error('Error details:', errorOutput);
        }
        reject(new Error(`Claude CLI failed with code ${code}`));
        isResolved = true;
      }
    });

    // Handle process errors
    claude.on('error', (error) => {
      clearTimeout(timeoutId);
      
      if (isResolved) return;
      
      console.error('❌ Failed to start Claude CLI:', error.message);
      
      if (error.code === 'ENOENT') {
        console.error('\n💡 Claude Code CLI not found. Please install it:');
        console.error('   npm install -g @anthropic-ai/claude-code');
        console.error('   Then authenticate: claude auth login');
        console.error('   Docs: https://docs.anthropic.com/en/docs/claude-code');
      }
      
      reject(error);
      isResolved = true;
    });
  });
}

// Check if Claude CLI is installed and authenticated
async function checkClaudeCLI() {
  return new Promise((resolve) => {
    const claude = spawn('claude', ['--version'], { 
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true 
    });
    
    let output = '';
    claude.stdout.on('data', (data) => output += data.toString());
    claude.stderr.on('data', (data) => output += data.toString());
    
    claude.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Claude CLI found and working');
        resolve(true);
      } else {
        console.log('❌ Claude CLI not working properly');
        resolve(false);
      }
    });
    
    claude.on('error', () => {
      console.log('❌ Claude CLI not installed');
      resolve(false);
    });
  });
}

async function main() {
  const prompt = process.argv[2];
  const model = process.argv.find(arg => arg.startsWith('--model='))?.split('=')[1];
  const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');
  const timeout = process.argv.find(arg => arg.startsWith('--timeout='))?.split('=')[1] || 60000;
  
  if (!prompt) {
    console.log('❌ Please provide a prompt as an argument');
    console.log('\nUsage:');
    console.log('  node simple-claude-cli-advanced.js "your prompt here"');
    console.log('  node simple-claude-cli-advanced.js "your prompt" --model=opus --verbose');
    console.log('  node simple-claude-cli-advanced.js "your prompt" --timeout=30000');
    console.log('\nOptions:');
    console.log('  --model=sonnet|opus|haiku  (default: sonnet)');
    console.log('  --verbose, -v              Show detailed output');
    console.log('  --timeout=ms               Timeout in milliseconds');
    process.exit(1);
  }
  
  // Check Claude CLI before running
  console.log('🔍 Checking Claude CLI...');
  const cliWorking = await checkClaudeCLI();
  
  if (!cliWorking) {
    console.error('\n💡 Please install and authenticate Claude CLI:');
    console.error('   npm install -g @anthropic-ai/claude-code');
    console.error('   claude auth login');
    process.exit(1);
  }
  
  try {
    const result = await runClaudeTask(prompt, { 
      model, 
      verbose, 
      timeout: parseInt(timeout) 
    });
    
    if (verbose) {
      console.log(`\n📊 Stats: ${result.output.length} characters generated`);
    }
  } catch (error) {
    console.error('Failed to run Claude task:', error.message);
    process.exit(1);
  }
}

main();