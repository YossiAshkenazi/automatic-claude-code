import {
  Kafka,
  Consumer,
  ConsumerConfig,
  ConsumerSubscribeTopics,
  EachMessagePayload,
  EachBatchPayload,
  OffsetCommitPolicy,
} from 'kafkajs';
import { Logger } from '../../logger';
import { CircuitBreaker, CircuitBreakerOptions } from '../utils/CircuitBreaker';
import { RetryPolicy, RetryOptions } from '../utils/RetryPolicy';
import { MetricsCollector } from '../monitoring/MetricsCollector';
import { DeadLetterQueue } from '../patterns/DeadLetterQueue';
import { EventEmitter } from 'events';

export interface KafkaConsumerClientConfig extends ConsumerConfig {
  clientId: string;
  brokers: string[];
  groupId: string;
  connectionTimeout?: number;
  sessionTimeout?: number;
  heartbeatInterval?: number;
  maxWaitTimeInMs?: number;
  maxBytesPerPartition?: number;
  minBytes?: number;
  maxBytes?: number;
  retry?: RetryOptions;
  circuitBreaker?: CircuitBreakerOptions;
  enableMetrics?: boolean;
  deadLetterQueue?: {
    enabled: boolean;
    topic: string;
    maxRetries: number;
  };
  offsetCommitPolicy?: {
    autoCommit?: boolean;
    autoCommitInterval?: number;
    strategy?: 'latest' | 'earliest';
  };
}

export interface MessageHandler<T = any> {
  (payload: {
    topic: string;
    partition: number;
    message: T;
    offset: string;
    headers: Record<string, string>;
    timestamp: string;
    key?: string;
  }): Promise<void>;
}

export interface BatchMessageHandler<T = any> {
  (payload: {
    topic: string;
    partition: number;
    messages: Array<{
      message: T;
      offset: string;
      headers: Record<string, string>;
      timestamp: string;
      key?: string;
    }>;
  }): Promise<void>;
}

export interface ProcessingResult {
  success: boolean;
  error?: Error;
  processingTime: number;
  retryCount?: number;
}

export class KafkaConsumerClient extends EventEmitter {
  private kafka: Kafka;
  private consumer: Consumer;
  private circuitBreaker: CircuitBreaker;
  private retryPolicy: RetryPolicy;
  private metrics: MetricsCollector;
  private deadLetterQueue: DeadLetterQueue;
  private logger: Logger;
  private isConnected = false;
  private isConsuming = false;
  private messageHandlers = new Map<string, MessageHandler>();
  private batchHandlers = new Map<string, BatchMessageHandler>();
  private processingStats = new Map<string, number>();

  constructor(private config: KafkaConsumerClientConfig) {
    super();
    this.logger = new Logger('KafkaConsumerClient');
    
    // Initialize Kafka client
    this.kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
      connectionTimeout: config.connectionTimeout || 3000,
      requestTimeout: 30000,
      retry: {
        initialRetryTime: 100,
        retries: config.retry?.maxRetries || 5,
        maxRetryTime: 30000,
        factor: 0.2,
        multiplier: 2,
        retryDelayOnFailover: 100,
      },
    });

    // Create consumer with optimized settings
    this.consumer = this.kafka.consumer({
      groupId: config.groupId,
      sessionTimeout: config.sessionTimeout || 30000,
      heartbeatInterval: config.heartbeatInterval || 3000,
      maxWaitTimeInMs: config.maxWaitTimeInMs || 5000,
      maxBytesPerPartition: config.maxBytesPerPartition || 1048576, // 1MB
      minBytes: config.minBytes || 1,
      maxBytes: config.maxBytes || 10485760, // 10MB
      allowAutoTopicCreation: false,
      ...config,
    });

    // Initialize circuit breaker
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 30000,
      monitoringPeriod: 10000,
      ...config.circuitBreaker,
    });

    // Initialize retry policy
    this.retryPolicy = new RetryPolicy(config.retry || {
      maxRetries: 3,
      baseDelay: 100,
      maxDelay: 5000,
      backoffMultiplier: 2,
    });

    // Initialize metrics collector
    if (config.enableMetrics !== false) {
      this.metrics = new MetricsCollector('kafka_consumer');
    }

    // Initialize dead letter queue if enabled
    if (config.deadLetterQueue?.enabled) {
      this.deadLetterQueue = new DeadLetterQueue({
        kafka: this.kafka,
        topic: config.deadLetterQueue.topic,
        maxRetries: config.deadLetterQueue.maxRetries,
      });
    }

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.consumer.on('consumer.connect', () => {
      this.logger.info('Consumer connected successfully');
      this.isConnected = true;
      this.metrics?.incrementCounter('connections_established');
      this.emit('connected');
    });

    this.consumer.on('consumer.disconnect', () => {
      this.logger.warn('Consumer disconnected');
      this.isConnected = false;
      this.isConsuming = false;
      this.metrics?.incrementCounter('disconnections');
      this.emit('disconnected');
    });

    this.consumer.on('consumer.stop', () => {
      this.logger.info('Consumer stopped');
      this.isConsuming = false;
      this.emit('stopped');
    });

    this.consumer.on('consumer.crash', ({ error }) => {
      this.logger.error('Consumer crashed', error);
      this.metrics?.incrementCounter('consumer_crashes');
      this.emit('error', error);
    });

    this.consumer.on('consumer.rebalancing', () => {
      this.logger.info('Consumer rebalancing');
      this.metrics?.incrementCounter('rebalances');
      this.emit('rebalancing');
    });
  }

  async connect(): Promise<void> {
    try {
      await this.consumer.connect();
      if (this.deadLetterQueue) {
        await this.deadLetterQueue.connect();
      }
      this.logger.info('Kafka consumer connected successfully');
    } catch (error) {
      this.logger.error('Failed to connect consumer', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.isConsuming) {
        await this.stop();
      }
      await this.consumer.disconnect();
      if (this.deadLetterQueue) {
        await this.deadLetterQueue.disconnect();
      }
      this.isConnected = false;
      this.logger.info('Kafka consumer disconnected successfully');
    } catch (error) {
      this.logger.error('Error disconnecting consumer', error);
      throw error;
    }
  }

  async subscribe(
    topics: string[] | ConsumerSubscribeTopics,
    options: { fromBeginning?: boolean } = {}
  ): Promise<void> {
    try {
      if (Array.isArray(topics)) {
        await this.consumer.subscribe({
          topics,
          fromBeginning: options.fromBeginning || false,
        });
      } else {
        await this.consumer.subscribe(topics);
      }
      this.logger.info('Subscribed to topics', { topics });
    } catch (error) {
      this.logger.error('Failed to subscribe to topics', error);
      throw error;
    }
  }

  registerMessageHandler<T>(topic: string, handler: MessageHandler<T>): void {
    this.messageHandlers.set(topic, handler as MessageHandler);
    this.logger.info(`Registered message handler for topic: ${topic}`);
  }

  registerBatchHandler<T>(topic: string, handler: BatchMessageHandler<T>): void {
    this.batchHandlers.set(topic, handler as BatchMessageHandler);
    this.logger.info(`Registered batch handler for topic: ${topic}`);
  }

  async startConsuming(options: {
    eachMessage?: boolean;
    eachBatch?: boolean;
    batchSize?: number;
  } = {}): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      if (options.eachMessage !== false) {
        await this.consumer.run({
          eachMessage: this.handleEachMessage.bind(this),
        });
      }

      if (options.eachBatch) {
        await this.consumer.run({
          eachBatch: this.handleEachBatch.bind(this),
        });
      }

      this.isConsuming = true;
      this.logger.info('Started consuming messages');
      this.emit('started');
    } catch (error) {
      this.logger.error('Failed to start consuming', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      await this.consumer.stop();
      this.isConsuming = false;
      this.logger.info('Stopped consuming messages');
    } catch (error) {
      this.logger.error('Error stopping consumer', error);
      throw error;
    }
  }

  private async handleEachMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload;
    const startTime = Date.now();

    try {
      const handler = this.messageHandlers.get(topic);
      if (!handler) {
        this.logger.warn(`No handler registered for topic: ${topic}`);
        return;
      }

      const deserializedMessage = await this.deserializeMessage(message.value);
      const headers = this.extractHeaders(message.headers);

      const result = await this.processWithRetryAndCircuitBreaker(async () => {
        await handler({
          topic,
          partition,
          message: deserializedMessage,
          offset: message.offset,
          headers,
          timestamp: message.timestamp,
          key: message.key?.toString(),
        });
      });

      if (result.success) {
        // Auto-commit is handled by kafkajs by default
        this.metrics?.incrementCounter('messages_processed_successfully');
        this.updateProcessingStats(topic, Date.now() - startTime);
      } else {
        await this.handleProcessingError(topic, message, result.error!);
      }
    } catch (error) {
      this.logger.error(`Error processing message from topic ${topic}`, error);
      await this.handleProcessingError(topic, message, error);
    }
  }

  private async handleEachBatch(payload: EachBatchPayload): Promise<void> {
    const { batch } = payload;
    const { topic, partition } = batch;
    const startTime = Date.now();

    try {
      const handler = this.batchHandlers.get(topic);
      if (!handler) {
        this.logger.warn(`No batch handler registered for topic: ${topic}`);
        return;
      }

      const messages = await Promise.all(
        batch.messages.map(async (message) => ({
          message: await this.deserializeMessage(message.value),
          offset: message.offset,
          headers: this.extractHeaders(message.headers),
          timestamp: message.timestamp,
          key: message.key?.toString(),
        }))
      );

      const result = await this.processWithRetryAndCircuitBreaker(async () => {
        await handler({ topic, partition, messages });
      });

      if (result.success) {
        // Commit the entire batch
        await payload.commitOffsetsIfNecessary();
        this.metrics?.incrementCounter('batches_processed_successfully');
        this.metrics?.incrementCounter('messages_processed_successfully', messages.length);
        this.updateProcessingStats(topic, Date.now() - startTime);
      } else {
        // Handle batch processing error
        this.logger.error(`Error processing batch from topic ${topic}`, result.error);
        this.metrics?.incrementCounter('batch_processing_errors');
      }
    } catch (error) {
      this.logger.error(`Error processing batch from topic ${topic}`, error);
      this.metrics?.incrementCounter('batch_processing_errors');
    }
  }

  private async processWithRetryAndCircuitBreaker(
    processor: () => Promise<void>
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    let retryCount = 0;

    try {
      await this.retryPolicy.execute(async () => {
        return this.circuitBreaker.execute(async () => {
          await processor();
        });
      }, (attempt) => {
        retryCount = attempt;
      });

      return {
        success: true,
        processingTime: Date.now() - startTime,
        retryCount,
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        processingTime: Date.now() - startTime,
        retryCount,
      };
    }
  }

  private async handleProcessingError(topic: string, message: any, error: Error): Promise<void> {
    this.metrics?.incrementCounter('message_processing_errors');
    
    if (this.deadLetterQueue) {
      try {
        await this.deadLetterQueue.send(topic, message, error);
        this.logger.info(`Sent failed message to dead letter queue for topic: ${topic}`);
      } catch (dlqError) {
        this.logger.error('Failed to send message to dead letter queue', dlqError);
      }
    }

    this.emit('processingError', { topic, message, error });
  }

  private async deserializeMessage(value: Buffer | null): Promise<any> {
    if (!value) return null;
    
    try {
      const stringValue = value.toString();
      return JSON.parse(stringValue);
    } catch (error) {
      // If JSON parsing fails, return as string
      return value.toString();
    }
  }

  private extractHeaders(headers: Record<string, Buffer> | undefined): Record<string, string> {
    if (!headers) return {};
    
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      result[key] = value.toString();
    }
    return result;
  }

  private updateProcessingStats(topic: string, processingTime: number): void {
    this.processingStats.set(topic, (this.processingStats.get(topic) || 0) + 1);
    this.metrics?.recordHistogram('message_processing_duration', processingTime, { topic });
  }

  async commitOffsets(offsets?: Array<{
    topic: string;
    partition: number;
    offset: string;
  }>): Promise<void> {
    try {
      if (offsets) {
        await this.consumer.commitOffsets(offsets);
      } else {
        // Commit current offsets
        await this.consumer.commitOffsets();
      }
      this.logger.debug('Committed offsets successfully');
    } catch (error) {
      this.logger.error('Failed to commit offsets', error);
      throw error;
    }
  }

  async pause(topics?: Array<{ topic: string; partitions?: number[] }>): Promise<void> {
    try {
      if (topics) {
        this.consumer.pause(topics);
      } else {
        this.consumer.pause();
      }
      this.logger.info('Paused consumption', { topics });
    } catch (error) {
      this.logger.error('Failed to pause consumption', error);
      throw error;
    }
  }

  async resume(topics?: Array<{ topic: string; partitions?: number[] }>): Promise<void> {
    try {
      if (topics) {
        this.consumer.resume(topics);
      } else {
        this.consumer.resume();
      }
      this.logger.info('Resumed consumption', { topics });
    } catch (error) {
      this.logger.error('Failed to resume consumption', error);
      throw error;
    }
  }

  getProcessingStats(): Record<string, number> {
    return Object.fromEntries(this.processingStats);
  }

  getMetrics(): Record<string, any> {
    return this.metrics?.getMetrics() || {};
  }

  isHealthy(): boolean {
    return this.isConnected && this.circuitBreaker.getState() !== 'OPEN';
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: Record<string, any>;
  }> {
    try {
      const metrics = this.getMetrics();
      const processingStats = this.getProcessingStats();
      
      return {
        status: this.isHealthy() ? 'healthy' : 'unhealthy',
        details: {
          connected: this.isConnected,
          consuming: this.isConsuming,
          circuitBreakerState: this.circuitBreaker.getState(),
          registeredHandlers: {
            messageHandlers: Array.from(this.messageHandlers.keys()),
            batchHandlers: Array.from(this.batchHandlers.keys()),
          },
          processingStats,
          metrics,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error.message,
          connected: this.isConnected,
          consuming: this.isConsuming,
          circuitBreakerState: this.circuitBreaker.getState(),
        },
      };
    }
  }
}

export default KafkaConsumerClient;