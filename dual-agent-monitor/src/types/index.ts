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

export interface WebSocketMessage {
  type: 'new_message' | 'session_update' | 'system_event' | 'performance_update' | 'session_list';
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