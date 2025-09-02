import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { ParsedOutput } from '../outputParser';
import { Logger } from '../logger';
import { EventEmitter } from 'events';

/**
 * Session iteration data structure - maintains compatibility with existing format
 */
interface SessionIteration {
  iteration: number;
  prompt: string;
  output: ParsedOutput;
  exitCode: number;
  duration: number;
  timestamp: Date;
  // SDK-specific fields
  executionMode?: 'cli' | 'sdk' | 'browser-auth';
  sdkSessionId?: string;
  authMethod?: 'api-key' | 'browser' | 'oauth';
}

/**
 * Session data structure - maintains compatibility with existing format
 */
interface Session {
  id: string;
  startTime: Date;
  endTime?: Date;
  initialPrompt: string;
  workDir: string;
  iterations: SessionIteration[];
  status: 'running' | 'completed' | 'failed';
  // SDK-specific fields
  executionMode?: 'cli' | 'sdk' | 'browser-auth';
  authenticationState?: 'authenticated' | 'pending' | 'failed';
  continueToken?: string;
  browserAuthRequired?: boolean;
}

/**
 * Session summary data structure - maintains compatibility
 */
interface SessionSummary {
  totalIterations: number;
  totalDuration: number;
  successRate: number;
  totalCost?: number;
  filesModified: string[];
  commandsExecuted: string[];
}

/**
 * Progress reporter interface for autopilot iterations
 */
interface ProgressReporter {
  updateProgress(iteration: number, maxIterations: number, message: string): void;
  reportTaskCompletion(summary: SessionSummary): void;
  reportError(error: string): void;
}

/**
 * Console-based progress reporter for autopilot iterations
 */
class ConsoleProgressReporter implements ProgressReporter {
  private logger: Logger;
  private startTime: Date;
  private lastUpdate: Date;

  constructor(logger: Logger) {
    this.logger = logger;
    this.startTime = new Date();
    this.lastUpdate = new Date();
  }

  updateProgress(iteration: number, maxIterations: number, message: string): void {
    const now = new Date();
    const elapsed = Math.round((now.getTime() - this.startTime.getTime()) / 1000);
    const iterationTime = Math.round((now.getTime() - this.lastUpdate.getTime()) / 1000);
    
    // Progress bar visualization
    const progressPercent = Math.round((iteration / maxIterations) * 100);
    const barLength = 30;
    const filledLength = Math.round((progressPercent / 100) * barLength);
    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
    
    // Status line with timing info
    const status = `[${iteration}/${maxIterations}] |${bar}| ${progressPercent}% (${elapsed}s total, +${iterationTime}s)`;
    
    // Use logger's progress method for consistent formatting
    this.logger.progress(status);
    this.logger.info(`Autopilot: ${message}`);
    
    this.lastUpdate = now;
  }

  reportTaskCompletion(summary: SessionSummary): void {
    const totalTime = Math.round((Date.now() - this.startTime.getTime()) / 1000);
    
    this.logger.success(`Task completed in ${totalTime}s`);
    this.logger.info(`Summary: ${summary.totalIterations} iterations, ${summary.successRate}% success rate`);
    
    if (summary.filesModified.length > 0) {
      this.logger.info(`Files modified: ${summary.filesModified.length}`);
      summary.filesModified.slice(0, 5).forEach(file => {
        this.logger.info(`  - ${path.basename(file)}`);
      });
      if (summary.filesModified.length > 5) {
        this.logger.info(`  ... and ${summary.filesModified.length - 5} more`);
      }
    }
    
    if (summary.totalCost && summary.totalCost > 0) {
      this.logger.info(`Estimated cost: $${summary.totalCost.toFixed(4)}`);
    }
  }

  reportError(error: string): void {
    this.logger.error(`Autopilot error: ${error}`);
  }
}

/**
 * Simplified session manager optimized for SDK-only execution
 * Maintains compatibility with existing session format and analysis tools
 */
export class SimplifiedSessionManager extends EventEmitter {
  private sessionsDir: string;
  private currentSession?: Session;
  private sessionFile?: string;
  private logger?: Logger;
  private progressReporter?: ProgressReporter;

  constructor(baseDir: string = '.claude-sessions', logger?: Logger) {
    super();
    this.sessionsDir = path.resolve(baseDir);
    this.logger = logger;
    if (logger) {
      this.progressReporter = new ConsoleProgressReporter(logger);
    }
  }

  /**
   * Create a new session with SDK support
   */
  async createSession(initialPrompt: string, workDir: string, executionMode: 'cli' | 'sdk' | 'browser-auth' = 'sdk'): Promise<string> {
    await this.ensureSessionsDir();
    
    const sessionId = this.generateSessionId();
    this.currentSession = {
      id: sessionId,
      startTime: new Date(),
      initialPrompt,
      workDir,
      iterations: [],
      status: 'running',
      executionMode,
      authenticationState: executionMode === 'browser-auth' ? 'pending' : 'authenticated',
      browserAuthRequired: executionMode === 'browser-auth'
    };
    
    this.sessionFile = path.join(this.sessionsDir, `${sessionId}.json`);
    await this.saveCurrentSession();
    
    // Emit event for hook scripts
    this.emitHookEvent('session_created', {
      sessionId,
      executionMode,
      workDir,
      initialPrompt: initialPrompt.substring(0, 100) + '...'
    });
    
    this.logger?.info(`Created session ${sessionId.slice(0, 8)} (${executionMode} mode)`);
    return sessionId;
  }

  /**
   * Add iteration with SDK support and progress reporting
   */
  async addIteration(iteration: Omit<SessionIteration, 'timestamp'> & { 
    sdkSessionId?: string;
    authMethod?: 'api-key' | 'browser' | 'oauth';
    executionMode?: 'cli' | 'sdk' | 'browser-auth';
  }): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }
    
    const fullIteration: SessionIteration = {
      ...iteration,
      timestamp: new Date(),
      executionMode: iteration.executionMode || this.currentSession.executionMode || 'sdk',
      sdkSessionId: iteration.sdkSessionId,
      authMethod: iteration.authMethod || (this.currentSession.browserAuthRequired ? 'browser' : 'api-key')
    };
    
    this.currentSession.iterations.push(fullIteration);
    
    // Update authentication state based on execution success
    if (iteration.exitCode === 0 && this.currentSession.authenticationState === 'pending') {
      this.currentSession.authenticationState = 'authenticated';
    } else if (iteration.exitCode !== 0 && iteration.output.error?.includes('auth')) {
      this.currentSession.authenticationState = 'failed';
    }
    
    await this.saveCurrentSession();
    
    // Progress reporting for autopilot
    if (this.progressReporter && iteration.iteration > 0) {
      // Estimate max iterations if not provided (default to 10 for autopilot)
      const maxIterations = 10;
      const message = this.createProgressMessage(fullIteration);
      this.progressReporter.updateProgress(iteration.iteration, maxIterations, message);
    }
    
    // Emit event for hook scripts
    this.emitHookEvent('iteration_completed', {
      sessionId: this.currentSession.id,
      iteration: iteration.iteration,
      exitCode: iteration.exitCode,
      duration: iteration.duration,
      executionMode: fullIteration.executionMode,
      hasError: !!iteration.output.error
    });
    
    this.logger?.debug(`Added iteration ${iteration.iteration} (exit code: ${iteration.exitCode})`);
  }

  /**
   * Complete session with enhanced reporting
   */
  async completeSession(status: 'completed' | 'failed' = 'completed'): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }
    
    this.currentSession.endTime = new Date();
    this.currentSession.status = status;
    
    await this.saveCurrentSession();
    
    // Generate summary and report completion
    const summary = await this.getSummary();
    
    if (this.progressReporter) {
      if (status === 'completed') {
        this.progressReporter.reportTaskCompletion(summary);
      } else {
        this.progressReporter.reportError('Session failed or was terminated');
      }
    }
    
    // Emit event for hook scripts
    this.emitHookEvent('session_completed', {
      sessionId: this.currentSession.id,
      status,
      summary,
      duration: summary.totalDuration,
      iterations: summary.totalIterations,
      successRate: summary.successRate
    });
    
    this.logger?.success(`Session completed: ${status} (${summary.totalIterations} iterations, ${summary.successRate}% success)`);
  }

  /**
   * Get session summary - maintains compatibility with existing format
   */
  async getSummary(): Promise<SessionSummary> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }
    
    const iterations = this.currentSession.iterations;
    const successfulIterations = iterations.filter(i => i.exitCode === 0).length;
    
    const allFiles = new Set<string>();
    const allCommands = new Set<string>();
    let totalCost = 0;
    let totalDuration = 0;
    
    for (const iteration of iterations) {
      if (iteration.output.files) {
        iteration.output.files.forEach(f => allFiles.add(f));
      }
      
      if (iteration.output.commands) {
        iteration.output.commands.forEach(c => allCommands.add(c));
      }
      
      if (iteration.output.totalCost) {
        totalCost += iteration.output.totalCost;
      }
      
      totalDuration += iteration.duration;
    }
    
    return {
      totalIterations: iterations.length,
      totalDuration: Math.round(totalDuration),
      successRate: iterations.length > 0 ? Math.round((successfulIterations / iterations.length) * 100) : 0,
      totalCost: totalCost > 0 ? totalCost : undefined,
      filesModified: Array.from(allFiles),
      commandsExecuted: Array.from(allCommands),
    };
  }

  /**
   * Load session - maintains compatibility with existing format
   */
  async loadSession(sessionId: string): Promise<Session> {
    const sessionFile = path.join(this.sessionsDir, `${sessionId}.json`);
    const content = await fs.readFile(sessionFile, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * List sessions - maintains compatibility with existing format
   */
  async listSessions(): Promise<{ id: string; date: Date; status: string; prompt: string }[]> {
    await this.ensureSessionsDir();
    
    const files = await fs.readdir(this.sessionsDir);
    const sessions = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const session = await this.loadSession(file.replace('.json', ''));
          
          // Handle backward compatibility - initialPrompt can be string or object
          let promptText: string;
          if (typeof session.initialPrompt === 'string') {
            promptText = session.initialPrompt;
          } else if (session.initialPrompt && typeof session.initialPrompt === 'object') {
            // Extract task from object format
            promptText = (session.initialPrompt as any).task || 'Unknown task';
          } else {
            promptText = 'Unknown task';
          }
          
          sessions.push({
            id: session.id,
            date: new Date(session.startTime),
            status: session.status,
            prompt: promptText.substring(0, 50) + '...',
          });
        } catch (error) {
          this.logger?.error(`Failed to load session ${file}:`, error instanceof Error ? error.message : String(error));
        }
      }
    }
    
    return sessions.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  /**
   * Show history - maintains compatibility with existing format
   */
  async showHistory(): Promise<void> {
    const sessions = await this.listSessions();
    
    if (sessions.length === 0) {
      console.log('No sessions found.');
      return;
    }
    
    console.log('\nSession History:');
    console.log('================\n');
    
    for (const session of sessions) {
      const status = session.status === 'completed' ? '✅' : 
                    session.status === 'failed' ? '❌' : '🔄';
      
      console.log(`${status} ${session.id}`);
      console.log(`   Date: ${session.date.toLocaleString()}`);
      console.log(`   Task: ${session.prompt}`);
      console.log();
    }
  }

  /**
   * Get session report - maintains compatibility with existing format
   */
  async getSessionReport(sessionId: string): Promise<string> {
    const session = await this.loadSession(sessionId);
    const summary = await this.getSummaryForSession(session);
    
    let report = `# Session Report: ${sessionId}\n\n`;
    report += `**Started:** ${new Date(session.startTime).toLocaleString()}\n`;
    report += `**Status:** ${session.status}\n`;
    report += `**Execution Mode:** ${session.executionMode || 'cli'}\n`;
    report += `**Working Directory:** ${session.workDir}\n`;
    // Handle backward compatibility - initialPrompt can be string or object
    let promptText: string;
    if (typeof session.initialPrompt === 'string') {
      promptText = session.initialPrompt;
    } else if (session.initialPrompt && typeof session.initialPrompt === 'object') {
      // Extract task from object format
      promptText = (session.initialPrompt as any).task || 'Unknown task';
    } else {
      promptText = 'Unknown task';
    }
    report += `**Initial Task:** ${promptText}\n\n`;
    
    report += `## Summary\n`;
    report += `- Total Iterations: ${summary.totalIterations}\n`;
    report += `- Success Rate: ${summary.successRate}%\n`;
    report += `- Total Duration: ${summary.totalDuration}s\n`;
    
    if (summary.totalCost) {
      report += `- Estimated Cost: $${summary.totalCost.toFixed(4)}\n`;
    }
    
    report += `\n## Files Modified\n`;
    if (summary.filesModified.length > 0) {
      summary.filesModified.forEach(file => {
        report += `- ${file}\n`;
      });
    } else {
      report += `No files modified.\n`;
    }
    
    report += `\n## Commands Executed\n`;
    if (summary.commandsExecuted.length > 0) {
      summary.commandsExecuted.forEach(cmd => {
        report += `- \`${cmd}\`\n`;
      });
    } else {
      report += `No commands executed.\n`;
    }
    
    report += `\n## Iteration Details\n`;
    for (const iteration of session.iterations) {
      report += `\n### Iteration ${iteration.iteration}\n`;
      report += `**Prompt:** ${iteration.prompt.substring(0, 100)}...\n`;
      report += `**Duration:** ${iteration.duration}s\n`;
      report += `**Exit Code:** ${iteration.exitCode}\n`;
      report += `**Execution Mode:** ${iteration.executionMode || 'cli'}\n`;
      
      if (iteration.output.error) {
        report += `**Error:** ${iteration.output.error}\n`;
      }
    }
    
    return report;
  }

  /**
   * Set maximum iterations for progress reporting
   */
  setMaxIterations(maxIterations: number): void {
    if (this.logger) {
      this.logger.setMaxIterations(maxIterations);
    }
  }

  /**
   * Update current iteration for progress reporting
   */
  setCurrentIteration(iteration: number): void {
    if (this.logger) {
      this.logger.setIteration(iteration);
    }
  }

  // Private helper methods

  private async saveCurrentSession(): Promise<void> {
    if (!this.currentSession || !this.sessionFile) {
      return;
    }
    
    await fs.writeFile(
      this.sessionFile,
      JSON.stringify(this.currentSession, null, 2),
      'utf-8'
    );
  }

  private async ensureSessionsDir(): Promise<void> {
    try {
      await fs.access(this.sessionsDir);
    } catch {
      await fs.mkdir(this.sessionsDir, { recursive: true });
    }
  }

  private generateSessionId(): string {
    return crypto.randomUUID();
  }

  private async getSummaryForSession(session: Session): Promise<SessionSummary> {
    const iterations = session.iterations;
    const successfulIterations = iterations.filter(i => i.exitCode === 0).length;
    
    const allFiles = new Set<string>();
    const allCommands = new Set<string>();
    let totalCost = 0;
    let totalDuration = 0;
    
    for (const iteration of iterations) {
      if (iteration.output.files) {
        iteration.output.files.forEach(f => allFiles.add(f));
      }
      
      if (iteration.output.commands) {
        iteration.output.commands.forEach(c => allCommands.add(c));
      }
      
      if (iteration.output.totalCost) {
        totalCost += iteration.output.totalCost;
      }
      
      totalDuration += iteration.duration;
    }
    
    return {
      totalIterations: iterations.length,
      totalDuration: Math.round(totalDuration),
      successRate: iterations.length > 0 ? Math.round((successfulIterations / iterations.length) * 100) : 0,
      totalCost: totalCost > 0 ? totalCost : undefined,
      filesModified: Array.from(allFiles),
      commandsExecuted: Array.from(allCommands),
    };
  }

  private createProgressMessage(iteration: SessionIteration): string {
    if (iteration.output.error) {
      return `Error in iteration ${iteration.iteration}: ${iteration.output.error.substring(0, 50)}...`;
    }
    
    if (iteration.output.result) {
      return `Iteration ${iteration.iteration}: ${iteration.output.result.substring(0, 50)}...`;
    }
    
    const fileCount = iteration.output.files?.length || 0;
    const commandCount = iteration.output.commands?.length || 0;
    
    return `Iteration ${iteration.iteration}: ${fileCount} files, ${commandCount} commands`;
  }

  /**
   * Emit events for hook script integration
   * Maintains compatibility with existing hook script format
   */
  private emitHookEvent(eventType: string, data: any): void {
    try {
      // Emit internal event
      this.emit(eventType, data);
      
      // Format for hook scripts - matches existing format from CLAUDE.md and hook scripts
      const hookEvent = {
        eventType,
        timestamp: new Date().toISOString(),
        sessionId: data.sessionId,
        projectPath: this.currentSession?.workDir,
        payload: data
      };
      
      // Emit specific events that hook scripts expect
      this.emitSpecificHookEvents(eventType, data);
      
      // The hook scripts will be triggered by the Claude CLI framework
      // This event emission ensures our simplified manager maintains compatibility
      this.logger?.debug(`Hook event emitted: ${eventType}`);
      
    } catch (error) {
      // Never let hook events break the session
      this.logger?.debug(`Failed to emit hook event: ${error}`);
    }
  }

  /**
   * Emit specific hook events that match the expected hook script types
   */
  private emitSpecificHookEvents(eventType: string, data: any): void {
    const baseHookData = {
      source_app: this.currentSession ? path.basename(this.currentSession.workDir) : 'unknown-project',
      session_id: data.sessionId,
      timestamp: new Date().toISOString(),
      cwd: this.currentSession?.workDir,
      transcript_path: undefined // Will be set by CLI framework
    };

    switch (eventType) {
      case 'session_created':
        // Emit UserPromptSubmit-like event for session creation
        this.emit('user_prompt_submit', {
          hook_event_type: 'SessionCreated',
          payload: {
            ...baseHookData,
            message: `Session created: ${data.initialPrompt || 'New session'}`,
            executionMode: data.executionMode
          }
        });
        break;

      case 'iteration_completed':
        // Emit PostToolUse-like event for iterations
        this.emit('post_tool_use', {
          hook_event_type: 'IterationCompleted',
          payload: {
            ...baseHookData,
            iteration: data.iteration,
            exitCode: data.exitCode,
            duration: data.duration,
            hasError: data.hasError,
            executionMode: data.executionMode
          }
        });
        break;

      case 'session_completed':
        // Emit Stop-like event for session completion
        this.emit('session_stop', {
          hook_event_type: 'SessionCompleted',
          payload: {
            ...baseHookData,
            status: data.status,
            summary: data.summary,
            duration: data.duration,
            iterations: data.iterations,
            successRate: data.successRate
          }
        });
        break;

      // Dual-agent specific events
      case 'agent_communication':
        this.emit('agent_communication', {
          hook_event_type: 'AgentCommunication',
          payload: {
            ...baseHookData,
            ...data
          }
        });
        break;

      case 'quality_gate_result':
        this.emit('quality_gate', {
          hook_event_type: 'QualityGateResult',
          payload: {
            ...baseHookData,
            ...data
          }
        });
        break;

      case 'workflow_transition':
        this.emit('workflow_transition', {
          hook_event_type: 'WorkflowTransition',
          payload: {
            ...baseHookData,
            ...data
          }
        });
        break;
    }
  }
}

// Export types for external use
export type { Session, SessionIteration, SessionSummary, ProgressReporter };
export { ConsoleProgressReporter };