# Automatic Claude Code

## Project Overview

**Status**: ✅ OPERATIONAL (v1.2.1) | **Dashboard**: http://localhost:6011 | **API**: http://localhost:4005/api/health

Browser-authenticated TypeScript CLI for dual-agent AI development automation. Eliminates API keys by leveraging your Claude Pro/Team browser session.

**Key Features:**
- Browser-based authentication (no API keys needed)
- Manager-Worker dual-agent architecture
- Real-time monitoring dashboard
- Cross-platform support (Chrome, Firefox, Safari, Edge)
- Production-ready deployment options

## ⚡ Quick Start

### Installation
```bash
# Clone and install
git clone https://github.com/yossiashkenazi/automatic-claude-code
cd automatic-claude-code
pnpm install
pnpm run build

# Enable global 'acc' command
npm link  # Makes 'acc' available globally

# Verify installation
acc examples
```

### Basic Usage
```bash
# Run task with browser authentication (default)
acc run "implement user authentication" --dual-agent -i 5 -v

# Start monitoring dashboard
cd dual-agent-monitor && pnpm run dev  # UI: http://localhost:6011

# Browser session management
acc --check-browser-session    # Verify browser session
acc --refresh-browser-session  # Force refresh
```

## Architecture

### Dual-Agent System
- **Manager Agent**: Strategic planning with Opus model
- **Worker Agent**: Task execution with Sonnet model
- **Browser SDK**: Direct Claude session integration
- **Monitoring**: Real-time WebSocket communication

### Core Structure
```
src/
├── index.ts                    # CLI entry point
├── agents/                     # Dual-agent system
│   ├── agentCoordinator.ts     # Agent communication
│   └── managerAgent.ts/workerAgent.ts
├── services/                   # Core services
│   ├── claudeExecutor.ts       # Execution engine
│   ├── browserSessionManager.ts # Browser auth
│   └── sdkClaudeExecutor.ts   # SDK integration
└── monitoringManager.ts       # Dashboard integration

dual-agent-monitor/            # Monitoring dashboard
├── src/                      # React frontend
└── server/                   # WebSocket backend
```

## 🚀 Parallel Agents Strategy

**DEFAULT**: Use parallel agents for tasks >30 seconds or >2 files:

```javascript
// Launch parallel agents for complex tasks
"Use Task tool to launch 5-10 agents IN PARALLEL:
- Search agents: Find files (return paths only)
- Analysis agents: Understand code (return summaries)
- Implementation agents: Make changes (return confirmations)
Each agent returns <1K tokens"
```

### Available Subagents
- **general-purpose**: Complex multi-step tasks
- **test-runner**: Run tests and analyze failures
- **git-workflow**: Git operations and PRs
- **documentation-manager**: Update docs
- **web-search-optimizer**: Filtered web searches
- **validation-gates**: Quality validation

### Performance Metrics
| Task Type | Sequential | Parallel | Speedup | Context Saved |
|-----------|------------|----------|---------|---------------|
| 10 File Updates | 120s | 28s | **4.3x** | 95% |
| Feature Dev | 180s | 65s | **2.8x** | 88% |

## Configuration

### Config Location: `~/.automatic-claude-code/config.json`

```json
{
  "defaultModel": "sonnet",
  "browserAuth": {
    "enabled": true,
    "defaultBrowser": "chrome",
    "sessionTimeout": 3600
  },
  "dualAgentMode": {
    "enabled": false,
    "managerModel": "opus",
    "workerModel": "sonnet"
  },
  "monitoring": {
    "enabled": true,
    "dashboardPort": 6011,
    "apiPort": 4005
  }
}
```

## Development Workflow

### Development Commands
```bash
pnpm run dev          # Development mode with hot reload
pnpm run build        # Compile TypeScript
pnpm run test         # Run test suite
pnpm run lint         # Run ESLint

# Docker
pnpm run docker:build  # Build image
pnpm run docker:dev    # Development environment
pnpm run docker:prod   # Production deployment

# Monitoring
pnpm run monitor:start # Start monitoring server
pnpm run monitor:pm2   # PM2 managed service
```

### Testing Dual-Agent Mode
```bash
# Basic coordination test
acc run "implement auth system" --dual-agent -i 5 -v

# Verify monitoring
curl http://localhost:4005/api/health

# Watch real-time coordination
# Open http://localhost:6011
```

## MCP Server Integration

### Archon (Task Management + RAG)
```javascript
// Search documentation
mcp__archon__perform_rag_query(query="authentication patterns", match_count=5)

// Find code examples
mcp__archon__search_code_examples(query="jwt implementation", match_count=3)

// Task management
mcp__archon__create_task(project_id="...", title="...", assignee="AI IDE Agent")
```

### Available MCP Servers
- **archon**: Task management + 19+ knowledge sources
- **github**: Repository operations
- **playwright**: Browser automation
- **context7**: Documentation retrieval
- **memory**: Persistent storage

## Hook Scripts

Located in `.claude/hooks/`:
- User prompt capture
- Tool execution monitoring
- Agent communication tracking
- Quality gate validation

Configuration via `.claude/settings.local.json`

## Production Deployment

### Docker (Recommended)
```bash
# Using pre-built image
docker pull ghcr.io/yossiashkenazi/automatic-claude-code:latest

# Run with volumes
docker run -it --rm \
  -v "$(pwd):/workspace:ro" \
  -v "$HOME/.claude:/home/nodejs/.claude:ro" \
  ghcr.io/yossiashkenazi/automatic-claude-code:latest \
  run "your task" --dual-agent -i 5
```

### High Availability
```bash
cd dual-agent-monitor/deploy
docker-compose -f docker-compose.ha.yml up -d
```

### Kubernetes
```bash
kubectl apply -f dual-agent-monitor/deploy/kubernetes/
```

## Troubleshooting

### Browser Authentication Issues
```bash
# Check browser session
acc --check-browser-session

# Force refresh
acc run "test" --refresh-browser-session -i 1

# Debug mode
DEBUG=browser:* acc run "test" --dual-agent -v

# Try different browsers
acc run "task" --browser firefox --dual-agent -i 2
```

### Common Issues

**acc command not found**:
```bash
cd automatic-claude-code
npm link  # Re-run installation
```

**Browser session not detected**:
1. Open https://claude.ai in your browser
2. Sign in to your Claude account
3. Run `acc --check-browser-session`

**Monitoring not connecting**:
```bash
# Check ports
netstat -an | grep -E "4005|6011"

# Restart services
pnpm run monitor:stop
pnpm run monitor:start
```

## Recent Updates (2025-09-02)

### v1.2.1 - Critical Fixes
- **Fixed**: Documentation accuracy (removed misleading PTY references)
- **Fixed**: Global `acc` command installation issues
- **Enhanced**: Browser authentication error messages
- **Added**: Comprehensive troubleshooting guidance

### v1.2.0 - Browser SDK Integration
- **Revolutionary**: Direct browser authentication (no API keys)
- **Added**: Cross-browser support with session management
- **Enhanced**: Dual-agent coordination with browser SDK
- **Improved**: Global command availability with `npm link`

### Previous Major Updates
- Docker containerization with CI/CD pipelines
- PostgreSQL database integration
- Machine learning insights engine
- Webhook system (Slack, Discord, email)
- Session replay functionality

## Important Notes

- **Package Manager**: pnpm (primary), npm fallback for WSL
- **Claude CLI Required**: Must have Claude Code CLI installed
- **Browser First**: Always attempts browser auth before API fallback
- **Session Persistence**: All sessions saved to database
- **Cross-Platform**: Windows, macOS, Linux + Docker support

## Quick Reference

### Essential Commands
```bash
acc run "task" --dual-agent -i 5 -v   # Run with dual agents
acc monitor                            # Check monitoring
acc history                            # View session history
acc logs --tail                        # Watch logs
acc examples                           # Show examples
```

### Monitoring Endpoints
- Dashboard UI: http://localhost:6011
- API Health: http://localhost:4005/api/health
- WebSocket: ws://localhost:4005

### File Paths
- Config: `~/.automatic-claude-code/config.json`
- Sessions: `~/.automatic-claude-code/sessions/`
- Logs: `~/.automatic-claude-code/logs/`

---

*For detailed documentation, see `/docs` directory*