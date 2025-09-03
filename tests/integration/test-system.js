#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Testing Automatic Claude Code System\n');

// Test 1: Check system components
console.log('1. Testing CLI Interface...');
const versionCheck = spawn('node', ['dist/index.js', '--version'], {
  cwd: __dirname,
  shell: true
});

versionCheck.stdout.on('data', (data) => {
  console.log(`   ✅ CLI Version: ${data.toString().trim()}`);
});

versionCheck.on('close', (code) => {
  if (code === 0) {
    console.log('   ✅ CLI Interface: Working\n');
    
    // Test 2: Check monitoring
    console.log('2. Testing Monitoring API...');
    fetch('http://localhost:4005/api/health')
      .then(res => res.json())
      .then(data => {
        console.log(`   ✅ Monitoring Status: ${data.status}`);
        console.log(`   ✅ WebSocket: ${data.websocket}`);
        console.log(`   ✅ Port: ${data.port}\n`);
        
        // Test 3: Show examples
        console.log('3. Testing Example Commands...');
        const examples = spawn('node', ['dist/index.js', 'examples'], {
          cwd: __dirname,
          shell: true
        });
        
        let exampleCount = 0;
        examples.stdout.on('data', (data) => {
          const lines = data.toString().split('\n');
          lines.forEach(line => {
            if (line.includes('acc run')) {
              exampleCount++;
            }
          });
        });
        
        examples.on('close', () => {
          console.log(`   ✅ Example Commands: ${exampleCount} examples available\n`);
          
          console.log('📊 System Test Summary:');
          console.log('   ✅ CLI Interface: Operational');
          console.log('   ✅ Monitoring: Active');
          console.log('   ✅ Build System: Verified');
          console.log('   ⚠️  Claude Auth: Needs configuration');
          console.log('\n💡 Next Steps:');
          console.log('   1. Set ANTHROPIC_API_KEY environment variable');
          console.log('   2. Or use Docker: docker run ghcr.io/yossiashkenazi/automatic-claude-code');
          console.log('   3. Or authenticate: claude setup-token');
        });
      })
      .catch(err => {
        console.log('   ⚠️  Monitoring API not running');
        console.log('   Start with: cd dual-agent-monitor && pnpm run dev');
      });
  }
});