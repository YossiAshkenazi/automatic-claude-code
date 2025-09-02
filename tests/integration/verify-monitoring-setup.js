#!/usr/bin/env node

/**
 * Monitoring Setup Verification Script
 * 
 * This script verifies that the dual-agent monitoring system is properly set up
 * and ready for testing. It checks all required services and provides setup
 * instructions if anything is missing.
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

class MonitoringSetupVerifier {
  constructor() {
    this.checks = [];
    this.errors = [];
    this.warnings = [];
  }

  log(message, type = 'info') {
    const icons = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      step: '📋'
    };
    console.log(`${icons[type]} ${message}`);
  }

  async checkPort(port, serviceName) {
    return new Promise((resolve) => {
      const req = http.get(`http://localhost:${port}`, (res) => {
        resolve({ available: true, status: res.statusCode });
      });
      
      req.on('error', () => {
        resolve({ available: false, status: null });
      });
      
      req.setTimeout(2000, () => {
        req.abort();
        resolve({ available: false, status: null });
      });
    });
  }

  async checkWebSocketConnection(port) {
    try {
      const { WebSocket } = require('ws');
      return new Promise((resolve) => {
        const ws = new WebSocket(`ws://localhost:${port}`);
        
        ws.on('open', () => {
          ws.close();
          resolve(true);
        });
        
        ws.on('error', () => {
          resolve(false);
        });
        
        setTimeout(() => {
          if (ws.readyState === ws.CONNECTING) {
            ws.close();
            resolve(false);
          }
        }, 3000);
      });
    } catch (error) {
      return false;
    }
  }

  async checkDirectoryExists(dir) {
    const fs = require('fs');
    return new Promise((resolve) => {
      fs.access(dir, fs.constants.F_OK, (err) => {
        resolve(!err);
      });
    });
  }

  async checkNodeModules() {
    const monitoringDir = path.join(__dirname, 'dual-agent-monitor');
    const nodeModulesExists = await this.checkDirectoryExists(path.join(monitoringDir, 'node_modules'));
    
    if (!nodeModulesExists) {
      this.errors.push({
        issue: 'Missing node_modules in dual-agent-monitor',
        solution: 'Run: cd dual-agent-monitor && pnpm install'
      });
      return false;
    }
    return true;
  }

  async checkPackageJson() {
    try {
      const packagePath = path.join(__dirname, 'dual-agent-monitor', 'package.json');
      require(packagePath);
      return true;
    } catch (error) {
      this.errors.push({
        issue: 'dual-agent-monitor/package.json not found or invalid',
        solution: 'Ensure dual-agent-monitor directory exists with valid package.json'
      });
      return false;
    }
  }

  async runVerification() {
    this.log('🚀 Starting monitoring setup verification...', 'info');
    console.log('');

    // Check 1: Directory structure
    this.log('Step 1: Checking directory structure', 'step');
    const monitoringDirExists = await this.checkDirectoryExists(path.join(__dirname, 'dual-agent-monitor'));
    
    if (!monitoringDirExists) {
      this.errors.push({
        issue: 'dual-agent-monitor directory not found',
        solution: 'Ensure you are running this from the correct directory'
      });
      this.log('dual-agent-monitor directory: NOT FOUND', 'error');
    } else {
      this.log('dual-agent-monitor directory: OK', 'success');
    }

    // Check 2: Package.json and dependencies
    this.log('Step 2: Checking package configuration', 'step');
    const packageOk = await this.checkPackageJson();
    if (packageOk) {
      this.log('package.json: OK', 'success');
    } else {
      this.log('package.json: ERROR', 'error');
    }

    const nodeModulesOk = await this.checkNodeModules();
    if (nodeModulesOk) {
      this.log('node_modules: OK', 'success');
    } else {
      this.log('node_modules: MISSING', 'error');
    }

    // Check 3: Port availability
    this.log('Step 3: Checking service availability', 'step');
    
    // Check API server (port 4005)
    const apiCheck = await this.checkPort(4005, 'API Server');
    if (apiCheck.available) {
      this.log('API Server (port 4005): RUNNING', 'success');
      
      // Check WebSocket if API is running
      const wsOk = await this.checkWebSocketConnection(4005);
      if (wsOk) {
        this.log('WebSocket Server (port 4005): OK', 'success');
      } else {
        this.warnings.push({
          issue: 'WebSocket server not responding',
          solution: 'API server is running but WebSocket may not be properly configured'
        });
        this.log('WebSocket Server (port 4005): WARNING', 'warning');
      }
    } else {
      this.errors.push({
        issue: 'API server not running on port 4005',
        solution: 'Run: cd dual-agent-monitor && pnpm run server:dev'
      });
      this.log('API Server (port 4005): NOT RUNNING', 'error');
    }

    // Check frontend server (port 6011)
    const frontendCheck = await this.checkPort(6011, 'Frontend Server');
    if (frontendCheck.available) {
      this.log('Frontend Server (port 6011): RUNNING', 'success');
    } else {
      this.errors.push({
        issue: 'Frontend server not running on port 6011',
        solution: 'Run: cd dual-agent-monitor && pnpm run client:dev'
      });
      this.log('Frontend Server (port 6011): NOT RUNNING', 'error');
    }

    // Check 4: Database connectivity (if configured)
    this.log('Step 4: Checking database configuration', 'step');
    
    // Check for PostgreSQL configuration
    const postgresCheck = await this.checkPort(5434, 'PostgreSQL');
    if (postgresCheck.available) {
      this.log('PostgreSQL (port 5434): RUNNING', 'success');
    } else {
      this.warnings.push({
        issue: 'PostgreSQL not detected on port 5434',
        solution: 'For production use, set up PostgreSQL. For development, the system can use in-memory storage'
      });
      this.log('PostgreSQL (port 5434): NOT DETECTED (will use in-memory storage)', 'warning');
    }

    console.log('');
    this.generateReport();
  }

  generateReport() {
    const hasErrors = this.errors.length > 0;
    const hasWarnings = this.warnings.length > 0;

    if (!hasErrors && !hasWarnings) {
      this.log('🎉 All checks passed! Monitoring system is ready.', 'success');
      console.log('');
      this.log('✨ You can now run the comprehensive test:', 'info');
      this.log('   node test-dual-agent-session.js', 'info');
      console.log('');
      this.log('🌐 Dashboard URLs:', 'info');
      this.log('   Frontend: http://localhost:6011', 'info');
      this.log('   API:      http://localhost:4005', 'info');
      return;
    }

    if (hasErrors) {
      console.log('');
      this.log('❌ Errors found that need to be resolved:', 'error');
      this.errors.forEach((error, index) => {
        console.log(`${index + 1}. Issue: ${error.issue}`);
        console.log(`   Solution: ${error.solution}`);
        console.log('');
      });
    }

    if (hasWarnings) {
      console.log('');
      this.log('⚠️  Warnings (system will work but may have limitations):', 'warning');
      this.warnings.forEach((warning, index) => {
        console.log(`${index + 1}. Issue: ${warning.issue}`);
        console.log(`   Note: ${warning.solution}`);
        console.log('');
      });
    }

    console.log('');
    this.log('🔧 Quick Setup Commands:', 'info');
    console.log('');
    console.log('# Install dependencies:');
    console.log('cd dual-agent-monitor && pnpm install');
    console.log('');
    console.log('# Start development servers (run in separate terminals):');
    console.log('cd dual-agent-monitor && pnpm run server:dev  # API + WebSocket');
    console.log('cd dual-agent-monitor && pnpm run client:dev  # Frontend UI');
    console.log('');
    console.log('# Or start both together:');
    console.log('cd dual-agent-monitor && pnpm run dev');
    console.log('');
    
    if (hasErrors) {
      this.log('⚡ Please resolve the errors above, then run this verification again.', 'error');
      process.exit(1);
    } else {
      this.log('⚡ Resolve warnings if needed, then run: node test-dual-agent-session.js', 'info');
    }
  }
}

// Main execution
async function main() {
  const verifier = new MonitoringSetupVerifier();
  
  try {
    await verifier.runVerification();
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('\n🛑 Verification interrupted');
  process.exit(0);
});

main().catch(console.error);