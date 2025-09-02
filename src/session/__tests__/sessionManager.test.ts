import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ClaudeSessionManager, ClaudePathEncoder, ClaudeMessage, SessionMetadata } from '../sessionManager';
import { Logger } from '../../logger';

describe('ClaudeSessionManager', () => {
  let sessionManager: ClaudeSessionManager;
  let testProjectPath: string;
  let tempDir: string;

  beforeAll(async () => {
    // Create temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-session-test-'));
    testProjectPath = path.join(tempDir, 'test-project');
    await fs.mkdir(testProjectPath, { recursive: true });
    
    // Mock the Claude projects directory to point to our temp dir
    const mockClaudeDir = path.join(tempDir, '.claude', 'projects');
    await fs.mkdir(mockClaudeDir, { recursive: true });
    
    // Patch the ClaudePathEncoder to use our temp directory
    const originalGetClaudeProjectsDir = ClaudePathEncoder.getClaudeProjectsDir;
    ClaudePathEncoder.getClaudeProjectsDir = () => mockClaudeDir;
    
    sessionManager = new ClaudeSessionManager(new Logger('test'));
  });

  afterAll(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up temp directory:', error);
    }
  });

  describe('Path Encoding', () => {
    test('should encode paths exactly like Claude does', () => {
      const testPath = 'C:\\Users\\Dev\\automatic-claude-code';
      const encoded = ClaudePathEncoder.encodePath(testPath);
      
      // Should match the encoding we observed from Claude
      expect(encoded).toBe('QzpcVXNlcnNcRGV2XGF1dG9tYXRpYy1jbGF1ZGUtY29kZQ');
    });

    test('should decode paths correctly', () => {
      const encoded = 'QzpcVXNlcnNcRGV2XGF1dG9tYXRpYy1jbGF1ZGUtY29kZQ';
      const decoded = ClaudePathEncoder.decodePath(encoded);
      
      expect(decoded).toBe('C:\\Users\\Dev\\automatic-claude-code');
    });

    test('should handle Unix-style paths', () => {
      const unixPath = '/home/user/project';
      const encoded = ClaudePathEncoder.encodePath(unixPath);
      const decoded = ClaudePathEncoder.decodePath(encoded);
      
      // Path should be normalized to backslashes during encoding
      expect(decoded).toContain('\\');
    });
  });

  describe('Session Creation', () => {
    test('should create a new session with all required fields', async () => {
      const sessionId = await sessionManager.createSession({
        projectPath: testProjectPath,
        initialMessage: 'Test initial message',
        version: '1.0.92',
        gitBranch: 'main'
      });

      expect(sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

      // Verify session file was created
      const messages = await sessionManager.loadSession(testProjectPath, sessionId);
      expect(messages).toHaveLength(2); // Summary + user message
      
      const summaryMessage = messages[0];
      expect(summaryMessage.type).toBe('summary');
      expect(summaryMessage.summary).toBe('Test initial message');
      
      const userMessage = messages[1];
      expect(userMessage.type).toBe('user');
      expect(userMessage.message?.content).toBe('Test initial message');
    });

    test('should create session without initial message', async () => {
      const sessionId = await sessionManager.createSession({
        projectPath: testProjectPath
      });

      const messages = await sessionManager.loadSession(testProjectPath, sessionId);
      expect(messages).toHaveLength(1); // Only summary message
      expect(messages[0].type).toBe('summary');
    });

    test('should handle special characters in project path', async () => {
      const specialPath = path.join(tempDir, 'test-project with spaces & symbols!');
      await fs.mkdir(specialPath, { recursive: true });

      const sessionId = await sessionManager.createSession({
        projectPath: specialPath,
        initialMessage: 'Test with special path'
      });

      const messages = await sessionManager.loadSession(specialPath, sessionId);
      expect(messages).toHaveLength(2);
      expect(messages[0].cwd).toBe(path.resolve(specialPath));
    });
  });

  describe('Message Appending', () => {
    let sessionId: string;

    beforeEach(async () => {
      sessionId = await sessionManager.createSession({
        projectPath: testProjectPath,
        initialMessage: 'Initial message'
      });
    });

    test('should append user message to existing session', async () => {
      await sessionManager.appendMessage(testProjectPath, sessionId, {
        parentUuid: null,
        isSidechain: false,
        userType: 'external',
        version: '1.0.92',
        type: 'user',
        message: {
          role: 'user',
          content: 'Additional user message'
        }
      });

      const messages = await sessionManager.loadSession(testProjectPath, sessionId);
      expect(messages).toHaveLength(3);
      
      const lastMessage = messages[messages.length - 1];
      expect(lastMessage.type).toBe('user');
      expect(lastMessage.message?.content).toBe('Additional user message');
    });

    test('should append assistant message with usage stats', async () => {
      await sessionManager.appendMessage(testProjectPath, sessionId, {
        parentUuid: null,
        isSidechain: false,
        userType: 'external',
        version: '1.0.92',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: 'Assistant response',
          id: 'test-message-id',
          model: 'claude-3-sonnet',
          stop_reason: 'stop_sequence',
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0
          }
        }
      });

      const messages = await sessionManager.loadSession(testProjectPath, sessionId);
      expect(messages).toHaveLength(3);
      
      const assistantMessage = messages[messages.length - 1];
      expect(assistantMessage.type).toBe('assistant');
      expect(assistantMessage.message?.usage?.input_tokens).toBe(100);
      expect(assistantMessage.message?.usage?.output_tokens).toBe(50);
    });

    test('should fail when appending to non-existent session', async () => {
      const fakeSessionId = '00000000-0000-0000-0000-000000000000';
      
      await expect(sessionManager.appendMessage(testProjectPath, fakeSessionId, {
        parentUuid: null,
        isSidechain: false,
        userType: 'external',
        version: '1.0.92',
        type: 'user',
        message: {
          role: 'user',
          content: 'This should fail'
        }
      })).rejects.toThrow('Session 00000000-0000-0000-0000-000000000000 not found');
    });
  });

  describe('Session Loading and Listing', () => {
    let sessionIds: string[] = [];

    beforeEach(async () => {
      // Create multiple sessions for testing
      sessionIds = [];
      for (let i = 0; i < 3; i++) {
        const id = await sessionManager.createSession({
          projectPath: testProjectPath,
          initialMessage: `Test session ${i}`,
          version: '1.0.92'
        });
        sessionIds.push(id);
        
        // Add some variety to sessions
        if (i > 0) {
          await sessionManager.appendMessage(testProjectPath, id, {
            parentUuid: null,
            isSidechain: false,
            userType: 'external',
            version: '1.0.92',
            type: 'assistant',
            message: {
              role: 'assistant',
              content: `Response for session ${i}`,
              usage: {
                input_tokens: 50 * i,
                output_tokens: 25 * i,
                cache_creation_input_tokens: 0,
                cache_read_input_tokens: 0
              }
            }
          });
        }
      }
    });

    test('should list all sessions for project', async () => {
      const sessions = await sessionManager.listSessions(testProjectPath);
      
      expect(sessions).toHaveLength(3);
      sessions.forEach(session => {
        expect(session.projectPath).toBe(testProjectPath);
        expect(session.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        expect(session.messageCount).toBeGreaterThan(0);
      });
    });

    test('should return sessions sorted by last accessed (newest first)', async () => {
      const sessions = await sessionManager.listSessions(testProjectPath);
      
      for (let i = 0; i < sessions.length - 1; i++) {
        expect(sessions[i].lastAccessed.getTime()).toBeGreaterThanOrEqual(
          sessions[i + 1].lastAccessed.getTime()
        );
      }
    });

    test('should get accurate session metadata', async () => {
      const sessionId = sessionIds[2]; // Has assistant response
      const metadata = await sessionManager.getSessionMetadata(testProjectPath, sessionId);
      
      expect(metadata.id).toBe(sessionId);
      expect(metadata.projectPath).toBe(testProjectPath);
      expect(metadata.messageCount).toBe(3); // Summary + user + assistant
      expect(metadata.totalTokens).toBe(150); // 50*2 + 25*2
      expect(metadata.status).toBe('completed');
      expect(metadata.version).toBe('1.0.92');
    });

    test('should return empty array for project with no sessions', async () => {
      const emptyProjectPath = path.join(tempDir, 'empty-project');
      await fs.mkdir(emptyProjectPath, { recursive: true });
      
      const sessions = await sessionManager.listSessions(emptyProjectPath);
      expect(sessions).toHaveLength(0);
    });
  });

  describe('Session Management Operations', () => {
    let sessionId: string;

    beforeEach(async () => {
      sessionId = await sessionManager.createSession({
        projectPath: testProjectPath,
        initialMessage: 'Session for management tests'
      });
    });

    test('should delete session successfully', async () => {
      await sessionManager.deleteSession(testProjectPath, sessionId);
      
      // Verify session is gone
      await expect(sessionManager.loadSession(testProjectPath, sessionId))
        .rejects.toThrow(`Session ${sessionId} not found`);
      
      // Should not appear in listings
      const sessions = await sessionManager.listSessions(testProjectPath);
      expect(sessions.find(s => s.id === sessionId)).toBeUndefined();
    });

    test('should resume session with new message', async () => {
      await sessionManager.resumeSession(testProjectPath, sessionId, 'Resuming this session');
      
      const messages = await sessionManager.loadSession(testProjectPath, sessionId);
      const lastMessage = messages[messages.length - 1];
      
      expect(lastMessage.type).toBe('user');
      expect(lastMessage.message?.content).toBe('Resuming this session');
      expect(lastMessage.parentUuid).toBe(messages[messages.length - 2].uuid);
    });

    test('should export session data', async () => {
      const exportData = await sessionManager.exportSession(testProjectPath, sessionId);
      
      expect(exportData.metadata.id).toBe(sessionId);
      expect(exportData.messages).toHaveLength(2);
      expect(exportData.export_timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    test('should import session data', async () => {
      // Export existing session
      const exportData = await sessionManager.exportSession(testProjectPath, sessionId);
      
      // Delete original
      await sessionManager.deleteSession(testProjectPath, sessionId);
      
      // Import back
      const importedId = await sessionManager.importSession(testProjectPath, exportData);
      expect(importedId).toBe(sessionId);
      
      // Verify imported data
      const messages = await sessionManager.loadSession(testProjectPath, sessionId);
      expect(messages).toHaveLength(2);
      expect(messages[0].summary).toBe('Session for management tests');
    });
  });

  describe('Session Validation and Stats', () => {
    let sessionId: string;

    beforeEach(async () => {
      sessionId = await sessionManager.createSession({
        projectPath: testProjectPath,
        initialMessage: 'Validation test session'
      });
    });

    test('should validate correct session format', async () => {
      const validation = await sessionManager.validateSession(testProjectPath, sessionId);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.messageCount).toBe(2);
    });

    test('should generate project statistics', async () => {
      // Add some more data
      await sessionManager.appendMessage(testProjectPath, sessionId, {
        parentUuid: null,
        isSidechain: false,
        userType: 'external',
        version: '1.0.92',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: 'Response',
          usage: {
            input_tokens: 100,
            output_tokens: 75,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0
          }
        }
      });

      const stats = await sessionManager.getSessionStats(testProjectPath);
      
      expect(stats.totalSessions).toBeGreaterThan(0);
      expect(stats.completedSessions).toBeGreaterThan(0);
      expect(stats.totalMessages).toBeGreaterThan(0);
      expect(stats.totalTokens).toBe(175);
      expect(stats.oldestSession).toBeInstanceOf(Date);
      expect(stats.newestSession).toBeInstanceOf(Date);
    });
  });

  describe('Multi-Project Support', () => {
    let project2Path: string;

    beforeEach(async () => {
      project2Path = path.join(tempDir, 'project-2');
      await fs.mkdir(project2Path, { recursive: true });
    });

    test('should handle multiple projects independently', async () => {
      // Create sessions in both projects
      const session1 = await sessionManager.createSession({
        projectPath: testProjectPath,
        initialMessage: 'Project 1 session'
      });
      
      const session2 = await sessionManager.createSession({
        projectPath: project2Path,
        initialMessage: 'Project 2 session'
      });

      // Verify sessions are isolated
      const project1Sessions = await sessionManager.listSessions(testProjectPath);
      const project2Sessions = await sessionManager.listSessions(project2Path);
      
      expect(project1Sessions.some(s => s.id === session1)).toBe(true);
      expect(project1Sessions.some(s => s.id === session2)).toBe(false);
      
      expect(project2Sessions.some(s => s.id === session2)).toBe(true);
      expect(project2Sessions.some(s => s.id === session1)).toBe(false);
    });

    test('should list all projects with sessions', async () => {
      // Create sessions in both projects
      await sessionManager.createSession({
        projectPath: testProjectPath,
        initialMessage: 'Project 1 session'
      });
      
      await sessionManager.createSession({
        projectPath: project2Path,
        initialMessage: 'Project 2 session'
      });

      const projects = await sessionManager.listAllProjects();
      
      expect(projects).toHaveLength(2);
      expect(projects.some(p => p.projectPath === testProjectPath)).toBe(true);
      expect(projects.some(p => p.projectPath === project2Path)).toBe(true);
      
      projects.forEach(project => {
        expect(project.sessionCount).toBeGreaterThan(0);
        expect(project.lastActivity).toBeInstanceOf(Date);
      });
    });
  });

  describe('Cleanup Operations', () => {
    test('should clean up old sessions', async () => {
      // Create a session
      const sessionId = await sessionManager.createSession({
        projectPath: testProjectPath,
        initialMessage: 'Old session'
      });

      // Mark it as completed
      await sessionManager.appendMessage(testProjectPath, sessionId, {
        parentUuid: null,
        isSidechain: false,
        userType: 'external',
        version: '1.0.92',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: 'Complete'
        }
      });

      // Mock old date by manipulating file timestamps
      const sessionFile = ClaudePathEncoder.getSessionFilePath(testProjectPath, sessionId);
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 35); // 35 days ago
      
      await fs.utimes(sessionFile, oldDate, oldDate);

      // Cleanup with 30 day threshold
      const deletedSessions = await sessionManager.cleanupOldSessions(testProjectPath, 30);
      
      expect(deletedSessions).toContain(sessionId);
      
      // Verify session is gone
      await expect(sessionManager.loadSession(testProjectPath, sessionId))
        .rejects.toThrow(`Session ${sessionId} not found`);
    });

    test('should not clean up active sessions even if old', async () => {
      // Create a session but don't complete it
      const sessionId = await sessionManager.createSession({
        projectPath: testProjectPath,
        initialMessage: 'Active old session'
      });

      // Mock old date
      const sessionFile = ClaudePathEncoder.getSessionFilePath(testProjectPath, sessionId);
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 35);
      
      await fs.utimes(sessionFile, oldDate, oldDate);

      // Cleanup - should not delete active session
      const deletedSessions = await sessionManager.cleanupOldSessions(testProjectPath, 30);
      
      expect(deletedSessions).not.toContain(sessionId);
      
      // Verify session still exists
      const messages = await sessionManager.loadSession(testProjectPath, sessionId);
      expect(messages).toBeDefined();
    });
  });
});