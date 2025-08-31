# Quick Setup Guide - ACC Dual-Agent System

## Installation (First Time Setup)

### Step 1: Install ACC Command
```bash
cd "C:\Users\Dev\automatic-claude-code"
pnpm install
pnpm run build
npm link  # Makes 'acc' command available globally

# Verify installation
acc examples
```

### Step 2: Start Monitoring Server (Optional)
In one terminal:
```bash
cd "C:\Users\Dev\automatic-claude-code\dual-agent-monitor"
pnpm run dev
```
This starts the monitoring UI at http://localhost:6011

### Step 3: Run ACC from Your Project
In another terminal, from ANY project directory:
```bash
cd "C:\Users\Dev\your-project-directory"
acc run "your task" --dual-agent -i 5 -v

# Legacy method (if acc command not available):
# node "../automatic-claude-code/dist/index.js" run "your task" --dual-agent -i 5 -v
```

### Step 4: Monitor Agent Coordination
- Open http://localhost:6011 in your browser
- Watch Manager→Worker handoffs in real-time
- View agent communication logs and metrics

## Command Examples (Using ACC)

### Check Monitoring Status
```bash
acc monitor
```

### Simple Task
```bash
acc run "add error handling to API endpoints" --dual-agent -i 3 -v
```

### Complex Architecture Task
```bash
acc run "implement JWT authentication system" --dual-agent -i 5 --manager-model opus --worker-model sonnet -v
```

### Single Agent Mode (Legacy)
```bash
acc run "fix TypeScript errors" -i 3 -v
```

### View Examples
```bash
acc examples
```

## Legacy Commands (If ACC Not Available)

```bash
# If npm link didn't work or you prefer direct node usage:
node "../automatic-claude-code/dist/index.js" monitor
node "../automatic-claude-code/dist/index.js" run "task" --dual-agent -i 5 -v
node "../automatic-claude-code/dist/index.js" examples
```

## Key Features

- **Global Command**: Use `acc` from anywhere after `npm link`
- **Cross-Directory**: Run from any folder, ACC auto-detects monitoring server
- **Dual-Agent Mode**: Manager plans, Worker executes, with real-time coordination
- **Real-time Monitoring**: Live dashboard at localhost:6011 showing agent handoffs
- **Monitoring Integration**: Built-in API endpoint for external monitoring tools
- **Model Selection**: Choose opus/sonnet for each agent role
- **Stable Core**: ML features temporarily disabled for reliability

## Monitoring URLs

- **UI Dashboard**: http://localhost:6011
- **API Server**: http://localhost:4001  
- **WebSocket**: ws://localhost:4001
- **Monitoring API**: http://localhost:4001/api/monitoring

## Troubleshooting

### ACC Command Not Found
```bash
# Re-run the link command
cd "C:\Users\Dev\automatic-claude-code"
npm link

# Or check if node_modules/.bin is in PATH
echo $PATH | grep node_modules
```

### Monitoring Server Issues
```bash
# Start server manually
acc monitor --start

# Or disable monitoring if having issues
acc run "task" --no-monitoring
```

### ML Service Warnings
The ML service is temporarily disabled due to initialization issues. This doesn't affect core dual-agent functionality. You may see warning messages about ML service - these can be safely ignored.

### Port Already in Use
```bash
# Check what's using the ports
lsof -i :6011  # On macOS/Linux
netstat -ano | findstr :6011  # On Windows

# Kill existing processes or use different ports
```