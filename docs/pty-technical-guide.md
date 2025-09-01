# PTY Technical Guide - Advanced Claude Code Control

## Overview

Version 1.2.0 introduces a revolutionary PTY-based Claude Code control system that replaces API key dependencies with subscription-compatible OAuth authentication. This technical guide provides in-depth information about the PTY implementation, architecture, and advanced usage patterns.

## PTY Architecture

### Core Components

#### 1. PTY Controller (`src/services/ptyController.ts`)

The PTY Controller manages interactive Claude Code sessions using pseudo-terminals:

```typescript
interface PTYControllerOptions {
  sessionId?: string;
  logger?: Logger;
  oauthToken?: string;
  workDir?: string;
  maxSessions?: number;
  sessionTimeout?: number;
}

class ClaudeCodePTYController extends EventEmitter {
  // Key methods:
  initialize(workDir?: string): Promise<void>
  sendPrompt(prompt: string): Promise<string>
  cleanup(): Promise<void>
}
```

**Key Features**:
- Cross-platform PTY support (Windows ConPTY, Unix PTY)
- Automatic OAuth token extraction
- Session lifecycle management
- Real-time stream processing
- ANSI code handling and JSON detection

#### 2. Enhanced Claude Executor (`src/services/claudeExecutor.ts`)

Centralized execution service with PTY integration:

```typescript
class ClaudeExecutor {
  // PTY-specific methods:
  createPTYSession(options: PTYSessionOptions): Promise<string>
  executePTYPrompt(sessionId: string, prompt: string): Promise<ClaudeExecutionResult>
  cleanupPTYSession(sessionId: string): Promise<void>
  
  // OAuth integration:
  extractOAuthToken(): Promise<string | null>
}
```

**Capabilities**:
- Up to 28 concurrent PTY sessions
- Automatic fallback to headless mode
- OAuth token caching and management
- Enhanced error handling and recovery

#### 3. Advanced Stream Parser (`src/outputParser.ts`)

Next-generation output processing:

```typescript
interface StreamProcessingOptions {
  enableJsonDetection: boolean;
  stripAnsiCodes: boolean;
  parseToolUsage: boolean;
  extractErrorMessages: boolean;
  bufferSize: number;
}

class OutputParser {
  parseStreamOutput(rawOutput: string, options: StreamProcessingOptions): ParsedOutput
  detectJsonBlocks(stream: string): JsonBlock[]
  extractToolUsage(output: string): ToolUsage[]
}
```

**Advanced Features**:
- Real-time JSON stream detection
- ANSI escape sequence handling
- Tool usage categorization
- Error message extraction
- Buffer management for large outputs

### OAuth Token Extraction

#### Cross-Platform Credential Access

**Windows Integration**:
```typescript
// Windows Credential Manager access
import { execSync } from 'child_process';

function extractWindowsCredentials(): string | null {
  try {
    const result = execSync('cmdkey /list | findstr "claude"', { encoding: 'utf8' });
    // Parse Windows credential output
    return parseCredentialData(result);
  } catch (error) {
    return null;
  }
}
```

**macOS Keychain Access**:
```typescript
// macOS Security Framework integration
function extractMacOSCredentials(): string | null {
  try {
    const result = execSync(
      'security find-generic-password -s "claude" -w', 
      { encoding: 'utf8' }
    );
    return result.trim();
  } catch (error) {
    return null;
  }
}
```

**Linux Credential Files**:
```typescript
// Linux credential file parsing
function extractLinuxCredentials(): string | null {
  const credentialPaths = [
    path.join(os.homedir(), '.claude', 'credentials'),
    path.join(os.homedir(), '.claude', 'auth.json')
  ];
  
  for (const credPath of credentialPaths) {
    try {
      const credentials = JSON.parse(fs.readFileSync(credPath, 'utf8'));
      return credentials.token || credentials.access_token;
    } catch (error) {
      continue;
    }
  }
  return null;
}
```

## PTY Session Management

### Session Lifecycle

1. **Initialization Phase**:
   ```typescript
   // Create PTY process with Claude Code
   this.ptyProcess = pty.spawn('claude', args, {
     name: 'xterm-color',
     cols: 120,
     rows: 30,
     cwd: workDir,
     env: processEnv
   });
   ```

2. **Authentication Phase**:
   ```typescript
   // OAuth token injection
   if (this.oauthToken) {
     env.CLAUDE_CODE_OAUTH_TOKEN = this.oauthToken;
   }
   
   // Remove API key to force subscription auth
   delete env.ANTHROPIC_API_KEY;
   ```

3. **Interactive Session**:
   ```typescript
   // Send prompts and receive responses
   await this.sendPrompt(userPrompt);
   const response = await this.waitForResponse();
   ```

4. **Cleanup Phase**:
   ```typescript
   // Graceful session termination
   await this.cleanup();
   this.ptyProcess.kill('SIGTERM');
   ```

### Resource Management

**Session Pool Management**:
```typescript
class PTYSessionPool {
  private activeSessions: Map<string, PTYSession> = new Map();
  private maxSessions: number = 28;
  
  async createSession(options: SessionOptions): Promise<string> {
    if (this.activeSessions.size >= this.maxSessions) {
      await this.cleanupOldestSession();
    }
    
    const session = new PTYSession(options);
    const sessionId = generateSessionId();
    this.activeSessions.set(sessionId, session);
    
    return sessionId;
  }
}
```

**Memory Management**:
- Each PTY session uses approximately 30-50MB of memory
- Automatic cleanup of inactive sessions after timeout
- Buffer size limits prevent memory leaks
- Garbage collection for completed sessions

## Stream Processing Architecture

### Real-Time JSON Detection

```typescript
class JsonStreamDetector {
  private buffer: string = '';
  private jsonStack: number = 0;
  
  processChunk(chunk: string): JsonBlock[] {
    this.buffer += chunk;
    return this.extractCompleteJsonBlocks();
  }
  
  private extractCompleteJsonBlocks(): JsonBlock[] {
    const blocks: JsonBlock[] = [];
    let startIndex = -1;
    
    for (let i = 0; i < this.buffer.length; i++) {
      const char = this.buffer[i];
      
      if (char === '{') {
        if (this.jsonStack === 0) startIndex = i;
        this.jsonStack++;
      } else if (char === '}') {
        this.jsonStack--;
        if (this.jsonStack === 0 && startIndex !== -1) {
          const jsonStr = this.buffer.substring(startIndex, i + 1);
          blocks.push(this.parseJsonBlock(jsonStr));
        }
      }
    }
    
    return blocks;
  }
}
```

### ANSI Code Processing

```typescript
function stripAnsiCodes(text: string): string {
  // Remove ANSI escape sequences
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

function preserveFormattingContext(text: string): FormattedText {
  // Extract formatting information before stripping
  const formatting = extractAnsiFormatting(text);
  const cleanText = stripAnsiCodes(text);
  
  return {
    text: cleanText,
    formatting: formatting,
    originalLength: text.length
  };
}
```

## Advanced Configuration

### PTY Mode Configuration

```json
{
  "ptyMode": {
    "enabled": true,
    "maxSessions": 28,
    "sessionTimeout": 300000,
    "autoCleanup": true,
    "oauthTokenExtraction": true,
    "fallbackToHeadless": true,
    "bufferSize": 8192,
    "streamProcessing": {
      "enableJsonDetection": true,
      "stripAnsiCodes": true,
      "parseToolUsage": true,
      "extractErrorMessages": true,
      "batchProcessing": false,
      "realTimeUpdates": true
    },
    "platformSpecific": {
      "windows": {
        "useConPTY": true,
        "credentialManager": true
      },
      "macos": {
        "keychainAccess": true,
        "securityFramework": true
      },
      "linux": {
        "credentialFiles": [
          "~/.claude/credentials",
          "~/.claude/auth.json"
        ]
      }
    }
  }
}
```

### Dual-Agent PTY Integration

```json
{
  "dualAgentMode": {
    "usePTY": true,
    "managerPTYSessions": 5,
    "workerPTYSessions": 10,
    "coordinationTimeout": 30000,
    "sessionIsolation": true,
    "sharedContextMode": false,
    "ptyCoordination": {
      "enableCrossSessionCommunication": true,
      "sharedTokens": true,
      "sessionAffinity": true
    }
  }
}
```

## Performance Optimization

### Memory Optimization

```typescript
// Efficient buffer management
class CircularBuffer {
  private buffer: string[] = [];
  private maxSize: number;
  private currentIndex: number = 0;
  
  add(chunk: string): void {
    if (this.buffer.length < this.maxSize) {
      this.buffer.push(chunk);
    } else {
      this.buffer[this.currentIndex] = chunk;
      this.currentIndex = (this.currentIndex + 1) % this.maxSize;
    }
  }
  
  getContent(): string {
    return this.buffer.join('');
  }
}
```

### Session Pooling

```typescript
// Reusable session pool
class PTYSessionPool {
  private idleSessions: PTYSession[] = [];
  private busySessions: Map<string, PTYSession> = new Map();
  
  async acquireSession(options: SessionOptions): Promise<PTYSession> {
    let session = this.idleSessions.pop();
    
    if (!session) {
      session = await this.createNewSession(options);
    } else {
      await session.configure(options);
    }
    
    this.busySessions.set(session.id, session);
    return session;
  }
  
  releaseSession(session: PTYSession): void {
    this.busySessions.delete(session.id);
    this.idleSessions.push(session);
  }
}
```

### Stream Processing Optimization

```typescript
// Optimized stream processing
class OptimizedStreamProcessor {
  private processingQueue: string[] = [];
  private isProcessing: boolean = false;
  
  async processStream(chunk: string): Promise<void> {
    this.processingQueue.push(chunk);
    
    if (!this.isProcessing) {
      this.isProcessing = true;
      await this.processBatch();
      this.isProcessing = false;
    }
  }
  
  private async processBatch(): Promise<void> {
    const batch = this.processingQueue.splice(0, 10); // Process 10 chunks at a time
    
    for (const chunk of batch) {
      await this.processChunk(chunk);
    }
    
    if (this.processingQueue.length > 0) {
      // Continue processing remaining chunks
      setImmediate(() => this.processBatch());
    }
  }
}
```

## Error Handling and Recovery

### PTY Error Recovery

```typescript
class PTYErrorHandler {
  async handleSessionFailure(session: PTYSession, error: Error): Promise<void> {
    console.error(`PTY session ${session.id} failed:`, error);
    
    // Attempt recovery strategies
    if (error instanceof PTYTimeoutError) {
      await this.extendSessionTimeout(session);
    } else if (error instanceof PTYAuthError) {
      await this.refreshOAuthToken(session);
    } else if (error instanceof PTYResourceError) {
      await this.cleanupAndRecreate(session);
    } else {
      // Fallback to headless mode
      await this.fallbackToHeadless(session);
    }
  }
  
  async fallbackToHeadless(session: PTYSession): Promise<void> {
    console.log(`Falling back to headless mode for session ${session.id}`);
    
    // Create headless session with same context
    const headlessSession = await this.createHeadlessSession({
      context: session.getContext(),
      model: session.model,
      workDir: session.workDir
    });
    
    // Transfer session state
    await this.transferSessionState(session, headlessSession);
  }
}
```

### OAuth Token Refresh

```typescript
async refreshOAuthToken(): Promise<string | null> {
  try {
    // Attempt to refresh expired token
    const newToken = await this.extractOAuthToken();
    
    if (newToken) {
      // Update all active sessions with new token
      for (const session of this.activeSessions.values()) {
        session.updateOAuthToken(newToken);
      }
      
      return newToken;
    }
  } catch (error) {
    console.error('Failed to refresh OAuth token:', error);
  }
  
  return null;
}
```

## Monitoring and Debugging

### PTY Session Monitoring

```typescript
class PTYMonitor {
  private metrics: Map<string, SessionMetrics> = new Map();
  
  collectMetrics(sessionId: string): SessionMetrics {
    return {
      memoryUsage: process.memoryUsage().heapUsed,
      sessionAge: Date.now() - this.sessions.get(sessionId)?.startTime,
      messageCount: this.sessions.get(sessionId)?.messageCount || 0,
      errorCount: this.sessions.get(sessionId)?.errorCount || 0,
      avgResponseTime: this.calculateAvgResponseTime(sessionId)
    };
  }
  
  generateReport(): PTYReport {
    return {
      totalSessions: this.activeSessions.size,
      memoryUsage: this.calculateTotalMemoryUsage(),
      performanceMetrics: this.calculatePerformanceMetrics(),
      errorRates: this.calculateErrorRates()
    };
  }
}
```

### Debug Mode

```bash
# Enable PTY debug mode
export ACC_DEBUG_PTY=true
export ACC_DEBUG_OAUTH=true
export ACC_DEBUG_STREAMS=true

# Run with comprehensive debugging
acc run "test task" --dual-agent --debug-pty --debug-streams -v
```

## Migration from Headless Mode

### Compatibility Layer

```typescript
class HeadlessPTYBridge {
  async executeWithCompatibility(prompt: string, options: ExecutionOptions): Promise<Result> {
    try {
      // Try PTY mode first
      return await this.executePTY(prompt, options);
    } catch (error) {
      console.warn('PTY mode failed, falling back to headless:', error.message);
      // Fallback to traditional headless mode
      return await this.executeHeadless(prompt, options);
    }
  }
}
```

### Gradual Migration Strategy

1. **Phase 1**: Enable PTY mode alongside existing headless mode
2. **Phase 2**: Default to PTY mode with headless fallback
3. **Phase 3**: PTY mode becomes primary with headless as emergency fallback

## Security Considerations

### OAuth Token Security

```typescript
class SecureTokenManager {
  private tokenCache: Map<string, CachedToken> = new Map();
  
  storeToken(token: string, expiry: Date): void {
    // Encrypt token before storing
    const encryptedToken = this.encrypt(token);
    this.tokenCache.set('oauth', {
      token: encryptedToken,
      expiry: expiry,
      lastUsed: new Date()
    });
  }
  
  private encrypt(data: string): string {
    // Use system-appropriate encryption
    return crypto.createCipher('aes-256-cbc', this.getSystemKey()).update(data, 'utf8', 'hex');
  }
}
```

### Session Isolation

```typescript
// Ensure PTY sessions are isolated
class IsolatedPTYSession {
  constructor(options: SessionOptions) {
    // Each session gets its own environment
    this.env = { ...process.env };
    
    // Unique session identifier
    this.sessionId = crypto.randomUUID();
    
    // Isolated working directory
    this.workDir = path.join(os.tmpdir(), 'acc-pty', this.sessionId);
  }
}
```

## Future Enhancements

### Planned Improvements

1. **Advanced Session Persistence**: Save and restore PTY sessions across restarts
2. **Distributed PTY Management**: Run PTY sessions across multiple machines
3. **Enhanced OAuth Integration**: Support for more authentication providers
4. **Performance Analytics**: Advanced metrics and performance optimization
5. **Cloud PTY Support**: Run PTY sessions in cloud environments

### Experimental Features

```typescript
// Experimental: Distributed PTY sessions
class DistributedPTYManager {
  async createRemoteSession(nodeId: string, options: SessionOptions): Promise<string> {
    // Create PTY session on remote node
    const response = await this.sendToNode(nodeId, 'createPTYSession', options);
    return response.sessionId;
  }
}
```

---

This technical guide provides comprehensive information about the PTY implementation in ACC v1.2.0. For additional support or advanced use cases, refer to the troubleshooting guide and community resources.