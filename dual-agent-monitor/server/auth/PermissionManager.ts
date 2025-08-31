import * as crypto from 'crypto';
import { DatabaseService } from '../database/DatabaseService';
import { UserRole } from './UserManager';

export interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
  createdAt: Date;
}

export interface RolePermission {
  id: string;
  roleId: string;
  permissionId: string;
  grantedAt: Date;
  grantedBy: string;
}

export interface UserPermission {
  id: string;
  userId: string;
  permissionId: string;
  grantedAt: Date;
  grantedBy: string;
  expiresAt?: Date;
}

export interface PermissionCheck {
  hasPermission: boolean;
  reason?: string;
  source: 'role' | 'user' | 'none';
}

export class PermissionManager {
  private db: DatabaseService;
  private rolePermissions: Map<UserRole, Set<string>> = new Map();
  private permissionCache: Map<string, string[]> = new Map();
  private cacheExpiry: Map<string, number> = new Map();

  constructor(db: DatabaseService) {
    this.db = db;
    this.initializeDefaultPermissions();
    this.setupRolePermissions();
    
    // Clear cache every 5 minutes
    setInterval(() => this.clearExpiredCache(), 300000);
  }

  /**
   * Check if user has a specific permission
   */
  async hasPermission(userId: string, permission: string): Promise<boolean> {
    const check = await this.checkPermission(userId, permission);
    return check.hasPermission;
  }

  /**
   * Detailed permission check with reason
   */
  async checkPermission(userId: string, permission: string): Promise<PermissionCheck> {
    try {
      // Get user's role
      const userQuery = 'SELECT role FROM users WHERE id = ? AND is_active = 1';
      const userResult = await this.db.get(userQuery, [userId]);
      
      if (!userResult) {
        return { hasPermission: false, reason: 'User not found or inactive', source: 'none' };
      }

      const userRole = userResult.role as UserRole;

      // Check role-based permissions first
      if (this.hasRolePermission(userRole, permission)) {
        return { hasPermission: true, source: 'role' };
      }

      // Check user-specific permissions
      const hasUserPermission = await this.hasUserSpecificPermission(userId, permission);
      if (hasUserPermission) {
        return { hasPermission: true, source: 'user' };
      }

      return { 
        hasPermission: false, 
        reason: `Permission '${permission}' not granted to user or role '${userRole}'`,
        source: 'none' 
      };
    } catch (error) {
      console.error('Permission check error:', error);
      return { hasPermission: false, reason: 'Permission check failed', source: 'none' };
    }
  }

  /**
   * Get all permissions for a user (cached)
   */
  async getUserPermissions(userId: string): Promise<string[]> {
    // Check cache first
    const cached = this.permissionCache.get(userId);
    const expiry = this.cacheExpiry.get(userId);
    
    if (cached && expiry && expiry > Date.now()) {
      return cached;
    }

    // Get fresh permissions
    const permissions = await this.loadUserPermissions(userId);
    
    // Cache for 5 minutes
    this.permissionCache.set(userId, permissions);
    this.cacheExpiry.set(userId, Date.now() + 300000);
    
    return permissions;
  }

  /**
   * Grant permission to user
   */
  async grantUserPermission(
    userId: string, 
    permission: string, 
    grantedBy: string,
    expiresAt?: Date
  ): Promise<boolean> {
    try {
      const permissionId = await this.getOrCreatePermission(permission);
      if (!permissionId) {
        return false;
      }

      // Check if permission already exists
      const existing = await this.db.get(
        'SELECT id FROM user_permissions WHERE user_id = ? AND permission_id = ?',
        [userId, permissionId]
      );

      if (existing) {
        return true; // Already has permission
      }

      const query = `
        INSERT INTO user_permissions (id, user_id, permission_id, granted_at, granted_by, expires_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      await this.db.run(query, [
        crypto.randomUUID(),
        userId,
        permissionId,
        new Date().toISOString(),
        grantedBy,
        expiresAt?.toISOString() || null
      ]);

      // Clear user's permission cache
      this.clearUserCache(userId);
      
      return true;
    } catch (error) {
      console.error('Error granting user permission:', error);
      return false;
    }
  }

  /**
   * Revoke permission from user
   */
  async revokeUserPermission(userId: string, permission: string): Promise<boolean> {
    try {
      const permissionId = await this.getPermissionId(permission);
      if (!permissionId) {
        return false;
      }

      const query = 'DELETE FROM user_permissions WHERE user_id = ? AND permission_id = ?';
      const result = await this.db.run(query, [userId, permissionId]);

      // Clear user's permission cache
      this.clearUserCache(userId);

      return result.changes > 0;
    } catch (error) {
      console.error('Error revoking user permission:', error);
      return false;
    }
  }

  /**
   * Get all permissions for a role
   */
  getRolePermissions(role: UserRole): string[] {
    const permissions = this.rolePermissions.get(role);
    return permissions ? Array.from(permissions) : [];
  }

  /**
   * Get all available permissions
   */
  async getAllPermissions(): Promise<Permission[]> {
    const query = `
      SELECT id, name, description, category, created_at
      FROM permissions
      ORDER BY category, name
    `;

    const results = await this.db.all(query, []);
    return results.map(this.mapRowToPermission);
  }

  /**
   * Get permissions by category
   */
  async getPermissionsByCategory(category: string): Promise<Permission[]> {
    const query = `
      SELECT id, name, description, category, created_at
      FROM permissions
      WHERE category = ?
      ORDER BY name
    `;

    const results = await this.db.all(query, [category]);
    return results.map(this.mapRowToPermission);
  }

  /**
   * Get user's granted permissions (not from role)
   */
  async getUserSpecificPermissions(userId: string): Promise<UserPermission[]> {
    const query = `
      SELECT up.id, up.user_id, up.permission_id, up.granted_at, up.granted_by, up.expires_at,
             p.name as permission_name
      FROM user_permissions up
      JOIN permissions p ON up.permission_id = p.id
      WHERE up.user_id = ? AND (up.expires_at IS NULL OR up.expires_at > ?)
      ORDER BY up.granted_at DESC
    `;

    const results = await this.db.all(query, [userId, new Date().toISOString()]);
    return results.map(row => ({
      id: row.id,
      userId: row.user_id,
      permissionId: row.permission_id,
      grantedAt: new Date(row.granted_at),
      grantedBy: row.granted_by,
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined
    }));
  }

  /**
   * Check if role has permission
   */
  private hasRolePermission(role: UserRole, permission: string): boolean {
    const permissions = this.rolePermissions.get(role);
    return permissions ? permissions.has(permission) : false;
  }

  /**
   * Check if user has user-specific permission
   */
  private async hasUserSpecificPermission(userId: string, permission: string): Promise<boolean> {
    const query = `
      SELECT COUNT(*) as count
      FROM user_permissions up
      JOIN permissions p ON up.permission_id = p.id
      WHERE up.user_id = ? AND p.name = ? 
      AND (up.expires_at IS NULL OR up.expires_at > ?)
    `;

    const result = await this.db.get(query, [userId, permission, new Date().toISOString()]);
    return (result?.count || 0) > 0;
  }

  /**
   * Load all permissions for a user
   */
  private async loadUserPermissions(userId: string): Promise<string[]> {
    // Get user's role
    const userQuery = 'SELECT role FROM users WHERE id = ? AND is_active = 1';
    const userResult = await this.db.get(userQuery, [userId]);
    
    if (!userResult) {
      return [];
    }

    const permissions = new Set<string>();

    // Add role-based permissions
    const rolePermissions = this.getRolePermissions(userResult.role);
    rolePermissions.forEach(p => permissions.add(p));

    // Add user-specific permissions
    const userSpecificQuery = `
      SELECT p.name
      FROM user_permissions up
      JOIN permissions p ON up.permission_id = p.id
      WHERE up.user_id = ? AND (up.expires_at IS NULL OR up.expires_at > ?)
    `;

    const userSpecificResults = await this.db.all(userSpecificQuery, [
      userId, 
      new Date().toISOString()
    ]);

    userSpecificResults.forEach(row => permissions.add(row.name));

    return Array.from(permissions);
  }

  /**
   * Get or create permission ID
   */
  private async getOrCreatePermission(permissionName: string): Promise<string | null> {
    let permissionId = await this.getPermissionId(permissionName);
    
    if (!permissionId) {
      // Create new permission
      permissionId = crypto.randomUUID();
      const category = this.inferPermissionCategory(permissionName);
      
      await this.db.run(
        'INSERT INTO permissions (id, name, description, category, created_at) VALUES (?, ?, ?, ?, ?)',
        [permissionId, permissionName, `Auto-created permission: ${permissionName}`, category, new Date().toISOString()]
      );
    }
    
    return permissionId;
  }

  /**
   * Get permission ID by name
   */
  private async getPermissionId(permissionName: string): Promise<string | null> {
    const result = await this.db.get('SELECT id FROM permissions WHERE name = ?', [permissionName]);
    return result?.id || null;
  }

  /**
   * Infer permission category from name
   */
  private inferPermissionCategory(permissionName: string): string {
    if (permissionName.includes('session')) return 'sessions';
    if (permissionName.includes('agent')) return 'agents';
    if (permissionName.includes('user')) return 'users';
    if (permissionName.includes('admin')) return 'administration';
    if (permissionName.includes('analytics')) return 'analytics';
    return 'general';
  }

  /**
   * Clear user's permission cache
   */
  private clearUserCache(userId: string): void {
    this.permissionCache.delete(userId);
    this.cacheExpiry.delete(userId);
  }

  /**
   * Clear expired cache entries
   */
  private clearExpiredCache(): void {
    const now = Date.now();
    for (const [userId, expiry] of this.cacheExpiry.entries()) {
      if (expiry <= now) {
        this.permissionCache.delete(userId);
        this.cacheExpiry.delete(userId);
      }
    }
  }

  /**
   * Initialize default permissions in database
   */
  private async initializeDefaultPermissions(): Promise<void> {
    const permissions = [
      // Session permissions
      { name: 'sessions.view', description: 'View agent sessions', category: 'sessions' },
      { name: 'sessions.create', description: 'Create new sessions', category: 'sessions' },
      { name: 'sessions.delete', description: 'Delete sessions', category: 'sessions' },
      { name: 'sessions.replay', description: 'Replay sessions', category: 'sessions' },
      
      // Agent permissions
      { name: 'agents.monitor', description: 'Monitor agent activity', category: 'agents' },
      { name: 'agents.control', description: 'Control agent behavior', category: 'agents' },
      
      // User management permissions
      { name: 'users.view', description: 'View users', category: 'users' },
      { name: 'users.create', description: 'Create users', category: 'users' },
      { name: 'users.edit', description: 'Edit users', category: 'users' },
      { name: 'users.delete', description: 'Delete users', category: 'users' },
      
      // Analytics permissions
      { name: 'analytics.view', description: 'View analytics', category: 'analytics' },
      { name: 'analytics.export', description: 'Export analytics data', category: 'analytics' },
      
      // Administration permissions
      { name: 'admin.settings', description: 'Manage system settings', category: 'administration' },
      { name: 'admin.logs', description: 'View system logs', category: 'administration' },
      { name: 'admin.backup', description: 'Backup and restore', category: 'administration' }
    ];

    for (const perm of permissions) {
      try {
        const existingQuery = 'SELECT id FROM permissions WHERE name = ?';
        const existing = await this.db.get(existingQuery, [perm.name]);
        
        if (!existing) {
          const insertQuery = `
            INSERT INTO permissions (id, name, description, category, created_at)
            VALUES (?, ?, ?, ?, ?)
          `;
          
          await this.db.run(insertQuery, [
            crypto.randomUUID(),
            perm.name,
            perm.description,
            perm.category,
            new Date().toISOString()
          ]);
        }
      } catch (error) {
        // Ignore errors during initialization (table might not exist yet)
      }
    }
  }

  /**
   * Set up role-based permissions
   */
  private setupRolePermissions(): void {
    // Admin role - has all permissions
    this.rolePermissions.set('admin', new Set([
      'sessions.view', 'sessions.create', 'sessions.delete', 'sessions.replay',
      'agents.monitor', 'agents.control',
      'users.view', 'users.create', 'users.edit', 'users.delete',
      'analytics.view', 'analytics.export',
      'admin.settings', 'admin.logs', 'admin.backup'
    ]));

    // Manager role - can manage sessions and view analytics
    this.rolePermissions.set('manager', new Set([
      'sessions.view', 'sessions.create', 'sessions.delete', 'sessions.replay',
      'agents.monitor', 'agents.control',
      'analytics.view', 'analytics.export'
    ]));

    // Viewer role - read-only access
    this.rolePermissions.set('viewer', new Set([
      'sessions.view',
      'agents.monitor',
      'analytics.view'
    ]));
  }

  /**
   * Map database row to Permission object
   */
  private mapRowToPermission(row: any): Permission {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      createdAt: new Date(row.created_at)
    };
  }
}