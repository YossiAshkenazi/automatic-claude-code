import { Kafka, Producer, Message } from 'kafkajs';
import { Logger } from '../../logger';

export interface DeadLetterQueueConfig {
  kafka: Kafka;
  topic: string;
  maxRetries: number;
  retryDelay?: number;
  enableCompression?: boolean;
  headers?: Record<string, string>;
}

export interface DeadLetterMessage {
  originalTopic: string;
  originalPartition: number;
  originalOffset: string;
  originalTimestamp: string;
  originalKey?: string;
  originalValue: Buffer | null;
  originalHeaders?: Record<string, Buffer>;
  errorMessage: string;
  errorStack?: string;
  retryCount: number;
  failedAt: string;
  processingAttempts: Array<{
    attemptedAt: string;
    error: string;
    duration?: number;
  }>;
}

export class DeadLetterQueue {
  private producer: Producer;
  private logger: Logger;
  private isConnected = false;

  constructor(private config: DeadLetterQueueConfig) {
    this.logger = new Logger('DeadLetterQueue');
    this.producer = config.kafka.producer({
      idempotent: true,
      maxInFlightRequests: 1,
      compression: config.enableCompression ? 'gzip' : undefined,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.producer.on('producer.connect', () => {
      this.logger.info('Dead Letter Queue producer connected');
      this.isConnected = true;
    });

    this.producer.on('producer.disconnect', () => {
      this.logger.warn('Dead Letter Queue producer disconnected');
      this.isConnected = false;
    });

    this.producer.on('producer.network.request_timeout', (payload) => {
      this.logger.error('DLQ producer network timeout', payload);
    });
  }

  async connect(): Promise<void> {
    try {
      await this.producer.connect();
      this.logger.info('Dead Letter Queue connected successfully');
    } catch (error) {
      this.logger.error('Failed to connect Dead Letter Queue', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.producer.disconnect();
      this.isConnected = false;
      this.logger.info('Dead Letter Queue disconnected successfully');
    } catch (error) {
      this.logger.error('Error disconnecting Dead Letter Queue', error);
      throw error;
    }
  }

  async send(
    originalTopic: string,
    originalMessage: Message & { partition?: number; offset?: string; timestamp?: string },
    error: Error,
    processingAttempts: Array<{ attemptedAt: string; error: string; duration?: number }> = []
  ): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const retryCount = this.extractRetryCount(originalMessage.headers) + 1;
      
      // Check if we've exceeded max retries
      if (retryCount > this.config.maxRetries) {
        this.logger.warn(`Message exceeded max retries (${this.config.maxRetries}), sending to DLQ`, {
          originalTopic,
          originalOffset: originalMessage.offset,
          retryCount,
        });
      }

      const dlqMessage: DeadLetterMessage = {
        originalTopic,
        originalPartition: originalMessage.partition || 0,
        originalOffset: originalMessage.offset || '0',
        originalTimestamp: originalMessage.timestamp || Date.now().toString(),
        originalKey: originalMessage.key?.toString(),
        originalValue: originalMessage.value,
        originalHeaders: originalMessage.headers,
        errorMessage: error.message,
        errorStack: error.stack,
        retryCount,
        failedAt: new Date().toISOString(),
        processingAttempts: [
          ...processingAttempts,
          {
            attemptedAt: new Date().toISOString(),
            error: error.message,
          },
        ],
      };

      const headers: Record<string, string> = {
        'dlq-original-topic': originalTopic,
        'dlq-original-partition': originalMessage.partition?.toString() || '0',
        'dlq-original-offset': originalMessage.offset || '0',
        'dlq-retry-count': retryCount.toString(),
        'dlq-failed-at': dlqMessage.failedAt,
        'dlq-error-message': error.message,
        ...this.config.headers,
      };

      // Copy original headers with dlq- prefix
      if (originalMessage.headers) {
        for (const [key, value] of Object.entries(originalMessage.headers)) {
          headers[`dlq-original-header-${key}`] = value.toString();
        }
      }

      await this.producer.send({
        topic: this.config.topic,
        messages: [{
          key: originalMessage.key,
          value: JSON.stringify(dlqMessage),
          headers,
          timestamp: Date.now().toString(),
        }],
      });

      this.logger.info(`Message sent to dead letter queue`, {
        dlqTopic: this.config.topic,
        originalTopic,
        originalOffset: originalMessage.offset,
        retryCount,
        errorMessage: error.message,
      });
    } catch (dlqError) {
      this.logger.error('Failed to send message to dead letter queue', dlqError);
      throw dlqError;
    }
  }

  private extractRetryCount(headers?: Record<string, Buffer>): number {
    if (!headers || !headers['dlq-retry-count']) {
      return 0;
    }
    
    try {
      return parseInt(headers['dlq-retry-count'].toString(), 10) || 0;
    } catch {
      return 0;
    }
  }

  // Utility method to check if a message should be retried
  shouldRetry(message: Message): boolean {
    const retryCount = this.extractRetryCount(message.headers);
    return retryCount < this.config.maxRetries;
  }

  // Create a retry message with updated retry count
  createRetryMessage(
    originalMessage: Message,
    targetTopic: string,
    error: Error
  ): Message & { topic: string } {
    const retryCount = this.extractRetryCount(originalMessage.headers) + 1;
    
    const headers: Record<string, string> = {
      'dlq-retry-count': retryCount.toString(),
      'dlq-original-topic': targetTopic,
      'dlq-last-error': error.message,
      'dlq-retry-timestamp': new Date().toISOString(),
    };

    // Copy existing headers
    if (originalMessage.headers) {
      for (const [key, value] of Object.entries(originalMessage.headers)) {
        if (!key.startsWith('dlq-')) {
          headers[key] = value.toString();
        }
      }
    }

    return {
      topic: targetTopic,
      key: originalMessage.key,
      value: originalMessage.value,
      headers,
      partition: originalMessage.partition,
      timestamp: Date.now().toString(),
    };
  }

  // Parse a DLQ message back to its original form
  static parseDLQMessage(dlqMessageValue: Buffer | string): DeadLetterMessage {
    try {
      const messageStr = Buffer.isBuffer(dlqMessageValue) 
        ? dlqMessageValue.toString() 
        : dlqMessageValue;
      return JSON.parse(messageStr) as DeadLetterMessage;
    } catch (error) {
      throw new Error(`Failed to parse DLQ message: ${error.message}`);
    }
  }

  // Reprocess a message from the DLQ
  async reprocess(
    dlqMessage: DeadLetterMessage,
    targetProducer: Producer,
    transformMessage?: (message: DeadLetterMessage) => Message
  ): Promise<void> {
    try {
      let messageToSend: Message;

      if (transformMessage) {
        messageToSend = transformMessage(dlqMessage);
      } else {
        // Default: recreate original message
        messageToSend = {
          key: dlqMessage.originalKey,
          value: dlqMessage.originalValue,
          headers: dlqMessage.originalHeaders,
          timestamp: dlqMessage.originalTimestamp,
        };
      }

      await targetProducer.send({
        topic: dlqMessage.originalTopic,
        messages: [messageToSend],
      });

      this.logger.info(`Reprocessed message from DLQ`, {
        originalTopic: dlqMessage.originalTopic,
        originalOffset: dlqMessage.originalOffset,
        retryCount: dlqMessage.retryCount,
      });
    } catch (error) {
      this.logger.error('Failed to reprocess DLQ message', error);
      throw error;
    }
  }

  // Get DLQ statistics
  async getStats(adminClient?: any): Promise<{
    totalMessages: number;
    messagesByOriginalTopic: Record<string, number>;
    averageRetryCount: number;
    oldestMessage?: Date;
    newestMessage?: Date;
  }> {
    // This would require consuming from the DLQ topic to get statistics
    // Implementation would depend on your specific monitoring needs
    throw new Error('DLQ statistics not implemented - requires consumer implementation');
  }

  // Health check
  isHealthy(): boolean {
    return this.isConnected;
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: Record<string, any>;
  }> {
    try {
      return {
        status: this.isHealthy() ? 'healthy' : 'unhealthy',
        details: {
          connected: this.isConnected,
          topic: this.config.topic,
          maxRetries: this.config.maxRetries,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error.message,
          connected: this.isConnected,
        },
      };
    }
  }
}

export default DeadLetterQueue;