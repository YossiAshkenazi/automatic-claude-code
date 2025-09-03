import React, { memo, useCallback, useEffect, useState, useMemo } from 'react';
import { useNodesState, useEdgesState, addEdge, Node, Edge } from 'reactflow';
import { toast } from 'sonner';

import { FlowCanvas } from './FlowCanvas';
import { WorkflowControls } from './WorkflowControls';
import { ProgressIndicator } from './ProgressIndicator';
import {
  WorkflowCanvasProps,
  WorkflowNode,
  WorkflowEdge,
  AgentNodeData,
  TaskFlowData,
  WorkflowState,
  LayoutConfig
} from './types';
import { DualAgentSession, AgentMessage } from '../../types';

// Layout constants
const DEFAULT_LAYOUT: LayoutConfig = {
  nodeSpacing: {
    horizontal: 300,
    vertical: 200
  },
  agentPositions: {
    manager: { x: 100, y: 100 },
    worker: { x: 500, y: 100 }
  },
  autoLayout: true,
  layoutDirection: 'LR'
};

const WorkflowCanvas = memo<WorkflowCanvasProps>(({ 
  session,
  messages,
  isRealTime = false,
  onNodeSelect,
  onEdgeSelect,
  onTaskAssign,
  onTaskCreate,
  showControls = true,
  showMinimap = true,
  enableInteraction = true,
  height = '600px',
  className = ''
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isPlaying, setIsPlaying] = useState(isRealTime);
  const [workflowState, setWorkflowState] = useState<WorkflowState>({
    nodes: [],
    edges: [],
    selectedNodes: [],
    selectedEdges: [],
    viewMode: 'overview',
    filters: {
      showCompleted: true,
      showPending: true,
      showInProgress: true,
      showFailed: true,
      agentFilter: 'all',
      timeRange: 'all'
    }
  });
  const [layout, setLayout] = useState<LayoutConfig>(DEFAULT_LAYOUT);

  // Generate workflow nodes and edges from session data
  const generateWorkflowElements = useCallback(() => {
    const workflowNodes: WorkflowNode[] = [];
    const workflowEdges: WorkflowEdge[] = [];
    const taskMap = new Map<string, TaskFlowData>();

    // Create agent nodes
    const managerPerformance = calculateAgentPerformance(messages, 'manager');
    const workerPerformance = calculateAgentPerformance(messages, 'worker');

    const managerNode: WorkflowNode = {
      id: 'manager-agent',
      type: 'agent',
      position: layout.agentPositions.manager,
      data: {
        agentId: 'manager',
        agentType: 'manager',
        status: session.status === 'running' ? 'busy' : 'idle',
        name: 'Manager Agent',
        currentTask: getCurrentTask(messages, 'manager'),
        lastActivity: getLastActivity(messages, 'manager'),
        messageCount: messages.filter(m => m.agentType === 'manager').length,
        performance: managerPerformance
      } as AgentNodeData
    };

    const workerNode: WorkflowNode = {
      id: 'worker-agent',
      type: 'agent',
      position: layout.agentPositions.worker,
      data: {
        agentId: 'worker',
        agentType: 'worker',
        status: session.status === 'running' ? 'busy' : 'idle',
        name: 'Worker Agent',
        currentTask: getCurrentTask(messages, 'worker'),
        lastActivity: getLastActivity(messages, 'worker'),
        messageCount: messages.filter(m => m.agentType === 'worker').length,
        performance: workerPerformance
      } as AgentNodeData
    };

    workflowNodes.push(managerNode, workerNode);

    // Generate task nodes from messages
    const tasks = extractTasksFromMessages(messages);
    tasks.forEach((task, index) => {
      const taskNode: WorkflowNode = {
        id: `task-${task.taskId}`,
        type: 'task',
        position: {
          x: 300,
          y: 300 + (index * layout.nodeSpacing.vertical)
        },
        data: task
      };
      workflowNodes.push(taskNode);
      taskMap.set(task.taskId, task);
    });

    // Create edges between agents and tasks
    messages.forEach((message, index) => {
      if (message.messageType === 'prompt' || message.messageType === 'response') {
        const sourceAgent = message.agentType === 'manager' ? 'manager-agent' : 'worker-agent';
        const targetAgent = message.agentType === 'manager' ? 'worker-agent' : 'manager-agent';
        
        const edge: WorkflowEdge = {
          id: `msg-${message.id}`,
          source: sourceAgent,
          target: targetAgent,
          type: 'communication',
          animated: isRealTime && index === messages.length - 1,
          data: {
            messageId: message.id,
            messageType: message.messageType,
            timestamp: message.timestamp,
            status: 'completed' as const,
            color: message.messageType === 'prompt' ? '#3b82f6' : '#10b981'
          }
        };
        workflowEdges.push(edge);
      }
    });

    // Connect tasks to agents
    tasks.forEach(task => {
      if (task.assignedAgent) {
        const agentId = `${task.assignedAgent}-agent`;
        const taskId = `task-${task.taskId}`;
        
        const edge: WorkflowEdge = {
          id: `assignment-${task.taskId}`,
          source: agentId,
          target: taskId,
          type: 'task-flow',
          animated: task.status === 'in-progress',
          data: {
            taskId: task.taskId,
            progress: task.progress,
            status: task.status as 'pending' | 'in-progress' | 'completed' | 'failed' | 'assigned',
            color: getTaskStatusColor(task.status)
          }
        };
        workflowEdges.push(edge);
      }
    });

    return { nodes: workflowNodes, edges: workflowEdges };
  }, [session, messages, layout, isRealTime]);

  // Update nodes and edges when session or messages change
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = generateWorkflowElements();
    setNodes(newNodes as any);
    setEdges(newEdges as any);
  }, [generateWorkflowElements, setNodes, setEdges]);

  // Real-time animation updates
  useEffect(() => {
    if (isRealTime && isPlaying) {
      const interval = setInterval(() => {
        setNodes(nodes => 
          nodes.map(node => {
            if (node.type === 'agent') {
              const agentData = node.data as AgentNodeData;
              // Update agent status based on recent activity
              const recentActivity = getLastActivity(messages, agentData.agentType);
              const isActive = recentActivity && 
                (Date.now() - recentActivity.getTime()) < 30000; // 30 seconds
              
              return {
                ...node,
                data: {
                  ...agentData,
                  status: isActive ? 'busy' : 'idle'
                }
              };
            }
            return node;
          })
        );
      }, 5000); // Update every 5 seconds

      return () => clearInterval(interval);
    }
  }, [isRealTime, isPlaying, messages]);

  // Handle node connections
  const onConnect = useCallback(
    (connection: any) => {
      setEdges(edges => addEdge({
        ...connection,
        type: 'default',
        animated: true
      }, edges));
    },
    [setEdges]
  );

  // Handle node clicks
  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: WorkflowNode) => {
      onNodeSelect?.(node.id, node.type);
      
      // Show node details in toast
      if (node.type === 'agent') {
        const agentData = node.data as AgentNodeData;
        toast.info(`${agentData.name} - ${agentData.status}`, {
          description: `Messages: ${agentData.messageCount}, Success Rate: ${Math.round(agentData.performance.successRate * 100)}%`
        });
      } else if (node.type === 'task') {
        const taskData = node.data as TaskFlowData;
        toast.info(`${taskData.title}`, {
          description: `Status: ${taskData.status}, Progress: ${taskData.progress}%`
        });
      }
    },
    [onNodeSelect]
  );

  // Handle edge clicks
  const onEdgeClick = useCallback(
    (event: React.MouseEvent, edge: WorkflowEdge) => {
      onEdgeSelect?.(edge.id);
      
      if (edge.data?.messageType) {
        toast.info(`${edge.data.messageType} message`, {
          description: `From ${edge.source} to ${edge.target}`
        });
      }
    },
    [onEdgeSelect]
  );

  // Control handlers
  const handleZoomIn = useCallback(() => {
    // TODO: Implement zoom in
    console.log('Zoom in');
  }, []);

  const handleZoomOut = useCallback(() => {
    // TODO: Implement zoom out
    console.log('Zoom out');
  }, []);

  const handleFitView = useCallback(() => {
    // TODO: Implement fit view
    console.log('Fit view');
  }, []);

  const handleReset = useCallback(() => {
    const { nodes: newNodes, edges: newEdges } = generateWorkflowElements();
    setNodes(newNodes as any);
    setEdges(newEdges as any);
    toast.success('Workflow reset to initial state');
  }, [generateWorkflowElements, setNodes, setEdges]);

  const handleAutoLayout = useCallback(() => {
    // Implement automatic layout algorithm
    const layoutedNodes = nodes.map((node, index) => ({
      ...node,
      position: {
        x: (index % 3) * layout.nodeSpacing.horizontal,
        y: Math.floor(index / 3) * layout.nodeSpacing.vertical
      }
    }));
    setNodes(layoutedNodes);
    toast.success('Auto-layout applied');
  }, [nodes, layout, setNodes]);

  const handleRefresh = useCallback(() => {
    const { nodes: newNodes, edges: newEdges } = generateWorkflowElements();
    setNodes(newNodes as any);
    setEdges(newEdges as any);
    toast.success('Workflow refreshed');
  }, [generateWorkflowElements, setNodes, setEdges]);

  const handlePlayPause = useCallback(() => {
    setIsPlaying(!isPlaying);
    toast.info(isPlaying ? 'Workflow paused' : 'Workflow resumed');
  }, [isPlaying]);

  const handleFilterChange = useCallback((filters: any) => {
    setWorkflowState(prev => ({ ...prev, filters }));
    // Apply filters to nodes and edges
    // TODO: Implement filtering logic
  }, []);

  // Calculate overall workflow progress
  const overallProgress = useMemo(() => {
    const tasks = nodes.filter(n => n.type === 'task').map(n => n.data as TaskFlowData);
    if (tasks.length === 0) return 100;
    
    const totalProgress = tasks.reduce((sum, task) => sum + task.progress, 0);
    return totalProgress / tasks.length;
  }, [nodes]);

  return (
    <div className={`relative bg-gray-50 rounded-lg border border-gray-200 overflow-hidden ${className}`}>
      {/* Progress Indicator */}
      <div className="absolute top-4 left-4 z-10">
        <ProgressIndicator
          progress={overallProgress}
          status={session.status === 'running' ? 'in-progress' : session.status === 'completed' ? 'completed' : 'pending'}
          size="sm"
          showLabel={true}
          animated={isRealTime}
        />
      </div>

      {/* Workflow Controls */}
      {showControls && (
        <WorkflowControls
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onFitView={handleFitView}
          onReset={handleReset}
          onAutoLayout={handleAutoLayout}
          onRefresh={handleRefresh}
          isPlaying={isPlaying}
          onPlayPause={handlePlayPause}
          showFilters={true}
          showMinimap={showMinimap}
          filters={workflowState.filters}
          onFilterChange={handleFilterChange}
        />
      )}

      {/* Main Flow Canvas */}
      <FlowCanvas
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        showMinimap={showMinimap}
        showControls={false} // We use our custom controls
        enableInteraction={enableInteraction}
        height={height}
      />
    </div>
  );
});

// Helper functions
function calculateAgentPerformance(messages: AgentMessage[], agentType: 'manager' | 'worker') {
  const agentMessages = messages.filter(m => m.agentType === agentType);
  const responses = agentMessages.filter(m => m.messageType === 'response');
  const errors = agentMessages.filter(m => m.messageType === 'error');
  
  const totalDuration = agentMessages.reduce((sum, m) => {
    return sum + (m.metadata?.duration || 0);
  }, 0);
  
  const averageResponseTime = agentMessages.length > 0 
    ? totalDuration / agentMessages.length 
    : 0;
  
  const successRate = agentMessages.length > 0 
    ? (agentMessages.length - errors.length) / agentMessages.length 
    : 1;
  
  return {
    tasksCompleted: responses.length,
    averageResponseTime: Math.round(averageResponseTime),
    successRate
  };
}

function getCurrentTask(messages: AgentMessage[], agentType: 'manager' | 'worker'): string | undefined {
  const agentMessages = messages
    .filter(m => m.agentType === agentType)
    .reverse();
  
  const lastPrompt = agentMessages.find(m => m.messageType === 'prompt');
  return lastPrompt ? lastPrompt.content.substring(0, 50) + '...' : undefined;
}

function getLastActivity(messages: AgentMessage[], agentType: 'manager' | 'worker'): Date | undefined {
  const agentMessages = messages.filter(m => m.agentType === agentType);
  if (agentMessages.length === 0) return undefined;
  
  const lastMessage = agentMessages[agentMessages.length - 1];
  return lastMessage.timestamp;
}

function extractTasksFromMessages(messages: AgentMessage[]): TaskFlowData[] {
  const tasks: TaskFlowData[] = [];
  
  messages.forEach((message, index) => {
    if (message.messageType === 'prompt' && message.content.length > 10) {
      const task: TaskFlowData = {
        taskId: `task-${index}`,
        title: message.content.substring(0, 50) + (message.content.length > 50 ? '...' : ''),
        description: message.content,
        status: index < messages.length - 1 ? 'completed' : 'in-progress',
        assignedAgent: message.agentType,
        progress: index < messages.length - 1 ? 100 : Math.random() * 100,
        createdAt: message.timestamp,
        startedAt: message.timestamp,
        completedAt: index < messages.length - 1 ? message.timestamp : undefined,
        priority: 'medium',
        metadata: {
          files: message.metadata?.files,
          tools: message.metadata?.tools
        }
      };
      tasks.push(task);
    }
  });
  
  return tasks;
}

function getTaskStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return '#10b981';
    case 'failed':
      return '#ef4444';
    case 'in-progress':
      return '#f59e0b';
    case 'assigned':
      return '#3b82f6';
    default:
      return '#6b7280';
  }
}

WorkflowCanvas.displayName = 'WorkflowCanvas';

export { WorkflowCanvas };