# Isolated Test Process Spawning

**Epic 3, Story 3.2**: Complete implementation of isolated test process spawning mechanism for the ACC SDK testing infrastructure.

## Overview

The `IsolatedTestRunner` provides complete process isolation for high-level integration tests by spawning separate Node.js processes. This eliminates shared state contamination between test runs while maintaining robust inter-process communication and resource management.

## Key Features

✅ **Complete Process Isolation**
- Each test runs in a separate Node.js process
- No shared state contamination between tests
- Independent memory spaces and event loops

✅ **Inter-Process Communication (IPC)**
- Real-time communication between parent and child processes
- Test progress monitoring and heartbeat detection
- Structured message passing with correlation IDs

✅ **Timeout Management**
- Configurable process execution timeouts
- Heartbeat monitoring for process health
- Forcible termination after timeout

✅ **Performance Optimized**
- Process spawning overhead under 2 seconds
- Concurrent process execution with limits
- Resource usage tracking and statistics

✅ **Robust Error Handling**
- Child process failures don't crash main runner
- Graceful cleanup and resource management
- Comprehensive error reporting and logging

✅ **TestSDKFactory Integration**
- Seamless integration with existing test infrastructure
- Configurable SDK options per test process
- Handle tracking integration for resource cleanup

## Architecture

```
┌─────────────────────┐    IPC     ┌─────────────────────┐
│   Parent Process    │<---------->│   Child Process     │
│   IsolatedTestRunner│            │   Test Execution    │
│   - Process Pool    │            │   - TestSDKFactory  │
│   - IPC Manager     │            │   - HandleTracker   │
│   - Timeout Manager │            │   - Test Function   │
└─────────────────────┘            └─────────────────────┘
          │
          ▼
┌─────────────────────┐
│ ProcessHandleTracker│
│ - Resource Cleanup  │
│ - Memory Management │
└─────────────────────┘
```

## Usage Examples

### Basic Isolated Test

```typescript
import IsolatedTestRunner from './IsolatedTestRunner';

const runner = new IsolatedTestRunner();

const testFunction = async (testInstance) => {
  const { sdk, sessionId, handleTracker } = testInstance;
  
  // Your test logic here
  const result = await sdk.executeWithSDK('test prompt');
  
  return { result, pid: process.pid };
};

const result = await runner.runIsolatedTest(testFunction);
console.log('Test result:', result);
```

### Concurrent Testing

```typescript
const runner = new IsolatedTestRunner(logger, {
  maxConcurrentProcesses: 3,
  processTimeout: 15000
});

const promises = [
  runner.runIsolatedTest(authTest),
  runner.runIsolatedTest(sessionTest),
  runner.runIsolatedTest(handleTest)
];

const results = await Promise.all(promises);
```

### Custom SDK Configuration

```typescript
const options = {
  testSDKOptions: {
    mockLevel: 'full_mock',
    sessionBehavior: 'isolated',
    authentication: 'mock',
    processIsolation: true,
    enableHandleTracking: true
  },
  processTimeout: 20000,
  enableProcessLogging: true
};

const result = await runner.runIsolatedTest(testFunction, [], options);
```

## Configuration Options

### IsolatedTestOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `processTimeout` | number | 30000 | Maximum process execution time (ms) |
| `spawnTimeout` | number | 5000 | Maximum time to spawn process (ms) |
| `cleanupTimeout` | number | 10000 | Maximum time for cleanup (ms) |
| `maxConcurrentProcesses` | number | 4 | Limit concurrent test processes |
| `enableIPC` | boolean | true | Enable inter-process communication |
| `heartbeatInterval` | number | 1000 | Health check interval (ms) |
| `enableProcessLogging` | boolean | false | Log child process output |
| `testSDKOptions` | TestSDKOptions | - | SDK configuration for tests |

## Performance Characteristics

- **Process Spawn Time**: < 2 seconds consistently
- **Memory Isolation**: Complete - no shared state leakage
- **Concurrency**: Configurable with automatic queuing
- **Resource Cleanup**: Automatic with timeout enforcement
- **Error Isolation**: Child failures don't affect parent

## Test Results Structure

```typescript
interface IsolatedTestResult {
  success: boolean;
  exitCode: number | null;
  signal: string | null;
  duration: number;
  stdout: string;
  stderr: string;
  error?: string;
  testResults?: any;
  processId: number;
  spawnTime: number;
  cleanupTime: number;
  memoryUsage?: NodeJS.MemoryUsage;
  handleStats?: HandleCleanupResult;
}
```

## Integration Points

### ProcessHandleTracker Integration
- Automatic handle tracking in child processes
- Resource cleanup enforcement
- Memory leak detection and prevention

### TestSDKFactory Integration
- Isolated SDK instances per test process
- Configurable mock levels and behaviors
- Session detection and management

## Cross-Platform Support

✅ **Windows**: Full support with PowerShell compatibility
✅ **Linux**: Native support with bash integration  
✅ **macOS**: Complete compatibility with Unix signals

## Error Handling

The isolated test runner provides comprehensive error handling:

- **Process Spawn Failures**: Timeout and retry logic
- **Test Execution Errors**: Captured and reported
- **Process Timeouts**: Forcible termination with cleanup
- **IPC Communication Errors**: Graceful degradation
- **Resource Leaks**: Automatic detection and cleanup

## Monitoring and Statistics

Real-time statistics and monitoring:

```typescript
const stats = runner.getStatistics();
console.log({
  totalProcessesSpawned: stats.totalProcessesSpawned,
  successfulTests: stats.successfulTests,
  failedTests: stats.failedTests,
  averageSpawnTime: stats.averageSpawnTime,
  peakMemoryUsage: stats.peakMemoryUsage
});
```

## Best Practices

1. **Process Limits**: Set appropriate `maxConcurrentProcesses` based on system resources
2. **Timeouts**: Configure realistic timeouts for your test scenarios
3. **Resource Cleanup**: Always call `runner.shutdown()` in cleanup
4. **Error Handling**: Handle both individual test failures and runner-level errors
5. **Logging**: Enable process logging for debugging complex test scenarios

## Demo and Examples

Run the demonstration:
```bash
npx ts-node src/testing/IsolatedTestRunner.demo.ts
```

Run the example suite:
```bash
npx ts-node src/testing/IsolatedTestRunner.examples.ts
```

## Testing

Comprehensive test suite available:
```bash
npm test -- src/testing/IsolatedTestRunner.test.ts
```

The test suite covers:
- Basic process spawning and isolation
- Error handling and timeout management
- IPC communication
- TestSDKFactory integration
- ProcessHandleTracker integration
- Concurrency management
- Cross-platform compatibility

## Files

- `IsolatedTestRunner.ts` - Main implementation
- `IsolatedTestRunner.test.ts` - Comprehensive test suite
- `IsolatedTestRunner.examples.ts` - Usage examples
- `IsolatedTestRunner.demo.ts` - Quick demonstration
- `IsolatedTestRunner.README.md` - This documentation

## Future Enhancements

- Docker container isolation option
- WebAssembly test execution support
- Distributed test execution across machines
- Performance profiling integration
- Visual test execution monitoring