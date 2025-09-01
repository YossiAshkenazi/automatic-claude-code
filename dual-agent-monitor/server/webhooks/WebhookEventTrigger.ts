import { WebhookManager } from './WebhookManager.js';
import type { 
  WebhookEvent, 
  WebhookEventPayload, 
  AgentMessage, 
  DualAgentSession, 
  SystemEvent, 
  PerformanceMetrics 
} from '../types.js';

/**
 * Central webhook event trigger system
 * Integrates with various parts of the application to trigger webhook events
 */
export class WebhookEventTrigger {
  private webhookManager: WebhookManager;
  private isInitialized = false;

  constructor(webhookManager: WebhookManager) {
    this.webhookManager = webhookManager;
  }

  /**
   * Initialize the webhook event trigger system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Set up event listeners
    this.setupWebhookManagerListeners();
    this.isInitialized = true;
    
    console.log('WebhookEventTrigger initialized');
  }

  /**
   * Set up internal webhook manager listeners for debugging
   */
  private setupWebhookManagerListeners(): void {
    this.webhookManager.on('event.triggered', (data) => {
      console.log(`Webhook event triggered: ${data.event} (${data.endpointCount} endpoints)`);
    });

    this.webhookManager.on('delivery.success', (data) => {
      console.log(`Webhook delivered successfully: ${data.delivery.event} -> ${data.delivery.endpointId}`);
    });

    this.webhookManager.on('delivery.failed', (data) => {
      console.error(`Webhook delivery failed: ${data.delivery.event} -> ${data.delivery.endpointId}`, data.result.error);
    });
  }

  /**
   * Trigger session started event
   */
  async triggerSessionStarted(session: DualAgentSession): Promise<void> {
    const payload: WebhookEventPayload = {
      sessionId: session.id,
      session: {
        id: session.id,
        initialTask: session.initialTask,
        startTime: session.startTime,
        status: session.status,
        workDir: session.workDir
      } as any
    };

    await this.webhookManager.triggerEvent('session.started', payload);
  }

  /**
   * Trigger session completed event
   */
  async triggerSessionCompleted(session: DualAgentSession): Promise<void> {
    const payload: WebhookEventPayload = {
      sessionId: session.id,
      session: session as any
    };

    await this.webhookManager.triggerEvent('session.completed', payload);
  }

  /**
   * Trigger session failed event
   */
  async triggerSessionFailed(session: DualAgentSession, error: string, severity: 'low' | 'medium' | 'high' | 'critical' = 'high'): Promise<void> {
    const payload: WebhookEventPayload = {
      sessionId: session.id,
      session: session as any,
      alert: {
        type: 'session_failure',
        severity,
        message: `Session failed: ${error}`,
        details: { 
          error, 
          failedAt: new Date().toISOString(),
          sessionDuration: session.endTime ? session.endTime.getTime() - session.startTime.getTime() : null
        }
      }
    };

    await this.webhookManager.triggerEvent('session.failed', payload);
  }

  /**
   * Trigger agent message event (if enabled for real-time monitoring)
   */
  async triggerAgentMessage(message: AgentMessage, options?: { skipRealTime?: boolean }): Promise<void> {
    // Skip real-time agent messages unless specifically enabled to avoid spam
    if (options?.skipRealTime && message.messageType !== 'error') {
      return;
    }

    const payload: WebhookEventPayload = {
      sessionId: message.sessionId,
      agentType: message.agentType,
      message: message as any
    };

    await this.webhookManager.triggerEvent('agent.message', payload);
  }

  /**
   * Trigger performance alert event
   */
  async triggerPerformanceAlert(alert: {
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    sessionId?: string;
    metrics?: PerformanceMetrics;
    details?: any;
  }): Promise<void> {
    const payload: WebhookEventPayload = {
      sessionId: alert.sessionId,
      alert: {
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
        details: alert.details
      },
      metrics: alert.metrics
    };

    await this.webhookManager.triggerEvent('performance.alert', payload);
  }

  /**
   * Trigger anomaly detected event
   */
  async triggerAnomalyDetected(anomaly: {
    type: string;
    confidence: number;
    description: string;
    sessionId?: string;
    data: any;
  }): Promise<void> {
    const payload: WebhookEventPayload = {
      sessionId: anomaly.sessionId,
      anomaly
    };

    await this.webhookManager.triggerEvent('anomaly.detected', payload);
  }

  /**
   * Trigger user login event
   */
  async triggerUserLogin(user: {
    id: string;
    email: string;
    timestamp?: Date;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    const payload: WebhookEventPayload = {
      user: {
        ...user,
        id: user.id,
        email: user.email,
        timestamp: user.timestamp || new Date()
      } as any
    };

    await this.webhookManager.triggerEvent('user.login', payload);
  }

  /**
   * Trigger cost threshold event
   */
  async triggerCostThreshold(cost: {
    current: number;
    threshold: number;
    period: string;
    details?: any;
  }): Promise<void> {
    const payload: WebhookEventPayload = {
      cost,
      alert: {
        type: 'cost_threshold',
        severity: cost.current > cost.threshold * 1.5 ? 'high' : 'medium',
        message: `Cost threshold exceeded: $${cost.current} > $${cost.threshold} for ${cost.period}`,
        details: {
          ...cost.details,
          overageAmount: cost.current - cost.threshold,
          overagePercent: Math.round(((cost.current - cost.threshold) / cost.threshold) * 100)
        }
      }
    };

    await this.webhookManager.triggerEvent('cost.threshold', payload);
  }

  /**
   * Trigger system event (converted to appropriate webhook events)
   */
  async triggerSystemEvent(event: SystemEvent): Promise<void> {
    switch (event.eventType) {
      case 'session_start':
        // This would typically be handled by triggerSessionStarted
        break;
      case 'session_end':
        // This would typically be handled by triggerSessionCompleted/Failed
        break;
      case 'error':
        await this.triggerPerformanceAlert({
          type: 'system_error',
          severity: 'high',
          message: `System error: ${event.details}`,
          sessionId: event.sessionId
        });
        break;
      case 'agent_switch':
        // Could trigger agent message event for coordination tracking
        break;
      default:
        // Log unknown system event but don't trigger webhook
        console.log(`Unknown system event type: ${event.eventType}`);
    }
  }

  /**
   * Trigger performance metrics update (for threshold monitoring)
   */
  async triggerPerformanceUpdate(metrics: PerformanceMetrics, thresholds?: {
    responseTimeThreshold?: number;
    errorRateThreshold?: number;
    costThreshold?: number;
  }): Promise<void> {
    const alerts: any[] = [];

    if (thresholds) {
      // Check response time threshold
      if (thresholds.responseTimeThreshold && metrics.responseTime > thresholds.responseTimeThreshold) {
        alerts.push({
          type: 'high_response_time',
          severity: metrics.responseTime > thresholds.responseTimeThreshold * 2 ? 'high' : 'medium',
          message: `Agent response time exceeded threshold: ${metrics.responseTime}ms > ${thresholds.responseTimeThreshold}ms`,
          details: {
            threshold: thresholds.responseTimeThreshold,
            actual: metrics.responseTime,
            agentType: metrics.agentType
          }
        });
      }

      // Check error rate threshold
      if (thresholds.errorRateThreshold && metrics.errorRate > thresholds.errorRateThreshold) {
        alerts.push({
          type: 'high_error_rate',
          severity: metrics.errorRate > thresholds.errorRateThreshold * 2 ? 'critical' : 'high',
          message: `Agent error rate exceeded threshold: ${Math.round(metrics.errorRate * 100)}% > ${Math.round(thresholds.errorRateThreshold * 100)}%`,
          details: {
            threshold: thresholds.errorRateThreshold,
            actual: metrics.errorRate,
            agentType: metrics.agentType
          }
        });
      }

      // Check cost threshold
      if (thresholds.costThreshold && metrics.cost && metrics.cost > thresholds.costThreshold) {
        await this.triggerCostThreshold({
          current: metrics.cost,
          threshold: thresholds.costThreshold,
          period: 'session',
          details: {
            sessionId: metrics.sessionId,
            agentType: metrics.agentType,
            tokensUsed: metrics.tokensUsed
          }
        });
      }
    }

    // Trigger performance alerts
    for (const alert of alerts) {
      await this.triggerPerformanceAlert({
        ...alert,
        sessionId: metrics.sessionId,
        metrics
      });
    }
  }

  /**
   * Batch trigger multiple events (for efficiency)
   */
  async triggerBatch(events: Array<{
    event: WebhookEvent;
    payload: WebhookEventPayload;
  }>): Promise<void> {
    const promises = events.map(({ event, payload }) => 
      this.webhookManager.triggerEvent(event, payload)
    );

    await Promise.all(promises);
  }

  /**
   * Check if webhook events are enabled for a specific event type
   */
  hasActiveWebhooksFor(event: WebhookEvent): boolean {
    const endpoints = this.webhookManager.getEndpoints();
    return endpoints.some(endpoint => 
      endpoint.active && (endpoint.events.length === 0 || endpoint.events.includes(event))
    );
  }

  /**
   * Get webhook statistics
   */
  getStatistics() {
    return this.webhookManager.getStatistics();
  }

  /**
   * Manually trigger a test event
   */
  async triggerTest(endpointId?: string): Promise<void> {
    const payload: WebhookEventPayload = {
      message: 'This is a test webhook delivery from Dual-Agent Monitor',
      test: true,
      timestamp: new Date(),
      webhookEndpointId: endpointId
    } as any;

    await this.webhookManager.triggerEvent('webhook.test', payload);
  }
}

/**
 * Factory function to create webhook event trigger with manager
 */
export function createWebhookEventTrigger(webhookManager: WebhookManager): WebhookEventTrigger {
  return new WebhookEventTrigger(webhookManager);
}

/**
 * Utility functions for common webhook patterns
 */
export class WebhookUtils {
  /**
   * Create session lifecycle handler
   */
  static createSessionLifecycleHandler(eventTrigger: WebhookEventTrigger) {
    return {
      onSessionStarted: (session: DualAgentSession) => eventTrigger.triggerSessionStarted(session),
      onSessionCompleted: (session: DualAgentSession) => eventTrigger.triggerSessionCompleted(session),
      onSessionFailed: (session: DualAgentSession, error: string) => eventTrigger.triggerSessionFailed(session, error),
    };
  }

  /**
   * Create performance monitoring handler
   */
  static createPerformanceMonitor(eventTrigger: WebhookEventTrigger, thresholds: {
    responseTimeThreshold: number;
    errorRateThreshold: number;
    costThreshold?: number;
  }) {
    return {
      onMetricsUpdate: (metrics: PerformanceMetrics) => 
        eventTrigger.triggerPerformanceUpdate(metrics, thresholds),
      onAlert: (alert: any) => eventTrigger.triggerPerformanceAlert(alert),
    };
  }

  /**
   * Create anomaly detection handler
   */
  static createAnomalyHandler(eventTrigger: WebhookEventTrigger) {
    return {
      onAnomalyDetected: (anomaly: any) => eventTrigger.triggerAnomalyDetected(anomaly),
    };
  }

  /**
   * Create authentication handler
   */
  static createAuthHandler(eventTrigger: WebhookEventTrigger) {
    return {
      onUserLogin: (user: any) => eventTrigger.triggerUserLogin(user),
    };
  }

  /**
   * Format error for webhook payload
   */
  static formatError(error: Error | string, context?: any): string {
    if (typeof error === 'string') return error;
    return `${error.name}: ${error.message}${context ? ` (Context: ${JSON.stringify(context)})` : ''}`;
  }

  /**
   * Calculate session duration in human-readable format
   */
  static formatDuration(startTime: Date, endTime?: Date): string {
    const duration = (endTime || new Date()).getTime() - startTime.getTime();
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Sanitize sensitive data from payloads
   */
  static sanitizePayload(payload: any, sensitiveFields: string[] = ['password', 'token', 'secret', 'key']): any {
    const sanitized = JSON.parse(JSON.stringify(payload));
    
    function sanitizeObject(obj: any): void {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
            obj[key] = '[REDACTED]';
          } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            sanitizeObject(obj[key]);
          }
        }
      }
    }
    
    sanitizeObject(sanitized);
    return sanitized;
  }
}