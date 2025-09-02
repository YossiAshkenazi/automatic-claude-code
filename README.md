# Automatic Claude Code (v2.0.0)

A powerful dual-agent system that revolutionizes AI-assisted development through coordinated Claude Code automation. Features a Manager-Worker architecture where specialized agents collaborate to tackle complex development tasks with unprecedented sophistication and reliability.

> 🎉 **Major Update v2.0.0**: ACC now uses pure SDK integration! Simplified architecture eliminates complex browser authentication and PTY systems. Direct integration with Claude Code CLI for maximum reliability and performance.

## ✅ Build Status (Verified September 1, 2025)

| Component | Status | Details |
|-----------|--------|---------|
| **TypeScript Compilation** | ✅ PASSED | Zero errors, clean build |
| **CLI Functionality** | ✅ OPERATIONAL | All commands working (run, dual, examples, monitor) |
| **SDK Integration** | ✅ ACTIVE | Direct Claude CLI integration |
| **Dual-Agent System** | ✅ FUNCTIONAL | Manager-Worker coordination operational |
| **Monitoring Dashboard** | ✅ HEALTHY | WebSocket active, real-time data flow |
| **Error Handling** | ✅ ROBUST | Comprehensive fallbacks and user guidance |

**Last Tested**: 2025-09-02 | **Version**: 2.0.0 | **Branch**: dashboard-ui-enhancement

## Features

### 🤖 Dual-Agent Architecture (NEW)
- 👑 **Manager Agent**: Strategic planning, task breakdown, and quality oversight
- 🔨 **Worker Agent**: Focused task execution and implementation
- 🤝 **Intelligent Coordination**: Seamless communication between specialized agents
- 🎯 **Quality Gates**: Automated validation and approval workflows
- 📋 **Task Decomposition**: Complex projects broken into manageable work items
- 🔄 **Adaptive Workflows**: Dynamic strategy adjustment based on progress

### 🚀 Core Capabilities
- 🔧 **SDK Integration**: Direct integration with Claude Code CLI through Anthropic SDK
- 🔄 **Streamlined Authentication**: Leverages Claude CLI's authentication seamlessly
- 🎛️ **Simplified Architecture**: No complex browser management or PTY systems
- 📊 **Advanced Session Management**: Persistent sessions with Claude CLI integration
- 🎯 **Smart Prompt Building**: Context-aware prompts generated from session state
- 🛠️ **Enhanced Error Recovery**: Robust error handling with SDK fallbacks
- 📈 **Progress Tracking**: Real-time monitoring of development progress
- 💾 **Session History**: Complete session persistence with SDK integration
- ⚙️ **Configurable**: Customizable settings optimized for SDK architecture

### 🖥️ Enhanced Monitoring Dashboard (Updated Sep 1, 2025)
- ✅ **Data Consistency**: Real-time dynamic session counts (fixed hardcoded values)
- ✅ **WebSocket Reliability**: Comprehensive error handling with auto-reconnection
- ✅ **Error Boundaries**: Robust error handling throughout dashboard components  
- ✅ **Mobile-Responsive**: Cross-platform data sync and responsive design
- ✅ **Comprehensive Testing**: 45+ tests ensuring UI reliability and data accuracy
- ✅ **Production Ready**: Enhanced API connectivity and state management

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

### Method 1B: Docker Installation (Recommended for Containerized Environments)
```bash
# Clone the repository
git clone https://github.com/YossiAshkenazi/automatic-claude-code.git
cd automatic-claude-code

# Build Docker image
pnpm run docker:build

# Verify Docker installation
docker run --rm automatic-claude-code

# Use with Docker
docker run -it --rm -v "$(pwd):/workspace:ro" -v "$HOME/.claude:/home/nodejs/.claude:ro" automatic-claude-code run "your task" -i 3
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

## Authentication Requirements

### 🎉 Simplified SDK Authentication (v2.0.0)

ACC now uses **direct SDK integration** with Claude Code CLI, providing the simplest and most reliable authentication approach!

#### Authentication Approach

**SDK Integration (Default & Only)**:
- ✅ Works with any Claude Code CLI authentication method
- ✅ Leverages your existing Claude CLI setup
- ✅ No complex browser session management
- ✅ No PTY process management overhead
- ✅ Direct Claude Code execution
- ✅ Automatic authentication handling
- ✅ Cross-platform compatibility

#### Quick Setup (All Users)

**Standard Setup** (Recommended):
```bash
# 1. Install Claude CLI if not already installed
npm install -g @anthropic-ai/claude-code

# 2. Verify Claude CLI is working
claude --version

# 3. Use ACC with SDK integration (default and only mode)
acc run "create a test file" --dual-agent -i 2 -v
# ACC automatically uses your Claude CLI setup
```

**Verification Options**:
```bash
# Verify Claude CLI installation
acc --verify-claude-cli

# Check SDK integration status
acc --sdk-status

# Debug SDK communication
DEBUG=sdk:* acc run "task" --dual-agent -v
```

#### SDK Integration Details

ACC seamlessly integrates with Claude Code CLI:
- **Direct Execution**: Runs Claude Code CLI commands directly
- **Authentication Passthrough**: Uses your existing Claude CLI authentication
- **Session Management**: Maintains session state through SDK
- **Error Handling**: Comprehensive error handling and recovery

No complex configuration required - works with any Claude CLI setup!

#### Prerequisites

Ensure you have Claude CLI properly set up:
```bash
# Install Claude CLI globally
npm install -g @anthropic-ai/claude-code

# Verify it's working (should show version)
claude --version

# If Claude CLI needs authentication, follow its setup instructions
# ACC will use whatever authentication Claude CLI is configured with
```

## Monitoring Setup

### Option 1: Development Mode (Full Featured)
To use the full-featured dual-agent monitoring dashboard:

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

### Option 2: Persistent Monitoring Service (Always Running)
For a lightweight, always-running monitoring service:

```bash
# Start persistent monitoring server
pnpm run monitor:start

# Or with auto-restart using PM2
pnpm run monitor:pm2

# Or with PowerShell persistence (Windows)
pnpm run monitor:persistent

# Monitor service status
pnpm run monitor:status
```

### Option 3: Docker Compose (Production Ready)
```bash
# Start all services with Docker
pnpm run docker:prod

# Or start development environment
pnpm run docker:dev

# Monitor services
pnpm run docker:logs
```

**Monitoring Dashboard URLs:**
- **Persistent Monitor**: http://localhost:6007 (lightweight, always running)
- **Full Dashboard**: http://localhost:6011 (development mode) ✅ *Enhanced UI with data consistency fixes*
- **API Server**: http://localhost:4005 (WebSocket + REST API) ✅ *Improved reliability and error handling*

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

SDK Integration Options:
  --sdk-timeout <ms>         SDK operation timeout (default: 300000)
  --sdk-retries <n>          Maximum SDK retry attempts (default: 3)
  --verify-claude-cli        Verify Claude CLI installation

Dual-Agent Options:
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

# Try dual-agent mode with SDK integration
acc run "implement user authentication system" --dual-agent -i 5 -v
# ACC automatically uses your Claude CLI setup
# Open http://localhost:6011 to watch agent coordination in real-time

# Use single-agent mode for simple tasks
acc run "add unit tests for all functions in src/utils.ts" -i 3 -v

# Verify SDK integration status
acc --verify-claude-cli

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

### Docker Options

```bash
# Run with Docker (development)
acc_docker_run="docker run -it --rm -v \"$(pwd):/workspace:ro\" -v \"$HOME/.claude:/home/nodejs/.claude:ro\" automatic-claude-code"
$acc_docker_run run "implement user authentication" --dual-agent -i 5

# Development environment with monitoring
pnpm run docker:dev

# Production deployment
pnpm run docker:prod

# View logs
pnpm run docker:logs
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

### 🔧 SDK-Based Execution (Streamlined Architecture)

**SDK Integration Process**:
1. **Claude CLI Detection**: Automatically detects and validates Claude CLI installation
2. **Direct Command Execution**: Executes Claude Code commands through SDK interface
3. **Response Processing**: Processes Claude Code output with robust parsing
4. **Session Management**: Maintains session state through simplified session tracking
5. **Cross-platform Compatibility**: Works wherever Claude CLI works

### 🤖 Dual-Agent Mode (SDK-Powered)

1. **SDK-Based Task Analysis**: Manager Agent uses Claude CLI for strategic analysis
2. **Task Decomposition**: Breaks complex goals into manageable work items with clear acceptance criteria
3. **Work Assignment**: Manager assigns specific tasks to Worker Agent with detailed context
4. **SDK Coordinated Execution**: 
   - Worker performs focused implementation through Claude CLI
   - Manager monitors progress through SDK responses
   - Quality gates ensure deliverables meet standards
   - Both agents use the same reliable Claude CLI integration
5. **Integration & Validation**: Manager validates all work items integrate properly
6. **Adaptive Planning**: Strategy adjusts based on progress and discoveries

### ⚡ Single-Agent Mode (SDK Integration)

1. **Initial Prompt**: You provide an initial task or goal
2. **SDK Execution**: Executes prompt through Claude CLI via SDK
3. **Response Analysis**: Parses Claude Code output for completion status
4. **Prompt Generation**: Creates contextual follow-up prompts based on results
5. **Loop Continuation**: Repeats with session persistence until task completion

## Configuration

Configuration file is stored at `~/.automatic-claude-code/config.json`:

```json
{
  "defaultModel": "sonnet",
  "sdkIntegration": {
    "enabled": true,
    "timeout": 300000,
    "retryAttempts": 3,
    "autoCleanup": true,
    "outputParsing": {
      "enableJsonDetection": true,
      "parseToolUsage": true,
      "extractErrorMessages": true
    }
  },
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

### Core Functionality
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

### Docker Commands
```bash
# Docker image management
pnpm run docker:build        # Build production Docker image
pnpm run docker:build-dev    # Build development Docker image
pnpm run docker:shell        # Access container shell

# Development environments
pnpm run docker:dev          # Start development environment
pnpm run docker:dev-app      # Start only ACC app container
pnpm run docker:dev-monitoring # Start only monitoring services

# Production deployment
pnpm run docker:prod         # Start production environment
pnpm run docker:prod-full    # Start production with nginx proxy

# Container management
pnpm run docker:stop         # Stop development services
pnpm run docker:stop-prod    # Stop production services
pnpm run docker:logs         # View all container logs
pnpm run docker:logs-app     # View ACC app logs only
pnpm run docker:clean        # Clean Docker resources
pnpm run docker:backup       # Run database backup
```

### Monitoring Commands
```bash
# Persistent monitoring service
pnpm run monitor:start       # Start lightweight persistent monitor
pnpm run monitor:status      # Check monitoring service status

# PM2 process management
pnpm run monitor:pm2         # Start with PM2 auto-restart
pnpm run monitor:pm2-stop    # Stop PM2 service
pnpm run monitor:pm2-restart # Restart PM2 service
pnpm run monitor:pm2-logs    # View PM2 logs
pnpm run monitor:pm2-status  # View PM2 status

# PowerShell persistence (Windows)
pnpm run monitor:persistent  # Start with PowerShell auto-restart

# Docker monitoring
pnpm run monitor:docker      # Start PostgreSQL and Redis only
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
├── index.ts           # Main application entry point with SDK support
├── config.ts          # Configuration management
├── services/          # Core services
│   ├── claudeExecutor.ts     # Legacy execution service
│   └── sdkClaudeExecutor.ts  # Primary SDK integration service
├── agents/            # Dual-agent system
│   ├── agentCoordinator.ts   # SDK-enhanced agent communication
│   ├── managerAgent.ts       # Strategic planning with SDK integration
│   ├── workerAgent.ts        # Task execution using SDK
│   └── agentTypes.ts         # Type definitions for agent communication
├── sessionManager.ts  # Session tracking with SDK support
├── outputParser.ts    # Output processing with JSON detection
├── promptBuilder.ts   # Agent-aware prompt generation
├── claudeUtils.ts     # Claude Code utilities
├── logger.ts          # Structured logging
└── tuiBrowser.ts     # Enhanced UI
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

### Docker Development

```bash
# Build Docker image for development
pnpm run docker:build-dev

# Run development environment
pnpm run docker:dev

# Access running container shell
pnpm run docker:shell

# Stop services
pnpm run docker:stop

# Clean Docker resources
pnpm run docker:clean
```

### Monitoring Development

```bash
# Start persistent monitoring service
pnpm run monitor:start

# Monitor with PM2
pnpm run monitor:pm2
pnpm run monitor:pm2-logs

# Check monitoring status
pnpm run monitor:status
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

### 🔒 Enhanced Safety (SDK Integration)
- **SDK Process Isolation**: Each Claude CLI execution runs in isolated process
- **Automatic Resource Cleanup**: Prevents resource leaks with proper cleanup
- **Secure Authentication**: Uses Claude CLI's secure authentication without exposing credentials
- **Controlled Memory Usage**: Efficient memory management through SDK
- **Maximum iteration limits** to prevent infinite loops
- **Session tracking** for audit and rollback
- **Tool permission controls** with granular access
- **Enhanced error detection and recovery** with comprehensive error handling
- **Verbose logging** for debugging and transparency
- **Progress checkpoints** for safe interruption and resumption

### 🐳 Container Safety
- **Isolated execution environment** with Docker containers
- **Resource limits** and health checks
- **Read-only workspace mounting** for safety
- **Non-root user execution** in containers
- **Automatic service recovery** with restart policies
- **Persistent monitoring** with crash detection and recovery

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Production Deployment

### Docker Compose Production
```bash
# Production deployment with all services
pnpm run docker:prod-full

# Basic production deployment
pnpm run docker:prod

# View production logs
docker-compose -f docker-compose.prod.yml logs -f

# Backup data
pnpm run docker:backup
```

### Environment Configuration
```bash
# Copy example environment file
cp .env.example .env

# Edit production settings
vim .env

# Start with custom environment
docker-compose --env-file .env -f docker-compose.prod.yml up -d
```

## Troubleshooting Guide

### Claude CLI Integration Issues

#### Claude CLI Not Found
```bash
# Install Claude CLI globally
npm install -g @anthropic-ai/claude-code

# Verify installation
claude --version

# Check ACC can find Claude CLI
acc --verify-claude-cli
```

#### Claude CLI Authentication Issues
```bash
# Follow Claude CLI's authentication setup
# This varies depending on your setup (API key, browser auth, etc.)

# Test Claude CLI directly
claude --help

# If Claude CLI works, ACC should work too
acc run "test task" -i 1
```

#### SDK Communication Errors
```bash
# Debug SDK communication
DEBUG=sdk:* acc run "test task" -i 1

# Check SDK integration status
acc --sdk-status

# Reinitialize SDK connection
acc --reinit-sdk
```

### Common SDK Integration Problems

#### Claude CLI Path Issues
```bash
# Check if Claude CLI is in PATH
which claude

# Add to PATH if needed (example for npm global installs)
export PATH="$PATH:$(npm config get prefix)/bin"

# Verify ACC can find Claude CLI
acc --verify-claude-cli
```

#### SDK Timeout Issues
```bash
# Increase SDK timeout for complex tasks
acc run "complex task" --sdk-timeout 600000 --dual-agent -i 5

# Check system resources
top | grep node

# Reduce concurrent operations if needed
acc run "task" --max-concurrent 1 --dual-agent -i 3
```

#### Cross-Platform Issues
**Windows:**
```powershell
# Check Windows Defender/Antivirus blocking
# Add ACC to Windows Defender exclusions
# Windows Security > Virus & threat protection > Exclusions

# Run as Administrator if needed
Start-Process powershell -Verb runAs
acc run "task" --dual-agent -i 3
```

**macOS:**
```bash
# Grant accessibility permissions
# System Preferences > Security & Privacy > Privacy > Accessibility
# Add Terminal/iTerm to allowed apps

# Allow browser automation
# System Preferences > Security & Privacy > Privacy > Automation
# Allow Terminal to control your browser
```

**Linux:**
```bash
# Install browser dependencies
sudo apt-get install -y xvfb x11-utils

# Start virtual display (headless environments)
export DISPLAY=:99
Xvfb :99 -screen 0 1024x768x24 &
acc run "task" --dual-agent -i 3
```

### Session Management Tips

#### Long-Running Sessions
```bash
# Increase session timeout for complex tasks
acc run "complex task" --session-timeout 3600 --dual-agent -i 10

# Use session checkpoints
acc run "task" --checkpoint-interval 5 --dual-agent -i 8

# Resume interrupted sessions
acc --resume-last-session
```

#### Memory Management
```bash
# Clear session history
acc --clear-history

# Limit concurrent sessions
acc run "task" --max-sessions 5 --dual-agent -i 3

# Monitor memory usage
acc --memory-status
```

### Advanced Troubleshooting

#### Debug Mode
```bash
# Enable comprehensive debug logging
DEBUG=* acc run "task" --dual-agent -v

# Browser-specific debugging
DEBUG=browser:* acc run "task" --dual-agent -v

# SDK-specific debugging
DEBUG=sdk:* acc run "task" --dual-agent -v
```

#### Network Issues
```bash
# Check Claude.ai connectivity
curl -I https://claude.ai

# Use proxy if needed
acc run "task" --proxy http://proxy:8080 --dual-agent -i 3

# Bypass SSL issues (development only)
acc run "task" --ignore-ssl-errors --dual-agent -i 3
```

#### Direct Claude CLI Usage Test
```bash
# Test Claude CLI directly to isolate issues
claude run "create a simple test file" -i 1

# If Claude CLI works but ACC doesn't, report an issue
# Include debug output:
DEBUG=* acc run "test task" -i 1 -v
```

### Performance Troubleshooting

#### Slow Browser Startup
```bash
# Disable browser extensions during automation
acc run "task" --clean-browser --dual-agent -i 3

# Use persistent browser session
acc run "task" --persistent-browser --dual-agent -i 3
```

#### High Memory Usage
```bash
# Monitor resource usage
top | grep -E "(node|claude)"

# Reduce concurrent operations
acc run "task" --max-concurrent 1 --dual-agent -i 3

# Use shorter SDK timeouts
acc run "task" --sdk-timeout 180000 --dual-agent -i 3
```

## Disclaimer

This tool runs Claude Code automatically with dual-agent coordination and can make significant changes to your codebase. Always:
- **Use version control (git)** - Essential for dual-agent workflows
- **Review changes before deployment** - Especially important with complex agent coordination
- **Test in a safe environment first** - Dual-agent mode can make extensive changes
- **Set appropriate iteration limits** - Start with lower limits to understand agent behavior
- **Monitor agent communication** - Use `acc agents --logs` to understand decision-making
- **Verify quality gates** - Ensure Manager validation aligns with your standards
- **Start with simple tasks** - Build confidence with dual-agent coordination gradually
- **Use Docker for isolation** - Container execution provides additional safety layers
- **Monitor service health** - Persistent monitoring ensures system reliability