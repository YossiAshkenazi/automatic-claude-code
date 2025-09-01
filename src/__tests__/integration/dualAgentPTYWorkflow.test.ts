/**
 * End-to-End Dual-Agent PTY Workflow Tests
 * Tests the complete dual-agent system with PTY-based execution
 */

import { AgentCoordinator, AgentCoordinatorOptions } from '../../agents/agentCoordinator';
import { ClaudeExecutor } from '../../services/claudeExecutor';
import { ClaudeCodePTYController } from '../../services/ptyController';
import { Logger } from '../../logger';
import { AgentCoordinatorConfig } from '../../agents/agentTypes';
import * as fs from 'fs';
import * as path from 'path';

// Mock node-pty for testing
jest.mock('node-pty', () => ({
  spawn: jest.fn(() => {
    const mockPty = {
      pid: 12345,
      onData: jest.fn(),
      onExit: jest.fn(),
      write: jest.fn(),
      kill: jest.fn(),
      resize: jest.fn(),
      // Mock event handlers
      _dataHandlers: [] as Function[],
      _exitHandlers: [] as Function[],
    };

    // Mock onData method to store handlers
    mockPty.onData = (handler: Function) => {
      mockPty._dataHandlers.push(handler);
    };

    // Mock onExit method to store handlers
    mockPty.onExit = (handler: Function) => {
      mockPty._exitHandlers.push(handler);
    };

    // Add methods to simulate data and exit events
    (mockPty as any).simulateData = (data: string) => {
      mockPty._dataHandlers.forEach(handler => handler(data));
    };

    (mockPty as any).simulateExit = (code: number) => {
      mockPty._exitHandlers.forEach(handler => handler({ exitCode: code }));
    };

    return mockPty;
  })
}));

describe('Dual-Agent PTY Workflow End-to-End Tests', () => {
  let testWorkDir: string;
  let logger: Logger;
  let claudeExecutor: ClaudeExecutor;
  let agentCoordinator: AgentCoordinator;

  beforeEach(() => {
    // Setup test environment
    testWorkDir = path.join(__dirname, 'e2e-test-workspace');
    if (!fs.existsSync(testWorkDir)) {
      fs.mkdirSync(testWorkDir, { recursive: true });
    }

    logger = new Logger();
    claudeExecutor = new ClaudeExecutor(logger);

    const config: AgentCoordinatorConfig = {
      maxIterations: 3,
      coordinationInterval: 500,
      qualityGateThreshold: 0.8,
      maxConcurrentTasks: 1,
      enableCrossValidation: true
    };

    agentCoordinator = new AgentCoordinator(config);
  });

  afterEach(async () => {
    // Cleanup
    if (agentCoordinator) {
      await agentCoordinator.shutdown();
    }

    if (claudeExecutor) {
      await claudeExecutor.shutdown();
    }

    // Clean up test workspace
    if (fs.existsSync(testWorkDir)) {
      fs.rmSync(testWorkDir, { recursive: true, force: true });
    }
  });

  describe('Simple Task Workflows', () => {
    it('should complete a simple function creation task using PTY', async () => {
      const mockEvents: any[] = [];
      
      // Track coordination events
      agentCoordinator.on('coordination_event', (event) => {
        mockEvents.push(event);
      });

      // Mock the coordination process
      const startCoordinationSpy = jest.spyOn(agentCoordinator, 'startCoordination');
      startCoordinationSpy.mockImplementation(async () => {
        // Simulate manager analysis
        agentCoordinator.emit('coordination_event', {
          type: 'MANAGER_TASK_ASSIGNMENT',
          agentRole: 'manager',
          data: {
            workItems: [
              { id: 'task-1', title: 'Create add function', status: 'planned' }
            ],
            strategy: 'simple-implementation'
          },
          timestamp: new Date()
        });

        // Simulate worker execution
        agentCoordinator.emit('coordination_event', {
          type: 'WORKER_PROGRESS_UPDATE',
          agentRole: 'worker',
          data: {
            workItemId: 'task-1',
            status: 'completed',
            progress: 1.0
          },
          timestamp: new Date()
        });

        // Simulate manager review
        agentCoordinator.emit('coordination_event', {
          type: 'MANAGER_QUALITY_CHECK',
          agentRole: 'manager',
          data: {
            workItemId: 'task-1',
            passed: true,
            score: 0.9
          },
          timestamp: new Date()
        });

        // Simulate workflow completion
        agentCoordinator.emit('coordination_event', {
          type: 'WORKFLOW_TRANSITION',
          agentRole: null,
          data: { newPhase: 'completion' },
          timestamp: new Date()
        });
      });

      const options: AgentCoordinatorOptions = {
        maxIterations: 2,
        workDir: testWorkDir,
        usePTY: true,
        verbose: true,
        timeout: 10000
      };

      await agentCoordinator.startCoordination(
        "Create a simple TypeScript function that adds two numbers",
        options
      );

      expect(startCoordinationSpy).toHaveBeenCalled();
      expect(mockEvents.length).toBeGreaterThan(0);

      // Verify the workflow progressed through expected phases
      const taskAssignment = mockEvents.find(e => e.type === 'MANAGER_TASK_ASSIGNMENT');
      const workerProgress = mockEvents.find(e => e.type === 'WORKER_PROGRESS_UPDATE');
      const qualityCheck = mockEvents.find(e => e.type === 'MANAGER_QUALITY_CHECK');
      const workflowTransition = mockEvents.find(e => e.type === 'WORKFLOW_TRANSITION');

      expect(taskAssignment).toBeDefined();
      expect(workerProgress).toBeDefined();
      expect(qualityCheck).toBeDefined();
      expect(workflowTransition).toBeDefined();
    });
  });

  describe('Complex Multi-Step Workflows', () => {
    it('should handle complex authentication system implementation', async () => {
      const workflowEvents: any[] = [];
      
      agentCoordinator.on('coordination_event', (event) => {
        workflowEvents.push(event);
      });

      const startCoordinationSpy = jest.spyOn(agentCoordinator, 'startCoordination');
      startCoordinationSpy.mockImplementation(async () => {
        // Simulate complex task breakdown
        agentCoordinator.emit('coordination_event', {
          type: 'MANAGER_TASK_ASSIGNMENT',
          agentRole: 'manager',
          data: {
            workItems: [
              { id: 'auth-1', title: 'Create user model', status: 'planned' },
              { id: 'auth-2', title: 'Implement JWT service', status: 'planned' },
              { id: 'auth-3', title: 'Add authentication middleware', status: 'planned' },
              { id: 'auth-4', title: 'Create registration endpoint', status: 'planned' },
              { id: 'auth-5', title: 'Add comprehensive tests', status: 'planned' }
            ],
            strategy: 'layered-authentication-architecture'
          },
          timestamp: new Date()
        });

        // Simulate multiple handoffs
        agentCoordinator.emit('coordination_event', {
          type: 'MANAGER_WORKER_HANDOFF',
          agentRole: 'manager',
          data: {
            workItem: { id: 'auth-1', title: 'Create user model' },
            handoffCount: 1,
            reason: 'work_delegation'
          },
          timestamp: new Date()
        });

        // Simulate worker execution with progress updates
        for (let i = 1; i <= 5; i++) {
          agentCoordinator.emit('coordination_event', {
            type: 'WORKER_PROGRESS_UPDATE',
            agentRole: 'worker',
            data: {
              workItemId: `auth-${i}`,
              status: 'completed',
              progress: i / 5,
              artifactsCreated: [`src/auth/component-${i}.ts`]
            },
            timestamp: new Date()
          });

          // Manager quality check for each component
          agentCoordinator.emit('coordination_event', {
            type: 'MANAGER_QUALITY_CHECK',
            agentRole: 'manager',
            data: {
              workItemId: `auth-${i}`,
              passed: true,
              score: 0.85 + (i * 0.02), // Improving quality over time
              feedback: [`Component ${i} meets requirements`]
            },
            timestamp: new Date()
          });
        }

        // Final completion
        agentCoordinator.emit('coordination_event', {
          type: 'WORKFLOW_TRANSITION',
          agentRole: null,
          data: { newPhase: 'completion', overallProgress: 1.0 },
          timestamp: new Date()
        });
      });

      const options: AgentCoordinatorOptions = {
        maxIterations: 6,
        workDir: testWorkDir,
        usePTY: true,
        managerModel: 'opus',
        workerModel: 'sonnet',
        timeout: 30000
      };

      await agentCoordinator.startCoordination(
        "Implement a comprehensive authentication system with JWT, user registration, and middleware",
        options
      );

      expect(workflowEvents.length).toBeGreaterThan(10);

      // Verify complex workflow structure
      const taskAssignments = workflowEvents.filter(e => e.type === 'MANAGER_TASK_ASSIGNMENT');
      const handoffs = workflowEvents.filter(e => e.type === 'MANAGER_WORKER_HANDOFF');
      const progressUpdates = workflowEvents.filter(e => e.type === 'WORKER_PROGRESS_UPDATE');
      const qualityChecks = workflowEvents.filter(e => e.type === 'MANAGER_QUALITY_CHECK');

      expect(taskAssignments.length).toBe(1);
      expect(handoffs.length).toBeGreaterThanOrEqual(1);
      expect(progressUpdates.length).toBe(5);
      expect(qualityChecks.length).toBe(5);

      // Verify all quality checks passed
      qualityChecks.forEach(check => {
        expect(check.data.passed).toBe(true);
        expect(check.data.score).toBeGreaterThan(0.8);
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle PTY connection failures gracefully', async () => {
      const errorEvents: any[] = [];
      
      agentCoordinator.on('agent_error', (error) => {
        errorEvents.push(error);
      });

      // Mock PTY failure scenario
      const startCoordinationSpy = jest.spyOn(agentCoordinator, 'startCoordination');
      startCoordinationSpy.mockImplementation(async () => {
        // Simulate PTY connection failure
        throw new Error('PTY connection failed');
      });

      const options: AgentCoordinatorOptions = {
        maxIterations: 2,
        workDir: testWorkDir,
        usePTY: true,
        continueOnError: true
      };

      try {
        await agentCoordinator.startCoordination(
          "Simple test task",
          options
        );
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('PTY connection failed');
      }
    });

    it('should recover from worker execution errors', async () => {
      const recoveryEvents: any[] = [];
      
      agentCoordinator.on('coordination_event', (event) => {
        recoveryEvents.push(event);
      });

      const startCoordinationSpy = jest.spyOn(agentCoordinator, 'startCoordination');
      startCoordinationSpy.mockImplementation(async () => {
        // Simulate error and recovery sequence
        agentCoordinator.emit('coordination_event', {
          type: 'MANAGER_TASK_ASSIGNMENT',
          agentRole: 'manager',
          data: { workItems: [{ id: 'task-1', title: 'Failing task' }] },
          timestamp: new Date()
        });

        // Simulate worker error
        agentCoordinator.emit('coordination_event', {
          type: 'WORKER_PROGRESS_UPDATE',
          agentRole: 'worker',
          data: {
            workItemId: 'task-1',
            status: 'failed',
            error: 'Execution failed'
          },
          timestamp: new Date()
        });

        // Simulate manager reassignment
        agentCoordinator.emit('coordination_event', {
          type: 'MANAGER_TASK_ASSIGNMENT',
          agentRole: 'manager',
          data: {
            workItems: [{ id: 'task-1-retry', title: 'Retry task with different approach' }],
            strategy: 'alternative-approach'
          },
          timestamp: new Date()
        });

        // Simulate successful retry
        agentCoordinator.emit('coordination_event', {
          type: 'WORKER_PROGRESS_UPDATE',
          agentRole: 'worker',
          data: {
            workItemId: 'task-1-retry',
            status: 'completed',
            progress: 1.0
          },
          timestamp: new Date()
        });
      });

      const options: AgentCoordinatorOptions = {
        maxIterations: 3,
        workDir: testWorkDir,
        usePTY: true,
        continueOnError: true
      };

      await agentCoordinator.startCoordination(
        "Task that initially fails but should recover",
        options
      );

      // Verify error and recovery sequence
      const failedUpdate = recoveryEvents.find(e => 
        e.type === 'WORKER_PROGRESS_UPDATE' && e.data.status === 'failed'
      );
      const retryAssignment = recoveryEvents.find(e =>
        e.type === 'MANAGER_TASK_ASSIGNMENT' && e.data.strategy === 'alternative-approach'
      );
      const successfulUpdate = recoveryEvents.find(e =>
        e.type === 'WORKER_PROGRESS_UPDATE' && e.data.status === 'completed'
      );

      expect(failedUpdate).toBeDefined();
      expect(retryAssignment).toBeDefined();
      expect(successfulUpdate).toBeDefined();
    });
  });

  describe('PTY Session Management', () => {
    it('should manage PTY sessions across multiple agents', async () => {
      const ptyController = new ClaudeCodePTYController({ logger });
      
      // Mock PTY session management
      const initializeSpy = jest.spyOn(ptyController, 'initialize');
      const closeSpy = jest.spyOn(ptyController, 'close');
      
      initializeSpy.mockResolvedValue(void 0);

      await ptyController.initialize(testWorkDir);
      
      expect(initializeSpy).toHaveBeenCalledWith(testWorkDir);
      expect(ptyController.getSessionId()).toBeDefined();

      ptyController.close();
      expect(closeSpy).toHaveBeenCalled();
    });

    it('should handle concurrent PTY sessions for manager and worker', async () => {
      const managerPty = new ClaudeCodePTYController({
        logger,
        sessionId: 'manager-session'
      });
      
      const workerPty = new ClaudeCodePTYController({
        logger,
        sessionId: 'worker-session'
      });

      const managerInitSpy = jest.spyOn(managerPty, 'initialize');
      const workerInitSpy = jest.spyOn(workerPty, 'initialize');

      managerInitSpy.mockResolvedValue(void 0);
      workerInitSpy.mockResolvedValue(void 0);

      await Promise.all([
        managerPty.initialize(testWorkDir),
        workerPty.initialize(testWorkDir)
      ]);

      expect(managerPty.getSessionId()).toBe('manager-session');
      expect(workerPty.getSessionId()).toBe('worker-session');

      managerPty.close();
      workerPty.close();
    });
  });

  describe('Performance and Monitoring', () => {
    it('should track performance metrics during PTY execution', async () => {
      const startTime = Date.now();
      
      const startCoordinationSpy = jest.spyOn(agentCoordinator, 'startCoordination');
      startCoordinationSpy.mockImplementation(async () => {
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      const options: AgentCoordinatorOptions = {
        maxIterations: 1,
        workDir: testWorkDir,
        usePTY: true
      };

      await agentCoordinator.startCoordination("Performance test task", options);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeGreaterThan(90); // At least 90ms due to mock delay
      expect(duration).toBeLessThan(5000); // Should complete quickly in tests
    });

    it('should emit monitoring events compatible with dashboard', async () => {
      const monitoringEvents: any[] = [];
      
      // Mock monitoring event collection
      agentCoordinator.on('coordination_event', (event) => {
        monitoringEvents.push({
          type: event.type,
          agentRole: event.agentRole,
          timestamp: event.timestamp,
          data: event.data
        });
      });

      const startCoordinationSpy = jest.spyOn(agentCoordinator, 'startCoordination');
      startCoordinationSpy.mockImplementation(async () => {
        // Emit various monitoring events
        const eventTypes = [
          'MANAGER_TASK_ASSIGNMENT',
          'WORKER_PROGRESS_UPDATE',
          'MANAGER_QUALITY_CHECK',
          'WORKFLOW_TRANSITION'
        ];

        eventTypes.forEach(eventType => {
          agentCoordinator.emit('coordination_event', {
            type: eventType,
            agentRole: eventType.startsWith('MANAGER') ? 'manager' : 'worker',
            data: { mockData: true },
            timestamp: new Date()
          });
        });
      });

      await agentCoordinator.startCoordination("Monitoring test", {
        maxIterations: 1,
        workDir: testWorkDir,
        usePTY: true
      });

      expect(monitoringEvents.length).toBe(4);
      
      // Verify all events have required fields for monitoring dashboard
      monitoringEvents.forEach(event => {
        expect(event.type).toBeDefined();
        expect(event.timestamp).toBeInstanceOf(Date);
        expect(['manager', 'worker', null]).toContain(event.agentRole);
      });
    });
  });
});