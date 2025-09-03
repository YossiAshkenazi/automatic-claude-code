# Troubleshooting Guide

Common issues and solutions for the Claude Code Python SDK.

## ✅ RESOLVED ISSUES (v1.1.1)

### Critical JSON Parsing Bug (FIXED)

**Previous Issue (v1.1.0 and earlier):**
```
Tool usage failing ~40% of the time with parsing errors
TypeError: Expected dict, got list for tool_result field
```

**Resolution (v1.1.1):**
✅ **FIXED**: Enhanced JSON parsing now handles both dict and list formats from Claude CLI
✅ **Result**: Tool usage success rate improved from ~60% to >90%
✅ **Status**: SDK now production-ready

**Upgrade to v1.1.1:**
```bash
git pull origin main  # Get latest version
cd python-sdk
python run_tests.py  # Verify 14/14 tests pass
```

### Process Hanging Issues (FIXED)

**Previous Issue:**
```
Processes hanging indefinitely, requiring Ctrl+C intervention
Manual process cleanup required
```

**Resolution (v1.1.1):**
✅ **FIXED**: Epic 3 process management integration
✅ **Result**: Clean process termination in <2 seconds
✅ **Status**: No manual intervention required

---

## Installation Issues

### Claude CLI Not Found

**Error:**
```
ClaudeNotFoundError: Claude CLI not found. Please install @anthropic-ai/claude-code
```

**Solutions:**

1. **Install Claude CLI:**
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

2. **Check Installation:**
   ```bash
   claude --version
   which claude  # Linux/Mac
   where claude  # Windows
   ```

3. **Specify Custom Path:**
   ```python
   from claude_code_sdk import ClaudeCodeOptions
   
   options = ClaudeCodeOptions(
       claude_cli_path="/custom/path/to/claude"
   )
   ```

4. **Environment Variable:**
   ```bash
   export CLAUDE_CLI_PATH="/path/to/claude"
   ```

### Python Dependencies

**Error:**
```
ModuleNotFoundError: No module named 'claude_code_sdk'
```

**Solutions:**

1. **Install in Development Mode:**
   ```bash
   cd python-sdk
   pip install -e .
   ```

2. **Check Python Path:**
   ```python
   import sys
   print(sys.path)
   ```

3. **Virtual Environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # Linux/Mac
   venv\Scripts\activate     # Windows
   pip install -e .
   ```

## Authentication Issues

### Authentication Required

**Error:**
```
ClaudeAuthError: Authentication required
```

**Solutions:**

1. **Authenticate CLI:**
   ```bash
   claude auth
   ```

2. **Check Authentication Status:**
   ```bash
   claude auth status
   ```

3. **API Key Method:**
   ```bash
   export ANTHROPIC_API_KEY="your-api-key"
   ```

4. **Verify in Python:**
   ```python
   from claude_code_sdk import check_claude
   
   result = await check_claude()
   print(f"Authenticated: {result['authenticated']}")
   ```

### Session Expired

**Error:**
```
ClaudeAuthError: Session expired or invalid
```

**Solutions:**

1. **Re-authenticate:**
   ```bash
   claude auth logout
   claude auth
   ```

2. **Clear Session Cache:**
   ```bash
   # Linux/Mac
   rm -rf ~/.claude
   
   # Windows
   rmdir /s %USERPROFILE%\.claude
   ```

## Runtime Issues

### Timeout Errors

**Error:**
```
ClaudeTimeoutError: Query timed out after 300 seconds
```

**Solutions:**

1. **Increase Timeout:**
   ```python
   options = ClaudeCodeOptions(timeout=600)  # 10 minutes
   ```

2. **Break Down Complex Tasks:**
   ```python
   # Instead of one large task
   # "Build a complete web application"
   
   # Use multiple smaller tasks
   await query("Create project structure")
   await query("Add database models") 
   await query("Implement API endpoints")
   ```

3. **Use Streaming:**
   ```python
   # Streaming prevents timeouts during long operations
   async for message in query("long task", stream=True):
       if isinstance(message, StatusMessage):
           print(f"Progress: {message.status}")
   ```

### Memory Issues

**Error:**
```
ResourceExhaustionError: System resources exhausted
```

**Solutions:**

1. **Limit Tool Usage:**
   ```python
   options = ClaudeCodeOptions(
       allowed_tools=["Read", "Write"],  # Restrict tools
       max_turns=10  # Limit conversation length
   )
   ```

2. **Use Context Manager:**
   ```python
   # Ensures proper cleanup
   async with ClaudeSDKClient(options) as client:
       await client.query("prompt")
   # Resources automatically cleaned up
   ```

3. **Monitor Memory:**
   ```python
   import psutil
   
   process = psutil.Process()
   print(f"Memory usage: {process.memory_info().rss / 1024 / 1024:.1f} MB")
   ```

### Process Issues

**Error:**
```
ProcessError: Process execution failed
```

**Solutions:**

1. **Check Working Directory:**
   ```python
   from pathlib import Path
   
   options = ClaudeCodeOptions(
       working_directory=Path("./valid_directory")
   )
   ```

2. **Verify Permissions:**
   ```bash
   # Ensure Claude can write to current directory
   touch test_file && rm test_file
   ```

3. **Debug Mode:**
   ```python
   import logging
   logging.getLogger('claude_code_sdk').setLevel(logging.DEBUG)
   
   # Shows detailed process information
   options = ClaudeCodeOptions(verbose=True)
   ```

## Rate Limiting

### Rate Limit Exceeded

**Error:**
```
RateLimitError: API rate limit exceeded. Retry after 60 seconds.
```

**Solutions:**

1. **Implement Retry Logic:**
   ```python
   import asyncio
   from claude_code_sdk import RateLimitError
   
   async def query_with_retry(prompt, max_retries=3):
       for attempt in range(max_retries):
           try:
               async for message in query(prompt):
                   yield message
               return
           except RateLimitError as e:
               if attempt < max_retries - 1:
                   print(f"Rate limited, waiting {e.retry_after}s...")
                   await asyncio.sleep(e.retry_after)
               else:
                   raise
   ```

2. **Add Delays Between Requests:**
   ```python
   import asyncio
   
   for task in tasks:
       await query(task)
       await asyncio.sleep(2)  # 2 second delay
   ```

3. **Use Exponential Backoff:**
   ```python
   async def exponential_backoff_query(prompt):
       delay = 1
       max_delay = 60
       
       while delay <= max_delay:
           try:
               async for message in query(prompt):
                   yield message
               return
           except RateLimitError:
               await asyncio.sleep(delay)
               delay *= 2
   ```

## Configuration Issues

### Invalid Model

**Error:**
```
InvalidModelError: Model 'gpt-4' is not supported
```

**Solutions:**

1. **Use Supported Models:**
   ```python
   # Supported models
   options = ClaudeCodeOptions(
       model="sonnet"     # Default
       # model="opus"     # High performance
       # model="haiku"    # Fast responses
   )
   ```

2. **Check Available Models:**
   ```python
   from claude_code_sdk.core.options import SUPPORTED_MODELS
   print(f"Supported models: {SUPPORTED_MODELS}")
   ```

### Tool Restrictions

**Error:**
```
ClaudeConfigError: Tool 'Execute' not in allowed_tools list
```

**Solutions:**

1. **Allow Required Tools:**
   ```python
   options = ClaudeCodeOptions(
       allowed_tools=["Read", "Write", "Edit", "Bash", "Glob", "Grep"]
   )
   ```

2. **Development Mode:**
   ```python
   from claude_code_sdk import create_development_options
   options = create_development_options()  # Enables all tools
   ```

## Network Issues

### Connection Errors

**Error:**
```
NetworkError: Failed to connect to Claude API
```

**Solutions:**

1. **Check Internet Connection:**
   ```bash
   ping anthropic.com
   ```

2. **Verify Proxy Settings:**
   ```python
   import os
   options = ClaudeCodeOptions()
   
   # Add proxy to environment if needed
   os.environ['HTTP_PROXY'] = 'http://proxy:8080'
   os.environ['HTTPS_PROXY'] = 'http://proxy:8080'
   ```

3. **Test Direct Connection:**
   ```python
   import aiohttp
   
   async def test_connection():
       async with aiohttp.ClientSession() as session:
           async with session.get('https://api.anthropic.com') as response:
               print(f"Status: {response.status}")
   ```

### Certificate Issues

**Error:**
```
NetworkError: SSL certificate verification failed
```

**Solutions:**

1. **Update Certificates:**
   ```bash
   pip install --upgrade certifi
   ```

2. **Temporary Workaround (Development Only):**
   ```python
   import ssl
   ssl._create_default_https_context = ssl._create_unverified_context
   ```

## Integration Issues

### Monitoring Connection

**Error:**
```
ConnectionError: Could not connect to monitoring server
```

**Solutions:**

1. **Start Monitoring Server:**
   ```bash
   cd dual-agent-monitor
   npm run dev
   ```

2. **Check Server Status:**
   ```bash
   curl http://localhost:6011/health
   curl http://localhost:4005/api/health
   ```

3. **Disable Monitoring:**
   ```python
   integration = AutomaticClaudeIntegration(
       enable_monitoring=False  # Disable monitoring
   )
   ```

### Dual-Agent Issues

**Error:**
```
AgentCoordinationError: Manager-Worker communication failed
```

**Solutions:**

1. **Check Agent Roles:**
   ```python
   # Ensure proper role assignment
   os.environ['CLAUDE_AGENT_ROLE'] = 'manager'  # or 'worker'
   ```

2. **Use Dual-Agent Options:**
   ```python
   from claude_code_sdk import create_dual_agent_options
   
   manager_options = create_dual_agent_options("manager")
   worker_options = create_dual_agent_options("worker")
   ```

## Debugging Strategies

### Enable Comprehensive Logging

```python
import logging

# Set up detailed logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Enable SDK logging
logger = logging.getLogger('claude_code_sdk')
logger.setLevel(logging.DEBUG)
```

### Health Check Script

```python
import asyncio
from claude_code_sdk import check_claude, ClaudeSDKClient, ClaudeCodeOptions

async def health_check():
    print("🔍 Claude Code SDK Health Check")
    print("=" * 40)
    
    # Check Claude CLI
    claude_status = await check_claude()
    print(f"Claude CLI: {'✅ Available' if claude_status['available'] else '❌ Not available'}")
    
    if not claude_status['available']:
        print(f"Error: {claude_status['error']}")
        return
    
    # Check SDK Client
    try:
        options = ClaudeCodeOptions()
        async with ClaudeSDKClient(options) as client:
            print("✅ SDK Client: Ready")
            print(f"CLI Path: {client.claude_cli_path}")
    except Exception as e:
        print(f"❌ SDK Client: {e}")
    
    print("🎉 Health check complete!")

asyncio.run(health_check())
```

### Performance Monitoring

```python
import time
from claude_code_sdk import ClaudeSDKClient

async with ClaudeSDKClient() as client:
    start_time = time.time()
    
    async for message in client.query("simple test"):
        pass
    
    end_time = time.time()
    stats = client.get_stats()
    
    print(f"Execution time: {end_time - start_time:.2f}s")
    print(f"Average response time: {stats['average_response_time']:.2f}s")
    print(f"Queries executed: {stats['queries_executed']}")
```

## Getting More Help

### Debug Information

When reporting issues, include:

1. **Python Version:**
   ```bash
   python --version
   ```

2. **SDK Version:**
   ```python
   from claude_code_sdk import __version__
   print(__version__)
   ```

3. **Claude CLI Version:**
   ```bash
   claude --version
   ```

4. **System Information:**
   ```python
   import platform
   print(f"OS: {platform.system()} {platform.release()}")
   ```

5. **Error Traceback:**
   ```python
   import traceback
   
   try:
       # Your code
       pass
   except Exception as e:
       print(traceback.format_exc())
   ```

### Support Channels

- **GitHub Issues**: Report bugs and feature requests
- **Documentation**: Check API documentation for detailed usage
- **Community**: Join discussions and ask questions

### Performance Tips

1. **Use Context Managers:** Always use `async with` for proper resource management
2. **Batch Operations:** Group related tasks together
3. **Configure Timeouts:** Set appropriate timeouts for your use case
4. **Monitor Resources:** Keep an eye on memory and process usage
5. **Handle Errors Gracefully:** Implement proper error handling and recovery

Remember: Most issues can be resolved by ensuring proper authentication, using the latest versions, and following the async/await patterns correctly.