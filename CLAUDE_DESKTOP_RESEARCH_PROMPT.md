# Deep Research Request: Programmatic Claude Code Session Management Without API Keys

## Context and Background

I have developed an automation system called "Automatic Claude Code" (ACC) that runs Claude Code in a loop to complete complex development tasks iteratively. The system currently faces a critical limitation: it requires API keys with credits to function because it uses the `-p` (print/headless) flag for non-interactive execution.

Many users, including myself, have Claude subscriptions but not API credits. We need to find a way to use Claude Code programmatically with subscription authentication instead of API keys.

## Current System Architecture

### What ACC Does:
- Spawns Claude Code as a child process using Node.js
- Passes prompts and captures outputs
- Maintains session continuity using `--resume` flag
- Parses responses to determine next actions
- Implements Manager-Worker dual-agent coordination
- Tracks progress through multiple iterations

### Current Implementation:
```javascript
// Simplified version of how ACC currently works
const claudeProcess = spawn('npx', [
    '@anthropic-ai/claude-code',
    '-p',  // Print mode (headless) - REQUIRES API KEY
    prompt,
    '--model', 'sonnet',
    '--dangerously-skip-permissions',
    '--resume', sessionId
], { shell: true });
```

### The Core Problem:
- `-p` flag enables headless/non-interactive mode but ONLY works with API keys
- Without `-p` flag, Claude Code runs interactively and waits for user input
- Subscription authentication (OAuth tokens from `setup-token`) doesn't work with `-p`
- We need programmatic control while using subscription authentication

## Research Questions

### 1. Alternative Execution Methods
- Is there any undocumented flag or environment variable that enables non-interactive mode with subscription auth?
- Can we use stdin/stdout piping to communicate with Claude Code in interactive mode programmatically?
- Are there WebSocket or IPC mechanisms we could leverage for session control?
- Does Claude Code have any API endpoints or local server mode we could interact with?

### 2. Session Management Deep Dive
- How exactly does the `--resume` flag work internally?
- Where are session states stored and can we manipulate them directly?
- Is there a way to pre-authenticate a session and reuse it programmatically?
- Can we create a persistent authenticated session that child processes can inherit?

### 3. Authentication Mechanisms
- What's the exact difference between OAuth tokens (from subscription) and API keys at the technical level?
- Is there a way to convert or bridge between subscription auth and API-compatible auth?
- Can we intercept and modify the authentication flow to make subscriptions work in headless mode?
- Are there any configuration files or environment variables that could override the auth requirements?

### 4. Process Communication Strategies
- Could we use a pseudo-TTY (pty) to simulate an interactive terminal while maintaining programmatic control?
- Is it possible to use named pipes or Unix sockets to communicate with Claude Code?
- Can we leverage the browser automation approach (like Playwright) to control Claude Code's UI programmatically?
- Would a screen/tmux session approach work for managing Claude Code instances?

### 5. Alternative Architectures
- Could we modify Claude Code's source (if available) to add a subscription-compatible headless mode?
- Is there a way to create a proxy or wrapper that translates between interactive and programmatic modes?
- Can we use the Claude Code VS Code extension's internals for programmatic access?
- Would running Claude Code in a Docker container with special configurations help?

## Technical Requirements

### Must Have:
1. Programmatic control over Claude Code execution
2. Ability to pass prompts and capture responses
3. Session persistence and continuity
4. Works with Claude subscription (not API keys)
5. Cross-platform compatibility (Windows, macOS, Linux)

### Nice to Have:
1. Minimal latency between iterations
2. Clean process management and error handling
3. Ability to run multiple concurrent sessions
4. Support for all Claude Code features (tools, MCP servers, etc.)

## Specific Technical Investigation Areas

### 1. Claude Code Internals
Please investigate:
- The complete list of CLI flags and environment variables (including undocumented ones)
- The authentication flow and where auth checks happen
- How session data is stored and accessed
- The difference between interactive and print modes at the code level

### 2. Node.js Child Process Alternatives
Research these approaches:
- Using `node-pty` for pseudo-terminal allocation
- Implementing expect-style scripting with libraries like `node-expect`
- Creating a custom REPL wrapper around Claude Code
- Using `xvfb` or similar for headless GUI automation

### 3. Authentication Workarounds
Explore:
- Setting up a local proxy that adds API key headers while using subscription auth
- Creating a mock API key that redirects to subscription auth
- Using browser automation to handle the OAuth flow programmatically
- Investigating if Claude Code accepts auth through alternative methods

### 4. Example Implementations
Please provide code examples for:
- Controlling an interactive CLI program from Node.js
- Managing persistent sessions with proper cleanup
- Handling stdin/stdout communication with buffering
- Implementing timeout and error recovery mechanisms

## Expected Deliverables

1. **Feasibility Assessment**: Can this be done? If yes, what's the best approach?

2. **Technical Proof of Concept**: Minimal working example showing:
   - How to spawn Claude Code without `-p` flag
   - How to send prompts programmatically
   - How to capture responses
   - How to maintain session state

3. **Implementation Guide**: Step-by-step instructions for:
   - Setting up the environment
   - Handling authentication
   - Managing the Claude Code process
   - Parsing outputs and maintaining state

4. **Code Samples**: Complete, working code examples in JavaScript/TypeScript showing the recommended approach

5. **Limitations and Workarounds**: Clear documentation of:
   - What won't work and why
   - Potential issues and how to handle them
   - Performance implications
   - Security considerations

## Additional Context

### Current File Structure:
- Main orchestrator: `src/index.ts`
- Claude executor: `src/services/claudeExecutor.ts`
- Session manager: `src/sessionManager.ts`
- Output parser: `src/outputParser.ts`

### Environment:
- Node.js 18+
- TypeScript
- Windows (primary) with WSL, macOS, and Linux support needed
- npm/pnpm package management

### Related Research:
- Similar tools like Auto-GPT, AgentGPT have solved similar problems
- VS Code extensions manage language servers programmatically
- Terminal multiplexers (screen, tmux) handle session management

## Priority Research Paths

Please prioritize investigating these approaches in order:

1. **Interactive Mode Control**: Using node-pty or similar to control Claude Code without `-p` flag
2. **Session Hijacking**: Finding ways to reuse authenticated sessions programmatically  
3. **Browser Automation**: Using Playwright/Puppeteer if Claude Code has a web interface
4. **Custom Authentication**: Building a bridge between subscription and API-style auth
5. **Alternative Tools**: If none work, what alternatives exist for subscription users?

## Success Criteria

A successful solution would:
- Allow ACC to work with Claude subscriptions without requiring API credits
- Maintain all current functionality (iterations, session management, dual-agent mode)
- Be reliable and maintainable
- Not violate Anthropic's terms of service
- Work cross-platform

Please provide comprehensive research on these approaches, with specific focus on practical implementation details and working code examples where possible.