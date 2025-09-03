# Automatic Claude Code - Visual Agent Management Platform

## Project Overview

**Status**: ✅ OPERATIONAL (v2.1.0) | **Dashboard**: http://localhost:6011 | **API**: http://localhost:4005/api/health  
**Hook Events**: http://localhost:6001 | **Monitoring**: http://localhost:4000/events

**MAJOR PROJECT PIVOT**: This project has undergone a significant course correction toward its true vision: **A comprehensive visual management platform for parallel Claude Code CLI agents with real-time workflow orchestration and comprehensive event monitoring**.

### Current Vision
A complete agent management ecosystem featuring:
- **Visual Agent Platform**: Create Manager and Worker agents through intuitive UI
- **Real-time Workflow Canvas**: Watch agents communicate with interactive visual flows
- **Comprehensive Event Monitoring**: Full observability of all agent activities via PowerShell/Bash hooks
- **Task Management System**: Visual drag-drop assignment and progress tracking
- **Multi-Modal Dashboards**: Real-time insights across development, monitoring, and coordination
- **Enterprise-Grade Infrastructure**: Epic 3 process management, PostgreSQL persistence, WebSocket communication

### Key Technologies
- **Frontend**: React + TypeScript + TailwindCSS + WebSocket
- **Backend**: Python + FastAPI + Enhanced CLI Wrapper  
- **CLI Integration**: Production-ready `claude_cli_wrapper.py` for multiple agents
- **Process Management**: Epic 3 system (guarantees clean termination)
- **Event Monitoring**: PowerShell/Bash hook system with real-time dashboard
- **Real-time Communication**: WebSocket infrastructure with <100ms latency
- **Database**: PostgreSQL with session persistence and event logging
- **Observability**: Comprehensive event capture and analysis system

---

## ⚡ Quick Start

### Installation
```bash
# Clone and install
git clone https://github.com/yossiashkenazi/automatic-claude-code
cd automatic-claude-code
pnpm install
pnpm run build

# Enable global 'acc' command
npm link

# Verify installation
acc examples
```

### Visual Agent Platform Launch
```bash
# Start monitoring dashboard (Visual Interface)
cd dual-agent-monitor && pnpm run dev  # UI: http://localhost:6011

# Start Python orchestrator (Backend)
cd python-sdk && python multi_agent_demo.py

# Create agents through UI and watch them work!
```

### Legacy CLI Usage (Still Available)
```bash
# Traditional dual-agent CLI mode
acc run "implement user authentication" --dual-agent -i 5 -v

# Claude CLI verification
acc --verify-claude-cli
acc examples
```

---

## 🔗 Hook System & Event Monitoring

**Status**: ✅ FULLY OPERATIONAL - Real-time event capture and observability

The platform includes a comprehensive event monitoring system that captures all Claude Code activities through PowerShell/Bash hooks, providing complete visibility into agent operations, task coordination, and development workflows.

### Hook System Architecture

#### Core Hook Scripts (`.claude/hooks/`)
- **`user-prompt-submit-hook.ps1/.sh`** - Captures user prompts to Claude
- **`tool-invocation-hook.ps1/.sh`** - Captures when Claude uses tools
- **`assistant-message-hook.ps1/.sh`** - Captures Claude's responses
- **`agent-communication-hook.ps1/.sh`** - Dual-agent coordination tracking
- **`quality-gate-hook.ps1/.sh`** - Validation checkpoint monitoring
- **`workflow-transition-hook.ps1/.sh`** - Inter-agent workflow phase tracking

#### Event Processing Pipeline
```
Claude Code Event → Hook Script → JSON Payload → HTTP POST → Observability Server → Real-time Dashboard
```

#### Key Features
- **Non-blocking execution** - 2-second timeout, never blocks Claude Code
- **Cross-platform compatibility** - PowerShell (Windows) + Bash (Linux/Mac)  
- **Enhanced project detection** - Multiple fallback methods for accurate project identification
- **Real-time dashboard** - Events appear instantly at http://localhost:6001
- **Event correlation** - Links related agent communications and task progressions

### Event Schema Examples

#### Agent Communication Event
```json
{
  "eventType": "agent_communication",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "agentType": "manager",
  "targetAgent": "worker", 
  "messageType": "task_assignment",
  "taskId": "auth-001",
  "coordinationPhase": "assignment",
  "projectPath": "/workspace/my-project",
  "sessionId": "session-123",
  "payload": {
    "task": "Implement password hashing",
    "priority": "high",
    "estimatedComplexity": 3
  }
}
```

#### Quality Gate Event
```json
{
  "eventType": "quality_gate_result",
  "timestamp": "2024-01-15T10:35:00.000Z",
  "agentType": "manager",
  "taskId": "auth-001",
  "qualityScore": 0.87,
  "gateType": "code_review",
  "result": "passed", 
  "feedback": ["Good error handling", "Tests included"],
  "coordinationPhase": "validation",
  "projectPath": "/workspace/my-project"
}
```

### Hook System Testing & Validation

#### Individual Hook Testing
```powershell
# Test core hooks
powershell -ExecutionPolicy Bypass -File ".\.claude\hooks\user-prompt-submit-hook.ps1"

# Test dual-agent specific hooks  
powershell -ExecutionPolicy Bypass -File ".\.claude\hooks\agent-communication-hook.ps1"

# Simulate agent coordination event
$env:CLAUDE_AGENT_TYPE="manager"
$env:CLAUDE_TASK_ID="test-001" 
$env:CLAUDE_MESSAGE_TYPE="task_assignment"
powershell -ExecutionPolicy Bypass -File ".\.claude\hooks\agent-coordination-hook.ps1"
```

#### System Integration Testing
```bash
# Start dual-agent session with hook monitoring
acc run "test task" --dual-agent -v --enable-hooks

# Monitor hook events in real-time
docker logs observability-server --tail -f

# View enhanced dashboard
open http://localhost:6001

# Test specific coordination scenarios
acc run "implement auth system" --dual-agent --test-coordination
```

---

## 🏗️ Architecture (Updated for Visual Agent Platform)

### New Multi-Layer Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    VISUAL DASHBOARD                             │
│                 (React + TypeScript)                           │
│  Agent Creation | Workflow Canvas | Task Management | Chat     │
└─────────────────────┬───────────────────────────────────────────┘
                      │ WebSocket / HTTP API
┌─────────────────────▼───────────────────────────────────────────┐
│                PYTHON ORCHESTRATOR                             │
│                (FastAPI + WebSocket)                           │
│  Agent Manager | Task Processor | Communication Hub           │
└─────────────────────┬───────────────────────────────────────────┘
                      │ Enhanced CLI Wrapper
┌─────────────────────▼───────────────────────────────────────────┐
│              MULTI-AGENT CLI WRAPPER                           │
│              (Enhanced Python Wrapper)                         │
│  Process Pool | Agent Isolation | Health Monitoring           │
└─────────────────────┬───────────────────────────────────────────┘
                      │ Direct CLI Execution
┌─────────────────────▼───────────────────────────────────────────┐
│                CLAUDE CODE CLI AGENTS                          │
│            (Multiple Parallel Instances)                       │
│  Manager Agent | Worker Agent 1 | Worker Agent N              │
└─────────────────────────────────────────────────────────────────┘
```

### Core Components

#### Enhanced Python CLI Wrapper (`python-sdk/`)
- **Production Ready**: v1.1.1 with critical JSON parsing bug fix
- **Multi-Agent Support**: Manage 2-5 parallel Claude CLI processes
- **Epic 3 Integration**: Guaranteed clean termination, no hanging processes
- **Resource Management**: Memory limits, health monitoring, automatic recovery

#### Visual Dashboard (`dual-agent-monitor/`)
- **React 18** with real-time WebSocket updates
- **Agent Management**: Create, configure, monitor multiple agents
- **Workflow Canvas**: Visual task flow between Manager and Worker agents
- **Task Management**: Drag-drop assignment, progress tracking
- **Communication Monitor**: Real-time agent conversation display

#### WebSocket Communication Bridge
- **Bi-directional real-time updates** between Python and React
- **Agent status broadcasting** (<100ms latency)
- **Command execution** from UI to orchestrator
- **Message queuing** for reliable delivery

---

## 🚀 Parallel Agents Strategy

### ⚠️ CRITICAL RULE: MANDATORY SUBAGENT DELEGATION FOR TOKEN CONSERVATION

**NEVER DO DIRECT WORK IN PRIMARY SESSION** - Always delegate to subagents to preserve context:

#### Token Conservation Protocol (Non-Negotiable)

1. **Immediate Delegation**: ANY task that involves file operations, searches, or analysis MUST be delegated to subagents
2. **Context Protection**: Primary session should only contain:
   - Task planning and orchestration
   - Subagent results summaries (max 1K tokens each)
   - Final consolidated responses
3. **Prohibited in Primary Session**:
   - Direct file reading/writing operations
   - Codebase searches or exploration
   - Multi-step implementation work
   - Repetitive operations
   - Any work that could consume >5K tokens

#### Enforcement Rules

```javascript
// WRONG - Pollutes primary context
Read file → Analyze → Implement → Test → Document
// +50K tokens accumulated in primary session ❌

// CORRECT - Preserves primary context  
Task("analysis-agent", "analyze codebase") → 1K summary
Task("implementation-agent", "implement feature") → 500 token confirmation  
Task("test-agent", "run tests") → 300 token results
// Total: <2K tokens in primary session ✅
```

**Key Principle**: The primary session is a **strategic orchestrator**, not a worker. Keep it clean, focused, and token-efficient for maximum session longevity and performance.

### Available Subagents
- **general-purpose**: Complex multi-step tasks and code implementation
- **frontend-specialist**: React, UI/UX, and dashboard development  
- **test-runner**: Run tests and analyze failures
- **validation-gates**: Quality validation and testing
- **git-workflow**: Git operations and PRs
- **documentation-manager**: Update documentation

### Performance Metrics
| Task Type | Sequential | Parallel | Speedup | Context Saved |
|-----------|------------|----------|---------|---------------|
| 10 File Updates | 120s | 28s | **4.3x** | 95% |
| Feature Dev | 180s | 65s | **2.8x** | 88% |
| Visual UI Dev | 240s | 45s | **5.3x** | 92% |

---

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

### Integration with Visual Agent Platform
Epic 3 is fully integrated into the multi-agent system:
- **Python CLI Wrapper**: Clean agent process termination
- **WebSocket Server**: Graceful connection cleanup  
- **React Dashboard**: Proper component unmounting
- **Multi-Agent Orchestrator**: Coordinated shutdown of all agents

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

### Essential Archon Commands for Visual Agent Platform

```javascript
// === PROJECT MANAGEMENT ===
// Current project for Visual Agent Platform
mcp__archon__get_project(project_id="8b97fbb5-0e77-4450-a08e-3231fb4cd9e0")

// === TASK MANAGEMENT (CRITICAL) ===
// List active development tasks
mcp__archon__list_tasks(
  filter_by="status", 
  filter_value="todo",
  project_id="8b97fbb5-0e77-4450-a08e-3231fb4cd9e0"
)

// Create new visual agent platform task
mcp__archon__create_task(
  project_id="8b97fbb5-0e77-4450-a08e-3231fb4cd9e0",
  title="Enhance multi-agent visual coordination",
  description="Improve real-time workflow visualization and agent communication display",
  assignee="AI IDE Agent",
  feature="visual-workflow"
)

// === KNOWLEDGE & RESEARCH ===
// Research agent coordination patterns
mcp__archon__perform_rag_query(
  query="dual agent coordination Manager Worker visual interface patterns",
  match_count=5
)

// Find React WebSocket implementation examples
mcp__archon__search_code_examples(
  query="React TypeScript WebSocket real-time agent communication",
  match_count=3
)
```

---

## 📊 Development Workflow

### Visual Agent Platform Development Commands
```bash
# Frontend development
cd dual-agent-monitor
pnpm run dev          # Development mode with hot reload
pnpm run build        # Build production React app
pnpm run test         # Run frontend tests

# Python orchestrator development  
cd python-sdk
python multi_agent_wrapper.py    # Test multi-agent coordination
python claude_cli_wrapper.py     # Test single agent
pytest tests/                    # Run Python test suite

# Full system integration
pnpm run build        # Build TypeScript CLI
pnpm run monitor:start # Start monitoring server
pnpm run test:integration # Run full system tests

# Docker deployment
pnpm run docker:build  # Build complete system image
pnpm run docker:dev    # Development environment
pnpm run docker:prod   # Production deployment
```

### Development Architecture Files
```
docs/                                    # NEW: Comprehensive documentation
├── VISUAL_AGENT_MANAGEMENT_PRD.md      # Product requirements
├── EPIC_STRUCTURE.md                   # 6-epic development roadmap  
├── TECHNICAL_ARCHITECTURE.md           # Complete system architecture
└── brief.md                            # Strategic project brief

python-sdk/                             # ENHANCED: Multi-agent support
├── multi_agent_wrapper/                # NEW: Multi-agent management
├── claude_cli_wrapper.py               # PRODUCTION: v1.1.1 with bug fixes
├── agent_orchestrator/                 # NEW: Agent coordination
└── communication/                      # NEW: Agent communication protocol

dual-agent-monitor/                     # ENHANCED: Visual interface
├── src/components/AgentManagement/     # NEW: Agent creation/management UI
├── src/components/WorkflowCanvas/      # NEW: Visual workflow display  
├── src/components/TaskManagement/      # NEW: Task assignment interface
├── src/components/Communication/       # NEW: Agent chat visualization
└── server/                             # ENHANCED: WebSocket + API
```

---

## 🎯 Current Development Status & Next Steps

### ✅ Completed (Recent Updates)
1. **Major Course Correction**: Refocused on visual agent management platform
2. **Python SDK Production**: v1.1.1 with critical JSON parsing bug fix (>90% test pass rate)
3. **Epic 3 Integration**: Process management preventing hanging processes  
4. **CLI Modularization**: Refactored monolithic structure into organized commands
5. **Comprehensive Documentation**: PRD, Epic Structure, Technical Architecture created
6. **Infrastructure Assessment**: Existing assets identified and leveraged

### 🚧 Phase 1 Implementation (In Progress)
Based on Epic Structure documentation:

#### Week 1-2 Priorities:
1. **Multi-Agent CLI Wrapper Enhancement** 
   - Extend `claude_cli_wrapper.py` for parallel agent support
   - Implement `MultiAgentCLIWrapper` class
   - Add agent isolation and resource management

2. **React Dashboard Enhancement**
   - Create AgentManagement components (AgentCreator, AgentList, AgentSettings)
   - Build real-time agent status display
   - Integrate with existing WebSocket infrastructure

3. **WebSocket Communication Bridge**
   - Implement bi-directional communication between Python and React
   - Add real-time agent status updates
   - Create command execution pathway from UI to orchestrator

#### Week 3-4 Goals:
4. **Workflow Visualization Canvas** 
   - Interactive canvas with agent nodes and task flows
   - Real-time visualization of Manager-Worker communication
   - Task handoff animations and progress tracking

5. **Task Management Interface**
   - Task creation and assignment UI
   - Drag-and-drop functionality between agents
   - Results preview and download capabilities

### 🎯 Success Metrics for Phase 1
- Create 2+ parallel Claude CLI agents through visual UI
- Real-time display of agent status and inter-agent communication  
- Basic task assignment from Manager to Worker agent via dashboard
- Interactive workflow canvas showing live agent interactions
- <100ms latency for real-time updates

---

## 📡 API & Communication

### Visual Agent Platform Endpoints
```bash
# Agent Management API
GET    /api/agents                    # List all agents
POST   /api/agents                    # Create new agent
GET    /api/agents/{id}              # Get agent details
PUT    /api/agents/{id}              # Update agent configuration
DELETE /api/agents/{id}              # Terminate agent

# Task Management API  
GET    /api/tasks                     # List tasks
POST   /api/tasks                     # Create task
PUT    /api/tasks/{id}/assign         # Assign task to agent
GET    /api/tasks/{id}/status         # Get task progress

# Real-time Communication
WS     /ws/agents                     # Agent status updates
WS     /ws/tasks                      # Task progress updates
WS     /ws/communication             # Agent-to-agent messages
```

### WebSocket Event Types
```javascript
// Agent Events
{ type: 'agent_created', agentId: 'uuid', role: 'manager|worker' }
{ type: 'agent_status_change', agentId: 'uuid', status: 'active|idle|error' }
{ type: 'agent_communication', from: 'uuid', to: 'uuid', message: '...' }

// Task Events  
{ type: 'task_assigned', taskId: 'uuid', agentId: 'uuid' }
{ type: 'task_progress', taskId: 'uuid', progress: 0.75 }
{ type: 'task_completed', taskId: 'uuid', result: '...' }

// System Events
{ type: 'system_health', agents: 3, tasks: 5, uptime: 3600 }
```

---

## 🔧 Configuration

### Visual Agent Platform Config: `~/.automatic-claude-code/config.json`

```json
{
  "visualAgentPlatform": {
    "enabled": true,
    "maxAgents": 5,
    "dashboardPort": 6011,
    "apiPort": 4005,
    "autoStartDashboard": true
  },
  "agentDefaults": {
    "managerModel": "opus",  
    "workerModel": "sonnet",
    "resourceLimits": {
      "maxMemoryMB": 512,
      "timeoutSeconds": 300
    }
  },
  "legacyMode": {
    "enabled": true,
    "defaultModel": "sonnet",
    "sdkIntegration": {
      "enabled": true,
      "timeout": 300000,
      "retryAttempts": 3
    }
  },
  "epic3ProcessManagement": {
    "enabled": true,
    "forceCleanupTimeout": 3000,
    "healthCheckInterval": 5000
  },
  "monitoring": {
    "enabled": true,
    "sessionRecording": true,
    "performanceMetrics": true
  },
  "hookSystem": {
    "enabled": true,
    "observabilityPort": 4000,
    "dashboardPort": 6001,
    "eventRetention": "30d",
    "crossPlatform": true,
    "eventTypes": {
      "agent_communication": true,
      "quality_gates": true,
      "workflow_transitions": true,
      "tool_invocations": true,
      "user_interactions": true
    }
  }
}
```

---

## 🚨 Troubleshooting

### Visual Agent Platform Issues

**Dashboard not loading (port 6011)**:
```bash
# Check if port is occupied
netstat -an | grep 6011

# Restart monitoring stack
cd dual-agent-monitor
pnpm run dev

# Check logs
tail -f logs/dashboard.log
```

**Python orchestrator connection issues**:
```bash
# Verify Python SDK status
cd python-sdk
python -c "from claude_cli_wrapper import ClaudeCLIWrapper; print('SDK OK')"

# Test Claude CLI connectivity
claude --version
claude auth status

# Debug multi-agent wrapper
python debug_multi_agent.py
```

**Agent creation failures**:
```bash
# Check Epic 3 process management
node tests/integration/quick-epic3-test.js

# Verify Claude CLI authentication
acc --verify-claude-cli

# Check resource availability
python python-sdk/debug_system_resources.py
```

### Legacy CLI Issues

**acc command not found**:
```bash
cd automatic-claude-code
npm link  # Re-run installation
```

**Claude CLI not found**:
1. Install Claude CLI: `npm install -g @anthropic-ai/claude-code`
2. Verify installation: `claude --version`
3. Run verification: `acc --verify-claude-cli`

### Hook System Issues

**Hook events not appearing in dashboard**:
```bash
# Check if hook scripts exist
ls -la .claude/hooks/

# Test individual hook manually
powershell -ExecutionPolicy Bypass -File ".\.claude\hooks\user-prompt-submit-hook.ps1"

# Check observability server status
curl http://localhost:4000/health
```

**Hook scripts failing on execution**:
```powershell
# Check PowerShell execution policy
Get-ExecutionPolicy

# Set execution policy if needed
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Test hook with verbose output
$VerbosePreference = "Continue"
powershell -ExecutionPolicy Bypass -File ".\.claude\hooks\user-prompt-submit-hook.ps1"
```

**Cross-platform hook compatibility issues**:
```bash
# For Linux/Mac - ensure bash scripts are executable
chmod +x .claude/hooks/*.sh

# Test bash hooks
export CLAUDE_AGENT_TYPE="test"
bash .claude/hooks/agent-communication-hook.sh

# Check script dependencies
which curl  # Required for HTTP requests
which jq    # Optional but recommended for JSON processing
```

---

## 📈 Recent Updates (Updated: 2024-09-03)

### v2.1.0 - Major Course Correction & Visual Agent Platform Foundation ✨
- **🎯 Project Pivot**: Refocused on visual management for parallel Claude Code CLI agents
- **📄 Complete Documentation**: PRD, Epic Structure, Technical Architecture created
- **🏗️ Infrastructure Assessment**: Identified and leveraged all existing working components
- **🚀 Development Roadmap**: 6-epic structure with detailed implementation plan
- **⚡ Phase 1 Planning**: Multi-agent CLI wrapper + React dashboard enhancement

### v2.0.1 - Python SDK Critical Bug Fix & Production Ready 🚀
- **⚠️ CRITICAL BUG FIX**: JSON parsing for Claude CLI tool responses resolved
- **🔧 Technical Fix**: `tool_result` field now correctly handles dict vs list formats
- **✅ Production Status**: Upgraded from beta to production-ready (>90% test pass rate)
- **📈 Performance**: Tool usage success rate improved from ~60% to >90%
- **🛡️ Epic 3 Integration**: Clean process termination without hanging processes

### v2.0.0 - CLI Architecture & Process Management Revolution
- **🏗️ CLI Modularization**: Refactored monolithic 920-line `src/index.ts` into organized command structure
- **⚡ Epic 3 System**: ProcessHandleTracker, ShutdownManager, IsolatedTestRunner integration
- **📊 Monitoring Stack**: PostgreSQL session recording, WebSocket real-time updates
- **🔄 Port Standardization**: Unified port configuration across all environments
- **🧪 Testing Infrastructure**: Comprehensive test suite with 95%+ reliability

### Previous Foundation Work
- Docker containerization with CI/CD pipelines
- PostgreSQL database integration with session persistence
- Machine learning insights engine for agent coordination
- Webhook system (Slack, Discord, email) for notifications
- Cross-platform compatibility (Windows, macOS, Linux)

---

## 🎯 Quick Reference

### Essential Commands
```bash
# Visual Agent Platform
cd dual-agent-monitor && pnpm run dev     # Start visual dashboard
cd python-sdk && python multi_agent_demo.py  # Start orchestrator

# Legacy CLI Mode  
acc run "task" --dual-agent -i 5 -v       # Run with dual agents
acc monitor                                # Check system status
acc history                                # View session history
acc examples                               # Show usage examples
```

### Key URLs
- **Visual Dashboard**: http://localhost:6011
- **API Health**: http://localhost:4005/api/health  
- **WebSocket**: ws://localhost:4005
- **Agent Communication**: ws://localhost:4005/ws/agents
- **Hook Events Dashboard**: http://localhost:6001
- **Event Monitoring API**: http://localhost:4000/events
- **Observability Server**: http://localhost:4000

### Important File Paths
- **Config**: `~/.automatic-claude-code/config.json`
- **Sessions**: `~/.automatic-claude-code/sessions/`
- **Logs**: `~/.automatic-claude-code/logs/`
- **Python SDK**: `python-sdk/claude_cli_wrapper.py`
- **Visual Dashboard**: `dual-agent-monitor/src/`
- **Hook Scripts**: `.claude/hooks/` (PowerShell + Bash)
- **Hook Configuration**: `.claude/settings.local.json`
- **Event Logs**: `~/.automatic-claude-code/events/`

### Development Status
- **Current Branch**: `dashboard-ui-enhancement`
- **Phase**: Phase 1 Implementation (Visual Agent Foundation)
- **Next Milestone**: Multi-agent CLI wrapper + React dashboard enhancement
- **Architecture**: Dual-agent visual coordination platform

---

*This project represents the convergence of AI development automation with intuitive visual management - transforming complex agent coordination into an accessible, powerful platform for developers.*