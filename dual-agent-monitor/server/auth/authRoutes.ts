import express from 'express';
import rateLimit from 'express-rate-limit';
import { AuthManager } from './AuthManager';
import { UserManager } from './UserManager';
import { DatabaseService } from '../database/DatabaseService';
import { authMiddleware, requirePermissions, requireRole } from './authMiddleware';

const router = express.Router();

// Rate limiting for authentication endpoints
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

// Initialize authentication services (these should be passed in or injected)
let authManager: AuthManager;
let userManager: UserManager;

export const initializeAuthRoutes = (db: DatabaseService) => {
  authManager = new AuthManager(db);
  userManager = new UserManager(db);
  return router;
};

// ================================
// PUBLIC AUTHENTICATION ROUTES
// ================================

/**
 * POST /api/auth/login - User authentication
 */
router.post('/login', authRateLimit, async (req, res) => {
  try {
    const { username, email, password, rememberMe } = req.body;

    if (!password || (!username && !email)) {
      return res.status(400).json({
        success: false,
        error: 'Username/email and password are required'
      });
    }

    const credentials = {
      username,
      email,
      password
    };

    const result = await authManager.login(credentials);

    if (result.success && result.token && result.refreshToken) {
      // Set HTTP-only cookie for refresh token
      const refreshTokenExpiry = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000; // 30 days or 7 days
      
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: refreshTokenExpiry
      });

      // Log successful login for audit
      req.ip && console.log(`Successful login for user ${result.user?.username} from IP: ${req.ip}`);

      res.json({
        success: true,
        user: result.user,
        token: result.token
      });
    } else {
      // Log failed login attempt
      console.warn(`Failed login attempt for ${username || email} from IP: ${req.ip}`);
      
      res.status(401).json({
        success: false,
        error: result.error || 'Authentication failed'
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication service unavailable'
    });
  }
});

/**
 * POST /api/auth/logout - User logout
 */
router.post('/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const refreshToken = req.cookies.refreshToken;

    if (token) {
      await authManager.logout(token, refreshToken);
    }

    // Clear refresh token cookie
    res.clearCookie('refreshToken');

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
});

/**
 * POST /api/auth/refresh - Refresh access token
 */
router.post('/refresh', generalRateLimit, async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token not provided'
      });
    }

    const result = await authManager.refreshToken(refreshToken);

    if (result.success && result.token && result.refreshToken) {
      // Update refresh token cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.json({
        success: true,
        user: result.user,
        token: result.token
      });
    } else {
      res.clearCookie('refreshToken');
      res.status(401).json({
        success: false,
        error: result.error || 'Token refresh failed'
      });
    }
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      error: 'Token refresh service unavailable'
    });
  }
});

// ================================
// PROTECTED USER PROFILE ROUTES
// ================================

/**
 * GET /api/auth/profile - Get current user profile
 */
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const user = await userManager.findById(userId);
    const profile = await userManager.getUserProfile(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Remove sensitive information
    const { passwordHash, ...safeUser } = user;

    res.json({
      success: true,
      user: safeUser,
      profile
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile'
    });
  }
});

/**
 * PUT /api/auth/profile - Update user profile
 */
router.put('/profile', authMiddleware, generalRateLimit, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const { displayName, preferences } = req.body;

    // Update user profile
    const updatedProfile = await userManager.updateUserProfile(userId, {
      displayName,
      preferences
    });

    if (!updatedProfile) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found'
      });
    }

    res.json({
      success: true,
      profile: updatedProfile
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
});

/**
 * POST /api/auth/change-password - Change user password
 */
router.post('/change-password', authMiddleware, authRateLimit, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required'
      });
    }

    // Validate password strength
    const passwordValidation = authManager.validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Password does not meet requirements',
        details: passwordValidation.errors
      });
    }

    // Get user and verify current password
    const user = await userManager.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const isCurrentPasswordValid = await authManager.verifyPassword(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Hash new password and update
    const newPasswordHash = await authManager.hashPassword(newPassword);
    const success = await userManager.updatePassword(userId, newPasswordHash);

    if (success) {
      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to update password'
      });
    }
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({
      success: false,
      error: 'Password change service unavailable'
    });
  }
});

// ================================
// ADMIN USER MANAGEMENT ROUTES
// ================================

/**
 * GET /api/auth/users - Get all users (admin only)
 */
router.get('/users', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const result = await userManager.getAllUsers(page, limit);

    // Remove sensitive information from all users
    const safeUsers = result.users.map(user => {
      const { passwordHash, ...safeUser } = user;
      return safeUser;
    });

    res.json({
      success: true,
      users: safeUsers,
      total: result.total,
      page,
      limit
    });
  } catch (error) {
    console.error('Users fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
});

/**
 * POST /api/auth/users - Create new user (admin only)
 */
router.post('/users', authMiddleware, requireRole('admin'), generalRateLimit, async (req, res) => {
  try {
    const { username, email, password, role, displayName } = req.body;

    if (!username || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        error: 'Username, email, password, and role are required'
      });
    }

    // Validate password strength
    const passwordValidation = authManager.validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Password does not meet requirements',
        details: passwordValidation.errors
      });
    }

    // Check if username or email already exists
    const existingUser = await userManager.findByUsernameOrEmail(username) || await userManager.findByUsernameOrEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'Username or email already exists'
      });
    }

    // Hash password and create user
    const passwordHash = await authManager.hashPassword(password);
    const user = await userManager.createUser({
      username,
      email,
      password,
      role,
      displayName
    }, passwordHash);

    // Remove sensitive information
    const { passwordHash: _, ...safeUser } = user;

    res.status(201).json({
      success: true,
      user: safeUser
    });
  } catch (error) {
    console.error('User creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create user'
    });
  }
});

/**
 * PUT /api/auth/users/:id - Update user (admin only)
 */
router.put('/users/:id', authMiddleware, requireRole('admin'), generalRateLimit, async (req, res) => {
  try {
    const userId = req.params.id;
    const { username, email, role, isActive, displayName, preferences } = req.body;

    const updatedUser = await userManager.updateUser(userId, {
      username,
      email,
      role,
      isActive,
      displayName,
      preferences
    });

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Remove sensitive information
    const { passwordHash, ...safeUser } = updatedUser;

    res.json({
      success: true,
      user: safeUser
    });
  } catch (error) {
    console.error('User update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user'
    });
  }
});

/**
 * DELETE /api/auth/users/:id - Delete user (admin only)
 */
router.delete('/users/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const userId = req.params.id;
    const currentUserId = req.user?.id;

    // Prevent self-deletion
    if (userId === currentUserId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete your own account'
      });
    }

    const success = await userManager.deleteUser(userId);

    if (success) {
      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
  } catch (error) {
    console.error('User deletion error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete user'
    });
  }
});

/**
 * POST /api/auth/users/:id/reset-password - Reset user password (admin only)
 */
router.post('/users/:id/reset-password', authMiddleware, requireRole('admin'), authRateLimit, async (req, res) => {
  try {
    const userId = req.params.id;

    // Generate temporary password
    const tempPassword = generateSecurePassword();
    const passwordHash = await authManager.hashPassword(tempPassword);

    const success = await userManager.updatePassword(userId, passwordHash);

    if (success) {
      res.json({
        success: true,
        newPassword: tempPassword,
        message: 'Password reset successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset password'
    });
  }
});

// ================================
// PERMISSION MANAGEMENT ROUTES
// ================================

/**
 * GET /api/auth/permissions - Get user permissions
 */
router.get('/permissions', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const permissions = await authManager.getUserPermissions(userId);

    res.json({
      success: true,
      permissions
    });
  } catch (error) {
    console.error('Permissions fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch permissions'
    });
  }
});

// ================================
// UTILITY FUNCTIONS
// ================================

/**
 * Generate a secure random password
 */
function generateSecurePassword(length: number = 12): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  
  // Ensure at least one character from each category
  const categories = [
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    'abcdefghijklmnopqrstuvwxyz',
    '0123456789',
    '!@#$%^&*'
  ];
  
  categories.forEach(category => {
    password += category.charAt(Math.floor(Math.random() * category.length));
  });
  
  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

export { router as authRoutes };