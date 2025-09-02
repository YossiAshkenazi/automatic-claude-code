# User Story: Test and Complete Claude CLI Wrapper Implementation

## Story ID: STORY-001
**Epic**: CLI Integration Without API Keys
**Sprint**: Current
**Priority**: P0 (Critical)
**Story Points**: 5

## User Story
**As a** developer using Claude with a subscription (Pro/Max)  
**I want to** execute Claude commands through a CLI wrapper without needing API keys  
**So that** I can leverage my existing subscription authentication via `claude setup-token`

## Background & Context
We've created a Claude CLI wrapper (`python-sdk/claude_cli_wrapper.py`) based on Dan Disler's approach from agentic-drop-zones. The wrapper uses subprocess execution to run Claude CLI directly, bypassing API key requirements. However, it needs thorough testing and completion.

## Acceptance Criteria
- [ ] CLI wrapper successfully executes simple prompts through Claude CLI
- [ ] Real-time streaming of responses works correctly
- [ ] Error handling for authentication failures is implemented
- [ ] Tool usage (Read, Write, Edit, Bash) is properly captured and displayed
- [ ] Process management (timeout, kill) functions correctly
- [ ] Both async and sync interfaces work as expected
- [ ] Output parsing correctly identifies different message types (stream, tool_use, error, status)
- [ ] Integration test suite passes with >90% coverage

## Technical Requirements

### Core Functionality Testing
1. **Basic Query Execution**
   - Test simple prompt: "What is 2+2?"
   - Verify response is received and parsed correctly
   - Confirm no API key errors occur

2. **Streaming Response Testing**
   - Test with longer prompt requiring multi-turn response
   - Verify real-time streaming (not buffered)
   - Ensure partial responses are handled correctly

3. **Tool Usage Testing**
   - Test file reading: "Read the file test.txt"
   - Test file writing: "Create a file hello.py with a hello world function"
   - Test bash execution: "Run ls -la command"
   - Verify tool usage is properly captured in CliMessage

4. **Error Scenario Testing**
   - Test with unauthenticated CLI (no setup-token)
   - Test with invalid model names
   - Test timeout scenarios
   - Test process killing during execution

### Implementation Tasks
1. **Enhance Output Parsing** (`_parse_line` method)
   - Study actual Claude CLI output format
   - Implement proper pattern matching for:
     - Tool invocation patterns
     - Response boundaries
     - Error messages
     - Status updates

2. **Add Robust Error Handling**
   - Detect authentication issues
   - Handle network timeouts
   - Manage subprocess crashes
   - Provide clear error messages

3. **Create Test Suite**
   ```python
   # test_claude_cli_wrapper.py
   - test_find_cli_path()
   - test_simple_query()
   - test_streaming_response()
   - test_tool_usage()
   - test_error_handling()
   - test_process_management()
   ```

4. **Create Working Examples**
   ```python
   # examples/cli_wrapper_demo.py
   - Simple query example
   - Streaming with progress indicator
   - File manipulation example
   - Error recovery example
   ```

## Definition of Done
- [ ] All unit tests pass
- [ ] Integration tests with real Claude CLI pass
- [ ] Documentation updated with usage examples
- [ ] Code review completed
- [ ] Performance benchmarks documented
- [ ] Merged to main branch

## Dependencies
- Claude CLI must be installed (`npm install -g @anthropic-ai/claude-code`)
- User must have run `claude setup-token` with valid subscription
- Python 3.11+ with asyncio support

## Risk Mitigation
- **Risk**: Claude CLI output format changes
  - **Mitigation**: Make parsing flexible and configurable
- **Risk**: Authentication token expires during execution
  - **Mitigation**: Detect auth errors and prompt for re-authentication
- **Risk**: Long-running processes hang
  - **Mitigation**: Implement proper timeout and kill mechanisms

## Notes
- This implementation is inspired by Dan Disler's Gemini CLI approach
- Preserves existing SDK work for future API key usage
- Provides fallback option for subscription users

## References
- [Dan Disler's agentic-drop-zones](https://github.com/disler/agentic-drop-zones)
- [Claude CLI Documentation](https://docs.anthropic.com/claude-code/cli)
- Current implementation: `python-sdk/claude_cli_wrapper.py`