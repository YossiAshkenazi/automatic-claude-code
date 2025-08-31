# Getting Started with Dual-Agent Development

## Quick Start Guide

### 1. Installation and Setup

Ensure you have the latest version of Automatic Claude Code with dual-agent capabilities:

```bash
# Update to latest version
git pull origin main
pnpm install
pnpm run build

# Verify dual-agent support
acc --version
acc config show | grep dualAgentMode
```

### 2. Your First Dual-Agent Session

Start with a simple but complete task to understand the dual-agent workflow:

```bash
# Enable dual-agent mode for a straightforward task
acc run "create a user authentication system with password hashing and JWT tokens" --dual-agent -i 5 -v
```

**What you'll see:**
- Manager Agent analyzes the request and creates a task plan
- Worker Agent implements each component step by step
- Manager Agent validates each deliverable
- Real-time coordination between agents

### 3. Understanding the Output

During execution, you'll see agent-specific output:

```
🤖 Starting Dual-Agent Session

[Manager] Analyzing request: "create user authentication system"
[Manager] Task breakdown:
  1. User model with validation
  2. Password hashing utilities
  3. JWT token generation/validation
  4. Authentication middleware
  5. Login/logout endpoints

[Manager] Assigning Task 1 to Worker: "Create User model"
[Worker] Implementing user model with email/password fields
[Worker] Task completed: models/User.js created
[Manager] Quality gate: ✅ PASSED (score: 0.85)

[Manager] Assigning Task 2 to Worker: "Implement password hashing"
[Worker] Creating password utilities with bcrypt
[Worker] Task completed: utils/passwordHash.js created
[Manager] Quality gate: ✅ PASSED (score: 0.92)
```

### 4. Monitor Agent Coordination

In a separate terminal, monitor the coordination:

```bash
# View real-time agent status
acc agents --status

# Watch coordination logs
acc agents --logs --tail

# Performance metrics
acc agents --performance
```

## When to Use Each Mode

### Choose Dual-Agent for Complex Tasks

**✅ Perfect Use Cases:**
- Multi-file implementations (authentication systems, API layers)
- Architecture changes (framework migrations, design patterns)
- Full-stack features (user management, payment processing)
- Quality-critical code (security features, data handling)

**Example Commands:**
```bash
# Large feature implementation
acc run "implement complete user management system with RBAC" --dual-agent -i 8

# Architecture refactoring
acc run "refactor to hexagonal architecture with DI container" --dual-agent -i 7

# Framework migration
acc run "migrate Express app to Fastify with performance optimization" --dual-agent -i 6
```

### Use Single-Agent for Simple Tasks

**✅ Best Use Cases:**
- Quick bug fixes
- Single-file modifications
- Documentation updates
- Style/lint fixes

**Example Commands:**
```bash
# Simple fixes
acc run "fix TypeScript compilation errors" -i 3

# Documentation
acc run "update README with new API endpoints" -i 2

# Quick features
acc run "add validation to contact form" -i 3
```

## Configuration Quickstart

### Basic Dual-Agent Configuration

Create or update `~/.automatic-claude-code/config.json`:

```json
{
  "dualAgentMode": {
    "enabled": true,
    "managerModel": "opus",
    "workerModel": "sonnet",
    "coordinationInterval": 3,
    "qualityGateThreshold": 0.8
  },
  "defaultIterations": 8,
  "verbose": true
}
```

### Project-Specific Configuration

For project-specific settings, create `.acc-config.json` in your project root:

```json
{
  "dualAgentMode": {
    "enabled": true,
    "projectSpecificPrompts": {
      "manager": "Follow clean architecture patterns and ensure proper separation of concerns",
      "worker": "Use existing code style and patterns found in src/ directory"
    },
    "qualityGateThreshold": 0.85,
    "maxConcurrentTasks": 2
  }
}
```

## Step-by-Step Tutorial

### Tutorial 1: Building a REST API

Let's build a complete REST API with authentication:

```bash
# Step 1: Initialize project structure
acc run "create Node.js project structure for REST API with src/, tests/, and config/ directories" --dual-agent -i 3

# Step 2: Implement core models
acc run "create User and Product models with Mongoose schemas and validation" --dual-agent -i 4

# Step 3: Build authentication
acc run "implement JWT authentication with login, register, and password reset endpoints" --dual-agent -i 6

# Step 4: Add CRUD operations
acc run "implement full CRUD operations for users and products with proper error handling" --dual-agent -i 5

# Step 5: Add testing
acc run "create comprehensive unit and integration tests with Jest" --dual-agent -i 4
```

### Tutorial 2: Frontend-Backend Integration

```bash
# Backend implementation
acc run "build Express.js API with user authentication, product catalog, and order management" --dual-agent -i 8

# Frontend implementation (separate session)
acc run "create React frontend with authentication, product browsing, and shopping cart functionality" --dual-agent -i 7

# Integration
acc run "integrate React frontend with Express API, handle authentication state, and implement error handling" --dual-agent -i 5
```

## Monitoring and Debugging

### Real-Time Monitoring

Keep these commands handy for monitoring long-running sessions:

```bash
# Agent status dashboard
acc agents --status --refresh 5

# Coordination log streaming
acc agents --logs --tail --filter coordination

# Quality gate monitoring
acc logs --dual-agent --filter quality-gate --tail

# Performance monitoring
acc agents --performance --live
```

### Debugging Failed Sessions

When things go wrong:

```bash
# Review session details
acc session <session-id>

# Check agent communication
acc logs --agent manager --session <session-id>
acc logs --agent worker --session <session-id>

# Analyze quality gate failures
acc logs --coordination --search "quality gate failed"

# View error details
acc logs --dual-agent --filter error --session <session-id>
```

## Best Practices for Beginners

### 1. Start Simple
```bash
# Good first dual-agent task
acc run "implement user login with password validation and session management" --dual-agent -i 4

# Avoid complex tasks initially
# acc run "build entire e-commerce platform" --dual-agent  # Too complex for first attempt
```

### 2. Use Descriptive Task Descriptions
```bash
# ✅ Good: Specific and detailed
acc run "implement user authentication with bcrypt password hashing, JWT tokens, email validation, and error handling" --dual-agent

# ❌ Avoid: Vague and unclear
acc run "add auth" --dual-agent
```

### 3. Monitor Progress Actively
```bash
# Watch coordination in real-time
acc agents --status &
acc run "your task" --dual-agent -v
```

### 4. Understand Quality Gates
Quality gates ensure code quality. If you see failures:
```bash
# Lower threshold for learning
acc run "task" --dual-agent --quality-threshold 0.7

# Review what failed
acc logs --coordination --search "quality gate"
```

### 5. Use Appropriate Iteration Limits
```bash
# Small tasks: 3-4 iterations
acc run "add input validation to form" --dual-agent -i 4

# Medium tasks: 5-7 iterations
acc run "implement user authentication system" --dual-agent -i 6

# Large tasks: 8-12 iterations
acc run "migrate to microservices architecture" --dual-agent -i 10
```

## Common Patterns

### Pattern 1: Incremental Feature Development
```bash
# Phase 1: Models and core logic
acc run "create user model with validation and core authentication functions" --dual-agent -i 4

# Phase 2: API endpoints
acc run "implement authentication API endpoints using existing user model" --dual-agent -i 4

# Phase 3: Integration and testing
acc run "add comprehensive tests and integrate with existing application" --dual-agent -i 3
```

### Pattern 2: Test-Driven Development
```bash
# First: Define interfaces and tests
acc run "create comprehensive test suite for user authentication system including unit and integration tests" --dual-agent -i 4

# Second: Implement to pass tests
acc run "implement user authentication system to pass the existing test suite" --dual-agent -i 5
```

### Pattern 3: Refactoring with Validation
```bash
# Refactor with high quality standards
acc run "refactor authentication module to use dependency injection while maintaining all existing functionality" --dual-agent --quality-threshold 0.9 -i 6
```

## Troubleshooting Quick Reference

### Agent Communication Issues
```bash
# Increase timeouts
acc run "task" --dual-agent --communication-timeout 60000

# Reduce concurrent load
acc run "task" --dual-agent --max-concurrent 1

# Check system resources
acc agents --performance
```

### Quality Gate Failures
```bash
# Temporarily lower threshold
acc run "task" --dual-agent --quality-threshold 0.6

# Review failure details
acc logs --coordination --search "quality gate failed"

# More specific requirements
acc run "implement login with specific validation: email format, 8+ char password, rate limiting" --dual-agent
```

### Performance Issues
```bash
# Use faster models for development
acc run "task" --dual-agent --manager-model sonnet --worker-model sonnet

# Reduce coordination frequency
acc run "task" --dual-agent --coordination-interval 5

# Monitor resource usage
acc monitor --resources --live
```

This getting started guide should help you quickly become productive with the dual-agent system. Start with simple tasks, monitor the coordination, and gradually tackle more complex projects as you become comfortable with the agent workflow.