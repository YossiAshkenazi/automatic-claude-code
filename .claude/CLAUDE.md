# CLAUDE.md - Hook Scripts

## Overview
Working PowerShell hook scripts that send Claude Code events to the observability server.

## Current Status - WORKING! ✅
- **Event transmission**: Successfully sending events to server
- **Project identification**: Extracting project name from path
- **Non-blocking**: 2-second timeout, never blocks Claude Code
- **Dashboard integration**: Events appear in real-time at http://localhost:6001

## Hook Scripts (PowerShell)
Located in `.claude/hooks/` folder:
- `user-prompt-submit-hook.ps1` - Captures user prompts to Claude
- `tool-invocation-hook.ps1` - Captures when Claude uses tools
- `assistant-message-hook.ps1` - Captures Claude's responses

## Configuration
The `settings.local.json` file contains permissions and MCP server configurations.

## How It Works
1. Claude Code triggers hook event with environment variables
2. PowerShell script reads CLAUDE_* environment variables
3. **Enhanced project detection** - Uses multiple fallback methods:
   - First: CLAUDE_PROJECT_PATH parameter
   - Second: Environment variable directly
   - Third: Current working directory with pattern matching
4. Creates JSON payload with project info and event data
5. Sends to http://localhost:4000/events using background job
6. Times out after 2 seconds if server unavailable
7. Always exits with code 0 to never block Claude Code

## Testing Enhanced Hook System

### Individual Hook Testing
```powershell
# Test core hooks
powershell -ExecutionPolicy Bypass -File ".\.claude\hooks\user-prompt-submit-hook.ps1"

# Test dual-agent specific hooks
powershell -ExecutionPolicy Bypass -File ".\.claude\hooks\agent-communication-hook.ps1"
powershell -ExecutionPolicy Bypass -File ".\.claude\hooks\quality-gate-hook.ps1"

# Simulate agent coordination event
$env:CLAUDE_AGENT_TYPE="manager"
$env:CLAUDE_TASK_ID="test-001"
$env:CLAUDE_MESSAGE_TYPE="task_assignment"
powershell -ExecutionPolicy Bypass -File ".\.claude\hooks\agent-coordination-hook.ps1"
```

### Cross-Platform Testing
```bash
# Test Linux/Mac hooks
export CLAUDE_AGENT_TYPE="worker"
export CLAUDE_TASK_ID="test-002"
export CLAUDE_QUALITY_SCORE="0.85"
bash .claude/hooks/quality-gate-hook.sh

# Test coordination tracking
export CLAUDE_COORDINATION_PHASE="execution"
bash .claude/hooks/workflow-transition-hook.sh
```

### System Integration Testing
```bash
# Start dual-agent session with hook monitoring
acc run "test task" --dual-agent -v --enable-hooks

# Monitor hook events in real-time
docker logs observability-server --tail -f

# View enhanced dashboard
open http://localhost:6001

# Test specific coordination scenarios
acc run "implement auth system" --dual-agent --test-coordination
```

## Recent Enhancements ✅
1. **✅ Bash versions added** - Full Linux/Mac compatibility
2. **✅ Dual-agent event capture** - Manager-Worker coordination tracking
3. **✅ Quality gate monitoring** - Validation checkpoint capture
4. **✅ Task coordination tracking** - Inter-agent workflow monitoring
5. **✅ Enhanced dashboard integration** - Real-time dual-agent insights

## Planned Improvements 🚧
1. **Agent performance metrics** - Response times and coordination efficiency
2. **Workflow visualization** - Interactive coordination flow diagrams
3. **Quality trend analysis** - Historical quality gate performance
4. **Predictive coordination** - AI-powered coordination optimization
5. **Custom event types** - User-defined hook events for specific workflows

## Event Schema Examples

### Agent Communication Event
```json
{
  "eventType": "agent_communication",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "agentType": "manager",
  "targetAgent": "worker",
  "messageType": "task_assignment",
  "taskId": "auth-001",
  "coordinationPhase": "assignment",
  "projectPath": "/workspace/my-project",
  "sessionId": "session-123",
  "payload": {
    "task": "Implement password hashing",
    "priority": "high",
    "estimatedComplexity": 3
  }
}
```

### Quality Gate Event
```json
{
  "eventType": "quality_gate_result",
  "timestamp": "2024-01-15T10:35:00.000Z",
  "agentType": "manager",
  "taskId": "auth-001",
  "qualityScore": 0.87,
  "gateType": "code_review",
  "result": "passed",
  "feedback": ["Good error handling", "Tests included"],
  "coordinationPhase": "validation",
  "projectPath": "/workspace/my-project"
}
```

### Workflow Transition Event
```json
{
  "eventType": "workflow_transition",
  "timestamp": "2024-01-15T10:40:00.000Z",
  "fromPhase": "execution",
  "toPhase": "validation",
  "triggeredBy": "worker",
  "workflowState": "progressing",
  "completedTasks": 3,
  "remainingTasks": 2,
  "projectPath": "/workspace/my-project"
}
```

## Important Implementation Notes

### Critical Requirements
- **Non-blocking execution** - Hooks must NEVER block Claude Code
- **Silent failure handling** - All failures must be gracefully handled
- **Zero external dependencies** - Must work with built-in tools only
- **Offline compatibility** - Must work without internet connectivity
- **Cross-platform compatibility** - PowerShell and Bash versions required

### Dual-Agent Specific Requirements
- **Agent context preservation** - Maintain agent identity throughout event chain
- **Coordination state tracking** - Accurate workflow phase monitoring
- **Message correlation** - Link related agent communications
- **Quality gate consistency** - Reliable validation event capture
- **Performance impact** - Minimal overhead on agent coordination

### Security Considerations
- **Sensitive data filtering** - Remove credentials and API keys from events
- **Project path sanitization** - Avoid exposing internal directory structures
- **Agent communication privacy** - Hash or encrypt sensitive coordination data
- **Event payload validation** - Sanitize all event data before transmission

### Best Practices
- **Structured logging** - Use consistent JSON schema across all events
- **Timestamp precision** - Include millisecond precision for coordination analysis
- **Error context** - Capture sufficient context for debugging hook failures
- **Event deduplication** - Prevent duplicate events from agent retries
- **Resource cleanup** - Proper cleanup of temporary files and processes