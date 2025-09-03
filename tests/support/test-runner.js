#!/usr/bin/env node

/**
 * Comprehensive Test Runner
 * Manages execution of different test suites with proper orchestration
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class TestRunner {
  constructor() {
    this.results = {
      unit: null,
      integration: null,
      validation: null,
      e2e: null,
      load: null
    };
  }

  async runTestSuite(type, config) {
    return new Promise((resolve, reject) => {
      console.log(`\n🚀 Running ${type} tests...`);
      
      const jest = spawn('npx', ['jest', '--config', config], {
        stdio: 'pipe',
        shell: true
      });

      let output = '';
      let errorOutput = '';

      jest.stdout.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        process.stdout.write(chunk);
      });

      jest.stderr.on('data', (data) => {
        const chunk = data.toString();
        errorOutput += chunk;
        process.stderr.write(chunk);
      });

      jest.on('close', (code) => {
        const result = {
          type,
          success: code === 0,
          code,
          output,
          errorOutput,
          timestamp: new Date().toISOString()
        };

        this.results[type] = result;
        
        if (code === 0) {
          console.log(`✅ ${type} tests completed successfully`);
          resolve(result);
        } else {
          console.log(`❌ ${type} tests failed with code ${code}`);
          reject(result);
        }
      });

      jest.on('error', (err) => {
        console.error(`Failed to start ${type} tests:`, err);
        reject(err);
      });
    });
  }

  async runAll(options = {}) {
    const { 
      skipE2E = false, 
      skipLoad = false,
      parallel = false,
      coverage = false
    } = options;

    console.log('🧪 Starting comprehensive test suite...');
    
    try {
      if (parallel) {
        // Run unit and integration tests in parallel
        const promises = [
          this.runTestSuite('unit', 'jest.config.js'),
          this.runTestSuite('integration', 'jest.config.integration.js')
        ];

        await Promise.all(promises);
      } else {
        // Sequential execution
        await this.runTestSuite('unit', 'jest.config.js');
        await this.runTestSuite('integration', 'jest.config.integration.js');
      }

      // E2E tests always run sequentially after unit/integration
      if (!skipE2E) {
        await this.runTestSuite('e2e', 'jest.config.e2e.js');
      }

      // Load tests run last and are optional
      if (!skipLoad) {
        await this.runTestSuite('load', 'jest.config.load.js');
      }

      this.generateReport();
      
    } catch (error) {
      console.error('❌ Test suite execution failed:', error);
      this.generateReport();
      process.exit(1);
    }
  }

  generateReport() {
    console.log('\n📊 Test Summary Report');
    console.log('=' * 50);

    let totalPassed = 0;
    let totalFailed = 0;

    Object.entries(this.results).forEach(([type, result]) => {
      if (result) {
        const status = result.success ? '✅ PASSED' : '❌ FAILED';
        console.log(`${type.toUpperCase().padEnd(12)} ${status}`);
        
        if (result.success) totalPassed++;
        else totalFailed++;
      }
    });

    console.log('=' * 50);
    console.log(`Total: ${totalPassed} passed, ${totalFailed} failed`);
    
    // Generate JSON report
    const reportPath = 'test-results.json';
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`📄 Detailed report saved to: ${reportPath}`);
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const runner = new TestRunner();
  
  const options = {
    skipE2E: args.includes('--skip-e2e'),
    skipLoad: args.includes('--skip-load'),
    parallel: args.includes('--parallel'),
    coverage: args.includes('--coverage')
  };

  runner.runAll(options);
}

module.exports = TestRunner;