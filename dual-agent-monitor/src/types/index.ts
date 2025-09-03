export interface AgentMessage {
  id: string;
  sessionId: string;
  agentType: 'manager' | 'worker';
  messageType: 'prompt' | 'response' | 'tool_call' | 'tool_use' | 'tool_result' | 'error' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    tools?: string[];
    files?: string[];
    commands?: string[];
    cost?: number;
    duration?: number;
    exitCode?: number;
  };
}

export interface DualAgentSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  lastActivity?: string;
  status: 'running' | 'completed' | 'failed' | 'paused' | 'error';
  initialTask: string;
  workDir: string;
  messages: AgentMessage[];
  summary?: SessionSummary;
}

export interface SessionSummary {
  totalMessages: number;
  managerMessages: number;
  workerMessages: number;
  totalDuration: number;
  totalCost?: number;
  filesModified: string[];
  commandsExecuted: string[];
  toolsUsed: string[];
  successRate: number;
}

export interface WebSocketMessage {
  type: 'new_message' | 'session_update' | 'system_event' | 'performance_update' | 'session_list' | 'session_created' | 'session_deleted' | 'error' | 'send_message';
  data: any;
}

export interface SessionControlProps {
  session: DualAgentSession;
  onStatusChange: (sessionId: string, status: DualAgentSession['status']) => void;
}

export interface MessagePaneProps {
  agentType: 'manager' | 'worker';
  messages: AgentMessage[];
  session: DualAgentSession;
}

// Re-export agent types
export type {
  Agent,
  AgentConfiguration,
  AgentMetrics,
  AgentCommunication,
  AgentTask,
  AgentWorkflow,
  CreateAgentRequest,
  UpdateAgentRequest,
  AgentCommand,
  AgentEvent,
  AgentStatusUpdate
} from './agent';

// Task Management Types
export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedAgent?: 'manager' | 'worker' | null;
  sessionId?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  estimatedDuration?: number; // in minutes
  actualDuration?: number; // in minutes
  progress: number; // 0-100
  tags: string[];
  dependencies: string[]; // Task IDs
  requirements: TaskRequirement[];
  result?: TaskResult;
  metadata?: {
    complexity?: 'simple' | 'moderate' | 'complex';
    toolsRequired?: string[];
    filesAffected?: string[];
    estimatedCost?: number;
  };
}

export interface TaskRequirement {
  id: string;
  type: 'file' | 'tool' | 'capability' | 'dependency';
  description: string;
  required: boolean;
  fulfilled: boolean;
  value?: string;
}

export interface TaskResult {
  success: boolean;
  output?: string;
  error?: string;
  filesCreated?: string[];
  filesModified?: string[];
  commandsExecuted?: string[];
  toolsUsed?: string[];
  metrics?: {
    executionTime: number;
    memoryUsed?: number;
    apiCalls?: number;
    cost?: number;
  };
}

export interface TaskQueue {
  id: string;
  name: string;
  tasks: Task[];
  maxConcurrency: number;
  currentlyRunning: number;
  status: 'active' | 'paused' | 'stopped';
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  template: Partial<Task>;
  isPublic: boolean;
  createdBy: string;
  usageCount: number;
}

export interface TaskFilter {
  status?: Task['status'][];
  priority?: Task['priority'][];
  assignedAgent?: Task['assignedAgent'][];
  tags?: string[];
  dateRange?: { start: Date; end: Date };
  searchTerm?: string;
}

export interface TaskMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  pendingTasks: number;
  averageCompletionTime: number;
  successRate: number;
  tasksPerAgent: { [agentType: string]: number };
  tasksByPriority: { [priority: string]: number };
  tasksByStatus: { [status: string]: number };
}