/**
 * Global E2E Test Setup
 * Prepares environment for end-to-end testing
 */

const fs = require('fs');
const path = require('path');

module.exports = async () => {
  console.log('🔧 Setting up E2E test environment...');

  // Ensure test data directories exist
  const testDataDir = path.join(__dirname, '../fixtures/e2e-data');
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }

  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.ACC_TEST_MODE = 'true';
  process.env.ACC_CONFIG_PATH = path.join(testDataDir, 'test-config.json');

  // Create test configuration
  const testConfig = {
    defaultModel: 'sonnet',
    sdkIntegration: {
      enabled: true,
      timeout: 30000,
      retryAttempts: 2
    },
    dualAgentMode: {
      enabled: false
    },
    monitoring: {
      enabled: false
    }
  };

  fs.writeFileSync(process.env.ACC_CONFIG_PATH, JSON.stringify(testConfig, null, 2));

  // Prepare test workspace
  const testWorkspace = path.join(testDataDir, 'test-workspace');
  if (!fs.existsSync(testWorkspace)) {
    fs.mkdirSync(testWorkspace, { recursive: true });
  }

  console.log('✅ E2E test environment ready');
};