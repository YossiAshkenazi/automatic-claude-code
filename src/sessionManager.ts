import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { ParsedOutput } from './outputParser';
import { Logger } from './logger';
import { ACCPTYManager } from './services/ptyController';

interface SessionIteration {
  iteration: number;
  prompt: string;
  output: ParsedOutput;
  exitCode: number;
  duration: number;
  timestamp: Date;
}

interface Session {
  id: string;
  startTime: Date;
  endTime?: Date;
  initialPrompt: string;
  workDir: string;
  iterations: SessionIteration[];
  status: 'running' | 'completed' | 'failed';
}

interface SessionSummary {
  totalIterations: number;
  totalDuration: number;
  successRate: number;
  totalCost?: number;
  filesModified: string[];
  commandsExecuted: string[];
}

/**
 * Enhanced session state for concurrent process tracking
 */
interface SessionState {
  sessionId: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  processInfo: {
    pid?: number;
    hasActiveController: boolean;
    lastActivity?: Date;
    error?: string;
  };
  paths: {
    workDir: string;
    sessionFile: string;
    logDir: string;
  };
  metadata: {
    createdAt: Date;
    lastAccessed: Date;
    resumeCount: number;
  };
}

/**
 * Custom error for session limit violations
 */
export class SessionLimitError extends Error {
  constructor(limit: number, current: number) {
    super(`Session limit exceeded: ${current}/${limit} concurrent sessions`);
    this.name = 'SessionLimitError';
  }
}

/**
 * Path encoding utilities for safe file system operations
 */
class SessionPathEncoder {
  /**
   * Encode a path to be filesystem-safe
   */
  static encodePath(input: string): string {
    return Buffer.from(input, 'utf-8')
      .toString('base64')
      .replace(/[+/=]/g, (char) => {
        switch (char) {
          case '+': return '-';
          case '/': return '_';
          case '=': return '';
          default: return char;
        }
      });
  }

  /**
   * Decode a filesystem-safe path back to original
   */
  static decodePath(encoded: string): string {
    const base64 = encoded
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(encoded.length + (4 - encoded.length % 4) % 4, '=');
    
    return Buffer.from(base64, 'base64').toString('utf-8');
  }

  /**
   * Create a safe session directory structure
   */
  static createSessionPaths(sessionId: string, workDir: string, baseDir: string): SessionState['paths'] {
    const encodedWorkDir = this.encodePath(workDir);
    const sessionFile = path.join(baseDir, `${sessionId}.json`);
    const logDir = path.join(baseDir, 'logs', sessionId);
    
    return {
      workDir,
      sessionFile,
      logDir
    };
  }
}

export class SessionManager {
  protected sessionsDir: string;
  protected currentSession?: Session;
  private sessionFile?: string;

  constructor(baseDir: string = '.claude-sessions') {
    this.sessionsDir = path.resolve(baseDir);
  }

  async createSession(initialPrompt: string, workDir: string): Promise<string> {
    await this.ensureSessionsDir();
    
    const sessionId = this.generateSessionId();
    this.currentSession = {
      id: sessionId,
      startTime: new Date(),
      initialPrompt,
      workDir,
      iterations: [],
      status: 'running',
    };
    
    this.sessionFile = path.join(this.sessionsDir, `${sessionId}.json`);
    await this.saveCurrentSession();
    
    return sessionId;
  }

  async addIteration(iteration: Omit<SessionIteration, 'timestamp'>): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }
    
    this.currentSession.iterations.push({
      ...iteration,
      timestamp: new Date(),
    });
    
    await this.saveCurrentSession();
  }

  async completeSession(status: 'completed' | 'failed' = 'completed'): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }
    
    this.currentSession.endTime = new Date();
    this.currentSession.status = status;
    
    await this.saveCurrentSession();
  }

  async saveSession(): Promise<void> {
    await this.completeSession();
  }

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
      successRate: Math.round((successfulIterations / iterations.length) * 100),
      totalCost: totalCost > 0 ? totalCost : undefined,
      filesModified: Array.from(allFiles),
      commandsExecuted: Array.from(allCommands),
    };
  }

  async loadSession(sessionId: string): Promise<Session> {
    const sessionFile = path.join(this.sessionsDir, `${sessionId}.json`);
    const content = await fs.readFile(sessionFile, 'utf-8');
    return JSON.parse(content);
  }

  async listSessions(): Promise<{ id: string; date: Date; status: string; prompt: string }[]> {
    await this.ensureSessionsDir();
    
    const files = await fs.readdir(this.sessionsDir);
    const sessions = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const session = await this.loadSession(file.replace('.json', ''));
          sessions.push({
            id: session.id,
            date: new Date(session.startTime),
            status: session.status,
            prompt: session.initialPrompt.substring(0, 50) + '...',
          });
        } catch (error) {
          console.error(`Failed to load session ${file}:`, error);
        }
      }
    }
    
    return sessions.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

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

  async getSessionReport(sessionId: string): Promise<string> {
    const session = await this.loadSession(sessionId);
    const summary = await this.getSummaryForSession(session);
    
    let report = `# Session Report: ${sessionId}\n\n`;
    report += `**Started:** ${new Date(session.startTime).toLocaleString()}\n`;
    report += `**Status:** ${session.status}\n`;
    report += `**Working Directory:** ${session.workDir}\n`;
    report += `**Initial Task:** ${session.initialPrompt}\n\n`;
    
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
      
      if (iteration.output.error) {
        report += `**Error:** ${iteration.output.error}\n`;
      }
    }
    
    return report;
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
      successRate: Math.round((successfulIterations / iterations.length) * 100),
      totalCost: totalCost > 0 ? totalCost : undefined,
      filesModified: Array.from(allFiles),
      commandsExecuted: Array.from(allCommands),
    };
  }

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
    // Generate a proper UUID v4 format that Claude CLI expects
    return crypto.randomUUID();
  }
}

/**
 * Enhanced session manager with PTY integration and state tracking
 */
export class EnhancedSessionManager extends SessionManager {
  private logger: Logger;
  private ptyManager: ACCPTYManager;
  private sessionStates: Map<string, SessionState> = new Map();
  private maxConcurrentSessions: number = 28;
  private cleanupInterval?: NodeJS.Timeout;
  private isShuttingDown: boolean = false;

  constructor(
    baseDir: string = '.claude-sessions',
    logger?: Logger,
    ptyManager?: ACCPTYManager
  ) {
    super(baseDir);
    this.logger = logger || new Logger();
    this.ptyManager = ptyManager || new ACCPTYManager(this.logger);
    
    // Start automatic cleanup every hour
    this.cleanupInterval = setInterval(() => {
      this.performAutomaticCleanup().catch(err => 
        this.logger.error('Automatic cleanup failed:', err)
      );
    }, 60 * 60 * 1000);

    // Handle graceful shutdown
    process.on('SIGINT', () => this.cleanup());
    process.on('SIGTERM', () => this.cleanup());
  }

  /**
   * Create a new session with enhanced state tracking
   */
  async createSession(initialPrompt: string, workDir: string): Promise<string> {
    // Check concurrent session limit
    const runningSessions = Array.from(this.sessionStates.values())
      .filter(state => state.status === 'running').length;
    
    if (runningSessions >= this.maxConcurrentSessions) {
      throw new SessionLimitError(this.maxConcurrentSessions, runningSessions);
    }

    // Create base session
    const sessionId = await super.createSession(initialPrompt, workDir);
    
    // Create enhanced state tracking
    const paths = SessionPathEncoder.createSessionPaths(sessionId, workDir, this.sessionsDir);
    const sessionState: SessionState = {
      sessionId,
      status: 'running',
      processInfo: {
        hasActiveController: false,
        lastActivity: new Date()
      },
      paths,
      metadata: {
        createdAt: new Date(),
        lastAccessed: new Date(),
        resumeCount: 0
      }
    };
    
    this.sessionStates.set(sessionId, sessionState);
    
    // Create log directory
    await fs.mkdir(paths.logDir, { recursive: true });
    
    // Initialize PTY controller (optional, may fail gracefully)
    try {
      await this.ptyManager.createSession(workDir, sessionId);
      sessionState.processInfo.hasActiveController = true;
      sessionState.processInfo.pid = process.pid; // Approximate
    } catch (error) {
      this.logger.debug(`Failed to create PTY session ${sessionId}: ${error}`);
      sessionState.processInfo.error = error instanceof Error ? error.message : String(error);
    }
    
    this.logger.info(`Created session ${sessionId} for ${workDir}`);
    return sessionId;
  }

  /**
   * Resume an existing session with additional context
   */
  async resumeSession(sessionId: string, additionalPrompt?: string): Promise<string> {
    try {
      const session = await this.loadSession(sessionId);
      
      // Update session state
      const state = this.sessionStates.get(sessionId);
      if (state) {
        state.status = 'running';
        state.metadata.lastAccessed = new Date();
        state.metadata.resumeCount++;
        state.processInfo.lastActivity = new Date();
        
        // Clear end time
        if (session.endTime) {
          delete session.endTime;
        }
        session.status = 'running';
        
        // Add resume context if provided
        if (additionalPrompt) {
          await this.addIteration({
            iteration: session.iterations.length + 1,
            prompt: `[RESUME] ${additionalPrompt}`,
            output: { result: 'Session resumed', files: [], commands: [], totalCost: 0 },
            exitCode: 0,
            duration: 0
          });
        }
        
        // Reinitialize PTY if needed
        if (!state.processInfo.hasActiveController) {
          try {
            await this.ptyManager.createSession(session.workDir, sessionId);
            state.processInfo.hasActiveController = true;
            delete state.processInfo.error;
          } catch (error) {
            state.processInfo.error = error instanceof Error ? error.message : String(error);
          }
        }
      }
      
      this.logger.info(`Resumed session ${sessionId}`);
      return sessionId;
    } catch (error) {
      throw new Error(`Session ${sessionId} not found or could not be resumed`);
    }
  }

  /**
   * Complete a session with enhanced cleanup
   */
  async completeSession(status: 'completed' | 'failed' = 'completed'): Promise<void> {
    await super.completeSession(status);
    
    if (this.currentSession) {
      const sessionId = this.currentSession.id;
      const state = this.sessionStates.get(sessionId);
      
      if (state) {
        state.status = status;
        state.processInfo.lastActivity = new Date();
        
        // Close PTY controller
        this.ptyManager.closeSession(sessionId);
        state.processInfo.hasActiveController = false;
      }
      
      this.logger.info(`Completed session ${sessionId} with status: ${status}`);
    }
  }

  /**
   * Get current state of a session
   */
  getSessionState(sessionId: string): SessionState | undefined {
    const state = this.sessionStates.get(sessionId);
    if (state) {
      // Update controller status
      const controller = this.ptyManager.getController(sessionId);
      state.processInfo.hasActiveController = !!controller;
    }
    return state;
  }

  /**
   * List all active sessions with state information
   */
  async listActiveSessions(): Promise<(SessionState & { session?: Session })[]> {
    const results: (SessionState & { session?: Session })[] = [];
    
    for (const [sessionId, state] of this.sessionStates) {
      if (state.status === 'running') {
        try {
          const session = await this.loadSession(sessionId);
          results.push({ ...state, session });
        } catch (error) {
          // Session file may have been deleted, clean up state
          this.sessionStates.delete(sessionId);
        }
      }
    }
    
    return results.sort((a, b) => b.metadata.lastAccessed.getTime() - a.metadata.lastAccessed.getTime());
  }

  /**
   * Set maximum concurrent sessions limit
   */
  setMaxConcurrentSessions(limit: number): void {
    this.maxConcurrentSessions = Math.max(1, limit);
    this.logger.debug(`Set max concurrent sessions to ${limit}`);
  }

  /**
   * Clean up old completed sessions
   */
  async cleanupOldSessions(maxAgeHours: number = 24): Promise<string[]> {
    const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
    const cleanedSessions: string[] = [];
    
    try {
      const allSessions = await this.listSessions();
      
      for (const sessionInfo of allSessions) {
        if (sessionInfo.status !== 'running') {
          try {
            const session = await this.loadSession(sessionInfo.id);
            const endTime = session.endTime ? new Date(session.endTime).getTime() : Date.now();
            
            if (endTime < cutoffTime) {
              // Remove session file
              const sessionFile = path.join(this.sessionsDir, `${sessionInfo.id}.json`);
              await fs.unlink(sessionFile);
              
              // Clean up logs
              const logDir = path.join(this.sessionsDir, 'logs', sessionInfo.id);
              try {
                await fs.rm(logDir, { recursive: true, force: true });
              } catch (error) {
                // Log directory may not exist
              }
              
              // Remove from state tracking
              this.sessionStates.delete(sessionInfo.id);
              
              cleanedSessions.push(sessionInfo.id);
              this.logger.debug(`Cleaned up old session: ${sessionInfo.id}`);
            }
          } catch (error) {
            this.logger.error(`Failed to cleanup session ${sessionInfo.id}: ${String(error)}`);
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to list sessions for cleanup:', String(error));
    }
    
    this.logger.info(`Cleaned up ${cleanedSessions.length} old sessions`);
    return cleanedSessions;
  }

  /**
   * Clean up orphaned PTY processes
   */
  async cleanupOrphanedProcesses(): Promise<void> {
    const activeControllers = new Set(
      Array.from(this.sessionStates.keys())
        .filter(id => this.sessionStates.get(id)?.status === 'running')
    );
    
    // Get all PTY controllers
    const allControllers = (this.ptyManager as any).controllers as Map<string, any>;
    
    for (const [controllerId, controller] of allControllers) {
      if (!activeControllers.has(controllerId)) {
        this.logger.info(`Cleaning up orphaned PTY process: ${controllerId}`);
        try {
          controller.close();
          allControllers.delete(controllerId);
        } catch (error) {
          this.logger.error(`Failed to close orphaned controller ${controllerId}: ${String(error)}`);
        }
      }
    }
  }

  /**
   * Perform automatic cleanup of old sessions and orphaned processes
   */
  private async performAutomaticCleanup(): Promise<void> {
    if (this.isShuttingDown) return;
    
    this.logger.debug('Running automatic cleanup...');
    
    try {
      // Clean up old sessions (older than 24 hours)
      await this.cleanupOldSessions(24);
      
      // Clean up orphaned processes
      await this.cleanupOrphanedProcesses();
      
      // Update session states for inactive sessions
      const now = Date.now();
      const inactivityThreshold = 30 * 60 * 1000; // 30 minutes
      
      for (const [sessionId, state] of this.sessionStates) {
        if (state.processInfo.lastActivity) {
          const timeSinceActivity = now - state.processInfo.lastActivity.getTime();
          
          if (timeSinceActivity > inactivityThreshold && state.status === 'running') {
            // Mark as potentially stale
            this.logger.debug(`Session ${sessionId} inactive for ${Math.round(timeSinceActivity / 60000)} minutes`);
            
            // Check if PTY controller is still responsive
            const controller = this.ptyManager.getController(sessionId);
            if (!controller) {
              state.processInfo.hasActiveController = false;
              state.processInfo.error = 'Controller lost';
            }
          }
        }
      }
    } catch (error) {
      this.logger.error('Automatic cleanup failed:', String(error));
    }
  }

  /**
   * Graceful shutdown with cleanup
   */
  async cleanup(): Promise<void> {
    if (this.isShuttingDown) return;
    
    this.isShuttingDown = true;
    this.logger.info('Shutting down session manager...');
    
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Complete any active session
    try {
      if (this.currentSession && this.currentSession.status === 'running') {
        await this.completeSession('completed');
      }
    } catch (error) {
      this.logger.error('Failed to complete session during shutdown:', String(error));
    }
    
    // Close all PTY controllers
    this.ptyManager.closeAllSessions();
    
    // Final cleanup
    await this.cleanupOrphanedProcesses();
    
    this.logger.info('Session manager shutdown complete');
  }

  /**
   * Get statistics about current session usage
   */
  getSessionStatistics(): {
    total: number;
    running: number;
    completed: number;
    failed: number;
    maxConcurrent: number;
  } {
    const states = Array.from(this.sessionStates.values());
    
    return {
      total: states.length,
      running: states.filter(s => s.status === 'running').length,
      completed: states.filter(s => s.status === 'completed').length,
      failed: states.filter(s => s.status === 'failed').length,
      maxConcurrent: this.maxConcurrentSessions
    };
  }

  /**
   * Force kill a session and its associated processes
   */
  async forceKillSession(sessionId: string): Promise<void> {
    const state = this.sessionStates.get(sessionId);
    if (!state) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    // Close PTY controller forcefully
    this.ptyManager.closeSession(sessionId);
    
    // Update state
    state.status = 'failed';
    state.processInfo.hasActiveController = false;
    state.processInfo.error = 'Force killed';
    
    // Complete session
    try {
      const session = await this.loadSession(sessionId);
      session.status = 'failed';
      session.endTime = new Date();
      
      const sessionFile = path.join(this.sessionsDir, `${sessionId}.json`);
      await fs.writeFile(sessionFile, JSON.stringify(session, null, 2));
    } catch (error) {
      this.logger.error(`Failed to update session ${sessionId} after force kill: ${String(error)}`);
    }
    
    this.logger.info(`Force killed session ${sessionId}`);
  }

  /**
   * Export session data for backup or migration
   */
  async exportSession(sessionId: string): Promise<{
    session: Session;
    state: SessionState;
    logs?: string[];
  }> {
    const session = await this.loadSession(sessionId);
    const state = this.getSessionState(sessionId);
    
    if (!state) {
      throw new Error(`Session state not found for ${sessionId}`);
    }
    
    // Try to read log files
    let logs: string[] = [];
    try {
      const logFiles = await fs.readdir(state.paths.logDir);
      logs = await Promise.all(
        logFiles.map(async file => {
          const content = await fs.readFile(path.join(state.paths.logDir, file), 'utf-8');
          return `=== ${file} ===\n${content}`;
        })
      );
    } catch (error) {
      // Logs may not exist
    }
    
    return { session, state, logs };
  }
}

// Export types for external use
export { SessionState };