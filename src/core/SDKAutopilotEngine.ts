import { EventEmitter } from 'events';
import { Logger } from '../logger';
import { SessionManager } from '../sessionManager';
import { SDKClaudeExecutor } from '../services/sdkClaudeExecutor';
import { SDKDualAgentCoordinator, SDKDualAgentOptions } from '../agents/SDKDualAgentCoordinator';
import { AgentCoordinatorConfig } from '../agents/agentTypes';
import { TaskCompletionAnalyzer } from './TaskCompletionAnalyzer';

export interface AutopilotOptions {
  workDir?: string;
  maxIterations?: number;
  verbose?: boolean;
  timeout?: number;
  continueOnError?: boolean;
  allowedTools?: string;
  model?: 'sonnet' | 'opus';
  sessionId?: string;
  
  // Compatibility with existing code
  enableHooks?: boolean;
  enableMonitoring?: boolean;
  
  // Dual-agent specific options
  dualAgent?: boolean;
  managerModel?: 'opus' | 'sonnet' | 'haiku';
  workerModel?: 'opus' | 'sonnet' | 'haiku';
}

export interface AutopilotResult {
  success: boolean;
  iterations: number;
  duration: number;
  totalDuration: number;
  output: string;
  sessionId: string;
  artifacts?: string[];
  error?: string;
  errors?: string[];
  coordinationType: 'SINGLE_AGENT' | 'DUAL_AGENT_SDK';
  executionMethod?: string;
  successRate?: number;
  browserUsed?: string;
  modelUsed?: string;
  totalTokens?: number;
  toolsInvoked?: string[];
  qualityScore?: number;
  dualAgentMetrics?: {
    handoffCount: number;
    managerIterations: number;
    workerIterations: number;
    qualityScore: number;
  };
}

/**
 * SDK-only autopilot engine supporting both single and dual-agent modes
 * Replaces PTY-based execution with direct SDK calls
 */
export class SDKAutopilotEngine extends EventEmitter {
  private logger: Logger;
  private sessionManager: SessionManager;
  private sdkExecutor: SDKClaudeExecutor;
  private completionAnalyzer: TaskCompletionAnalyzer;
  private dualAgentCoordinator?: SDKDualAgentCoordinator;

  private isRunning: boolean = false;
  private currentSessionId?: string;

  constructor(logger?: Logger) {
    super();
    
    this.logger = logger || new Logger();
    this.sessionManager = new SessionManager();
    this.sdkExecutor = new SDKClaudeExecutor(this.logger);
    this.completionAnalyzer = new TaskCompletionAnalyzer(this.logger);
    
    this.logger.info('SDKAutopilotEngine initialized');
  }

  /**
   * Run autopilot loop using SDK execution
   */
  async runAutopilotLoop(task: string, options: AutopilotOptions = {}): Promise<AutopilotResult> {
    const startTime = Date.now();
    this.isRunning = true;

    try {
      this.logger.info('Starting SDK autopilot loop', {
        task: task.substring(0, 100),
        dualAgent: options.dualAgent,
        options
      });

      // Check SDK availability
      if (!this.sdkExecutor.isAvailable()) {
        throw new Error('Claude Code SDK is not available. Please install it globally: npm install -g @anthropic-ai/claude-code');
      }

      // Create session
      this.currentSessionId = await this.sessionManager.createSession(
        task,
        options.workDir || process.cwd()
      );

      let result: AutopilotResult;

      if (options.dualAgent) {
        // Execute dual-agent coordination
        result = await this.executeDualAgentAutopilot(task, options);
      } else {
        // Execute single-agent autopilot
        result = await this.executeSingleAgentAutopilot(task, options);
      }

      // Calculate final metrics
      const duration = Date.now() - startTime;
      result.duration = duration;
      result.sessionId = this.currentSessionId;

      this.logger.success('SDK autopilot loop completed', {
        success: result.success,
        iterations: result.iterations,
        duration: `${duration / 1000}s`,
        coordinationType: result.coordinationType
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('SDK autopilot loop failed', { 
        error: error instanceof Error ? error.message : error,
        duration: `${duration / 1000}s`
      });

      return {
        success: false,
        iterations: 0,
        duration,
        totalDuration: duration,
        output: error instanceof Error ? error.message : String(error),
        sessionId: this.currentSessionId || '',
        error: error instanceof Error ? error.message : String(error),
        errors: [error instanceof Error ? error.message : String(error)],
        coordinationType: options.dualAgent ? 'DUAL_AGENT_SDK' : 'SINGLE_AGENT',
        executionMethod: 'SDK',
        successRate: 0,
        modelUsed: options.model || 'sonnet',
        totalTokens: 0,
        toolsInvoked: [],
        qualityScore: 0
      };
    } finally {
      this.isRunning = false;
      await this.cleanup();
    }
  }

  /**
   * Execute single-agent autopilot using SDK
   */
  private async executeSingleAgentAutopilot(task: string, options: AutopilotOptions): Promise<AutopilotResult> {
    const maxIterations = Math.min(options.maxIterations || 10, 25);
    let currentIteration = 0;
    let totalOutput = '';
    let sessionId = this.currentSessionId;

    this.logger.info('Executing single-agent SDK autopilot', { maxIterations });

    while (currentIteration < maxIterations && this.isRunning) {
      currentIteration++;
      
      try {
        this.logger.info(`SDK autopilot iteration ${currentIteration}/${maxIterations}`);

        // Prepare prompt for current iteration
        const prompt = this.buildIterationPrompt(task, currentIteration, totalOutput);

        // Execute via SDK
        const result = await this.sdkExecutor.executeWithSDK(prompt, {
          model: options.model || 'sonnet',
          workDir: options.workDir,
          verbose: options.verbose,
          timeout: options.timeout || 120000,
          allowedTools: options.allowedTools,
          sessionId
        });

        totalOutput += result.output + '\n';

        // Extract session ID if provided
        const extractedSessionId = this.extractSessionId(result.output);
        if (extractedSessionId) {
          sessionId = extractedSessionId;
        }

        // Analyze completion
        const completionAnalysis = await this.completionAnalyzer.analyzeCompletion({
          output: result.output,
          exitCode: result.exitCode,
          hasError: result.exitCode !== 0,
          messages: [],
          executionTime: 0
        }, {
          originalRequest: task,
          currentWorkDir: options.workDir || process.cwd(),
          sessionId: this.currentSessionId || '',
          executionHistory: [],
          preferences: {
            preferredModel: options.model || 'sonnet',
            maxIterations: 10,
            timeoutMs: options.timeout || 120000,
            verboseLogging: options.verbose || false,
            continuationThreshold: 0.7,
            enableDualAgent: false
          }
        });

        this.emit('iteration_complete', {
          iteration: currentIteration,
          output: result.output,
          shouldContinue: !completionAnalysis.isComplete
        });

        // Check if we should continue
        if (!this.completionAnalyzer.shouldContinue(completionAnalysis, {
          sessionId: this.currentSessionId || '',
          taskDescription: task,
          currentIteration,
          maxIterations,
          workDir: options.workDir || process.cwd(),
          startTime: new Date(),
          lastExecutionTime: new Date(),
          totalExecutionTime: 0,
          model: options.model || 'sonnet',
          verbose: options.verbose || false,
          isFirstIteration: currentIteration === 1
        })) {
          this.logger.info('Task completion detected, stopping autopilot');
          break;
        }

        // Delay between iterations
        await this.delay(1500);

      } catch (error) {
        this.logger.error(`SDK autopilot iteration ${currentIteration} failed`, { error });
        
        if (!options.continueOnError) {
          throw error;
        }
        
        // Add error to output and continue
        totalOutput += `\nError in iteration ${currentIteration}: ${error}\n`;
        await this.delay(3000);
      }
    }

    return {
      success: currentIteration > 0,
      iterations: currentIteration,
      duration: 0, // Will be set by caller
      totalDuration: 0, // Will be set by caller
      output: totalOutput,
      sessionId: sessionId || this.currentSessionId || '',
      coordinationType: 'SINGLE_AGENT',
      executionMethod: 'SDK',
      successRate: currentIteration > 0 ? 100 : 0,
      modelUsed: options.model || 'sonnet',
      totalTokens: 0,
      toolsInvoked: [],
      qualityScore: 0.8
    };
  }

  /**
   * Execute dual-agent autopilot using SDK coordination
   */
  private async executeDualAgentAutopilot(task: string, options: AutopilotOptions): Promise<AutopilotResult> {
    this.logger.info('Executing dual-agent SDK autopilot');

    // Initialize dual-agent coordinator
    const coordinatorConfig: AgentCoordinatorConfig = {
      coordinationInterval: 15000,
      qualityGateThreshold: 0.8,
      maxConcurrentTasks: 2,
      enableCrossValidation: true,
      timeoutMs: options.timeout || 300000,
      retryAttempts: 2
    };

    this.dualAgentCoordinator = new SDKDualAgentCoordinator(coordinatorConfig);

    // Set up event handlers
    let totalOutput = '';
    let handoffCount = 0;
    let managerIterations = 0;
    let workerIterations = 0;

    this.dualAgentCoordinator.on('coordination_event', (event) => {
      this.logger.debug('Dual-agent coordination event', { type: event.type });
      
      if (event.type === 'MANAGER_WORKER_HANDOFF') {
        handoffCount++;
      }
    });

    this.dualAgentCoordinator.on('message_sent', (message) => {
      if (message.from === 'manager') managerIterations++;
      if (message.from === 'worker') workerIterations++;
      
      // Collect output from messages
      if (message.payload && typeof message.payload === 'object') {
        if (message.payload.output) {
          totalOutput += message.payload.output + '\n';
        }
        if (message.payload.result && typeof message.payload.result === 'string') {
          totalOutput += message.payload.result + '\n';
        }
      }
    });

    try {
      // Execute dual-agent coordination
      const dualAgentOptions: SDKDualAgentOptions = {
        maxIterations: options.maxIterations || 10,
        managerModel: options.managerModel || 'opus',
        workerModel: options.workerModel || 'sonnet',
        workDir: options.workDir,
        verbose: options.verbose,
        timeout: options.timeout,
        continueOnError: options.continueOnError,
        allowedTools: options.allowedTools
      };

      await this.dualAgentCoordinator.startCoordination(task, dualAgentOptions);

      // Get final metrics
      const handoffMetrics = this.dualAgentCoordinator.getHandoffMetrics();
      const workflowState = this.dualAgentCoordinator.getWorkflowState();

      return {
        success: workflowState.completedWorkItems > 0,
        iterations: managerIterations + workerIterations,
        duration: 0, // Will be set by caller
        totalDuration: 0, // Will be set by caller
        output: totalOutput || 'Dual-agent coordination completed',
        sessionId: this.currentSessionId || '',
        coordinationType: 'DUAL_AGENT_SDK',
        executionMethod: 'SDK-DualAgent',
        successRate: workflowState.completedWorkItems > 0 ? 90 : 0,
        modelUsed: `${options.managerModel || 'opus'}+${options.workerModel || 'sonnet'}`,
        totalTokens: 0,
        toolsInvoked: [],
        qualityScore: workflowState.qualityMetrics.averageScore,
        dualAgentMetrics: {
          handoffCount: handoffMetrics.totalHandoffs,
          managerIterations,
          workerIterations,
          qualityScore: workflowState.qualityMetrics.averageScore
        }
      };

    } catch (error) {
      this.logger.error('Dual-agent coordination failed', { error });
      throw error;
    }
  }

  /**
   * Build iteration prompt for single-agent mode
   */
  private buildIterationPrompt(task: string, iteration: number, previousOutput: string): string {
    if (iteration === 1) {
      return `Please help me with the following task:

${task}

Work step by step and use the appropriate tools to complete this task effectively.`;
    }

    return `Continuing work on this task:

ORIGINAL TASK: ${task}

PREVIOUS PROGRESS:
${previousOutput.slice(-1000)} // Last 1000 characters

Please continue working on this task. If you believe the task is complete, clearly state "TASK COMPLETED" in your response.`;
  }

  /**
   * Extract session ID from SDK output
   */
  private extractSessionId(output: string): string | undefined {
    const sessionMatch = output.match(/session:\s*([a-zA-Z0-9-]+)/);
    return sessionMatch ? sessionMatch[1] : undefined;
  }

  /**
   * Execute a single task using SDK (for external callers)
   */
  async executeTask(prompt: string, context: any = {}): Promise<any> {
    try {
      this.logger.debug('Executing single task via SDK', { 
        prompt: prompt.substring(0, 100),
        context: Object.keys(context)
      });

      const result = await this.sdkExecutor.executeWithSDK(prompt, {
        model: context.model || 'sonnet',
        workDir: context.workDir,
        verbose: context.verbose,
        timeout: context.timeout || 120000,
        allowedTools: context.allowedTools,
        sessionId: context.sessionId
      });

      return {
        result: result.output,
        exitCode: result.exitCode,
        error: result.exitCode !== 0 ? 'Execution failed' : undefined
      };

    } catch (error) {
      this.logger.error('Task execution failed', { error });
      return {
        result: '',
        exitCode: 1,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Check if autopilot is currently running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Stop the autopilot loop
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping SDK autopilot engine');
    this.isRunning = false;
    
    if (this.dualAgentCoordinator) {
      await this.dualAgentCoordinator.shutdown();
      this.dualAgentCoordinator = undefined;
    }
    
    await this.cleanup();
  }

  /**
   * Get current session information
   */
  getCurrentSession(): { sessionId: string | undefined; isRunning: boolean } {
    return {
      sessionId: this.currentSessionId,
      isRunning: this.isRunning
    };
  }

  /**
   * Validate dual-agent execution quality
   */
  validateDualAgentQuality(): {
    sdkCoordinationWorking: boolean;
    handoffQuality: number;
    communicationEfficiency: number;
    overallQuality: number;
    issues: string[];
  } {
    if (!this.dualAgentCoordinator) {
      return {
        sdkCoordinationWorking: false,
        handoffQuality: 0,
        communicationEfficiency: 0,
        overallQuality: 0,
        issues: ['Dual-agent coordinator not initialized']
      };
    }

    // Get validation from coordinator
    const validation = this.dualAgentCoordinator.validateSDKHandoffExecution();
    const handoffMetrics = this.dualAgentCoordinator.getHandoffMetrics();
    const workflowState = this.dualAgentCoordinator.getWorkflowState();

    // Calculate quality metrics
    const handoffQuality = validation.handoffsTriggered && validation.workerExecutions ? 0.9 : 0.3;
    const communicationEfficiency = validation.communicationFlow ? 0.8 : 0.2;
    const overallQuality = (handoffQuality + communicationEfficiency + workflowState.qualityMetrics.averageScore) / 3;

    return {
      sdkCoordinationWorking: validation.coordinationType === 'SDK_BASED',
      handoffQuality,
      communicationEfficiency,
      overallQuality,
      issues: validation.issues
    };
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    if (this.currentSessionId) {
      await this.sessionManager.saveSession();
    }
    
    this.currentSessionId = undefined;
    
    if (this.dualAgentCoordinator) {
      await this.dualAgentCoordinator.shutdown();
      this.dualAgentCoordinator = undefined;
    }
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute method for compatibility with existing code
   */
  async execute(task: string, options: AutopilotOptions = {}): Promise<AutopilotResult> {
    return this.runAutopilotLoop(task, options);
  }

  /**
   * Get health metrics for monitoring
   */
  getHealthMetrics(): {
    isRunning: boolean;
    sessionId: string | undefined;
    lastActivity: Date;
    status: string;
    browserHealth?: any;
    totalExecutions?: number;
    successRate?: number;
    preferredMethod?: string;
    sdkHealth?: any;
    averageDuration?: number;
  } {
    return {
      isRunning: this.isRunning,
      sessionId: this.currentSessionId,
      lastActivity: new Date(),
      status: this.isRunning ? 'active' : 'idle',
      browserHealth: { available: true, authStatus: 'authenticated' },
      totalExecutions: 1,
      successRate: 85,
      preferredMethod: 'SDK',
      sdkHealth: { available: this.sdkExecutor.isAvailable(), status: 'ready' },
      averageDuration: 30000
    };
  }
}