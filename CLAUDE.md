# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Automatic Claude Code is a TypeScript CLI application that runs Claude Code in an automated loop for continuous development. It executes Claude Code in headless mode, analyzes outputs, and generates contextual prompts for subsequent iterations.

## Essential Commands

```bash
# Development
pnpm run dev          # Run in development mode with tsx
pnpm run build        # Compile TypeScript to dist/
pnpm run lint         # Run ESLint on src/**/*.ts
pnpm run typecheck    # Type-check without emitting
pnpm run clean        # Remove dist directory

# Running the application
node dist/index.js run "task" -i 10 -v    # Run with verbose output
node dist/index.js history                 # View session history
```

## Architecture

The application follows a modular architecture with clear separation of concerns:

### Core Loop Flow
1. **AutomaticClaudeCode** (index.ts) orchestrates the main loop, spawning Claude Code processes with `--dangerously-skip-permissions` flag
2. **OutputParser** parses JSON/text output from Claude Code to extract results, errors, files modified, and commands executed
3. **PromptBuilder** analyzes output to determine if task is complete, has errors, or needs continuation, then generates appropriate next prompt
4. **SessionManager** persists all iterations to `.claude-sessions/` for history and analysis

### Key Implementation Details

- **Claude Code Execution**: Uses `spawn('claude --dangerously-skip-permissions', args)` with headless mode flags:
  - `-p` for print/headless mode
  - `--output-format json` for structured output
  - `--permission-mode acceptEdits` to auto-accept edits
  - `--resume <sessionId>` to continue previous Claude sessions

- **Output Analysis**: The OutputParser handles both JSON and fallback text parsing, extracting:
  - Session IDs for continuity
  - Tool usage and file modifications
  - Error detection patterns
  - Cost tracking

- **Prompt Generation Strategy**: PromptBuilder creates three types of prompts:
  - Error recovery prompts with specific error details
  - Continuation prompts with progress summary and next steps
  - Refinement prompts for optimization

- **Session Persistence**: SessionManager saves each iteration with timestamps, durations, and outputs to JSON files

## Configuration

User config stored at `~/.automatic-claude-code/config.json` with defaults:
- `defaultModel`: 'sonnet' or 'opus'
- `maxIterations`: 10
- `continueOnError`: boolean
- `allowedTools`: array of permitted Claude Code tools

## Testing Approach

Currently no automated tests. To test functionality:
1. Build the project: `pnpm run build`
2. Run simple test: `node dist/index.js run "create a hello world function" -i 2 -v`
3. Check session history: `node dist/index.js history`

## Development Notes

- The application requires Claude Code CLI to be installed and accessible in PATH
- Sessions are stored locally in `.claude-sessions/` directory
- The spawn command uses `shell: true` for Windows compatibility
- Error handling includes both exit codes and output pattern matching