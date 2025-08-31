import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { DatabaseService } from '../../server/database/DatabaseService';
import { AuthManager } from '../../server/auth/AuthManager';
import { createServer } from './helpers/server';

describe('API Integration Tests', () => {
  let app: express.Application;
  let databaseService: DatabaseService;
  let authToken: string;

  beforeAll(async () => {
    // Setup test database
    databaseService = new DatabaseService(':memory:');
    await databaseService.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        duration INTEGER DEFAULT 0,
        message_count INTEGER DEFAULT 0
      )
    `);

    await databaseService.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        permissions TEXT NOT NULL DEFAULT '[]'
      )
    `);

    // Create test user
    const authManager = new AuthManager();
    const hashedPassword = await authManager.hashPassword('testpass123');
    
    await databaseService.query(
      'INSERT INTO users (username, password_hash, role, permissions) VALUES (?, ?, ?, ?)',
      ['testuser', hashedPassword, 'admin', JSON.stringify(['read', 'write', 'admin'])]
    );

    app = createServer(databaseService);
  });

  afterAll(async () => {
    await databaseService.close();
  });

  beforeEach(async () => {
    // Clean up sessions before each test
    await databaseService.query('DELETE FROM sessions', []);
  });

  describe('Authentication', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'testpass123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toEqual({
        id: expect.any(Number),
        username: 'testuser',
        role: 'admin',
        permissions: ['read', 'write', 'admin']
      });

      authToken = response.body.token;
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should get user profile with valid token', async () => {
      // First login to get token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'testpass123'
        });

      const token = loginResponse.body.token;

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toEqual({
        id: expect.any(Number),
        username: 'testuser',
        role: 'admin',
        permissions: ['read', 'write', 'admin']
      });
    });

    it('should reject requests without token', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
    });
  });

  describe('Sessions API', () => {
    beforeEach(async () => {
      // Login to get auth token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'testpass123'
        });

      authToken = loginResponse.body.token;

      // Insert test sessions
      await databaseService.query(
        'INSERT INTO sessions (id, name, status, duration, message_count) VALUES (?, ?, ?, ?, ?)',
        ['session-1', 'Test Session 1', 'completed', 120000, 25]
      );
      await databaseService.query(
        'INSERT INTO sessions (id, name, status, duration, message_count) VALUES (?, ?, ?, ?, ?)',
        ['session-2', 'Test Session 2', 'active', 60000, 12]
      );
    });

    it('should get all sessions', async () => {
      const response = await request(app)
        .get('/api/sessions')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.sessions).toHaveLength(2);
      expect(response.body.sessions[0]).toHaveProperty('id');
      expect(response.body.sessions[0]).toHaveProperty('name');
      expect(response.body.sessions[0]).toHaveProperty('status');
    });

    it('should get specific session by ID', async () => {
      const response = await request(app)
        .get('/api/sessions/session-1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', 'session-1');
      expect(response.body).toHaveProperty('name', 'Test Session 1');
      expect(response.body).toHaveProperty('status', 'completed');
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .get('/api/sessions/nonexistent-session')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    it('should require authentication for sessions endpoint', async () => {
      const response = await request(app)
        .get('/api/sessions');

      expect(response.status).toBe(401);
    });
  });

  describe('Analytics API', () => {
    beforeEach(async () => {
      // Login to get auth token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'testpass123'
        });

      authToken = loginResponse.body.token;
    });

    it('should get performance metrics', async () => {
      const response = await request(app)
        .get('/api/analytics/performance')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('metrics');
      expect(response.body.metrics).toHaveProperty('averageResponseTime');
      expect(response.body.metrics).toHaveProperty('successRate');
    });

    it('should get agent comparison data', async () => {
      const response = await request(app)
        .get('/api/analytics/agent-comparison')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('comparison');
    });

    it('should require authentication for analytics endpoints', async () => {
      const response = await request(app)
        .get('/api/analytics/performance');

      expect(response.status).toBe(401);
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for unknown endpoints', async () => {
      const response = await request(app)
        .get('/api/nonexistent-endpoint');

      expect(response.status).toBe(404);
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response.status).toBe(400);
    });
  });
});