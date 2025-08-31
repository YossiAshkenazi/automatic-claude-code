# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Automatic Claude Code is a TypeScript CLI application that runs Claude Code in an automated dual-agent loop for continuous AI-assisted development. The system uses a Manager-Worker architecture where a Manager Agent coordinates tasks and a Worker Agent executes them, enabling more sophisticated problem-solving through specialized roles and collaborative workflows.

**Key Features:**
- **Dual-Agent Architecture**: Manager-Worker coordination for complex task execution
- **Real-time Monitoring**: Web-based dashboard with live agent communication tracking
- **Production-Ready Deployment**: Docker, Kubernetes, and cloud infrastructure support
- **Machine Learning Insights**: Anomaly detection, predictive analytics, and optimization recommendations
- **External Integrations**: Webhook system supporting Slack, Discord, and email notifications
- **Mobile-Responsive Interface**: Progressive Web App with offline capabilities
- **Comprehensive Testing**: Automated CI/CD pipelines with unit, integration, and E2E tests

## Essential Commands

### Installation (Required First Step)
```bash
# Install acc command globally using npm link
cd automatic-claude-code
pnpm install
pnpm run build
npm link  # This makes 'acc' available globally

# Verify installation
acc examples
```

### Development Commands
```bash
# Development
pnpm run dev          # Run in development mode with tsx
pnpm run build        # Compile TypeScript to dist/
pnpm run lint         # Run ESLint on src/**/*.ts
pnpm run typecheck    # Type-check without emitting
pnpm run clean        # Remove dist directory
```

### Core Usage (with acc command)
```bash
# From ANY project directory - use acc command
acc run "task" --dual-agent -i 5 -v
acc run "task" --manager-model opus --worker-model sonnet -v
acc monitor        # Check monitoring status
acc monitor --start # Start monitoring server
acc examples      # Show example prompts
acc history       # View session history
acc logs --tail   # Watch logs in real-time

# Legacy method (if acc command not available)
node "../automatic-claude-code/dist/index.js" run "task" --dual-agent -i 5 -v
```

### Monitoring UI
```bash
# Start monitoring server
cd dual-agent-monitor
pnpm run dev  # Starts UI on http://localhost:6011, API on http://localhost:4001

# Access monitoring dashboard
# Open http://localhost:6011 to watch dual-agent coordination in real-time
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
├── index.ts                    # Main CLI entry point and orchestration
├── config.ts                   # Configuration management
├── agents/                     # Dual-agent system
│   ├── agentCoordinator.ts     # Manages agent communication and workflows
│   ├── managerAgent.ts         # Strategic planning and oversight
│   ├── workerAgent.ts          # Task execution and implementation
│   └── agentTypes.ts           # Type definitions for agent communication
├── sessionManager.ts           # Session persistence with dual-agent support
├── outputParser.ts             # Parse outputs from both agents
├── promptBuilder.ts            # Generate contextual prompts (agent-aware)
├── logger.ts                   # Structured logging with agent tracking
├── logViewer.ts               # Terminal UI with agent-specific views
├── tuiBrowser.ts              # Enhanced browser with agent insights
└── monitoringManager.ts       # Integration with monitoring dashboard

dual-agent-monitor/             # Real-time monitoring dashboard
├── src/                        # React-based frontend application
│   ├── components/             # UI components for agent visualization
│   │   ├── visualization/      # Agent communication diagrams
│   │   ├── mobile/            # Mobile-responsive components
│   │   ├── webhooks/          # Webhook configuration UI
│   │   ├── ml/               # ML insights dashboard
│   │   └── auth/             # Authentication components
│   ├── hooks/                 # React hooks for agent data
│   ├── store/                 # State management (Zustand)
│   └── utils/                 # Utility functions
├── server/                    # Backend API and WebSocket server
│   ├── websocket-server.ts    # Real-time agent communication
│   ├── database/              # PostgreSQL integration
│   ├── auth/                  # Authentication & authorization
│   ├── webhooks/              # External integration system
│   ├── ml/                    # Machine learning insights engine
│   ├── analytics/             # Performance analytics
│   └── replay/                # Session replay functionality
└── deploy/                    # Production deployment configs
    ├── docker-compose.ha.yml  # High-availability setup
    ├── kubernetes/            # K8s manifests
    ├── terraform/             # Infrastructure as Code
    └── monitoring/            # Prometheus, Grafana configs
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

### Output Analysis & Monitoring (Enhanced)

The system now provides comprehensive monitoring and analysis:

#### Real-time Agent Monitoring
- **Agent Identification**: Tracks which agent generated each output
- **Inter-Agent Messages**: Parses communication between Manager and Worker
- **Task State Tracking**: Monitors progress on assigned work items
- **Quality Gate Results**: Captures Manager's validation decisions
- **Coordination Metrics**: Measures collaboration effectiveness

#### Machine Learning Insights
- **Anomaly Detection**: Identifies unusual patterns in agent behavior
- **Predictive Analytics**: Forecasts task completion times and success rates
- **Optimization Recommendations**: AI-driven suggestions for workflow improvements
- **Performance Analytics**: Comprehensive metrics on agent effectiveness

#### Monitoring Dashboard Features
- **Live Agent Communication**: Real-time visualization of Manager-Worker handoffs
- **Session Replay**: Review and analyze complete agent interaction sessions
- **Performance Metrics**: Charts showing response times, success rates, error patterns
- **Mobile-Responsive UI**: Progressive Web App with offline capabilities
- **Multi-Project Support**: Monitor agent activities across different codebases

#### External Integrations
- **Webhook System**: Real-time notifications to external services
- **Slack Integration**: Agent status updates and alerts in Slack channels
- **Discord Integration**: Bot notifications for development teams
- **Email Alerts**: Critical event notifications via email
- **Custom Webhooks**: Configurable endpoints for third-party integrations

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
  "monitoring": {
    "enabled": true,
    "dashboardPort": 6011,
    "apiPort": 4001,
    "autoStart": true,
    "persistSessions": true,
    "enableWebhooks": true,
    "mlInsights": true,
    "anomalyDetection": true
  },
  "database": {
    "type": "postgresql",
    "host": "localhost",
    "port": 5432,
    "database": "dual_agent_monitor",
    "ssl": false,
    "maxConnections": 20,
    "connectionTimeout": 30000
  },
  "webhooks": {
    "slack": {
      "enabled": false,
      "webhookUrl": "",
      "channel": "#dev-notifications"
    },
    "discord": {
      "enabled": false,
      "webhookUrl": "",
      "username": "Dual Agent Monitor"
    },
    "email": {
      "enabled": false,
      "smtpHost": "",
      "smtpPort": 587,
      "smtpUser": "",
      "recipients": []
    }
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

## Monitoring API Integration

### External Monitoring Endpoint

The system provides a RESTful API endpoint for external monitoring tools and integrations:

#### POST /api/monitoring
**URL**: `http://localhost:4001/api/monitoring`

**Purpose**: Receives real-time dual-agent coordination data from the main application

**Request Format**:
```json
{
  "agentType": "manager" | "worker",
  "messageType": "coordination_event" | "prompt" | "response" | "error",
  "message": "Event description or content",
  "metadata": {
    "eventType": "MANAGER_TASK_ASSIGNMENT" | "WORKER_PROGRESS_UPDATE" | "AGENT_COORDINATION",
    "eventData": { /* Event-specific data */ },
    "timestamp": "2024-08-31T12:00:00.000Z",
    "workflowPhase": "planning" | "execution" | "validation" | "completion",
    "overallProgress": 0.75
  },
  "sessionInfo": {
    "task": "User task description",
    "workDir": "/path/to/project"
  }
}
```

**Response Format**:
```json
{
  "success": true
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "Error message"
}
```

#### Integration in AgentCoordinator

The monitoring integration is automatically triggered during agent coordination:

```typescript
// Automatically called during agent communication
this.emitCoordinationEvent('AGENT_COORDINATION', 'manager', {
  phase: 'task_assignment',
  workItems: assignedTasks,
  qualityGates: validationCriteria
});
```

**Event Types Sent**:
- `MANAGER_TASK_ASSIGNMENT`: When Manager assigns work to Worker
- `WORKER_PROGRESS_UPDATE`: When Worker reports progress
- `MANAGER_QUALITY_CHECK`: When Manager validates Worker output
- `AGENT_COORDINATION`: General coordination events
- `WORKFLOW_TRANSITION`: Phase changes in dual-agent workflow
- `MANAGER_WORKER_HANDOFF`: Task handoffs between agents

#### Usage Examples

**curl Command**:
```bash
curl -X POST http://localhost:4001/api/monitoring \
  -H "Content-Type: application/json" \
  -d '{
    "agentType": "manager",
    "messageType": "coordination_event", 
    "message": "Task assignment initiated",
    "metadata": {
      "eventType": "MANAGER_TASK_ASSIGNMENT",
      "workflowPhase": "planning",
      "overallProgress": 0.25
    },
    "sessionInfo": {
      "task": "Implement authentication system",
      "workDir": "/path/to/project"
    }
  }'
```

**JavaScript Integration**:
```javascript
const monitoringData = {
  agentType: 'worker',
  messageType: 'response',
  message: 'Authentication module completed',
  metadata: {
    eventType: 'WORKER_PROGRESS_UPDATE',
    completedTasks: ['JWT setup', 'User model', 'Auth middleware'],
    overallProgress: 0.8
  }
};

fetch('http://localhost:4001/api/monitoring', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(monitoringData)
});
```

**Benefits**:
- Real-time visibility into agent coordination
- External tool integration (dashboards, alerts, analytics)
- Session persistence and replay capabilities
- Performance monitoring and optimization insights
- Custom webhook and notification support

## Production Deployment

### Quick Production Setup
The system includes comprehensive deployment infrastructure:

```bash
# 1. High-Availability Docker Compose
cd dual-agent-monitor/deploy
cp .env.production .env
docker-compose -f docker-compose.ha.yml up -d

# 2. Kubernetes Deployment
kubectl apply -f dual-agent-monitor/deploy/kubernetes/

# 3. Terraform (AWS/Azure/GCP)
cd dual-agent-monitor/deploy/terraform
terraform init && terraform apply
```

### Deployment Options
- **Single Server**: Docker Compose with PostgreSQL, Redis, nginx
- **High Availability**: Load balancer, multiple app instances, database clustering
- **Kubernetes**: Full container orchestration with auto-scaling
- **Cloud Infrastructure**: Terraform modules for AWS, Azure, GCP
- **Monitoring Stack**: Prometheus, Grafana, Alertmanager integration

### Production Features
- **SSL/TLS**: Automatic certificate management with Let's Encrypt
- **Database**: PostgreSQL with backup automation and connection pooling
- **Caching**: Redis for session storage and real-time data
- **Load Balancing**: HAProxy with health checks and failover
- **Monitoring**: Comprehensive metrics, logging, and alerting
- **Security**: Firewall rules, security headers, authentication
- **Scaling**: Auto-scaling based on CPU, memory, and request metrics

## Testing & Development Workflow

### Local Development
```bash
# 1. Install dependencies
pnpm install

# 2. Start monitoring dashboard (in separate terminal)
cd dual-agent-monitor && pnpm run dev

# 3. Run in development mode (uses tsx for hot reload)
pnpm run dev

# 4. Test a simple task
pnpm run dev run "create a hello world function" -i 2 -v

# 5. Build and test production
pnpm run build
node dist/index.js run "task" -i 3
```

### Monitoring Dashboard Development
```bash
# Frontend development server (React + Vite)
cd dual-agent-monitor
pnpm install
pnpm run dev  # Runs on http://localhost:6011

# Backend WebSocket server (in separate terminal)
cd dual-agent-monitor/server
pnpm run dev  # Runs on http://localhost:4001
```

### Testing Checklist

#### Single-Agent Mode (Legacy)
1. **Basic Functionality**: `acc run "create test.txt with hello" -i 1`
   - If acc command not available: `node "../automatic-claude-code/dist/index.js" run "create test.txt with hello" -i 1`
2. **Error Recovery**: Test with intentionally failing tasks
3. **Session Continuity**: Verify `--resume` functionality
4. **Output Parsing**: Check both JSON and text fallback modes
5. **Hook Execution**: Monitor `.claude/hooks/` script triggers

#### Dual-Agent Mode (Enhanced)
1. **Agent Coordination**: `acc run "implement user auth system" --dual-agent -i 5 -v`
   - If acc command not available: `node "../automatic-claude-code/dist/index.js" run "implement user auth system" --dual-agent -i 5 -v`
2. **Manager Planning**: Verify Manager creates proper task breakdown
3. **Worker Execution**: Confirm Worker executes assigned tasks correctly
4. **Quality Gates**: Test Manager's validation of Worker outputs
5. **Error Recovery**: Test how agents handle and recover from failures
6. **Inter-Agent Communication**: Monitor agent message exchange via dashboard
7. **Performance Comparison**: Compare dual vs single agent effectiveness
8. **Complex Workflows**: Test multi-step architecture changes
9. **Concurrent Task Handling**: Verify parallel work item execution
10. **Cross-Validation**: Test Manager reviewing Worker's solutions
11. **Monitoring Integration**: Verify dashboard displays agent activities correctly
12. **Webhook Notifications**: Test Slack/Discord/email integrations
13. **ML Insights**: Validate anomaly detection and predictive analytics
14. **Session Persistence**: Confirm PostgreSQL storage and replay functionality
15. **Mobile Interface**: Test responsive design and PWA features

#### Automated Testing Infrastructure
The system includes comprehensive test suites:
- **Unit Tests**: Component-level testing with Jest/Vitest
- **Integration Tests**: API and database integration testing
- **E2E Tests**: Full workflow testing with Playwright
- **Performance Tests**: Load testing and performance benchmarking
- **CI/CD Pipeline**: Automated testing on GitHub Actions
- **Security Testing**: Dependency scanning and vulnerability assessment

## Recent Updates (Updated: 2024-08-31)

### Latest Changes (2024-08-31)
- **Global Command Installation**: Added `npm link` setup for global `acc` command access
- **Monitoring Port Update**: Changed monitoring UI port from 6007 to 6011
- **ML Service Temporary Disable**: Disabled problematic ML components for stability
- **Enhanced Monitoring Integration**: Added `/api/monitoring` endpoint for dual-agent coordination
- **Improved Cross-Directory Usage**: Streamlined usage from any project directory
- **Stability Improvements**: Fixed initialization errors in monitoring services

### Major Features Added
- **Production Deployment Infrastructure**: Complete Docker, Kubernetes, and Terraform configurations
- **Machine Learning Insights Engine**: Anomaly detection, predictive analytics, optimization recommendations
- **External Integrations**: Comprehensive webhook system with Slack, Discord, and email support
- **Mobile-Responsive Dashboard**: Progressive Web App with offline capabilities
- **Database Integration**: PostgreSQL support with schema management and data persistence
- **Authentication & Authorization**: User management system with role-based permissions
- **Session Replay**: Record and replay complete agent interaction sessions
- **Automated Testing**: CI/CD pipelines with unit, integration, and E2E tests

### Architecture Enhancements
- **Monitoring Backend**: Express + WebSocket server for real-time agent communication
- **React Frontend**: Modern UI with Zustand state management and responsive design
- **Analytics Service**: Performance metrics collection and analysis
- **Security Layer**: SSL/TLS, firewall rules, and security headers
- **Scaling Infrastructure**: Auto-scaling, load balancing, and high availability setup

### Developer Experience Improvements
- **Live Agent Visualization**: Real-time Manager-Worker communication diagrams
- **Performance Analytics**: Detailed metrics on agent effectiveness and coordination
- **Multi-Project Support**: Monitor agent activities across different codebases
- **Quick Setup Guide**: Simplified deployment with QUICK-SETUP.md
- **Comprehensive Documentation**: Production deployment guide (DEPLOYMENT.md)

### Breaking Changes
- **Port Configuration**: Monitoring UI now runs on port 6011 (updated from 6007), API on port 4001
- **Command Installation**: `acc` command now requires `npm link` for global installation
- **Configuration Schema**: Extended config.json with monitoring, database, and webhook settings
- **ML Service**: Machine Learning features temporarily disabled to ensure core functionality
- **Database Requirement**: PostgreSQL recommended for production, in-memory fallback for development

## Important Notes

- **Package Manager**: Project uses pnpm (primary) with npm fallback for WSL compatibility
- **Monitoring Ports**: UI Dashboard (6011), API Server (4001), WebSocket (4001)
- **Database Setup**: PostgreSQL recommended for production, in-memory fallback for development
- **Session Storage**: All sessions persisted to database with replay capabilities
- **Process Spawning**: Uses shell execution for cross-platform compatibility
- **Claude CLI Required**: Must have Claude Code CLI installed and in PATH
- **Webhook Configuration**: External integrations configurable via config.json or dashboard UI