const path = require('path');

// Base directory is two levels up from config/testing/
const baseDir = path.resolve(__dirname, '../../');

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: baseDir,
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '!**/__tests__/manual/**',
    '!**/__tests__/setup.ts'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: path.join(baseDir, 'tsconfig.test.json')
    }]
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/test/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testTimeout: 10000,
  verbose: true,
  transformIgnorePatterns: [
    'node_modules/(?!(strip-ansi|ansi-regex|chalk|boxen|cli-progress|ora|blessed|blessed-contrib|cli-highlight|cli-table3)/)'
  ],
  moduleNameMapper: {
    '^strip-ansi$': '<rootDir>/src/__tests__/__mocks__/strip-ansi.js',
    '^chalk$': '<rootDir>/src/__tests__/__mocks__/chalk.js',
    '^boxen$': '<rootDir>/src/__tests__/__mocks__/boxen.js',
    '^cli-progress$': '<rootDir>/src/__tests__/__mocks__/cli-progress.js',
    '^ora$': '<rootDir>/src/__tests__/__mocks__/ora.js',
    '^blessed$': '<rootDir>/src/__tests__/__mocks__/blessed.js',
    '^blessed-contrib$': '<rootDir>/src/__tests__/__mocks__/blessed-contrib.js',
    '^cli-highlight$': '<rootDir>/src/__tests__/__mocks__/cli-highlight.js',
    '^cli-table3$': '<rootDir>/src/__tests__/__mocks__/cli-table3.js'
  }
};