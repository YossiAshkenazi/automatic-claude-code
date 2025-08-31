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

### Development Mode

```bash
# Install dependencies
npm install

# Start development servers (frontend + backend)
npm run dev
```

This will start:
- Frontend dev server at http://localhost:6002
- Backend API server at http://localhost:6003
- WebSocket server for real-time updates

### Production Mode

```bash
# Build the application
npm run build

# Start production server
npm start
```

### Docker Deployment

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

### WebSocket Events
- `new_message` - New agent message received
- `session_update` - Session status/data updated
- `system_event` - System events (start, stop, error)
- `performance_update` - Performance metrics update
- `session_list` - Updated list of all sessions

## Integration with Existing System

The monitor integrates with your existing Claude Code observability setup:

### Hook Scripts Integration
The existing PowerShell hook scripts in `.claude/hooks/` automatically send events to the monitor:

```powershell
# Events are sent to http://localhost:4000/events
# Monitor server proxies these to the dual-agent system
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
PORT=6003                    # Backend server port
```

### Frontend Configuration
The frontend connects to:
- Backend API: `/api/*` (proxied to localhost:6003)  
- WebSocket: `/ws` (proxied to ws://localhost:6003)

## Monitoring Integration

### Existing Observability Server
The monitor extends your existing observability infrastructure:
- **Port 4000**: Existing observability server
- **Port 6001**: Current dashboard  
- **Port 6002**: New dual-agent monitor (frontend)
- **Port 6003**: Dual-agent monitor backend

### Event Flow
```
Claude Code Hooks → Observability Server (4000) → Dual-Agent Monitor (6003) → Frontend (6002)
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
npm run test

# Run backend tests  
npm run test:server

# Run E2E tests
npm run test:e2e
```

## Troubleshooting

### WebSocket Connection Issues
- Check that backend is running on port 6003
- Verify firewall settings allow WebSocket connections
- Check browser console for connection errors

### No Sessions Appearing
- Verify hook scripts are sending events to correct endpoint
- Check `.dual-agent-sessions/` directory permissions
- Review server logs for event processing errors

### Performance Issues
- Check session data size (large sessions may be slow to load)
- Consider pagination for session lists with many items
- Monitor WebSocket message frequency

## License

MIT - See LICENSE file for details