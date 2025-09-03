# CLI Wrappers Test Suite

Comprehensive test suite for Claude, Gemini, and Unified CLI wrappers.

## Test Coverage

### Unit Tests (90%+ Coverage Target)
- **ClaudeCliOptions**: Configuration and CLI argument generation
- **GeminiCliOptions**: Configuration and CLI argument generation  
- **ClaudeCliWrapper**: Execution, streaming, availability checks
- **GeminiCliWrapper**: Execution and availability checks
- **UnifiedCliWrapper**: Model detection, unified interface

### Integration Tests
- **Real CLI Integration**: Tests with actual Claude/Gemini CLI (when available)
- **Error Handling**: Invalid inputs, missing CLIs, timeouts
- **Cross-Platform**: Windows/Linux/macOS compatibility

### Performance Tests
- **Concurrent Execution**: Multiple simultaneous requests
- **Large Response Handling**: Memory and performance with large outputs
- **Streaming Performance**: Real-time response processing

### Edge Cases
- **Model Selection**: Invalid models, auto-detection fallbacks
- **Empty/Large Prompts**: Boundary condition testing
- **Interruption Handling**: Graceful cancellation of streaming

## Running Tests

### Quick Start
```bash
# Run all unit tests with coverage
python -m pytest tests/test_cli_wrappers.py -m unit --cov=claude_cli_wrapper --cov=gemini_cli_wrapper --cov=unified_cli_wrapper

# Run integration tests (requires CLI installations)
python -m pytest tests/test_cli_wrappers.py -m integration

# Run performance benchmarks
python -m pytest tests/test_cli_wrappers.py::TestPerformanceBenchmarks -s
```

### Using Test Runner
```bash
# Unit tests only
python tests/run_cli_tests.py unit

# Integration tests (requires CLIs installed)
python tests/run_cli_tests.py integration  

# All tests with coverage
python tests/run_cli_tests.py all

# Performance benchmarks
python tests/run_cli_tests.py performance
```

## Test Organization

```
tests/
├── test_cli_wrappers.py     # Main test suite
├── run_cli_tests.py         # Test runner script
├── pytest.ini              # Pytest configuration
├── conftest.py              # Shared fixtures
└── README.md                # This file
```

## Key Features

### Comprehensive Mocking
- **Subprocess mocking**: All CLI interactions mocked for reliability
- **Async mocking**: Proper async/await testing patterns
- **Response simulation**: Realistic CLI output simulation

### Test Categories
- `@pytest.mark.unit`: Fast, isolated tests with mocking
- `@pytest.mark.integration`: Tests requiring real CLI installations
- `@pytest.mark.slow`: Performance and long-running tests
- `@pytest.mark.requires_claude_cli`: Tests needing Claude CLI

### Coverage Goals
- **>90% code coverage** for all wrapper modules
- **All error paths tested** with appropriate exception handling
- **Edge cases covered** including timeouts, large responses, interruptions

## Example Test Execution

```bash
# Expected output for unit tests
$ python -m pytest tests/test_cli_wrappers.py -m unit -v

======= test session starts =======
tests/test_cli_wrappers.py::TestClaudeCliOptions::test_default_options PASSED
tests/test_cli_wrappers.py::TestClaudeCliOptions::test_custom_options PASSED
tests/test_cli_wrappers.py::TestClaudeCliWrapper::test_initialization PASSED
tests/test_cli_wrappers.py::TestClaudeWrapper::test_execute_sync_success PASSED
...
======= 23 passed in 2.45s =======

Name                      Stmts   Miss  Cover   Missing
-------------------------------------------------------
claude_cli_wrapper.py      156      8    95%   245-252
gemini_cli_wrapper.py      134      6    96%   198-203  
unified_cli_wrapper.py     98       3    97%   89-91
-------------------------------------------------------
TOTAL                      388     17    96%
```

## Dependencies

- **pytest**: Test framework
- **pytest-asyncio**: Async test support
- **pytest-cov**: Coverage reporting
- **unittest.mock**: Mocking functionality (built-in)

## Notes

- Tests use mocking by default for reliability and speed
- Integration tests require actual CLI installations
- All async code properly tested with pytest-asyncio
- Coverage excludes test files and build artifacts
- Cross-platform compatibility tested on Windows/Linux/macOS