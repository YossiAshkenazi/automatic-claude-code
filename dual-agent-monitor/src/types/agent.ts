// Enhanced agent types for multi-agent management
export interface Agent {
  id: string;
  name: string;
  type: 'manager' | 'worker' | 'specialist';
  role: 'claude-opus' | 'claude-sonnet' | 'claude-haiku';
  status: 'idle' | 'active' | 'working' | 'error' | 'offline' | 'starting' | 'stopping';
  createdAt: Date;
  lastActivity?: Date;
  configuration: AgentConfiguration;
  metrics: AgentMetrics;
  currentTask?: string;
  sessionId?: string;
}

export interface AgentConfiguration {
  model: string;
  maxTokens: number;
  temperature: number;
  maxIterations?: number;
  timeoutSeconds: number;
  workingDirectory?: string;
  specialization?: string;
  capabilities: string[];
  resourceLimits: {
    maxMemoryMB: number;
    maxCpuPercent: number;
  };
}

export interface AgentMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageResponseTime: number; // ms
  totalTokensUsed: number;
  totalCost: number;
  uptime: number; // ms
  lastResponseTime?: number;
  memoryUsage?: number; // MB
  cpuUsage?: number; // %
  healthScore: number; // 0-100
}

export interface AgentCommunication {
  id: string;
  fromAgent: string;
  toAgent: string;
  messageType: 'task_assignment' | 'progress_update' | 'completion_report' | 'error_report' | 'coordination' | 'status_check';
  content: string;
  timestamp: Date;
  metadata?: {
    taskId?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    responseRequired?: boolean;
    attachments?: string[];
  };
}

export interface AgentTask {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  estimatedDuration?: number; // minutes
  actualDuration?: number; // minutes
  dependencies?: string[]; // task IDs
  results?: any;
  error?: string;
}

export interface AgentWorkflow {
  id: string;
  name: string;
  description: string;
  agents: string[]; // agent IDs
  tasks: AgentTask[];
  status: 'draft' | 'active' | 'paused' | 'completed' | 'failed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  coordination: {
    managerAgent: string;
    workerAgents: string[];
    communicationPattern: 'sequential' | 'parallel' | 'hierarchical';
  };
}

export interface CreateAgentRequest {
  name: string;
  type: Agent['type'];
  role: Agent['role'];
  configuration: Partial<AgentConfiguration>;
  specialization?: string;
}

export interface UpdateAgentRequest {
  id: string;
  configuration?: Partial<AgentConfiguration>;
  name?: string;
  specialization?: string;
}

export interface AgentCommand {
  type: 'start' | 'stop' | 'pause' | 'resume' | 'restart' | 'configure' | 'assign_task';
  payload?: any;
}

export interface AgentEvent {
  id: string;
  agentId: string;
  type: 'created' | 'started' | 'stopped' | 'error' | 'task_assigned' | 'task_completed' | 'communication';
  timestamp: Date;
  data: any;
  severity: 'info' | 'warning' | 'error' | 'success';
}

// Real-time agent status for WebSocket updates
export interface AgentStatusUpdate {
  agentId: string;
  status: Agent['status'];
  metrics?: Partial<AgentMetrics>;
  currentTask?: string;
  lastActivity?: Date;
  healthScore?: number;
}