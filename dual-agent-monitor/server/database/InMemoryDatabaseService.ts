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

  // Enhanced analytics queries for InMemoryDatabaseService
  public async getMetricsInTimeRange(
    timeRange: { start: Date; end: Date },
    sessionIds?: string[]
  ): Promise<PerformanceMetrics[]> {
    const allMetrics: PerformanceMetrics[] = [];
    
    const sessionsToCheck = sessionIds || Array.from(this.sessions.keys());
    
    for (const sessionId of sessionsToCheck) {
      const sessionMetrics = this.metrics.get(sessionId) || [];
      const filteredMetrics = sessionMetrics.filter(metric => 
        metric.timestamp >= timeRange.start && metric.timestamp <= timeRange.end
      );
      allMetrics.push(...filteredMetrics);
    }
    
    return allMetrics.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  public async getAggregatedMetrics(
    timeWindow: 'hour' | 'day' | 'week',
    sessionIds?: string[]
  ): Promise<Array<{
    timeWindow: string;
    agentType: 'manager' | 'worker';
    avgResponseTime: number;
    totalTokens: number;
    totalCost: number;
    avgErrorRate: number;
    messageCount: number;
  }>> {
    const allMetrics = await this.getMetricsInTimeRange(
      { start: new Date(0), end: new Date() },
      sessionIds
    );

    const windowMap = new Map<string, Map<'manager' | 'worker', PerformanceMetrics[]>>();
    
    allMetrics.forEach(metric => {
      const timeKey = this.getTimeWindow(metric.timestamp, timeWindow);
      
      if (!windowMap.has(timeKey)) {
        windowMap.set(timeKey, new Map());
      }
      
      const agentMap = windowMap.get(timeKey)!;
      if (!agentMap.has(metric.agentType)) {
        agentMap.set(metric.agentType, []);
      }
      
      agentMap.get(metric.agentType)!.push(metric);
    });

    const result: Array<{
      timeWindow: string;
      agentType: 'manager' | 'worker';
      avgResponseTime: number;
      totalTokens: number;
      totalCost: number;
      avgErrorRate: number;
      messageCount: number;
    }> = [];

    for (const [timeKey, agentMap] of windowMap.entries()) {
      for (const [agentType, metrics] of agentMap.entries()) {
        const avgResponseTime = metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length;
        const totalTokens = metrics.reduce((sum, m) => sum + (m.tokensUsed || 0), 0);
        const totalCost = metrics.reduce((sum, m) => sum + (m.cost || 0), 0);
        const avgErrorRate = metrics.reduce((sum, m) => sum + m.errorRate, 0) / metrics.length;

        result.push({
          timeWindow: timeKey,
          agentType,
          avgResponseTime,
          totalTokens,
          totalCost,
          avgErrorRate,
          messageCount: metrics.length
        });
      }
    }

    return result.sort((a, b) => a.timeWindow.localeCompare(b.timeWindow));
  }

  public async getTopPerformingSessions(limit: number = 10): Promise<Array<{
    sessionId: string;
    performanceScore: number;
    avgResponseTime: number;
    totalCost: number;
    errorRate: number;
    duration: number;
  }>> {
    const sessionScores: Array<{
      sessionId: string;
      performanceScore: number;
      avgResponseTime: number;
      totalCost: number;
      errorRate: number;
      duration: number;
    }> = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.status !== 'completed') continue;

      const sessionMetrics = this.metrics.get(sessionId) || [];
      if (sessionMetrics.length === 0) continue;

      const avgResponseTime = sessionMetrics.reduce((sum, m) => sum + m.responseTime, 0) / sessionMetrics.length;
      const totalCost = sessionMetrics.reduce((sum, m) => sum + (m.cost || 0), 0);
      const errorRate = sessionMetrics.reduce((sum, m) => sum + m.errorRate, 0) / sessionMetrics.length;
      
      const duration = session.endTime && session.startTime ?
        session.endTime.getTime() - session.startTime.getTime() : 0;

      const performanceScore = (1 - errorRate) * 50 + 
        (avgResponseTime > 0 ? Math.max(0, 100 - avgResponseTime / 1000) * 0.5 : 50);

      sessionScores.push({
        sessionId,
        performanceScore: Math.round(performanceScore),
        avgResponseTime,
        totalCost,
        errorRate,
        duration
      });
    }

    return sessionScores
      .sort((a, b) => b.performanceScore - a.performanceScore)
      .slice(0, limit);
  }

  public async getCostAnalytics(
    timeRange?: { start: Date; end: Date },
    sessionIds?: string[]
  ): Promise<{
    totalCost: number;
    avgCostPerSession: number;
    costByAgent: { manager: number; worker: number };
    costTrend: Array<{ date: string; cost: number }>;
  }> {
    const allMetrics = timeRange ? 
      await this.getMetricsInTimeRange(timeRange, sessionIds) :
      Array.from(this.metrics.values()).flat().filter(m => 
        !sessionIds || sessionIds.includes(m.sessionId)
      );

    let totalCost = 0;
    const costByAgent = { manager: 0, worker: 0 };
    const costTrendMap = new Map<string, number>();
    const uniqueSessions = new Set<string>();

    allMetrics.forEach(metric => {
      const cost = metric.cost || 0;
      totalCost += cost;
      uniqueSessions.add(metric.sessionId);

      if (metric.agentType === 'manager') {
        costByAgent.manager += cost;
      } else if (metric.agentType === 'worker') {
        costByAgent.worker += cost;
      }

      const date = metric.timestamp.toISOString().split('T')[0];
      const existing = costTrendMap.get(date) || 0;
      costTrendMap.set(date, existing + cost);
    });

    const costTrend = Array.from(costTrendMap.entries())
      .map(([date, cost]) => ({ date, cost }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalCost,
      avgCostPerSession: uniqueSessions.size > 0 ? totalCost / uniqueSessions.size : 0,
      costByAgent,
      costTrend
    };
  }

  public async getErrorAnalytics(sessionIds?: string[]): Promise<{
    totalErrors: number;
    errorsByType: Array<{ type: string; count: number; percentage: number }>;
    errorsByAgent: { manager: number; worker: number };
    errorTrend: Array<{ date: string; errors: number }>;
  }> {
    const allMessages: AgentMessage[] = [];
    const sessionsToCheck = sessionIds || Array.from(this.sessions.keys());

    for (const sessionId of sessionsToCheck) {
      const sessionMessages = this.messages.get(sessionId) || [];
      allMessages.push(...sessionMessages);
    }

    let totalErrors = 0;
    const errorsByType = new Map<string, number>();
    const errorsByAgent = { manager: 0, worker: 0 };
    const errorTrendMap = new Map<string, number>();

    allMessages.forEach(message => {
      if (message.messageType === 'error') {
        totalErrors++;

        // Count by agent
        if (message.agentType === 'manager') {
          errorsByAgent.manager++;
        } else if (message.agentType === 'worker') {
          errorsByAgent.worker++;
        }

        // Count by date for trend
        const date = message.timestamp.toISOString().split('T')[0];
        const existing = errorTrendMap.get(date) || 0;
        errorTrendMap.set(date, existing + 1);

        // Count by type
        const existing_type = errorsByType.get(message.messageType) || 0;
        errorsByType.set(message.messageType, existing_type + 1);
      }
    });

    const errorTrend = Array.from(errorTrendMap.entries())
      .map(([date, errors]) => ({ date, errors }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const errorTypeArray = Array.from(errorsByType.entries()).map(([type, count]) => ({
      type,
      count,
      percentage: totalErrors > 0 ? (count / totalErrors) * 100 : 0
    }));

    return {
      totalErrors,
      errorsByType: errorTypeArray,
      errorsByAgent,
      errorTrend
    };
  }

  private getTimeWindow(timestamp: Date, window: 'hour' | 'day' | 'week'): string {
    const date = new Date(timestamp);
    
    switch (window) {
      case 'hour':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00:00`;
      case 'day':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return `${weekStart.getFullYear()}-W${String(this.getWeekNumber(weekStart)).padStart(2, '0')}`;
      default:
        return date.toISOString().split('T')[0];
    }
  }

  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
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