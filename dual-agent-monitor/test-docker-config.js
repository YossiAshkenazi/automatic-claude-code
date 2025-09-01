#!/usr/bin/env node
/**
 * Test script to validate Docker configuration
 */

const { spawn } = require('child_process');
const path = require('path');

async function testDockerConfig() {
  console.log('🔍 Testing Docker configuration for dual-agent-monitor...\n');
  
  const tests = [
    {
      name: 'Basic Docker Compose Validation',
      command: 'docker-compose',
      args: ['config'],
      file: 'docker-compose.yml'
    },
    {
      name: 'Production Docker Compose Validation',
      command: 'docker-compose',
      args: ['-f', 'docker-compose.prod.yml', 'config'],
      file: 'docker-compose.prod.yml'
    },
    {
      name: 'PostgreSQL Docker Compose Validation',
      command: 'docker-compose',
      args: ['-f', 'docker-compose.postgres.yml', 'config'],
      file: 'docker-compose.postgres.yml'
    }
  ];
  
  for (const test of tests) {
    console.log(`📋 Running: ${test.name}`);
    
    try {
      await runCommand(test.command, test.args);
      console.log(`✅ ${test.name} - PASSED\n`);
    } catch (error) {
      console.error(`❌ ${test.name} - FAILED:`);
      console.error(`   ${error.message}\n`);
    }
  }
  
  console.log('🏁 Docker configuration test completed!');
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Command failed with code ${code}:\n${stderr}`));
      }
    });
    
    child.on('error', (error) => {
      reject(new Error(`Command error: ${error.message}`));
    });
  });
}

// Run the tests
testDockerConfig().catch(console.error);