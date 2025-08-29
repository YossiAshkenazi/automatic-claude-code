import * as fs from 'fs/promises';
import * as path from 'path';
import { ParsedOutput } from './outputParser';

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

export class SessionManager {
  private sessionsDir: string;
  private currentSession?: Session;
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
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 7);
    return `session-${timestamp}-${random}`;
  }
}