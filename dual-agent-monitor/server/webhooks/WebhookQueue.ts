import { EventEmitter } from 'events';
import type { WebhookEvent } from '../types.js';

export interface QueuedWebhookDelivery {
  id: string;
  endpointId: string;
  event: WebhookEvent;
  payload: any;
  createdAt: Date;
  scheduledFor: Date;
  attempts: number;
  maxRetries: number;
  nextRetryAt: Date;
  lastError?: string;
  priority: number;
  metadata?: Record<string, any>;
}

export interface WebhookQueueOptions {
  maxRetries: number;
  retryDelayMs: number;
  maxQueueSize: number;
  enablePriorityQueue: boolean;
  deadLetterQueueEnabled: boolean;
}

export interface QueueStatistics {
  totalEnqueued: number;
  totalProcessed: number;
  totalFailed: number;
  currentQueueSize: number;
  averageProcessingTime: number;
  oldestPendingDelivery?: Date;
  deadLetterQueueSize: number;
}

export class WebhookQueue extends EventEmitter {
  private queue: QueuedWebhookDelivery[] = [];
  private deadLetterQueue: QueuedWebhookDelivery[] = [];
  private processing: Map<string, QueuedWebhookDelivery> = new Map();
  private statistics: QueueStatistics = {
    totalEnqueued: 0,
    totalProcessed: 0,
    totalFailed: 0,
    currentQueueSize: 0,
    averageProcessingTime: 0,
    deadLetterQueueSize: 0
  };
  private processingTimes: number[] = [];

  private readonly options: WebhookQueueOptions = {
    maxRetries: 3,
    retryDelayMs: 1000,
    maxQueueSize: 10000,
    enablePriorityQueue: true,
    deadLetterQueueEnabled: true
  };

  constructor(options?: Partial<WebhookQueueOptions>) {
    super();
    this.options = { ...this.options, ...options };

    // Clean up old processing entries periodically
    setInterval(() => this.cleanupProcessing(), 60000);

    // Update statistics periodically
    setInterval(() => this.updateStatistics(), 10000);
  }

  /**
   * Enqueue a webhook delivery
   */
  async enqueue(delivery: Omit<QueuedWebhookDelivery, 'scheduledFor' | 'maxRetries' | 'priority'>): Promise<void> {
    if (this.queue.length >= this.options.maxQueueSize) {
      throw new Error(`Queue is full (max size: ${this.options.maxQueueSize})`);
    }

    const queuedDelivery: QueuedWebhookDelivery = {
      ...delivery,
      scheduledFor: delivery.nextRetryAt || new Date(),
      maxRetries: this.options.maxRetries,
      priority: this.calculatePriority(delivery.event, delivery.endpointId)
    };

    // Insert in priority order if priority queue is enabled
    if (this.options.enablePriorityQueue) {
      this.insertByPriority(queuedDelivery);
    } else {
      this.queue.push(queuedDelivery);
    }

    this.statistics.totalEnqueued++;
    this.emit('delivery.enqueued', queuedDelivery);
  }

  /**
   * Get ready deliveries for processing
   */
  async getReadyDeliveries(limit: number = 10): Promise<QueuedWebhookDelivery[]> {
    const now = new Date();
    const readyDeliveries: QueuedWebhookDelivery[] = [];

    // Find deliveries that are ready to be processed
    for (let i = 0; i < this.queue.length && readyDeliveries.length < limit; i++) {
      const delivery = this.queue[i];
      
      // Check if delivery is ready and not already being processed
      if (delivery.scheduledFor <= now && !this.processing.has(delivery.id)) {
        readyDeliveries.push(delivery);
        this.processing.set(delivery.id, delivery);
        
        // Remove from queue
        this.queue.splice(i, 1);
        i--; // Adjust index after removal
      }
    }

    return readyDeliveries;
  }

  /**
   * Mark a delivery as completed successfully
   */
  async markCompleted(deliveryId: string): Promise<void> {
    const delivery = this.processing.get(deliveryId);
    if (!delivery) {
      return;
    }

    this.processing.delete(deliveryId);
    this.statistics.totalProcessed++;

    // Track processing time
    const processingTime = Date.now() - delivery.createdAt.getTime();
    this.processingTimes.push(processingTime);

    // Keep only last 1000 processing times for average calculation
    if (this.processingTimes.length > 1000) {
      this.processingTimes.shift();
    }

    this.emit('delivery.completed', { deliveryId, processingTime });
  }

  /**
   * Mark a delivery as failed
   */
  async markFailed(deliveryId: string, error: string): Promise<void> {
    const delivery = this.processing.get(deliveryId);
    if (!delivery) {
      return;
    }

    delivery.lastError = error;
    this.processing.delete(deliveryId);
    this.statistics.totalFailed++;

    // Move to dead letter queue if enabled
    if (this.options.deadLetterQueueEnabled) {
      this.deadLetterQueue.push(delivery);
      
      // Limit dead letter queue size
      if (this.deadLetterQueue.length > 1000) {
        this.deadLetterQueue.shift();
      }
    }

    this.emit('delivery.failed', { deliveryId, error, delivery });
  }

  /**
   * Reschedule a delivery for retry
   */
  async reschedule(deliveryId: string, nextRetryAt: Date): Promise<void> {
    const delivery = this.processing.get(deliveryId);
    if (!delivery) {
      return;
    }

    delivery.attempts++;
    delivery.nextRetryAt = nextRetryAt;
    delivery.scheduledFor = nextRetryAt;

    // Check if we've exceeded max retries
    if (delivery.attempts >= delivery.maxRetries) {
      await this.markFailed(deliveryId, 'Max retries exceeded');
      return;
    }

    // Remove from processing and add back to queue
    this.processing.delete(deliveryId);
    
    if (this.options.enablePriorityQueue) {
      this.insertByPriority(delivery);
    } else {
      this.queue.push(delivery);
    }

    this.emit('delivery.rescheduled', { deliveryId, nextRetryAt, attempts: delivery.attempts });
  }

  /**
   * Get queue statistics
   */
  getStatistics(): QueueStatistics {
    return {
      ...this.statistics,
      currentQueueSize: this.queue.length,
      averageProcessingTime: this.calculateAverageProcessingTime(),
      oldestPendingDelivery: this.getOldestPendingDelivery(),
      deadLetterQueueSize: this.deadLetterQueue.length
    };
  }

  /**
   * Get pending deliveries
   */
  getPendingDeliveries(limit: number = 100): QueuedWebhookDelivery[] {
    return this.queue.slice(0, limit);
  }

  /**
   * Get failed deliveries from dead letter queue
   */
  getFailedDeliveries(limit: number = 100): QueuedWebhookDelivery[] {
    return this.deadLetterQueue.slice(-limit).reverse();
  }

  /**
   * Get deliveries currently being processed
   */
  getProcessingDeliveries(): QueuedWebhookDelivery[] {
    return Array.from(this.processing.values());
  }

  /**
   * Retry a failed delivery from dead letter queue
   */
  async retryFailedDelivery(deliveryId: string): Promise<boolean> {
    const index = this.deadLetterQueue.findIndex(d => d.id === deliveryId);
    if (index === -1) {
      return false;
    }

    const delivery = this.deadLetterQueue.splice(index, 1)[0];
    
    // Reset delivery for retry
    delivery.attempts = 0;
    delivery.nextRetryAt = new Date();
    delivery.scheduledFor = new Date();
    delivery.lastError = undefined;

    // Add back to main queue
    if (this.options.enablePriorityQueue) {
      this.insertByPriority(delivery);
    } else {
      this.queue.push(delivery);
    }

    this.emit('delivery.retried', { deliveryId });
    return true;
  }

  /**
   * Clear the dead letter queue
   */
  clearDeadLetterQueue(): number {
    const count = this.deadLetterQueue.length;
    this.deadLetterQueue = [];
    this.emit('deadLetterQueue.cleared', { count });
    return count;
  }

  /**
   * Remove a specific delivery from the queue
   */
  removeDelivery(deliveryId: string): boolean {
    // Check main queue
    const queueIndex = this.queue.findIndex(d => d.id === deliveryId);
    if (queueIndex !== -1) {
      this.queue.splice(queueIndex, 1);
      this.emit('delivery.removed', { deliveryId, source: 'queue' });
      return true;
    }

    // Check processing
    if (this.processing.has(deliveryId)) {
      this.processing.delete(deliveryId);
      this.emit('delivery.removed', { deliveryId, source: 'processing' });
      return true;
    }

    // Check dead letter queue
    const dlqIndex = this.deadLetterQueue.findIndex(d => d.id === deliveryId);
    if (dlqIndex !== -1) {
      this.deadLetterQueue.splice(dlqIndex, 1);
      this.emit('delivery.removed', { deliveryId, source: 'deadLetterQueue' });
      return true;
    }

    return false;
  }

  /**
   * Pause processing (for maintenance)
   */
  pause(): void {
    this.emit('queue.paused');
  }

  /**
   * Resume processing
   */
  resume(): void {
    this.emit('queue.resumed');
  }

  /**
   * Clear all queues
   */
  clear(): { queue: number; deadLetterQueue: number; processing: number } {
    const counts = {
      queue: this.queue.length,
      deadLetterQueue: this.deadLetterQueue.length,
      processing: this.processing.size
    };

    this.queue = [];
    this.deadLetterQueue = [];
    this.processing.clear();

    this.emit('queue.cleared', counts);
    return counts;
  }

  /**
   * Insert delivery in priority order
   */
  private insertByPriority(delivery: QueuedWebhookDelivery): void {
    let insertIndex = this.queue.length;
    
    // Find the correct position based on priority (higher priority first)
    for (let i = 0; i < this.queue.length; i++) {
      if (delivery.priority > this.queue[i].priority) {
        insertIndex = i;
        break;
      }
    }

    this.queue.splice(insertIndex, 0, delivery);
  }

  /**
   * Calculate priority for a delivery
   */
  private calculatePriority(event: WebhookEvent, endpointId: string): number {
    // Priority levels (higher number = higher priority)
    const eventPriorities: Record<string, number> = {
      'session.failed': 100,
      'performance.alert': 90,
      'anomaly.detected': 80,
      'cost.threshold': 70,
      'session.completed': 50,
      'agent.message': 30,
      'session.started': 20,
      'user.login': 10,
      'webhook.test': 5
    };

    let priority = eventPriorities[event] || 0;

    // Boost priority for critical endpoints (this could be configurable)
    if (endpointId.includes('critical') || endpointId.includes('pager')) {
      priority += 10;
    }

    return priority;
  }

  /**
   * Clean up stale processing entries
   */
  private cleanupProcessing(): void {
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();

    for (const [deliveryId, delivery] of this.processing.entries()) {
      const processingTime = now - delivery.createdAt.getTime();
      
      if (processingTime > staleThreshold) {
        console.warn(`Cleaning up stale processing entry: ${deliveryId}`);
        this.processing.delete(deliveryId);
        
        // Re-queue the delivery
        delivery.attempts++;
        delivery.nextRetryAt = new Date(now + this.options.retryDelayMs);
        delivery.scheduledFor = delivery.nextRetryAt;
        
        if (delivery.attempts < delivery.maxRetries) {
          this.queue.push(delivery);
          this.emit('delivery.requeued', { deliveryId, reason: 'stale_processing' });
        } else {
          this.markFailed(deliveryId, 'Processing timeout - cleanup');
        }
      }
    }
  }

  /**
   * Update statistics
   */
  private updateStatistics(): void {
    // Statistics are mostly updated inline, but we can do periodic cleanup here
    if (this.processingTimes.length > 10000) {
      // Keep only recent processing times
      this.processingTimes = this.processingTimes.slice(-1000);
    }
  }

  /**
   * Calculate average processing time
   */
  private calculateAverageProcessingTime(): number {
    if (this.processingTimes.length === 0) {
      return 0;
    }

    const sum = this.processingTimes.reduce((acc, time) => acc + time, 0);
    return sum / this.processingTimes.length;
  }

  /**
   * Get oldest pending delivery
   */
  private getOldestPendingDelivery(): Date | undefined {
    if (this.queue.length === 0) {
      return undefined;
    }

    return this.queue.reduce((oldest, delivery) => {
      return delivery.createdAt < oldest ? delivery.createdAt : oldest;
    }, this.queue[0].createdAt);
  }

  /**
   * Get queue health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Check queue size
    if (this.queue.length > this.options.maxQueueSize * 0.8) {
      issues.push(`Queue is ${Math.round((this.queue.length / this.options.maxQueueSize) * 100)}% full`);
      recommendations.push('Consider scaling up webhook processing or check for failing endpoints');
      status = 'warning';
    }

    if (this.queue.length >= this.options.maxQueueSize) {
      status = 'critical';
    }

    // Check dead letter queue
    if (this.deadLetterQueue.length > 100) {
      issues.push(`${this.deadLetterQueue.length} deliveries in dead letter queue`);
      recommendations.push('Review failed deliveries and fix endpoint configurations');
      if (status === 'healthy') status = 'warning';
    }

    // Check processing times
    const avgProcessingTime = this.calculateAverageProcessingTime();
    if (avgProcessingTime > 30000) { // 30 seconds
      issues.push(`Average processing time is ${Math.round(avgProcessingTime / 1000)} seconds`);
      recommendations.push('Webhook endpoints may be responding slowly');
      if (status === 'healthy') status = 'warning';
    }

    // Check stale processing
    const staleProcessing = Array.from(this.processing.values()).filter(
      d => Date.now() - d.createdAt.getTime() > 5 * 60 * 1000
    );
    
    if (staleProcessing.length > 0) {
      issues.push(`${staleProcessing.length} deliveries stuck in processing`);
      recommendations.push('Check webhook processing service health');
      if (status === 'healthy') status = 'warning';
    }

    return { status, issues, recommendations };
  }
}