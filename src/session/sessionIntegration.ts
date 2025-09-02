import * as path from 'path';
import { ClaudeSessionManager, ClaudeMessage, SessionMetadata, CreateSessionOptions } from './sessionManager';
import { Logger } from '../logger';
import { EnhancedSessionManager } from '../sessionManager';

/**
 * Integration layer that bridges the new Claude session management 
 * with the existing automatic-claude-code session system
 */
export class SessionIntegration {
  private claudeSessionManager: ClaudeSessionManager;
  private legacySessionManager?: EnhancedSessionManager;
  private logger: Logger;

  constructor(logger?: Logger, legacySessionManager?: EnhancedSessionManager) {
    this.logger = logger || new Logger();
    this.claudeSessionManager = new ClaudeSessionManager(this.logger);
    this.legacySessionManager = legacySessionManager;
  }

  /**
   * Create a session that persists in Claude's native format
   */
  async createPersistentSession(options: {
    projectPath: string;
    initialPrompt: string;
    userType?: string;
    version?: string;
    gitBranch?: string;
  }): Promise<{
    sessionId: string;
    claudeSessionId: string;
    legacySessionId?: string;
  }> {
    // Create Claude native session
    const claudeSessionId = await this.claudeSessionManager.createSession({
      projectPath: options.projectPath,
      initialMessage: options.initialPrompt,
      userType: options.userType || 'external',
      version: options.version || '1.0.92',
      gitBranch: options.gitBranch
    });

    // Also create legacy session if manager is available
    let legacySessionId: string | undefined;
    if (this.legacySessionManager) {
      try {
        legacySessionId = await this.legacySessionManager.createSession(
          options.initialPrompt,
          options.projectPath,
          'cli' // Default to CLI mode for compatibility
        );
      } catch (error) {
        this.logger.error(`Failed to create legacy session: ${error}`);
      }
    }

    this.logger.info(`Created persistent session ${claudeSessionId} for ${options.projectPath}`);

    return {
      sessionId: claudeSessionId, // Primary ID is Claude's native format
      claudeSessionId,
      legacySessionId
    };
  }

  /**
   * Resume a Claude session and optionally sync with legacy system
   */
  async resumePersistentSession(options: {
    projectPath: string;
    sessionId: string;
    additionalPrompt: string;
    syncWithLegacy?: boolean;
  }): Promise<void> {
    // Resume Claude session
    await this.claudeSessionManager.resumeSession(
      options.projectPath,
      options.sessionId,
      options.additionalPrompt
    );

    // Sync with legacy session if requested
    if (options.syncWithLegacy && this.legacySessionManager) {
      try {
        // Try to find corresponding legacy session
        const legacySessions = await this.legacySessionManager.listSessions();
        const matchingSession = legacySessions.find(session => {
          // Match by prompt content or timing
          return session.prompt.includes(options.additionalPrompt.substring(0, 30));
        });

        if (matchingSession) {
          await this.legacySessionManager.resumeSession(
            matchingSession.id,
            options.additionalPrompt
          );
        }
      } catch (error) {
        this.logger.error(`Failed to sync with legacy session: ${error}`);
      }
    }

    this.logger.info(`Resumed persistent session ${options.sessionId}`);
  }

  /**
   * Add a message to both Claude and legacy sessions
   */
  async addMessage(options: {
    projectPath: string;
    sessionId: string;
    message: Partial<ClaudeMessage>;
    syncWithLegacy?: boolean;
  }): Promise<void> {
    // Add to Claude session
    await this.claudeSessionManager.appendMessage(
      options.projectPath,
      options.sessionId,
      {
        parentUuid: options.message.parentUuid || null,
        isSidechain: options.message.isSidechain || false,
        userType: options.message.userType || 'external',
        version: options.message.version || '1.0.92',
        gitBranch: options.message.gitBranch,
        type: options.message.type || 'user',
        message: options.message.message,
        isApiErrorMessage: options.message.isApiErrorMessage,
        summary: options.message.summary,
        leafUuid: options.message.leafUuid
      }
    );

    // Sync with legacy if enabled
    if (options.syncWithLegacy && this.legacySessionManager && options.message.message) {
      try {
        const content = typeof options.message.message.content === 'string' 
          ? options.message.message.content 
          : JSON.stringify(options.message.message.content);

        await this.legacySessionManager.addSDKIteration({
          iteration: 1, // This will be updated by the manager
          prompt: content,
          output: {
            result: 'Synced from Claude session',
            files: [],
            commands: [],
            totalCost: options.message.message.usage?.input_tokens || 0
          },
          exitCode: options.message.isApiErrorMessage ? 1 : 0,
          duration: 0,
          executionMode: 'cli',
          authMethod: 'api-key'
        });
      } catch (error) {
        this.logger.error(`Failed to sync message with legacy session: ${error}`);
      }
    }
  }

  /**
   * Get comprehensive session information from both systems
   */
  async getSessionInfo(projectPath: string, sessionId: string): Promise<{
    claude: {
      metadata: SessionMetadata;
      messages: ClaudeMessage[];
      validation: { valid: boolean; errors: string[] };
    };
    legacy?: {
      session: any;
      summary: any;
    };
    combined: {
      totalMessages: number;
      totalTokens: number;
      startTime: Date;
      lastActivity: Date;
      status: 'active' | 'completed' | 'error';
    };
  }> {
    // Get Claude session info
    const claudeMetadata = await this.claudeSessionManager.getSessionMetadata(projectPath, sessionId);
    const claudeMessages = await this.claudeSessionManager.loadSession(projectPath, sessionId);
    const claudeValidation = await this.claudeSessionManager.validateSession(projectPath, sessionId);

    // Try to get legacy session info
    let legacyInfo: { session: any; summary: any } | undefined;
    if (this.legacySessionManager) {
      try {
        // This is a simplistic matching - in practice you'd want better correlation
        const legacySessions = await this.legacySessionManager.listSessions();
        const matchingSession = legacySessions.find(session => 
          Math.abs(session.date.getTime() - claudeMetadata.created.getTime()) < 60000 // Within 1 minute
        );

        if (matchingSession) {
          const session = await this.legacySessionManager.loadSession(matchingSession.id);
          const summary = await this.legacySessionManager.getSummary();
          legacyInfo = { session, summary };
        }
      } catch (error) {
        this.logger.debug(`Could not load legacy session info: ${error}`);
      }
    }

    // Combine information
    const combined = {
      totalMessages: claudeMetadata.messageCount + (legacyInfo?.session.iterations.length || 0),
      totalTokens: claudeMetadata.totalTokens + (legacyInfo?.summary.totalCost || 0),
      startTime: claudeMetadata.created,
      lastActivity: claudeMetadata.lastAccessed,
      status: claudeMetadata.status
    };

    return {
      claude: {
        metadata: claudeMetadata,
        messages: claudeMessages,
        validation: claudeValidation
      },
      legacy: legacyInfo,
      combined
    };
  }

  /**
   * List all sessions across both systems
   */
  async listAllSessions(projectPath: string): Promise<{
    claude: SessionMetadata[];
    legacy?: any[];
    combined: Array<{
      id: string;
      source: 'claude' | 'legacy' | 'both';
      created: Date;
      lastActivity: Date;
      messageCount: number;
      status: string;
      prompt: string;
    }>;
  }> {
    // Get Claude sessions
    const claudeSessions = await this.claudeSessionManager.listSessions(projectPath);

    // Get legacy sessions if available
    let legacySessions: any[] = [];
    if (this.legacySessionManager) {
      try {
        legacySessions = await this.legacySessionManager.listSessions();
      } catch (error) {
        this.logger.debug(`Could not load legacy sessions: ${error}`);
      }
    }

    // Combine and deduplicate
    const combined = [
      ...claudeSessions.map(session => ({
        id: session.id,
        source: 'claude' as const,
        created: session.created,
        lastActivity: session.lastAccessed,
        messageCount: session.messageCount,
        status: session.status,
        prompt: 'Claude session' // Could extract from first user message
      })),
      ...legacySessions.map(session => ({
        id: session.id,
        source: 'legacy' as const,
        created: session.date,
        lastActivity: session.date,
        messageCount: 1, // Legacy format doesn't track this well
        status: session.status,
        prompt: session.prompt
      }))
    ].sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());

    return {
      claude: claudeSessions,
      legacy: legacySessions.length > 0 ? legacySessions : undefined,
      combined
    };
  }

  /**
   * Export sessions for backup or migration
   */
  async exportAllSessions(projectPath: string): Promise<{
    claude: Array<{
      metadata: SessionMetadata;
      messages: ClaudeMessage[];
    }>;
    legacy?: any[];
    exportMetadata: {
      timestamp: string;
      projectPath: string;
      totalSessions: number;
    };
  }> {
    const claudeSessions = await this.claudeSessionManager.listSessions(projectPath);
    const claudeExports = await Promise.all(
      claudeSessions.map(session => 
        this.claudeSessionManager.exportSession(projectPath, session.id)
      )
    );

    let legacyExports: any[] = [];
    if (this.legacySessionManager) {
      try {
        const legacySessions = await this.legacySessionManager.listSessions();
        legacyExports = await Promise.all(
          legacySessions.map(session => 
            this.legacySessionManager!.exportSession(session.id)
          )
        );
      } catch (error) {
        this.logger.error(`Could not export legacy sessions: ${error}`);
      }
    }

    return {
      claude: claudeExports,
      legacy: legacyExports.length > 0 ? legacyExports : undefined,
      exportMetadata: {
        timestamp: new Date().toISOString(),
        projectPath,
        totalSessions: claudeExports.length + legacyExports.length
      }
    };
  }

  /**
   * Migrate legacy sessions to Claude format
   */
  async migrateLegacyToClaudeFormat(projectPath: string): Promise<{
    migrated: number;
    errors: string[];
    sessionMappings: Array<{ legacyId: string; claudeId: string }>;
  }> {
    if (!this.legacySessionManager) {
      throw new Error('Legacy session manager not available for migration');
    }

    const legacySessions = await this.legacySessionManager.listSessions();
    const sessionMappings: Array<{ legacyId: string; claudeId: string }> = [];
    const errors: string[] = [];
    let migrated = 0;

    for (const legacySession of legacySessions) {
      try {
        const session = await this.legacySessionManager.loadSession(legacySession.id);
        
        // Create Claude session with initial prompt
        const claudeSessionId = await this.claudeSessionManager.createSession({
          projectPath,
          initialMessage: typeof session.initialPrompt === 'string' 
            ? session.initialPrompt 
            : 'Migrated session',
          version: '1.0.92'
        });

        // Migrate each iteration as messages
        for (const iteration of session.iterations) {
          // Add user message
          await this.claudeSessionManager.appendMessage(projectPath, claudeSessionId, {
            parentUuid: null,
            isSidechain: false,
            userType: 'external',
            version: '1.0.92',
            type: 'user',
            message: {
              role: 'user',
              content: iteration.prompt
            }
          });

          // Add assistant response if available
          if (iteration.output.result) {
            await this.claudeSessionManager.appendMessage(projectPath, claudeSessionId, {
              parentUuid: null,
              isSidechain: false,
              userType: 'external',
              version: '1.0.92',
              type: 'assistant',
              message: {
                role: 'assistant',
                content: iteration.output.result,
                usage: {
                  input_tokens: Math.floor(iteration.output.totalCost || 0),
                  output_tokens: Math.floor((iteration.output.totalCost || 0) * 0.5),
                  cache_creation_input_tokens: 0,
                  cache_read_input_tokens: 0
                }
              },
              isApiErrorMessage: iteration.exitCode !== 0
            });
          }
        }

        sessionMappings.push({ legacyId: legacySession.id, claudeId: claudeSessionId });
        migrated++;
        
        this.logger.info(`Migrated legacy session ${legacySession.id} to Claude format ${claudeSessionId}`);
      } catch (error) {
        const errorMsg = `Failed to migrate session ${legacySession.id}: ${error}`;
        errors.push(errorMsg);
        this.logger.error(errorMsg);
      }
    }

    this.logger.info(`Migration complete: ${migrated} sessions migrated, ${errors.length} errors`);

    return {
      migrated,
      errors,
      sessionMappings
    };
  }

  /**
   * Cleanup old sessions across both systems
   */
  async cleanupOldSessions(
    projectPath: string, 
    maxAgeDays: number = 30
  ): Promise<{
    claude: string[];
    legacy: string[];
    total: number;
  }> {
    // Cleanup Claude sessions
    const claudeDeleted = await this.claudeSessionManager.cleanupOldSessions(projectPath, maxAgeDays);

    // Cleanup legacy sessions
    let legacyDeleted: string[] = [];
    if (this.legacySessionManager) {
      try {
        legacyDeleted = await this.legacySessionManager.cleanupOldSessions(maxAgeDays);
      } catch (error) {
        this.logger.error(`Failed to cleanup legacy sessions: ${error}`);
      }
    }

    const totalDeleted = claudeDeleted.length + legacyDeleted.length;
    this.logger.info(`Cleaned up ${totalDeleted} old sessions from ${projectPath}`);

    return {
      claude: claudeDeleted,
      legacy: legacyDeleted,
      total: totalDeleted
    };
  }

  /**
   * Get comprehensive project statistics
   */
  async getProjectStats(projectPath: string): Promise<{
    claude: any;
    legacy?: any;
    combined: {
      totalSessions: number;
      totalMessages: number;
      totalTokens: number;
      activeSessions: number;
      oldestSession: Date | null;
      newestSession: Date | null;
      averageSessionLength: number;
    };
  }> {
    const claudeStats = await this.claudeSessionManager.getSessionStats(projectPath);

    let legacyStats: any;
    if (this.legacySessionManager) {
      try {
        legacyStats = this.legacySessionManager.getSessionStatistics();
      } catch (error) {
        this.logger.debug(`Could not get legacy stats: ${error}`);
      }
    }

    const combined = {
      totalSessions: claudeStats.totalSessions + (legacyStats?.total || 0),
      totalMessages: claudeStats.totalMessages + (legacyStats?.total || 0), // Legacy doesn't track messages well
      totalTokens: claudeStats.totalTokens + (legacyStats?.total || 0), // Rough estimate
      activeSessions: claudeStats.activeSessions + (legacyStats?.running || 0),
      oldestSession: claudeStats.oldestSession,
      newestSession: claudeStats.newestSession,
      averageSessionLength: claudeStats.totalSessions > 0 
        ? Math.round(claudeStats.totalMessages / claudeStats.totalSessions)
        : 0
    };

    return {
      claude: claudeStats,
      legacy: legacyStats,
      combined
    };
  }
}

export default SessionIntegration;