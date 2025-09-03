module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: [
    '**/load/**/*.test.ts',
    '**/load/**/*.test.js'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json'
    }]
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/test/**'
  ],
  coverageDirectory: 'coverage/load',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/support/setup.ts'],
  testTimeout: 120000, // 2 minutes for load tests
  verbose: true,
  detectOpenHandles: true,
  forceExit: true,
  maxWorkers: '50%', // Use half the available workers for load tests
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  }
};