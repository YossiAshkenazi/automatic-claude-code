/**
 * Core Types for SDK-Based Autopilot Architecture
 * This file defines the interfaces needed for Story 1.2: SDK-Based Autopilot Logic
 */

import { AgentRole, AgentModel, WorkflowPhase } from './agents/agentTypes';

// SDK Response Types
export interface SDKResponse {
  type: 'result' | 'error' | 'tool_use' | 'session' | 'stream';
  result?: string;
  content?: string;
  error?: string;
  tool?: string;
  sessionId?: string;
  timestamp: Date;
}

export interface SDKResult {
  output: string;
  exitCode: number;
  sessionId?: string;
  messages: SDKResponse[];
  hasError: boolean;
  executionTime: number;
}

// Autopilot Configuration
export interface AutopilotOptions {
  model?: AgentModel;
  workDir?: string;
  sessionId?: string;
  verbose?: boolean;
  timeout?: number;
  maxIterations?: number;
  allowedTools?: string;
  dualAgent?: boolean;
  continuationThreshold?: number;
}

// Task Completion Analysis
export interface CompletionAnalysis {
  isComplete: boolean;
  confidence: number; // 0-1
  continuationNeeded: boolean;
  reasonForContinuation?: string;
  suggestedNextAction?: string;
  detectedPatterns: CompletionPattern[];
  qualityScore: number; // 0-1
}

export interface CompletionPattern {
  type: 'explicit_completion' | 'task_pending' | 'error_needs_fixing' | 'clarification_needed' | 'iterative_improvement';
  confidence: number;
  evidence: string[];
  weight: number;
}

// Execution Context
export interface ExecutionContext {
  sessionId: string;
  taskDescription: string;
  currentIteration: number;
  maxIterations: number;
  workDir: string;
  startTime: Date;
  lastExecutionTime: Date;
  totalExecutionTime: number;
  model: AgentModel;
  verbose: boolean;
  isFirstIteration: boolean;
}

export interface TaskContext {
  originalRequest: string;
  executionHistory: IterationData[];
  currentWorkDir: string;
  sessionId: string;
  preferences: UserPreferences;
}

export interface IterationData {
  iterationNumber: number;
  prompt: string;
  response: SDKResult;
  completionAnalysis: CompletionAnalysis;
  timestamp: Date;
  executionTimeMs: number;
  tokensUsed?: number;
  toolsInvoked: string[];
}

// User Preferences
export interface UserPreferences {
  preferredModel: AgentModel;
  maxIterations: number;
  timeoutMs: number;
  verboseLogging: boolean;
  continuationThreshold: number;
  enableDualAgent: boolean;
}

// Dual Agent Coordination
export interface DualAgentOptions {
  managerModel: AgentModel;
  workerModel: AgentModel;
  coordinationMode: 'sequential' | 'parallel' | 'hybrid';
  qualityGateEnabled: boolean;
  maxCoordinationRounds: number;
}

export interface CoordinationResult {
  phase: WorkflowPhase;
  managerOutput: ManagerResult;
  workerOutput?: WorkerResult;
  qualityCheck?: QualityCheck;
  shouldContinue: boolean;
  nextPhase?: WorkflowPhase;
}

export interface ManagerResult {
  taskBreakdown: TaskBreakdown;
  delegationInstructions: string;
  qualityCriteria: QualityCriteria[];
  expectedOutcomes: string[];
  sessionId: string;
  executionTime: number;
}

export interface WorkerResult {
  completedTasks: CompletedTask[];
  artifactsProduced: string[];
  encounteredIssues: Issue[];
  qualityReport: QualityReport;
  sessionId: string;
  executionTime: number;
}

export interface TaskBreakdown {
  id: string;
  title: string;
  subtasks: Subtask[];
  dependencies: string[];
  estimatedComplexity: number;
  requiredTools: string[];
  acceptanceCriteria: string[];
}

export interface Subtask {
  id: string;
  description: string;
  priority: number;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  assignedTo?: AgentRole;
  estimatedEffort: number;
}

export interface CompletedTask {
  subtaskId: string;
  output: string;
  artifacts: string[];
  qualityScore: number;
  executionTime: number;
  toolsUsed: string[];
}

export interface Issue {
  id: string;
  type: 'error' | 'warning' | 'blocker';
  description: string;
  suggestedResolution: string;
  affectedTasks: string[];
  severity: number; // 1-5
}

export interface QualityReport {
  overallScore: number; // 0-1
  criteriaScores: CriteriaScore[];
  recommendations: string[];
  mustFixIssues: Issue[];
  totalChecks: number;
  passedChecks: number;
}

export interface CriteriaScore {
  criteriaId: string;
  score: number;
  feedback: string;
  evidence: string[];
}

export interface QualityCriteria {
  id: string;
  name: string;
  description: string;
  weight: number;
  validator: string;
  threshold: number;
}

export interface QualityCheck {
  gateId: string;
  taskId: string;
  passed: boolean;
  score: number;
  feedback: string[];
  recommendations?: string[];
  timestamp: Date;
}

// Session Management
export interface SessionData {
  sessionId: string;
  taskDescription: string;
  startTime: Date;
  endTime?: Date;
  iterations: IterationData[];
  finalResult?: SDKResult;
  completionAnalysis?: CompletionAnalysis;
  workDir: string;
  model: AgentModel;
  options: AutopilotOptions;
}

// Error Types
export interface AutopilotError {
  type: 'sdk_error' | 'timeout' | 'iteration_limit' | 'validation_error' | 'authentication_error';
  message: string;
  details?: any;
  timestamp: Date;
  sessionId: string;
  iteration?: number;
  recoverable: boolean;
  suggestedAction?: string;
}

// Monitoring Types
export interface AutopilotMetrics {
  sessionId: string;
  totalIterations: number;
  totalExecutionTime: number;
  averageIterationTime: number;
  tokensUsed: number;
  toolsInvoked: string[];
  qualityScores: number[];
  finalQualityScore: number;
  completionType: 'natural' | 'max_iterations' | 'timeout' | 'error' | 'user_stop';
}

// Configuration Types
export interface SDKAutopilotConfig {
  defaultModel: AgentModel;
  maxIterationsDefault: number;
  timeoutMs: number;
  continuationThreshold: number;
  qualityGateThreshold: number;
  enableDetailedLogging: boolean;
  sessionStoragePath: string;
  dualAgentSettings: DualAgentOptions;
}

// Export default configuration
export const DEFAULT_AUTOPILOT_CONFIG: SDKAutopilotConfig = {
  defaultModel: 'sonnet',
  maxIterationsDefault: 10,
  timeoutMs: 300000, // 5 minutes
  continuationThreshold: 0.7,
  qualityGateThreshold: 0.8,
  enableDetailedLogging: false,
  sessionStoragePath: '~/.automatic-claude-code/sessions',
  dualAgentSettings: {
    managerModel: 'opus',
    workerModel: 'sonnet',
    coordinationMode: 'sequential',
    qualityGateEnabled: true,
    maxCoordinationRounds: 5
  }
};