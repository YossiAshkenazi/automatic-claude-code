# Claude CLI Wrapper Examples

This directory contains practical examples demonstrating the Claude CLI wrapper functionality alongside the existing SDK examples. Each example is self-contained and runnable, showcasing different aspects of CLI wrapper capabilities.

## Prerequisites

- Python 3.10+
- Claude Code CLI installed and configured
- claude-code-sdk package installed
- Optional: MCP servers configured (for MCP integration examples)

## Installation

```bash
# Install the SDK
pip install -e ../

# Or if installing from PyPI (when available)
pip install claude-code-sdk
```

## CLI Wrapper Examples (NEW)

### 01_simple_query.py - Basic CLI Usage
**What it demonstrates:**
- Simple prompt execution with CLI wrapper
- Synchronous response handling  
- Basic error checking
- Interactive query mode

**Key concepts:**
- `ClaudeCliOptions` configuration
- `execute_sync()` method
- CLI availability checking
- Basic cleanup patterns

**Run with:** `python 01_simple_query.py`

---

### 02_streaming_example.py - Real-time Responses
**What it demonstrates:**
- Streaming responses with real-time output
- Progress indicators and formatting
- Multiple streaming queries
- Message type handling

**Key concepts:**
- `execute()` async generator
- `CliMessage` types (content, tool_use, thinking, error)
- Real-time progress display
- Stream processing patterns

**Run with:** `python 02_streaming_example.py`

---

### 03_multi_model_comparison.py - Model Selection
**What it demonstrates:**
- Comparing responses from different models
- Unified interface usage
- Side-by-side async execution
- Interactive model selection

**Key concepts:**
- `UnifiedCliWrapper` usage
- Model availability detection
- Concurrent execution with `asyncio.gather()`
- Performance comparison metrics

**Run with:** `python 03_multi_model_comparison.py`

---

### 04_tool_usage_example.py - AI Tool Integration
**What it demonstrates:**
- Claude using Read, Write, Edit tools
- Bash command execution
- Code analysis and improvement
- MCP (Model Context Protocol) tools

**Key concepts:**
- Tool configuration with `allowed_tools`
- File operations in temp directories
- Code generation and modification
- System command execution
- MCP integration patterns

**Run with:** `python 04_tool_usage_example.py`

---

### 05_error_handling_example.py - Robust Operations
**What it demonstrates:**
- Comprehensive error handling strategies
- Retry logic with exponential backoff
- Graceful degradation with fallback models
- Logging and monitoring patterns

**Key concepts:**
- Exception handling patterns
- Timeout management
- Retry mechanisms
- Fallback strategies
- Performance monitoring
- Custom logging integration

**Run with:** `python 05_error_handling_example.py`

## SDK Examples Overview

### 1. Basic Usage (`basic_usage.py`)
Fundamental usage patterns including:
- Simple queries with `quick_query()`
- Streaming responses
- Context manager usage with `ClaudeSDKClient`
- Multi-step conversations
- Error handling basics
- Configuration patterns

**Run:** `python basic_usage.py`

### 2. Advanced Streaming (`advanced_streaming.py`)
Sophisticated streaming patterns:
- Custom stream handlers with real-time analytics
- Message filtering and transformation
- Concurrent streaming operations
- Stream state management
- Performance metrics tracking

**Run:** `python advanced_streaming.py`

### 3. Integration with automatic-claude-code (`integration_with_automatic_claude.py`)
System integration examples:
- Dual-agent architecture coordination
- Monitoring dashboard integration
- Task workflow coordination
- Real-time observability
- Error reporting and analytics

**Run:** `python integration_with_automatic_claude.py`

**Prerequisites:** 
- automatic-claude-code system running
- Optional: Monitoring server on localhost:6011

### 4. Error Handling & Retry (`error_handling_retry.py`)
Comprehensive error management:
- Error classification and handling strategies
- Multiple retry strategies (exponential backoff, linear, fixed delay)
- Circuit breaker pattern for fault tolerance
- Fallback mechanisms
- Resilient client patterns

**Run:** `python error_handling_retry.py`

### 5. Multi-Turn Conversation (`multi_turn_conversation.py`)
Advanced conversational patterns:
- Context-aware conversations
- Session state management
- Branching conversation paths
- State persistence and restoration
- Concurrent conversation management

**Run:** `python multi_turn_conversation.py`

### 6. MCP Tool Integration (`mcp_tool_integration.py`)
Model Context Protocol tool integration:
- File system operations
- Web browsing automation
- GitHub API integration
- Memory and knowledge management
- Archon project management
- Complex multi-tool workflows

**Run:** `python mcp_tool_integration.py`

**Prerequisites:**
- MCP servers configured in Claude CLI
- GitHub token (for GitHub operations)
- Playwright server (for web browsing)

## Quick Start

1. **Start with basic usage:**
   ```bash
   python basic_usage.py
   ```

2. **Try streaming examples:**
   ```bash
   python advanced_streaming.py
   ```

3. **Test error handling:**
   ```bash
   python error_handling_retry.py
   ```

## Configuration

Most examples use default configurations, but you can customize:

```python
from claude_code_sdk.core.options import create_development_options

options = create_development_options(
    timeout=60,
    model="claude-3-sonnet-20241022",
    verbose=True
)
```

## Common Patterns

### Basic Query
```python
from claude_code_sdk import quick_query

result = await quick_query("Create a Python function to sort a list")
print(result)
```

### Context Manager
```python
from claude_code_sdk import ClaudeSDKClient
from claude_code_sdk.core.options import create_production_options

options = create_production_options()
async with ClaudeSDKClient(options) as client:
    response = await client.execute("Your prompt here")
    if response.success:
        print(response.result)
```

### Streaming
```python
from claude_code_sdk import query_stream

async for message in query_stream("Complex task requiring streaming"):
    if hasattr(message, 'result') and message.result:
        print(f"Chunk: {message.result}")
```

### Error Handling
```python
from claude_code_sdk.exceptions import ClaudeCodeError, ClaudeTimeoutError

try:
    result = await quick_query("Your prompt")
except ClaudeTimeoutError:
    print("Request timed out")
except ClaudeCodeError as e:
    print(f"Claude error: {e}")
```

## Integration Examples

### With automatic-claude-code
```python
from claude_code_sdk.integrations.automatic_claude import AutomaticClaudeIntegration

integration = AutomaticClaudeIntegration(enable_dual_agent=True)
result = await integration.execute_with_monitoring("Complex development task")
```

### With MCP Tools
```python
# File operations, web browsing, GitHub integration, etc.
# are handled automatically through Claude's MCP tool system
response = await client.execute(
    "Create a GitHub repository and add a README file using MCP tools"
)
```

## Performance Tips

1. **Use streaming for long responses:**
   ```python
   async for chunk in query_stream("Generate a large codebase"):
       process_chunk(chunk)
   ```

2. **Implement retry logic for production:**
   ```python
   from claude_code_sdk.exceptions import is_recoverable_error
   
   max_retries = 3
   for attempt in range(max_retries):
       try:
           result = await client.execute(prompt)
           break
       except Exception as e:
           if not is_recoverable_error(e) or attempt == max_retries - 1:
               raise
           await asyncio.sleep(2 ** attempt)  # Exponential backoff
   ```

3. **Use appropriate timeouts:**
   ```python
   # Short tasks
   options = create_development_options(timeout=30)
   
   # Complex tasks  
   options = create_development_options(timeout=300)
   ```

4. **Batch operations when possible:**
   ```python
   tasks = [client.execute(prompt) for prompt in prompts]
   results = await asyncio.gather(*tasks)
   ```

## Troubleshooting

### Common Issues

1. **"Claude CLI not found"**
   - Install Claude CLI: `npm install -g @anthropic-ai/claude-code`
   - Verify: `claude --version`

2. **Authentication errors**
   - Run `claude auth login` to authenticate
   - Check API key configuration

3. **Timeout errors**
   - Increase timeout in options
   - Use streaming for long responses
   - Implement retry logic

4. **MCP tool errors**
   - Verify MCP servers are configured in Claude CLI
   - Check `.mcp.json` configuration
   - Test MCP server connectivity

### Debug Mode

Enable debug logging:
```python
import logging
logging.basicConfig(level=logging.DEBUG)

# Or set DEBUG environment variable
import os
os.environ['DEBUG'] = 'claude-sdk:*'
```

## Contributing

When adding new examples:

1. Follow the existing pattern structure
2. Include comprehensive docstrings
3. Add error handling
4. Provide clear output and progress indicators
5. Update this README with new example information

## Examples Checklist

Each example should demonstrate:
- ✅ Proper async/await usage
- ✅ Context manager patterns  
- ✅ Error handling
- ✅ Progress indication
- ✅ Clear documentation
- ✅ Real-world use cases
- ✅ Performance considerations

## Next Steps

After running these examples:

1. **Explore the SDK source code** in `../claude_code_sdk/`
2. **Check out integration options** with your existing projects
3. **Review the main documentation** in `../README.md`
4. **Consider contributing examples** for your specific use cases

## SDK Information

```python
from claude_code_sdk import get_sdk_info
print(json.dumps(get_sdk_info(), indent=2))
```

For more information, see the main SDK documentation and the automatic-claude-code project documentation.