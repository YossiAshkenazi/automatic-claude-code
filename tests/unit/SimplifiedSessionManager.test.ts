/**
 * Unit tests for SimplifiedSessionManager
 * Tests SDK-optimized session management functionality
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';
import { Logger } from '@/logger';
import {
  SimplifiedSessionManager,
  Session,
  SessionIteration,
  SessionSummary,
  ConsoleProgressReporter
} from '@/core/SimplifiedSessionManager';
import { ParsedOutput } from '@/outputParser';

// Mock fs and path modules
jest.mock('fs/promises');
jest.mock('path');
jest.mock('os');
jest.mock('crypto');
jest.mock('@/logger');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = path as jest.Mocked<typeof path>;

describe('SimplifiedSessionManager', () => {
  let sessionManager: SimplifiedSessionManager;
  let mockLogger: jest.Mocked<Logger>;
  let tempDir: string;

  beforeEach(() => {
    mockLogger = new Logger() as jest.Mocked<Logger>;
    tempDir = '/tmp/test-sessions';
    
    // Mock path methods
    mockPath.resolve.mockReturnValue(tempDir);
    mockPath.join.mockImplementation((...parts) => parts.join('/'));
    mockPath.basename.mockImplementation((filePath) => filePath.split('/').pop() || '');
    
    // Mock crypto.randomUUID
    const mockCrypto = require('crypto');
    mockCrypto.randomUUID = jest.fn().mockReturnValue('test-uuid-123');
    
    // Mock fs operations
    mockFs.access.mockResolvedValue(undefined);
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue('{}');
    mockFs.readdir.mockResolvedValue([]);
    
    sessionManager = new SimplifiedSessionManager(tempDir, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should initialize with custom base directory and logger', () => {
      expect(sessionManager).toBeInstanceOf(SimplifiedSessionManager);
      expect(sessionManager).toBeInstanceOf(EventEmitter);
      expect(mockPath.resolve).toHaveBeenCalledWith(tempDir);
    });

    test('should initialize with default parameters', () => {
      const defaultManager = new SimplifiedSessionManager();
      expect(defaultManager).toBeInstanceOf(SimplifiedSessionManager);
    });

    test('should initialize without logger', () => {
      const managerWithoutLogger = new SimplifiedSessionManager(tempDir);
      expect(managerWithoutLogger).toBeInstanceOf(SimplifiedSessionManager);
    });
  });

  describe('createSession', () => {
    test('should create new session with SDK mode', async () => {
      const sessionId = await sessionManager.createSession(
        'Test task implementation',
        '/test/workspace',
        'sdk'
      );

      expect(sessionId).toBe('test-uuid-123');
      expect(mockFs.mkdir).toHaveBeenCalledWith(tempDir, { recursive: true });
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test-uuid-123.json'),
        expect.stringContaining('Test task implementation'),
        'utf-8'
      );
    });

    test('should create session with browser-auth mode', async () => {
      const sessionId = await sessionManager.createSession(
        'Browser auth task',
        '/test/workspace',
        'browser-auth'
      );

      expect(sessionId).toBe('test-uuid-123');
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('browser-auth mode')
      );
    });

    test('should default to SDK mode when no execution mode specified', async () => {
      const sessionId = await sessionManager.createSession(
        'Default mode task',
        '/test/workspace'
      );

      expect(sessionId).toBe('test-uuid-123');
      // Check that the written session has SDK mode as default
      const writeCall = mockFs.writeFile.mock.calls.find(call => 
        (call[0] as string).includes('test-uuid-123.json')
      );
      expect(writeCall![1]).toContain('"executionMode":"sdk"');
    });

    test('should emit session_created hook event', async () => {
      const eventSpy = jest.fn();
      sessionManager.on('user_prompt_submit', eventSpy);

      await sessionManager.createSession('Hook test task', '/test/workspace');

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          hook_event_type: 'SessionCreated',
          payload: expect.objectContaining({
            session_id: 'test-uuid-123',
            message: expect.stringContaining('Session created')
          })
        })
      );
    });
  });

  describe('addIteration', () => {
    let sessionId: string;

    beforeEach(async () => {
      sessionId = await sessionManager.createSession('Test task', '/test/workspace');
    });

    test('should add iteration with SDK execution mode', async () => {
      const mockOutput: ParsedOutput = {
        result: 'Iteration completed successfully',
        error: undefined,
        files: ['src/test.ts'],
        commands: ['npm test'],
        totalCost: 0.005
      };

      await sessionManager.addIteration({
        iteration: 1,
        prompt: 'Implement feature',
        output: mockOutput,
        exitCode: 0,
        duration: 5000,
        executionMode: 'sdk',
        sdkSessionId: 'sdk-session-456',
        authMethod: 'browser'
      });

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`${sessionId}.json`),
        expect.stringContaining('"iteration":1'),
        'utf-8'
      );
    });

    test('should emit post_tool_use hook event for iterations', async () => {
      const eventSpy = jest.fn();
      sessionManager.on('post_tool_use', eventSpy);

      const mockOutput: ParsedOutput = {
        result: 'Test result',
        error: undefined,
        files: [],
        commands: []
      };

      await sessionManager.addIteration({
        iteration: 2,
        prompt: 'Continue task',
        output: mockOutput,
        exitCode: 0,
        duration: 3000
      });

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          hook_event_type: 'IterationCompleted',
          payload: expect.objectContaining({
            iteration: 2,
            exitCode: 0,
            duration: 3000,
            hasError: false
          })
        })
      );
    });

    test('should update authentication state based on execution success', async () => {
      // First, create a session with pending auth
      const pendingSessionId = await sessionManager.createSession(
        'Auth test',
        '/test/workspace',
        'browser-auth'
      );

      const mockOutput: ParsedOutput = {
        result: 'Authenticated successfully',
        error: undefined,
        files: [],
        commands: []
      };

      await sessionManager.addIteration({
        iteration: 1,
        prompt: 'Test auth',
        output: mockOutput,
        exitCode: 0,
        duration: 1000
      });

      // Should update authentication state to authenticated
      const writeCall = mockFs.writeFile.mock.calls.find(call => 
        (call[0] as string).includes(`${pendingSessionId}.json`)
      );
      expect(writeCall![1]).toContain('"authenticationState":"authenticated"');
    });

    test('should handle authentication failures', async () => {
      const mockOutput: ParsedOutput = {
        result: '',
        error: 'Authentication failed - invalid credentials',
        files: [],
        commands: []
      };

      await sessionManager.addIteration({
        iteration: 1,
        prompt: 'Auth failing task',
        output: mockOutput,
        exitCode: 1,
        duration: 500
      });

      const writeCall = mockFs.writeFile.mock.calls.find(call => 
        (call[0] as string).includes(`${sessionId}.json`)
      );
      expect(writeCall![1]).toContain('"authenticationState":"failed"');
    });
  });

  describe('completeSession', () => {
    let sessionId: string;

    beforeEach(async () => {
      sessionId = await sessionManager.createSession('Test task', '/test/workspace');
      
      // Add some iterations
      await sessionManager.addIteration({
        iteration: 1,
        prompt: 'Step 1',
        output: { result: 'Step 1 done', error: undefined, files: ['file1.ts'], commands: ['echo 1'] },
        exitCode: 0,
        duration: 2000
      });
      
      await sessionManager.addIteration({
        iteration: 2,
        prompt: 'Step 2',
        output: { result: 'Step 2 done', error: undefined, files: ['file2.ts'], commands: ['echo 2'] },
        exitCode: 0,
        duration: 3000
      });
    });

    test('should complete session successfully', async () => {
      await sessionManager.completeSession('completed');

      const writeCall = mockFs.writeFile.mock.calls.find(call => 
        (call[0] as string).includes(`${sessionId}.json`)
      );
      expect(writeCall![1]).toContain('"status":"completed"');
      expect(writeCall![1]).toContain('"endTime"');
    });

    test('should emit session_stop hook event', async () => {
      const eventSpy = jest.fn();
      sessionManager.on('session_stop', eventSpy);

      await sessionManager.completeSession('completed');

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          hook_event_type: 'SessionCompleted',
          payload: expect.objectContaining({
            status: 'completed',
            summary: expect.objectContaining({
              totalIterations: 2,
              successRate: 100
            })
          })
        })
      );
    });

    test('should handle failed session completion', async () => {
      await sessionManager.completeSession('failed');

      expect(mockLogger.success).toHaveBeenCalledWith(
        expect.stringContaining('Session completed: failed')
      );
    });
  });

  describe('getSummary', () => {
    let sessionId: string;

    beforeEach(async () => {
      sessionId = await sessionManager.createSession('Summary test', '/test/workspace');
    });

    test('should generate accurate session summary', async () => {
      // Add iterations with different outcomes
      await sessionManager.addIteration({
        iteration: 1,
        prompt: 'Success step',
        output: {
          result: 'Success',
          error: undefined,
          files: ['src/component.tsx', 'src/utils.ts'],
          commands: ['npm install', 'npm test'],
          totalCost: 0.002
        },
        exitCode: 0,
        duration: 4000
      });

      await sessionManager.addIteration({
        iteration: 2,
        prompt: 'Failure step',
        output: {
          result: '',
          error: 'Build failed',
          files: [],
          commands: ['npm run build'],
          totalCost: 0.001
        },
        exitCode: 1,
        duration: 2000
      });

      await sessionManager.addIteration({
        iteration: 3,
        prompt: 'Recovery step',
        output: {
          result: 'Recovered',
          error: undefined,
          files: ['src/fix.ts'],
          commands: ['npm run build'],
          totalCost: 0.003
        },
        exitCode: 0,
        duration: 3000
      });

      const summary = await sessionManager.getSummary();

      expect(summary.totalIterations).toBe(3);
      expect(summary.totalDuration).toBe(9000); // 4000 + 2000 + 3000
      expect(summary.successRate).toBe(67); // 2 successes out of 3 = 66.67%, rounded to 67
      expect(summary.totalCost).toBe(0.006);
      expect(summary.filesModified).toEqual(['src/component.tsx', 'src/utils.ts', 'src/fix.ts']);
      expect(summary.commandsExecuted).toEqual(['npm install', 'npm test', 'npm run build']);
    });

    test('should handle empty session', async () => {
      const summary = await sessionManager.getSummary();

      expect(summary.totalIterations).toBe(0);
      expect(summary.totalDuration).toBe(0);
      expect(summary.successRate).toBe(0);
      expect(summary.totalCost).toBeUndefined();
      expect(summary.filesModified).toEqual([]);
      expect(summary.commandsExecuted).toEqual([]);
    });
  });

  describe('loadSession', () => {
    test('should load existing session', async () => {
      const mockSessionData = {
        id: 'existing-session',
        startTime: new Date().toISOString(),
        initialPrompt: 'Existing task',
        workDir: '/existing/workspace',
        iterations: [],
        status: 'running'
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockSessionData));

      const session = await sessionManager.loadSession('existing-session');

      expect(session.id).toBe('existing-session');
      expect(session.initialPrompt).toBe('Existing task');
      expect(mockFs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('existing-session.json'),
        'utf-8'
      );
    });
  });

  describe('listSessions', () => {
    test('should list all sessions', async () => {
      mockFs.readdir.mockResolvedValue(['session1.json', 'session2.json', 'not-json.txt'] as any);
      
      const sessionData1 = {
        id: 'session1',
        startTime: new Date('2024-01-01').toISOString(),
        initialPrompt: 'First task',
        status: 'completed'
      };
      
      const sessionData2 = {
        id: 'session2',
        startTime: new Date('2024-01-02').toISOString(),
        initialPrompt: 'Second task with a very long description that should be truncated',
        status: 'running'
      };

      mockFs.readFile
        .mockResolvedValueOnce(JSON.stringify(sessionData1))
        .mockResolvedValueOnce(JSON.stringify(sessionData2));

      const sessions = await sessionManager.listSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions[0].id).toBe('session2'); // Should be sorted by date, newest first
      expect(sessions[0].prompt).toHaveLength(53); // Should be truncated with '...'
      expect(sessions[1].id).toBe('session1');
    });

    test('should handle corrupted session files gracefully', async () => {
      mockFs.readdir.mockResolvedValue(['good.json', 'corrupted.json'] as any);
      
      mockFs.readFile
        .mockResolvedValueOnce(JSON.stringify({ id: 'good', startTime: new Date().toISOString(), initialPrompt: 'Good task', status: 'completed' }))
        .mockRejectedValueOnce(new Error('Corrupted JSON'));

      const sessions = await sessionManager.listSessions();

      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe('good');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load session corrupted.json'),
        'Corrupted JSON'
      );
    });
  });

  describe('getSessionReport', () => {
    test('should generate comprehensive session report', async () => {
      const mockSession: Session = {
        id: 'report-session',
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T10:15:00Z'),
        initialPrompt: 'Create a React component',
        workDir: '/project/workspace',
        status: 'completed',
        executionMode: 'sdk',
        authenticationState: 'authenticated',
        iterations: [
          {
            iteration: 1,
            prompt: 'Create component structure',
            output: {
              result: 'Component created',
              error: undefined,
              files: ['src/Component.tsx'],
              commands: ['mkdir src'],
              totalCost: 0.002
            },
            exitCode: 0,
            duration: 5000,
            timestamp: new Date('2024-01-01T10:05:00Z'),
            executionMode: 'sdk'
          },
          {
            iteration: 2,
            prompt: 'Add styling',
            output: {
              result: 'Styles added',
              error: undefined,
              files: ['src/Component.module.css'],
              commands: ['touch src/Component.module.css'],
              totalCost: 0.001
            },
            exitCode: 0,
            duration: 3000,
            timestamp: new Date('2024-01-01T10:10:00Z'),
            executionMode: 'sdk'
          }
        ]
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockSession));

      const report = await sessionManager.getSessionReport('report-session');

      expect(report).toContain('# Session Report: report-session');
      expect(report).toContain('**Status:** completed');
      expect(report).toContain('**Execution Mode:** sdk');
      expect(report).toContain('**Initial Task:** Create a React component');
      expect(report).toContain('- Total Iterations: 2');
      expect(report).toContain('- Success Rate: 100%');
      expect(report).toContain('- Total Duration: 8s');
      expect(report).toContain('- Estimated Cost: $0.0030');
      expect(report).toContain('- src/Component.tsx');
      expect(report).toContain('- src/Component.module.css');
      expect(report).toContain('- `mkdir src`');
      expect(report).toContain('### Iteration 1');
      expect(report).toContain('### Iteration 2');
    });
  });

  describe('Progress Reporting', () => {
    test('should set and track max iterations', () => {
      sessionManager.setMaxIterations(10);
      expect(mockLogger.setMaxIterations).toHaveBeenCalledWith(10);
    });

    test('should set and track current iteration', () => {
      sessionManager.setCurrentIteration(5);
      expect(mockLogger.setIteration).toHaveBeenCalledWith(5);
    });
  });

  describe('Hook Events', () => {
    test('should emit dual-agent specific hook events', async () => {
      const agentCommSpy = jest.fn();
      const qualityGateSpy = jest.fn();
      const workflowSpy = jest.fn();

      sessionManager.on('agent_communication', agentCommSpy);
      sessionManager.on('quality_gate', qualityGateSpy);
      sessionManager.on('workflow_transition', workflowSpy);

      // Simulate different event types by calling private method
      (sessionManager as any).emitSpecificHookEvents('agent_communication', {
        sessionId: 'test-session',
        agentType: 'manager',
        targetAgent: 'worker',
        messageType: 'task_assignment'
      });

      (sessionManager as any).emitSpecificHookEvents('quality_gate_result', {
        sessionId: 'test-session',
        qualityScore: 0.85,
        result: 'passed'
      });

      (sessionManager as any).emitSpecificHookEvents('workflow_transition', {
        sessionId: 'test-session',
        fromPhase: 'planning',
        toPhase: 'execution'
      });

      expect(agentCommSpy).toHaveBeenCalled();
      expect(qualityGateSpy).toHaveBeenCalled();
      expect(workflowSpy).toHaveBeenCalled();
    });

    test('should handle hook event errors gracefully', async () => {
      // Mock a scenario where hook event emission fails
      jest.spyOn(sessionManager, 'emit').mockImplementation(() => {
        throw new Error('Event emission failed');
      });

      // Should not throw when hook events fail
      await expect(
        sessionManager.createSession('Hook error test', '/test/workspace')
      ).resolves.toBeDefined();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Failed to emit hook event')
      );
    });
  });

  describe('showHistory', () => {
    test('should display session history to console', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      mockFs.readdir.mockResolvedValue(['session1.json'] as any);
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        id: 'session1',
        startTime: new Date('2024-01-01').toISOString(),
        initialPrompt: 'Test task',
        status: 'completed'
      }));

      await sessionManager.showHistory();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Session History:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('✅ session1'));
      
      consoleSpy.mockRestore();
    });

    test('should handle empty history', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      mockFs.readdir.mockResolvedValue([]);

      await sessionManager.showHistory();

      expect(consoleSpy).toHaveBeenCalledWith('No sessions found.');
      
      consoleSpy.mockRestore();
    });
  });
});

describe('ConsoleProgressReporter', () => {
  let reporter: ConsoleProgressReporter;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockLogger = new Logger() as jest.Mocked<Logger>;
    reporter = new ConsoleProgressReporter(mockLogger);
  });

  test('should report progress with visual progress bar', () => {
    reporter.updateProgress(3, 10, 'Processing step 3');

    expect(mockLogger.progress).toHaveBeenCalledWith(
      expect.stringContaining('[3/10]')
    );
    expect(mockLogger.progress).toHaveBeenCalledWith(
      expect.stringContaining('30%')
    );
    expect(mockLogger.info).toHaveBeenCalledWith('Autopilot: Processing step 3');
  });

  test('should report task completion with summary', () => {
    const summary: SessionSummary = {
      totalIterations: 5,
      totalDuration: 15000,
      successRate: 80,
      totalCost: 0.025,
      filesModified: ['file1.ts', 'file2.ts', 'file3.ts'],
      commandsExecuted: ['npm test', 'npm build']
    };

    reporter.reportTaskCompletion(summary);

    expect(mockLogger.success).toHaveBeenCalledWith(
      expect.stringContaining('Task completed')
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Summary: 5 iterations, 80% success rate'
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Files modified: 3'
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Estimated cost: $0.0250'
    );
  });

  test('should report errors', () => {
    reporter.reportError('Something went wrong');

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Autopilot error: Something went wrong'
    );
  });

  test('should handle many modified files by truncating display', () => {
    const summary: SessionSummary = {
      totalIterations: 1,
      totalDuration: 5000,
      successRate: 100,
      filesModified: Array.from({ length: 10 }, (_, i) => `file${i + 1}.ts`),
      commandsExecuted: []
    };

    reporter.reportTaskCompletion(summary);

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('... and 5 more')
    );
  });
});
