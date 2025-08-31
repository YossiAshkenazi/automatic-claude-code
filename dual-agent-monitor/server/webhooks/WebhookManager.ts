import crypto from 'crypto';
import axios, { AxiosResponse } from 'axios';
import { EventEmitter } from 'events';
import { WebhookQueue } from './WebhookQueue.js';
import { WebhookSecurity } from './WebhookSecurity.js';
import type { 
  WebhookEndpoint, 
  WebhookEvent, 
  WebhookDeliveryResult, 
  WebhookDeliveryLog,
  WebhookEventPayload,
  WebhookConfig
} from '../types.js';

export interface WebhookManagerOptions {
  maxRetries: number;
  retryDelayMs: number;
  timeoutMs: number;
  maxConcurrentDeliveries: number;
  rateLimitPerMinute: number;
  enableDeadLetterQueue: boolean;
}

export class WebhookManager extends EventEmitter {
  private queue: WebhookQueue;
  private security: WebhookSecurity;
  private endpoints: Map<string, WebhookEndpoint> = new Map();
  private deliveryLogs: Map<string, WebhookDeliveryLog[]> = new Map();
  private rateLimitCounters: Map<string, { count: number; resetTime: number }> = new Map();
  private isProcessing = false;
  private processingPromise?: Promise<void>;

  private readonly options: WebhookManagerOptions = {
    maxRetries: 3,
    retryDelayMs: 1000,
    timeoutMs: 30000,
    maxConcurrentDeliveries: 10,
    rateLimitPerMinute: 60,
    enableDeadLetterQueue: true
  };

  constructor(options?: Partial<WebhookManagerOptions>) {
    super();
    this.options = { ...this.options, ...options };
    this.queue = new WebhookQueue({
      maxRetries: this.options.maxRetries,
      retryDelayMs: this.options.retryDelayMs
    });
    this.security = new WebhookSecurity();

    // Start processing queue
    this.startProcessing();

    // Clean up rate limit counters every minute
    setInterval(() => this.cleanupRateLimitCounters(), 60000);
  }

  /**
   * Register a new webhook endpoint
   */
  async registerEndpoint(endpoint: Omit<WebhookEndpoint, 'id' | 'createdAt' | 'updatedAt'>): Promise<WebhookEndpoint> {
    const id = crypto.randomUUID();
    const now = new Date();
    
    const webhookEndpoint: WebhookEndpoint = {
      ...endpoint,
      id,
      createdAt: now,
      updatedAt: now
    };

    this.endpoints.set(id, webhookEndpoint);
    this.deliveryLogs.set(id, []);

    this.emit('endpoint.registered', { endpoint: webhookEndpoint });
    return webhookEndpoint;
  }

  /**
   * Update an existing webhook endpoint
   */
  async updateEndpoint(id: string, updates: Partial<Omit<WebhookEndpoint, 'id' | 'createdAt'>>): Promise<WebhookEndpoint | null> {
    const endpoint = this.endpoints.get(id);
    if (!endpoint) {
      return null;
    }

    const updatedEndpoint: WebhookEndpoint = {
      ...endpoint,
      ...updates,
      id: endpoint.id, // Preserve original ID
      createdAt: endpoint.createdAt, // Preserve creation date
      updatedAt: new Date()
    };

    this.endpoints.set(id, updatedEndpoint);
    this.emit('endpoint.updated', { endpoint: updatedEndpoint });
    return updatedEndpoint;
  }

  /**
   * Remove a webhook endpoint
   */
  async removeEndpoint(id: string): Promise<boolean> {
    const endpoint = this.endpoints.get(id);
    if (!endpoint) {
      return false;
    }

    this.endpoints.delete(id);
    this.deliveryLogs.delete(id);
    this.emit('endpoint.removed', { endpointId: id });
    return true;
  }

  /**
   * Get all registered endpoints
   */
  getEndpoints(): WebhookEndpoint[] {
    return Array.from(this.endpoints.values());
  }

  /**
   * Get a specific endpoint by ID
   */
  getEndpoint(id: string): WebhookEndpoint | null {
    return this.endpoints.get(id) || null;
  }

  /**
   * Get delivery logs for an endpoint
   */
  getDeliveryLogs(endpointId: string, limit: number = 100): WebhookDeliveryLog[] {
    const logs = this.deliveryLogs.get(endpointId) || [];
    return logs.slice(-limit).reverse(); // Most recent first
  }

  /**
   * Trigger a webhook event
   */
  async triggerEvent(event: WebhookEvent, payload: WebhookEventPayload): Promise<void> {
    const matchingEndpoints = this.getEndpointsForEvent(event);
    
    if (matchingEndpoints.length === 0) {
      return;
    }

    const webhookPayload = this.buildEventPayload(event, payload);

    // Queue deliveries for all matching endpoints
    const deliveryPromises = matchingEndpoints.map(endpoint => 
      this.queue.enqueue({
        id: crypto.randomUUID(),
        endpointId: endpoint.id,
        event,
        payload: webhookPayload,
        createdAt: new Date(),
        attempts: 0,
        nextRetryAt: new Date()
      })
    );

    await Promise.all(deliveryPromises);
    this.emit('event.triggered', { event, payload, endpointCount: matchingEndpoints.length });
  }

  /**
   * Test a webhook endpoint
   */
  async testEndpoint(endpointId: string): Promise<WebhookDeliveryResult> {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) {
      throw new Error(`Endpoint not found: ${endpointId}`);
    }

    const testPayload = this.buildTestPayload();
    
    try {
      const result = await this.deliverWebhook(endpoint, 'webhook.test', testPayload);
      this.logDelivery(endpointId, 'webhook.test', testPayload, result);
      return result;
    } catch (error) {
      const errorResult: WebhookDeliveryResult = {
        success: false,
        statusCode: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        deliveredAt: new Date(),
        duration: 0
      };
      this.logDelivery(endpointId, 'webhook.test', testPayload, errorResult);
      throw error;
    }
  }

  /**
   * Start processing the webhook queue
   */
  private startProcessing(): void {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    this.processingPromise = this.processQueue();
  }

  /**
   * Stop processing the webhook queue
   */
  async stopProcessing(): Promise<void> {
    this.isProcessing = false;
    if (this.processingPromise) {
      await this.processingPromise;
    }
  }

  /**
   * Process webhook deliveries from the queue
   */
  private async processQueue(): Promise<void> {
    while (this.isProcessing) {
      try {
        const deliveries = await this.queue.getReadyDeliveries(this.options.maxConcurrentDeliveries);
        
        if (deliveries.length === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before checking again
          continue;
        }

        // Process deliveries concurrently
        await Promise.allSettled(
          deliveries.map(delivery => this.processDelivery(delivery))
        );
      } catch (error) {
        console.error('Error processing webhook queue:', error);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds on error
      }
    }
  }

  /**
   * Process a single webhook delivery
   */
  private async processDelivery(delivery: any): Promise<void> {
    const endpoint = this.endpoints.get(delivery.endpointId);
    if (!endpoint) {
      await this.queue.markFailed(delivery.id, 'Endpoint not found');
      return;
    }

    // Check rate limiting
    if (!this.checkRateLimit(endpoint.id)) {
      await this.queue.reschedule(delivery.id, new Date(Date.now() + 60000)); // Retry in 1 minute
      return;
    }

    try {
      const result = await this.deliverWebhook(endpoint, delivery.event, delivery.payload);
      this.logDelivery(delivery.endpointId, delivery.event, delivery.payload, result);

      if (result.success) {
        await this.queue.markCompleted(delivery.id);
        this.emit('delivery.success', { delivery, result });
      } else {
        const shouldRetry = delivery.attempts < this.options.maxRetries && result.statusCode !== 400;
        if (shouldRetry) {
          const nextRetryAt = new Date(Date.now() + this.calculateRetryDelay(delivery.attempts));
          await this.queue.reschedule(delivery.id, nextRetryAt);
        } else {
          await this.queue.markFailed(delivery.id, result.error || 'Max retries exceeded');
          this.emit('delivery.failed', { delivery, result });
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const result: WebhookDeliveryResult = {
        success: false,
        statusCode: 0,
        error: errorMessage,
        deliveredAt: new Date(),
        duration: 0
      };

      this.logDelivery(delivery.endpointId, delivery.event, delivery.payload, result);

      if (delivery.attempts < this.options.maxRetries) {
        const nextRetryAt = new Date(Date.now() + this.calculateRetryDelay(delivery.attempts));
        await this.queue.reschedule(delivery.id, nextRetryAt);
      } else {
        await this.queue.markFailed(delivery.id, errorMessage);
        this.emit('delivery.failed', { delivery, result });
      }
    }
  }

  /**
   * Deliver a webhook to an endpoint
   */
  private async deliverWebhook(
    endpoint: WebhookEndpoint, 
    event: WebhookEvent, 
    payload: any
  ): Promise<WebhookDeliveryResult> {
    const startTime = Date.now();
    let response: AxiosResponse | null = null;

    try {
      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Dual-Agent-Monitor-Webhooks/1.0',
        'X-Webhook-Event': event,
        'X-Webhook-Delivery': crypto.randomUUID(),
        'X-Webhook-Timestamp': new Date().toISOString(),
        ...endpoint.headers
      };

      // Add signature if secret is configured
      if (endpoint.secret) {
        const signature = this.security.generateSignature(JSON.stringify(payload), endpoint.secret);
        headers['X-Webhook-Signature'] = signature;
      }

      // Filter payload based on endpoint configuration
      const filteredPayload = this.filterPayload(payload, endpoint);

      // Make HTTP request
      response = await axios.post(endpoint.url, filteredPayload, {
        headers,
        timeout: this.options.timeoutMs,
        validateStatus: (status) => status < 500 // Don't throw on client errors
      });

      const duration = Date.now() - startTime;
      const success = response.status >= 200 && response.status < 300;

      return {
        success,
        statusCode: response.status,
        response: response.data,
        deliveredAt: new Date(),
        duration,
        error: success ? undefined : `HTTP ${response.status}: ${response.statusText}`
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      let statusCode = 0;
      let errorMessage = 'Unknown error';

      if (axios.isAxiosError(error)) {
        statusCode = error.response?.status || 0;
        errorMessage = error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      return {
        success: false,
        statusCode,
        error: errorMessage,
        deliveredAt: new Date(),
        duration
      };
    }
  }

  /**
   * Get endpoints that should receive a specific event
   */
  private getEndpointsForEvent(event: WebhookEvent): WebhookEndpoint[] {
    return Array.from(this.endpoints.values()).filter(endpoint => {
      if (!endpoint.active) {
        return false;
      }

      // Check if endpoint subscribes to this event
      if (endpoint.events.length > 0 && !endpoint.events.includes(event)) {
        return false;
      }

      // Check filters if configured
      if (endpoint.filters && Object.keys(endpoint.filters).length > 0) {
        // Filters would be checked here based on payload content
        // For now, we assume all filtered endpoints match
      }

      return true;
    });
  }

  /**
   * Build the event payload
   */
  private buildEventPayload(event: WebhookEvent, data: WebhookEventPayload): any {
    return {
      id: crypto.randomUUID(),
      event,
      timestamp: new Date().toISOString(),
      data,
      version: '1.0'
    };
  }

  /**
   * Build test payload
   */
  private buildTestPayload(): any {
    return {
      id: crypto.randomUUID(),
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook delivery from Dual-Agent Monitor',
        test: true
      },
      version: '1.0'
    };
  }

  /**
   * Filter payload based on endpoint configuration
   */
  private filterPayload(payload: any, endpoint: WebhookEndpoint): any {
    if (!endpoint.payloadFields || endpoint.payloadFields.length === 0) {
      return payload;
    }

    const filtered: any = { ...payload };
    
    // If specific fields are configured, only include those
    if (endpoint.payloadFields.length > 0) {
      const filteredData: any = {};
      endpoint.payloadFields.forEach(field => {
        if (field in payload.data) {
          filteredData[field] = payload.data[field];
        }
      });
      filtered.data = filteredData;
    }

    return filtered;
  }

  /**
   * Log webhook delivery
   */
  private logDelivery(
    endpointId: string, 
    event: WebhookEvent, 
    payload: any, 
    result: WebhookDeliveryResult
  ): void {
    const logs = this.deliveryLogs.get(endpointId) || [];
    
    const log: WebhookDeliveryLog = {
      id: crypto.randomUUID(),
      endpointId,
      event,
      payload,
      result,
      timestamp: new Date()
    };

    logs.push(log);

    // Keep only the last 1000 logs per endpoint
    if (logs.length > 1000) {
      logs.splice(0, logs.length - 1000);
    }

    this.deliveryLogs.set(endpointId, logs);
  }

  /**
   * Check rate limiting for an endpoint
   */
  private checkRateLimit(endpointId: string): boolean {
    const now = Date.now();
    const minute = Math.floor(now / 60000);
    const key = `${endpointId}:${minute}`;
    
    const counter = this.rateLimitCounters.get(key) || { count: 0, resetTime: (minute + 1) * 60000 };
    
    if (counter.count >= this.options.rateLimitPerMinute) {
      return false;
    }

    counter.count++;
    this.rateLimitCounters.set(key, counter);
    return true;
  }

  /**
   * Clean up old rate limit counters
   */
  private cleanupRateLimitCounters(): void {
    const now = Date.now();
    for (const [key, counter] of this.rateLimitCounters.entries()) {
      if (now > counter.resetTime) {
        this.rateLimitCounters.delete(key);
      }
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attemptNumber: number): number {
    const baseDelay = this.options.retryDelayMs;
    const maxDelay = 300000; // 5 minutes max
    const exponentialDelay = baseDelay * Math.pow(2, attemptNumber);
    const jitteredDelay = exponentialDelay * (0.5 + Math.random() * 0.5); // Add jitter
    return Math.min(jitteredDelay, maxDelay);
  }

  /**
   * Get webhook statistics
   */
  getStatistics(): {
    totalEndpoints: number;
    activeEndpoints: number;
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    averageDeliveryTime: number;
  } {
    const totalEndpoints = this.endpoints.size;
    const activeEndpoints = Array.from(this.endpoints.values()).filter(e => e.active).length;
    
    let totalDeliveries = 0;
    let successfulDeliveries = 0;
    let failedDeliveries = 0;
    let totalDeliveryTime = 0;

    for (const logs of this.deliveryLogs.values()) {
      for (const log of logs) {
        totalDeliveries++;
        totalDeliveryTime += log.result.duration;
        
        if (log.result.success) {
          successfulDeliveries++;
        } else {
          failedDeliveries++;
        }
      }
    }

    return {
      totalEndpoints,
      activeEndpoints,
      totalDeliveries,
      successfulDeliveries,
      failedDeliveries,
      averageDeliveryTime: totalDeliveries > 0 ? totalDeliveryTime / totalDeliveries : 0
    };
  }
}