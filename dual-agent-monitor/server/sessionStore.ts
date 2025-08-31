import { DualAgentSession, AgentMessage, SystemEvent, SessionSummary } from './types';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export class SessionStore {
  private sessions = new Map<string, DualAgentSession>();
  private sessionsDir: string;

  constructor(baseDir: string = '.dual-agent-sessions') {
    this.sessionsDir = path.resolve(baseDir);
    this.ensureSessionsDir();
    this.loadExistingSessions();
  }

  async createSession(initialTask: string, workDir: string): Promise<DualAgentSession> {
    const session: DualAgentSession = {
      id: uuidv4(),
      startTime: new Date(),
      status: 'running',
      initialTask,
      workDir,
      messages: [],
    };

    this.sessions.set(session.id, session);
    await this.saveSession(session);
    
    return session;
  }

  async addMessage(sessionId: string, message: Omit<AgentMessage, 'id' | 'sessionId' | 'timestamp'>): Promise<AgentMessage> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const fullMessage: AgentMessage = {
      ...message,
      id: uuidv4(),
      sessionId,
      timestamp: new Date(),
    };

    session.messages.push(fullMessage);
    await this.saveSession(session);
    
    return fullMessage;
  }

  async updateSessionStatus(sessionId: string, status: DualAgentSession['status']): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.status = status;
    if (status === 'completed' || status === 'failed') {
      session.endTime = new Date();
      session.summary = await this.generateSummary(session);
    }

    await this.saveSession(session);
  }

  getSession(sessionId: string): DualAgentSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): DualAgentSession[] {
    return Array.from(this.sessions.values()).sort(
      (a, b) => b.startTime.getTime() - a.startTime.getTime()
    );
  }

  getActiveSessions(): DualAgentSession[] {
    return this.getAllSessions().filter(s => s.status === 'running' || s.status === 'paused');
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    this.sessions.delete(sessionId);
    
    try {
      const sessionFile = path.join(this.sessionsDir, `${sessionId}.json`);
      await fs.unlink(sessionFile);
    } catch (error) {
      console.error(`Error deleting session file for ${sessionId}:`, error);
    }

    return true;
  }

  private async generateSummary(session: DualAgentSession): Promise<SessionSummary> {
    const messages = session.messages;
    const managerMessages = messages.filter(m => m.agentType === 'manager').length;
    const workerMessages = messages.filter(m => m.agentType === 'worker').length;
    
    const filesModified = new Set<string>();
    const commandsExecuted = new Set<string>();
    const toolsUsed = new Set<string>();
    let totalCost = 0;
    let totalDuration = 0;
    let successCount = 0;

    for (const message of messages) {
      if (message.metadata) {
        if (message.metadata.files) {
          message.metadata.files.forEach(f => filesModified.add(f));
        }
        if (message.metadata.commands) {
          message.metadata.commands.forEach(c => commandsExecuted.add(c));
        }
        if (message.metadata.tools) {
          message.metadata.tools.forEach(t => toolsUsed.add(t));
        }
        if (message.metadata.cost) {
          totalCost += message.metadata.cost;
        }
        if (message.metadata.duration) {
          totalDuration += message.metadata.duration;
        }
        if (message.metadata.exitCode === 0) {
          successCount++;
        }
      }
    }

    const duration = session.endTime 
      ? (session.endTime.getTime() - session.startTime.getTime()) / 1000 
      : totalDuration;

    return {
      totalMessages: messages.length,
      managerMessages,
      workerMessages,
      totalDuration: Math.round(duration),
      totalCost: totalCost > 0 ? totalCost : undefined,
      filesModified: Array.from(filesModified),
      commandsExecuted: Array.from(commandsExecuted),
      toolsUsed: Array.from(toolsUsed),
      successRate: messages.length > 0 ? Math.round((successCount / messages.length) * 100) : 0,
    };
  }

  private async saveSession(session: DualAgentSession): Promise<void> {
    try {
      const sessionFile = path.join(this.sessionsDir, `${session.id}.json`);
      await fs.writeFile(sessionFile, JSON.stringify(session, null, 2), 'utf-8');
    } catch (error) {
      console.error(`Error saving session ${session.id}:`, error);
    }
  }

  private async ensureSessionsDir(): Promise<void> {
    try {
      await fs.access(this.sessionsDir);
    } catch {
      await fs.mkdir(this.sessionsDir, { recursive: true });
    }
  }

  private async loadExistingSessions(): Promise<void> {
    try {
      const files = await fs.readdir(this.sessionsDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const content = await fs.readFile(path.join(this.sessionsDir, file), 'utf-8');
            const session: DualAgentSession = JSON.parse(content);
            
            // Convert date strings back to Date objects
            session.startTime = new Date(session.startTime);
            if (session.endTime) {
              session.endTime = new Date(session.endTime);
            }
            
            session.messages.forEach(msg => {
              msg.timestamp = new Date(msg.timestamp);
            });
            
            this.sessions.set(session.id, session);
          } catch (error) {
            console.error(`Error loading session file ${file}:`, error);
          }
        }
      }
      
      console.log(`Loaded ${this.sessions.size} existing sessions`);
    } catch (error) {
      console.error('Error loading existing sessions:', error);
    }
  }
}