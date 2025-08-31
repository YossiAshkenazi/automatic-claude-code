import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { AuthManager } from '../../auth/AuthManager';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Mock dependencies
vi.mock('bcryptjs');
vi.mock('jsonwebtoken');
vi.mock('../../database/DatabaseService');

describe('AuthManager', () => {
  let authManager: AuthManager;
  let mockBcrypt: any;
  let mockJwt: any;

  beforeEach(() => {
    mockBcrypt = vi.mocked(bcrypt);
    mockJwt = vi.mocked(jwt);
    authManager = new AuthManager();
  });

  describe('authenticateUser', () => {
    it('should authenticate valid user credentials', async () => {
      const username = 'admin';
      const password = 'password123';
      const hashedPassword = '$2a$10$hashedpassword';

      // Mock database response
      const mockUser = {
        id: 1,
        username: 'admin',
        password_hash: hashedPassword,
        role: 'admin',
        permissions: JSON.stringify(['read', 'write', 'admin'])
      };

      vi.spyOn(authManager as any, 'getUserByUsername').mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true);
      mockJwt.sign.mockReturnValue('mock-jwt-token');

      const result = await authManager.authenticateUser(username, password);

      expect(result.success).toBe(true);
      expect(result.user).toEqual({
        id: 1,
        username: 'admin',
        role: 'admin',
        permissions: ['read', 'write', 'admin']
      });
      expect(result.token).toBe('mock-jwt-token');
    });

    it('should reject invalid credentials', async () => {
      const username = 'admin';
      const password = 'wrongpassword';

      const mockUser = {
        id: 1,
        username: 'admin',
        password_hash: '$2a$10$hashedpassword',
        role: 'admin',
        permissions: JSON.stringify(['read', 'write', 'admin'])
      };

      vi.spyOn(authManager as any, 'getUserByUsername').mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(false);

      const result = await authManager.authenticateUser(username, password);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid credentials');
      expect(result.user).toBeUndefined();
      expect(result.token).toBeUndefined();
    });

    it('should reject non-existent user', async () => {
      const username = 'nonexistent';
      const password = 'password123';

      vi.spyOn(authManager as any, 'getUserByUsername').mockResolvedValue(null);

      const result = await authManager.authenticateUser(username, password);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid credentials');
    });
  });

  describe('verifyToken', () => {
    it('should verify valid JWT token', async () => {
      const token = 'valid-jwt-token';
      const decodedPayload = {
        userId: 1,
        username: 'admin',
        role: 'admin'
      };

      mockJwt.verify.mockReturnValue(decodedPayload);

      const mockUser = {
        id: 1,
        username: 'admin',
        role: 'admin',
        permissions: JSON.stringify(['read', 'write', 'admin'])
      };

      vi.spyOn(authManager as any, 'getUserById').mockResolvedValue(mockUser);

      const result = await authManager.verifyToken(token);

      expect(result.valid).toBe(true);
      expect(result.user).toEqual({
        id: 1,
        username: 'admin',
        role: 'admin',
        permissions: ['read', 'write', 'admin']
      });
    });

    it('should reject invalid JWT token', async () => {
      const token = 'invalid-jwt-token';

      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await authManager.verifyToken(token);

      expect(result.valid).toBe(false);
      expect(result.user).toBeUndefined();
    });

    it('should reject token for non-existent user', async () => {
      const token = 'valid-jwt-token';
      const decodedPayload = {
        userId: 999,
        username: 'deleted-user',
        role: 'admin'
      };

      mockJwt.verify.mockReturnValue(decodedPayload);
      vi.spyOn(authManager as any, 'getUserById').mockResolvedValue(null);

      const result = await authManager.verifyToken(token);

      expect(result.valid).toBe(false);
    });
  });

  describe('hashPassword', () => {
    it('should hash password correctly', async () => {
      const password = 'password123';
      const hashedPassword = '$2a$10$hashedpassword';

      mockBcrypt.hash.mockResolvedValue(hashedPassword);

      const result = await authManager.hashPassword(password);

      expect(result).toBe(hashedPassword);
      expect(mockBcrypt.hash).toHaveBeenCalledWith(password, 10);
    });
  });

  describe('generateToken', () => {
    it('should generate JWT token with user data', () => {
      const user = {
        id: 1,
        username: 'admin',
        role: 'admin'
      };

      mockJwt.sign.mockReturnValue('generated-jwt-token');

      const result = authManager.generateToken(user);

      expect(result).toBe('generated-jwt-token');
      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          username: 'admin',
          role: 'admin'
        }),
        expect.any(String),
        expect.objectContaining({
          expiresIn: '24h'
        })
      );
    });
  });
});