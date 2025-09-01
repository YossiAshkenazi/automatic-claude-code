# Changelog

All notable changes to the Automatic Claude Code project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.2] - 2025-09-01

### Added
- **Comprehensive Dashboard Enhancements**: Major monitoring interface improvements
  - Built comprehensive test suite with 45+ tests focusing on data consistency
  - Created extensive validation for component functionality and reliability
  - Added production-ready build pipeline with TypeScript safety checks
  - Implemented robust error boundaries throughout dashboard components
- **Enhanced Testing Infrastructure**: 
  - Test scripts for dashboard data consistency validation
  - Comprehensive component and integration testing coverage
  - Production readiness validation and build pipeline testing

### Fixed
- **Critical Data Consistency Issues**: Fixed hardcoded session counts throughout dashboard
  - Fixed `dual-agent-monitor/src/components/ui/Sidebar.tsx` - replaced hardcoded `badge: 3` with dynamic session count
  - Updated `dual-agent-monitor/src/components/mobile/MobileApp.tsx` - replaced hardcoded badge values with real-time calculations
  - All session counts now display dynamic, real-time data from backend
- **Enhanced WebSocket Reliability**: Comprehensive improvements to real-time communication
  - Added comprehensive error handling with auto-reconnection logic
  - Implemented heartbeat monitoring for connection stability
  - Enhanced connection state management and recovery mechanisms
- **Mobile Experience Improvements**: 
  - Fixed responsive design inconsistencies across platforms
  - Enhanced cross-platform data synchronization
  - Improved mobile UI component reliability and performance

### Enhanced
- **Production Infrastructure**: Significant improvements to system reliability
  - Enhanced API connectivity with better state management
  - Improved backend communication reliability
  - Strengthened error handling throughout the monitoring stack
- **Dashboard UI Components**: 
  - Added comprehensive error boundary protection
  - Enhanced real-time data binding and updates
  - Improved component state management and consistency

### Testing
- **Dashboard UI Testing**: Added extensive test coverage for monitoring interface
  - Data consistency validation tests
  - Component functionality and error handling tests  
  - Cross-platform compatibility verification
  - Production build and deployment testing

## [1.1.1] - 2025-09-01

### Fixed
- **Critical**: Fixed dual-agent monitoring dashboard network connection error
  - Frontend was hardcoded to use `http://localhost:4001/api` but API runs on port 4005
  - Changed API_BASE in `dual-agent-monitor/src/utils/api.ts` to always use nginx proxy (`/api`)
  - Dashboard now properly connects to backend through nginx reverse proxy
  - Verified fix using Playwright browser automation
- Monitoring dashboard now displays "Connected" status instead of "Network error"
- WebSocket connections working correctly through nginx proxy
- All monitoring features (sessions, metrics, real-time updates) fully functional

### Infrastructure
- Updated monitoring service configuration to use consistent API endpoints
- Improved frontend-backend communication reliability through proxy architecture
- Enhanced container networking for production deployments

## [1.1.0] - 2025-01-09

### Added
- Global `acc` command installation support via `npm link`
- Authentication troubleshooting documentation
- Research prompt for Claude Desktop integration (`CLAUDE_DESKTOP_RESEARCH_PROMPT.md`)
- Enhanced version management (version now properly displayed in CLI)

### Changed
- Updated version from 1.0.0 to 1.1.0
- Fixed hardcoded version in `src/index.ts` to match package.json
- Improved installation documentation with clearer global command setup

### Fixed
- Version display issue where `acc --version` showed incorrect version
- Fixed version mismatch between package.json and CLI output

### Known Issues
- **Critical**: Claude Code headless mode (`-p` flag) requires API keys with credits
- Subscription authentication (OAuth tokens) not compatible with headless mode
- ACC automation requires API credits to function (cannot use subscription)

### Documentation
- Added comprehensive authentication troubleshooting section
- Created research prompt for investigating subscription-based automation
- Updated README with clearer installation instructions
- Added known limitations regarding API key requirements

## [1.0.0] - 2024-08-31

### Initial Release
- Dual-agent architecture (Manager-Worker coordination)
- Automated Claude Code loop execution
- Session management and persistence
- Real-time monitoring dashboard
- Docker containerization support
- Multiple installation methods
- Comprehensive error handling and recovery
- Quality gates and validation workflows
- Task decomposition and parallel execution
- Cross-platform support (Windows, macOS, Linux)