# Simple Claude CLI Integration

Uses your Claude.ai subscription through Claude Code CLI - no separate API key needed!

## Prerequisites

1. **Install Claude Code CLI:**
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

2. **Authenticate (one-time setup):**
   ```bash
   claude auth login
   ```
   This uses your existing Claude.ai subscription!

## Usage

### Basic Version (simple-claude-cli.js)
```bash
node simple-claude-cli.js "say hello"
node simple-claude-cli.js "write a TypeScript function"
node simple-claude-cli.js "explain async/await"
```

### Advanced Version (simple-claude-cli-advanced.js)
```bash
# Basic usage
node simple-claude-cli-advanced.js "say hello"

# With model selection
node simple-claude-cli-advanced.js "complex task" --model=opus

# With verbose output
node simple-claude-cli-advanced.js "debug this" --verbose

# With custom timeout
node simple-claude-cli-advanced.js "long task" --timeout=120000
```

## Features

### Basic Version ✅
- Real-time streaming output
- Uses your Claude subscription
- Error handling
- No API key needed

### Advanced Version ✅
- Model selection (sonnet/opus/haiku)
- Configurable timeouts
- Verbose mode
- CLI health checking
- Better error messages
- Usage statistics

## Example Output

```bash
$ node simple-claude-cli-advanced.js "write hello world in typescript"

🔍 Checking Claude CLI...
✅ Claude CLI found and working
🚀 Starting Claude CLI task...
📋 Task: write hello world in typescript

Here's a simple "Hello World" program in TypeScript:

```typescript
function sayHello(name: string = "World"): void {
    console.log(`Hello, ${name}!`);
}

// Call the function
sayHello();
sayHello("TypeScript");
```

This program:
- Defines a function with a default parameter
- Uses proper TypeScript typing
- Demonstrates string interpolation
- Shows both default and custom calls
---
✅ Task completed successfully!
```

## Why This Approach?

✅ **Uses your subscription** - No separate API payments  
✅ **Real-time streaming** - See output as Claude generates it  
✅ **No authentication hassle** - Uses Claude CLI's auth  
✅ **All Claude features** - Full access to models and capabilities  
✅ **Simple integration** - Just spawn a process  

## Troubleshooting

**"Claude CLI not found"**:
```bash
npm install -g @anthropic-ai/claude-code
claude --version  # Should show version number
```

**Authentication issues**:
```bash
claude auth logout
claude auth login  # Re-authenticate
```

**Permission errors**:
```bash
# Windows: Run PowerShell as Administrator
# Mac/Linux: Use sudo for npm install -g
```

This is the correct approach for using your Claude.ai subscription programmatically! 🎉