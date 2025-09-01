# Troubleshooting Guide - Dual-Agent System

## Common Issues and Solutions

### Authentication Issues (Critical)

#### Symptom: "Credit balance is too low" Error
```
Credit balance is too low
❌ Error in iteration 1: Error: Claude Code exited with code 1
```

**Root Cause:**
ACC uses Claude Code's headless mode (`-p` flag) which **requires API keys with credits**. Subscription authentication (OAuth tokens from `claude setup-token`) does not work with headless mode.

**Current Status:** 
⚠️ **This is a fundamental limitation** - Claude Code's headless mode only supports API key authentication, not subscription authentication.

**Solutions:**

1. **Get API Credits (Required for ACC)**
   ```bash
   # Visit https://console.anthropic.com
   # Add credits to your account
   # Generate an API key
   
   # Set the API key
   export ANTHROPIC_API_KEY="sk-ant-..."
   
   # Or on Windows PowerShell:
   $env:ANTHROPIC_API_KEY = "sk-ant-..."
   
   # Make it permanent (Windows):
   [Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY", "sk-ant-...", "User")
   ```

2. **Use Claude Code Interactively (Without ACC)**
   ```bash
   # Works with subscription (no -p flag)
   claude "your task here"
   
   # This won't work with ACC automation
   ```

3. **Future Solutions (Under Investigation)**
   - See `CLAUDE_DESKTOP_RESEARCH_PROMPT.md` for research into alternatives
   - Potential workarounds using pseudo-TTY or process control
   - Waiting for Anthropic to add subscription support to headless mode

#### Symptom: "Invalid API key · Fix external API key"
```
PS C:\Users\Dev> claude "hello world" -p
Invalid API key · Fix external API key
```

**Cause:** 
The `-p` (print/headless) flag requires an API key. Your subscription token won't work here.

**Solution:**
You must use API credits for headless/automated operation. Subscription tokens only work in interactive mode.

#### Symptom: setup-token Fails in PowerShell
```
Error: Raw mode is not supported on the current process.stdin
```

**Solutions:**
1. Try Command Prompt (cmd) instead of PowerShell
2. Use Git Bash if available
3. The token may have been saved despite the error - check if it works

### Agent Communication Problems

#### Symptom: Agent Communication Timeouts
```
ERROR: Agent communication timeout after 30000ms
Manager waiting for Worker response to task assignment
```

**Causes & Solutions:**

1. **System Resource Constraints**
   ```bash
   # Check system resources
   acc agents --performance
   
   # Increase timeout
   acc run "task" --dual-agent --communication-timeout 60000
   
   # Reduce concurrent tasks
   acc run "task" --dual-agent --max-concurrent 1
   ```

2. **Network/Connectivity Issues**
   ```bash
   # Test basic connectivity
   acc agents --status
   
   # Check if Claude CLI is responding
   claude --version
   
   # Restart with verbose logging
   acc run "task" --dual-agent -v --debug
   ```

3. **Model Overload**
   ```bash
   # Switch to faster models temporarily
   acc run "task" --dual-agent --manager-model sonnet --worker-model sonnet
   
   # Reduce coordination frequency
   acc run "task" --dual-agent --coordination-interval 5
   ```

#### Symptom: Agent Messages Not Reaching Target
```
WARNING: Worker message lost - no Manager acknowledgment
Message ID: msg-12345 not processed
```

**Solutions:**
```bash
# Enable message debugging
export ACC_DEBUG_MESSAGES=true
acc run "task" --dual-agent -v

# Check message queue status
acc agents --logs --search "message queue"

# Increase retry attempts
acc config set agentCommunication.retryAttempts 5
```

### Quality Gate Failures

#### Symptom: Repeated Quality Gate Rejections
```
QUALITY_GATE_FAILED: Code quality score 0.65 below threshold 0.8
Manager rejected Worker deliverable for task auth-001
```

**Analysis & Solutions:**

1. **Review Quality Criteria**
   ```bash
   # View specific quality gate results
   acc logs --coordination --search "quality gate"
   
   # Temporarily lower threshold for development
   acc run "task" --dual-agent --quality-threshold 0.6
   
   # Review what specific checks are failing
   acc agents --logs --filter quality-check
   ```

2. **Provide More Context**
   ```bash
   # More specific task description
   acc run "implement user login with input validation, password hashing, error handling, and unit tests with 90% coverage" --dual-agent
   
   # Include examples and requirements
   acc run "refactor authentication following existing patterns in auth/ directory, maintain compatibility with current API" --dual-agent
   ```

3. **Adjust Manager Expectations**
   ```json
   // .acc-config.json
   {
     "dualAgentMode": {
       "qualityGateThreshold": 0.75,
       "projectSpecificPrompts": {
         "manager": "Focus on functional correctness over perfect code style for prototyping phase"
       }
     }
   }
   ```

#### Symptom: Inconsistent Quality Evaluations
```
INFO: Same deliverable approved by Manager on retry with no changes
Inconsistent quality gate results for task auth-002
```

**Solutions:**
```bash
# Enable cross-validation for consistency
acc run "task" --dual-agent --cross-validation

# Use more deterministic quality criteria
acc config set dualAgentMode.enableStrictQualityGates true

# Review Manager prompt engineering
acc agents --config --show-prompts
```

### Task Assignment Issues

#### Symptom: Circular Task Dependencies
```
ERROR: Circular dependency detected in task graph
Task A depends on B, B depends on C, C depends on A
```

**Solutions:**
```bash
# Break down complex tasks more explicitly
acc run "implement user authentication in phases: 1) data models 2) password hashing 3) JWT tokens 4) API endpoints" --dual-agent

# Use sequential execution for dependent tasks
acc run "task" --dual-agent --max-concurrent 1 --sequential

# Review task breakdown with Manager
acc agents --logs --search "task assignment" --filter manager
```

#### Symptom: Worker Overload
```
WARNING: Worker agent has 5 active tasks, consider reducing load
Worker response time increased to 8.5s average
```

**Solutions:**
```bash
# Reduce concurrent tasks
acc run "task" --dual-agent --max-concurrent 2

# Increase coordination interval to give Worker more time
acc run "task" --dual-agent --coordination-interval 5

# Use simpler Worker model for faster processing
acc run "task" --dual-agent --worker-model sonnet
```

### Performance Issues

#### Symptom: Slow Agent Response Times
```
PERFORMANCE: Manager response time: 12.3s (target: <5s)
PERFORMANCE: Worker response time: 8.7s (target: <3s)
```

**Optimization Strategies:**

1. **Model Optimization**
   ```bash
   # Use Sonnet for both agents during development
   acc run "task" --dual-agent --manager-model sonnet --worker-model sonnet
   
   # Only use Opus for complex architectural decisions
   acc run "design system architecture" --dual-agent --manager-model opus --worker-model sonnet
   ```

2. **Coordination Optimization**
   ```bash
   # Reduce coordination frequency
   acc run "task" --dual-agent --coordination-interval 4
   
   # Batch similar tasks
   acc run "implement all CRUD operations for user management" --dual-agent
   ```

3. **Resource Management**
   ```bash
   # Monitor system resources
   acc agents --performance --monitor
   
   # Adjust timeout thresholds
   acc config set dualAgentMode.communicationTimeout 45000
   ```

#### Symptom: High Memory Usage
```
WARNING: Memory usage at 85% capacity during dual-agent session
Consider reducing concurrent operations
```

**Solutions:**
```bash
# Reduce concurrent tasks
acc config set dualAgentMode.maxConcurrentTasks 1

# Shorter session iterations
acc run "task" --dual-agent -i 5 --coordination-interval 2

# Monitor memory usage
acc agents --performance --memory-monitor
```

### Session Management Issues

#### Symptom: Session State Corruption
```
ERROR: Session state mismatch between agents
Manager believes task completed, Worker still in progress
```

**Recovery Steps:**
```bash
# Reset session state
acc session --reset <session-id>

# Resume with state verification
acc run "continue previous task" --dual-agent --verify-state

# Force synchronization
acc agents --sync-state <session-id>
```

#### Symptom: Lost Session Context
```
ERROR: Worker cannot find context for task auth-003
Session context appears corrupted or incomplete
```

**Solutions:**
```bash
# Restore from backup
acc session --restore <session-id> --from-backup

# Restart with fresh context
acc run "continue with full context: $(cat requirements.md)" --dual-agent

# Enable context preservation
acc config set sessionManager.preserveFullContext true
```

## Debugging Tools and Techniques

### Debug Mode Activation
```bash
# Full debug mode
export ACC_DEBUG=true
export ACC_DEBUG_AGENTS=true
export ACC_DEBUG_MESSAGES=true
acc run "task" --dual-agent -v

# Specific component debugging
export ACC_DEBUG_COORDINATION=true
export ACC_DEBUG_QUALITY_GATES=true
acc run "task" --dual-agent
```

### Log Analysis Tools

#### Coordination Log Analysis
```bash
# View coordination timeline
acc logs --coordination --timeline

# Find communication gaps
acc logs --coordination --gaps

# Analyze response times
acc logs --coordination --performance-analysis
```

#### Quality Gate Analysis
```bash
# Quality gate history
acc logs --quality-gates --history

# Failed gate details
acc logs --quality-gates --failures-only

# Quality trends
acc logs --quality-gates --trends --days 7
```

### Advanced Debugging Commands

#### Message Tracing
```bash
# Trace specific message
acc debug --trace-message msg-12345

# Trace task lifecycle
acc debug --trace-task auth-001

# Communication flow diagram
acc debug --communication-flow <session-id>
```

#### State Inspection
```bash
# Current agent states
acc debug --agent-states

# Session state dump
acc debug --session-state <session-id>

# Message queue status
acc debug --message-queue
```

### Performance Monitoring

#### Real-time Monitoring
```bash
# Live performance dashboard
acc monitor --live

# Resource utilization tracking
acc monitor --resources --duration 300

# Agent coordination efficiency
acc monitor --coordination --session <session-id>
```

#### Performance Profiling
```bash
# Profile dual-agent session
acc profile --session <session-id>

# Compare single vs dual agent performance
acc profile --compare single dual --task "implement auth"

# Bottleneck analysis
acc profile --bottlenecks --session <session-id>
```

## Configuration Tuning

### Development Environment
```json
{
  "dualAgentMode": {
    "enabled": true,
    "managerModel": "sonnet",
    "workerModel": "sonnet", 
    "coordinationInterval": 2,
    "qualityGateThreshold": 0.7,
    "maxConcurrentTasks": 1,
    "communicationTimeout": 20000,
    "debug": {
      "enableVerboseLogging": true,
      "logAgentThoughts": true,
      "preserveFailedAttempts": true
    }
  }
}
```

### Production Environment
```json
{
  "dualAgentMode": {
    "enabled": true,
    "managerModel": "opus",
    "workerModel": "sonnet",
    "coordinationInterval": 4,
    "qualityGateThreshold": 0.9,
    "maxConcurrentTasks": 2,
    "communicationTimeout": 45000,
    "reliability": {
      "retryAttempts": 3,
      "enableBackups": true,
      "gracefulDegradation": true
    }
  }
}
```

## Error Recovery Procedures

### Automatic Recovery
```bash
# Enable auto-recovery mode
acc run "task" --dual-agent --auto-recovery

# Configure recovery strategies
acc config set recovery.enableAutoRetry true
acc config set recovery.maxRetryAttempts 3
acc config set recovery.backoffMultiplier 2
```

### Manual Recovery
```bash
# Recover failed session
acc recover --session <session-id>

# Continue from last successful checkpoint
acc resume --session <session-id> --from-checkpoint

# Reset and restart with lessons learned
acc restart --session <session-id> --apply-learnings
```

### Graceful Degradation
```bash
# Fallback to single-agent mode
acc run "task" --fallback-single-agent

# Simplified coordination mode
acc run "task" --dual-agent --simple-coordination

# Emergency mode (minimal overhead)
acc run "task" --dual-agent --emergency-mode
```

## Best Practices for Reliability

### Monitoring and Alerting
```bash
# Set up health checks
acc health-check --interval 60 --alert-email admin@company.com

# Performance thresholds
acc alerts --response-time-threshold 10s
acc alerts --quality-gate-failure-rate 20%

# Resource monitoring
acc monitor --cpu-threshold 80% --memory-threshold 85%
```

### Backup and Recovery
```bash
# Enable automatic backups
acc config set backup.enabled true
acc config set backup.interval 300  # 5 minutes

# Manual backup before complex operations
acc backup --session <session-id> --description "before major refactor"

# Restore from backup
acc restore --backup <backup-id>
```

### Testing and Validation
```bash
# Test dual-agent setup
acc test --dual-agent-connectivity

# Validate configuration
acc validate --config ~/.automatic-claude-code/config.json

# Dry run mode
acc run "task" --dual-agent --dry-run
```

This troubleshooting guide provides comprehensive solutions for the most common issues encountered when using the dual-agent system.