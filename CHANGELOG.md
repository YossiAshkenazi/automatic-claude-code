# Changelog

All notable changes to the Automatic Claude Code project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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