# Automatic Claude Code

A WSL terminal application that runs Claude Code in an automated loop for continuous AI-assisted development. This tool enables iterative development by automatically feeding Claude Code's output back as input for the next iteration.

## Features

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

# Install dependencies
pnpm install

# Build the project
pnpm run build

# Link globally for easy access
pnpm link --global

# Now you can use 'acc' from anywhere
acc examples
```

### Method 2: Local Usage
```bash
# Clone and build (same as above)
git clone https://github.com/YossiAshkenazi/automatic-claude-code.git
cd automatic-claude-code
pnpm install
pnpm run build

# Use with node command
node dist/index.js run "your task" -i 3 -v
```

### Method 3: NPM Install (Future)
```bash
# When published to NPM (not yet available)
npm install -g automatic-claude-code
```

## Prerequisites

- Node.js 18+
- Claude Code CLI installed and configured
- WSL (for Windows users) or Unix-like environment

## Usage

### Basic Command

```bash
# Run with a specific task
automatic-claude-code run "implement a REST API with authentication"

# Or use the short alias
acc run "fix all TypeScript errors in the project"
```

### Options

```bash
acc run [prompt] [options]

Options:
  -i, --iterations <number>   Maximum number of iterations (default: 10)
  -m, --model <model>        Claude model to use: sonnet or opus (default: sonnet)
  -d, --dir <path>          Working directory for the project
  -t, --tools <tools>       Comma-separated list of allowed tools
  -c, --continue-on-error   Continue loop even if errors occur
  -v, --verbose            Show detailed output
```

### Quick Start

```bash
# Get help and see example prompts
acc examples

# Run a specific development task
acc run "add unit tests for all functions in src/utils.ts" -i 3 -v

# Check what happened in your last session
acc session

# View all your previous sessions
acc session --list
```

### Development Examples

```bash
# 💡 Development Tasks
acc run "implement error handling for network requests" -i 4
acc run "add JSDoc comments to all exported functions" -i 2
acc run "refactor the authentication module to use JWT" -i 5

# 🐛 Bug Fixes  
acc run "fix the memory leak in the websocket connection" -i 3
acc run "resolve TypeScript errors in the build process" -i 4
acc run "fix the race condition in async data loading" -i 3

# 📚 Documentation
acc run "create comprehensive README with installation guide" -i 2
acc run "add inline documentation for complex algorithms" -i 3

# 🏗️ Architecture
acc run "migrate from Express to Fastify framework" -i 6
acc run "implement dependency injection pattern" -i 4
```

### Advanced Options

```bash
# Use Opus model with verbose output
acc run "refactor the database layer" -m opus -v

# Specify working directory and tools  
acc run "implement caching" -d ./my-project -t "Read,Write,Edit,Bash"

# Continue on errors
acc run "migrate to TypeScript" -c

# Run with specific iteration limit
acc run "add unit tests for all components" -i 5
```

### Debugging and Session Management

```bash
# Show all previous sessions
acc history

# List recent sessions with summaries
acc session --list

# View detailed session breakdown
acc session [session-id]

# View raw logs
acc logs

# Watch logs in real-time  
acc logs --tail
```

## How It Works

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
  "maxIterations": 10,
  "continueOnError": false,
  "verbose": false,
  "allowedTools": [
    "Read", "Write", "Edit", "MultiEdit",
    "Bash", "Glob", "Grep", "LS",
    "WebFetch", "WebSearch", "TodoWrite"
  ],
  "sessionHistoryLimit": 100,
  "autoSaveInterval": 60000
}
```

## All Available Commands

```bash
# Core functionality
acc run "<task>"           # Run automated development task
acc examples              # Show example prompts and usage tips
acc help                  # Show help information

# Session management  
acc session              # View latest session details
acc session --list       # List all sessions with summaries  
acc session <id>         # View specific session details
acc history              # Show session history

# Logging and debugging
acc logs                 # View latest log file
acc logs --list          # List all log files
acc logs --tail          # Watch logs in real-time
```

## Session Management

Sessions are saved in `.claude-sessions/` directory with detailed information:
- 📝 **Prompts sent** to Claude Code in each iteration
- 💬 **Full responses** received from Claude
- 📁 **Files modified** and commands executed  
- ⏱️ **Timing data** and cost information
- 🐛 **Error logs** and recovery attempts
- 🛠️ **Tools used** (Read, Write, Edit, Bash, etc.)

## Architecture

```
src/
├── index.ts           # Main application entry point
├── config.ts          # Configuration management
├── sessionManager.ts  # Session tracking and persistence
├── outputParser.ts    # Claude output parsing and analysis
└── promptBuilder.ts   # Intelligent prompt generation
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

- **Iterative Feature Development**: Build complex features step by step
- **Automated Bug Fixing**: Let Claude Code find and fix issues systematically  
- **Code Refactoring**: Progressively improve code quality
- **Test Generation**: Create comprehensive test suites
- **Documentation**: Generate and update documentation
- **Migration Tasks**: Migrate codebases between frameworks or languages

## Safety Features

- Maximum iteration limits to prevent infinite loops
- Session tracking for audit and rollback
- Tool permission controls
- Error detection and recovery mechanisms
- Verbose logging for debugging

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Disclaimer

This tool runs Claude Code automatically and can make changes to your codebase. Always:
- Use version control (git)
- Review changes before deployment
- Test in a safe environment first
- Set appropriate iteration limits