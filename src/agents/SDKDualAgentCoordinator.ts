import { EventEmitter } from 'events';
import { Logger } from '../logger';
import { SessionManager } from '../sessionManager';
import { monitoringManager } from '../monitoringManager';
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

export interface SDKDualAgentOptions {
  maxIterations?: number;
  managerModel?: 'opus' | 'sonnet' | 'haiku';
  workerModel?: 'opus' | 'sonnet' | 'haiku';
  workDir?: string;
  verbose?: boolean;
  timeout?: number;
  continueOnError?: boolean;
  allowedTools?: string;
}

export interface SDKAgentResult {
  success: boolean;
  output: string;
  workItems?: WorkItem[];
  strategy?: string;
  error?: string;
  artifacts?: string[];
  sessionId?: string;
}

/**
 * SDK-based dual-agent coordinator using direct Claude SDK calls
 * Replaces PTY-based coordination with function-based coordination
 * Implements Manager (Opus) and Worker (Sonnet) coordination via SDK sessions
 */
export class SDKDualAgentCoordinator extends EventEmitter {
  private logger: Logger;
  private sessionManager: SessionManager;
  private managerSDK: SDKClaudeExecutor;
  private workerSDK: SDKClaudeExecutor;

  private executionContext: ExecutionContext;
  private messageQueue: AgentMessage[] = [];
  private isActive: boolean = false;
  private startTime: Date = new Date();
  private lastHandoffTime?: Date;
  private handoffCount: number = 0;

  // SDK session management
  private managerSessionId?: string;
  private workerSessionId?: string;

  // Work item management
  private pendingWorkItems: Map<string, WorkItem> = new Map();
  private handoffQueue: Array<{ workItem: WorkItem; context: string }> = [];

  // Rate limiting for monitoring events
  private lastMonitoringEventTime: Map<string, number> = new Map();
  private monitoringEventCooldown: number = 10000; // 10 seconds

  constructor(config: AgentCoordinatorConfig) {
    super();
    
    this.logger = new Logger();
    this.sessionManager = new SessionManager();
    this.managerSDK = new SDKClaudeExecutor(this.logger);
    this.workerSDK = new SDKClaudeExecutor(this.logger);
    
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

    this.logger.info('SDKDualAgentCoordinator initialized', { config });
  }

  /**
   * Start dual-agent coordination using SDK sessions
   */
  async startCoordination(
    userRequest: string,
    options: SDKDualAgentOptions
  ): Promise<void> {
    try {
      this.isActive = true;
      this.startTime = new Date();
      
      this.logger.info('Starting SDK-based dual-agent coordination', { 
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
        workDir: options.workDir || process.cwd(),
        coordinationType: 'SDK_BASED'
      });

      // Initialize SDK sessions
      await this.initializeSDKSessions(options);

      // Execute main coordination workflow
      await this.executeSDKCoordinationWorkflow(options);

    } catch (error) {
      this.logger.error('SDK agent coordination failed', { 
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    } finally {
      await this.shutdown();
    }
  }

  /**
   * Initialize SDK sessions for both agents
   */
  private async initializeSDKSessions(options: SDKDualAgentOptions): Promise<void> {
    this.logger.info('Initializing SDK sessions for dual-agent coordination');

    // Check SDK availability
    if (!this.managerSDK.isAvailable()) {
      throw new Error('Claude Code SDK is not available. Please install it globally: npm install -g @anthropic-ai/claude-code');
    }

    // Update agent states
    this.executionContext.managerState.status = 'idle';
    this.executionContext.managerState.model = options.managerModel || 'opus';
    this.executionContext.workerState.status = 'idle';
    this.executionContext.workerState.model = options.workerModel || 'sonnet';

    this.emit('agents_initialized', {
      managerModel: options.managerModel || 'opus',
      workerModel: options.workerModel || 'sonnet',
      coordinationType: 'SDK_BASED'
    });

    this.logger.info('SDK sessions initialized successfully');
  }

  /**
   * Execute the main SDK-based coordination workflow
   */
  private async executeSDKCoordinationWorkflow(options: SDKDualAgentOptions): Promise<void> {
    const maxIterations = Math.min(options.maxIterations || 10, 25);
    let currentIteration = 0;
    let idleIterations = 0;
    const maxIdleIterations = 5;

    this.updateWorkflowPhase('execution');
    this.logger.info(`Starting SDK coordination workflow (max ${maxIterations} iterations)`);

    // Phase 1: Manager Analysis
    await this.executeManagerAnalysis(this.executionContext.userRequest, options);

    // Phase 2: Manager-Worker Coordination Loop
    while (currentIteration < maxIterations && this.isActive) {
      currentIteration++;
      this.logger.info(`SDK coordination iteration ${currentIteration}/${maxIterations}`);

      try {
        // Check if workflow is complete
        if (this.isWorkflowComplete()) {
          this.logger.success('SDK workflow completed successfully');
          this.updateWorkflowPhase('completion');
          break;
        }

        // Execute coordination cycle
        const hasProgress = await this.executeCoordinationCycle(options);

        if (!hasProgress) {
          idleIterations++;
          this.logger.warning(`No progress in iteration ${currentIteration} (idle: ${idleIterations}/${maxIdleIterations})`);
          
          if (idleIterations >= maxIdleIterations) {
            this.logger.warning('Forcing workflow completion due to lack of progress');
            this.updateWorkflowPhase('completion');
            break;
          }
        } else {
          idleIterations = 0; // Reset on progress
        }

        // Delay between iterations
        await this.delay(2000);

      } catch (error) {
        this.logger.error(`SDK coordination iteration ${currentIteration} failed`, { error });
        if (!options.continueOnError) {
          throw error;
        }
        await this.delay(3000);
      }
    }

    this.logger.info('SDK coordination workflow completed', {
      totalIterations: currentIteration,
      handoffCount: this.handoffCount,
      completedWorkItems: this.executionContext.workflowState.completedWorkItems
    });
  }

  /**
   * Execute Manager analysis using SDK
   */
  private async executeManagerAnalysis(userRequest: string, options: SDKDualAgentOptions): Promise<void> {
    this.logger.info('Executing Manager analysis via SDK');
    
    this.updateAgentStatus('manager', 'planning');
    
    try {
      const analysisPrompt = this.buildManagerAnalysisPrompt(userRequest);
      
      const result = await this.managerSDK.executeWithSDK(analysisPrompt, {
        model: (options.managerModel || 'opus') as 'sonnet' | 'opus',
        workDir: options.workDir,
        verbose: options.verbose,
        timeout: options.timeout || 180000,
        allowedTools: options.allowedTools,
        sessionId: this.managerSessionId
      });

      // Store session ID for continuity
      this.managerSessionId = result.output.includes('session:') ? 
        this.extractSessionId(result.output) : this.managerSessionId;

      // Parse manager analysis result
      const analysisResult = this.parseManagerAnalysis(result.output);
      
      if (analysisResult.workItems && analysisResult.workItems.length > 0) {
        // Update workflow state with work items
        this.executionContext.workflowState.totalWorkItems = analysisResult.workItems.length;
        this.executionContext.workflowState.activeWorkItems = analysisResult.workItems.map(item => item.id);

        // Store work items for handoff
        this.storeWorkItemsForHandoff(analysisResult.workItems);

        this.logger.success('Manager analysis completed via SDK', {
          workItemCount: analysisResult.workItems.length,
          strategy: analysisResult.strategy?.substring(0, 100)
        });

        // Emit analysis completion event
        this.emitCoordinationEvent('MANAGER_TASK_ASSIGNMENT', 'manager', {
          workItems: analysisResult.workItems,
          strategy: analysisResult.strategy,
          coordinationType: 'SDK_BASED'
        });

        // Move to planning phase
        this.updateWorkflowPhase('planning');
      }
    } catch (error) {
      this.emitCoordinationEvent('AGENT_COORDINATION', 'manager', {
        phase: 'analysis_error',
        error: error instanceof Error ? error.message : String(error),
        errorType: 'manager_analysis_failed',
        coordinationType: 'SDK_BASED'
      });
      
      await this.handleAgentError('manager', 'tool_failure', error instanceof Error ? error.message : String(error));
    } finally {
      this.updateAgentStatus('manager', 'idle');
    }
  }

  /**
   * Execute a single coordination cycle
   */
  private async executeCoordinationCycle(options: SDKDualAgentOptions): Promise<boolean> {
    let hasProgress = false;

    // Process pending handoffs first
    if (this.handoffQueue.length > 0) {
      await this.processPendingSDKHandoffs(options);
      hasProgress = true;
    }

    // Check for new work items to process
    const pendingWorkItems = this.getPendingWorkItems();
    
    if (pendingWorkItems.length > 0) {
      // Process up to 2 work items concurrently to avoid overwhelming
      const itemsToProcess = pendingWorkItems.slice(0, 2);
      
      for (const workItem of itemsToProcess) {
        await this.executeWorkerTaskViaSDK(workItem, options);
        hasProgress = true;
        
        // Small delay between tasks
        await this.delay(1000);
      }
    }

    // Manager review of completed work
    const completedItems = Array.from(this.pendingWorkItems.values()).filter(
      item => item.status === 'completed' && item.assignedTo === 'worker'
    );

    for (const item of completedItems) {
      await this.executeManagerReviewViaSDK(item, options);
      hasProgress = true;
    }

    return hasProgress;
  }

  /**
   * Process pending handoffs via SDK
   */
  private async processPendingSDKHandoffs(options: SDKDualAgentOptions): Promise<void> {
    if (this.handoffQueue.length === 0) return;

    const handoff = this.handoffQueue.shift();
    if (handoff) {
      this.logger.info('Processing SDK handoff', { 
        workItemId: handoff.workItem.id,
        title: handoff.workItem.title 
      });

      await this.executeWorkerTaskViaSDK(handoff.workItem, options, handoff.context);
      
      this.handoffCount++;
      this.lastHandoffTime = new Date();
      
      // Emit handoff event
      this.emitCoordinationEvent('MANAGER_WORKER_HANDOFF', 'manager', {
        workItem: handoff.workItem,
        handoffCount: this.handoffCount,
        coordinationType: 'SDK_BASED'
      });
    }
  }

  /**
   * Execute worker task via SDK
   */
  private async executeWorkerTaskViaSDK(
    workItem: WorkItem, 
    options: SDKDualAgentOptions, 
    context?: string
  ): Promise<void> {
    this.logger.info('Executing worker task via SDK', {
      workItemId: workItem.id,
      title: workItem.title
    });

    this.updateAgentStatus('worker', 'executing');
    workItem.status = 'in_progress';
    workItem.assignedTo = 'worker';

    try {
      const workerPrompt = this.buildWorkerExecutionPrompt(workItem, context);
      
      const result = await this.workerSDK.executeWithSDK(workerPrompt, {
        model: (options.workerModel || 'sonnet') as 'sonnet' | 'opus',
        workDir: options.workDir,
        verbose: options.verbose,
        timeout: options.timeout || 180000,
        allowedTools: options.allowedTools,
        sessionId: this.workerSessionId
      });

      // Store session ID for continuity
      this.workerSessionId = result.output.includes('session:') ? 
        this.extractSessionId(result.output) : this.workerSessionId;

      // Parse worker execution result
      const executionResult = this.parseWorkerExecution(result.output);
      
      if (executionResult.success) {
        workItem.status = 'completed';
        this.executionContext.workflowState.completedWorkItems++;
        
        this.logger.success('Worker task completed via SDK', {
          workItemId: workItem.id,
          artifacts: executionResult.artifacts?.length || 0
        });

        // Send completion message
        this.sendMessage('worker', 'manager', 'completion_report', {
          workItemId: workItem.id,
          result: executionResult,
          workItem,
          coordinationType: 'SDK_BASED'
        });
        
      } else {
        workItem.status = 'failed';
        this.logger.error('Worker task failed via SDK', {
          workItemId: workItem.id,
          error: executionResult.error
        });
      }

    } catch (error) {
      workItem.status = 'failed';
      await this.handleAgentError('worker', 'tool_failure', error instanceof Error ? error.message : String(error), workItem.id);
    } finally {
      this.updateAgentStatus('worker', 'idle');
    }
  }

  /**
   * Execute manager review via SDK
   */
  private async executeManagerReviewViaSDK(workItem: WorkItem, options: SDKDualAgentOptions): Promise<void> {
    this.logger.info('Executing manager review via SDK', {
      workItemId: workItem.id,
      title: workItem.title
    });

    this.updateAgentStatus('manager', 'reviewing');

    try {
      const reviewPrompt = this.buildManagerReviewPrompt(workItem);
      
      const result = await this.managerSDK.executeWithSDK(reviewPrompt, {
        model: (options.managerModel || 'opus') as 'sonnet' | 'opus',
        workDir: options.workDir,
        verbose: options.verbose,
        timeout: options.timeout || 120000,
        allowedTools: options.allowedTools,
        sessionId: this.managerSessionId
      });

      // Parse review result
      const reviewResult = this.parseManagerReview(result.output);
      
      if (reviewResult.approved) {
        this.logger.success('Work item approved by manager via SDK', {
          workItemId: workItem.id,
          qualityScore: reviewResult.qualityScore
        });
        
        // Remove from pending items
        this.pendingWorkItems.delete(workItem.id);
      } else {
        workItem.status = 'failed';
        this.logger.warning('Work item needs revision', {
          workItemId: workItem.id,
          feedback: reviewResult.feedback
        });
      }

      // Send quality check message
      const qualityCheck: QualityCheck = {
        gateId: 'manager_review_sdk',
        workItemId: workItem.id,
        passed: reviewResult.approved,
        score: reviewResult.qualityScore || 0,
        feedback: reviewResult.feedback || [],
        recommendations: reviewResult.recommendations
      };

      this.sendMessage('manager', 'worker', 'quality_check', {
        ...qualityCheck,
        coordinationType: 'SDK_BASED'
      });

      // Emit coordination event
      this.emitCoordinationEvent('MANAGER_QUALITY_CHECK', 'manager', qualityCheck);

    } catch (error) {
      await this.handleAgentError('manager', 'tool_failure', error instanceof Error ? error.message : String(error));
    } finally {
      this.updateAgentStatus('manager', 'idle');
    }
  }

  /**
   * Build Manager analysis prompt
   */
  private buildManagerAnalysisPrompt(userRequest: string): string {
    return `You are a Manager Agent using the Claude Code SDK for dual-agent coordination.

TASK: Analyze the following user request and create a detailed execution plan with specific work items for the Worker Agent.

USER REQUEST:
${userRequest}

ANALYSIS REQUIREMENTS:
1. Break down the task into specific, actionable work items
2. For each work item, provide:
   - Clear title and description
   - Acceptance criteria
   - Priority (1-5 scale)
   - Estimated effort (hours)
   - Dependencies

3. Provide an overall strategy for task completion

OUTPUT FORMAT:
Provide your analysis in this exact JSON format:

{
  "strategy": "Overall strategy description...",
  "workItems": [
    {
      "id": "work-item-1",
      "title": "Clear work item title",
      "description": "Detailed description of what needs to be done",
      "acceptanceCriteria": ["Criteria 1", "Criteria 2"],
      "priority": 3,
      "estimatedEffort": 2,
      "dependencies": []
    }
  ]
}

Focus on creating actionable work items that can be executed independently by the Worker Agent.`;
  }

  /**
   * Build Worker execution prompt
   */
  private buildWorkerExecutionPrompt(workItem: WorkItem, context?: string): string {
    return `You are a Worker Agent using the Claude Code SDK for dual-agent coordination.

TASK: Execute the following work item with high quality and attention to detail.

WORK ITEM DETAILS:
- Title: ${workItem.title}
- Description: ${workItem.description}
- Priority: ${workItem.priority}/5
- Estimated Effort: ${workItem.estimatedEffort} hours

ACCEPTANCE CRITERIA:
${workItem.acceptanceCriteria.map(criteria => `- ${criteria}`).join('\n')}

${context ? `STRATEGIC CONTEXT:\n${context}\n` : ''}

EXECUTION REQUIREMENTS:
1. Follow all acceptance criteria exactly
2. Implement proper error handling
3. Write clean, maintainable code
4. Include appropriate tests where applicable
5. Document complex logic

QUALITY STANDARDS:
- Code must follow best practices
- Ensure security considerations
- Optimize for performance where relevant
- Maintain consistency with existing codebase

Execute this work item thoroughly and report on your progress and any artifacts created.

OUTPUT FORMAT:
Provide a summary of work completed, files modified/created, and any issues encountered.`;
  }

  /**
   * Build Manager review prompt
   */
  private buildManagerReviewPrompt(workItem: WorkItem): string {
    return `You are a Manager Agent reviewing work completed by the Worker Agent.

WORK ITEM UNDER REVIEW:
- Title: ${workItem.title}
- Description: ${workItem.description}
- Status: ${workItem.status}

ACCEPTANCE CRITERIA:
${workItem.acceptanceCriteria.map(criteria => `- ${criteria}`).join('\n')}

REVIEW REQUIREMENTS:
1. Verify all acceptance criteria are met
2. Check code quality and best practices
3. Validate security considerations
4. Assess maintainability and documentation

QUALITY GATES:
- Functionality: Does it meet requirements?
- Code Quality: Is it well-structured and maintainable?
- Error Handling: Are edge cases handled properly?
- Testing: Are appropriate tests included?

OUTPUT FORMAT:
Provide your review in this JSON format:

{
  "approved": true/false,
  "qualityScore": 0.0-1.0,
  "feedback": ["Feedback item 1", "Feedback item 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}

Be thorough but constructive in your review.`;
  }

  /**
   * Parse Manager analysis result
   */
  private parseManagerAnalysis(output: string): SDKAgentResult {
    try {
      // Look for JSON in the output
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Convert to WorkItem format
        const workItems: WorkItem[] = parsed.workItems?.map((item: any) => ({
          ...item,
          status: 'planned' as TaskStatus,
          assignedTo: undefined,
          createdAt: new Date(),
          updatedAt: new Date()
        })) || [];

        return {
          success: workItems.length > 0,
          output,
          workItems,
          strategy: parsed.strategy
        };
      }
      
      // Fallback: create a single work item from the output
      return {
        success: true,
        output,
        workItems: [{
          id: `work-item-${Date.now()}`,
          title: 'Execute user request',
          description: output.substring(0, 200) + '...',
          acceptanceCriteria: ['Complete the requested task'],
          priority: 3,
          estimatedEffort: 2,
          dependencies: [],
          status: 'planned' as TaskStatus,
          assignedTo: undefined,
          createdAt: new Date(),
          updatedAt: new Date()
        }],
        strategy: 'Direct execution approach'
      };
    } catch (error) {
      this.logger.warning('Failed to parse manager analysis, using fallback', { error });
      return {
        success: false,
        output,
        error: 'Failed to parse analysis result'
      };
    }
  }

  /**
   * Parse Worker execution result
   */
  private parseWorkerExecution(output: string): SDKAgentResult {
    // Simple heuristic: if output contains error keywords, mark as failed
    const errorKeywords = ['error', 'failed', 'exception', 'cannot', 'unable', 'not found'];
    const hasError = errorKeywords.some(keyword => 
      output.toLowerCase().includes(keyword) && 
      output.toLowerCase().includes('error')
    );

    return {
      success: !hasError && output.trim().length > 0,
      output,
      artifacts: this.extractArtifacts(output),
      error: hasError ? 'Execution encountered errors' : undefined
    };
  }

  /**
   * Parse Manager review result with enhanced quality analysis
   */
  private parseManagerReview(output: string): any {
    try {
      // Look for JSON in the output
      const jsonMatch = output.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        // Validate quality gates
        return this.validateQualityGates(parsed, output);
      }
      
      // Fallback: enhanced heuristic analysis
      return this.performHeuristicQualityAnalysis(output);
    } catch (error) {
      this.logger.warning('Manager review parsing failed, using fallback analysis', { error });
      return this.performHeuristicQualityAnalysis(output);
    }
  }

  /**
   * Validate quality gates based on review result
   */
  private validateQualityGates(reviewResult: any, output: string): any {
    let qualityScore = reviewResult.qualityScore || 0.7;
    const feedback = reviewResult.feedback || [];
    const recommendations = reviewResult.recommendations || [];

    // Quality gate 1: Functionality check
    const functionalityScore = this.assessFunctionality(output);
    
    // Quality gate 2: Code quality check
    const codeQualityScore = this.assessCodeQuality(output);
    
    // Quality gate 3: Error handling check
    const errorHandlingScore = this.assessErrorHandling(output);
    
    // Quality gate 4: Security considerations
    const securityScore = this.assessSecurity(output);
    
    // Weighted quality score
    const weightedScore = (
      functionalityScore * 0.4 +
      codeQualityScore * 0.3 +
      errorHandlingScore * 0.2 +
      securityScore * 0.1
    );

    // Override original score if calculated score differs significantly
    if (Math.abs(weightedScore - qualityScore) > 0.2) {
      qualityScore = weightedScore;
      feedback.push(`Quality score adjusted based on automated analysis (${(weightedScore * 100).toFixed(1)}%)`);
    }

    // Add quality gate feedback
    if (functionalityScore < 0.7) {
      feedback.push('Functionality concerns detected - verify all requirements are met');
    }
    if (codeQualityScore < 0.7) {
      feedback.push('Code quality issues detected - consider refactoring');
    }
    if (errorHandlingScore < 0.6) {
      recommendations.push('Improve error handling and edge case coverage');
    }
    if (securityScore < 0.8) {
      recommendations.push('Review security implications and add appropriate safeguards');
    }

    return {
      approved: qualityScore >= 0.7 && functionalityScore >= 0.6,
      qualityScore,
      feedback,
      recommendations,
      qualityGates: {
        functionality: functionalityScore,
        codeQuality: codeQualityScore,
        errorHandling: errorHandlingScore,
        security: securityScore,
        overall: weightedScore
      }
    };
  }

  /**
   * Assess functionality based on output analysis
   */
  private assessFunctionality(output: string): number {
    const functionalityIndicators = [
      /implemented|created|added|built/gi,
      /working|functional|complete/gi,
      /test.*pass|success/gi,
      /requirements.*met|criteria.*satisfied/gi
    ];

    const negativeIndicators = [
      /not working|broken|failed|error/gi,
      /incomplete|missing|todo/gi,
      /not implemented|placeholder/gi
    ];

    let score = 0.7; // Base score

    // Check positive indicators
    const positiveMatches = functionalityIndicators.reduce((count, pattern) => {
      const matches = output.match(pattern) || [];
      return count + matches.length;
    }, 0);

    // Check negative indicators
    const negativeMatches = negativeIndicators.reduce((count, pattern) => {
      const matches = output.match(pattern) || [];
      return count + matches.length;
    }, 0);

    // Adjust score based on indicators
    score += (positiveMatches * 0.05) - (negativeMatches * 0.1);

    // Check for specific functionality markers
    if (output.toLowerCase().includes('all acceptance criteria')) score += 0.1;
    if (output.toLowerCase().includes('requirements met')) score += 0.1;
    if (output.toLowerCase().includes('fully implemented')) score += 0.15;

    return Math.min(Math.max(score, 0), 1);
  }

  /**
   * Assess code quality based on output analysis
   */
  private assessCodeQuality(output: string): number {
    const qualityIndicators = [
      /clean.*code|well.*structured|maintainable/gi,
      /documented|comments|readable/gi,
      /best.*practice|standard|convention/gi,
      /refactor|optimize|improve/gi
    ];

    const qualityIssues = [
      /hack|quick.*fix|temporary/gi,
      /duplicate|repetitive|copy.*paste/gi,
      /complex|convoluted|messy/gi,
      /no.*test|untested/gi
    ];

    let score = 0.7; // Base score

    const qualityMatches = qualityIndicators.reduce((count, pattern) => {
      const matches = output.match(pattern) || [];
      return count + matches.length;
    }, 0);

    const issueMatches = qualityIssues.reduce((count, pattern) => {
      const matches = output.match(pattern) || [];
      return count + matches.length;
    }, 0);

    score += (qualityMatches * 0.06) - (issueMatches * 0.08);

    // Bonus for specific quality mentions
    if (output.toLowerCase().includes('type safety')) score += 0.05;
    if (output.toLowerCase().includes('error handling')) score += 0.05;
    if (output.toLowerCase().includes('unit test')) score += 0.08;

    return Math.min(Math.max(score, 0), 1);
  }

  /**
   * Assess error handling based on output analysis
   */
  private assessErrorHandling(output: string): number {
    const errorHandlingIndicators = [
      /try.*catch|error.*handling/gi,
      /validation|sanitiz|check/gi,
      /exception|fallback|recovery/gi,
      /edge.*case|boundary/gi
    ];

    const errorHandlingIssues = [
      /no.*error|ignore.*error|silent.*fail/gi,
      /crash|uncaught|unhandled/gi,
      /assume|expect.*never/gi
    ];

    let score = 0.6; // Lower base score for error handling

    const handlingMatches = errorHandlingIndicators.reduce((count, pattern) => {
      const matches = output.match(pattern) || [];
      return count + matches.length;
    }, 0);

    const issueMatches = errorHandlingIssues.reduce((count, pattern) => {
      const matches = output.match(pattern) || [];
      return count + matches.length;
    }, 0);

    score += (handlingMatches * 0.08) - (issueMatches * 0.12);

    return Math.min(Math.max(score, 0), 1);
  }

  /**
   * Assess security considerations based on output analysis
   */
  private assessSecurity(output: string): number {
    const securityIndicators = [
      /security|secure|safe/gi,
      /sanitiz|validat|escape/gi,
      /authentication|authorization/gi,
      /encrypt|hash|salt/gi
    ];

    const securityConcerns = [
      /password.*plain|hardcod.*key/gi,
      /sql.*injection|xss|csrf/gi,
      /insecure|vulnerable|unsafe/gi,
      /eval|exec|dangerous/gi
    ];

    let score = 0.8; // Higher base score for security (assume secure by default)

    const securityMatches = securityIndicators.reduce((count, pattern) => {
      const matches = output.match(pattern) || [];
      return count + matches.length;
    }, 0);

    const concernMatches = securityConcerns.reduce((count, pattern) => {
      const matches = output.match(pattern) || [];
      return count + matches.length;
    }, 0);

    score += (securityMatches * 0.03) - (concernMatches * 0.2);

    return Math.min(Math.max(score, 0), 1);
  }

  /**
   * Perform heuristic quality analysis when JSON parsing fails
   */
  private performHeuristicQualityAnalysis(output: string): any {
    const positiveKeywords = ['approved', 'good', 'excellent', 'meets', 'satisfies', 'complete', 'working'];
    const negativeKeywords = ['failed', 'reject', 'needs work', 'issues', 'problems', 'broken', 'incomplete'];
    
    const hasPositive = positiveKeywords.some(keyword => 
      output.toLowerCase().includes(keyword)
    );
    const hasNegative = negativeKeywords.some(keyword => 
      output.toLowerCase().includes(keyword)
    );

    // Assess individual quality gates
    const functionality = this.assessFunctionality(output);
    const codeQuality = this.assessCodeQuality(output);
    const errorHandling = this.assessErrorHandling(output);
    const security = this.assessSecurity(output);

    const overallScore = (functionality * 0.4 + codeQuality * 0.3 + errorHandling * 0.2 + security * 0.1);

    const approved = (hasPositive && !hasNegative) || overallScore >= 0.7;

    return {
      approved,
      qualityScore: overallScore,
      feedback: [
        `Heuristic analysis: ${approved ? 'Approved' : 'Needs review'}`,
        output.substring(0, 150) + '...'
      ],
      recommendations: overallScore < 0.7 ? ['Consider manual review for quality assurance'] : [],
      qualityGates: {
        functionality,
        codeQuality,
        errorHandling,
        security,
        overall: overallScore
      }
    };
  }

  /**
   * Extract artifacts from output
   */
  private extractArtifacts(output: string): string[] {
    const artifacts: string[] = [];
    
    // Look for file creation/modification patterns
    const filePatterns = [
      /created?\s+(?:file\s+)?([^\s\n]+\.[a-zA-Z]+)/gi,
      /modified?\s+(?:file\s+)?([^\s\n]+\.[a-zA-Z]+)/gi,
      /updated?\s+(?:file\s+)?([^\s\n]+\.[a-zA-Z]+)/gi,
      /wrote?\s+(?:file\s+)?([^\s\n]+\.[a-zA-Z]+)/gi
    ];

    for (const pattern of filePatterns) {
      let match;
      while ((match = pattern.exec(output)) !== null) {
        if (match[1] && !artifacts.includes(match[1])) {
          artifacts.push(match[1]);
        }
      }
    }

    return artifacts;
  }

  /**
   * Extract session ID from output
   */
  private extractSessionId(output: string): string | undefined {
    const sessionMatch = output.match(/session:\s*([a-zA-Z0-9-]+)/);
    return sessionMatch ? sessionMatch[1] : undefined;
  }

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
    
    this.logger.info('Work items stored for SDK handoff', { count: workItems.length });
  }

  /**
   * Check if workflow is complete
   */
  private isWorkflowComplete(): boolean {
    const { totalWorkItems, completedWorkItems } = this.executionContext.workflowState;
    const hasNoPendingWork = this.handoffQueue.length === 0 && this.pendingWorkItems.size === 0;
    
    const hasCompletedAllWork = (totalWorkItems > 0 && completedWorkItems >= totalWorkItems) || 
                                (totalWorkItems === 0 && hasNoPendingWork);
    
    return hasCompletedAllWork && hasNoPendingWork;
  }

  /**
   * Get pending work items
   */
  private getPendingWorkItems(): WorkItem[] {
    return Array.from(this.pendingWorkItems.values()).filter(item => 
      item.status === 'planned' || item.status === 'blocked'
    );
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

    this.logger.debug('SDK message sent', { 
      from, 
      to, 
      type, 
      messageId: message.id 
    });

    this.emit('message_sent', message);
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

    this.logger.error('SDK agent error occurred', { 
      id: agentError.id,
      agentRole: agentError.agentRole,
      errorType: agentError.errorType,
      message: agentError.message
    });

    // Update agent state
    this.updateAgentStatus(agentRole, 'error');

    // Simple recovery: mark as idle after error
    setTimeout(() => {
      this.updateAgentStatus(agentRole, 'idle');
    }, 5000);

    this.emit('agent_error', agentError);
  }

  /**
   * Determine recovery strategy
   */
  private determineRecoveryStrategy(errorType: ErrorType, agentRole: AgentRole): RecoveryStrategy {
    return {
      type: 'retry',
      maxAttempts: 2,
      backoffMs: 5000,
      fallbackPlan: `Switch to alternative approach for ${agentRole}`
    };
  }

  /**
   * Helper methods
   */
  private updateWorkflowPhase(phase: WorkflowPhase): void {
    this.executionContext.workflowState.phase = phase;
    this.logger.info(`SDK workflow phase updated: ${phase}`);
    
    this.emitCoordinationEvent('WORKFLOW_TRANSITION', null, { 
      newPhase: phase,
      coordinationType: 'SDK_BASED'
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

  private buildWorkItemContext(workItem: WorkItem): string {
    return `${workItem.title}: ${workItem.description}`;
  }

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

    // Send to monitoring with rate limiting
    if (this.shouldSendMonitoringEvent(type)) {
      monitoringManager.sendMonitoringData({
        agentType: agentRole || 'manager',
        messageType: 'coordination_event',
        message: type,
        metadata: {
          eventType: type,
          eventData: data,
          timestamp: event.timestamp,
          coordinationType: 'SDK_BASED'
        },
        sessionInfo: {
          task: this.executionContext.userRequest,
          workDir: process.cwd()
        }
      }).catch(error => {
        this.logger.debug('Failed to send monitoring data', { error });
      });
    }
  }

  private shouldSendMonitoringEvent(eventType: string): boolean {
    const now = Date.now();
    const lastTime = this.lastMonitoringEventTime.get(eventType) || 0;
    
    if (now - lastTime > this.monitoringEventCooldown) {
      this.lastMonitoringEventTime.set(eventType, now);
      return true;
    }
    
    return false;
  }

  private generateMessageId(): string {
    return `sdk-msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  }

  private generateErrorId(): string {
    return `sdk-err-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Shutdown coordination and cleanup resources
   */
  async shutdown(): Promise<void> {
    this.isActive = false;
    
    // Save session
    await this.sessionManager.saveSession();

    // Clear work queues
    this.pendingWorkItems.clear();
    this.handoffQueue = [];

    const duration = (Date.now() - this.startTime.getTime()) / 1000;
    this.logger.info('SDK agent coordination shutdown completed', { 
      duration: `${duration}s`,
      messagesProcessed: this.executionContext.communicationHistory.length,
      workItemsCompleted: this.executionContext.workflowState.completedWorkItems,
      handoffCount: this.handoffCount,
      coordinationType: 'SDK_BASED'
    });

    this.logger.close();
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
      handoffRate: Math.round(handoffRate * 100) / 100
    };
  }

  /**
   * Validate SDK handoff execution
   */
  public validateSDKHandoffExecution(): {
    handoffsTriggered: boolean;
    workerExecutions: boolean;
    managerReviews: boolean;
    communicationFlow: boolean;
    coordinationType: string;
    issues: string[];
  } {
    const issues: string[] = [];
    
    const handoffsTriggered = this.handoffCount > 0;
    if (!handoffsTriggered) {
      issues.push('No SDK handoffs detected - manager may not be delegating work via SDK');
    }
    
    const workerExecutions = this.executionContext.workflowState.completedWorkItems > 0;
    if (!workerExecutions) {
      issues.push('Worker agent not executing tasks via SDK');
    }
    
    const managerReviews = this.executionContext.communicationHistory.some(
      msg => msg.type === 'quality_check' && msg.from === 'manager'
    );
    if (!managerReviews && workerExecutions) {
      issues.push('Manager not reviewing completed work via SDK');
    }
    
    const communicationFlow = this.executionContext.communicationHistory.length > 0;
    if (!communicationFlow) {
      issues.push('No SDK-based inter-agent communication detected');
    }
    
    return {
      handoffsTriggered,
      workerExecutions,
      managerReviews,
      communicationFlow,
      coordinationType: 'SDK_BASED',
      issues
    };
  }
}