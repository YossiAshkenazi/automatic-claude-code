import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
  AgentMessage,
  DualAgentSession,
  SessionSummary,
  AgentCommunication,
  SystemEvent,
  PerformanceMetrics
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