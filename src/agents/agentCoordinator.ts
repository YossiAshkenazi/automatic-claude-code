import { EventEmitter } from 'events';
import { Logger } from '../logger';
import { SessionManager } from '../sessionManager';
import { OutputParser, ParsedOutput } from '../outputParser';
import {
  AgentRole,
  AgentMessage,
  WorkItem,
  TaskAssignment,
  ProgressUpdate,
  QualityCheck,
  WorkflowState,
  WorkflowPhase,
  AgentState,
  AgentCoordinatorConfig,
  ExecutionContext,
  CoordinationEvent,
  AgentError,
  ErrorType,
  RecoveryStrategy,
  TaskStatus,
  MessageType
} from './agentTypes';
import { ManagerAgent } from './managerAgent';
import { WorkerAgent } from './workerAgent';

export interface AgentCoordinatorOptions {
  maxIterations?: number;
  managerModel?: 'opus' | 'sonnet' | 'haiku';
  workerModel?: 'opus' | 'sonnet' | 'haiku';
  workDir?: string;
  verbose?: boolean;
  timeout?: number;
  continueOnError?: boolean;
  allowedTools?: string;
}

/**
 * Central coordinator for managing dual-agent workflows.
 * Orchestrates communication between Manager and Worker agents,
 * tracks workflow progress, and ensures quality gates are met.
 */
export class AgentCoordinator extends EventEmitter {
  private logger: Logger;
  private sessionManager: SessionManager;
  private outputParser: OutputParser;
  private managerAgent: ManagerAgent;
  private workerAgent: WorkerAgent;

  private executionContext: ExecutionContext;
  private messageQueue: AgentMessage[] = [];
  private coordinationInterval: NodeJS.Timeout | null = null;
  private isActive: boolean = false;
  private startTime: Date = new Date();

  constructor(config: AgentCoordinatorConfig) {
    super();
    
    this.logger = new Logger();
    this.sessionManager = new SessionManager();
    this.outputParser = new OutputParser();
    
    // Initialize execution context with default values
    this.executionContext = {
      sessionId: '',
      userRequest: '',
      workflowState: this.createInitialWorkflowState(),
      managerState: this.createInitialAgentState('manager', config),
      workerState: this.createInitialAgentState('worker', config),
      communicationHistory: [],
      artifacts: [],
      config
    };

    // Initialize agents
    this.managerAgent = new ManagerAgent(config, this.logger);
    this.workerAgent = new WorkerAgent(config, this.logger);

    // Set up agent event handlers
    this.setupAgentEventHandlers();

    this.logger.info('AgentCoordinator initialized', { config });
  }

  /**
   * Start dual-agent workflow coordination
   */
  async startCoordination(
    userRequest: string,
    options: AgentCoordinatorOptions
  ): Promise<void> {
    try {
      this.isActive = true;
      this.startTime = new Date();
      
      this.logger.info('Starting agent coordination', { 
        userRequest: userRequest.substring(0, 100),
        options 
      });

      // Create session
      const sessionId = await this.sessionManager.createSession(
        userRequest,
        options.workDir || process.cwd()
      );

      // Update execution context
      this.executionContext.sessionId = sessionId;
      this.executionContext.userRequest = userRequest;
      this.updateWorkflowPhase('analysis');

      // Initialize agents with context
      await this.initializeAgents(options);

      // Start coordination loop
      this.startCoordinationLoop();

      // Begin workflow with manager analysis
      await this.initiateManagerAnalysis(userRequest);

      // Execute main coordination workflow
      await this.executeCoordinationWorkflow(options);

    } catch (error) {
      this.logger.error('Agent coordination failed', { 
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    } finally {
      await this.shutdown();
    }
  }

  /**
   * Initialize both agents with execution context
   */
  private async initializeAgents(options: AgentCoordinatorOptions): Promise<void> {
    this.logger.info('Initializing agents');

    // Initialize manager agent
    await this.managerAgent.initialize({
      model: options.managerModel || 'opus',
      workDir: options.workDir,
      timeout: options.timeout || 1800000,
      verbose: options.verbose,
      allowedTools: options.allowedTools
    });

    // Initialize worker agent
    await this.workerAgent.initialize({
      model: options.workerModel || 'sonnet',
      workDir: options.workDir,
      timeout: options.timeout || 1800000,
      verbose: options.verbose,
      allowedTools: options.allowedTools
    });

    // Update agent states
    this.executionContext.managerState.status = 'idle';
    this.executionContext.workerState.status = 'idle';

    this.emit('agents_initialized', {
      managerModel: options.managerModel || 'opus',
      workerModel: options.workerModel || 'sonnet'
    });
  }

  /**
   * Start the coordination monitoring loop
   */
  private startCoordinationLoop(): void {
    const interval = this.executionContext.config.coordinationInterval || 5000;
    
    this.coordinationInterval = setInterval(() => {
      this.performCoordinationTasks();
    }, interval);

    this.logger.debug('Coordination loop started', { interval });
  }

  /**
   * Perform periodic coordination tasks
   */
  private performCoordinationTasks(): void {
    if (!this.isActive) return;

    try {
      // Process message queue
      this.processMessageQueue();

      // Update workflow progress
      this.updateWorkflowProgress();

      // Check for quality gates
      this.checkQualityGates();

      // Emit coordination event
      this.emitCoordinationEvent('AGENT_COORDINATION', null, {
        messageQueueLength: this.messageQueue.length,
        workflowProgress: this.executionContext.workflowState.overallProgress,
        activePhase: this.executionContext.workflowState.phase
      });

    } catch (error) {
      this.logger.error('Coordination task failed', { error });
    }
  }

  /**
   * Initiate manager analysis of the user request
   */
  private async initiateManagerAnalysis(userRequest: string): Promise<void> {
    this.logger.info('Initiating manager analysis');
    
    this.updateAgentStatus('manager', 'planning');
    
    try {
      const analysisResult = await this.managerAgent.analyzeTask(userRequest);
      
      if (analysisResult.workItems && analysisResult.workItems.length > 0) {
        // Update workflow state with work items
        this.executionContext.workflowState.totalWorkItems = analysisResult.workItems.length;
        this.executionContext.workflowState.activeWorkItems = analysisResult.workItems.map(item => item.id);

        this.logger.info('Manager analysis completed', {
          workItemCount: analysisResult.workItems.length,
          strategy: analysisResult.strategy
        });

        // Emit analysis completion event
        this.emitCoordinationEvent('MANAGER_TASK_ASSIGNMENT', 'manager', {
          workItems: analysisResult.workItems,
          strategy: analysisResult.strategy
        });

        // Move to planning phase
        this.updateWorkflowPhase('planning');
      }
    } catch (error) {
      await this.handleAgentError('manager', 'tool_failure', error instanceof Error ? error.message : String(error));
    } finally {
      this.updateAgentStatus('manager', 'idle');
    }
  }

  /**
   * Execute the main coordination workflow
   */
  private async executeCoordinationWorkflow(options: AgentCoordinatorOptions): Promise<void> {
    const maxIterations = options.maxIterations || 10;
    let currentIteration = 0;

    this.updateWorkflowPhase('execution');

    while (currentIteration < maxIterations && this.isActive) {
      currentIteration++;
      this.logger.info(`Coordination iteration ${currentIteration}/${maxIterations}`);

      try {
        // Check if workflow is complete
        if (this.isWorkflowComplete()) {
          this.logger.success('Workflow completed successfully');
          this.updateWorkflowPhase('completion');
          break;
        }

        // Coordinate next steps between agents
        await this.coordinateAgentWork();

        // Brief pause between iterations
        await this.delay(2000);

      } catch (error) {
        this.logger.error(`Coordination iteration ${currentIteration} failed`, { error });
        
        if (!options.continueOnError) {
          throw error;
        }
      }
    }

    if (currentIteration >= maxIterations) {
      this.logger.warning('Maximum coordination iterations reached');
    }
  }

  /**
   * Coordinate work between manager and worker agents
   */
  private async coordinateAgentWork(): Promise<void> {
    // Get pending work items
    const pendingWorkItems = this.getPendingWorkItems();
    
    if (pendingWorkItems.length === 0) {
      this.logger.info('No pending work items');
      return;
    }

    // Process work items based on current workflow phase
    for (const workItem of pendingWorkItems.slice(0, this.executionContext.config.maxConcurrentTasks)) {
      await this.processWorkItem(workItem);
    }
  }

  /**
   * Process a single work item through the agent workflow
   */
  private async processWorkItem(workItem: WorkItem): Promise<void> {
    this.logger.info(`Processing work item: ${workItem.title}`);

    try {
      if (workItem.status === 'planned') {
        // Assign to worker for execution
        await this.assignWorkToWorker(workItem);
      } else if (workItem.status === 'in_progress') {
        // Check progress with worker
        await this.checkWorkerProgress(workItem.id);
      } else if (workItem.status === 'completed') {
        // Manager review and quality check
        await this.managerReviewWork(workItem);
      }
    } catch (error) {
      this.logger.error(`Work item processing failed: ${workItem.id}`, { error });
      workItem.status = 'failed';
    }
  }

  /**
   * Assign work item to worker agent
   */
  private async assignWorkToWorker(workItem: WorkItem): Promise<void> {
    this.logger.info(`Assigning work to worker: ${workItem.title}`);
    
    this.updateAgentStatus('worker', 'executing');
    workItem.status = 'assigned';
    workItem.assignedTo = 'worker';

    try {
      const assignment: TaskAssignment = {
        workItem,
        context: this.buildWorkItemContext(workItem),
        requiredTools: this.inferRequiredTools(workItem),
        constraints: [],
        qualityGates: []
      };

      const result = await this.workerAgent.executeTask(assignment);
      
      if (result.success) {
        workItem.status = 'in_progress';
        this.logger.info(`Worker started task: ${workItem.id}`);
      } else {
        workItem.status = 'failed';
        this.logger.error(`Worker task assignment failed: ${workItem.id}`, { result });
      }

      // Send coordination message
      this.sendMessage('manager', 'worker', 'task_assignment', {
        workItem,
        result
      });

    } catch (error) {
      workItem.status = 'failed';
      await this.handleAgentError('worker', 'tool_failure', error instanceof Error ? error.message : String(error));
    } finally {
      this.updateAgentStatus('worker', 'idle');
    }
  }

  /**
   * Check worker progress on a work item
   */
  private async checkWorkerProgress(workItemId: string): Promise<void> {
    try {
      const progressUpdate = await this.workerAgent.getProgress(workItemId);
      
      if (progressUpdate) {
        this.logger.info(`Worker progress update: ${workItemId}`, {
          status: progressUpdate.status,
          confidence: progressUpdate.confidenceLevel
        });

        // Update work item status
        const workItem = this.findWorkItem(workItemId);
        if (workItem) {
          workItem.status = progressUpdate.status;
        }

        // Send progress to manager
        this.sendMessage('worker', 'manager', 'progress_update', progressUpdate);

        // Emit coordination event
        this.emitCoordinationEvent('WORKER_PROGRESS_UPDATE', 'worker', progressUpdate);
      }
    } catch (error) {
      this.logger.error(`Progress check failed: ${workItemId}`, { error });
    }
  }

  /**
   * Manager review and quality check of completed work
   */
  private async managerReviewWork(workItem: WorkItem): Promise<void> {
    this.logger.info(`Manager reviewing work: ${workItem.title}`);
    
    this.updateAgentStatus('manager', 'reviewing');

    try {
      const reviewResult = await this.managerAgent.reviewWork(workItem.id);
      
      if (reviewResult.approved) {
        workItem.status = 'completed';
        this.executionContext.workflowState.completedWorkItems++;
        
        this.logger.success(`Work item approved: ${workItem.id}`, {
          qualityScore: reviewResult.qualityScore
        });
      } else {
        workItem.status = 'failed';
        this.logger.warning(`Work item needs revision: ${workItem.id}`, {
          feedback: reviewResult.feedback
        });
      }

      // Send quality check message
      const qualityCheck: QualityCheck = {
        gateId: 'manager_review',
        workItemId: workItem.id,
        passed: reviewResult.approved,
        score: reviewResult.qualityScore || 0,
        feedback: reviewResult.feedback || [],
        recommendations: reviewResult.recommendations
      };

      this.sendMessage('manager', 'worker', 'quality_check', qualityCheck);

      // Emit coordination event
      this.emitCoordinationEvent('MANAGER_QUALITY_CHECK', 'manager', qualityCheck);

    } catch (error) {
      await this.handleAgentError('manager', 'tool_failure', error instanceof Error ? error.message : String(error));
    } finally {
      this.updateAgentStatus('manager', 'idle');
    }
  }

  /**
   * Set up event handlers for agent communication
   */
  private setupAgentEventHandlers(): void {
    // Manager agent events
    this.managerAgent.on('task_analyzed', (data) => {
      this.emit('manager_analysis_complete', data);
    });

    this.managerAgent.on('work_reviewed', (data) => {
      this.emit('manager_review_complete', data);
    });

    // Worker agent events
    this.workerAgent.on('task_started', (data) => {
      this.emit('worker_task_started', data);
    });

    this.workerAgent.on('task_completed', (data) => {
      this.emit('worker_task_completed', data);
    });

    this.workerAgent.on('progress_update', (data) => {
      this.emit('worker_progress_update', data);
    });

    // Error handling
    this.managerAgent.on('error', (error) => {
      this.handleAgentError('manager', 'tool_failure', error.message);
    });

    this.workerAgent.on('error', (error) => {
      this.handleAgentError('worker', 'tool_failure', error.message);
    });
  }

  /**
   * Send message between agents
   */
  private sendMessage(
    from: AgentRole,
    to: AgentRole,
    type: MessageType,
    payload: any,
    correlationId?: string
  ): void {
    const message: AgentMessage = {
      id: this.generateMessageId(),
      from,
      to,
      type,
      payload,
      timestamp: new Date(),
      correlationId
    };

    this.messageQueue.push(message);
    this.executionContext.communicationHistory.push(message);

    this.logger.debug('Message sent', { 
      from, 
      to, 
      type, 
      messageId: message.id 
    });

    this.emit('message_sent', message);
  }

  /**
   * Process the message queue
   */
  private processMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.deliverMessage(message);
      }
    }
  }

  /**
   * Deliver message to target agent
   */
  private deliverMessage(message: AgentMessage): void {
    try {
      if (message.to === 'manager') {
        this.managerAgent.receiveMessage(message);
      } else if (message.to === 'worker') {
        this.workerAgent.receiveMessage(message);
      }

      this.logger.debug('Message delivered', { 
        messageId: message.id,
        to: message.to 
      });

    } catch (error) {
      this.logger.error('Message delivery failed', { 
        messageId: message.id,
        error 
      });
    }
  }

  /**
   * Handle agent errors with recovery strategies
   */
  private async handleAgentError(
    agentRole: AgentRole,
    errorType: ErrorType,
    message: string,
    workItemId?: string
  ): Promise<void> {
    const agentError: AgentError = {
      id: this.generateErrorId(),
      agentRole,
      workItemId,
      errorType,
      message,
      recoveryStrategy: this.determineRecoveryStrategy(errorType, agentRole),
      timestamp: new Date()
    };

    this.logger.error('Agent error occurred', { 
      id: agentError.id,
      agentRole: agentError.agentRole,
      errorType: agentError.errorType,
      message: agentError.message
    });

    // Update agent state
    this.updateAgentStatus(agentRole, 'error');

    // Attempt recovery based on strategy
    const recoverySuccess = await this.attemptRecovery(agentError);

    if (recoverySuccess) {
      this.updateAgentStatus(agentRole, 'idle');
      this.logger.info('Agent error recovery successful', { 
        agentRole, 
        errorId: agentError.id 
      });
    } else {
      this.logger.error('Agent error recovery failed', { 
        agentRole, 
        errorId: agentError.id 
      });
    }

    this.emit('agent_error', agentError);
  }

  /**
   * Determine recovery strategy based on error type
   */
  private determineRecoveryStrategy(errorType: ErrorType, agentRole: AgentRole): RecoveryStrategy {
    switch (errorType) {
      case 'timeout':
        return {
          type: 'retry',
          maxAttempts: 3,
          backoffMs: 5000,
          fallbackPlan: `Switch to ${agentRole === 'manager' ? 'worker' : 'manager'} agent`
        };

      case 'tool_failure':
        return {
          type: 'retry',
          maxAttempts: 2,
          backoffMs: 2000,
          fallbackPlan: 'Use alternative tools or approach'
        };

      case 'communication_error':
        return {
          type: 'retry',
          maxAttempts: 3,
          backoffMs: 1000
        };

      case 'validation_failure':
        return {
          type: 'reassign',
          maxAttempts: 1,
          backoffMs: 0,
          fallbackPlan: 'Reassign to peer agent for alternative approach'
        };

      default:
        return {
          type: 'escalate',
          maxAttempts: 1,
          backoffMs: 0,
          fallbackPlan: 'Human intervention required'
        };
    }
  }

  /**
   * Attempt error recovery based on strategy
   */
  private async attemptRecovery(agentError: AgentError): Promise<boolean> {
    const strategy = agentError.recoveryStrategy;
    if (!strategy) return false;

    try {
      switch (strategy.type) {
        case 'retry':
          await this.delay(strategy.backoffMs);
          return true; // Caller should retry the operation

        case 'reassign':
          // Move work to the other agent
          if (agentError.workItemId) {
            const workItem = this.findWorkItem(agentError.workItemId);
            if (workItem && workItem.assignedTo) {
              workItem.assignedTo = workItem.assignedTo === 'manager' ? 'worker' : 'manager';
              workItem.status = 'planned';
              return true;
            }
          }
          return false;

        case 'skip':
          // Mark work item as failed and continue
          if (agentError.workItemId) {
            const workItem = this.findWorkItem(agentError.workItemId);
            if (workItem) {
              workItem.status = 'failed';
              return true;
            }
          }
          return false;

        case 'escalate':
        default:
          // Escalate to human intervention
          this.logger.error('Human intervention required', { 
            agentError,
            fallbackPlan: strategy.fallbackPlan 
          });
          return false;
      }
    } catch (recoveryError) {
      this.logger.error('Recovery attempt failed', { 
        originalError: agentError,
        recoveryError 
      });
      return false;
    }
  }

  /**
   * Helper methods for workflow management
   */
  private updateWorkflowPhase(phase: WorkflowPhase): void {
    this.executionContext.workflowState.phase = phase;
    this.logger.info(`Workflow phase updated: ${phase}`);
    
    this.emitCoordinationEvent('WORKFLOW_TRANSITION', null, { 
      previousPhase: this.executionContext.workflowState.phase,
      newPhase: phase 
    });
  }

  private updateAgentStatus(role: AgentRole, status: AgentState['status']): void {
    if (role === 'manager') {
      this.executionContext.managerState.status = status;
      this.executionContext.managerState.lastActivity = new Date();
    } else {
      this.executionContext.workerState.status = status;
      this.executionContext.workerState.lastActivity = new Date();
    }
  }

  private updateWorkflowProgress(): void {
    const { totalWorkItems, completedWorkItems } = this.executionContext.workflowState;
    
    if (totalWorkItems > 0) {
      this.executionContext.workflowState.overallProgress = completedWorkItems / totalWorkItems;
    }
  }

  private checkQualityGates(): void {
    // Implementation for quality gate checking
    // This would validate work against defined quality criteria
  }

  private isWorkflowComplete(): boolean {
    const { totalWorkItems, completedWorkItems } = this.executionContext.workflowState;
    return totalWorkItems > 0 && completedWorkItems >= totalWorkItems;
  }

  private getPendingWorkItems(): WorkItem[] {
    // Return work items that need processing
    // This would be implemented based on the actual work item storage
    return [];
  }

  private findWorkItem(workItemId: string): WorkItem | null {
    // Implementation to find work item by ID
    // This would be implemented based on the actual work item storage
    return null;
  }

  private buildWorkItemContext(workItem: WorkItem): string {
    return `Work Item: ${workItem.title}\nDescription: ${workItem.description}\nAcceptance Criteria: ${workItem.acceptanceCriteria.join(', ')}`;
  }

  private inferRequiredTools(workItem: WorkItem): string[] {
    // Infer required tools based on work item description
    const tools = ['Read', 'Write', 'Bash'];
    
    if (workItem.description.toLowerCase().includes('test')) {
      tools.push('MultiEdit');
    }
    
    if (workItem.description.toLowerCase().includes('search')) {
      tools.push('Grep', 'Glob');
    }
    
    return tools;
  }

  /**
   * Helper methods for creating initial states
   */
  private createInitialWorkflowState(): WorkflowState {
    return {
      phase: 'analysis',
      startTime: new Date(),
      totalWorkItems: 0,
      completedWorkItems: 0,
      activeWorkItems: [],
      blockedWorkItems: [],
      overallProgress: 0,
      qualityMetrics: {
        averageScore: 0,
        gatesPassed: 0,
        gatesFailed: 0,
        criticalIssues: 0
      }
    };
  }

  private createInitialAgentState(role: AgentRole, config: AgentCoordinatorConfig): AgentState {
    return {
      role,
      model: role === 'manager' ? 'opus' : 'sonnet',
      status: 'offline',
      currentWorkItems: [],
      capabilities: [],
      performance: {
        tasksCompleted: 0,
        averageQualityScore: 0,
        averageCompletionTime: 0,
        errorRate: 0,
        collaborationScore: 0
      },
      lastActivity: new Date()
    };
  }

  private emitCoordinationEvent(type: CoordinationEvent['type'], agentRole: AgentRole | null, data: any): void {
    const event: CoordinationEvent = {
      type,
      agentRole: agentRole || 'manager',
      data,
      timestamp: new Date()
    };

    this.emit('coordination_event', event);
  }

  /**
   * Utility methods
   */
  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  }

  private generateErrorId(): string {
    return `err-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Shutdown coordination and cleanup resources
   */
  async shutdown(): Promise<void> {
    this.isActive = false;
    
    // Stop coordination loop
    if (this.coordinationInterval) {
      clearInterval(this.coordinationInterval);
      this.coordinationInterval = null;
    }

    // Shutdown agents
    if (this.managerAgent) {
      await this.managerAgent.shutdown();
    }
    
    if (this.workerAgent) {
      await this.workerAgent.shutdown();
    }

    // Save session
    await this.sessionManager.saveSession();

    // Close logger
    this.logger.close();

    const duration = (Date.now() - this.startTime.getTime()) / 1000;
    this.logger.info('Agent coordination shutdown completed', { 
      duration: `${duration}s`,
      messagesProcessed: this.executionContext.communicationHistory.length
    });

    this.emit('coordination_shutdown');
  }

  /**
   * Public API methods for external monitoring
   */
  public getExecutionContext(): ExecutionContext {
    return { ...this.executionContext };
  }

  public getWorkflowState(): WorkflowState {
    return { ...this.executionContext.workflowState };
  }

  public getCommunicationHistory(): AgentMessage[] {
    return [...this.executionContext.communicationHistory];
  }

  public getAgentStates(): { manager: AgentState; worker: AgentState } {
    return {
      manager: { ...this.executionContext.managerState },
      worker: { ...this.executionContext.workerState }
    };
  }
}