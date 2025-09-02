# PTY-Enhanced Dual-Agent Documentation Suite (v1.2.0)

Welcome to the comprehensive documentation for the Automatic Claude Code PTY-enhanced dual-agent system. This directory contains detailed guides for understanding, using, and extending the revolutionary PTY-based dual-agent architecture with subscription authentication support.

## 📚 Documentation Overview

### 🚀 [Getting Started Guide](getting-started.md)
**Perfect for newcomers to PTY-enhanced dual-agent development**
- Quick setup with PTY authentication and OAuth token extraction
- First PTY dual-agent session with subscription support
- When to use PTY vs headless modes
- Step-by-step tutorials with interactive sessions
- Best practices for PTY session management
- Common patterns and PTY-specific troubleshooting

### 🐳 [Docker Deployment Guide](./setup/DOCKER.md) **(NEW)**
**Complete containerization and deployment guide**
- Docker image building and configuration
- Development environment setup
- Production deployment with Docker Compose
- Container monitoring and health checks
- Data persistence and backup strategies
- Troubleshooting containerized deployments

### 🏗️ [PTY-Enhanced Dual-Agent Architecture](dual-agent-architecture.md)
**Deep dive into the PTY-enhanced system design**
- PTY-powered Manager-Worker agent coordination
- Interactive session management and OAuth integration
- Real-time stream processing and communication protocols
- Enhanced workflow phases with session persistence
- Advanced error recovery through PTY session management
- PTY configuration and OAuth customization options

### 📖 [Usage Guide](usage-guide.md)
**Comprehensive usage patterns and examples**
- Detailed command-line options
- Real-world development examples
- Monitoring and debugging techniques
- Performance optimization strategies
- Advanced usage patterns
- Team collaboration workflows

### 🔌 [API Documentation](api-documentation.md)
**Technical reference for developers (PTY-Enhanced)**
- PTY-enhanced agent communication interfaces
- OAuth token management APIs
- PTY session lifecycle management
- Enhanced WebSocket event schemas with stream data
- PTY-aware hook integration APIs
- Custom PTY event types and stream processing

### 🎯 [PTY Technical Guide](pty-technical-guide.md) **(NEW)**
**Advanced PTY implementation details**
- PTY controller architecture and cross-platform support
- OAuth token extraction mechanisms (Windows/macOS/Linux)
- Advanced stream processing and JSON detection
- Session pool management and resource optimization
- Performance tuning and monitoring for PTY sessions
- Security considerations and token management

### 🔧 [Troubleshooting Guide](troubleshooting.md)
**Solutions for common issues (Updated for v1.2.0)**
- PTY authentication and OAuth token extraction issues
- PTY session management and resource problems
- Agent communication through PTY channels
- Performance optimization for PTY sessions
- Stream processing and JSON parsing issues
- Advanced debug tools and PTY-specific recovery procedures

## 🎯 Quick Navigation

### For Beginners (PTY Mode)
1. Start with [Getting Started Guide](getting-started.md) - includes PTY setup
2. Try the PTY dual-agent tutorial examples
3. Read PTY-specific best practices section
4. Refer to [Troubleshooting Guide](troubleshooting.md) for OAuth and PTY issues

### For Advanced Users
1. Review [PTY-Enhanced Dual-Agent Architecture](dual-agent-architecture.md)
2. Study [PTY Technical Guide](pty-technical-guide.md) for implementation details
3. Explore advanced PTY patterns in [Usage Guide](usage-guide.md)
4. Integrate with [API Documentation](api-documentation.md)
5. Optimize PTY performance using [Troubleshooting Guide](troubleshooting.md)

### For Developers
1. Study [PTY Technical Guide](pty-technical-guide.md) for deep implementation understanding
2. Review [API Documentation](api-documentation.md) for PTY-enhanced interfaces
3. Understand PTY architecture in [Dual-Agent Architecture](dual-agent-architecture.md)
4. Implement custom PTY solutions with OAuth integration
5. Contribute improvements to PTY functionality and documentation

## 🚀 Key Features Covered

### PTY-Enhanced Dual-Agent Capabilities
- **PTY Manager Agent**: Interactive strategic planning with enhanced context preservation
- **PTY Worker Agent**: Real-time implementation through interactive Claude sessions
- **OAuth Authentication**: Seamless subscription support without API key requirements
- **Stream-based Coordination**: Real-time communication through JSON stream processing
- **Enhanced Quality Gates**: Improved validation with interactive session feedback
- **Advanced Error Recovery**: PTY session recovery and intelligent failure handling

### Advanced PTY Features
- **Interactive Session Management**: Up to 28 concurrent PTY sessions with automatic lifecycle management
- **Cross-platform OAuth**: Automatic token extraction from Windows Credential Manager, macOS Keychain, Linux credential files
- **Real-time Stream Processing**: Advanced JSON detection with ANSI handling and buffer management
- **Enhanced Performance**: Better context preservation and reduced API rate limiting
- **PTY-aware Monitoring**: Live PTY session status and OAuth authentication tracking
- **Flexible Execution Modes**: PTY mode (default) with automatic fallback to headless mode
- **Cross-platform PTY Support**: Windows ConPTY, macOS/Linux native PTY implementations
- **Container Support**: Full Docker containerization with PTY session support
- **Security Enhancements**: Secure OAuth token management and session isolation

### Development Workflows
- **Incremental Development**: Step-by-step feature implementation
- **Architecture Refactoring**: Large-scale code transformations
- **Framework Migrations**: Coordinated technology transitions
- **Quality Assurance**: Automated testing and validation
- **Team Collaboration**: Shared sessions and progress tracking
- **Containerized Development**: Docker-based isolated development environments
- **Production Deployment**: Docker Compose with database persistence and monitoring
- **Multi-Environment Support**: Native, Docker, and cloud deployment options

## 📋 Documentation Standards

### Code Examples
All code examples in the documentation follow these conventions:
- **Bash commands** for CLI interactions
- **JSON schemas** for API specifications
- **TypeScript interfaces** for type definitions
- **PowerShell/Bash** for hook scripts
- **Markdown tables** for structured information

### Cross-References
Documents are extensively cross-referenced:
- Related sections linked within documents
- External tool documentation referenced
- API endpoints connected to usage examples
- Troubleshooting linked to relevant features

### Versioning
Documentation is maintained alongside code versions:
- Features documented as they're implemented
- Breaking changes highlighted in migration sections
- Backward compatibility notes included
- Future enhancement roadmaps provided

## 🔄 Updates and Maintenance

### Recent Documentation Updates (v1.2.0)
- ✅ **PTY-Enhanced Dual-Agent Architecture** (MAJOR UPDATE)
- ✅ **PTY Technical Guide** - comprehensive implementation details (NEW)
- ✅ **OAuth Authentication Guide** - cross-platform token extraction (NEW)
- ✅ **Stream Processing Documentation** - JSON detection and ANSI handling (NEW)
- ✅ **Migration Guide v1.2.0** - comprehensive upgrade path (NEW)
- ✅ **Enhanced Troubleshooting** - PTY and OAuth-specific solutions (UPDATED)
- ✅ **Getting Started Guide** - PTY mode tutorials and examples (UPDATED)
- ✅ **Usage Guide** - PTY command options and advanced patterns (UPDATED)
- ✅ Enhanced hook system documentation  
- ✅ Real-time monitoring with PTY session tracking (UPDATED)
- ✅ Complete API reference with PTY interfaces (UPDATED)
- ✅ Docker deployment guide with PTY support (UPDATED)

### Planned Documentation Enhancements
- 🚧 Interactive PTY tutorials with embedded OAuth examples
- 🚧 Video walkthroughs for PTY session management
- 🚧 Community-contributed PTY patterns and advanced configurations
- 🚧 Integration guides for PTY mode in CI/CD pipelines
- 🚧 PTY performance tuning and optimization cookbook
- 🚧 Advanced OAuth provider integration guides
- 🚧 PTY session debugging and monitoring best practices

## 🤝 Contributing to Documentation

### How to Contribute
1. **Identify gaps**: Areas lacking sufficient documentation
2. **Submit improvements**: Enhanced examples, clarifications, corrections
3. **Add patterns**: New usage patterns and best practices
4. **Update references**: Keep external links and versions current

### Documentation Guidelines
- **Clear examples**: Practical, tested code examples
- **Consistent formatting**: Follow established markdown conventions
- **Comprehensive coverage**: Address both basic and advanced use cases
- **Regular updates**: Keep pace with feature development

### Getting Help
- **GitHub Issues**: Report documentation bugs or gaps
- **Community Discord**: Discuss complex usage patterns
- **Email Support**: Direct questions to maintainers
- **Stack Overflow**: Community-driven Q&A

## 🎓 Learning Path

### Beginner Path
1. **Setup**: Install and configure dual-agent system
2. **First Session**: Complete a simple dual-agent task
3. **Understanding**: Learn agent roles and coordination
4. **Practice**: Try increasingly complex examples
5. **Mastery**: Implement custom workflows

### Advanced Path
1. **Architecture**: Deep understanding of system design
2. **Optimization**: Performance tuning and monitoring
3. **Integration**: API usage and custom extensions
4. **Troubleshooting**: Debug complex coordination issues
5. **Contribution**: Enhance system and documentation

### Developer Path
1. **API Mastery**: Complete understanding of all interfaces
2. **Hook Development**: Custom event handlers and extensions
3. **System Integration**: Embed dual-agent in larger systems
4. **Performance Analysis**: Optimize coordination algorithms
5. **Feature Development**: Contribute new capabilities

This documentation suite provides everything needed to effectively use and extend the dual-agent system, from first steps to advanced customization.