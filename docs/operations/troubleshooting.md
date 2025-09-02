# Troubleshooting Guide - SDK-Based Dual-Agent System

## SDK Integration Issues (v2.0.0)

### Claude CLI Not Found

#### Symptom: "Claude CLI not detected" or "Command 'claude' not found"
```
Error: Claude CLI not found in PATH
SDK initialization failed
Cannot locate @anthropic-ai/claude-code
```

**Root Cause:**
Claude CLI is not installed or not in system PATH.

**Solution:**
1. **Install Claude CLI globally:**
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

2. **Verify installation:**
   ```bash
   claude --version
   which claude  # Unix/Linux/macOS
   where claude  # Windows
   ```

3. **Check PATH if needed:**
   ```bash
   echo $PATH | grep npm  # Should show npm global bin directory
   ```

4. **Test ACC integration:**
   ```bash
   acc --verify-claude-cli
   ```

### SDK Communication Errors

#### Symptom: "SDK execution failed" or "Process spawn failed"
```
Error: spawn claude ENOENT
SDK communication timeout
Process exited with code 1
```

**Root Cause:**
SDK cannot communicate with Claude CLI process.

**Solution:**
1. **Debug SDK communication:**
   ```bash
   DEBUG=sdk:* acc run "test" -i 1 -v
   ```

2. **Test Claude CLI directly:**
   ```bash
   claude run "create a test file" -i 1
   ```

3. **Check system resources:**
   ```bash
   # Monitor resource usage during execution
   top | grep -E "(node|claude)"
   ```

4. **Increase timeout if needed:**
   ```bash
   acc run "task" --sdk-timeout 600000 -i 3
   ```

## Legacy Issues (Pre-v2.0.0)

**Note**: The following issues apply to legacy PTY and browser authentication systems that have been removed in v2.0.0.

## Common Issues and Solutions

### Monitoring Dashboard Issues

#### Symptom: "Network error - please check your connection"
```
Error: Network error - please check your connection
Dashboard shows "Disconnected" status
WebSocket connects but API calls fail
```

**Root Cause:**
Frontend hardcoded to use wrong API port (`http://localhost:4001/api` instead of nginx proxy `/api`).

**Solution:**
This was fixed in v1.1.1. If you encounter this issue:

1. **Verify services are running:**
   ```bash
   # Check containers
   cd dual-agent-monitor && docker-compose ps
   
   # Test API directly
   curl http://localhost:4005/api/health
   
   # Test through nginx proxy
   curl http://localhost:6011/api/health
   ```

2. **Restart services if needed:**
   ```bash
   cd dual-agent-monitor
   docker-compose down
   docker-compose up -d
   ```

3. **Verify dashboard connection:**
   - Open http://localhost:6011
   - Status should show "Connected" 
   - WebSocket Status should show "Connected"
   - No "Connection Lost" error at bottom

**Fixed in v1.1.1**: Frontend now always uses nginx proxy (`/api`) instead of direct port calls.

#### Symptom: Hardcoded Session Counts in Dashboard
```
Sidebar shows "3" sessions regardless of actual session count
Mobile app displays static badge values
Session counts don't update with real-time data
```

**Root Cause:**
Dashboard components contained hardcoded values instead of dynamic data binding.

**Solution:**
This was fixed in v1.1.2. If you encounter this issue with custom deployments:

1. **Verify dynamic data binding:**
   ```bash
   # Check if API returns correct session counts
   curl http://localhost:4005/api/sessions | jq '.length'
   
   # Verify WebSocket updates are received
   # Open browser dev tools → Network → WS tab
   # Should see session count updates in real-time
   ```

2. **Component fixes applied:**
   - Fixed `dual-agent-monitor/src/components/ui/Sidebar.tsx` - now uses dynamic session count
   - Updated `dual-agent-monitor/src/components/mobile/MobileApp.tsx` - real-time calculations
   - Enhanced data consistency across all dashboard components

**Fixed in v1.1.2**: All session counts now use dynamic, real-time data from backend APIs.

### Authentication Issues (v1.2.0 Updates)

#### ✅ RESOLVED: Subscription Authentication Now Supported!

As of **v1.2.0**, ACC fully supports subscription authentication through PTY mode!

```bash
# Now works with Claude Pro/Team subscriptions
acc run "your task" --dual-agent -i 3 -v
# ACC automatically extracts OAuth tokens from your system
```

#### PTY Mode Authentication (Default)

**Benefits**:
- ✅ Works with Claude Pro/Team subscriptions
- ✅ No API key required
- ✅ Automatic OAuth token extraction
- ✅ Enhanced error recovery and context

**Troubleshooting PTY Authentication**:

1. **Verify Claude CLI Setup**:
   ```bash
   # Test basic Claude functionality
   claude --version
   claude "hello world"  # Should work without API key
   
   # If this fails, run:
   claude auth login  # Follow the authentication flow
   ```

2. **Check OAuth Token Extraction**:
   ```bash
   # Run with verbose logging to see token extraction
   acc run "simple task" --use-pty -v
   # Look for "OAuth token extracted" or similar messages
   ```

3. **Platform-Specific Issues**:
   
   **Windows**: Credential Manager access
   ```bash
   # If token extraction fails, try refreshing credentials
   claude auth logout
   claude auth login
   ```
   
   **macOS**: Keychain access
   ```bash
   # Grant keychain access if prompted
   security find-generic-password -s "claude" -a "$USER"
   ```
   
   **Linux**: Credential file access
   ```bash
   # Check credential files exist and are readable
   ls -la ~/.claude/
   cat ~/.claude/credentials  # Should contain token data
   ```

#### Legacy API Key Authentication (Fallback)

For users who prefer API keys or need headless mode:

```bash
# Set up API key authentication
export ANTHROPIC_API_KEY="sk-ant-your-key-here"

# Force headless mode
acc run "task" --no-pty -i 3 -v
```

**When to use API keys**:
- Server environments without interactive sessions
- CI/CD pipelines
- When PTY is unavailable or problematic

#### Symptom: "node-pty not available" Error
```
Error: node-pty module not available. Install with: pnpm add node-pty
```

**Solution**:
```bash
# Install node-pty dependency
pnpm add node-pty

# If installation fails, ensure build tools are available:
# Windows: Visual Studio Build Tools
# macOS: Xcode Command Line Tools  
# Linux: build-essential, python3

# Rebuild the project
pnpm run build
```

#### Symptom: PTY Session Creation Fails
```
ERROR: Failed to create PTY session
Timeout waiting for Claude to initialize
```

**Solutions**:
```bash
# 1. Increase PTY timeout
acc run "task" --pty-timeout 600000 --dual-agent  # 10 minutes

# 2. Reduce concurrent sessions
acc run "task" --max-pty-sessions 5 --dual-agent

# 3. Fall back to headless mode
acc run "task" --no-pty --dual-agent

# 4. Check system resources
acc agents --performance
```

#### Symptom: "Invalid API key" (Legacy Headless Mode)
```
PS C:\Users\Dev> claude "hello world" -p
Invalid API key · Fix external API key
```

**Cause:** 
You're using headless mode (`-p` flag or `--no-pty`) which requires an API key.

**Solutions:**

1. **Use PTY Mode (Recommended)**:
   ```bash
   # Switch to PTY mode (works with subscription)
   acc run "task" --use-pty --dual-agent  # Default behavior
   ```

2. **Set Up API Key for Headless Mode**:
   ```bash
   # Get API key from console.anthropic.com
   export ANTHROPIC_API_KEY="sk-ant-your-key-here"
   acc run "task" --no-pty -i 3
   ```

#### Symptom: OAuth Token Extraction Fails
```
WARNING: Could not extract OAuth token from system credentials
Falling back to headless mode
```

**Solutions:**

1. **Re-authenticate Claude CLI**:
   ```bash
   claude auth logout
   claude auth login
   # Follow the browser-based authentication flow
   ```

2. **Check Platform-Specific Credentials**:
   
   **Windows PowerShell**:
   ```powershell
   # Check if credentials exist in Credential Manager
   cmdkey /list | findstr "claude"
   
   # If setup-token fails in PowerShell, try Command Prompt
   cmd /c "claude auth login"
   ```
   
   **macOS Terminal**:
   ```bash
   # Check keychain access
   security find-generic-password -s "claude"
   
   # Grant access if prompted during authentication
   ```
   
   **Linux Terminal**:
   ```bash
   # Check credential files
   ls -la ~/.claude/
   
   # Re-create credentials if missing
   mkdir -p ~/.claude
   claude auth login
   ```

3. **Manual Token Verification**:
   ```bash
   # Test if authentication is working
   claude "test message"  # Should work without API key
   
   # If this works, ACC should detect the credentials
   acc run "simple task" --use-pty -v
   ```

#### Symptom: Dashboard Component Errors or Crashes
```
Dashboard shows "Something went wrong" error boundaries
Components failing to load or update
UI freezes or becomes unresponsive
```

**Root Cause:**
React component errors that weren't properly handled, causing entire dashboard sections to crash.

**Solution:**
Enhanced error boundary protection was added in v1.1.2:

1. **Error boundaries implemented:**
   ```bash
   # Check browser console for component errors
   # Open DevTools → Console
   # Look for React component error logs
   ```

2. **Component reliability improvements:**
   - Added comprehensive error boundaries throughout dashboard components
   - Enhanced error handling for API data loading failures
   - Improved component state management and consistency
   - Better handling of WebSocket connection state changes

3. **Recovery mechanisms:**
   ```bash
   # If dashboard components are stuck, refresh specific sections
   # Most errors now auto-recover without full page refresh
   
   # For persistent issues, clear browser cache:
   # Ctrl+Shift+Del (Chrome) or Cmd+Shift+Del (Safari)
   ```

**Enhanced in v1.1.2**: Comprehensive error boundary protection prevents component crashes and provides graceful degradation.

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

#### Symptom: WebSocket Connection Instability (Fixed in v1.1.2)
```
WebSocket frequently disconnects and reconnects
"Connection Lost" errors appear intermittently
Real-time updates delayed or missing
```

**Root Cause:**
Insufficient WebSocket error handling and reconnection logic.

**Solution:**
Enhanced WebSocket reliability was implemented in v1.1.2:

1. **Improved connection management:**
   ```bash
   # Check WebSocket connection status in dashboard
   # Status should show "Connected" with green indicator
   # Automatic reconnection should occur within 5 seconds of disconnection
   ```

2. **New reliability features:**
   - **Auto-reconnection logic**: Automatic reconnection with exponential backoff
   - **Heartbeat monitoring**: Regular ping/pong to detect connection issues early
   - **Connection state management**: Better handling of connection lifecycle events
   - **Error recovery**: Graceful handling of network interruptions

3. **Monitoring WebSocket health:**
   ```bash
   # Check WebSocket connection in browser dev tools
   # Network tab → WS → Should show stable connection
   # No frequent disconnects/reconnects
   
   # If issues persist, restart monitoring services:
   cd dual-agent-monitor && docker-compose restart
   ```

**Enhanced in v1.1.2**: WebSocket connections now include comprehensive error handling, auto-reconnection, and heartbeat monitoring for maximum reliability.

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

### PTY-Specific Issues (v1.2.0)

#### Symptom: High PTY Session Memory Usage
```
WARNING: PTY sessions using 1.2GB memory
Consider reducing concurrent sessions
```

**Solutions**:
```bash
# Reduce maximum concurrent PTY sessions
acc run "task" --max-pty-sessions 10 --dual-agent

# Configure in config file
{
  "ptyMode": {
    "maxSessions": 10,
    "sessionTimeout": 180000  # 3 minutes
  }
}

# Monitor PTY resource usage
acc agents --performance --pty-sessions
```

#### Symptom: PTY Session Cleanup Issues
```
ERROR: PTY session cleanup failed
Orphan sessions detected
```

**Solutions**:
```bash
# Force cleanup of all PTY sessions
acc pty --cleanup-all

# Enable automatic cleanup
acc config set ptyMode.autoCleanup true

# Check for orphan sessions
ps aux | grep claude  # Look for zombie processes
killall claude  # If necessary
```

#### Symptom: ANSI Code Rendering Issues
```
Output contains escape sequences: \u001b[32m
Text formatting not properly stripped
```

**Solutions**:
```bash
# Enable ANSI stripping (should be default)
acc config set ptyMode.streamProcessing.stripAnsiCodes true

# Check output parser configuration
acc run "task" --use-pty -v | grep "ANSI"

# For debugging, disable ANSI stripping temporarily
acc config set ptyMode.streamProcessing.stripAnsiCodes false
```

#### Symptom: JSON Stream Parsing Failures
```
WARNING: JSON detection failed in stream
Fallback to text parsing
```

**Solutions**:
```bash
# Enable enhanced JSON detection
acc config set ptyMode.streamProcessing.enableJsonDetection true

# Increase buffer size for complex outputs
acc config set ptyMode.bufferSize 16384

# Debug stream processing
acc run "task" --use-pty --debug-streams -v
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