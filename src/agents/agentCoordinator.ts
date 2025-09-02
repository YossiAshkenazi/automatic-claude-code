import { EventEmitter } from 'events';
import { Logger } from '../logger';
import { SessionManager } from '../sessionManager';
import { monitoringManager } from '../monitoringManager';
import { OutputParser, ParsedOutput } from '../outputParser';
import { SDKClaudeExecutor } from '../services/sdkClaudeExecutor';
import {
  AgentRole,
  AgentMessage,
  WorkItem,
  TaskAssignment,
  ProgressUpdate,
  QualityCheck,
  QualityGate,
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
// Handoff logic is now integrated into this coordinator and outputParser

export interface AgentCoordinatorOptions {
  maxIterations?: number;
  managerModel?: 'opus' | 'sonnet' | 'haiku';
  workerModel?: 'opus' | 'sonnet' | 'haiku';
  workDir?: string;
  verbose?: boolean;
  timeout?: number;
  continueOnError?: boolean;
  allowedTools?: string;
  usePTY?: boolean; // Enable PTY-based execution
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
  private claudeExecutor: SDKClaudeExecutor;

  private executionContext: ExecutionContext;
  private messageQueue: AgentMessage[] = [];
  private coordinationInterval: NodeJS.Timeout | null = null;
  private isActive: boolean = false;
  private startTime: Date = new Date();
  private lastHandoffTime?: Date;
  private handoffCount: number = 0;

  // Rate limiting for monitoring events
  private lastMonitoringEventTime: Map<string, number> = new Map();
  private monitoringEventCooldown: number = 10000; // 10 seconds minimum between similar events
  private lastProgressUpdate: number = 0;
  private progressUpdateThreshold: number = 0.05; // Only send updates for 5% progress changes

  constructor(config: AgentCoordinatorConfig) {
    super();
    
    this.logger = new Logger();
    this.sessionManager = new SessionManager();
    this.outputParser = new OutputParser();
    this.claudeExecutor = new SDKClaudeExecutor(this.logger);
    
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

      // Send initial monitoring event
      this.emitCoordinationEvent('AGENT_COORDINATION', 'manager', {
        phase: 'initialization',
        sessionId,
        userRequest,
        workDir: options.workDir || process.cwd()
      });

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
    this.logger.info('Initializing agents with PTY support', { usePTY: options.usePTY });

    // Create PTY sessions for agents if enabled
    if (options.usePTY) {
      const managerSession = await this.claudeExecutor.getOrCreatePTYSession(
        `manager-${this.executionContext.sessionId}`,
        options.workDir
      );
      
      const workerSession = await this.claudeExecutor.getOrCreatePTYSession(
        `worker-${this.executionContext.sessionId}`,
        options.workDir
      );
      
      this.logger.info('PTY sessions created for both agents', { 
        managerSessionId: managerSession.sessionId,
        workerSessionId: workerSession.sessionId
      });
    }

    // Initialize manager agent
    await this.managerAgent.initialize({
      model: options.managerModel || 'opus',
      workDir: options.workDir,
      timeout: options.timeout || 1800000,
      verbose: options.verbose,
      allowedTools: options.allowedTools,
      usePTY: options.usePTY,
      claudeExecutor: this.claudeExecutor
    });

    // Initialize worker agent
    await this.workerAgent.initialize({
      model: options.workerModel || 'sonnet',
      workDir: options.workDir,
      timeout: options.timeout || 1800000,
      verbose: options.verbose,
      allowedTools: options.allowedTools,
      usePTY: options.usePTY,
      claudeExecutor: this.claudeExecutor
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
    // Increase default interval to reduce frequency of monitoring events
    const interval = this.executionContext.config.coordinationInterval || 15000; // Changed from 5s to 15s
    
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

      // Only emit coordination events if there's meaningful change
      const currentProgress = this.executionContext.workflowState.overallProgress;
      const shouldEmitProgressUpdate = Math.abs(currentProgress - this.lastProgressUpdate) >= this.progressUpdateThreshold;
      
      if (shouldEmitProgressUpdate || this.messageQueue.length > 0) {
        this.emitCoordinationEvent('AGENT_COORDINATION', null, {
          messageQueueLength: this.messageQueue.length,
          workflowProgress: currentProgress,
          activePhase: this.executionContext.workflowState.phase
        });
        this.lastProgressUpdate = currentProgress;
      }

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

        // Store work items for handoff
        this.storeWorkItemsForHandoff(analysisResult.workItems);

        this.logger.info('Manager analysis completed', {
          workItemCount: analysisResult.workItems.length,
          strategy: analysisResult.strategy
        });

        // Emit analysis completion event
        this.emitCoordinationEvent('MANAGER_TASK_ASSIGNMENT', 'manager', {
          workItems: analysisResult.workItems,
          strategy: analysisResult.strategy
        });

        // Move to planning phase and trigger handoff
        this.updateWorkflowPhase('planning');
        
        // Process all work items for handoff
        for (const workItem of analysisResult.workItems) {
          await this.triggerWorkerHandoff(workItem, analysisResult.strategy);
          // Small delay between handoffs to prevent overwhelming
          await this.delay(500);
        }
      }
    } catch (error) {
      // Send error monitoring event
      this.emitCoordinationEvent('AGENT_COORDINATION', 'manager', {
        phase: 'analysis_error',
        error: error instanceof Error ? error.message : String(error),
        errorType: 'manager_analysis_failed'
      });
      
      await this.handleAgentError('manager', 'tool_failure', error instanceof Error ? error.message : String(error));
    } finally {
      this.updateAgentStatus('manager', 'idle');
    }
  }

  /**
   * Execute the main coordination workflow
   */
  private async executeCoordinationWorkflow(options: AgentCoordinatorOptions): Promise<void> {
    const maxIterations = Math.min(options.maxIterations || 10, 25); // Hard cap at 25
    let currentIteration = 0;
    let idleIterations = 0;
    let consecutiveErrors = 0;
    const maxIdleIterations = 5; // Stop if no progress for 5 iterations
    const maxConsecutiveErrors = 3;
    let lastWorkflowState = { ...this.executionContext.workflowState };

    this.updateWorkflowPhase('execution');
    this.logger.info(`Starting coordination workflow (max ${maxIterations} iterations)`);

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

        // Validate agents are ready
        if (!this.validateAgentsReady()) {
          this.logger.warning('Agents not ready, waiting...');
          await this.delay(2000); // Longer wait for agent readiness
          continue;
        }
        
        // Check for workflow progress (prevent endless loops)
        const currentWorkflowState = { ...this.executionContext.workflowState };
        const hasProgress = this.hasWorkflowProgressed(lastWorkflowState, currentWorkflowState);
        
        if (!hasProgress) {
          idleIterations++;
          this.logger.warning(`No workflow progress detected (idle iteration ${idleIterations}/${maxIdleIterations})`);
          
          if (idleIterations >= maxIdleIterations) {
            this.logger.error('Workflow appears stuck - no progress after multiple iterations');
            this.logger.info('Workflow State Analysis:', {
              totalWorkItems: currentWorkflowState.totalWorkItems,
              completedWorkItems: currentWorkflowState.completedWorkItems,
              pendingHandoffs: this.handoffQueue.length,
              activeWorkItems: currentWorkflowState.activeWorkItems.length,
              phase: currentWorkflowState.phase
            });
            
            // Only try to restart analysis once, then exit to prevent infinite loops
            if (currentWorkflowState.totalWorkItems === 0 && idleIterations === maxIdleIterations) {
              this.logger.info('Attempting to restart manager analysis due to lack of work items (final attempt)');
              await this.initiateManagerAnalysis(this.executionContext.userRequest);
              // Continue the loop for one more cycle to see if analysis produces work items
            } else {
              // Force completion if still no progress after restart attempt
              this.logger.warning('Forcing workflow completion due to lack of progress');
              this.updateWorkflowPhase('completion');
              break;
            }
          }
        } else {
          idleIterations = 0; // Reset idle counter on progress
          consecutiveErrors = 0; // Reset error counter on progress
        }
        
        lastWorkflowState = currentWorkflowState;

        // Coordinate next steps between agents
        await this.coordinateAgentWork();

        // Progressive delay - longer delays for later iterations
        const iterationDelay = Math.min(1500 + (currentIteration * 200), 5000);
        await this.delay(iterationDelay);

      } catch (error) {
        consecutiveErrors++;
        this.logger.error(`Coordination iteration ${currentIteration} failed (consecutive error ${consecutiveErrors}/${maxConsecutiveErrors})`, { error });
        
        if (consecutiveErrors >= maxConsecutiveErrors) {
          this.logger.error('Too many consecutive coordination errors - stopping workflow');
          throw new Error(`Coordination failed after ${maxConsecutiveErrors} consecutive errors. Last error: ${error instanceof Error ? error.message : String(error)}`);
        }
        
        if (!options.continueOnError) {
          throw error;
        }
        
        // Add delay for error recovery
        await this.delay(3000 * consecutiveErrors);
      }
    }

    if (currentIteration >= maxIterations) {
      this.logger.warning('Maximum coordination iterations reached');
      this.emitCoordinationEvent('WORKFLOW_TRANSITION', 'manager', {
        reason: 'max_iterations_reached',
        currentIteration,
        maxIterations
      });
    }
    
    // Final workflow analysis
    this.logger.info('Coordination workflow completed', {
      totalIterations: currentIteration,
      finalState: {
        totalWorkItems: this.executionContext.workflowState.totalWorkItems,
        completedWorkItems: this.executionContext.workflowState.completedWorkItems,
        pendingHandoffs: this.handoffQueue.length,
        pendingWorkItems: this.pendingWorkItems.size,
        idleIterations,
        consecutiveErrors
      },
      workflowPhase: this.executionContext.workflowState.phase
    });
  }

  /**
   * Coordinate work between manager and worker agents
   */
  private async coordinateAgentWork(): Promise<void> {
    // Check for handoff opportunity first
    await this.evaluateHandoffOpportunity();

    // Get pending work items
    const pendingWorkItems = this.getPendingWorkItems();
    
    if (pendingWorkItems.length === 0) {
      this.logger.info('No pending work items');
      
      // If we have no pending work AND no work items were ever created,
      // trigger manager to analyze the task again or mark as complete
      const { totalWorkItems } = this.executionContext.workflowState;
      if (totalWorkItems === 0 && this.executionContext.workflowState.phase === 'analysis') {
        this.logger.info('No work items created, attempting manager analysis');
        await this.initiateManagerAnalysis(this.executionContext.userRequest);
      }
      
      return;
    }

    // Process work items based on current workflow phase
    for (const workItem of pendingWorkItems.slice(0, this.executionContext.config.maxConcurrentTasks || 1)) {
      await this.processWorkItem(workItem);
    }
  }

  /**
   * Evaluate if a handoff should occur from Manager to Worker
   */
  private async evaluateHandoffOpportunity(): Promise<void> {
    // Skip if Worker is already busy or if we recently handed off
    if (this.executionContext.workerState.status === 'executing') {
      return;
    }

    // Don't evaluate handoffs too frequently
    if (this.lastHandoffTime && 
        (Date.now() - this.lastHandoffTime.getTime()) < 15000) { // 15 seconds
      return;
    }

    try {
      // Get recent Manager output for analysis
      const recentManagerOutput = await this.getRecentManagerOutput();
      if (!recentManagerOutput) {
        return;
      }

      // Use outputParser to analyze Manager output for handoff triggers
      const handoffAnalysis = this.outputParser.analyzeAgentOutput(recentManagerOutput, 'manager');
      
      if (handoffAnalysis.needsHandoff && handoffAnalysis.analysisComplete) {
        this.logger.info('Manager handoff trigger detected', {
          reason: handoffAnalysis.handoffReason,
          taskBreakdown: handoffAnalysis.taskBreakdown?.length || 0
        });
        
        await this.processManagerHandoff(handoffAnalysis);
      } else {
        // Fallback: check basic handoff conditions
        const handoffNeeded = this.checkHandoffConditions();
        
        if (handoffNeeded) {
          this.logger.info('Basic handoff conditions met - proceeding with delegation');
          await this.processHandoffDecision();
        }
      }

    } catch (error) {
      this.logger.error('Handoff evaluation failed', { error });
    }
  }

  /**
   * Check if handoff conditions are met
   */
  private checkHandoffConditions(): boolean {
    // Check if manager has completed analysis and there are pending work items
    const hasAnalysisComplete = this.executionContext.workflowState.phase === 'planning' || this.executionContext.workflowState.phase === 'execution';
    const hasPendingWork = this.pendingWorkItems.size > 0 || this.handoffQueue.length > 0;
    const workerIsIdle = this.executionContext.workerState.status === 'idle';
    
    return hasAnalysisComplete && hasPendingWork && workerIsIdle;
  }

  /**
   * Process Manager's handoff based on output analysis
   */
  private async processManagerHandoff(analysis: { needsHandoff: boolean; handoffReason?: string; taskBreakdown?: string[]; analysisComplete?: boolean; }): Promise<void> {
    this.logger.info('Processing Manager handoff based on analysis', {
      reason: analysis.handoffReason,
      taskCount: analysis.taskBreakdown?.length || 0
    });
    
    try {
      // Create work items from task breakdown if available
      if (analysis.taskBreakdown && analysis.taskBreakdown.length > 0) {
        const workItems = this.createWorkItemsFromBreakdown(analysis.taskBreakdown);
        this.storeWorkItemsForHandoff(workItems);
      }
      
      // Process the handoff
      await this.processHandoffDecision();
      
    } catch (error) {
      this.logger.error('Manager handoff processing failed', { error });
      throw error;
    }
  }
  
  /**
   * Create work items from task breakdown
   */
  private createWorkItemsFromBreakdown(taskBreakdown: string[]): WorkItem[] {
    const now = new Date();
    return taskBreakdown.map((task, index) => ({
      id: `work-item-${Date.now()}-${index}`,
      title: task.length > 50 ? task.substring(0, 50) + '...' : task,
      description: task,
      status: 'planned' as TaskStatus,
      priority: 3,
      estimatedEffort: 2,
      acceptanceCriteria: [`Complete: ${task}`],
      dependencies: [],
      assignedTo: undefined,
      createdAt: now,
      updatedAt: now
    }));
  }
  
  /**
   * Process handoff decision using integrated logic
   */
  private async processHandoffDecision(): Promise<void> {
    this.logger.info('Processing handoff decision - delegating work to Worker');

    try {
      if (this.handoffQueue.length > 0) {
        await this.processPendingHandoffs();
      } else if (this.pendingWorkItems.size > 0) {
        const workItem = Array.from(this.pendingWorkItems.values())[0];
        const context = this.buildWorkItemContext(workItem);
        await this.executeWorkerTask(workItem, context);
      }

      // Increment handoff counter and track timing
      this.handoffCount++;
      this.lastHandoffTime = new Date();
      
      // Emit handoff event
      this.emitCoordinationEvent('MANAGER_WORKER_HANDOFF', 'manager', {
        handoffCount: this.handoffCount,
        reason: 'work_delegation'
      });

      // Update workflow phase if moving from planning to execution
      if (this.executionContext.workflowState.phase === 'planning') {
        this.updateWorkflowPhase('execution');
      }

    } catch (error) {
      this.logger.error('Handoff processing failed', { error });
      throw error;
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
   * Assign work item to worker agent (legacy method - now uses executeWorkerTask)
   */
  private async assignWorkToWorker(workItem: WorkItem): Promise<void> {
    this.logger.info(`Assigning work to worker: ${workItem.title}`);
    
    // Use the new comprehensive execution method
    const context = this.buildWorkItemContext(workItem);
    await this.executeWorkerTask(workItem, context);
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
   * Storage for work items ready for handoff
   */
  private pendingWorkItems: Map<string, WorkItem> = new Map();
  private handoffQueue: Array<{ workItem: WorkItem; context: string }> = [];

  /**
   * Store work items for handoff to worker
   */
  private storeWorkItemsForHandoff(workItems: WorkItem[]): void {
    workItems.forEach(item => {
      this.pendingWorkItems.set(item.id, item);
      this.handoffQueue.push({
        workItem: item,
        context: this.buildWorkItemContext(item)
      });
    });
    
    this.logger.info('Work items stored for handoff', { count: workItems.length });
  }

  /**
   * Check if there are pending handoffs
   */
  private hasPendingHandoffs(): boolean {
    return this.handoffQueue.length > 0;
  }

  /**
   * Process pending handoffs
   */
  private async processPendingHandoffs(): Promise<void> {
    if (this.handoffQueue.length === 0) return;

    const handoff = this.handoffQueue.shift();
    if (handoff) {
      this.logger.info('Processing handoff', { 
        workItemId: handoff.workItem.id,
        title: handoff.workItem.title 
      });

      await this.executeWorkerTask(handoff.workItem, handoff.context);
      
      // Increment handoff counter after processing
      this.handoffCount++;
      this.lastHandoffTime = new Date();
    }
  }

  /**
   * Trigger handoff to worker with specific work item
   */
  private async triggerWorkerHandoff(workItem: WorkItem, strategy: string): Promise<void> {
    this.logger.info('Triggering worker handoff', {
      workItemId: workItem.id,
      title: workItem.title,
      strategy: strategy.substring(0, 100)
    });

    try {
      // Build comprehensive context for worker
      const context = this.buildComprehensiveWorkItemContext(workItem, strategy);
      
      // Execute task immediately
      await this.executeWorkerTask(workItem, context);
      
      // Increment handoff counter and track timing
      this.handoffCount++;
      this.lastHandoffTime = new Date();
      
      // Emit handoff event
      this.emitCoordinationEvent('MANAGER_WORKER_HANDOFF', 'manager', {
        workItem,
        context,
        strategy,
        handoffCount: this.handoffCount
      });

    } catch (error) {
      this.logger.error('Worker handoff failed', {
        workItemId: workItem.id,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Put work item back in queue
      this.handoffQueue.unshift({ workItem, context: strategy });
    }
  }

  /**
   * Execute worker task with proper context
   */
  private async executeWorkerTask(workItem: WorkItem, context: string): Promise<void> {
    this.logger.info('Executing worker task', {
      workItemId: workItem.id,
      title: workItem.title
    });

    this.updateAgentStatus('worker', 'executing');
    workItem.status = 'in_progress';
    workItem.assignedTo = 'worker';

    try {
      const assignment: TaskAssignment = {
        workItem,
        context,
        requiredTools: this.inferRequiredTools(workItem),
        constraints: this.buildTaskConstraints(workItem),
        qualityGates: this.buildQualityGates(workItem)
      };

      const result = await this.workerAgent.executeTask(assignment);
      
      if (result.success) {
        workItem.status = 'completed';
        this.executionContext.workflowState.completedWorkItems++;
        
        this.logger.success('Worker task completed', {
          workItemId: workItem.id,
          duration: result.duration,
          artifacts: result.artifactsCreated.length
        });

        // Trigger manager review
        setTimeout(() => {
          this.triggerManagerReview(workItem);
        }, 1000);
        
      } else {
        workItem.status = 'failed';
        this.logger.error('Worker task failed', {
          workItemId: workItem.id,
          error: result.error
        });
      }

      // Send coordination message
      this.sendMessage('worker', 'manager', 'completion_report', {
        workItemId: workItem.id,
        result,
        workItem
      });

    } catch (error) {
      workItem.status = 'failed';
      await this.handleAgentError('worker', 'tool_failure', error instanceof Error ? error.message : String(error), workItem.id);
    } finally {
      this.updateAgentStatus('worker', 'idle');
    }
  }

  /**
   * Trigger manager review of completed work
   */
  private async triggerManagerReview(workItem: WorkItem): Promise<void> {
    this.logger.info('Triggering manager review', {
      workItemId: workItem.id,
      title: workItem.title
    });

    try {
      await this.managerReviewWork(workItem);
    } catch (error) {
      this.logger.error('Manager review failed', {
        workItemId: workItem.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Build comprehensive work item context with strategy
   */
  private buildComprehensiveWorkItemContext(workItem: WorkItem, strategy: string): string {
    return `
STRATEGIC CONTEXT:
${strategy}

WORK ITEM DETAILS:
Title: ${workItem.title}
Description: ${workItem.description}
Priority: ${workItem.priority}/5
Estimated Effort: ${workItem.estimatedEffort} hours

ACCEPTANCE CRITERIA:
${workItem.acceptanceCriteria.map(criteria => `- ${criteria}`).join('\n')}

DEPENDENCIES:
${workItem.dependencies && workItem.dependencies.length > 0 ? workItem.dependencies.map(dep => `- ${dep}`).join('\n') : 'None'}

QUALITY REQUIREMENTS:
- Code must follow best practices
- Include appropriate error handling
- Add tests where applicable
- Document complex logic
- Ensure security considerations
    `.trim();
  }

  /**
   * Build task constraints for worker
   */
  private buildTaskConstraints(workItem: WorkItem): string[] {
    const constraints = [
      'Follow established coding standards',
      'Implement proper error handling',
      'Write maintainable code'
    ];

    if (workItem.priority >= 4) {
      constraints.push('High priority - focus on core functionality first');
    }

    if (workItem.estimatedEffort > 4) {
      constraints.push('Complex task - break into smaller steps if needed');
    }

    return constraints;
  }

  /**
   * Build quality gates for worker
   */
  private buildQualityGates(workItem: WorkItem): QualityGate[] {
    return [
      {
        id: 'functionality-gate',
        name: 'functionality',
        criteria: [{ 
          name: 'acceptance_criteria', 
          description: 'All acceptance criteria must be met',
          validator: 'checkAcceptanceCriteria',
          weight: 1.0
        }],
        threshold: 0.9,
        required: true
      },
      {
        id: 'code-quality-gate',
        name: 'code_quality',
        criteria: [{ 
          name: 'maintainability', 
          description: 'Code must be clean and maintainable',
          validator: 'checkCodeQuality',
          weight: 0.8
        }],
        threshold: 0.8,
        required: true
      },
      {
        id: 'error-handling-gate',
        name: 'error_handling',
        criteria: [{ 
          name: 'error_handling', 
          description: 'Proper error handling must be implemented',
          validator: 'checkErrorHandling',
          weight: 0.8
        }],
        threshold: 0.8,
        required: false
      }
    ];
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
    const hasNoPendingWork = this.handoffQueue.length === 0 && this.pendingWorkItems.size === 0;
    
    // If no work items were created but there's no pending work, consider it complete
    // This fixes the infinite loop when totalWorkItems remains 0
    const hasCompletedAllWork = (totalWorkItems > 0 && completedWorkItems >= totalWorkItems) || 
                                (totalWorkItems === 0 && hasNoPendingWork);
    
    return hasCompletedAllWork && hasNoPendingWork;
  }

  /**
   * Validate that agents are properly initialized and ready
   */
  private validateAgentsReady(): boolean {
    const managerReady = this.executionContext.managerState.status !== 'offline';
    const workerReady = this.executionContext.workerState.status !== 'offline';
    
    if (!managerReady) {
      this.logger.warning('Manager agent not ready', { status: this.executionContext.managerState.status });
    }
    
    if (!workerReady) {
      this.logger.warning('Worker agent not ready', { status: this.executionContext.workerState.status });
    }
    
    return managerReady && workerReady;
  }

  /**
   * Enhanced validation that handoffs are occurring
   */
  public validateHandoffExecution(): {
    handoffsTriggered: boolean;
    workerExecutions: boolean;
    managerReviews: boolean;
    communicationFlow: boolean;
    handoffCount: number;
    messagesExchanged: number;
    issues: string[];
  } {
    const issues: string[] = [];
    
    // Check if handoffs were triggered
    const handoffsTriggered = this.handoffQueue.length > 0 || this.executionContext.workflowState.completedWorkItems > 0;
    if (!handoffsTriggered) {
      issues.push('No handoffs detected - manager may not be delegating work');
    }
    
    // Check if worker executed tasks
    const workerExecutions = this.executionContext.workerState.currentWorkItems.length > 0 || 
                            this.executionContext.workflowState.completedWorkItems > 0;
    if (!workerExecutions) {
      issues.push('Worker agent not executing tasks');
    }
    
    // Check if manager reviewed work
    const managerReviews = this.executionContext.communicationHistory.some(
      msg => msg.type === 'quality_check' && msg.from === 'manager'
    );
    if (!managerReviews && this.executionContext.workflowState.completedWorkItems > 0) {
      issues.push('Manager not reviewing completed work');
    }
    
    // Check communication flow
    const communicationFlow = this.executionContext.communicationHistory.length > 0;
    if (!communicationFlow) {
      issues.push('No inter-agent communication detected');
    }
    
    return {
      handoffsTriggered,
      workerExecutions,
      managerReviews,
      communicationFlow,
      handoffCount: this.handoffCount,
      messagesExchanged: this.executionContext.communicationHistory.length,
      issues
    };
  }

  private getPendingWorkItems(): WorkItem[] {
    // Return work items from the pending queue
    return Array.from(this.pendingWorkItems.values()).filter(item => 
      item.status === 'planned' || item.status === 'blocked'
    );
  }

  private findWorkItem(workItemId: string): WorkItem | null {
    // Find work item in pending items or manager's active work items
    const pendingItem = this.pendingWorkItems.get(workItemId);
    if (pendingItem) return pendingItem;

    const managerWorkItems = this.managerAgent.getActiveWorkItems();
    return managerWorkItems.find(item => item.id === workItemId) || null;
  }

  /**
   * Get recent Manager output for handoff analysis
   */
  private async getRecentManagerOutput(): Promise<ParsedOutput | null> {
    try {
      // Get the most recent manager output from message history
      const recentManagerMessages = this.executionContext.communicationHistory
        .filter(msg => msg.from === 'manager')
        .slice(-3); // Get last 3 manager messages

      if (recentManagerMessages.length === 0) {
        return null;
      }

      // Combine recent messages into a single output for analysis
      const combinedContent = recentManagerMessages
        .map(msg => msg.payload?.content || msg.payload?.result || '')
        .join('\n');

      return {
        result: combinedContent,
        error: undefined
      };

    } catch (error) {
      this.logger.error('Failed to get recent manager output', { error });
      return null;
    }
  }

  /**
   * Get all work items from various sources
   */
  private getAllWorkItems(): WorkItem[] {
    // Collect work items from manager's active work items
    const managerWorkItems = this.managerAgent.getActiveWorkItems();
    
    // Add any pending work items
    const pendingItems = this.getPendingWorkItems();
    
    // Combine and deduplicate
    const allItems = [...managerWorkItems, ...pendingItems];
    const uniqueItems = allItems.filter((item, index, self) => 
      index === self.findIndex(i => i.id === item.id)
    );
    
    return uniqueItems;
  }

  /**
   * Get current iteration count for handoff analysis
   */
  private getCurrentIterationCount(): number {
    // This would track the number of coordination cycles in current phase
    // For now, return a simple estimate based on workflow state
    const startTime = this.executionContext.workflowState.startTime.getTime();
    const currentTime = Date.now();
    const elapsedMinutes = (currentTime - startTime) / (1000 * 60);
    
    // Estimate iterations based on elapsed time (assuming ~2-3 minutes per iteration)
    return Math.floor(elapsedMinutes / 2.5);
  }

  /**
   * Get work items that are ready for Worker handoff
   */
  private getReadyWorkItems(workItems: WorkItem[]): WorkItem[] {
    return workItems.filter(item => 
      item.status === 'planned' &&
      item.acceptanceCriteria &&
      item.acceptanceCriteria.length > 0 &&
      !item.assignedTo // Not already assigned
    );
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

    // Rate limit monitoring events to prevent spam
    if (this.shouldSendMonitoringEvent(type)) {
      monitoringManager.sendMonitoringData({
        agentType: agentRole || 'manager',
        messageType: 'coordination_event',
        message: type,
        metadata: {
          eventType: type,
          eventData: data,
          timestamp: event.timestamp,
          workflowPhase: this.executionContext.workflowState.phase,
          overallProgress: this.executionContext.workflowState.overallProgress
        },
        sessionInfo: {
          task: this.executionContext.userRequest,
          workDir: process.cwd()
        }
      }).catch(error => {
        // Don't let monitoring errors break execution
        this.logger.debug('Failed to send monitoring data', { error });
      });
    }
  }

  /**
   * Rate limiting logic for monitoring events
   */
  private shouldSendMonitoringEvent(eventType: string): boolean {
    const now = Date.now();
    const lastTime = this.lastMonitoringEventTime.get(eventType) || 0;
    
    // Always send important events
    const criticalEvents = [
      'MANAGER_TASK_ASSIGNMENT',
      'WORKER_PROGRESS_UPDATE', 
      'MANAGER_QUALITY_CHECK',
      'MANAGER_WORKER_HANDOFF',
      'WORKFLOW_TRANSITION'
    ];
    
    if (criticalEvents.includes(eventType)) {
      this.lastMonitoringEventTime.set(eventType, now);
      return true;
    }
    
    // Rate limit routine coordination events
    if (now - lastTime > this.monitoringEventCooldown) {
      this.lastMonitoringEventTime.set(eventType, now);
      return true;
    }
    
    return false;
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

  /**
   * Check if workflow has progressed between iterations
   */
  private hasWorkflowProgressed(
    previousState: WorkflowState, 
    currentState: WorkflowState
  ): boolean {
    // Check for progress indicators
    const progressIndicators = [
      currentState.completedWorkItems > previousState.completedWorkItems,
      currentState.totalWorkItems > previousState.totalWorkItems,
      currentState.activeWorkItems.length !== previousState.activeWorkItems.length,
      currentState.phase !== previousState.phase,
      currentState.overallProgress > previousState.overallProgress
    ];
    
    const hasProgress = progressIndicators.some(indicator => indicator);
    
    if (!hasProgress) {
      this.logger.debug('No workflow progress detected', {
        previous: {
          totalWorkItems: previousState.totalWorkItems,
          completedWorkItems: previousState.completedWorkItems,
          phase: previousState.phase
        },
        current: {
          totalWorkItems: currentState.totalWorkItems,
          completedWorkItems: currentState.completedWorkItems,
          phase: currentState.phase
        }
      });
    }
    
    return hasProgress;
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

    // Validate handoff execution before shutdown
    const validation = this.validateHandoffExecution();
    
    // Shutdown agents
    if (this.managerAgent) {
      await this.managerAgent.shutdown();
    }
    
    if (this.workerAgent) {
      await this.workerAgent.shutdown();
    }

    // Shutdown Claude executor and PTY sessions
    if (this.claudeExecutor) {
      await this.claudeExecutor.shutdown();
    }

    // Save session
    await this.sessionManager.saveSession();

    // Clear handoff queues
    this.pendingWorkItems.clear();
    this.handoffQueue = [];

    const duration = (Date.now() - this.startTime.getTime()) / 1000;
    this.logger.info('Agent coordination shutdown completed', { 
      duration: `${duration}s`,
      messagesProcessed: this.executionContext.communicationHistory.length,
      workItemsCompleted: this.executionContext.workflowState.completedWorkItems,
      handoffValidation: {
        handoffsTriggered: validation.handoffsTriggered,
        workerExecutions: validation.workerExecutions,
        issues: validation.issues
      },
      pTYSessions: this.claudeExecutor ? this.claudeExecutor.getActivePTYSessions().length : 0
    });

    if (validation.issues.length > 0) {
      this.logger.warning('Handoff execution issues detected', { issues: validation.issues });
    }

    // Close logger
    this.logger.close();

    this.emit('coordination_shutdown', { validation });
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

  public getHandoffMetrics(): {
    totalHandoffs: number;
    lastHandoffTime: Date | undefined;
    handoffRate: number;
  } {
    const elapsedTime = Date.now() - this.startTime.getTime();
    const handoffRate = elapsedTime > 0 ? (this.handoffCount / (elapsedTime / (1000 * 60))) : 0;
    
    return {
      totalHandoffs: this.handoffCount,
      lastHandoffTime: this.lastHandoffTime,
      handoffRate: Math.round(handoffRate * 100) / 100 // handoffs per minute
    };
  }
}