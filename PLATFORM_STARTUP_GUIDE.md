# Visual Agent Management Platform - Startup Guide

## 🚀 Quick Start (One Command)

**Windows Users:**
```cmd
start_platform.bat
```

**All Platforms:**
```bash
python start_platform.py
```

That's it! The platform will:
- ✅ Check all prerequisites
- ✅ Start Python backend
- ✅ Start React dashboard  
- ✅ Open browser automatically
- ✅ Monitor and restart failed components

## 📋 Prerequisites

### Required Software
- **Python 3.8+** - [Download](https://python.org/downloads)
- **Node.js 18+** - [Download](https://nodejs.org)
- **pnpm** - Install with `npm install -g pnpm`
- **Claude CLI** - Install with `npm install -g @anthropic-ai/claude-code`

### Quick Environment Setup
```bash
# Install all dependencies
pnpm run setup:complete

# Or manually:
pnpm install                           # Root dependencies
cd dual-agent-monitor && pnpm install # Dashboard dependencies
cd ../python-sdk && pip install -r requirements.txt
```

## 🌐 Access URLs

Once started, access these URLs:

| Component | URL | Description |
|-----------|-----|-------------|
| **Visual Dashboard** | http://localhost:6011 | Main agent management interface |
| **API Health** | http://localhost:4005/health | Backend API status |
| **WebSocket** | ws://localhost:8765 | Real-time communication |
| **Hook Events** | http://localhost:4000/events | Event monitoring (optional) |

## 🔧 Manual Component Control

If you need to start components individually:

### Python Backend
```bash
cd python-sdk
python start_websocket_server.py
```

### React Dashboard
```bash
cd dual-agent-monitor
pnpm run dev
```

### Full Development Mode
```bash
# Start all components in development mode
pnpm run dev:platform
```

## 🏥 Health Monitoring

Check platform health anytime:

```bash
# Quick health check
python platform_health_check.py

# Detailed status
python platform_health_check.py --verbose

# Continuous monitoring
python platform_health_check.py --continuous 5

# JSON output for scripts
python platform_health_check.py --json
```

Example health output:
```
✅ Python Backend/WebSocket Server Port 8765  [HEALTHY]
✅ React Dashboard                 Port 6011  [HEALTHY] 
⚠️  API Server                     Port 4005  [UNHEALTHY]
❌ Hooks Monitoring Server         Port 4000  [DOWN]
```

## 🔥 Troubleshooting

### Common Issues

**"Port already in use" errors:**
```bash
# Check what's using ports
netstat -an | findstr "6011 8765 4005"

# Kill processes on specific port (Windows)
taskkill /F /PID <process-id>

# Or use different ports via environment variables
set WEBSOCKET_PORT=8766
set DASHBOARD_PORT=6012
python start_platform.py
```

**"Prerequisites not met":**
- Install missing software (Python, Node.js, pnpm, Claude CLI)
- Ensure all are in system PATH
- Restart terminal after installations

**"Python backend failed to start":**
```bash
# Check Python dependencies
cd python-sdk
pip install -r requirements.txt

# Test WebSocket server manually
python start_websocket_server.py
```

**"React dashboard failed to start":**
```bash
# Rebuild dependencies
cd dual-agent-monitor
pnpm install
pnpm run build

# Check for port conflicts
pnpm run dev
```

### Component Logs

Logs are automatically created in:
- `platform_startup.log` - Main startup orchestrator
- `python-sdk/logs/websocket_server.log` - Python backend
- Console output for React dashboard

### Recovery Options

**Restart specific component:**
```bash
# The startup system automatically restarts failed components
# Or manually restart individual services
```

**Clean restart:**
```bash
# Stop all platform processes
Ctrl+C

# Clear temporary files
pnpm run clean:all

# Start fresh
python start_platform.py
```

## 🎯 Platform Features

Once running, you can:

### Agent Management
- ➕ **Create Agents**: Manager and Worker agents through visual interface
- ⚙️ **Configure Models**: Choose between Claude models (Opus, Sonnet, Haiku)
- 📊 **Monitor Status**: Real-time agent health and activity tracking

### Task Coordination  
- 📝 **Task Assignment**: Drag-and-drop task assignment between agents
- 🔄 **Workflow Canvas**: Visual representation of task flows
- 💬 **Communication Monitoring**: Real-time agent-to-agent communication

### Real-time Updates
- ⚡ **WebSocket Communication**: <100ms latency for all updates
- 🔄 **Auto-refresh**: Live status updates without page refresh
- 📈 **Performance Metrics**: Task completion times and success rates

## 🛠️ Advanced Configuration

### Environment Variables
```bash
# WebSocket configuration
WEBSOCKET_HOST=localhost
WEBSOCKET_PORT=8765

# Dashboard configuration  
DASHBOARD_PORT=6011
DASHBOARD_HOST=localhost

# API configuration
API_PORT=4005
API_HOST=localhost

# Hooks monitoring (optional)
HOOKS_PORT=4000
HOOKS_ENABLED=true
```

### Docker Deployment
```bash
# Build and run in Docker
pnpm run docker:dev-platform

# Or use production config
pnpm run docker:prod
```

## 📚 Next Steps

1. **Create Your First Agent**
   - Open http://localhost:6011
   - Click "Create Agent" 
   - Choose Manager or Worker role
   - Select Claude model (Sonnet recommended)

2. **Assign a Task**
   - Use the task assignment interface
   - Drag tasks between agents
   - Monitor progress in real-time

3. **Explore the Workflow Canvas**
   - Visual task flow representation
   - Real-time agent communication
   - Task completion tracking

4. **Monitor System Health**
   - Check component status
   - View performance metrics
   - Monitor agent coordination

## 🆘 Support

- **Documentation**: Check `docs/` folder for detailed guides
- **Issues**: Report bugs via GitHub Issues
- **Logs**: Check `platform_startup.log` and component logs
- **Health Check**: Use `python platform_health_check.py`

---

*Happy agent coordinating! 🤖✨*