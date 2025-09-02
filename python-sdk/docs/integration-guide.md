# Python SDK Integration Guide

**Claude CLI Wrapper - Authentication and Setup Guide**  
**Version**: 1.1.0 | **Updated**: September 2, 2025

This guide covers the complete setup process for the Claude CLI Wrapper Python SDK, including authentication, platform-specific configurations, and troubleshooting.

## 🎯 Overview

The Python SDK provides direct integration with Claude Code CLI, bypassing the need for API key management by leveraging Claude CLI's existing authentication system.

### Key Benefits
- ✅ **No API Key Management** - Uses Claude CLI authentication
- ✅ **Cross-Platform** - Windows, macOS, Linux support
- ✅ **Enhanced Parsing** - 14 pattern types for comprehensive output handling
- ✅ **Async Resource Management** - Production-ready process handling
- ✅ **Automatic Error Detection** - Authentication issues detected with guidance

## 📋 Prerequisites

### System Requirements
- **Python 3.8+** (tested with 3.8-3.13)
- **Node.js 16+** (for Claude CLI installation)
- **Operating System**: Windows 10+, macOS 10.14+, or Linux (Ubuntu 20.04+)

### Claude CLI Installation

#### Step 1: Install Claude CLI

```bash
# Install globally via npm
npm install -g @anthropic-ai/claude-code

# Verify installation
claude --version
```

#### Step 2: Claude CLI Authentication

The Claude CLI supports multiple authentication methods. Choose the one that works for your setup:

**Method A: Setup Token (Recommended)**
```bash
# Run the setup wizard
claude setup-token

# Follow the prompts to:
# 1. Enter your Anthropic API key
# 2. Choose default model (sonnet recommended)
# 3. Configure default settings
```

**Method B: Direct Authentication**
```bash
# If setup-token doesn't work, try:
claude auth

# Or set environment variable:
export ANTHROPIC_API_KEY="your-api-key-here"
```

#### Step 3: Verify Claude CLI Setup

```bash
# Test Claude CLI directly
claude run "hello world" -i 1

# Should output:
# Hello! How can I help you today?
```

## 🐍 Python SDK Setup

### Step 1: Get the Python SDK

```bash
# Clone the main project
git clone https://github.com/YossiAshkenazi/automatic-claude-code.git
cd automatic-claude-code/python-sdk

# No additional dependencies needed!
# The wrapper uses only Python standard library
```

### Step 2: Verify SDK Installation

```bash
# Test basic imports
python -c "from claude_cli_wrapper import ClaudeCliWrapper; print('✅ SDK imported successfully')"

# Run comprehensive demo
python examples/enhanced_cli_wrapper_demo.py

# Run test suite
python run_tests.py
```

### Step 3: Integration Test

```bash
# Test with real Claude CLI (requires authentication)
python test_real_claude.py
```

## 🔧 Configuration

### Basic Configuration

```python
from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions

# Default configuration
options = ClaudeCliOptions()
wrapper = ClaudeCliWrapper(options)

# Custom configuration
options = ClaudeCliOptions(
    model="sonnet",                    # sonnet, opus, haiku
    timeout=300,                      # 5-minute timeout
    max_turns=10,                     # Conversation turns
    allowed_tools=["Read", "Write", "Edit", "Bash"],
    verbose=True,                     # Detailed logging
    dangerously_skip_permissions=False  # Safety mode
)
wrapper = ClaudeCliWrapper(options)
```

### Environment Variables

The SDK respects several environment variables:

```bash
# Claude CLI path (if not in PATH)
export CLAUDE_CLI_PATH="/custom/path/to/claude"

# Anthropic API key (fallback)
export ANTHROPIC_API_KEY="your-key-here"

# Enable debug logging
export CLAUDE_DEBUG="1"
```

### Platform-Specific Setup

#### Windows

```powershell
# PowerShell setup
# 1. Install Node.js from nodejs.org
# 2. Install Claude CLI
npm install -g @anthropic-ai/claude-code

# 3. If PATH issues occur:
$env:PATH += ";C:\Users\$env:USERNAME\AppData\Roaming\npm"

# 4. Verify
claude --version

# 5. Test Python SDK
python -c "from claude_cli_wrapper import ClaudeCliWrapper; print('Windows setup complete')"
```

#### macOS

```bash
# Using Homebrew (recommended)
brew install node
npm install -g @anthropic-ai/claude-code

# Alternative: Direct Node.js install
# Download from nodejs.org and follow installer

# Verify installation
claude --version
which claude  # Should show path

# Test Python SDK
python3 -c "from claude_cli_wrapper import ClaudeCliWrapper; print('macOS setup complete')"
```

#### Linux (Ubuntu/Debian)

```bash
# Install Node.js via NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Claude CLI
sudo npm install -g @anthropic-ai/claude-code

# Fix permissions if needed
sudo chown -R $(whoami) $(npm config get prefix)/lib/node_modules

# Verify installation
claude --version

# Test Python SDK
python3 -c "from claude_cli_wrapper import ClaudeCliWrapper; print('Linux setup complete')"
```

## 🔐 Authentication Workflows

### Workflow 1: Standard Setup

```bash
# 1. Install and authenticate Claude CLI
npm install -g @anthropic-ai/claude-code
claude setup-token
# Enter your Anthropic API key when prompted

# 2. Test Claude CLI
claude run "test" -i 1

# 3. Use Python SDK (inherits authentication)
python -c "
import asyncio
from claude_cli_wrapper import ClaudeCliSimple
claude = ClaudeCliSimple()
print('Ready to use!')
"
```

### Workflow 2: API Key Environment

```bash
# 1. Set environment variable
export ANTHROPIC_API_KEY="your-api-key"

# 2. Install Claude CLI
npm install -g @anthropic-ai/claude-code

# 3. Test (should use environment API key)
claude run "test" -i 1

# 4. Use Python SDK
python examples/enhanced_cli_wrapper_demo.py
```

### Workflow 3: Custom CLI Path

```python
# If Claude CLI is in non-standard location
from claude_cli_wrapper import ClaudeCliOptions, ClaudeCliWrapper

options = ClaudeCliOptions(cli_path="/custom/path/to/claude")
wrapper = ClaudeCliWrapper(options)

# The SDK will use your custom path
```

## 🐛 Troubleshooting

### Common Issues and Solutions

#### Issue 1: Claude CLI Not Found

**Error:**
```
FileNotFoundError: Claude CLI not found. Please install with: npm install -g @anthropic-ai/claude-code
```

**Solution:**
```bash
# 1. Install Claude CLI
npm install -g @anthropic-ai/claude-code

# 2. Verify installation
claude --version
which claude  # Should show path

# 3. If still not found, check PATH
echo $PATH | grep npm

# 4. Add npm global path if needed (example):
export PATH="$PATH:$(npm config get prefix)/bin"
```

#### Issue 2: Authentication Errors

**Error:**
```
Authentication failed: Invalid API key
Please run: claude setup-token
```

**Solution:**
```bash
# 1. Run setup-token
claude setup-token

# 2. Enter valid Anthropic API key
# Get key from: https://console.anthropic.com/

# 3. Test authentication
claude run "test authentication" -i 1

# 4. If still failing, try environment variable:
export ANTHROPIC_API_KEY="your-key"
```

#### Issue 3: Permission Errors

**Error:**
```
PermissionError: Permission denied executing Claude CLI
```

**Solution:**
```bash
# macOS/Linux: Fix permissions
sudo chmod +x $(which claude)

# Windows: Run as Administrator
# Right-click PowerShell -> "Run as Administrator"

# Alternative: Install with different permissions
npm install -g @anthropic-ai/claude-code --unsafe-perm=true --allow-root
```

#### Issue 4: Timeout Errors

**Error:**
```
ClaudeTimeoutError: Execution timed out after 300 seconds
```

**Solution:**
```python
# Increase timeout for complex tasks
from claude_cli_wrapper import ClaudeCliOptions, ClaudeCliWrapper

options = ClaudeCliOptions(
    timeout=1800  # 30 minutes
)
wrapper = ClaudeCliWrapper(options)

# Or break down complex tasks into smaller parts
```

#### Issue 5: Windows Console Encoding

**Error:**
```
UnicodeDecodeError: 'utf-8' codec can't decode byte...
```

**Solution:**
```python
# The SDK handles this automatically, but if issues persist:
import os
os.environ["PYTHONIOENCODING"] = "utf-8"

# Or use Windows-specific console:
chcp 65001  # In Command Prompt
```

### Debug Mode

Enable detailed debugging:

```python
import logging
from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions

# Enable debug logging
logging.basicConfig(level=logging.DEBUG)

# Use verbose mode
options = ClaudeCliOptions(verbose=True)
wrapper = ClaudeCliWrapper(options)

# Monitor what's happening
async def debug_execution():
    async for message in wrapper.execute("test prompt"):
        print(f"[{message.type}] {message.content[:100]}")
        print(f"Metadata: {message.metadata}")
```

### Health Check Script

```python
#!/usr/bin/env python3
"""Health check script for Claude CLI Wrapper setup"""

import asyncio
import subprocess
import sys
from pathlib import Path

def check_python_version():
    """Check Python version"""
    version = sys.version_info
    if version.major == 3 and version.minor >= 8:
        print(f"✅ Python {version.major}.{version.minor}.{version.micro}")
        return True
    else:
        print(f"❌ Python {version.major}.{version.minor}.{version.micro} - Requires 3.8+")
        return False

def check_claude_cli():
    """Check Claude CLI installation"""
    try:
        result = subprocess.run(["claude", "--version"], 
                               capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            print(f"✅ Claude CLI: {result.stdout.strip()}")
            return True
        else:
            print(f"❌ Claude CLI error: {result.stderr.strip()}")
            return False
    except FileNotFoundError:
        print("❌ Claude CLI not found - run: npm install -g @anthropic-ai/claude-code")
        return False
    except subprocess.TimeoutExpired:
        print("❌ Claude CLI timeout - check installation")
        return False

def check_sdk_imports():
    """Check SDK imports"""
    try:
        from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions, ClaudeCliSimple
        print("✅ SDK imports successful")
        return True
    except ImportError as e:
        print(f"❌ SDK import error: {e}")
        return False

async def check_sdk_functionality():
    """Check basic SDK functionality"""
    try:
        from claude_cli_wrapper import ClaudeCliWrapper
        wrapper = ClaudeCliWrapper()
        print(f"✅ SDK initialized - CLI path: {wrapper.cli_path}")
        return True
    except Exception as e:
        print(f"❌ SDK initialization error: {e}")
        return False

async def main():
    """Run complete health check"""
    print("Claude CLI Wrapper - Health Check")
    print("=" * 40)
    
    checks = [
        ("Python Version", check_python_version()),
        ("Claude CLI", check_claude_cli()),
        ("SDK Imports", check_sdk_imports()),
        ("SDK Functionality", await check_sdk_functionality())
    ]
    
    passed = sum(1 for _, check in checks if check)
    total = len(checks)
    
    print("\n" + "=" * 40)
    print(f"Health Check Results: {passed}/{total} passed")
    
    if passed == total:
        print("🎉 All checks passed! SDK is ready for use.")
        print("\nNext steps:")
        print("1. Run: python examples/enhanced_cli_wrapper_demo.py")
        print("2. Run: python run_tests.py")
        print("3. Try: python test_real_claude.py (requires authentication)")
    else:
        print("❌ Some checks failed. Please review the errors above.")
        return 1
    
    return 0

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
```

Save as `health_check.py` and run:

```bash
python health_check.py
```

## 🚀 Getting Started Examples

### Example 1: Basic Query

```python
#!/usr/bin/env python3
"""Basic query example"""

import asyncio
from claude_cli_wrapper import ClaudeCliSimple

def main():
    # Simple synchronous usage
    claude = ClaudeCliSimple(model="sonnet", verbose=True)
    
    result = claude.query("Write a Python function to calculate the factorial of a number")
    print("Result:")
    print(result)

if __name__ == "__main__":
    main()
```

### Example 2: Async Streaming

```python
#!/usr/bin/env python3
"""Async streaming example"""

import asyncio
from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions

async def main():
    options = ClaudeCliOptions(
        model="sonnet",
        verbose=True,
        timeout=600
    )
    
    wrapper = ClaudeCliWrapper(options)
    
    print("Starting streaming query...")
    async for message in wrapper.execute("Create a simple web server using Python Flask"):
        if message.type == "stream":
            print(f"Claude: {message.content}")
        elif message.type == "tool_action":
            print(f"🔧 Tool: {message.content}")
        elif message.type == "auth_error":
            print(f"❌ Auth Error: {message.content}")
            break
        elif message.type == "error":
            print(f"❌ Error: {message.content}")
    
    print("Query completed!")

if __name__ == "__main__":
    asyncio.run(main())
```

### Example 3: Error Handling

```python
#!/usr/bin/env python3
"""Comprehensive error handling example"""

import asyncio
from claude_cli_wrapper import ClaudeCliWrapper, ClaudeCliOptions

async def main():
    options = ClaudeCliOptions(
        model="sonnet",
        timeout=180,  # 3 minutes
        verbose=True
    )
    
    wrapper = ClaudeCliWrapper(options)
    
    try:
        async for message in wrapper.execute("Analyze this codebase and suggest improvements"):
            if message.type == "auth_error":
                print("❌ Authentication required:")
                print(message.content)
                print("\nPlease run: claude setup-token")
                break
            elif message.type == "error":
                print(f"❌ Error occurred: {message.content}")
                if "timeout" in message.content.lower():
                    print("💡 Consider increasing timeout or breaking down the task")
            elif message.type == "stream":
                print(f"📝 {message.content}")
            elif message.type == "result":
                print(f"✅ Result: {message.content}")
    
    except asyncio.TimeoutError:
        print("❌ Execution timed out")
    except asyncio.CancelledError:
        print("❌ Execution was cancelled")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
    finally:
        await wrapper.cleanup()
        print("🧹 Cleanup completed")

if __name__ == "__main__":
    asyncio.run(main())
```

## 🔗 Next Steps

1. **Run the Examples**: Try the examples above to verify your setup
2. **Read the API Documentation**: See `docs/api-reference.md` for complete API details
3. **Explore Advanced Features**: Check `docs/testing-procedures.md` for testing capabilities
4. **Join the Community**: Report issues and share feedback in the main project repository

## 📚 Additional Resources

- **[Main Project Documentation](../../README.md)** - Complete ACC project overview
- **[Python SDK API Reference](./api-reference.md)** - Detailed API documentation
- **[Testing Procedures](./testing-procedures.md)** - Testing and validation guide
- **[Claude CLI Documentation](https://docs.anthropic.com/claude-code)** - Official Claude CLI docs

---

**Claude CLI Wrapper Python SDK Integration Guide**  
Part of the Automatic Claude Code project - Enhanced Python SDK for Claude CLI integration