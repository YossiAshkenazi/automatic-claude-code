# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-09-01-pty-claude-control/spec.md

> Created: 2025-09-01
> Status: Ready for Implementation

## Tasks

- [ ] 1. Implement Core PTY Controller
  - [ ] 1.1 Write tests for PTY controller initialization and lifecycle
  - [ ] 1.2 Install node-pty and configure for Windows ConPTY
  - [ ] 1.3 Create ClaudeCodePtyController class with spawn and control methods
  - [ ] 1.4 Implement buffer management and ANSI sequence handling
  - [ ] 1.5 Add graceful shutdown and process cleanup logic
  - [ ] 1.6 Verify all PTY controller tests pass

- [ ] 2. OAuth Token Extraction System
  - [ ] 2.1 Write tests for Windows credential extraction
  - [ ] 2.2 Install windows-credential and node-windows dependencies
  - [ ] 2.3 Implement Windows Credential Manager token extraction
  - [ ] 2.4 Add fallback to ~/.claude/.credentials.json file check
  - [ ] 2.5 Create token caching and validation logic
  - [ ] 2.6 Support CLAUDE_CODE_OAUTH_TOKEN environment override
  - [ ] 2.7 Verify all OAuth extraction tests pass

- [ ] 3. Session Management Implementation
  - [ ] 3.1 Write tests for session creation, persistence, and cleanup
  - [ ] 3.2 Implement session path encoding and directory structure
  - [ ] 3.3 Create session state tracking for concurrent processes
  - [ ] 3.4 Add session resume functionality with --resume flag
  - [ ] 3.5 Implement automatic cleanup after task completion
  - [ ] 3.6 Add concurrent session limit enforcement (28 max)
  - [ ] 3.7 Verify all session management tests pass

- [ ] 4. Response Parser and Stream Processing
  - [ ] 4.1 Write tests for JSON stream parsing and ANSI stripping
  - [ ] 4.2 Install strip-ansi dependency
  - [ ] 4.3 Create StreamJsonParser class for Claude output processing
  - [ ] 4.4 Implement response completion detection patterns
  - [ ] 4.5 Add partial message buffering and reassembly
  - [ ] 4.6 Extract tool uses, responses, and error messages
  - [ ] 4.7 Verify all parser tests pass

- [ ] 5. Integration with Dual-Agent System
  - [ ] 5.1 Write integration tests for PTY controller with AgentCoordinator
  - [ ] 5.2 Replace spawn() calls in claudeExecutor.ts with PTY controller
  - [ ] 5.3 Update AgentCoordinator to use new PTY-based execution
  - [ ] 5.4 Maintain monitoring integration and event emission
  - [ ] 5.5 Preserve hook system compatibility
  - [ ] 5.6 Test dual-agent workflows end-to-end
  - [ ] 5.7 Remove API key configuration and environment variables
  - [ ] 5.8 Verify all integration tests pass