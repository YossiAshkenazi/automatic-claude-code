import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { AuthManager } from './AuthManager';
import { UserManager } from './UserManager';
import { DatabaseService } from '../database/DatabaseService';

// Extend Express Request interface to include user data
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        role: 'admin' | 'manager' | 'viewer';
        sessionId: string;
        permissions?: string[];
      };
    }
  }
}

let authManager: AuthManager;
let userManager: UserManager;

/**
 * Initialize middleware with database service
 */
export const initializeAuthMiddleware = (db: DatabaseService) => {
  authManager = new AuthManager(db);
  userManager = new UserManager(db);
};

/**
 * JWT Authentication Middleware
 * Verifies JWT token and attaches user information to request
 */
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token is required',
        code: 'TOKEN_MISSING'
      });
    }

    // Verify JWT token
    const decoded = authManager.verifyToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
        code: 'TOKEN_INVALID'
      });
    }

    // Get user information
    const user = await userManager.findById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'User account is inactive or not found',
        code: 'USER_INACTIVE'
      });
    }

    // Get user permissions
    const permissions = await authManager.getUserPermissions(decoded.userId);

    // Attach user information to request
    req.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      sessionId: decoded.sessionId,
      permissions
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token format',
        code: 'TOKEN_MALFORMED'
      });
    }

    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        error: 'Token has expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Authentication service unavailable',
      code: 'AUTH_SERVICE_ERROR'
    });
  }
};

/**
 * Optional Authentication Middleware
 * Attaches user info if token is present, but doesn't require it
 */
export const optionalAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (token) {
      const decoded = authManager.verifyToken(token);
      if (decoded) {
        const user = await userManager.findById(decoded.userId);
        if (user && user.isActive) {
          const permissions = await authManager.getUserPermissions(decoded.userId);
          req.user = {
            id: user.id,
            username: user.username,
            role: user.role,
            sessionId: decoded.sessionId,
            permissions
          };
        }
      }
    }

    next();
  } catch (error) {
    // In optional auth, we don't fail on errors, just continue without user
    console.warn('Optional auth middleware warning:', error);
    next();
  }
};

/**
 * Role-based Authorization Middleware
 */
export const requireRole = (...allowedRoles: ('admin' | 'manager' | 'viewer')[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
        code: 'INSUFFICIENT_ROLE'
      });
    }

    next();
  };
};

/**
 * Permission-based Authorization Middleware
 */
export const requirePermissions = (
  permissions: string | string[],
  requireAll: boolean = true
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];
    const userPermissions = req.user.permissions || [];

    // Admin users have all permissions
    if (req.user.role === 'admin') {
      return next();
    }

    // Check permissions
    const hasPermission = requireAll
      ? requiredPermissions.every(perm => userPermissions.includes(perm))
      : requiredPermissions.some(perm => userPermissions.includes(perm));

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Required permissions: ${requiredPermissions.join(', ')}`,
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    next();
  };
};

/**
 * Admin-only Authorization Middleware
 */
export const requireAdmin = requireRole('admin');

/**
 * Manager or Admin Authorization Middleware
 */
export const requireManagerOrAdmin = requireRole('admin', 'manager');

/**
 * Self or Admin Authorization Middleware
 * Allows users to access their own resources or admins to access any resource
 */
export const requireSelfOrAdmin = (getUserIdFromRequest: (req: Request) => string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const targetUserId = getUserIdFromRequest(req);
    const isAdmin = req.user.role === 'admin';
    const isSelf = req.user.id === targetUserId;

    if (!isAdmin && !isSelf) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only access your own resources.',
        code: 'ACCESS_DENIED'
      });
    }

    next();
  };
};

/**
 * Rate limiting based on user ID
 */
export const createUserRateLimit = (options: {
  windowMs: number;
  maxRequests: number;
  skipAdmin?: boolean;
}) => {
  const requestCounts = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    // Skip rate limiting for admins if configured
    if (options.skipAdmin && req.user.role === 'admin') {
      return next();
    }

    const userId = req.user.id;
    const now = Date.now();
    const userLimit = requestCounts.get(userId);

    if (!userLimit || now > userLimit.resetTime) {
      // First request or window expired
      requestCounts.set(userId, {
        count: 1,
        resetTime: now + options.windowMs
      });
      return next();
    }

    if (userLimit.count >= options.maxRequests) {
      const remainingMs = userLimit.resetTime - now;
      const remainingMinutes = Math.ceil(remainingMs / 60000);

      return res.status(429).json({
        success: false,
        error: `Too many requests. Try again in ${remainingMinutes} minute(s).`,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: remainingMs
      });
    }

    // Increment counter
    userLimit.count++;
    next();
  };
};

/**
 * Audit logging middleware
 * Logs user actions for security and compliance
 */
export const auditMiddleware = (action: string, resourceType?: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Store original res.json to intercept response
    const originalJson = res.json.bind(res);
    
    res.json = function(body: any) {
      // Log the action after response is sent
      if (req.user) {
        logUserAction({
          userId: req.user.id,
          action,
          resourceType,
          resourceId: req.params.id || req.params.userId || undefined,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          success: res.statusCode < 400,
          details: {
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            body: req.method !== 'GET' ? req.body : undefined
          }
        });
      }
      
      return originalJson(body);
    };

    next();
  };
};

/**
 * Log user action for audit trail
 */
async function logUserAction(data: {
  userId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  details: any;
}) {
  try {
    // This would typically write to the audit_log table
    // For now, we'll just log to console
    console.log('Audit Log:', {
      timestamp: new Date().toISOString(),
      ...data
    });

    // TODO: Implement actual database logging
    // await db.run(`INSERT INTO audit_log ...`, [...values]);
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}

/**
 * WebSocket Authentication Middleware
 * Verifies JWT token for WebSocket connections
 */
export const authenticateWebSocket = async (token: string): Promise<{
  success: boolean;
  user?: {
    id: string;
    username: string;
    role: 'admin' | 'manager' | 'viewer';
    permissions: string[];
  };
  error?: string;
}> => {
  try {
    if (!token) {
      return { success: false, error: 'Token is required' };
    }

    const decoded = authManager.verifyToken(token);
    if (!decoded) {
      return { success: false, error: 'Invalid or expired token' };
    }

    const user = await userManager.findById(decoded.userId);
    if (!user || !user.isActive) {
      return { success: false, error: 'User account is inactive or not found' };
    }

    const permissions = await authManager.getUserPermissions(decoded.userId);

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        permissions
      }
    };
  } catch (error) {
    console.error('WebSocket auth error:', error);
    return { success: false, error: 'Authentication failed' };
  }
};

/**
 * Check if user has permission for WebSocket operation
 */
export const checkWebSocketPermission = (
  userRole: string,
  userPermissions: string[],
  requiredPermissions: string | string[]
): boolean => {
  // Admin users have all permissions
  if (userRole === 'admin') {
    return true;
  }

  const required = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
  return required.some(perm => userPermissions.includes(perm));
};

/**
 * CSRF Protection Middleware
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF for GET requests and API calls with valid JWT
  if (req.method === 'GET' || req.headers.authorization?.startsWith('Bearer ')) {
    return next();
  }

  const csrfToken = req.headers['x-csrf-token'] || req.body._csrf;
  const sessionCsrf = req.session?.csrfToken;

  if (!csrfToken || csrfToken !== sessionCsrf) {
    return res.status(403).json({
      success: false,
      error: 'Invalid CSRF token',
      code: 'CSRF_INVALID'
    });
  }

  next();
};

export default {
  authMiddleware,
  optionalAuthMiddleware,
  requireRole,
  requirePermissions,
  requireAdmin,
  requireManagerOrAdmin,
  requireSelfOrAdmin,
  createUserRateLimit,
  auditMiddleware,
  authenticateWebSocket,
  checkWebSocketPermission,
  csrfProtection
};