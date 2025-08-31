# Automatic Claude Code

A powerful dual-agent system that revolutionizes AI-assisted development through coordinated Claude Code automation. Features a Manager-Worker architecture where specialized agents collaborate to tackle complex development tasks with unprecedented sophistication and reliability.

## Features

### 🤖 Dual-Agent Architecture (NEW)
- 👑 **Manager Agent**: Strategic planning, task breakdown, and quality oversight
- 🔨 **Worker Agent**: Focused task execution and implementation
- 🤝 **Intelligent Coordination**: Seamless communication between specialized agents
- 🎯 **Quality Gates**: Automated validation and approval workflows
- 📋 **Task Decomposition**: Complex projects broken into manageable work items
- 🔄 **Adaptive Workflows**: Dynamic strategy adjustment based on progress

### 🚀 Core Capabilities
- 🔄 **Automated Loop Execution**: Runs Claude Code in headless mode continuously
- 📊 **Session Management**: Tracks all iterations, outputs, and progress
- 🎯 **Smart Prompt Building**: Automatically generates contextual prompts based on previous outputs
- 🛠️ **Error Recovery**: Detects and attempts to fix errors automatically
- 📈 **Progress Tracking**: Monitors files modified, commands executed, and overall progress
- 💾 **Session History**: Saves and allows review of all development sessions
- ⚙️ **Configurable**: Customizable iteration limits, models, and tool permissions

## Installation

### Method 1: Global Installation (Recommended)
```bash
# Clone the repository
git clone https://github.com/YossiAshkenazi/automatic-claude-code.git
cd automatic-claude-code

# Install dependencies and build
pnpm install
pnpm run build

# Make 'acc' command available globally
npm link

# Verify installation works
acc examples

# Alternative for WSL/Linux users (if npm link fails):
sudo npm install --force --no-bin-links
sudo npm run build
sudo npm link
```

### Method 2: Local Usage with Alias (Alternative)
```bash
# Clone and build (same as above)
git clone https://github.com/YossiAshkenazi/automatic-claude-code.git
cd automatic-claude-code
pnpm install
pnpm run build

# Create an alias for easy access (replace path with your actual path)
echo 'alias acc="node /mnt/c/Users/Dev/automatic-claude-code/dist/index.js"' >> ~/.bashrc
source ~/.bashrc

# Now you can use 'acc' from anywhere!
acc examples
```

### Method 3: Direct Node Usage (Legacy)
```bash
# After cloning and building, use with full node command
node dist/index.js run "your task" -i 3 -v
node dist/index.js examples
node dist/index.js session --list

# Or from any project directory:
node "../automatic-claude-code/dist/index.js" run "your task" -i 3 -v
```

### Method 4: NPM Install (Future)
```bash
# When published to NPM (not yet available)
npm install -g automatic-claude-code
```

## Monitoring Setup

To use the real-time monitoring dashboard:

```bash
# In a separate terminal, start the monitoring server
cd dual-agent-monitor
pnpm install
pnpm run dev

# This starts:
# - Frontend UI: http://localhost:6011
# - Backend API: http://localhost:4001
# - WebSocket server for real-time updates
```

## Prerequisites

- Node.js 18+
- Claude Code CLI installed and configured
- WSL (for Windows users) or Unix-like environment

## Usage

### Basic Commands

```bash
# NEW: Dual-Agent Mode (Recommended)
acc run "implement a REST API with authentication" --dual-agent

# Single-Agent Mode (Legacy)
acc run "fix all TypeScript errors in the project"

# Custom agent models
acc run "refactor database layer" --manager-model opus --worker-model sonnet
```

### Options

```bash
acc run [prompt] [options]

Core Options:
  -i, --iterations <number>     Maximum number of iterations (default: 10)
  -m, --model <model>          Claude model to use: sonnet or opus (default: sonnet)
  -d, --dir <path>            Working directory for the project
  -t, --tools <tools>         Comma-separated list of allowed tools
  -c, --continue-on-error     Continue loop even if errors occur
  -v, --verbose              Show detailed output

Dual-Agent Options (NEW):
  --dual-agent               Enable dual-agent mode with Manager-Worker architecture
  --manager-model <model>    Model for Manager Agent (default: opus)
  --worker-model <model>     Model for Worker Agent (default: sonnet)
  --coordination-interval <n> How often Manager checks Worker progress (default: 3)
  --quality-threshold <0-1>   Quality gate threshold (default: 0.8)
  --max-concurrent <number>   Maximum concurrent tasks (default: 2)
```

### Quick Start

```bash
# Get help and see example prompts
acc examples

# Start monitoring server (optional, in separate terminal)
cd dual-agent-monitor && pnpm run dev

# Try dual-agent mode for complex tasks (with monitoring)
acc run "implement user authentication system" --dual-agent -i 5 -v
# Open http://localhost:6011 to watch agent coordination in real-time

# Use single-agent for simple tasks
acc run "add unit tests for all functions in src/utils.ts" -i 3 -v

# Check what happened in your last session
acc session

# View all your previous sessions
acc session --list
```

### Development Examples

#### 🤖 Dual-Agent Mode (Best for Complex Tasks)
```bash
# 🏗️ Architecture & Large Features
acc run "implement microservices architecture" --dual-agent -i 8
acc run "migrate from Express to Fastify framework" --dual-agent -i 6
acc run "add comprehensive user authentication system" --dual-agent -i 5
acc run "implement CI/CD pipeline with testing" --dual-agent -i 7

# 🔧 Complex Refactoring
acc run "refactor to clean architecture pattern" --dual-agent -i 6
acc run "implement dependency injection across codebase" --dual-agent -i 5
acc run "migrate from JavaScript to TypeScript" --dual-agent -i 8

# 📦 Full-Stack Features
acc run "build real-time chat system with WebSockets" --dual-agent -i 7
acc run "implement payment processing integration" --dual-agent -i 6
acc run "add comprehensive API documentation and testing" --dual-agent -i 4
```

#### ⚡ Single-Agent Mode (Fast for Simple Tasks)
```bash
# 💡 Quick Development Tasks
acc run "add unit tests for all functions in src/utils.ts" -i 3
acc run "implement error handling for network requests" -i 4
acc run "add JSDoc comments to all exported functions" -i 2

# 🐛 Bug Fixes  
acc run "fix the memory leak in the websocket connection" -i 3
acc run "resolve TypeScript errors in the build process" -i 4
acc run "fix the race condition in async data loading" -i 3

# 📚 Documentation
acc run "create comprehensive README with installation guide" -i 2
acc run "add inline documentation for complex algorithms" -i 3
acc run "generate API documentation from TypeScript interfaces" -i 2
```

### Advanced Options

```bash
# Dual-agent with custom models and settings
acc run "refactor the database layer" --dual-agent --manager-model opus --worker-model sonnet -v

# Fine-tune coordination behavior
acc run "implement caching" --dual-agent --coordination-interval 2 --quality-threshold 0.9

# Specify working directory and tools  
acc run "implement caching" -d ./my-project -t "Read,Write,Edit,Bash" --dual-agent

# Continue on errors with dual agents
acc run "migrate to TypeScript" --dual-agent -c

# Maximum concurrent tasks for complex workflows
acc run "build microservices" --dual-agent --max-concurrent 3 -i 8
```

### Debugging and Session Management

```bash
# Get help and see all example prompts
acc examples

# Agent-specific monitoring (NEW)
acc agents --status              # View current agent states
acc agents --logs               # View inter-agent communication
acc agents --performance        # Agent coordination metrics

# Enhanced session management
acc session --list              # List sessions with agent info
acc session [session-id]        # View dual-agent session details
acc history                     # Show session history

# Advanced log viewing
acc logs                        # View latest session
acc logs --dual-agent          # Filter dual-agent specific logs
acc logs --agent manager       # View Manager agent logs only
acc logs --agent worker        # View Worker agent logs only
acc logs --coordination        # View agent communication logs
acc logs --tail                # Watch logs in real-time
```

## How It Works

### 🤖 Dual-Agent Mode (Default for Complex Tasks)

1. **Task Analysis**: Manager Agent analyzes your request and creates a strategic plan
2. **Task Decomposition**: Breaks complex goals into manageable work items with clear acceptance criteria
3. **Work Assignment**: Manager assigns specific tasks to Worker Agent with detailed context
4. **Coordinated Execution**: 
   - Worker performs focused implementation using Claude Code tools
   - Manager monitors progress and provides guidance
   - Quality gates ensure deliverables meet standards
5. **Integration & Validation**: Manager validates all work items integrate properly
6. **Adaptive Planning**: Strategy adjusts based on progress and discoveries

### ⚡ Single-Agent Mode (Legacy/Simple Tasks)

1. **Initial Prompt**: You provide an initial task or goal
2. **Claude Code Execution**: The app runs Claude Code in headless mode with your prompt
3. **Output Analysis**: Parses Claude's output to understand progress and detect issues
4. **Prompt Generation**: Automatically creates the next prompt based on:
   - Completed actions
   - Errors encountered
   - Remaining tasks
   - Context from previous iterations
5. **Loop Continuation**: Repeats until the task is complete or max iterations reached

## Configuration

Configuration file is stored at `~/.automatic-claude-code/config.json`:

```json
{
  "defaultModel": "sonnet",
  "dualAgentMode": {
    "enabled": true,
    "managerModel": "opus",
    "workerModel": "sonnet",
    "coordinationInterval": 3,
    "qualityGateThreshold": 0.8,
    "maxConcurrentTasks": 2,
    "enableCrossValidation": true,
    "communicationTimeout": 30000
  },
  "maxIterations": 10,
  "continueOnError": false,
  "verbose": false,
  "allowedTools": [
    "Read", "Write", "Edit", "MultiEdit",
    "Bash", "Glob", "Grep", "LS",
    "WebFetch", "WebSearch", "TodoWrite"
  ],
  "sessionHistoryLimit": 100,
  "autoSaveInterval": 60000,
  "agentCommunication": {
    "logLevel": "info",
    "retryAttempts": 3,
    "enableMetrics": true
  }
}
```

## All Available Commands

```bash
# Core functionality
acc run "<task>"              # Run automated development task (single-agent)
acc run "<task>" --dual-agent # Run with dual-agent architecture
acc examples                  # Show example prompts and usage tips
acc help                      # Show help information

# Agent management (NEW)
acc agents --status          # View agent coordination status
acc agents --logs            # View inter-agent communication logs
acc agents --performance     # Agent collaboration metrics
acc agents --config          # Show current dual-agent configuration

# Session management  
acc session                  # View latest session details
acc session --list           # List all sessions with summaries  
acc session <id>             # View specific session details
acc history                  # Show session history

# Enhanced logging and debugging
acc logs                     # View latest log file
acc logs --dual-agent        # Filter dual-agent logs
acc logs --agent <manager|worker> # View specific agent logs
acc logs --coordination      # View agent communication logs
acc logs --list              # List all log files
acc logs --tail              # Watch logs in real-time
```

## Session Management

Sessions are saved in `.claude-sessions/` directory with comprehensive dual-agent information:

### 🤖 Dual-Agent Session Data
- 👑 **Manager Activities**: Strategic decisions, task assignments, quality validations
- 🔨 **Worker Activities**: Implementation details, progress reports, deliverables
- 🤝 **Agent Communication**: Inter-agent message exchanges and coordination
- 📋 **Task Breakdown**: Hierarchical work item structure and completion status
- 🎯 **Quality Gates**: Validation checkpoints and approval workflows
- 📊 **Coordination Metrics**: Agent collaboration effectiveness measurements

### 📊 Traditional Session Data
- 📝 **Prompts sent** to Claude Code in each iteration
- 💬 **Full responses** received from Claude
- 📁 **Files modified** and commands executed  
- ⏱️ **Timing data** and cost information
- 🐛 **Error logs** and recovery attempts
- 🛠️ **Tools used** (Read, Write, Edit, Bash, etc.)

## Architecture

```
src/
├── index.ts           # Main application entry point and orchestration
├── config.ts          # Configuration management
├── agents/            # Dual-agent system (NEW)
│   ├── agentCoordinator.ts   # Manages agent communication and workflows
│   ├── managerAgent.ts       # Strategic planning and oversight
│   ├── workerAgent.ts        # Task execution and implementation
│   └── agentTypes.ts         # Type definitions for agent communication
├── sessionManager.ts  # Session tracking with dual-agent support
├── outputParser.ts    # Enhanced parsing for both agents
├── promptBuilder.ts   # Agent-aware prompt generation
├── logger.ts          # Structured logging with agent tracking
└── tuiBrowser.ts     # Enhanced UI with agent insights
```

## Development

```bash
# Run in development mode
pnpm run dev

# Run linting
pnpm run lint

# Type checking
pnpm run typecheck

# Build for production
pnpm run build
```

## Use Cases

### 🤖 Perfect for Dual-Agent Mode
- **Large-Scale Architecture**: Microservices, clean architecture implementations
- **Complex Feature Development**: Authentication systems, payment processing, real-time features
- **Framework Migrations**: React to Vue, Express to Fastify, JavaScript to TypeScript
- **Full-Stack Applications**: End-to-end feature implementation with frontend and backend
- **Legacy Modernization**: Systematic updates of older codebases
- **Multi-Module Refactoring**: Coordinated changes across multiple components
- **CI/CD Implementation**: Complete pipeline setup with testing and deployment

### ⚡ Great for Single-Agent Mode  
- **Bug Fixes**: Quick issue resolution and patches
- **Unit Testing**: Add tests for specific functions or components
- **Documentation**: Generate README files, API docs, inline comments
- **Code Formatting**: Style consistency and linting fixes
- **Simple Refactoring**: Variable renaming, function extraction
- **Configuration Updates**: Package.json, config file modifications

## Safety Features

### 🤖 Dual-Agent Safety
- **Quality Gates**: Manager validates all Worker outputs before approval
- **Cross-Validation**: Agents can review each other's work
- **Staged Execution**: Complex tasks broken into manageable, verifiable steps
- **Coordination Timeouts**: Prevents agents from waiting indefinitely
- **Task Isolation**: Failed work items don't affect other concurrent tasks

### 🔒 General Safety
- **Maximum iteration limits** to prevent infinite loops
- **Session tracking** for audit and rollback
- **Tool permission controls** with granular access
- **Error detection and recovery** mechanisms
- **Verbose logging** for debugging and transparency
- **Progress checkpoints** for safe interruption and resumption

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Disclaimer

This tool runs Claude Code automatically with dual-agent coordination and can make significant changes to your codebase. Always:
- **Use version control (git)** - Essential for dual-agent workflows
- **Review changes before deployment** - Especially important with complex agent coordination
- **Test in a safe environment first** - Dual-agent mode can make extensive changes
- **Set appropriate iteration limits** - Start with lower limits to understand agent behavior
- **Monitor agent communication** - Use `acc agents --logs` to understand decision-making
- **Verify quality gates** - Ensure Manager validation aligns with your standards
- **Start with simple tasks** - Build confidence with dual-agent coordination gradually