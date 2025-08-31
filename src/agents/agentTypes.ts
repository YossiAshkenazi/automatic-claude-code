// Core Agent Types for Dual-Agent Architecture
export type AgentRole = 'manager' | 'worker';
export type AgentModel = 'opus' | 'sonnet' | 'haiku';

// Message Types for Inter-Agent Communication
export type MessageType = 
  | 'task_assignment'
  | 'progress_update' 
  | 'completion_report'
  | 'error_report'
  | 'quality_check'
  | 'course_correction'
  | 'workflow_transition';

export interface AgentMessage<T = any> {
  id: string;
  from: AgentRole;
  to: AgentRole;
  type: MessageType;
  payload: T;
  timestamp: Date;
  correlationId?: string;
}

// Task Management Types
export interface WorkItem {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: number;
  estimatedEffort: number;
  dependencies: string[];
  assignedTo?: AgentRole;
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type TaskStatus = 'planned' | 'assigned' | 'in_progress' | 'completed' | 'blocked' | 'failed';

export interface TaskAssignment {
  workItem: WorkItem;
  context: string;
  requiredTools: string[];
  constraints: string[];
  qualityGates: QualityGate[];
}

export interface ProgressUpdate {
  workItemId: string;
  status: TaskStatus;
  completedSteps: string[];
  nextSteps: string[];
  blockers?: string[];
  artifactsProduced: string[];
  confidenceLevel: number; // 0-1
}

// Quality Management Types
export interface QualityGate {
  id: string;
  name: string;
  criteria: QualityCriteria[];
  threshold: number; // 0-1
  required: boolean;
}

export interface QualityCriteria {
  name: string;
  description: string;
  validator: string; // function name or validation rule
  weight: number;
}

export interface QualityCheck {
  gateId: string;
  workItemId: string;
  passed: boolean;
  score: number;
  feedback: string[];
  recommendations?: string[];
}

// Agent State Management
export interface AgentState {
  role: AgentRole;
  model: AgentModel;
  status: AgentStatus;
  currentWorkItems: string[];
  capabilities: AgentCapability[];
  performance: PerformanceMetrics;
  lastActivity: Date;
}

export type AgentStatus = 'idle' | 'planning' | 'executing' | 'reviewing' | 'error' | 'offline';

export interface AgentCapability {
  name: string;
  proficiency: number; // 0-1
  description: string;
}

export interface PerformanceMetrics {
  tasksCompleted: number;
  averageQualityScore: number;
  averageCompletionTime: number;
  errorRate: number;
  collaborationScore: number;
}

// Workflow Management
export type WorkflowPhase = 'analysis' | 'planning' | 'execution' | 'integration' | 'validation' | 'completion';

export interface WorkflowState {
  phase: WorkflowPhase;
  startTime: Date;
  totalWorkItems: number;
  completedWorkItems: number;
  activeWorkItems: string[];
  blockedWorkItems: string[];
  overallProgress: number; // 0-1
  qualityMetrics: QualityMetrics;
}

export interface QualityMetrics {
  averageScore: number;
  gatesPassed: number;
  gatesFailed: number;
  criticalIssues: number;
}

// Error Handling Types
export interface AgentError {
  id: string;
  agentRole: AgentRole;
  workItemId?: string;
  errorType: ErrorType;
  message: string;
  stackTrace?: string;
  recoveryStrategy?: RecoveryStrategy;
  timestamp: Date;
}

export type ErrorType = 'tool_failure' | 'communication_error' | 'validation_failure' | 'timeout' | 'resource_unavailable';

export interface RecoveryStrategy {
  type: 'retry' | 'reassign' | 'skip' | 'escalate';
  maxAttempts: number;
  backoffMs: number;
  fallbackPlan?: string;
}

// Coordination Types
export interface CoordinationEvent {
  type: 'MANAGER_TASK_ASSIGNMENT' | 'WORKER_PROGRESS_UPDATE' | 'MANAGER_QUALITY_CHECK' | 'AGENT_COORDINATION' | 
        'WORKFLOW_TRANSITION' | 'MANAGER_WORKER_HANDOFF' | 'HANDOFF_VALIDATION' | 'TASK_DELEGATION' | 'EXECUTION_COMPLETE';
  agentRole: AgentRole;
  workItemId?: string;
  data: any;
  timestamp: Date;
}

export interface AgentCoordinatorConfig {
  coordinationInterval: number;
  qualityGateThreshold: number;
  maxConcurrentTasks: number;
  enableCrossValidation: boolean;
  timeoutMs: number;
  retryAttempts: number;
}

// Execution Context
export interface ExecutionContext {
  sessionId: string;
  userRequest: string;
  workflowState: WorkflowState;
  managerState: AgentState;
  workerState: AgentState;
  communicationHistory: AgentMessage[];
  artifacts: string[];
  config: AgentCoordinatorConfig;
}