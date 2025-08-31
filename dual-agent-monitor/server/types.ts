export interface AgentMessage {
  id: string;
  sessionId: string;
  agentType: 'manager' | 'worker';
  messageType: 'prompt' | 'response' | 'tool_call' | 'error' | 'system';
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
  status: 'running' | 'completed' | 'failed' | 'paused';
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

export interface AgentCommunication {
  id: string;
  sessionId: string;
  fromAgent: 'manager' | 'worker';
  toAgent: 'manager' | 'worker';
  messageType: 'instruction' | 'feedback' | 'result' | 'question';
  content: string;
  timestamp: Date;
  relatedMessageId?: string;
}

export interface SystemEvent {
  id: string;
  sessionId: string;
  eventType: 'session_start' | 'session_end' | 'agent_switch' | 'error' | 'pause' | 'resume';
  details: string;
  timestamp: Date;
}

export interface PerformanceMetrics {
  sessionId: string;
  agentType: 'manager' | 'worker';
  responseTime: number;
  tokensUsed?: number;
  cost?: number;
  errorRate: number;
  timestamp: Date;
}

export interface WebSocketMessage {
  type: 'new_message' | 'session_update' | 'system_event' | 'performance_update' | 'session_list';
  data: AgentMessage | DualAgentSession | SystemEvent | PerformanceMetrics | DualAgentSession[];
}