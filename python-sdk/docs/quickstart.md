# Quickstart Guide

This guide will get you up and running with the Claude Code SDK in minutes.

## Installation and Setup

```bash
# Install the SDK
pip install claude-code-sdk

# Verify Claude CLI is installed
claude --version

# Test SDK installation
python -c "from claude_code_sdk import ClaudeCodeSDK; print('SDK installed successfully!')"
```

## Your First SDK Script

Create a file called `first_script.py`:

```python
from claude_code_sdk import ClaudeCodeSDK

# Initialize the SDK
sdk = ClaudeCodeSDK()

# Execute a simple command
result = sdk.execute("help")

if result.success:
    print("✅ Success!")
    print(result.output)
else:
    print("❌ Error:", result.error)
```

Run it:

```bash
python first_script.py
```

## Common Usage Patterns

### 1. File Operations

```python
from claude_code_sdk import ClaudeCodeSDK

sdk = ClaudeCodeSDK()

# Create a new file
result = sdk.execute("run 'create a hello.py file with a simple greeting'")
print(result.output)

# Modify existing files
result = sdk.execute("run 'add error handling to hello.py'")
print(result.output)
```

### 2. Code Analysis

```python
# Analyze code quality
result = sdk.execute("run 'analyze the code quality in this directory'")
if result.success:
    print("Code Analysis Results:")
    print(result.output)
```

### 3. Streaming Output for Long Tasks

```python
sdk = ClaudeCodeSDK(streaming=True)

def print_progress(line):
    print(f"[PROGRESS] {line}")

# Long-running task with real-time output
result = sdk.execute(
    "run 'implement a complete REST API with tests'",
    output_callback=print_progress
)
```

### 4. Error Handling and Retries

```python
from claude_code_sdk import ClaudeCodeSDK, SDKError
import time

sdk = ClaudeCodeSDK()

def execute_with_retry(command, max_retries=3):
    for attempt in range(max_retries):
        try:
            result = sdk.execute(command)
            if result.success:
                return result
            print(f"Attempt {attempt + 1} failed: {result.error}")
        except SDKError as e:
            print(f"SDK error on attempt {attempt + 1}: {e}")
        
        if attempt < max_retries - 1:
            time.sleep(2 ** attempt)  # Exponential backoff
    
    raise Exception("All retry attempts failed")

# Usage
try:
    result = execute_with_retry("run 'complex task that might fail'")
    print("Success:", result.output)
except Exception as e:
    print("Final failure:", e)
```

## Advanced Features

### Async Support

```python
import asyncio
from claude_code_sdk import AsyncClaudeCodeSDK

async def async_example():
    sdk = AsyncClaudeCodeSDK()
    
    # Execute multiple tasks concurrently
    tasks = [
        sdk.execute("run 'analyze file1.py'"),
        sdk.execute("run 'analyze file2.py'"),
        sdk.execute("run 'analyze file3.py'")
    ]
    
    results = await asyncio.gather(*tasks)
    
    for i, result in enumerate(results, 1):
        print(f"File {i} analysis: {result.output[:100]}...")

# Run the async example
asyncio.run(async_example())
```

### Custom Configuration

```python
sdk = ClaudeCodeSDK(
    claude_executable="/custom/path/to/claude",
    timeout=600,  # 10 minutes
    streaming=True,
    debug=True
)
```

### Working with Results

```python
result = sdk.execute("run 'create a simple calculator'")

# Check result properties
print(f"Success: {result.success}")
print(f"Exit Code: {result.exit_code}")
print(f"Execution Time: {result.execution_time}s")
print(f"Output Length: {len(result.output)} characters")

# Access metadata
if result.metadata:
    print(f"Command: {result.metadata.get('command')}")
    print(f"Timestamp: {result.metadata.get('timestamp')}")
```

## Integration Examples

### CI/CD Integration

```python
#!/usr/bin/env python3
"""CI/CD script using Claude Code SDK"""

import sys
from claude_code_sdk import ClaudeCodeSDK

def main():
    sdk = ClaudeCodeSDK()
    
    # Code quality check
    result = sdk.execute("run 'run all tests and check code quality'")
    
    if not result.success:
        print("❌ Quality checks failed!")
        print(result.error)
        sys.exit(1)
    
    print("✅ All quality checks passed!")
    print(result.output)

if __name__ == "__main__":
    main()
```

### Development Automation

```python
"""Development workflow automation"""

from claude_code_sdk import ClaudeCodeSDK

class DevWorkflow:
    def __init__(self):
        self.sdk = ClaudeCodeSDK(streaming=True)
    
    def setup_project(self, project_name):
        """Set up a new project structure"""
        command = f"run 'create a new Python project structure for {project_name}'"
        return self.sdk.execute(command)
    
    def add_feature(self, feature_description):
        """Add a new feature with tests"""
        command = f"run 'implement {feature_description} with comprehensive tests'"
        return self.sdk.execute(command)
    
    def refactor_code(self, target_file):
        """Refactor code for better maintainability"""
        command = f"run 'refactor {target_file} for better readability and performance'"
        return self.sdk.execute(command)

# Usage
workflow = DevWorkflow()
workflow.setup_project("my-awesome-app")
workflow.add_feature("user authentication system")
workflow.refactor_code("auth.py")
```

## Best Practices

### 1. Always Check Results

```python
result = sdk.execute(command)
if not result.success:
    # Handle the error appropriately
    logger.error(f"Command failed: {result.error}")
    return None
```

### 2. Use Timeouts for Long Operations

```python
sdk = ClaudeCodeSDK(timeout=300)  # 5-minute timeout
```

### 3. Enable Streaming for Interactive Tasks

```python
sdk = ClaudeCodeSDK(streaming=True)

def handle_output(line):
    # Process output line by line
    if "error" in line.lower():
        logger.warning(f"Potential issue: {line}")

result = sdk.execute(command, output_callback=handle_output)
```

### 4. Use Environment Variables for Configuration

```bash
export CLAUDE_CODE_SDK_DEBUG=true
export CLAUDE_CODE_SDK_TIMEOUT=600
```

## Next Steps

- Explore the [API Reference](api-reference.html) for detailed documentation
- Check out [Examples](examples/index.html) for more complex use cases
- Read about [Architecture](architecture.html) to understand the SDK internals
- Review [Troubleshooting](troubleshooting.html) for common issues and solutions