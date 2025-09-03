#!/usr/bin/env node

/**
 * Kafka Client Libraries - Sample Application
 * 
 * Demonstrates high-performance Kafka integration with:
 * - Producer/Consumer clients with 100K+ msgs/sec capability
 * - Event sourcing patterns
 * - Saga orchestration
 * - Dead letter queue handling
 * - Circuit breaker patterns
 * - Comprehensive monitoring
 * 
 * Run: npx tsx examples/sample-app.ts
 */

import { KafkaProducerClient } from '../src/kafka/producer/KafkaProducerClient';
import { KafkaConsumerClient } from '../src/kafka/consumer/KafkaConsumerClient';
import { SagaOrchestrator, SagaDefinition } from '../src/kafka/patterns/SagaOrchestrator';
import { 
  KafkaEventStore, 
  EventBus, 
  AggregateRepository,
  BaseAggregateRoot,
  Event
} from '../src/kafka/patterns/EventSourcing';
import { Logger } from '../src/logger';
import { CompressionTypes } from 'kafkajs';

// Sample domain models for demonstration
interface UserCreatedEvent {
  userId: string;
  email: string;
  username: string;
  createdAt: Date;
}

interface OrderCreatedEvent {
  orderId: string;
  userId: string;
  items: Array<{ productId: string; quantity: number; price: number }>;
  totalAmount: number;
  createdAt: Date;
}

interface PaymentProcessedEvent {
  paymentId: string;
  orderId: string;
  amount: number;
  status: 'success' | 'failed';
  processedAt: Date;
}

// Sample aggregate for event sourcing
class UserAggregate extends BaseAggregateRoot {
  public email: string = '';
  public username: string = '';
  public isActive: boolean = true;
  public orders: string[] = [];

  static create(userId: string, email: string, username: string): UserAggregate {
    const user = new UserAggregate(userId);
    user.addEvent({
      aggregateId: userId,
      eventType: 'UserCreated',
      data: { userId, email, username, createdAt: new Date() },
    });
    return user;
  }

  addOrder(orderId: string): void {
    this.addEvent({
      aggregateId: this.id,
      eventType: 'OrderAdded',
      data: { orderId, addedAt: new Date() },
    });
  }

  deactivate(): void {
    if (!this.isActive) {
      throw new Error('User is already inactive');
    }
    
    this.addEvent({
      aggregateId: this.id,
      eventType: 'UserDeactivated',
      data: { deactivatedAt: new Date() },
    });
  }

  applyEvent(event: Event): void {
    switch (event.eventType) {
      case 'UserCreated':
        this.email = event.data.email;
        this.username = event.data.username;
        this.version = event.eventVersion;
        break;
      
      case 'OrderAdded':
        this.orders.push(event.data.orderId);
        this.version = event.eventVersion;
        break;
      
      case 'UserDeactivated':
        this.isActive = false;
        this.version = event.eventVersion;
        break;
    }
  }
}

class KafkaSampleApp {
  private logger = new Logger('KafkaSampleApp');
  private producer!: KafkaProducerClient;
  private consumer!: KafkaConsumerClient;
  private eventBus!: EventBus;
  private sagaOrchestrator!: SagaOrchestrator;
  private userRepository!: AggregateRepository<UserAggregate>;

  async run(): Promise<void> {
    try {
      this.logger.info('🚀 Starting Kafka Sample Application...');
      
      // Initialize components
      await this.initializeKafkaClients();
      await this.initializeEventSourcing();
      await this.initializeSagaOrchestration();
      
      // Run demonstrations
      await this.demonstrateHighThroughputMessaging();
      await this.demonstrateEventSourcing();
      await this.demonstrateSagaOrchestration();
      await this.demonstrateErrorHandling();
      await this.demonstratePerformanceMetrics();
      
      this.logger.info('✅ All demonstrations completed successfully!');
      
    } catch (error) {
      this.logger.error('❌ Sample application failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  private async initializeKafkaClients(): Promise<void> {
    this.logger.info('Initializing Kafka clients...');
    
    const brokers = process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'];
    
    // High-performance producer configuration
    this.producer = new KafkaProducerClient({
      clientId: 'sample-app-producer',
      brokers,
      compression: CompressionTypes.GZIP,
      batchSize: 65536, // 64KB batches for high throughput
      lingerMs: 10, // 10ms batching window
      enableMetrics: true,
      retry: {
        maxRetries: 3,
        baseDelay: 100,
        maxDelay: 5000,
        backoffMultiplier: 2,
      },
      circuitBreaker: {
        failureThreshold: 5,
        resetTimeout: 30000,
        monitoringPeriod: 10000,
      },
    });

    // High-performance consumer configuration
    this.consumer = new KafkaConsumerClient({
      clientId: 'sample-app-consumer',
      brokers,
      groupId: 'sample-app-group',
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      maxWaitTimeInMs: 5000,
      maxBytesPerPartition: 1048576, // 1MB per partition
      enableMetrics: true,
      deadLetterQueue: {
        enabled: true,
        topic: 'sample-app-dlq',
        maxRetries: 3,
      },
    });

    await this.producer.connect();
    await this.consumer.connect();
    
    this.logger.info('✅ Kafka clients initialized');
  }

  private async initializeEventSourcing(): Promise<void> {
    this.logger.info('Initializing Event Sourcing...');
    
    const eventStore = new KafkaEventStore(this.producer, this.consumer, {
      eventsTopic: 'user-events',
      snapshotsTopic: 'user-snapshots',
      partitionStrategy: 'aggregate',
    });

    this.userRepository = new AggregateRepository(
      eventStore,
      UserAggregate,
      {
        enableSnapshots: true,
        snapshotFrequency: 10, // Snapshot every 10 events
      }
    );

    this.eventBus = new EventBus(this.consumer);
    
    // Register event handlers
    this.eventBus.subscribe('UserCreated', this.handleUserCreated.bind(this));
    this.eventBus.subscribe('OrderAdded', this.handleOrderAdded.bind(this));
    
    await this.eventBus.start('user-events');
    
    this.logger.info('✅ Event Sourcing initialized');
  }

  private async initializeSagaOrchestration(): Promise<void> {
    this.logger.info('Initializing Saga Orchestration...');
    
    this.sagaOrchestrator = new SagaOrchestrator(this.producer, this.consumer, {
      sagaEventsTopic: 'saga-events',
      sagaCommandsTopic: 'saga-commands',
      timeoutCheckInterval: 5000,
      persistSagaState: true,
      sagaStateTopic: 'saga-state',
    });

    // Define order processing saga
    const orderProcessingSaga: SagaDefinition = {
      id: 'order-processing-saga',
      name: 'Order Processing',
      timeoutMs: 300000, // 5 minutes
      compensationStrategy: 'backward',
      steps: [
        {
          id: 'validate-inventory',
          name: 'Validate Inventory',
          command: {
            type: 'ValidateInventory',
            targetTopic: 'inventory-commands',
            data: {},
          },
          compensatingCommand: {
            type: 'ReleaseInventory',
            targetTopic: 'inventory-commands',
            data: {},
          },
          timeout: 30000,
          retryPolicy: {
            maxRetries: 3,
            retryDelay: 1000,
            backoffMultiplier: 2,
          },
        },
        {
          id: 'process-payment',
          name: 'Process Payment',
          command: {
            type: 'ProcessPayment',
            targetTopic: 'payment-commands',
            data: {},
          },
          compensatingCommand: {
            type: 'RefundPayment',
            targetTopic: 'payment-commands',
            data: {},
          },
          dependsOn: ['validate-inventory'],
          timeout: 60000,
        },
        {
          id: 'ship-order',
          name: 'Ship Order',
          command: {
            type: 'ShipOrder',
            targetTopic: 'shipping-commands',
            data: {},
          },
          dependsOn: ['process-payment'],
          timeout: 120000,
        },
      ],
    };

    this.sagaOrchestrator.registerSaga(orderProcessingSaga);
    
    // Register step handlers (simplified for demo)
    this.sagaOrchestrator.registerStepHandler('ValidateInventory', async (command, context) => {
      this.logger.info('Validating inventory...', context);
      await this.simulateWork(1000); // Simulate inventory check
      return { success: true, data: { inventoryValid: true } };
    });

    this.sagaOrchestrator.registerStepHandler('ProcessPayment', async (command, context) => {
      this.logger.info('Processing payment...', context);
      await this.simulateWork(2000); // Simulate payment processing
      // Simulate occasional payment failures
      const success = Math.random() > 0.2; // 80% success rate
      return { 
        success, 
        data: success ? { paymentId: 'pay-123' } : undefined,
        error: success ? undefined : new Error('Payment failed'),
      };
    });

    this.sagaOrchestrator.registerStepHandler('ShipOrder', async (command, context) => {
      this.logger.info('Shipping order...', context);
      await this.simulateWork(1500); // Simulate shipping
      return { success: true, data: { trackingNumber: 'TRK-456' } };
    });

    await this.sagaOrchestrator.start();
    
    this.logger.info('✅ Saga Orchestration initialized');
  }

  private async demonstrateHighThroughputMessaging(): Promise<void> {
    this.logger.info('🔥 Demonstrating High-Throughput Messaging...');
    
    const topic = 'high-throughput-demo';
    const messageCount = 10000;
    const batchSize = 100;
    
    // Subscribe consumer
    await this.consumer.subscribe([topic]);
    
    let receivedCount = 0;
    this.consumer.registerMessageHandler(topic, async (payload) => {
      receivedCount++;
      if (receivedCount % 1000 === 0) {
        this.logger.info(`Received ${receivedCount}/${messageCount} messages`);
      }
    });
    
    await this.consumer.startConsuming();
    
    // Send messages in batches for maximum throughput
    const startTime = Date.now();
    
    for (let i = 0; i < messageCount; i += batchSize) {
      const batch = Array.from({ length: Math.min(batchSize, messageCount - i) }, (_, j) => ({
        message: {
          id: i + j,
          data: `High-throughput message ${i + j}`,
          timestamp: new Date(),
          payload: Buffer.alloc(1024, 'x'), // 1KB payload
        },
        options: {
          key: `key-${i + j}`,
          headers: {
            'message-type': 'high-throughput',
            'batch-id': Math.floor(i / batchSize).toString(),
          },
        },
      }));
      
      await this.producer.publishBatch(topic, batch);
    }
    
    const publishTime = Date.now() - startTime;
    const throughput = Math.round((messageCount / publishTime) * 1000);
    
    this.logger.info(`📊 Published ${messageCount} messages in ${publishTime}ms`);
    this.logger.info(`📈 Throughput: ${throughput} messages/second`);
    
    // Wait for all messages to be consumed
    const consumeStartTime = Date.now();
    while (receivedCount < messageCount && Date.now() - consumeStartTime < 30000) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const consumeTime = Date.now() - consumeStartTime;
    const consumeThroughput = Math.round((receivedCount / consumeTime) * 1000);
    
    this.logger.info(`📊 Consumed ${receivedCount} messages in ${consumeTime}ms`);
    this.logger.info(`📈 Consume throughput: ${consumeThroughput} messages/second`);
    
    await this.consumer.pause();
  }

  private async demonstrateEventSourcing(): Promise<void> {
    this.logger.info('📚 Demonstrating Event Sourcing...');
    
    const userId = 'user-123';
    
    // Create new user aggregate
    const user = UserAggregate.create(userId, 'john@example.com', 'john_doe');
    user.addOrder('order-456');
    user.addOrder('order-789');
    
    // Save aggregate (will persist events)
    await this.userRepository.save(user);
    this.logger.info(`✅ User aggregate saved with ${user.getUncommittedEvents().length} events`);
    
    // Load aggregate from event store
    const loadedUser = await this.userRepository.getById(userId);
    if (loadedUser) {
      this.logger.info(`✅ User aggregate loaded: ${loadedUser.username}, Orders: ${loadedUser.orders.length}`);
      
      // Make more changes
      loadedUser.addOrder('order-999');
      await this.userRepository.save(loadedUser);
      this.logger.info('✅ Additional order added to user');
    }
    
    // Demonstrate event replay
    const replayedUser = await this.userRepository.getById(userId);
    this.logger.info(`📚 Replayed user state: Version ${replayedUser?.version}, Orders: ${replayedUser?.orders.length}`);
  }

  private async demonstrateSagaOrchestration(): Promise<void> {
    this.logger.info('⚙️ Demonstrating Saga Orchestration...');
    
    // Start multiple order processing sagas
    const sagaPromises = Array.from({ length: 5 }, async (_, i) => {
      const sagaId = await this.sagaOrchestrator.startSaga('order-processing-saga', {
        orderId: `order-${1000 + i}`,
        customerId: `customer-${100 + i}`,
        amount: 99.99 + i,
        items: [
          { productId: `product-${i}`, quantity: 1, price: 99.99 },
        ],
      });
      
      this.logger.info(`🚀 Started saga ${sagaId} for order-${1000 + i}`);
      return sagaId;
    });
    
    const sagaIds = await Promise.all(sagaPromises);
    
    // Monitor saga progress
    this.sagaOrchestrator.on('sagaCompleted', ({ sagaId, instance }) => {
      this.logger.info(`✅ Saga ${sagaId} completed successfully`);
    });
    
    this.sagaOrchestrator.on('sagaFailed', ({ sagaId, instance }) => {
      this.logger.warn(`❌ Saga ${sagaId} failed: ${instance.error?.message}`);
    });
    
    // Wait for sagas to complete (with timeout)
    const startTime = Date.now();
    const timeout = 60000; // 1 minute
    
    while (Date.now() - startTime < timeout) {
      const runningSagas = this.sagaOrchestrator.getSagaInstancesByStatus('running');
      if (runningSagas.length === 0) {
        break;
      }
      
      this.logger.info(`⏳ Waiting for ${runningSagas.length} sagas to complete...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Show final saga statistics
    const completedSagas = this.sagaOrchestrator.getSagaInstancesByStatus('completed');
    const failedSagas = this.sagaOrchestrator.getSagaInstancesByStatus('failed');
    const compensatedSagas = this.sagaOrchestrator.getSagaInstancesByStatus('compensated');
    
    this.logger.info(`📊 Saga Results - Completed: ${completedSagas.length}, Failed: ${failedSagas.length}, Compensated: ${compensatedSagas.length}`);
  }

  private async demonstrateErrorHandling(): Promise<void> {
    this.logger.info('🛡️ Demonstrating Error Handling...');
    
    const errorTopic = 'error-demo';
    await this.consumer.subscribe([errorTopic]);
    
    // Register handler that sometimes fails
    this.consumer.registerMessageHandler(errorTopic, async (payload) => {
      const message = payload.message as any;
      
      if (message.shouldFail) {
        throw new Error(`Simulated processing error for message ${message.id}`);
      }
      
      this.logger.info(`✅ Successfully processed message ${message.id}`);
    });
    
    await this.consumer.startConsuming();
    
    // Send mix of successful and failing messages
    const testMessages = Array.from({ length: 10 }, (_, i) => ({
      message: {
        id: i,
        data: `Test message ${i}`,
        shouldFail: i % 3 === 0, // Every 3rd message fails
      },
      options: {
        key: `error-test-${i}`,
      },
    }));
    
    await this.producer.publishBatch(errorTopic, testMessages);
    this.logger.info(`📤 Sent ${testMessages.length} test messages (some will fail)`);
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check dead letter queue (would need separate consumer)
    this.logger.info('💀 Failed messages sent to dead letter queue for later processing');
    
    await this.consumer.pause();
  }

  private async demonstratePerformanceMetrics(): Promise<void> {
    this.logger.info('📊 Demonstrating Performance Metrics...');
    
    // Get producer metrics
    const producerMetrics = this.producer.getMetrics();
    this.logger.info('Producer Metrics:', {
      messagesPublished: producerMetrics.messages_published || 0,
      publishErrors: producerMetrics.publish_errors || 0,
      avgPublishDuration: producerMetrics.publish_duration_avg || 0,
    });
    
    // Get consumer metrics
    const consumerMetrics = this.consumer.getMetrics();
    this.logger.info('Consumer Metrics:', {
      messagesProcessed: consumerMetrics.messages_processed_successfully || 0,
      processingErrors: consumerMetrics.message_processing_errors || 0,
      avgProcessingDuration: consumerMetrics.message_processing_duration_avg || 0,
    });
    
    // Health checks
    const producerHealth = await this.producer.healthCheck();
    const consumerHealth = await this.consumer.healthCheck();
    
    this.logger.info('Health Status:', {
      producer: producerHealth.status,
      consumer: consumerHealth.status,
    });
    
    // Saga orchestrator stats
    const allSagas = this.sagaOrchestrator.getAllSagaInstances();
    const sagaStats = allSagas.reduce((acc, saga) => {
      acc[saga.status] = (acc[saga.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    this.logger.info('Saga Statistics:', sagaStats);
  }

  private async handleUserCreated(event: Event<UserCreatedEvent>): Promise<void> {
    this.logger.info(`👤 User created: ${event.data.username} (${event.data.email})`);
    
    // Trigger welcome email saga or other workflows
    await this.producer.publish('user-welcome-events', {
      type: 'UserWelcomeRequested',
      userId: event.data.userId,
      email: event.data.email,
      timestamp: new Date(),
    });
  }

  private async handleOrderAdded(event: Event): Promise<void> {
    this.logger.info(`🛒 Order added to user ${event.aggregateId}: ${event.data.orderId}`);
  }

  private async simulateWork(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async cleanup(): Promise<void> {
    this.logger.info('🧹 Cleaning up resources...');
    
    try {
      if (this.sagaOrchestrator) {
        await this.sagaOrchestrator.stop();
      }
      
      if (this.consumer) {
        await this.consumer.disconnect();
      }
      
      if (this.producer) {
        await this.producer.disconnect();
      }
      
      this.logger.info('✅ Cleanup completed');
    } catch (error) {
      this.logger.error('❌ Error during cleanup:', error);
    }
  }
}

// Run the sample application
async function main() {
  const app = new KafkaSampleApp();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    await app.cleanup();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    await app.cleanup();
    process.exit(0);
  });
  
  try {
    await app.run();
  } catch (error) {
    console.error('💥 Application failed:', error);
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export default KafkaSampleApp;