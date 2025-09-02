# Migration Guide - Claude Code Python SDK

This guide helps users migrate between different versions of the Claude Code Python SDK.

## Current Version: 0.1.0

**Status**: Pre-release (Beta)  
**API Stability**: In development, expect changes before 1.0.0  
**Migration Required**: None (initial release)

---

## Upcoming: Migration to 1.0.0 (Stable Release)

### Overview
The transition from 0.1.0 to 1.0.0 will mark the first stable release of the SDK. While we aim to minimize breaking changes, some API refinements may be necessary.

### Expected Timeline
- **Beta Period**: 0.1.0 - 0.9.x (Current)
- **Release Candidate**: 1.0.0-rc.1 - 1.0.0-rc.x
- **Stable Release**: 1.0.0 (Target: Q2 2025)

### Anticipated Changes

#### Potential Breaking Changes
Based on current development, these areas may see breaking changes before 1.0.0:

1. **Configuration Structure**
   ```python
   # Current (0.1.0)
   from claude_code_sdk import ClaudeCodeOptions
   options = ClaudeCodeOptions(timeout=30, retry_attempts=3)
   
   # Potential 1.0.0 structure
   from claude_code_sdk import ClaudeCodeConfig
   config = ClaudeCodeConfig()
   config.timeout.connection = 30
   config.retry.max_attempts = 3
   ```

2. **Error Handling Hierarchy**
   - Error class names may be refined
   - Error hierarchy may be reorganized for better specificity

3. **Streaming Interface**
   - Message types may be consolidated
   - Streaming handler interface may be simplified

#### Guaranteed Compatibility
These features will remain stable across the 1.0.0 transition:

- ✅ **Core query functions**: `query()`, `query_stream()`, `conversation()`
- ✅ **Basic client usage**: `ClaudeCodeClient` context manager pattern
- ✅ **Essential message types**: `ResultMessage`, `ErrorMessage`
- ✅ **Integration classes**: `AutomaticClaudeIntegration`
- ✅ **Utility functions**: CLI detection, basic error classification

### Migration Strategy

#### 1. Stay Updated
Monitor releases and test your code against release candidates:

```bash
# Install latest pre-release
pip install --pre claude-code-sdk

# Test your integration
python -m pytest your_tests/
```

#### 2. Use Stable APIs
Focus on the guaranteed compatibility features for production code:

```python
# Recommended stable usage pattern
from claude_code_sdk import query, ClaudeCodeClient

# Simple usage (most stable)
async for message in query("Your prompt here"):
    if message.type == "result":
        print(message.result)

# Advanced usage (stable pattern)
async with ClaudeCodeClient() as client:
    async for message in client.query("Your prompt"):
        # Handle messages
        pass
```

#### 3. Prepare for Changes
If using advanced features, prepare for potential changes:

```python
# Instead of deep configuration
try:
    # New way (1.0.0)
    from claude_code_sdk import ClaudeCodeConfig
    config = ClaudeCodeConfig()
except ImportError:
    # Fallback to current way (0.1.0)
    from claude_code_sdk import ClaudeCodeOptions
    config = ClaudeCodeOptions()
```

---

## Migration from External Libraries

### From Direct Claude CLI Usage

If you're currently using subprocess to call Claude CLI directly:

#### Before (Direct CLI)
```python
import subprocess
import json

def query_claude(prompt):
    result = subprocess.run(
        ["claude", "query", prompt],
        capture_output=True,
        text=True
    )
    return result.stdout
```

#### After (Claude Code SDK)
```python
from claude_code_sdk import query

async def query_claude(prompt):
    async for message in query(prompt):
        if message.type == "result":
            return message.result
    return ""
```

### From Other Python AI SDKs

#### From OpenAI SDK Pattern
```python
# Old pattern
import openai
response = openai.ChatCompletion.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Hello"}]
)
result = response.choices[0].message.content

# Claude Code SDK pattern
from claude_code_sdk import quick_query
result = await quick_query("Hello")
```

#### From Anthropic SDK Pattern
```python
# Official Anthropic SDK
import anthropic
client = anthropic.Anthropic()
message = client.messages.create(
    model="claude-3-sonnet-20240229",
    max_tokens=1000,
    messages=[{"role": "user", "content": "Hello"}]
)

# Claude Code SDK (focuses on CLI integration)
from claude_code_sdk import ClaudeCodeClient
async with ClaudeCodeClient() as client:
    async for message in client.query("Hello"):
        print(message.result)
```

---

## Common Migration Patterns

### Error Handling Migration

#### From Generic Exception Handling
```python
# Before
try:
    result = some_claude_operation()
except Exception as e:
    print(f"Error: {e}")
```

#### After (Using SDK Error Classification)
```python
from claude_code_sdk import query, classify_error, is_recoverable_error

try:
    async for message in query("Your prompt"):
        # Handle message
        pass
except Exception as e:
    error_type = classify_error(e)
    if is_recoverable_error(e):
        # Retry logic
        pass
    else:
        # Handle permanent failure
        pass
```

### Async/Await Migration

#### From Synchronous Code
```python
# Before
def process_requests(prompts):
    results = []
    for prompt in prompts:
        result = synchronous_claude_call(prompt)
        results.append(result)
    return results
```

#### After (Async with Concurrency)
```python
import asyncio
from claude_code_sdk import query

async def process_requests(prompts):
    tasks = [query(prompt) for prompt in prompts]
    results = []
    
    for task in asyncio.as_completed(tasks):
        async for message in await task:
            if message.type == "result":
                results.append(message.result)
                break
    
    return results
```

### Streaming Migration

#### From Polling-Based Updates
```python
# Before
def get_response_with_updates(prompt):
    job_id = start_claude_job(prompt)
    while True:
        status = check_job_status(job_id)
        if status.complete:
            return status.result
        time.sleep(1)
```

#### After (Real-time Streaming)
```python
from claude_code_sdk import query_stream

async def get_response_with_updates(prompt):
    async for message in query_stream(prompt):
        if message.type == "status":
            print(f"Progress: {message.status}")
        elif message.type == "result":
            return message.result
```

---

## Breaking Changes Policy

### Semantic Versioning Commitment
- **MAJOR** (X.0.0): Breaking changes allowed, migration guide provided
- **MINOR** (0.X.0): New features only, backwards compatible
- **PATCH** (0.0.X): Bug fixes only, backwards compatible

### Breaking Change Process
1. **Advance Notice**: 30+ days warning before major releases
2. **Migration Guide**: Detailed guide with code examples
3. **Deprecation Period**: Old APIs marked deprecated but functional
4. **Migration Tools**: Automated migration scripts where possible
5. **Support**: Community support during migration period

### Version Support Policy
- **Latest Major**: Full support and active development
- **Previous Major**: Security fixes and critical bugs only
- **Older Versions**: Community support only

---

## Migration Tools

### Automated Migration Script (Coming in 1.0.0)

```bash
# Future migration tool
pip install claude-code-sdk[migration]
claude-sdk-migrate --from 0.9.x --to 1.0.0 --path ./my_project/
```

### Version Compatibility Checker

```python
from claude_code_sdk import check_compatibility

# Check if your code is ready for upgrade
compatibility = check_compatibility("1.0.0")
if compatibility.compatible:
    print("✅ Ready to upgrade")
else:
    print("⚠️ Issues found:")
    for issue in compatibility.issues:
        print(f"  - {issue}")
```

---

## Getting Help

### Migration Support
- **GitHub Issues**: Tag with `migration` label
- **Documentation**: Check docs for version-specific guides
- **Community**: Ask questions in discussions

### Staying Informed
- **GitHub Releases**: Watch repository for release notifications
- **CHANGELOG.md**: Review detailed changes for each version
- **Migration Guides**: Updated with each major release

### Reporting Issues
If you encounter migration problems:

1. **Check Compatibility**: Verify Python and dependency versions
2. **Review Changes**: Check CHANGELOG.md for breaking changes
3. **Test Isolation**: Create minimal reproduction case
4. **Report Details**: Include version numbers, error messages, code samples

---

## Migration Checklist

### Pre-Migration
- [ ] Backup your current working code
- [ ] Review CHANGELOG.md for breaking changes
- [ ] Test in development environment first
- [ ] Update Python version if required
- [ ] Check dependency compatibility

### During Migration
- [ ] Update SDK version: `pip install --upgrade claude-code-sdk`
- [ ] Run your test suite
- [ ] Update code for breaking changes
- [ ] Test integration with automatic-claude-code
- [ ] Verify performance hasn't regressed

### Post-Migration
- [ ] Update documentation
- [ ] Deploy to staging environment
- [ ] Monitor for issues
- [ ] Update CI/CD pipelines
- [ ] Notify team members of changes

---

*This migration guide will be updated with each release. Check the latest version at https://github.com/yourusername/claude-code-python-sdk/blob/main/MIGRATION.md*