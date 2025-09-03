import { v4 as uuidv4 } from 'uuid';
import {
  AgentMessage,
  DualAgentSession,
  SessionSummary,
  AgentCommunication,
  SystemEvent,
  PerformanceMetrics,
  SessionRecording,
  RecordingInteraction,
  PlaybackSession,
  PlaybackSettings,
  RecordingAnnotation,
  RecordingBookmark,
  RecordingExport,
  ExportOptions,
  KeyMoment
} from '../types';

export class InMemoryDatabaseService {
  private sessions: Map<string, DualAgentSession> = new Map();
  private messages: Map<string, AgentMessage[]> = new Map();
  private communications: Map<string, AgentCommunication[]> = new Map();
  private events: Map<string, SystemEvent[]> = new Map();
  private metrics: Map<string, PerformanceMetrics[]> = new Map();
  private summaries: Map<string, SessionSummary> = new Map();
  
  // Recording-related storage
  private recordings: Map<string, SessionRecording> = new Map();
  private interactions: Map<string, RecordingInteraction[]> = new Map();
  private playbacks: Map<string, PlaybackSession> = new Map();
  private annotations: Map<string, RecordingAnnotation[]> = new Map();
  private bookmarks: Map<string, RecordingBookmark[]> = new Map();
  private exports: Map<string, RecordingExport> = new Map();

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
    avgResponseTime: number;
    totalMessages: number;
    successRate: number;
  }>> {
    const sessionScores: Array<{
      sessionId: string;
      avgResponseTime: number;
      totalMessages: number;
      successRate: number;
      performanceScore: number;
    }> = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.status !== 'completed') continue;

      const sessionMetrics = this.metrics.get(sessionId) || [];
      const sessionMessages = this.messages.get(sessionId) || [];
      
      if (sessionMessages.length === 0) continue;

      const avgResponseTime = sessionMetrics.length > 0 ? 
        sessionMetrics.reduce((sum, m) => sum + m.responseTime, 0) / sessionMetrics.length : 0;
      
      const totalMessages = sessionMessages.length;
      
      // Calculate success rate (simple heuristic: 1 - error_rate from messages)
      const errorMessages = sessionMessages.filter(m => m.messageType === 'error').length;
      const successRate = totalMessages > 0 ? (totalMessages - errorMessages) / totalMessages : 1;

      const performanceScore = successRate * 50 + 
        (avgResponseTime > 0 ? Math.max(0, 100 - avgResponseTime / 1000) * 0.5 : 50);

      sessionScores.push({
        sessionId,
        avgResponseTime,
        totalMessages,
        successRate,
        performanceScore
      });
    }

    return sessionScores
      .sort((a, b) => b.performanceScore - a.performanceScore)
      .slice(0, limit)
      .map(({sessionId, avgResponseTime, totalMessages, successRate}) => ({
        sessionId,
        avgResponseTime,
        totalMessages,
        successRate
      }));
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
    errorRate: number;
    errorsByType: { [key: string]: number };
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

    // Calculate error rate (errors per total messages)
    const errorRate = allMessages.length > 0 ? totalErrors / allMessages.length : 0;

    // Convert Map to simple object
    const errorsByTypeObject: { [key: string]: number } = {};
    errorsByType.forEach((count, type) => {
      errorsByTypeObject[type] = count;
    });

    return {
      totalErrors,
      errorRate,
      errorsByType: errorsByTypeObject
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

  public isReady(): boolean {
    return true; // In-memory service is always ready
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
    this.recordings.clear();
    this.interactions.clear();
    this.playbacks.clear();
    this.annotations.clear();
    this.bookmarks.clear();
    this.exports.clear();
  }

  // ===============================================
  // SESSION RECORDING METHODS
  // ===============================================

  async createSessionRecording(recording: {
    sessionId: string;
    recordingName?: string;
    description?: string;
    recordedBy?: string;
    recordingQuality?: 'low' | 'medium' | 'high' | 'lossless';
  }): Promise<string> {
    const id = uuidv4();
    const sessionRecording: SessionRecording = {
      id,
      sessionId: recording.sessionId,
      recordingName: recording.recordingName || `Recording ${id}`,
      description: recording.description,
      recordedBy: recording.recordedBy,
      recordingQuality: recording.recordingQuality || 'medium',
      recordingStartedAt: new Date(),
      recordingCompletedAt: undefined,
      status: 'recording',
      totalInteractions: 0,
      totalSizeBytes: 0,
      sharedPublicly: false,
      downloadCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.recordings.set(id, sessionRecording);
    this.interactions.set(id, []);
    this.annotations.set(id, []);
    this.bookmarks.set(id, []);
    
    return id;
  }

  async getSessionRecording(recordingId: string): Promise<SessionRecording | null> {
    return this.recordings.get(recordingId) || null;
  }

  async getAllSessionRecordings(limit?: number): Promise<SessionRecording[]> {
    const recordings = Array.from(this.recordings.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    return limit ? recordings.slice(0, limit) : recordings;
  }

  async updateSessionRecording(recordingId: string, updates: Partial<SessionRecording>): Promise<void> {
    const recording = this.recordings.get(recordingId);
    if (!recording) return;
    
    Object.assign(recording, updates, { updatedAt: new Date() });
    this.recordings.set(recordingId, recording);
  }

  async deleteSessionRecording(recordingId: string): Promise<void> {
    this.recordings.delete(recordingId);
    this.interactions.delete(recordingId);
    this.annotations.delete(recordingId);
    this.bookmarks.delete(recordingId);
    
    // Delete related exports
    for (const [exportId, exportData] of this.exports.entries()) {
      if (exportData.recordingId === recordingId) {
        this.exports.delete(exportId);
      }
    }
  }

  async addRecordingInteraction(interaction: {
    recordingId: string;
    sessionId: string;
    interactionType: string;
    timestamp: Date;
    relativeTimeMs: number;
    durationMs?: number;
    agentType?: 'manager' | 'worker' | 'system' | 'user';
    content: string;
    contentType?: 'text' | 'json' | 'binary' | 'image' | 'file';
    metadata?: any;
    relatedMessageId?: string;
    relatedEventId?: string;
    parentInteractionId?: string;
  }): Promise<void> {
    const recordingInteraction: RecordingInteraction = {
      id: uuidv4(),
      recordingId: interaction.recordingId,
      sessionId: interaction.sessionId,
      sequenceNumber: 0,
      interactionType: interaction.interactionType as any,
      timestamp: interaction.timestamp,
      relativeTimeMs: interaction.relativeTimeMs,
      durationMs: interaction.durationMs,
      agentType: interaction.agentType,
      content: interaction.content,
      contentType: interaction.contentType || 'text',
      relatedMessageId: interaction.relatedMessageId,
      relatedEventId: interaction.relatedEventId,
      parentInteractionId: interaction.parentInteractionId,
      metadata: interaction.metadata,
      isCompressed: false
    };
    
    const interactions = this.interactions.get(interaction.recordingId) || [];
    interactions.push(recordingInteraction);
    this.interactions.set(interaction.recordingId, interactions);
  }

  async getRecordingInteractions(recordingId: string, startTime?: number, endTime?: number): Promise<RecordingInteraction[]> {
    const interactions = this.interactions.get(recordingId) || [];
    
    if (startTime !== undefined || endTime !== undefined) {
      return interactions.filter(interaction => {
        const time = interaction.relativeTimeMs;
        if (startTime !== undefined && time < startTime) return false;
        if (endTime !== undefined && time > endTime) return false;
        return true;
      });
    }
    
    return interactions;
  }

  async getRecordingInteractionsByTimeRange(
    recordingId: string, 
    startTimeMs: number, 
    endTimeMs: number
  ): Promise<RecordingInteraction[]> {
    return this.getRecordingInteractions(recordingId, startTimeMs, endTimeMs);
  }

  async createPlaybackSession(playback: {
    recordingId: string;
    userId?: string;
    playbackName?: string;
    playbackSettings?: PlaybackSettings;
  }): Promise<string> {
    const id = uuidv4();
    const playbackSession: PlaybackSession = {
      id,
      recordingId: playback.recordingId,
      userId: playback.userId,
      playbackName: playback.playbackName || `Playback ${id}`,
      currentPositionMs: 0,
      playbackSpeed: 1.0,
      isPlaying: false,
      isPaused: false,
      startedAt: new Date(),
      lastAccessedAt: new Date(),
      totalWatchTimeMs: 0,
      annotationsAdded: 0,
      bookmarksAdded: 0,
      playbackSettings: playback.playbackSettings,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.playbacks.set(id, playbackSession);
    return id;
  }

  async getPlaybackSession(playbackId: string): Promise<PlaybackSession | null> {
    return this.playbacks.get(playbackId) || null;
  }

  async updatePlaybackSession(playbackId: string, updates: {
    currentPositionMs?: number;
    playbackSpeed?: number;
    isPlaying?: boolean;
    isPaused?: boolean;
    totalWatchTimeMs?: number;
    notes?: string;
    playbackSettings?: PlaybackSettings;
  }): Promise<void> {
    const playback = this.playbacks.get(playbackId);
    if (!playback) return;
    
    Object.assign(playback, updates, { updatedAt: new Date() });
    this.playbacks.set(playbackId, playback);
  }

  async getUserPlaybackSessions(userId: string, recordingId?: string): Promise<PlaybackSession[]> {
    const sessions = Array.from(this.playbacks.values())
      .filter(session => session.userId === userId)
      .filter(session => !recordingId || session.recordingId === recordingId);
    
    return sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async deletePlaybackSession(playbackId: string): Promise<void> {
    this.playbacks.delete(playbackId);
  }

  async addRecordingAnnotation(annotation: {
    recordingId: string;
    playbackSessionId?: string;
    userId?: string;
    timestampMs: number;
    durationMs?: number;
    annotationType: 'note' | 'highlight' | 'bookmark' | 'flag' | 'question';
    title: string;
    content: string;
    color?: string;
    isPublic?: boolean;
    tags?: string[];
    priority?: 'low' | 'normal' | 'high' | 'critical';
  }): Promise<string> {
    const id = uuidv4();
    const recordingAnnotation: RecordingAnnotation = {
      id,
      recordingId: annotation.recordingId,
      playbackSessionId: annotation.playbackSessionId,
      userId: annotation.userId,
      timestampMs: annotation.timestampMs,
      durationMs: annotation.durationMs,
      annotationType: annotation.annotationType,
      title: annotation.title,
      content: annotation.content,
      color: annotation.color || '#yellow',
      isPublic: annotation.isPublic || false,
      tags: annotation.tags || [],
      priority: annotation.priority || 'normal',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const annotations = this.annotations.get(annotation.recordingId) || [];
    annotations.push(recordingAnnotation);
    this.annotations.set(annotation.recordingId, annotations);
    
    return id;
  }

  async getRecordingAnnotations(recordingId: string, userId?: string): Promise<RecordingAnnotation[]> {
    const annotations = this.annotations.get(recordingId) || [];
    
    if (userId) {
      return annotations.filter(annotation => 
        annotation.userId === userId || annotation.isPublic
      );
    }
    
    return annotations;
  }

  async updateRecordingAnnotation(annotationId: string, updates: Partial<RecordingAnnotation>): Promise<void> {
    for (const annotations of this.annotations.values()) {
      const index = annotations.findIndex(a => a.id === annotationId);
      if (index !== -1) {
        Object.assign(annotations[index], updates, { updatedAt: new Date() });
        break;
      }
    }
  }

  async deleteRecordingAnnotation(annotationId: string): Promise<void> {
    for (const [recordingId, annotations] of this.annotations.entries()) {
      const filtered = annotations.filter(a => a.id !== annotationId);
      this.annotations.set(recordingId, filtered);
    }
  }

  async addRecordingBookmark(bookmark: {
    recordingId: string;
    userId?: string;
    timestampMs: number;
    title: string;
    description?: string;
    bookmarkType?: 'user' | 'system' | 'auto' | 'key_moment';
    icon?: string;
    color?: string;
    chapterMarker?: boolean;
  }): Promise<string> {
    const id = uuidv4();
    const recordingBookmark: RecordingBookmark = {
      id,
      recordingId: bookmark.recordingId,
      userId: bookmark.userId,
      timestampMs: bookmark.timestampMs,
      title: bookmark.title,
      description: bookmark.description,
      bookmarkType: bookmark.bookmarkType || 'user',
      icon: bookmark.icon || '📌',
      color: bookmark.color || '#blue',
      chapterMarker: bookmark.chapterMarker || false,
      accessCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const bookmarks = this.bookmarks.get(bookmark.recordingId) || [];
    bookmarks.push(recordingBookmark);
    bookmarks.sort((a, b) => a.timestampMs - b.timestampMs);
    this.bookmarks.set(bookmark.recordingId, bookmarks);
    
    return id;
  }

  async getRecordingBookmarks(recordingId: string, userId?: string): Promise<RecordingBookmark[]> {
    const bookmarks = this.bookmarks.get(recordingId) || [];
    
    if (userId) {
      return bookmarks.filter(bookmark => 
        bookmark.userId === userId || bookmark.bookmarkType === 'system'
      );
    }
    
    return bookmarks;
  }

  async updateRecordingBookmark(bookmarkId: string, updates: Partial<RecordingBookmark>): Promise<void> {
    for (const bookmarks of this.bookmarks.values()) {
      const index = bookmarks.findIndex(b => b.id === bookmarkId);
      if (index !== -1) {
        Object.assign(bookmarks[index], updates);
        break;
      }
    }
  }

  async deleteRecordingBookmark(bookmarkId: string): Promise<void> {
    for (const [recordingId, bookmarks] of this.bookmarks.entries()) {
      const filtered = bookmarks.filter(b => b.id !== bookmarkId);
      this.bookmarks.set(recordingId, filtered);
    }
  }

  async createRecordingExport(exportRequest: {
    recordingId: string;
    requestedBy?: string;
    exportFormat: 'json' | 'csv' | 'video' | 'html' | 'pdf' | 'zip';
    exportOptions?: ExportOptions;
    includeAnnotations?: boolean;
    includeBookmarks?: boolean;
    includeMetadata?: boolean;
    startTimeMs?: number;
    endTimeMs?: number;
  }): Promise<string> {
    const id = uuidv4();
    const recordingExport: RecordingExport = {
      id,
      recordingId: exportRequest.recordingId,
      requestedBy: exportRequest.requestedBy,
      exportFormat: exportRequest.exportFormat,
      exportOptions: exportRequest.exportOptions,
      includeAnnotations: exportRequest.includeAnnotations || false,
      includeBookmarks: exportRequest.includeBookmarks || false,
      includeMetadata: exportRequest.includeMetadata || true,
      startTimeMs: exportRequest.startTimeMs,
      endTimeMs: exportRequest.endTimeMs,
      status: 'pending',
      downloadCount: 0,
      requestedAt: new Date()
    };
    
    this.exports.set(id, recordingExport);
    return id;
  }

  async getRecordingExport(exportId: string): Promise<RecordingExport | null> {
    return this.exports.get(exportId) || null;
  }

  async getRecordingExports(recordingId: string): Promise<RecordingExport[]> {
    return Array.from(this.exports.values())
      .filter(exp => exp.recordingId === recordingId)
      .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
  }

  async updateRecordingExport(exportId: string, updates: {
    status?: 'pending' | 'processing' | 'completed' | 'failed';
    filePath?: string;
    fileSizeBytes?: number;
    completedAt?: Date;
    errorMessage?: string;
  }): Promise<void> {
    const exportData = this.exports.get(exportId);
    if (!exportData) return;
    
    Object.assign(exportData, updates, { updatedAt: new Date() });
    this.exports.set(exportId, exportData);
  }

  async deleteRecordingExport(exportId: string): Promise<void> {
    this.exports.delete(exportId);
  }

  async getRecordingAnalytics(recordingId: string): Promise<{
    totalViews: number;
    totalWatchTime: number;
    averageWatchTime: number;
    completionRate: number;
    annotationCount: number;
    bookmarkCount: number;
    exportCount: number;
    viewerCount: number;
  }> {
    const playbacks = Array.from(this.playbacks.values())
      .filter(p => p.recordingId === recordingId);
    
    const annotations = this.annotations.get(recordingId) || [];
    const bookmarks = this.bookmarks.get(recordingId) || [];
    const exports = Array.from(this.exports.values())
      .filter(exp => exp.recordingId === recordingId);
    
    const totalViews = playbacks.length;
    const totalWatchTime = playbacks.reduce((sum, p) => sum + p.totalWatchTimeMs, 0);
    const averageWatchTime = totalViews > 0 ? totalWatchTime / totalViews : 0;
    const uniqueViewers = new Set(playbacks.map(p => p.userId).filter(Boolean)).size;
    
    return {
      totalViews,
      totalWatchTime,
      averageWatchTime,
      completionRate: 0.85, // Mock completion rate
      annotationCount: annotations.length,
      bookmarkCount: bookmarks.length,
      exportCount: exports.length,
      viewerCount: uniqueViewers
    };
  }

  async getPopularRecordings(limit?: number): Promise<Array<{
    recordingId: string;
    recordingName: string;
    viewCount: number;
    downloadCount: number;
    rating?: number;
  }>> {
    const recordingStats = new Map<string, {
      recordingName: string;
      viewCount: number;
      downloadCount: number;
    }>();
    
    // Count views
    for (const playback of this.playbacks.values()) {
      const recording = this.recordings.get(playback.recordingId);
      if (recording) {
        const existing = recordingStats.get(playback.recordingId) || {
          recordingName: recording.recordingName || recording.id,
          viewCount: 0,
          downloadCount: 0
        };
        existing.viewCount++;
        recordingStats.set(playback.recordingId, existing);
      }
    }
    
    // Count downloads
    for (const exportData of this.exports.values()) {
      if (exportData.status === 'completed') {
        const existing = recordingStats.get(exportData.recordingId);
        if (existing) {
          existing.downloadCount++;
        }
      }
    }
    
    const results = Array.from(recordingStats.entries())
      .map(([recordingId, stats]) => ({
        recordingId,
        recordingName: stats.recordingName,
        viewCount: stats.viewCount,
        downloadCount: stats.downloadCount,
        rating: Math.random() * 5 // Mock rating
      }))
      .sort((a, b) => b.viewCount - a.viewCount);
    
    return limit ? results.slice(0, limit) : results;
  }

  async detectKeyMoments(recordingId: string): Promise<KeyMoment[]> {
    const interactions = this.interactions.get(recordingId) || [];
    const keyMoments: KeyMoment[] = [];
    
    // Simple key moment detection based on interaction patterns
    interactions.forEach((interaction, index) => {
      if (interaction.interactionType === 'error') {
        keyMoments.push({
          timestampMs: interaction.relativeTimeMs,
          title: 'Error Detected',
          description: 'Error occurred during execution',
          momentType: 'error',
          importance: 'high',
          automaticallyDetected: true,
          relatedInteractionIds: [interaction.id]
        });
      }
    });
    
    return keyMoments;
  }

  async addKeyMoment(recordingId: string, keyMoment: {
    timestampMs: number;
    title: string;
    description: string;
    momentType: 'error' | 'completion' | 'decision_point' | 'interaction_peak' | 'user_defined';
    importance: 'low' | 'medium' | 'high';
    automaticallyDetected?: boolean;
    relatedInteractionIds?: string[];
  }): Promise<void> {
    // For in-memory implementation, we just store it as an annotation
    await this.addRecordingAnnotation({
      recordingId,
      timestampMs: keyMoment.timestampMs,
      annotationType: 'bookmark',
      title: keyMoment.title,
      content: keyMoment.description,
      priority: keyMoment.importance === 'high' ? 'high' : 
               keyMoment.importance === 'medium' ? 'normal' : 'low'
    });
  }
}