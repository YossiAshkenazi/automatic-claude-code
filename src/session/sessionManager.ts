import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { Logger } from '../logger';

/**
 * Claude session message structure as stored in JSONL files
 */
interface ClaudeMessage {
  parentUuid: string | null;
  isSidechain: boolean;
  userType: string;
  cwd: string;
  sessionId: string;
  version: string;
  gitBranch?: string;
  type: 'user' | 'assistant' | 'summary';
  message?: {
    role: 'user' | 'assistant';
    content: string | Array<{ type: string; text: string; [key: string]: any }>;
    id?: string;
    model?: string;
    stop_reason?: string;
    stop_sequence?: string;
    usage?: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens: number;
      cache_read_input_tokens: number;
      server_tool_use?: { web_search_requests: number };
      service_tier?: string | null;
    };
  };
  uuid: string;
  timestamp: string;
  summary?: string;
  leafUuid?: string;
  isApiErrorMessage?: boolean;
}

/**
 * Session metadata structure
 */
interface SessionMetadata {
  id: string;
  projectPath: string;
  created: Date;
  lastAccessed: Date;
  messageCount: number;
  totalTokens: number;
  status: 'active' | 'completed' | 'error';
  version: string;
  gitBranch?: string;
}

/**
 * Session creation options
 */
interface CreateSessionOptions {
  projectPath: string;
  initialMessage?: string;
  version?: string;
  gitBranch?: string;
  userType?: string;
}

/**
 * Path encoding utilities matching Claude's behavior
 */
export class ClaudePathEncoder {
  /**
   * Encode a directory path exactly as Claude does
   * Uses base64 encoding with URL-safe modifications
   */
  static encodePath(dirPath: string): string {
    // Normalize path separators to backslashes (Windows-style)
    const normalizedPath = path.resolve(dirPath).replace(/\//g, '\\');
    
    return Buffer.from(normalizedPath, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')    // Replace + with -
      .replace(/\//g, '_')    // Replace / with _
      .replace(/=/g, '');     // Remove padding
  }

  /**
   * Decode a Claude-encoded path back to original
   */
  static decodePath(encoded: string): string {
    // Restore base64 padding and characters
    const base64 = encoded
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(encoded.length + (4 - encoded.length % 4) % 4, '=');
    
    return Buffer.from(base64, 'base64').toString('utf8');
  }

  /**
   * Get Claude's projects directory
   */
  static getClaudeProjectsDir(): string {
    return path.join(os.homedir(), '.claude', 'projects');
  }

  /**
   * Get Claude's session directory for a specific project
   */
  static getProjectSessionDir(projectPath: string): string {
    const encodedPath = this.encodePath(projectPath);
    return path.join(this.getClaudeProjectsDir(), encodedPath);
  }

  /**
   * Get session file path for a specific session ID
   */
  static getSessionFilePath(projectPath: string, sessionId: string): string {
    const sessionDir = this.getProjectSessionDir(projectPath);
    return path.join(sessionDir, `${sessionId}.jsonl`);
  }
}

/**
 * Comprehensive session management system that manipulates Claude's session files
 */
export class ClaudeSessionManager {
  private logger: Logger;
  private claudeProjectsDir: string;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
    this.claudeProjectsDir = ClaudePathEncoder.getClaudeProjectsDir();
  }

  /**
   * Create a new Claude session
   */
  async createSession(options: CreateSessionOptions): Promise<string> {
    const sessionId = crypto.randomUUID();
    const sessionDir = ClaudePathEncoder.getProjectSessionDir(options.projectPath);
    const sessionFile = ClaudePathEncoder.getSessionFilePath(options.projectPath, sessionId);

    // Ensure session directory exists
    await fs.mkdir(sessionDir, { recursive: true });

    // Create initial summary message (matches Claude's pattern)
    const summaryMessage: ClaudeMessage = {
      type: 'summary',
      summary: options.initialMessage || 'Session created',
      leafUuid: crypto.randomUUID(),
      parentUuid: null,
      isSidechain: false,
      userType: options.userType || 'external',
      cwd: path.resolve(options.projectPath),
      sessionId,
      version: options.version || '1.0.92',
      gitBranch: options.gitBranch,
      uuid: crypto.randomUUID(),
      timestamp: new Date().toISOString()
    };

    // Write initial message to JSONL file
    await this.appendMessageToSession(sessionFile, summaryMessage);

    // If initial message provided, add user message
    if (options.initialMessage) {
      const userMessage: ClaudeMessage = {
        parentUuid: null,
        isSidechain: false,
        userType: options.userType || 'external',
        cwd: path.resolve(options.projectPath),
        sessionId,
        version: options.version || '1.0.92',
        gitBranch: options.gitBranch,
        type: 'user',
        message: {
          role: 'user',
          content: options.initialMessage
        },
        uuid: crypto.randomUUID(),
        timestamp: new Date().toISOString()
      };

      await this.appendMessageToSession(sessionFile, userMessage);
    }

    this.logger.info(`Created Claude session ${sessionId} for project ${options.projectPath}`);
    return sessionId;
  }

  /**
   * Load an existing session
   */
  async loadSession(projectPath: string, sessionId: string): Promise<ClaudeMessage[]> {
    const sessionFile = ClaudePathEncoder.getSessionFilePath(projectPath, sessionId);
    
    try {
      const content = await fs.readFile(sessionFile, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      
      return lines.map(line => JSON.parse(line));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Session ${sessionId} not found for project ${projectPath}`);
      }
      throw error;
    }
  }

  /**
   * Append a message to an existing session
   */
  async appendMessage(
    projectPath: string, 
    sessionId: string, 
    message: Omit<ClaudeMessage, 'uuid' | 'timestamp' | 'sessionId' | 'cwd'>
  ): Promise<void> {
    const sessionFile = ClaudePathEncoder.getSessionFilePath(projectPath, sessionId);
    
    // Verify session exists
    try {
      await fs.access(sessionFile);
    } catch {
      throw new Error(`Session ${sessionId} not found for project ${projectPath}`);
    }

    const completeMessage: ClaudeMessage = {
      ...message,
      uuid: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      sessionId,
      cwd: path.resolve(projectPath)
    };

    await this.appendMessageToSession(sessionFile, completeMessage);
  }

  /**
   * List all available sessions for a project
   */
  async listSessions(projectPath: string): Promise<SessionMetadata[]> {
    const sessionDir = ClaudePathEncoder.getProjectSessionDir(projectPath);
    
    try {
      const files = await fs.readdir(sessionDir);
      const sessionFiles = files.filter(file => file.endsWith('.jsonl'));
      
      const sessions: SessionMetadata[] = [];
      
      for (const file of sessionFiles) {
        const sessionId = path.basename(file, '.jsonl');
        try {
          const metadata = await this.getSessionMetadata(projectPath, sessionId);
          sessions.push(metadata);
        } catch (error) {
          this.logger.debug(`Failed to read session ${sessionId}: ${error}`);
        }
      }
      
      return sessions.sort((a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime());
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return []; // No sessions directory exists yet
      }
      throw error;
    }
  }

  /**
   * Get session metadata
   */
  async getSessionMetadata(projectPath: string, sessionId: string): Promise<SessionMetadata> {
    const messages = await this.loadSession(projectPath, sessionId);
    const sessionFile = ClaudePathEncoder.getSessionFilePath(projectPath, sessionId);
    const stats = await fs.stat(sessionFile);
    
    // Calculate total tokens from usage information
    let totalTokens = 0;
    let version = '1.0.92';
    let gitBranch: string | undefined;
    let status: 'active' | 'completed' | 'error' = 'active';
    
    for (const message of messages) {
      if (message.version) version = message.version;
      if (message.gitBranch) gitBranch = message.gitBranch;
      
      if (message.message?.usage) {
        totalTokens += message.message.usage.input_tokens + message.message.usage.output_tokens;
      }
      
      if (message.isApiErrorMessage) {
        status = 'error';
      }
    }
    
    // Check if session has assistant messages (indicates completion)
    const hasAssistantMessages = messages.some(m => m.type === 'assistant');
    if (hasAssistantMessages && status !== 'error') {
      status = 'completed';
    }

    return {
      id: sessionId,
      projectPath,
      created: stats.birthtime,
      lastAccessed: stats.mtime,
      messageCount: messages.length,
      totalTokens,
      status,
      version,
      gitBranch
    };
  }

  /**
   * Delete a session
   */
  async deleteSession(projectPath: string, sessionId: string): Promise<void> {
    const sessionFile = ClaudePathEncoder.getSessionFilePath(projectPath, sessionId);
    
    try {
      await fs.unlink(sessionFile);
      this.logger.info(`Deleted session ${sessionId} for project ${projectPath}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Session ${sessionId} not found for project ${projectPath}`);
      }
      throw error;
    }
  }

  /**
   * Clean up old sessions (older than specified days)
   */
  async cleanupOldSessions(projectPath: string, maxAgeDays: number = 30): Promise<string[]> {
    const sessions = await this.listSessions(projectPath);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);
    
    const deletedSessions: string[] = [];
    
    for (const session of sessions) {
      if (session.lastAccessed < cutoffDate && session.status !== 'active') {
        try {
          await this.deleteSession(projectPath, session.id);
          deletedSessions.push(session.id);
        } catch (error) {
          this.logger.error(`Failed to delete old session ${session.id}: ${error}`);
        }
      }
    }
    
    this.logger.info(`Cleaned up ${deletedSessions.length} old sessions for project ${projectPath}`);
    return deletedSessions;
  }

  /**
   * List all projects with sessions
   */
  async listAllProjects(): Promise<{ projectPath: string; sessionCount: number; lastActivity: Date }[]> {
    try {
      const encodedDirs = await fs.readdir(this.claudeProjectsDir, { withFileTypes: true });
      const projects: { projectPath: string; sessionCount: number; lastActivity: Date }[] = [];
      
      for (const dir of encodedDirs) {
        if (dir.isDirectory()) {
          try {
            const projectPath = ClaudePathEncoder.decodePath(dir.name);
            const sessions = await this.listSessions(projectPath);
            
            if (sessions.length > 0) {
              const lastActivity = sessions.reduce((latest, session) => 
                session.lastAccessed > latest ? session.lastAccessed : latest, 
                new Date(0)
              );
              
              projects.push({
                projectPath,
                sessionCount: sessions.length,
                lastActivity
              });
            }
          } catch (error) {
            this.logger.debug(`Failed to decode project path ${dir.name}: ${error}`);
          }
        }
      }
      
      return projects.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return []; // No Claude projects directory exists yet
      }
      throw error;
    }
  }

  /**
   * Export session data as JSON (for backup/analysis)
   */
  async exportSession(projectPath: string, sessionId: string): Promise<{
    metadata: SessionMetadata;
    messages: ClaudeMessage[];
    export_timestamp: string;
  }> {
    const metadata = await this.getSessionMetadata(projectPath, sessionId);
    const messages = await this.loadSession(projectPath, sessionId);
    
    return {
      metadata,
      messages,
      export_timestamp: new Date().toISOString()
    };
  }

  /**
   * Import session data from JSON export
   */
  async importSession(
    projectPath: string, 
    exportData: { metadata: SessionMetadata; messages: ClaudeMessage[] }
  ): Promise<string> {
    const sessionId = exportData.metadata.id;
    const sessionFile = ClaudePathEncoder.getSessionFilePath(projectPath, sessionId);
    const sessionDir = ClaudePathEncoder.getProjectSessionDir(projectPath);

    // Ensure session directory exists
    await fs.mkdir(sessionDir, { recursive: true });

    // Check if session already exists
    try {
      await fs.access(sessionFile);
      throw new Error(`Session ${sessionId} already exists for project ${projectPath}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    // Write all messages to JSONL format
    const jsonlContent = exportData.messages.map(msg => JSON.stringify(msg)).join('\n') + '\n';
    await fs.writeFile(sessionFile, jsonlContent, 'utf-8');

    this.logger.info(`Imported session ${sessionId} for project ${projectPath}`);
    return sessionId;
  }

  /**
   * Resume session by creating a new message continuation
   */
  async resumeSession(
    projectPath: string, 
    sessionId: string, 
    userMessage: string
  ): Promise<void> {
    const messages = await this.loadSession(projectPath, sessionId);
    
    // Find the last message for proper threading
    const lastMessage = messages[messages.length - 1];
    
    const userResumeMessage: ClaudeMessage = {
      parentUuid: lastMessage?.uuid || null,
      isSidechain: false,
      userType: 'external',
      cwd: path.resolve(projectPath),
      sessionId,
      version: lastMessage?.version || '1.0.92',
      gitBranch: lastMessage?.gitBranch,
      type: 'user',
      message: {
        role: 'user',
        content: userMessage
      },
      uuid: crypto.randomUUID(),
      timestamp: new Date().toISOString()
    };

    await this.appendMessage(projectPath, sessionId, {
      parentUuid: userResumeMessage.parentUuid,
      isSidechain: userResumeMessage.isSidechain,
      userType: userResumeMessage.userType,
      version: userResumeMessage.version,
      gitBranch: userResumeMessage.gitBranch,
      type: userResumeMessage.type,
      message: userResumeMessage.message
    });

    this.logger.info(`Resumed session ${sessionId} with new user message`);
  }

  /**
   * Get session statistics
   */
  async getSessionStats(projectPath: string): Promise<{
    totalSessions: number;
    activeSessions: number;
    completedSessions: number;
    errorSessions: number;
    totalMessages: number;
    totalTokens: number;
    oldestSession: Date | null;
    newestSession: Date | null;
  }> {
    const sessions = await this.listSessions(projectPath);
    
    let totalMessages = 0;
    let totalTokens = 0;
    let activeSessions = 0;
    let completedSessions = 0;
    let errorSessions = 0;
    let oldestSession: Date | null = null;
    let newestSession: Date | null = null;
    
    for (const session of sessions) {
      totalMessages += session.messageCount;
      totalTokens += session.totalTokens;
      
      switch (session.status) {
        case 'active': activeSessions++; break;
        case 'completed': completedSessions++; break;
        case 'error': errorSessions++; break;
      }
      
      if (!oldestSession || session.created < oldestSession) {
        oldestSession = session.created;
      }
      
      if (!newestSession || session.created > newestSession) {
        newestSession = session.created;
      }
    }
    
    return {
      totalSessions: sessions.length,
      activeSessions,
      completedSessions,
      errorSessions,
      totalMessages,
      totalTokens,
      oldestSession,
      newestSession
    };
  }

  /**
   * Private method to append a message to session file
   */
  private async appendMessageToSession(sessionFile: string, message: ClaudeMessage): Promise<void> {
    const jsonLine = JSON.stringify(message) + '\n';
    await fs.appendFile(sessionFile, jsonLine, 'utf-8');
  }

  /**
   * Validate session file format
   */
  async validateSession(projectPath: string, sessionId: string): Promise<{
    valid: boolean;
    errors: string[];
    messageCount: number;
  }> {
    const errors: string[] = [];
    let messageCount = 0;
    
    try {
      const messages = await this.loadSession(projectPath, sessionId);
      messageCount = messages.length;
      
      // Validate each message has required fields
      for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        
        if (!message.uuid) errors.push(`Message ${i}: Missing uuid`);
        if (!message.timestamp) errors.push(`Message ${i}: Missing timestamp`);
        if (!message.type) errors.push(`Message ${i}: Missing type`);
        if (!message.sessionId) errors.push(`Message ${i}: Missing sessionId`);
        
        // Validate message-specific fields
        if (message.type === 'user' || message.type === 'assistant') {
          if (!message.message) errors.push(`Message ${i}: Missing message content`);
        }
        
        if (message.type === 'summary') {
          if (!message.summary) errors.push(`Message ${i}: Missing summary content`);
        }
      }
      
    } catch (error) {
      errors.push(`Failed to load session: ${error}`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      messageCount
    };
  }
}

// Export types for external use
export type { ClaudeMessage, SessionMetadata, CreateSessionOptions };