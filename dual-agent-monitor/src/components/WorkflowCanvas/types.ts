import { Node, Edge, NodeProps, EdgeProps } from 'reactflow';
import { DualAgentSession, AgentMessage } from '../../types';

// Core workflow types
export interface WorkflowNode extends Omit<Node, 'type' | 'data'> {
  id: string;
  type: 'agent' | 'task' | 'communication' | 'milestone';
  position: { x: number; y: number };
  data: AgentNodeData | TaskFlowData | CommunicationData | MilestoneData;
}

export interface WorkflowEdge extends Omit<Edge, 'type' | 'data'> {
  id: string;
  source: string;
  target: string;
  type?: 'default' | 'animated' | 'smoothstep' | 'task-flow' | 'communication';
  data?: {
    taskId?: string;
    messageId?: string;
    messageType?: 'prompt' | 'response' | 'tool_call' | 'tool_result' | 'system';
    progress?: number;
    status?: 'pending' | 'in-progress' | 'completed' | 'failed' | 'assigned';
    animated?: boolean;
    color?: string;
    timestamp?: Date;
  };
}

// Agent node data
export interface AgentNodeData {
  agentId: string;
  agentType: 'manager' | 'worker';
  status: 'idle' | 'busy' | 'error' | 'offline';
  name: string;
  currentTask?: string;
  lastActivity?: Date;
  messageCount: number;
  performance: {
    tasksCompleted: number;
    averageResponseTime: number;
    successRate: number;
  };
  position?: { x: number; y: number };
}

// Task flow data
export interface TaskFlowData {
  taskId: string;
  title: string;
  description?: string;
  status: 'pending' | 'assigned' | 'in-progress' | 'completed' | 'failed';
  assignedAgent?: 'manager' | 'worker';
  progress: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  estimatedDuration?: number;
  actualDuration?: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  metadata?: {
    files?: string[];
    tools?: string[];
    dependencies?: string[];
  };
}

// Communication data
export interface CommunicationData {
  messageId: string;
  fromAgent: 'manager' | 'worker';
  toAgent: 'manager' | 'worker';
  messageType: 'prompt' | 'response' | 'tool_call' | 'tool_result' | 'system';
  timestamp: Date;
  content: string;
  status: 'sent' | 'received' | 'processing' | 'error';
  metadata?: {
    duration?: number;
    tokenCount?: number;
    cost?: number;
  };
}

// Milestone data
export interface MilestoneData {
  milestoneId: string;
  title: string;
  description?: string;
  status: 'upcoming' | 'current' | 'completed' | 'missed';
  targetDate?: Date;
  completedDate?: Date;
  criteria: string[];
  progress: number;
}

// Component props
export interface WorkflowCanvasProps {
  session: DualAgentSession;
  messages: AgentMessage[];
  isRealTime?: boolean;
  onNodeSelect?: (nodeId: string, nodeType: string) => void;
  onEdgeSelect?: (edgeId: string) => void;
  onTaskAssign?: (taskId: string, agentType: 'manager' | 'worker') => void;
  onTaskCreate?: (task: Partial<TaskFlowData>) => void;
  showControls?: boolean;
  showMinimap?: boolean;
  enableInteraction?: boolean;
  height?: string | number;
  className?: string;
}

export interface FlowCanvasProps {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  onNodesChange: (changes: any[]) => void;
  onEdgesChange: (changes: any[]) => void;
  onConnect: (connection: any) => void;
  onNodeClick?: (event: React.MouseEvent, node: WorkflowNode) => void;
  onEdgeClick?: (event: React.MouseEvent, edge: WorkflowEdge) => void;
  onSelectionChange?: (selection: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }) => void;
  showMinimap?: boolean;
  showControls?: boolean;
  enableInteraction?: boolean;
  height?: string | number;
  className?: string;
}

export interface AgentNodeProps extends Omit<NodeProps, 'data'> {
  data: AgentNodeData;
  onTaskAssign?: (taskId: string) => void;
}

export interface TaskNodeProps extends Omit<NodeProps, 'data'> {
  data: TaskFlowData;
  onStatusChange?: (status: TaskFlowData['status']) => void;
  onAgentAssign?: (agentType: 'manager' | 'worker') => void;
}

// Workflow state management
export interface WorkflowState {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNodes: string[];
  selectedEdges: string[];
  viewMode: 'overview' | 'detailed' | 'timeline' | 'communication';
  filters: {
    showCompleted: boolean;
    showPending: boolean;
    showInProgress: boolean;
    showFailed: boolean;
    agentFilter: 'all' | 'manager' | 'worker';
    timeRange: 'all' | '1h' | '24h' | '7d';
  };
}

// Animation and visual effects
export interface AnimationConfig {
  taskFlow: {
    duration: number;
    easing: string;
    color: string;
  };
  communication: {
    duration: number;
    easing: string;
    pulseColor: string;
  };
  nodeStatusChange: {
    duration: number;
    scale: number;
  };
}

// Layout configuration
export interface LayoutConfig {
  nodeSpacing: {
    horizontal: number;
    vertical: number;
  };
  agentPositions: {
    manager: { x: number; y: number };
    worker: { x: number; y: number };
  };
  autoLayout: boolean;
  layoutDirection: 'TB' | 'BT' | 'LR' | 'RL';
}