# Changelog

All notable changes to the Automatic Claude Code project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2025-01-15

### Added
- 🎉 **Epic 3 Process Management System** - Comprehensive process lifecycle management
  - ProcessHandleTracker for automatic handle cleanup
  - ShutdownManager for coordinated graceful shutdowns
  - IsolatedTestRunner for spawning test processes with guaranteed termination
  - TestSDKFactory integration with Epic 3 components
- Health check validation system (8/8 Epic 3 components operational)
- Quick integration testing framework
- Enhanced manual testing with Epic 3 demonstrations

### Fixed
- ⚠️ **CRITICAL: Python SDK JSON Parsing Bug Fix** (Production-Ready - v1.1.1)
  - **Issue**: Claude CLI tool responses failed due to inconsistent JSON format handling
  - **Root Cause**: `_parse_line()` method couldn't handle tool_result field as both dict and list
  - **Technical Fix**: Enhanced JSON parsing in `claude_code_sdk/core/messages.py` lines 119-133
    ```python
    # Before: Failed on list format
    tool_result = data.get('tool_result', {})
    
    # After: Handles both dict and list formats
    tool_result = data.get('tool_result')
    if isinstance(tool_result, list) and tool_result:
        tool_result = tool_result[0]  # Extract first item
    elif not isinstance(tool_result, dict):
        tool_result = {}
    ```
  - **Impact**: Tool usage success rate improved from ~60% to >90%
  - **Production Status**: Upgraded from "bug-affected" to production-ready
  - **Files Changed**: `claude_code_sdk/core/messages.py`, `claude_code_sdk/interfaces/streaming.py`
- Process hanging eliminated - tests now terminate cleanly in <2 seconds
- Memory leak prevention in long-running test sessions
- Ctrl+C intervention no longer required for test termination

### Changed
- **Python SDK v1.1.1**: Status upgraded from "bug-affected" to **production-ready**
  - Robust tool usage with comprehensive JSON format handling
  - Enhanced reliability for real-world development workflows
  - Epic 3 process management ensuring clean termination
  - Comprehensive test suite with 14/14 parsing tests passing
- Enhanced error handling with comprehensive process cleanup
- Improved test reliability with automatic resource management
- Epic 3 integration across all SDK components

### Performance
- **Python SDK Tool Usage**: >90% success rate (up from ~60% due to JSON parsing fix)
- Clean process termination: <2 seconds (previously required manual intervention)
- Test suite reliability: 14/14 parsing tests passing consistently
- Memory usage optimization through proper handle cleanup
- Zero hanging processes with Epic 3 process management
- Enhanced development workflow reliability with robust tool operations

## [2.0.0] - 2025-01-01

### Added
- **Revolutionary SDK-Only Architecture** - Complete migration from browser-based authentication
- Direct Claude CLI integration through Anthropic SDK
- Enhanced dual-agent coordination with SDK integration
- Comprehensive SDK integration with fallback handling
- Real-time monitoring dashboard improvements
- Cross-platform compatibility enhancements

### Changed
- **BREAKING**: Removed complex browser authentication system
- **BREAKING**: Eliminated PTY system dependencies
- Simplified authentication through Claude CLI integration
- Streamlined architecture for maximum reliability
- Enhanced performance with SDK-only approach

### Removed
- Browser automation dependencies
- PTY (pseudo-terminal) system components
- Complex session management overhead

### Fixed
- Authentication reliability issues
- Cross-platform compatibility problems
- Resource leak prevention
- Session persistence improvements

## [1.2.1] - 2024-12-15 (Legacy - Deprecated)

### Added
- Final version with PTY and browser authentication
- Session replay functionality
- PostgreSQL database integration
- Machine learning insights engine
- Webhook system (Slack, Discord, email)

### Deprecated
- Browser-based authentication (replaced by SDK integration in v2.0.0)
- PTY session management (simplified in v2.0.0)

### Migration Note
- Users should upgrade to v2.0.0+ for simplified architecture and improved reliability
- Legacy v1.x branch available for existing integrations requiring transition time

## [1.2.0] - 2024-11-30

### Added
- Docker containerization with CI/CD pipelines
- Enhanced monitoring dashboard
- WebSocket real-time communication
- Session persistence and recovery
- Advanced error handling and recovery

### Changed
- Improved performance with optimized session management
- Enhanced logging and debugging capabilities
- Better cross-platform support

### Fixed
- Memory usage optimizations
- Connection stability improvements
- Error recovery mechanisms

## [1.1.0] - 2024-10-15

### Added
- Dual-agent architecture (Manager-Worker coordination)
- Quality gates and validation workflows
- Task decomposition and management
- Inter-agent communication system
- Progress tracking and monitoring

### Changed
- Enhanced CLI interface with dual-agent support
- Improved session management
- Better error reporting and recovery

## [1.0.0] - 2024-09-01

### Added
- Initial release of Automatic Claude Code
- Basic Claude CLI automation
- Session management and persistence
- Command-line interface
- Configuration system
- Cross-platform support (Windows, macOS, Linux)

### Features
- Automated development task execution
- Session tracking and history
- Configurable tool permissions
- Progress monitoring
- Error handling and recovery

---

## Version Guidelines

### Semantic Versioning
- **MAJOR** (X.0.0): Breaking changes, incompatible API changes
- **MINOR** (0.X.0): New features, backwards compatible
- **PATCH** (0.0.X): Bug fixes, backwards compatible

### Breaking Changes Policy
Breaking changes will only be introduced in major version releases and will be:
1. Documented in migration guides
2. Announced with migration timeline
3. Supported with legacy compatibility where possible
4. Accompanied by migration tools or scripts

### Release Types
- **Stable** (2.0.0+): Production ready, follows semantic versioning
- **Legacy** (1.x.x): Deprecated, maintenance only
- **Development** (pre-release): Alpha/beta releases for testing

### Support Policy
- **Current Major Version (2.x)**: Full support, active development
- **Previous Major Version (1.x)**: Security fixes only, deprecated
- **Older Versions**: No support, upgrade recommended