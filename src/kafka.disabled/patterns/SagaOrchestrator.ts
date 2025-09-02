import { v4 as uuidv4 } from 'uuid';
import { KafkaProducerClient } from '../producer/KafkaProducerClient';
import { KafkaConsumerClient } from '../consumer/KafkaConsumerClient';
import { Logger } from '../../logger';
import { EventEmitter } from 'events';

export interface SagaStep {
  id: string;
  name: string;
  command: SagaCommand;
  compensatingCommand?: SagaCommand;
  retryPolicy?: {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier: number;
  };
  timeout?: number;
  dependsOn?: string[]; // Step IDs this step depends on
}

export interface SagaCommand {
  type: string;
  data: any;
  targetService?: string;
  targetTopic?: string;
  headers?: Record<string, string>;
}

export interface SagaDefinition {
  id: string;
  name: string;
  steps: SagaStep[];
  timeoutMs?: number;
  compensationStrategy?: 'backward' | 'forward';
}

export interface SagaInstance {
  id: string;
  sagaDefinitionId: string;
  status: 'created' | 'running' | 'completed' | 'failed' | 'compensating' | 'compensated' | 'timeout';
  startedAt: Date;
  completedAt?: Date;
  currentStep?: string;
  completedSteps: string[];
  failedSteps: string[];
  compensatedSteps: string[];
  context: Record<string, any>;
  error?: {
    message: string;
    step: string;
    timestamp: Date;
    retryCount: number;
  };
}

export interface SagaEvent {
  type: 'saga_started' | 'step_started' | 'step_completed' | 'step_failed' | 'saga_completed' | 'saga_failed' | 'compensation_started' | 'step_compensated';
  sagaId: string;
  sagaDefinitionId: string;
  stepId?: string;
  timestamp: Date;
  data?: any;
  error?: string;
}

export interface SagaStepResult {
  success: boolean;
  data?: any;
  error?: Error;
  retryable?: boolean;
}

export interface SagaStepHandler {
  (command: SagaCommand, context: Record<string, any>): Promise<SagaStepResult>;
}

export interface SagaCompensationHandler {
  (command: SagaCommand, context: Record<string, any>): Promise<SagaStepResult>;
}

export class SagaOrchestrator extends EventEmitter {
  private sagaDefinitions = new Map<string, SagaDefinition>();
  private sagaInstances = new Map<string, SagaInstance>();
  private stepHandlers = new Map<string, SagaStepHandler>();
  private compensationHandlers = new Map<string, SagaCompensationHandler>();
  private logger: Logger;
  private isStarted = false;

  constructor(
    private producer: KafkaProducerClient,
    private consumer: KafkaConsumerClient,
    private config: {
      sagaEventsTopic: string;
      sagaCommandsTopic: string;
      timeoutCheckInterval?: number;
      persistSagaState?: boolean;
      sagaStateTopic?: string;
    }
  ) {
    super();
    this.logger = new Logger('SagaOrchestrator');
    
    // Setup periodic timeout checks
    if (config.timeoutCheckInterval) {
      setInterval(() => {
        this.checkTimeouts();
      }, config.timeoutCheckInterval);
    }
  }

  // Register saga definition
  registerSaga(definition: SagaDefinition): void {
    this.validateSagaDefinition(definition);
    this.sagaDefinitions.set(definition.id, definition);
    this.logger.info(`Registered saga definition: ${definition.name} (${definition.id})`);
  }

  // Register step handler
  registerStepHandler(commandType: string, handler: SagaStepHandler): void {
    this.stepHandlers.set(commandType, handler);
    this.logger.info(`Registered step handler for command type: ${commandType}`);
  }

  // Register compensation handler
  registerCompensationHandler(commandType: string, handler: SagaCompensationHandler): void {
    this.compensationHandlers.set(commandType, handler);
    this.logger.info(`Registered compensation handler for command type: ${commandType}`);
  }

  // Start the orchestrator
  async start(): Promise<void> {
    if (this.isStarted) {
      return;
    }

    await this.consumer.subscribe([
      this.config.sagaEventsTopic,
      this.config.sagaCommandsTopic,
    ]);

    // Handle saga events
    this.consumer.registerMessageHandler(this.config.sagaEventsTopic, async (payload) => {
      const event = payload.message as SagaEvent;
      await this.handleSagaEvent(event);
    });

    // Handle saga commands
    this.consumer.registerMessageHandler(this.config.sagaCommandsTopic, async (payload) => {
      const { sagaId, stepId, command } = payload.message as {
        sagaId: string;
        stepId: string;
        command: SagaCommand;
      };
      await this.executeStep(sagaId, stepId, command);
    });

    await this.consumer.startConsuming();
    this.isStarted = true;
    this.logger.info('Saga orchestrator started');
  }

  // Stop the orchestrator
  async stop(): Promise<void> {
    await this.consumer.stop();
    this.isStarted = false;
    this.logger.info('Saga orchestrator stopped');
  }

  // Start a new saga instance
  async startSaga(
    sagaDefinitionId: string,
    initialContext: Record<string, any> = {},
    sagaId?: string
  ): Promise<string> {
    const definition = this.sagaDefinitions.get(sagaDefinitionId);
    if (!definition) {
      throw new Error(`Saga definition not found: ${sagaDefinitionId}`);
    }

    const instanceId = sagaId || uuidv4();
    const instance: SagaInstance = {
      id: instanceId,
      sagaDefinitionId,
      status: 'created',
      startedAt: new Date(),
      completedSteps: [],
      failedSteps: [],
      compensatedSteps: [],
      context: { ...initialContext },
    };

    this.sagaInstances.set(instanceId, instance);

    // Publish saga started event
    await this.publishSagaEvent({
      type: 'saga_started',
      sagaId: instanceId,
      sagaDefinitionId,
      timestamp: new Date(),
      data: initialContext,
    });

    // Start executing steps
    await this.executeNextSteps(instanceId);

    this.logger.info(`Started saga instance: ${instanceId} (${definition.name})`);
    return instanceId;
  }

  // Execute next available steps
  private async executeNextSteps(sagaId: string): Promise<void> {
    const instance = this.sagaInstances.get(sagaId);
    const definition = this.sagaDefinitions.get(instance!.sagaDefinitionId);
    
    if (!instance || !definition || instance.status !== 'running' && instance.status !== 'created') {
      return;
    }

    instance.status = 'running';

    // Find steps that can be executed (dependencies satisfied)
    const availableSteps = definition.steps.filter(step => 
      !instance.completedSteps.includes(step.id) &&
      !instance.failedSteps.includes(step.id) &&
      this.areDependenciesSatisfied(step, instance)
    );

    if (availableSteps.length === 0) {
      // Check if saga is complete
      if (instance.completedSteps.length === definition.steps.length) {
        await this.completeSaga(sagaId);
      } else if (instance.failedSteps.length > 0) {
        await this.failSaga(sagaId, new Error('Some steps failed'));
      }
      return;
    }

    // Execute available steps in parallel
    const stepPromises = availableSteps.map(step => 
      this.scheduleStep(sagaId, step)
    );

    await Promise.allSettled(stepPromises);
  }

  private areDependenciesSatisfied(step: SagaStep, instance: SagaInstance): boolean {
    if (!step.dependsOn || step.dependsOn.length === 0) {
      return true;
    }

    return step.dependsOn.every(depId => 
      instance.completedSteps.includes(depId)
    );
  }

  private async scheduleStep(sagaId: string, step: SagaStep): Promise<void> {
    const instance = this.sagaInstances.get(sagaId)!;
    
    // Publish step started event
    await this.publishSagaEvent({
      type: 'step_started',
      sagaId,
      sagaDefinitionId: instance.sagaDefinitionId,
      stepId: step.id,
      timestamp: new Date(),
    });

    // Send command for execution
    if (step.command.targetTopic) {
      // External service execution
      await this.producer.publish(step.command.targetTopic, {
        sagaId,
        stepId: step.id,
        command: step.command,
        context: instance.context,
      });
    } else {
      // Local execution
      await this.executeStep(sagaId, step.id, step.command);
    }

    // Set timeout if specified
    if (step.timeout) {
      setTimeout(() => {
        this.handleStepTimeout(sagaId, step.id);
      }, step.timeout);
    }
  }

  private async executeStep(sagaId: string, stepId: string, command: SagaCommand): Promise<void> {
    const instance = this.sagaInstances.get(sagaId);
    const definition = this.sagaDefinitions.get(instance!.sagaDefinitionId);
    const step = definition!.steps.find(s => s.id === stepId);

    if (!instance || !definition || !step) {
      this.logger.error(`Invalid step execution request: saga=${sagaId}, step=${stepId}`);
      return;
    }

    const handler = this.stepHandlers.get(command.type);
    if (!handler) {
      await this.handleStepFailure(sagaId, stepId, new Error(`No handler for command type: ${command.type}`));
      return;
    }

    try {
      const result = await handler(command, instance.context);
      
      if (result.success) {
        await this.handleStepSuccess(sagaId, stepId, result.data);
      } else {
        await this.handleStepFailure(sagaId, stepId, result.error || new Error('Step execution failed'));
      }
    } catch (error) {
      await this.handleStepFailure(sagaId, stepId, error as Error);
    }
  }

  private async handleStepSuccess(sagaId: string, stepId: string, data?: any): Promise<void> {
    const instance = this.sagaInstances.get(sagaId)!;
    
    instance.completedSteps.push(stepId);
    if (data) {
      instance.context = { ...instance.context, ...data };
    }

    await this.publishSagaEvent({
      type: 'step_completed',
      sagaId,
      sagaDefinitionId: instance.sagaDefinitionId,
      stepId,
      timestamp: new Date(),
      data,
    });

    // Continue with next steps
    await this.executeNextSteps(sagaId);
  }

  private async handleStepFailure(sagaId: string, stepId: string, error: Error): Promise<void> {
    const instance = this.sagaInstances.get(sagaId)!;
    const definition = this.sagaDefinitions.get(instance.sagaDefinitionId)!;
    const step = definition.steps.find(s => s.id === stepId)!;

    // Check if we should retry
    const retryPolicy = step.retryPolicy;
    const currentRetryCount = instance.error?.retryCount || 0;
    
    if (retryPolicy && currentRetryCount < retryPolicy.maxRetries) {
      instance.error = {
        message: error.message,
        step: stepId,
        timestamp: new Date(),
        retryCount: currentRetryCount + 1,
      };

      // Schedule retry
      setTimeout(() => {
        this.executeStep(sagaId, stepId, step.command);
      }, retryPolicy.retryDelay * Math.pow(retryPolicy.backoffMultiplier, currentRetryCount));
      
      return;
    }

    // Step failed permanently
    instance.failedSteps.push(stepId);
    instance.error = {
      message: error.message,
      step: stepId,
      timestamp: new Date(),
      retryCount: currentRetryCount,
    };

    await this.publishSagaEvent({
      type: 'step_failed',
      sagaId,
      sagaDefinitionId: instance.sagaDefinitionId,
      stepId,
      timestamp: new Date(),
      error: error.message,
    });

    // Start compensation
    await this.startCompensation(sagaId);
  }

  private async startCompensation(sagaId: string): Promise<void> {
    const instance = this.sagaInstances.get(sagaId)!;
    const definition = this.sagaDefinitions.get(instance.sagaDefinitionId)!;

    instance.status = 'compensating';

    await this.publishSagaEvent({
      type: 'compensation_started',
      sagaId,
      sagaDefinitionId: instance.sagaDefinitionId,
      timestamp: new Date(),
    });

    // Compensate completed steps in reverse order
    const stepsToCompensate = definition.steps
      .filter(step => 
        instance.completedSteps.includes(step.id) && 
        step.compensatingCommand &&
        !instance.compensatedSteps.includes(step.id)
      )
      .reverse();

    for (const step of stepsToCompensate) {
      await this.compensateStep(sagaId, step);
    }

    instance.status = 'compensated';
    instance.completedAt = new Date();
    
    await this.publishSagaEvent({
      type: 'saga_failed',
      sagaId,
      sagaDefinitionId: instance.sagaDefinitionId,
      timestamp: new Date(),
    });

    this.emit('sagaFailed', { sagaId, instance });
  }

  private async compensateStep(sagaId: string, step: SagaStep): Promise<void> {
    const instance = this.sagaInstances.get(sagaId)!;
    
    if (!step.compensatingCommand) {
      return;
    }

    const handler = this.compensationHandlers.get(step.compensatingCommand.type);
    if (!handler) {
      this.logger.error(`No compensation handler for command type: ${step.compensatingCommand.type}`);
      return;
    }

    try {
      const result = await handler(step.compensatingCommand, instance.context);
      
      if (result.success) {
        instance.compensatedSteps.push(step.id);
        
        await this.publishSagaEvent({
          type: 'step_compensated',
          sagaId,
          sagaDefinitionId: instance.sagaDefinitionId,
          stepId: step.id,
          timestamp: new Date(),
        });
      } else {
        this.logger.error(`Compensation failed for step ${step.id} in saga ${sagaId}`, result.error);
      }
    } catch (error) {
      this.logger.error(`Compensation error for step ${step.id} in saga ${sagaId}`, error);
    }
  }

  private async completeSaga(sagaId: string): Promise<void> {
    const instance = this.sagaInstances.get(sagaId)!;
    
    instance.status = 'completed';
    instance.completedAt = new Date();

    await this.publishSagaEvent({
      type: 'saga_completed',
      sagaId,
      sagaDefinitionId: instance.sagaDefinitionId,
      timestamp: new Date(),
    });

    this.emit('sagaCompleted', { sagaId, instance });
    this.logger.info(`Saga completed: ${sagaId}`);
  }

  private async failSaga(sagaId: string, error: Error): Promise<void> {
    const instance = this.sagaInstances.get(sagaId)!;
    
    instance.status = 'failed';
    instance.completedAt = new Date();
    instance.error = {
      message: error.message,
      step: 'saga',
      timestamp: new Date(),
      retryCount: 0,
    };

    await this.publishSagaEvent({
      type: 'saga_failed',
      sagaId,
      sagaDefinitionId: instance.sagaDefinitionId,
      timestamp: new Date(),
      error: error.message,
    });

    this.emit('sagaFailed', { sagaId, instance });
    this.logger.error(`Saga failed: ${sagaId}`, error);
  }

  private async handleStepTimeout(sagaId: string, stepId: string): Promise<void> {
    const instance = this.sagaInstances.get(sagaId);
    if (!instance || instance.completedSteps.includes(stepId) || instance.failedSteps.includes(stepId)) {
      return; // Step already completed or failed
    }

    await this.handleStepFailure(sagaId, stepId, new Error(`Step timeout: ${stepId}`));
  }

  private async handleSagaEvent(event: SagaEvent): Promise<void> {
    this.emit('sagaEvent', event);
    
    // Handle external step completion/failure notifications
    if (event.type === 'step_completed' && event.stepId) {
      await this.handleStepSuccess(event.sagaId, event.stepId, event.data);
    } else if (event.type === 'step_failed' && event.stepId) {
      await this.handleStepFailure(event.sagaId, event.stepId, new Error(event.error || 'External step failed'));
    }
  }

  private async publishSagaEvent(event: SagaEvent): Promise<void> {
    await this.producer.publish(this.config.sagaEventsTopic, event, {
      key: event.sagaId,
      headers: {
        'event-type': event.type,
        'saga-id': event.sagaId,
        'saga-definition-id': event.sagaDefinitionId,
        'step-id': event.stepId || '',
      },
    });

    if (this.config.persistSagaState && this.config.sagaStateTopic) {
      const instance = this.sagaInstances.get(event.sagaId);
      if (instance) {
        await this.producer.publish(this.config.sagaStateTopic, instance, {
          key: event.sagaId,
          headers: {
            'saga-id': event.sagaId,
            'saga-status': instance.status,
          },
        });
      }
    }
  }

  private checkTimeouts(): void {
    const now = new Date();
    
    for (const [sagaId, instance] of this.sagaInstances) {
      const definition = this.sagaDefinitions.get(instance.sagaDefinitionId);
      if (!definition || !definition.timeoutMs) {
        continue;
      }

      const elapsed = now.getTime() - instance.startedAt.getTime();
      if (elapsed > definition.timeoutMs && instance.status === 'running') {
        this.handleStepTimeout(sagaId, 'saga_timeout');
      }
    }
  }

  private validateSagaDefinition(definition: SagaDefinition): void {
    if (!definition.id || !definition.name || !definition.steps || definition.steps.length === 0) {
      throw new Error('Invalid saga definition: missing required fields');
    }

    // Check for circular dependencies
    const stepIds = new Set(definition.steps.map(s => s.id));
    for (const step of definition.steps) {
      if (step.dependsOn) {
        for (const depId of step.dependsOn) {
          if (!stepIds.has(depId)) {
            throw new Error(`Invalid dependency: step ${step.id} depends on non-existent step ${depId}`);
          }
        }
      }
    }

    // TODO: Add cycle detection algorithm for dependencies
  }

  // Public API methods
  getSagaInstance(sagaId: string): SagaInstance | undefined {
    return this.sagaInstances.get(sagaId);
  }

  getSagaDefinition(definitionId: string): SagaDefinition | undefined {
    return this.sagaDefinitions.get(definitionId);
  }

  getAllSagaInstances(): SagaInstance[] {
    return Array.from(this.sagaInstances.values());
  }

  getSagaInstancesByStatus(status: SagaInstance['status']): SagaInstance[] {
    return Array.from(this.sagaInstances.values()).filter(instance => instance.status === status);
  }

  async cancelSaga(sagaId: string): Promise<void> {
    const instance = this.sagaInstances.get(sagaId);
    if (!instance || instance.status === 'completed' || instance.status === 'failed') {
      return;
    }

    await this.startCompensation(sagaId);
  }

  // Cleanup completed sagas to prevent memory leaks
  cleanupCompletedSagas(olderThanHours = 24): number {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    let cleaned = 0;

    for (const [sagaId, instance] of this.sagaInstances) {
      if (
        (instance.status === 'completed' || instance.status === 'failed' || instance.status === 'compensated') &&
        instance.completedAt &&
        instance.completedAt < cutoff
      ) {
        this.sagaInstances.delete(sagaId);
        cleaned++;
      }
    }

    this.logger.info(`Cleaned up ${cleaned} completed sagas`);
    return cleaned;
  }
}

export default SagaOrchestrator;