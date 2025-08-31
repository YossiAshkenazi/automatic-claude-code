import { v4 as uuidv4 } from 'uuid';
import {
  AgentMessage,
  DualAgentSession,
  SessionSummary,
  AgentCommunication,
  SystemEvent,
  PerformanceMetrics
} from '../types';

export class InMemoryDatabaseService {
  private sessions: Map<string, DualAgentSession> = new Map();
  private messages: Map<string, AgentMessage[]> = new Map();
  private communications: Map<string, AgentCommunication[]> = new Map();
  private events: Map<string, SystemEvent[]> = new Map();
  private metrics: Map<string, PerformanceMetrics[]> = new Map();
  private summaries: Map<string, SessionSummary> = new Map();

  constructor() {
    console.log('Initializing in-memory database service');
  }

  // Session management
  public async createSession(session: Omit<DualAgentSession, 'id' | 'messages'>): Promise<string> {
    const id = uuidv4();
    
    const newSession: DualAgentSession = {
      id,
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status,
      initialTask: session.initialTask,
      workDir: session.workDir,
      messages: []
    };
    
    this.sessions.set(id, newSession);
    this.messages.set(id, []);
    this.communications.set(id, []);
    this.events.set(id, []);
    this.metrics.set(id, []);
    
    // Create initial system event
    await this.addSystemEvent({
      id: uuidv4(),
      sessionId: id,
      eventType: 'session_start',
      details: `Session started with task: ${session.initialTask}`,
      timestamp: new Date()
    });

    return id;
  }

  public async getSession(sessionId: string): Promise<DualAgentSession | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const messages = await this.getSessionMessages(sessionId);
    const summary = await this.getSessionSummary(sessionId);

    return {
      ...session,
      messages,
      summary
    };
  }

  public async getAllSessions(): Promise<DualAgentSession[]> {
    const sessions = Array.from(this.sessions.values());
    
    const fullSessions = await Promise.all(sessions.map(async (session) => {
      const messages = await this.getSessionMessages(session.id);
      const summary = await this.getSessionSummary(session.id);
      
      return {
        ...session,
        messages,
        summary
      };
    }));

    return fullSessions.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  public async updateSessionStatus(sessionId: string, status: DualAgentSession['status'], endTime?: Date): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.status = status;
    if (endTime) {
      session.endTime = endTime;
    }

    this.sessions.set(sessionId, session);

    // Add system event for status change
    let eventType: SystemEvent['eventType'];
    switch (status) {
      case 'completed':
      case 'failed':
        eventType = 'session_end';
        break;
      case 'paused':
        eventType = 'pause';
        break;
      case 'running':
        eventType = 'resume';
        break;
      default:
        eventType = 'session_end';
    }

    await this.addSystemEvent({
      id: uuidv4(),
      sessionId,
      eventType,
      details: `Session status changed to: ${status}`,
      timestamp: new Date()
    });
  }

  // Message management
  public async addMessage(message: AgentMessage): Promise<void> {
    const sessionMessages = this.messages.get(message.sessionId) || [];
    sessionMessages.push(message);
    this.messages.set(message.sessionId, sessionMessages);

    // Update session summary
    await this.updateSessionSummary(message.sessionId);
  }

  public async getSessionMessages(sessionId: string): Promise<AgentMessage[]> {
    return this.messages.get(sessionId) || [];
  }

  public async getLatestMessages(limit: number = 50): Promise<AgentMessage[]> {
    const allMessages: AgentMessage[] = [];
    
    for (const messages of this.messages.values()) {
      allMessages.push(...messages);
    }
    
    return allMessages
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  // Agent communication management
  public async addAgentCommunication(communication: AgentCommunication): Promise<void> {
    const sessionCommunications = this.communications.get(communication.sessionId) || [];
    sessionCommunications.push(communication);
    this.communications.set(communication.sessionId, sessionCommunications);
  }

  public async getSessionCommunications(sessionId: string): Promise<AgentCommunication[]> {
    return this.communications.get(sessionId) || [];
  }

  // System event management
  public async addSystemEvent(event: SystemEvent): Promise<void> {
    const sessionEvents = this.events.get(event.sessionId) || [];
    sessionEvents.push(event);
    this.events.set(event.sessionId, sessionEvents);
  }

  public async getSessionEvents(sessionId: string): Promise<SystemEvent[]> {
    return this.events.get(sessionId) || [];
  }

  // Performance metrics management
  public async addPerformanceMetric(metric: PerformanceMetrics & { id?: string }): Promise<void> {
    const sessionMetrics = this.metrics.get(metric.sessionId) || [];
    sessionMetrics.push(metric);
    this.metrics.set(metric.sessionId, sessionMetrics);
  }

  public async getSessionMetrics(sessionId: string): Promise<PerformanceMetrics[]> {
    return this.metrics.get(sessionId) || [];
  }

  // Session summary management
  private async updateSessionSummary(sessionId: string): Promise<void> {
    try {
      const messages = await this.getSessionMessages(sessionId);
      const managerMessages = messages.filter(m => m.agentType === 'manager').length;
      const workerMessages = messages.filter(m => m.agentType === 'worker').length;
      
      // Calculate total duration
      const durations = messages
        .map(m => m.metadata?.duration || 0)
        .filter(d => d > 0);
      const totalDuration = durations.reduce((sum, duration) => sum + duration, 0);
      
      // Calculate total cost
      const costs = messages
        .map(m => m.metadata?.cost || 0)
        .filter(c => c > 0);
      const totalCost = costs.reduce((sum, cost) => sum + cost, 0);
      
      // Extract file, command, and tool information
      const filesModified = new Set<string>();
      const commandsExecuted = new Set<string>();
      const toolsUsed = new Set<string>();
      
      messages.forEach(message => {
        if (message.metadata?.files) {
          message.metadata.files.forEach(file => filesModified.add(file));
        }
        if (message.metadata?.commands) {
          message.metadata.commands.forEach(cmd => commandsExecuted.add(cmd));
        }
        if (message.metadata?.tools) {
          message.metadata.tools.forEach(tool => toolsUsed.add(tool));
        }
      });
      
      // Calculate success rate (simple heuristic: 1 - error_rate)
      const errorMessages = messages.filter(m => m.messageType === 'error').length;
      const successRate = messages.length > 0 ? 1 - (errorMessages / messages.length) : 1;
      
      const summary: SessionSummary = {
        totalMessages: messages.length,
        managerMessages,
        workerMessages,
        totalDuration,
        totalCost: totalCost || undefined,
        filesModified: Array.from(filesModified),
        commandsExecuted: Array.from(commandsExecuted),
        toolsUsed: Array.from(toolsUsed),
        successRate
      };
      
      this.summaries.set(sessionId, summary);
    } catch (error) {
      console.error(`Failed to update session summary for ${sessionId}:`, error);
    }
  }

  public async getSessionSummary(sessionId: string): Promise<SessionSummary | undefined> {
    return this.summaries.get(sessionId);
  }

  // Utility methods
  public async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    this.messages.delete(sessionId);
    this.communications.delete(sessionId);
    this.events.delete(sessionId);
    this.metrics.delete(sessionId);
    this.summaries.delete(sessionId);
  }

  public getHealthStatus(): { healthy: boolean; details: any } {
    return {
      healthy: true,
      details: {
        connected: true,
        type: 'in-memory',
        sessions: this.sessions.size,
        totalMessages: Array.from(this.messages.values()).reduce((sum, msgs) => sum + msgs.length, 0)
      }
    };
  }

  public async cleanup(): Promise<void> {
    // Clean up old sessions (older than 30 days by default)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    let cleanedCount = 0;
    for (const [sessionId, session] of this.sessions.entries()) {
      if ((session.status === 'completed' || session.status === 'failed') && 
          session.startTime < thirtyDaysAgo) {
        await this.deleteSession(sessionId);
        cleanedCount++;
      }
    }
    
    console.log(`Cleaned up ${cleanedCount} old sessions`);
  }

  public close(): void {
    console.log('Closing in-memory database service');
    this.sessions.clear();
    this.messages.clear();
    this.communications.clear();
    this.events.clear();
    this.metrics.clear();
    this.summaries.clear();
  }
}