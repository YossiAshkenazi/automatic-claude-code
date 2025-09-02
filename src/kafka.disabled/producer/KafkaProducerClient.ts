import { Kafka, Producer, ProducerConfig, ProducerRecord, RecordMetadata } from 'kafkajs';
import { Logger } from '../../logger';
import { CircuitBreaker, CircuitBreakerOptions } from '../utils/CircuitBreaker';
import { RetryPolicy, RetryOptions } from '../utils/RetryPolicy';
import { MetricsCollector } from '../monitoring/MetricsCollector';
import { CompressionTypes, logLevel } from 'kafkajs';

export interface KafkaProducerClientConfig extends ProducerConfig {
  clientId: string;
  brokers: string[];
  connectionTimeout?: number;
  requestTimeout?: number;
  retry?: RetryOptions;
  compression?: CompressionTypes;
  batchSize?: number;
  lingerMs?: number;
  circuitBreaker?: CircuitBreakerOptions;
  enableMetrics?: boolean;
  schemaRegistry?: {
    url: string;
    auth?: {
      username: string;
      password: string;
    };
  };
}

export interface PublishOptions {
  key?: string;
  partition?: number;
  timestamp?: string;
  headers?: Record<string, string>;
  retries?: number;
  timeout?: number;
  idempotent?: boolean;
}

export class KafkaProducerClient {
  private kafka: Kafka;
  private producer: Producer;
  private circuitBreaker: CircuitBreaker;
  private retryPolicy: RetryPolicy;
  private metrics: MetricsCollector;
  private logger: Logger;
  private isConnected = false;
  private connectionPromise: Promise<void> | null = null;

  constructor(private config: KafkaProducerClientConfig) {
    this.logger = new Logger('KafkaProducerClient');
    
    // Initialize Kafka client with optimized settings for high throughput
    this.kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
      connectionTimeout: config.connectionTimeout || 3000,
      requestTimeout: config.requestTimeout || 30000,
      retry: {
        initialRetryTime: 100,
        retries: config.retry?.maxRetries || 5,
        maxRetryTime: 30000,
        factor: 0.2,
        multiplier: 2,
        retryDelayOnFailover: 100,
      },
      logLevel: logLevel.ERROR,
    });

    // Create producer with high-performance settings
    this.producer = this.kafka.producer({
      maxInFlightRequests: 5, // Optimal for throughput
      idempotent: true, // Exactly-once semantics
      transactionTimeout: 30000,
      allowAutoTopicCreation: false,
      compression: config.compression || CompressionTypes.GZIP,
      batch: {
        size: config.batchSize || 16384, // 16KB batches
      },
      linger: {
        ms: config.lingerMs || 5, // 5ms linger for batching
      },
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
      this.metrics = new MetricsCollector('kafka_producer');
    }

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.producer.on('producer.connect', () => {
      this.logger.info('Producer connected successfully');
      this.isConnected = true;
      this.metrics?.incrementCounter('connections_established');
    });

    this.producer.on('producer.disconnect', () => {
      this.logger.warn('Producer disconnected');
      this.isConnected = false;
      this.metrics?.incrementCounter('disconnections');
    });

    this.producer.on('producer.network.request_timeout', (payload) => {
      this.logger.error('Producer network request timeout', payload);
      this.metrics?.incrementCounter('network_timeouts');
    });
  }

  async connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this.circuitBreaker.execute(async () => {
      await this.producer.connect();
      this.logger.info('Kafka producer connected successfully');
    });

    return this.connectionPromise;
  }

  async disconnect(): Promise<void> {
    try {
      await this.producer.disconnect();
      this.isConnected = false;
      this.connectionPromise = null;
      this.logger.info('Kafka producer disconnected successfully');
    } catch (error) {
      this.logger.error('Error disconnecting producer', error);
      throw error;
    }
  }

  async publish<T>(
    topic: string,
    message: T,
    options: PublishOptions = {}
  ): Promise<RecordMetadata[]> {
    if (!this.isConnected) {
      await this.connect();
    }

    const startTime = Date.now();
    
    try {
      const serializedMessage = await this.serializeMessage(message);
      
      const record: ProducerRecord = {
        topic,
        messages: [{
          key: options.key,
          value: serializedMessage,
          partition: options.partition,
          timestamp: options.timestamp,
          headers: options.headers,
        }],
      };

      const result = await this.retryPolicy.execute(async () => {
        return this.circuitBreaker.execute(async () => {
          return await this.producer.send(record);
        });
      });

      const duration = Date.now() - startTime;
      this.metrics?.recordHistogram('publish_duration', duration);
      this.metrics?.incrementCounter('messages_published');
      
      this.logger.debug(`Message published to topic ${topic} successfully`, {
        partition: result[0].partition,
        offset: result[0].offset,
        duration,
      });

      return result;
    } catch (error) {
      this.metrics?.incrementCounter('publish_errors');
      this.logger.error(`Failed to publish message to topic ${topic}`, error);
      throw error;
    }
  }

  async publishBatch<T>(
    topic: string,
    messages: Array<{ message: T; options?: PublishOptions }>,
    options: { transactional?: boolean } = {}
  ): Promise<RecordMetadata[]> {
    if (!this.isConnected) {
      await this.connect();
    }

    const startTime = Date.now();
    
    try {
      const serializedMessages = await Promise.all(
        messages.map(async ({ message, options: msgOptions = {} }) => ({
          key: msgOptions.key,
          value: await this.serializeMessage(message),
          partition: msgOptions.partition,
          timestamp: msgOptions.timestamp,
          headers: msgOptions.headers,
        }))
      );

      const record: ProducerRecord = {
        topic,
        messages: serializedMessages,
      };

      let result: RecordMetadata[];

      if (options.transactional) {
        const transaction = await this.producer.transaction();
        try {
          result = await transaction.send(record);
          await transaction.commit();
        } catch (error) {
          await transaction.abort();
          throw error;
        }
      } else {
        result = await this.retryPolicy.execute(async () => {
          return this.circuitBreaker.execute(async () => {
            return await this.producer.send(record);
          });
        });
      }

      const duration = Date.now() - startTime;
      this.metrics?.recordHistogram('batch_publish_duration', duration);
      this.metrics?.incrementCounter('batch_messages_published', messages.length);
      
      this.logger.debug(`Batch of ${messages.length} messages published to topic ${topic}`, {
        duration,
        transactional: options.transactional,
      });

      return result;
    } catch (error) {
      this.metrics?.incrementCounter('batch_publish_errors');
      this.logger.error(`Failed to publish batch to topic ${topic}`, error);
      throw error;
    }
  }

  private async serializeMessage<T>(message: T): Promise<string> {
    if (typeof message === 'string') {
      return message;
    }
    
    try {
      return JSON.stringify(message);
    } catch (error) {
      this.logger.error('Failed to serialize message', error);
      throw new Error(`Message serialization failed: ${error.message}`);
    }
  }

  async getMetadata(topics?: string[]): Promise<any> {
    const admin = this.kafka.admin();
    try {
      await admin.connect();
      const metadata = await admin.fetchTopicMetadata({ topics });
      return metadata;
    } finally {
      await admin.disconnect();
    }
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
      const metadata = await this.getMetadata();
      const metrics = this.getMetrics();
      
      return {
        status: this.isHealthy() ? 'healthy' : 'unhealthy',
        details: {
          connected: this.isConnected,
          circuitBreakerState: this.circuitBreaker.getState(),
          brokers: metadata.brokers?.length || 0,
          metrics,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error.message,
          connected: this.isConnected,
          circuitBreakerState: this.circuitBreaker.getState(),
        },
      };
    }
  }
}

export default KafkaProducerClient;