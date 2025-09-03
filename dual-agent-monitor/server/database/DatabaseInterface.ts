import {
  AgentMessage,
  DualAgentSession,
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

/**
 * Common interface for all database services
 * This allows for interchangeable database implementations
 */
export interface DatabaseInterface {
  // Session management
  createSession(sessionData: {
    startTime: Date;
    status: string;
    initialTask: string;
    workDir: string;
  }): Promise<string>;

  getSession(sessionId: string): Promise<DualAgentSession | null>;
  getAllSessions(limit?: number): Promise<DualAgentSession[]>;
  updateSessionStatus(sessionId: string, status: string, endTime?: Date): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;

  // Message management
  addMessage(message: {
    id: string;
    sessionId: string;
    agentType: 'manager' | 'worker';
    messageType: string;
    content: string;
    timestamp: Date;
    parentMessageId?: string;
    metadata?: {
      tools?: string[];
      files?: string[];
      commands?: string[];
      duration?: number;
      cost?: number;
      exitCode?: number;
    };
  }): Promise<void>;

  getSessionMessages(sessionId: string): Promise<AgentMessage[]>;

  // Communication tracking
  addAgentCommunication(communication: {
    sessionId: string;
    fromAgent: 'manager' | 'worker';
    toAgent: 'manager' | 'worker';
    messageType: string;
    content: string;
    timestamp: Date;
    relatedMessageId?: string;
  }): Promise<void>;

  getSessionCommunications(sessionId: string): Promise<AgentCommunication[]>;

  // System events
  addSystemEvent(event: {
    id: string;
    sessionId: string;
    eventType: string;
    details: string;
    timestamp: Date;
  }): Promise<void>;

  getSessionEvents(sessionId: string): Promise<SystemEvent[]>;

  // Performance metrics
  addPerformanceMetric(metric: {
    sessionId: string;
    agentType: 'manager' | 'worker';
    responseTime: number;
    tokensUsed?: number;
    cost?: number;
    errorRate: number;
    timestamp: Date;
  }): Promise<void>;

  getSessionMetrics(sessionId: string): Promise<PerformanceMetrics[]>;

  // Analytics methods
  getAggregatedMetrics(
    timeWindow: 'hour' | 'day' | 'week',
    sessionIds?: string[]
  ): Promise<any>;

  getTopPerformingSessions(limit?: number): Promise<Array<{
    sessionId: string;
    avgResponseTime: number;
    totalMessages: number;
    successRate: number;
  }>>;

  getCostAnalytics(
    timeRange?: { start: Date; end: Date },
    sessionIds?: string[]
  ): Promise<any>;

  getErrorAnalytics(sessionIds?: string[]): Promise<{
    totalErrors: number;
    errorRate: number;
    errorsByType: { [key: string]: number };
  }>;

  getMetricsInTimeRange(
    timeRange: { start: Date; end: Date },
    sessionIds?: string[]
  ): Promise<PerformanceMetrics[]>;

  // Health and status
  getHealthStatus(): Promise<{ healthy: boolean }> | { healthy: boolean };
  getHealthCheck?(): Promise<{ healthy: boolean; details: any }>;
  isReady(): boolean;
  close(): Promise<void> | void;

  // ===============================================
  // SESSION RECORDING METHODS
  // ===============================================

  // Recording management
  createSessionRecording(recording: {
    sessionId: string;
    recordingName?: string;
    description?: string;
    recordedBy?: string;
    recordingQuality?: 'low' | 'medium' | 'high' | 'lossless';
  }): Promise<string>;

  getSessionRecording(recordingId: string): Promise<SessionRecording | null>;
  getAllSessionRecordings(limit?: number): Promise<SessionRecording[]>;
  updateSessionRecording(recordingId: string, updates: Partial<SessionRecording>): Promise<void>;
  deleteSessionRecording(recordingId: string): Promise<void>;
  
  // Recording interactions
  addRecordingInteraction(interaction: {
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
  }): Promise<void>;

  getRecordingInteractions(recordingId: string, startTime?: number, endTime?: number): Promise<RecordingInteraction[]>;
  getRecordingInteractionsByTimeRange(
    recordingId: string, 
    startTimeMs: number, 
    endTimeMs: number
  ): Promise<RecordingInteraction[]>;

  // Playback sessions
  createPlaybackSession(playback: {
    recordingId: string;
    userId?: string;
    playbackName?: string;
    playbackSettings?: PlaybackSettings;
  }): Promise<string>;

  getPlaybackSession(playbackId: string): Promise<PlaybackSession | null>;
  updatePlaybackSession(playbackId: string, updates: {
    currentPositionMs?: number;
    playbackSpeed?: number;
    isPlaying?: boolean;
    isPaused?: boolean;
    totalWatchTimeMs?: number;
    notes?: string;
    playbackSettings?: PlaybackSettings;
  }): Promise<void>;

  getUserPlaybackSessions(userId: string, recordingId?: string): Promise<PlaybackSession[]>;
  deletePlaybackSession(playbackId: string): Promise<void>;

  // Annotations
  addRecordingAnnotation(annotation: {
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
  }): Promise<string>;

  getRecordingAnnotations(recordingId: string, userId?: string): Promise<RecordingAnnotation[]>;
  updateRecordingAnnotation(annotationId: string, updates: Partial<RecordingAnnotation>): Promise<void>;
  deleteRecordingAnnotation(annotationId: string): Promise<void>;

  // Bookmarks
  addRecordingBookmark(bookmark: {
    recordingId: string;
    userId?: string;
    timestampMs: number;
    title: string;
    description?: string;
    bookmarkType?: 'user' | 'system' | 'auto' | 'key_moment';
    icon?: string;
    color?: string;
    chapterMarker?: boolean;
  }): Promise<string>;

  getRecordingBookmarks(recordingId: string, userId?: string): Promise<RecordingBookmark[]>;
  updateRecordingBookmark(bookmarkId: string, updates: Partial<RecordingBookmark>): Promise<void>;
  deleteRecordingBookmark(bookmarkId: string): Promise<void>;

  // Exports
  createRecordingExport(exportRequest: {
    recordingId: string;
    requestedBy?: string;
    exportFormat: 'json' | 'csv' | 'video' | 'html' | 'pdf' | 'zip';
    exportOptions?: ExportOptions;
    includeAnnotations?: boolean;
    includeBookmarks?: boolean;
    includeMetadata?: boolean;
    startTimeMs?: number;
    endTimeMs?: number;
  }): Promise<string>;

  getRecordingExport(exportId: string): Promise<RecordingExport | null>;
  getRecordingExports(recordingId: string): Promise<RecordingExport[]>;
  updateRecordingExport(exportId: string, updates: {
    status?: 'pending' | 'processing' | 'completed' | 'failed';
    filePath?: string;
    fileSizeBytes?: number;
    completedAt?: Date;
    errorMessage?: string;
  }): Promise<void>;
  deleteRecordingExport(exportId: string): Promise<void>;

  // Recording analytics
  getRecordingAnalytics(recordingId: string): Promise<{
    totalViews: number;
    totalWatchTime: number;
    averageWatchTime: number;
    completionRate: number;
    annotationCount: number;
    bookmarkCount: number;
    exportCount: number;
    viewerCount: number;
  }>;

  getPopularRecordings(limit?: number): Promise<Array<{
    recordingId: string;
    recordingName: string;
    viewCount: number;
    downloadCount: number;
    rating?: number;
  }>>;

  // Key moments detection
  detectKeyMoments(recordingId: string): Promise<KeyMoment[]>;
  addKeyMoment(recordingId: string, keyMoment: {
    timestampMs: number;
    title: string;
    description: string;
    momentType: 'error' | 'completion' | 'decision_point' | 'interaction_peak' | 'user_defined';
    importance: 'low' | 'medium' | 'high';
    automaticallyDetected?: boolean;
    relatedInteractionIds?: string[];
  }): Promise<void>;
}