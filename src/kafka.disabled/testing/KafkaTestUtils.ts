import { Kafka, Producer, Consumer, Admin, TopicConfig } from 'kafkajs';
import { TestContainers, GenericContainer, StartedTestContainer } from 'testcontainers';
import { KafkaProducerClient } from '../producer/KafkaProducerClient';
import { KafkaConsumerClient } from '../consumer/KafkaConsumerClient';
import { Logger } from '../../logger';
import { EventEmitter } from 'events';

export interface KafkaTestConfig {
  kafkaVersion?: string;
  numPartitions?: number;
  replicationFactor?: number;
  cleanupPolicy?: 'delete' | 'compact';
  enableTransactions?: boolean;
  enableSchemaRegistry?: boolean;
  autoCreateTopics?: boolean;
  startTimeout?: number;
}

export interface TestMessage<T = any> {
  key?: string;
  value: T;
  headers?: Record<string, string>;
  partition?: number;
  timestamp?: number;
}

export interface ConsumedMessage<T = any> extends TestMessage<T> {
  topic: string;
  partition: number;
  offset: string;
  timestamp: string;
}

export interface KafkaTestEnvironment {
  kafka: Kafka;
  admin: Admin;
  brokers: string[];
  container: StartedTestContainer;
  cleanup: () => Promise<void>;
}

export class KafkaTestUtils {
  private static logger = new Logger('KafkaTestUtils');
  private static environments = new Set<KafkaTestEnvironment>();

  /**
   * Create a test Kafka environment using TestContainers
   */
  static async createTestEnvironment(config: KafkaTestConfig = {}): Promise<KafkaTestEnvironment> {
    const {
      kafkaVersion = '7.4.0',
      enableSchemaRegistry = false,
      startTimeout = 60000,
    } = config;

    try {
      // Start Kafka container
      const kafkaContainer = new GenericContainer(`confluentinc/cp-kafka:${kafkaVersion}`)
        .withEnvironment({
          KAFKA_BROKER_ID: '1',
          KAFKA_ZOOKEEPER_CONNECT: 'zookeeper:2181',
          KAFKA_ADVERTISED_LISTENERS: 'PLAINTEXT://localhost:9092,PLAINTEXT_HOST://localhost:29092',
          KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: 'PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT',
          KAFKA_INTER_BROKER_LISTENER_NAME: 'PLAINTEXT',
          KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: '1',
          KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: '1',
          KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: '1',
          KAFKA_AUTO_CREATE_TOPICS_ENABLE: config.autoCreateTopics ? 'true' : 'false',
        })
        .withExposedPorts(9092, 29092)
        .withStartupTimeout(startTimeout);

      // Start Zookeeper container
      const zookeeperContainer = new GenericContainer('confluentinc/cp-zookeeper:7.4.0')
        .withEnvironment({
          ZOOKEEPER_CLIENT_PORT: '2181',
          ZOOKEEPER_TICK_TIME: '2000',
        })
        .withExposedPorts(2181);

      this.logger.info('Starting Kafka test environment...');
      
      const startedZookeeper = await zookeeperContainer.start();
      const startedKafka = await kafkaContainer
        .withNetworkMode('host') // Simplified networking for tests
        .start();

      const kafkaPort = startedKafka.getMappedPort(9092);
      const brokers = [`localhost:${kafkaPort}`];

      // Create Kafka client
      const kafka = new Kafka({
        clientId: 'kafka-test-utils',
        brokers,
        retry: {
          initialRetryTime: 100,
          retries: 3,
        },
      });

      const admin = kafka.admin();
      await admin.connect();

      const environment: KafkaTestEnvironment = {
        kafka,
        admin,
        brokers,
        container: startedKafka,
        cleanup: async () => {
          try {
            await admin.disconnect();
            await startedKafka.stop();
            await startedZookeeper.stop();
            this.environments.delete(environment);
            this.logger.info('Kafka test environment cleaned up');
          } catch (error) {
            this.logger.error('Error cleaning up test environment', error);
          }
        },
      };

      this.environments.add(environment);
      this.logger.info(`Kafka test environment started on ${brokers[0]}`);
      
      return environment;
    } catch (error) {
      this.logger.error('Failed to create Kafka test environment', error);
      throw error;
    }
  }

  /**
   * Create test topics with specified configuration
   */
  static async createTestTopics(
    admin: Admin,
    topics: Array<{
      topic: string;
      numPartitions?: number;
      replicationFactor?: number;
      configEntries?: Array<{ name: string; value: string }>;
    }>
  ): Promise<void> {
    const topicsConfig: TopicConfig[] = topics.map(t => ({
      topic: t.topic,
      numPartitions: t.numPartitions || 1,
      replicationFactor: t.replicationFactor || 1,
      configEntries: t.configEntries || [],
    }));

    try {
      await admin.createTopics({
        topics: topicsConfig,
        waitForLeaders: true,
      });
      this.logger.info(`Created test topics: ${topics.map(t => t.topic).join(', ')}`);
    } catch (error) {
      this.logger.error('Failed to create test topics', error);
      throw error;
    }
  }

  /**
   * Create a test producer with optimized settings
   */
  static async createTestProducer(kafka: Kafka): Promise<Producer> {
    const producer = kafka.producer({
      maxInFlightRequests: 1,
      idempotent: true,
      transactionTimeout: 30000,
    });

    await producer.connect();
    return producer;
  }

  /**
   * Create a test consumer with optimized settings
   */
  static async createTestConsumer(kafka: Kafka, groupId: string = 'test-group'): Promise<Consumer> {
    const consumer = kafka.consumer({
      groupId,
      sessionTimeout: 10000,
      heartbeatInterval: 3000,
      maxWaitTimeInMs: 1000,
      retry: {
        initialRetryTime: 100,
        retries: 3,
      },
    });

    await consumer.connect();
    return consumer;
  }

  /**
   * Send test messages to a topic
   */
  static async sendTestMessages<T>(
    producer: Producer,
    topic: string,
    messages: TestMessage<T>[]
  ): Promise<void> {
    const kafkaMessages = messages.map(msg => ({
      key: msg.key,
      value: JSON.stringify(msg.value),
      headers: msg.headers,
      partition: msg.partition,
      timestamp: msg.timestamp?.toString(),
    }));

    await producer.send({
      topic,
      messages: kafkaMessages,
    });
  }

  /**
   * Consume test messages from a topic with timeout
   */
  static async consumeTestMessages<T>(
    consumer: Consumer,
    topic: string,
    expectedCount: number,
    timeoutMs: number = 30000
  ): Promise<ConsumedMessage<T>[]> {
    const messages: ConsumedMessage<T>[] = [];
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for ${expectedCount} messages, received ${messages.length}`));
      }, timeoutMs);

      consumer.subscribe({ topic });
      
      consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            const value = message.value ? JSON.parse(message.value.toString()) : null;
            
            messages.push({
              topic,
              partition,
              offset: message.offset,
              timestamp: message.timestamp || Date.now().toString(),
              key: message.key?.toString(),
              value,
              headers: this.extractHeaders(message.headers),
            });

            if (messages.length >= expectedCount) {
              clearTimeout(timeout);
              resolve(messages);
            }
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        },
      });
    });
  }

  private static extractHeaders(headers?: Record<string, Buffer>): Record<string, string> {
    if (!headers) return {};
    
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      result[key] = value.toString();
    }
    return result;
  }

  /**
   * Performance test helper - measure throughput
   */
  static async measureThroughput<T>(
    producer: Producer,
    topic: string,
    messageCount: number,
    messageSize: number = 1024
  ): Promise<{
    messagesPerSecond: number;
    totalTimeMs: number;
    avgLatencyMs: number;
  }> {
    // Generate test messages
    const messages = Array.from({ length: messageCount }, (_, i) => ({
      key: `test-key-${i}`,
      value: 'x'.repeat(messageSize), // Fixed size message
    }));

    const startTime = Date.now();
    const latencies: number[] = [];

    // Send messages and measure latency
    for (const message of messages) {
      const messageStartTime = Date.now();
      await producer.send({
        topic,
        messages: [{ key: message.key, value: message.value }],
      });
      latencies.push(Date.now() - messageStartTime);
    }

    const totalTimeMs = Date.now() - startTime;
    const messagesPerSecond = (messageCount / totalTimeMs) * 1000;
    const avgLatencyMs = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    return {
      messagesPerSecond,
      totalTimeMs,
      avgLatencyMs,
    };
  }

  /**
   * Load test helper - concurrent producers
   */
  static async loadTest(
    kafka: Kafka,
    config: {
      topic: string;
      producerCount: number;
      messagesPerProducer: number;
      messageSize: number;
      durationMs?: number;
    }
  ): Promise<{
    totalMessages: number;
    messagesPerSecond: number;
    totalTimeMs: number;
    errors: number;
  }> {
    const { topic, producerCount, messagesPerProducer, messageSize, durationMs } = config;
    const producers: Producer[] = [];
    let totalMessages = 0;
    let errors = 0;

    // Create producers
    for (let i = 0; i < producerCount; i++) {
      const producer = await this.createTestProducer(kafka);
      producers.push(producer);
    }

    const startTime = Date.now();
    
    try {
      // Run concurrent producers
      const producerPromises = producers.map(async (producer, index) => {
        let messagesSent = 0;
        const endTime = durationMs ? startTime + durationMs : Infinity;

        while (messagesSent < messagesPerProducer && Date.now() < endTime) {
          try {
            await producer.send({
              topic,
              messages: [{
                key: `producer-${index}-msg-${messagesSent}`,
                value: 'x'.repeat(messageSize),
              }],
            });
            messagesSent++;
            totalMessages++;
          } catch (error) {
            errors++;
          }
        }
      });

      await Promise.all(producerPromises);
    } finally {
      // Cleanup producers
      await Promise.all(producers.map(p => p.disconnect()));
    }

    const totalTimeMs = Date.now() - startTime;
    const messagesPerSecond = (totalMessages / totalTimeMs) * 1000;

    return {
      totalMessages,
      messagesPerSecond,
      totalTimeMs,
      errors,
    };
  }

  /**
   * Integration test helper for client library testing
   */
  static async testClientIntegration(
    environment: KafkaTestEnvironment,
    config: {
      topic: string;
      messages: any[];
      testTimeout?: number;
    }
  ): Promise<{
    sent: number;
    received: number;
    success: boolean;
    errors: Error[];
  }> {
    const { topic, messages, testTimeout = 30000 } = config;
    const errors: Error[] = [];
    
    try {
      // Create test topics
      await this.createTestTopics(environment.admin, [{ topic }]);

      // Initialize clients
      const producerClient = new KafkaProducerClient({
        clientId: 'test-producer',
        brokers: environment.brokers,
        enableMetrics: false,
      });

      const consumerClient = new KafkaConsumerClient({
        clientId: 'test-consumer',
        brokers: environment.brokers,
        groupId: 'test-integration-group',
        enableMetrics: false,
      });

      await producerClient.connect();
      await consumerClient.connect();

      // Set up message collection
      const receivedMessages: any[] = [];
      consumerClient.registerMessageHandler(topic, async (payload) => {
        receivedMessages.push(payload.message);
      });

      await consumerClient.subscribe([topic], { fromBeginning: true });
      await consumerClient.startConsuming();

      // Send messages
      let sent = 0;
      for (const message of messages) {
        try {
          await producerClient.publish(topic, message);
          sent++;
        } catch (error) {
          errors.push(error as Error);
        }
      }

      // Wait for messages to be received
      const startWait = Date.now();
      while (receivedMessages.length < sent && Date.now() - startWait < testTimeout) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Cleanup
      await consumerClient.disconnect();
      await producerClient.disconnect();

      return {
        sent,
        received: receivedMessages.length,
        success: receivedMessages.length === sent && errors.length === 0,
        errors,
      };
    } catch (error) {
      errors.push(error as Error);
      return {
        sent: 0,
        received: 0,
        success: false,
        errors,
      };
    }
  }

  /**
   * Chaos testing helper - simulate failures
   */
  static async chaosTest(
    environment: KafkaTestEnvironment,
    config: {
      topic: string;
      duration: number;
      failureTypes: ('network' | 'broker_restart' | 'partition_failure')[];
      messageRate: number;
    }
  ): Promise<{
    messagesLost: number;
    averageRecoveryTime: number;
    failureEvents: Array<{ type: string; timestamp: Date; duration: number }>;
  }> {
    // This is a simplified chaos test implementation
    // In a real scenario, you'd integrate with chaos engineering tools
    // like Chaos Monkey, Litmus, or custom failure injection
    
    const failureEvents: Array<{ type: string; timestamp: Date; duration: number }> = [];
    let messagesLost = 0;
    
    this.logger.warn('Chaos testing implementation is simplified - integrate with chaos engineering tools for production use');
    
    return {
      messagesLost,
      averageRecoveryTime: 0,
      failureEvents,
    };
  }

  /**
   * Cleanup all test environments
   */
  static async cleanupAll(): Promise<void> {
    const cleanupPromises = Array.from(this.environments).map(env => env.cleanup());
    await Promise.allSettled(cleanupPromises);
    this.environments.clear();
  }

  /**
   * Wait for topic to be ready
   */
  static async waitForTopic(admin: Admin, topic: string, timeoutMs: number = 10000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const metadata = await admin.fetchTopicMetadata({ topics: [topic] });
        if (metadata.topics.length > 0 && metadata.topics[0].partitions.length > 0) {
          return;
        }
      } catch (error) {
        // Topic doesn't exist yet, continue waiting
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error(`Timeout waiting for topic ${topic} to be ready`);
  }

  /**
   * Generate test data
   */
  static generateTestData(config: {
    messageCount: number;
    messageSize?: number;
    keyPrefix?: string;
    includeHeaders?: boolean;
  }): TestMessage[] {
    const { messageCount, messageSize = 100, keyPrefix = 'test', includeHeaders = false } = config;
    
    return Array.from({ length: messageCount }, (_, i) => ({
      key: `${keyPrefix}-${i}`,
      value: {
        id: i,
        data: 'x'.repeat(messageSize),
        timestamp: Date.now(),
      },
      headers: includeHeaders ? {
        'test-header': `value-${i}`,
        'message-type': 'test-data',
      } : undefined,
    }));
  }

  /**
   * Benchmark helper for comparing performance
   */
  static async benchmark(
    name: string,
    operation: () => Promise<void>,
    iterations: number = 1000
  ): Promise<{
    name: string;
    iterations: number;
    totalTimeMs: number;
    avgTimeMs: number;
    opsPerSecond: number;
  }> {
    const startTime = Date.now();
    
    for (let i = 0; i < iterations; i++) {
      await operation();
    }
    
    const totalTimeMs = Date.now() - startTime;
    const avgTimeMs = totalTimeMs / iterations;
    const opsPerSecond = (iterations / totalTimeMs) * 1000;
    
    return {
      name,
      iterations,
      totalTimeMs,
      avgTimeMs,
      opsPerSecond,
    };
  }
}

export default KafkaTestUtils;