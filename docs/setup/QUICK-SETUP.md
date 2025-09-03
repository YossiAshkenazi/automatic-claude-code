# Quick Setup Guide - ACC Dual-Agent System

## Installation Options

### Option 1: Native Installation (Recommended)
```bash
cd "C:\Users\Dev\automatic-claude-code"
pnpm install
pnpm run build
npm link  # Makes 'acc' command available globally

# Verify installation
acc examples
```

### Option 2: Docker Installation (Containerized)
```bash
cd "C:\Users\Dev\automatic-claude-code"

# Build Docker image
pnpm run docker:build

# Verify Docker installation
docker run --rm automatic-claude-code

# Create alias for easy Docker usage
echo 'alias acc-docker="docker run -it --rm -v \"$(pwd):/workspace:ro\" -v \"$HOME/.claude:/home/nodejs/.claude:ro\" automatic-claude-code"' >> ~/.bashrc
source ~/.bashrc

# Test Docker setup
acc-docker --help
```

### Step 2: Start Monitoring Server (Multiple Options)

#### Option A: Full Development Monitoring (Feature-Rich)
```bash
cd "C:\Users\Dev\automatic-claude-code\dual-agent-monitor"
pnpm install
pnpm run dev
```
This starts the full monitoring UI at http://localhost:6011

#### Option B: Persistent Monitoring Service (Always Running)
```bash
cd "C:\Users\Dev\automatic-claude-code"

# Start lightweight persistent monitor
pnpm run monitor:start

# Or with PM2 auto-restart
pnpm run monitor:pm2

# Or with PowerShell persistence (Windows)
pnpm run monitor:persistent
```
This starts a lightweight monitor at http://localhost:6007

#### Option C: Docker Compose (Production-Ready)
```bash
# Start all services with Docker
pnpm run docker:dev

# Or production deployment
pnpm run docker:prod
```
This starts all services in containers

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

## Command Examples

### Native Commands (Using ACC)

#### Check Monitoring Status
```bash
acc monitor

# Check persistent monitor status
pnpm run monitor:status
```

#### Simple Task
```bash
acc run "add error handling to API endpoints" --dual-agent -i 3 -v
```

#### Complex Architecture Task
```bash
acc run "implement JWT authentication system" --dual-agent -i 5 --manager-model opus --worker-model sonnet -v
```

#### Single Agent Mode (Legacy)
```bash
acc run "fix TypeScript errors" -i 3 -v
```

#### View Examples
```bash
acc examples
```

### Docker Commands (Using Container)

#### Simple Task with Docker
```bash
acc-docker run "add error handling to API endpoints" --dual-agent -i 3 -v
```

#### Complex Task with Docker
```bash
docker run -it --rm -v "$(pwd):/workspace:ro" -v "$HOME/.claude:/home/nodejs/.claude:ro" automatic-claude-code run "implement JWT authentication system" --dual-agent -i 5 -v
```

#### Docker Compose Development
```bash
# Start development environment
pnpm run docker:dev

# In another terminal, use the running container
docker exec -it automatic-claude-code-app node dist/index.js run "your task" --dual-agent -i 3
```

## Legacy Commands (If ACC Not Available)

### Direct Node.js Usage
```bash
# If npm link didn't work or you prefer direct node usage:
node "../automatic-claude-code/dist/index.js" monitor
node "../automatic-claude-code/dist/index.js" run "task" --dual-agent -i 5 -v
node "../automatic-claude-code/dist/index.js" examples
```

### Docker Alternative Commands
```bash
# If Docker alias not set up:
docker run -it --rm -v "$(pwd):/workspace:ro" -v "$HOME/.claude:/home/nodejs/.claude:ro" automatic-claude-code run "task" --dual-agent -i 5 -v
docker run --rm automatic-claude-code examples

# Access container shell for debugging
pnpm run docker:shell
```

## Key Features

- **Global Command**: Use `acc` from anywhere after `npm link`
- **Docker Support**: Full containerization for isolated execution
- **Cross-Directory**: Run from any folder, ACC auto-detects monitoring server
- **Dual-Agent Mode**: Manager plans, Worker executes, with real-time coordination
- **Multiple Monitoring Options**: 
  - Persistent service (localhost:6007) - Always running
  - Full dashboard (localhost:6011) - Development mode
  - Docker compose - Production ready
- **Service Reliability**: Auto-restart, PM2 integration, crash recovery
- **Model Selection**: Choose opus/sonnet for each agent role
- **Production Ready**: Docker compose with database, monitoring, and backups

## Monitoring URLs

### Development Mode (Full Features)
- **UI Dashboard**: http://localhost:6011
- **API Server**: http://localhost:4001  
- **WebSocket**: ws://localhost:4001
- **Monitoring API**: http://localhost:4001/api/monitoring

### Persistent Mode (Always Running)
- **Persistent Monitor**: http://localhost:6007
- **Health Check**: http://localhost:6007/health
- **Status API**: http://localhost:6007/api/status

### Docker Mode (Production)
- **Frontend**: http://localhost:6011 (mapped from container)
- **Backend**: http://localhost:4001 (mapped from container)
- **Database**: localhost:5432 (PostgreSQL)
- **Redis**: localhost:6379 (Cache)

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

# Or start persistent monitoring service
pnpm run monitor:start

# Check monitor status
pnpm run monitor:status

# Restart with PM2
pnpm run monitor:pm2-restart

# Or disable monitoring if having issues
acc run "task" --no-monitoring
```

### Docker Issues
```bash
# Rebuild Docker image
pnpm run docker:build

# Check container status
docker ps -a

# View Docker logs
pnpm run docker:logs

# Clean Docker resources if needed
pnpm run docker:clean

# Stop all services
pnpm run docker:stop
```

### ML Service Warnings
The ML service is temporarily disabled due to initialization issues. This doesn't affect core dual-agent functionality. You may see warning messages about ML service - these can be safely ignored.

### Port Already in Use
```bash
# Check what's using the ports
lsof -i :6007  # Persistent monitor (macOS/Linux)
lsof -i :6011  # Full dashboard (macOS/Linux)
netstat -ano | findstr :6007  # Persistent monitor (Windows)
netstat -ano | findstr :6011  # Full dashboard (Windows)

# Kill existing processes or use different ports

# For Docker conflicts
docker ps  # Check running containers
docker-compose down  # Stop compose services
```

### Container Issues
```bash
# View container logs
docker logs automatic-claude-code-app

# Access container for debugging
pnpm run docker:shell

# Reset Docker environment
pnpm run docker:clean
pnpm run docker:build
```