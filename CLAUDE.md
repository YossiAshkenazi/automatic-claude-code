# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Automatic Claude Code is a TypeScript CLI application that runs Claude Code in an automated dual-agent loop for continuous AI-assisted development. The system uses a Manager-Worker architecture where a Manager Agent coordinates tasks and a Worker Agent executes them, enabling more sophisticated problem-solving through specialized roles and collaborative workflows.

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

# From ANY project directory (using relative path to ACC)
node "../automatic-claude-code/dist/index.js" run "task" --dual-agent -i 5 -v
node "../automatic-claude-code/dist/index.js" run "task" --manager-model opus --worker-model sonnet -v
node "../automatic-claude-code/dist/index.js" monitor        # Check monitoring status
node "../automatic-claude-code/dist/index.js" monitor --start # Start monitoring server
node "../automatic-claude-code/dist/index.js" examples      # Show example prompts
node "../automatic-claude-code/dist/index.js" history       # View session history
node "../automatic-claude-code/dist/index.js" logs --tail   # Watch logs in real-time

# Monitoring UI
# Open http://localhost:6007 to watch dual-agent coordination in real-time
```

## Architecture

### Dual-Agent System Overview

The system employs a **Manager-Worker** architecture with two specialized Claude agents:

#### Manager Agent (Strategic Planning)
- **Role**: High-level task planning, progress monitoring, quality gates
- **Model**: Typically Opus (for better reasoning)
- **Responsibilities**:
  - Breaks down complex tasks into actionable work items
  - Monitors Worker progress and provides course corrections
  - Validates deliverables against acceptance criteria
  - Handles error recovery and workflow decisions
  - Coordinates multi-step workflows

#### Worker Agent (Task Execution)
- **Role**: Focused execution of specific tasks
- **Model**: Typically Sonnet (for speed and efficiency)
- **Responsibilities**:
  - Executes concrete development tasks (coding, testing, debugging)
  - Implements specific features and fixes
  - Reports progress and blockers to Manager
  - Performs detailed technical work

### Core Module Structure
```
src/
├── index.ts           # Main CLI entry point and orchestration
├── config.ts          # Configuration management
├── agents/            # Dual-agent system (NEW)
│   ├── agentCoordinator.ts   # Manages agent communication and workflows
│   ├── managerAgent.ts       # Strategic planning and oversight
│   ├── workerAgent.ts        # Task execution and implementation
│   └── agentTypes.ts         # Type definitions for agent communication
├── sessionManager.ts  # Session persistence with dual-agent support
├── outputParser.ts    # Parse outputs from both agents
├── promptBuilder.ts   # Generate contextual prompts (agent-aware)
├── logger.ts          # Structured logging with agent tracking
├── logViewer.ts      # Terminal UI with agent-specific views
└── tuiBrowser.ts     # Enhanced browser with agent insights
```

### Dual-Agent Workflow

#### Phase 1: Task Analysis & Planning (Manager Agent)
1. **Task Decomposition**: Manager analyzes the user request and breaks it into manageable work items
2. **Strategy Formation**: Creates a high-level execution plan with quality gates
3. **Resource Assessment**: Evaluates required tools, files, and dependencies
4. **Success Criteria**: Defines clear acceptance criteria for each work item

#### Phase 2: Coordinated Execution
1. **Work Assignment**: Manager assigns specific tasks to Worker with detailed context
2. **Worker Execution**: Worker performs focused implementation using Claude Code tools
3. **Progress Monitoring**: Manager periodically checks Worker's progress and outputs
4. **Quality Gates**: Manager validates deliverables before approving next steps
5. **Course Correction**: Manager provides feedback and adjustments when needed

#### Phase 3: Integration & Completion
1. **Integration Review**: Manager ensures all work items integrate properly
2. **Final Validation**: Comprehensive testing and quality assurance
3. **Documentation Update**: Automatic documentation updates based on changes
4. **Session Summary**: Detailed report of what was accomplished

### Agent Communication Protocol

```typescript
interface AgentMessage {
  from: 'manager' | 'worker';
  to: 'manager' | 'worker';
  type: 'task_assignment' | 'progress_update' | 'completion_report' | 'error_report' | 'quality_check';
  payload: {
    taskId: string;
    content: string;
    metadata?: any;
  };
  timestamp: Date;
}
```

### Claude Code Execution (Enhanced)

Both agents spawn Claude Code processes with specialized configurations:

**Manager Agent Flags**:
- `--model opus` (or configured manager model)
- `--role strategic-planning`
- `--max-turns 20` (longer conversations for planning)

**Worker Agent Flags**:
- `--model sonnet` (or configured worker model)
- `--role task-execution`
- `--dangerously-skip-permissions` - Skip permission prompts
- `-p` - Headless/print mode
- `--output-format json` - Structured output
- `--permission-mode acceptEdits` - Auto-accept edits

### Output Analysis (Dual-Agent)

The outputParser now handles:
- **Agent Identification**: Tracks which agent generated each output
- **Inter-Agent Messages**: Parses communication between Manager and Worker
- **Task State Tracking**: Monitors progress on assigned work items
- **Quality Gate Results**: Captures Manager's validation decisions
- **Coordination Metrics**: Measures collaboration effectiveness

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
Enhanced configuration at `~/.automatic-claude-code/config.json`:
```json
{
  "defaultModel": "sonnet",
  "dualAgentMode": {
    "enabled": false,
    "managerModel": "opus",
    "workerModel": "sonnet",
    "coordinationInterval": 3,
    "qualityGateThreshold": 0.8,
    "maxConcurrentTasks": 2,
    "enableCrossValidation": true
  },
  "maxIterations": 10,
  "continueOnError": false,
  "verbose": false,
  "allowedTools": ["Read", "Write", "Edit", "Bash", "MultiEdit", "Grep", "Glob"],
  "sessionHistoryLimit": 100,
  "autoSaveInterval": 60000,
  "agentCommunication": {
    "logLevel": "info",
    "retryAttempts": 3,
    "timeoutMs": 30000
  }
}
```

## Hook Scripts Integration

The project includes enhanced observability hooks in `.claude/hooks/` that capture dual-agent Claude Code events:

### Available Hooks (PowerShell, Bash, Node.js)
- `user-prompt-submit-hook` - Captures user prompts
- `pre-tool-use-hook` - Before tool execution (agent-aware)
- `post-tool-use-hook` - After tool execution (agent-aware)
- `agent-communication-hook` - Captures Manager-Worker communication (NEW)
- `agent-coordination-hook` - Logs agent coordination events (NEW)
- `quality-gate-hook` - Records quality validation results (NEW)
- `notification-hook` - System notifications
- `stop-hook` - Session termination
- `subagent-stop-hook` - Subagent completion

### Dual-Agent Event Types
New events captured by hooks:
- `MANAGER_TASK_ASSIGNMENT` - When Manager assigns work to Worker
- `WORKER_PROGRESS_UPDATE` - When Worker reports progress
- `MANAGER_QUALITY_CHECK` - When Manager validates Worker output
- `AGENT_COORDINATION` - Inter-agent communication events
- `WORKFLOW_TRANSITION` - Phase changes in dual-agent workflow

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

#### Single-Agent Mode (Legacy)
1. **Basic Functionality**: `acc run "create test.txt with hello" -i 1`
2. **Error Recovery**: Test with intentionally failing tasks
3. **Session Continuity**: Verify `--resume` functionality
4. **Output Parsing**: Check both JSON and text fallback modes
5. **Hook Execution**: Monitor `.claude/hooks/` script triggers

#### Dual-Agent Mode (NEW)
1. **Agent Coordination**: `acc run "implement user auth system" --dual-agent -i 5 -v`
2. **Manager Planning**: Verify Manager creates proper task breakdown
3. **Worker Execution**: Confirm Worker executes assigned tasks correctly
4. **Quality Gates**: Test Manager's validation of Worker outputs
5. **Error Recovery**: Test how agents handle and recover from failures
6. **Inter-Agent Communication**: Monitor agent message exchange
7. **Performance Comparison**: Compare dual vs single agent effectiveness
8. **Complex Workflows**: Test multi-step architecture changes
9. **Concurrent Task Handling**: Verify parallel work item execution
10. **Cross-Validation**: Test Manager reviewing Worker's solutions

## Important Notes

- **Package Manager**: Project uses both pnpm (primary) and npm (fallback for WSL issues)
- **WSL Compatibility**: Special handling with `--no-bin-links` flag for permission issues
- **Session Storage**: All sessions saved to `.claude-sessions/` for audit trail
- **Process Spawning**: Uses shell execution for cross-platform compatibility
- **Claude CLI Required**: Must have Claude Code CLI installed and in PATH