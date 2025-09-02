#!/usr/bin/env node

/**
 * Complete Dual-Agent Monitoring Test Suite
 * 
 * This script runs the complete test suite for the dual-agent monitoring system:
 * 1. Verifies prerequisites and setup
 * 2. Runs comprehensive dual-agent session simulation  
 * 3. Validates data in dashboard
 * 4. Generates summary report
 * 
 * Usage:
 *   node run-full-test.js
 *   node run-full-test.js --fast    # Quick test with reduced delays
 *   node run-full-test.js --verbose # Detailed logging
 */

const { spawn } = require('child_process');
const path = require('path');

class DualAgentTestRunner {
  constructor() {
    this.args = process.argv.slice(2);
    this.verbose = this.args.includes('--verbose');
    this.fast = this.args.includes('--fast');
    this.errors = [];
    this.startTime = Date.now();
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString().substr(11, 8);
    const icons = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      step: '📋',
      result: '📊'
    };
    console.log(`[${timestamp}] ${icons[type]} ${message}`);
  }

  async runScript(scriptName, description, options = {}) {
    return new Promise((resolve, reject) => {
      this.log(`Running ${description}...`, 'step');
      
      const args = [scriptName];
      if (options.fast && this.fast) args.push('--fast');
      if (options.debug && this.verbose) args.push('--debug');
      
      const child = spawn('node', args, {
        cwd: __dirname,
        stdio: this.verbose ? 'inherit' : 'pipe'
      });

      let output = '';
      let errorOutput = '';

      if (!this.verbose) {
        child.stdout?.on('data', (data) => {
          output += data.toString();
        });

        child.stderr?.on('data', (data) => {
          errorOutput += data.toString();
        });
      }

      child.on('close', (code) => {
        if (code === 0) {
          this.log(`${description} completed successfully`, 'success');
          resolve({ success: true, output, errorOutput });
        } else {
          this.log(`${description} failed with code ${code}`, 'error');
          this.errors.push(`${description}: Exit code ${code}`);
          
          if (!this.verbose && errorOutput) {
            console.log('Error output:', errorOutput);
          }
          
          resolve({ success: false, output, errorOutput, code });
        }
      });

      child.on('error', (error) => {
        this.log(`${description} error: ${error.message}`, 'error');
        this.errors.push(`${description}: ${error.message}`);
        reject(error);
      });
    });
  }

  async waitForServices() {
    this.log('Checking if monitoring services are running...', 'step');
    
    // Give services time to start if they're not running
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const verifyResult = await this.runScript('verify-monitoring-setup.js', 'Service verification');
    
    if (!verifyResult.success) {
      this.log('⚠️  Monitoring services may not be fully ready', 'warning');
      this.log('   Make sure to run: cd dual-agent-monitor && pnpm run dev', 'info');
      this.log('   Or start API server: cd dual-agent-monitor && pnpm run server:dev', 'info');
      return false;
    }
    
    return true;
  }

  async runFullTestSuite() {
    this.log('🚀 Starting complete dual-agent monitoring test suite', 'info');
    this.log(`Mode: ${this.fast ? 'Fast' : 'Standard'} | Verbose: ${this.verbose}`, 'info');
    console.log('');

    // Step 1: Prerequisites check
    const servicesReady = await this.waitForServices();
    if (!servicesReady) {
      this.log('Services are not ready, but continuing with test...', 'warning');
    }

    // Step 2: Run main dual-agent session test
    const sessionTestArgs = { fast: true, debug: true };
    const sessionResult = await this.runScript(
      'test-dual-agent-session.js', 
      'Dual-agent session simulation',
      sessionTestArgs
    );

    if (!sessionResult.success) {
      this.log('❌ Main test failed, aborting test suite', 'error');
      this.generateFailureReport();
      return;
    }

    // Step 3: Verify data in dashboard
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for data to settle

    const dataResult = await this.runScript(
      'get-session-details.js',
      'Dashboard data verification'
    );

    // Step 4: Test API endpoints
    const apiResult = await this.runScript(
      'check-api-endpoints.js',
      'API endpoints verification'
    );

    // Generate final report
    this.generateFinalReport(sessionResult, dataResult, apiResult);
  }

  generateFinalReport(sessionResult, dataResult, apiResult) {
    const duration = ((Date.now() - this.startTime) / 1000 / 60).toFixed(1);
    
    console.log('');
    console.log('='.repeat(70));
    this.log('🎉 DUAL-AGENT MONITORING TEST SUITE COMPLETE', 'result');
    console.log('='.repeat(70));
    console.log('');

    this.log(`⏱️  Total Duration: ${duration} minutes`, 'info');
    this.log(`❌ Errors Encountered: ${this.errors.length}`, this.errors.length > 0 ? 'error' : 'success');
    
    console.log('');
    this.log('📊 Test Results:', 'result');
    
    const results = [
      { name: 'Prerequisites Check', status: 'completed' },
      { name: 'Dual-Agent Session Simulation', status: sessionResult.success ? 'passed' : 'failed' },
      { name: 'Dashboard Data Verification', status: dataResult.success ? 'passed' : 'failed' },
      { name: 'API Endpoints Check', status: apiResult.success ? 'passed' : 'failed' }
    ];

    results.forEach(result => {
      const icon = result.status === 'passed' ? '✅' : result.status === 'failed' ? '❌' : '⏺️';
      console.log(`   ${icon} ${result.name}: ${result.status.toUpperCase()}`);
    });

    if (this.errors.length > 0) {
      console.log('');
      this.log('🔍 Errors Details:', 'error');
      this.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    console.log('');
    this.log('🌐 Dashboard Access:', 'info');
    console.log('   Main Dashboard: http://localhost:6011');
    console.log('   API Endpoints:  http://localhost:4001/api');
    
    console.log('');
    this.log('📋 Next Steps:', 'info');
    console.log('   1. Open http://localhost:6011 to view the monitoring dashboard');
    console.log('   2. Check session details and real-time metrics');
    console.log('   3. Review the test data in the session list');
    console.log('   4. Test session replay functionality if available');
    
    console.log('');
    this.log('📖 Documentation:', 'info');
    console.log('   Read DUAL-AGENT-TEST-SUMMARY.md for detailed test results');
    
    const overallSuccess = this.errors.length === 0 && sessionResult.success;
    this.log(`🎯 Overall Result: ${overallSuccess ? 'SUCCESS' : 'PARTIAL SUCCESS'}`, overallSuccess ? 'success' : 'warning');
    
    console.log('');
    console.log('='.repeat(70));
  }

  generateFailureReport() {
    console.log('');
    console.log('❌ TEST SUITE FAILED');
    console.log('');
    
    this.log('🔧 Troubleshooting Steps:', 'info');
    console.log('   1. Ensure monitoring services are running:');
    console.log('      cd dual-agent-monitor && pnpm run dev');
    console.log('');
    console.log('   2. Check if ports are available:');
    console.log('      - API Server: http://localhost:4001');
    console.log('      - Frontend:   http://localhost:6011');
    console.log('');
    console.log('   3. Run individual verification:');
    console.log('      node verify-monitoring-setup.js');
    console.log('');
    console.log('   4. Try running tests individually:');
    console.log('      node test-dual-agent-session.js --fast');

    process.exit(1);
  }
}

// Main execution
async function main() {
  const runner = new DualAgentTestRunner();
  
  try {
    await runner.runFullTestSuite();
  } catch (error) {
    console.error('❌ Test suite execution failed:', error.message);
    process.exit(1);
  }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('\n🛑 Test suite interrupted by user');
  process.exit(0);
});

main().catch(console.error);