import { WebhookManager } from '../WebhookManager';
import { WebhookQueue } from '../WebhookQueue';
import { WebhookSecurity } from '../WebhookSecurity';
import type { WebhookEndpoint, WebhookEvent, WebhookEventPayload, AgentMessage } from '../../types';

// Mock axios
jest.mock('axios');
const mockedAxios = jest.mocked(require('axios'));

describe('WebhookManager', () => {
  let webhookManager: WebhookManager;
  let mockEndpoint: WebhookEndpoint;

  beforeEach(() => {
    jest.clearAllMocks();
    webhookManager = new WebhookManager({
      maxRetries: 2,
      retryDelayMs: 100,
      timeoutMs: 5000,
      maxConcurrentDeliveries: 5,
      rateLimitPerMinute: 60,
      enableDeadLetterQueue: true
    });

    mockEndpoint = {
      id: 'test-endpoint-1',
      name: 'Test Webhook',
      url: 'https://example.com/webhook',
      secret: 'test-secret',
      events: ['session.started', 'session.completed'],
      active: true,
      headers: { 'X-Custom': 'test' },
      payloadFields: ['sessionId', 'message'],
      filters: {},
      integration: 'test',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  });

  afterEach(async () => {
    await webhookManager.stopProcessing();
  });

  describe('Endpoint Management', () => {
    test('should register a new endpoint', async () => {
      const endpoint = await webhookManager.registerEndpoint({
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['session.started'],
        active: true
      });

      expect(endpoint).toBeDefined();
      expect(endpoint.id).toBeDefined();
      expect(endpoint.name).toBe('Test Webhook');
      expect(endpoint.url).toBe('https://example.com/webhook');
      expect(endpoint.events).toEqual(['session.started']);
      expect(endpoint.active).toBe(true);
      expect(endpoint.createdAt).toBeDefined();
      expect(endpoint.updatedAt).toBeDefined();
    });

    test('should update an existing endpoint', async () => {
      const endpoint = await webhookManager.registerEndpoint({
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['session.started'],
        active: true
      });

      const updatedEndpoint = await webhookManager.updateEndpoint(endpoint.id, {
        name: 'Updated Webhook',
        active: false
      });

      expect(updatedEndpoint).toBeDefined();
      expect(updatedEndpoint!.name).toBe('Updated Webhook');
      expect(updatedEndpoint!.active).toBe(false);
      expect(updatedEndpoint!.updatedAt.getTime()).toBeGreaterThan(endpoint.createdAt.getTime());
    });

    test('should remove an endpoint', async () => {
      const endpoint = await webhookManager.registerEndpoint({
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['session.started'],
        active: true
      });

      const removed = await webhookManager.removeEndpoint(endpoint.id);
      expect(removed).toBe(true);

      const retrieved = webhookManager.getEndpoint(endpoint.id);
      expect(retrieved).toBeNull();
    });

    test('should get all endpoints', async () => {
      await webhookManager.registerEndpoint({
        name: 'Webhook 1',
        url: 'https://example.com/webhook1',
        events: ['session.started'],
        active: true
      });

      await webhookManager.registerEndpoint({
        name: 'Webhook 2',
        url: 'https://example.com/webhook2',
        events: ['session.completed'],
        active: false
      });

      const endpoints = webhookManager.getEndpoints();
      expect(endpoints).toHaveLength(2);
    });
  });

  describe('Event Triggering', () => {
    beforeEach(async () => {
      await webhookManager.registerEndpoint({
        name: 'Test Webhook',
        url: 'https://httpbin.org/post',
        events: ['session.started'],
        active: true,
        secret: 'test-secret'
      });

      // Mock successful HTTP response
      mockedAxios.post.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        data: { received: true }
      });
    });

    test('should trigger webhook events', async () => {
      const payload: WebhookEventPayload = {
        sessionId: 'test-session-123',
        session: {
          id: 'test-session-123',
          initialTask: 'Test task',
          startTime: new Date().toISOString(),
          status: 'running'
        } as any
      };

      await webhookManager.triggerEvent('session.started', payload);

      // Wait a bit for async processing
      await new Promise(resolve => setTimeout(resolve, 200));

      const stats = webhookManager.getStatistics();
      expect(stats.totalEndpoints).toBe(1);
      expect(stats.activeEndpoints).toBe(1);
    });

    test('should filter events based on endpoint configuration', async () => {
      // Register endpoint that only listens to session.completed
      await webhookManager.registerEndpoint({
        name: 'Completion Only Webhook',
        url: 'https://httpbin.org/post',
        events: ['session.completed'],
        active: true
      });

      const payload: WebhookEventPayload = {
        sessionId: 'test-session-123'
      };

      // Trigger session.started (should not be sent to completion-only webhook)
      await webhookManager.triggerEvent('session.started', payload);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should still have called axios.post once for the general webhook from beforeEach
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    test('should handle inactive endpoints', async () => {
      // Register inactive endpoint
      await webhookManager.registerEndpoint({
        name: 'Inactive Webhook',
        url: 'https://httpbin.org/post',
        events: ['session.started'],
        active: false
      });

      const payload: WebhookEventPayload = {
        sessionId: 'test-session-123'
      };

      await webhookManager.triggerEvent('session.started', payload);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should only call once for the active endpoint from beforeEach
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('Webhook Testing', () => {
    test('should test webhook endpoint successfully', async () => {
      const endpoint = await webhookManager.registerEndpoint({
        name: 'Test Webhook',
        url: 'https://httpbin.org/post',
        events: ['webhook.test'],
        active: true
      });

      mockedAxios.post.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        data: { test: 'success' }
      });

      const result = await webhookManager.testEndpoint(endpoint.id);

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.response).toEqual({ test: 'success' });
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    test('should handle test endpoint failure', async () => {
      const endpoint = await webhookManager.registerEndpoint({
        name: 'Test Webhook',
        url: 'https://httpbin.org/post',
        events: ['webhook.test'],
        active: true
      });

      mockedAxios.post.mockRejectedValue(new Error('Network error'));

      await expect(webhookManager.testEndpoint(endpoint.id)).rejects.toThrow('Network error');
    });

    test('should return error for non-existent endpoint test', async () => {
      await expect(webhookManager.testEndpoint('non-existent-id')).rejects.toThrow('Endpoint not found');
    });
  });

  describe('Payload Processing', () => {
    test('should build proper event payload', async () => {
      const endpoint = await webhookManager.registerEndpoint({
        name: 'Test Webhook',
        url: 'https://httpbin.org/post',
        events: ['session.started'],
        active: true,
        payloadFields: ['sessionId', 'timestamp']
      });

      const eventPayload: WebhookEventPayload = {
        sessionId: 'test-session-123',
        message: {
          id: 'test-msg',
          sessionId: 'test-session-123',
          agentType: 'manager',
          messageType: 'prompt',
          content: 'This should be filtered out',
          timestamp: new Date()
        } as AgentMessage
      };

      await webhookManager.triggerEvent('session.started', eventPayload);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://httpbin.org/post',
        expect.objectContaining({
          id: expect.any(String),
          event: 'session.started',
          timestamp: expect.any(String),
          version: '1.0',
          data: expect.objectContaining({
            sessionId: 'test-session-123'
          })
        }),
        expect.any(Object)
      );
    });

    test('should include webhook signature when secret is configured', async () => {
      const endpoint = await webhookManager.registerEndpoint({
        name: 'Test Webhook',
        url: 'https://httpbin.org/post',
        events: ['session.started'],
        active: true,
        secret: 'test-secret-key'
      });

      await webhookManager.triggerEvent('session.started', { sessionId: 'test' });
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Webhook-Signature': expect.stringMatching(/^sha256=/)
          })
        })
      );
    });
  });

  describe('Error Handling and Retries', () => {
    test('should retry failed deliveries', async () => {
      const endpoint = await webhookManager.registerEndpoint({
        name: 'Failing Webhook',
        url: 'https://httpbin.org/status/500',
        events: ['session.started'],
        active: true
      });

      // Mock failure then success
      mockedAxios.post
        .mockRejectedValueOnce(new Error('Server error'))
        .mockResolvedValueOnce({
          status: 200,
          statusText: 'OK',
          data: {}
        });

      await webhookManager.triggerEvent('session.started', { sessionId: 'test' });
      
      // Wait for retries
      await new Promise(resolve => setTimeout(resolve, 500));

      // Should have attempted multiple times
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });

    test('should respect rate limiting', async () => {
      const webhookManagerWithLowLimit = new WebhookManager({
        rateLimitPerMinute: 1,
        maxRetries: 0
      });

      const endpoint = await webhookManagerWithLowLimit.registerEndpoint({
        name: 'Rate Limited Webhook',
        url: 'https://httpbin.org/post',
        events: ['session.started'],
        active: true
      });

      mockedAxios.post.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        data: {}
      });

      // Trigger multiple events rapidly
      await Promise.all([
        webhookManagerWithLowLimit.triggerEvent('session.started', { sessionId: 'test1' }),
        webhookManagerWithLowLimit.triggerEvent('session.started', { sessionId: 'test2' }),
        webhookManagerWithLowLimit.triggerEvent('session.started', { sessionId: 'test3' })
      ]);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should have been rate limited
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);

      await webhookManagerWithLowLimit.stopProcessing();
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should track delivery statistics', async () => {
      const endpoint = await webhookManager.registerEndpoint({
        name: 'Stats Webhook',
        url: 'https://httpbin.org/post',
        events: ['session.started'],
        active: true
      });

      mockedAxios.post.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        data: {}
      });

      await webhookManager.triggerEvent('session.started', { sessionId: 'test' });
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));

      const stats = webhookManager.getStatistics();
      expect(stats.totalEndpoints).toBe(1);
      expect(stats.activeEndpoints).toBe(1);
      expect(stats.totalDeliveries).toBeGreaterThan(0);
    });

    test('should retrieve delivery logs', async () => {
      const endpoint = await webhookManager.registerEndpoint({
        name: 'Logged Webhook',
        url: 'https://httpbin.org/post',
        events: ['session.started'],
        active: true
      });

      mockedAxios.post.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        data: { success: true }
      });

      await webhookManager.triggerEvent('session.started', { sessionId: 'test' });
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));

      const logs = webhookManager.getDeliveryLogs(endpoint.id, 10);
      expect(logs).toBeDefined();
      expect(Array.isArray(logs)).toBe(true);
    });
  });

  describe('Event Listeners', () => {
    test('should emit events for endpoint registration', (done) => {
      webhookManager.once('endpoint.registered', (data) => {
        expect(data.endpoint).toBeDefined();
        expect(data.endpoint.name).toBe('Event Test Webhook');
        done();
      });

      webhookManager.registerEndpoint({
        name: 'Event Test Webhook',
        url: 'https://example.com/webhook',
        events: ['session.started'],
        active: true
      });
    });

    test('should emit events for successful deliveries', (done) => {
      webhookManager.once('delivery.success', (data) => {
        expect(data.delivery).toBeDefined();
        expect(data.result).toBeDefined();
        expect(data.result.success).toBe(true);
        done();
      });

      webhookManager.registerEndpoint({
        name: 'Success Event Webhook',
        url: 'https://httpbin.org/post',
        events: ['session.started'],
        active: true
      }).then(() => {
        mockedAxios.post.mockResolvedValue({
          status: 200,
          statusText: 'OK',
          data: {}
        });

        webhookManager.triggerEvent('session.started', { sessionId: 'test' });
      });
    });
  });
});