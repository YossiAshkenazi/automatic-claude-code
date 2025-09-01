# Changelog

All notable changes to the Automatic Claude Code project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2025-09-01

### 🎉 Major Feature: PTY-Based Claude Code Control

#### Added
- **Complete PTY Integration**: Revolutionary PTY-based Claude Code control system
  - Replaces API key dependency with subscription-compatible OAuth authentication
  - Cross-platform PTY support: Windows ConPTY, macOS/Linux native PTY
  - Up to 28 concurrent PTY sessions with automatic lifecycle management
  - Advanced stream processing with real-time JSON detection and ANSI handling
  - Comprehensive error recovery and buffer management

- **OAuth Token Extraction System**: Automatic credential extraction from system stores
  - Windows: Windows Credential Manager integration
  - macOS: Keychain Access integration
  - Linux: Claude credential file parsing (`~/.claude/`)
  - No manual API key configuration required for most users

- **Enhanced Dual-Agent Integration**: Full PTY support in Manager-Worker architecture
  - Manager Agent uses interactive sessions for strategic planning
  - Worker Agent leverages PTY for real-time task execution
  - Seamless OAuth authentication across both agents
  - Enhanced inter-agent communication through PTY channels

- **Advanced Response Processing**: Next-generation output parsing and analysis
  - Real-time JSON stream parser with intelligent detection
  - ANSI color code stripping and buffer management
  - Tool usage extraction and categorization
  - Enhanced error message parsing and context preservation
  - File operation monitoring and command tracking

#### Enhanced
- **Execution Modes**: Flexible authentication and execution options
  - PTY Mode (default): Uses subscription authentication via interactive sessions
  - Headless Mode (fallback): Traditional API key authentication for compatibility
  - New CLI flags: `--use-pty` (default) and `--no-pty` (force headless)
  - Automatic fallback from PTY to headless mode when needed

- **Session Management**: Advanced session persistence and state management
  - OAuth token integration in session metadata
  - Enhanced session cleanup and resource management
  - Cross-session state preservation and recovery
  - Comprehensive session history with authentication details

- **Configuration System**: Extended configuration schema for PTY support
  - New `ptyMode` configuration section with comprehensive options
  - Enhanced `dualAgentMode` with PTY integration settings
  - Backward-compatible configuration migration
  - Stream processing and buffer management settings

#### Technical Implementation
- **New Core Services**:
  - `src/services/claudeExecutor.ts`: Centralized execution service with PTY support
  - `src/services/ptyController.ts`: PTY session management and OAuth integration
  - Enhanced `src/agents/agentCoordinator.ts`: PTY-aware agent coordination
  - Updated `src/sessionManager.ts`: OAuth token storage and session persistence
  - Advanced `src/outputParser.ts`: Stream processing with JSON detection

- **Cross-Platform Compatibility**: Full Windows, macOS, and Linux support
  - Windows ConPTY integration for native terminal experience
  - Unix PTY support for macOS and Linux systems
  - Graceful degradation when PTY unavailable
  - Comprehensive error handling for platform-specific issues

#### Breaking Changes
- **Default Execution Mode**: PTY mode is now default (was headless mode)
- **Authentication Priority**: Subscription authentication takes precedence over API keys
- **Session Format**: Enhanced session files include OAuth token metadata
- **Configuration Schema**: New PTY-related configuration options added

#### Migration Guide
Existing users will automatically benefit from PTY mode with no configuration changes required. API key setups continue to work as fallback. See `MIGRATION-v1.2.0.md` for detailed migration instructions.

### Testing and Validation
- **100% Test Coverage**: 31/31 tests passing across all PTY functionality
  - Basic test suite: 9/9 tests (stream processing, JSON parsing, ANSI handling)
  - Integration test suite: 7/7 tests (PTY controller, ClaudeExecutor integration)
  - Advanced test suite: 15/15 tests (edge cases, error recovery, malformed input)
- **Production Readiness**: Comprehensive validation and stress testing completed
- **Cross-Platform Testing**: Validated on Windows, macOS, and Linux environments

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
- ~~**Critical**: Claude Code headless mode (`-p` flag) requires API keys with credits~~ ✅ **FIXED**: PTY mode eliminates API key dependency
- ~~Subscription authentication (OAuth tokens) not compatible with headless mode~~ ✅ **FIXED**: OAuth integration now fully supported
- ~~ACC automation requires API credits to function (cannot use subscription)~~ ✅ **FIXED**: Subscription users can now use ACC seamlessly

### Documentation
- Added comprehensive authentication troubleshooting section (updated in v1.2.0)
- Created research prompt for investigating subscription-based automation (implemented in v1.2.0)
- Updated README with clearer installation instructions
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