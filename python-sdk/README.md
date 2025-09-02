# Claude Code Python SDK

A comprehensive Python SDK for Claude Code CLI interactions with full integration support for the automatic-claude-code system.

## 🚀 Features

- **Async/await support** with context managers
- **Streaming and non-streaming** execution modes
- **Comprehensive error handling** and classification
- **Integration with dual-agent architecture**
- **Real-time monitoring** and observability
- **Cross-platform compatibility** (Windows, macOS, Linux)
- **Type hints** for full IDE support
- **Official SDK compatibility** for easy migration

## 📦 Installation

### Development Installation (Current)

Since the package is not yet published to PyPI, install from source:

```bash
# Clone the repository
git clone https://github.com/yossiashkenazi/automatic-claude-code
cd automatic-claude-code/python-sdk

# Install in development mode
pip install -e .

# Or install dependencies manually
pip install -r requirements.txt
```

### Prerequisites

- **Python 3.8+** (tested with 3.8-3.13)
- **Claude Code CLI** must be installed and accessible
- **Valid Anthropic API key** or Claude CLI authentication setup

### Verify Installation

```bash
# Check if Claude CLI is accessible
python -c "from claude_code_sdk.utils import CLIDetector; import asyncio; print(asyncio.run(CLIDetector().detect_claude_cli()))"

# Test basic SDK functionality
python -c "from claude_code_sdk import ClaudeCodeOptions; print('SDK installed successfully')"
```

## 🏃 Quick Start

### Simple Query

```python
import asyncio
from claude_code_sdk import query, ResultMessage

async def main():
    async for message in query("Create a Python function to calculate fibonacci numbers"):
        if isinstance(message, ResultMessage):
            print(message.result)

asyncio.run(main())
```

### Advanced Client Usage

```python
import asyncio
from claude_code_sdk import ClaudeCodeClient, ClaudeCodeOptions

async def main():
    options = ClaudeCodeOptions(
        model="opus",
        allowed_tools=["Read", "Write", "Edit"],
        max_turns=20,
        verbose=True
    )
    
    async with ClaudeCodeClient(options) as client:
        async for message in client.query("Implement a REST API with FastAPI"):
            print(f"[{message.type}] {message.content}")

asyncio.run(main())
```

### Integration with Automatic Claude Code

```python
import asyncio
from claude_code_sdk.integrations import AutomaticClaudeIntegration

async def main():
    integration = AutomaticClaudeIntegration(
        enable_dual_agent=True,
        enable_monitoring=True
    )
    
    # Single execution with monitoring
    result = await integration.execute_with_monitoring(
        "Implement user authentication system",
        agent_role="worker"
    )
    
    print(f"Success: {result['success']}")
    print(f"Result: {result['final_result']}")
    print(f"Execution time: {result['execution_time']:.2f}s")

asyncio.run(main())
```

### Dual-Agent Coordination

```python
import asyncio
from claude_code_sdk.integrations import AutomaticClaudeIntegration

async def main():
    integration = AutomaticClaudeIntegration(enable_dual_agent=True)
    
    # Dual-agent session with Manager-Worker coordination
    result = await integration.execute_dual_agent_session(
        "Build a complete web application with authentication and database",
        max_iterations=15
    )
    
    print(f"Task completed: {result['success']}")
    print(f"Total iterations: {result['total_iterations']}")
    print(f"Final result: {result['final_result']}")

asyncio.run(main())
```

## 📖 API Reference

### Core Classes

#### `ClaudeCodeClient`

The main async client class with context manager support.

```python
async with ClaudeCodeClient(options) as client:
    async for message in client.query("prompt"):
        # Handle messages
```

#### `ClaudeCodeOptions`

Configuration options for Claude Code execution.

```python
options = ClaudeCodeOptions(
    system_prompt="You are a Python expert",
    allowed_tools=["Read", "Write", "Bash"],
    model="sonnet",
    max_turns=10,
    timeout=300,
    verbose=True
)
```

### High-Level Functions

#### `query(prompt, **kwargs)`

Execute a single query with streaming responses.

```python
async for message in query("Create a Flask app"):
    if isinstance(message, ResultMessage):
        print(message.result)
```

#### `query_stream(prompt, on_message, **kwargs)`

Execute with real-time message callbacks.

```python
def handle_message(message):
    print(f"Received: {message.type}")

result = await query_stream(
    "Implement authentication", 
    on_message=handle_message
)
```

#### `conversation(prompts, **kwargs)`

Multi-turn conversation execution.

```python
result = await conversation([
    "Create a Python class for user management",
    "Add methods for login and logout",
    "Add password hashing functionality"
])
```

### Message Types

- **`ResultMessage`**: Final results from Claude
- **`ToolUseMessage`**: Tool usage notifications
- **`ToolResultMessage`**: Tool execution results
- **`ErrorMessage`**: Error notifications
- **`StreamMessage`**: Streaming content
- **`StatusMessage`**: Status updates

### Exception Handling

```python
from claude_code_sdk import (
    ClaudeCodeError, 
    ClaudeTimeoutError, 
    ClaudeAuthError,
    RateLimitError
)

try:
    async for message in query("complex task"):
        pass
except ClaudeTimeoutError:
    print("Execution timed out")
except ClaudeAuthError:
    print("Authentication required")
except RateLimitError as e:
    print(f"Rate limited. Retry after: {e.retry_after}s")
```

## 🔧 Configuration

### Option Factories

Pre-configured option sets for common use cases:

```python
from claude_code_sdk import (
    create_development_options,
    create_production_options,
    create_dual_agent_options,
    create_streaming_options
)

# Development mode
dev_options = create_development_options(
    allowed_tools=["Read", "Write", "Edit", "Bash"],
    verbose=True
)

# Production mode
prod_options = create_production_options(
    timeout=60,
    max_retries=3
)

# Dual-agent mode
manager_options = create_dual_agent_options("manager")
worker_options = create_dual_agent_options("worker")
```

### Environment Variables

- `CLAUDE_CLI_PATH`: Path to Claude CLI executable
- `CLAUDE_SESSION_ID`: Session ID for tracking
- `CLAUDE_AGENT_ROLE`: Agent role in dual-agent mode

## 🔌 Integrations

### Automatic Claude Code Integration

Full integration with the automatic-claude-code system:

```python
from claude_code_sdk.integrations import AutomaticClaudeIntegration

integration = AutomaticClaudeIntegration(
    monitoring_port=6011,
    api_port=4005,
    enable_dual_agent=True,
    enable_monitoring=True
)
```

### Monitoring Integration

Real-time monitoring and observability:

```python
from claude_code_sdk.integrations import MonitoringIntegration

monitoring = MonitoringIntegration(
    monitoring_port=6011,
    api_port=4005
)

# Send custom events
await monitoring.send_event("custom_event", {"data": "value"})
```

## 🧪 Testing

⚠️ **Note**: Comprehensive test suite is currently in development.

For now, you can validate the SDK functionality with:

```bash
# Install development dependencies
pip install -e .

# Basic functionality test
python -c "from claude_code_sdk import ClaudeCodeOptions; print('Core imports working')"

# CLI detection test
python -c "from claude_code_sdk.utils import CLIDetector; import asyncio; print('CLI detection:', asyncio.run(CLIDetector().detect_claude_cli()))"

# Integration test (requires Claude CLI authentication)
# python examples/basic_query_example.py
```

**Future Testing Features** (planned):
- Comprehensive test suite with pytest
- Code coverage analysis
- Type checking with mypy
- Integration tests with mock Claude CLI
- Security vulnerability scanning

## 🚨 Troubleshooting

### Common Issues

1. **Claude CLI not found**
   ```
   ClaudeNotFoundError: Claude CLI not found
   ```
   **Solution**: Install Claude CLI: `npm install -g @anthropic-ai/claude-code`

2. **Authentication required**
   ```
   ClaudeAuthError: Authentication required
   ```
   **Solution**: Run `claude auth` to authenticate

3. **Timeout errors**
   ```
   ClaudeTimeoutError: Query timed out after 300 seconds
   ```
   **Solution**: Increase timeout in options or break down the task

### Debug Mode

Enable debug logging:

```python
import logging
logging.getLogger('claude_code_sdk').setLevel(logging.DEBUG)
```

### Health Check

```python
from claude_code_sdk import check_claude

result = await check_claude()
print(f"Claude available: {result['available']}")
if not result['available']:
    print(f"Error: {result['error']}")
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Run tests and linting
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆕 Changelog

### v0.1.0 (Initial Release)

- Core async client implementation
- Streaming and non-streaming support
- Comprehensive error handling
- Integration with automatic-claude-code
- Dual-agent architecture support
- Real-time monitoring integration
- Cross-platform compatibility

## 🔗 Related Projects

- [Automatic Claude Code](https://github.com/yourusername/automatic-claude-code) - Main dual-agent system
- [Claude Code CLI](https://www.npmjs.com/package/@anthropic-ai/claude-code) - Official Claude CLI