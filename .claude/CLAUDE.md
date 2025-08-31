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

## Testing Hooks
```powershell
# Test individual hooks
powershell -ExecutionPolicy Bypass -File ".\.claude\hooks\user-prompt-submit-hook.ps1"

# Check server logs
docker logs observability-server --tail 10

# View dashboard
start http://localhost:6001
```

## TODO
1. **Add bash versions** - For Linux/Mac compatibility
2. **Test on all platforms** - Currently only tested on Windows
3. **Add retry logic** - Single retry for network failures

## Testing Hooks
```bash
# Windows
powershell -ExecutionPolicy Bypass -File .claude/hooks/pre_tool_use.ps1

# Linux/Mac
bash .claude/hooks/pre_tool_use.sh
```

## Important Notes
- Hooks must NEVER block Claude Code
- Failures should be silent
- No external dependencies allowed
- Must work offline (fail gracefully)