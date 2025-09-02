# Changelog

All notable changes to the Claude Code Python SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Version management system with semantic versioning
- Automated version bumping scripts
- Migration guides for version upgrades
- Release process documentation
- Breaking changes policy

### Changed
- Preparing for 1.0.0 stable release
- Enhanced SDK metadata and information

## [0.1.0] - 2025-01-15

### Added
- Initial release of Claude Code Python SDK
- Async/await support with context managers
- Streaming and non-streaming execution modes
- Comprehensive error handling and classification
- Integration with dual-agent architecture
- Real-time monitoring and observability
- Cross-platform compatibility (Windows, macOS, Linux)
- Type hints for full IDE support
- Core client (`ClaudeCodeClient`) with options system
- Message handling system with streaming support
- High-level query interfaces (`query`, `query_stream`, `conversation`)
- Integration classes for automatic-claude-code system
- CLI detection utilities
- Performance benchmarking tools

### Features by Module
- **Core**: Client, options, messages system
- **Interfaces**: Simple query functions, streaming handlers
- **Integrations**: AutomaticClaudeIntegration, MonitoringIntegration
- **Exceptions**: Comprehensive error classification
- **Utils**: CLI detection, process management

### Supported Platforms
- Python 3.8+
- Windows, macOS, Linux
- Compatible with Claude Code CLI v1.0+
- Compatible with automatic-claude-code v1.2.0+

### Known Limitations
- No external dependencies (stdlib only)
- Requires Claude CLI to be installed and configured
- Beta stability - API may change before 1.0.0

---

## Version Guidelines

### Semantic Versioning
- **MAJOR** (X.0.0): Breaking changes, incompatible API changes
- **MINOR** (0.X.0): New features, backwards compatible
- **PATCH** (0.0.X): Bug fixes, backwards compatible

### Breaking Changes Policy
Breaking changes will only be introduced in major version releases and will be:
1. Documented in MIGRATION.md
2. Announced with migration timeline
3. Supported with legacy compatibility where possible
4. Accompanied by migration tools or scripts

### Release Types
- **Stable** (1.0.0+): Production ready, follows semantic versioning
- **Beta** (0.x.x): Feature complete, API may change
- **Alpha** (0.0.x): Development releases, expect breaking changes