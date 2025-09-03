/**
 * Agent Service for Frontend Protocol Handling
 * ===========================================
 * 
 * This service provides comprehensive frontend protocol handling for agent
 * communication, including real-time messaging, task management, quality
 * control, and human intervention capabilities.
 * 
 * Key Features:
 * - Protocol client for UI interactions
 * - Real-time message display and formatting
 * - User intervention controls and feedback
 * - Agent communication visualization
 * - Task assignment and progress tracking
 * - Quality gate management and validation
 * - WebSocket-based real-time communication
 */

import { EventEmitter } from 'events';

// ============================================================================
// Protocol Types (matching Python backend)
// ============================================================================

export enum MessageType {
  // Task Management Messages
  TASK_ASSIGNMENT = 'task_assignment',
  TASK_ACCEPTED = 'task_accepted',
  TASK_REJECTED = 'task_rejected',
  TASK_PROGRESS = 'task_progress',
  TASK_COMPLETION = 'task_completion',
  TASK_FAILED = 'task_failed',
  
  // Coordination Messages
  COORDINATION_REQUEST = 'coordination_request',
  COORDINATION_RESPONSE = 'coordination_response',
  HANDOFF_INITIATE = 'handoff_initiate',
  HANDOFF_COMPLETE = 'handoff_complete',
  
  // Quality Control Messages
  QUALITY_CHECK = 'quality_check',
  QUALITY_RESULT = 'quality_result',
  VALIDATION_REQUEST = 'validation_request',
  VALIDATION_RESPONSE = 'validation_response',
  
  // Human Intervention Messages
  HUMAN_INTERVENTION_REQUESTED = 'human_intervention_requested',
  HUMAN_INTERVENTION_PROVIDED = 'human_intervention_provided',
  APPROVAL_REQUEST = 'approval_request',
  APPROVAL_RESPONSE = 'approval_response',
  
  // System Messages
  HEARTBEAT = 'heartbeat',
  STATUS_UPDATE = 'status_update',
  ERROR_REPORT = 'error_report',
  SESSION_EVENT = 'session_event',
  
  // Protocol Messages
  ACK = 'ack',
  NACK = 'nack',
  PING = 'ping',
  PONG = 'pong'
}

export enum AgentRole {
  MANAGER = 'manager',
  WORKER = 'worker',
  HUMAN = 'human',
  SYSTEM = 'system'
}

export enum MessagePriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  URGENT = 4,
  CRITICAL = 5
}

export enum TaskStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  WAITING_REVIEW = 'waiting_review',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REQUIRES_HUMAN = 'requires_human'
}

export enum CoordinationPhase {
  PLANNING = 'planning',
  ASSIGNMENT = 'assignment',
  EXECUTION = 'execution',
  VALIDATION = 'validation',
  COMPLETION = 'completion',
  ERROR_HANDLING = 'error_handling'
}

// ============================================================================
// Data Structures
// ============================================================================

export interface MessageMetadata {
  correlation_id?: string;
  reply_to?: string;
  session_id?: string;
  task_id?: string;
  sequence_number?: number;
  retry_count?: number;
  timeout_seconds?: number;
  requires_ack?: boolean;
  created_at?: number;
  expires_at?: number;
}

export interface ProtocolMessage {
  id: string;
  type: MessageType;
  sender: AgentRole;
  recipient: AgentRole;
  content: Record<string, any>;
  priority: MessagePriority;
  metadata: MessageMetadata;
  timestamp: number;
}

export interface TaskDefinition {
  id: string;
  title: string;
  description: string;
  requirements: string[];
  estimated_duration?: number; // minutes
  priority: MessagePriority;
  dependencies: string[]; // task IDs
  metadata: Record<string, any>;
}

export interface TaskProgress {
  task_id: string;
  status: TaskStatus;
  progress_percent: number;
  current_step: string;
  completed_steps: string[];
  remaining_steps: string[];
  outputs: string[];
  metrics: Record<string, any>;
  estimated_completion?: number;
}

export interface QualityGate {
  id: string;
  name: string;
  description: string;
  criteria: Array<Record<string, any>>;
  threshold_score: number;
  required: boolean;
  auto_validate: boolean;
}

export interface ValidationResult {
  gate_id: string;
  task_id: string;
  passed: boolean;
  score: number;
  feedback: string[];
  recommendations: string[];
  timestamp: number;
}

export interface AgentState {
  agent_id: string;
  role: AgentRole;
  status: string; // active, busy, idle, offline, error
  last_seen: number;
  current_session?: string;
  assigned_tasks: Set<string>;
  capabilities: Set<string>;
  messages_sent: number;
  messages_received: number;
  tasks_completed: number;
  tasks_failed: number;
  average_response_time: number;
  current_load: number;
}

export interface SessionState {
  session_id: string;
  status: string; // active, paused, completed, failed
  created_at: number;
  updated_at: number;
  manager_agent_id?: string;
  worker_agent_ids: Set<string>;
  human_operators: Set<string>;
  initial_task: string;
  work_dir: string;
  current_phase: CoordinationPhase;
  metadata: Record<string, any>;
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  active_tasks: Set<string>;
  messages_exchanged: number;
  total_duration: number;
  coordination_events: number;
}

// ============================================================================
// Human Intervention Types
// ============================================================================

export interface InterventionRequest {
  intervention_id: string;
  task_id: string;
  reason: string;
  context: Record<string, any>;
  requested_by: string;
  urgency: 'low' | 'normal' | 'high' | 'critical';
  requested_at: number;
  timeout_seconds: number;
}

export interface ApprovalRequest {
  approval_id: string;
  task_id: string;
  action: string;
  details: Record<string, any>;
  requested_by: string;
  requested_at: number;
  timeout_seconds: number;
}

export interface HumanInterventionResponse {
  intervention_id: string;
  guidance: string;
  action_taken: 'provide_guidance' | 'take_control' | 'escalate' | 'reject';
  additional_context?: Record<string, any>;
}

export interface ApprovalResponse {
  approval_id: string;
  approved: boolean;
  reason: string;
  conditions?: string[];
}

// ============================================================================
// Event Types
// ============================================================================

export interface AgentServiceEvents {
  'message_received': (message: ProtocolMessage) => void;
  'task_created': (task: TaskDefinition) => void;
  'task_updated': (taskId: string, progress: TaskProgress) => void;
  'agent_status_changed': (agentId: string, status: string) => void;
  'intervention_requested': (request: InterventionRequest) => void;
  'approval_requested': (request: ApprovalRequest) => void;
  'quality_result': (result: ValidationResult) => void;
  'coordination_event': (event: CoordinationEvent) => void;
  'connection_status': (connected: boolean) => void;
  'error': (error: Error) => void;
}

export interface CoordinationEvent {
  type: 'handoff' | 'quality_check' | 'phase_transition' | 'intervention';
  session_id: string;
  from_agent?: string;
  to_agent?: string;
  phase?: CoordinationPhase;
  metadata: Record<string, any>;
  timestamp: number;
}

// ============================================================================
// Agent Service Implementation
// ============================================================================

export class AgentService extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000; // Start with 1 second
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private messageQueue: ProtocolMessage[] = [];
  private isConnected = false;
  private pendingAcks: Map<string, NodeJS.Timeout> = new Map();
  
  // State management
  private agents: Map<string, AgentState> = new Map();
  private sessions: Map<string, SessionState> = new Map();
  private tasks: Map<string, TaskProgress> = new Map();
  private pendingInterventions: Map<string, InterventionRequest> = new Map();
  private pendingApprovals: Map<string, ApprovalRequest> = new Map();
  
  // Configuration
  private readonly wsUrl: string;
  private readonly ackTimeout = 30000; // 30 seconds
  private readonly heartbeatInterval_ms = 30000; // 30 seconds
  
  constructor(wsUrl: string = 'ws://localhost:4005/ws/protocol') {
    super();
    this.wsUrl = wsUrl;
  }
  
  // ========================================================================
  // Connection Management
  // ========================================================================
  
  async connect(): Promise<void> {
    try {
      this.ws = new WebSocket(this.wsUrl);
      
      this.ws.onopen = () => {
        console.log('Agent service connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.emit('connection_status', true);
        
        // Start heartbeat
        this.startHeartbeat();
        
        // Send queued messages
        this.flushMessageQueue();
      };
      
      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };
      
      this.ws.onclose = () => {
        console.log('Agent service disconnected');
        this.isConnected = false;
        this.emit('connection_status', false);
        this.stopHeartbeat();
        
        // Attempt reconnection
        this.scheduleReconnect();
      };
      
      this.ws.onerror = (error) => {
        console.error('Agent service error:', error);
        this.emit('error', new Error(`WebSocket error: ${error}`));
      };
      
    } catch (error) {
      console.error('Failed to connect agent service:', error);
      this.emit('error', error as Error);
      throw error;
    }
  }
  
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.stopHeartbeat();
    this.isConnected = false;
  }
  
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('error', new Error('Max reconnection attempts reached'));
      return;
    }
    
    setTimeout(() => {
      console.log(`Attempting to reconnect (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
      this.reconnectAttempts++;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000); // Max 30 seconds
      this.connect().catch(console.error);
    }, this.reconnectDelay);
  }
  
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.sendMessage({
          id: this.generateId(),
          type: MessageType.HEARTBEAT,
          sender: AgentRole.HUMAN,
          recipient: AgentRole.SYSTEM,
          content: { timestamp: Date.now() },
          priority: MessagePriority.LOW,
          metadata: { requires_ack: false },
          timestamp: Date.now()
        });
      }
    }, this.heartbeatInterval_ms);
  }
  
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
  
  // ========================================================================
  // Message Handling
  // ========================================================================
  
  private handleMessage(data: string): void {
    try {
      const message: ProtocolMessage = JSON.parse(data);
      
      // Handle acknowledgments
      if (message.type === MessageType.ACK) {
        this.handleAck(message);
        return;
      }
      
      // Send acknowledgment if required
      if (message.metadata.requires_ack) {
        this.sendAck(message);
      }
      
      // Process message based on type
      this.processMessage(message);
      
    } catch (error) {
      console.error('Error handling message:', error);
      this.emit('error', new Error(`Message handling error: ${error}`));
    }
  }
  
  private processMessage(message: ProtocolMessage): void {
    this.emit('message_received', message);
    
    switch (message.type) {
      case MessageType.TASK_ASSIGNMENT:
        this.handleTaskAssignment(message);
        break;
        
      case MessageType.TASK_PROGRESS:
        this.handleTaskProgress(message);
        break;
        
      case MessageType.TASK_COMPLETION:
        this.handleTaskCompletion(message);
        break;
        
      case MessageType.HUMAN_INTERVENTION_REQUESTED:
        this.handleInterventionRequest(message);
        break;
        
      case MessageType.APPROVAL_REQUEST:
        this.handleApprovalRequest(message);
        break;
        
      case MessageType.QUALITY_RESULT:
        this.handleQualityResult(message);
        break;
        
      case MessageType.STATUS_UPDATE:
        this.handleStatusUpdate(message);
        break;
        
      case MessageType.HANDOFF_INITIATE:
      case MessageType.HANDOFF_COMPLETE:
        this.handleCoordinationEvent(message);
        break;
        
      default:
        console.log(`Unhandled message type: ${message.type}`);
    }
  }
  
  // ========================================================================
  // Message Sending
  // ========================================================================
  
  private sendMessage(message: ProtocolMessage): void {
    if (!this.isConnected || !this.ws) {
      // Queue message for later delivery
      this.messageQueue.push(message);
      return;
    }
    
    try {
      this.ws.send(JSON.stringify(message));
      
      // Set up acknowledgment timeout if required
      if (message.metadata.requires_ack !== false) {
        const timeout = setTimeout(() => {
          console.warn(`No acknowledgment received for message ${message.id}`);
          this.pendingAcks.delete(message.id);
        }, this.ackTimeout);
        
        this.pendingAcks.set(message.id, timeout);
      }
      
    } catch (error) {
      console.error('Error sending message:', error);
      this.messageQueue.push(message); // Queue for retry
    }
  }
  
  private sendAck(originalMessage: ProtocolMessage): void {
    const ackMessage: ProtocolMessage = {
      id: this.generateId(),
      type: MessageType.ACK,
      sender: AgentRole.HUMAN,
      recipient: originalMessage.sender,
      content: { original_message_id: originalMessage.id },
      priority: MessagePriority.LOW,
      metadata: {
        correlation_id: originalMessage.metadata.correlation_id,
        requires_ack: false
      },
      timestamp: Date.now()
    };
    
    this.sendMessage(ackMessage);
  }
  
  private handleAck(ackMessage: ProtocolMessage): void {
    const originalMessageId = ackMessage.content.original_message_id;
    const timeout = this.pendingAcks.get(originalMessageId);
    
    if (timeout) {
      clearTimeout(timeout);
      this.pendingAcks.delete(originalMessageId);
    }
  }
  
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      if (message) {
        this.sendMessage(message);
      }
    }
  }
  
  // ========================================================================
  // Task Management
  // ========================================================================
  
  public createTask(sessionId: string, taskDefinition: Partial<TaskDefinition>): string {
    const task: TaskDefinition = {
      id: this.generateId(),
      title: taskDefinition.title || '',
      description: taskDefinition.description || '',
      requirements: taskDefinition.requirements || [],
      priority: taskDefinition.priority || MessagePriority.NORMAL,
      dependencies: taskDefinition.dependencies || [],
      metadata: taskDefinition.metadata || {},
      ...taskDefinition
    };
    
    const message: ProtocolMessage = {
      id: this.generateId(),
      type: MessageType.TASK_ASSIGNMENT,
      sender: AgentRole.HUMAN,
      recipient: AgentRole.MANAGER,
      content: {
        task: task,
        session_id: sessionId
      },
      priority: task.priority,
      metadata: {
        session_id: sessionId,
        task_id: task.id,
        requires_ack: true
      },
      timestamp: Date.now()
    };
    
    this.sendMessage(message);
    this.emit('task_created', task);
    
    return task.id;
  }
  
  private handleTaskAssignment(message: ProtocolMessage): void {
    const task = message.content.task as TaskDefinition;
    // Update local task state if needed
    this.emit('task_created', task);
  }
  
  private handleTaskProgress(message: ProtocolMessage): void {
    const progress = message.content.progress as TaskProgress;
    this.tasks.set(progress.task_id, progress);
    this.emit('task_updated', progress.task_id, progress);
  }
  
  private handleTaskCompletion(message: ProtocolMessage): void {
    const taskId = message.content.task_id;
    const result = message.content.result;
    
    // Update task state
    const progress = this.tasks.get(taskId);
    if (progress) {
      progress.status = TaskStatus.COMPLETED;
      progress.progress_percent = 100;
      progress.outputs.push(result.output);
      this.emit('task_updated', taskId, progress);
    }
  }
  
  // ========================================================================
  // Human Intervention Management
  // ========================================================================
  
  private handleInterventionRequest(message: ProtocolMessage): void {
    const request: InterventionRequest = {
      intervention_id: message.content.intervention_id,
      task_id: message.content.task_id,
      reason: message.content.reason,
      context: message.content.context,
      requested_by: message.content.requested_by,
      urgency: message.content.urgency || 'normal',
      requested_at: message.timestamp,
      timeout_seconds: message.metadata.timeout_seconds || 300
    };
    
    this.pendingInterventions.set(request.intervention_id, request);
    this.emit('intervention_requested', request);
  }
  
  public provideIntervention(interventionId: string, response: HumanInterventionResponse): void {
    const request = this.pendingInterventions.get(interventionId);
    if (!request) {
      throw new Error(`Intervention request ${interventionId} not found`);
    }
    
    const message: ProtocolMessage = {
      id: this.generateId(),
      type: MessageType.HUMAN_INTERVENTION_PROVIDED,
      sender: AgentRole.HUMAN,
      recipient: AgentRole.MANAGER,
      content: response,
      priority: MessagePriority.HIGH,
      metadata: {
        task_id: request.task_id,
        requires_ack: true
      },
      timestamp: Date.now()
    };
    
    this.sendMessage(message);
    this.pendingInterventions.delete(interventionId);
  }
  
  private handleApprovalRequest(message: ProtocolMessage): void {
    const request: ApprovalRequest = {
      approval_id: message.content.approval_id,
      task_id: message.content.task_id,
      action: message.content.action,
      details: message.content.details,
      requested_by: message.content.requested_by,
      requested_at: message.timestamp,
      timeout_seconds: message.metadata.timeout_seconds || 180
    };
    
    this.pendingApprovals.set(request.approval_id, request);
    this.emit('approval_requested', request);
  }
  
  public provideApproval(approvalId: string, response: ApprovalResponse): void {
    const request = this.pendingApprovals.get(approvalId);
    if (!request) {
      throw new Error(`Approval request ${approvalId} not found`);
    }
    
    const message: ProtocolMessage = {
      id: this.generateId(),
      type: MessageType.APPROVAL_RESPONSE,
      sender: AgentRole.HUMAN,
      recipient: AgentRole.MANAGER,
      content: response,
      priority: MessagePriority.HIGH,
      metadata: {
        task_id: request.task_id,
        requires_ack: true
      },
      timestamp: Date.now()
    };
    
    this.sendMessage(message);
    this.pendingApprovals.delete(approvalId);
  }
  
  // ========================================================================
  // Quality Gate Management
  // ========================================================================
  
  private handleQualityResult(message: ProtocolMessage): void {
    const result = message.content.validation_result as ValidationResult;
    this.emit('quality_result', result);
  }
  
  public requestQualityCheck(taskId: string, gateId?: string, output?: Record<string, any>): void {
    const message: ProtocolMessage = {
      id: this.generateId(),
      type: MessageType.QUALITY_CHECK,
      sender: AgentRole.HUMAN,
      recipient: AgentRole.MANAGER,
      content: {
        task_id: taskId,
        gate_id: gateId || 'default',
        output: output || {}
      },
      priority: MessagePriority.NORMAL,
      metadata: {
        task_id: taskId,
        requires_ack: true
      },
      timestamp: Date.now()
    };
    
    this.sendMessage(message);
  }
  
  // ========================================================================
  // Agent Status and Coordination
  // ========================================================================
  
  private handleStatusUpdate(message: ProtocolMessage): void {
    const agentId = message.content.agent_id || message.sender;
    const status = message.content.status;
    
    if (agentId) {
      this.emit('agent_status_changed', agentId, status);
    }
  }
  
  private handleCoordinationEvent(message: ProtocolMessage): void {
    const event: CoordinationEvent = {
      type: message.type === MessageType.HANDOFF_INITIATE ? 'handoff' : 
            message.type === MessageType.HANDOFF_COMPLETE ? 'handoff' : 'handoff',
      session_id: message.metadata.session_id || '',
      from_agent: message.sender,
      to_agent: message.recipient,
      metadata: message.content,
      timestamp: message.timestamp
    };
    
    this.emit('coordination_event', event);
  }
  
  // ========================================================================
  // Public API Methods
  // ========================================================================
  
  public getPendingInterventions(): InterventionRequest[] {
    return Array.from(this.pendingInterventions.values());
  }
  
  public getPendingApprovals(): ApprovalRequest[] {
    return Array.from(this.pendingApprovals.values());
  }
  
  public getTaskProgress(taskId: string): TaskProgress | undefined {
    return this.tasks.get(taskId);
  }
  
  public getAllTasks(): Map<string, TaskProgress> {
    return new Map(this.tasks);
  }
  
  public isConnected(): boolean {
    return this.isConnected;
  }
  
  public getConnectionStats(): Record<string, any> {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      queuedMessages: this.messageQueue.length,
      pendingAcks: this.pendingAcks.size,
      pendingInterventions: this.pendingInterventions.size,
      pendingApprovals: this.pendingApprovals.size
    };
  }
  
  // ========================================================================
  // Utilities
  // ========================================================================
  
  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  public formatMessage(message: ProtocolMessage): string {
    const timestamp = new Date(message.timestamp).toLocaleTimeString();
    const priority = MessagePriority[message.priority] || message.priority;
    
    return `[${timestamp}] ${message.sender} → ${message.recipient} (${priority}): ${message.type}`;
  }
  
  public getMessageTypeLabel(type: MessageType): string {
    const labels: Record<MessageType, string> = {
      [MessageType.TASK_ASSIGNMENT]: 'Task Assignment',
      [MessageType.TASK_ACCEPTED]: 'Task Accepted',
      [MessageType.TASK_REJECTED]: 'Task Rejected',
      [MessageType.TASK_PROGRESS]: 'Task Progress',
      [MessageType.TASK_COMPLETION]: 'Task Completed',
      [MessageType.TASK_FAILED]: 'Task Failed',
      [MessageType.COORDINATION_REQUEST]: 'Coordination Request',
      [MessageType.COORDINATION_RESPONSE]: 'Coordination Response',
      [MessageType.HANDOFF_INITIATE]: 'Handoff Started',
      [MessageType.HANDOFF_COMPLETE]: 'Handoff Completed',
      [MessageType.QUALITY_CHECK]: 'Quality Check',
      [MessageType.QUALITY_RESULT]: 'Quality Result',
      [MessageType.VALIDATION_REQUEST]: 'Validation Request',
      [MessageType.VALIDATION_RESPONSE]: 'Validation Response',
      [MessageType.HUMAN_INTERVENTION_REQUESTED]: 'Human Intervention Required',
      [MessageType.HUMAN_INTERVENTION_PROVIDED]: 'Human Intervention Provided',
      [MessageType.APPROVAL_REQUEST]: 'Approval Required',
      [MessageType.APPROVAL_RESPONSE]: 'Approval Provided',
      [MessageType.HEARTBEAT]: 'Heartbeat',
      [MessageType.STATUS_UPDATE]: 'Status Update',
      [MessageType.ERROR_REPORT]: 'Error Report',
      [MessageType.SESSION_EVENT]: 'Session Event',
      [MessageType.ACK]: 'Acknowledgment',
      [MessageType.NACK]: 'Negative Acknowledgment',
      [MessageType.PING]: 'Ping',
      [MessageType.PONG]: 'Pong'
    };
    
    return labels[type] || type;
  }
  
  public getPriorityColor(priority: MessagePriority): string {
    const colors: Record<MessagePriority, string> = {
      [MessagePriority.LOW]: '#6B7280',
      [MessagePriority.NORMAL]: '#3B82F6',
      [MessagePriority.HIGH]: '#F59E0B',
      [MessagePriority.URGENT]: '#EF4444',
      [MessagePriority.CRITICAL]: '#DC2626'
    };
    
    return colors[priority] || '#6B7280';
  }
  
  public getTaskStatusColor(status: TaskStatus): string {
    const colors: Record<TaskStatus, string> = {
      [TaskStatus.PENDING]: '#6B7280',
      [TaskStatus.ASSIGNED]: '#3B82F6',
      [TaskStatus.IN_PROGRESS]: '#F59E0B',
      [TaskStatus.WAITING_REVIEW]: '#8B5CF6',
      [TaskStatus.COMPLETED]: '#10B981',
      [TaskStatus.FAILED]: '#EF4444',
      [TaskStatus.CANCELLED]: '#6B7280',
      [TaskStatus.REQUIRES_HUMAN]: '#F59E0B'
    };
    
    return colors[status] || '#6B7280';
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let agentServiceInstance: AgentService | null = null;

export function getAgentService(wsUrl?: string): AgentService {
  if (!agentServiceInstance) {
    agentServiceInstance = new AgentService(wsUrl);
  }
  return agentServiceInstance;
}

// ============================================================================
// React Hooks for Agent Service
// ============================================================================

export function useAgentService() {
  const service = getAgentService();
  return service;
}

// ============================================================================
// Message Formatting Utilities
// ============================================================================

export class MessageFormatter {
  static formatTaskAssignment(message: ProtocolMessage): string {
    const task = message.content.task as TaskDefinition;
    return `📋 New task assigned: "${task.title}" (Priority: ${MessagePriority[task.priority]})`;
  }
  
  static formatTaskProgress(message: ProtocolMessage): string {
    const progress = message.content.progress as TaskProgress;
    return `⏳ Task progress: ${progress.progress_percent}% - ${progress.current_step}`;
  }
  
  static formatTaskCompletion(message: ProtocolMessage): string {
    const result = message.content.result;
    return `✅ Task completed: ${result.output}`;
  }
  
  static formatInterventionRequest(message: ProtocolMessage): string {
    const reason = message.content.reason;
    const urgency = message.content.urgency || 'normal';
    return `🚨 Human intervention required (${urgency}): ${reason}`;
  }
  
  static formatApprovalRequest(message: ProtocolMessage): string {
    const action = message.content.action;
    return `🔍 Approval required for: ${action}`;
  }
  
  static formatQualityResult(message: ProtocolMessage): string {
    const result = message.content.validation_result as ValidationResult;
    const status = result.passed ? '✅ PASSED' : '❌ FAILED';
    return `🎯 Quality check ${status} (Score: ${(result.score * 100).toFixed(1)}%)`;
  }
  
  static formatMessage(message: ProtocolMessage): string {
    switch (message.type) {
      case MessageType.TASK_ASSIGNMENT:
        return MessageFormatter.formatTaskAssignment(message);
      case MessageType.TASK_PROGRESS:
        return MessageFormatter.formatTaskProgress(message);
      case MessageType.TASK_COMPLETION:
        return MessageFormatter.formatTaskCompletion(message);
      case MessageType.HUMAN_INTERVENTION_REQUESTED:
        return MessageFormatter.formatInterventionRequest(message);
      case MessageType.APPROVAL_REQUEST:
        return MessageFormatter.formatApprovalRequest(message);
      case MessageType.QUALITY_RESULT:
        return MessageFormatter.formatQualityResult(message);
      default:
        return `${message.type}: ${JSON.stringify(message.content)}`;
    }
  }
}

export default AgentService;