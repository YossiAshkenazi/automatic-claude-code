# Visual Agent Management Platform - Development Setup

This guide provides a comprehensive setup for the integrated development environment of the Visual Agent Management Platform, enabling seamless development across React, Python, and Node.js components with hot reload, debugging, and monitoring capabilities.

## 🚀 Quick Start

### One-Command Setup
```bash
# Complete environment setup
pnpm run setup:complete

# Start the full platform
pnpm run dev:platform
```

### Manual Setup
```bash
# 1. Install dependencies
pnpm run setup:dev

# 2. Setup environment
pnpm run setup:env  

# 3. Build all components
pnpm run build:all

# 4. Start development platform
pnpm run dev:platform
```

## 🏗️ Architecture Overview

The development environment supports concurrent development across multiple components:

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEVELOPMENT ORCHESTRATION                    │
│                     (Concurrently + Scripts)                   │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│  🎨 React Dashboard     🐍 Python API        🪝 Hook System    │
│  (Port 6011)           (Port 4005)          (Port 4000/6001)   │
│  • Hot Reload          • Auto-restart       • Event Monitor    │
│  • Debug Port 9230     • Debug Port 5678    • Log Aggregation │
└─────────────────────────────────────────────────────────────────┘
```

## 🛠️ Development Commands

### Integrated Development
| Command | Description | Ports Used |
|---------|-------------|------------|
| `pnpm run dev:platform` | Start full platform with all components | 6011, 4005, 4000, 6001 |
| `pnpm run dev:platform:clean` | Clean build and start platform | All ports |
| `pnpm run dev:platform:debug` | Start with enhanced debugging | All ports + debug ports |

### Component Development
| Command | Description | Port |
|---------|-------------|------|
| `pnpm run dev:dashboard` | React dashboard only | 6011 |
| `pnpm run dev:python` | Python orchestrator only | 4005 |
| `pnpm run dev:hooks` | Hook system only | 4000, 6001 |

### Build & Quality
| Command | Description |
|---------|-------------|
| `pnpm run build:all` | Build all components |
| `pnpm run test:all` | Run tests for all components |
| `pnpm run lint:all` | Lint all codebases |
| `pnpm run typecheck:all` | Type check TypeScript code |

### Debugging
| Command | Description | Debug Port |
|---------|-------------|------------|
| `pnpm run debug:cli` | Debug CLI with breakpoints | 9229 |
| `pnpm run debug:dashboard` | Debug React with inspector | 9230 |
| `pnpm run debug:python` | Debug Python with pdb | 5678 |
| `pnpm run debug:all` | Debug all components | All debug ports |

## 🔧 VS Code Integration

### Debug Configurations
Press `F5` in VS Code to access these debug configurations:

1. **🚀 Debug CLI** - Debug the CLI with breakpoints
2. **🎨 Debug Dashboard (Attach)** - Attach to React development server
3. **🐍 Debug Python Orchestrator** - Debug Python orchestrator
4. **🪝 Debug Hook System** - Debug hook and observability system
5. **🚀 Debug Full Platform** - Debug all components simultaneously

### Useful Tasks
- `Ctrl+Shift+P` → "Run Task" → "dev:platform"
- `Ctrl+Shift+P` → "Run Task" → "build:all"
- `Ctrl+Shift+P` → "Run Task" → "test:all"

## 🐳 Docker Development

### Start with Docker
```bash
# Build and start all services
pnpm run docker:dev-platform

# Individual services
docker-compose -f docker-compose.dev.yml up dashboard
docker-compose -f docker-compose.dev.yml up python-orchestrator
```

### Services Included
- **React Dashboard** with hot reload
- **Python Orchestrator** with auto-restart
- **PostgreSQL** development database
- **Redis** for caching
- **Hook System** with observability

## 📊 Monitoring & Observability

### Real-time Monitoring
- **Visual Dashboard**: http://localhost:6011 - Main UI
- **Python API Health**: http://localhost:4005/health - API status
- **Hook Dashboard**: http://localhost:6001 - Hook events
- **Observability Server**: http://localhost:4000 - System monitoring

### Log Files
Development logs are stored in:
```
logs/dev/
├── react-dashboard.log
├── python-orchestrator.log
├── hook-system.log
└── cli.log
```

## 🔥 Hot Reload Configuration

### React Dashboard
- **File watching**: `src/**/*`, `public/**/*`
- **Auto-refresh**: Browser refreshes on file changes
- **Error overlay**: Shows build errors in browser
- **Source maps**: Full debugging support

### Python Orchestrator
- **uvicorn --reload**: Restarts on `.py` file changes
- **PYTHONPATH**: Automatically configured
- **Virtual environment**: Isolated dependencies

### Hook System
- **nodemon**: Restarts on JavaScript changes
- **File watching**: Hook scripts and monitoring code
- **Real-time events**: Instant hook event processing

## 🚨 Troubleshooting

### Port Conflicts
```bash
# Check port usage
netstat -an | findstr "6011 4005 4000 6001"

# Kill processes using ports
Get-Process -Id (Get-NetTCPConnection -LocalPort 6011).OwningProcess | Stop-Process
```

### Python Environment Issues
```bash
# Recreate virtual environment
cd python-sdk
Remove-Item venv -Recurse -Force
python -m venv venv
.\venv\Scripts\activate.ps1
pip install -r requirements.txt -r requirements-dev.txt
```

### Node.js Module Issues
```bash
# Clean node modules and reinstall
pnpm run clean:all
Remove-Item node_modules -Recurse -Force
Remove-Item dual-agent-monitor/node_modules -Recurse -Force
pnpm install
cd dual-agent-monitor && pnpm install
```

### Build Issues
```bash
# Force rebuild everything
pnpm run clean:all
pnpm run build:all
```

## 🧪 Testing Integration

### Run All Tests
```bash
pnpm run test:all  # Parallel test execution
pnpm run test:coverage:all  # With coverage reports
```

### Individual Test Suites
```bash
pnpm run test  # CLI tests
cd dual-agent-monitor && pnpm run test  # Dashboard tests
cd python-sdk && python -m pytest  # Python tests
```

### Integration Tests
```bash
pnpm run test:integration  # Cross-component tests
pnpm run test:e2e  # End-to-end tests
```

## 🔐 Environment Configuration

### Development Environment Variables
Key variables in `.env.development`:
- `NODE_ENV=development`
- `REACT_APP_API_BASE_URL=http://localhost:4005`
- `PYTHON_ENV=development`
- `HOOKS_ENABLED=true`
- `DEBUG=*` (for verbose logging)

### Component-Specific Configuration
- **React**: `dual-agent-monitor/.env`
- **Python**: Environment variables in PowerShell scripts
- **CLI**: Uses global `.env.development`

## 📈 Performance Optimization

### Development Optimizations
- **Concurrent execution**: All components start in parallel
- **Incremental builds**: Only changed components rebuild
- **Hot reload**: Instant feedback on code changes
- **Source maps**: Fast debugging without performance impact

### Resource Monitoring
The development environment includes:
- Memory usage tracking per component
- Port utilization monitoring
- Process health checks
- Automatic restart on failures

## 🤝 Team Development

### Code Quality
Pre-commit hooks ensure:
- TypeScript compilation
- ESLint/Prettier formatting
- Python black/flake8 formatting
- Test execution before commits

### Workspace Configuration
VS Code workspace settings provide:
- Consistent formatting
- Integrated debugging
- Multi-root project support
- Extension recommendations

## 🎯 Next Steps

After setup, you can:
1. **Start coding**: All components have hot reload
2. **Debug issues**: Use VS Code debug configurations
3. **Test changes**: Comprehensive test suite available
4. **Monitor system**: Real-time observability dashboard
5. **Deploy**: Use Docker for consistent deployment

---

*This development environment provides a production-like experience with development conveniences, enabling rapid iteration on the Visual Agent Management Platform.*