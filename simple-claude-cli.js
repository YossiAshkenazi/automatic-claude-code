#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

async function runClaudeTask(prompt) {
  console.log('🚀 Starting Claude CLI task...');
  console.log(`📋 Task: ${prompt}\n`);
  
  return new Promise((resolve, reject) => {
    // Spawn Claude Code CLI process
    const claude = spawn('claude', [prompt], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    });

    let output = '';
    let errorOutput = '';

    // Handle stdout (real-time streaming)
    claude.stdout.on('data', (data) => {
      const text = data.toString();
      process.stdout.write(text); // Stream immediately to console
      output += text;
    });

    // Handle stderr
    claude.stderr.on('data', (data) => {
      const text = data.toString();
      console.error(text);
      errorOutput += text;
    });

    // Handle process completion
    claude.on('close', (code) => {
      console.log('\n---');
      if (code === 0) {
        console.log('✅ Task completed successfully!');
        resolve(output);
      } else {
        console.error(`❌ Claude CLI exited with code ${code}`);
        if (errorOutput) {
          console.error('Error details:', errorOutput);
        }
        reject(new Error(`Claude CLI failed with code ${code}: ${errorOutput}`));
      }
    });

    // Handle process errors
    claude.on('error', (error) => {
      console.error('❌ Failed to start Claude CLI:', error.message);
      
      if (error.code === 'ENOENT') {
        console.error('\n💡 Claude Code CLI not found. Please install it:');
        console.error('   npm install -g @anthropic-ai/claude-code');
        console.error('   or check: https://docs.anthropic.com/en/docs/claude-code');
      }
      
      reject(error);
    });
  });
}

async function main() {
  const prompt = process.argv[2];
  
  if (!prompt) {
    console.log('❌ Please provide a prompt as an argument');
    console.log('Usage: node simple-claude-cli.js "your prompt here"');
    process.exit(1);
  }
  
  try {
    await runClaudeTask(prompt);
  } catch (error) {
    console.error('Failed to run Claude task:', error.message);
    process.exit(1);
  }
}

main();