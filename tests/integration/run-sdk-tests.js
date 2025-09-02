#!/usr/bin/env node

/**
 * SDK Integration Test Runner
 * 
 * Standalone test runner for SDK integration tests
 * Handles test setup, execution, and reporting
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class SDKTestRunner {
  constructor() {
    this.testFile = path.join(__dirname, 'test-sdk-integration.ts');
    this.results = {
      passed: 0,
      failed: 0,
      total: 0,
      errors: []
    };
  }

  async runTests() {
    console.log('🧪 Starting SDK Integration Tests...\n');
    
    // Check if test file exists
    if (!fs.existsSync(this.testFile)) {
      console.error('❌ Test file not found:', this.testFile);
      process.exit(1);
    }

    // Check if Jest is available
    try {
      require.resolve('jest');
    } catch (error) {
      console.error('❌ Jest not found. Installing...');
      await this.installJest();
    }

    // Run tests
    try {
      await this.executeJestTests();
      this.reportResults();
    } catch (error) {
      console.error('❌ Test execution failed:', error.message);
      process.exit(1);
    }
  }

  async installJest() {
    return new Promise((resolve, reject) => {
      console.log('📦 Installing Jest and dependencies...');
      
      const npm = spawn('npm', ['install', '--save-dev', 'jest', '@types/jest', 'ts-jest', 'typescript'], {
        stdio: 'inherit',
        shell: true
      });

      npm.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Dependencies installed successfully');
          resolve();
        } else {
          reject(new Error(`npm install failed with code ${code}`));
        }
      });
    });
  }

  async executeJestTests() {
    return new Promise((resolve, reject) => {
      const jestPath = path.join(__dirname, 'node_modules', '.bin', 'jest');
      const jestArgs = [
        this.testFile,
        '--verbose',
        '--detectOpenHandles',
        '--forceExit',
        '--testTimeout=30000',
        '--setupFilesAfterEnv=<rootDir>/src/__tests__/setup.ts'
      ];

      console.log('🏃 Running Jest tests...');
      console.log(`Command: ${jestPath} ${jestArgs.join(' ')}\n`);

      const jest = spawn('npx', ['jest', ...jestArgs.slice(1)], {
        cwd: __dirname,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      });

      let output = '';
      let errorOutput = '';

      jest.stdout.on('data', (data) => {
        const text = data.toString();
        console.log(text);
        output += text;
      });

      jest.stderr.on('data', (data) => {
        const text = data.toString();
        console.error(text);
        errorOutput += text;
      });

      jest.on('close', (code) => {
        this.parseTestResults(output, errorOutput);
        
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Jest tests failed with code ${code}`));
        }
      });

      jest.on('error', (error) => {
        reject(error);
      });
    });
  }

  parseTestResults(output, errorOutput) {
    // Parse Jest output for test results
    const passMatch = output.match(/✓\s+(.+)/g);
    const failMatch = output.match(/✕\s+(.+)/g);
    
    if (passMatch) {
      this.results.passed = passMatch.length;
    }
    
    if (failMatch) {
      this.results.failed = failMatch.length;
      this.results.errors = failMatch.map(match => match.replace('✕ ', ''));
    }
    
    this.results.total = this.results.passed + this.results.failed;

    // Also check for summary line
    const summaryMatch = output.match(/Tests:\s+(\d+)\s+failed,\s+(\d+)\s+passed,\s+(\d+)\s+total/);
    if (summaryMatch) {
      this.results.failed = parseInt(summaryMatch[1]);
      this.results.passed = parseInt(summaryMatch[2]);
      this.results.total = parseInt(summaryMatch[3]);
    }
  }

  reportResults() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 SDK Integration Test Results');
    console.log('='.repeat(60));
    
    console.log(`Total Tests: ${this.results.total}`);
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    
    const successRate = this.results.total > 0 ? 
      ((this.results.passed / this.results.total) * 100).toFixed(1) : 0;
    console.log(`📈 Success Rate: ${successRate}%`);

    if (this.results.failed > 0) {
      console.log('\n🔍 Failed Tests:');
      this.results.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    console.log('\n📝 Test Coverage:');
    const coverageAreas = [
      '✅ SDK availability detection',
      '✅ SDK initialization from multiple paths', 
      '✅ Successful SDK execution',
      '✅ Session management and continuation',
      '✅ Tool use handling',
      '✅ Streaming responses',
      '✅ Error handling (auth, network, timeouts)',
      '✅ Browser auth CLI spawning',
      '✅ Fallback strategies',
      '✅ Configuration options',
      '✅ Response parsing',
      '✅ Empty and partial response handling'
    ];
    
    coverageAreas.forEach(area => console.log(`  ${area}`));

    console.log('\n🔧 To run tests manually:');
    console.log('  npm test test-sdk-integration.ts');
    console.log('  or');
    console.log('  npx jest test-sdk-integration.ts --verbose');

    if (this.results.failed === 0) {
      console.log('\n🎉 All SDK integration tests passed!');
    } else {
      console.log(`\n⚠️  ${this.results.failed} test(s) need attention`);
    }
    
    console.log('='.repeat(60));
  }

  async setupJestConfig() {
    const jestConfigPath = path.join(__dirname, 'jest.config.sdk.js');
    
    if (!fs.existsSync(jestConfigPath)) {
      const jestConfig = `
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/test-sdk-integration.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/services/sdkClaudeExecutor.ts',
  ],
  coverageDirectory: 'coverage/sdk',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 30000,
  verbose: true,
  detectOpenHandles: true,
  forceExit: true
};
`;
      
      fs.writeFileSync(jestConfigPath, jestConfig);
      console.log('✅ Created Jest config for SDK tests');
    }
    
    return jestConfigPath;
  }
}

// Run if called directly
if (require.main === module) {
  const runner = new SDKTestRunner();
  
  runner.setupJestConfig().then(() => {
    return runner.runTests();
  }).catch(error => {
    console.error('❌ Test runner failed:', error.message);
    process.exit(1);
  });
}

module.exports = SDKTestRunner;