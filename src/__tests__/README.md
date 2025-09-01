# PTY Controller Tests

This directory contains comprehensive tests for the PTY controller functionality.

## Test Coverage

### PTY Controller Tests (`ptyController.test.ts`)

The test suite provides comprehensive coverage for:

1. **Controller Initialization and Lifecycle**
   - Basic initialization with default options
   - Initialization with custom options (sessionId, oauthToken)
   - PTY process spawning with correct arguments
   - Session resume functionality
   - Initialization failure handling
   - Ready state timeout scenarios

2. **Process Spawning Without -p Flag**
   - Verifies interactive mode spawning (no `-p` flag)
   - Environment configuration for subscription auth
   - OAuth token integration in environment
   - API key removal for subscription flow

3. **Process Lifecycle Management**
   - Process start success handling
   - Graceful process exit handling
   - Unexpected exit during prompt handling
   - Proper process cleanup on close
   - Safe handling when process not initialized

4. **Buffer Management and Streaming**
   - JSON message processing
   - Malformed JSON handling
   - Partial message accumulation
   - Multiple message processing in buffer
   - ANSI escape sequence handling
   - Different message type emission (ready, tool_use, error)

5. **Error Handling Scenarios**
   - Claude command not found
   - PTY spawn failure
   - Send prompt when not initialized
   - Send prompt when not ready
   - Prompt timeout handling
   - OAuth token extraction failure

6. **Concurrent Process Limits**
   - Multiple controller simultaneous handling
   - Controller creation failure in batch scenarios
   - Resource cleanup in concurrent scenarios

7. **PTY Features**
   - PTY resizing functionality
   - Prompt sending and response handling
   - Interactive mode operation

8. **OAuth Token Extraction**
   - macOS keychain extraction
   - Windows credential file extraction
   - Linux credential file extraction
   - Existing session detection

### PTY Manager Tests

The ACCPTYManager tests cover:

1. **Session Management**
   - New session creation
   - Custom session ID support
   - Controller retrieval by session ID
   - Session closure (individual and all)
   - Non-existent session handling

2. **Prompt Handling**
   - Prompt sending to sessions
   - Non-existent session error handling

3. **Session ID Generation**
   - Unique ID generation
   - Concurrent session creation handling

4. **Error Handling in Manager**
   - Session creation failure
   - Initialization timeout in manager
   - Prompt failure handling

## Running Tests

To run the tests (once vitest dependencies are installed):

```bash
# Run all tests
pnpm test

# Run in watch mode  
pnpm test:watch

# Run with coverage
pnpm test:coverage

# Run once without watch
pnpm test:run
```

## Test Setup

The tests use:
- **Vitest** as the test framework
- **Mock implementations** for all external dependencies:
  - `node-pty` - PTY process spawning
  - `fs` - File system operations
  - `os` - Operating system utilities
  - `path` - Path utilities
  - Logger - Logging functionality
  - ClaudeUtils - Claude command utilities

## Architecture Tested

The tests validate the full PTY controller architecture:

```
ClaudeCodePTYController
├── Initialization & Configuration
├── PTY Process Management (node-pty)
├── Event Handling (EventEmitter)
├── Buffer Processing & JSON Parsing
├── OAuth Token Management
└── Interactive Mode Operations

ACCPTYManager
├── Multi-Session Management
├── Session ID Generation
├── Controller Lifecycle
└── Batch Operations
```

## Important Notes

- Tests mock all external dependencies to ensure isolation
- Tests simulate PTY events using mock handlers
- Timeout scenarios use fake timers for fast execution
- All cleanup is handled automatically between tests
- Tests verify both success and error paths comprehensively

This test suite ensures the PTY controller is robust, handles edge cases gracefully, and maintains proper resource management in all scenarios.