import * as crypto from 'crypto';
import { DatabaseService } from '../database/DatabaseService';

export interface UserSession {
  id: string;
  userId: string;
  refreshToken: string;
  permissions: string[];
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt: Date;
  ipAddress?: string;
  userAgent?: string;
  isActive: boolean;
}

export interface SessionConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshTokenExpiresIn: string;
}

export interface CreateSessionData {
  userId: string;
  refreshToken: string;
  permissions?: string[];
  ipAddress?: string;
  userAgent?: string;
}

export class SessionManager {
  private db: DatabaseService;
  private config: SessionConfig;

  constructor(db: DatabaseService, config: SessionConfig) {
    this.db = db;
    this.config = config;

    // Clean up expired sessions every hour
    setInterval(() => this.cleanupExpiredSessions(), 3600000);
  }

  /**
   * Create a new user session
   */
  async createSession(
    userId: string, 
    refreshToken: string, 
    options?: {
      permissions?: string[];
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<UserSession> {
    const sessionId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.parseExpirationTime(this.config.refreshTokenExpiresIn));

    const query = `
      INSERT INTO user_sessions (
        id, user_id, refresh_token, permissions, expires_at, 
        created_at, updated_at, last_accessed_at, ip_address, user_agent, is_active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.run(query, [
      sessionId,
      userId,
      refreshToken,
      JSON.stringify(options?.permissions || []),
      expiresAt.toISOString(),
      now.toISOString(),
      now.toISOString(),
      now.toISOString(),
      options?.ipAddress || null,
      options?.userAgent || null,
      1
    ]);

    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Failed to create session');
    }

    return session;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<UserSession | null> {
    const query = `
      SELECT id, user_id, refresh_token, permissions, expires_at,
             created_at, updated_at, last_accessed_at, ip_address, user_agent, is_active
      FROM user_sessions
      WHERE id = ? AND is_active = 1
    `;

    const result = await this.db.get(query, [sessionId]);
    return result ? this.mapRowToSession(result) : null;
  }

  /**
   * Get session by refresh token
   */
  async getSessionByRefreshToken(refreshToken: string): Promise<UserSession | null> {
    const query = `
      SELECT id, user_id, refresh_token, permissions, expires_at,
             created_at, updated_at, last_accessed_at, ip_address, user_agent, is_active
      FROM user_sessions
      WHERE refresh_token = ? AND is_active = 1 AND expires_at > ?
    `;

    const result = await this.db.get(query, [refreshToken, new Date().toISOString()]);
    return result ? this.mapRowToSession(result) : null;
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<UserSession[]> {
    const query = `
      SELECT id, user_id, refresh_token, permissions, expires_at,
             created_at, updated_at, last_accessed_at, ip_address, user_agent, is_active
      FROM user_sessions
      WHERE user_id = ? AND is_active = 1 AND expires_at > ?
      ORDER BY last_accessed_at DESC
    `;

    const results = await this.db.all(query, [userId, new Date().toISOString()]);
    return results.map(this.mapRowToSession);
  }

  /**
   * Update session with new refresh token
   */
  async updateSession(sessionId: string, newRefreshToken: string): Promise<UserSession | null> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.parseExpirationTime(this.config.refreshTokenExpiresIn));

    const query = `
      UPDATE user_sessions 
      SET refresh_token = ?, expires_at = ?, updated_at = ?, last_accessed_at = ?
      WHERE id = ? AND is_active = 1
    `;

    const result = await this.db.run(query, [
      newRefreshToken,
      expiresAt.toISOString(),
      now.toISOString(),
      now.toISOString(),
      sessionId
    ]);

    if (result.changes === 0) {
      return null;
    }

    return this.getSession(sessionId);
  }

  /**
   * Update session permissions
   */
  async updateSessionPermissions(sessionId: string, permissions: string[]): Promise<boolean> {
    const query = `
      UPDATE user_sessions 
      SET permissions = ?, updated_at = ?
      WHERE id = ? AND is_active = 1
    `;

    const result = await this.db.run(query, [
      JSON.stringify(permissions),
      new Date().toISOString(),
      sessionId
    ]);

    return result.changes > 0;
  }

  /**
   * Update last accessed timestamp
   */
  async updateLastAccessed(sessionId: string, ipAddress?: string): Promise<void> {
    const fields = ['last_accessed_at = ?'];
    const values = [new Date().toISOString()];

    if (ipAddress) {
      fields.push('ip_address = ?');
      values.push(ipAddress);
    }

    values.push(sessionId);

    const query = `UPDATE user_sessions SET ${fields.join(', ')} WHERE id = ?`;
    await this.db.run(query, values);
  }

  /**
   * Validate refresh token and return session
   */
  async validateRefreshToken(refreshToken: string): Promise<UserSession | null> {
    const session = await this.getSessionByRefreshToken(refreshToken);
    
    if (!session) {
      return null;
    }

    // Check if session is expired
    if (session.expiresAt <= new Date()) {
      await this.invalidateSession(session.userId, refreshToken);
      return null;
    }

    // Update last accessed time
    await this.updateLastAccessed(session.id);

    return session;
  }

  /**
   * Invalidate a specific session
   */
  async invalidateSession(userId: string, refreshToken?: string): Promise<boolean> {
    let query: string;
    let params: any[];

    if (refreshToken) {
      query = `
        UPDATE user_sessions 
        SET is_active = 0, updated_at = ?
        WHERE user_id = ? AND refresh_token = ?
      `;
      params = [new Date().toISOString(), userId, refreshToken];
    } else {
      query = `
        UPDATE user_sessions 
        SET is_active = 0, updated_at = ?
        WHERE user_id = ? AND is_active = 1
      `;
      params = [new Date().toISOString(), userId];
    }

    const result = await this.db.run(query, params);
    return result.changes > 0;
  }

  /**
   * Invalidate all sessions for a user
   */
  async invalidateAllUserSessions(userId: string): Promise<number> {
    const query = `
      UPDATE user_sessions 
      SET is_active = 0, updated_at = ?
      WHERE user_id = ? AND is_active = 1
    `;

    const result = await this.db.run(query, [new Date().toISOString(), userId]);
    return result.changes;
  }

  /**
   * Invalidate session by ID
   */
  async invalidateSessionById(sessionId: string): Promise<boolean> {
    const query = `
      UPDATE user_sessions 
      SET is_active = 0, updated_at = ?
      WHERE id = ?
    `;

    const result = await this.db.run(query, [new Date().toISOString(), sessionId]);
    return result.changes > 0;
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const query = `
      DELETE FROM user_sessions 
      WHERE expires_at <= ? OR (is_active = 0 AND updated_at <= ?)
    `;

    // Delete sessions expired more than 30 days ago
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const result = await this.db.run(query, [
      new Date().toISOString(),
      thirtyDaysAgo.toISOString()
    ]);

    if (result.changes > 0) {
      console.log(`Cleaned up ${result.changes} expired sessions`);
    }

    return result.changes;
  }

  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<{
    totalActiveSessions: number;
    totalExpiredSessions: number;
    sessionsPerUser: { userId: string; count: number }[];
    recentActivity: { date: string; count: number }[];
  }> {
    const now = new Date().toISOString();

    // Total active sessions
    const activeResult = await this.db.get(
      'SELECT COUNT(*) as count FROM user_sessions WHERE is_active = 1 AND expires_at > ?',
      [now]
    );

    // Total expired sessions
    const expiredResult = await this.db.get(
      'SELECT COUNT(*) as count FROM user_sessions WHERE expires_at <= ?',
      [now]
    );

    // Sessions per user
    const perUserResults = await this.db.all(`
      SELECT user_id, COUNT(*) as count
      FROM user_sessions
      WHERE is_active = 1 AND expires_at > ?
      GROUP BY user_id
      ORDER BY count DESC
      LIMIT 10
    `, [now]);

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const activityResults = await this.db.all(`
      SELECT DATE(last_accessed_at) as date, COUNT(*) as count
      FROM user_sessions
      WHERE last_accessed_at >= ? AND is_active = 1
      GROUP BY DATE(last_accessed_at)
      ORDER BY date DESC
    `, [sevenDaysAgo]);

    return {
      totalActiveSessions: activeResult?.count || 0,
      totalExpiredSessions: expiredResult?.count || 0,
      sessionsPerUser: perUserResults.map(r => ({ userId: r.user_id, count: r.count })),
      recentActivity: activityResults.map(r => ({ date: r.date, count: r.count }))
    };
  }

  /**
   * Parse expiration time string to milliseconds
   */
  private parseExpirationTime(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhdw])$/);
    if (!match) {
      throw new Error(`Invalid expiration time format: ${expiresIn}`);
    }

    const [, value, unit] = match;
    const num = parseInt(value, 10);

    switch (unit) {
      case 's': return num * 1000; // seconds
      case 'm': return num * 60 * 1000; // minutes
      case 'h': return num * 60 * 60 * 1000; // hours
      case 'd': return num * 24 * 60 * 60 * 1000; // days
      case 'w': return num * 7 * 24 * 60 * 60 * 1000; // weeks
      default: throw new Error(`Unknown time unit: ${unit}`);
    }
  }

  /**
   * Map database row to UserSession object
   */
  private mapRowToSession(row: any): UserSession {
    return {
      id: row.id,
      userId: row.user_id,
      refreshToken: row.refresh_token,
      permissions: JSON.parse(row.permissions || '[]'),
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastAccessedAt: new Date(row.last_accessed_at),
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      isActive: Boolean(row.is_active)
    };
  }
}