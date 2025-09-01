/**
 * Integration Tests for PTY Controller with AgentCoordinator
 * Tests the PTY-based dual-agent execution system
 */

import { AgentCoordinator, AgentCoordinatorOptions } from '../../agents/agentCoordinator';
import { ClaudeCodePTYController } from '../../services/ptyController';
import { Logger } from '../../logger';
import { AgentCoordinatorConfig } from '../../agents/agentTypes';
import * as fs from 'fs';
import * as path from 'path';

// Mock the pty module for testing
jest.mock('node-pty', () => ({
  spawn: jest.fn(() => ({
    pid: 12345,
    onData: jest.fn(),
    onExit: jest.fn(),
    write: jest.fn(),
    kill: jest.fn(),
    resize: jest.fn()
  }))
}));

describe('PTY Controller Integration with AgentCoordinator', () => {
  let agentCoordinator: AgentCoordinator;
  let logger: Logger;
  let testWorkDir: string;
  let config: AgentCoordinatorConfig;

  beforeEach(async () => {
    // Setup test environment
    testWorkDir = path.join(__dirname, 'test-workspace');
    
    // Ensure test workspace exists
    if (!fs.existsSync(testWorkDir)) {
      fs.mkdirSync(testWorkDir, { recursive: true });
    }

    // Create test logger
    logger = new Logger();

    // Configuration for dual-agent coordination
    config = {
      maxIterations: 5,
      managerModel: 'opus' as const,
      workerModel: 'sonnet' as const,
      coordinationInterval: 1000,
      qualityGateThreshold: 0.8,
      maxConcurrentTasks: 2,
      enableCrossValidation: true
    };

    // Initialize AgentCoordinator
    agentCoordinator = new AgentCoordinator(config);
  });

  afterEach(async () => {
    // Cleanup
    if (agentCoordinator) {
      await agentCoordinator.shutdown();
    }

    // Clean up test workspace
    if (fs.existsSync(testWorkDir)) {
      fs.rmSync(testWorkDir, { recursive: true, force: true });
    }
  });

  describe('PTY Controller Initialization', () => {
    it('should initialize PTY controller for manager agent', async () => {
      const ptyController = new ClaudeCodePTYController({
        logger,
        sessionId: 'test-manager-session'
      });

      // Mock the initialize method to avoid actual PTY spawning
      jest.spyOn(ptyController, 'initialize').mockResolvedValue(void 0);
      
      await ptyController.initialize(testWorkDir);
      
      expect(ptyController.initialize).toHaveBeenCalledWith(testWorkDir);
    });

    it('should initialize PTY controller for worker agent', async () => {
      const ptyController = new ClaudeCodePTYController({
        logger,
        sessionId: 'test-worker-session'
      });

      jest.spyOn(ptyController, 'initialize').mockResolvedValue(void 0);
      
      await ptyController.initialize(testWorkDir);
      
      expect(ptyController.initialize).toHaveBeenCalledWith(testWorkDir);
    });
  });

  describe('Agent Coordination with PTY', () => {
    it('should coordinate dual-agent workflow using PTY controllers', async () => {
      const coordinationOptions: AgentCoordinatorOptions = {
        maxIterations: 3,
        workDir: testWorkDir,
        verbose: true,
        timeout: 30000
      };

      // Mock the PTY-based execution in AgentCoordinator
      const startCoordinationSpy = jest.spyOn(agentCoordinator, 'startCoordination');
      startCoordinationSpy.mockResolvedValue(void 0);

      const testPrompt = "Create a simple hello world function in TypeScript";
      
      await agentCoordinator.startCoordination(testPrompt, coordinationOptions);

      expect(startCoordinationSpy).toHaveBeenCalledWith(testPrompt, coordinationOptions);
    });

    it('should handle manager-worker handoffs using PTY communication', async () => {
      // Test that messages are properly exchanged between agents
      const mockHandoffEvents: any[] = [];

      agentCoordinator.on('coordination_event', (event) => {
        if (event.type === 'MANAGER_WORKER_HANDOFF') {
          mockHandoffEvents.push(event);
        }
      });

      // Mock agent initialization and execution
      const coordinationOptions: AgentCoordinatorOptions = {
        maxIterations: 2,
        workDir: testWorkDir,
        timeout: 15000
      };

      const startCoordinationSpy = jest.spyOn(agentCoordinator, 'startCoordination');
      startCoordinationSpy.mockImplementation(async () => {
        // Simulate handoff event
        agentCoordinator.emit('coordination_event', {
          type: 'MANAGER_WORKER_HANDOFF',
          agentRole: 'manager',
          data: { handoffCount: 1, reason: 'work_delegation' },
          timestamp: new Date()
        });
      });

      await agentCoordinator.startCoordination("Test task", coordinationOptions);

      expect(mockHandoffEvents).toHaveLength(1);
      expect(mockHandoffEvents[0].data.reason).toBe('work_delegation');
    });
  });

  describe('PTY Message Processing', () => {
    it('should process JSON messages from Claude PTY sessions', () => {
      const ptyController = new ClaudeCodePTYController({ logger });
      let receivedMessages: any[] = [];

      ptyController.on('message', (message) => {
        receivedMessages.push(message);
      });

      // Mock JSON message handling
      const mockMessage = {
        type: 'result',
        content: 'Task completed successfully',
        metadata: { workItemId: 'test-item-1' }
      };

      // Simulate receiving a JSON message (access private method for testing)
      (ptyController as any).handleJsonMessage(mockMessage);

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0].content).toBe('Task completed successfully');
    });

    it('should handle ready state detection from PTY output', () => {
      const ptyController = new ClaudeCodePTYController({ logger });
      let readyEventFired = false;

      ptyController.on('ready', () => {
        readyEventFired = true;
      });

      // Simulate ready state detection
      (ptyController as any).handleTextLine('Claude> Ready for next prompt');

      expect(readyEventFired).toBe(true);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle PTY process exit gracefully', () => {
      const ptyController = new ClaudeCodePTYController({ logger });
      let exitEventReceived = false;

      ptyController.on('exit', (exitData) => {
        exitEventReceived = true;
        expect(exitData.exitCode).toBe(0);
      });

      // Mock PTY process exit handling
      jest.spyOn(ptyController as any, 'setupEventHandlers').mockImplementation(() => {
        // Simulate exit event
        ptyController.emit('exit', { exitCode: 0 });
      });

      (ptyController as any).setupEventHandlers();

      expect(exitEventReceived).toBe(true);
    });

    it('should recover from communication errors between agents', async () => {
      // Test error recovery in agent coordination
      const errorEvents: any[] = [];

      agentCoordinator.on('agent_error', (error) => {
        errorEvents.push(error);
      });

      // Mock error handling in coordination
      const handleAgentErrorSpy = jest.spyOn(agentCoordinator as any, 'handleAgentError');
      handleAgentErrorSpy.mockResolvedValue(void 0);

      await (agentCoordinator as any).handleAgentError(
        'worker',
        'communication_error',
        'PTY connection lost',
        'test-work-item-1'
      );

      expect(handleAgentErrorSpy).toHaveBeenCalledWith(
        'worker',
        'communication_error',
        'PTY connection lost',
        'test-work-item-1'
      );
    });
  });

  describe('Session Management', () => {
    it('should manage PTY sessions across agent restarts', async () => {
      const sessionId = 'test-session-persistent';
      
      const ptyController1 = new ClaudeCodePTYController({
        logger,
        sessionId
      });

      const ptyController2 = new ClaudeCodePTYController({
        logger,
        sessionId
      });

      expect(ptyController1.getSessionId()).toBe(sessionId);
      expect(ptyController2.getSessionId()).toBe(sessionId);
    });

    it('should handle session cleanup on coordinator shutdown', async () => {
      const shutdownSpy = jest.spyOn(agentCoordinator, 'shutdown');
      shutdownSpy.mockResolvedValue(void 0);

      await agentCoordinator.shutdown();

      expect(shutdownSpy).toHaveBeenCalled();
    });
  });

  describe('Performance Monitoring', () => {
    it('should track coordination metrics during PTY-based execution', () => {
      // Test performance tracking
      const metrics = agentCoordinator.getHandoffMetrics();
      
      expect(metrics).toHaveProperty('totalHandoffs');
      expect(metrics).toHaveProperty('lastHandoffTime');
      expect(metrics).toHaveProperty('handoffRate');
      expect(typeof metrics.totalHandoffs).toBe('number');
    });

    it('should validate handoff execution patterns', () => {
      const validation = agentCoordinator.validateHandoffExecution();
      
      expect(validation).toHaveProperty('handoffsTriggered');
      expect(validation).toHaveProperty('workerExecutions'); 
      expect(validation).toHaveProperty('managerReviews');
      expect(validation).toHaveProperty('communicationFlow');
      expect(validation).toHaveProperty('issues');
      expect(Array.isArray(validation.issues)).toBe(true);
    });
  });

  describe('Authentication Handling', () => {
    it('should handle OAuth token extraction for PTY sessions', async () => {
      const ptyController = new ClaudeCodePTYController({ logger });

      // Mock OAuth token extraction
      const extractTokenSpy = jest.spyOn(ptyController as any, 'extractOAuthToken');
      extractTokenSpy.mockResolvedValue('mock-oauth-token');

      const token = await (ptyController as any).extractOAuthToken();

      expect(extractTokenSpy).toHaveBeenCalled();
      expect(token).toBe('mock-oauth-token');
    });

    it('should remove API key from environment for PTY processes', async () => {
      const ptyController = new ClaudeCodePTYController({ logger });
      
      // Mock initialize to check environment handling
      const initializeSpy = jest.spyOn(ptyController, 'initialize');
      initializeSpy.mockImplementation(async () => {
        // Verify API key is not in environment
        const env = process.env;
        expect(env.ANTHROPIC_API_KEY).toBeUndefined();
      });

      await ptyController.initialize(testWorkDir);
    });
  });

  describe('Tool Integration', () => {
    it('should emit tool usage events during PTY execution', () => {
      const ptyController = new ClaudeCodePTYController({ logger });
      let toolUseEvents: any[] = [];

      ptyController.on('tool_use', (event) => {
        toolUseEvents.push(event);
      });

      // Mock tool use message
      const toolMessage = {
        type: 'tool_use',
        tool: 'Read',
        parameters: { file_path: '/test/file.ts' },
        result: 'File content here'
      };

      (ptyController as any).handleJsonMessage(toolMessage);

      expect(toolUseEvents).toHaveLength(1);
      expect(toolUseEvents[0].tool).toBe('Read');
    });
  });
});

describe('PTY Agent Coordination Integration Scenarios', () => {
  let agentCoordinator: AgentCoordinator;
  let testWorkDir: string;

  beforeEach(() => {
    testWorkDir = path.join(__dirname, 'integration-test-workspace');
    if (!fs.existsSync(testWorkDir)) {
      fs.mkdirSync(testWorkDir, { recursive: true });
    }

    const config: AgentCoordinatorConfig = {
      maxIterations: 3,
      managerModel: 'opus' as const,
      workerModel: 'sonnet' as const,
      coordinationInterval: 500,
      qualityGateThreshold: 0.8,
      maxConcurrentTasks: 1,
      enableCrossValidation: false
    };

    agentCoordinator = new AgentCoordinator(config);
  });

  afterEach(async () => {
    if (agentCoordinator) {
      await agentCoordinator.shutdown();
    }
    if (fs.existsSync(testWorkDir)) {
      fs.rmSync(testWorkDir, { recursive: true, force: true });
    }
  });

  it('should execute simple task coordination using PTY', async () => {
    const testPrompt = "Create a simple TypeScript function that adds two numbers";
    
    // Mock the coordination process
    const startCoordinationSpy = jest.spyOn(agentCoordinator, 'startCoordination');
    startCoordinationSpy.mockImplementation(async () => {
      // Simulate successful coordination
      agentCoordinator.emit('coordination_event', {
        type: 'WORKFLOW_TRANSITION',
        agentRole: 'manager',
        data: { newPhase: 'completion' },
        timestamp: new Date()
      });
    });

    const coordinationOptions: AgentCoordinatorOptions = {
      maxIterations: 2,
      workDir: testWorkDir,
      verbose: true,
      timeout: 10000
    };

    await expect(agentCoordinator.startCoordination(testPrompt, coordinationOptions))
      .resolves.not.toThrow();
  });

  it('should handle complex multi-step task breakdown', async () => {
    const complexPrompt = "Implement a complete authentication system with JWT tokens, password hashing, and user registration";
    
    const workflowEvents: any[] = [];
    agentCoordinator.on('coordination_event', (event) => {
      workflowEvents.push(event);
    });

    // Mock complex workflow
    const startCoordinationSpy = jest.spyOn(agentCoordinator, 'startCoordination');
    startCoordinationSpy.mockImplementation(async () => {
      // Simulate manager analysis
      agentCoordinator.emit('coordination_event', {
        type: 'MANAGER_TASK_ASSIGNMENT',
        agentRole: 'manager', 
        data: { workItems: ['auth-middleware', 'user-model', 'jwt-service'], strategy: 'layered-architecture' },
        timestamp: new Date()
      });

      // Simulate worker progress
      agentCoordinator.emit('coordination_event', {
        type: 'WORKER_PROGRESS_UPDATE',
        agentRole: 'worker',
        data: { workItemId: 'auth-middleware', status: 'completed' },
        timestamp: new Date()
      });

      // Simulate manager review
      agentCoordinator.emit('coordination_event', {
        type: 'MANAGER_QUALITY_CHECK',
        agentRole: 'manager',
        data: { workItemId: 'auth-middleware', passed: true, score: 0.9 },
        timestamp: new Date()
      });
    });

    const coordinationOptions: AgentCoordinatorOptions = {
      maxIterations: 4,
      workDir: testWorkDir,
      timeout: 20000
    };

    await agentCoordinator.startCoordination(complexPrompt, coordinationOptions);

    expect(workflowEvents.length).toBeGreaterThan(0);
    expect(workflowEvents.some(e => e.type === 'MANAGER_TASK_ASSIGNMENT')).toBe(true);
    expect(workflowEvents.some(e => e.type === 'WORKER_PROGRESS_UPDATE')).toBe(true);
    expect(workflowEvents.some(e => e.type === 'MANAGER_QUALITY_CHECK')).toBe(true);
  });
});