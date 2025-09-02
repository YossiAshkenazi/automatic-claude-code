/**
 * Test Utilities
 * Common utilities and helpers for all test types
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class TestUtils {
  /**
   * Create temporary test directory
   */
  static createTempDir(prefix = 'acc-test-') {
    const tempDir = path.join(__dirname, '../fixtures/temp', `${prefix}${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    return tempDir;
  }

  /**
   * Clean up temporary directory
   */
  static cleanupTempDir(dirPath) {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  }

  /**
   * Mock Claude CLI responses
   */
  static mockClaudeResponse(response) {
    return jest.fn().mockResolvedValue({
      success: true,
      output: response,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Wait for condition with timeout
   */
  static async waitFor(condition, timeout = 5000, interval = 100) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error(`Condition not met within ${timeout}ms`);
  }

  /**
   * Execute command and return result
   */
  static executeCommand(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        stdio: 'pipe',
        shell: true,
        ...options
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        resolve({
          code,
          stdout,
          stderr,
          success: code === 0
        });
      });

      proc.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Generate test data
   */
  static generateTestData(type) {
    const testData = {
      simple_task: "Create a hello world function",
      complex_task: "Implement a REST API with authentication, rate limiting, and error handling",
      sdk_response: {
        success: true,
        result: "Task completed successfully",
        metadata: {
          model: "claude-3-sonnet-20240229",
          usage: {
            input_tokens: 100,
            output_tokens: 50
          }
        }
      },
      error_response: {
        success: false,
        error: "Authentication failed",
        code: "AUTH_ERROR"
      }
    };

    return testData[type] || {};
  }

  /**
   * Create mock configuration
   */
  static createMockConfig(overrides = {}) {
    const defaultConfig = {
      defaultModel: 'sonnet',
      sdkIntegration: {
        enabled: true,
        timeout: 10000,
        retryAttempts: 1
      },
      dualAgentMode: {
        enabled: false
      },
      monitoring: {
        enabled: false
      }
    };

    return { ...defaultConfig, ...overrides };
  }

  /**
   * Setup test environment
   */
  static setupTestEnv() {
    process.env.NODE_ENV = 'test';
    process.env.ACC_TEST_MODE = 'true';
    
    // Prevent actual HTTP requests
    process.env.NO_NETWORK = 'true';
    
    // Use test configuration
    const testConfigPath = path.join(__dirname, '../fixtures/test-config.json');
    fs.writeFileSync(testConfigPath, JSON.stringify(this.createMockConfig(), null, 2));
    process.env.ACC_CONFIG_PATH = testConfigPath;
  }

  /**
   * Cleanup test environment
   */
  static cleanupTestEnv() {
    delete process.env.ACC_TEST_MODE;
    delete process.env.NO_NETWORK;
    delete process.env.ACC_CONFIG_PATH;
  }

  /**
   * Assert directory structure
   */
  static assertDirectoryStructure(basePath, expectedStructure) {
    for (const [relativePath, type] of Object.entries(expectedStructure)) {
      const fullPath = path.join(basePath, relativePath);
      
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Expected ${type} not found: ${fullPath}`);
      }

      const stat = fs.statSync(fullPath);
      if (type === 'directory' && !stat.isDirectory()) {
        throw new Error(`Expected directory but found file: ${fullPath}`);
      }
      if (type === 'file' && !stat.isFile()) {
        throw new Error(`Expected file but found directory: ${fullPath}`);
      }
    }
  }
}

module.exports = TestUtils;