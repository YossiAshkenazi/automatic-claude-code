import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { ClaudeUtils } from '../claudeUtils';
import { Logger } from '../logger';
import { OutputParser, ParsedOutput } from '../outputParser';
import { SDKClaudeExecutor } from '../services/sdkClaudeExecutor';
import {
  AgentMessage,
  WorkItem,
  TaskStatus,
  QualityCheck,
  AgentCoordinatorConfig,
  ProgressUpdate,
  MessageType
} from './agentTypes';

export interface ManagerAgentConfig {
  model: 'opus' | 'sonnet' | 'haiku';
  workDir?: string;
  timeout: number;
  verbose?: boolean;
  allowedTools?: string;
  usePTY?: boolean;
  claudeExecutor?: SDKClaudeExecutor;
}

export interface TaskAnalysisResult {
  workItems: WorkItem[];
  strategy: string;
  estimatedEffort: number;
  riskFactors: string[];
  dependencies: string[];
}

export interface WorkReviewResult {
  approved: boolean;
  qualityScore?: number;
  feedback?: string[];
  recommendations?: string[];
  requiredChanges?: string[];
}

/**
 * Manager Agent - Strategic planning and oversight agent
 * Responsible for high-level task planning, progress monitoring, 
 * quality gates, and coordinating Worker agent activities.
 */
export class ManagerAgent extends EventEmitter {
  private config: AgentCoordinatorConfig;
  private logger: Logger;
  private outputParser: OutputParser;
  private isInitialized: boolean = false;
  private currentSession?: string;
  private agentConfig?: ManagerAgentConfig;
  private messageHistory: AgentMessage[] = [];
  private activeWorkItems: Map<string, WorkItem> = new Map();
  private qualityStandards: Map<string, number> = new Map();
  private claudeExecutor?: SDKClaudeExecutor;
  private ptySessionId?: string;

  constructor(config: AgentCoordinatorConfig, logger: Logger) {
    super();
    this.config = config;
    this.logger = logger;
    this.outputParser = new OutputParser();
    
    // Set default quality standards
    this.qualityStandards.set('code_quality', 0.8);
    this.qualityStandards.set('test_coverage', 0.7);
    this.qualityStandards.set('documentation', 0.6);
    this.qualityStandards.set('performance', 0.8);
    this.qualityStandards.set('security', 0.9);

    this.logger.info('ManagerAgent initialized');
  }

  /**
   * Initialize the Manager Agent with configuration
   */
  async initialize(config: ManagerAgentConfig): Promise<void> {
    this.agentConfig = config;
    this.isInitialized = true;
    this.claudeExecutor = config.claudeExecutor;
    
    // Initialize PTY session if enabled
    if (config.usePTY && this.claudeExecutor) {
      this.ptySessionId = await this.claudeExecutor.getOrCreatePTYSession(
        'manager',
        config.workDir,
        this.currentSession
      );
      
      this.logger.info('Manager agent initialized with PTY', {
        model: config.model,
        workDir: config.workDir,
        timeout: config.timeout,
        ptySessionId: this.ptySessionId
      });
    } else {
      this.logger.info('Manager agent initialized with spawn', {
        model: config.model,
        workDir: config.workDir,
        timeout: config.timeout
      });
    }

    this.emit('agent_initialized', { role: 'manager', config });
  }

  /**
   * Analyze a task and break it down into manageable work items
   */
  async analyzeTask(userRequest: string): Promise<TaskAnalysisResult> {
    this.ensureInitialized();
    
    this.logger.info('Manager analyzing task', { 
      request: userRequest.substring(0, 100) 
    });

    try {
      const analysisPrompt = this.buildTaskAnalysisPrompt(userRequest);
      const result = await this.executeClaudeCommand(analysisPrompt);
      const parsedOutput = this.outputParser.parse(result.output);
      
      const analysisResult = await this.parseTaskAnalysis(parsedOutput, userRequest);
      
      // Store work items for tracking
      analysisResult.workItems.forEach(item => {
        this.activeWorkItems.set(item.id, item);
      });

      this.logger.success('Task analysis completed', {
        workItemCount: analysisResult.workItems.length,
        strategy: analysisResult.strategy,
        estimatedEffort: analysisResult.estimatedEffort
      });

      this.emit('task_analyzed', analysisResult);
      
      return analysisResult;

    } catch (error) {
      this.logger.error('Task analysis failed', { 
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }

  /**
   * Review work completed by the Worker agent
   */
  async reviewWork(workItemId: string): Promise<WorkReviewResult> {
    this.ensureInitialized();
    
    const workItem = this.activeWorkItems.get(workItemId);
    if (!workItem) {
      throw new Error(`Work item not found: ${workItemId}`);
    }

    this.logger.info('Manager reviewing work', { 
      workItemId, 
      title: workItem.title 
    });

    try {
      const reviewPrompt = this.buildWorkReviewPrompt(workItem);
      const result = await this.executeClaudeCommand(reviewPrompt);
      const parsedOutput = this.outputParser.parse(result.output);
      
      const reviewResult = await this.parseWorkReview(parsedOutput, workItem);
      
      // Update work item based on review
      if (reviewResult.approved) {
        workItem.status = 'completed';
        this.logger.success(`Work approved: ${workItemId}`, {
          qualityScore: reviewResult.qualityScore
        });
      } else {
        workItem.status = 'blocked';
        this.logger.warning(`Work needs revision: ${workItemId}`, {
          feedback: reviewResult.feedback
        });
      }

      workItem.updatedAt = new Date();
      
      this.emit('work_reviewed', { workItemId, result: reviewResult });
      
      return reviewResult;

    } catch (error) {
      this.logger.error('Work review failed', { 
        workItemId,
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }

  /**
   * Provide strategic guidance and course corrections
   */
  async provideCourseCorrection(
    workItemId: string, 
    currentProgress: ProgressUpdate,
    issues: string[]
  ): Promise<string[]> {
    this.ensureInitialized();
    
    this.logger.info('Manager providing course correction', { 
      workItemId,
      issues: issues.length 
    });

    try {
      const correctionPrompt = this.buildCorrectionPrompt(workItemId, currentProgress, issues);
      const result = await this.executeClaudeCommand(correctionPrompt);
      const parsedOutput = this.outputParser.parse(result.output);
      
      const corrections = this.parseCourseCorrection(parsedOutput);
      
      this.logger.info('Course correction provided', {
        workItemId,
        correctionCount: corrections.length
      });

      this.emit('course_correction', { workItemId, corrections });
      
      return corrections;

    } catch (error) {
      this.logger.error('Course correction failed', { 
        workItemId,
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }

  /**
   * Monitor overall project progress and identify bottlenecks
   */
  async monitorProgress(): Promise<{
    overallHealth: 'good' | 'warning' | 'critical';
    recommendations: string[];
    blockers: string[];
    nextPriorities: string[];
  }> {
    this.ensureInitialized();
    
    this.logger.info('Manager monitoring overall progress');

    try {
      const progressPrompt = this.buildProgressMonitoringPrompt();
      const result = await this.executeClaudeCommand(progressPrompt);
      const parsedOutput = this.outputParser.parse(result.output);
      
      const progressAnalysis = this.parseProgressMonitoring(parsedOutput);
      
      this.logger.info('Progress monitoring completed', {
        health: progressAnalysis.overallHealth,
        recommendationCount: progressAnalysis.recommendations.length,
        blockerCount: progressAnalysis.blockers.length
      });

      this.emit('progress_monitored', progressAnalysis);
      
      return progressAnalysis;

    } catch (error) {
      this.logger.error('Progress monitoring failed', { 
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }

  /**
   * Receive and process messages from the coordination system
   */
  receiveMessage(message: AgentMessage): void {
    this.messageHistory.push(message);
    
    this.logger.debug('Manager received message', {
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
        case 'progress_update':
          this.handleProgressUpdate(message);
          break;
        case 'completion_report':
          this.handleCompletionReport(message);
          break;
        case 'error_report':
          this.handleErrorReport(message);
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
   * Handle progress update from Worker
   */
  private handleProgressUpdate(message: AgentMessage): void {
    const progressUpdate = message.payload as ProgressUpdate;
    const workItem = this.activeWorkItems.get(progressUpdate.workItemId);
    
    if (workItem) {
      workItem.status = progressUpdate.status;
      workItem.updatedAt = new Date();
      
      this.logger.info('Work item progress updated', {
        workItemId: progressUpdate.workItemId,
        status: progressUpdate.status,
        confidence: progressUpdate.confidenceLevel
      });

      // Check if intervention is needed based on confidence level
      if (progressUpdate.confidenceLevel < 0.5 && progressUpdate.blockers && progressUpdate.blockers.length > 0) {
        this.emit('intervention_needed', {
          workItemId: progressUpdate.workItemId,
          reason: 'low_confidence',
          blockers: progressUpdate.blockers
        });
      }
    }
  }

  /**
   * Handle completion report from Worker
   */
  private handleCompletionReport(message: AgentMessage): void {
    const completionReport = message.payload;
    const workItemId = completionReport.workItemId;
    
    this.logger.info('Work completion reported', { workItemId });
    
    // Schedule automatic review
    setTimeout(() => {
      this.reviewWork(workItemId).catch(error => {
        this.logger.error('Automatic review failed', { workItemId, error });
      });
    }, 1000);
  }

  /**
   * Handle error report from Worker
   */
  private handleErrorReport(message: AgentMessage): void {
    const errorReport = message.payload;
    
    this.logger.warning('Worker error reported', errorReport);
    
    // Emit intervention event for coordinator
    this.emit('intervention_needed', {
      workItemId: errorReport.workItemId,
      reason: 'worker_error',
      error: errorReport
    });
  }

  /**
   * Build task analysis prompt for Claude
   */
  private buildTaskAnalysisPrompt(userRequest: string): string {
    return `
You are a strategic Manager agent in a dual-agent system. Your role is to analyze complex tasks and break them down into manageable work items for a Worker agent to implement.

TASK TO ANALYZE:
${userRequest}

IMPORTANT: You MUST break down this task into MULTIPLE discrete work items that can be delegated to a Worker agent. Even simple tasks should be broken into at least 2-3 work items.

Provide your analysis in the following EXACT format:

## WORK ITEMS

Work Item 1: [Title]
Description: [Detailed description of what needs to be done]
Acceptance Criteria: [What defines this work item as complete]
Priority: [1-5, where 1 is highest]
Effort: [Estimated hours]
Dependencies: [List any dependencies or 'None']

Work Item 2: [Title]
Description: [Detailed description of what needs to be done]
Acceptance Criteria: [What defines this work item as complete]
Priority: [1-5, where 1 is highest]
Effort: [Estimated hours]
Dependencies: [List any dependencies or 'None']

[Continue with more work items as needed...]

## IMPLEMENTATION STRATEGY
[Your high-level strategy for approaching this task]

## RISK ASSESSMENT
- [Risk 1]
- [Risk 2]
[Continue as needed...]

## DEPENDENCIES
- [Dependency 1]
- [Dependency 2]
[Or write 'None' if no external dependencies]

## QUALITY GATES
- [Quality checkpoint 1]
- [Quality checkpoint 2]
[Continue as needed...]

REMEMBER:
- Break the task into AT LEAST 2-3 work items, even for simple tasks
- Each work item should be specific and actionable
- Work items should be sized for 1-4 hours of work
- Consider creating work items for: implementation, testing, validation, documentation
- The Worker agent will execute these items, so be clear and specific
    `.trim();
  }

  /**
   * Build work review prompt for Claude
   */
  private buildWorkReviewPrompt(workItem: WorkItem): string {
    return `
You are a Manager agent reviewing work completed by a Worker agent. Your role is to ensure quality and adherence to requirements.

WORK ITEM UNDER REVIEW:
Title: ${workItem.title}
Description: ${workItem.description}
Acceptance Criteria: ${workItem.acceptanceCriteria.join(', ')}
Status: ${workItem.status}

Please review the completed work and provide:

1. **Quality Assessment**: Evaluate the work against the acceptance criteria
2. **Code Quality**: If applicable, assess code quality, maintainability, and best practices
3. **Test Coverage**: Verify that appropriate tests have been implemented
4. **Documentation**: Check for adequate documentation and comments
5. **Performance**: Assess performance implications if relevant
6. **Security**: Identify any security concerns

Provide your review in the following format:
- APPROVED: Yes/No
- QUALITY_SCORE: 0.0-1.0 (overall quality score)
- FEEDBACK: List of specific feedback points
- RECOMMENDATIONS: Suggestions for improvement
- REQUIRED_CHANGES: Critical changes needed if not approved

Use the following quality standards:
- Code Quality: ${this.qualityStandards.get('code_quality')}
- Test Coverage: ${this.qualityStandards.get('test_coverage')}
- Documentation: ${this.qualityStandards.get('documentation')}
- Performance: ${this.qualityStandards.get('performance')}
- Security: ${this.qualityStandards.get('security')}

Be thorough but constructive in your feedback.
    `.trim();
  }

  /**
   * Build course correction prompt for Claude
   */
  private buildCorrectionPrompt(
    workItemId: string,
    currentProgress: ProgressUpdate,
    issues: string[]
  ): string {
    const workItem = this.activeWorkItems.get(workItemId);
    
    return `
You are a Manager agent providing strategic guidance to resolve issues and get work back on track.

WORK ITEM: ${workItem?.title || workItemId}
CURRENT STATUS: ${currentProgress.status}
CONFIDENCE LEVEL: ${currentProgress.confidenceLevel}
COMPLETED STEPS: ${currentProgress.completedSteps.join(', ')}
PLANNED NEXT STEPS: ${currentProgress.nextSteps.join(', ')}

CURRENT ISSUES:
${issues.map(issue => `- ${issue}`).join('\n')}

BLOCKERS:
${currentProgress.blockers?.map(blocker => `- ${blocker}`).join('\n') || 'None reported'}

Please provide specific, actionable course corrections including:

1. **Root Cause Analysis**: Identify the underlying causes of the issues
2. **Alternative Approaches**: Suggest different technical approaches if needed
3. **Resource Adjustments**: Recommend additional tools, libraries, or resources
4. **Priority Changes**: Suggest if priorities or scope should be adjusted
5. **Risk Mitigation**: Provide strategies to prevent similar issues
6. **Next Steps**: Clear, prioritized next steps to move forward

Focus on practical, implementable solutions that address the root causes.
Provide corrections in order of priority and impact.
    `.trim();
  }

  /**
   * Build progress monitoring prompt for Claude
   */
  private buildProgressMonitoringPrompt(): string {
    const workItemsStatus = Array.from(this.activeWorkItems.values()).map(item => ({
      id: item.id,
      title: item.title,
      status: item.status,
      priority: item.priority
    }));

    return `
You are a Manager agent monitoring overall project progress and health.

CURRENT WORK ITEMS STATUS:
${workItemsStatus.map(item => 
  `- [${item.status.toUpperCase()}] ${item.title} (Priority: ${item.priority})`
).join('\n')}

RECENT MESSAGES: ${this.messageHistory.slice(-5).length} messages in last coordination cycle

Please analyze the overall project health and provide:

1. **Overall Health**: Assess as 'good', 'warning', or 'critical'
2. **Progress Summary**: High-level progress assessment
3. **Bottlenecks**: Identify current bottlenecks or blocking issues
4. **Resource Utilization**: Assess if resources are being used effectively  
5. **Timeline Assessment**: Evaluate if the project is on track
6. **Recommendations**: Strategic recommendations for improvement
7. **Next Priorities**: What should be prioritized in the next iteration

Consider:
- Work item completion rate
- Quality of deliverables
- Communication effectiveness
- Risk factors
- Dependency management

Provide actionable insights that will help coordinate the next phase of work.
    `.trim();
  }

  /**
   * Execute Claude command and return parsed result
   */
  private async executeClaudeCommand(prompt: string): Promise<{ output: string; exitCode: number }> {
    if (!this.agentConfig) {
      throw new Error('Manager agent not initialized');
    }

    // Use PTY execution if available
    if (this.agentConfig.usePTY && this.claudeExecutor && this.ptySessionId) {
      try {
        const output = await this.claudeExecutor.sendToPTYSession(this.ptySessionId, prompt);
        return { output, exitCode: 0 };
      } catch (error) {
        this.logger.error('PTY execution failed, falling back to spawn', { error });
        // Fall through to spawn execution
      }
    }

    // Traditional spawn-based execution
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

    return new Promise((resolve, reject) => {
      let claudeProcess: any;
      
      try {
        const { command, baseArgs } = ClaudeUtils.getClaudeCommand();
        const allArgs = [...baseArgs, ...args];
        
        // Determine if shell should be used more reliably
        const useShell = process.platform === 'win32' || command.includes('npx') || command.includes('npm');
        
        this.logger.debug('Spawning Claude process', {
          command,
          args: allArgs,
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
        output += data.toString();
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
          reject(new Error(`Manager agent Claude execution failed with code ${code}: ${errorOutput}`));
        } else {
          resolve({ output, exitCode: code || 0 });
        }
      });

      claudeProcess.on('error', (err: Error) => {
        reject(err);
      });

      // Timeout handling
      const timeout = setTimeout(() => {
        claudeProcess.kill('SIGTERM');
        reject(new Error('Manager agent Claude execution timed out'));
      }, this.agentConfig?.timeout || 1800000);

      claudeProcess.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  /**
   * Parse task analysis results from Claude output
   */
  private async parseTaskAnalysis(parsedOutput: ParsedOutput, userRequest: string): Promise<TaskAnalysisResult> {
    const result = parsedOutput.result || '';
    
    // Extract work items using pattern matching and AI parsing
    const workItems = this.extractWorkItems(result, userRequest);
    const strategy = this.extractStrategy(result);
    const riskFactors = this.extractRiskFactors(result);
    const dependencies = this.extractDependencies(result);
    
    const estimatedEffort = workItems.reduce((total, item) => total + item.estimatedEffort, 0);

    return {
      workItems,
      strategy,
      estimatedEffort,
      riskFactors,
      dependencies
    };
  }

  /**
   * Extract work items from analysis result
   */
  private extractWorkItems(result: string, userRequest: string): WorkItem[] {
    const workItems: WorkItem[] = [];
    
    // More robust pattern to extract work items
    const workItemSection = result.match(/##\s*WORK\s*ITEMS[\s\S]*?(?=##|$)/i);
    const workItemText = workItemSection ? workItemSection[0] : result;
    
    // Pattern to match individual work items
    const workItemPattern = /Work\s*Item\s*(\d+)[:\s]*([^\n]+)[\s\S]*?(?=Work\s*Item\s*\d+|##|$)/gi;
    const matches = [...workItemText.matchAll(workItemPattern)];
    
    if (matches && matches.length > 0) {
      matches.forEach((match, index) => {
        const fullItemText = match[0];
        const itemNumber = match[1];
        const title = match[2].trim();
        
        const workItem = this.parseWorkItemFromStructuredText(fullItemText, title, index, userRequest);
        if (workItem) {
          workItems.push(workItem);
        }
      });
    }
    
    // If we didn't find properly formatted work items, try a fallback approach
    if (workItems.length === 0) {
      workItems.push(...this.createFallbackWorkItems(result, userRequest));
    }
    
    // Ensure we always have at least 2 work items for delegation
    if (workItems.length === 1) {
      workItems.push(this.createValidationWorkItem(userRequest));
    }
    
    this.logger.info(`Extracted ${workItems.length} work items from Manager analysis`);
    
    return workItems;
  }

  /**
   * Parse work item from structured text format
   */
  private parseWorkItemFromStructuredText(text: string, title: string, index: number, userRequest: string): WorkItem | null {
    try {
      // Extract description
      const descriptionMatch = text.match(/Description:\s*([^\n]+)/i);
      const description = descriptionMatch ? descriptionMatch[1].trim() : title;
      
      // Extract acceptance criteria
      const criteriaMatch = text.match(/Acceptance\s*Criteria:\s*([^\n]+)/i);
      const acceptanceCriteria = criteriaMatch 
        ? [criteriaMatch[1].trim()]
        : [`Complete: ${title}`];
      
      // Extract priority (default to 3)
      const priorityMatch = text.match(/Priority:\s*(\d+)/i);
      const priority = priorityMatch ? parseInt(priorityMatch[1]) : 3;
      
      // Extract effort estimate (default to 2 hours)
      const effortMatch = text.match(/Effort:\s*(\d+)/i);
      const estimatedEffort = effortMatch ? parseInt(effortMatch[1]) : 2;
      
      // Extract dependencies
      const depMatch = text.match(/Dependencies:\s*([^\n]+)/i);
      const dependencies = depMatch && !depMatch[1].toLowerCase().includes('none')
        ? [depMatch[1].trim()]
        : [];
      
      return {
        id: this.generateWorkItemId(),
        title: title.replace(/\[|\]/g, ''),
        description,
        acceptanceCriteria,
        priority,
        estimatedEffort,
        dependencies,
        status: 'planned' as TaskStatus,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } catch (error) {
      this.logger.error('Failed to parse structured work item', { text, error });
      return null;
    }
  }

  /**
   * Create fallback work items when parsing fails
   */
  private createFallbackWorkItems(result: string, userRequest: string): WorkItem[] {
    const workItems: WorkItem[] = [];
    const now = new Date();
    
    // Always create at least implementation and validation items
    workItems.push({
      id: this.generateWorkItemId(),
      title: 'Implement Core Functionality',
      description: `Implement the main functionality for: ${userRequest.substring(0, 200)}`,
      acceptanceCriteria: [
        'Core functionality implemented',
        'Code follows best practices',
        'Basic error handling in place'
      ],
      priority: 1,
      estimatedEffort: 3,
      dependencies: [],
      status: 'planned' as TaskStatus,
      createdAt: now,
      updatedAt: now
    });
    
    workItems.push({
      id: this.generateWorkItemId(),
      title: 'Testing and Validation',
      description: 'Test the implemented functionality and ensure it meets requirements',
      acceptanceCriteria: [
        'Functionality tested',
        'Edge cases handled',
        'Meets user requirements'
      ],
      priority: 2,
      estimatedEffort: 2,
      dependencies: ['Implementation complete'],
      status: 'planned' as TaskStatus,
      createdAt: now,
      updatedAt: now
    });
    
    // Add a third item if the task seems complex
    if (userRequest.length > 100 || userRequest.toLowerCase().includes('and')) {
      workItems.push({
        id: this.generateWorkItemId(),
        title: 'Documentation and Cleanup',
        description: 'Document the implementation and clean up any technical debt',
        acceptanceCriteria: [
          'Code is documented',
          'Any TODOs addressed',
          'Code is production-ready'
        ],
        priority: 3,
        estimatedEffort: 1,
        dependencies: ['Testing complete'],
        status: 'planned' as TaskStatus,
        createdAt: now,
        updatedAt: now
      });
    }
    
    return workItems;
  }

  /**
   * Create a validation work item
   */
  private createValidationWorkItem(userRequest: string): WorkItem {
    const now = new Date();
    return {
      id: this.generateWorkItemId(),
      title: 'Final Validation and Quality Check',
      description: 'Validate that all requirements have been met and perform quality checks',
      acceptanceCriteria: [
        'All requirements validated',
        'Quality standards met',
        'Ready for production'
      ],
      priority: 2,
      estimatedEffort: 1,
      dependencies: ['Primary implementation complete'],
      status: 'planned' as TaskStatus,
      createdAt: now,
      updatedAt: now
    };
  }

  /**
   * Create default work item when parsing fails
   */
  private createDefaultWorkItem(userRequest: string): WorkItem {
    return {
      id: this.generateWorkItemId(),
      title: 'Implement User Request',
      description: userRequest,
      acceptanceCriteria: [
        'User request is fully implemented',
        'Solution is tested and verified',
        'Code follows best practices'
      ],
      priority: 3,
      estimatedEffort: 4,
      dependencies: [],
      status: 'planned' as TaskStatus,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Extract implementation strategy from analysis
   */
  private extractStrategy(result: string): string {
    const strategyMatch = result.match(/(?:strategy|approach)[:\-]?\s*([\s\S]*?)(?=(?:risk|dependencies|quality)|$)/i);
    return strategyMatch ? strategyMatch[1].trim() : 'Implement requirements incrementally with testing at each stage';
  }

  /**
   * Extract risk factors from analysis
   */
  private extractRiskFactors(result: string): string[] {
    const riskMatch = result.match(/(?:risk|challenge)[:\-]?\s*([\s\S]*?)(?=(?:dependencies|quality|$))/i);
    if (riskMatch) {
      return riskMatch[1].split(/[,\n]/).map(r => r.trim()).filter(r => r.length > 0);
    }
    return ['Technical complexity', 'Integration challenges'];
  }

  /**
   * Extract dependencies from analysis
   */
  private extractDependencies(result: string): string[] {
    const depMatch = result.match(/(?:dependencies|prerequisite)[:\-]?\s*([\s\S]*?)(?=(?:quality|$))/i);
    if (depMatch) {
      return depMatch[1].split(/[,\n]/).map(d => d.trim()).filter(d => d.length > 0);
    }
    return [];
  }

  /**
   * Parse work review results from Claude output
   */
  private async parseWorkReview(parsedOutput: ParsedOutput, workItem: WorkItem): Promise<WorkReviewResult> {
    const result = parsedOutput.result || '';
    
    // Extract approval status
    const approvedMatch = result.match(/approved[:\-]?\s*(yes|no|true|false)/i);
    const approved = approvedMatch ? ['yes', 'true'].includes(approvedMatch[1].toLowerCase()) : false;
    
    // Extract quality score
    const scoreMatch = result.match(/quality[_\s]?score[:\-]?\s*([\d.]+)/i);
    const qualityScore = scoreMatch ? parseFloat(scoreMatch[1]) : undefined;
    
    // Extract feedback
    const feedbackMatch = result.match(/feedback[:\-]?\s*([\s\S]*?)(?=(?:recommendations|required)|$)/i);
    const feedback = feedbackMatch 
      ? feedbackMatch[1].split(/[,\n]/).map(f => f.trim()).filter(f => f.length > 0)
      : [];
    
    // Extract recommendations
    const recommendationsMatch = result.match(/recommendations[:\-]?\s*([\s\S]*?)(?=(?:required|$))/i);
    const recommendations = recommendationsMatch 
      ? recommendationsMatch[1].split(/[,\n]/).map(r => r.trim()).filter(r => r.length > 0)
      : [];
    
    // Extract required changes
    const changesMatch = result.match(/required[_\s]?changes[:\-]?\s*([\s\S]*?)$/i);
    const requiredChanges = changesMatch 
      ? changesMatch[1].split(/[,\n]/).map(c => c.trim()).filter(c => c.length > 0)
      : [];

    return {
      approved,
      qualityScore,
      feedback,
      recommendations,
      requiredChanges
    };
  }

  /**
   * Parse course correction from Claude output
   */
  private parseCourseCorrection(parsedOutput: ParsedOutput): string[] {
    const result = parsedOutput.result || '';
    
    // Extract corrections using various patterns
    const corrections: string[] = [];
    
    // Look for numbered lists
    const numberedMatches = result.match(/\d+\.\s*([^\n]+)/g);
    if (numberedMatches) {
      corrections.push(...numberedMatches.map(m => m.replace(/^\d+\.\s*/, '')));
    }
    
    // Look for bullet points
    const bulletMatches = result.match(/[*\-]\s*([^\n]+)/g);
    if (bulletMatches) {
      corrections.push(...bulletMatches.map(m => m.replace(/^[*\-]\s*/, '')));
    }
    
    // If no structured format found, split by sentences
    if (corrections.length === 0) {
      const sentences = result.split(/[.!?]\s+/).filter(s => s.trim().length > 20);
      corrections.push(...sentences.slice(0, 5)); // Take up to 5 key sentences
    }
    
    return corrections.filter(c => c.length > 0).slice(0, 10); // Limit to 10 corrections
  }

  /**
   * Parse progress monitoring from Claude output
   */
  private parseProgressMonitoring(parsedOutput: ParsedOutput): {
    overallHealth: 'good' | 'warning' | 'critical';
    recommendations: string[];
    blockers: string[];
    nextPriorities: string[];
  } {
    const result = parsedOutput.result || '';
    
    // Extract health status
    const healthMatch = result.match(/(?:health|status)[:\-]?\s*(good|warning|critical)/i);
    const overallHealth = healthMatch ? healthMatch[1].toLowerCase() as 'good' | 'warning' | 'critical' : 'good';
    
    // Extract recommendations
    const recommendations = this.extractListFromText(result, 'recommendations?');
    
    // Extract blockers
    const blockers = this.extractListFromText(result, 'blockers?');
    
    // Extract next priorities
    const nextPriorities = this.extractListFromText(result, '(?:next[_\s]?)?priorities');
    
    return {
      overallHealth,
      recommendations,
      blockers,
      nextPriorities
    };
  }

  /**
   * Extract list items from text using pattern matching
   */
  private extractListFromText(text: string, sectionPattern: string): string[] {
    const pattern = new RegExp(`${sectionPattern}[:\-]?\\s*([\\s\\S]*?)(?=(?:[A-Z][a-z]+[:\-]|$))`, 'i');
    const match = text.match(pattern);
    
    if (match) {
      const section = match[1];
      
      // Try numbered lists first
      const numberedItems = section.match(/\d+\.\s*([^\n]+)/g);
      if (numberedItems) {
        return numberedItems.map(item => item.replace(/^\d+\.\s*/, '').trim());
      }
      
      // Try bullet points
      const bulletItems = section.match(/[*\-]\s*([^\n]+)/g);
      if (bulletItems) {
        return bulletItems.map(item => item.replace(/^[*\-]\s*/, '').trim());
      }
      
      // Try comma-separated
      const commaSeparated = section.split(',').map(item => item.trim()).filter(item => item.length > 0);
      if (commaSeparated.length > 1) {
        return commaSeparated;
      }
    }
    
    return [];
  }

  /**
   * Utility methods
   */
  private generateWorkItemId(): string {
    return `wi-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Manager agent not initialized');
    }
  }

  /**
   * Shutdown the Manager Agent
   */
  async shutdown(): Promise<void> {
    this.isInitialized = false;
    this.activeWorkItems.clear();
    this.messageHistory = [];
    
    // Close PTY session if exists
    if (this.ptySessionId && this.claudeExecutor) {
      this.claudeExecutor.closePTYSession(this.ptySessionId);
      this.ptySessionId = undefined;
    }
    
    this.logger.info('Manager agent shutdown completed', {
      ptySessionClosed: this.ptySessionId === undefined
    });
    this.emit('agent_shutdown', { role: 'manager' });
  }

  /**
   * Public API methods for external monitoring
   */
  public getActiveWorkItems(): WorkItem[] {
    return Array.from(this.activeWorkItems.values());
  }

  public getMessageHistory(): AgentMessage[] {
    return [...this.messageHistory];
  }

  public getQualityStandards(): Map<string, number> {
    return new Map(this.qualityStandards);
  }

  public setQualityStandard(category: string, threshold: number): void {
    this.qualityStandards.set(category, Math.max(0, Math.min(1, threshold)));
    this.logger.info('Quality standard updated', { category, threshold });
  }
}