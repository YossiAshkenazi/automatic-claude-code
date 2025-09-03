module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: [
    '**/unit/**/*.test.ts',
    '**/unit/**/*.test.js',
    '!**/fixtures/**',
    '!**/support/**'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json'
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
  setupFilesAfterEnv: ['<rootDir>/tests/support/setup.ts'],
  testTimeout: 10000,
  verbose: true,
  transformIgnorePatterns: [
    'node_modules/(?!(strip-ansi|ansi-regex|chalk|boxen|cli-progress|ora|blessed|blessed-contrib|cli-highlight|cli-table3)/)'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^strip-ansi$': '<rootDir>/tests/fixtures/mocks/strip-ansi.js',
    '^chalk$': '<rootDir>/tests/fixtures/mocks/chalk.js',
    '^boxen$': '<rootDir>/tests/fixtures/mocks/boxen.js',
    '^cli-progress$': '<rootDir>/tests/fixtures/mocks/cli-progress.js',
    '^ora$': '<rootDir>/tests/fixtures/mocks/ora.js',
    '^blessed$': '<rootDir>/tests/fixtures/mocks/blessed.js',
    '^blessed-contrib$': '<rootDir>/tests/fixtures/mocks/blessed-contrib.js',
    '^cli-highlight$': '<rootDir>/tests/fixtures/mocks/cli-highlight.js',
    '^cli-table3$': '<rootDir>/tests/fixtures/mocks/cli-table3.js'
  }
};