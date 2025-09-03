import { EventEmitter } from 'events';
import { Logger } from '../logger';
import { SessionManager } from '../sessionManager';
import { SDKClaudeExecutor, SDKNotInstalledError } from '../services/sdkClaudeExecutor';
import { SDKDualAgentCoordinator, SDKDualAgentOptions } from '../agents/SDKDualAgentCoordinator';
import { AgentCoordinatorConfig } from '../agents/agentTypes';
import { TaskCompletionAnalyzer } from './TaskCompletionAnalyzer';
import { SDKChecker, SDKAvailabilityStatus, SDKHealthStatus } from '../utils/sdkChecker';
import chalk from 'chalk';

export interface AutopilotOptions {
  workDir?: string;
  maxIterations?: number;
  verbose?: boolean;
  timeout?: number;
  continueOnError?: boolean;
  allowedTools?: string;
  model?: 'sonnet' | 'opus';
  sessionId?: string;
  
  // Browser and SDK options
  browser?: string;
  refreshBrowserSession?: boolean;
  headless?: boolean;
  useSDKOnly?: boolean;
  
  // Compatibility with existing code
  enableHooks?: boolean;
  enableMonitoring?: boolean;
  qualityGate?: boolean;
  agentRole?: 'single' | 'manager' | 'worker';
  
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
  private sdkChecker: SDKChecker;

  private isRunning: boolean = false;
  private currentSessionId?: string;
  private sdkHealthLastChecked?: Date;
  private lastSDKHealth?: SDKHealthStatus;

  constructor(logger?: Logger) {
    super();
    
    this.logger = logger || new Logger();
    this.sessionManager = new SessionManager();
    this.sdkExecutor = new SDKClaudeExecutor(this.logger);
    this.completionAnalyzer = new TaskCompletionAnalyzer(this.logger);
    this.sdkChecker = SDKChecker.getInstance();
    
    this.logger.info('SDKAutopilotEngine initialized with enhanced SDK checking');
  }

  /**
   * Run autopilot loop using SDK execution with comprehensive availability checking
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

      // Comprehensive SDK availability check
      const sdkAvailabilityCheck = await this.checkSDKReadiness();
      if (!sdkAvailabilityCheck.canProceed) {
        return this.createSDKUnavailableResult(task, startTime, sdkAvailabilityCheck);
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorType = error?.constructor?.name || 'Error';
      
      this.logger.error('SDK autopilot loop failed', { 
        error: errorMessage,
        errorType,
        duration: `${duration / 1000}s`,
        coordinationType: options.dualAgent ? 'DUAL_AGENT_SDK' : 'SINGLE_AGENT',
        sessionId: this.currentSessionId
      });
      
      // Enhanced error classification for better user guidance
      let enhancedErrorMessage = errorMessage;
      let recoveryGuidance: string[] = [];
      
      if (errorMessage.toLowerCase().includes('sdk') || errorMessage.toLowerCase().includes('not installed')) {
        recoveryGuidance = [
          'Install Claude Code CLI: npm install -g @anthropic-ai/claude-code',
          'Verify installation: claude --version',
          'Run diagnostic: acc --verify-claude-cli'
        ];
        enhancedErrorMessage = `SDK Installation Issue: ${errorMessage}`;
      } else if (errorMessage.toLowerCase().includes('authentication') || errorMessage.toLowerCase().includes('unauthorized')) {
        recoveryGuidance = [
          'Authenticate with Claude: claude auth',
          'Ensure you are logged into claude.ai in your browser',
          'Try clearing browser cache and re-authenticating'
        ];
        enhancedErrorMessage = `Authentication Issue: ${errorMessage}`;
      } else if (errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('timeout')) {
        recoveryGuidance = [
          'Check your internet connection',
          'Try increasing timeout with --timeout option',
          'Verify firewall is not blocking connections to claude.ai'
        ];
        enhancedErrorMessage = `Network Issue: ${errorMessage}`;
      } else if (errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('limit')) {
        recoveryGuidance = [
          'Check your Claude subscription status',
          'Wait for usage limits to reset',
          'Try using a different model with --model option'
        ];
        enhancedErrorMessage = `Usage Limit Issue: ${errorMessage}`;
      }

      return {
        success: false,
        iterations: 0,
        duration,
        totalDuration: duration,
        output: enhancedErrorMessage + (recoveryGuidance.length > 0 ? '\n\nRecovery Suggestions:\n' + recoveryGuidance.map((g, i) => `${i + 1}. ${g}`).join('\n') : ''),
        sessionId: this.currentSessionId || '',
        error: enhancedErrorMessage,
        errors: [enhancedErrorMessage],
        coordinationType: options.dualAgent ? 'DUAL_AGENT_SDK' : 'SINGLE_AGENT',
        executionMethod: 'SDK-ERROR',
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
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorType = error?.constructor?.name || 'Error';
        
        this.logger.error(`SDK autopilot iteration ${currentIteration} failed`, { 
          error: errorMessage,
          errorType,
          iteration: currentIteration,
          maxIterations,
          continueOnError: options.continueOnError
        });
        
        if (!options.continueOnError) {
          // Enhanced error before throwing
          const enhancedError = new Error(`Autopilot iteration ${currentIteration}/${maxIterations} failed: ${errorMessage}`);
          enhancedError.name = errorType;
          throw enhancedError;
        }
        
        // Add detailed error to output and continue
        totalOutput += `\n🚫 Error in iteration ${currentIteration}/${maxIterations}:\n`;
        totalOutput += `   Type: ${errorType}\n`;
        totalOutput += `   Message: ${errorMessage}\n`;
        totalOutput += `   Continuing with next iteration...\n\n`;
        
        // Adaptive delay based on error type
        let errorDelay = 3000;
        if (errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('timeout')) {
          errorDelay = 5000; // Longer delay for network issues
        } else if (errorMessage.toLowerCase().includes('rate') || errorMessage.toLowerCase().includes('limit')) {
          errorDelay = 10000; // Much longer delay for rate limiting
        }
        
        await this.delay(errorDelay);
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorType = error?.constructor?.name || 'Error';
      
      this.logger.error('Dual-agent coordination failed', { 
        error: errorMessage,
        errorType,
        handoffCount,
        managerIterations,
        workerIterations,
        sessionId: this.currentSessionId
      });
      
      // Enhanced error for dual-agent specific issues
      const enhancedError = new Error(`Dual-agent coordination failed: ${errorMessage}`);
      enhancedError.name = `DualAgent${errorType}`;
      throw enhancedError;
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorType = error?.constructor?.name || 'Error';
      
      this.logger.error('Task execution failed', { 
        error: errorMessage,
        errorType,
        promptLength: prompt.length,
        context: Object.keys(context)
      });
      
      // Provide enhanced error context
      let enhancedMessage = errorMessage;
      if (errorMessage.toLowerCase().includes('sdk')) {
        enhancedMessage += ' (Hint: Check SDK installation with: acc --verify-claude-cli)';
      } else if (errorMessage.toLowerCase().includes('auth')) {
        enhancedMessage += ' (Hint: Authenticate with: claude auth)';
      } else if (errorMessage.toLowerCase().includes('network')) {
        enhancedMessage += ' (Hint: Check internet connection and try --timeout 300000)';
      }
      
      return {
        result: '',
        exitCode: 1,
        error: enhancedMessage
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
   * Alias for runAutopilotLoop for CLI compatibility
   */
  async runAutopilot(task: string, options: AutopilotOptions = {}): Promise<AutopilotResult> {
    return this.runAutopilotLoop(task, options);
  }

  /**
   * Check SDK readiness for autopilot execution
   */
  private async checkSDKReadiness(): Promise<{
    canProceed: boolean;
    health?: SDKHealthStatus;
    issues: string[];
    recommendations: string[];
    fallbackAvailable: boolean;
  }> {
    try {
      this.logger.debug('Performing comprehensive SDK readiness check...');
      
      // Get fresh SDK health status
      const health = await this.sdkChecker.getSDKHealthStatus();
      this.lastSDKHealth = health;
      this.sdkHealthLastChecked = new Date();
      
      const result = {
        canProceed: false,
        health,
        issues: [...health.issues],
        recommendations: [...health.actionItems],
        fallbackAvailable: false
      };

      // Determine if we can proceed
      if (health.overallHealth === 'healthy') {
        result.canProceed = true;
        this.logger.info('SDK health check passed - ready for autopilot execution');
      } else if (health.overallHealth === 'partial') {
        // SDK partially available - can proceed with limitations
        result.canProceed = true;
        this.logger.warning('SDK partially available - proceeding with limited functionality', {
          availableFeatures: {
            sdkAvailable: health.sdkAvailable,
            canImportSDK: health.canImportSDK,
            hasClaudeCLI: health.hasClaudeCLI,
            authReady: health.authenticationReady
          }
        });
        result.issues.push('SDK functionality may be limited');
        result.recommendations.push('Consider resolving SDK issues for full functionality');
      } else {
        // SDK unavailable
        result.canProceed = false;
        this.logger.error('SDK health check failed - cannot proceed with autopilot execution', {
          health: health.overallHealth,
          issues: health.issues,
          actionItems: health.actionItems
        });
        
        // Check if fallback options are available
        result.fallbackAvailable = this.checkFallbackOptions();
      }

      return result;
      
    } catch (error) {
      this.logger.error('SDK readiness check failed', { error: String(error) });
      return {
        canProceed: false,
        issues: [`SDK readiness check failed: ${String(error)}`],
        recommendations: ['Verify Claude Code installation and try again'],
        fallbackAvailable: false
      };
    }
  }

  /**
   * Check if fallback execution options are available
   */
  private checkFallbackOptions(): boolean {
    // Check for environment variables that might indicate API-only mode
    const hasApiKey = Boolean(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY);
    
    // Check if we can fall back to legacy CLI execution
    const hasClaudeCLI = this.lastSDKHealth?.hasClaudeCLI || false;
    
    return hasApiKey || hasClaudeCLI;
  }

  /**
   * Create result when SDK is unavailable
   */
  private createSDKUnavailableResult(
    task: string, 
    startTime: number,
    availabilityCheck: { health?: SDKHealthStatus; issues: string[]; recommendations: string[]; fallbackAvailable: boolean }
  ): AutopilotResult {
    const duration = Date.now() - startTime;
    
    let errorMessage = '🚫 Claude Code SDK Not Available\n\n';
    
    if (availabilityCheck.health) {
      const health = availabilityCheck.health;
      errorMessage += `Overall Health: ${health.overallHealth.toUpperCase()}\n`;
      errorMessage += `SDK Available: ${health.sdkAvailable ? '✅' : '❌'}\n`;
      errorMessage += `Can Import SDK: ${health.canImportSDK ? '✅' : '❌'}\n`;
      errorMessage += `Claude CLI: ${health.hasClaudeCLI ? '✅' : '❌'}\n`;
      errorMessage += `Authentication: ${health.authenticationReady ? '✅' : '❌'}\n\n`;
    }
    
    if (availabilityCheck.issues.length > 0) {
      errorMessage += '❌ Issues:\n';
      availabilityCheck.issues.forEach((issue, index) => {
        errorMessage += `  ${index + 1}. ${issue}\n`;
      });
      errorMessage += '\n';
    }
    
    if (availabilityCheck.recommendations.length > 0) {
      errorMessage += '💡 Recommendations:\n';
      availabilityCheck.recommendations.slice(0, 3).forEach((rec, index) => {
        errorMessage += `  ${index + 1}. ${rec}\n`;
      });
      errorMessage += '\n';
    }
    
    if (availabilityCheck.fallbackAvailable) {
      errorMessage += '🔄 Alternative Options:\n';
      errorMessage += '  • Use --use-legacy flag to bypass SDK\n';
      errorMessage += '  • Try acc --verify-claude-cli for diagnostics\n';
    } else {
      errorMessage += '📦 Installation Required:\n';
      errorMessage += '  npm install -g @anthropic-ai/claude-code\n';
    }

    return {
      success: false,
      iterations: 0,
      duration,
      totalDuration: duration,
      output: errorMessage,
      sessionId: this.currentSessionId || '',
      error: 'SDK unavailable',
      errors: ['Claude Code SDK is not available or not properly configured'],
      coordinationType: 'SINGLE_AGENT',
      executionMethod: 'SDK-UNAVAILABLE',
      successRate: 0,
      modelUsed: 'N/A',
      totalTokens: 0,
      toolsInvoked: [],
      qualityScore: 0
    };
  }

  /**
   * Get health metrics for monitoring
   */
  async getHealthMetrics(): Promise<{
    isRunning: boolean;
    sessionId: string | undefined;
    lastActivity: Date;
    status: string;
    browserHealth: {
      available: boolean;
      authStatus: string;
      hasActiveSessions?: boolean;
      authenticatedSessions?: number;
      claudeTabsOpen?: number;
      recommendedBrowser?: string;
    };
    totalExecutions: number;
    successRate: number;
    preferredMethod: string;
    sdkHealth: {
      available: boolean;
      status: string;
      sdkAvailable?: boolean;
      circuitBreakerOpen?: boolean;
      overallHealth?: string;
      lastChecked?: Date;
      issues?: string[];
      canImportSDK?: boolean;
      hasClaudeCLI?: boolean;
      authenticationReady?: boolean;
    };
    averageDuration: number;
  }> {
    // Get SDK status from executor
    const sdkStatus = await this.sdkExecutor.getSDKStatus();
    
    // Get comprehensive SDK health if not recently checked
    const needsHealthCheck = !this.sdkHealthLastChecked || 
      (Date.now() - this.sdkHealthLastChecked.getTime()) > 60000; // 1 minute
    
    let comprehensiveHealth: SDKHealthStatus | undefined;
    if (needsHealthCheck || !this.lastSDKHealth) {
      try {
        comprehensiveHealth = await this.sdkChecker.getSDKHealthStatus();
        this.lastSDKHealth = comprehensiveHealth;
        this.sdkHealthLastChecked = new Date();
      } catch (error) {
        this.logger.debug('Failed to get comprehensive SDK health', { error: String(error) });
      }
    } else {
      comprehensiveHealth = this.lastSDKHealth;
    }
    
    return {
      isRunning: this.isRunning,
      sessionId: this.currentSessionId,
      lastActivity: new Date(),
      status: this.isRunning ? 'active' : 'idle',
      browserHealth: {
        available: Boolean(sdkStatus.browserAuth),
        authStatus: sdkStatus.browserAuth ? 'authenticated' : 'unauthenticated',
        hasActiveSessions: Boolean(sdkStatus.browserAuth),
        authenticatedSessions: sdkStatus.browserAuth ? 1 : 0,
        claudeTabsOpen: sdkStatus.browserAuth ? 1 : 0,
        recommendedBrowser: 'chrome'
      },
      totalExecutions: sdkStatus.executionStats.attempts,
      successRate: sdkStatus.executionStats.successRate,
      preferredMethod: 'SDK',
      sdkHealth: {
        available: sdkStatus.sdkAvailable,
        status: sdkStatus.sdkAvailable ? 'ready' : 'unavailable',
        sdkAvailable: sdkStatus.sdkAvailable,
        circuitBreakerOpen: sdkStatus.circuitBreakerOpen,
        overallHealth: comprehensiveHealth?.overallHealth,
        lastChecked: this.sdkHealthLastChecked,
        issues: comprehensiveHealth?.issues || [],
        canImportSDK: comprehensiveHealth?.canImportSDK,
        hasClaudeCLI: comprehensiveHealth?.hasClaudeCLI,
        authenticationReady: comprehensiveHealth?.authenticationReady
      },
      averageDuration: 30000
    };
  }

  /**
   * Force refresh SDK health status
   */
  async refreshSDKHealth(): Promise<SDKHealthStatus> {
    this.logger.debug('Forcing SDK health refresh...');
    const health = await this.sdkChecker.getSDKHealthStatus();
    this.lastSDKHealth = health;
    this.sdkHealthLastChecked = new Date();
    return health;
  }

  /**
   * Display comprehensive SDK status for debugging
   */
  async displaySDKStatus(): Promise<void> {
    await this.sdkExecutor.displaySDKStatus();
  }
}