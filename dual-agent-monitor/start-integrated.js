#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const config = {
  wsPort: process.env.WS_PORT || 8080,
  uiPort: process.env.UI_PORT || 5173,
  verbose: process.env.VERBOSE === 'true',
  production: process.env.NODE_ENV === 'production'
};

console.log('🚀 Starting Dual-Agent Monitor with Real Integration\n');

// Check prerequisites
function checkPrerequisites() {
  console.log('📋 Checking prerequisites...');
  
  // Check if acc command exists
  try {
    const accPath = process.platform === 'win32' ? 'acc.cmd' : 'acc';
    const result = spawn.sync(accPath, ['--version'], { stdio: 'pipe' });
    if (result.status !== 0) {
      throw new Error('acc command not found or not working');
    }
    console.log('✅ Automatic Claude Code (acc) is available');
  } catch (error) {
    console.error('❌ Automatic Claude Code (acc) not found');
    console.error('   Please install and ensure it\'s in your PATH');
    process.exit(1);
  }

  // Check if Claude CLI exists
  try {
    const result = spawn.sync('claude', ['--version'], { stdio: 'pipe' });
    if (result.status !== 0) {
      throw new Error('claude command not found');
    }
    console.log('✅ Claude Code CLI is available');
  } catch (error) {
    console.error('❌ Claude Code CLI not found');
    console.error('   Please install Claude Code CLI');
    process.exit(1);
  }

  // Check if node_modules exists
  if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
    console.error('❌ Dependencies not installed');
    console.error('   Please run: pnpm install');
    process.exit(1);
  }
  console.log('✅ Dependencies are installed');

  console.log('');
}

// Build TypeScript if needed
async function buildIfNeeded() {
  const serverTsPath = path.join(__dirname, 'server', 'websocket-server.ts');
  const serverJsPath = path.join(__dirname, 'dist', 'server', 'websocket-server.js');
  
  const needsBuild = !fs.existsSync(serverJsPath) || 
    fs.statSync(serverTsPath).mtime > fs.statSync(serverJsPath).mtime;

  if (needsBuild) {
    console.log('🔨 Building TypeScript files...');
    return new Promise((resolve, reject) => {
      const tsc = spawn('npx', ['tsc', '--project', 'server/tsconfig.json'], {
        stdio: 'inherit',
        cwd: __dirname
      });
      
      tsc.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Build completed');
          resolve();
        } else {
          console.error('❌ Build failed');
          reject(new Error('TypeScript build failed'));
        }
      });
    });
  } else {
    console.log('✅ TypeScript files are up to date');
  }
}

// Start WebSocket server
function startWebSocketServer() {
  console.log(`🔗 Starting WebSocket server on port ${config.wsPort}...`);
  
  const serverPath = path.join(__dirname, 'dist', 'server', 'websocket-server.js');
  const wsServer = spawn('node', [serverPath], {
    cwd: __dirname,
    env: {
      ...process.env,
      PORT: config.wsPort,
      VERBOSE: config.verbose
    }
  });

  wsServer.stdout.on('data', (data) => {
    const message = data.toString().trim();
    if (message) {
      console.log(`[WS] ${message}`);
    }
  });

  wsServer.stderr.on('data', (data) => {
    const message = data.toString().trim();
    if (message) {
      console.error(`[WS ERROR] ${message}`);
    }
  });

  wsServer.on('close', (code) => {
    console.log(`WebSocket server exited with code ${code}`);
    if (code !== 0) {
      process.exit(1);
    }
  });

  return wsServer;
}

// Start UI development server
function startUIServer() {
  console.log(`🎨 Starting UI server on port ${config.uiPort}...`);
  
  const viteArgs = config.production ? ['preview'] : ['dev'];
  const uiServer = spawn('npx', ['vite', ...viteArgs], {
    cwd: __dirname,
    env: {
      ...process.env,
      VITE_WS_URL: `ws://localhost:${config.wsPort}`,
      PORT: config.uiPort
    }
  });

  uiServer.stdout.on('data', (data) => {
    const message = data.toString().trim();
    if (message && !message.includes('waiting for file changes')) {
      console.log(`[UI] ${message}`);
    }
  });

  uiServer.stderr.on('data', (data) => {
    const message = data.toString().trim();
    if (message) {
      console.error(`[UI ERROR] ${message}`);
    }
  });

  uiServer.on('close', (code) => {
    console.log(`UI server exited with code ${code}`);
  });

  return uiServer;
}

// Main startup function
async function start() {
  try {
    checkPrerequisites();
    
    if (!config.production) {
      await buildIfNeeded();
    }

    // Start both servers
    const wsServer = startWebSocketServer();
    
    // Wait a moment for WebSocket server to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const uiServer = startUIServer();

    // Display startup information
    console.log('\n🎉 Dual-Agent Monitor is starting up!\n');
    console.log('📊 Monitoring Dashboard:', `http://localhost:${config.uiPort}`);
    console.log('🔗 WebSocket Server:', `ws://localhost:${config.wsPort}`);
    console.log('📡 REST API:', `http://localhost:${config.wsPort}/api`);
    console.log('\n📖 Usage:');
    console.log('1. Open the UI in your browser');
    console.log('2. Click "Start Agents" to begin monitoring');
    console.log('3. Enter a task for the dual-agent system');
    console.log('4. Watch real-time agent communication and metrics');
    console.log('\n⚡ Features:');
    console.log('• Real-time agent message monitoring');
    console.log('• Performance metrics (CPU, memory)');
    console.log('• Session history and export');
    console.log('• Interactive agent communication');
    console.log('\n🔍 Debugging:');
    console.log(`• WebSocket traffic: wscat -c ws://localhost:${config.wsPort}`);
    console.log('• Agent logs: tail -f .claude-sessions/*.log');
    console.log('• Health check: curl http://localhost:' + config.wsPort + '/api/health');
    
    if (config.verbose) {
      console.log('\n🐛 Verbose logging enabled');
    }

    console.log('\n⏹️  Press Ctrl+C to stop all services\n');

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down...');
      wsServer.kill('SIGTERM');
      uiServer.kill('SIGTERM');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Shutting down...');
      wsServer.kill('SIGTERM');
      uiServer.kill('SIGTERM');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Startup failed:', error.message);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('Dual-Agent Monitor - Real Integration Starter\n');
  console.log('Usage: node start-integrated.js [options]\n');
  console.log('Options:');
  console.log('  --help, -h     Show this help message');
  console.log('  --production   Run in production mode');
  console.log('  --verbose      Enable verbose logging');
  console.log('\nEnvironment Variables:');
  console.log('  WS_PORT        WebSocket server port (default: 8080)');
  console.log('  UI_PORT        UI server port (default: 5173)');
  console.log('  NODE_ENV       Environment (development/production)');
  console.log('  VERBOSE        Enable verbose logging (true/false)');
  console.log('\nExamples:');
  console.log('  node start-integrated.js');
  console.log('  VERBOSE=true node start-integrated.js');
  console.log('  NODE_ENV=production node start-integrated.js --production');
  process.exit(0);
}

if (args.includes('--production')) {
  config.production = true;
  process.env.NODE_ENV = 'production';
}

if (args.includes('--verbose')) {
  config.verbose = true;
  process.env.VERBOSE = 'true';
}

// Start the application
start();