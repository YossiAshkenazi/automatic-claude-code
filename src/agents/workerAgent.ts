import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { ClaudeUtils } from '../claudeUtils';
import { Logger } from '../logger';
import { OutputParser, ParsedOutput } from '../outputParser';
import {
  AgentMessage,
  WorkItem,
  TaskAssignment,
  ProgressUpdate,
  TaskStatus,
  QualityCheck,
  AgentCoordinatorConfig,
  MessageType
} from './agentTypes';

export interface WorkerAgentConfig {
  model: 'opus' | 'sonnet' | 'haiku';
  workDir?: string;
  timeout: number;
  verbose?: boolean;
  allowedTools?: string;
}

export interface TaskExecutionResult {
  success: boolean;
  output?: ParsedOutput;
  error?: string;
  artifactsCreated: string[];
  toolsUsed: string[];
  duration: number;
}

export interface WorkerCapability {
  name: string;
  proficiency: number;
  lastUsed?: Date;
  successRate: number;
}

/**
 * Worker Agent - Task execution and implementation agent
 * Responsible for executing specific tasks, implementing code,
 * running tests, and providing detailed progress reports.
 */
export class WorkerAgent extends EventEmitter {
  private config: AgentCoordinatorConfig;
  private logger: Logger;
  private outputParser: OutputParser;
  private isInitialized: boolean = false;
  private currentSession?: string;
  private agentConfig?: WorkerAgentConfig;
  private messageHistory: AgentMessage[] = [];
  private activeAssignments: Map<string, TaskAssignment> = new Map();
  private progressTracking: Map<string, ProgressUpdate> = new Map();
  private capabilities: Map<string, WorkerCapability> = new Map();
  private performanceMetrics = {
    tasksCompleted: 0,
    tasksSucceeded: 0,
    averageCompletionTime: 0,
    toolUsageStats: new Map<string, number>()
  };

  constructor(config: AgentCoordinatorConfig, logger: Logger) {
    super();
    this.config = config;
    this.logger = logger;
    this.outputParser = new OutputParser();
    
    // Initialize default capabilities
    this.initializeCapabilities();

    this.logger.info('WorkerAgent initialized');
  }

  /**
   * Initialize the Worker Agent with configuration
   */
  async initialize(config: WorkerAgentConfig): Promise<void> {
    this.agentConfig = config;
    this.isInitialized = true;
    
    this.logger.info('Worker agent initialized', { 
      model: config.model,
      workDir: config.workDir,
      timeout: config.timeout 
    });

    this.emit('agent_initialized', { role: 'worker', config });
  }

  /**
   * Execute a task assignment from the Manager
   */
  async executeTask(assignment: TaskAssignment): Promise<TaskExecutionResult> {
    this.ensureInitialized();
    
    const { workItem } = assignment;
    this.logger.info('Worker executing task', { 
      workItemId: workItem.id,
      title: workItem.title 
    });

    const startTime = Date.now();
    this.activeAssignments.set(workItem.id, assignment);
    
    try {
      // Initialize progress tracking
      this.initializeProgressTracking(workItem);
      
      // Build execution prompt
      const executionPrompt = this.buildTaskExecutionPrompt(assignment);
      
      // Execute task with Claude
      const result = await this.executeClaudeCommand(executionPrompt);
      const parsedOutput = this.outputParser.parse(result.output);
      
      // Analyze execution result
      const executionResult = this.analyzeExecutionResult(parsedOutput, result.exitCode, startTime);
      
      // Update progress tracking
      this.updateProgressTracking(workItem.id, executionResult);
      
      // Update performance metrics
      this.updatePerformanceMetrics(executionResult);
      
      // Emit events
      if (executionResult.success) {
        this.emit('task_completed', { 
          workItemId: workItem.id, 
          result: executionResult 
        });
        this.logger.success(`Task completed: ${workItem.id}`, {
          duration: executionResult.duration,
          artifactsCreated: executionResult.artifactsCreated.length
        });
      } else {
        this.emit('task_failed', { 
          workItemId: workItem.id, 
          error: executionResult.error 
        });
        this.logger.error(`Task failed: ${workItem.id}`, {
          error: executionResult.error
        });
      }
      
      return executionResult;

    } catch (error) {
      const executionResult: TaskExecutionResult = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        artifactsCreated: [],
        toolsUsed: [],
        duration: Date.now() - startTime
      };
      
      this.updateProgressTracking(workItem.id, executionResult);
      this.emit('task_failed', { workItemId: workItem.id, error });
      
      this.logger.error(`Task execution failed: ${workItem.id}`, { error });
      return executionResult;
      
    } finally {
      this.activeAssignments.delete(workItem.id);
    }
  }

  /**
   * Get progress update for a specific work item
   */
  async getProgress(workItemId: string): Promise<ProgressUpdate | null> {
    const progress = this.progressTracking.get(workItemId);
    
    if (progress) {
      this.logger.debug('Progress requested', { 
        workItemId, 
        status: progress.status,
        confidence: progress.confidenceLevel 
      });
      
      this.emit('progress_update', progress);
    }
    
    return progress || null;
  }

  /**
   * Handle quality check feedback from Manager
   */
  async handleQualityCheck(qualityCheck: QualityCheck): Promise<void> {
    this.logger.info('Quality check received', {
      workItemId: qualityCheck.workItemId,
      passed: qualityCheck.passed,
      score: qualityCheck.score
    });

    if (!qualityCheck.passed) {
      // Handle quality check failure
      await this.handleQualityFailure(qualityCheck);
    }

    this.emit('quality_check_received', qualityCheck);
  }

  /**
   * Receive and process messages from the coordination system
   */
  receiveMessage(message: AgentMessage): void {
    this.messageHistory.push(message);
    
    this.logger.debug('Worker received message', {
      messageId: message.id,
      type: message.type,
      from: message.from
    });

    // Process message based on type
    this.processMessage(message);

    this.emit('message_received', message);
  }

  /**
   * Process received messages
   */
  private processMessage(message: AgentMessage): void {
    try {
      switch (message.type) {
        case 'task_assignment':
          this.handleTaskAssignment(message);
          break;
        case 'quality_check':
          this.handleQualityCheck(message.payload as QualityCheck);
          break;
        case 'course_correction':
          this.handleCourseCorrection(message);
          break;
        default:
          this.logger.debug('Unhandled message type', { type: message.type });
      }
    } catch (error) {
      this.logger.error('Message processing failed', { 
        messageId: message.id,
        error 
      });
    }
  }

  /**
   * Handle task assignment message
   */
  private async handleTaskAssignment(message: AgentMessage): Promise<void> {
    const assignment = message.payload as TaskAssignment;
    
    this.logger.info('Task assignment received', {
      workItemId: assignment.workItem.id,
      title: assignment.workItem.title
    });

    // Execute the task asynchronously
    setTimeout(() => {
      this.executeTask(assignment).catch(error => {
        this.logger.error('Async task execution failed', { 
          workItemId: assignment.workItem.id,
          error 
        });
      });
    }, 100);
  }

  /**
   * Handle course correction from Manager
   */
  private async handleCourseCorrection(message: AgentMessage): Promise<void> {
    const corrections = message.payload as string[];
    
    this.logger.info('Course corrections received', {
      correctionCount: corrections.length
    });

    // Apply corrections to current work
    // This would involve adjusting the current approach based on Manager feedback
    this.emit('course_correction_received', { corrections });
  }

  /**
   * Handle quality check failure
   */
  private async handleQualityFailure(qualityCheck: QualityCheck): Promise<void> {
    this.logger.warning('Quality check failed', {
      workItemId: qualityCheck.workItemId,
      score: qualityCheck.score,
      feedback: qualityCheck.feedback
    });

    const progress = this.progressTracking.get(qualityCheck.workItemId);
    if (progress) {
      progress.status = 'blocked';
      progress.blockers = qualityCheck.feedback || [];
      progress.confidenceLevel = Math.min(progress.confidenceLevel, 0.5);
    }

    // If there are specific required changes, attempt to address them
    if (qualityCheck.recommendations && qualityCheck.recommendations.length > 0) {
      await this.attemptQualityImprovements(qualityCheck);
    }
  }

  /**
   * Attempt to address quality check recommendations
   */
  private async attemptQualityImprovements(qualityCheck: QualityCheck): Promise<void> {
    const improvementPrompt = this.buildQualityImprovementPrompt(qualityCheck);
    
    try {
      const result = await this.executeClaudeCommand(improvementPrompt);
      const parsedOutput = this.outputParser.parse(result.output);
      
      this.logger.info('Quality improvements attempted', {
        workItemId: qualityCheck.workItemId,
        success: result.exitCode === 0
      });

      // Update progress with improvement attempt
      const progress = this.progressTracking.get(qualityCheck.workItemId);
      if (progress) {
        progress.completedSteps.push('Applied quality improvements');
        progress.confidenceLevel = Math.min(progress.confidenceLevel + 0.2, 1.0);
      }

    } catch (error) {
      this.logger.error('Quality improvement failed', {
        workItemId: qualityCheck.workItemId,
        error
      });
    }
  }

  /**
   * Build task execution prompt for Claude
   */
  private buildTaskExecutionPrompt(assignment: TaskAssignment): string {
    const { workItem, context, requiredTools, constraints } = assignment;
    
    return `
You are a skilled Worker agent responsible for implementing specific tasks with precision and quality.

TASK ASSIGNMENT:
Title: ${workItem.title}
Description: ${workItem.description}

ACCEPTANCE CRITERIA:
${workItem.acceptanceCriteria.map(criteria => `- ${criteria}`).join('\n')}

CONTEXT:
${context}

AVAILABLE TOOLS:
${requiredTools.join(', ')}

CONSTRAINTS:
${constraints.length > 0 ? constraints.map(c => `- ${c}`).join('\n') : 'None specified'}

PRIORITY: ${workItem.priority}/5
ESTIMATED EFFORT: ${workItem.estimatedEffort} hours

Please implement this task following these guidelines:

1. **Implementation**: Write clean, maintainable code that meets all acceptance criteria
2. **Testing**: Include appropriate tests to verify functionality
3. **Documentation**: Add necessary comments and documentation
4. **Error Handling**: Implement proper error handling and validation
5. **Performance**: Consider performance implications of your implementation
6. **Security**: Follow security best practices

Approach the task systematically:
1. Analyze the requirements thoroughly
2. Plan your implementation approach
3. Implement the solution incrementally
4. Test each component as you build
5. Document your work clearly
6. Verify all acceptance criteria are met

Provide regular progress updates and be specific about what you've accomplished.
If you encounter any blockers or need clarification, report them clearly.

Focus on delivering high-quality, production-ready code that meets all requirements.
    `.trim();
  }

  /**
   * Build quality improvement prompt for Claude
   */
  private buildQualityImprovementPrompt(qualityCheck: QualityCheck): string {
    return `
You are addressing quality feedback from a Manager agent. Your previous work needs improvements.

QUALITY CHECK RESULTS:
- Passed: ${qualityCheck.passed ? 'No' : 'Yes'}
- Score: ${qualityCheck.score}/1.0
- Work Item ID: ${qualityCheck.workItemId}

FEEDBACK RECEIVED:
${qualityCheck.feedback?.map(f => `- ${f}`).join('\n') || 'No specific feedback provided'}

RECOMMENDATIONS:
${qualityCheck.recommendations?.map(r => `- ${r}`).join('\n') || 'No specific recommendations provided'}

Please address the quality concerns by:

1. **Analyzing the Feedback**: Understand each point of feedback thoroughly
2. **Identifying Root Causes**: Determine why the quality issues occurred
3. **Implementing Fixes**: Make specific improvements to address each concern
4. **Verification**: Test that your improvements resolve the issues
5. **Documentation**: Document what changes were made and why

Focus on:
- Code quality and maintainability
- Test coverage and reliability  
- Documentation clarity
- Performance optimization
- Security considerations
- Best practices compliance

Make the necessary improvements and ensure the work meets high quality standards.
Provide a clear summary of what was improved and how it addresses the feedback.
    `.trim();
  }

  /**
   * Initialize progress tracking for a work item
   */
  private initializeProgressTracking(workItem: WorkItem): void {
    const initialProgress: ProgressUpdate = {
      workItemId: workItem.id,
      status: 'in_progress',
      completedSteps: ['Task assignment received', 'Analysis started'],
      nextSteps: ['Implement core functionality', 'Add tests', 'Verify acceptance criteria'],
      blockers: [],
      artifactsProduced: [],
      confidenceLevel: 0.8
    };

    this.progressTracking.set(workItem.id, initialProgress);
    this.logger.debug('Progress tracking initialized', { workItemId: workItem.id });
  }

  /**
   * Update progress tracking based on execution result
   */
  private updateProgressTracking(workItemId: string, result: TaskExecutionResult): void {
    const progress = this.progressTracking.get(workItemId);
    
    if (progress) {
      if (result.success) {
        progress.status = 'completed';
        progress.completedSteps.push('Implementation completed', 'Testing completed', 'All acceptance criteria verified');
        progress.nextSteps = ['Awaiting manager review'];
        progress.confidenceLevel = 0.9;
      } else {
        progress.status = 'failed';
        progress.blockers = progress.blockers || [];
        if (result.error) {
          progress.blockers.push(result.error);
        }
        progress.confidenceLevel = Math.max(progress.confidenceLevel - 0.3, 0.2);
      }
      
      progress.artifactsProduced = result.artifactsCreated;
      
      this.logger.debug('Progress tracking updated', { 
        workItemId, 
        status: progress.status,
        confidence: progress.confidenceLevel
      });
    }
  }

  /**
   * Analyze execution result from Claude output
   */
  private analyzeExecutionResult(
    parsedOutput: ParsedOutput,
    exitCode: number,
    startTime: number
  ): TaskExecutionResult {
    const duration = Date.now() - startTime;
    const success = exitCode === 0 && !parsedOutput.error;
    
    // Extract artifacts created
    const artifactsCreated = parsedOutput.files || [];
    
    // Extract tools used
    const toolsUsed = parsedOutput.tools || [];
    
    // Update tool usage statistics
    toolsUsed.forEach(tool => {
      const currentCount = this.performanceMetrics.toolUsageStats.get(tool) || 0;
      this.performanceMetrics.toolUsageStats.set(tool, currentCount + 1);
    });
    
    // Update capability proficiency
    this.updateCapabilityProficiency(toolsUsed, success);
    
    return {
      success,
      output: parsedOutput,
      error: parsedOutput.error,
      artifactsCreated,
      toolsUsed,
      duration
    };
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(result: TaskExecutionResult): void {
    this.performanceMetrics.tasksCompleted++;
    
    if (result.success) {
      this.performanceMetrics.tasksSucceeded++;
    }
    
    // Update average completion time
    const currentAvg = this.performanceMetrics.averageCompletionTime;
    const taskCount = this.performanceMetrics.tasksCompleted;
    
    this.performanceMetrics.averageCompletionTime = 
      ((currentAvg * (taskCount - 1)) + result.duration) / taskCount;
  }

  /**
   * Initialize default capabilities
   */
  private initializeCapabilities(): void {
    const defaultCapabilities = [
      { name: 'code_implementation', proficiency: 0.8 },
      { name: 'testing', proficiency: 0.7 },
      { name: 'debugging', proficiency: 0.8 },
      { name: 'documentation', proficiency: 0.6 },
      { name: 'file_management', proficiency: 0.9 },
      { name: 'command_execution', proficiency: 0.8 },
      { name: 'problem_solving', proficiency: 0.7 },
      { name: 'code_review', proficiency: 0.6 }
    ];

    defaultCapabilities.forEach(cap => {
      this.capabilities.set(cap.name, {
        name: cap.name,
        proficiency: cap.proficiency,
        successRate: 0.8
      });
    });
  }

  /**
   * Update capability proficiency based on task results
   */
  private updateCapabilityProficiency(toolsUsed: string[], success: boolean): void {
    const adjustment = success ? 0.01 : -0.02;
    
    // Update specific tool capabilities
    toolsUsed.forEach(tool => {
      const capability = this.capabilities.get(tool.toLowerCase());
      if (capability) {
        capability.proficiency = Math.max(0.1, Math.min(1.0, 
          capability.proficiency + adjustment
        ));
        capability.lastUsed = new Date();
        
        // Update success rate
        const currentSuccessRate = capability.successRate;
        capability.successRate = Math.max(0.1, Math.min(1.0,
          (currentSuccessRate * 0.9) + (success ? 0.1 : 0)
        ));
      }
    });

    // Update general capabilities
    const generalCapabilities = ['code_implementation', 'problem_solving'];
    generalCapabilities.forEach(capName => {
      const capability = this.capabilities.get(capName);
      if (capability) {
        capability.proficiency = Math.max(0.1, Math.min(1.0,
          capability.proficiency + (adjustment * 0.5)
        ));
      }
    });
  }

  /**
   * Execute Claude command and return parsed result
   */
  private async executeClaudeCommand(prompt: string): Promise<{ output: string; exitCode: number }> {
    if (!this.agentConfig) {
      throw new Error('Worker agent not initialized');
    }

    const args = ['-p', prompt];
    
    if (this.agentConfig.model) {
      args.push('--model', this.agentConfig.model);
    }
    
    if (this.currentSession) {
      args.push('--resume', this.currentSession);
    }
    
    if (this.agentConfig.verbose) {
      args.push('--verbose');
    }

    if (this.agentConfig.allowedTools) {
      args.push('--allowedTools', this.agentConfig.allowedTools);
    }

    // Add specific worker optimizations
    args.push('--dangerously-skip-permissions');

    return new Promise((resolve, reject) => {
      let claudeProcess: any;
      
      try {
        const { command, baseArgs } = ClaudeUtils.getClaudeCommand();
        const allArgs = [...baseArgs, ...args];
        
        // Determine if shell should be used more reliably
        const useShell = process.platform === 'win32' || command.includes('npx') || command.includes('npm');
        
        this.logger.debug('Executing Claude command', { 
          command, 
          args: allArgs.slice(0, 3), // Log first few args for debugging
          useShell,
          workDir: this.agentConfig?.workDir || process.cwd()
        });

        claudeProcess = spawn(command, allArgs, {
          shell: useShell,
          env: { ...process.env, PATH: process.env.PATH },
          cwd: this.agentConfig?.workDir || process.cwd(),
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true
        });
      } catch (spawnError) {
        this.logger.error('Failed to spawn Claude process', { 
          error: spawnError instanceof Error ? spawnError.message : spawnError 
        });
        reject(new Error(`spawn EINVAL`));
        return;
      }

      let output = '';
      let errorOutput = '';

      claudeProcess.stdout.on('data', (data: any) => {
        const chunk = data.toString();
        output += chunk;
        
        // Emit real-time progress updates
        this.emit('execution_progress', { chunk });
      });

      claudeProcess.stderr.on('data', (data: any) => {
        errorOutput += data.toString();
      });

      claudeProcess.on('close', (code: number | null) => {
        this.logger.debug('Claude process completed', {
          exitCode: code,
          outputLength: output.length,
          errorOutputLength: errorOutput.length,
          errorOutput: errorOutput.substring(0, 500) // First 500 chars of error
        });
        
        if (code !== 0) {
          this.logger.warning('Claude execution completed with errors', {
            exitCode: code,
            errorOutput: errorOutput.substring(0, 200)
          });
        }
        
        resolve({ output, exitCode: code || 0 });
      });

      claudeProcess.on('error', (err: Error) => {
        this.logger.error('Claude process error', { error: err.message });
        reject(err);
      });

      // Timeout handling
      const timeout = setTimeout(() => {
        claudeProcess.kill('SIGTERM');
        reject(new Error('Worker agent Claude execution timed out'));
      }, this.agentConfig?.timeout || 1800000);

      claudeProcess.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  /**
   * Utility methods
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Worker agent not initialized');
    }
  }

  /**
   * Shutdown the Worker Agent
   */
  async shutdown(): Promise<void> {
    this.isInitialized = false;
    this.activeAssignments.clear();
    this.progressTracking.clear();
    this.messageHistory = [];
    
    this.logger.info('Worker agent shutdown completed', {
      performanceMetrics: {
        tasksCompleted: this.performanceMetrics.tasksCompleted,
        successRate: this.performanceMetrics.tasksCompleted > 0 
          ? (this.performanceMetrics.tasksSucceeded / this.performanceMetrics.tasksCompleted) * 100
          : 0,
        averageCompletionTime: Math.round(this.performanceMetrics.averageCompletionTime)
      }
    });
    
    this.emit('agent_shutdown', { role: 'worker' });
  }

  /**
   * Public API methods for external monitoring
   */
  public getActiveAssignments(): TaskAssignment[] {
    return Array.from(this.activeAssignments.values());
  }

  public getProgressTracking(): Map<string, ProgressUpdate> {
    return new Map(this.progressTracking);
  }

  public getMessageHistory(): AgentMessage[] {
    return [...this.messageHistory];
  }

  public getCapabilities(): WorkerCapability[] {
    return Array.from(this.capabilities.values());
  }

  public getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      successRate: this.performanceMetrics.tasksCompleted > 0 
        ? (this.performanceMetrics.tasksSucceeded / this.performanceMetrics.tasksCompleted) * 100
        : 0,
      toolUsageStats: Object.fromEntries(this.performanceMetrics.toolUsageStats)
    };
  }

  /**
   * Manual capability adjustment for fine-tuning
   */
  public adjustCapability(capabilityName: string, proficiency: number): void {
    const capability = this.capabilities.get(capabilityName);
    if (capability) {
      capability.proficiency = Math.max(0.1, Math.min(1.0, proficiency));
      this.logger.info('Capability adjusted', { capabilityName, proficiency });
    }
  }

  /**
   * Get capability assessment for task planning
   */
  public assessTaskCapability(requiredTools: string[], taskComplexity: number): {
    overallConfidence: number;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  } {
    const toolCapabilities = requiredTools.map(tool => {
      const capability = this.capabilities.get(tool.toLowerCase());
      return {
        tool,
        proficiency: capability?.proficiency || 0.5,
        successRate: capability?.successRate || 0.5
      };
    });

    const averageProficiency = toolCapabilities.reduce((sum, cap) => sum + cap.proficiency, 0) / toolCapabilities.length;
    const averageSuccessRate = toolCapabilities.reduce((sum, cap) => sum + cap.successRate, 0) / toolCapabilities.length;
    
    // Adjust confidence based on task complexity
    const complexityAdjustment = Math.max(0.5, 1 - (taskComplexity - 1) * 0.1);
    const overallConfidence = (averageProficiency * 0.6 + averageSuccessRate * 0.4) * complexityAdjustment;

    const strengths = toolCapabilities.filter(cap => cap.proficiency > 0.8).map(cap => cap.tool);
    const weaknesses = toolCapabilities.filter(cap => cap.proficiency < 0.6).map(cap => cap.tool);
    
    const recommendations: string[] = [];
    if (overallConfidence < 0.6) {
      recommendations.push('Consider breaking down into smaller tasks');
    }
    if (weaknesses.length > 0) {
      recommendations.push(`May need assistance with: ${weaknesses.join(', ')}`);
    }
    if (taskComplexity > 3) {
      recommendations.push('High complexity task - recommend manager oversight');
    }

    return {
      overallConfidence,
      strengths,
      weaknesses,
      recommendations
    };
  }
}