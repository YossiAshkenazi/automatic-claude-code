# Migration Guide

This guide helps you migrate between different versions of the Claude Code SDK.

## Version 0.1.0 (Initial Release)

This is the initial release, so there are no migration steps required. However, this guide outlines the architecture and patterns that future versions will maintain for backward compatibility.

### Core Architecture

The SDK is built around several key concepts:

- **ClaudeCodeSDK**: Main synchronous interface
- **AsyncClaudeCodeSDK**: Asynchronous interface
- **ExecutionResult**: Standard result object
- **Exception Hierarchy**: Structured error handling

### API Stability Promise

Starting with v0.1.0, we commit to:

1. **Semantic Versioning**: Major.Minor.Patch versioning
2. **Backward Compatibility**: No breaking changes in minor versions
3. **Deprecation Warnings**: 2 versions notice for breaking changes
4. **Migration Guides**: Detailed upgrade instructions

## Future Migration Patterns

### Expected in v0.2.0

The following enhancements are planned and will be backward compatible:

#### Dual-Agent Support
```python
# Current (v0.1.0)
sdk = ClaudeCodeSDK()
result = sdk.execute("complex task")

# Future (v0.2.0) - Optional dual-agent mode
sdk = ClaudeCodeSDK(dual_agent=True)
result = sdk.execute("complex task")  # Same interface, enhanced backend
```

#### Enhanced Streaming
```python
# Current (v0.1.0)
sdk = ClaudeCodeSDK(streaming=True)
result = sdk.execute(command, output_callback=callback)

# Future (v0.2.0) - Enhanced streaming with backpressure
sdk = ClaudeCodeSDK(streaming=True, buffer_size=8192)
result = sdk.execute(command, 
                    output_callback=callback,
                    progress_callback=progress_callback)
```

### Expected in v0.3.0

More advanced features while maintaining backward compatibility:

#### Configuration Files
```python
# Current (v0.1.0)
sdk = ClaudeCodeSDK(timeout=300, debug=True)

# Future (v0.3.0) - Config files supported
sdk = ClaudeCodeSDK.from_config("~/.claude-sdk/config.yml")
# Old initialization still works
```

#### Plugin System
```python
# Future (v0.3.0) - Optional plugin system
sdk = ClaudeCodeSDK()
sdk.register_plugin("enhanced-logging", LoggingPlugin())
# Core functionality unchanged
```

## Breaking Changes Policy

### What Constitutes a Breaking Change

- Removing public methods or properties
- Changing method signatures (removing parameters)
- Changing return type structures
- Changing exception types
- Removing or renaming modules

### What Does NOT Constitute a Breaking Change

- Adding new optional parameters with defaults
- Adding new methods or properties
- Adding new exception types (as long as they inherit properly)
- Adding new modules
- Performance improvements
- Bug fixes that correct documented behavior

### Deprecation Process

When we need to make breaking changes:

1. **Version N**: Introduce new API alongside old API
2. **Version N+1**: Mark old API as deprecated with warnings
3. **Version N+2**: Remove old API (major version bump)

Example:
```python
# v0.1.0 - Original API
result = sdk.execute(command, timeout=60)

# v0.2.0 - New API introduced, old API works
result = sdk.execute(command, execution_options={"timeout": 60})
result = sdk.execute(command, timeout=60)  # Still works, no warning

# v0.3.0 - Old API deprecated
result = sdk.execute(command, timeout=60)  # Works with deprecation warning
result = sdk.execute(command, execution_options={"timeout": 60})  # Preferred

# v1.0.0 - Old API removed
result = sdk.execute(command, execution_options={"timeout": 60})  # Only way
```

## Migration Testing Strategy

### Compatibility Testing

Before upgrading, test your integration:

```python
def test_sdk_compatibility():
    """Test that your current usage still works"""
    sdk = ClaudeCodeSDK()
    
    # Test basic operations
    result = sdk.execute("help")
    assert result.success
    
    # Test streaming
    sdk_streaming = ClaudeCodeSDK(streaming=True)
    result = sdk_streaming.execute("help", output_callback=lambda x: None)
    assert result.success
    
    # Test error handling
    try:
        sdk.execute("invalid command")
    except Exception as e:
        assert isinstance(e, (CommandError, SDKError))
```

### Version-Specific Testing

```python
def test_version_features():
    """Test version-specific features"""
    import claude_code_sdk
    
    version = claude_code_sdk.__version__
    major, minor, patch = map(int, version.split('.'))
    
    if major >= 0 and minor >= 2:
        # Test v0.2.0+ features
        sdk = ClaudeCodeSDK(dual_agent=True)
        # Test dual-agent functionality
    
    if major >= 0 and minor >= 3:
        # Test v0.3.0+ features
        sdk = ClaudeCodeSDK.from_config("config.yml")
        # Test config file functionality
```

## Common Migration Scenarios

### Upgrading from Direct CLI Usage

If you're currently using subprocess to call Claude CLI:

```python
# Before (direct subprocess)
import subprocess

def run_claude(command):
    result = subprocess.run(['claude'] + command.split(), 
                          capture_output=True, text=True)
    return result.stdout if result.returncode == 0 else None

# After (SDK)
from claude_code_sdk import ClaudeCodeSDK

def run_claude(command):
    sdk = ClaudeCodeSDK()
    result = sdk.execute(command)
    return result.output if result.success else None
```

### Upgrading from Custom Wrappers

If you have custom wrapper functions:

```python
# Before (custom wrapper)
class CustomClaudeWrapper:
    def __init__(self):
        self.timeout = 60
    
    def run_task(self, task):
        # Custom implementation
        pass

# After (SDK-based)
from claude_code_sdk import ClaudeCodeSDK

class CustomClaudeWrapper:
    def __init__(self):
        self.sdk = ClaudeCodeSDK(timeout=60)
    
    def run_task(self, task):
        return self.sdk.execute(f"run '{task}'")
```

## Troubleshooting Migrations

### Common Issues

1. **Import Errors**: Ensure you've installed the correct version
2. **Timeout Changes**: New versions might have different default timeouts
3. **Error Types**: Exception types might be more specific in newer versions
4. **Output Format**: Result structures are stable, but metadata might be enhanced

### Getting Help

- Check the [Changelog](changelog.md) for version-specific changes
- Review [API Reference](api-reference.html) for current interfaces
- Search [GitHub Issues](https://github.com/YossiAshkenazi/automatic-claude-code/issues)
- Create a [Discussion](https://github.com/YossiAshkenazi/automatic-claude-code/discussions) for migration help

## Version Support Policy

- **Current Version**: Full support with new features and bug fixes
- **Previous Minor Version**: Security updates and critical bug fixes
- **Older Versions**: Community support only

Example:
- If v0.3.0 is current, v0.2.x receives security updates
- v0.1.x and earlier are community-supported only

This policy ensures you have time to migrate while maintaining security.