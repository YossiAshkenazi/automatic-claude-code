# API Documentation - Dual-Agent System

## Agent Communication API

The dual-agent system uses a structured communication protocol for coordination between Manager and Worker agents.

### Core Interfaces

#### AgentMessage Interface
```typescript
interface AgentMessage {
  id: string;                    // Unique message identifier
  from: AgentType;              // Source agent
  to: AgentType;                // Target agent  
  type: MessageType;            // Message category
  payload: MessagePayload;      // Message content
  timestamp: Date;              // Creation time
  priority: MessagePriority;    // Urgency level
  correlationId?: string;       // Related message chain
  retryCount?: number;          // Retry attempts
}

type AgentType = 'manager' | 'worker';
type MessagePriority = 'low' | 'normal' | 'high' | 'urgent';
```

#### MessageType Enumeration
```typescript
enum MessageType {
  // Manager → Worker
  TASK_ASSIGNMENT = 'task_assignment',
  STRATEGY_UPDATE = 'strategy_update',
  APPROVAL_RESPONSE = 'approval_response',
  GUIDANCE = 'guidance',
  
  // Worker → Manager  
  PROGRESS_UPDATE = 'progress_update',
  COMPLETION_REPORT = 'completion_report',
  APPROVAL_REQUEST = 'approval_request',
  GUIDANCE_REQUEST = 'guidance_request',
  
  // Bidirectional
  ERROR_REPORT = 'error_report',
  STATUS_PING = 'status_ping',
  QUALITY_CHECK = 'quality_check'
}
```

### Message Payloads

#### Task Assignment Payload
```typescript
interface TaskAssignmentPayload {
  taskId: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: TaskPriority;
  estimatedComplexity: number;  // 1-10 scale
  dependencies: string[];       // Task IDs
  resources: TaskResource[];
  deadline?: Date;
  context?: {
    relatedFiles: string[];
    relevantDocumentation: string[];
    previousAttempts?: string[];
  };
}

interface TaskResource {
  type: 'file' | 'api' | 'documentation' | 'example';
  path: string;
  description?: string;
}

enum TaskPriority {
  LOW = 'low',
  NORMAL = 'normal', 
  HIGH = 'high',
  CRITICAL = 'critical'
}
```

#### Progress Update Payload
```typescript
interface ProgressUpdatePayload {
  taskId: string;
  status: TaskStatus;
  progress: number;            // 0-100 percentage
  completedSteps: string[];
  currentStep: string;
  remainingSteps: string[];
  blockers: TaskBlocker[];
  estimatedCompletion: string; // Human readable time
  resourcesUsed: string[];     // Tools, files accessed
  qualityMetrics?: {
    testsAdded: number;
    testsPassing: number;
    codeQualityScore: number;
    documentation: boolean;
  };
}

enum TaskStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  BLOCKED = 'blocked',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

interface TaskBlocker {
  type: 'technical' | 'dependency' | 'resource' | 'requirement';
  description: string;
  severity: 'low' | 'medium' | 'high';
  suggestedResolution?: string;
}
```

#### Completion Report Payload
```typescript
interface CompletionReportPayload {
  taskId: string;
  status: 'completed' | 'failed';
  deliverables: Deliverable[];
  testResults?: TestResults;
  qualityMetrics: QualityMetrics;
  notes: string;
  nextSteps?: string[];
  validationRequired: boolean;
  timeSpent: number;           // Minutes
}

interface Deliverable {
  type: 'file' | 'configuration' | 'documentation' | 'test';
  path: string;
  description: string;
  changes: FileChange[];
}

interface FileChange {
  operation: 'created' | 'modified' | 'deleted';
  linesAdded: number;
  linesRemoved: number;
  summary: string;
}

interface QualityMetrics {
  codeQuality: number;        // 0-1 score
  testCoverage: number;       // 0-1 percentage  
  documentation: boolean;
  bestPractices: boolean;
  security: number;           // 0-1 score
  performance: number;        // 0-1 score
}
```

#### Quality Check Payload
```typescript
interface QualityCheckPayload {
  taskId: string;
  checkType: QualityCheckType;
  criteria: QualityChecklist;
  results: QualityResults;
  approved: boolean;
  feedback: string[];
  requiredChanges?: string[];
}

enum QualityCheckType {
  CODE_REVIEW = 'code_review',
  INTEGRATION_TEST = 'integration_test',
  SECURITY_AUDIT = 'security_audit',
  PERFORMANCE_CHECK = 'performance_check',
  DOCUMENTATION_REVIEW = 'documentation_review'
}

interface QualityChecklist {
  codeStandards: boolean;
  testCoverage: boolean;
  documentation: boolean;
  security: boolean;
  performance: boolean;
  integration: boolean;
}
```

## Agent Coordinator API

### AgentCoordinator Class

```typescript
class AgentCoordinator {
  private managerAgent: ManagerAgent;
  private workerAgent: WorkerAgent;
  private messageQueue: MessageQueue;
  private sessionManager: DualAgentSessionManager;

  constructor(config: DualAgentConfig) {
    this.managerAgent = new ManagerAgent(config.managerModel);
    this.workerAgent = new WorkerAgent(config.workerModel);
    this.messageQueue = new MessageQueue();
    this.sessionManager = new DualAgentSessionManager();
  }

  async startSession(userPrompt: string): Promise<string> {
    const sessionId = await this.sessionManager.createSession(userPrompt);
    await this.managerAgent.initialize(sessionId, userPrompt);
    await this.workerAgent.initialize(sessionId);
    return sessionId;
  }

  async executeWorkflow(sessionId: string): Promise<WorkflowResult> {
    const workflow = await this.managerAgent.createWorkflow();
    return await this.coordinateExecution(workflow);
  }

  private async coordinateExecution(workflow: Workflow): Promise<WorkflowResult> {
    // Implementation details...
  }
}
```

### Configuration Interface

```typescript
interface DualAgentConfig {
  enabled: boolean;
  managerModel: 'opus' | 'sonnet' | 'haiku';
  workerModel: 'opus' | 'sonnet' | 'haiku';
  coordinationInterval: number;     // Seconds between coordination checks
  qualityGateThreshold: number;     // 0-1, minimum quality score
  maxConcurrentTasks: number;       // Maximum parallel tasks
  enableCrossValidation: boolean;   // Agents review each other's work
  communicationTimeout: number;     // Milliseconds
  retryAttempts: number;           // Maximum retry attempts
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}
```

## Web UI API Endpoints

### Session Management Endpoints

#### GET /api/sessions
```typescript
// Get all sessions with dual-agent information
interface SessionListResponse {
  sessions: SessionSummary[];
  total: number;
  page: number;
  pageSize: number;
}

interface SessionSummary {
  id: string;
  userPrompt: string;
  mode: 'single-agent' | 'dual-agent';
  status: SessionStatus;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  agentInfo?: {
    managerModel: string;
    workerModel: string;
    messagesExchanged: number;
    tasksCompleted: number;
    qualityGatesPassed: number;
  };
}
```

#### GET /api/sessions/:id
```typescript
// Get detailed session information
interface SessionDetailResponse {
  session: SessionDetail;
  timeline: TimelineEvent[];
  agentCommunication: AgentMessage[];
  qualityGates: QualityGateResult[];
  metrics: SessionMetrics;
}

interface SessionDetail extends SessionSummary {
  workDir: string;
  config: DualAgentConfig;
  tasks: TaskDetail[];
  finalReport: string;
}

interface TaskDetail {
  id: string;
  title: string;
  status: TaskStatus;
  assignedTo: AgentType;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  deliverables: Deliverable[];
  qualityScore: number;
}
```

### Agent Monitoring Endpoints

#### GET /api/agents/status
```typescript
// Real-time agent status
interface AgentStatusResponse {
  manager: AgentStatus;
  worker: AgentStatus;
  coordination: CoordinationStatus;
  lastUpdated: Date;
}

interface AgentStatus {
  id: string;
  type: AgentType;
  model: string;
  status: 'idle' | 'active' | 'waiting' | 'error';
  currentTask?: string;
  messagesSent: number;
  messagesReceived: number;
  averageResponseTime: number;
  lastActivity: Date;
  metrics: AgentMetrics;
}

interface CoordinationStatus {
  messagesExchanged: number;
  averageResolutionTime: number;
  qualityGateSuccessRate: number;
  activeCoordinations: number;
  coordinationEfficiency: number; // 0-1 score
}
```

#### GET /api/agents/communication
```typescript
// Agent communication log
interface CommunicationLogResponse {
  messages: AgentMessage[];
  total: number;
  filters: {
    agentType?: AgentType;
    messageType?: MessageType;
    timeRange?: DateRange;
    sessionId?: string;
  };
  pagination: PaginationInfo;
}
```

### Quality Gate Endpoints

#### GET /api/quality-gates
```typescript
// Quality gate results
interface QualityGateResponse {
  gates: QualityGateResult[];
  summary: QualityGateSummary;
}

interface QualityGateResult {
  id: string;
  sessionId: string;
  taskId: string;
  timestamp: Date;
  checkType: QualityCheckType;
  score: number;
  passed: boolean;
  feedback: string[];
  details: QualityGateDetails;
}

interface QualityGateSummary {
  totalGates: number;
  passed: number;
  failed: number;
  averageScore: number;
  byType: Record<QualityCheckType, QualityGateStats>;
}
```

### Metrics and Analytics Endpoints

#### GET /api/metrics/performance
```typescript
// Performance metrics
interface PerformanceMetricsResponse {
  timeRange: DateRange;
  sessions: {
    total: number;
    singleAgent: number;
    dualAgent: number;
    successRate: number;
  };
  agentPerformance: {
    manager: AgentPerformanceMetrics;
    worker: AgentPerformanceMetrics;
  };
  coordination: CoordinationMetrics;
}

interface AgentPerformanceMetrics {
  averageResponseTime: number;
  taskSuccessRate: number;
  qualityScore: number;
  efficiency: number;
  resourceUtilization: number;
}

interface CoordinationMetrics {
  averageCoordinationTime: number;
  communicationEfficiency: number;
  taskHandoffSuccess: number;
  conflictResolutionTime: number;
}
```

## WebSocket Events

### Real-time Event Streaming

```typescript
// WebSocket connection for real-time updates
interface WebSocketEvent {
  type: EventType;
  sessionId: string;
  timestamp: Date;
  data: EventData;
}

enum EventType {
  SESSION_STARTED = 'session_started',
  SESSION_COMPLETED = 'session_completed',
  AGENT_MESSAGE = 'agent_message',
  TASK_ASSIGNED = 'task_assigned',
  TASK_COMPLETED = 'task_completed',
  QUALITY_GATE_RESULT = 'quality_gate_result',
  ERROR_OCCURRED = 'error_occurred',
  STATUS_UPDATE = 'status_update'
}

// Subscribe to events
const ws = new WebSocket('ws://localhost:4000/events');
ws.onmessage = (event) => {
  const wsEvent: WebSocketEvent = JSON.parse(event.data);
  handleRealtimeUpdate(wsEvent);
};
```

## Hook Integration API

### Enhanced Hook Events

```typescript
// Extended hook events for dual-agent mode
interface DualAgentHookEvent extends HookEvent {
  agentType: AgentType;
  messageId?: string;
  taskId?: string;
  coordinationPhase?: CoordinationPhase;
}

enum CoordinationPhase {
  PLANNING = 'planning',
  ASSIGNMENT = 'assignment', 
  EXECUTION = 'execution',
  VALIDATION = 'validation',
  INTEGRATION = 'integration'
}

// Hook script environment variables
interface DualAgentHookEnv extends HookEnv {
  CLAUDE_AGENT_TYPE: AgentType;
  CLAUDE_MESSAGE_TYPE: MessageType;
  CLAUDE_TASK_ID: string;
  CLAUDE_COORDINATION_PHASE: CoordinationPhase;
  CLAUDE_QUALITY_SCORE: string;
}
```

### Custom Hook Examples

#### Agent Communication Hook
```powershell
# agent-communication-hook.ps1
param(
    [string]$AgentType,
    [string]$MessageType,
    [string]$TaskId,
    [string]$Message
)

$payload = @{
    eventType = "agent_communication"
    agentType = $AgentType
    messageType = $MessageType
    taskId = $TaskId
    message = $Message
    timestamp = (Get-Date).ToString("o")
    projectPath = $env:CLAUDE_PROJECT_PATH
} | ConvertTo-Json -Compress

Invoke-WebRequest -Uri "http://localhost:4000/events" -Method Post -Body $payload -ContentType "application/json" -TimeoutSec 2
```

#### Quality Gate Hook
```bash
#!/bin/bash
# quality-gate-hook.sh
AGENT_TYPE=${CLAUDE_AGENT_TYPE}
TASK_ID=${CLAUDE_TASK_ID}  
QUALITY_SCORE=${CLAUDE_QUALITY_SCORE}
GATE_RESULT=${CLAUDE_GATE_RESULT}

curl -X POST http://localhost:4000/events \
  -H "Content-Type: application/json" \
  -d "{
    \"eventType\": \"quality_gate_result\",
    \"agentType\": \"$AGENT_TYPE\",
    \"taskId\": \"$TASK_ID\",
    \"qualityScore\": $QUALITY_SCORE,
    \"result\": \"$GATE_RESULT\",
    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)\"
  }" \
  --max-time 2
```

This comprehensive API documentation provides all the necessary interfaces and endpoints for integrating with and extending the dual-agent system.