import { describe, test, expect, vi, beforeEach, afterEach, MockedFunction } from 'vitest';
import { EventEmitter } from 'events';
import * as pty from '@lydell/node-pty';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ClaudeCodePTYController, ACCPTYManager } from '../services/ptyController';
import { Logger } from '../logger';
import { ClaudeUtils } from '../claudeUtils';

// Mock dependencies
vi.mock('@lydell/node-pty');
vi.mock('fs');
vi.mock('os');
vi.mock('path');
vi.mock('../logger');
vi.mock('../claudeUtils');

// Mock implementations
const mockPty = {
  spawn: vi.fn(),
  onData: vi.fn(),
  onExit: vi.fn(),
  write: vi.fn(),
  kill: vi.fn(),
  resize: vi.fn(),
  pid: 1234
};

const mockLogger = {
  info: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
};

describe('ClaudeCodePTYController', () => {
  let controller: ClaudeCodePTYController;
  let mockDataHandler: Function;
  let mockExitHandler: Function;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock node-pty spawn
    (pty.spawn as MockedFunction<typeof pty.spawn>).mockReturnValue(mockPty as any);
    
    // Mock Logger
    (Logger as any).mockImplementation(() => mockLogger);
    
    // Mock ClaudeUtils
    (ClaudeUtils.getClaudeCommand as MockedFunction<typeof ClaudeUtils.getClaudeCommand>)
      .mockReturnValue({ command: 'claude', args: [] });
    
    // Mock os methods
    (os.homedir as MockedFunction<typeof os.homedir>).mockReturnValue('/home/user');
    (os.platform as any).mockReturnValue('linux');
    
    // Mock path methods
    (path.join as MockedFunction<typeof path.join>).mockImplementation((...args) => args.join('/'));
    
    // Mock fs methods
    (fs.existsSync as MockedFunction<typeof fs.existsSync>).mockReturnValue(false);
    (fs.readFileSync as MockedFunction<typeof fs.readFileSync>).mockReturnValue('{}');
    (fs.readdirSync as MockedFunction<typeof fs.readdirSync>).mockReturnValue([]);

    // Setup PTY event handlers to capture them
    mockPty.onData.mockImplementation((handler: Function) => {
      mockDataHandler = handler;
    });
    mockPty.onExit.mockImplementation((handler: Function) => {
      mockExitHandler = handler;
    });

    controller = new ClaudeCodePTYController({
      logger: new Logger()
    });
  });

  afterEach(() => {
    if (controller) {
      controller.close();
    }
  });

  describe('Initialization', () => {
    test('should initialize with default options', () => {
      expect(controller).toBeInstanceOf(ClaudeCodePTYController);
      expect(controller).toBeInstanceOf(EventEmitter);
    });

    test('should initialize with custom options', () => {
      const customController = new ClaudeCodePTYController({
        logger: mockLogger,
        sessionId: 'test-session',
        oauthToken: 'test-token'
      });
      
      expect(customController.getSessionId()).toBe('test-session');
    });

    test('should initialize PTY process with correct arguments', async () => {
      const workDir = '/test/project';
      
      // Mock ready state
      const initPromise = controller.initialize(workDir);
      
      // Simulate ready event
      setTimeout(() => {
        if (mockDataHandler) {
          mockDataHandler('Ready\n');
        }
      }, 10);
      
      await initPromise;

      expect(pty.spawn).toHaveBeenCalledWith('claude', [
        '--continue',
        '--model', 'sonnet',
        '--dangerously-skip-permissions',
        '--output-format', 'stream-json',
        '--max-turns', '10'
      ], {
        name: 'xterm-color',
        cols: 120,
        rows: 30,
        cwd: workDir,
        env: expect.objectContaining({
          CLAUDE_CODE_USE_BEDROCK: '0',
          CLAUDE_CODE_ENABLE_TELEMETRY: '0'
        })
      });
    });

    test('should initialize with session resume', async () => {
      const sessionController = new ClaudeCodePTYController({
        sessionId: 'existing-session'
      });

      const initPromise = sessionController.initialize();
      
      // Simulate ready event
      setTimeout(() => {
        if (mockDataHandler) {
          mockDataHandler('Ready\n');
        }
      }, 10);
      
      await initPromise;

      expect(pty.spawn).toHaveBeenCalledWith('claude', 
        expect.arrayContaining([
          '--resume', 'existing-session'
        ]),
        expect.any(Object)
      );

      sessionController.close();
    });

    test('should handle initialization failure', async () => {
      (pty.spawn as MockedFunction<typeof pty.spawn>).mockImplementation(() => {
        throw new Error('Spawn failed');
      });

      await expect(controller.initialize()).rejects.toThrow('Spawn failed');
    });

    test('should wait for ready timeout', async () => {
      vi.useFakeTimers();
      
      try {
        const initPromise = controller.initialize();
        
        // Advance time to trigger timeout
        await vi.advanceTimersByTimeAsync(11000);
        
        await expect(initPromise).rejects.toThrow('Timeout waiting for Claude to be ready');
      } finally {
        vi.useRealTimers();
      }
    }, 15000);
  });

  describe('Process Spawning Configuration', () => {
    test('should spawn process without -p flag', async () => {
      const initPromise = controller.initialize();
      
      // Simulate ready event immediately
      process.nextTick(() => {
        if (mockDataHandler) {
          mockDataHandler('Ready\n');
        }
      });
      
      await initPromise;

      const spawnCall = (pty.spawn as MockedFunction<typeof pty.spawn>).mock.calls[0];
      const args = spawnCall[1];
      
      expect(args).not.toContain('-p');
      expect(args).not.toContain('--print');
    }, 10000);

    test('should configure environment for subscription auth', async () => {
      process.env.ANTHROPIC_API_KEY = 'test-api-key';
      
      const initPromise = controller.initialize();
      
      // Simulate ready event immediately
      process.nextTick(() => {
        if (mockDataHandler) {
          mockDataHandler('Ready\n');
        }
      });
      
      await initPromise;

      const spawnCall = (pty.spawn as MockedFunction<typeof pty.spawn>).mock.calls[0];
      const env = spawnCall[2].env;
      
      expect(env).not.toHaveProperty('ANTHROPIC_API_KEY');
      expect(env).toHaveProperty('CLAUDE_CODE_USE_BEDROCK', '0');
      expect(env).toHaveProperty('CLAUDE_CODE_ENABLE_TELEMETRY', '0');
    }, 10000);

    test('should include OAuth token in environment', async () => {
      const tokenController = new ClaudeCodePTYController({
        oauthToken: 'test-oauth-token'
      });

      const initPromise = tokenController.initialize();
      
      // Simulate ready event immediately
      process.nextTick(() => {
        if (mockDataHandler) {
          mockDataHandler('Ready\n');
        }
      });
      
      await initPromise;

      const spawnCall = (pty.spawn as MockedFunction<typeof pty.spawn>).mock.calls[0];
      const env = spawnCall[2].env;
      
      expect(env).toHaveProperty('CLAUDE_CODE_OAUTH_TOKEN', 'test-oauth-token');

      tokenController.close();
    }, 10000);
  });

  describe('Process Lifecycle Management', () => {
    beforeEach(async () => {
      const initPromise = controller.initialize();
      
      // Simulate ready event immediately
      process.nextTick(() => {
        if (mockDataHandler) {
          mockDataHandler('Ready\n');
        }
      });
      
      await initPromise;
    }, 15000);

    test('should handle process start successfully', () => {
      expect(mockPty.onData).toHaveBeenCalled();
      expect(mockPty.onExit).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Initializing PTY with Claude in interactive mode')
      );
    });

    test('should handle process exit gracefully', () => {
      const exitSpy = vi.fn();
      controller.on('exit', exitSpy);

      mockExitHandler({ exitCode: 0, signal: undefined });

      expect(exitSpy).toHaveBeenCalledWith({ exitCode: 0, signal: undefined });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'PTY process exited with code 0, signal undefined'
      );
    });

    test('should handle unexpected exit during prompt', async () => {
      const promptPromise = controller.sendPrompt('test prompt');
      
      // Simulate process exit while waiting for response
      mockExitHandler({ exitCode: 1 });
      
      await expect(promptPromise).rejects.toThrow('Process exited unexpectedly: 1');
    });

    test('should close process properly', async () => {
      // Wait a bit for the close operation to complete
      controller.close();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockPty.kill).toHaveBeenCalled();
    });

    test('should handle close when process not initialized', () => {
      const uninitializedController = new ClaudeCodePTYController();
      
      expect(() => uninitializedController.close()).not.toThrow();
    });
  });

  describe('Buffer Management and Streaming', () => {
    beforeEach(async () => {
      const initPromise = controller.initialize();
      
      // Simulate ready event immediately
      process.nextTick(() => {
        if (mockDataHandler) {
          mockDataHandler('Ready\n');
        }
      });
      
      await initPromise;
    }, 15000);

    test('should process JSON messages correctly', () => {
      const messageSpy = vi.fn();
      controller.on('message', messageSpy);

      const jsonMessage = JSON.stringify({ type: 'result', content: 'test result' });
      mockDataHandler(`${jsonMessage}\n`);

      expect(messageSpy).toHaveBeenCalledWith({ type: 'result', content: 'test result' });
    });

    test('should handle malformed JSON gracefully', () => {
      const messageSpy = vi.fn();
      controller.on('message', messageSpy);

      mockDataHandler('{"invalid": json}\n');

      // Should not crash, should process as text
      expect(messageSpy).not.toHaveBeenCalled();
    });

    test('should accumulate partial messages', () => {
      const messageSpy = vi.fn();
      controller.on('message', messageSpy);

      // Send partial JSON
      mockDataHandler('{"type": "result"');
      expect(messageSpy).not.toHaveBeenCalled();

      // Complete the JSON
      mockDataHandler(', "content": "test"}\n');
      expect(messageSpy).toHaveBeenCalledWith({ type: 'result', content: 'test' });
    });

    test('should process multiple messages in buffer', () => {
      const messageSpy = vi.fn();
      controller.on('message', messageSpy);

      const message1 = JSON.stringify({ type: 'result', content: 'first' });
      const message2 = JSON.stringify({ type: 'result', content: 'second' });
      
      mockDataHandler(`${message1}\n${message2}\n`);

      expect(messageSpy).toHaveBeenCalledTimes(2);
      expect(messageSpy).toHaveBeenNthCalledWith(1, { type: 'result', content: 'first' });
      expect(messageSpy).toHaveBeenNthCalledWith(2, { type: 'result', content: 'second' });
    });

    test('should handle ANSI escape sequences', () => {
      const messageSpy = vi.fn();
      controller.on('message', messageSpy);

      const jsonWithAnsi = `\x1b[32m${JSON.stringify({ type: 'result', content: 'colored' })}\x1b[0m\n`;
      mockDataHandler(jsonWithAnsi);

      expect(messageSpy).toHaveBeenCalledWith({ type: 'result', content: 'colored' });
    });

    test('should emit different message types correctly', async () => {
      const readySpy = vi.fn();
      const toolUseSpy = vi.fn();
      const errorSpy = vi.fn();
      
      controller.on('ready', readySpy);
      controller.on('tool_use', toolUseSpy);
      controller.on('error', errorSpy);

      mockDataHandler(`${JSON.stringify({ type: 'ready' })}\n`);
      mockDataHandler(`${JSON.stringify({ type: 'tool_use', tool: 'test' })}\n`);
      mockDataHandler(`${JSON.stringify({ type: 'error', error: 'test error' })}\n`);

      // Wait for events to process
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(readySpy).toHaveBeenCalled();
      expect(toolUseSpy).toHaveBeenCalledWith({ type: 'tool_use', tool: 'test' });
      expect(errorSpy).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('Error Handling Scenarios', () => {
    test('should handle Claude command not found', async () => {
      (ClaudeUtils.getClaudeCommand as MockedFunction<typeof ClaudeUtils.getClaudeCommand>)
        .mockImplementation(() => {
          throw new Error('Claude command not found');
        });

      await expect(controller.initialize()).rejects.toThrow('Claude command not found');
    });

    test('should handle PTY spawn failure', async () => {
      (pty.spawn as MockedFunction<typeof pty.spawn>).mockImplementation(() => {
        throw new Error('PTY spawn failed');
      });

      await expect(controller.initialize()).rejects.toThrow('PTY spawn failed');
    });

    test('should handle send prompt when not initialized', async () => {
      await expect(controller.sendPrompt('test')).rejects.toThrow('PTY process not initialized');
    });

    test('should handle send prompt when not ready', async () => {
      // Initialize without ready state
      const initPromise = controller.initialize();
      
      setTimeout(() => {
        // Don't send ready signal
      }, 10);

      vi.useFakeTimers();
      
      // Try to send prompt before ready
      const promptPromise = controller.sendPrompt('test');
      
      // Fast forward past ready timeout
      vi.advanceTimersByTime(11000);
      
      await expect(promptPromise).rejects.toThrow('Timeout waiting for Claude to be ready');
      
      vi.useRealTimers();
    });

    test('should handle prompt timeout', async () => {
      const initPromise = controller.initialize();
      
      setTimeout(() => {
        if (mockDataHandler) {
          mockDataHandler('Ready\n');
        }
      }, 10);
      
      await initPromise;

      vi.useFakeTimers();
      
      const promptPromise = controller.sendPrompt('test prompt');
      
      // Don't send response, let timeout occur
      vi.advanceTimersByTime(31000);
      
      await expect(promptPromise).rejects.toThrow('Prompt timeout');
      
      vi.useRealTimers();
    });

    test('should handle OAuth token extraction failure', async () => {
      // Mock all token extraction methods to fail
      (fs.existsSync as MockedFunction<typeof fs.existsSync>).mockReturnValue(false);
      delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
      delete process.env.CLAUDE_SESSION_TOKEN;

      const initPromise = controller.initialize();
      
      setTimeout(() => {
        if (mockDataHandler) {
          mockDataHandler('Ready\n');
        }
      }, 10);
      
      await initPromise;

      // Should still initialize successfully without token
      expect(pty.spawn).toHaveBeenCalled();
    });
  });

  describe('Concurrent Process Limits', () => {
    test('should handle multiple controllers simultaneously', async () => {
      const controllers: ClaudeCodePTYController[] = [];
      const maxControllers = 3;

      // Create multiple controllers
      for (let i = 0; i < maxControllers; i++) {
        const ctrl = new ClaudeCodePTYController({
          sessionId: `session-${i}`
        });
        controllers.push(ctrl);
      }

      // Initialize all controllers
      const initPromises = controllers.map(async (ctrl, index) => {
        const promise = ctrl.initialize(`/test/project-${index}`);
        
        // Simulate ready for each
        setTimeout(() => {
          if (mockDataHandler) {
            mockDataHandler('Ready\n');
          }
        }, 50 + index * 10);
        
        return promise;
      });

      await Promise.all(initPromises);

      // Verify all were spawned
      expect(pty.spawn).toHaveBeenCalledTimes(maxControllers);

      // Clean up
      controllers.forEach(ctrl => ctrl.close());
    });

    test('should handle controller creation failure in batch', async () => {
      const controllers: ClaudeCodePTYController[] = [];
      
      // Create controllers
      for (let i = 0; i < 3; i++) {
        controllers.push(new ClaudeCodePTYController({
          sessionId: `session-${i}`
        }));
      }

      // Make second spawn fail
      (pty.spawn as MockedFunction<typeof pty.spawn>)
        .mockImplementationOnce(() => mockPty as any)
        .mockImplementationOnce(() => {
          throw new Error('Second spawn failed');
        })
        .mockImplementationOnce(() => mockPty as any);

      // Initialize with mixed results
      const results = await Promise.allSettled(
        controllers.map(async (ctrl, index) => {
          const promise = ctrl.initialize(`/test/project-${index}`);
          
          if (index !== 1) { // Don't send ready for failing one
            setTimeout(() => {
              if (mockDataHandler) {
                mockDataHandler('Ready\n');
              }
            }, 50);
          }
          
          return promise;
        })
      );

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');

      // Clean up successful ones
      controllers[0].close();
      controllers[2].close();
    });
  });

  describe('PTY Features', () => {
    beforeEach(async () => {
      const initPromise = controller.initialize();
      
      // Simulate ready event immediately
      process.nextTick(() => {
        if (mockDataHandler) {
          mockDataHandler('Ready\n');
        }
      });
      
      await initPromise;
    }, 15000);

    test('should resize PTY correctly', () => {
      controller.resize(80, 24);
      
      expect(mockPty.resize).toHaveBeenCalledWith(80, 24);
    });

    test('should handle resize when not initialized', () => {
      const uninitializedController = new ClaudeCodePTYController();
      
      expect(() => uninitializedController.resize(80, 24)).not.toThrow();
    });

    test('should send prompts correctly', async () => {
      const promptPromise = controller.sendPrompt('test prompt');
      
      expect(mockPty.write).toHaveBeenCalledWith('test prompt\n');
      
      // Simulate response
      setTimeout(() => {
        if (mockDataHandler) {
          mockDataHandler('Response completed >>>\n');
        }
      }, 10);
      
      const response = await promptPromise;
      expect(response).toContain('Response completed');
    });
  });

  describe('OAuth Token Extraction', () => {
    test('should extract token from macOS keychain', async () => {
      (os.platform as any).mockReturnValue('darwin');
      
      // Mock successful keychain extraction
      const { exec } = require('child_process');
      const mockExec = vi.fn().mockResolvedValue({ stdout: 'keychain-token\n' });
      vi.doMock('child_process', () => ({
        exec: mockExec
      }));

      const tokenController = new ClaudeCodePTYController();
      
      const initPromise = tokenController.initialize();
      
      setTimeout(() => {
        if (mockDataHandler) {
          mockDataHandler('Ready\n');
        }
      }, 10);
      
      await initPromise;

      tokenController.close();
    });

    test('should extract token from Windows credential file', async () => {
      (os.platform as any).mockReturnValue('win32');
      (fs.existsSync as MockedFunction<typeof fs.existsSync>).mockReturnValue(true);
      (fs.readFileSync as MockedFunction<typeof fs.readFileSync>)
        .mockReturnValue(JSON.stringify({ oauth_token: 'windows-token' }));

      const tokenController = new ClaudeCodePTYController();
      
      const initPromise = tokenController.initialize();
      
      setTimeout(() => {
        if (mockDataHandler) {
          mockDataHandler('Ready\n');
        }
      }, 10);
      
      await initPromise;

      const spawnCall = (pty.spawn as MockedFunction<typeof pty.spawn>).mock.calls[0];
      const env = spawnCall[2].env;
      
      expect(env).toHaveProperty('CLAUDE_CODE_OAUTH_TOKEN', 'windows-token');

      tokenController.close();
    });

    test('should extract token from Linux credential file', async () => {
      (os.platform as any).mockReturnValue('linux');
      (fs.existsSync as MockedFunction<typeof fs.existsSync>).mockReturnValue(true);
      (fs.readFileSync as MockedFunction<typeof fs.readFileSync>)
        .mockReturnValue(JSON.stringify({ session_token: 'linux-token' }));

      const tokenController = new ClaudeCodePTYController();
      
      const initPromise = tokenController.initialize();
      
      setTimeout(() => {
        if (mockDataHandler) {
          mockDataHandler('Ready\n');
        }
      }, 10);
      
      await initPromise;

      const spawnCall = (pty.spawn as MockedFunction<typeof pty.spawn>).mock.calls[0];
      const env = spawnCall[2].env;
      
      expect(env).toHaveProperty('CLAUDE_CODE_OAUTH_TOKEN', 'linux-token');

      tokenController.close();
    });

    test('should detect existing session files', async () => {
      (fs.existsSync as MockedFunction<typeof fs.existsSync>)
        .mockImplementation((filePath) => {
          if (filePath.includes('projects')) return true;
          if (filePath.includes('conversation.jsonl')) return true;
          return false;
        });
      (fs.readdirSync as MockedFunction<typeof fs.readdirSync>)
        .mockReturnValue(['session1', 'session2']);

      const tokenController = new ClaudeCodePTYController();
      
      const initPromise = tokenController.initialize();
      
      setTimeout(() => {
        if (mockDataHandler) {
          mockDataHandler('Ready\n');
        }
      }, 10);
      
      await initPromise;

      const spawnCall = (pty.spawn as MockedFunction<typeof pty.spawn>).mock.calls[0];
      const env = spawnCall[2].env;
      
      expect(env).toHaveProperty('CLAUDE_CODE_OAUTH_TOKEN', 'session-exists');

      tokenController.close();
    });
  });
});

describe('ACCPTYManager', () => {
  let manager: ACCPTYManager;
  let mockDataHandler: Function;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock node-pty spawn
    (pty.spawn as MockedFunction<typeof pty.spawn>).mockReturnValue(mockPty as any);
    
    // Mock Logger
    (Logger as any).mockImplementation(() => mockLogger);
    
    // Mock ClaudeUtils
    (ClaudeUtils.getClaudeCommand as MockedFunction<typeof ClaudeUtils.getClaudeCommand>)
      .mockReturnValue({ command: 'claude', args: [] });
    
    // Mock os and path methods
    (os.homedir as MockedFunction<typeof os.homedir>).mockReturnValue('/home/user');
    (os.platform as any).mockReturnValue('linux');
    (path.join as MockedFunction<typeof path.join>).mockImplementation((...args) => args.join('/'));
    
    // Mock fs methods
    (fs.existsSync as MockedFunction<typeof fs.existsSync>).mockReturnValue(false);
    (fs.readFileSync as MockedFunction<typeof fs.readFileSync>).mockReturnValue('{}');
    (fs.readdirSync as MockedFunction<typeof fs.readdirSync>).mockReturnValue([]);

    // Setup PTY event handlers
    mockPty.onData.mockImplementation((handler: Function) => {
      mockDataHandler = handler;
    });
    mockPty.onExit.mockImplementation((handler: Function) => {
      // Store exit handler if needed
    });

    manager = new ACCPTYManager(new Logger());
  });

  afterEach(() => {
    manager.closeAllSessions();
  });

  describe('Session Management', () => {
    test('should create new session successfully', async () => {
      const sessionPromise = manager.createSession('/test/project');
      
      // Simulate ready event
      setTimeout(() => {
        if (mockDataHandler) {
          mockDataHandler('Ready\n');
        }
      }, 10);
      
      const sessionId = await sessionPromise;
      
      expect(sessionId).toBeDefined();
      expect(sessionId).toMatch(/^session-\d+-[a-z0-9]+$/);
      expect(pty.spawn).toHaveBeenCalledWith('claude', expect.any(Array), expect.any(Object));
    });

    test('should create session with custom session ID', async () => {
      const customSessionId = 'custom-session-123';
      
      const sessionPromise = manager.createSession('/test/project', customSessionId);
      
      setTimeout(() => {
        if (mockDataHandler) {
          mockDataHandler('Ready\n');
        }
      }, 10);
      
      const sessionId = await sessionPromise;
      
      expect(sessionId).toBe(customSessionId);
    });

    test('should get controller by session ID', async () => {
      const sessionPromise = manager.createSession('/test/project');
      
      setTimeout(() => {
        if (mockDataHandler) {
          mockDataHandler('Ready\n');
        }
      }, 10);
      
      const sessionId = await sessionPromise;
      const controller = manager.getController(sessionId);
      
      expect(controller).toBeInstanceOf(ClaudeCodePTYController);
      expect(controller?.getSessionId()).toBe(sessionId);
    });

    test('should return undefined for non-existent session', () => {
      const controller = manager.getController('non-existent');
      expect(controller).toBeUndefined();
    });

    test('should close specific session', async () => {
      const sessionPromise = manager.createSession('/test/project');
      
      setTimeout(() => {
        if (mockDataHandler) {
          mockDataHandler('Ready\n');
        }
      }, 10);
      
      const sessionId = await sessionPromise;
      
      manager.closeSession(sessionId);
      
      expect(mockPty.kill).toHaveBeenCalled();
      expect(manager.getController(sessionId)).toBeUndefined();
    });

    test('should handle close non-existent session gracefully', () => {
      expect(() => manager.closeSession('non-existent')).not.toThrow();
    });

    test('should close all sessions', async () => {
      // Create multiple sessions
      const session1Promise = manager.createSession('/test/project1');
      const session2Promise = manager.createSession('/test/project2');
      
      setTimeout(() => {
        if (mockDataHandler) {
          mockDataHandler('Ready\n');
        }
      }, 10);
      
      const [sessionId1, sessionId2] = await Promise.all([session1Promise, session2Promise]);
      
      manager.closeAllSessions();
      
      expect(mockPty.kill).toHaveBeenCalledTimes(2);
      expect(manager.getController(sessionId1)).toBeUndefined();
      expect(manager.getController(sessionId2)).toBeUndefined();
    });
  });

  describe('Prompt Handling', () => {
    let sessionId: string;

    beforeEach(async () => {
      const sessionPromise = manager.createSession('/test/project');
      
      // Simulate ready event immediately
      process.nextTick(() => {
        if (mockDataHandler) {
          mockDataHandler('Ready\n');
        }
      });
      
      sessionId = await sessionPromise;
    }, 15000);

    test('should send prompt to session successfully', async () => {
      const promptPromise = manager.sendPrompt(sessionId, 'test prompt');
      
      expect(mockPty.write).toHaveBeenCalledWith('test prompt\n');
      
      // Simulate response
      setTimeout(() => {
        if (mockDataHandler) {
          mockDataHandler('Response completed >>>\n');
        }
      }, 10);
      
      const response = await promptPromise;
      expect(response).toContain('Response completed');
    });

    test('should handle prompt to non-existent session', async () => {
      await expect(manager.sendPrompt('non-existent', 'test')).rejects.toThrow(
        'Session non-existent not found'
      );
    });
  });

  describe('Session ID Generation', () => {
    test('should generate unique session IDs', async () => {
      const session1Promise = manager.createSession('/test/project1');
      const session2Promise = manager.createSession('/test/project2');
      
      setTimeout(() => {
        if (mockDataHandler) {
          mockDataHandler('Ready\n');
        }
      }, 10);
      
      const [sessionId1, sessionId2] = await Promise.all([session1Promise, session2Promise]);
      
      expect(sessionId1).not.toBe(sessionId2);
      expect(sessionId1).toMatch(/^session-\d+-[a-z0-9]+$/);
      expect(sessionId2).toMatch(/^session-\d+-[a-z0-9]+$/);
    });

    test('should handle multiple concurrent session creations', async () => {
      const sessionPromises = [];
      
      for (let i = 0; i < 5; i++) {
        sessionPromises.push(manager.createSession(`/test/project${i}`));
      }
      
      setTimeout(() => {
        if (mockDataHandler) {
          mockDataHandler('Ready\n');
        }
      }, 10);
      
      const sessionIds = await Promise.all(sessionPromises);
      
      // All should be unique
      const uniqueIds = new Set(sessionIds);
      expect(uniqueIds.size).toBe(sessionIds.length);
      
      // All should follow pattern
      sessionIds.forEach(id => {
        expect(id).toMatch(/^session-\d+-[a-z0-9]+$/);
      });
    });
  });

  describe('Error Handling in Manager', () => {
    test('should handle session creation failure', async () => {
      (pty.spawn as MockedFunction<typeof pty.spawn>).mockImplementation(() => {
        throw new Error('Manager spawn failed');
      });

      await expect(manager.createSession('/test/project')).rejects.toThrow('Manager spawn failed');
    });

    test('should handle initialization timeout in manager', async () => {
      vi.useFakeTimers();
      
      const sessionPromise = manager.createSession('/test/project');
      
      // Don't send ready event, let timeout occur
      vi.advanceTimersByTime(11000);
      
      await expect(sessionPromise).rejects.toThrow('Timeout waiting for Claude to be ready');
      
      vi.useRealTimers();
    });

    test('should handle prompt failure in manager', async () => {
      const sessionPromise = manager.createSession('/test/project');
      
      setTimeout(() => {
        if (mockDataHandler) {
          mockDataHandler('Ready\n');
        }
      }, 10);
      
      const sessionId = await sessionPromise;
      
      // Mock error in prompt sending
      mockPty.write.mockImplementation(() => {
        throw new Error('Write failed');
      });
      
      await expect(manager.sendPrompt(sessionId, 'test')).rejects.toThrow();
    });
  });
});