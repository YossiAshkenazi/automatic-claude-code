# Quick Start Guide

Get up and running with the Claude Code Python SDK in minutes.

## Installation

### Prerequisites

- **Python 3.8+** (tested with 3.8-3.13)
- **Claude Code CLI** must be installed and accessible
- **Valid Anthropic API key** or Claude CLI authentication

### Install Claude CLI

```bash
npm install -g @anthropic-ai/claude-code
claude auth  # Follow authentication prompts
```

### Install Python SDK

```bash
# Clone repository
git clone https://github.com/yossiashkenazi/automatic-claude-code
cd automatic-claude-code/python-sdk

# Install in development mode
pip install -e .
```

### Verify Installation

```bash
python -c "from claude_code_sdk import ClaudeSDKClient; print('SDK ready!')"
claude --version  # Should show Claude CLI version
```

## Your First Query

### Simple Query

```python
import asyncio
from claude_code_sdk import query, ResultMessage

async def main():
    async for message in query("Create a Python function to calculate fibonacci"):
        if isinstance(message, ResultMessage):
            print(message.result)

asyncio.run(main())
```

### Using the Client

```python
import asyncio
from claude_code_sdk import ClaudeSDKClient, ClaudeCodeOptions

async def main():
    options = ClaudeCodeOptions(
        model="sonnet",
        verbose=True
    )
    
    async with ClaudeSDKClient(options) as client:
        async for message in client.query("Explain Python decorators"):
            print(f"[{message.type}] {message.content}")

asyncio.run(main())
```

## Core Concepts

### 1. Async/Await Pattern

The SDK is built around async/await for non-blocking execution:

```python
# Always use async functions
async def my_claude_task():
    async for message in query("prompt"):
        # Handle streaming messages
        pass

# Run with asyncio
asyncio.run(my_claude_task())
```

### 2. Context Manager Support

Use context managers for automatic resource cleanup:

```python
async with ClaudeSDKClient(options) as client:
    # Client automatically initializes and cleans up
    async for message in client.query("prompt"):
        pass
# Client is automatically closed here
```

### 3. Message Types

Handle different message types during execution:

```python
from claude_code_sdk import ResultMessage, ToolUseMessage, ErrorMessage

async for message in query("Create a web app"):
    if isinstance(message, ResultMessage):
        print(f"Result: {message.result}")
    elif isinstance(message, ToolUseMessage):
        print(f"Using tool: {message.tool_name}")
    elif isinstance(message, ErrorMessage):
        print(f"Error: {message.error}")
```

## Common Patterns

### 1. File Operations

```python
async def create_file():
    prompt = '''
    Create a Python file called "hello.py" with a function 
    that prints "Hello, World!" and call it.
    '''
    
    async for message in query(prompt):
        if isinstance(message, ResultMessage):
            print("File created successfully!")
```

### 2. Code Generation

```python
async def generate_api():
    prompt = '''
    Create a FastAPI application with:
    - User model with Pydantic
    - CRUD endpoints for users
    - Basic authentication
    - Error handling
    '''
    
    async for message in query(prompt):
        if isinstance(message, ToolUseMessage):
            print(f"Creating: {message.tool_input}")
        elif isinstance(message, ResultMessage):
            print("API generated!")
```

### 3. Multi-Step Tasks

```python
async def build_project():
    steps = [
        "Create a new Python project structure",
        "Add a requirements.txt with FastAPI and SQLAlchemy", 
        "Create a simple REST API with database models",
        "Add unit tests for the API endpoints"
    ]
    
    for step in steps:
        print(f"Executing: {step}")
        async for message in query(step):
            if isinstance(message, ResultMessage):
                print(f"✅ Completed: {step}")
                break
```

### 4. Error Handling

```python
from claude_code_sdk import ClaudeTimeoutError, ClaudeAuthError

async def robust_query():
    try:
        async for message in query("complex task", timeout=60):
            if isinstance(message, ResultMessage):
                return message.result
    except ClaudeTimeoutError:
        print("Task timed out - try breaking it into smaller steps")
    except ClaudeAuthError:
        print("Please run 'claude auth' to authenticate")
    except Exception as e:
        print(f"Unexpected error: {e}")
```

## Configuration Examples

### Development Setup

```python
from claude_code_sdk import create_development_options

options = create_development_options(
    verbose=True,
    allowed_tools=["Read", "Write", "Edit", "Bash"],
    timeout=300
)

async with ClaudeSDKClient(options) as client:
    # Development mode with full tool access
    pass
```

### Production Setup

```python
from claude_code_sdk import create_production_options

options = create_production_options(
    timeout=60,
    max_turns=10,
    allowed_tools=["Read", "Write"]  # Restricted tools
)

async with ClaudeSDKClient(options) as client:
    # Production mode with safety limits
    pass
```

### Custom Configuration

```python
from claude_code_sdk import ClaudeCodeOptions

options = ClaudeCodeOptions(
    model="opus",  # Higher capability model
    system_prompt="You are a senior Python developer",
    max_turns=20,
    timeout=600,
    verbose=True,
    working_directory=Path("./my_project")
)
```

## Integration Examples

### With Automatic Claude Code

```python
from claude_code_sdk.integrations import AutomaticClaudeIntegration

async def integrated_task():
    integration = AutomaticClaudeIntegration(
        enable_dual_agent=True,
        enable_monitoring=True
    )
    
    result = await integration.execute_with_monitoring(
        "Build a complete user authentication system",
        agent_role="worker"
    )
    
    print(f"Success: {result['success']}")
    print(f"Execution time: {result['execution_time']:.2f}s")
```

### With Custom Monitoring

```python
from claude_code_sdk.interfaces.streaming import MessageCollector

async def monitored_execution():
    collector = MessageCollector()
    
    async for message in query("Create a database schema"):
        collector.add(message)
        
        # Real-time monitoring
        if isinstance(message, ToolUseMessage):
            print(f"Tool: {message.tool_name}")
    
    # Get collected results
    results = collector.get_results()
    errors = collector.get_errors()
    
    print(f"Completed with {len(results)} results, {len(errors)} errors")
```

## Best Practices

### 1. Resource Management

Always use context managers to ensure proper cleanup:

```python
# ✅ Good
async with ClaudeSDKClient(options) as client:
    await client.query("prompt")

# ❌ Avoid - no automatic cleanup
client = ClaudeSDKClient(options)
await client._initialize()
await client.query("prompt")
# Resources might not be cleaned up
```

### 2. Error Handling

Handle specific error types for better user experience:

```python
from claude_code_sdk import (
    ClaudeTimeoutError, 
    ClaudeAuthError, 
    RateLimitError
)

try:
    async for message in query("prompt"):
        pass
except ClaudeAuthError:
    print("Please authenticate: claude auth")
except RateLimitError as e:
    print(f"Rate limited. Wait {e.retry_after}s")
except ClaudeTimeoutError:
    print("Task timed out. Try smaller steps.")
```

### 3. Streaming vs Blocking

Choose the right execution mode for your use case:

```python
# Streaming - for interactive applications
async for message in query("prompt", stream=True):
    if isinstance(message, StreamMessage):
        print(message.content, end="", flush=True)

# Blocking - for simple scripts
result = await get_final_result(query("prompt", stream=False))
print(result)
```

### 4. Performance Optimization

```python
# Use connection pooling for multiple queries
async with ClaudeSDKClient(options) as client:
    # Reuse the same client for multiple queries
    for task in tasks:
        async for message in client.query(task):
            pass

# Configure appropriate timeouts
options = ClaudeCodeOptions(
    timeout=120,  # Reasonable timeout
    max_turns=15  # Prevent infinite loops
)
```

## Debugging

### Enable Debug Logging

```python
import logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger('claude_code_sdk')
logger.setLevel(logging.DEBUG)
```

### Health Check

```python
from claude_code_sdk import check_claude

health = await check_claude()
if health['available']:
    print(f"Claude CLI ready: {health['version']}")
else:
    print(f"Issue: {health['error']}")
```

### Verbose Output

```python
options = ClaudeCodeOptions(verbose=True)
# Shows detailed execution information
```

## Next Steps

1. **Read the [API Documentation](docs/api.md)** for detailed reference
2. **Check [Troubleshooting](docs/troubleshooting.md)** for common issues  
3. **Explore [Architecture](docs/architecture.md)** for advanced usage
4. **See example scripts** in the repository for more patterns

## Getting Help

- **GitHub Issues**: Report bugs and request features
- **Documentation**: Complete API reference available
- **Examples**: Check the `examples/` directory for more patterns

Happy coding with Claude! 🚀