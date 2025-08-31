/**
 * Dual-Agent System Module Exports
 * 
 * This module provides a comprehensive dual-agent architecture for automated
 * Claude Code execution with Manager-Worker coordination, quality gates,
 * and sophisticated error handling.
 * 
 * @see CLAUDE.md for detailed architecture documentation
 */

// Type definitions (import first to ensure types are available)
export * from './agentTypes';

// Import types for use in this file
import { AgentCoordinatorConfig, TaskStatus, MessageType } from './agentTypes';

// Core agent implementations
export { AgentCoordinator } from './agentCoordinator';
export { ManagerAgent } from './managerAgent';
export { WorkerAgent } from './workerAgent';

// Re-export commonly used interfaces for convenience
export type {
  AgentRole,
  AgentModel,
  AgentMessage,
  WorkItem,
  TaskAssignment,
  ProgressUpdate,
  QualityCheck,
  WorkflowState,
  WorkflowPhase,
  AgentState,
  ExecutionContext,
  CoordinationEvent,
  AgentError,
  ErrorType,
  RecoveryStrategy
} from './agentTypes';

// Configuration interfaces
export interface DualAgentSystemConfig {
  coordinationInterval: number;
  qualityGateThreshold: number;
  maxConcurrentTasks: number;
  enableCrossValidation: boolean;
  timeoutMs: number;
  retryAttempts: number;
  managerModel: 'opus' | 'sonnet' | 'haiku';
  workerModel: 'opus' | 'sonnet' | 'haiku';
  verbose: boolean;
}

// Default configuration
export const DEFAULT_DUAL_AGENT_CONFIG: DualAgentSystemConfig = {
  coordinationInterval: 5000,
  qualityGateThreshold: 0.8,
  maxConcurrentTasks: 2,
  enableCrossValidation: true,
  timeoutMs: 1800000, // 30 minutes
  retryAttempts: 3,
  managerModel: 'opus',
  workerModel: 'sonnet',
  verbose: false
};

/**
 * Factory function to create a fully configured dual-agent system
 * 
 * @param config Partial configuration, will be merged with defaults
 * @returns Configured AgentCoordinator instance
 */
export function createDualAgentSystem(
  config: Partial<DualAgentSystemConfig> = {}
) {
  const { AgentCoordinator } = require('./agentCoordinator');
  const fullConfig = { ...DEFAULT_DUAL_AGENT_CONFIG, ...config };
  
  const coordinatorConfig: AgentCoordinatorConfig = {
    coordinationInterval: fullConfig.coordinationInterval,
    qualityGateThreshold: fullConfig.qualityGateThreshold,
    maxConcurrentTasks: fullConfig.maxConcurrentTasks,
    enableCrossValidation: fullConfig.enableCrossValidation,
    timeoutMs: fullConfig.timeoutMs,
    retryAttempts: fullConfig.retryAttempts
  };
  
  return new AgentCoordinator(coordinatorConfig);
}

/**
 * Utility function to validate agent system configuration
 * 
 * @param config Configuration to validate
 * @returns Validation result with any errors
 */
export function validateDualAgentConfig(
  config: Partial<DualAgentSystemConfig>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (config.coordinationInterval && config.coordinationInterval < 1000) {
    errors.push('Coordination interval must be at least 1000ms');
  }
  
  if (config.qualityGateThreshold && (config.qualityGateThreshold < 0 || config.qualityGateThreshold > 1)) {
    errors.push('Quality gate threshold must be between 0 and 1');
  }
  
  if (config.maxConcurrentTasks && config.maxConcurrentTasks < 1) {
    errors.push('Max concurrent tasks must be at least 1');
  }
  
  if (config.timeoutMs && config.timeoutMs < 10000) {
    errors.push('Timeout must be at least 10 seconds (10000ms)');
  }
  
  if (config.retryAttempts && config.retryAttempts < 0) {
    errors.push('Retry attempts must be non-negative');
  }
  
  const validModels = ['opus', 'sonnet', 'haiku'];
  if (config.managerModel && !validModels.includes(config.managerModel)) {
    errors.push(`Manager model must be one of: ${validModels.join(', ')}`);
  }
  
  if (config.workerModel && !validModels.includes(config.workerModel)) {
    errors.push(`Worker model must be one of: ${validModels.join(', ')}`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Version information for the dual-agent system
 */
export const DUAL_AGENT_VERSION = '1.0.0';
export const DUAL_AGENT_SYSTEM_NAME = 'Automatic Claude Code - Dual Agent Architecture';

/**
 * System capabilities and limits
 */
export const SYSTEM_LIMITS = {
  MAX_WORK_ITEMS: 50,
  MAX_MESSAGE_HISTORY: 1000,
  MAX_COORDINATION_TIME: 3600000, // 1 hour
  MAX_RETRY_ATTEMPTS: 10,
  MIN_QUALITY_THRESHOLD: 0.1,
  MAX_QUALITY_THRESHOLD: 1.0
} as const;

/**
 * Event names emitted by the dual-agent system
 */
export const AGENT_EVENTS = {
  // Coordinator events
  COORDINATION_STARTED: 'coordination_started',
  COORDINATION_COMPLETED: 'coordination_completed',
  COORDINATION_ERROR: 'coordination_error',
  COORDINATION_SHUTDOWN: 'coordination_shutdown',
  
  // Agent lifecycle events
  AGENTS_INITIALIZED: 'agents_initialized',
  AGENT_ERROR: 'agent_error',
  AGENT_RECOVERY: 'agent_recovery',
  
  // Workflow events
  WORKFLOW_PHASE_CHANGED: 'workflow_phase_changed',
  WORK_ITEM_ASSIGNED: 'work_item_assigned',
  WORK_ITEM_COMPLETED: 'work_item_completed',
  WORK_ITEM_FAILED: 'work_item_failed',
  
  // Communication events
  MESSAGE_SENT: 'message_sent',
  MESSAGE_DELIVERED: 'message_delivered',
  HANDOFF_INITIATED: 'handoff_initiated',
  HANDOFF_COMPLETED: 'handoff_completed',
  
  // Quality events
  QUALITY_CHECK_PASSED: 'quality_check_passed',
  QUALITY_CHECK_FAILED: 'quality_check_failed',
  QUALITY_IMPROVEMENT: 'quality_improvement'
} as const;

/**
 * Type guard utilities
 */
export function isManagerAgent(role: string): role is 'manager' {
  return role === 'manager';
}

export function isWorkerAgent(role: string): role is 'worker' {
  return role === 'worker';
}

export function isValidAgentModel(model: string): model is 'opus' | 'sonnet' | 'haiku' {
  return ['opus', 'sonnet', 'haiku'].includes(model);
}

export function isValidTaskStatus(status: string): status is TaskStatus {
  return ['planned', 'assigned', 'in_progress', 'completed', 'blocked', 'failed'].includes(status);
}

export function isValidMessageType(type: string): type is MessageType {
  return [
    'task_assignment',
    'progress_update',
    'completion_report',
    'error_report',
    'quality_check',
    'course_correction',
    'workflow_transition'
  ].includes(type);
}