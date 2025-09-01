import express from 'express';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { DatabaseService } from '../database/DatabaseService';
import { AuthManager, UserManager, SessionManager, PermissionManager } from './index';
import { initializeAuthRoutes } from './authRoutes';
import { initializeAuthMiddleware, authMiddleware, authenticateWebSocket, checkWebSocketPermission } from './authMiddleware';
import * as WebSocket from 'ws';

/**
 * Authentication Integration
 * Provides complete authentication setup for the dual-agent monitor
 */
export class AuthIntegration {
  private authManager: AuthManager;
  private userManager: UserManager;
  private sessionManager: SessionManager;
  private permissionManager: PermissionManager;

  constructor(private db: DatabaseService) {
    this.authManager = new AuthManager(db);
    this.userManager = new UserManager(db);
    
    // Ensure JWT_SECRET is set - no fallback allowed for security
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret === 'your-secret-key') {
      throw new Error('JWT_SECRET environment variable must be set to a secure value');
    }
    
    this.sessionManager = new SessionManager(db, {
      jwtSecret: jwtSecret,
      jwtExpiresIn: '15m',
      refreshTokenExpiresIn: '7d'
    });
    this.permissionManager = new PermissionManager(db);
  }

  /**
   * Setup Express app with authentication middleware
   */
  setupExpress(app: express.Application): void {
    // Initialize authentication middleware
    initializeAuthMiddleware(this.db);

    // Security middleware
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'", "ws:", "wss:"]
        }
      },
      crossOriginEmbedderPolicy: false
    }));

    // Rate limiting
    const globalRateLimit = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // Limit each IP to 1000 requests per windowMs
      standardHeaders: true,
      legacyHeaders: false,
    });
    app.use(globalRateLimit);

    // Body parsing and cookies
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    app.use(cookieParser());

    // Session management
    const sessionSecret = process.env.SESSION_SECRET;
    if (!sessionSecret || sessionSecret === 'your-session-secret') {
      throw new Error('SESSION_SECRET environment variable must be set to a secure value');
    }
    
    app.use(session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      }
    }));

    // Authentication routes
    const authRoutes = initializeAuthRoutes(this.db);
    app.use('/api/auth', authRoutes);
  }

  /**
   * Setup WebSocket server with authentication
   */
  setupWebSocket(wss: WebSocket.Server): void {
    wss.on('connection', async (ws: WebSocket, req) => {
      // Extract token from URL parameters or headers
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const token = url.searchParams.get('token') || req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        ws.close(1008, 'Authentication token required');
        return;
      }

      // Authenticate WebSocket connection
      const authResult = await authenticateWebSocket(token);
      if (!authResult.success || !authResult.user) {
        ws.close(1008, authResult.error || 'Authentication failed');
        return;
      }

      // Store user info in WebSocket
      (ws as any).user = authResult.user;

      console.log(`WebSocket authenticated: ${authResult.user.username} (${authResult.user.role})`);

      // Handle WebSocket messages with permission checking
      ws.on('message', async (message: string) => {
        try {
          const data = JSON.parse(message);
          const { type, payload } = data;

          // Check permissions based on message type
          let requiredPermissions: string[] = [];
          
          switch (type) {
            case 'session_control':
              requiredPermissions = ['sessions.create', 'sessions.delete'];
              break;
            case 'agent_control':
              requiredPermissions = ['agents.control'];
              break;
            case 'user_management':
              requiredPermissions = ['users.edit'];
              break;
            case 'system_settings':
              requiredPermissions = ['admin.settings'];
              break;
            default:
              requiredPermissions = ['sessions.view']; // Default permission
          }

          const hasPermission = checkWebSocketPermission(
            authResult.user.role,
            authResult.user.permissions,
            requiredPermissions
          );

          if (!hasPermission) {
            ws.send(JSON.stringify({
              type: 'error',
              message: `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`,
              code: 'PERMISSION_DENIED'
            }));
            return;
          }

          // Process the message (implement your WebSocket logic here)
          this.handleWebSocketMessage(ws, type, payload, authResult.user);

        } catch (error) {
          console.error('WebSocket message error:', error);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format',
            code: 'INVALID_MESSAGE'
          }));
        }
      });

      ws.on('close', () => {
        console.log(`WebSocket disconnected: ${authResult.user?.username}`);
      });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'auth_success',
        user: {
          username: authResult.user.username,
          role: authResult.user.role,
          permissions: authResult.user.permissions
        }
      }));
    });
  }

  /**
   * Handle WebSocket messages based on type and user permissions
   */
  private handleWebSocketMessage(ws: WebSocket, type: string, payload: any, user: any): void {
    // Implementation depends on your specific WebSocket message handling
    // This is a placeholder for your WebSocket logic
    
    switch (type) {
      case 'session_list':
        // Return session list based on user permissions
        ws.send(JSON.stringify({
          type: 'session_list_response',
          data: [] // Your session data here
        }));
        break;
        
      case 'agent_status':
        // Return agent status
        ws.send(JSON.stringify({
          type: 'agent_status_response',
          data: {} // Your agent status here
        }));
        break;
        
      default:
        ws.send(JSON.stringify({
          type: 'error',
          message: `Unknown message type: ${type}`,
          code: 'UNKNOWN_MESSAGE_TYPE'
        }));
    }
  }

  /**
   * Create default admin user if none exists
   */
  async createDefaultAdmin(): Promise<void> {
    try {
      // Check if any admin users exist
      const adminUsers = await this.userManager.getUsersByRole('admin');
      
      if (adminUsers.length === 0) {
        console.log('No admin users found, creating default admin...');
        
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123!';
        const passwordHash = await this.authManager.hashPassword(adminPassword);
        
        const adminUser = await this.userManager.createUser({
          username: 'admin',
          email: 'admin@dual-agent-monitor.local',
          password: adminPassword,
          role: 'admin',
          displayName: 'System Administrator'
        }, passwordHash);

        console.log(`Default admin user created:
  Username: admin
  Email: admin@dual-agent-monitor.local
  Password: ${adminPassword}
  
  ⚠️ IMPORTANT: Change the default password immediately after first login!`);
      }
    } catch (error) {
      console.error('Failed to create default admin user:', error);
    }
  }

  /**
   * Seed demo users for development
   */
  async createDemoUsers(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      return; // Don't create demo users in production
    }

    try {
      const demoUsers = [
        {
          username: 'manager1',
          email: 'manager@demo.local',
          password: 'manager123!',
          role: 'manager' as const,
          displayName: 'Demo Manager'
        },
        {
          username: 'viewer1',
          email: 'viewer@demo.local',
          password: 'viewer123!',
          role: 'viewer' as const,
          displayName: 'Demo Viewer'
        }
      ];

      for (const userData of demoUsers) {
        const existingUser = await this.userManager.findByUsername(userData.username);
        if (!existingUser) {
          const passwordHash = await this.authManager.hashPassword(userData.password);
          await this.userManager.createUser(userData, passwordHash);
          console.log(`Created demo user: ${userData.username} (${userData.role})`);
        }
      }
    } catch (error) {
      console.error('Failed to create demo users:', error);
    }
  }

  /**
   * Get authentication managers for external use
   */
  getManagers() {
    return {
      auth: this.authManager,
      user: this.userManager,
      session: this.sessionManager,
      permission: this.permissionManager
    };
  }

  /**
   * Health check for authentication system
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    components: Record<string, boolean>;
    error?: string;
  }> {
    try {
      const components = {
        database: false,
        userManager: false,
        authManager: false,
        sessionManager: false,
        permissionManager: false
      };

      // Test database connection
      try {
        await this.db.get('SELECT 1');
        components.database = true;
      } catch (error) {
        console.error('Database health check failed:', error);
      }

      // Test user manager
      try {
        await this.userManager.getAllUsers(1, 1);
        components.userManager = true;
      } catch (error) {
        console.error('UserManager health check failed:', error);
      }

      // Test auth manager
      try {
        this.authManager.validatePassword('test123!');
        components.authManager = true;
      } catch (error) {
        console.error('AuthManager health check failed:', error);
      }

      // Test session manager
      try {
        await this.sessionManager.getSessionStats();
        components.sessionManager = true;
      } catch (error) {
        console.error('SessionManager health check failed:', error);
      }

      // Test permission manager
      try {
        await this.permissionManager.getAllPermissions();
        components.permissionManager = true;
      } catch (error) {
        console.error('PermissionManager health check failed:', error);
      }

      const healthy = Object.values(components).every(status => status);

      return {
        healthy,
        components
      };
    } catch (error) {
      return {
        healthy: false,
        components: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

/**
 * Middleware to add authentication to existing routes
 */
export const protectRoute = (permissions?: string | string[]) => {
  return [
    authMiddleware,
    permissions ? require('./authMiddleware').requirePermissions(permissions) : (req: any, res: any, next: any) => next()
  ];
};

/**
 * Utility function to check if user can access resource
 */
export const canAccessResource = async (userId: string, resourceType: string, resourceId: string): Promise<boolean> => {
  // Implement your resource access logic here
  // This could check ownership, permissions, etc.
  return true; // Placeholder
};

export default AuthIntegration;