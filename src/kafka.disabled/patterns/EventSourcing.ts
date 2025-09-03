import { v4 as uuidv4 } from 'uuid';
import { KafkaProducerClient } from '../producer/KafkaProducerClient';
import { KafkaConsumerClient } from '../consumer/KafkaConsumerClient';
import { Logger } from '../../logger';

export interface Event {
  id: string;
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  eventVersion: number;
  timestamp: Date;
  data: any;
  metadata?: Record<string, any>;
  causationId?: string;
  correlationId?: string;
}

export interface EventDescriptor {
  aggregateId: string;
  eventType: string;
  data: any;
  metadata?: Record<string, any>;
  correlationId?: string;
  causationId?: string;
}

export interface Snapshot {
  id: string;
  aggregateId: string;
  aggregateType: string;
  version: number;
  timestamp: Date;
  data: any;
}

export interface EventStore {
  saveEvents(aggregateId: string, events: Event[], expectedVersion?: number): Promise<void>;
  getEvents(aggregateId: string, fromVersion?: number): Promise<Event[]>;
  saveSnapshot(snapshot: Snapshot): Promise<void>;
  getSnapshot(aggregateId: string): Promise<Snapshot | null>;
}

export interface EventHandler<T = any> {
  (event: Event<T>): Promise<void>;
}

export interface AggregateRoot {
  id: string;
  version: number;
  uncommittedEvents: Event[];
  
  applyEvent(event: Event): void;
  markEventsAsCommitted(): void;
  loadFromHistory(events: Event[]): void;
  getUncommittedEvents(): Event[];
}

export abstract class BaseAggregateRoot implements AggregateRoot {
  public id: string;
  public version = 0;
  public uncommittedEvents: Event[] = [];

  constructor(id?: string) {
    this.id = id || uuidv4();
  }

  protected addEvent(eventDescriptor: EventDescriptor): void {
    const event: Event = {
      id: uuidv4(),
      aggregateId: this.id,
      aggregateType: this.constructor.name,
      eventType: eventDescriptor.eventType,
      eventVersion: this.version + 1,
      timestamp: new Date(),
      data: eventDescriptor.data,
      metadata: eventDescriptor.metadata,
      causationId: eventDescriptor.causationId,
      correlationId: eventDescriptor.correlationId,
    };

    this.applyEvent(event);
    this.uncommittedEvents.push(event);
  }

  abstract applyEvent(event: Event): void;

  markEventsAsCommitted(): void {
    this.uncommittedEvents = [];
  }

  loadFromHistory(events: Event[]): void {
    for (const event of events) {
      this.applyEvent(event);
    }
    this.markEventsAsCommitted();
  }

  getUncommittedEvents(): Event[] {
    return [...this.uncommittedEvents];
  }
}

export class KafkaEventStore implements EventStore {
  private logger: Logger;

  constructor(
    private producer: KafkaProducerClient,
    private consumer: KafkaConsumerClient,
    private config: {
      eventsTopic: string;
      snapshotsTopic: string;
      partitionStrategy?: 'aggregate' | 'hash' | 'round-robin';
    }
  ) {
    this.logger = new Logger('KafkaEventStore');
  }

  async saveEvents(
    aggregateId: string,
    events: Event[],
    expectedVersion?: number
  ): Promise<void> {
    try {
      // Optimistic concurrency check would go here if needed
      // This would require reading current version from a separate store or topic

      const messages = events.map(event => ({
        message: event,
        options: {
          key: aggregateId,
          partition: this.getPartition(aggregateId),
          headers: {
            'aggregate-id': aggregateId,
            'aggregate-type': event.aggregateType,
            'event-type': event.eventType,
            'event-version': event.eventVersion.toString(),
            'correlation-id': event.correlationId || '',
            'causation-id': event.causationId || '',
          },
        },
      }));

      await this.producer.publishBatch(
        this.config.eventsTopic,
        messages,
        { transactional: true }
      );

      this.logger.debug(`Saved ${events.length} events for aggregate ${aggregateId}`);
    } catch (error) {
      this.logger.error(`Failed to save events for aggregate ${aggregateId}`, error);
      throw error;
    }
  }

  async getEvents(aggregateId: string, fromVersion = 0): Promise<Event[]> {
    // This is a simplified implementation
    // In reality, you'd need to consume from the events topic
    // filtering by aggregate ID and version
    throw new Error('getEvents not implemented - requires consumer implementation with filtering');
  }

  async saveSnapshot(snapshot: Snapshot): Promise<void> {
    try {
      await this.producer.publish(
        this.config.snapshotsTopic,
        snapshot,
        {
          key: snapshot.aggregateId,
          partition: this.getPartition(snapshot.aggregateId),
          headers: {
            'aggregate-id': snapshot.aggregateId,
            'aggregate-type': snapshot.aggregateType,
            'snapshot-version': snapshot.version.toString(),
          },
        }
      );

      this.logger.debug(`Saved snapshot for aggregate ${snapshot.aggregateId} at version ${snapshot.version}`);
    } catch (error) {
      this.logger.error(`Failed to save snapshot for aggregate ${snapshot.aggregateId}`, error);
      throw error;
    }
  }

  async getSnapshot(aggregateId: string): Promise<Snapshot | null> {
    // This is a simplified implementation
    // In reality, you'd need to consume from the snapshots topic
    // and find the latest snapshot for the aggregate
    throw new Error('getSnapshot not implemented - requires consumer implementation with filtering');
  }

  private getPartition(aggregateId: string): number | undefined {
    switch (this.config.partitionStrategy) {
      case 'aggregate':
        // Use aggregate ID hash for partitioning
        return this.hashString(aggregateId) % 10; // Assuming 10 partitions
      case 'hash':
        return this.hashString(aggregateId) % 10;
      case 'round-robin':
        return undefined; // Let Kafka decide
      default:
        return undefined;
    }
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

export class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();
  private logger: Logger;

  constructor(private consumer: KafkaConsumerClient) {
    this.logger = new Logger('EventBus');
  }

  subscribe<T>(eventType: string, handler: EventHandler<T>): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    
    this.handlers.get(eventType)!.add(handler as EventHandler);
    this.logger.info(`Subscribed handler for event type: ${eventType}`);
  }

  unsubscribe<T>(eventType: string, handler: EventHandler<T>): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler as EventHandler);
      if (handlers.size === 0) {
        this.handlers.delete(eventType);
      }
    }
  }

  async start(topic: string): Promise<void> {
    await this.consumer.subscribe([topic]);
    
    this.consumer.registerMessageHandler(topic, async (payload) => {
      try {
        const event = payload.message as Event;
        await this.publishToHandlers(event);
      } catch (error) {
        this.logger.error('Error processing event', error);
        throw error;
      }
    });

    await this.consumer.startConsuming();
    this.logger.info(`Event bus started, consuming from topic: ${topic}`);
  }

  private async publishToHandlers(event: Event): Promise<void> {
    const handlers = this.handlers.get(event.eventType);
    if (!handlers || handlers.size === 0) {
      this.logger.debug(`No handlers found for event type: ${event.eventType}`);
      return;
    }

    const promises = Array.from(handlers).map(async (handler) => {
      try {
        await handler(event);
      } catch (error) {
        this.logger.error(`Error in event handler for ${event.eventType}`, error);
        // Don't rethrow - let other handlers continue
      }
    });

    await Promise.all(promises);
  }
}

// Repository pattern for aggregates
export class AggregateRepository<T extends AggregateRoot> {
  private logger: Logger;

  constructor(
    private eventStore: EventStore,
    private aggregateType: new (id?: string) => T,
    private config: {
      snapshotFrequency?: number;
      enableSnapshots?: boolean;
    } = {}
  ) {
    this.logger = new Logger(`AggregateRepository<${aggregateType.name}>`);
  }

  async save(aggregate: T, expectedVersion?: number): Promise<void> {
    const uncommittedEvents = aggregate.getUncommittedEvents();
    if (uncommittedEvents.length === 0) {
      return;
    }

    try {
      await this.eventStore.saveEvents(
        aggregate.id,
        uncommittedEvents,
        expectedVersion
      );

      aggregate.markEventsAsCommitted();

      // Create snapshot if configured and needed
      if (this.shouldCreateSnapshot(aggregate)) {
        await this.createSnapshot(aggregate);
      }

      this.logger.debug(`Saved aggregate ${aggregate.id} with ${uncommittedEvents.length} events`);
    } catch (error) {
      this.logger.error(`Failed to save aggregate ${aggregate.id}`, error);
      throw error;
    }
  }

  async getById(id: string): Promise<T | null> {
    try {
      let aggregate = new this.aggregateType(id);
      let fromVersion = 0;

      // Try to load from snapshot first if enabled
      if (this.config.enableSnapshots) {
        const snapshot = await this.eventStore.getSnapshot(id);
        if (snapshot) {
          aggregate = this.rehydrateFromSnapshot(snapshot);
          fromVersion = snapshot.version + 1;
        }
      }

      // Load events after snapshot
      const events = await this.eventStore.getEvents(id, fromVersion);
      if (events.length === 0 && fromVersion === 0) {
        return null; // Aggregate doesn't exist
      }

      aggregate.loadFromHistory(events);
      return aggregate;
    } catch (error) {
      this.logger.error(`Failed to load aggregate ${id}`, error);
      throw error;
    }
  }

  private shouldCreateSnapshot(aggregate: T): boolean {
    if (!this.config.enableSnapshots || !this.config.snapshotFrequency) {
      return false;
    }

    return aggregate.version % this.config.snapshotFrequency === 0;
  }

  private async createSnapshot(aggregate: T): Promise<void> {
    const snapshot: Snapshot = {
      id: uuidv4(),
      aggregateId: aggregate.id,
      aggregateType: this.aggregateType.name,
      version: aggregate.version,
      timestamp: new Date(),
      data: this.serializeAggregate(aggregate),
    };

    await this.eventStore.saveSnapshot(snapshot);
  }

  private rehydrateFromSnapshot(snapshot: Snapshot): T {
    // This would need to be implemented based on your aggregate structure
    // For now, just create a new instance and set basic properties
    const aggregate = new this.aggregateType(snapshot.aggregateId);
    aggregate.version = snapshot.version;
    
    // You'd need to implement deserializeAggregate to restore state
    // this.deserializeAggregate(aggregate, snapshot.data);
    
    return aggregate;
  }

  private serializeAggregate(aggregate: T): any {
    // Implement serialization logic based on your aggregate structure
    // This is a simplified example
    return {
      id: aggregate.id,
      version: aggregate.version,
      // Add other aggregate properties as needed
    };
  }
}

// Example usage and utility functions
export class EventSourcingUtils {
  static createCorrelationId(): string {
    return uuidv4();
  }

  static createCausationId(): string {
    return uuidv4();
  }

  static validateEvent(event: Event): boolean {
    return !!(
      event.id &&
      event.aggregateId &&
      event.aggregateType &&
      event.eventType &&
      event.eventVersion > 0 &&
      event.timestamp &&
      event.data
    );
  }

  static serializeEvent(event: Event): string {
    return JSON.stringify(event, (key, value) => {
      if (key === 'timestamp' && value instanceof Date) {
        return value.toISOString();
      }
      return value;
    });
  }

  static deserializeEvent(eventJson: string): Event {
    const parsed = JSON.parse(eventJson);
    if (parsed.timestamp) {
      parsed.timestamp = new Date(parsed.timestamp);
    }
    return parsed as Event;
  }

  static getEventsByType(events: Event[], eventType: string): Event[] {
    return events.filter(event => event.eventType === eventType);
  }

  static getEventsByAggregateType(events: Event[], aggregateType: string): Event[] {
    return events.filter(event => event.aggregateType === aggregateType);
  }

  static getEventsInTimeRange(events: Event[], start: Date, end: Date): Event[] {
    return events.filter(event => 
      event.timestamp >= start && event.timestamp <= end
    );
  }
}

export default {
  Event,
  EventDescriptor,
  BaseAggregateRoot,
  KafkaEventStore,
  EventBus,
  AggregateRepository,
  EventSourcingUtils,
};