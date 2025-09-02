# Test Infrastructure Documentation

## Overview

This directory contains the comprehensive test suite for the Automatic Claude Code project, organized into a structured hierarchy that supports different testing strategies and requirements.

## Directory Structure

```
tests/
├── unit/                      # Unit tests for individual components
│   ├── *.test.ts             # TypeScript unit tests
│   ├── *.test.js             # JavaScript unit tests
│   └── components/           # Component-specific tests
├── integration/              # Integration tests for system interactions
│   ├── python-sdk/          # Python SDK integration tests
│   ├── dual-agent-monitor/  # Monitoring system tests
│   ├── *.test.ts            # TypeScript integration tests
│   └── *.test.js            # JavaScript integration tests
├── e2e/                     # End-to-end tests for complete workflows
│   ├── *.test.ts           # TypeScript E2E tests
│   ├── *.test.js           # JavaScript E2E tests
│   └── *.ps1               # PowerShell E2E scripts
├── load/                   # Performance and load tests
│   ├── *.test.ts          # Load testing suites
│   └── performance/       # Performance benchmarks
├── fixtures/              # Test data and mocks
│   ├── mocks/            # Mock implementations
│   ├── test-config.json  # Test configurations
│   └── e2e-data/         # E2E test data
└── support/              # Test utilities and infrastructure
    ├── setup.ts          # Test environment setup
    ├── test-runner.js    # Comprehensive test runner
    ├── test-utils.js     # Common test utilities
    ├── e2e-setup.js      # E2E environment setup
    └── e2e-teardown.js   # E2E cleanup
```

## Test Categories

### 1. Unit Tests (`tests/unit/`)

**Purpose**: Test individual functions, classes, and components in isolation.

**Characteristics**:
- Fast execution (< 1 second each)
- No external dependencies
- Mock all external services
- High code coverage

**Examples**:
- Buffer management utilities
- OAuth token extraction
- Stream JSON parsing
- Session management logic

**Running Unit Tests**:
```bash
pnpm run test:unit          # Run all unit tests
pnpm run test:unit --watch  # Watch mode for development
```

### 2. Integration Tests (`tests/integration/`)

**Purpose**: Test interactions between components and external services.

**Characteristics**:
- Medium execution time (1-30 seconds)
- Test real component interactions
- May use test databases/services
- Network-dependent tests

**Examples**:
- SDK integration with Claude CLI
- Database connectivity
- API endpoint testing
- Agent coordination

**Running Integration Tests**:
```bash
pnpm run test:integration     # Run all integration tests
pnpm run test:integration --coverage  # With coverage
```

### 3. End-to-End Tests (`tests/e2e/`)

**Purpose**: Test complete user workflows and system behavior.

**Characteristics**:
- Slow execution (30+ seconds)
- Test full application flow
- Use production-like environment
- Cross-platform compatibility

**Examples**:
- Complete task execution workflows
- CLI command validation
- Dual-agent coordination scenarios
- Authentication flows

**Running E2E Tests**:
```bash
pnpm run test:e2e           # Run all E2E tests
pnpm run test:e2e --maxWorkers=1  # Sequential execution
```

### 4. Load Tests (`tests/load/`)

**Purpose**: Test system performance under various load conditions.

**Characteristics**:
- Long execution time (minutes)
- High resource usage
- Performance metrics collection
- Stress testing scenarios

**Examples**:
- Concurrent task processing
- Memory usage under load
- SDK rate limiting
- Agent coordination performance

**Running Load Tests**:
```bash
pnpm run test:load          # Run load tests
pnpm run test:load --timeout=300000  # Extended timeout
```

## Test Infrastructure

### Test Runner (`tests/support/test-runner.js`)

The comprehensive test runner orchestrates execution across all test categories:

```bash
# Run all tests sequentially
pnpm run test:all

# Run tests in parallel (faster)
pnpm run test:all:parallel

# Skip slow tests for CI
pnpm run test:validate

# Custom runner options
node tests/support/test-runner.js --skip-e2e --parallel --coverage
```

**Runner Options**:
- `--parallel`: Run unit and integration tests in parallel
- `--skip-e2e`: Skip end-to-end tests
- `--skip-load`: Skip load tests
- `--coverage`: Generate coverage reports

### Configuration Files

- `jest.config.js` - Unit test configuration
- `jest.config.integration.js` - Integration test configuration
- `jest.config.e2e.js` - E2E test configuration
- `jest.config.load.js` - Load test configuration
- `jest.config.sdk.js` - SDK-specific test configuration

### Test Utilities (`tests/support/test-utils.js`)

Common utilities available to all tests:

```javascript
const TestUtils = require('../support/test-utils');

// Create temporary test directory
const tempDir = TestUtils.createTempDir();

// Mock Claude CLI responses
const mockResponse = TestUtils.mockClaudeResponse('Task completed');

// Wait for async conditions
await TestUtils.waitFor(() => condition, 5000);

// Execute system commands
const result = await TestUtils.executeCommand('acc', ['--version']);

// Generate test data
const testTask = TestUtils.generateTestData('complex_task');
```

## Test Organization Migration

This test structure consolidates 142 previously scattered test files:

- **48 Python files** → `tests/integration/python-sdk/`
- **53 JavaScript files** → `tests/integration/` and `tests/unit/`
- **22 TypeScript files** → `tests/unit/` and `tests/integration/`
- **12 PowerShell files** → `tests/e2e/`
- **7 Mock files** → `tests/fixtures/mocks/`

## Best Practices

### Writing Unit Tests
```typescript
// tests/unit/example.test.ts
import { ExampleClass } from '@/services/ExampleClass';

describe('ExampleClass', () => {
  beforeEach(() => {
    // Setup before each test
  });

  it('should handle basic functionality', () => {
    const instance = new ExampleClass();
    const result = instance.process('input');
    expect(result).toBe('expected');
  });
});
```

### Writing Integration Tests
```javascript
// tests/integration/example.test.js
const TestUtils = require('../support/test-utils');

describe('System Integration', () => {
  beforeAll(async () => {
    TestUtils.setupTestEnv();
  });

  afterAll(async () => {
    TestUtils.cleanupTestEnv();
  });

  it('should integrate components correctly', async () => {
    const result = await TestUtils.executeCommand('acc', ['run', 'test task']);
    expect(result.success).toBe(true);
  });
});
```

### Writing E2E Tests
```typescript
// tests/e2e/example.test.ts
describe('Complete Workflow', () => {
  it('should execute full user journey', async () => {
    // Test complete user workflow
    const tempWorkspace = TestUtils.createTempDir();
    
    try {
      // Execute workflow steps
      const result = await executeCompleteWorkflow();
      expect(result.success).toBe(true);
    } finally {
      TestUtils.cleanupTempDir(tempWorkspace);
    }
  });
});
```

## Continuous Integration

### GitHub Actions Integration
```yaml
# .github/workflows/test.yml (example)
- name: Run Test Suite
  run: |
    pnpm run test:validate  # Fast validation tests
    pnpm run test:unit      # Full unit test suite
    pnpm run test:integration  # Integration tests
```

### Local Development Workflow
```bash
# Quick validation during development
pnpm run test:validate

# Watch unit tests while coding
pnpm run test:unit --watch

# Full test suite before committing
pnpm run test:all

# Performance testing before releases
pnpm run test:load
```

## Debugging Tests

### Common Debugging Commands
```bash
# Run specific test file
npx jest tests/unit/bufferManager.test.ts

# Run tests with debug output
DEBUG=* pnpm run test:unit

# Run single test with verbose output
npx jest --testNamePattern="specific test" --verbose

# Generate coverage report
pnpm run test:coverage:all
```

### Test Failure Investigation
1. Check test logs in `test-results.json`
2. Review coverage reports in `coverage/`
3. Use `--verbose` flag for detailed output
4. Check `tests/fixtures/temp/` for test artifacts

## Performance Metrics

The test suite is designed for optimal performance:

- **Unit Tests**: < 30 seconds total
- **Integration Tests**: < 2 minutes total
- **E2E Tests**: < 5 minutes total
- **Load Tests**: < 10 minutes total

**Parallel Execution**: Reduces total time by ~60% for unit and integration tests.

## Maintenance

### Adding New Tests
1. Place in appropriate category directory
2. Follow naming conventions (`*.test.ts`, `*.test.js`)
3. Use shared utilities from `tests/support/`
4. Update this documentation if adding new patterns

### Migrating Old Tests
1. Categorize by test type (unit/integration/e2e/load)
2. Update import paths to use `@/` alias
3. Migrate to new test utilities
4. Update configuration if needed

## Support and Troubleshooting

### Common Issues
1. **Import path errors**: Update to use `@/` alias
2. **Mock not found**: Check `tests/fixtures/mocks/`
3. **Setup failures**: Verify `tests/support/setup.ts`
4. **Timeout issues**: Adjust test timeouts in config files

### Getting Help
- Check test logs and coverage reports
- Review existing test patterns in each category
- Use test utilities for common operations
- Reference Jest documentation for advanced features

---

*This test infrastructure supports the comprehensive testing needs of the Automatic Claude Code project while maintaining excellent performance and developer experience.*