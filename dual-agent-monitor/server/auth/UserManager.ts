import * as crypto from 'crypto';
import { DatabaseService } from '../database/DatabaseService';

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  id: string;
  userId: string;
  displayName: string;
  avatar?: string;
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  timezone: string;
  notifications: {
    email: boolean;
    browser: boolean;
    sessionAlerts: boolean;
    errorAlerts: boolean;
  };
  dashboard: {
    defaultView: 'sessions' | 'analytics' | 'agents';
    refreshInterval: number;
    maxSessions: number;
  };
}

export type UserRole = 'admin' | 'manager' | 'viewer';

export interface CreateUserData {
  username: string;
  email: string;
  password: string;
  role: UserRole;
  displayName?: string;
  isActive?: boolean;
}

export interface UpdateUserData {
  username?: string;
  email?: string;
  role?: UserRole;
  isActive?: boolean;
  displayName?: string;
  preferences?: Partial<UserPreferences>;
}

export class UserManager {
  private db: DatabaseService;

  constructor(db: DatabaseService) {
    this.db = db;
  }

  /**
   * Create a new user
   */
  async createUser(userData: CreateUserData, passwordHash: string): Promise<User> {
    const userId = crypto.randomUUID();
    const now = new Date();

    const query = `
      INSERT INTO users (id, username, email, password_hash, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.run(query, [
      userId,
      userData.username,
      userData.email,
      passwordHash,
      userData.role,
      userData.isActive ?? true,
      now.toISOString(),
      now.toISOString()
    ]);

    // Create default user profile
    await this.createUserProfile(userId, {
      displayName: userData.displayName || userData.username,
      preferences: this.getDefaultPreferences()
    });

    const user = await this.findById(userId);
    if (!user) {
      throw new Error('Failed to create user');
    }

    return user;
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    const query = `
      SELECT id, username, email, password_hash, role, is_active, last_login_at, created_at, updated_at
      FROM users
      WHERE id = ? AND is_active = 1
    `;

    const result = await this.db.get(query, [id]);
    return result ? this.mapRowToUser(result) : null;
  }

  /**
   * Find user by username or email
   */
  async findByUsernameOrEmail(identifier: string): Promise<User | null> {
    const query = `
      SELECT id, username, email, password_hash, role, is_active, last_login_at, created_at, updated_at
      FROM users
      WHERE (username = ? OR email = ?) AND is_active = 1
    `;

    const result = await this.db.get(query, [identifier, identifier]);
    return result ? this.mapRowToUser(result) : null;
  }

  /**
   * Find user by username
   */
  async findByUsername(username: string): Promise<User | null> {
    const query = `
      SELECT id, username, email, password_hash, role, is_active, last_login_at, created_at, updated_at
      FROM users
      WHERE username = ?
    `;

    const result = await this.db.get(query, [username]);
    return result ? this.mapRowToUser(result) : null;
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const query = `
      SELECT id, username, email, password_hash, role, is_active, last_login_at, created_at, updated_at
      FROM users
      WHERE email = ?
    `;

    const result = await this.db.get(query, [email]);
    return result ? this.mapRowToUser(result) : null;
  }

  /**
   * Get all users with pagination
   */
  async getAllUsers(page: number = 1, limit: number = 50): Promise<{ users: User[]; total: number }> {
    const offset = (page - 1) * limit;

    const countQuery = 'SELECT COUNT(*) as total FROM users';
    const countResult = await this.db.get(countQuery, []);
    const total = countResult?.total || 0;

    const query = `
      SELECT id, username, email, password_hash, role, is_active, last_login_at, created_at, updated_at
      FROM users
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    const results = await this.db.all(query, [limit, offset]);
    const users = results.map(this.mapRowToUser);

    return { users, total };
  }

  /**
   * Update user information
   */
  async updateUser(id: string, data: UpdateUserData): Promise<User | null> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.username !== undefined) {
      fields.push('username = ?');
      values.push(data.username);
    }

    if (data.email !== undefined) {
      fields.push('email = ?');
      values.push(data.email);
    }

    if (data.role !== undefined) {
      fields.push('role = ?');
      values.push(data.role);
    }

    if (data.isActive !== undefined) {
      fields.push('is_active = ?');
      values.push(data.isActive);
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());

    if (fields.length === 1) { // Only updated_at was added
      return this.findById(id);
    }

    values.push(id);

    const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
    await this.db.run(query, values);

    // Update user profile if display name or preferences are provided
    if (data.displayName !== undefined || data.preferences !== undefined) {
      await this.updateUserProfile(id, {
        displayName: data.displayName,
        preferences: data.preferences
      });
    }

    return this.findById(id);
  }

  /**
   * Update user password
   */
  async updatePassword(id: string, passwordHash: string): Promise<boolean> {
    const query = `
      UPDATE users 
      SET password_hash = ?, updated_at = ?
      WHERE id = ?
    `;

    const result = await this.db.run(query, [
      passwordHash,
      new Date().toISOString(),
      id
    ]);

    return result.changes > 0;
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(id: string): Promise<void> {
    const query = `
      UPDATE users 
      SET last_login_at = ?, updated_at = ?
      WHERE id = ?
    `;

    await this.db.run(query, [
      new Date().toISOString(),
      new Date().toISOString(),
      id
    ]);
  }

  /**
   * Deactivate user (soft delete)
   */
  async deactivateUser(id: string): Promise<boolean> {
    const query = `
      UPDATE users 
      SET is_active = 0, updated_at = ?
      WHERE id = ?
    `;

    const result = await this.db.run(query, [new Date().toISOString(), id]);
    return result.changes > 0;
  }

  /**
   * Activate user
   */
  async activateUser(id: string): Promise<boolean> {
    const query = `
      UPDATE users 
      SET is_active = 1, updated_at = ?
      WHERE id = ?
    `;

    const result = await this.db.run(query, [new Date().toISOString(), id]);
    return result.changes > 0;
  }

  /**
   * Delete user permanently
   */
  async deleteUser(id: string): Promise<boolean> {
    // Delete user profile first
    await this.deleteUserProfile(id);

    const query = 'DELETE FROM users WHERE id = ?';
    const result = await this.db.run(query, [id]);
    return result.changes > 0;
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const query = `
      SELECT id, user_id, display_name, avatar, preferences, created_at, updated_at
      FROM user_profiles
      WHERE user_id = ?
    `;

    const result = await this.db.get(query, [userId]);
    return result ? this.mapRowToUserProfile(result) : null;
  }

  /**
   * Create user profile
   */
  async createUserProfile(userId: string, profileData: {
    displayName: string;
    avatar?: string;
    preferences: UserPreferences;
  }): Promise<UserProfile> {
    const profileId = crypto.randomUUID();
    const now = new Date();

    const query = `
      INSERT INTO user_profiles (id, user_id, display_name, avatar, preferences, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.run(query, [
      profileId,
      userId,
      profileData.displayName,
      profileData.avatar || null,
      JSON.stringify(profileData.preferences),
      now.toISOString(),
      now.toISOString()
    ]);

    const profile = await this.getUserProfile(userId);
    if (!profile) {
      throw new Error('Failed to create user profile');
    }

    return profile;
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, data: {
    displayName?: string;
    avatar?: string;
    preferences?: Partial<UserPreferences>;
  }): Promise<UserProfile | null> {
    const existingProfile = await this.getUserProfile(userId);
    if (!existingProfile) {
      return null;
    }

    const fields: string[] = [];
    const values: any[] = [];

    if (data.displayName !== undefined) {
      fields.push('display_name = ?');
      values.push(data.displayName);
    }

    if (data.avatar !== undefined) {
      fields.push('avatar = ?');
      values.push(data.avatar);
    }

    if (data.preferences !== undefined) {
      const updatedPreferences = { ...existingProfile.preferences, ...data.preferences };
      fields.push('preferences = ?');
      values.push(JSON.stringify(updatedPreferences));
    }

    if (fields.length === 0) {
      return existingProfile;
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(userId);

    const query = `UPDATE user_profiles SET ${fields.join(', ')} WHERE user_id = ?`;
    await this.db.run(query, values);

    return this.getUserProfile(userId);
  }

  /**
   * Delete user profile
   */
  async deleteUserProfile(userId: string): Promise<boolean> {
    const query = 'DELETE FROM user_profiles WHERE user_id = ?';
    const result = await this.db.run(query, [userId]);
    return result.changes > 0;
  }

  /**
   * Check if username exists
   */
  async usernameExists(username: string, excludeUserId?: string): Promise<boolean> {
    let query = 'SELECT COUNT(*) as count FROM users WHERE username = ?';
    const params = [username];

    if (excludeUserId) {
      query += ' AND id != ?';
      params.push(excludeUserId);
    }

    const result = await this.db.get(query, params);
    return (result?.count || 0) > 0;
  }

  /**
   * Check if email exists
   */
  async emailExists(email: string, excludeUserId?: string): Promise<boolean> {
    let query = 'SELECT COUNT(*) as count FROM users WHERE email = ?';
    const params = [email];

    if (excludeUserId) {
      query += ' AND id != ?';
      params.push(excludeUserId);
    }

    const result = await this.db.get(query, params);
    return (result?.count || 0) > 0;
  }

  /**
   * Get users by role
   */
  async getUsersByRole(role: UserRole): Promise<User[]> {
    const query = `
      SELECT id, username, email, password_hash, role, is_active, last_login_at, created_at, updated_at
      FROM users
      WHERE role = ? AND is_active = 1
      ORDER BY username
    `;

    const results = await this.db.all(query, [role]);
    return results.map(this.mapRowToUser);
  }

  /**
   * Get default user preferences
   */
  private getDefaultPreferences(): UserPreferences {
    return {
      theme: 'auto',
      language: 'en',
      timezone: 'UTC',
      notifications: {
        email: true,
        browser: true,
        sessionAlerts: true,
        errorAlerts: true
      },
      dashboard: {
        defaultView: 'sessions',
        refreshInterval: 5000,
        maxSessions: 50
      }
    };
  }

  /**
   * Map database row to User object
   */
  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role as UserRole,
      isActive: Boolean(row.is_active),
      lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  /**
   * Map database row to UserProfile object
   */
  private mapRowToUserProfile(row: any): UserProfile {
    return {
      id: row.id,
      userId: row.user_id,
      displayName: row.display_name,
      avatar: row.avatar,
      preferences: JSON.parse(row.preferences),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}