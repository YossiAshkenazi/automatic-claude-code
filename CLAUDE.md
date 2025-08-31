# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Automatic Claude Code is a TypeScript CLI application that runs Claude Code in an automated loop for continuous AI-assisted development. It executes Claude Code in headless mode, analyzes outputs, and generates contextual prompts for subsequent iterations.

## Essential Commands

```bash
# Development
pnpm run dev          # Run in development mode with tsx
pnpm run build        # Compile TypeScript to dist/
pnpm run lint         # Run ESLint on src/**/*.ts
pnpm run typecheck    # Type-check without emitting
pnpm run clean        # Remove dist directory

# Production build & run
pnpm run build && node dist/index.js run "task" -i 10 -v

# Using the CLI (after global install with pnpm link --global)
acc run "your task" -i 5 -v              # Run with iterations and verbose
acc examples                             # Show example prompts
acc session --list                       # List all sessions
acc history                              # View session history
acc logs --tail                          # Watch logs in real-time
```

## Architecture

### Core Module Structure
```
src/
├── index.ts           # Main CLI entry point, command routing, and loop orchestration
├── config.ts          # Configuration management (~/.automatic-claude-code/config.json)
├── sessionManager.ts  # Session persistence to .claude-sessions/
├── outputParser.ts    # Parse Claude Code JSON/text output
├── promptBuilder.ts   # Generate contextual prompts for iterations
├── logger.ts          # Structured logging system
├── logViewer.ts      # Terminal UI for viewing logs
└── tuiBrowser.ts     # Terminal UI browser for session inspection
```

### Core Loop Flow

1. **Command Processing** (index.ts): Parses CLI arguments and orchestrates the automated loop
2. **Claude Code Execution**: Spawns Claude with specific flags:
   - `--dangerously-skip-permissions` - Skip permission prompts
   - `-p` - Headless/print mode
   - `--output-format json` - Structured output
   - `--permission-mode acceptEdits` - Auto-accept edits
   - `--resume <sessionId>` - Continue previous sessions

3. **Output Analysis** (outputParser.ts): Extracts from Claude's output:
   - Session IDs for continuity
   - Tool usage patterns (Read, Write, Edit, Bash, etc.)
   - File modifications and commands executed
   - Error detection and cost tracking

4. **Prompt Generation** (promptBuilder.ts): Creates three prompt types:
   - **Error Recovery**: Specific error details and fix suggestions
   - **Continuation**: Progress summary with next steps
   - **Refinement**: Optimization and improvement prompts

5. **Session Management** (sessionManager.ts): Persists each iteration with:
   - Timestamps and duration tracking
   - Full input/output preservation
   - Cost and token usage metrics
   - Session metadata for analysis

## Key Implementation Details

### Process Management
- Uses Node.js `spawn()` with `shell: true` for Windows compatibility
- Handles both stdout and stderr streams
- Implements graceful shutdown with process cleanup
- Manages session continuity via Claude's `--resume` flag

### Error Handling Strategy
- Detects errors via exit codes and output patterns
- Implements automatic retry logic with context
- Preserves error states in session history
- Allows continuation with `--continue-on-error` flag

### Configuration System
Default configuration at `~/.automatic-claude-code/config.json`:
```json
{
  "defaultModel": "sonnet",      // or "opus"
  "maxIterations": 10,
  "continueOnError": false,
  "verbose": false,
  "allowedTools": ["Read", "Write", "Edit", "Bash", ...],
  "sessionHistoryLimit": 100,
  "autoSaveInterval": 60000
}
```

## Hook Scripts Integration

The project includes observability hooks in `.claude/hooks/` that capture Claude Code events:

### Available Hooks (PowerShell, Bash, Node.js)
- `user-prompt-submit-hook` - Captures user prompts
- `pre-tool-use-hook` - Before tool execution
- `post-tool-use-hook` - After tool execution  
- `notification-hook` - System notifications
- `stop-hook` - Session termination
- `subagent-stop-hook` - Subagent completion

### Hook Configuration
Managed via `.claude/settings.local.json` with:
- Tool permissions (allow/deny/ask)
- MCP server enablement (archon, github, playwright, etc.)
- Default permission mode

## MCP Server Integration

The project is configured to work with multiple MCP servers:
- **archon**: Task and project management
- **github**: GitHub API integration
- **playwright**: Browser automation
- **context7**: Knowledge base integration
- **memory**: Persistent memory storage

## Testing & Development Workflow

### Local Development
```bash
# 1. Install dependencies
pnpm install

# 2. Run in development mode (uses tsx for hot reload)
pnpm run dev

# 3. Test a simple task
pnpm run dev run "create a hello world function" -i 2 -v

# 4. Build and test production
pnpm run build
node dist/index.js run "task" -i 3
```

### Testing Checklist
1. **Basic Functionality**: `acc run "create test.txt with hello" -i 1`
2. **Error Recovery**: Test with intentionally failing tasks
3. **Session Continuity**: Verify `--resume` functionality
4. **Output Parsing**: Check both JSON and text fallback modes
5. **Hook Execution**: Monitor `.claude/hooks/` script triggers

## Important Notes

- **Package Manager**: Project uses both pnpm (primary) and npm (fallback for WSL issues)
- **WSL Compatibility**: Special handling with `--no-bin-links` flag for permission issues
- **Session Storage**: All sessions saved to `.claude-sessions/` for audit trail
- **Process Spawning**: Uses shell execution for cross-platform compatibility
- **Claude CLI Required**: Must have Claude Code CLI installed and in PATH