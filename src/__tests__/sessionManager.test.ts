import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { SessionManager, EnhancedSessionManager, SessionState, SessionLimitError } from '../sessionManager';
import { SDKClaudeExecutor } from '../services/sdkClaudeExecutor';
import { Logger } from '../logger';
import { createTempDir, cleanupDir } from './setup';

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
    sessionManager = new SessionManager(path.join(tempDir, 'sessions'));
  });

  afterEach(async () => {
    cleanupDir(tempDir);
  });

  describe('Session Creation', () => {
    test('should create a new session with unique ID', async () => {
      const prompt = 'Test task';
      const workDir = '/test/work/dir';

      const sessionId = await sessionManager.createSession(prompt, workDir);

      expect(sessionId).toMatch(/^session-[a-z0-9]+-[a-z0-9]+$/);
      
      const session = await sessionManager.loadSession(sessionId);
      expect(session.initialPrompt).toBe(prompt);
      expect(session.workDir).toBe(workDir);
      expect(session.status).toBe('running');
      expect(session.iterations).toEqual([]);
    });

    test('should create sessions directory if it does not exist', async () => {
      const nonExistentDir = path.join(tempDir, 'non-existent', 'sessions');
      const sm = new SessionManager(nonExistentDir);

      await sm.createSession('test', '/test');
      
      const dirExists = await fs.access(nonExistentDir).then(() => true).catch(() => false);
      expect(dirExists).toBe(true);
    });

    test('should generate unique session IDs for concurrent sessions', async () => {
      const sessions = await Promise.all([
        sessionManager.createSession('task1', '/dir1'),
        sessionManager.createSession('task2', '/dir2'),
        sessionManager.createSession('task3', '/dir3')
      ]);

      const uniqueIds = new Set(sessions);
      expect(uniqueIds.size).toBe(3);
    });
  });

  describe('Session Persistence', () => {
    test('should save session to disk immediately after creation', async () => {
      const sessionId = await sessionManager.createSession('test', '/test');
      const sessionFile = path.join(tempDir, 'sessions', `${sessionId}.json`);
      
      const fileExists = await fs.access(sessionFile).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
      
      const content = await fs.readFile(sessionFile, 'utf-8');
      const session = JSON.parse(content);
      expect(session.id).toBe(sessionId);
    });

    test('should persist session iterations', async () => {
      const sessionId = await sessionManager.createSession('test', '/test');
      
      await sessionManager.addIteration({
        iteration: 1,
        prompt: 'test prompt',
        output: { content: 'test output', files: [], commands: [] },
        exitCode: 0,
        duration: 1500
      });

      const session = await sessionManager.loadSession(sessionId);
      expect(session.iterations).toHaveLength(1);
      expect(session.iterations[0].prompt).toBe('test prompt');
      expect(session.iterations[0].exitCode).toBe(0);
    });

    test('should handle session completion and status updates', async () => {
      const sessionId = await sessionManager.createSession('test', '/test');
      
      await sessionManager.completeSession('completed');
      
      const session = await sessionManager.loadSession(sessionId);
      expect(session.status).toBe('completed');
      expect(session.endTime).toBeDefined();
    });

    test('should load existing session from disk', async () => {
      // Create session manually
      const sessionData = {
        id: 'test-session-123',
        startTime: new Date(),
        initialPrompt: 'test prompt',
        workDir: '/test',
        iterations: [{
          iteration: 1,
          prompt: 'test',
          output: { content: 'result' },
          exitCode: 0,
          duration: 1000,
          timestamp: new Date()
        }],
        status: 'running'
      };

      const sessionFile = path.join(tempDir, 'sessions', 'test-session-123.json');
      await fs.mkdir(path.dirname(sessionFile), { recursive: true });
      await fs.writeFile(sessionFile, JSON.stringify(sessionData));

      const loaded = await sessionManager.loadSession('test-session-123');
      expect(loaded.id).toBe('test-session-123');
      expect(loaded.iterations).toHaveLength(1);
    });
  });

  describe('Session Cleanup', () => {
    test('should list all sessions', async () => {
      const sessionId1 = await sessionManager.createSession('task1', '/dir1');
      const sessionId2 = await sessionManager.createSession('task2', '/dir2');
      
      const sessions = await sessionManager.listSessions();
      
      expect(sessions).toHaveLength(2);
      expect(sessions.map(s => s.id)).toContain(sessionId1);
      expect(sessions.map(s => s.id)).toContain(sessionId2);
    });

    test('should handle corrupted session files gracefully', async () => {
      // Create corrupted file
      const corruptFile = path.join(tempDir, 'sessions', 'corrupt-session.json');
      await fs.mkdir(path.dirname(corruptFile), { recursive: true });
      await fs.writeFile(corruptFile, 'invalid json content');

      const sessions = await sessionManager.listSessions();
      // Should not throw error, just skip corrupted file
      expect(sessions).toEqual([]);
    });

    test('should generate session reports', async () => {
      const sessionId = await sessionManager.createSession('test task', '/test');
      
      await sessionManager.addIteration({
        iteration: 1,
        prompt: 'do something',
        output: { 
          content: 'done',
          files: ['/test/file.js'],
          commands: ['npm install'],
          totalCost: 0.05
        },
        exitCode: 0,
        duration: 2500
      });

      await sessionManager.completeSession('completed');

      const report = await sessionManager.getSessionReport(sessionId);
      
      expect(report).toContain('Session Report');
      expect(report).toContain('test task');
      expect(report).toContain('completed');
      expect(report).toContain('/test/file.js');
      expect(report).toContain('npm install');
      expect(report).toContain('$0.0500');
    });
  });
});

describe('EnhancedSessionManager', () => {
  let enhancedManager: EnhancedSessionManager;
  let tempDir: string;
  let logger: Logger;
  let sdkExecutor: SDKClaudeExecutor;

  beforeEach(() => {
    tempDir = createTempDir();
    logger = new Logger();
    sdkExecutor = new SDKClaudeExecutor(logger);
    enhancedManager = new EnhancedSessionManager(
      path.join(tempDir, 'sessions'), 
      logger,
      sdkExecutor
    );
  });

  afterEach(async () => {
    await enhancedManager.cleanup();
    cleanupDir(tempDir);
  });

  describe('Session State Tracking', () => {
    test('should track concurrent session states', async () => {
      const sessionId1 = await enhancedManager.createSession('task1', '/dir1');
      const sessionId2 = await enhancedManager.createSession('task2', '/dir2');

      const state1 = enhancedManager.getSessionState(sessionId1);
      const state2 = enhancedManager.getSessionState(sessionId2);

      expect(state1.status).toBe('running');
      expect(state2.status).toBe('running');
      expect(state1.processInfo).toBeDefined();
      expect(state2.processInfo).toBeDefined();
    });

    test('should update session state when PTY processes change', async () => {
      const sessionId = await enhancedManager.createSession('task', '/dir');
      
      // Mock PTY process creation
      const mockController = {
        getSessionId: () => sessionId,
        sendPrompt: jest.fn().mockResolvedValue('response'),
        close: jest.fn(),
        on: jest.fn(),
        emit: jest.fn()
      };

      (ptyManager as any).controllers.set(sessionId, mockController);
      
      const state = enhancedManager.getSessionState(sessionId);
      expect(state.processInfo.hasActiveController).toBe(true);
    });
  });

  describe('Session Resume Functionality', () => {
    test('should resume existing session', async () => {
      // Create and complete a session
      const sessionId = await enhancedManager.createSession('original task', '/dir');
      await enhancedManager.addIteration({
        iteration: 1,
        prompt: 'first prompt',
        output: { content: 'first result' },
        exitCode: 0,
        duration: 1000
      });

      // Resume the session
      const resumedId = await enhancedManager.resumeSession(sessionId, 'continue task');
      
      expect(resumedId).toBe(sessionId);
      const session = await enhancedManager.loadSession(sessionId);
      expect(session.status).toBe('running');
    });

    test('should handle resume of non-existent session', async () => {
      await expect(
        enhancedManager.resumeSession('non-existent-session', 'task')
      ).rejects.toThrow('Session non-existent-session not found');
    });

    test('should resume with additional context', async () => {
      const sessionId = await enhancedManager.createSession('original', '/dir');
      const resumed = await enhancedManager.resumeSession(sessionId, 'additional context');
      
      const session = await enhancedManager.loadSession(resumed);
      // Should have additional context stored somehow (implementation dependent)
      expect(session.status).toBe('running');
    });
  });

  describe('Concurrent Session Limits', () => {
    test('should enforce maximum concurrent session limit', async () => {
      // Set a low limit for testing
      enhancedManager.setMaxConcurrentSessions(2);

      // Create sessions up to limit
      await enhancedManager.createSession('task1', '/dir1');
      await enhancedManager.createSession('task2', '/dir2');

      // Third session should throw error
      await expect(
        enhancedManager.createSession('task3', '/dir3')
      ).rejects.toThrow(SessionLimitError);
    });

    test('should allow new sessions after completing others', async () => {
      enhancedManager.setMaxConcurrentSessions(1);

      const sessionId1 = await enhancedManager.createSession('task1', '/dir1');
      await enhancedManager.completeSession('completed');

      // Should be able to create another session after completing first
      const sessionId2 = await enhancedManager.createSession('task2', '/dir2');
      expect(sessionId2).toBeDefined();
    });

    test('should count only running sessions toward limit', async () => {
      enhancedManager.setMaxConcurrentSessions(2);

      // Create and complete first session
      const sessionId1 = await enhancedManager.createSession('task1', '/dir1');
      await enhancedManager.completeSession('completed');

      // Should be able to create two more running sessions
      await enhancedManager.createSession('task2', '/dir2');
      await enhancedManager.createSession('task3', '/dir3');

      // Third running session should fail
      await expect(
        enhancedManager.createSession('task4', '/dir4')
      ).rejects.toThrow(SessionLimitError);
    });
  });

  describe('Automatic Cleanup', () => {
    test('should clean up completed sessions older than threshold', async () => {
      const sessionId = await enhancedManager.createSession('old task', '/dir');
      
      // Mock old completion time
      const session = await enhancedManager.loadSession(sessionId);
      session.endTime = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      session.status = 'completed';
      
      // Save modified session
      const sessionFile = path.join(tempDir, 'sessions', `${sessionId}.json`);
      await fs.writeFile(sessionFile, JSON.stringify(session));

      // Run cleanup
      const cleaned = await enhancedManager.cleanupOldSessions(24); // 24 hour threshold

      expect(cleaned).toContain(sessionId);
      
      // Verify session file is removed
      const fileExists = await fs.access(sessionFile).then(() => true).catch(() => false);
      expect(fileExists).toBe(false);
    });

    test('should not clean up active or recent sessions', async () => {
      const activeId = await enhancedManager.createSession('active task', '/dir1');
      const recentId = await enhancedManager.createSession('recent task', '/dir2');
      
      await enhancedManager.completeSession('completed'); // Complete recent session
      
      const cleaned = await enhancedManager.cleanupOldSessions(24);
      
      expect(cleaned).not.toContain(activeId);
      expect(cleaned).not.toContain(recentId);
    });

    test('should clean up orphaned PTY processes', async () => {
      const sessionId = await enhancedManager.createSession('test', '/dir');
      
      // Create mock orphaned controller
      const mockController = {
        getSessionId: () => 'orphaned-session',
        close: jest.fn(),
        sendPrompt: jest.fn(),
        on: jest.fn(),
        emit: jest.fn()
      };
      
      (ptyManager as any).controllers.set('orphaned-session', mockController);
      
      await enhancedManager.cleanupOrphanedProcesses();
      
      expect(mockController.close).toHaveBeenCalled();
      expect((ptyManager as any).controllers.has('orphaned-session')).toBe(false);
    });
  });

  describe('Session Path Encoding', () => {
    test('should encode session paths safely', async () => {
      const unsafePath = '/path/with spaces/and:colons/and|pipes';
      const sessionId = await enhancedManager.createSession('test', unsafePath);
      
      const session = await enhancedManager.loadSession(sessionId);
      expect(session.workDir).toBe(unsafePath);
      
      // Session file should be created with safe name
      const sessionFile = path.join(tempDir, 'sessions', `${sessionId}.json`);
      const fileExists = await fs.access(sessionFile).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });

    test('should handle directory structure creation', async () => {
      const sessionId = await enhancedManager.createSession('test', '/test/deep/dir');
      
      const state = enhancedManager.getSessionState(sessionId);
      expect(state.paths.workDir).toBe('/test/deep/dir');
      expect(state.paths.sessionFile).toMatch(/session-.*\.json$/);
      expect(state.paths.logDir).toMatch(/logs$/);
    });
  });

  describe('Integration with PTY Controller', () => {
    test('should coordinate with PTY manager for session lifecycle', async () => {
      const createSpy = jest.spyOn(ptyManager, 'createSession');
      const closeSpy = jest.spyOn(ptyManager, 'closeSession');
      
      const sessionId = await enhancedManager.createSession('test', '/dir');
      await enhancedManager.completeSession('completed');
      
      // Should attempt to create PTY session
      expect(createSpy).toHaveBeenCalledWith('/dir', sessionId);
      
      // Should close PTY session on completion
      expect(closeSpy).toHaveBeenCalledWith(sessionId);
    });

    test('should handle PTY initialization failures gracefully', async () => {
      jest.spyOn(ptyManager, 'createSession').mockRejectedValue(new Error('PTY failed'));
      
      // Should still create session even if PTY fails
      const sessionId = await enhancedManager.createSession('test', '/dir');
      expect(sessionId).toBeDefined();
      
      const state = enhancedManager.getSessionState(sessionId);
      expect(state.processInfo.hasActiveController).toBe(false);
      expect(state.processInfo.error).toMatch(/PTY failed/);
    });
  });
});