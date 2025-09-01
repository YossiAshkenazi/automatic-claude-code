# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-09-01-pty-claude-control/spec.md

> Created: 2025-09-01
> Version: 1.0.0

## Technical Requirements

### Core PTY Controller
- Implement Windows ConPTY-based process control using node-pty library
- Spawn Claude Code processes WITHOUT the `-p` flag to avoid API key requirement
- Use interactive mode flags: `--continue`, `--dangerously-skip-permissions`, `--output-format stream-json`
- Handle ANSI escape sequences and terminal control codes
- Implement proper buffer management for streaming responses
- Support graceful shutdown and process cleanup

### OAuth Token Management
- Extract OAuth tokens from Windows Credential Manager using Windows Credential API
- Check for tokens in fallback location: `~/.claude/.credentials.json`
- Support CLAUDE_CODE_OAUTH_TOKEN environment variable override
- Implement token validation and refresh detection
- Cache extracted tokens in memory for performance

### Session Management
- Store sessions in `~/.claude/projects/[encoded-path]/` directory structure
- Implement path encoding: replace `/` with `-` in directory names
- Support session resume using `--resume [session-id]` flag
- Automatic session cleanup after task completion
- Handle up to 28 concurrent PTY sessions
- Implement session state tracking and recovery

### Response Processing
- Parse stream-json formatted output from Claude Code
- Strip ANSI escape sequences for text processing
- Detect response completion patterns
- Handle partial JSON messages and buffering
- Extract tool use, responses, and error messages

### Integration Architecture
- Replace current spawn() calls in claudeExecutor.ts
- Maintain compatibility with dual-agent coordinator
- Preserve monitoring integration and event emission
- Support existing hook system
- Maintain session history recording

### Error Handling
- Detect OAuth token expiration and prompt for re-authentication
- Handle PTY allocation failures with fallback strategies
- Implement timeout mechanisms for hung processes
- Automatic retry with exponential backoff
- Comprehensive error logging and debugging output

### Performance Optimization
- Lazy PTY allocation only when needed
- Reuse PTY sessions when possible
- Implement connection pooling for concurrent processes
- Memory-efficient buffer management
- Asynchronous I/O for all PTY operations

## Approach

### Phase 1: PTY Controller Implementation
1. Install and configure node-pty library
2. Create PTYController class with session management
3. Implement OAuth token extraction from Windows Credential Manager
4. Build response parsing system for stream-json format
5. Add ANSI sequence stripping and text processing

### Phase 2: Integration with ClaudeExecutor
1. Replace spawn() calls in claudeExecutor.ts with PTY controller
2. Maintain existing API surface for dual-agent compatibility
3. Implement session persistence and recovery mechanisms
4. Add comprehensive error handling and retry logic
5. Preserve monitoring and event emission functionality

### Phase 3: Testing and Optimization
1. Create comprehensive test suite for PTY operations
2. Test OAuth token extraction across different Windows versions
3. Validate session management and concurrent PTY handling
4. Performance testing with multiple concurrent sessions
5. Error scenario testing and recovery validation

## External Dependencies

- **node-pty** (^1.0.0) - Cross-platform PTY emulation library
  - **Justification:** Required for pseudo-terminal control on Windows using ConPTY
  
- **strip-ansi** (^7.1.0) - Remove ANSI escape codes from strings
  - **Justification:** Essential for processing terminal output into clean text
  
- **node-windows** (^1.0.0-beta.8) - Windows-specific system integration
  - **Justification:** Required for Windows Credential Manager access

- **windows-credential** (^1.1.2) - Windows credential storage access
  - **Justification:** Direct access to OAuth tokens stored by Claude Desktop