# Quick Start Guide - Automatic Claude Code v2.0

Get up and running with Automatic Claude Code in under 5 minutes! 🚀

## Prerequisites

Before you begin, ensure you have:
- **Node.js 18+** installed ([Download](https://nodejs.org/))
- **Git** installed ([Download](https://git-scm.com/))
- **pnpm** or **npm** package manager
- **Claude account** (for Claude CLI authentication)

## 🚀 Installation (2 minutes)

### Step 1: Install Claude CLI (Required)
```bash
# Install the official Claude CLI globally
npm install -g @anthropic-ai/claude-code

# Verify installation
claude --version
# Expected: Claude Code version 1.0.100 or higher

# Authenticate with Claude
claude login
# Follow the browser authentication flow
```

### Step 2: Install Automatic Claude Code
```bash
# Clone the repository
git clone https://github.com/yossiashkenazi/automatic-claude-code
cd automatic-claude-code

# Install dependencies (using pnpm or npm)
pnpm install
# OR
npm install

# Build the project
pnpm run build

# Make 'acc' command available globally
npm link

# Verify installation
acc --version
# Expected: 1.2.0 or higher
```

## ✅ Verification (1 minute)

### Health Check
```bash
# Run comprehensive health check
acc run --verify-claude-cli "test"

# You should see:
# 🟢 Overall Health: HEALTHY
# SDK Available: ✅
# Claude CLI: ✅
# Authentication: ✅
```

### Quick Test
```bash
# Test with a simple task
acc run "write a hello world function in JavaScript" -i 1

# This will:
# 1. Initialize the SDK
# 2. Send your task to Claude
# 3. Execute the response
# 4. Save the session
```

## 🎯 Basic Usage (30 seconds per task)

### Simple Tasks
```bash
# Fix a bug
acc run "fix the TypeError in utils.js" -i 3

# Add documentation
acc run "add JSDoc comments to all functions in src/" -i 2

# Write tests
acc run "create unit tests for the auth module" -i 4
```

### Advanced Features
```bash
# Dual-agent mode (Manager + Worker)
acc run "refactor the entire authentication system" --dual-agent -i 5

# Verbose output for debugging
acc run "optimize database queries" -i 3 -v

# Check session history
acc history

# View specific session details
acc session [session-id]
```

## 🎨 Common Use Cases

### 1. Bug Fixing
```bash
acc run "find and fix all TypeScript errors in the project" -i 5
```

### 2. Feature Implementation
```bash
acc run "implement user authentication with JWT tokens" -i 10
```

### 3. Code Refactoring
```bash
acc run "refactor api.js to use async/await instead of promises" -i 4
```

### 4. Documentation
```bash
acc run "generate comprehensive README with examples" -i 3
```

### 5. Testing
```bash
acc run "write integration tests for the payment module" -i 6
```

## ⚙️ Configuration (Optional)

### Default Configuration Location
```bash
~/.automatic-claude-code/config.json
```

### Basic Configuration
```json
{
  "defaultModel": "sonnet",
  "maxIterations": 10,
  "sdkIntegration": {
    "enabled": true,
    "timeout": 300000
  },
  "monitoring": {
    "enabled": false
  }
}
```

### Enable Monitoring Dashboard (Optional)
```bash
# Start monitoring server
cd dual-agent-monitor
pnpm install
pnpm run dev

# Access dashboard
open http://localhost:6011

# Check API health
curl http://localhost:4005/api/health
```

## 🔧 Troubleshooting

### Issue: "Claude Code SDK not available"
**Solution**:
```bash
# Reinstall Claude CLI
npm uninstall -g @anthropic-ai/claude-code
npm install -g @anthropic-ai/claude-code

# Re-authenticate
claude logout
claude login

# Verify
acc run --verify-claude-cli "test"
```

### Issue: "Authentication failed"
**Solution**:
```bash
# Re-authenticate with Claude
claude logout
claude login

# If using API key instead
export ANTHROPIC_API_KEY="your-api-key"
```

### Issue: "Command not found: acc"
**Solution**:
```bash
# Re-link the command
cd automatic-claude-code
npm link

# Verify
which acc
acc --version
```

## 📊 Monitoring Your Tasks

### View Session History
```bash
# List all sessions
acc history

# Filter recent sessions
acc history | head -20

# View specific session
acc session [session-id]
```

### Monitor in Real-Time
```bash
# Start monitoring dashboard (optional)
pnpm run monitor:start

# View live dashboard
open http://localhost:6011
```

## 🚀 Pro Tips

### 1. Use Iterations Wisely
- Start with 3-5 iterations for simple tasks
- Use 10-15 for complex refactoring
- Add `-v` flag to see detailed progress

### 2. Dual-Agent for Complex Tasks
```bash
# Manager plans, Worker executes
acc run "redesign the entire database schema" --dual-agent -i 10
```

### 3. Save Time with Examples
```bash
# View example prompts
acc examples

# Copy and modify for your needs
```

### 4. Debug with Verbose Mode
```bash
# See everything that's happening
acc run "debug the memory leak" -i 5 -v
```

### 5. Check SDK Status Regularly
```bash
# Quick health check
acc run --sdk-status "test"
```

## 📚 Next Steps

### Explore Advanced Features
- Read the [full documentation](./docs/)
- Check out the [Migration Guide](./MIGRATION_GUIDE.md) if upgrading
- Review the [Phase 3 Roadmap](./PHASE3_ROADMAP.md) for upcoming features

### Join the Community
- Report issues on [GitHub](https://github.com/yossiashkenazi/automatic-claude-code/issues)
- Share your experience
- Contribute to the project

## 🎉 You're Ready!

You now have everything you need to start using Automatic Claude Code. Begin with simple tasks and gradually explore more advanced features as you become comfortable.

**Happy Coding with AI! 🤖**

---

*Need help? Run `acc --help` or check our [comprehensive documentation](./docs/).*