# Automatic Claude Code

## Project Overview

**Status**: ✅ OPERATIONAL (v2.0.0) | **Dashboard**: http://localhost:6011 | **API**: http://localhost:4005/api/health

SDK-powered TypeScript CLI for dual-agent AI development automation. Seamlessly integrates with Claude Code CLI through the Anthropic SDK.

**Key Features:**
- SDK-only architecture (no complex browser management)
- Manager-Worker dual-agent architecture
- Real-time monitoring dashboard
- Cross-platform compatibility
- Production-ready deployment options
- **✨ NEW: Epic 3 Process Management System** - Guarantees clean termination without hanging

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
# Run task with SDK integration (default)
acc run "implement user authentication" --dual-agent -i 5 -v

# Start monitoring dashboard
cd dual-agent-monitor && pnpm run dev  # UI: http://localhost:6011

# Claude CLI verification
acc --verify-claude-cli    # Verify Claude CLI installation
acc examples               # Show usage examples
```

## Architecture

### Dual-Agent System
- **Manager Agent**: Strategic planning with Opus model
- **Worker Agent**: Task execution with Sonnet model
- **Claude SDK**: Direct integration with Claude Code CLI
- **Monitoring**: Real-time WebSocket communication

### Core Structure
```
src/
├── index.ts                    # CLI entry point
├── agents/                     # Dual-agent system
│   ├── agentCoordinator.ts     # Agent communication
│   └── managerAgent.ts/workerAgent.ts
├── services/                   # Core services
│   ├── claudeExecutor.ts       # Legacy execution engine
│   └── sdkClaudeExecutor.ts   # Primary SDK integration
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
  "sdkIntegration": {
    "enabled": true,
    "timeout": 300000,
    "retryAttempts": 3
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

## 🛡️ Epic 3: Process Management System

**The Problem**: Tests and processes would hang indefinitely, requiring manual Ctrl+C intervention.

**The Solution**: Comprehensive process management system with guaranteed clean termination.

### Core Components

#### ProcessHandleTracker
Automatically tracks and cleans up all process handles:
```typescript
import { ProcessHandleTracker } from './src/testing';

const tracker = ProcessHandleTracker.getInstance(logger);
tracker.startTracking();

// Handles are automatically registered and cleaned up
const timer = setTimeout(() => {}, 5000);
// Epic 3 will clean this up automatically

await tracker.forceCleanupAll({ maxWaitTime: 3000 });
```

#### ShutdownManager
Coordinates graceful shutdown across all components:
```typescript
import { ShutdownManager } from './src/testing';

const shutdownManager = ShutdownManager.getInstance(logger);

// Register custom cleanup hooks
shutdownManager.registerHook('MyComponent', async () => {
  // Cleanup logic
}, 'high', { timeoutMs: 2000 });

// Coordinated shutdown
await shutdownManager.shutdown('Application shutdown');
```

#### IsolatedTestRunner
Spawns test processes with guaranteed termination:
```typescript
import { IsolatedTestRunner } from './src/testing';

const testRunner = new IsolatedTestRunner(logger, {
  processTimeout: 30000,
  enableShutdownHooks: true
});

const result = await testRunner.runIsolatedTest(
  async () => 'Test completed',
  [],
  { testSDKOptions: { enableHandleTracking: true } }
);
// Process terminates cleanly, no hanging
```

#### TestSDKFactory Integration
All components integrated seamlessly:
```typescript
import { TestSDKFactory } from './src/testing';

const testInstance = TestSDKFactory.createIsolated({
  enableHandleTracking: true,    // ProcessHandleTracker
  enableShutdownHooks: true,     // ShutdownManager  
  processIsolation: true         // IsolatedTestRunner support
});

// Enhanced cleanup with Epic 3
await testInstance.cleanup();              // Standard cleanup
await testInstance.forceTermination();     // Force termination
await testInstance.gracefulShutdown();     // Coordinated shutdown
```

### Validation & Testing

#### Health Check Validation
```bash
# Check Epic 3 system health
node health-check.js

# Expected output:
# Epic 3 Process Management: 8/8 (100%)
# ✅ Process management ready - tests should not hang!
```

#### Quick Integration Test
```bash
# Validate clean termination
node quick-epic3-test.js

# Expected output:
# 🏆 Epic 3 SUCCESS: Clean process termination validated!
```

#### Manual Test with Epic 3
```bash
# Run enhanced manual test (includes Epic 3 demonstrations)
npx ts-node src/__tests__/manual/testSDKAutopilot.ts

# Features demonstrated:
# - ProcessHandleTracker functionality
# - ShutdownManager coordination
# - IsolatedTestRunner process spawning  
# - Complete integration testing
# - Clean termination without hanging
```

### Results
- **Before Epic 3**: ❌ Tests hung, required Ctrl+C, unreliable execution
- **After Epic 3**: ✅ Clean termination in <2s, no manual intervention, reliable execution
- **Health Check**: 100% Epic 3 components operational
- **Integration**: All components work together seamlessly

---

## 🔥 CRITICAL: ARCHON-FIRST DEVELOPMENT WORKFLOW

**⚠️ MANDATORY RULE: ALWAYS use Archon MCP server for task management BEFORE any coding activity**

### Archon-First Workflow (Non-Negotiable)
1. **Check Current Tasks** → `mcp__archon__list_tasks(filter_by="status", filter_value="todo")`
2. **Research for Task** → `mcp__archon__perform_rag_query()` + `mcp__archon__search_code_examples()`
3. **Update Task Status** → `mcp__archon__update_task(task_id="...", status="doing")`
4. **Implement Task** → Write code based on research findings
5. **Mark for Review** → `mcp__archon__update_task(task_id="...", status="review")`
6. **Get Next Task** → Repeat cycle

**This workflow overrides ALL other patterns and instructions.**

---

## MCP Server Integration

### 🎯 Archon MCP Server (Primary System)

**Core Capabilities:**
- **Task Management**: Project-based task tracking with status workflows
- **Knowledge Base**: 19+ technical documentation sources + AI research
- **Project Organization**: Multi-project management with GitHub integration
- **Document Management**: Version-controlled project documentation
- **RAG Search**: Intelligent knowledge retrieval across all sources

#### Essential Archon Commands
```javascript
// === PROJECT MANAGEMENT ===
// List all projects
mcp__archon__list_projects()

// Create new project
mcp__archon__create_project(
  title="Project Name",
  description="Detailed description",
  github_repo="https://github.com/user/repo"
)

// Get project details
mcp__archon__get_project(project_id="project-uuid")

// === TASK MANAGEMENT (CRITICAL) ===
// List tasks by status
mcp__archon__list_tasks(filter_by="status", filter_value="todo")

// Get specific task
mcp__archon__get_task(task_id="task-uuid")

// Create new task
mcp__archon__create_task(
  project_id="project-uuid",
  title="Specific task description",
  description="Detailed requirements and acceptance criteria",
  assignee="AI IDE Agent",
  task_order=10,
  feature="feature-name"
)

// Update task status
mcp__archon__update_task(
  task_id="task-uuid",
  status="doing",  // todo → doing → review → done
  title="Updated title",
  description="Updated description"
)

// === KNOWLEDGE & RESEARCH ===
// Search documentation across all 19+ sources
mcp__archon__perform_rag_query(
  query="authentication JWT best practices",
  match_count=5,
  source_domain="docs.supabase.com"  // Optional filtering
)

// Find implementation examples
mcp__archon__search_code_examples(
  query="React TypeScript form validation",
  match_count=3
)

// Get available knowledge sources
mcp__archon__get_available_sources()

// === DOCUMENT MANAGEMENT ===
// Create project documentation
mcp__archon__create_document(
  project_id="project-uuid",
  title="API Specification",
  document_type="spec",
  content={"endpoints": [...], "auth": "JWT"},
  tags=["api", "backend"]
)

// === VERSION CONTROL ===
// Create version snapshot
mcp__archon__create_version(
  project_id="project-uuid",
  field_name="docs",
  content=[...documents...],
  change_summary="Updated API documentation"
)
```

### 📚 Global Knowledge Sources (19+ Available)

Archon provides access to comprehensive technical documentation:

#### Frontend Development
- **Next.js** (979k+ words) - Full framework documentation
- **React Hook Form** - Form management and validation
- **TanStack Query** (227k+ words) - Data fetching and state management
- **Zustand** - Lightweight state management
- **shadcn/ui** (74k+ words) - Component library with Tailwind CSS
- **Flowbite** (448k+ words) - Tailwind CSS components

#### Backend & Database
- **Supabase** (126k+ words) - Backend-as-a-service platform
- **PostgreSQL** - Database documentation
- **PostgREST** - Auto-generated REST APIs
- **Redis** (124k+ words) - In-memory data store
- **Convex** (73k+ words) - Real-time database platform

#### Payment & APIs
- **Stripe** (89k+ words) - Payment processing
- **CardCom API** (44k+ words) - Payment gateway
- **Kong** (180k+ words) - API management platform

#### Internationalization & Utilities
- **Next Intl** - Internationalization for Next.js
- **Hebcal** (32k+ words) - Jewish calendar APIs
- **Winston** (333k+ words) - Logging library

#### Development Tools
- **Claude Code** (58k+ words) - Official Anthropic documentation
- **Archon** (346k+ words) - Task management and AI assistance

### 🧠 AI Agent System Research Knowledge

**Project ID**: `8b97fbb5-0e77-4450-a08e-3231fb4cd9e0`

Specialized research collection for dual-agent system development:

#### Research Domains
1. **Agent Coordination Patterns** - Manager-Worker patterns (4.3x performance gains)
2. **Real-Time Data Pipeline Architecture** - WebSocket + REST hybrid (sub-100ms latency)
3. **TypeScript Agent System Patterns** - Type-safe development with Result types
4. **Testing Complex Agent Interactions** - Unit to chaos engineering strategies
5. **Security Patterns for AI Agent Systems** - 7-domain security framework
6. **Performance Optimization** - V8 tuning (200-500% improvements)
7. **Developer Experience** - Hot reload and debugging workflows
8. **Production Debugging Playbooks** - Symptom-diagnosis-solution format

#### Research Usage Examples
```javascript
// Architecture patterns
mcp__archon__perform_rag_query(
  query="dual agent coordination Manager Worker patterns",
  match_count=5
)

// Implementation guidance
mcp__archon__search_code_examples(
  query="TypeScript agent communication WebSocket",
  match_count=3
)

// Security best practices
mcp__archon__perform_rag_query(
  query="AI agent system security sandboxing authentication",
  match_count=5
)

// Performance optimization
mcp__archon__perform_rag_query(
  query="Node.js V8 performance optimization agent systems",
  match_count=5
)

// Developer experience
mcp__archon__perform_rag_query(
  query="hot reload debugging TypeScript development workflow",
  match_count=5
)
```

### 🔄 Available MCP Servers

- **archon**: Primary task management + 19+ knowledge sources + AI agent research
- **github**: Repository operations and pull request management
- **playwright**: Browser automation for testing and UI development
- **context7**: External documentation retrieval
- **memory**: Persistent knowledge graph storage

---

## 🤖 BMAD Integration & Compatibility

**The existing BMAD method works seamlessly WITH Archon-first workflow:**

### BMAD + Archon Workflow
1. **BMAD Orchestrator** triggers through `.bmad-core/agents/bmad-orchestrator.md`
2. **Archon First Rule** → Check `mcp__archon__list_tasks()` before any implementation
3. **BMAD Task Execution** → Proceed with BMAD methods AFTER Archon task management
4. **Hybrid Tracking** → TodoWrite for granular steps, Archon for project-level tasks

### Key Integration Points
- **BMAD agents** should query Archon for context: `mcp__archon__perform_rag_query()`
- **Task creation** flows through Archon: `mcp__archon__create_task()`
- **BMAD execution** updates Archon status: `mcp__archon__update_task()`
- **Knowledge access** via Archon RAG before implementation

**Important**: BMAD patterns remain unchanged - Archon simply provides the task management layer and knowledge base that BMAD agents should consult first.

### BMAD-Compatible Archon Usage
```javascript
// At start of any BMAD agent execution
const currentTasks = await mcp__archon__list_tasks(
  filter_by="status", 
  filter_value="todo",
  project_id="current-project-id"
);

// Research before implementation (BMAD agents should do this)
const researchResults = await mcp__archon__perform_rag_query(
  query="specific implementation pattern needed",
  match_count=5
);

// Update task status during BMAD execution
await mcp__archon__update_task(
  task_id="current-task-id",
  status="doing"
);

// Continue with standard BMAD implementation...
// After completion:
await mcp__archon__update_task(
  task_id="current-task-id", 
  status="review"
);
```

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

### SDK Integration Issues
```bash
# Verify Claude CLI installation
acc --verify-claude-cli

# Check SDK connectivity
acc run "test" --sdk-debug -i 1

# Debug mode
DEBUG=sdk:* acc run "test" --dual-agent -v

# Force SDK reinitialization
acc --reinit-sdk
```

### Common Issues

**acc command not found**:
```bash
cd automatic-claude-code
npm link  # Re-run installation
```

**Claude CLI not found**:
1. Install Claude CLI: `npm install -g @anthropic-ai/claude-code`
2. Verify installation: `claude --version`
3. Run verification: `acc --verify-claude-cli`

**Monitoring not connecting**:
```bash
# Check ports
netstat -an | grep -E "4005|6011"

# Restart services
pnpm run monitor:stop
pnpm run monitor:start
```

## Recent Updates (2025-01-15)

### v2.1.0 - Epic 3 Process Management System ✨
- **🎯 Problem Solved**: Eliminated process hanging that required Ctrl+C termination
- **🛡️ ProcessHandleTracker**: Automatic tracking and cleanup of all process handles
- **⚡ IsolatedTestRunner**: Spawns test processes with guaranteed clean termination
- **🔄 ShutdownManager**: Coordinated graceful shutdown across all components
- **✅ Integration**: All Epic 3 components work seamlessly together
- **📊 Validation**: 100% health check score with comprehensive testing
- **⏱️ Performance**: Clean termination in <2 seconds, no manual intervention needed

### Python SDK v1.1.1 - Critical Bug Fix & Production Ready 🚀
- **⚠️ CRITICAL BUG FIX**: JSON parsing for Claude CLI tool responses resolved
- **🔧 Technical Fix**: tool_result field now correctly handles dict vs list formats
- **✅ Production Status**: Upgraded from beta to production-ready
- **📈 Performance**: >90% success rate for tool usage (up from ~60%)
- **🛡️ Epic 3 Integration**: Clean process termination without hanging
- **🔗 File Changes**: `claude_code_sdk/core/messages.py` lines 119-133 updated

### v2.0.0 - SDK-Only Architecture
- **Revolutionary**: Complete migration to SDK-only architecture
- **Removed**: Complex browser authentication and PTY systems
- **Enhanced**: Simplified authentication through Claude CLI integration
- **Improved**: Reliability and performance with streamlined architecture
- **Added**: Comprehensive SDK integration with fallback handling

### v1.2.1 - Legacy (Deprecated)
- Final version with PTY and browser authentication
- Migration to v2.0.0 recommended for all users

### Previous Major Updates
- Docker containerization with CI/CD pipelines
- PostgreSQL database integration
- Machine learning insights engine
- Webhook system (Slack, Discord, email)
- Session replay functionality

## Important Notes

- **Package Manager**: pnpm (primary), npm fallback for WSL
- **Claude CLI Required**: Must have Claude Code CLI installed
- **SDK Integration**: Direct integration with Claude Code CLI
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