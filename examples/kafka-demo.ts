#!/usr/bin/env node

/**
 * Simplified Kafka Demo Application
 * 
 * Demonstrates the working Kafka client libraries with basic functionality
 */

import { 
  KafkaProducerClient, 
  KafkaConsumerClient, 
  KafkaClientFactory,
  SagaOrchestrator,
  AggregateRoot
} from '../src/kafka/KafkaClientLibraries';
import { Logger } from '../src/logger';

// Demo User Aggregate for Event Sourcing
class UserAggregate extends AggregateRoot {
  public email = '';
  public username = '';
  public orderCount = 0;

  static create(email: string, username: string): UserAggregate {
    const user = new UserAggregate();
    user.addEvent('UserCreated', { email, username });
    return user;
  }

  addOrder(orderId: string): void {
    this.addEvent('OrderAdded', { orderId });
  }

  applyEvent(event: any): void {
    switch (event.eventType) {
      case 'UserCreated':
        this.email = event.data.email;
        this.username = event.data.username;
        this.version = event.eventVersion;
        break;
      case 'OrderAdded':
        this.orderCount++;
        this.version = event.eventVersion;
        break;
    }
  }
}

async function demonstrateKafkaIntegration() {
  const logger = new Logger('KafkaDemo');
  logger.info('🚀 Starting Kafka Client Libraries Demo');

  const brokers = process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'];

  try {
    // 1. High-Throughput Producer Demo
    logger.info('📤 Testing High-Throughput Producer...');
    const producer = KafkaClientFactory.createHighThroughputProducer(
      brokers, 
      'demo-producer'
    );

    await producer.connect();

    // Send test messages
    const startTime = Date.now();
    const messageCount = 1000;

    for (let i = 0; i < messageCount; i++) {
      await producer.publish('demo-topic', {
        id: i,
        timestamp: new Date(),
        data: `High-throughput message ${i}`,
        payload: 'x'.repeat(100), // 100-byte payload
      }, {
        key: `key-${i}`,
        headers: { 'source': 'demo', 'type': 'test' },
      });

      if (i % 100 === 0) {
        logger.info(`Sent ${i}/${messageCount} messages`);
      }
    }

    const duration = Date.now() - startTime;
    const throughput = Math.round((messageCount / duration) * 1000);
    logger.success(`✅ Producer: ${messageCount} messages in ${duration}ms (${throughput} msg/sec)`);

    // 2. High-Throughput Consumer Demo
    logger.info('📥 Testing High-Throughput Consumer...');
    const consumer = KafkaClientFactory.createHighThroughputConsumer(
      brokers,
      'demo-consumer',
      'demo-group'
    );

    await consumer.connect();
    await consumer.subscribe(['demo-topic']);

    let receivedCount = 0;
    const consumeStartTime = Date.now();

    consumer.registerMessageHandler('demo-topic', async (payload) => {
      receivedCount++;
      
      if (receivedCount % 100 === 0) {
        logger.info(`Received ${receivedCount} messages`);
      }

      if (receivedCount >= messageCount) {
        const consumeDuration = Date.now() - consumeStartTime;
        const consumeThroughput = Math.round((receivedCount / consumeDuration) * 1000);
        logger.success(`✅ Consumer: ${receivedCount} messages in ${consumeDuration}ms (${consumeThroughput} msg/sec)`);
        
        await consumer.stop();
      }
    });

    await consumer.startConsuming();

    // 3. Event Sourcing Demo
    logger.info('📚 Testing Event Sourcing...');
    const user = UserAggregate.create('john@example.com', 'john_doe');
    user.addOrder('order-123');
    user.addOrder('order-456');

    logger.info(`User created: ${user.username}, Orders: ${user.orderCount}, Events: ${user.getUncommittedEvents().length}`);

    // 4. Saga Orchestration Demo
    logger.info('⚙️ Testing Saga Orchestration...');
    const sagaOrchestrator = new SagaOrchestrator();

    const orderProcessingSteps = [
      {
        id: 'validate-inventory',
        name: 'Validate Inventory',
        execute: async (context: any) => {
          logger.info('🔍 Validating inventory...');
          await new Promise(resolve => setTimeout(resolve, 100));
          return { inventoryValid: true };
        },
        compensate: async (context: any) => {
          logger.info('🔄 Releasing inventory...');
        },
      },
      {
        id: 'process-payment',
        name: 'Process Payment',
        execute: async (context: any) => {
          logger.info('💳 Processing payment...');
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // 80% success rate simulation
          if (Math.random() > 0.2) {
            return { paymentId: 'pay-12345', amount: context.amount };
          } else {
            throw new Error('Payment failed');
          }
        },
        compensate: async (context: any) => {
          logger.info('💸 Refunding payment...');
        },
      },
      {
        id: 'ship-order',
        name: 'Ship Order',
        execute: async (context: any) => {
          logger.info('📦 Shipping order...');
          await new Promise(resolve => setTimeout(resolve, 150));
          return { trackingNumber: 'TRK-67890' };
        },
      },
    ];

    let completedSagas = 0;
    let failedSagas = 0;

    sagaOrchestrator.on('sagaCompleted', ({ sagaId }) => {
      completedSagas++;
      logger.success(`✅ Saga completed: ${sagaId}`);
    });

    sagaOrchestrator.on('sagaFailed', ({ sagaId }) => {
      failedSagas++;
      logger.warning(`❌ Saga failed and compensated: ${sagaId}`);
    });

    // Start multiple sagas
    const sagaPromises = Array.from({ length: 5 }, async (_, i) => {
      const sagaId = `order-saga-${i}`;
      await sagaOrchestrator.startSaga(sagaId, orderProcessingSteps, {
        orderId: `order-${1000 + i}`,
        customerId: `customer-${100 + i}`,
        amount: 99.99 + i,
      });
    });

    await Promise.allSettled(sagaPromises);

    // Wait for sagas to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    logger.info(`📊 Saga Results: Completed: ${completedSagas}, Failed: ${failedSagas}`);

    // 5. Metrics and Health Check Demo
    logger.info('📊 Checking Metrics and Health...');
    
    const producerMetrics = producer.getMetrics();
    const consumerMetrics = consumer.getMetrics();

    logger.info('Producer Metrics:', {
      messagesPublished: producerMetrics.messages_published || 0,
      publishErrors: producerMetrics.publish_errors || 0,
      avgPublishDuration: Math.round(producerMetrics.publish_duration_avg || 0),
    });

    logger.info('Consumer Metrics:', {
      messagesProcessed: consumerMetrics.messages_processed_successfully || 0,
      processingErrors: consumerMetrics.message_processing_errors || 0,
      avgProcessingDuration: Math.round(consumerMetrics.message_processing_duration_avg || 0),
    });

    logger.info('Health Status:', {
      producer: producer.isHealthy() ? '✅ Healthy' : '❌ Unhealthy',
      consumer: consumer.isHealthy() ? '✅ Healthy' : '❌ Unhealthy',
    });

    // Cleanup
    await producer.disconnect();
    await consumer.disconnect();

    logger.success('🎉 Kafka Client Libraries Demo Completed Successfully!');

  } catch (error) {
    logger.error('❌ Demo failed:', error);
    throw error;
  }
}

// Performance benchmark
async function runPerformanceBenchmark() {
  const logger = new Logger('KafkaBenchmark');
  logger.info('🏃‍♂️ Running Performance Benchmark...');

  const brokers = process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'];
  
  try {
    const producer = KafkaClientFactory.createHighThroughputProducer(
      brokers,
      'benchmark-producer'
    );

    await producer.connect();

    // Benchmark different message sizes
    const messageSizes = [100, 1000, 10000]; // bytes
    const messageCount = 1000;

    for (const size of messageSizes) {
      logger.info(`📏 Testing ${size}-byte messages...`);
      
      const messages = Array.from({ length: messageCount }, (_, i) => ({
        message: {
          id: i,
          data: 'x'.repeat(size),
          timestamp: new Date(),
        },
        options: { key: `bench-${i}` },
      }));

      const startTime = Date.now();
      await producer.publishBatch('benchmark-topic', messages);
      const duration = Date.now() - startTime;

      const throughput = Math.round((messageCount / duration) * 1000);
      const mbps = Math.round((messageCount * size / duration / 1024) * 1000) / 1024;

      logger.success(`📈 ${size}B messages: ${throughput} msg/sec, ${mbps} MB/s`);
    }

    await producer.disconnect();
    logger.success('🏆 Performance benchmark completed!');

  } catch (error) {
    logger.error('❌ Benchmark failed:', error);
  }
}

// Main execution
async function main() {
  const logger = new Logger('Main');
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    logger.warning('🛑 Received SIGINT, shutting down...');
    process.exit(0);
  });

  try {
    await demonstrateKafkaIntegration();
    
    if (process.env.RUN_BENCHMARK === 'true') {
      await runPerformanceBenchmark();
    }
    
  } catch (error) {
    logger.error('💥 Application failed:', error);
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export default { demonstrateKafkaIntegration, runPerformanceBenchmark };