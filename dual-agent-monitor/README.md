# Dual-Agent Claude Code Monitor

A comprehensive web UI for monitoring and analyzing dual-agent Claude Code system interactions between Manager (Opus) and Worker (Sonnet) agents.

## Features

### 🖥️ Dual-Pane Interface
- **Left Pane**: Manager (Opus) analysis, planning, and instructions
- **Right Pane**: Worker (Sonnet) implementation and progress  
- **Real-time updates** of agent communications via WebSocket

### 📈 Timeline & Session Management
- **Chronological view** of Manager ↔ Worker interactions
- **Session controls**: start, pause, resume, stop
- **Session history browser** with search and filter capabilities
- **Progress indicators** and task completion status

### 🚀 Technical Implementation
- **React + TypeScript** frontend with Tailwind CSS
- **Node.js + Express** backend with WebSocket support
- **Real-time communication** via WebSocket connections
- **Responsive design** for different screen sizes
- **Docker containerization** for easy deployment

### 📊 Advanced Features
- **Syntax highlighting** for code blocks with copy functionality
- **Session replay** capability with timeline scrubbing
- **Export session data** (JSON, logs)
- **Agent performance metrics** with interactive charts
- **Cost tracking** and analysis per session

### 🔗 Integration
- **Hook system integration** with existing observability server
- **Extends observability server** at localhost:4000
- **Serves UI at localhost:6002** (separate from current dashboard)
- **Docker setup** following existing patterns

## Quick Start

### Option 1: Development Mode (Full Features)

```bash
# Install dependencies
pnpm install

# Start development servers (frontend + backend)
pnpm run dev
```

This will start:
- Frontend dev server at http://localhost:6011
- Backend API server at http://localhost:4001
- WebSocket server for real-time updates

### Option 2: Persistent Monitoring Service (Always Running)

```bash
# From main project directory
cd ../

# Start lightweight persistent monitor
pnpm run monitor:start

# Or with PM2 auto-restart
pnpm run monitor:pm2

# Check status
pnpm run monitor:status
```

This will start:
- Lightweight monitoring server at http://localhost:6007
- Basic health and status monitoring
- Auto-restart capabilities
- Lower resource usage

### Option 3: Production Mode

```bash
# Build the application
pnpm run build

# Start production server
pnpm start
```

### Option 4: Docker Deployment

```bash
# From main project directory - Development environment
cd ../
pnpm run docker:dev

# Or production deployment
pnpm run docker:prod

# View logs
pnpm run docker:logs

# Stop services
pnpm run docker:stop
```

#### Legacy Docker Compose (from dual-agent-monitor directory)

```bash
# Build and start with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

## Architecture

### Backend (Node.js + TypeScript)
```
server/
├── index.ts           # Express server + WebSocket handling
├── sessionStore.ts    # Session persistence and management
├── types.ts          # TypeScript interfaces
└── tsconfig.json     # TypeScript configuration
```

### Frontend (React + TypeScript)
```
src/
├── components/       # React components
│   ├── MessagePane.tsx      # Agent message display
│   ├── SessionControls.tsx  # Session management UI
│   ├── Timeline.tsx         # Communication timeline
│   ├── SessionList.tsx      # Session browser
│   └── PerformanceMetrics.tsx # Charts and analytics
├── hooks/           # Custom React hooks
├── types/           # TypeScript interfaces  
├── utils/           # Utilities and API client
├── App.tsx         # Main application component
└── main.tsx        # React app entry point
```

## API Endpoints

### REST API
- `GET /sessions` - List all sessions
- `GET /sessions/active` - Get active sessions
- `GET /sessions/:id` - Get specific session
- `POST /sessions` - Create new session
- `PATCH /sessions/:id/status` - Update session status
- `DELETE /sessions/:id` - Delete session
- `POST /sessions/:id/messages` - Add message to session
- `POST /events` - Receive events from observability hooks
- `POST /api/monitoring` - **NEW**: External monitoring endpoint for dual-agent coordination

### WebSocket Events
- `new_message` - New agent message received
- `session_update` - Session status/data updated
- `system_event` - System events (start, stop, error)
- `performance_update` - Performance metrics update
- `session_list` - Updated list of all sessions

## Integration with Existing System

The monitor integrates with your existing Claude Code observability setup:

### Integration with Automatic Claude Code

The monitoring system integrates directly with the dual-agent coordinator:

```typescript
// Events are automatically sent to http://localhost:4001/api/monitoring
// From AgentCoordinator.emitCoordinationEvent() method
monitoringManager.sendMonitoringData({
  agentType: 'manager' | 'worker',
  messageType: 'coordination_event',
  message: eventData,
  metadata: { /* coordination details */ }
});
```

### Session Data Storage
Sessions are stored in `.dual-agent-sessions/` directory:
```
.dual-agent-sessions/
├── session-abc123.json
├── session-def456.json
└── ...
```

Each session file contains:
- Session metadata (ID, start time, status, task)
- All agent messages with timestamps
- Performance metrics and cost tracking
- File modifications and commands executed

## Usage Examples

### Starting a New Session
1. Click "New Session" in the top right
2. Enter initial task description
3. Monitor Manager and Worker communications in real-time

### Viewing Session History
1. Click "Sessions" view mode
2. Browse previous sessions with filtering
3. Click any session to view details

### Analyzing Performance
1. Select a session
2. Switch to "Metrics" view mode  
3. View charts for response times, costs, success rates

### Timeline Analysis
1. Select a session
2. Switch to "Timeline" view mode
3. See chronological agent interactions with communication patterns

### Exporting Data
1. Open any session
2. Click "Export" button in session controls
3. Download complete session data as JSON

## Configuration

### Environment Variables
```bash
NODE_ENV=development|production
PORT=4001                    # Backend server port (API + WebSocket)
FRONTEND_PORT=6011          # Frontend development server port
```

### Frontend Configuration
The frontend connects to:
- Backend API: `/api/*` (proxied to localhost:4001)  
- WebSocket: `/ws` (proxied to ws://localhost:4001)

## Monitoring Integration

### Current Port Configuration
The monitoring system supports multiple port configurations:

#### Full Development Mode
- **Port 4001**: Dual-agent monitor backend (API + WebSocket)
- **Port 6011**: Dual-agent monitor frontend (development)

#### Persistent Monitoring Mode
- **Port 6007**: Lightweight persistent monitor (basic dashboard + API)

#### Docker Mode
- **Port 4001**: Backend API (mapped from container)
- **Port 6011**: Frontend (mapped from container)
- **Port 5432**: PostgreSQL database (mapped from container)
- **Port 6379**: Redis cache (mapped from container)

### Event Flow
```
Automatic Claude Code → AgentCoordinator → Monitoring Manager → /api/monitoring (4001) → Frontend (6011)
```

## Development

### Adding New Features

#### New Message Type
1. Add type to `server/types.ts` and `src/types/index.ts`
2. Update `MessagePane.tsx` to handle the new type
3. Add icon and styling in `getMessageIcon()`

#### New Chart/Metric
1. Add data processing in `PerformanceMetrics.tsx`
2. Create new chart component using Recharts
3. Update the metrics grid layout

#### New View Mode
1. Add mode to `ViewMode` type in `App.tsx`
2. Create new component in `src/components/`
3. Add navigation button in header
4. Handle routing in main content area

### Testing

```bash
# Run frontend tests
pnpm run test

# Run backend tests  
pnpm run test:server

# Run E2E tests
pnpm run test:e2e
```

## Troubleshooting

### WebSocket Connection Issues
- Check that backend is running on port 4001
- Verify firewall settings allow WebSocket connections
- Check browser console for connection errors
- Ensure no other services are using port 4001

### No Sessions Appearing
- Verify automatic-claude-code is sending events to `/api/monitoring`
- Check that dual-agent mode is enabled (`--dual-agent` flag)
- Review server logs for event processing errors
- Ensure monitoring integration is not disabled

### Performance Issues
- Check session data size (large sessions may be slow to load)
- Consider pagination for session lists with many items
- Monitor WebSocket message frequency

## License

MIT - See LICENSE file for details