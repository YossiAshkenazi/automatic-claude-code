# Simple Claude SDK Implementation

The absolute simplest way to use Claude's TypeScript SDK with streaming output.

## Setup

1. **Install dependencies:**
   ```bash
   pnpm install @anthropic-ai/sdk
   # or npm install @anthropic-ai/sdk
   ```

2. **Set your API key:**
   ```bash
   export ANTHROPIC_API_KEY="your-api-key-here"
   # or on Windows:
   set ANTHROPIC_API_KEY=your-api-key-here
   ```

## Usage

### Option 1: JavaScript (No compilation needed)
```bash
node run-simple.js "Write a hello world function"
```

### Option 2: TypeScript (requires tsx)
```bash
# Install tsx globally if not already installed
npm install -g tsx

# Run the TypeScript version
tsx simple-claude-sdk.ts "Write a hello world function"
```

## What it does

- ✅ Connects to Claude API using official SDK
- ✅ Streams response in real-time as it arrives
- ✅ Handles errors gracefully  
- ✅ Takes prompt as command line argument
- ✅ Minimal dependencies (just the Anthropic SDK)
- ✅ Works immediately with no complex setup

## Example Output

```bash
$ node run-simple.js "Write a TypeScript hello world"

🚀 Starting Claude SDK task...
📋 Task: Write a TypeScript hello world

💭 Sending prompt to Claude...
📝 Response (streaming):
---
Here's a simple TypeScript "Hello World" program:

```typescript
function sayHello(name: string = "World"): void {
  console.log(`Hello, ${name}!`);
}

sayHello();
sayHello("TypeScript");
```

This program defines a function that takes an optional name parameter...
---
✅ Task completed successfully!
```

That's it! No complex setup, no dual agents, just Claude SDK streaming directly to your terminal.