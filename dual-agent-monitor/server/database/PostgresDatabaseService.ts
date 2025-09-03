import { Pool, PoolClient } from 'pg';
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
import { DatabaseInterface } from './DatabaseInterface';

export interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  maxConnections?: number;
}

export class PostgresDatabaseService implements DatabaseInterface {
  private pool: Pool;
  private isInitialized = false;

  constructor(config: PostgresConfig) {
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      max: config.maxConnections || 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 30000,
    });

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('Unexpected database pool error:', err);
    });

    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Test connection
      const client = await this.pool.connect();
      console.log('PostgreSQL database connection established');
      client.release();
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize PostgreSQL database:', error);
      throw error;
    }
  }

  async createSession(sessionData: {
    startTime: Date;
    status: string;
    initialTask: string;
    workDir: string;
  }): Promise<string> {
    const client = await this.pool.connect();
    try {
      const sessionId = uuidv4();
      const query = `
        INSERT INTO sessions (id, start_time, status, initial_task, work_dir)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `;
      
      const result = await client.query(query, [
        sessionId,
        sessionData.startTime,
        sessionData.status,
        sessionData.initialTask,
        sessionData.workDir
      ]);
      
      return result.rows[0].id;
    } finally {
      client.release();
    }
  }

  async updateSessionStatus(sessionId: string, status: string, endTime?: Date): Promise<void> {
    const client = await this.pool.connect();
    try {
      const query = `
        UPDATE sessions 
        SET status = $2, end_time = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `;
      
      await client.query(query, [sessionId, status, endTime]);
    } finally {
      client.release();
    }
  }

  async addMessage(message: {
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
  }): Promise<void> {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO messages (
          id, session_id, agent_type, message_type, content, timestamp,
          parent_message_id, tools_used, files_modified, commands_executed,
          duration, cost, exit_code
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `;
      
      await client.query(query, [
        message.id,
        message.sessionId,
        message.agentType,
        message.messageType,
        message.content,
        message.timestamp,
        message.parentMessageId || null,
        JSON.stringify(message.metadata?.tools || []),
        JSON.stringify(message.metadata?.files || []),
        JSON.stringify(message.metadata?.commands || []),
        message.metadata?.duration || null,
        message.metadata?.cost || null,
        message.metadata?.exitCode || null
      ]);
    } finally {
      client.release();
    }
  }

  async addAgentCommunication(communication: {
    sessionId: string;
    fromAgent: 'manager' | 'worker';
    toAgent: 'manager' | 'worker';
    messageType: string;
    content: string;
    timestamp: Date;
    relatedMessageId?: string;
  }): Promise<void> {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO agent_communications (
          id, session_id, from_agent, to_agent, message_type, content, timestamp, related_message_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;
      
      await client.query(query, [
        uuidv4(),
        communication.sessionId,
        communication.fromAgent,
        communication.toAgent,
        communication.messageType,
        communication.content,
        communication.timestamp,
        communication.relatedMessageId || null
      ]);
    } finally {
      client.release();
    }
  }

  async addSystemEvent(event: {
    id: string;
    sessionId: string;
    eventType: string;
    details: string;
    timestamp: Date;
  }): Promise<void> {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO system_events (id, session_id, event_type, details, timestamp)
        VALUES ($1, $2, $3, $4, $5)
      `;
      
      await client.query(query, [
        event.id,
        event.sessionId,
        event.eventType,
        event.details,
        event.timestamp
      ]);
    } finally {
      client.release();
    }
  }

  async addPerformanceMetric(metric: {
    sessionId: string;
    agentType: 'manager' | 'worker';
    responseTime: number;
    tokensUsed?: number;
    cost?: number;
    errorRate: number;
    timestamp: Date;
  }): Promise<void> {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO performance_metrics (
          id, session_id, agent_type, response_time, tokens_used, cost, error_rate, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;
      
      await client.query(query, [
        uuidv4(),
        metric.sessionId,
        metric.agentType,
        metric.responseTime,
        metric.tokensUsed || null,
        metric.cost || null,
        metric.errorRate,
        metric.timestamp
      ]);
    } finally {
      client.release();
    }
  }

  async getSession(sessionId: string): Promise<DualAgentSession | null> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT s.*, ss.total_messages, ss.manager_messages, ss.worker_messages,
               ss.total_duration, ss.total_cost, ss.success_rate
        FROM sessions s
        LEFT JOIN session_summaries ss ON s.id = ss.session_id
        WHERE s.id = $1
      `;
      
      const result = await client.query(query, [sessionId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      return {
        id: row.id,
        startTime: row.start_time,
        endTime: row.end_time,
        status: row.status,
        initialTask: row.initial_task,
        workDir: row.work_dir,
        messages: await this.getSessionMessages(sessionId)
      };
    } finally {
      client.release();
    }
  }

  async getSessionMessages(sessionId: string): Promise<AgentMessage[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM messages 
        WHERE session_id = $1 
        ORDER BY timestamp ASC
      `;
      
      const result = await client.query(query, [sessionId]);
      
      return result.rows.map(row => ({
        id: row.id,
        sessionId: row.session_id,
        agentType: row.agent_type,
        messageType: row.message_type,
        content: row.content,
        timestamp: row.timestamp,
        parentMessageId: row.parent_message_id,
        metadata: {
          tools: row.tools_used ? JSON.parse(row.tools_used) : [],
          files: row.files_modified ? JSON.parse(row.files_modified) : [],
          commands: row.commands_executed ? JSON.parse(row.commands_executed) : [],
          duration: row.duration,
          cost: row.cost,
          exitCode: row.exit_code
        }
      }));
    } finally {
      client.release();
    }
  }

  async getSessionCommunications(sessionId: string): Promise<AgentCommunication[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM agent_communications 
        WHERE session_id = $1 
        ORDER BY timestamp ASC
      `;
      
      const result = await client.query(query, [sessionId]);
      
      return result.rows.map(row => ({
        id: row.id,
        sessionId: row.session_id,
        fromAgent: row.from_agent,
        toAgent: row.to_agent,
        messageType: row.message_type,
        content: row.content,
        timestamp: row.timestamp,
        relatedMessageId: row.related_message_id
      }));
    } finally {
      client.release();
    }
  }

  async getSessionEvents(sessionId: string): Promise<SystemEvent[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM system_events 
        WHERE session_id = $1 
        ORDER BY timestamp ASC
      `;
      
      const result = await client.query(query, [sessionId]);
      
      return result.rows.map(row => ({
        id: row.id,
        sessionId: row.session_id,
        eventType: row.event_type,
        details: row.details,
        timestamp: row.timestamp
      }));
    } finally {
      client.release();
    }
  }

  async getSessionMetrics(sessionId: string): Promise<PerformanceMetrics[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM performance_metrics 
        WHERE session_id = $1 
        ORDER BY timestamp ASC
      `;
      
      const result = await client.query(query, [sessionId]);
      
      return result.rows.map(row => ({
        id: row.id,
        sessionId: row.session_id,
        agentType: row.agent_type,
        responseTime: row.response_time,
        tokensUsed: row.tokens_used,
        cost: row.cost,
        errorRate: row.error_rate,
        timestamp: row.timestamp
      }));
    } finally {
      client.release();
    }
  }

  async getAllSessions(limit: number = 50): Promise<DualAgentSession[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT s.*, ss.total_messages, ss.manager_messages, ss.worker_messages,
               ss.total_duration, ss.total_cost, ss.success_rate
        FROM sessions s
        LEFT JOIN session_summaries ss ON s.id = ss.session_id
        ORDER BY s.start_time DESC
        LIMIT $1
      `;
      
      const result = await client.query(query, [limit]);
      
      return Promise.all(result.rows.map(async (row) => {
        return {
          id: row.id,
          startTime: row.start_time,
          endTime: row.end_time,
          status: row.status,
          initialTask: row.initial_task,
          workDir: row.work_dir,
          messages: await this.getSessionMessages(row.id)
        };
      }));
    } finally {
      client.release();
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      const query = 'DELETE FROM sessions WHERE id = $1';
      await client.query(query, [sessionId]);
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    console.log('PostgreSQL database connection closed');
  }

  async getHealthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      const client = await this.pool.connect();
      const result = await client.query('SELECT 1 as test');
      client.release();
      
      return {
        healthy: true,
        details: {
          connected: true,
          type: 'postgresql',
          tablesCount: await this.getTablesCount()
        }
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          connected: false,
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  private async getTablesCount(): Promise<number> {
    try {
      const client = await this.pool.connect();
      const result = await client.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      client.release();
      return parseInt(result.rows[0].count);
    } catch (error) {
      return 0;
    }
  }

  // Additional methods required by websocket-server.ts
  async getAggregatedMetrics(
    timeWindow: 'hour' | 'day' | 'week',
    sessionIds?: string[]
  ): Promise<any> {
    const client = await this.pool.connect();
    try {
      let timeFormat: string;
      switch (timeWindow) {
        case 'hour':
          timeFormat = 'YYYY-MM-DD HH24:00:00';
          break;
        case 'day':
          timeFormat = 'YYYY-MM-DD';
          break;
        case 'week':
          timeFormat = 'YYYY-WW';
          break;
      }
      
      let query = `
        SELECT 
          TO_CHAR(timestamp, $1) as time_window,
          AVG(response_time) as avg_response_time,
          COUNT(*) as total_requests,
          AVG(error_rate) as avg_error_rate,
          SUM(cost) as total_cost
        FROM performance_metrics 
        WHERE 1=1
      `;
      
      const params = [timeFormat];
      
      if (sessionIds && sessionIds.length > 0) {
        query += ` AND session_id = ANY($2)`;
        params.push(sessionIds as any);
      }
      
      query += ' GROUP BY time_window ORDER BY time_window DESC';
      
      const result = await client.query(query, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async getTopPerformingSessions(limit: number = 10): Promise<Array<{
    sessionId: string;
    avgResponseTime: number;
    totalMessages: number;
    successRate: number;
  }>> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT 
          s.id as session_id,
          AVG(pm.response_time) as avg_response_time,
          COUNT(m.id) as total_messages,
          (1.0 - AVG(pm.error_rate)) as success_rate
        FROM sessions s
        LEFT JOIN messages m ON s.id = m.session_id
        LEFT JOIN performance_metrics pm ON s.id = pm.session_id
        GROUP BY s.id
        ORDER BY success_rate DESC, avg_response_time ASC
        LIMIT $1
      `;
      
      const result = await client.query(query, [limit]);
      return result.rows.map(row => ({
        sessionId: row.session_id,
        avgResponseTime: parseFloat(row.avg_response_time) || 0,
        totalMessages: parseInt(row.total_messages) || 0,
        successRate: parseFloat(row.success_rate) || 0
      }));
    } finally {
      client.release();
    }
  }

  async getCostAnalytics(
    timeRange?: { start: Date; end: Date },
    sessionIds?: string[]
  ): Promise<any> {
    const client = await this.pool.connect();
    try {
      let query = `
        SELECT 
          SUM(cost) as total_cost,
          AVG(cost) as avg_cost,
          COUNT(*) as total_operations
        FROM performance_metrics 
        WHERE cost IS NOT NULL
      `;
      
      const params: any[] = [];
      let paramIndex = 1;
      
      if (timeRange) {
        query += ` AND timestamp >= $${paramIndex} AND timestamp <= $${paramIndex + 1}`;
        params.push(timeRange.start, timeRange.end);
        paramIndex += 2;
      }
      
      if (sessionIds && sessionIds.length > 0) {
        query += ` AND session_id = ANY($${paramIndex})`;
        params.push(sessionIds);
      }
      
      const result = await client.query(query, params);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async getErrorAnalytics(sessionIds?: string[]): Promise<{
    totalErrors: number;
    errorRate: number;
    errorsByType: { [key: string]: number };
  }> {
    const client = await this.pool.connect();
    try {
      let query = `
        SELECT 
          COUNT(*) as total_requests,
          SUM(CASE WHEN error_rate > 0 THEN 1 ELSE 0 END) as total_errors,
          AVG(error_rate) as avg_error_rate
        FROM performance_metrics
        WHERE 1=1
      `;
      
      const params: any[] = [];
      
      if (sessionIds && sessionIds.length > 0) {
        query += ` AND session_id = ANY($1)`;
        params.push(sessionIds);
      }
      
      const result = await client.query(query, params);
      const row = result.rows[0];
      
      return {
        totalErrors: parseInt(row.total_errors) || 0,
        errorRate: parseFloat(row.avg_error_rate) || 0,
        errorsByType: {} // TODO: Implement error type tracking
      };
    } finally {
      client.release();
    }
  }

  async getMetricsInTimeRange(
    timeRange: { start: Date; end: Date },
    sessionIds?: string[]
  ): Promise<PerformanceMetrics[]> {
    const client = await this.pool.connect();
    try {
      let query = `
        SELECT * FROM performance_metrics 
        WHERE timestamp >= $1 AND timestamp <= $2
      `;
      
      const params = [timeRange.start, timeRange.end];
      
      if (sessionIds && sessionIds.length > 0) {
        query += ` AND session_id = ANY($3)`;
        params.push(sessionIds as any);
      }
      
      query += ' ORDER BY timestamp ASC';
      
      const result = await client.query(query, params);
      return result.rows.map(row => ({
        id: row.id,
        sessionId: row.session_id,
        agentType: row.agent_type,
        responseTime: row.response_time,
        tokensUsed: row.tokens_used,
        cost: row.cost,
        errorRate: row.error_rate,
        timestamp: row.timestamp
      }));
    } finally {
      client.release();
    }
  }

  async getHealthStatus(): Promise<{ healthy: boolean }> {
    const healthCheck = await this.getHealthCheck();
    return { healthy: healthCheck.healthy };
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  // ===============================================
  // SESSION RECORDING METHODS - STUB IMPLEMENTATIONS
  // ===============================================

  async createSessionRecording(recording: {
    sessionId: string;
    recordingName?: string;
    description?: string;
    recordedBy?: string;
    recordingQuality?: 'low' | 'medium' | 'high' | 'lossless';
  }): Promise<string> {
    // Stub implementation - returns a UUID
    return uuidv4();
  }

  async getSessionRecording(recordingId: string): Promise<SessionRecording | null> {
    // Stub implementation - returns null
    return null;
  }

  async getAllSessionRecordings(limit?: number): Promise<SessionRecording[]> {
    // Stub implementation - returns empty array
    return [];
  }

  async updateSessionRecording(recordingId: string, updates: Partial<SessionRecording>): Promise<void> {
    // Stub implementation - does nothing
  }

  async deleteSessionRecording(recordingId: string): Promise<void> {
    // Stub implementation - does nothing
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
    // Stub implementation - does nothing
  }

  async getRecordingInteractions(recordingId: string, startTime?: number, endTime?: number): Promise<RecordingInteraction[]> {
    // Stub implementation - returns empty array
    return [];
  }

  async getRecordingInteractionsByTimeRange(
    recordingId: string, 
    startTimeMs: number, 
    endTimeMs: number
  ): Promise<RecordingInteraction[]> {
    // Stub implementation - returns empty array
    return [];
  }

  async createPlaybackSession(playback: {
    recordingId: string;
    userId?: string;
    playbackName?: string;
    playbackSettings?: PlaybackSettings;
  }): Promise<string> {
    // Stub implementation - returns a UUID
    return uuidv4();
  }

  async getPlaybackSession(playbackId: string): Promise<PlaybackSession | null> {
    // Stub implementation - returns null
    return null;
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
    // Stub implementation - does nothing
  }

  async getUserPlaybackSessions(userId: string, recordingId?: string): Promise<PlaybackSession[]> {
    // Stub implementation - returns empty array
    return [];
  }

  async deletePlaybackSession(playbackId: string): Promise<void> {
    // Stub implementation - does nothing
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
    // Stub implementation - returns a UUID
    return uuidv4();
  }

  async getRecordingAnnotations(recordingId: string, userId?: string): Promise<RecordingAnnotation[]> {
    // Stub implementation - returns empty array
    return [];
  }

  async updateRecordingAnnotation(annotationId: string, updates: Partial<RecordingAnnotation>): Promise<void> {
    // Stub implementation - does nothing
  }

  async deleteRecordingAnnotation(annotationId: string): Promise<void> {
    // Stub implementation - does nothing
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
    // Stub implementation - returns a UUID
    return uuidv4();
  }

  async getRecordingBookmarks(recordingId: string, userId?: string): Promise<RecordingBookmark[]> {
    // Stub implementation - returns empty array
    return [];
  }

  async updateRecordingBookmark(bookmarkId: string, updates: Partial<RecordingBookmark>): Promise<void> {
    // Stub implementation - does nothing
  }

  async deleteRecordingBookmark(bookmarkId: string): Promise<void> {
    // Stub implementation - does nothing
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
    // Stub implementation - returns a UUID
    return uuidv4();
  }

  async getRecordingExport(exportId: string): Promise<RecordingExport | null> {
    // Stub implementation - returns null
    return null;
  }

  async getRecordingExports(recordingId: string): Promise<RecordingExport[]> {
    // Stub implementation - returns empty array
    return [];
  }

  async updateRecordingExport(exportId: string, updates: {
    status?: 'pending' | 'processing' | 'completed' | 'failed';
    filePath?: string;
    fileSizeBytes?: number;
    completedAt?: Date;
    errorMessage?: string;
  }): Promise<void> {
    // Stub implementation - does nothing
  }

  async deleteRecordingExport(exportId: string): Promise<void> {
    // Stub implementation - does nothing
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
    // Stub implementation - returns zero values
    return {
      totalViews: 0,
      totalWatchTime: 0,
      averageWatchTime: 0,
      completionRate: 0,
      annotationCount: 0,
      bookmarkCount: 0,
      exportCount: 0,
      viewerCount: 0
    };
  }

  async getPopularRecordings(limit?: number): Promise<Array<{
    recordingId: string;
    recordingName: string;
    viewCount: number;
    downloadCount: number;
    rating?: number;
  }>> {
    // Stub implementation - returns empty array
    return [];
  }

  async detectKeyMoments(recordingId: string): Promise<KeyMoment[]> {
    // Stub implementation - returns empty array
    return [];
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
    // Stub implementation - does nothing
  }
}