# Changelog

All notable changes to the Automatic Claude Code project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1] - 2025-09-01

### 🔧 Critical Post-Release Fixes

#### Fixed
- **Documentation Accuracy**: Corrected misleading CHANGELOG.md v1.2.0 content
  - Replaced incorrect "PTY-Based Claude Code Control" description with accurate "Browser SDK Integration"
  - Fixed version mismatches between README.md and actual system status
  - Updated build status table to reflect correct v1.2.0 testing results
  - Ensured all documentation accurately reflects the working Browser SDK system

- **Global Command Reliability**: Enhanced `acc` command installation and usage
  - Improved npm link setup documentation and troubleshooting
  - Enhanced Claude CLI path detection with multiple fallback strategies
  - Fixed cross-platform command resolution issues
  - Added comprehensive error handling for missing dependencies

- **Authentication Flow Improvements**: Streamlined browser authentication process
  - Enhanced browser session detection with `acc browser --check` command
  - Improved error messages for authentication failures with actionable guidance
  - Fixed authentication fallback logic from browser to API mode
  - Added detailed troubleshooting steps for common authentication issues

#### Enhanced
- **User Guidance**: Improved error messages and troubleshooting
  - Added clear instructions for resolving common installation issues
  - Enhanced help documentation with practical examples
  - Improved error reporting with specific next steps
  - Added comprehensive setup verification commands

### Testing and Validation
- ✅ **Documentation Consistency**: All version references now accurate across files
- ✅ **Global Command**: `acc` installation and usage verified working
- ✅ **Authentication Flow**: Browser session detection and fallbacks tested
- ✅ **Error Handling**: Comprehensive error scenarios validated with user guidance

## [1.2.0] - 2025-09-01

### 🎉 Major Feature: Browser SDK Integration

#### Added
- **Browser-Based Authentication**: Revolutionary browser SDK integration with Claude Code
  - Eliminates API key requirements completely for subscription users
  - Direct Claude Pro/Team session integration via browser authentication
  - Cross-browser support: Chrome, Firefox, Safari, Edge compatibility
  - Persistent browser sessions with automatic token refresh
  - Interactive stream processing through browser SDK

- **Global Command Installation**: Enhanced global `acc` command availability
  - Improved `npm link` setup for global access from any directory
  - Multi-strategy Claude CLI path detection system
  - Comprehensive troubleshooting with `acc --help` and `acc examples`
  - Cross-platform command resolution (Windows, macOS, Linux)

- **Enhanced Authentication System**: Comprehensive browser session management
  - Automatic browser session detection with `acc browser --check`
  - Multiple authentication fallback strategies
  - Browser session health monitoring and refresh capabilities
  - Seamless integration with existing Claude Pro/Team subscriptions

- **Improved Dual-Agent Integration**: Browser SDK support in Manager-Worker architecture
  - Manager Agent uses browser sessions for strategic planning
  - Worker Agent leverages browser authentication for task execution
  - Seamless subscription authentication across both agents
  - Enhanced inter-agent communication through browser SDK

- **Advanced Stream Processing**: Real-time browser communication handling
  - Interactive session control through browser automation
  - Enhanced response parsing with browser-specific optimizations
  - Comprehensive error handling for browser disconnections
  - Real-time tool execution feedback through browser streams

#### Enhanced
- **Execution Modes**: Flexible browser-first authentication approach
  - Browser Mode (default): Uses subscription authentication via browser session
  - API Mode (fallback): Traditional API key authentication for compatibility
  - Automatic fallback from browser to API mode when needed
  - Enhanced user guidance for authentication setup

- **Session Management**: Browser session persistence and state management
  - Browser token integration in session metadata
  - Enhanced session cleanup and resource management
  - Cross-session state preservation with browser authentication
  - Comprehensive session history with browser session details

- **Configuration System**: Extended configuration for browser SDK support
  - New `browserAuth` configuration section with comprehensive options
  - Enhanced `dualAgentMode` with browser integration settings
  - Backward-compatible configuration migration
  - Browser session and authentication management settings

#### Technical Implementation
- **Core Service Enhancements**:
  - Enhanced `src/index.ts`: Browser SDK integration and path detection
  - Updated command handling with browser authentication priority
  - Improved error handling for browser session failures
  - Enhanced CLI argument processing for browser modes

- **Cross-Platform Browser Support**: Full Windows, macOS, and Linux compatibility
  - Automatic browser detection and selection
  - Cross-platform browser automation support
  - Graceful degradation when browsers unavailable
  - Comprehensive error handling for platform-specific browser issues

#### Critical Fixes
- **Global Command Installation**: Fixed `acc` command availability
  - Resolved npm link installation issues
  - Enhanced path detection for Claude CLI across platforms
  - Fixed command resolution in various shell environments

- **Authentication Flow**: Comprehensive authentication improvements
  - Fixed browser session detection and validation
  - Enhanced error messages for authentication failures
  - Improved fallback logic from browser to API authentication
  - Added comprehensive troubleshooting guidance

#### Breaking Changes
- **Default Authentication**: Browser authentication is now default (was API key)
- **Command Installation**: Global `acc` command now requires `npm link` setup
- **Session Format**: Enhanced session files include browser session metadata
- **Configuration Schema**: New browser authentication options added

#### Migration Guide
Existing users benefit from browser authentication automatically. API key setups continue to work as fallback. Run `npm link` in the project directory to enable global `acc` command access.

### Testing and Validation
- **✅ Build Verification**: TypeScript compilation successful, all CLI commands functional
- **✅ SDK Integration**: Browser authentication tested and verified working
- **✅ Global Command**: `acc` command installation and usage confirmed operational
- **✅ Dual-Agent System**: Manager-Worker coordination with browser auth verified
- **✅ Monitoring Dashboard**: Real-time WebSocket communication confirmed operational
- **✅ Cross-Platform**: Validated on Windows, macOS, and Linux environments

---

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

### Known Issues (RESOLVED in v1.2.0)
- ~~**Critical**: Claude Code headless mode (`-p` flag) requires API keys with credits~~ ✅ **FIXED**: Browser SDK eliminates API key dependency
- ~~Subscription authentication not compatible with headless mode~~ ✅ **FIXED**: Browser authentication fully supported
- ~~ACC automation requires API credits to function (cannot use subscription)~~ ✅ **FIXED**: Subscription users can now use ACC seamlessly

### Documentation
- Added comprehensive browser authentication troubleshooting section (updated in v1.2.0)
- Created browser SDK integration guide (implemented in v1.2.0)
- Updated README with clearer global command installation instructions
- Added known limitations regarding API key requirements (resolved in v1.2.0)

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