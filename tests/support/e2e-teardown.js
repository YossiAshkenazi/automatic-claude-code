/**
 * Global E2E Test Teardown
 * Cleans up after end-to-end testing
 */

const fs = require('fs');
const path = require('path');

module.exports = async () => {
  console.log('🧹 Cleaning up E2E test environment...');

  try {
    // Clean up test workspace but preserve test data for debugging
    const testDataDir = path.join(__dirname, '../fixtures/e2e-data');
    const testWorkspace = path.join(testDataDir, 'test-workspace');

    if (fs.existsSync(testWorkspace)) {
      // Clean workspace files but keep directory structure
      const files = fs.readdirSync(testWorkspace);
      files.forEach(file => {
        const filePath = path.join(testWorkspace, file);
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
          fs.unlinkSync(filePath);
        }
      });
    }

    // Clean environment variables
    delete process.env.ACC_TEST_MODE;
    delete process.env.ACC_CONFIG_PATH;

    console.log('✅ E2E test cleanup completed');
  } catch (error) {
    console.warn('⚠️ E2E cleanup warning:', error.message);
  }
};