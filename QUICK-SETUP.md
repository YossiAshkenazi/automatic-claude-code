# Quick Setup Guide - ACC Dual-Agent System

## Use ACC from Any Project Directory

### Step 1: Start Monitoring Server
In one terminal:
```bash
cd "C:\Users\Dev\automatic-claude-code\dual-agent-monitor"
pnpm run dev
```
This starts the monitoring UI at http://localhost:6007

### Step 2: Run ACC from Your Project
In another terminal, from ANY project directory:
```bash
cd "C:\Users\Dev\your-project-directory"
node "../automatic-claude-code/dist/index.js" run "your task" --dual-agent -i 5 -v
```

### Step 3: Monitor Agent Coordination
- Open http://localhost:6007 in your browser
- Watch Manager→Worker handoffs in real-time
- View agent communication logs and metrics

## Command Examples

### Check Monitoring Status
```bash
node "../automatic-claude-code/dist/index.js" monitor
```

### Simple Task
```bash
node "../automatic-claude-code/dist/index.js" run "add error handling to API endpoints" --dual-agent -i 3 -v
```

### Complex Architecture Task
```bash
node "../automatic-claude-code/dist/index.js" run "implement JWT authentication system" --dual-agent -i 5 --manager-model opus --worker-model sonnet -v
```

### Single Agent Mode (Legacy)
```bash
node "../automatic-claude-code/dist/index.js" run "fix TypeScript errors" -i 3 -v
```

### View Examples
```bash
node "../automatic-claude-code/dist/index.js" examples
```

## Key Features

- **Cross-Directory**: Run from any folder, ACC auto-detects monitoring server
- **Dual-Agent Mode**: Manager plans, Worker executes, with real-time coordination
- **Monitoring UI**: Live dashboard showing agent handoffs and communication
- **Auto-Server**: Monitoring server starts automatically if not running
- **Model Selection**: Choose opus/sonnet for each agent role

## Monitoring URLs

- **UI Dashboard**: http://localhost:6007
- **API Server**: http://localhost:4001  
- **WebSocket**: ws://localhost:4001

## Troubleshooting

If server isn't found:
```bash
node "../automatic-claude-code/dist/index.js" monitor --start
```

If monitoring disabled:
```bash
node "../automatic-claude-code/dist/index.js" run "task" --no-monitoring
```