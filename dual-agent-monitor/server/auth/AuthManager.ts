import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { DatabaseService } from '../database/DatabaseService';
import { UserManager } from './UserManager';
import { SessionManager } from './SessionManager';
import { PermissionManager } from './PermissionManager';

export interface LoginCredentials {
  username?: string;
  email?: string;
  password: string;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  token?: string;
  refreshToken?: string;
  error?: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole = 'admin' | 'manager' | 'viewer';

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshTokenExpiresIn: string;
  saltRounds: number;
  maxLoginAttempts: number;
  lockoutDuration: number; // in minutes
  passwordMinLength: number;
  enableTwoFactor: boolean;
}

export class AuthManager {
  private db: DatabaseService;
  private userManager: UserManager;
  private sessionManager: SessionManager;
  private permissionManager: PermissionManager;
  private config: AuthConfig;
  private loginAttempts: Map<string, { count: number; lockedUntil?: Date }> = new Map();

  constructor(
    db: DatabaseService,
    config?: Partial<AuthConfig>
  ) {
    this.db = db;
    this.config = {
      jwtSecret: process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex'),
      jwtExpiresIn: '15m',
      refreshTokenExpiresIn: '7d',
      saltRounds: 12,
      maxLoginAttempts: 5,
      lockoutDuration: 30,
      passwordMinLength: 8,
      enableTwoFactor: false,
      ...config
    };

    this.userManager = new UserManager(db);
    this.sessionManager = new SessionManager(db, this.config);
    this.permissionManager = new PermissionManager(db);

    // Clean up expired lockouts every hour
    setInterval(() => this.cleanupExpiredLockouts(), 3600000);
  }

  /**
   * Authenticate user with username/email and password
   */
  async login(credentials: LoginCredentials): Promise<AuthResult> {
    try {
      const identifier = credentials.username || credentials.email;
      if (!identifier) {
        return { success: false, error: 'Username or email is required' };
      }

      // Check if account is locked
      if (this.isAccountLocked(identifier)) {
        return { success: false, error: 'Account is temporarily locked due to too many failed login attempts' };
      }

      // Find user by username or email
      const user = await this.userManager.findByUsernameOrEmail(identifier);
      if (!user) {
        this.recordFailedAttempt(identifier);
        return { success: false, error: 'Invalid credentials' };
      }

      // Check if user account is active
      if (!user.isActive) {
        return { success: false, error: 'Account is deactivated' };
      }

      // Verify password
      const isValidPassword = await this.verifyPassword(credentials.password, user.passwordHash);
      if (!isValidPassword) {
        this.recordFailedAttempt(identifier);
        return { success: false, error: 'Invalid credentials' };
      }

      // Clear failed attempts on successful login
      this.loginAttempts.delete(identifier);

      // Generate JWT tokens
      const tokens = await this.generateTokens(user);

      // Create user session
      await this.sessionManager.createSession(user.id, tokens.refreshToken);

      // Update last login time
      await this.userManager.updateLastLogin(user.id);

      // Log successful login
      await this.logAuthEvent(user.id, 'login_success', { ip: 'unknown' });

      return {
        success: true,
        user: this.sanitizeUser(user),
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken
      };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Authentication failed' };
    }
  }

  /**
   * Logout user and invalidate tokens
   */
  async logout(token: string, refreshToken?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const decoded = this.verifyToken(token);
      if (!decoded) {
        return { success: false, error: 'Invalid token' };
      }

      // Invalidate session
      await this.sessionManager.invalidateSession(decoded.userId, refreshToken);

      // Log logout event
      await this.logAuthEvent(decoded.userId, 'logout', {});

      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: 'Logout failed' };
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<AuthResult> {
    try {
      const session = await this.sessionManager.validateRefreshToken(refreshToken);
      if (!session) {
        return { success: false, error: 'Invalid refresh token' };
      }

      const user = await this.userManager.findById(session.userId);
      if (!user || !user.isActive) {
        return { success: false, error: 'User not found or inactive' };
      }

      const tokens = await this.generateTokens(user);
      await this.sessionManager.updateSession(session.id, tokens.refreshToken);

      return {
        success: true,
        user: this.sanitizeUser(user),
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken
      };
    } catch (error) {
      console.error('Token refresh error:', error);
      return { success: false, error: 'Token refresh failed' };
    }
  }

  /**
   * Verify JWT token and return decoded payload
   */
  verifyToken(token: string): { userId: string; role: UserRole; sessionId: string } | null {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret) as any;
      return {
        userId: decoded.userId,
        role: decoded.role,
        sessionId: decoded.sessionId
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Hash password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.config.saltRounds);
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Validate password strength
   */
  validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < this.config.passwordMinLength) {
      errors.push(`Password must be at least ${this.config.passwordMinLength} characters long`);
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate JWT access and refresh tokens
   */
  private async generateTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
    const sessionId = crypto.randomUUID();
    
    const accessTokenPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
      sessionId
    };

    const accessToken = jwt.sign(accessTokenPayload, this.config.jwtSecret, {
      expiresIn: this.config.jwtExpiresIn,
      issuer: 'dual-agent-monitor',
      subject: user.id
    });

    const refreshToken = crypto.randomBytes(32).toString('hex');

    return { accessToken, refreshToken };
  }

  /**
   * Remove sensitive fields from user object
   */
  private sanitizeUser(user: any): User {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }

  /**
   * Check if account is locked due to failed login attempts
   */
  private isAccountLocked(identifier: string): boolean {
    const attempts = this.loginAttempts.get(identifier);
    if (!attempts) return false;

    if (attempts.lockedUntil && attempts.lockedUntil > new Date()) {
      return true;
    }

    return attempts.count >= this.config.maxLoginAttempts;
  }

  /**
   * Record a failed login attempt
   */
  private recordFailedAttempt(identifier: string): void {
    const attempts = this.loginAttempts.get(identifier) || { count: 0 };
    attempts.count++;

    if (attempts.count >= this.config.maxLoginAttempts) {
      attempts.lockedUntil = new Date(Date.now() + this.config.lockoutDuration * 60 * 1000);
    }

    this.loginAttempts.set(identifier, attempts);
  }

  /**
   * Clean up expired lockouts
   */
  private cleanupExpiredLockouts(): void {
    const now = new Date();
    for (const [identifier, attempts] of this.loginAttempts.entries()) {
      if (attempts.lockedUntil && attempts.lockedUntil <= now) {
        this.loginAttempts.delete(identifier);
      }
    }
  }

  /**
   * Log authentication events for audit trail
   */
  private async logAuthEvent(userId: string, event: string, metadata: any): Promise<void> {
    try {
      const query = `
        INSERT INTO audit_log (id, user_id, action, details, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `;
      
      await this.db.run(query, [
        crypto.randomUUID(),
        userId,
        event,
        JSON.stringify(metadata),
        new Date().toISOString()
      ]);
    } catch (error) {
      console.error('Failed to log auth event:', error);
    }
  }

  /**
   * Get user permissions for authorization
   */
  async getUserPermissions(userId: string): Promise<string[]> {
    return this.permissionManager.getUserPermissions(userId);
  }

  /**
   * Check if user has specific permission
   */
  async hasPermission(userId: string, permission: string): Promise<boolean> {
    return this.permissionManager.hasPermission(userId, permission);
  }
}