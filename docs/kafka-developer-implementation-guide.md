# Kafka Developer Implementation Guide

## Overview

This comprehensive guide provides developers with practical implementation patterns, best practices, and code examples for building event-driven applications with Apache Kafka in the dual-agent architecture. Designed for a 15 FTE development team across 4 organizational teams working on the Sprint 1 migration.

## Architecture Patterns

### Event-Driven Architecture Foundation

The migration transforms the existing SDK-based dual-agent system into an event-driven architecture using Apache Kafka as the backbone for inter-service communication.

```typescript
// Core Event Interface
interface DomainEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  eventData: any;
  metadata: {
    timestamp: Date;
    version: string;
    causationId?: string;
    correlationId: string;
    userId?: string;
    sessionId?: string;
  };
}

// Base Event Publisher
abstract class EventPublisher {
  constructor(
    private producer: Producer,
    private schemaRegistry: SchemaRegistry
  ) {}

  async publishEvent(event: DomainEvent): Promise<void> {
    try {
      // Validate event schema
      await this.validateEventSchema(event);
      
      // Enrich with metadata
      const enrichedEvent = this.enrichEventMetadata(event);
      
      // Publish to appropriate topic
      const topic = this.getTopicForEvent(event.eventType);
      
      await this.producer.send({
        topic,
        messages: [{
          key: event.aggregateId,
          value: JSON.stringify(enrichedEvent),
          headers: {
            'event-type': event.eventType,
            'event-version': event.metadata.version,
            'correlation-id': event.metadata.correlationId
          }
        }]
      });
      
      // Track metrics
      this.trackEventPublished(event.eventType);
      
    } catch (error) {
      await this.handlePublishError(event, error);
      throw error;
    }
  }

  protected abstract getTopicForEvent(eventType: string): string;
  protected abstract validateEventSchema(event: DomainEvent): Promise<void>;
}
```

### Agent Communication Patterns

#### Manager-Worker Coordination

Replace direct SDK calls with event-driven coordination:

```typescript
// Before: Direct SDK coordination
class LegacyAgentCoordinator {
  async coordinateTask(task: UserTask): Promise<TaskResult> {
    const analysisResult = await this.managerSDK.executeWithSDK(task.prompt);
    const workItems = this.parseWorkItems(analysisResult);
    
    const results = await Promise.all(
      workItems.map(item => this.workerSDK.executeWithSDK(item.prompt))
    );
    
    return this.combineResults(results);
  }
}

// After: Event-driven coordination
class EventDrivenAgentCoordinator extends EventPublisher {
  async coordinateTask(task: UserTask): Promise<string> {
    const correlationId = uuidv4();
    
    // Publish task assignment event
    await this.publishEvent({
      eventId: uuidv4(),
      eventType: 'TaskAssigned',
      aggregateId: task.id,
      aggregateType: 'Task',
      eventData: {
        taskId: task.id,
        description: task.description,
        priority: task.priority,
        assignedTo: 'manager-agent',
        dueDate: task.dueDate
      },
      metadata: {
        timestamp: new Date(),
        version: '1.0',
        correlationId,
        sessionId: task.sessionId,
        userId: task.userId
      }
    });
    
    return correlationId; // Client can track progress via correlation ID
  }

  protected getTopicForEvent(eventType: string): string {
    const topicMap: Record<string, string> = {
      'TaskAssigned': 'agent.tasks.manager',
      'WorkItemCreated': 'agent.tasks.worker',
      'TaskCompleted': 'session.events',
      'QualityGateResult': 'quality.gates'
    };
    
    return topicMap[eventType] || 'default.events';
  }
}

// Manager Agent Event Handler
class ManagerAgentHandler {
  @EventHandler('TaskAssigned')
  async handleTaskAssigned(event: DomainEvent): Promise<void> {
    try {
      const task = event.eventData;
      
      // Perform analysis using Claude SDK
      const analysis = await this.claudeSDK.analyzeTask(task);
      
      // Break down into work items
      const workItems = this.createWorkItems(analysis);
      
      // Publish work item events
      for (const workItem of workItems) {
        await this.eventPublisher.publishEvent({
          eventId: uuidv4(),
          eventType: 'WorkItemCreated',
          aggregateId: workItem.id,
          aggregateType: 'WorkItem',
          eventData: workItem,
          metadata: {
            timestamp: new Date(),
            version: '1.0',
            correlationId: event.metadata.correlationId,
            causationId: event.eventId,
            sessionId: event.metadata.sessionId
          }
        });
      }
      
      // Update task status
      await this.publishTaskStatusUpdate(task.id, 'ANALYZED', event.metadata.correlationId);
      
    } catch (error) {
      await this.handleTaskError(event, error);
    }
  }

  private async publishTaskStatusUpdate(
    taskId: string, 
    status: string, 
    correlationId: string
  ): Promise<void> {
    await this.eventPublisher.publishEvent({
      eventId: uuidv4(),
      eventType: 'TaskStatusUpdated',
      aggregateId: taskId,
      aggregateType: 'Task',
      eventData: { status, timestamp: new Date() },
      metadata: {
        timestamp: new Date(),
        version: '1.0',
        correlationId
      }
    });
  }
}

// Worker Agent Event Handler
class WorkerAgentHandler {
  @EventHandler('WorkItemCreated')
  async handleWorkItemCreated(event: DomainEvent): Promise<void> {
    try {
      const workItem = event.eventData;
      
      // Execute work item using Claude SDK
      const result = await this.claudeSDK.executeWorkItem(workItem);
      
      // Publish completion event
      await this.eventPublisher.publishEvent({
        eventId: uuidv4(),
        eventType: 'WorkItemCompleted',
        aggregateId: workItem.id,
        aggregateType: 'WorkItem',
        eventData: {
          workItemId: workItem.id,
          result: result,
          completedAt: new Date(),
          executionTime: result.executionTime
        },
        metadata: {
          timestamp: new Date(),
          version: '1.0',
          correlationId: event.metadata.correlationId,
          causationId: event.eventId
        }
      });
      
    } catch (error) {
      await this.handleWorkItemError(event, error);
    }
  }
}
```

### Event Sourcing Implementation

#### Session State Management

Transform session management from direct state updates to event sourcing:

```typescript
// Event Store Interface
interface EventStore {
  appendEvents(streamId: string, events: DomainEvent[]): Promise<void>;
  getEvents(streamId: string, fromVersion?: number): Promise<DomainEvent[]>;
  createSnapshot(streamId: string, snapshot: any, version: number): Promise<void>;
  getSnapshot(streamId: string): Promise<{ snapshot: any; version: number } | null>;
}

// Session Aggregate
class SessionAggregate {
  private id: string;
  private version: number = 0;
  private state: SessionState;
  private uncommittedEvents: DomainEvent[] = [];

  constructor(id: string) {
    this.id = id;
    this.state = new SessionState();
  }

  // Command: Start Session
  startSession(userId: string, taskDescription: string): void {
    const event: DomainEvent = {
      eventId: uuidv4(),
      eventType: 'SessionStarted',
      aggregateId: this.id,
      aggregateType: 'Session',
      eventData: {
        userId,
        taskDescription,
        startTime: new Date()
      },
      metadata: {
        timestamp: new Date(),
        version: '1.0',
        correlationId: uuidv4()
      }
    };

    this.apply(event);
    this.uncommittedEvents.push(event);
  }

  // Command: Assign Task to Agent
  assignTaskToAgent(taskId: string, agentType: 'manager' | 'worker'): void {
    if (!this.state.isActive) {
      throw new Error('Cannot assign task to inactive session');
    }

    const event: DomainEvent = {
      eventId: uuidv4(),
      eventType: 'TaskAssignedToAgent',
      aggregateId: this.id,
      aggregateType: 'Session',
      eventData: {
        taskId,
        agentType,
        assignedAt: new Date()
      },
      metadata: {
        timestamp: new Date(),
        version: '1.0',
        correlationId: this.state.correlationId
      }
    };

    this.apply(event);
    this.uncommittedEvents.push(event);
  }

  // Event Application
  private apply(event: DomainEvent): void {
    switch (event.eventType) {
      case 'SessionStarted':
        this.state.isActive = true;
        this.state.userId = event.eventData.userId;
        this.state.startTime = event.eventData.startTime;
        this.state.correlationId = event.metadata.correlationId;
        break;

      case 'TaskAssignedToAgent':
        this.state.activeTasks.push({
          taskId: event.eventData.taskId,
          agentType: event.eventData.agentType,
          status: 'assigned'
        });
        break;

      case 'WorkItemCompleted':
        const taskIndex = this.state.activeTasks.findIndex(
          t => t.taskId === event.eventData.taskId
        );
        if (taskIndex >= 0) {
          this.state.activeTasks[taskIndex].status = 'completed';
        }
        break;

      case 'SessionCompleted':
        this.state.isActive = false;
        this.state.endTime = event.eventData.endTime;
        break;
    }

    this.version++;
  }

  // Replay events to rebuild state
  static async fromHistory(id: string, events: DomainEvent[]): Promise<SessionAggregate> {
    const aggregate = new SessionAggregate(id);
    
    for (const event of events) {
      aggregate.apply(event);
    }
    
    return aggregate;
  }

  getUncommittedEvents(): DomainEvent[] {
    return [...this.uncommittedEvents];
  }

  clearUncommittedEvents(): void {
    this.uncommittedEvents = [];
  }
}

// Session Repository
class SessionRepository {
  constructor(
    private eventStore: EventStore,
    private eventPublisher: EventPublisher
  ) {}

  async save(session: SessionAggregate): Promise<void> {
    const events = session.getUncommittedEvents();
    
    if (events.length === 0) {
      return;
    }

    // Persist events
    await this.eventStore.appendEvents(session.getId(), events);

    // Publish events to Kafka
    for (const event of events) {
      await this.eventPublisher.publishEvent(event);
    }

    session.clearUncommittedEvents();
  }

  async getById(id: string): Promise<SessionAggregate | null> {
    try {
      // Try to load from snapshot first
      const snapshot = await this.eventStore.getSnapshot(id);
      let events: DomainEvent[];
      
      if (snapshot) {
        // Load events since snapshot
        events = await this.eventStore.getEvents(id, snapshot.version);
      } else {
        // Load all events
        events = await this.eventStore.getEvents(id);
      }

      if (events.length === 0 && !snapshot) {
        return null;
      }

      return SessionAggregate.fromHistory(id, events);
      
    } catch (error) {
      throw new Error(`Failed to load session ${id}: ${error.message}`);
    }
  }
}
```

### CQRS Pattern Implementation

Separate read and write operations for better scalability and performance:

```typescript
// Command Side - Write Model
interface Command {
  id: string;
  type: string;
  aggregateId: string;
  payload: any;
  metadata: {
    userId?: string;
    correlationId: string;
    timestamp: Date;
  };
}

class CommandHandler {
  constructor(
    private repository: SessionRepository,
    private validator: CommandValidator
  ) {}

  async handle(command: Command): Promise<void> {
    // Validate command
    await this.validator.validate(command);

    // Load aggregate
    let session = await this.repository.getById(command.aggregateId);
    
    if (!session && this.isCreateCommand(command)) {
      session = new SessionAggregate(command.aggregateId);
    }

    if (!session) {
      throw new Error(`Session ${command.aggregateId} not found`);
    }

    // Execute command
    switch (command.type) {
      case 'StartSession':
        session.startSession(command.payload.userId, command.payload.taskDescription);
        break;
      case 'AssignTaskToAgent':
        session.assignTaskToAgent(command.payload.taskId, command.payload.agentType);
        break;
      default:
        throw new Error(`Unknown command type: ${command.type}`);
    }

    // Save aggregate
    await this.repository.save(session);
  }
}

// Query Side - Read Model
interface SessionReadModel {
  sessionId: string;
  userId: string;
  status: string;
  startTime: Date;
  endTime?: Date;
  activeTasks: TaskSummary[];
  totalTasks: number;
  completedTasks: number;
  estimatedCompletion?: Date;
}

class SessionProjectionHandler {
  constructor(private queryStore: QueryStore) {}

  @EventHandler('SessionStarted')
  async handleSessionStarted(event: DomainEvent): Promise<void> {
    const sessionReadModel: SessionReadModel = {
      sessionId: event.aggregateId,
      userId: event.eventData.userId,
      status: 'active',
      startTime: event.eventData.startTime,
      activeTasks: [],
      totalTasks: 0,
      completedTasks: 0
    };

    await this.queryStore.saveSessionReadModel(sessionReadModel);
  }

  @EventHandler('TaskAssignedToAgent')
  async handleTaskAssignedToAgent(event: DomainEvent): Promise<void> {
    const sessionReadModel = await this.queryStore.getSessionReadModel(event.aggregateId);
    
    if (sessionReadModel) {
      sessionReadModel.activeTasks.push({
        taskId: event.eventData.taskId,
        agentType: event.eventData.agentType,
        status: 'assigned',
        assignedAt: event.eventData.assignedAt
      });
      sessionReadModel.totalTasks++;

      await this.queryStore.saveSessionReadModel(sessionReadModel);
    }
  }

  @EventHandler('WorkItemCompleted')
  async handleWorkItemCompleted(event: DomainEvent): Promise<void> {
    const sessionReadModel = await this.queryStore.getSessionReadModel(event.aggregateId);
    
    if (sessionReadModel) {
      const task = sessionReadModel.activeTasks.find(t => t.taskId === event.eventData.taskId);
      if (task) {
        task.status = 'completed';
        task.completedAt = event.eventData.completedAt;
      }
      
      sessionReadModel.completedTasks++;
      sessionReadModel.estimatedCompletion = this.calculateEstimatedCompletion(sessionReadModel);

      await this.queryStore.saveSessionReadModel(sessionReadModel);
    }
  }
}

// Query Service
class SessionQueryService {
  constructor(private queryStore: QueryStore) {}

  async getSession(sessionId: string): Promise<SessionReadModel | null> {
    return this.queryStore.getSessionReadModel(sessionId);
  }

  async getActiveSessions(userId?: string): Promise<SessionReadModel[]> {
    return this.queryStore.getActiveSessionsForUser(userId);
  }

  async getSessionsByDateRange(startDate: Date, endDate: Date): Promise<SessionReadModel[]> {
    return this.queryStore.getSessionsByDateRange(startDate, endDate);
  }
}
```

## Message Schema Design and Evolution

### Schema Registry Integration

```typescript
// Schema Definition
interface EventSchema {
  type: 'record';
  name: string;
  namespace: string;
  fields: SchemaField[];
}

interface SchemaField {
  name: string;
  type: string | string[] | ComplexType;
  default?: any;
  doc?: string;
}

// Schema Registry Client
class SchemaRegistryClient {
  constructor(private baseUrl: string, private apiKey: string) {}

  async registerSchema(subject: string, schema: EventSchema): Promise<number> {
    const response = await fetch(`${this.baseUrl}/subjects/${subject}/versions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/vnd.schemaregistry.v1+json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({ schema: JSON.stringify(schema) })
    });

    const result = await response.json();
    return result.id;
  }

  async getLatestSchema(subject: string): Promise<EventSchema> {
    const response = await fetch(`${this.baseUrl}/subjects/${subject}/versions/latest`);
    const result = await response.json();
    return JSON.parse(result.schema);
  }

  async checkCompatibility(subject: string, schema: EventSchema): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/compatibility/subjects/${subject}/versions/latest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/vnd.schemaregistry.v1+json'
      },
      body: JSON.stringify({ schema: JSON.stringify(schema) })
    });

    const result = await response.json();
    return result.is_compatible;
  }
}

// Schema Evolution Example
const taskEventSchemaV1: EventSchema = {
  type: 'record',
  name: 'TaskEvent',
  namespace: 'com.company.events',
  fields: [
    { name: 'eventId', type: 'string' },
    { name: 'taskId', type: 'string' },
    { name: 'userId', type: 'string' },
    { name: 'description', type: 'string' },
    { name: 'priority', type: ['null', 'string'], default: null },
    { name: 'timestamp', type: 'long' }
  ]
};

// Evolved schema with new fields
const taskEventSchemaV2: EventSchema = {
  type: 'record',
  name: 'TaskEvent',
  namespace: 'com.company.events',
  fields: [
    { name: 'eventId', type: 'string' },
    { name: 'taskId', type: 'string' },
    { name: 'userId', type: 'string' },
    { name: 'description', type: 'string' },
    { name: 'priority', type: ['null', 'string'], default: null },
    { name: 'timestamp', type: 'long' },
    // New fields with defaults for backward compatibility
    { name: 'estimatedDuration', type: ['null', 'int'], default: null },
    { name: 'tags', type: { type: 'array', items: 'string' }, default: [] },
    { name: 'metadata', type: ['null', 'string'], default: null }
  ]
};

// Schema Evolution Manager
class SchemaEvolutionManager {
  constructor(private schemaRegistry: SchemaRegistryClient) {}

  async evolveSchema(subject: string, newSchema: EventSchema): Promise<void> {
    // Check backward compatibility
    const isCompatible = await this.schemaRegistry.checkCompatibility(subject, newSchema);
    
    if (!isCompatible) {
      throw new Error(`Schema evolution would break backward compatibility for ${subject}`);
    }

    // Register new schema version
    const schemaId = await this.schemaRegistry.registerSchema(subject, newSchema);
    console.log(`Registered new schema version ${schemaId} for ${subject}`);

    // Update event serializers to use new schema
    await this.updateSerializers(subject, newSchema);
  }

  private async updateSerializers(subject: string, schema: EventSchema): Promise<void> {
    // Implementation would update application serializers
    // to handle the new schema version
  }
}
```

### Schema Validation

```typescript
class EventSchemaValidator {
  private schemas: Map<string, EventSchema> = new Map();

  constructor(private schemaRegistry: SchemaRegistryClient) {}

  async loadSchema(eventType: string): Promise<void> {
    const subject = `${eventType}-value`;
    const schema = await this.schemaRegistry.getLatestSchema(subject);
    this.schemas.set(eventType, schema);
  }

  async validateEvent(event: DomainEvent): Promise<void> {
    let schema = this.schemas.get(event.eventType);
    
    if (!schema) {
      await this.loadSchema(event.eventType);
      schema = this.schemas.get(event.eventType);
    }

    if (!schema) {
      throw new Error(`Schema not found for event type: ${event.eventType}`);
    }

    // Validate event data against schema
    const isValid = this.validateAgainstSchema(event.eventData, schema);
    
    if (!isValid) {
      throw new Error(`Event data does not match schema for event type: ${event.eventType}`);
    }
  }

  private validateAgainstSchema(data: any, schema: EventSchema): boolean {
    // Implementation would validate the data structure
    // against the Avro schema fields
    for (const field of schema.fields) {
      if (!this.validateField(data[field.name], field)) {
        return false;
      }
    }
    return true;
  }

  private validateField(value: any, field: SchemaField): boolean {
    // Handle null values
    if (value === null || value === undefined) {
      return Array.isArray(field.type) && field.type.includes('null');
    }

    // Handle union types
    if (Array.isArray(field.type)) {
      return field.type.some(type => this.validateType(value, type));
    }

    return this.validateType(value, field.type);
  }

  private validateType(value: any, type: string | ComplexType): boolean {
    if (typeof type === 'string') {
      switch (type) {
        case 'string': return typeof value === 'string';
        case 'int':
        case 'long': return typeof value === 'number' && Number.isInteger(value);
        case 'float':
        case 'double': return typeof value === 'number';
        case 'boolean': return typeof value === 'boolean';
        default: return false;
      }
    }

    // Handle complex types (arrays, records, etc.)
    return this.validateComplexType(value, type as ComplexType);
  }
}
```

## Consumer Group Management and Scaling

### Dynamic Consumer Scaling

```typescript
interface ConsumerGroupConfig {
  groupId: string;
  topics: string[];
  partitionAssignmentStrategy: 'roundrobin' | 'range' | 'sticky';
  maxPollRecords: number;
  sessionTimeout: number;
  autoCommit: boolean;
  offsetRetention: number;
}

class DynamicConsumerGroup {
  private consumers: Map<string, Consumer> = new Map();
  private isRunning = false;
  private metrics: ConsumerGroupMetrics;

  constructor(
    private config: ConsumerGroupConfig,
    private kafka: Kafka,
    private metricsCollector: MetricsCollector
  ) {
    this.metrics = new ConsumerGroupMetrics(config.groupId);
  }

  async start(initialConsumerCount: number = 1): Promise<void> {
    this.isRunning = true;

    // Start initial consumers
    for (let i = 0; i < initialConsumerCount; i++) {
      await this.addConsumer();
    }

    // Start metrics collection and auto-scaling
    this.startMetricsCollection();
    this.startAutoScaling();
  }

  async addConsumer(): Promise<string> {
    const consumerId = `${this.config.groupId}-consumer-${Date.now()}`;
    
    const consumer = this.kafka.consumer({
      groupId: this.config.groupId,
      sessionTimeout: this.config.sessionTimeout,
      maxPollRecords: this.config.maxPollRecords
    });

    await consumer.connect();
    await consumer.subscribe({ 
      topics: this.config.topics,
      fromBeginning: false 
    });

    await consumer.run({
      autoCommit: this.config.autoCommit,
      eachMessage: async ({ topic, partition, message }) => {
        const startTime = Date.now();
        
        try {
          await this.processMessage(topic, partition, message);
          
          // Track successful processing
          const processingTime = Date.now() - startTime;
          this.metrics.recordMessageProcessed(topic, processingTime);
          
        } catch (error) {
          this.metrics.recordMessageError(topic, error);
          await this.handleMessageError(topic, partition, message, error);
        }
      }
    });

    this.consumers.set(consumerId, consumer);
    console.log(`Added consumer: ${consumerId}`);
    
    return consumerId;
  }

  async removeConsumer(consumerId: string): Promise<void> {
    const consumer = this.consumers.get(consumerId);
    
    if (consumer) {
      await consumer.disconnect();
      this.consumers.delete(consumerId);
      console.log(`Removed consumer: ${consumerId}`);
    }
  }

  private startAutoScaling(): void {
    setInterval(async () => {
      if (!this.isRunning) return;

      const shouldScale = await this.evaluateScaling();
      
      if (shouldScale.scaleUp) {
        const newConsumerCount = Math.min(
          this.consumers.size + shouldScale.scaleUpBy,
          this.getMaxConsumersForTopics()
        );
        
        for (let i = this.consumers.size; i < newConsumerCount; i++) {
          await this.addConsumer();
        }
      } else if (shouldScale.scaleDown) {
        const targetCount = Math.max(
          this.consumers.size - shouldScale.scaleDownBy,
          1 // Always keep at least one consumer
        );
        
        const consumersToRemove = Array.from(this.consumers.keys())
          .slice(targetCount);
        
        for (const consumerId of consumersToRemove) {
          await this.removeConsumer(consumerId);
        }
      }
    }, 60000); // Check every minute
  }

  private async evaluateScaling(): Promise<ScalingDecision> {
    const lag = await this.getConsumerGroupLag();
    const processingRate = this.metrics.getProcessingRate();
    const errorRate = this.metrics.getErrorRate();

    // Scale up conditions
    if (lag > 10000 && errorRate < 0.05) {
      return { scaleUp: true, scaleUpBy: 2 };
    }
    
    if (lag > 50000) {
      return { scaleUp: true, scaleUpBy: 3 };
    }

    // Scale down conditions
    if (lag < 1000 && this.consumers.size > 1 && processingRate < 0.5) {
      return { scaleDown: true, scaleDownBy: 1 };
    }

    return { scaleUp: false, scaleDown: false };
  }

  private getMaxConsumersForTopics(): number {
    // Maximum consumers = total partitions across all subscribed topics
    // This is a simplified calculation - in practice, you'd query Kafka metadata
    return this.config.topics.length * 12; // Assuming 12 partitions per topic
  }

  async getConsumerGroupLag(): Promise<number> {
    const admin = this.kafka.admin();
    await admin.connect();
    
    try {
      const groupDescription = await admin.describeGroups([this.config.groupId]);
      // Calculate total lag across all partitions
      // Implementation would query Kafka for actual lag metrics
      return 0; // Placeholder
    } finally {
      await admin.disconnect();
    }
  }
}
```

### Consumer Error Handling and Dead Letter Queues

```typescript
class ConsumerErrorHandler {
  constructor(
    private deadLetterProducer: Producer,
    private retryPolicy: RetryPolicy,
    private alertManager: AlertManager
  ) {}

  async handleMessageError(
    topic: string,
    partition: number,
    message: KafkaMessage,
    error: Error
  ): Promise<void> {
    const errorContext = {
      topic,
      partition,
      offset: message.offset,
      key: message.key?.toString(),
      error: error.message,
      timestamp: new Date(),
      retryCount: this.getRetryCount(message) || 0
    };

    // Determine if error is retryable
    if (this.isRetryableError(error) && errorContext.retryCount < this.retryPolicy.maxRetries) {
      await this.scheduleRetry(topic, message, errorContext);
    } else {
      await this.sendToDeadLetterQueue(topic, message, errorContext);
    }

    // Alert on high error rates
    const errorRate = await this.calculateErrorRate(topic);
    if (errorRate > 0.1) { // 10% error rate threshold
      await this.alertManager.sendAlert({
        severity: 'HIGH',
        message: `High error rate detected for topic ${topic}: ${errorRate * 100}%`,
        context: errorContext
      });
    }
  }

  private isRetryableError(error: Error): boolean {
    const retryableErrors = [
      'NETWORK_EXCEPTION',
      'REQUEST_TIMEOUT',
      'RETRIABLE_EXCEPTION',
      'UNKNOWN_SERVER_ERROR'
    ];

    return retryableErrors.some(retryableError => 
      error.message.includes(retryableError) ||
      error.name.includes(retryableError)
    );
  }

  private async scheduleRetry(
    topic: string,
    message: KafkaMessage,
    errorContext: any
  ): Promise<void> {
    const retryTopic = `${topic}.retry`;
    const delay = this.calculateRetryDelay(errorContext.retryCount);

    await this.deadLetterProducer.send({
      topic: retryTopic,
      messages: [{
        key: message.key,
        value: message.value,
        headers: {
          ...message.headers,
          'retry-count': (errorContext.retryCount + 1).toString(),
          'original-topic': topic,
          'error-message': errorContext.error,
          'retry-at': (Date.now() + delay).toString()
        }
      }]
    });
  }

  private async sendToDeadLetterQueue(
    topic: string,
    message: KafkaMessage,
    errorContext: any
  ): Promise<void> {
    const dlqTopic = `${topic}.dlq`;

    await this.deadLetterProducer.send({
      topic: dlqTopic,
      messages: [{
        key: message.key,
        value: message.value,
        headers: {
          ...message.headers,
          'original-topic': topic,
          'error-message': errorContext.error,
          'final-retry-count': errorContext.retryCount.toString(),
          'dlq-timestamp': Date.now().toString()
        }
      }]
    });

    // Log dead letter for monitoring
    console.error('Message sent to dead letter queue', {
      topic: dlqTopic,
      originalTopic: topic,
      error: errorContext.error,
      retryCount: errorContext.retryCount
    });
  }

  private calculateRetryDelay(retryCount: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    return Math.min(1000 * Math.pow(2, retryCount), 60000); // Max 1 minute
  }
}

// Retry Consumer for processing retry topics
class RetryConsumer {
  constructor(
    private kafka: Kafka,
    private originalConsumer: DynamicConsumerGroup
  ) {}

  async start(): Promise<void> {
    const consumer = this.kafka.consumer({
      groupId: 'retry-processor',
      sessionTimeout: 30000
    });

    await consumer.connect();
    await consumer.subscribe({ 
      topics: ['*.retry'], // Subscribe to all retry topics
      fromBeginning: false 
    });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const retryAt = parseInt(message.headers?.['retry-at']?.toString() || '0');
        const now = Date.now();

        // Check if it's time to retry
        if (retryAt > now) {
          // Not yet time to retry, skip this message
          return;
        }

        // Extract original topic and forward message
        const originalTopic = message.headers?.['original-topic']?.toString();
        if (originalTopic) {
          await this.forwardToOriginalTopic(originalTopic, message);
        }
      }
    });
  }

  private async forwardToOriginalTopic(topic: string, message: KafkaMessage): Promise<void> {
    // Remove retry-specific headers
    const cleanHeaders = { ...message.headers };
    delete cleanHeaders['retry-at'];
    delete cleanHeaders['original-topic'];

    // Forward message back to original topic for reprocessing
    const producer = this.kafka.producer();
    await producer.connect();

    try {
      await producer.send({
        topic,
        messages: [{
          key: message.key,
          value: message.value,
          headers: cleanHeaders
        }]
      });
    } finally {
      await producer.disconnect();
    }
  }
}
```

## Performance Optimization Patterns

### Batch Processing

```typescript
class BatchProcessor<T> {
  private batch: T[] = [];
  private batchTimer?: NodeJS.Timeout;

  constructor(
    private batchSize: number,
    private batchTimeout: number,
    private processBatch: (items: T[]) => Promise<void>
  ) {}

  async addItem(item: T): Promise<void> {
    this.batch.push(item);

    // Start batch timer if this is the first item
    if (this.batch.length === 1) {
      this.startBatchTimer();
    }

    // Process batch if it reaches the size limit
    if (this.batch.length >= this.batchSize) {
      await this.flushBatch();
    }
  }

  private startBatchTimer(): void {
    this.batchTimer = setTimeout(async () => {
      await this.flushBatch();
    }, this.batchTimeout);
  }

  private async flushBatch(): Promise<void> {
    if (this.batch.length === 0) return;

    // Clear timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }

    // Process current batch
    const currentBatch = [...this.batch];
    this.batch = [];

    try {
      await this.processBatch(currentBatch);
    } catch (error) {
      // Handle batch processing error
      console.error('Batch processing failed', error);
      
      // Consider retry logic or dead letter handling
      await this.handleBatchError(currentBatch, error);
    }
  }

  private async handleBatchError(batch: T[], error: Error): Promise<void> {
    // Implementation could include:
    // - Individual item processing to identify problematic items
    // - Partial retry with exponential backoff
    // - Dead letter queue for failed batches
    console.error('Handling batch error', { batchSize: batch.length, error: error.message });
  }

  async shutdown(): Promise<void> {
    await this.flushBatch();
  }
}

// Usage in event processing
class EventBatchProcessor {
  private batchProcessor: BatchProcessor<DomainEvent>;

  constructor(private eventStore: EventStore) {
    this.batchProcessor = new BatchProcessor(
      100, // batch size
      5000, // 5 second timeout
      this.processBatch.bind(this)
    );
  }

  async processEvent(event: DomainEvent): Promise<void> {
    await this.batchProcessor.addItem(event);
  }

  private async processBatch(events: DomainEvent[]): Promise<void> {
    // Group events by aggregate
    const eventsByAggregate = this.groupEventsByAggregate(events);

    // Process each aggregate's events
    await Promise.all(
      Object.entries(eventsByAggregate).map(([aggregateId, aggregateEvents]) =>
        this.eventStore.appendEvents(aggregateId, aggregateEvents)
      )
    );
  }

  private groupEventsByAggregate(events: DomainEvent[]): Record<string, DomainEvent[]> {
    return events.reduce((groups, event) => {
      const key = event.aggregateId;
      groups[key] = groups[key] || [];
      groups[key].push(event);
      return groups;
    }, {} as Record<string, DomainEvent[]>);
  }
}
```

### Connection Pooling and Resource Management

```typescript
class KafkaConnectionPool {
  private producers: Producer[] = [];
  private consumers: Consumer[] = [];
  private availableProducers: Producer[] = [];
  private availableConsumers: Consumer[] = [];
  private producerIndex = 0;
  private maxProducers: number;
  private maxConsumers: number;

  constructor(
    private kafka: Kafka,
    options: {
      maxProducers?: number;
      maxConsumers?: number;
      initialProducers?: number;
      initialConsumers?: number;
    } = {}
  ) {
    this.maxProducers = options.maxProducers || 10;
    this.maxConsumers = options.maxConsumers || 10;
  }

  async initialize(): Promise<void> {
    // Create initial producer pool
    for (let i = 0; i < Math.min(3, this.maxProducers); i++) {
      const producer = this.kafka.producer({
        allowAutoTopicCreation: false,
        transactionTimeout: 30000,
        maxInFlightRequests: 1,
        idempotent: true,
        compression: CompressionTypes.gzip
      });

      await producer.connect();
      this.producers.push(producer);
      this.availableProducers.push(producer);
    }

    console.log(`Initialized Kafka connection pool with ${this.producers.length} producers`);
  }

  async getProducer(): Promise<Producer> {
    // Return available producer if exists
    if (this.availableProducers.length > 0) {
      return this.availableProducers.pop()!;
    }

    // Create new producer if under limit
    if (this.producers.length < this.maxProducers) {
      const producer = this.kafka.producer({
        allowAutoTopicCreation: false,
        transactionTimeout: 30000,
        maxInFlightRequests: 1,
        idempotent: true,
        compression: CompressionTypes.gzip
      });

      await producer.connect();
      this.producers.push(producer);
      return producer;
    }

    // Use round-robin for existing producers
    const producer = this.producers[this.producerIndex % this.producers.length];
    this.producerIndex++;
    return producer;
  }

  releaseProducer(producer: Producer): void {
    if (!this.availableProducers.includes(producer)) {
      this.availableProducers.push(producer);
    }
  }

  async createConsumer(groupId: string, topics: string[]): Promise<Consumer> {
    if (this.consumers.length >= this.maxConsumers) {
      throw new Error('Maximum number of consumers reached');
    }

    const consumer = this.kafka.consumer({
      groupId,
      sessionTimeout: 30000,
      rebalanceTimeout: 60000,
      heartbeatInterval: 3000,
      maxBytesPerPartition: 1048576, // 1MB
      maxBytes: 10485760 // 10MB
    });

    await consumer.connect();
    await consumer.subscribe({ topics });
    
    this.consumers.push(consumer);
    return consumer;
  }

  async shutdown(): Promise<void> {
    console.log('Shutting down Kafka connection pool...');

    // Disconnect all producers
    await Promise.all(
      this.producers.map(producer => producer.disconnect())
    );

    // Disconnect all consumers
    await Promise.all(
      this.consumers.map(consumer => consumer.disconnect())
    );

    console.log('Kafka connection pool shut down successfully');
  }
}

// Usage with resource management
class ManagedKafkaService {
  private connectionPool: KafkaConnectionPool;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(kafka: Kafka) {
    this.connectionPool = new KafkaConnectionPool(kafka, {
      maxProducers: 20,
      maxConsumers: 50
    });
  }

  async initialize(): Promise<void> {
    await this.connectionPool.initialize();
    
    // Start periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 300000); // 5 minutes
  }

  async publishEvent(event: DomainEvent): Promise<void> {
    const producer = await this.connectionPool.getProducer();
    
    try {
      const topic = this.getTopicForEvent(event.eventType);
      
      await producer.send({
        topic,
        messages: [{
          key: event.aggregateId,
          value: JSON.stringify(event),
          headers: {
            'event-type': event.eventType,
            'correlation-id': event.metadata.correlationId
          }
        }]
      });
      
    } finally {
      this.connectionPool.releaseProducer(producer);
    }
  }

  private performCleanup(): void {
    // Implement cleanup logic:
    // - Close idle connections
    // - Reset connection metrics
    // - Log connection pool statistics
    console.log('Performing connection pool cleanup...');
  }

  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    await this.connectionPool.shutdown();
  }
}
```

## Testing Strategies

### Unit Testing Event Handlers

```typescript
// Test utilities
class TestEventBuilder {
  static createTaskAssignedEvent(overrides: Partial<DomainEvent> = {}): DomainEvent {
    return {
      eventId: uuidv4(),
      eventType: 'TaskAssigned',
      aggregateId: 'test-task-123',
      aggregateType: 'Task',
      eventData: {
        taskId: 'test-task-123',
        userId: 'test-user-456',
        description: 'Test task description',
        priority: 'high'
      },
      metadata: {
        timestamp: new Date(),
        version: '1.0',
        correlationId: uuidv4()
      },
      ...overrides
    };
  }

  static createWorkItemCompletedEvent(overrides: Partial<DomainEvent> = {}): DomainEvent {
    return {
      eventId: uuidv4(),
      eventType: 'WorkItemCompleted',
      aggregateId: 'test-workitem-789',
      aggregateType: 'WorkItem',
      eventData: {
        workItemId: 'test-workitem-789',
        taskId: 'test-task-123',
        result: { success: true, output: 'Task completed successfully' },
        completedAt: new Date(),
        executionTime: 5000
      },
      metadata: {
        timestamp: new Date(),
        version: '1.0',
        correlationId: uuidv4()
      },
      ...overrides
    };
  }
}

// Mock event publisher for testing
class MockEventPublisher extends EventPublisher {
  public publishedEvents: DomainEvent[] = [];

  async publishEvent(event: DomainEvent): Promise<void> {
    this.publishedEvents.push(event);
  }

  protected getTopicForEvent(eventType: string): string {
    return `test.${eventType.toLowerCase()}`;
  }

  protected async validateEventSchema(event: DomainEvent): Promise<void> {
    // Mock validation - always passes in tests
  }

  getPublishedEvents(eventType?: string): DomainEvent[] {
    if (eventType) {
      return this.publishedEvents.filter(e => e.eventType === eventType);
    }
    return [...this.publishedEvents];
  }

  clear(): void {
    this.publishedEvents = [];
  }
}

// Unit test example
describe('ManagerAgentHandler', () => {
  let handler: ManagerAgentHandler;
  let mockEventPublisher: MockEventPublisher;
  let mockClaudeSDK: jest.Mocked<ClaudeSDK>;

  beforeEach(() => {
    mockEventPublisher = new MockEventPublisher(null as any, null as any);
    mockClaudeSDK = {
      analyzeTask: jest.fn(),
      executeWithSDK: jest.fn()
    } as any;

    handler = new ManagerAgentHandler(mockEventPublisher, mockClaudeSDK);
  });

  afterEach(() => {
    mockEventPublisher.clear();
    jest.clearAllMocks();
  });

  describe('handleTaskAssigned', () => {
    it('should analyze task and create work items', async () => {
      // Arrange
      const taskEvent = TestEventBuilder.createTaskAssignedEvent();
      const mockAnalysis = {
        workItems: [
          { id: 'wi-1', description: 'Work item 1', type: 'implementation' },
          { id: 'wi-2', description: 'Work item 2', type: 'testing' }
        ],
        estimatedDuration: 3600
      };

      mockClaudeSDK.analyzeTask.mockResolvedValue(mockAnalysis);

      // Act
      await handler.handleTaskAssigned(taskEvent);

      // Assert
      expect(mockClaudeSDK.analyzeTask).toHaveBeenCalledWith(taskEvent.eventData);

      const workItemEvents = mockEventPublisher.getPublishedEvents('WorkItemCreated');
      expect(workItemEvents).toHaveLength(2);

      const statusUpdateEvents = mockEventPublisher.getPublishedEvents('TaskStatusUpdated');
      expect(statusUpdateEvents).toHaveLength(1);
      expect(statusUpdateEvents[0].eventData.status).toBe('ANALYZED');
    });

    it('should handle analysis errors gracefully', async () => {
      // Arrange
      const taskEvent = TestEventBuilder.createTaskAssignedEvent();
      const analysisError = new Error('Claude SDK analysis failed');

      mockClaudeSDK.analyzeTask.mockRejectedValue(analysisError);

      // Act & Assert
      await expect(handler.handleTaskAssigned(taskEvent)).rejects.toThrow('Claude SDK analysis failed');

      // Verify error handling events were published
      const errorEvents = mockEventPublisher.getPublishedEvents('TaskErrorOccurred');
      expect(errorEvents).toHaveLength(1);
    });
  });
});
```

### Integration Testing with Test Containers

```typescript
// Integration test setup
class KafkaTestContainer {
  private container: StartedTestContainer;
  private kafka: Kafka;

  async start(): Promise<void> {
    // Start Kafka container
    this.container = await new GenericContainer('confluentinc/cp-kafka:latest')
      .withEnvironment({
        'KAFKA_BROKER_ID': '1',
        'KAFKA_ZOOKEEPER_CONNECT': 'localhost:2181',
        'KAFKA_LISTENERS': 'PLAINTEXT://0.0.0.0:9092',
        'KAFKA_ADVERTISED_LISTENERS': 'PLAINTEXT://localhost:9092',
        'KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR': '1'
      })
      .withExposedPorts(9092)
      .start();

    // Initialize Kafka client
    const kafkaPort = this.container.getMappedPort(9092);
    this.kafka = new Kafka({
      clientId: 'test-client',
      brokers: [`localhost:${kafkaPort}`]
    });
  }

  async stop(): Promise<void> {
    if (this.container) {
      await this.container.stop();
    }
  }

  getKafka(): Kafka {
    return this.kafka;
  }

  async createTopic(topic: string, partitions: number = 1): Promise<void> {
    const admin = this.kafka.admin();
    await admin.connect();
    
    try {
      await admin.createTopics({
        topics: [{
          topic,
          numPartitions: partitions,
          replicationFactor: 1
        }]
      });
    } finally {
      await admin.disconnect();
    }
  }
}

// Integration test example
describe('Agent Coordination Integration', () => {
  let kafkaContainer: KafkaTestContainer;
  let coordinator: EventDrivenAgentCoordinator;
  let managerHandler: ManagerAgentHandler;
  let workerHandler: WorkerAgentHandler;

  beforeAll(async () => {
    kafkaContainer = new KafkaTestContainer();
    await kafkaContainer.start();

    // Create test topics
    await kafkaContainer.createTopic('agent.tasks.manager', 3);
    await kafkaContainer.createTopic('agent.tasks.worker', 3);
    await kafkaContainer.createTopic('session.events', 3);
  }, 60000); // 60 second timeout for container startup

  afterAll(async () => {
    if (kafkaContainer) {
      await kafkaContainer.stop();
    }
  });

  beforeEach(async () => {
    const kafka = kafkaContainer.getKafka();
    
    // Set up coordinator and handlers
    const eventPublisher = new KafkaEventPublisher(kafka.producer());
    coordinator = new EventDrivenAgentCoordinator(eventPublisher);
    
    const mockClaudeSDK = new MockClaudeSDK();
    managerHandler = new ManagerAgentHandler(eventPublisher, mockClaudeSDK);
    workerHandler = new WorkerAgentHandler(eventPublisher, mockClaudeSDK);

    // Set up consumers
    await this.setupEventConsumers(kafka);
  });

  it('should complete full agent coordination workflow', async () => {
    // Arrange
    const task: UserTask = {
      id: 'integration-test-task',
      description: 'Implement user authentication system',
      priority: 'high',
      sessionId: 'test-session-123',
      userId: 'test-user'
    };

    // Act - Start coordination
    const correlationId = await coordinator.coordinateTask(task);

    // Wait for workflow completion
    await this.waitForWorkflowCompletion(correlationId, 30000);

    // Assert - Verify workflow completed successfully
    const sessionEvents = await this.getSessionEvents(task.sessionId);
    
    expect(sessionEvents).toContainEqual(
      expect.objectContaining({
        eventType: 'TaskAssigned',
        aggregateId: task.id
      })
    );

    expect(sessionEvents).toContainEqual(
      expect.objectContaining({
        eventType: 'TaskStatusUpdated',
        eventData: expect.objectContaining({
          status: 'COMPLETED'
        })
      })
    );

    // Verify work items were created and completed
    const workItemEvents = sessionEvents.filter(e => 
      e.eventType === 'WorkItemCreated' || e.eventType === 'WorkItemCompleted'
    );
    
    expect(workItemEvents.length).toBeGreaterThan(0);
  }, 45000);

  private async setupEventConsumers(kafka: Kafka): Promise<void> {
    // Set up manager agent consumer
    const managerConsumer = kafka.consumer({ groupId: 'test-manager-agent' });
    await managerConsumer.connect();
    await managerConsumer.subscribe({ topics: ['agent.tasks.manager'] });
    
    await managerConsumer.run({
      eachMessage: async ({ message }) => {
        const event = JSON.parse(message.value!.toString()) as DomainEvent;
        if (event.eventType === 'TaskAssigned') {
          await managerHandler.handleTaskAssigned(event);
        }
      }
    });

    // Set up worker agent consumer
    const workerConsumer = kafka.consumer({ groupId: 'test-worker-agent' });
    await workerConsumer.connect();
    await workerConsumer.subscribe({ topics: ['agent.tasks.worker'] });
    
    await workerConsumer.run({
      eachMessage: async ({ message }) => {
        const event = JSON.parse(message.value!.toString()) as DomainEvent;
        if (event.eventType === 'WorkItemCreated') {
          await workerHandler.handleWorkItemCreated(event);
        }
      }
    });
  }

  private async waitForWorkflowCompletion(correlationId: string, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkCompletion = async () => {
        try {
          const isComplete = await this.checkWorkflowCompletion(correlationId);
          
          if (isComplete) {
            resolve();
            return;
          }

          if (Date.now() - startTime > timeout) {
            reject(new Error('Workflow completion timeout'));
            return;
          }

          setTimeout(checkCompletion, 1000); // Check every second
        } catch (error) {
          reject(error);
        }
      };

      checkCompletion();
    });
  }

  private async checkWorkflowCompletion(correlationId: string): Promise<boolean> {
    // Implementation would check for completion events with matching correlation ID
    const sessionEvents = await this.getEventsByCorrelationId(correlationId);
    return sessionEvents.some(e => 
      e.eventType === 'TaskStatusUpdated' && 
      e.eventData.status === 'COMPLETED'
    );
  }
});
```

## Security Best Practices

### Authentication and Authorization

```typescript
// SASL/SCRAM Authentication
class SecureKafkaClient {
  private kafka: Kafka;

  constructor(config: SecureKafkaConfig) {
    this.kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
      ssl: {
        rejectUnauthorized: true,
        ca: [fs.readFileSync(config.ssl.caPath, 'utf-8')],
        key: fs.readFileSync(config.ssl.keyPath, 'utf-8'),
        cert: fs.readFileSync(config.ssl.certPath, 'utf-8')
      },
      sasl: {
        mechanism: 'scram-sha-512',
        username: config.sasl.username,
        password: config.sasl.password
      },
      connectionTimeout: 3000,
      authenticationTimeout: 1000,
      reauthenticationThreshold: 10000
    });
  }

  async createSecureProducer(permissions: ProducerPermissions): Promise<Producer> {
    const producer = this.kafka.producer({
      allowAutoTopicCreation: false,
      transactionTimeout: 30000,
      idempotent: true
    });

    // Validate permissions before connecting
    await this.validateProducerPermissions(permissions);
    
    await producer.connect();
    return producer;
  }

  async createSecureConsumer(
    groupId: string, 
    permissions: ConsumerPermissions
  ): Promise<Consumer> {
    const consumer = this.kafka.consumer({
      groupId,
      sessionTimeout: 30000
    });

    // Validate permissions before connecting
    await this.validateConsumerPermissions(permissions);
    
    await consumer.connect();
    return consumer;
  }

  private async validateProducerPermissions(permissions: ProducerPermissions): Promise<void> {
    const admin = this.kafka.admin();
    await admin.connect();
    
    try {
      // Check topic write permissions
      for (const topic of permissions.allowedTopics) {
        const hasPermission = await this.checkTopicPermission(admin, topic, 'WRITE');
        if (!hasPermission) {
          throw new Error(`No write permission for topic: ${topic}`);
        }
      }
    } finally {
      await admin.disconnect();
    }
  }

  private async checkTopicPermission(
    admin: Admin, 
    topic: string, 
    operation: 'READ' | 'WRITE'
  ): Promise<boolean> {
    // Implementation would check ACLs
    // This is a simplified version
    try {
      const metadata = await admin.fetchTopicMetadata({ topics: [topic] });
      return metadata.topics.length > 0;
    } catch (error) {
      return false;
    }
  }
}
```

### Message Encryption

```typescript
class MessageEncryption {
  constructor(
    private encryptionKey: Buffer,
    private algorithm: string = 'aes-256-gcm'
  ) {}

  async encryptMessage(message: any): Promise<EncryptedMessage> {
    const plaintext = JSON.stringify(message);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, this.encryptionKey);
    
    cipher.setAAD(Buffer.from('kafka-message'));
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();

    return {
      data: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      algorithm: this.algorithm
    };
  }

  async decryptMessage(encryptedMessage: EncryptedMessage): Promise<any> {
    const decipher = crypto.createDecipher(
      encryptedMessage.algorithm, 
      this.encryptionKey
    );
    
    decipher.setAAD(Buffer.from('kafka-message'));
    decipher.setAuthTag(Buffer.from(encryptedMessage.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedMessage.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }
}

// Secure Event Publisher
class SecureEventPublisher extends EventPublisher {
  constructor(
    producer: Producer,
    schemaRegistry: SchemaRegistry,
    private encryption: MessageEncryption,
    private sensitiveFields: string[] = ['userId', 'email', 'phone']
  ) {
    super(producer, schemaRegistry);
  }

  async publishEvent(event: DomainEvent): Promise<void> {
    // Encrypt sensitive data
    const secureEvent = await this.encryptSensitiveData(event);
    
    // Call parent implementation
    await super.publishEvent(secureEvent);
  }

  private async encryptSensitiveData(event: DomainEvent): Promise<DomainEvent> {
    const eventCopy = { ...event };
    
    // Encrypt sensitive fields in event data
    for (const field of this.sensitiveFields) {
      if (eventCopy.eventData[field]) {
        const encrypted = await this.encryption.encryptMessage(eventCopy.eventData[field]);
        eventCopy.eventData[field] = encrypted;
        eventCopy.eventData[`${field}_encrypted`] = true;
      }
    }

    return eventCopy;
  }
}
```

This comprehensive developer implementation guide provides the foundation for successful event-driven development during the Kafka migration. It includes practical patterns, code examples, and best practices that enable the 15 FTE team to build scalable, maintainable applications while supporting the Sprint 1 objectives and long-term operational excellence.