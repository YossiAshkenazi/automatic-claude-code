# Python SDK Usage Guide

## 🔧 **Proper Authentication Setup**

**IMPORTANT**: The Claude CLI does NOT have a separate `claude auth` command. It uses the same authentication as Claude Code.

### Authentication Methods:

1. **Claude Code Desktop App** (Recommended):
   - Install and authenticate Claude Code desktop app
   - Claude CLI automatically uses the same authentication
   - No additional setup required

2. **Browser Authentication**:
   - The Claude CLI will open a browser for authentication when needed
   - This happens automatically on first use

3. **API Key Method**:
   - Set `ANTHROPIC_API_KEY` environment variable
   - Not recommended for desktop usage

## 🚀 **Testing the SDK**

### **Quick Functionality Test**
```bash
cd "C:\Users\Dev\automatic-claude-code\python-sdk"

# Test core functionality (no auth required)
python demo.py

# Test complete system (no auth required)  
python simple_test.py

# Test integration with monitoring
python simple_integration_test.py
```

### **Real Claude Query Test**
```bash
# Test with actual Claude CLI execution
python test_real_query.py
```

This will:
- Check if Claude CLI is accessible
- Test authentication status
- Try a real query with `--dangerously-skip-permissions`
- Show results in real-time

## 💻 **Using the SDK in Your Code**

### **Basic Usage with Skip Permissions**
```python
import asyncio
from claude_code_sdk import ClaudeCodeClient, ClaudeCodeOptions

async def main():
    # Configure with skip permissions flag (required for most usage)
    options = ClaudeCodeOptions(
        model="sonnet",
        verbose=True,
        max_turns=5,
        additional_args=["--dangerously-skip-permissions"]
    )
    
    async with ClaudeCodeClient(options) as client:
        async for message in client.query("What is 2+2?"):
            if hasattr(message, 'result'):
                print(f"Result: {message.result}")

asyncio.run(main())
```

### **Advanced Configuration**
```python
options = ClaudeCodeOptions(
    model="opus",  # or "sonnet", "haiku"
    allowed_tools=["Read", "Write", "Edit", "Bash"],
    max_turns=20,
    verbose=True,
    timeout=180,
    system_prompt="You are a helpful coding assistant.",
    additional_args=[
        "--dangerously-skip-permissions",
        "--no-continue"  # Don't continue previous conversations
    ]
)
```

### **Streaming Response Handler**
```python
async def handle_streaming():
    options = ClaudeCodeOptions(
        additional_args=["--dangerously-skip-permissions"]
    )
    
    async with ClaudeCodeClient(options) as client:
        message_count = 0
        async for message in client.query("Explain Python decorators"):
            message_count += 1
            print(f"Message {message_count}: {type(message).__name__}")
            
            # Handle different message types
            if isinstance(message, ResultMessage):
                print(f"Final result: {message.result}")
            elif isinstance(message, StreamMessage):
                print(f"Streaming: {message.content}")
            elif isinstance(message, ErrorMessage):
                print(f"Error: {message.error}")
```

## 📊 **Integration with Monitoring**

The SDK automatically integrates with the automatic-claude-code monitoring system:

```python
from claude_code_sdk.integrations import AutomaticClaudeIntegration

# Create integration
integration = AutomaticClaudeIntegration()

# Get session info
session_id = integration.create_session()
stats = integration.get_statistics()

print(f"Session: {session_id}")
print(f"Success rate: {stats['success_rate']:.1%}")
```

### **Monitoring Dashboard**
- **URL**: http://localhost:6011
- **API**: http://localhost:4001/api/health
- **Real-time**: WebSocket events automatically sent

## 🔍 **Troubleshooting**

### **Common Issues**

1. **"Claude CLI not found"**
   ```bash
   # Install Claude CLI
   npm install -g @anthropic-ai/claude-code
   
   # Verify installation
   claude --help
   ```

2. **Authentication errors**
   - Make sure Claude Code desktop app is installed and authenticated
   - The CLI uses the same authentication automatically
   - No separate `claude auth` command exists

3. **Permission errors**
   - Always use `--dangerously-skip-permissions` flag
   - Add to `additional_args`: `["--dangerously-skip-permissions"]`

4. **Timeout issues**
   - Increase timeout in options: `timeout=600`
   - Check network connectivity
   - Verify API limits haven't been exceeded

### **Debug Mode**
```python
# Enable verbose logging
options = ClaudeCodeOptions(
    verbose=True,
    additional_args=["--dangerously-skip-permissions", "--verbose"]
)

# Check CLI detection
from claude_code_sdk.utils import CLIDetector
detector = CLIDetector()
claude_path = await detector.detect_claude_cli()
print(f"Claude CLI: {claude_path}")
```

## 📈 **Performance Tips**

1. **Use appropriate models**:
   - `"haiku"` - Fast, less capable
   - `"sonnet"` - Balanced (recommended)
   - `"opus"` - Most capable, slower

2. **Set reasonable limits**:
   ```python
   options = ClaudeCodeOptions(
       max_turns=10,        # Limit conversation length
       timeout=120,         # 2-minute timeout
       model="sonnet"       # Balanced performance
   )
   ```

3. **Handle errors gracefully**:
   ```python
   try:
       async for message in client.query(prompt):
           # Process message
           pass
   except ClaudeTimeoutError:
       print("Query timed out, try again")
   except ClaudeNotFoundError:
       print("Claude CLI not found, check installation")
   ```

## 🎯 **Production Usage**

### **Environment Setup**
```bash
# Production environment variables
export ANTHROPIC_API_KEY="your-key-here"  # Optional
export CLAUDE_CLI_PATH="/path/to/claude"   # Optional override
```

### **Error Handling**
```python
from claude_code_sdk.exceptions import (
    ClaudeCodeError, ClaudeTimeoutError, 
    ClaudeNotFoundError, NetworkError
)

async def robust_query(prompt: str):
    options = ClaudeCodeOptions(
        additional_args=["--dangerously-skip-permissions"],
        timeout=180
    )
    
    try:
        async with ClaudeCodeClient(options) as client:
            async for message in client.query(prompt):
                yield message
                
    except ClaudeTimeoutError:
        # Handle timeout
        raise Exception("Query took too long")
    except ClaudeNotFoundError:
        # Handle CLI not found
        raise Exception("Claude CLI not installed")
    except NetworkError:
        # Handle network issues
        raise Exception("Network connectivity problem")
    except Exception as e:
        # Handle other errors
        raise Exception(f"Query failed: {e}")
```

---

## ✅ **Summary**

The Python SDK is production-ready with:
- ✅ **No separate authentication** - uses Claude Code's authentication
- ✅ **Automatic `--dangerously-skip-permissions`** - add to additional_args
- ✅ **Full monitoring integration** - real-time dashboard
- ✅ **Comprehensive error handling** - robust exception system
- ✅ **Cross-platform compatibility** - Windows, Linux, macOS

**Ready to use right now!** 🚀