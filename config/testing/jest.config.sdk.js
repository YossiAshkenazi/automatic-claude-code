const path = require('path');

// Base directory is two levels up from config/testing/
const baseDir = path.resolve(__dirname, '../../');

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: baseDir,
  roots: ['<rootDir>'],
  testMatch: ['**/test-sdk-integration.ts'],
  // setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'], // Commented out - setup file doesn't exist
  collectCoverage: true,
  collectCoverageFrom: [
    'src/services/sdkClaudeExecutor.ts',
    'src/services/claudeExecutor.ts'
  ],
  coverageDirectory: 'coverage/sdk',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 30000,
  verbose: true,
  detectOpenHandles: true,
  forceExit: true,
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  }
};