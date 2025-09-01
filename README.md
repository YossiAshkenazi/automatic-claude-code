# Automatic Claude Code (v1.2.0)

A powerful dual-agent system that revolutionizes AI-assisted development through coordinated Claude Code automation. Features a Manager-Worker architecture where specialized agents collaborate to tackle complex development tasks with unprecedented sophistication and reliability.

> 🎉 **Major Update v1.2.0**: ACC now uses Claude's Browser-based authentication SDK! No API keys required - works directly with your browser's Claude Pro/Team session. Interactive session control with real-time stream processing.

## Features

### 🤖 Dual-Agent Architecture (NEW)
- 👑 **Manager Agent**: Strategic planning, task breakdown, and quality oversight
- 🔨 **Worker Agent**: Focused task execution and implementation
- 🤝 **Intelligent Coordination**: Seamless communication between specialized agents
- 🎯 **Quality Gates**: Automated validation and approval workflows
- 📋 **Task Decomposition**: Complex projects broken into manageable work items
- 🔄 **Adaptive Workflows**: Dynamic strategy adjustment based on progress

### 🚀 Core Capabilities
- 🌐 **Browser-Based Authentication**: Direct integration with Claude Pro/Team via browser session
- 🔄 **Interactive Session Control**: Real-time communication with Claude Code through browser SDK
- 🎛️ **Dual Execution Modes**: Browser mode (default, subscription-compatible) and API fallback
- 📊 **Advanced Session Management**: Persistent browser sessions with automatic token refresh
- 🎯 **Smart Prompt Building**: Context-aware prompts generated from session state
- 🛠️ **Enhanced Error Recovery**: Stream parsing with browser disconnect handling
- 📈 **Progress Tracking**: Real-time monitoring of development progress
- 💾 **Session History**: Complete session persistence with browser authentication
- ⚙️ **Configurable**: Customizable settings with browser-first authentication

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

### 🎉 New Browser-Based Authentication (v1.2.0)

ACC now supports **browser-based authentication** through Claude's SDK, eliminating API key requirements entirely!

#### Execution Modes Available

**1. Browser Mode (Default & Recommended)**:
- ✅ Works with Claude Pro/Team subscriptions
- ✅ No API key required
- ✅ Direct browser session integration
- ✅ Interactive Claude Code sessions
- ✅ Automatic session management and token refresh
- ✅ Real-time stream processing
- ✅ Cross-platform browser support

**2. API Mode (Fallback)**:
- ⚠️ Requires API credits from console.anthropic.com
- ⚠️ API key authentication only
- ⚠️ Fallback for headless environments

#### Quick Setup (Most Users)

**For Claude Subscribers** (Recommended):
```bash
# 1. Ensure you're logged into Claude via browser
# Visit https://claude.ai and sign in with Pro/Team account

# 2. Verify Claude CLI is working
claude --version

# 3. Use ACC with browser mode (default)
acc run "create a test file" --dual-agent -i 2 -v
# ACC will automatically use your browser's Claude session
```

**Advanced Setup Options**:
```bash
# Force browser mode (default behavior)
acc run "task" --browser-auth --dual-agent

# Force API mode (requires API key)
acc run "task" --api-auth -i 3

# Browser session timeout control
acc run "task" --dual-agent --session-timeout 600
```

#### Browser Session Integration

ACC automatically connects to your browser's Claude session:
- **Chrome/Edge**: Browser extension integration
- **Firefox**: WebDriver connection
- **Safari**: AppleScript automation (macOS)
- **Fallback**: Manual session token extraction

No manual configuration required for most users!

#### API Key Setup (Only if needed)

If you need API mode for headless environments:
```bash
# Get API key from console.anthropic.com
# Set environment variable:
export ANTHROPIC_API_KEY="sk-ant-your-key-here"

# Or Windows PowerShell:
$env:ANTHROPIC_API_KEY = "sk-ant-your-key-here"

# Use with API mode
acc run "task" --api-auth -i 3
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

PTY Mode Options (NEW):
  --use-pty                  Force PTY mode (default for dual-agent)
  --no-pty                   Force headless mode (requires API key)
  --max-pty-sessions <n>     Maximum concurrent PTY sessions (default: 28)
  --pty-timeout <ms>         PTY session timeout (default: 300000)

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

# Try dual-agent mode with PTY (subscription users)
acc run "implement user authentication system" --dual-agent -i 5 -v
# ACC automatically uses PTY mode with your subscription credentials
# Open http://localhost:6011 to watch agent coordination in real-time

# Use single-agent PTY mode for simple tasks
acc run "add unit tests for all functions in src/utils.ts" -i 3 -v

# Force headless mode if you have API key setup
acc run "simple task" --no-pty -i 2 -v

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

### 🎆 PTY-Based Execution (New Architecture)

**PTY Session Management**:
1. **OAuth Token Extraction**: Automatically extracts credentials from system stores
2. **PTY Session Creation**: Creates interactive Claude sessions using node-pty
3. **Real-time Stream Processing**: Advanced JSON stream parsing with ANSI handling
4. **Session Pool Management**: Manages up to 28 concurrent sessions with automatic cleanup
5. **Cross-platform Compatibility**: Windows ConPTY, macOS/Linux PTY support

### 🤖 Dual-Agent Mode (Enhanced with PTY)

1. **PTY-Based Task Analysis**: Manager Agent uses interactive sessions for deeper analysis
2. **Task Decomposition**: Breaks complex goals into manageable work items with clear acceptance criteria
3. **Work Assignment**: Manager assigns specific tasks to Worker Agent with detailed context
4. **PTY Coordinated Execution**: 
   - Worker performs focused implementation using interactive Claude sessions
   - Manager monitors progress through real-time stream processing
   - Quality gates ensure deliverables meet standards with enhanced feedback
   - Both agents leverage subscription authentication seamlessly
5. **Integration & Validation**: Manager validates all work items integrate properly
6. **Adaptive Planning**: Strategy adjusts based on progress and discoveries

### ⚡ Single-Agent Mode (PTY + Headless Support)

**PTY Mode (Default)**:
1. **Initial Prompt**: You provide an initial task or goal
2. **PTY Session Creation**: Creates interactive Claude session with subscription auth
3. **Real-time Output Analysis**: Parses streaming output with advanced JSON detection
4. **Prompt Generation**: Automatically creates contextual prompts based on stream data
5. **Loop Continuation**: Repeats with session persistence until task completion

**Headless Mode (Fallback)**:
1. **API Key Validation**: Verifies API key availability for headless operation
2. **Claude Code Execution**: Runs Claude Code with `-p` flag and API authentication
3. **Output Analysis**: Traditional output parsing for compatibility
4. **Loop Continuation**: Repeats until task complete or max iterations reached

## Configuration

Configuration file is stored at `~/.automatic-claude-code/config.json`:

```json
{
  "defaultModel": "sonnet",
  "ptyMode": {
    "enabled": true,
    "maxSessions": 28,
    "sessionTimeout": 300000,
    "autoCleanup": true,
    "oauthTokenExtraction": true,
    "fallbackToHeadless": true,
    "bufferSize": 8192,
    "streamProcessing": {
      "enableJsonDetection": true,
      "stripAnsiCodes": true,
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
    "communicationTimeout": 30000,
    "usePTY": true
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
├── index.ts           # Main application entry point with PTY support
├── config.ts          # Configuration management with PTY settings
├── services/          # Core services (NEW)
│   ├── claudeExecutor.ts     # Centralized execution service with PTY support
│   └── ptyController.ts      # PTY session management and OAuth integration
├── agents/            # Dual-agent system
│   ├── agentCoordinator.ts   # PTY-enhanced agent communication
│   ├── managerAgent.ts       # Strategic planning with interactive sessions
│   ├── workerAgent.ts        # Task execution using PTY
│   └── agentTypes.ts         # Type definitions for agent communication
├── sessionManager.ts  # Enhanced session tracking with OAuth support
├── outputParser.ts    # Advanced stream processing with JSON detection
├── promptBuilder.ts   # Agent-aware prompt generation
├── claudeUtils.ts     # Claude Code utilities and OAuth handling
├── logger.ts          # Structured logging with PTY session tracking
└── tuiBrowser.ts     # Enhanced UI with PTY session insights
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

### 🔒 Enhanced Safety (PTY Mode)
- **PTY Session Isolation**: Each session runs in isolated PTY environment
- **Automatic Session Cleanup**: Prevents resource leaks with up to 28 concurrent sessions
- **OAuth Token Security**: Secure credential extraction without exposing API keys
- **Stream Buffer Management**: Controlled memory usage with advanced stream processing
- **Maximum iteration limits** to prevent infinite loops
- **Session tracking** for audit and rollback with OAuth integration
- **Tool permission controls** with granular access
- **Enhanced error detection and recovery** with JSON stream parsing
- **Verbose logging** for debugging and transparency with PTY session details
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

### Browser Authentication Issues

#### Browser Session Not Found
```bash
# Check if you're logged into Claude
# 1. Open https://claude.ai in your browser
# 2. Ensure you're signed in with Pro/Team account
# 3. Try refreshing the page

# Force browser session refresh
acc run "test task" --refresh-session -i 1

# Check browser compatibility
acc --check-browser-support
```

#### Browser Popup Blocked
```bash
# Enable popups for claude.ai in your browser
# Chrome: Settings > Privacy and security > Site Settings > Pop-ups
# Firefox: Preferences > Privacy & Security > Permissions > Block pop-up windows
# Edge: Settings > Cookies and site permissions > Pop-ups and redirects

# Alternative: Use manual token mode
acc run "task" --manual-auth -i 3
```

#### Session Expired/Invalid
```bash
# Clear stored session tokens
acc --clear-session-cache

# Re-authenticate with browser
acc run "test task" --force-reauth -i 1

# Check session status
acc --session-status
```

### Common SDK Authentication Problems

#### Browser Not Launching
```bash
# Check default browser setting
which google-chrome || which firefox || which safari

# Specify browser explicitly
acc run "task" --browser chrome --dual-agent -i 3
acc run "task" --browser firefox --dual-agent -i 3

# Use headless browser mode
acc run "task" --headless-browser --dual-agent -i 3
```

#### WebDriver Connection Failed
```bash
# Install/update browser drivers
npm install -g chromedriver geckodriver

# Check WebDriver path
which chromedriver
which geckodriver

# Use system WebDriver
acc run "task" --system-webdriver --dual-agent -i 3
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

#### Fallback to API Mode
```bash
# If browser mode fails, use API mode
export ANTHROPIC_API_KEY="sk-ant-your-key-here"
acc run "task" --api-auth --dual-agent -i 3

# Test API connectivity
acc --test-api-connection
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
acc --resource-monitor &
acc run "task" --dual-agent -i 5

# Use lightweight browser mode
acc run "task" --lightweight-browser --dual-agent -i 3
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