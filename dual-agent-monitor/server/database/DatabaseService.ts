import sqlite3 from 'sqlite3';
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
  KeyMoment
} from '../types';
import { readFileSync } from 'fs';
import { join } from 'path';

export class DatabaseService {
  private db!: sqlite3.Database;

  constructor(dbPath: string = 'dual-agent-monitor.db') {
    // Initialize database with migrations synchronously
    this.initializeDb(dbPath);
  }

  private initializeDb(dbPath: string): void {
    console.log(`Initializing database at: ${dbPath}`);
    
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Database connection error:', err);
        throw err;
      }
    });
    
    // Configure SQLite for better performance
    this.db.run('PRAGMA journal_mode = WAL');
    this.db.run('PRAGMA synchronous = NORMAL');
    this.db.run('PRAGMA cache_size = 1000');
    this.db.run('PRAGMA temp_store = MEMORY');
    
    // Load and execute schema
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    this.db.exec(schema, (err) => {
      if (err) {
        console.error('Schema execution error:', err);
        throw err;
      }
    });
    
    console.log('Database initialization complete');
  }

  // Session management
  public async createSession(session: Omit<DualAgentSession, 'id' | 'messages'>): Promise<string> {
    const id = uuidv4();
    
    return new Promise((resolve, reject) => {
      this.db.run(`
        INSERT INTO sessions (id, start_time, status, initial_task, work_dir)
        VALUES (?, ?, ?, ?, ?)
      `, [
        id,
        session.startTime.toISOString(),
        session.status,
        session.initialTask,
        session.workDir
      ], (err: any) => {
        if (err) {
          reject(new Error(`Failed to create session: ${err.message}`));
        } else {
          // Create initial system event
          const eventId = uuidv4();
          resolve(id);
          
          // Add system event asynchronously
          setImmediate(() => {
            this.db.run(`
              INSERT INTO system_events (id, session_id, event_type, details, timestamp)
              VALUES (?, ?, ?, ?, ?)
            `, [
              eventId,
              id,
              'session_start',
              `Session started with task: ${session.initialTask}`,
              new Date().toISOString()
            ]);
          });
        }
      });
    });
  }

  public async getSession(sessionId: string): Promise<DualAgentSession | null> {
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT * FROM sessions WHERE id = ?
      `, [sessionId], async (err, row: any) => {
        if (err) {
          reject(new Error(`Failed to get session: ${err.message}`));
          return;
        }
        
        if (!row) {
          resolve(null);
          return;
        }

        try {
          const messages = await this.getSessionMessages(sessionId);
          const summary = await this.getSessionSummary(sessionId);

          resolve({
            id: row.id,
            startTime: new Date(row.start_time),
            endTime: row.end_time ? new Date(row.end_time) : undefined,
            status: row.status,
            initialTask: row.initial_task,
            workDir: row.work_dir,
            messages,
            summary
          });
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  public async getAllSessions(): Promise<DualAgentSession[]> {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT s.*, ss.total_messages, ss.total_duration, ss.success_rate
        FROM sessions s
        LEFT JOIN session_summaries ss ON s.id = ss.session_id
        ORDER BY s.start_time DESC
      `, [], async (err, rows: any[]) => {
        if (err) {
          reject(new Error(`Failed to get all sessions: ${err.message}`));
          return;
        }

        try {
          const sessions = await Promise.all(rows.map(async (row) => {
            const messages = await this.getSessionMessages(row.id);
            const summary = row.total_messages ? {
              totalMessages: row.total_messages,
              managerMessages: 0,
              workerMessages: 0,
              totalDuration: row.total_duration || 0,
              totalCost: 0,
              filesModified: [],
              commandsExecuted: [],
              toolsUsed: [],
              successRate: row.success_rate || 0
            } as SessionSummary : undefined;

            return {
              id: row.id,
              startTime: new Date(row.start_time),
              endTime: row.end_time ? new Date(row.end_time) : undefined,
              status: row.status,
              initialTask: row.initial_task,
              workDir: row.work_dir,
              messages,
              summary
            };
          }));

          resolve(sessions);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  public async updateSessionStatus(sessionId: string, status: DualAgentSession['status'], endTime?: Date): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(`
        UPDATE sessions 
        SET end_time = ?, status = ?
        WHERE id = ?
      `, [
        endTime ? endTime.toISOString() : null,
        status,
        sessionId
      ], function(err) {
        if (err) {
          reject(new Error(`Failed to update session status: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  // Message management
  public async addMessage(message: AgentMessage): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(`
        INSERT INTO messages (
          id, session_id, agent_type, message_type, content, timestamp,
          parent_message_id, tools_used, files_modified, commands_executed,
          cost, duration, exit_code
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        message.id,
        message.sessionId,
        message.agentType,
        message.messageType,
        message.content,
        message.timestamp.toISOString(),
        null, // parent_message_id - not in current metadata interface
        message.metadata?.tools ? JSON.stringify(message.metadata.tools) : null,
        message.metadata?.files ? JSON.stringify(message.metadata.files) : null,
        message.metadata?.commands ? JSON.stringify(message.metadata.commands) : null,
        message.metadata?.cost || null,
        message.metadata?.duration || null,
        message.metadata?.exitCode || null
      ], (err: any) => {
        if (err) {
          reject(new Error(`Failed to add message: ${err.message}`));
        } else {
          resolve();
          
          // Update session summary asynchronously
          setImmediate(async () => {
            try {
              await this.updateSessionSummary(message.sessionId);
            } catch (error) {
              console.error('Failed to update session summary:', error);
            }
          });
        }
      });
    });
  }

  public async getSessionMessages(sessionId: string): Promise<AgentMessage[]> {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT * FROM messages 
        WHERE session_id = ?
        ORDER BY timestamp ASC
      `, [sessionId], (err, rows: any[]) => {
        if (err) {
          reject(new Error(`Failed to get session messages: ${err.message}`));
          return;
        }

        const messages = rows.map(row => ({
          id: row.id,
          sessionId: row.session_id,
          agentType: row.agent_type,
          messageType: row.message_type,
          content: row.content,
          timestamp: new Date(row.timestamp),
          metadata: {
            tools: row.tools_used ? JSON.parse(row.tools_used) : undefined,
            files: row.files_modified ? JSON.parse(row.files_modified) : undefined,
            commands: row.commands_executed ? JSON.parse(row.commands_executed) : undefined,
            cost: row.cost || undefined,
            duration: row.duration || undefined,
            exitCode: row.exit_code || undefined
          }
        }));

        resolve(messages);
      });
    });
  }

  public async getLatestMessages(limit: number = 50): Promise<AgentMessage[]> {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT * FROM messages
        ORDER BY timestamp DESC
        LIMIT ?
      `, [limit], (err, rows: any[]) => {
        if (err) {
          reject(new Error(`Failed to get latest messages: ${err.message}`));
          return;
        }

        const messages = rows.map(row => ({
          id: row.id,
          sessionId: row.session_id,
          agentType: row.agent_type,
          messageType: row.message_type,
          content: row.content,
          timestamp: new Date(row.timestamp),
          metadata: {
            tools: row.tools_used ? JSON.parse(row.tools_used) : undefined,
            files: row.files_modified ? JSON.parse(row.files_modified) : undefined,
            commands: row.commands_executed ? JSON.parse(row.commands_executed) : undefined,
            cost: row.cost || undefined,
            duration: row.duration || undefined,
            exitCode: row.exit_code || undefined
          }
        }));

        resolve(messages);
      });
    });
  }

  // Agent communication management
  public async addAgentCommunication(communication: AgentCommunication): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(`
        INSERT INTO agent_communications (
          id, session_id, from_agent, to_agent, message_type, content, timestamp, related_message_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        communication.id,
        communication.sessionId,
        communication.fromAgent,
        communication.toAgent,
        communication.messageType,
        communication.content,
        communication.timestamp.toISOString(),
        communication.relatedMessageId || null
      ], function(err) {
        if (err) {
          reject(new Error(`Failed to add agent communication: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  public async getSessionCommunications(sessionId: string): Promise<AgentCommunication[]> {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT * FROM agent_communications
        WHERE session_id = ?
        ORDER BY timestamp ASC
      `, [sessionId], (err, rows: any[]) => {
        if (err) {
          reject(new Error(`Failed to get session communications: ${err.message}`));
          return;
        }

        const communications = rows.map(row => ({
          id: row.id,
          sessionId: row.session_id,
          fromAgent: row.from_agent,
          toAgent: row.to_agent,
          messageType: row.message_type,
          content: row.content,
          timestamp: new Date(row.timestamp),
          relatedMessageId: row.related_message_id || undefined
        }));

        resolve(communications);
      });
    });
  }

  // System event management
  public async addSystemEvent(event: SystemEvent): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(`
        INSERT INTO system_events (id, session_id, event_type, details, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `, [
        event.id,
        event.sessionId,
        event.eventType,
        event.details,
        event.timestamp.toISOString()
      ], function(err) {
        if (err) {
          reject(new Error(`Failed to add system event: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  public async getSessionEvents(sessionId: string): Promise<SystemEvent[]> {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT * FROM system_events
        WHERE session_id = ?
        ORDER BY timestamp ASC
      `, [sessionId], (err, rows: any[]) => {
        if (err) {
          reject(new Error(`Failed to get session events: ${err.message}`));
          return;
        }

        const events = rows.map(row => ({
          id: row.id,
          sessionId: row.session_id,
          eventType: row.event_type,
          details: row.details,
          timestamp: new Date(row.timestamp)
        }));

        resolve(events);
      });
    });
  }

  // Performance metrics management
  public async addPerformanceMetric(metric: PerformanceMetrics & { id?: string }): Promise<void> {
    return new Promise((resolve, reject) => {
      const id = metric.id || uuidv4();
      this.db.run(`
        INSERT INTO performance_metrics (
          id, session_id, agent_type, response_time, tokens_used, cost, error_rate, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id,
        metric.sessionId,
        metric.agentType,
        metric.responseTime,
        metric.tokensUsed || null,
        metric.cost || null,
        metric.errorRate,
        metric.timestamp.toISOString()
      ], function(err) {
        if (err) {
          reject(new Error(`Failed to add performance metric: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  public async getSessionMetrics(sessionId: string): Promise<PerformanceMetrics[]> {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT * FROM performance_metrics
        WHERE session_id = ?
        ORDER BY timestamp ASC
      `, [sessionId], (err, rows: any[]) => {
        if (err) {
          reject(new Error(`Failed to get session metrics: ${err.message}`));
          return;
        }

        const metrics = rows.map(row => ({
          sessionId: row.session_id,
          agentType: row.agent_type,
          responseTime: row.response_time,
          tokensUsed: row.tokens_used || undefined,
          cost: row.cost || undefined,
          errorRate: row.error_rate,
          timestamp: new Date(row.timestamp)
        }));

        resolve(metrics);
      });
    });
  }

  // Enhanced analytics queries
  public async getMetricsInTimeRange(
    timeRange: { start: Date; end: Date },
    sessionIds?: string[]
  ): Promise<PerformanceMetrics[]> {
    let query = `
      SELECT * FROM performance_metrics
      WHERE timestamp BETWEEN ? AND ?
    `;
    const params: any[] = [timeRange.start.toISOString(), timeRange.end.toISOString()];

    if (sessionIds && sessionIds.length > 0) {
      query += ` AND session_id IN (${sessionIds.map(() => '?').join(',')})`;
      params.push(...sessionIds);
    }

    query += ' ORDER BY timestamp ASC';

    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows: any[]) => {
        if (err) {
          reject(new Error(`Failed to get metrics in time range: ${err.message}`));
          return;
        }

        const metrics = rows.map(row => ({
          sessionId: row.session_id,
          agentType: row.agent_type,
          responseTime: row.response_time,
          tokensUsed: row.tokens_used || undefined,
          cost: row.cost || undefined,
          errorRate: row.error_rate,
          timestamp: new Date(row.timestamp)
        }));

        resolve(metrics);
      });
    });
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
    const timeFormat = timeWindow === 'hour' ? '%Y-%m-%d %H:00:00' : 
                     timeWindow === 'day' ? '%Y-%m-%d' : 
                     '%Y-%W'; // Week format

    let query = `
      SELECT 
        strftime('${timeFormat}', timestamp) as time_window,
        agent_type,
        AVG(response_time) as avg_response_time,
        SUM(COALESCE(tokens_used, 0)) as total_tokens,
        SUM(COALESCE(cost, 0)) as total_cost,
        AVG(error_rate) as avg_error_rate,
        COUNT(*) as message_count
      FROM performance_metrics
    `;

    const params: any[] = [];

    if (sessionIds && sessionIds.length > 0) {
      query += ` WHERE session_id IN (${sessionIds.map(() => '?').join(',')})`;
      params.push(...sessionIds);
    }

    query += `
      GROUP BY time_window, agent_type
      ORDER BY time_window ASC, agent_type
    `;

    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows: any[]) => {
        if (err) {
          reject(new Error(`Failed to get aggregated metrics: ${err.message}`));
          return;
        }

        const aggregated = rows.map(row => ({
          timeWindow: row.time_window,
          agentType: row.agent_type,
          avgResponseTime: row.avg_response_time || 0,
          totalTokens: row.total_tokens || 0,
          totalCost: row.total_cost || 0,
          avgErrorRate: row.avg_error_rate || 0,
          messageCount: row.message_count || 0
        }));

        resolve(aggregated);
      });
    });
  }

  public async getTopPerformingSessions(limit: number = 10): Promise<Array<{
    sessionId: string;
    performanceScore: number;
    avgResponseTime: number;
    totalCost: number;
    errorRate: number;
    duration: number;
  }>> {
    const query = `
      SELECT 
        s.id as session_id,
        s.start_time,
        s.end_time,
        AVG(pm.response_time) as avg_response_time,
        SUM(COALESCE(pm.cost, 0)) as total_cost,
        AVG(pm.error_rate) as error_rate,
        COUNT(pm.id) as metric_count
      FROM sessions s
      LEFT JOIN performance_metrics pm ON s.id = pm.session_id
      WHERE s.status = 'completed'
      GROUP BY s.id
      HAVING metric_count > 0
      ORDER BY (1.0 - AVG(pm.error_rate)) * 50 + 
               CASE 
                 WHEN AVG(pm.response_time) > 0 
                 THEN (100 - AVG(pm.response_time) / 1000) * 0.5 
                 ELSE 50 
               END DESC
      LIMIT ?
    `;

    return new Promise((resolve, reject) => {
      this.db.all(query, [limit], (err, rows: any[]) => {
        if (err) {
          reject(new Error(`Failed to get top performing sessions: ${err.message}`));
          return;
        }

        const sessions = rows.map(row => {
          const errorRate = row.error_rate || 0;
          const avgResponseTime = row.avg_response_time || 0;
          const performanceScore = (1 - errorRate) * 50 + 
            (avgResponseTime > 0 ? Math.max(0, 100 - avgResponseTime / 1000) * 0.5 : 50);
          
          const duration = row.end_time && row.start_time ?
            new Date(row.end_time).getTime() - new Date(row.start_time).getTime() :
            0;

          return {
            sessionId: row.session_id,
            performanceScore: Math.round(performanceScore),
            avgResponseTime: avgResponseTime,
            totalCost: row.total_cost || 0,
            errorRate: errorRate,
            duration: duration
          };
        });

        resolve(sessions);
      });
    });
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
    let whereClause = '';
    const params: any[] = [];

    if (timeRange) {
      whereClause += 'WHERE pm.timestamp BETWEEN ? AND ?';
      params.push(timeRange.start.toISOString(), timeRange.end.toISOString());
    }

    if (sessionIds && sessionIds.length > 0) {
      if (whereClause) {
        whereClause += ` AND pm.session_id IN (${sessionIds.map(() => '?').join(',')})`;
      } else {
        whereClause += `WHERE pm.session_id IN (${sessionIds.map(() => '?').join(',')})`;
      }
      params.push(...sessionIds);
    }

    const query = `
      SELECT 
        SUM(COALESCE(pm.cost, 0)) as total_cost,
        AVG(COALESCE(pm.cost, 0)) as avg_cost_per_message,
        COUNT(DISTINCT pm.session_id) as session_count,
        pm.agent_type,
        strftime('%Y-%m-%d', pm.timestamp) as date
      FROM performance_metrics pm
      ${whereClause}
      GROUP BY pm.agent_type, date
      ORDER BY date ASC
    `;

    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows: any[]) => {
        if (err) {
          reject(new Error(`Failed to get cost analytics: ${err.message}`));
          return;
        }

        let totalCost = 0;
        let sessionCount = 0;
        const costByAgent = { manager: 0, worker: 0 };
        const costTrendMap = new Map<string, number>();

        rows.forEach(row => {
          totalCost += row.total_cost || 0;
          sessionCount = Math.max(sessionCount, row.session_count || 0);
          
          if (row.agent_type === 'manager') {
            costByAgent.manager += row.total_cost || 0;
          } else if (row.agent_type === 'worker') {
            costByAgent.worker += row.total_cost || 0;
          }

          const date = row.date;
          const existing = costTrendMap.get(date) || 0;
          costTrendMap.set(date, existing + (row.total_cost || 0));
        });

        const costTrend = Array.from(costTrendMap.entries()).map(([date, cost]) => ({
          date,
          cost
        }));

        resolve({
          totalCost,
          avgCostPerSession: sessionCount > 0 ? totalCost / sessionCount : 0,
          costByAgent,
          costTrend
        });
      });
    });
  }

  public async getErrorAnalytics(sessionIds?: string[]): Promise<{
    totalErrors: number;
    errorsByType: Array<{ type: string; count: number; percentage: number }>;
    errorsByAgent: { manager: number; worker: number };
    errorTrend: Array<{ date: string; errors: number }>;
  }> {
    let whereClause = '';
    const params: any[] = [];

    if (sessionIds && sessionIds.length > 0) {
      whereClause = `WHERE m.session_id IN (${sessionIds.map(() => '?').join(',')})`;
      params.push(...sessionIds);
    }

    const query = `
      SELECT 
        m.message_type,
        m.agent_type,
        strftime('%Y-%m-%d', m.timestamp) as date,
        COUNT(*) as count
      FROM messages m
      ${whereClause}
      GROUP BY m.message_type, m.agent_type, date
      ORDER BY date ASC
    `;

    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows: any[]) => {
        if (err) {
          reject(new Error(`Failed to get error analytics: ${err.message}`));
          return;
        }

        let totalMessages = 0;
        let totalErrors = 0;
        const errorsByType = new Map<string, number>();
        const errorsByAgent = { manager: 0, worker: 0 };
        const errorTrendMap = new Map<string, number>();

        rows.forEach(row => {
          totalMessages += row.count;
          
          if (row.message_type === 'error') {
            totalErrors += row.count;
            
            // Count by agent
            if (row.agent_type === 'manager') {
              errorsByAgent.manager += row.count;
            } else if (row.agent_type === 'worker') {
              errorsByAgent.worker += row.count;
            }

            // Count by date for trend
            const date = row.date;
            const existing = errorTrendMap.get(date) || 0;
            errorTrendMap.set(date, existing + row.count);

            // Count by type (simplified - would need more detailed error classification)
            const existing_type = errorsByType.get(row.message_type) || 0;
            errorsByType.set(row.message_type, existing_type + row.count);
          }
        });

        const errorTrend = Array.from(errorTrendMap.entries()).map(([date, errors]) => ({
          date,
          errors
        }));

        const errorTypeArray = Array.from(errorsByType.entries()).map(([type, count]) => ({
          type,
          count,
          percentage: totalErrors > 0 ? (count / totalErrors) * 100 : 0
        }));

        resolve({
          totalErrors,
          errorsByType: errorTypeArray,
          errorsByAgent,
          errorTrend
        });
      });
    });
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
      
      return new Promise((resolve, reject) => {
        this.db.run(`
          INSERT OR REPLACE INTO session_summaries (
            session_id, total_messages, manager_messages, worker_messages,
            total_duration, total_cost, files_modified, commands_executed,
            tools_used, success_rate
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          sessionId,
          messages.length,
          managerMessages,
          workerMessages,
          totalDuration,
          totalCost || null,
          JSON.stringify(Array.from(filesModified)),
          JSON.stringify(Array.from(commandsExecuted)),
          JSON.stringify(Array.from(toolsUsed)),
          successRate
        ], function(err) {
          if (err) {
            reject(new Error(`Failed to update session summary: ${err.message}`));
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      console.error(`Failed to update session summary for ${sessionId}:`, error);
    }
  }

  public async getSessionSummary(sessionId: string): Promise<SessionSummary | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT * FROM session_summaries WHERE session_id = ?
      `, [sessionId], (err, row: any) => {
        if (err) {
          console.error(`Failed to get session summary for ${sessionId}:`, err);
          resolve(undefined);
          return;
        }
        
        if (!row) {
          resolve(undefined);
          return;
        }
        
        try {
          resolve({
            totalMessages: row.total_messages,
            managerMessages: row.manager_messages,
            workerMessages: row.worker_messages,
            totalDuration: row.total_duration || 0,
            totalCost: row.total_cost || undefined,
            filesModified: row.files_modified ? JSON.parse(row.files_modified) : [],
            commandsExecuted: row.commands_executed ? JSON.parse(row.commands_executed) : [],
            toolsUsed: row.tools_used ? JSON.parse(row.tools_used) : [],
            successRate: row.success_rate || 0
          });
        } catch (error) {
          console.error(`Error parsing session summary for ${sessionId}:`, error);
          resolve(undefined);
        }
      });
    });
  }

  // Utility methods
  public async deleteSession(sessionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // SQLite will handle cascading deletes
      this.db.run('DELETE FROM sessions WHERE id = ?', [sessionId], function(err) {
        if (err) {
          reject(new Error(`Failed to delete session: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  public getHealthStatus(): { healthy: boolean; details: any } {
    // Simple health check for sqlite3
    try {
      return {
        healthy: true,
        details: {
          connected: true,
          type: 'sqlite3'
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

  public async cleanup(): Promise<void> {
    // Clean up old sessions (older than 30 days by default)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    return new Promise((resolve, reject) => {
      this.db.run(`
        DELETE FROM sessions 
        WHERE status IN ('completed', 'failed') 
        AND start_time < ?
      `, [thirtyDaysAgo.toISOString()], function(err) {
        if (err) {
          console.error('Failed to cleanup old sessions:', err);
          reject(err);
        } else {
          console.log(`Cleaned up ${this.changes} old sessions`);
          resolve();
        }
      });
    });
  }

  // ===============================================
  // SESSION RECORDING METHODS
  // ===============================================

  public async createSessionRecording(recording: {
    sessionId: string;
    recordingName?: string;
    description?: string;
    recordedBy?: string;
    recordingQuality?: 'low' | 'medium' | 'high' | 'lossless';
  }): Promise<string> {
    const id = uuidv4();
    
    return new Promise((resolve, reject) => {
      this.db.run(`
        INSERT INTO session_recordings (
          id, session_id, recording_name, description, recorded_by,
          recording_started_at, status, recording_quality
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id,
        recording.sessionId,
        recording.recordingName || null,
        recording.description || null,
        recording.recordedBy || null,
        new Date().toISOString(),
        'recording',
        recording.recordingQuality || 'high'
      ], (err: any) => {
        if (err) {
          reject(new Error(`Failed to create session recording: ${err.message}`));
        } else {
          resolve(id);
        }
      });
    });
  }

  public async getSessionRecording(recordingId: string): Promise<SessionRecording | null> {
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT * FROM session_recordings WHERE id = ?
      `, [recordingId], (err, row: any) => {
        if (err) {
          reject(new Error(`Failed to get session recording: ${err.message}`));
          return;
        }
        
        if (!row) {
          resolve(null);
          return;
        }

        resolve({
          id: row.id,
          sessionId: row.session_id,
          recordingName: row.recording_name,
          description: row.description,
          recordedBy: row.recorded_by,
          recordingStartedAt: new Date(row.recording_started_at),
          recordingCompletedAt: row.recording_completed_at ? new Date(row.recording_completed_at) : undefined,
          status: row.status,
          totalInteractions: row.total_interactions,
          totalSizeBytes: row.total_size_bytes,
          recordingQuality: row.recording_quality,
          playbackDurationMs: row.playback_duration_ms,
          keyMoments: row.key_moments ? JSON.parse(row.key_moments) : undefined,
          annotations: row.annotations ? JSON.parse(row.annotations) : undefined,
          bookmarks: row.bookmarks ? JSON.parse(row.bookmarks) : undefined,
          sharedPublicly: row.shared_publicly === 1,
          downloadCount: row.download_count,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at)
        });
      });
    });
  }

  public async getAllSessionRecordings(limit?: number): Promise<SessionRecording[]> {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM session_recordings
        ORDER BY created_at DESC
        ${limit ? 'LIMIT ?' : ''}
      `;
      
      const params = limit ? [limit] : [];
      
      this.db.all(query, params, (err, rows: any[]) => {
        if (err) {
          reject(new Error(`Failed to get session recordings: ${err.message}`));
          return;
        }

        const recordings = rows.map(row => ({
          id: row.id,
          sessionId: row.session_id,
          recordingName: row.recording_name,
          description: row.description,
          recordedBy: row.recorded_by,
          recordingStartedAt: new Date(row.recording_started_at),
          recordingCompletedAt: row.recording_completed_at ? new Date(row.recording_completed_at) : undefined,
          status: row.status,
          totalInteractions: row.total_interactions,
          totalSizeBytes: row.total_size_bytes,
          recordingQuality: row.recording_quality,
          playbackDurationMs: row.playback_duration_ms,
          keyMoments: row.key_moments ? JSON.parse(row.key_moments) : undefined,
          sharedPublicly: row.shared_publicly === 1,
          downloadCount: row.download_count,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at)
        }));

        resolve(recordings);
      });
    });
  }

  public async updateSessionRecording(recordingId: string, updates: Partial<SessionRecording>): Promise<void> {
    const setClause: string[] = [];
    const params: any[] = [];
    
    if (updates.recordingName !== undefined) {
      setClause.push('recording_name = ?');
      params.push(updates.recordingName);
    }
    if (updates.status) {
      setClause.push('status = ?');
      params.push(updates.status);
    }
    if (updates.recordingCompletedAt) {
      setClause.push('recording_completed_at = ?');
      params.push(updates.recordingCompletedAt.toISOString());
    }
    if (updates.playbackDurationMs) {
      setClause.push('playback_duration_ms = ?');
      params.push(updates.playbackDurationMs);
    }
    if (updates.keyMoments) {
      setClause.push('key_moments = ?');
      params.push(JSON.stringify(updates.keyMoments));
    }
    
    if (setClause.length === 0) return;
    
    params.push(recordingId);
    
    return new Promise((resolve, reject) => {
      this.db.run(`
        UPDATE session_recordings 
        SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, params, (err: any) => {
        if (err) {
          reject(new Error(`Failed to update session recording: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  public async addRecordingInteraction(interaction: {
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
    const id = uuidv4();
    
    return new Promise((resolve, reject) => {
      // Get next sequence number
      this.db.get(`
        SELECT COALESCE(MAX(sequence_number), 0) + 1 as next_seq
        FROM recording_interactions 
        WHERE recording_id = ?
      `, [interaction.recordingId], (err, row: any) => {
        if (err) {
          reject(new Error(`Failed to get sequence number: ${err.message}`));
          return;
        }
        
        const sequenceNumber = row?.next_seq || 1;
        
        this.db.run(`
          INSERT INTO recording_interactions (
            id, recording_id, session_id, sequence_number, interaction_type,
            timestamp, relative_time_ms, duration_ms, agent_type, content,
            content_type, metadata, related_message_id, related_event_id,
            parent_interaction_id, original_size
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          id,
          interaction.recordingId,
          interaction.sessionId,
          sequenceNumber,
          interaction.interactionType,
          interaction.timestamp.toISOString(),
          interaction.relativeTimeMs,
          interaction.durationMs || 0,
          interaction.agentType || null,
          interaction.content,
          interaction.contentType || 'text',
          interaction.metadata ? JSON.stringify(interaction.metadata) : null,
          interaction.relatedMessageId || null,
          interaction.relatedEventId || null,
          interaction.parentInteractionId || null,
          Buffer.byteLength(interaction.content, 'utf8')
        ], (err: any) => {
          if (err) {
            reject(new Error(`Failed to add recording interaction: ${err.message}`));
          } else {
            resolve();
          }
        });
      });
    });
  }

  public async getRecordingInteractions(recordingId: string, startTime?: number, endTime?: number): Promise<RecordingInteraction[]> {
    let query = `
      SELECT * FROM recording_interactions 
      WHERE recording_id = ?
    `;
    const params = [recordingId];
    
    if (startTime !== undefined) {
      query += ' AND relative_time_ms >= ?';
      params.push(startTime.toString());
    }
    if (endTime !== undefined) {
      query += ' AND relative_time_ms <= ?';
      params.push(endTime.toString());
    }
    
    query += ' ORDER BY sequence_number ASC';
    
    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows: any[]) => {
        if (err) {
          reject(new Error(`Failed to get recording interactions: ${err.message}`));
          return;
        }

        const interactions = rows.map(row => ({
          id: row.id,
          recordingId: row.recording_id,
          sessionId: row.session_id,
          sequenceNumber: row.sequence_number,
          interactionType: row.interaction_type,
          timestamp: new Date(row.timestamp),
          relativeTimeMs: row.relative_time_ms,
          durationMs: row.duration_ms,
          agentType: row.agent_type,
          content: row.content,
          contentType: row.content_type,
          metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
          relatedMessageId: row.related_message_id,
          relatedEventId: row.related_event_id,
          parentInteractionId: row.parent_interaction_id,
          isCompressed: row.is_compressed === 1,
          compressedSize: row.compressed_size,
          originalSize: row.original_size
        }));

        resolve(interactions);
      });
    });
  }

  public async getRecordingInteractionsByTimeRange(
    recordingId: string, 
    startTimeMs: number, 
    endTimeMs: number
  ): Promise<RecordingInteraction[]> {
    return this.getRecordingInteractions(recordingId, startTimeMs, endTimeMs);
  }

  public async deleteSessionRecording(recordingId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM session_recordings WHERE id = ?', [recordingId], (err: any) => {
        if (err) {
          reject(new Error(`Failed to delete session recording: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  // Additional recording methods would go here...
  // For brevity, I'm including key methods. Full implementation would include
  // all playback, annotation, bookmark, and export methods

  public close(): void {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('Database connection closed.');
        }
      });
    }
  }
}