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

// Webhook Types
export type WebhookEvent = 
  | 'session.started'
  | 'session.completed'
  | 'session.failed'
  | 'agent.message'
  | 'performance.alert'
  | 'anomaly.detected'
  | 'user.login'
  | 'cost.threshold'
  | 'webhook.test';

export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  secret?: string;
  events: WebhookEvent[];
  active: boolean;
  headers?: Record<string, string>;
  payloadFields?: string[];
  filters?: Record<string, any>;
  integration?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookEventPayload {
  sessionId?: string;
  agentType?: 'manager' | 'worker';
  message?: AgentMessage;
  session?: DualAgentSession;
  metrics?: PerformanceMetrics;
  alert?: {
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    details?: any;
  };
  user?: {
    id: string;
    email: string;
    timestamp: Date;
  };
  cost?: {
    current: number;
    threshold: number;
    period: string;
  };
  anomaly?: {
    type: string;
    confidence: number;
    description: string;
    data: any;
  };
}

export interface WebhookDeliveryResult {
  success: boolean;
  statusCode: number;
  response?: any;
  error?: string;
  deliveredAt: Date;
  duration: number;
}

export interface WebhookDeliveryLog {
  id: string;
  endpointId: string;
  event: WebhookEvent;
  payload: any;
  result: WebhookDeliveryResult;
  timestamp: Date;
}

export interface WebhookConfig {
  maxRetries: number;
  retryDelayMs: number;
  timeoutMs: number;
  enableSignatureVerification: boolean;
  enableRateLimiting: boolean;
  enableDeadLetterQueue: boolean;
}

export interface WebhookTemplate {
  id: string;
  name: string;
  description: string;
  integration: string;
  defaultEvents: WebhookEvent[];
  defaultHeaders: Record<string, string>;
  defaultPayloadFields: string[];
  defaultFilters: Record<string, any>;
  configSchema: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'select';
    required: boolean;
    description: string;
    options?: string[];
  }>;
}

export interface WebhookIntegration {
  id: string;
  name: string;
  description: string;
  iconUrl?: string;
  category: 'communication' | 'project-management' | 'monitoring' | 'development' | 'other';
  setupInstructions: string[];
  configFields: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'select';
    required: boolean;
    description: string;
    options?: string[];
  }>;
}