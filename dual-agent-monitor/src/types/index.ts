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