const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const platformDetection = require('./platform-detection.js');
const UniversalHookWrapper = require('./universal-hook-wrapper.js');

/**
 * Platform Verification System
 * Tests hook execution across all supported platforms and validates functionality
 */
class PlatformVerification {
  constructor(options = {}) {
    this.debug = options.debug || process.env.DEBUG === 'true';
    this.hookDir = options.hookDir || path.join(__dirname, '..', 'universal-hooks');
    this.timeout = options.timeout || 5000; // 5 second timeout for tests
    this.wrapper = new UniversalHookWrapper({ 
      debug: this.debug, 
      timeout: this.timeout,
      hookDir: this.hookDir
    });
    this.results = {};
  }

  /**
   * Log debug messages if debug mode is enabled
   * @param {string} message - Debug message
   */
  _debug(message) {
    if (this.debug) {
      console.log(`[DEBUG] PlatformVerification: ${message}`);
    }
  }

  /**
   * Log information messages
   * @param {string} message - Info message
   */
  _info(message) {
    console.log(`[INFO] ${message}`);
  }

  /**
   * Log warning messages
   * @param {string} message - Warning message
   */
  _warn(message) {
    console.log(`[WARN] ${message}`);
  }

  /**
   * Log error messages
   * @param {string} message - Error message
   */
  _error(message) {
    console.log(`[ERROR] ${message}`);
  }

  /**
   * Get all hook types to test
   * @returns {Array<string>} - Array of hook names
   */
  getHookTypes() {
    return [
      'user-prompt-submit-hook',
      'pre-tool-use-hook',
      'post-tool-use-hook',
      'notification-hook',
      'pre-compact-hook',
      'stop-hook',
      'subagent-stop-hook'
    ];
  }

  /**
   * Create test data for hook execution
   * @param {string} hookType - Type of hook
   * @returns {object} - Test data object
   */
  createTestData(hookType) {
    const baseData = {
      session_id: 'test-session-' + Date.now(),
      cwd: process.cwd(),
      transcript_path: '/tmp/test-transcript.json',
      platform: platformDetection.detectPlatform(),
      timestamp: new Date().toISOString(),
      user: 'test-user'
    };

    // Add hook-specific data
    const hookSpecificData = {
      'user-prompt-submit-hook': {
        prompt: 'Test user prompt for verification'
      },
      'pre-tool-use-hook': {
        tool_name: 'TestTool',
        tool_args: JSON.stringify({ test: 'value' })
      },
      'post-tool-use-hook': {
        tool_name: 'TestTool',
        tool_result: JSON.stringify({ success: true, test: 'result' })
      },
      'notification-hook': {
        message: 'Test notification message'
      },
      'pre-compact-hook': {
        message: 'Context compaction starting'
      },
      'stop-hook': {
        message: 'Session ending'
      },
      'subagent-stop-hook': {
        message: 'Subagent terminating'
      }
    };

    return { ...baseData, ...hookSpecificData[hookType] };
  }

  /**
   * Validate hook execution result (hooks don't return JSON, they send to server)
   * @param {object} executionResult - Full execution result from wrapper
   * @param {string} hookType - Type of hook
   * @returns {object} - Validation result
   */
  validateHookExecution(executionResult, hookType) {
    const result = {
      isValid: false,
      executionSuccess: false,
      hasExpectedBehavior: false,
      errors: [],
      warnings: []
    };

    // Check if execution was successful (exit code 0)
    if (executionResult.exitCode === 0) {
      result.executionSuccess = true;
      this._debug(`Hook ${hookType} executed successfully (exit code 0)`);
    } else {
      result.errors.push(`Hook failed with exit code: ${executionResult.exitCode}`);
    }

    // Check if there were critical errors in stderr
    if (executionResult.stderr && executionResult.stderr.trim().length > 0) {
      const stderr = executionResult.stderr.toLowerCase();
      
      // Check for critical errors
      if (stderr.includes('error') || stderr.includes('failed') || stderr.includes('cannot')) {
        result.errors.push(`Stderr contains errors: ${executionResult.stderr.substring(0, 200)}`);
      } else {
        // Non-critical stderr (warnings, info messages)
        result.warnings.push(`Stderr output: ${executionResult.stderr.substring(0, 100)}`);
      }
    }

    // For these hooks, successful execution means:
    // 1. Exit code 0
    // 2. No critical errors
    // 3. Process didn't timeout or crash
    if (result.executionSuccess && result.errors.length === 0) {
      result.hasExpectedBehavior = true;
      
      // Additional checks based on execution strategy
      if (executionResult.strategy) {
        this._debug(`Hook executed using strategy: ${executionResult.strategy}`);
      }
      
      if (executionResult.fallbackMode) {
        result.warnings.push('Hook executed in fallback mode - some features may be limited');
      }
      
      // Check if hook completed in reasonable time
      const executionTime = executionResult.executionTime || 0;
      if (executionTime > 5000) {
        result.warnings.push(`Slow execution: ${executionTime}ms (consider optimization)`);
      }
    }

    // Hook-specific validation
    const hookValidationResult = this.validateHookSpecificBehavior(executionResult, hookType);
    result.warnings.push(...hookValidationResult.warnings);
    result.errors.push(...hookValidationResult.errors);

    result.isValid = result.executionSuccess && result.hasExpectedBehavior && result.errors.length === 0;
    return result;
  }

  /**
   * Perform hook-specific validation
   * @param {object} executionResult - Execution result
   * @param {string} hookType - Type of hook
   * @returns {object} - Hook-specific validation result
   */
  validateHookSpecificBehavior(executionResult, hookType) {
    const result = {
      warnings: [],
      errors: []
    };

    // These hooks send data to observability server, so they shouldn't produce stdout
    // unless there's an error or debug output
    if (executionResult.stdout && executionResult.stdout.trim().length > 0) {
      // Check if stdout contains error messages or unexpected output
      const stdout = executionResult.stdout.toLowerCase();
      
      if (stdout.includes('error') || stdout.includes('failed')) {
        result.errors.push(`Unexpected error output: ${executionResult.stdout.substring(0, 100)}`);
      } else if (stdout.length > 100) {
        result.warnings.push('Hook produced unexpected stdout output - may indicate debug mode or errors');
      }
    }

    // Check for network-related issues (common failure point)
    if (executionResult.stderr) {
      const stderr = executionResult.stderr.toLowerCase();
      
      if (stderr.includes('connection refused') || stderr.includes('network') || 
          stderr.includes('timeout') || stderr.includes('unreachable')) {
        result.warnings.push('Network connectivity issue detected - observability server may not be running');
      }
      
      if (stderr.includes('curl') && stderr.includes('not found')) {
        result.errors.push('curl command not found - required for HTTP communication');
      }
      
      if (stderr.includes('jq') && stderr.includes('not found')) {
        result.warnings.push('jq command not found - using fallback JSON parsing');
      }
    }

    return result;
  }

  /**
   * Test a specific hook type
   * @param {string} hookType - Type of hook to test
   * @returns {Promise<object>} - Test result
   */
  async testHook(hookType) {
    const startTime = Date.now();
    this._debug(`Testing hook: ${hookType}`);

    const testResult = {
      hookType,
      platform: platformDetection.detectPlatform(),
      success: false,
      executionTime: 0,
      strategies: [],
      validation: null,
      errors: []
    };

    try {
      // Create test environment variables
      const testData = this.createTestData(hookType);
      const testEnv = {};
      
      // Map test data to environment variables
      Object.keys(testData).forEach(key => {
        const envKey = `CLAUDE_${key.toUpperCase()}`;
        testEnv[envKey] = typeof testData[key] === 'object' ? JSON.stringify(testData[key]) : testData[key];
      });

      this._debug(`Created test environment with ${Object.keys(testEnv).length} variables`);

      // Execute hook with test data
      const result = await this.wrapper.executeHookWithFallback(hookType, [], { 
        env: testEnv,
        timeout: this.timeout
      });

      testResult.executionTime = Date.now() - startTime;
      testResult.strategies = result.attemptResults || [];

      // Validate execution (not expecting JSON output, just successful execution)
      testResult.validation = this.validateHookExecution(result, hookType);
      
      if (testResult.validation.isValid) {
        testResult.success = true;
        this._debug(`Hook ${hookType} test passed`);
      } else {
        testResult.errors = testResult.validation.errors;
        if (testResult.validation.warnings.length > 0) {
          testResult.warnings = testResult.validation.warnings;
          this._debug(`Hook ${hookType} warnings: ${testResult.validation.warnings.join('; ')}`);
        }
        this._debug(`Hook ${hookType} validation failed: ${testResult.errors.join(', ')}`);
      }

      // Store execution details
      testResult.executionDetails = {
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        strategy: result.strategy,
        fallbackMode: result.fallbackMode
      };

    } catch (error) {
      testResult.executionTime = Date.now() - startTime;
      testResult.errors.push(`Test execution error: ${error.message}`);
      this._debug(`Hook ${hookType} test failed with error: ${error.message}`);
    }

    return testResult;
  }

  /**
   * Test all hook types on current platform
   * @returns {Promise<object>} - Complete test results
   */
  async testAllHooks() {
    this._info('Starting comprehensive hook testing...');
    
    const platform = platformDetection.detectPlatform();
    const validation = platformDetection.validateEnvironment();
    
    const results = {
      platform,
      environmentValidation: validation,
      timestamp: new Date().toISOString(),
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        executionTime: 0
      },
      hookResults: {},
      platformCapabilities: await this.assessPlatformCapabilities(),
      recommendations: []
    };

    this._info(`Testing on platform: ${platform}`);
    
    if (!validation.isValid) {
      this._warn('Environment validation failed, some tests may not work properly');
      results.recommendations.push('Fix environment issues before deploying hooks');
    }

    const hookTypes = this.getHookTypes();
    results.summary.total = hookTypes.length;

    const testStartTime = Date.now();

    // Test each hook type
    for (const hookType of hookTypes) {
      this._info(`Testing ${hookType}...`);
      
      try {
        const result = await this.testHook(hookType);
        results.hookResults[hookType] = result;
        
        if (result.success) {
          results.summary.passed++;
          this._info(`✅ ${hookType} - PASSED (${result.executionTime}ms)`);
        } else {
          results.summary.failed++;
          this._error(`❌ ${hookType} - FAILED: ${result.errors.join('; ')}`);
        }
      } catch (error) {
        results.summary.failed++;
        results.hookResults[hookType] = {
          hookType,
          success: false,
          errors: [`Test setup error: ${error.message}`],
          executionTime: 0
        };
        this._error(`❌ ${hookType} - ERROR: ${error.message}`);
      }
    }

    results.summary.executionTime = Date.now() - testStartTime;
    
    // Generate recommendations
    results.recommendations.push(...this.generateRecommendations(results));

    this._info(`Testing completed: ${results.summary.passed}/${results.summary.total} passed in ${results.summary.executionTime}ms`);

    return results;
  }

  /**
   * Assess platform capabilities
   * @returns {Promise<object>} - Platform capability assessment
   */
  async assessPlatformCapabilities() {
    const platform = platformDetection.detectPlatform();
    const capabilities = {
      platform,
      availableShells: [],
      availableCommands: [],
      scriptSupport: {},
      networkAccess: false,
      permissions: {}
    };

    // Test shell availability
    const shells = ['bash', 'powershell', 'pwsh', 'node'];
    for (const shell of shells) {
      try {
        const testCommand = shell === 'node' ? 'node --version' : 
                           shell === 'bash' ? 'bash --version' :
                           `${shell} -Command "Get-Host"`;
        
        await this._execCommand(testCommand, { timeout: 2000 });
        capabilities.availableShells.push(shell);
      } catch (e) {
        // Shell not available
      }
    }

    // Test command availability
    const commands = ['curl', 'wget', 'jq'];
    for (const cmd of commands) {
      try {
        await this._execCommand(`${cmd} --version`, { timeout: 2000 });
        capabilities.availableCommands.push(cmd);
      } catch (e) {
        // Command not available
      }
    }

    // Test script support
    capabilities.scriptSupport = {
      powershell: capabilities.availableShells.includes('powershell') || capabilities.availableShells.includes('pwsh'),
      bash: capabilities.availableShells.includes('bash'),
      node: capabilities.availableShells.includes('node')
    };

    // Test basic network access (without making actual requests)
    try {
      const os = require('os');
      capabilities.networkAccess = Object.keys(os.networkInterfaces()).length > 0;
    } catch (e) {
      capabilities.networkAccess = false;
    }

    // Test basic permissions
    try {
      const tempFile = path.join(require('os').tmpdir(), 'test-' + Date.now());
      require('fs').writeFileSync(tempFile, 'test');
      require('fs').unlinkSync(tempFile);
      capabilities.permissions.canWriteTemp = true;
    } catch (e) {
      capabilities.permissions.canWriteTemp = false;
    }

    return capabilities;
  }

  /**
   * Execute a command for testing
   * @param {string} command - Command to execute
   * @param {object} options - Execution options
   * @returns {Promise<object>} - Execution result
   */
  _execCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ');
      const child = spawn(cmd, args, {
        stdio: 'ignore',
        timeout: options.timeout || 5000
      });

      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Command timeout'));
      }, options.timeout || 5000);

      child.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve({ exitCode: code });
        } else {
          reject(new Error(`Command failed with exit code ${code}`));
        }
      });

      child.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Generate recommendations based on test results
   * @param {object} results - Test results
   * @returns {Array<string>} - Array of recommendations
   */
  generateRecommendations(results) {
    const recommendations = [];
    const { summary, environmentValidation, hookResults, platformCapabilities } = results;

    // General recommendations
    if (summary.failed === 0) {
      recommendations.push('✅ All hooks are working correctly on this platform');
    } else if (summary.passed > summary.failed) {
      recommendations.push('⚠️ Most hooks are working, but some issues need attention');
    } else {
      recommendations.push('❌ Major issues detected - platform may not be suitable for hook execution');
    }

    // Environment-specific recommendations
    if (!environmentValidation.isValid) {
      recommendations.push('🔧 Fix environment validation issues first');
      environmentValidation.recommendations.forEach(rec => {
        recommendations.push(`  • ${rec}`);
      });
    }

    // Hook-specific recommendations
    Object.values(hookResults).forEach(result => {
      if (!result.success && result.errors.length > 0) {
        recommendations.push(`🐛 ${result.hookType}: ${result.errors[0]}`);
      }
    });

    // Platform capability recommendations
    if (!platformCapabilities.scriptSupport.powershell && !platformCapabilities.scriptSupport.bash) {
      recommendations.push('⚠️ No supported shell found - install PowerShell or Bash');
    }

    if (!platformCapabilities.networkAccess) {
      recommendations.push('🌐 Network access may be limited - check connectivity');
    }

    // Performance recommendations
    const avgExecutionTime = summary.executionTime / summary.total;
    if (avgExecutionTime > 1000) {
      recommendations.push('⏱️ Hook execution is slow - consider optimization');
    }

    return recommendations;
  }

  /**
   * Generate compatibility report
   * @param {object} results - Test results
   * @returns {string} - Formatted compatibility report
   */
  generateCompatibilityReport(results) {
    const lines = [];
    
    // Header
    lines.push('🚀 PLATFORM COMPATIBILITY REPORT');
    lines.push('=' .repeat(50));
    lines.push(`Platform: ${results.platform}`);
    lines.push(`Timestamp: ${results.timestamp}`);
    lines.push('');

    // Summary
    lines.push('📊 SUMMARY');
    lines.push('-'.repeat(20));
    lines.push(`Total Hooks Tested: ${results.summary.total}`);
    lines.push(`✅ Passed: ${results.summary.passed}`);
    lines.push(`❌ Failed: ${results.summary.failed}`);
    lines.push(`⏱️ Total Execution Time: ${results.summary.executionTime}ms`);
    lines.push(`📈 Success Rate: ${Math.round((results.summary.passed / results.summary.total) * 100)}%`);
    lines.push('');

    // Environment validation
    lines.push('🔍 ENVIRONMENT VALIDATION');
    lines.push('-'.repeat(30));
    lines.push(`Status: ${results.environmentValidation.isValid ? '✅ Valid' : '❌ Invalid'}`);
    
    if (results.environmentValidation.warnings.length > 0) {
      lines.push('Warnings:');
      results.environmentValidation.warnings.forEach(warning => {
        lines.push(`  ⚠️ ${warning}`);
      });
    }

    if (results.environmentValidation.errors.length > 0) {
      lines.push('Errors:');
      results.environmentValidation.errors.forEach(error => {
        lines.push(`  ❌ ${error}`);
      });
    }
    lines.push('');

    // Platform capabilities
    lines.push('⚙️ PLATFORM CAPABILITIES');
    lines.push('-'.repeat(25));
    lines.push(`Available Shells: ${results.platformCapabilities.availableShells.join(', ') || 'None'}`);
    lines.push(`Available Commands: ${results.platformCapabilities.availableCommands.join(', ') || 'None'}`);
    lines.push(`PowerShell Support: ${results.platformCapabilities.scriptSupport.powershell ? '✅' : '❌'}`);
    lines.push(`Bash Support: ${results.platformCapabilities.scriptSupport.bash ? '✅' : '❌'}`);
    lines.push(`Node.js Support: ${results.platformCapabilities.scriptSupport.node ? '✅' : '❌'}`);
    lines.push(`Network Access: ${results.platformCapabilities.networkAccess ? '✅' : '❌'}`);
    lines.push(`Temp Write Access: ${results.platformCapabilities.permissions.canWriteTemp ? '✅' : '❌'}`);
    lines.push('');

    // Hook test results
    lines.push('🎯 HOOK TEST RESULTS');
    lines.push('-'.repeat(25));
    Object.values(results.hookResults).forEach(result => {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      const time = `(${result.executionTime}ms)`;
      const strategy = result.executionDetails?.strategy ? ` [${result.executionDetails.strategy}]` : '';
      lines.push(`${result.hookType}: ${status} ${time}${strategy}`);
      
      // Show warnings even for successful tests
      if (result.warnings && result.warnings.length > 0) {
        result.warnings.forEach(warning => {
          lines.push(`    ⚠️  ${warning}`);
        });
      }
      
      // Show errors for failed tests
      if (!result.success && result.errors.length > 0) {
        result.errors.forEach(error => {
          lines.push(`    ❌ ${error}`);
        });
      }
      
      // Show execution details for debugging
      if (result.executionDetails && (result.executionDetails.stderr || result.executionDetails.stdout)) {
        if (result.executionDetails.stderr) {
          const stderr = result.executionDetails.stderr.substring(0, 100).replace(/\n/g, ' ');
          lines.push(`    📝 stderr: ${stderr}${result.executionDetails.stderr.length > 100 ? '...' : ''}`);
        }
        if (result.executionDetails.stdout && result.executionDetails.stdout.trim()) {
          const stdout = result.executionDetails.stdout.substring(0, 100).replace(/\n/g, ' ');
          lines.push(`    📝 stdout: ${stdout}${result.executionDetails.stdout.length > 100 ? '...' : ''}`);
        }
      }
    });
    lines.push('');

    // Recommendations
    lines.push('💡 RECOMMENDATIONS');
    lines.push('-'.repeat(20));
    results.recommendations.forEach(rec => {
      lines.push(rec);
    });
    lines.push('');

    // Footer
    lines.push('=' .repeat(50));
    lines.push('Report generated by Universal Hook Wrapper');
    lines.push(`For support: Check troubleshooting documentation`);

    return lines.join('\n');
  }

  /**
   * Run complete platform verification and generate report
   * @returns {Promise<object>} - Complete verification results
   */
  async runVerification() {
    try {
      this._info('🚀 Starting Platform Verification...');
      
      const results = await this.testAllHooks();
      const report = this.generateCompatibilityReport(results);
      
      // Save results to file
      const resultsFile = path.join(require('os').tmpdir(), `platform-verification-${Date.now()}.json`);
      const reportFile = path.join(require('os').tmpdir(), `platform-compatibility-${Date.now()}.txt`);
      
      try {
        fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
        fs.writeFileSync(reportFile, report);
        
        this._info(`📄 Results saved to: ${resultsFile}`);
        this._info(`📋 Report saved to: ${reportFile}`);
      } catch (e) {
        this._warn(`Could not save files: ${e.message}`);
      }

      // Display report
      console.log('\n' + report);

      return {
        results,
        report,
        files: {
          results: resultsFile,
          report: reportFile
        }
      };
      
    } catch (error) {
      this._error(`Verification failed: ${error.message}`);
      throw error;
    }
  }
}

module.exports = PlatformVerification;