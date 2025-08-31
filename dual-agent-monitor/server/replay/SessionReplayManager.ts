import { DatabaseService } from '../database/DatabaseService';
import { InMemoryDatabaseService } from '../database/InMemoryDatabaseService';
import { DualAgentSession, AgentMessage, AgentCommunication, SystemEvent, PerformanceMetrics } from '../types';
import { 
  ReplayStateManager, 
  ReplayBookmark, 
  ReplayAnnotation, 
  ReplaySegment, 
  ReplayTimelineEvent,
  ReplayMetadata
} from './ReplayState';
import { ReplayControls, PlaybackOptions } from './ReplayControls';
import { TimelineProcessor, ProcessingOptions, SessionAnalysis } from './TimelineProcessor';
import { v4 as uuidv4 } from 'uuid';

export interface ReplaySession {
  id: string;
  sessionId: string;
  stateManager: ReplayStateManager;
  controls: ReplayControls;
  processor: TimelineProcessor;
  metadata: ReplayMetadata;
  createdAt: Date;
  lastAccessedAt: Date;
  isCollaborative: boolean;
  collaborators: string[];
}

export interface SessionComparisonData {
  sessions: DualAgentSession[];
  alignedTimeline: Array<{
    timestamp: Date;
    events: Array<{
      sessionId: string;
      event: ReplayTimelineEvent | null;
    }>;
  }>;
  performanceComparison: {
    responseTime: Array<{ sessionId: string; avg: number; }>;
    cost: Array<{ sessionId: string; total: number; }>;
    errorRate: Array<{ sessionId: string; rate: number; }>;
  };
  workflowComparison: Array<{
    sessionId: string;
    phases: Array<{
      name: string;
      duration: number;
      dominantAgent: 'manager' | 'worker';
    }>;
  }>;
}

export interface ReplayExportOptions {
  format: 'json' | 'csv' | 'markdown';
  includeBookmarks: boolean;
  includeAnnotations: boolean;
  includeSegments: boolean;
  timeRange?: { start: Date; end: Date; };
  eventTypes?: Array<'message' | 'communication' | 'system_event' | 'performance_metric'>;
}

export class SessionReplayManager {
  private dbService: DatabaseService | InMemoryDatabaseService;
  private activeSessions = new Map<string, ReplaySession>();
  private bookmarksStore = new Map<string, ReplayBookmark[]>();
  private annotationsStore = new Map<string, ReplayAnnotation[]>();
  private segmentsStore = new Map<string, ReplaySegment[]>();
  private metadataStore = new Map<string, ReplayMetadata>();
  
  constructor(dbService: DatabaseService | InMemoryDatabaseService) {
    this.dbService = dbService;
  }

  // Session management
  async prepareSessionForReplay(
    sessionId: string, 
    options: ProcessingOptions = {}
  ): Promise<string> {
    // Check if already prepared
    const existingReplay = Array.from(this.activeSessions.values())
      .find(replay => replay.sessionId === sessionId);
    
    if (existingReplay) {
      existingReplay.lastAccessedAt = new Date();
      return existingReplay.id;
    }

    // Fetch session data
    const session = await this.dbService.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Fetch related data
    const communications = await this.dbService.getSessionCommunications(sessionId);
    const events = await this.dbService.getSessionEvents(sessionId);
    const metrics = await this.dbService.getSessionMetrics(sessionId);

    // Create processor and generate timeline
    const processor = new TimelineProcessor(session, communications, events, metrics);
    const timeline = processor.processTimeline(options);
    const metadata = processor.generateMetadata();

    // Create state manager and controls
    const stateManager = new ReplayStateManager(sessionId);
    const controls = new ReplayControls(stateManager);
    
    // Set up initial state
    stateManager.setTimeline(timeline);

    // Load existing bookmarks, annotations, segments
    const bookmarks = this.bookmarksStore.get(sessionId) || processor.generateBookmarks();
    const annotations = this.annotationsStore.get(sessionId) || [];
    const segments = this.segmentsStore.get(sessionId) || processor.generateSegments();

    // Store data
    this.bookmarksStore.set(sessionId, bookmarks);
    this.annotationsStore.set(sessionId, annotations);
    this.segmentsStore.set(sessionId, segments);
    this.metadataStore.set(sessionId, metadata);

    // Update state manager with stored data
    bookmarks.forEach(bookmark => stateManager.addBookmark(bookmark));
    annotations.forEach(annotation => stateManager.addAnnotation(annotation));
    segments.forEach(segment => stateManager.addSegment(segment));

    // Create replay session
    const replayId = uuidv4();
    const replaySession: ReplaySession = {
      id: replayId,
      sessionId,
      stateManager,
      controls,
      processor,
      metadata,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      isCollaborative: false,
      collaborators: []
    };

    this.activeSessions.set(replayId, replaySession);
    return replayId;
  }

  getReplaySession(replayId: string): ReplaySession | null {
    const session = this.activeSessions.get(replayId);
    if (session) {
      session.lastAccessedAt = new Date();
    }
    return session || null;
  }

  async closeReplaySession(replayId: string): Promise<void> {
    const session = this.activeSessions.get(replayId);
    if (session) {
      // Save any state changes
      await this.saveReplayState(replayId);
      
      // Cleanup controls
      session.controls.dispose();
      
      // Remove from active sessions
      this.activeSessions.delete(replayId);
    }
  }

  // Bookmark management
  async addBookmark(
    replayId: string, 
    bookmark: Omit<ReplayBookmark, 'id' | 'createdAt'>
  ): Promise<ReplayBookmark> {
    const session = this.getReplaySession(replayId);
    if (!session) {
      throw new Error(`Replay session ${replayId} not found`);
    }

    const fullBookmark: ReplayBookmark = {
      ...bookmark,
      id: uuidv4(),
      createdAt: new Date()
    };

    session.stateManager.addBookmark(fullBookmark);
    
    // Update store
    const bookmarks = this.bookmarksStore.get(session.sessionId) || [];
    bookmarks.push(fullBookmark);
    this.bookmarksStore.set(session.sessionId, bookmarks);

    return fullBookmark;
  }

  async updateBookmark(
    replayId: string, 
    bookmarkId: string, 
    updates: Partial<ReplayBookmark>
  ): Promise<void> {
    const session = this.getReplaySession(replayId);
    if (!session) {
      throw new Error(`Replay session ${replayId} not found`);
    }

    session.stateManager.updateBookmark(bookmarkId, updates);
    
    // Update store
    const bookmarks = this.bookmarksStore.get(session.sessionId) || [];
    const index = bookmarks.findIndex(b => b.id === bookmarkId);
    if (index !== -1) {
      bookmarks[index] = { ...bookmarks[index], ...updates };
      this.bookmarksStore.set(session.sessionId, bookmarks);
    }
  }

  async removeBookmark(replayId: string, bookmarkId: string): Promise<void> {
    const session = this.getReplaySession(replayId);
    if (!session) {
      throw new Error(`Replay session ${replayId} not found`);
    }

    session.stateManager.removeBookmark(bookmarkId);
    
    // Update store
    const bookmarks = this.bookmarksStore.get(session.sessionId) || [];
    const filtered = bookmarks.filter(b => b.id !== bookmarkId);
    this.bookmarksStore.set(session.sessionId, filtered);
  }

  // Annotation management
  async addAnnotation(
    replayId: string, 
    annotation: Omit<ReplayAnnotation, 'id' | 'createdAt'>
  ): Promise<ReplayAnnotation> {
    const session = this.getReplaySession(replayId);
    if (!session) {
      throw new Error(`Replay session ${replayId} not found`);
    }

    const fullAnnotation: ReplayAnnotation = {
      ...annotation,
      id: uuidv4(),
      createdAt: new Date()
    };

    session.stateManager.addAnnotation(fullAnnotation);
    
    // Update store
    const annotations = this.annotationsStore.get(session.sessionId) || [];
    annotations.push(fullAnnotation);
    this.annotationsStore.set(session.sessionId, annotations);

    return fullAnnotation;
  }

  async updateAnnotation(
    replayId: string, 
    annotationId: string, 
    updates: Partial<ReplayAnnotation>
  ): Promise<void> {
    const session = this.getReplaySession(replayId);
    if (!session) {
      throw new Error(`Replay session ${replayId} not found`);
    }

    session.stateManager.updateAnnotation(annotationId, updates);
    
    // Update store
    const annotations = this.annotationsStore.get(session.sessionId) || [];
    const index = annotations.findIndex(a => a.id === annotationId);
    if (index !== -1) {
      annotations[index] = { ...annotations[index], ...updates };
      this.annotationsStore.set(session.sessionId, annotations);
    }
  }

  async removeAnnotation(replayId: string, annotationId: string): Promise<void> {
    const session = this.getReplaySession(replayId);
    if (!session) {
      throw new Error(`Replay session ${replayId} not found`);
    }

    session.stateManager.removeAnnotation(annotationId);
    
    // Update store
    const annotations = this.annotationsStore.get(session.sessionId) || [];
    const filtered = annotations.filter(a => a.id !== annotationId);
    this.annotationsStore.set(session.sessionId, filtered);
  }

  // Segment management
  async addSegment(
    replayId: string, 
    segment: Omit<ReplaySegment, 'id' | 'createdAt'>
  ): Promise<ReplaySegment> {
    const session = this.getReplaySession(replayId);
    if (!session) {
      throw new Error(`Replay session ${replayId} not found`);
    }

    const fullSegment: ReplaySegment = {
      ...segment,
      id: uuidv4(),
      createdAt: new Date()
    };

    session.stateManager.addSegment(fullSegment);
    
    // Update store
    const segments = this.segmentsStore.get(session.sessionId) || [];
    segments.push(fullSegment);
    this.segmentsStore.set(session.sessionId, segments);

    return fullSegment;
  }

  // Multi-session comparison
  async compareSessionsForReplay(sessionIds: string[]): Promise<SessionComparisonData> {
    if (sessionIds.length < 2) {
      throw new Error('At least 2 sessions required for comparison');
    }

    const sessions: DualAgentSession[] = [];
    const processors: TimelineProcessor[] = [];

    // Load all sessions and create processors
    for (const sessionId of sessionIds) {
      const session = await this.dbService.getSession(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      const communications = await this.dbService.getSessionCommunications(sessionId);
      const events = await this.dbService.getSessionEvents(sessionId);
      const metrics = await this.dbService.getSessionMetrics(sessionId);

      sessions.push(session);
      processors.push(new TimelineProcessor(session, communications, events, metrics));
    }

    // Create aligned timeline
    const alignedTimeline = this.createAlignedTimeline(sessions, processors);

    // Generate performance comparison
    const performanceComparison = await this.generatePerformanceComparison(sessions, processors);

    // Generate workflow comparison
    const workflowComparison = this.generateWorkflowComparison(processors);

    return {
      sessions,
      alignedTimeline,
      performanceComparison,
      workflowComparison
    };
  }

  // Export functionality
  async exportReplayData(
    replayId: string, 
    options: ReplayExportOptions
  ): Promise<string> {
    const session = this.getReplaySession(replayId);
    if (!session) {
      throw new Error(`Replay session ${replayId} not found`);
    }

    const state = session.stateManager.getState();
    const timeline = session.stateManager.getFilteredTimeline();
    
    // Filter by time range if specified
    let filteredTimeline = timeline;
    if (options.timeRange) {
      filteredTimeline = timeline.filter(event => 
        event.timestamp >= options.timeRange!.start && 
        event.timestamp <= options.timeRange!.end
      );
    }

    // Filter by event types if specified
    if (options.eventTypes) {
      filteredTimeline = filteredTimeline.filter(event => 
        options.eventTypes!.includes(event.type)
      );
    }

    const exportData = {
      metadata: session.metadata,
      timeline: filteredTimeline,
      bookmarks: options.includeBookmarks ? state.bookmarks : [],
      annotations: options.includeAnnotations ? state.annotations : [],
      segments: options.includeSegments ? state.segments : [],
      analysis: session.processor.analyzeSession(),
      exportedAt: new Date(),
      exportOptions: options
    };

    switch (options.format) {
      case 'json':
        return JSON.stringify(exportData, null, 2);
      
      case 'csv':
        return this.convertToCSV(exportData);
      
      case 'markdown':
        return this.convertToMarkdown(exportData);
      
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  async exportSegment(
    replayId: string, 
    segmentId: string, 
    options: ReplayExportOptions
  ): Promise<string> {
    const session = this.getReplaySession(replayId);
    if (!session) {
      throw new Error(`Replay session ${replayId} not found`);
    }

    const segment = session.stateManager.getState().segments.find(s => s.id === segmentId);
    if (!segment) {
      throw new Error(`Segment ${segmentId} not found`);
    }

    // Override time range with segment bounds
    const segmentOptions: ReplayExportOptions = {
      ...options,
      timeRange: {
        start: segment.startTime,
        end: segment.endTime
      }
    };

    return this.exportReplayData(replayId, segmentOptions);
  }

  // Collaborative features
  async enableCollaborativeMode(replayId: string, collaborators: string[]): Promise<void> {
    const session = this.getReplaySession(replayId);
    if (!session) {
      throw new Error(`Replay session ${replayId} not found`);
    }

    session.isCollaborative = true;
    session.collaborators = [...new Set(collaborators)];
  }

  async addCollaborator(replayId: string, collaboratorId: string): Promise<void> {
    const session = this.getReplaySession(replayId);
    if (!session) {
      throw new Error(`Replay session ${replayId} not found`);
    }

    if (!session.collaborators.includes(collaboratorId)) {
      session.collaborators.push(collaboratorId);
    }
  }

  // State persistence
  private async saveReplayState(replayId: string): Promise<void> {
    const session = this.getReplaySession(replayId);
    if (!session) return;

    const state = session.stateManager.exportState();
    
    // In a production environment, this would save to persistent storage
    // For now, we keep it in memory stores
    this.bookmarksStore.set(session.sessionId, session.stateManager.getState().bookmarks);
    this.annotationsStore.set(session.sessionId, session.stateManager.getState().annotations);
    this.segmentsStore.set(session.sessionId, session.stateManager.getState().segments);
  }

  // Helper methods for export
  private convertToCSV(data: any): string {
    const lines: string[] = [];
    
    // Timeline CSV
    lines.push('timestamp,type,agent_type,message_type,content');
    data.timeline.forEach((event: ReplayTimelineEvent) => {
      if (event.type === 'message') {
        const message = event.data as AgentMessage;
        const csvLine = [
          event.timestamp.toISOString(),
          event.type,
          message.agentType,
          message.messageType,
          `"${message.content.replace(/"/g, '""')}"`
        ].join(',');
        lines.push(csvLine);
      }
    });

    return lines.join('\n');
  }

  private convertToMarkdown(data: any): string {
    const lines: string[] = [];
    
    lines.push(`# Session Replay: ${data.metadata.title}`);
    lines.push('');
    lines.push(`**Session ID:** ${data.metadata.sessionId}`);
    lines.push(`**Duration:** ${Math.round(data.metadata.duration / 1000)}s`);
    lines.push(`**Total Events:** ${data.metadata.totalEvents}`);
    lines.push('');

    // Timeline
    lines.push('## Timeline');
    lines.push('');
    data.timeline.forEach((event: ReplayTimelineEvent) => {
      if (event.type === 'message') {
        const message = event.data as AgentMessage;
        lines.push(`### ${event.timestamp.toISOString()} - ${message.agentType} (${message.messageType})`);
        lines.push('');
        lines.push(message.content);
        lines.push('');
      }
    });

    // Bookmarks
    if (data.bookmarks.length > 0) {
      lines.push('## Bookmarks');
      lines.push('');
      data.bookmarks.forEach((bookmark: ReplayBookmark) => {
        lines.push(`- **${bookmark.title}** (${bookmark.timestamp.toISOString()})`);
        if (bookmark.description) {
          lines.push(`  ${bookmark.description}`);
        }
      });
      lines.push('');
    }

    return lines.join('\n');
  }

  private createAlignedTimeline(
    sessions: DualAgentSession[], 
    processors: TimelineProcessor[]
  ): SessionComparisonData['alignedTimeline'] {
    const allTimestamps = new Set<number>();
    const sessionTimelines = new Map<string, ReplayTimelineEvent[]>();

    // Collect all timestamps and timelines
    sessions.forEach((session, index) => {
      const timeline = processors[index].processTimeline();
      sessionTimelines.set(session.id, timeline);
      timeline.forEach(event => allTimestamps.add(event.timestamp.getTime()));
    });

    // Create aligned timeline
    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);
    
    return sortedTimestamps.map(timestamp => ({
      timestamp: new Date(timestamp),
      events: sessions.map(session => {
        const timeline = sessionTimelines.get(session.id)!;
        const event = timeline.find(e => e.timestamp.getTime() === timestamp);
        return {
          sessionId: session.id,
          event: event || null
        };
      })
    }));
  }

  private async generatePerformanceComparison(
    sessions: DualAgentSession[], 
    processors: TimelineProcessor[]
  ): Promise<SessionComparisonData['performanceComparison']> {
    const responseTime: Array<{ sessionId: string; avg: number; }> = [];
    const cost: Array<{ sessionId: string; total: number; }> = [];
    const errorRate: Array<{ sessionId: string; rate: number; }> = [];

    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      const analysis = processors[i].analyzeSession();
      
      responseTime.push({
        sessionId: session.id,
        avg: analysis.performanceMetrics.avgResponseTime
      });
      
      cost.push({
        sessionId: session.id,
        total: analysis.performanceMetrics.totalCost
      });
      
      errorRate.push({
        sessionId: session.id,
        rate: analysis.performanceMetrics.errorRate
      });
    }

    return { responseTime, cost, errorRate };
  }

  private generateWorkflowComparison(
    processors: TimelineProcessor[]
  ): SessionComparisonData['workflowComparison'] {
    return processors.map((processor, index) => {
      const analysis = processor.analyzeSession();
      return {
        sessionId: processor['session'].id, // Access private property for session ID
        phases: analysis.workflowPhases.map(phase => ({
          name: phase.name,
          duration: phase.endTime.getTime() - phase.startTime.getTime(),
          dominantAgent: phase.dominantAgent
        }))
      };
    });
  }

  // Cleanup
  async cleanup(): Promise<void> {
    // Close old sessions (older than 1 hour)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    
    for (const [replayId, session] of this.activeSessions.entries()) {
      if (session.lastAccessedAt.getTime() < oneHourAgo) {
        await this.closeReplaySession(replayId);
      }
    }
  }

  // Status
  getActiveSessionsCount(): number {
    return this.activeSessions.size;
  }

  getActiveSessionIds(): string[] {
    return Array.from(this.activeSessions.keys());
  }

  getSessionInfo(replayId: string): {
    sessionId: string;
    createdAt: Date;
    lastAccessedAt: Date;
    isCollaborative: boolean;
    collaboratorCount: number;
  } | null {
    const session = this.activeSessions.get(replayId);
    if (!session) return null;

    return {
      sessionId: session.sessionId,
      createdAt: session.createdAt,
      lastAccessedAt: session.lastAccessedAt,
      isCollaborative: session.isCollaborative,
      collaboratorCount: session.collaborators.length
    };
  }
}