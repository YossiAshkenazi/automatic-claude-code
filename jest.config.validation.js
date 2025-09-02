module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: [
    '**/validation/**/*.test.ts',
    '**/validation/**/*.test.js',
    '**/validation/**/*.js',
    '!**/node_modules/**',
    '!**/fixtures/**'
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
  coverageDirectory: 'coverage/validation',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/support/setup.ts'],
  testTimeout: 60000, // Validation tests may take longer
  verbose: true,
  detectOpenHandles: true,
  forceExit: true,
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(strip-ansi|ansi-regex|chalk|boxen|cli-progress|ora|blessed|blessed-contrib|cli-highlight|cli-table3)/)'
  ]
};