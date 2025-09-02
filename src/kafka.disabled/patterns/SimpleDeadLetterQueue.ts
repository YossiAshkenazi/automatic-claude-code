import { Kafka, Producer, Message } from 'kafkajs';
import { Logger } from '../../logger';

export interface DeadLetterQueueConfig {
  kafka: Kafka;
  topic: string;
  maxRetries: number;
}

export class DeadLetterQueue {
  private producer: Producer;
  private logger: Logger;
  private isConnected = false;

  constructor(private config: DeadLetterQueueConfig) {
    this.logger = new Logger('DeadLetterQueue');
    this.producer = config.kafka.producer();
  }

  async connect(): Promise<void> {
    await this.producer.connect();
    this.isConnected = true;
    this.logger.info('Dead Letter Queue connected');
  }

  async disconnect(): Promise<void> {
    await this.producer.disconnect();
    this.isConnected = false;
    this.logger.info('Dead Letter Queue disconnected');
  }

  async send(
    originalTopic: string,
    originalMessage: Message & { partition?: number; offset?: string },
    error: Error
  ): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    const dlqMessage = {
      originalTopic,
      originalOffset: originalMessage.offset || '0',
      errorMessage: error.message,
      failedAt: new Date().toISOString(),
    };

    await this.producer.send({
      topic: this.config.topic,
      messages: [{
        key: originalMessage.key,
        value: JSON.stringify(dlqMessage),
        headers: {
          'dlq-original-topic': originalTopic,
          'dlq-error': error.message,
        },
      }],
    });

    this.logger.info(`Message sent to dead letter queue: ${this.config.topic}`);
  }

  isHealthy(): boolean {
    return this.isConnected;
  }
}

export default DeadLetterQueue;