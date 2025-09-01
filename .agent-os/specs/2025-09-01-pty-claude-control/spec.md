# Spec Requirements Document

> Spec: PTY-Based Claude Control
> Created: 2025-09-01
> Status: Planning

## Overview

Replace API key-based Claude Code control with PTY-based interactive mode control that leverages subscription OAuth authentication. This eliminates the API token requirement for Automatic Claude Code users while maintaining full programmatic control through pseudo-terminal emulation on Windows systems.

## User Stories

### Developer Using Claude Pro Subscription

As a developer with a Claude Pro subscription, I want to use Automatic Claude Code without needing an API key, so that I can leverage my existing subscription for automated development workflows.

The developer installs ACC, runs a command like `acc run "implement feature" --dual-agent -i 5`, and ACC automatically uses their Claude Pro subscription authentication through interactive mode control. No API key configuration is required - the system extracts OAuth tokens from Windows credential storage and controls Claude Code through ConPTY emulation.

### System Administrator Running Concurrent Tasks

As a system administrator, I want to run multiple ACC instances concurrently, so that I can parallelize development tasks across different projects.

The administrator can spawn up to 28 concurrent Claude Code processes, each controlled through its own PTY session. Sessions are automatically managed and cleaned up when tasks complete. Each session maintains its own state and can be resumed if interrupted.

### CI/CD Pipeline Integration

As a DevOps engineer, I want ACC to work in automated environments, so that I can integrate AI-assisted development into continuous integration workflows.

The system runs headlessly on Windows servers, automatically handling authentication through stored OAuth tokens. Session persistence allows workflows to recover from interruptions, and automatic cleanup prevents resource leaks.

## Spec Scope

1. **PTY Controller Implementation** - Windows ConPTY-based controller that spawns and manages Claude Code processes in interactive mode
2. **OAuth Token Extraction** - Extract and manage OAuth tokens from Windows credential storage for subscription authentication
3. **Session Management System** - Handle session creation, persistence, resumption, and automatic cleanup for up to 28 concurrent processes
4. **Response Parser** - Stream-based JSON parser with ANSI sequence handling for processing Claude Code outputs
5. **Integration Layer** - Replace current spawn-based approach with PTY controller in dual-agent coordinator

## Out of Scope

- macOS and Linux support (future phase)
- API key backward compatibility
- Session sharing between ACC instances
- Docker container support (unless Windows implementation has issues)
- Real-time session migration between machines

## Expected Deliverable

1. Fully functional ACC system that works with Claude Pro/Max subscriptions without requiring API keys
2. Successful execution of dual-agent workflows using PTY-based control with subscription authentication
3. Automated tests demonstrating concurrent session management and error recovery scenarios

## Spec Documentation

- Tasks: @.agent-os/specs/2025-09-01-pty-claude-control/tasks.md
- Technical Specification: @.agent-os/specs/2025-09-01-pty-claude-control/sub-specs/technical-spec.md