import express from 'express';
import { WebhookManager } from './WebhookManager.js';
import { WebhookRegistry } from './WebhookRegistry.js';
import { WebhookSecurity } from './WebhookSecurity.js';
import type { 
  WebhookEndpoint, 
  WebhookEvent, 
  WebhookEventPayload,
  WebhookConfig
} from '../types.js';

export interface WebhookRouterOptions {
  webhookManager: WebhookManager;
  webhookRegistry: WebhookRegistry;
  webhookSecurity: WebhookSecurity;
  requireAuth?: boolean;
  adminOnly?: boolean;
}

export function createWebhookRouter(options: WebhookRouterOptions): express.Router {
  const router = express.Router();
  const { webhookManager, webhookRegistry, webhookSecurity } = options;

  // Middleware for authentication (if required)
  const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!options.requireAuth) {
      return next();
    }

    // Check for API key or JWT token
    const apiKey = req.headers['x-api-key'] as string;
    const authHeader = req.headers.authorization;

    if (!apiKey && !authHeader) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Add your authentication logic here
    // For now, we'll just pass through
    next();
  };

  // Middleware for admin-only operations
  const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!options.adminOnly) {
      return next();
    }

    // Check for admin role
    // Add your admin check logic here
    // For now, we'll just pass through
    next();
  };

  // Error handling middleware
  const handleAsync = (fn: Function) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

  // GET /api/webhooks - List all webhooks
  router.get('/', requireAuth, handleAsync(async (req: express.Request, res: express.Response) => {
    const { active, event, integration, limit, offset } = req.query;

    const filters: any = {};
    if (active !== undefined) filters.active = active === 'true';
    if (event) filters.event = event as WebhookEvent;
    if (integration) filters.integration = integration as string;

    const endpoints = webhookRegistry.getEndpoints(filters);
    
    // Apply pagination
    const startIndex = parseInt(offset as string || '0');
    const endIndex = limit ? startIndex + parseInt(limit as string) : undefined;
    const paginatedEndpoints = endpoints.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: paginatedEndpoints,
      pagination: {
        total: endpoints.length,
        offset: startIndex,
        limit: limit ? parseInt(limit as string) : endpoints.length,
        hasMore: endIndex ? endIndex < endpoints.length : false
      }
    });
  }));

  // GET /api/webhooks/:id - Get specific webhook
  router.get('/:id', requireAuth, handleAsync(async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    const endpoint = webhookRegistry.getEndpoint(id);

    if (!endpoint) {
      return res.status(404).json({ 
        success: false, 
        error: 'Webhook not found' 
      });
    }

    res.json({ 
      success: true, 
      data: endpoint 
    });
  }));

  // POST /api/webhooks - Create new webhook
  router.post('/', requireAuth, requireAdmin, handleAsync(async (req: express.Request, res: express.Response) => {
    const {
      name,
      url,
      secret,
      events,
      active = true,
      headers = {},
      payloadFields = [],
      filters = {},
      integration
    } = req.body;

    // Validate required fields
    if (!name || !url) {
      return res.status(400).json({
        success: false,
        error: 'Name and URL are required'
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format'
      });
    }

    // Validate events
    if (events && Array.isArray(events)) {
      const validEvents: WebhookEvent[] = [
        'session.started',
        'session.completed',
        'session.failed',
        'agent.message',
        'performance.alert',
        'anomaly.detected',
        'user.login',
        'cost.threshold',
        'webhook.test'
      ];

      const invalidEvents = events.filter(e => !validEvents.includes(e));
      if (invalidEvents.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Invalid events: ${invalidEvents.join(', ')}`
        });
      }
    }

    try {
      const endpoint = await webhookRegistry.register({
        name,
        url,
        secret,
        events: events || [],
        active,
        headers,
        payloadFields,
        filters,
        integration
      });

      res.status(201).json({ 
        success: true, 
        data: endpoint 
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create webhook'
      });
    }
  }));

  // PUT /api/webhooks/:id - Update webhook
  router.put('/:id', requireAuth, requireAdmin, handleAsync(async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    const updates = req.body;

    // Validate URL if provided
    if (updates.url) {
      try {
        new URL(updates.url);
      } catch {
        return res.status(400).json({
          success: false,
          error: 'Invalid URL format'
        });
      }
    }

    // Validate events if provided
    if (updates.events && Array.isArray(updates.events)) {
      const validEvents: WebhookEvent[] = [
        'session.started',
        'session.completed',
        'session.failed',
        'agent.message',
        'performance.alert',
        'anomaly.detected',
        'user.login',
        'cost.threshold',
        'webhook.test'
      ];

      const invalidEvents = updates.events.filter((e: string) => !validEvents.includes(e as WebhookEvent));
      if (invalidEvents.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Invalid events: ${invalidEvents.join(', ')}`
        });
      }
    }

    try {
      const endpoint = await webhookRegistry.update(id, updates);

      if (!endpoint) {
        return res.status(404).json({ 
          success: false, 
          error: 'Webhook not found' 
        });
      }

      res.json({ 
        success: true, 
        data: endpoint 
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update webhook'
      });
    }
  }));

  // DELETE /api/webhooks/:id - Delete webhook
  router.delete('/:id', requireAuth, requireAdmin, handleAsync(async (req: express.Request, res: express.Response) => {
    const { id } = req.params;

    const success = await webhookRegistry.unregister(id);

    if (!success) {
      return res.status(404).json({ 
        success: false, 
        error: 'Webhook not found' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Webhook deleted successfully' 
    });
  }));

  // POST /api/webhooks/:id/test - Test webhook endpoint
  router.post('/:id/test', requireAuth, handleAsync(async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    const { payload } = req.body;

    try {
      const result = await webhookManager.testEndpoint(id);
      
      res.json({
        success: true,
        data: {
          deliveryResult: result,
          message: 'Test webhook delivered successfully'
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Test failed',
        data: {
          deliveryResult: null
        }
      });
    }
  }));

  // GET /api/webhooks/:id/logs - Get delivery logs
  router.get('/:id/logs', requireAuth, handleAsync(async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    const { limit = '100', offset = '0' } = req.query;

    const endpoint = webhookRegistry.getEndpoint(id);
    if (!endpoint) {
      return res.status(404).json({ 
        success: false, 
        error: 'Webhook not found' 
      });
    }

    const logs = webhookManager.getDeliveryLogs(id, parseInt(limit as string));
    const startIndex = parseInt(offset as string);
    const paginatedLogs = logs.slice(startIndex, startIndex + parseInt(limit as string));

    res.json({
      success: true,
      data: paginatedLogs,
      pagination: {
        total: logs.length,
        offset: startIndex,
        limit: parseInt(limit as string),
        hasMore: startIndex + parseInt(limit as string) < logs.length
      }
    });
  }));

  // GET /api/webhooks/templates - Get available templates
  router.get('/templates', requireAuth, handleAsync(async (req: express.Request, res: express.Response) => {
    const templates = webhookRegistry.getTemplates();
    res.json({ 
      success: true, 
      data: templates 
    });
  }));

  // GET /api/webhooks/integrations - Get available integrations
  router.get('/integrations', requireAuth, handleAsync(async (req: express.Request, res: express.Response) => {
    const integrations = webhookRegistry.getIntegrations();
    res.json({ 
      success: true, 
      data: integrations 
    });
  }));

  // POST /api/webhooks/from-template - Create webhook from template
  router.post('/from-template', requireAuth, requireAdmin, handleAsync(async (req: express.Request, res: express.Response) => {
    const {
      templateId,
      name,
      url,
      secret,
      events,
      headers = {},
      filters = {}
    } = req.body;

    if (!templateId || !name || !url) {
      return res.status(400).json({
        success: false,
        error: 'Template ID, name, and URL are required'
      });
    }

    try {
      const endpoint = await webhookRegistry.createFromTemplate(templateId, {
        name,
        url,
        secret,
        events,
        headers,
        filters
      });

      if (!endpoint) {
        return res.status(404).json({
          success: false,
          error: 'Template not found'
        });
      }

      res.status(201).json({ 
        success: true, 
        data: endpoint 
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create webhook from template'
      });
    }
  }));

  // POST /api/webhooks/trigger - Manually trigger a webhook event (for testing)
  router.post('/trigger', requireAuth, requireAdmin, handleAsync(async (req: express.Request, res: express.Response) => {
    const { event, payload } = req.body;

    if (!event) {
      return res.status(400).json({
        success: false,
        error: 'Event type is required'
      });
    }

    const validEvents: WebhookEvent[] = [
      'session.started',
      'session.completed',
      'session.failed',
      'agent.message',
      'performance.alert',
      'anomaly.detected',
      'user.login',
      'cost.threshold',
      'webhook.test'
    ];

    if (!validEvents.includes(event)) {
      return res.status(400).json({
        success: false,
        error: `Invalid event type: ${event}`
      });
    }

    try {
      await webhookManager.triggerEvent(event, payload || {});
      
      res.json({
        success: true,
        message: `Event ${event} triggered successfully`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to trigger event'
      });
    }
  }));

  // GET /api/webhooks/statistics - Get webhook statistics
  router.get('/statistics', requireAuth, handleAsync(async (req: express.Request, res: express.Response) => {
    const managerStats = webhookManager.getStatistics();
    const registryStats = webhookRegistry.getStatistics();

    res.json({
      success: true,
      data: {
        manager: managerStats,
        registry: registryStats
      }
    });
  }));

  // GET /api/webhooks/health - Get webhook system health
  router.get('/health', requireAuth, handleAsync(async (req: express.Request, res: express.Response) => {
    // This would integrate with WebhookQueue health check
    res.json({
      success: true,
      data: {
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      }
    });
  }));

  // Error handling middleware
  router.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Webhook API error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  });

  return router;
}

// Webhook event trigger helper
export class WebhookEventTrigger {
  constructor(private webhookManager: WebhookManager) {}

  async triggerSessionStarted(sessionId: string, initialTask: string): Promise<void> {
    await this.webhookManager.triggerEvent('session.started', {
      sessionId,
      session: {
        id: sessionId,
        initialTask,
        startTime: new Date(),
        status: 'running'
      } as any
    });
  }

  async triggerSessionCompleted(session: any): Promise<void> {
    await this.webhookManager.triggerEvent('session.completed', {
      sessionId: session.id,
      session
    });
  }

  async triggerSessionFailed(session: any, error: string): Promise<void> {
    await this.webhookManager.triggerEvent('session.failed', {
      sessionId: session.id,
      session,
      alert: {
        type: 'session_failure',
        severity: 'high' as const,
        message: `Session failed: ${error}`,
        details: { error }
      }
    });
  }

  async triggerAgentMessage(message: any): Promise<void> {
    await this.webhookManager.triggerEvent('agent.message', {
      sessionId: message.sessionId,
      agentType: message.agentType,
      message
    });
  }

  async triggerPerformanceAlert(alert: {
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    sessionId?: string;
    metrics?: any;
  }): Promise<void> {
    await this.webhookManager.triggerEvent('performance.alert', {
      sessionId: alert.sessionId,
      alert,
      metrics: alert.metrics
    });
  }

  async triggerAnomalyDetected(anomaly: {
    type: string;
    confidence: number;
    description: string;
    sessionId?: string;
    data: any;
  }): Promise<void> {
    await this.webhookManager.triggerEvent('anomaly.detected', {
      sessionId: anomaly.sessionId,
      anomaly
    });
  }

  async triggerUserLogin(user: {
    id: string;
    email: string;
    timestamp: Date;
  }): Promise<void> {
    await this.webhookManager.triggerEvent('user.login', {
      user
    });
  }

  async triggerCostThreshold(cost: {
    current: number;
    threshold: number;
    period: string;
  }): Promise<void> {
    await this.webhookManager.triggerEvent('cost.threshold', {
      cost,
      alert: {
        type: 'cost_threshold',
        severity: 'medium' as const,
        message: `Cost threshold exceeded: $${cost.current} > $${cost.threshold}`,
        details: cost
      }
    });
  }
}