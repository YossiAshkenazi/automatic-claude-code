# Python SDK API Reference

**Claude CLI Wrapper - Complete API Documentation**  
**Version**: 1.1.0 | **Updated**: September 2, 2025

Complete API reference for the Claude CLI Wrapper Python SDK, including all classes, methods, and configuration options.

## 📑 Table of Contents

- [Core Classes](#core-classes)
  - [ClaudeCliWrapper](#claudecliwrapper)
  - [ClaudeCliOptions](#claudeclioptions)
  - [ClaudeCliSimple](#claudeclisimple)
  - [CliMessage](#climessage)
- [Method Reference](#method-reference)
- [Configuration Options](#configuration-options)
- [Message Types](#message-types)
- [Error Handling](#error-handling)
- [Examples](#examples)

## 📚 Core Classes

### ClaudeCliWrapper

The main async wrapper class for advanced Claude CLI integration.

```python
class ClaudeCliWrapper:
    """Async wrapper for Claude Code CLI using subprocess execution."""
    
    def __init__(self, options: Optional[ClaudeCliOptions] = None)
```

#### Constructor Parameters

- `options` (Optional[ClaudeCliOptions]): Configuration options for the wrapper
  - Defaults to `ClaudeCliOptions()` if not provided

#### Instance Attributes

- `options` (ClaudeCliOptions): The configuration options used by this instance
- `cli_path` (str): Resolved path to the Claude CLI executable
- `process` (Optional[asyncio.subprocess.Process]): Current running process (if any)

#### Methods

##### async execute(prompt: str) -> AsyncGenerator[CliMessage, None]

**Primary method for executing Claude CLI commands with streaming responses.**

```python
async def execute(self, prompt: str) -> AsyncGenerator[CliMessage, None]:
    """Execute Claude CLI command and stream parsed messages."""
```

**Parameters:**
- `prompt` (str): The prompt to send to Claude

**Returns:**
- AsyncGenerator[CliMessage, None]: Stream of parsed messages

**Features:**
- ✅ Timeout enforcement using `asyncio.timeout()`
- ✅ Retry logic with exponential backoff (3 attempts)
- ✅ Graceful process termination (SIGTERM → wait → SIGKILL)
- ✅ Concurrent stdout/stderr reading
- ✅ Comprehensive error handling with user guidance
- ✅ Authentication error detection
- ✅ Resource cleanup on cancellation

**Usage Example:**
```python
async for message in wrapper.execute("Create a Python function"):
    if message.type == "stream":
        print(f"Output: {message.content}")
    elif message.type == "auth_error":
        print(f"Auth issue: {message.content}")
        break
```

**Error Scenarios:**
- Empty/whitespace prompts → Yields error message
- Claude CLI not found → Yields error with installation guidance
- Authentication issues → Yields auth_error with setup guidance
- Timeout → Retries with exponential backoff
- Process errors → Graceful cleanup and error reporting

##### async execute_sync(prompt: str) -> str

**Execute and collect all output synchronously.**

```python
async def execute_sync(self, prompt: str) -> str:
    """Execute and collect all output synchronously."""
```

**Parameters:**
- `prompt` (str): The prompt to send to Claude

**Returns:**
- str: Complete response content (stream and result messages combined)

**Usage Example:**
```python
result = await wrapper.execute_sync("Write a hello world function")
print(result)  # Complete response as string
```

##### async cleanup()

**Cleanup resources and terminate processes.**

```python
async def cleanup(self):
    """Cleanup resources and terminate processes."""
```

**Features:**
- ✅ Graceful process termination with timeout
- ✅ Force-kill fallback for unresponsive processes
- ✅ Resource cleanup and error handling
- ✅ Safe to call multiple times

**Usage Example:**
```python
try:
    async for message in wrapper.execute("complex task"):
        # Process messages
        pass
finally:
    await wrapper.cleanup()  # Always cleanup
```

##### is_available() -> bool

**Check if Claude CLI is available.**

```python
def is_available(self) -> bool:
    """Check if Claude CLI is available."""
```

**Returns:**
- bool: True if Claude CLI is found and accessible, False otherwise

**Usage Example:**
```python
wrapper = ClaudeCliWrapper()
if wrapper.is_available():
    print("Claude CLI is ready")
else:
    print("Please install Claude CLI")
```

##### kill()

**Force kill the running process.**

```python
def kill(self):
    """Kill the running process if it exists."""
```

**Use Case:** Emergency process termination

**Note:** Use `cleanup()` for graceful termination; `kill()` for emergency situations

### ClaudeCliOptions

Configuration options dataclass for Claude CLI execution.

```python
@dataclass
class ClaudeCliOptions:
    """Options for Claude CLI execution."""
    
    model: str = "sonnet"                    # Model selection
    max_turns: int = 10                       # Conversation turns
    allowed_tools: List[str] = field(default_factory=lambda: ["Read", "Write", "Edit", "Bash"])
    verbose: bool = False                     # Detailed logging
    dangerously_skip_permissions: bool = False  # Skip permission prompts
    mcp_config: Optional[str] = None          # MCP config file path
    working_directory: Optional[Path] = None  # Working directory
    timeout: int = 300                        # Timeout in seconds
    cli_path: Optional[str] = None            # Custom CLI path
```

#### Configuration Parameters

**model** (str, default="sonnet")
- Available models: "sonnet", "opus", "haiku"
- Determines Claude model used for responses
- "sonnet" recommended for balanced performance/cost

**max_turns** (int, default=10)
- Maximum conversation turns allowed
- Range: 1-100 (practical limit)
- Higher values allow longer conversations

**allowed_tools** (List[str], default=["Read", "Write", "Edit", "Bash"])
- Tools that Claude can use during execution
- Available tools: "Read", "Write", "Edit", "MultiEdit", "Bash", "Glob", "Grep"
- Security consideration: Limit tools for safer execution

**verbose** (bool, default=False)
- Enable detailed logging output
- Useful for debugging and development
- Shows CLI command construction and execution details

**dangerously_skip_permissions** (bool, default=False)
- Skip permission prompts for non-interactive execution
- **WARNING**: Use with caution - bypasses safety checks
- Useful for automation scenarios

**mcp_config** (Optional[str], default=None)
- Path to MCP (Model Context Protocol) configuration file
- Enables custom tool and integration configurations
- Advanced feature for specialized setups

**working_directory** (Optional[Path], default=None)
- Set working directory for Claude CLI execution
- Defaults to current directory if not specified
- Useful for project-specific operations

**timeout** (int, default=300)
- Timeout in seconds for Claude CLI execution
- Range: 30-3600 seconds (30 seconds to 1 hour)
- Adjust based on expected task complexity

**cli_path** (Optional[str], default=None)
- Custom path to Claude CLI executable
- Auto-detected if not specified
- Useful for non-standard installations

#### Methods

##### to_cli_args() -> List[str]

**Convert options to Claude CLI command arguments.**

```python
def to_cli_args(self) -> List[str]:
    """Convert options to CLI arguments."""
```

**Returns:**
- List[str]: Command line arguments for Claude CLI

**Usage Example:**
```python
options = ClaudeCliOptions(model="opus", verbose=True)
args = options.to_cli_args()
print(args)  # ['--model', 'opus', '--verbose']
```

### ClaudeCliSimple

Simple synchronous wrapper for quick usage scenarios.

```python
class ClaudeCliSimple:
    """Simple synchronous wrapper for quick usage."""
    
    def __init__(self, model: str = "sonnet", verbose: bool = False)
```

#### Constructor Parameters

- `model` (str, default="sonnet"): Claude model to use
- `verbose` (bool, default=False): Enable verbose output

#### Methods

##### query(prompt: str) -> str

**Simple synchronous query execution.**

```python
def query(self, prompt: str) -> str:
    """Simple synchronous query."""
```

**Parameters:**
- `prompt` (str): The prompt to send to Claude

**Returns:**
- str: Complete response from Claude

**Usage Example:**
```python
claude = ClaudeCliSimple(model="sonnet", verbose=True)
result = claude.query("Write a Python function to sort a list")
print(result)
```

##### async stream_query(prompt: str)

**Async streaming query for simple wrapper.**

```python
async def stream_query(self, prompt: str):
    """Async streaming query."""
```

**Parameters:**
- `prompt` (str): The prompt to send to Claude

**Yields:**
- CliMessage: Streaming messages from Claude

**Usage Example:**
```python
claude = ClaudeCliSimple()
async for message in claude.stream_query("Create a web server"):
    print(f"[{message.type}] {message.content}")
```

### CliMessage

Message container for parsed Claude CLI output.

```python
@dataclass
class CliMessage:
    """Message from CLI output."""
    
    type: str                                    # Message type
    content: str                                 # Message content
    metadata: Dict[str, Any] = field(default_factory=dict)  # Additional data
```

#### Attributes

**type** (str)
- Message classification based on parsing
- See [Message Types](#message-types) for complete list

**content** (str)
- The actual message content/text
- Cleaned and processed for display

**metadata** (Dict[str, Any])
- Additional context and parsing information
- Varies by message type
- Useful for advanced processing and debugging

## 🕰️ Message Types

The enhanced parser recognizes 14 different message types:

### Primary Types

#### "stream"
**Regular streaming content from Claude**
```python
CliMessage(
    type="stream",
    content="I'll help you create that function...",
    metadata={"is_stderr": False}
)
```

#### "result"
**Final result or completion message**
```python
CliMessage(
    type="result",
    content="Task completed successfully",
    metadata={"is_error": False, "session_id": "abc123"}
)
```

#### "tool_use"
**Tool usage detection (XML patterns)**
```python
CliMessage(
    type="tool_use",
    content="<function_calls>",
    metadata={"xml_pattern": True}
)
```

#### "tool_action"
**Action phrase detection**
```python
CliMessage(
    type="tool_action",
    content="Reading file: test.py",
    metadata={"action_pattern": "reading file:"}
)
```

### Status and Progress Types

#### "status"
**Status messages and system updates**
```python
CliMessage(
    type="status",
    content="Processing your request...",
    metadata={"status_indicator": True}
)
```

#### "progress"
**Progress indicators with numbers/symbols**
```python
CliMessage(
    type="progress",
    content="[3/5] Processing files",
    metadata={"progress_indicator": True}
)
```

### Error Types

#### "error"
**General error messages**
```python
CliMessage(
    type="error",
    content="File not found: missing.py",
    metadata={"is_stderr": True}
)
```

#### "auth_error"
**Authentication errors with setup guidance**
```python
CliMessage(
    type="auth_error",
    content="Authentication failed: Invalid API key\n\nPlease run: claude setup-token",
    metadata={"auth_setup_required": True}
)
```

### Parsing Detection Rules

1. **JSON Structure** (Priority 1): Attempts JSON parsing first
2. **XML Patterns** (Priority 2): Detects `<function_calls>`, `<invoke>`, etc.
3. **Action Phrases** (Priority 3): "Reading file:", "Writing to file:", "Running command:"
4. **Progress Indicators** (Priority 4): Numbers + symbols (`[1/5]`, `75%`)
5. **Status Messages** (Priority 5): "waiting", "processing", "loading"
6. **Error Patterns** (Priority 6): "error:", "failed:", "exception:"
7. **Authentication** (Special): "invalid api key", "authentication failed"
8. **Default**: Falls back to "stream" type

## 🌐 Configuration Options

### Pre-configured Option Sets

#### Development Configuration
```python
dev_options = ClaudeCliOptions(
    model="sonnet",                           # Cost-effective for testing
    timeout=180,                              # 3-minute timeout
    max_turns=5,                              # Limited conversation
    allowed_tools=["Read", "Edit"],           # Safe tools only
    dangerously_skip_permissions=True,        # Non-interactive
    verbose=True                              # Debug output
)
```

#### Production Configuration
```python
prod_options = ClaudeCliOptions(
    model="opus",                             # More capable model
    timeout=900,                              # 15-minute timeout
    max_turns=20,                             # Extended conversations
    allowed_tools=["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
    verbose=False,                            # Clean output
    working_directory=Path("./src")           # Project directory
)
```

#### High-Performance Configuration
```python
high_perf_options = ClaudeCliOptions(
    model="sonnet",                           # Fast responses
    timeout=60,                               # Quick timeout
    max_turns=3,                              # Short conversations
    allowed_tools=["Read", "Write"],          # Essential tools
    dangerously_skip_permissions=True         # No interruptions
)
```

### Environment Variable Support

```python
# The wrapper respects these environment variables:
os.environ["CLAUDE_CLI_PATH"] = "/custom/path/to/claude"
os.environ["ANTHROPIC_API_KEY"] = "your-api-key"
os.environ["CLAUDE_NO_BROWSER"] = "1"        # Disable browser launches
os.environ["FORCE_COLOR"] = "0"               # Disable colors for parsing
```

## ❌ Error Handling

### Exception Types

The wrapper handles various error conditions gracefully:

#### FileNotFoundError
**Claude CLI not found**
```python
try:
    wrapper = ClaudeCliWrapper()
except FileNotFoundError as e:
    print(f"Install Claude CLI: {e}")
    # Error includes installation command
```

#### PermissionError
**Permission denied executing Claude CLI**
```python
# Detected during execution, yields error message
message = CliMessage(
    type="error",
    content="Permission denied executing '/path/to/claude'. Check file permissions.",
    metadata={"permission_error": True}
)
```

#### asyncio.TimeoutError
**Execution timeout**
```python
# Handled with retry logic and error messages
message = CliMessage(
    type="error",
    content="Execution failed after 3 attempts due to timeout (300s)",
    metadata={"timeout": True, "max_retries_exceeded": True}
)
```

#### asyncio.CancelledError
**User cancellation**
```python
# Graceful cleanup and status message
message = CliMessage(
    type="status",
    content="Execution cancelled",
    metadata={"cancelled": True}
)
```

### Error Recovery Strategies

#### Retry Logic
```python
# Automatic retry for transient errors
transient_keywords = ["connection", "network", "timeout", "temporary", "unavailable"]

# Exponential backoff: 1s, 2s, 4s
max_retries = 3
base_delay = 1.0
delay = base_delay * (2 ** attempt)
```

#### Process Cleanup
```python
# Graceful termination sequence
1. process.terminate()  # Send SIGTERM
2. await process.wait(timeout=2.0)  # Wait for graceful exit
3. process.kill()       # Force kill if needed
4. await process.wait() # Ensure completion
```

## 🚀 Usage Examples

### Example 1: Basic Usage

```python
#!/usr/bin/env python3
import asyncio
from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions

async def basic_example():
    """Basic wrapper usage with error handling"""
    options = ClaudeCliOptions(
        model="sonnet",
        verbose=True,
        timeout=300
    )
    
    wrapper = ClaudeCliWrapper(options)
    
    try:
        async for message in wrapper.execute("Create a Python class for managing tasks"):
            match message.type:
                case "stream":
                    print(f"💬 {message.content}")
                case "tool_action":
                    print(f"🔧 {message.content}")
                case "result":
                    print(f"✅ {message.content}")
                case "auth_error":
                    print(f"❌ {message.content}")
                    break
                case "error":
                    print(f"⚠️ {message.content}")
    
    finally:
        await wrapper.cleanup()

if __name__ == "__main__":
    asyncio.run(basic_example())
```

### Example 2: Advanced Configuration

```python
#!/usr/bin/env python3
import asyncio
from pathlib import Path
from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions

async def advanced_example():
    """Advanced configuration with custom options"""
    options = ClaudeCliOptions(
        model="opus",
        max_turns=15,
        allowed_tools=["Read", "Write", "Edit", "Bash", "Glob"],
        verbose=True,
        working_directory=Path("./my-project"),
        timeout=600,  # 10 minutes
        dangerously_skip_permissions=False  # Keep safety prompts
    )
    
    wrapper = ClaudeCliWrapper(options)
    
    print(f"Claude CLI path: {wrapper.cli_path}")
    print(f"CLI arguments: {' '.join(options.to_cli_args())}")
    
    try:
        prompt = """
        Analyze this codebase and:
        1. Identify code quality issues
        2. Suggest architectural improvements
        3. Add comprehensive tests
        4. Update documentation
        """
        
        message_count = 0
        async for message in wrapper.execute(prompt.strip()):
            message_count += 1
            
            if message.type == "auth_error":
                print("Authentication required - stopping execution")
                break
            
            print(f"[{message_count:03d}] [{message.type.upper()}] {message.content[:100]}")
            
            # Check metadata for additional info
            if message.metadata.get("action_pattern"):
                print(f"       Action detected: {message.metadata['action_pattern']}")
        
        print(f"\nProcessed {message_count} messages")
    
    except asyncio.TimeoutError:
        print("Execution timed out - task was too complex")
    except KeyboardInterrupt:
        print("Execution interrupted by user")
    finally:
        await wrapper.cleanup()
        print("Cleanup completed")

if __name__ == "__main__":
    asyncio.run(advanced_example())
```

### Example 3: Message Type Handling

```python
#!/usr/bin/env python3
import asyncio
from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions

class MessageProcessor:
    """Process different message types with specialized handling"""
    
    def __init__(self):
        self.results = []
        self.errors = []
        self.tool_usage = []
        self.progress_updates = []
    
    async def process_query(self, prompt: str):
        options = ClaudeCliOptions(
            model="sonnet",
            verbose=True,
            timeout=300
        )
        
        wrapper = ClaudeCliWrapper(options)
        
        try:
            async for message in wrapper.execute(prompt):
                await self.handle_message(message)
        finally:
            await wrapper.cleanup()
    
    async def handle_message(self, message):
        """Handle different message types"""
        handlers = {
            "stream": self.handle_stream,
            "result": self.handle_result,
            "tool_use": self.handle_tool_use,
            "tool_action": self.handle_tool_action,
            "status": self.handle_status,
            "progress": self.handle_progress,
            "error": self.handle_error,
            "auth_error": self.handle_auth_error
        }
        
        handler = handlers.get(message.type, self.handle_unknown)
        await handler(message)
    
    async def handle_stream(self, message):
        print(f"💬 Stream: {message.content}")
    
    async def handle_result(self, message):
        print(f"✅ Result: {message.content}")
        self.results.append(message.content)
    
    async def handle_tool_use(self, message):
        print(f"🔧 Tool Use: {message.content}")
        self.tool_usage.append({
            "content": message.content,
            "xml_pattern": message.metadata.get("xml_pattern", False)
        })
    
    async def handle_tool_action(self, message):
        print(f"⚙️ Tool Action: {message.content}")
        self.tool_usage.append({
            "content": message.content,
            "action_pattern": message.metadata.get("action_pattern")
        })
    
    async def handle_status(self, message):
        print(f"🔄 Status: {message.content}")
    
    async def handle_progress(self, message):
        print(f"📈 Progress: {message.content}")
        self.progress_updates.append(message.content)
    
    async def handle_error(self, message):
        print(f"❌ Error: {message.content}")
        self.errors.append(message.content)
    
    async def handle_auth_error(self, message):
        print(f"🔐 Auth Error: {message.content}")
        self.errors.append(f"AUTH: {message.content}")
        return False  # Stop processing
    
    async def handle_unknown(self, message):
        print(f"❓ Unknown [{message.type}]: {message.content}")
    
    def print_summary(self):
        """Print processing summary"""
        print("\n" + "=" * 50)
        print("PROCESSING SUMMARY")
        print("=" * 50)
        print(f"Results: {len(self.results)}")
        print(f"Errors: {len(self.errors)}")
        print(f"Tool Usage: {len(self.tool_usage)}")
        print(f"Progress Updates: {len(self.progress_updates)}")
        
        if self.errors:
            print("\nErrors encountered:")
            for error in self.errors:
                print(f"  - {error}")

async def main():
    processor = MessageProcessor()
    
    await processor.process_query("Create a web scraper with error handling and logging")
    
    processor.print_summary()

if __name__ == "__main__":
    asyncio.run(main())
```

### Example 4: Testing and Validation

```python
#!/usr/bin/env python3
import asyncio
import json
from claude_cli_wrapper import ClaudeCliWrapper

async def test_parsing():
    """Test the enhanced parsing capabilities"""
    wrapper = ClaudeCliWrapper()
    
    # Test cases covering all parsing scenarios
    test_cases = [
        # JSON structured responses
        ('{"type": "result", "result": "Success!", "is_error": false}', "result"),
        ('{"type": "stream", "content": "Processing..."}', "stream"),
        ('{"type": "result", "result": "Invalid API key", "is_error": true}', "auth_error"),
        
        # XML tool patterns
        ("<function_calls>", "tool_use"),
        ("<invoke name='Read'>", "tool_use"),
        ("</invoke>", "tool_use"),
        
        # Action phrases
        ("Reading file: test.py", "tool_action"),
        ("Writing to file: output.txt", "tool_action"),
        ("Running command: ls -la", "tool_action"),
        
        # Progress indicators
        ("[1/5] Processing files", "progress"),
        ("Progress: 75%", "progress"),
        ("Step 3/10 completed", "progress"),
        
        # Status messages
        ("Waiting for response...", "status"),
        ("Processing your request", "status"),
        ("Loading model data", "status"),
        
        # Error patterns
        ("Error: File not found", "error"),
        ("Failed to connect", "error"),
        ("Authentication failed - please check credentials", "auth_error"),
        
        # Edge cases
        ("", "stream"),  # Empty line
        ("   \t  ", "stream"),  # Whitespace
        ("x" * 1000, "stream"),  # Very long line
    ]
    
    print("Testing Enhanced Parsing Capabilities")
    print("=" * 50)
    
    passed = 0
    failed = 0
    
    for i, (test_input, expected_type) in enumerate(test_cases, 1):
        message = wrapper._parse_line(test_input)
        
        if message.type == expected_type:
            status = "✅ PASS"
            passed += 1
        else:
            status = "❌ FAIL"
            failed += 1
        
        display_input = test_input[:50] + "..." if len(test_input) > 50 else test_input
        print(f"[{i:2d}] {status} '{display_input}' -> {message.type} (expected {expected_type})")
        
        # Show metadata for special cases
        if message.metadata.get("auth_setup_required"):
            print(f"     🔐 Auth setup guidance provided")
        if message.metadata.get("xml_pattern"):
            print(f"     🔧 XML tool pattern detected")
        if message.metadata.get("action_pattern"):
            print(f"     ⚡ Action pattern: {message.metadata['action_pattern']}")
    
    print("\n" + "=" * 50)
    print(f"RESULTS: {passed}/{len(test_cases)} tests passed ({passed/len(test_cases)*100:.1f}%)")
    
    if failed > 0:
        print(f"❌ {failed} tests failed - review parsing logic")
    else:
        print("✅ All parsing tests passed!")

if __name__ == "__main__":
    asyncio.run(test_parsing())
```

## 🔗 Integration Patterns

### With Existing Async Code

```python
import asyncio
from claude_cli_wrapper import ClaudeCliWrapper

class AsyncService:
    """Example service integrating Claude CLI wrapper"""
    
    def __init__(self):
        self.wrapper = ClaudeCliWrapper()
    
    async def analyze_code(self, file_path: str) -> dict:
        """Analyze code file with Claude"""
        prompt = f"Analyze this code file and provide suggestions: {file_path}"
        
        results = {
            "analysis": "",
            "suggestions": [],
            "errors": []
        }
        
        try:
            async for message in self.wrapper.execute(prompt):
                if message.type == "result":
                    results["analysis"] = message.content
                elif message.type == "error":
                    results["errors"].append(message.content)
            
            return results
        
        finally:
            await self.wrapper.cleanup()
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.wrapper.cleanup()

# Usage
async def main():
    async with AsyncService() as service:
        result = await service.analyze_code("my_script.py")
        print(result["analysis"])
```

### With Task Queues

```python
import asyncio
from asyncio import Queue
from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions

class ClaudeTaskProcessor:
    """Process Claude tasks from a queue"""
    
    def __init__(self, max_workers: int = 3):
        self.task_queue = Queue()
        self.result_queue = Queue()
        self.max_workers = max_workers
        self.workers = []
    
    async def worker(self, worker_id: int):
        """Worker process for handling Claude tasks"""
        options = ClaudeCliOptions(
            model="sonnet",
            timeout=300,
            verbose=False
        )
        
        wrapper = ClaudeCliWrapper(options)
        
        try:
            while True:
                task = await self.task_queue.get()
                if task is None:  # Shutdown signal
                    break
                
                task_id, prompt = task
                print(f"Worker {worker_id} processing task {task_id}")
                
                try:
                    result = await wrapper.execute_sync(prompt)
                    await self.result_queue.put((task_id, True, result))
                except Exception as e:
                    await self.result_queue.put((task_id, False, str(e)))
                finally:
                    self.task_queue.task_done()
        
        finally:
            await wrapper.cleanup()
    
    async def start_workers(self):
        """Start worker processes"""
        for i in range(self.max_workers):
            worker = asyncio.create_task(self.worker(i))
            self.workers.append(worker)
    
    async def add_task(self, task_id: str, prompt: str):
        """Add task to queue"""
        await self.task_queue.put((task_id, prompt))
    
    async def get_result(self):
        """Get next result"""
        return await self.result_queue.get()
    
    async def shutdown(self):
        """Shutdown workers"""
        # Send shutdown signals
        for _ in range(self.max_workers):
            await self.task_queue.put(None)
        
        # Wait for workers to complete
        await asyncio.gather(*self.workers)

# Usage example
async def main():
    processor = ClaudeTaskProcessor(max_workers=2)
    await processor.start_workers()
    
    # Add tasks
    tasks = [
        ("task1", "Create a Python function for sorting"),
        ("task2", "Write a class for file handling"),
        ("task3", "Generate unit tests for a calculator")
    ]
    
    for task_id, prompt in tasks:
        await processor.add_task(task_id, prompt)
    
    # Collect results
    for _ in tasks:
        task_id, success, result = await processor.get_result()
        if success:
            print(f"Task {task_id} completed: {result[:100]}...")
        else:
            print(f"Task {task_id} failed: {result}")
    
    await processor.shutdown()
```

---

**Claude CLI Wrapper Python SDK - Complete API Reference**  
Part of the Automatic Claude Code project - Enhanced Python SDK for Claude CLI integration