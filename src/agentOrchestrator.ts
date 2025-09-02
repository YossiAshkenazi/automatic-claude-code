import { spawn } from 'child_process';
import { SessionManager } from './sessionManager';
import { OutputParser, ParsedOutput } from './outputParser';
import { Logger } from './logger';
import { ClaudeUtils } from './claudeUtils';
import { SDKClaudeExecutor, SDKExecutionOptions } from './services/sdkClaudeExecutor';
import chalk from 'chalk';

export interface AgentConfig {
  name: string;
  model: 'sonnet' | 'opus';
  role: 'manager' | 'worker';
  timeout: number;
}

export interface AgentSession {
  id: string;
  config: AgentConfig;
  sessionId?: string;
  active: boolean;
  lastActivity: Date;
  conversationHistory: AgentMessage[];
}

export interface AgentMessage {
  from: 'user' | 'manager' | 'worker';
  to: 'manager' | 'worker';
  content: string;
  timestamp: Date;
  messageId: string;
  context?: {
    files?: string[];
    commands?: string[];
    errors?: string[];
  };
}

export interface DualAgentOptions {
  maxIterations?: number;
  managerModel?: 'sonnet' | 'opus';
  workerModel?: 'sonnet' | 'opus';
  continueOnError?: boolean;
  verbose?: boolean;
  workDir?: string;
  allowedTools?: string;
  timeout?: number;
  loopDetectionThreshold?: number;
  maxRetries?: number;
  escalationThreshold?: number;
  fallbackToSingleAgent?: boolean;
}

export interface AgentHandoff {
  fromAgent: string;
  toAgent: string;
  task: string;
  context: {
    previousWork?: string;
    requirements?: string;
    constraints?: string[];
    files?: string[];
  };
  timestamp: Date;
}

export class AgentOrchestrator {
  private sessionManager: SessionManager;
  private outputParser: OutputParser;
  private logger: Logger;
  private claudeExecutor: SDKClaudeExecutor;
  private agents: Map<string, AgentSession> = new Map();
  private handoffHistory: AgentHandoff[] = [];
  private messageHistory: AgentMessage[] = [];
  private iteration: number = 0;
  private loopDetectionBuffer: string[] = [];
  private errorHistory: Map<string, number> = new Map(); // Track error counts per agent
  private retryCount: number = 0;
  private lastError?: Error;
  private recoveryAttempts: number = 0;

  constructor() {
    this.sessionManager = new SessionManager();
    this.outputParser = new OutputParser();
    this.logger = new Logger();
    this.claudeExecutor = new SDKClaudeExecutor(this.logger);
  }

  async startDualAgentSession(
    initialTask: string,
    options: DualAgentOptions
  ): Promise<void> {
    console.log(chalk.blue.bold('\n🤖 Starting Dual-Agent Orchestration\n'));
    console.log(chalk.cyan(`Initial Task: ${initialTask}`));
    console.log(chalk.cyan(`Manager Model: ${options.managerModel || 'opus'}`));
    console.log(chalk.cyan(`Worker Model: ${options.workerModel || 'sonnet'}`));
    console.log(chalk.cyan(`Max Iterations: ${options.maxIterations || 10}`));
    console.log(chalk.cyan(`Working Directory: ${options.workDir || process.cwd()}\n`));

    this.logger.info('Starting dual-agent orchestration', {
      initialTask,
      options
    });

    // Initialize agents
    await this.initializeAgents(options);

    // Create session
    await this.sessionManager.createSession(initialTask, options.workDir || process.cwd());

    try {
      // Start with manager receiving the initial task
      await this.executeAgentLoop(initialTask, options);
    } catch (error) {
      this.logger.error('Dual-agent session failed', { error });
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  private async initializeAgents(options: DualAgentOptions): Promise<void> {
    // Manager agent (typically Opus for high-level planning)
    const managerAgent: AgentSession = {
      id: 'manager',
      config: {
        name: 'Manager',
        model: options.managerModel || 'opus',
        role: 'manager',
        timeout: options.timeout || 1800000
      },
      active: false,
      lastActivity: new Date(),
      conversationHistory: []
    };

    // Worker agent (typically Sonnet for implementation)
    const workerAgent: AgentSession = {
      id: 'worker',
      config: {
        name: 'Worker',
        model: options.workerModel || 'sonnet',
        role: 'worker',
        timeout: options.timeout || 1800000
      },
      active: false,
      lastActivity: new Date(),
      conversationHistory: []
    };

    this.agents.set('manager', managerAgent);
    this.agents.set('worker', workerAgent);

    this.logger.info('Agents initialized', {
      manager: managerAgent.config,
      worker: workerAgent.config
    });
  }

  private async handleAgentError(
    agentId: string,
    error: Error,
    options: DualAgentOptions
  ): Promise<{ shouldContinue: boolean; recoveryAction?: string; fallbackAgent?: string }> {
    this.lastError = error;
    this.recoveryAttempts++;
    
    const errorCount = (this.errorHistory.get(agentId) || 0) + 1;
    this.errorHistory.set(agentId, errorCount);
    
    this.logger.error(`Agent ${agentId} error (count: ${errorCount})`, {
      error: error.message,
      recoveryAttempts: this.recoveryAttempts,
      totalRetries: this.retryCount
    });

    // Check if we've exceeded error thresholds
    const maxRetries = options.maxRetries || 3;
    const escalationThreshold = options.escalationThreshold || 5;
    
    if (errorCount >= escalationThreshold) {
      console.log(chalk.red.bold(`\n⚠️ Agent ${agentId} has failed ${errorCount} times. Escalating to human intervention.`));
      this.logger.error(`Agent ${agentId} exceeded failure threshold`, { errorCount, escalationThreshold });
      return { shouldContinue: false };
    }
    
    if (this.retryCount >= maxRetries) {
      if (options.fallbackToSingleAgent) {
        console.log(chalk.yellow.bold('\n🔄 Too many failures. Falling back to single-agent mode.'));
        this.logger.info('Falling back to single-agent mode due to errors');
        return { shouldContinue: false }; // Will trigger fallback in caller
      } else {
        console.log(chalk.red.bold('\n❌ Maximum retries exceeded. Stopping dual-agent session.'));
        return { shouldContinue: false };
      }
    }
    
    // Determine recovery strategy
    const recoveryStrategy = this.determineRecoveryStrategy(agentId, error, errorCount);
    
    console.log(chalk.yellow(`\n🔧 Attempting recovery: ${recoveryStrategy.action}`));
    this.logger.info(`Recovery strategy for agent ${agentId}`, recoveryStrategy);
    
    if (recoveryStrategy.switchAgent) {
      const fallbackAgent = agentId === 'manager' ? 'worker' : 'manager';
      console.log(chalk.cyan(`\n🔄 Switching to ${fallbackAgent} agent for recovery`));
      return { 
        shouldContinue: true, 
        recoveryAction: recoveryStrategy.action,
        fallbackAgent 
      };
    }
    
    return { 
      shouldContinue: true, 
      recoveryAction: recoveryStrategy.action 
    };
  }

  private determineRecoveryStrategy(
    agentId: string,
    error: Error,
    errorCount: number
  ): { action: string; switchAgent: boolean; retryDelay: number } {
    const errorMessage = error.message.toLowerCase();
    
    // Network/timeout errors - retry with same agent
    if (errorMessage.includes('timeout') || errorMessage.includes('network') || errorMessage.includes('connection')) {
      return {
        action: 'Retrying due to network/timeout issue',
        switchAgent: false,
        retryDelay: Math.min(2000 * errorCount, 10000) // Exponential backoff up to 10s
      };
    }
    
    // Model-specific errors - switch agents
    if (errorMessage.includes('model') || errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
      return {
        action: 'Switching agents due to model/quota issue',
        switchAgent: true,
        retryDelay: 5000
      };
    }
    
    // Claude CLI errors - retry with cleanup
    if (errorMessage.includes('claude') || errorMessage.includes('spawn') || errorMessage.includes('command not found')) {
      return {
        action: 'Retrying with Claude CLI cleanup',
        switchAgent: false,
        retryDelay: 3000
      };
    }
    
    // Permission or file system errors
    if (errorMessage.includes('permission') || errorMessage.includes('access') || errorMessage.includes('enoent')) {
      return {
        action: 'Retrying with modified permissions/paths',
        switchAgent: false,
        retryDelay: 1000
      };
    }
    
    // After multiple failures, try switching agents
    if (errorCount >= 2) {
      return {
        action: 'Switching agents after multiple failures',
        switchAgent: true,
        retryDelay: 4000
      };
    }
    
    // Default recovery - simple retry
    return {
      action: 'Simple retry with brief delay',
      switchAgent: false,
      retryDelay: 2000
    };
  }

  private async attemptErrorRecovery(
    recoveryAction: string,
    agentId: string,
    _options: DualAgentOptions
  ): Promise<boolean> {
    this.logger.info(`Attempting error recovery for agent ${agentId}`, { recoveryAction });
    
    try {
      // Cleanup agent session if needed
      const agent = this.agents.get(agentId);
      if (agent) {
        agent.active = false;
        agent.lastActivity = new Date();
        
        // Reset session ID to force fresh session
        if (recoveryAction.includes('cleanup') || recoveryAction.includes('fresh')) {
          agent.sessionId = undefined;
          this.logger.info(`Reset session for agent ${agentId}`);
        }
      }
      
      // Add recovery delay
      const strategy = this.determineRecoveryStrategy(agentId, this.lastError || new Error('Unknown'), this.recoveryAttempts);
      await this.delay(strategy.retryDelay);
      
      return true;
      
    } catch (recoveryError) {
      this.logger.error(`Error recovery failed for agent ${agentId}`, {
        recoveryError: recoveryError instanceof Error ? recoveryError.message : recoveryError
      });
      return false;
    }
  }

  private async fallbackToSingleAgent(
    currentTask: string,
    options: DualAgentOptions
  ): Promise<void> {
    console.log(chalk.yellow.bold('\n🔧 Initiating single-agent fallback mode'));
    this.logger.info('Starting single-agent fallback', { currentTask: currentTask.substring(0, 100) });
    
    try {
      // Import and use the original AutomaticClaudeCode class
      const { AutomaticClaudeCode } = await import('./index');
      const fallbackApp = new AutomaticClaudeCode();
      
      const fallbackPrompt = `The dual-agent system encountered issues. Please complete this task in single-agent mode: ${currentTask}`;
      
      await fallbackApp.runLoop(fallbackPrompt, {
        maxIterations: Math.max((options.maxIterations || 10) - this.iteration, 3),
        model: 'sonnet', // Use reliable model for fallback
        workDir: options.workDir,
        allowedTools: options.allowedTools,
        continueOnError: true, // More resilient in fallback mode
        verbose: options.verbose,
        timeout: options.timeout
      });
      
      console.log(chalk.green.bold('\n✅ Single-agent fallback completed successfully'));
      
    } catch (fallbackError) {
      console.log(chalk.red.bold('\n❌ Single-agent fallback also failed'));
      this.logger.error('Single-agent fallback failed', {
        error: fallbackError instanceof Error ? fallbackError.message : fallbackError
      });
      throw fallbackError;
    }
  }

  private async executeAgentLoop(
    initialTask: string,
    options: DualAgentOptions
  ): Promise<void> {
    const maxIterations = options.maxIterations || 10;
    let currentTask = initialTask;
    let activeAgent = 'manager';
    
    while (this.iteration < maxIterations) {
      this.iteration++;
      this.logger.setIteration(this.iteration);

      console.log(chalk.yellow.bold(`\n━━━ Dual-Agent Iteration ${this.iteration}/${maxIterations} ━━━`));
      console.log(chalk.gray(`Active Agent: ${activeAgent.toUpperCase()}`));
      console.log(chalk.gray(`Task: ${currentTask.substring(0, 100)}${currentTask.length > 100 ? '...' : ''}`));

      // Check for infinite loop
      if (this.detectInfiniteLoop(currentTask)) {
        console.log(chalk.red.bold('\n⚠️ Infinite loop detected! Escalating to human intervention.'));
        this.logger.error('Infinite loop detected', { 
          loopBuffer: this.loopDetectionBuffer,
          iteration: this.iteration 
        });
        break;
      }

      try {
        const agentResult = await this.runAgent(activeAgent, currentTask, options);
        
        // Parse and analyze the result
        const parsedOutput = this.outputParser.parse(agentResult.output);
        
        // Log agent session info if available
        if (parsedOutput.sessionId) {
          const agent = this.agents.get(activeAgent);
          if (agent && !agent.sessionId) {
            agent.sessionId = parsedOutput.sessionId;
            this.logger.info(`Agent ${activeAgent} session ID: ${parsedOutput.sessionId}`);
          }
        }

        // Add to session history
        await this.sessionManager.addIteration({
          iteration: this.iteration,
          prompt: `[${activeAgent.toUpperCase()}] ${currentTask}`,
          output: parsedOutput,
          exitCode: agentResult.exitCode,
          duration: parseFloat((agentResult.duration / 1000).toFixed(2))
        });

        // Determine next action
        const nextAction = await this.analyzeAgentOutput(activeAgent, parsedOutput, agentResult.exitCode);
        
        if (nextAction.isComplete) {
          console.log(chalk.green.bold('\n✅ Task completed successfully by dual-agent system!'));
          this.logger.success('Dual-agent task completed');
          break;
        }

        if (nextAction.hasError && !options.continueOnError) {
          console.log(chalk.red.bold('\n❌ Error detected. Stopping dual-agent loop.'));
          this.logger.error('Error detected, stopping dual-agent loop', { nextAction });
          break;
        }

        // Handle agent handoff
        if (nextAction.shouldHandoff) {
          const handoffResult = await this.handleAgentHandoff(
            activeAgent,
            nextAction.nextAgent!,
            parsedOutput,
            nextAction.handoffTask!
          );
          
          activeAgent = handoffResult.toAgent;
          currentTask = handoffResult.task;
        } else {
          // Continue with same agent
          currentTask = nextAction.nextTask || this.generateContinuationTask(parsedOutput);
        }

        // Brief pause between iterations
        if (this.iteration < maxIterations) {
          console.log(chalk.cyan('\n🔄 Preparing next agent iteration...'));
          await this.delay(2000);
        }

      } catch (error) {
        console.error(chalk.red(`\n❌ Error in agent ${activeAgent} iteration ${this.iteration}:`), error);
        
        // Use enhanced error handling
        const recoveryResult = await this.handleAgentError(
          activeAgent,
          error instanceof Error ? error : new Error(String(error)),
          options
        );
        
        if (!recoveryResult.shouldContinue) {
          if (options.fallbackToSingleAgent && this.iteration > 2) {
            // Try single-agent fallback if we're past initial setup
            await this.fallbackToSingleAgent(currentTask, options);
            break;
          } else {
            throw error;
          }
        }
        
        // Attempt error recovery
        if (recoveryResult.recoveryAction) {
          const recoverySuccess = await this.attemptErrorRecovery(
            recoveryResult.recoveryAction,
            activeAgent,
            options
          );
          
          if (!recoverySuccess && !options.continueOnError) {
            throw error;
          }
        }
        
        // Switch agents if recommended
        if (recoveryResult.fallbackAgent) {
          activeAgent = recoveryResult.fallbackAgent;
          currentTask = `The previous ${activeAgent === 'worker' ? 'manager' : 'worker'} agent encountered an error: ${error instanceof Error ? error.message : error}. Please analyze the situation and continue the task with a different approach.`;
        } else {
          // Modify task for retry with same agent
          currentTask = `Previous attempt failed with error: ${error instanceof Error ? error.message : error}. Please diagnose and fix the issue, then continue with the task.`;
        }
        
        this.retryCount++;
      }
    }

    if (this.iteration >= maxIterations) {
      console.log(chalk.yellow.bold('\n⚠️ Maximum iterations reached in dual-agent mode.'));
    }

    await this.sessionManager.saveSession();
    console.log(chalk.blue.bold('\n📊 Dual-Agent Session Summary:'));
    await this.printDualAgentSummary();
  }

  private async runAgent(
    agentId: string,
    task: string,
    options: DualAgentOptions
  ): Promise<{ output: string; exitCode: number; duration: number }> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    agent.active = true;
    agent.lastActivity = new Date();
    
    const startTime = Date.now();
    console.log(chalk.blue(`\n🤖 Running ${agent.config.name} (${agent.config.model})...`));

    try {
      // Build agent-specific prompt
      const agentPrompt = this.buildAgentPrompt(agentId, task);
      
      // Execute Claude Code with agent-specific model
      const result = await this.runClaudeCode(agentPrompt, {
        model: agent.config.model,
        sessionId: agent.sessionId,
        workDir: options.workDir,
        allowedTools: options.allowedTools,
        continueOnError: options.continueOnError,
        verbose: options.verbose,
        timeout: agent.config.timeout
      });

      const duration = Date.now() - startTime;
      console.log(chalk.green(`✓ ${agent.config.name} completed in ${(duration / 1000).toFixed(2)}s`));

      agent.active = false;
      agent.lastActivity = new Date();

      return {
        ...result,
        duration
      };
      
    } catch (error) {
      agent.active = false;
      agent.lastActivity = new Date();
      throw error;
    }
  }

  private buildAgentPrompt(agentId: string, task: string): string {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return task;
    }

    const prompts: string[] = [];

    if (agent.config.role === 'manager') {
      prompts.push(
        'You are the MANAGER agent in a dual-agent system.',
        'Your role is to break down complex tasks, provide clear instructions, and coordinate work.',
        'Focus on high-level planning, task decomposition, and quality assurance.',
        'When delegating to the worker agent, provide specific, actionable instructions.',
        'Review worker output and decide on next steps.',
      );
    } else {
      prompts.push(
        'You are the WORKER agent in a dual-agent system.',
        'Your role is to implement specific tasks with precision and attention to detail.',
        'Focus on code implementation, testing, debugging, and technical execution.',
        'Follow manager instructions carefully and report back with detailed results.',
        'If you encounter issues, provide specific error details for the manager to review.',
      );
    }

    // Add conversation context if available
    const recentMessages = this.getRecentAgentMessages(agentId, 3);
    if (recentMessages.length > 0) {
      prompts.push('\nRecent conversation context:');
      recentMessages.forEach(msg => {
        prompts.push(`${msg.from} → ${msg.to}: ${msg.content.substring(0, 200)}`);
      });
    }

    prompts.push(`\nCurrent task: ${task}`);

    return prompts.join(' ');
  }

  private getRecentAgentMessages(agentId: string, count: number): AgentMessage[] {
    return this.messageHistory
      .filter(msg => msg.from === agentId || msg.to === agentId)
      .slice(-count);
  }

  private async analyzeAgentOutput(
    agentId: string,
    output: ParsedOutput,
    exitCode: number
  ): Promise<{
    isComplete: boolean;
    hasError: boolean;
    shouldHandoff: boolean;
    nextAgent?: string;
    handoffTask?: string;
    nextTask?: string;
  }> {
    const hasError = exitCode !== 0 || Boolean(output.error);
    const result = output.result || '';
    
    // Check for completion indicators
    const completionIndicators = [
      'task completed',
      'successfully implemented',
      'all requirements met',
      'implementation finished',
      'ready for review',
      'task accomplished'
    ];
    
    const isComplete = completionIndicators.some(indicator => 
      result.toLowerCase().includes(indicator)
    );

    // Determine if handoff is needed
    let shouldHandoff = false;
    let nextAgent = '';
    let handoffTask = '';

    if (agentId === 'manager' && !isComplete && !hasError) {
      // Manager should delegate implementation tasks to worker
      if (result.includes('implement') || result.includes('code') || result.includes('build')) {
        shouldHandoff = true;
        nextAgent = 'worker';
        handoffTask = this.extractWorkerInstructions(result);
      }
    } else if (agentId === 'worker' && !isComplete && !hasError) {
      // Worker should report back to manager for review/next steps
      if (result.includes('completed') || result.includes('done') || result.includes('finished')) {
        shouldHandoff = true;
        nextAgent = 'manager';
        handoffTask = `Review the work completed by the worker: ${this.summarizeWorkerOutput(output)}. Determine next steps or completion.`;
      }
    }

    return {
      isComplete,
      hasError,
      shouldHandoff,
      nextAgent: nextAgent || undefined,
      handoffTask: handoffTask || undefined
    };
  }

  private extractWorkerInstructions(managerOutput: string): string {
    // Extract actionable instructions from manager output
    const lines = managerOutput.split('\n');
    const instructions: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('1.') || trimmed.startsWith('2.') || trimmed.startsWith('3.') ||
          trimmed.startsWith('-') || trimmed.startsWith('*') ||
          trimmed.includes('implement') || trimmed.includes('create') || 
          trimmed.includes('add') || trimmed.includes('update')) {
        instructions.push(trimmed);
      }
    }
    
    if (instructions.length > 0) {
      return `Execute the following instructions: ${instructions.slice(0, 5).join(' ')}`;
    }
    
    // Fallback to summarized version
    return `Implement the requirements outlined in the manager's response: ${managerOutput.substring(0, 300)}${managerOutput.length > 300 ? '...' : ''}`;
  }

  private summarizeWorkerOutput(output: ParsedOutput): string {
    const summary: string[] = [];
    
    if (output.files && output.files.length > 0) {
      summary.push(`Modified ${output.files.length} files: ${output.files.slice(-3).join(', ')}`);
    }
    
    if (output.commands && output.commands.length > 0) {
      summary.push(`Executed ${output.commands.length} commands`);
    }
    
    if (output.tools && output.tools.length > 0) {
      summary.push(`Used tools: ${output.tools.slice(-3).join(', ')}`);
    }
    
    const result = output.result || '';
    if (result) {
      const firstSentence = result.split('.')[0] + '.';
      summary.push(`Result: ${firstSentence}`);
    }
    
    return summary.join('. ');
  }

  private async handleAgentHandoff(
    fromAgent: string,
    toAgent: string,
    output: ParsedOutput,
    task: string
  ): Promise<AgentHandoff> {
    console.log(chalk.magenta(`\n🔄 Agent handoff: ${fromAgent.toUpperCase()} → ${toAgent.toUpperCase()}`));
    
    const handoff: AgentHandoff = {
      fromAgent,
      toAgent,
      task,
      context: {
        previousWork: this.summarizeWorkerOutput(output),
        files: output.files,
        requirements: task
      },
      timestamp: new Date()
    };
    
    this.handoffHistory.push(handoff);
    
    // Log the handoff
    this.logger.info('Agent handoff', {
      from: fromAgent,
      to: toAgent,
      task: task.substring(0, 200),
      context: handoff.context
    });
    
    // Create agent message
    const message: AgentMessage = {
      from: fromAgent as 'manager' | 'worker',
      to: toAgent as 'manager' | 'worker',
      content: task,
      timestamp: new Date(),
      messageId: this.generateMessageId(),
      context: {
        files: output.files,
        commands: output.commands,
        errors: output.error ? [output.error] : undefined
      }
    };
    
    this.messageHistory.push(message);
    
    // Update agent conversation history
    const fromAgentSession = this.agents.get(fromAgent);
    const toAgentSession = this.agents.get(toAgent);
    
    if (fromAgentSession) {
      fromAgentSession.conversationHistory.push(message);
    }
    
    if (toAgentSession) {
      toAgentSession.conversationHistory.push(message);
    }
    
    return handoff;
  }

  private detectInfiniteLoop(currentTask: string): boolean {
    const threshold = 3; // Default threshold for loop detection
    this.loopDetectionBuffer.push(currentTask.substring(0, 100));
    
    // Keep only recent tasks
    if (this.loopDetectionBuffer.length > threshold * 2) {
      this.loopDetectionBuffer = this.loopDetectionBuffer.slice(-threshold * 2);
    }
    
    // Check for repetitive patterns
    if (this.loopDetectionBuffer.length >= threshold) {
      const recent = this.loopDetectionBuffer.slice(-threshold);
      const counts = new Map<string, number>();
      
      recent.forEach(task => {
        counts.set(task, (counts.get(task) || 0) + 1);
      });
      
      // If any task appears more than half the threshold, it's likely a loop
      for (const [, count] of counts.entries()) {
        if (count >= Math.ceil(threshold / 2)) {
          return true;
        }
      }
    }
    
    return false;
  }

  private generateContinuationTask(output: ParsedOutput): string {
    const result = output.result || '';
    
    // Simple continuation logic - can be enhanced
    if (result.includes('error') || result.includes('failed')) {
      return 'Fix the errors encountered in the previous step and continue.';
    }
    
    if (result.includes('implemented') || result.includes('created')) {
      return 'Review the implementation and proceed with testing or next requirements.';
    }
    
    return 'Continue with the next logical step in the task.';
  }

  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  }

  private async runClaudeCode(
    prompt: string,
    options: any
  ): Promise<{ output: string; exitCode: number }> {
    // Convert options to SDKExecutionOptions
    const claudeOptions: SDKExecutionOptions = {
      model: options.model,
      workDir: options.workDir,
      allowedTools: options.allowedTools,
      sessionId: options.sessionId,
      verbose: options.verbose,
      continueOnError: options.continueOnError,
      timeout: options.timeout
    };

    // Use the SDKClaudeExecutor service
    return await this.claudeExecutor.executeWithSDK(prompt, claudeOptions);
  }

  private getClaudeCommand(): { command: string; baseArgs: string[] } {
    return ClaudeUtils.getClaudeCommand();
  }

  private async printDualAgentSummary(): Promise<void> {
    const summary = await this.sessionManager.getSummary();
    
    console.log(chalk.cyan(`Total Iterations: ${summary.totalIterations}`));
    console.log(chalk.cyan(`Total Duration: ${summary.totalDuration}s`));
    console.log(chalk.cyan(`Success Rate: ${summary.successRate}%`));
    
    if (summary.totalCost) {
      console.log(chalk.cyan(`Estimated Cost: $${summary.totalCost.toFixed(4)}`));
    }

    // Dual-agent specific summary
    console.log(chalk.magenta(`Agent Handoffs: ${this.handoffHistory.length}`));
    console.log(chalk.magenta(`Messages Exchanged: ${this.messageHistory.length}`));
    
    // Show recent handoffs
    if (this.handoffHistory.length > 0) {
      console.log(chalk.yellow('\nRecent Agent Handoffs:'));
      this.handoffHistory.slice(-3).forEach((handoff, index) => {
        console.log(chalk.gray(`  ${index + 1}. ${handoff.fromAgent} → ${handoff.toAgent}: ${handoff.task.substring(0, 60)}...`));
      });
    }
  }

  private async cleanup(): Promise<void> {
    // Cleanup agent sessions
    for (const [agentId, agent] of this.agents.entries()) {
      agent.active = false;
      this.logger.info(`Agent ${agentId} cleanup completed`, {
        totalMessages: agent.conversationHistory.length,
        sessionId: agent.sessionId
      });
    }
    
    this.agents.clear();
    this.logger.close();
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public methods for accessing agent state
  public getAgentStatus(): { [agentId: string]: { active: boolean; lastActivity: Date; messageCount: number } } {
    const status: { [agentId: string]: { active: boolean; lastActivity: Date; messageCount: number } } = {};
    
    for (const [agentId, agent] of this.agents.entries()) {
      status[agentId] = {
        active: agent.active,
        lastActivity: agent.lastActivity,
        messageCount: agent.conversationHistory.length
      };
    }
    
    return status;
  }

  public getHandoffHistory(): AgentHandoff[] {
    return [...this.handoffHistory];
  }

  public getMessageHistory(): AgentMessage[] {
    return [...this.messageHistory];
  }
}