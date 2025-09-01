# Usage Guide - PTY-Enhanced Dual-Agent Development (v1.2.0)

## Getting Started with PTY Dual-Agent Mode

### Quick Start with PTY Authentication

The dual-agent system now features PTY-based Claude Code control with automatic OAuth authentication, eliminating API key requirements for most users:

```bash
# Enable PTY dual-agent mode (default, no API key needed)
acc run "implement user authentication system" --dual-agent -v
# ACC automatically extracts OAuth tokens from your system

# Use specific models with PTY sessions
acc run "migrate to microservices" --manager-model opus --worker-model sonnet --dual-agent

# Monitor PTY-enhanced agent coordination
acc agents --status  # Shows PTY session information
acc logs --pty-sessions --tail  # PTY-specific logs

# Force headless mode if API key is preferred
acc run "simple task" --no-pty --dual-agent -i 3
```

### PTY Mode Benefits

**Enhanced Context & Coordination**:
- ✅ Interactive Claude sessions maintain better context between iterations
- ✅ Real-time JSON stream parsing with ANSI handling
- ✅ Improved error recovery through PTY session management
- ✅ Up to 28 concurrent sessions for complex workflows

**Subscription Authentication**:
- ✅ Works seamlessly with Claude Pro/Team subscriptions
- ✅ Automatic OAuth token extraction (Windows/macOS/Linux)
- ✅ No API key configuration required
- ✅ Fallback to API key mode when needed

## When to Use Each Mode

### 🤖 Choose Dual-Agent Mode For:

**Large-Scale Architecture (Enhanced with PTY)**
```bash
# Microservices implementation with PTY context preservation
acc run "convert monolith to microservices architecture" --dual-agent -i 8 -v

# Clean architecture setup with interactive sessions
acc run "implement clean architecture with DDD patterns" --dual-agent -i 6 -v

# Complex refactoring with enhanced error recovery
acc run "refactor entire codebase to hexagonal architecture" --dual-agent --max-pty-sessions 15 -i 10
```

**Complex Feature Development (PTY-Powered)**
```bash
# Full authentication system with subscription auth
acc run "implement JWT authentication with refresh tokens, role-based access, and password reset" --dual-agent -i 7 -v

# Real-time features with stream processing
acc run "add real-time chat with WebSockets, message persistence, and typing indicators" --dual-agent -i 6 -v

# Advanced features with PTY session management
acc run "build complete e-commerce checkout with payment processing and inventory management" --dual-agent --pty-timeout 600000 -i 12
```

**Framework Migrations (Interactive Sessions)**
```bash
# Major framework change with enhanced context
acc run "migrate React class components to hooks and functional components" --dual-agent -i 8 -v

# Backend framework migration with PTY coordination
acc run "migrate Express.js application to Fastify with performance optimization" --dual-agent -i 6 -v

# Database migration with session persistence
acc run "migrate from MongoDB to PostgreSQL with data transformation" --dual-agent --max-pty-sessions 20 -i 10
```

**Multi-Module Refactoring**
```bash
# Cross-cutting changes
acc run "implement dependency injection across all modules and add IoC container" --dual-agent -i 7

# Database layer refactoring
acc run "migrate from Sequelize to Prisma ORM with schema migration" --dual-agent -i 6
```

### ⚡ Choose Single-Agent Mode For:

**Quick Bug Fixes**
```bash
# Simple bug fixes
acc run "fix memory leak in WebSocket connection handler" -i 3

# Error handling
acc run "add proper error handling to API endpoints" -i 4
```

**Documentation Tasks**
```bash
# Documentation generation
acc run "generate comprehensive API documentation from TypeScript interfaces" -i 2

# README updates
acc run "update README with new installation instructions and examples" -i 2
```

**Simple Refactoring**
```bash
# Code cleanup
acc run "refactor utility functions to use modern JavaScript features" -i 3

# Style fixes
acc run "fix ESLint errors and apply consistent code formatting" -i 2
```

## Command-Line Options

### Basic Usage
```bash
acc run "<task description>" [options]
```

### Core Options
```bash
-i, --iterations <number>     # Maximum iterations (default: 10)
-v, --verbose                 # Show detailed output
-d, --dir <path>             # Working directory
-c, --continue-on-error      # Continue despite errors
```

### Dual-Agent Specific Options
```bash
--dual-agent                     # Enable dual-agent mode
--manager-model <model>          # Model for Manager (default: opus)
--worker-model <model>           # Model for Worker (default: sonnet)
--coordination-interval <n>      # Check interval (default: 3)
--quality-threshold <0-1>        # Quality gate threshold (default: 0.8)
--max-concurrent <number>        # Concurrent tasks (default: 2)
--no-cross-validation           # Disable peer review
```

### Advanced Configuration
```bash
--timeout <minutes>              # Per-iteration timeout
--communication-timeout <ms>     # Agent communication timeout
--retry-attempts <n>            # Error recovery attempts
```

## Practical Examples

### Example 1: E-commerce Platform Development
```bash
acc run "build e-commerce platform with product catalog, shopping cart, checkout, and payment processing" --dual-agent -i 10 -v
```

**Expected Agent Workflow:**
1. **Manager Planning**: 
   - Analyzes requirements
   - Creates project structure plan
   - Defines database schema
   - Plans API endpoints

2. **Worker Execution**:
   - Implements product models
   - Creates database migrations
   - Builds API endpoints
   - Adds payment integration

3. **Manager Validation**:
   - Reviews code quality
   - Tests API functionality
   - Validates security measures
   - Ensures proper error handling

### Example 2: Legacy System Modernization
```bash
acc run "modernize legacy PHP application to Node.js with TypeScript, REST API, and React frontend" --dual-agent --manager-model opus --worker-model sonnet -i 12
```

**Agent Coordination:**
- Manager creates migration strategy
- Worker implements incremental changes
- Manager validates each migration step
- Coordinated testing throughout process

### Example 3: DevOps Pipeline Setup
```bash
acc run "implement CI/CD pipeline with Docker, automated testing, code coverage, and deployment to staging/production" --dual-agent -i 8 --max-concurrent 3
```

**Concurrent Task Management:**
- Parallel development of Docker configs
- Simultaneous CI and CD pipeline setup
- Independent testing framework implementation

## Monitoring Agent Activity

### Real-Time Status Monitoring
```bash
# View current agent status
acc agents --status

# Monitor coordination in real-time
acc agents --logs --tail

# Performance metrics
acc agents --performance
```

### Sample Status Output
```
🤖 Agent Coordination Status

Manager Agent (Opus)
├── Status: Planning next phase
├── Current Task: Code quality review
├── Messages Sent: 15
├── Quality Gates: 8 passed, 1 pending
└── Response Time: 3.2s avg

Worker Agent (Sonnet)  
├── Status: Implementing user service
├── Current Task: JWT token validation
├── Messages Sent: 23
├── Tasks Completed: 6/8
└── Response Time: 1.8s avg

Coordination Metrics
├── Messages Exchanged: 38
├── Average Resolution Time: 45s
├── Quality Gate Success Rate: 94%
└── Overall Progress: 75%
```

### Communication Log Viewing
```bash
# View agent communication
acc logs --coordination

# Filter by agent
acc logs --agent manager
acc logs --agent worker

# Search coordination logs
acc logs --coordination --search "quality gate"
```

## Best Practices

### Task Description Guidelines

**✅ Good Task Descriptions:**
```bash
# Specific and detailed
acc run "implement user authentication with JWT tokens, password hashing using bcrypt, email verification, password reset, and role-based authorization" --dual-agent

# Clear acceptance criteria
acc run "refactor database layer to use repository pattern with TypeORM, include transaction support, error handling, and unit tests with 90% coverage" --dual-agent

# Includes technology preferences
acc run "build REST API using Express.js with TypeScript, implement CRUD operations for users and products, add Swagger documentation, and include integration tests" --dual-agent
```

**❌ Avoid Vague Descriptions:**
```bash
# Too vague
acc run "make the app better" --dual-agent

# Missing details
acc run "add authentication" --dual-agent

# No clear success criteria
acc run "fix the bugs" --dual-agent
```

### Monitoring Best Practices

1. **Regular Status Checks**: Monitor `acc agents --status` during long-running tasks
2. **Quality Gate Reviews**: Ensure Manager validation aligns with your standards
3. **Performance Monitoring**: Watch for communication delays or bottlenecks
4. **Log Analysis**: Review coordination logs for improvement opportunities

### Troubleshooting Common Issues

#### Agent Communication Timeouts
```bash
# Increase timeout
acc run "task" --dual-agent --communication-timeout 60000

# Check system resources
acc agents --performance
```

#### Quality Gate Failures
```bash
# Lower threshold temporarily
acc run "task" --dual-agent --quality-threshold 0.7

# Review specific failures
acc logs --coordination --search "quality gate failed"
```

#### Task Assignment Loops
```bash
# More specific requirements
acc run "implement user login with specific validation rules: email format, password strength, rate limiting" --dual-agent

# Break down complex tasks
acc run "step 1: create user model with validation" --dual-agent -i 3
```

## Configuration Management

### Project-Specific Configuration
Create `.acc-config.json` in your project root:
```json
{
  "dualAgentMode": {
    "enabled": true,
    "managerModel": "opus",
    "workerModel": "sonnet",
    "coordinationInterval": 2,
    "qualityGateThreshold": 0.85,
    "projectSpecificPrompts": {
      "manager": "Focus on clean architecture patterns",
      "worker": "Follow existing code style and patterns"
    }
  },
  "defaultIterations": 8,
  "preferredTools": ["Read", "Write", "Edit", "MultiEdit", "Bash", "Grep"]
}
```

### Environment-Specific Settings
```bash
# Development environment
acc config set dualAgentMode.qualityThreshold 0.7
acc config set dualAgentMode.coordinationInterval 2

# Production environment  
acc config set dualAgentMode.qualityThreshold 0.9
acc config set dualAgentMode.coordinationInterval 4
```

## Advanced Usage Patterns

### Staged Development
```bash
# Phase 1: Architecture and planning
acc run "design and implement data models for e-commerce system" --dual-agent -i 5

# Phase 2: Core functionality
acc run "implement business logic and services based on established data models" --dual-agent -i 6

# Phase 3: API and integration
acc run "create REST API endpoints and integrate with frontend" --dual-agent -i 4
```

### Parallel Development Streams
```bash
# Backend development
acc run "implement backend API with authentication, user management, and data persistence" --dual-agent -i 8 &

# Frontend development (separate terminal)
acc run "build React frontend with authentication, user dashboard, and responsive design" --dual-agent -i 7 &
```

### Quality-Focused Development
```bash
# High-quality standards
acc run "implement payment processing with comprehensive error handling, logging, security measures, and extensive testing" --dual-agent --quality-threshold 0.95 -i 8
```

### Rapid Prototyping
```bash
# Fast iteration with lower quality gates
acc run "create MVP version of social media feed with basic posting and viewing capabilities" --dual-agent --quality-threshold 0.6 --coordination-interval 1 -i 5
```

## Integration with Development Workflow

### Git Integration
```bash
# Automatic commits (recommended)
acc run "implement user profiles" --dual-agent --auto-commit

# Manual review before commits
acc run "implement user profiles" --dual-agent --no-auto-commit
```

### CI/CD Integration
```bash
# Run dual-agent in CI environment
export ACC_DUAL_AGENT=true
export ACC_QUALITY_THRESHOLD=0.9
acc run "implement feature based on requirements.md" --dual-agent
```

### Team Collaboration
```bash
# Generate team-readable reports
acc run "refactor authentication module" --dual-agent --generate-report

# Share session for team review
acc session --export html --share
```

This comprehensive usage guide provides the foundation for effectively utilizing the dual-agent system in real-world development scenarios.