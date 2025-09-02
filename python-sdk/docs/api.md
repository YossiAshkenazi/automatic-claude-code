# API Documentation

## Overview

The Claude Code Python SDK provides async/await support for Claude Code CLI interactions with comprehensive error handling and dual-agent integration.

## Core Classes

### ClaudeSDKClient

The main async client class with context manager support.

```python
from claude_code_sdk import ClaudeSDKClient, ClaudeCodeOptions

async with ClaudeSDKClient(options) as client:
    async for message in client.query("Create a Python function"):
        print(message.result)
```

#### Constructor

```python
ClaudeSDKClient(options: Optional[ClaudeCodeOptions] = None)
```

**Parameters:**
- `options` (ClaudeCodeOptions, optional): Configuration options for the client

#### Methods

##### query()

Execute a query with streaming responses.

```python
async def query(
    self, 
    prompt: str,
    stream: bool = None,
    on_message: Optional[Callable[[Message], None]] = None
) -> AsyncGenerator[Message, None]
```

**Parameters:**
- `prompt` (str): The prompt to send to Claude
- `stream` (bool, optional): Override streaming setting from options
- `on_message` (callable, optional): Callback for each message

**Returns:** AsyncGenerator yielding Message objects

**Example:**
```python
async with ClaudeSDKClient() as client:
    async for message in client.query("Explain async/await"):
        if isinstance(message, ResultMessage):
            print(message.result)
```

##### close()

Close the client and clean up resources.

```python
async def close() -> None
```

##### get_stats()

Get client performance statistics.

```python
def get_stats() -> Dict[str, Any]
```

**Returns:** Dictionary with execution statistics

## Configuration

### ClaudeCodeOptions

Configuration class for Claude Code execution.

```python
from claude_code_sdk import ClaudeCodeOptions

options = ClaudeCodeOptions(
    model="sonnet",
    allowed_tools=["Read", "Write", "Edit"],
    max_turns=10,
    timeout=300,
    verbose=True
)
```

#### Parameters

- `model` (str): Claude model to use ("sonnet", "opus", "haiku")
- `allowed_tools` (List[str]): Tools Claude can use
- `max_turns` (int): Maximum conversation turns
- `timeout` (float): Execution timeout in seconds
- `verbose` (bool): Enable verbose output
- `system_prompt` (str): System prompt for Claude
- `stream_response` (bool): Enable streaming responses
- `working_directory` (Path): Working directory for execution
- `claude_cli_path` (str): Path to Claude CLI executable

#### Option Factories

Pre-configured option sets for common use cases:

```python
from claude_code_sdk import (
    create_development_options,
    create_production_options,
    create_dual_agent_options,
    create_streaming_options
)

# Development mode
dev_options = create_development_options(verbose=True)

# Production mode  
prod_options = create_production_options(timeout=60)

# Dual-agent mode
manager_options = create_dual_agent_options("manager")
worker_options = create_dual_agent_options("worker")

# Streaming mode
stream_options = create_streaming_options()
```

## High-Level Functions

### query()

Execute a single query with streaming responses.

```python
from claude_code_sdk import query, ResultMessage

async def main():
    async for message in query("Create a FastAPI app"):
        if isinstance(message, ResultMessage):
            print(message.result)
```

**Parameters:**
- `prompt` (str): The prompt to send to Claude
- `**kwargs`: Additional options passed to ClaudeCodeOptions

**Returns:** AsyncGenerator yielding Message objects

### query_stream()

Execute with real-time message callbacks.

```python
from claude_code_sdk import query_stream

def handle_message(message):
    print(f"Received: {message.type}")

result = await query_stream(
    "Implement user authentication", 
    on_message=handle_message
)
```

### conversation()

Multi-turn conversation execution.

```python
from claude_code_sdk import conversation

result = await conversation([
    "Create a Python class for user management",
    "Add methods for login and logout",
    "Add password hashing functionality"
])
```

## Message Types

### BaseMessage

Base class for all message types.

**Properties:**
- `type` (str): Message type identifier
- `timestamp` (float): Message timestamp
- `content` (str): Message content

**Methods:**
- `to_dict()`: Convert to dictionary representation

### ResultMessage

Contains final results from Claude execution.

```python
class ResultMessage(BaseMessage):
    result: str
    token_count: Optional[int] = None
    model_used: Optional[str] = None
```

**Example:**
```python
if isinstance(message, ResultMessage):
    print(f"Result: {message.result}")
    print(f"Tokens used: {message.token_count}")
```

### ToolUseMessage

Notification of tool usage by Claude.

```python
class ToolUseMessage(BaseMessage):
    tool_name: str
    tool_input: Dict[str, Any]
    tool_use_id: Optional[str] = None
```

### ToolResultMessage

Results from tool execution.

```python
class ToolResultMessage(BaseMessage):
    tool_use_id: str
    result: Any
    is_error: bool = False
```

### ErrorMessage

Error notifications with classification.

```python
class ErrorMessage(BaseMessage):
    error: str
    error_code: Optional[str] = None
    error_type: str = "UnknownError"
    recoverable: bool = False
```

### StreamMessage

Streaming content during execution.

```python
class StreamMessage(BaseMessage):
    content: str
    is_partial: bool = True
```

### StatusMessage

Status updates during execution.

```python
class StatusMessage(BaseMessage):
    status: str
    details: Optional[Dict[str, Any]] = None
```

## Exception Handling

### Exception Hierarchy

```python
ClaudeCodeError                    # Base exception
├── ClaudeTimeoutError            # Execution timeout
├── ClaudeAuthError              # Authentication required
├── ClaudeNotFoundError          # CLI not found
├── ClaudeConfigError            # Configuration error
├── RateLimitError              # API rate limiting
├── QuotaExceededError          # Usage quota exceeded
├── InvalidModelError           # Invalid model specified
├── SessionCorruptedError       # Session state corrupted
├── ResourceExhaustionError     # System resources exhausted
├── NetworkError                # Network connectivity
└── ProcessError                # Process execution
```

### Error Classification

```python
from claude_code_sdk import classify_error, is_recoverable_error

try:
    async for message in query("complex task"):
        pass
except Exception as e:
    classified_error = classify_error(str(e))
    recoverable = is_recoverable_error(classified_error)
    
    if recoverable:
        print("Error is recoverable, retrying...")
    else:
        print("Fatal error, aborting")
```

### Exception Properties

All Claude exceptions have these properties:

- `message` (str): Error description
- `error_code` (str): Specific error code
- `recoverable` (bool): Whether error is recoverable
- `retry_after` (float, optional): Seconds to wait before retry

## Streaming Support

### StreamingHandler

Base class for handling streaming messages.

```python
from claude_code_sdk.interfaces.streaming import StreamingHandler

class CustomHandler(StreamingHandler):
    async def handle_result(self, message: ResultMessage):
        print(f"Final result: {message.result}")
    
    async def handle_tool_use(self, message: ToolUseMessage):
        print(f"Using tool: {message.tool_name}")
```

### MessageCollector

Collect messages during streaming execution.

```python
from claude_code_sdk.interfaces.streaming import MessageCollector

collector = MessageCollector()
async for message in query("Create a web app"):
    collector.add(message)

results = collector.get_results()
errors = collector.get_errors()
tool_uses = collector.get_tool_uses()
```

### Utility Functions

```python
from claude_code_sdk.interfaces.streaming import (
    collect_all_messages,
    get_final_result,
    error_only_filter,
    result_only_filter
)

# Collect all messages
messages = await collect_all_messages(query("prompt"))

# Get final result only
result = await get_final_result(query("prompt"))

# Filter message types
async for error in error_only_filter(query("prompt")):
    print(f"Error: {error.error}")
```

## Integrations

### AutomaticClaudeIntegration

Full integration with the automatic-claude-code system.

```python
from claude_code_sdk.integrations import AutomaticClaudeIntegration

integration = AutomaticClaudeIntegration(
    dashboard_url="http://localhost:6011",
    api_url="http://localhost:4005",
    enable_dual_agent=True,
    enable_monitoring=True
)

# Execute with monitoring
result = await integration.execute_with_monitoring(
    "Implement auth system",
    agent_role="worker"
)
```

#### Methods

##### execute_with_monitoring()

Execute a task with full monitoring integration.

```python
async def execute_with_monitoring(
    self,
    prompt: str,
    agent_role: str = "worker",
    **options
) -> Dict[str, Any]
```

##### execute_dual_agent_session()

Execute a dual-agent coordination session.

```python
async def execute_dual_agent_session(
    self,
    prompt: str,
    max_iterations: int = 10
) -> Dict[str, Any]
```

### MonitoringIntegration

Real-time monitoring and observability.

```python
from claude_code_sdk.integrations import MonitoringIntegration

monitoring = MonitoringIntegration(
    monitoring_port=6011,
    api_port=4005
)

# Send custom events
await monitoring.send_event("custom_event", {"data": "value"})

# Get system health
health = await monitoring.get_health()
```

## Utilities

### CLIDetector

Detect and validate Claude CLI installation.

```python
from claude_code_sdk.utils import CLIDetector

detector = CLIDetector()
cli_path = await detector.detect_claude_cli()

if cli_path:
    print(f"Claude CLI found: {cli_path}")
else:
    print("Claude CLI not found")
```

## Environment Variables

The SDK respects these environment variables:

- `CLAUDE_CLI_PATH`: Custom path to Claude CLI executable
- `CLAUDE_SESSION_ID`: Session ID for tracking
- `CLAUDE_AGENT_ROLE`: Agent role in dual-agent mode
- `CLAUDE_API_KEY`: Anthropic API key (if not using CLI auth)
- `DEBUG`: Enable debug logging

## Type Hints

The SDK provides comprehensive type hints for IDE support:

```python
from typing import AsyncGenerator, Optional, Dict, Any
from claude_code_sdk import ClaudeSDKClient, Message

async def my_function(client: ClaudeSDKClient) -> AsyncGenerator[Message, None]:
    async for message in client.query("prompt"):
        yield message
```