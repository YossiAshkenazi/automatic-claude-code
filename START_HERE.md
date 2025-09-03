# 🚀 Visual Agent Management Platform - Start Here

## One Command Startup

**Windows Users:**
```cmd
start_platform.bat
```

**All Platforms:**
```bash
python start_platform.py
```

## What This Does

The startup script will:
1. ✅ Check prerequisites (Python, Node.js, pnpm, Claude CLI)
2. ✅ Verify port availability 
3. ✅ Start Python backend (agent orchestration)
4. ✅ Start TypeScript API server (dashboard backend)
5. ✅ Start React dashboard (visual interface)
6. ✅ Open your browser to http://localhost:6011
7. ✅ Monitor and restart failed components

## Access URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **Main Dashboard** | http://localhost:6011 | Visual agent management interface |
| **API Health** | http://localhost:4005/health | Backend API status |
| **Python Backend** | ws://localhost:8765 | Agent WebSocket server |

## Quick Health Check

```bash
python platform_health_check.py
```

## Prerequisites

If the startup fails, install these:

### Required
- **Python 3.8+** - [Download](https://python.org/downloads)
- **Node.js 18+** - [Download](https://nodejs.org) 
- **pnpm** - Run `npm install -g pnpm`

### Optional
- **Claude CLI** - Run `npm install -g @anthropic-ai/claude-code`

## Troubleshooting

**"Port already in use":**
- Check running processes: `netstat -an | findstr "6011 8765 4005"`
- Kill conflicting processes or restart computer

**"Prerequisites not met":**
- Install missing software above
- Restart terminal/command prompt
- Try running verification: `python verify_startup.py`

**Platform won't start:**
- Check logs in `platform_startup.log`
- Run health check: `python platform_health_check.py`
- Try manual component startup (see PLATFORM_STARTUP_GUIDE.md)

## Using the Platform

Once running:

1. **Create Agents** - Manager and Worker agents through the web UI
2. **Assign Tasks** - Drag-and-drop task assignment interface  
3. **Monitor Progress** - Real-time agent status and communication
4. **View Workflow** - Visual canvas showing task flows between agents

## Stop the Platform

Press `Ctrl+C` in the terminal where you started it. All components will shut down gracefully.

## More Help

- **Full Guide**: `PLATFORM_STARTUP_GUIDE.md`
- **Project Info**: `CLAUDE.md` and `README.md`
- **Health Check**: `python platform_health_check.py`

---
**Ready to start managing Claude agents visually? Run the startup command above!** 🤖✨