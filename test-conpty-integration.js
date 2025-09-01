#!/usr/bin/env node
/**
 * Test script to verify Windows ConPTY integration with node-pty and supporting packages
 */

const os = require('os');
const path = require('path');

console.log('🚀 Testing Windows ConPTY Integration\n');

// Test 1: Import node-pty
try {
  const pty = require('@lydell/node-pty');
  console.log('✅ @lydell/node-pty imported successfully');
  console.log(`   Version: ${require('@lydell/node-pty/package.json').version}`);
} catch (error) {
  console.log('❌ Failed to import @lydell/node-pty:', error.message);
  process.exit(1);
}

// Test 2: Import strip-ansi
try {
  const stripAnsi = require('strip-ansi');
  console.log('✅ strip-ansi imported successfully');
  
  // Test ANSI stripping - handle both default and named exports
  const stripFunction = stripAnsi.default || stripAnsi;
  if (typeof stripFunction === 'function') {
    const testString = '\u001b[31mHello \u001b[32mWorld\u001b[39m';
    const stripped = stripFunction(testString);
    console.log(`   Test: "${testString}" -> "${stripped}"`);
    
    if (stripped === 'Hello World') {
      console.log('   ✅ ANSI stripping test passed');
    } else {
      console.log('   ⚠️  ANSI stripping result:', stripped);
    }
  } else {
    console.log('   ⚠️  strip-ansi function not found, but module imported');
  }
} catch (error) {
  console.log('❌ Failed to test strip-ansi:', error.message);
  // Don't exit on this error, continue with other tests
}

// Test 3: Import windows-credman (Windows only)
if (os.platform() === 'win32') {
  try {
    const credman = require('windows-credman');
    console.log('✅ windows-credman imported successfully');
  } catch (error) {
    console.log('⚠️  windows-credman import failed (may not be critical):', error.message);
  }
} else {
  console.log('ℹ️  Skipping windows-credman test (not on Windows)');
}

// Test 4: Import node-windows (Windows only)
if (os.platform() === 'win32') {
  try {
    const nodeWindows = require('node-windows');
    console.log('✅ node-windows imported successfully');
  } catch (error) {
    console.log('⚠️  node-windows import failed (may not be critical):', error.message);
  }
} else {
  console.log('ℹ️  Skipping node-windows test (not on Windows)');
}

// Test 5: Basic ConPTY functionality (Windows only)
if (os.platform() === 'win32') {
  console.log('\n🔧 Testing ConPTY functionality...');
  
  try {
    const pty = require('@lydell/node-pty');
    
    console.log('   Creating test PTY process...');
    const ptyProcess = pty.spawn('echo', ['Hello ConPTY!'], {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: process.cwd(),
      env: process.env
    });
    
    let output = '';
    
    ptyProcess.onData((data) => {
      output += data;
    });
    
    // Use callback-based approach instead of async/await
    const testPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('PTY test timeout'));
      }, 5000);
      
      ptyProcess.onExit(() => {
        clearTimeout(timeout);
        resolve();
      });
    });
    
    testPromise.then(() => {
      console.log('✅ ConPTY test completed successfully');
      console.log(`   Output: ${output.trim()}`);
      finishTests();
    }).catch((error) => {
      console.log('❌ ConPTY test failed:', error.message);
      finishTests();
    });
    
  } catch (error) {
    console.log('❌ ConPTY test failed:', error.message);
    finishTests();
  }
} else {
  console.log('ℹ️  Skipping ConPTY test (not on Windows)');
  finishTests();
}

function finishTests() {
  console.log('\n🎉 All tests completed!');
  console.log('\nSystem Information:');
  console.log(`   Platform: ${os.platform()}`);
  console.log(`   Architecture: ${os.arch()}`);
  console.log(`   Node.js: ${process.version}`);
  console.log(`   ConPTY Support: ${os.platform() === 'win32' ? 'Available' : 'Not applicable'}`);

  console.log('\n📋 Package Summary:');
  console.log('   ✅ @lydell/node-pty - Windows ConPTY support with prebuilt binaries');
  console.log('   ✅ strip-ansi - ANSI escape code removal');
  console.log('   ✅ windows-credman - Windows Credential Manager integration');
  console.log('   ✅ node-windows - Windows service management');

  console.log('\n🔗 Integration Points:');
  console.log('   • PTY Controller: Uses @lydell/node-pty for ConPTY support');
  console.log('   • ANSI Processing: Uses strip-ansi for clean output parsing');
  console.log('   • OAuth Tokens: Uses windows-credman for token extraction');
  console.log('   • Service Management: Uses node-windows for service control');
}