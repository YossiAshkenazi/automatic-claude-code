# Real Agent Integration Documentation

## Overview

This implementation connects the dual-agent monitor UI to actual running Claude Code agent processes, replacing mock data with real-time agent communication and monitoring.

## Architecture

```
┌─────────────────────┐     WebSocket      ┌──────────────────┐
│   React UI (Vite)   │ ◄─────────────────► │  WS Server:8080  │
└─────────────────────┘                     └──────────────────┘
                                                     │
                                            ┌────────┴────────┐
                                            ▼                 ▼
                                    ┌──────────────┐  ┌──────────────┐
                                    │ Manager Agent│  │ Worker Agent │
                                    │   (Opus)     │  │   (Sonnet)   │
                                    └──────────────┘  └──────────────┘
```

## Components

### 1. AgentIntegrationService (`src/services/AgentIntegrationService.ts`)
- Manages agent process lifecycle
- Captures and parses agent output
- Monitors resource usage (CPU, memory)
- Handles inter-agent communication
- Maintains session history

### 2. WebSocket Server (`server/websocket-server.ts`)
- Bridges UI with agent processes
- Broadcasts real-time updates
- Provides REST API fallback
- Manages client connections

### 3. React Integration Hook (`src/hooks/useAgentIntegration.ts`)
- Connects UI to WebSocket server
- Manages session state
- Handles real-time updates
- Provides agent control functions

## Setup Instructions

### Prerequisites
1. Claude Code CLI installed and in PATH
2. Automatic Claude Code (acc) installed
3. Node.js 18+ and pnpm

### Installation

```bash
# Install dependencies
cd dual-agent-monitor
pnpm install

# Build TypeScript files
pnpm run build
```

### Configuration

Create `.env` file:
```env
# WebSocket server port
PORT=8080

# Agent models (optional)
MANAGER_MODEL=opus
WORKER_MODEL=sonnet

# Max iterations per session
MAX_ITERATIONS=10

# Enable verbose logging
VERBOSE=true
```

### Starting the System

#### Option 1: Development Mode
```bash
# Terminal 1: Start WebSocket server
pnpm run server:dev

# Terminal 2: Start React UI
pnpm run client:dev
```

#### Option 2: Production Mode
```bash
# Build everything
pnpm run build

# Start server (includes static UI)
pnpm start
```

#### Option 3: Using Docker
```bash
# Build image
docker build -t dual-agent-monitor .

# Run container
docker run -p 8080:8080 -p 5173:5173 dual-agent-monitor
```

## Usage

### Starting Agents from UI

1. Open UI at http://localhost:5173
2. Click "Start Agents" button
3. Enter task description
4. Configure options:
   - Manager Model (default: opus)
   - Worker Model (default: sonnet)
   - Max Iterations (default: 10)
   - Verbose Mode
5. Click "Start"

### Monitoring Active Session

The UI displays real-time:
- Agent messages and communication
- Task assignments and completions
- Performance metrics (CPU, memory)
- Error reports and debugging info
- Quality gate results

### Managing Sessions

- **View History**: All sessions are saved and can be reviewed
- **Export Data**: Download session data as JSON
- **Stop Agents**: Gracefully terminate running agents
- **Send Messages**: Interact with agents during execution

## API Reference

### WebSocket Messages

#### Client → Server

```typescript
// Start agents
{
  type: 'agents:start',
  task: string,
  options: {
    managerModel?: string,
    workerModel?: string,
    maxIterations?: number,
    verbose?: boolean
  }
}

// Stop agents
{
  type: 'agents:stop'
}

// Get session data
{
  type: 'session:get',
  sessionId: string
}

// Send message to agent
{
  type: 'message:send',
  agent: 'manager' | 'worker',
  message: string
}
```

#### Server → Client

```typescript
// Agent message
{
  type: 'agent:message',
  data: AgentMessage
}

// Metrics update
{
  type: 'metrics:updated',
  data: {
    manager: AgentMetrics,
    worker: AgentMetrics
  }
}

// Task events
{
  type: 'task:assigned' | 'task:completed',
  data: {
    taskId: string,
    agent: 'manager' | 'worker'
  }
}
```

### REST API Endpoints

```bash
# Health check
GET /api/health

# List all sessions
GET /api/sessions

# Get specific session
GET /api/sessions/:id

# Start agents
POST /api/agents/start
Body: { task: string, options: {...} }

# Stop agents
POST /api/agents/stop

# Export session
GET /api/sessions/:id/export
```

## Integration with Existing Code

### Updating EnterpriseApp.tsx

```typescript
import { useAgentIntegration } from './hooks/useAgentIntegration';

function EnterpriseApp() {
  const {
    isConnected,
    sessions,
    currentSession,
    isAgentsRunning,
    startAgents,
    stopAgents
  } = useAgentIntegration();

  // Use real data instead of mock
  return (
    <div>
      {isConnected ? (
        <SessionList sessions={sessions} />
      ) : (
        <ConnectionError onReconnect={reconnect} />
      )}
    </div>
  );
}
```

### Session Store Integration

The integration automatically updates the Zustand store with real session data:

```typescript
// Automatic updates in useAgentIntegration
sessionStore.setSessions(realSessions);
sessionStore.addMessage(agentMessage);
sessionStore.setSelectedSession(currentSessionId);
```

## Debugging

### Enable Verbose Logging

```bash
# Set in .env
VERBOSE=true
DEBUG=agent:*
```

### View Agent Output

```bash
# Monitor agent processes
tail -f .claude-sessions/*.log

# View WebSocket traffic
wscat -c ws://localhost:8080
```

### Common Issues

1. **Agents not starting**
   - Check Claude Code CLI is in PATH
   - Verify acc command works
   - Check file permissions

2. **WebSocket connection failed**
   - Ensure server is running on port 8080
   - Check firewall settings
   - Verify CORS configuration

3. **No output from agents**
   - Enable verbose mode
   - Check agent process logs
   - Verify JSON output mode

## Performance Considerations

- **Message Buffering**: Prevents UI flooding with rapid updates
- **Metric Sampling**: Resource monitoring every 5 seconds
- **Session Limits**: Auto-archive sessions older than 30 days
- **WebSocket Reconnection**: Automatic retry with exponential backoff

## Security

- WebSocket authentication (if needed)
- Input sanitization for agent commands
- Rate limiting for API endpoints
- Secure session storage

## Testing

```bash
# Unit tests
pnpm test

# Integration tests
pnpm test:integration

# E2E tests with real agents
pnpm test:e2e
```

## Deployment

### Production Checklist

- [ ] Configure production environment variables
- [ ] Set up SSL/TLS for WebSocket
- [ ] Configure reverse proxy (nginx/Apache)
- [ ] Set up process manager (PM2/systemd)
- [ ] Configure logging and monitoring
- [ ] Set up backup for session data
- [ ] Configure rate limiting
- [ ] Enable CORS for production domain

### Example PM2 Configuration

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'agent-monitor',
    script: 'dist/server/websocket-server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 8080
    }
  }]
};
```

## Future Enhancements

- [ ] Multi-user support with authentication
- [ ] Agent pool management for parallel tasks
- [ ] Custom agent configurations
- [ ] Integration with CI/CD pipelines
- [ ] Advanced analytics and reporting
- [ ] Plugin system for custom monitors
- [ ] Mobile app for monitoring on-the-go