# Development Environment - Visual Agent Management Platform

## 🎯 Quick Start

```bash
# One-command setup and start
pnpm run setup:complete
pnpm run dev:platform

# Access the platform
# Dashboard: http://localhost:6011
# Python API: http://localhost:4005
# Hooks Dashboard: http://localhost:6001
```

## 🚀 Development Commands

### Main Development Workflows
| Command | Description | What It Starts |
|---------|-------------|----------------|
| `pnpm run dev:platform` | **Full platform development** | React Dashboard + Python API + Hook System |
| `pnpm run dev:platform:debug` | Full platform with debugging | All components with debug ports enabled |
| `pnpm run dev:platform:clean` | Clean build + full platform | Clean all builds then start platform |

### Individual Component Development
| Component | Command | Port | Debug Port |
|-----------|---------|------|------------|
| React Dashboard | `pnpm run dev:dashboard` | 6011 | 9230 |
| Python API | `pnpm run dev:python` | 4005 | 5678 |
| Hook System | `pnpm run dev:hooks` | 4000, 6001 | - |

### Build & Quality
| Command | Description |
|---------|-------------|
| `pnpm run build:all` | Build all components (CLI, Dashboard, Python) |
| `pnpm run test:all` | Run tests for all components |
| `pnpm run lint:all` | Lint all codebases (TypeScript, Python) |
| `pnpm run typecheck:all` | Type check TypeScript code |

## 🔧 VS Code Integration

### Debug Configurations (Press F5)
- **🚀 Debug Full Platform** - Debug all components simultaneously
- **🎨 Debug Dashboard (Attach)** - Attach to React dev server
- **🐍 Debug Python Orchestrator** - Debug Python with breakpoints
- **🪝 Debug Hook System** - Debug observability system

### Useful Tasks (Ctrl+Shift+P → "Run Task")
- **dev:platform** - Start full development platform
- **build:all** - Build all components
- **test:all** - Run comprehensive test suite

## 🐳 Docker Development

```bash
# Start with Docker (includes PostgreSQL, Redis)
pnpm run docker:dev-platform

# Individual services
docker-compose -f docker-compose.dev.yml up dashboard
docker-compose -f docker-compose.dev.yml up python-orchestrator
```

## 📊 Platform Components

### React Dashboard (Port 6011)
- **Hot Reload**: Instant updates on file changes
- **Debugging**: Node.js inspector on port 9230
- **Proxy**: API calls routed to Python backend
- **Build**: Vite with TypeScript support

### Python Orchestrator (Port 4005)
- **Auto-restart**: uvicorn --reload for instant updates
- **Debugging**: Python debugger on port 5678
- **Health endpoint**: `/health` for monitoring
- **Dependencies**: Isolated in virtual environment

### Hook System (Ports 4000, 6001)
- **Event capture**: Claude CLI hook events
- **Dashboard**: Real-time event monitoring
- **Observability**: System health and metrics
- **Cross-platform**: PowerShell + Bash scripts

## 🔍 Monitoring & Observability

### Access Points
- **Visual Dashboard**: http://localhost:6011 - Main development UI
- **Python API Health**: http://localhost:4005/health - API status
- **Hook Dashboard**: http://localhost:6001 - Real-time events
- **Observability API**: http://localhost:4000 - System metrics

### Log Files
```
logs/dev/
├── react-dashboard.log      # React dev server logs
├── python-orchestrator.log  # Python API logs
├── hook-system.log          # Hook event logs
└── cli.log                  # CLI execution logs
```

## 🔥 Hot Reload Features

### React Dashboard
- **File watching**: `src/**/*`, `public/**/*`
- **Browser refresh**: Automatic on file changes
- **Error overlay**: In-browser error display
- **Source maps**: Full debugging support

### Python API
- **uvicorn --reload**: Auto-restart on `.py` changes
- **Virtual environment**: Isolated dependencies
- **Environment variables**: Automatically configured

### Hook System
- **nodemon**: Restarts on JavaScript changes
- **Real-time events**: Instant hook processing
- **Cross-platform**: Windows PowerShell + Unix bash

## 🧪 Testing Integration

### Run Tests
```bash
pnpm run test:all           # All test suites in parallel
pnpm run test:coverage:all  # With coverage reports
pnpm run test:watch         # Watch mode for development
```

### Component Tests
```bash
pnpm run test               # CLI tests
pnpm run test:dashboard     # React component tests
pnpm run test:python        # Python unit tests
```

## 🚨 Troubleshooting

### Port Conflicts
```bash
# Check what's using ports
netstat -an | findstr "6011 4005 4000 6001"

# Kill processes using ports
tasklist | findstr node
taskkill /PID <process_id> /F
```

### Dependencies Issues
```bash
# Clean and reinstall everything
pnpm run clean:all
pnpm run setup:dev
```

### Python Environment
```bash
# Recreate virtual environment
cd python-sdk
Remove-Item venv -Recurse -Force
python -m venv venv
.\venv\Scripts\activate.ps1
pip install -r requirements.txt -r requirements-dev.txt
```

### Build Problems
```bash
# Force rebuild everything
pnpm run clean:all
pnpm run build:all
```

## ⚡ Performance Tips

### Development Optimizations
- **Parallel execution**: All components start concurrently
- **Incremental builds**: Only changed files rebuild
- **Hot reload**: Instant feedback on changes
- **Source maps**: Fast debugging without performance impact

### Resource Usage
- **Memory monitoring**: Built-in per-component tracking
- **Port management**: Automatic availability checking
- **Process cleanup**: Graceful shutdown on Ctrl+C
- **Health checks**: Continuous component monitoring

## 🎯 Development Workflow

### Typical Development Session
1. **Start platform**: `pnpm run dev:platform`
2. **Open VS Code**: Debug configurations available
3. **Make changes**: Hot reload provides instant feedback
4. **Debug issues**: Use VS Code debugging or browser dev tools
5. **Run tests**: `pnpm run test:all` before committing
6. **Commit changes**: Pre-commit hooks ensure quality

### Code Quality
- **ESLint + Prettier**: Automatic formatting
- **TypeScript**: Compile-time error checking
- **Python black/flake8**: Python code formatting
- **Pre-commit hooks**: Quality gates before commits

---

*This development environment provides a production-like experience with development conveniences, enabling rapid iteration on the Visual Agent Management Platform.*