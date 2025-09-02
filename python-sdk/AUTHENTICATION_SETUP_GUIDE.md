# Claude Code Python SDK - Authentication Setup Guide

## Quick Fix: "Invalid API key" Error

If you're getting "Invalid API key" errors, follow these steps:

### Step 1: Install Claude CLI
```bash
npm install -g @anthropic-ai/claude-code
```

### Step 2: Setup Authentication Token
```bash
claude setup-token
```
This command will:
- Open your default web browser
- Redirect you to Claude authentication page
- Prompt you to sign in with your Anthropic account
- Save authentication tokens locally

### Step 3: Verify Authentication Works
```bash
# Test basic CLI functionality
claude --help

# Test interactive mode (should not hang)
claude -p "hello world"
```

## Detailed Authentication Process

### What `claude setup-token` Does
1. **Browser Authentication**: Opens browser for secure OAuth login
2. **Token Storage**: Saves credentials to local Claude CLI config
3. **Session Creation**: Establishes authenticated session
4. **Validation**: Verifies API access works

### Expected Authentication Files
After successful setup, these files should exist:
- **Windows**: `%USERPROFILE%\.claude\` directory
- **macOS/Linux**: `~/.claude/` directory

### Verification Commands
```bash
# 1. Check CLI responds
claude --version

# 2. Test basic query (should not timeout)
claude -p "What is 2+2?"

# 3. Test interactive mode
claude
# (Type a message, then /exit to quit)
```

## Common Authentication Issues

### Issue: Browser Authentication Fails
**Symptoms**: Setup-token opens browser but doesn't complete
**Solutions**:
1. Try different browser: `claude setup-token --browser chrome`
2. Disable browser extensions temporarily
3. Check firewall/antivirus blocking localhost connections
4. Retry: `claude setup-token --force`

### Issue: CLI Hangs on Queries
**Symptoms**: Commands timeout after 15+ seconds
**Diagnosis**: Usually authentication incomplete
**Fix**:
```bash
# Re-run setup
claude setup-token

# Test immediately
claude -p "test"
```

### Issue: "No valid session" Error
**Symptoms**: Authentication worked before, now fails
**Fix**:
```bash
# Clear and re-authenticate
claude logout
claude setup-token
```

## Environment Variable Alternatives

### Option 1: Direct API Key (Advanced)
If you have an Anthropic API key:
```bash
# Windows
set ANTHROPIC_API_KEY=your-api-key-here

# macOS/Linux
export ANTHROPIC_API_KEY=your-api-key-here
```

### Option 2: Config File Override
Create `.clauderc` in your project:
```json
{
  "api_key": "your-api-key",
  "model": "claude-3-sonnet-20240229"
}
```

## Integration with Simple SDK Script

### Using the Simple SDK After Authentication
```python
from claude_code_sdk import ClaudeCodeClient

# After successful authentication, this works:
client = ClaudeCodeClient()
result = client.execute("Write a hello world function")
print(result.content)
```

### Simplified Alternative (No Complex Auth)
Use the simple working SDK for basic functionality:
```python
from simple_working_sdk import SimpleClaudeClient

# Works with basic CLI authentication
client = SimpleClaudeClient()
response = client.query_sync("Explain Python decorators")
print(response)
```

## Testing Authentication Status

### Quick Test Script
```python
# check_auth.py
import subprocess
import sys

def test_auth():
    try:
        result = subprocess.run(
            ['claude', '-p', 'hello'], 
            capture_output=True, 
            text=True, 
            timeout=10
        )
        
        if result.returncode == 0:
            print("✅ Authentication working!")
            return True
        else:
            print("❌ Authentication failed")
            print("Run: claude setup-token")
            return False
            
    except subprocess.TimeoutExpired:
        print("⏱️ Timeout - likely needs authentication")
        print("Run: claude setup-token")
        return False

if __name__ == "__main__":
    test_auth()
```

## Troubleshooting Checklist

### Before Running SDK:
- [ ] Claude CLI installed: `claude --version`
- [ ] Authentication completed: `claude setup-token`
- [ ] Basic query works: `claude -p "test"`
- [ ] No hanging/timeouts on CLI commands

### If Still Failing:
1. **Reinstall Claude CLI**: `npm uninstall -g @anthropic-ai/claude-code && npm install -g @anthropic-ai/claude-code`
2. **Clear auth cache**: `claude logout` then `claude setup-token`
3. **Check network**: Ensure no proxy/VPN blocking Claude API
4. **Try different terminal**: Some terminals have subprocess issues

### Success Indicators:
- Claude CLI responds instantly to `--help`
- Test queries complete in 2-5 seconds
- Interactive mode starts without hanging
- No "Invalid API key" errors

## Next Steps

Once authentication works:
1. Run SDK tests: `python test_sdk.py`
2. Try examples: `python example_basic_usage.py`
3. Build your applications with confidence!

---

**Need Help?** If authentication still fails after following this guide, check:
- Your Anthropic account has API access
- Network connectivity to api.anthropic.com
- No corporate firewall blocking OAuth flows