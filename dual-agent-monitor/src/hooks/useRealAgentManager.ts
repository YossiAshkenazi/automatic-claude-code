import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { 
  PythonAgentWebSocketService, 
  pythonAgentWebSocket,
  AgentType as PythonAgentType,
  MessageType,
  AgentInfo,
  TaskInfo,
  TaskStatus
} from '../services/PythonAgentWebSocketService';
import type { 
  Agent, 
  CreateAgentRequest,
  AgentTask,
  AgentEvent
} from '../types/agent';

interface UseRealAgentManagerOptions {
  autoConnect?: boolean;
  enableToasts?: boolean;
}

interface RealAgentManagerState {
  agents: Agent[];
  tasks: AgentTask[];
  events: AgentEvent[];
  loading: boolean;
  error: string | null;
  connected: boolean;
  connecting: boolean;
}

// Convert Python AgentInfo to React Agent type
function convertPythonAgent(pythonAgent: AgentInfo): Agent {
  return {
    id: pythonAgent.id,
    name: `${pythonAgent.type} Agent`,
    type: pythonAgent.type === 'manager' ? 'manager' : 
          pythonAgent.type === 'worker' ? 'worker' : 'specialist',
    role: getClaudeRole(pythonAgent.model),
    status: convertStatus(pythonAgent.status),
    createdAt: pythonAgent.created_at,
    lastActivity: pythonAgent.last_activity,
    currentTask: pythonAgent.current_task || null,
    metrics: {
      totalTasks: (pythonAgent.metrics.tasks_completed || 0) + (pythonAgent.metrics.tasks_failed || 0),
      completedTasks: pythonAgent.metrics.tasks_completed || 0,
      failedTasks: pythonAgent.metrics.tasks_failed || 0,
      averageResponseTime: pythonAgent.metrics.avg_response_time || 0,
      totalTokensUsed: pythonAgent.metrics.tokens_used || 0,
      totalCost: (pythonAgent.metrics.tokens_used || 0) * 0.001,
      uptime: pythonAgent.metrics.uptime || 0,
      healthScore: (pythonAgent.metrics.success_rate || 1.0) * 100
    },
    configuration: {
      model: pythonAgent.model,
      maxTokens: 4000,
      temperature: 0.1,
      maxIterations: 10,
      timeoutSeconds: 300,
      capabilities: pythonAgent.capabilities,
      resourceLimits: {
        maxMemoryMB: 512,
        maxCpuPercent: 50
      }
    }
  };
}

// Convert Python TaskInfo to React AgentTask type
function convertPythonTask(pythonTask: TaskInfo): AgentTask {
  return {
    id: pythonTask.id,
    title: pythonTask.title,
    description: pythonTask.description,
    assignedTo: pythonTask.assigned_agent || '',
    status: pythonTask.status as AgentTask['status'],
    createdAt: new Date(pythonTask.created_at),
    startedAt: pythonTask.started_at ? new Date(pythonTask.started_at) : undefined,
    completedAt: pythonTask.completed_at ? new Date(pythonTask.completed_at) : undefined,
    progress: pythonTask.progress,
    result: pythonTask.result,
    metadata: pythonTask.metadata
  };
}

function getClaudeRole(model: string): Agent['role'] {
  if (model.includes('opus')) return 'claude-opus';
  if (model.includes('haiku')) return 'claude-haiku';
  return 'claude-sonnet';
}

function convertStatus(status: string): Agent['status'] {
  switch (status) {
    case 'idle': return 'idle';
    case 'busy': return 'working';
    case 'error': return 'error';
    case 'stopping': 
    case 'stopped': return 'stopped';
    default: return 'idle';
  }
}

function convertAgentType(type: Agent['type']): PythonAgentType {
  switch (type) {
    case 'manager': return PythonAgentType.MANAGER;
    case 'worker': return PythonAgentType.WORKER;
    default: return PythonAgentType.COORDINATOR;
  }
}

export function useRealAgentManager(options: UseRealAgentManagerOptions = {}) {
  const {
    autoConnect = true,
    enableToasts = true
  } = options;

  const [state, setState] = useState<RealAgentManagerState>({
    agents: [],
    tasks: [],
    events: [],
    loading: false,
    error: null,
    connected: false,
    connecting: false
  });

  // Connection management
  const connect = useCallback(async () => {
    if (state.connecting || state.connected) return;

    setState(prev => ({ ...prev, connecting: true, error: null }));

    try {
      const success = await pythonAgentWebSocket.connect();
      
      if (success) {
        setState(prev => ({
          ...prev,
          connected: true,
          connecting: false,
          error: null
        }));

        if (enableToasts) {
          toast.success('Connected to Python agent orchestrator');
        }
      } else {
        throw new Error('Failed to connect');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      setState(prev => ({
        ...prev,
        connected: false,
        connecting: false,
        error: errorMessage
      }));

      if (enableToasts) {
        toast.error(`Connection failed: ${errorMessage}`);
      }
    }
  }, [state.connecting, state.connected, enableToasts]);

  const disconnect = useCallback(() => {
    pythonAgentWebSocket.disconnect();
    setState(prev => ({
      ...prev,
      connected: false,
      connecting: false
    }));

    if (enableToasts) {
      toast.info('Disconnected from Python agent orchestrator');
    }
  }, [enableToasts]);

  // Agent management
  const createAgent = useCallback(async (request: CreateAgentRequest): Promise<Agent | null> => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const pythonAgentType = convertAgentType(request.type);
      const model = request.configuration?.model || 'sonnet';
      const capabilities = request.configuration?.capabilities || [];
      
      const agentInfo = await pythonAgentWebSocket.createAgent(
        pythonAgentType,
        model,
        capabilities
      );
      
      const agent = convertPythonAgent(agentInfo);
      
      setState(prev => ({
        ...prev,
        agents: [...prev.agents, agent],
        loading: false
      }));

      if (enableToasts) {
        toast.success(`Created ${request.type} agent: ${agent.name}`);
      }

      return agent;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create agent';
      setState(prev => ({ ...prev, loading: false, error: errorMessage }));

      if (enableToasts) {
        toast.error(`Failed to create agent: ${errorMessage}`);
      }

      return null;
    }
  }, [enableToasts]);

  const executeCommand = useCallback(async (
    agentId: string,
    command: string,
    parameters: Record<string, any> = {}
  ): Promise<any> => {
    try {
      const result = await pythonAgentWebSocket.executeCommand(agentId, command, parameters);
      
      if (enableToasts) {
        toast.success('Command executed successfully');
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Command execution failed';
      
      if (enableToasts) {
        toast.error(`Command failed: ${errorMessage}`);
      }

      throw error;
    }
  }, [enableToasts]);

  const assignTask = useCallback(async (
    agentId: string,
    task: Omit<AgentTask, 'id' | 'assignedTo' | 'createdAt' | 'status'>
  ): Promise<AgentTask | null> => {
    try {
      const taskInfo = await pythonAgentWebSocket.assignTask({
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: task.title,
        description: task.description,
        metadata: task.metadata || {}
      }, agentId);
      
      const agentTask = convertPythonTask(taskInfo);
      
      setState(prev => ({
        ...prev,
        tasks: [...prev.tasks, agentTask]
      }));

      if (enableToasts) {
        toast.success(`Task assigned: ${task.title}`);
      }

      return agentTask;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to assign task';
      
      if (enableToasts) {
        toast.error(`Task assignment failed: ${errorMessage}`);
      }

      return null;
    }
  }, [enableToasts]);

  const refreshSystemStatus = useCallback(async () => {
    try {
      const status = await pythonAgentWebSocket.getSystemStatus();
      // Update agent status based on system status
      // This is a simplified implementation - you might want to expand this
      console.log('System status:', status);
    } catch (error) {
      console.error('Failed to refresh system status:', error);
    }
  }, []);

  // Event handlers
  useEffect(() => {
    if (!state.connected) return;

    const handleAgentStatus = (message: any) => {
      const agentInfo = message.payload.agent;
      if (agentInfo) {
        const agent = convertPythonAgent(agentInfo);
        setState(prev => ({
          ...prev,
          agents: prev.agents.map(a =>
            a.id === agent.id ? agent : a
          )
        }));
      }
    };

    const handleAgentCreated = (message: any) => {
      const agentInfo = message.payload.agent;
      if (agentInfo) {
        const agent = convertPythonAgent(agentInfo);
        setState(prev => ({
          ...prev,
          agents: [...prev.agents, agent]
        }));
        
        if (enableToasts) {
          toast.info(`New ${agent.type} agent created: ${agent.name}`);
        }
      }
    };

    const handleTaskUpdate = (message: any) => {
      const taskInfo = message.payload.task;
      if (taskInfo) {
        const task = convertPythonTask(taskInfo);
        setState(prev => ({
          ...prev,
          tasks: prev.tasks.map(t =>
            t.id === task.id ? task : t
          )
        }));
      }
    };

    const handleTaskComplete = (message: any) => {
      const taskInfo = message.payload.task;
      if (taskInfo) {
        const task = convertPythonTask(taskInfo);
        setState(prev => ({
          ...prev,
          tasks: prev.tasks.map(t =>
            t.id === task.id ? task : t
          )
        }));
        
        if (enableToasts) {
          toast.success(`Task completed: ${task.title}`);
        }
      }
    };

    const handleAgentError = (message: any) => {
      const { agent_id, error_message } = message.payload;
      
      if (enableToasts) {
        toast.error(`Agent ${agent_id} error: ${error_message}`);
      }
    };

    // Register handlers
    pythonAgentWebSocket.on(MessageType.AGENT_STATUS, handleAgentStatus);
    pythonAgentWebSocket.on(MessageType.AGENT_CREATED, handleAgentCreated);
    pythonAgentWebSocket.on(MessageType.TASK_UPDATE, handleTaskUpdate);
    pythonAgentWebSocket.on(MessageType.TASK_COMPLETE, handleTaskComplete);
    pythonAgentWebSocket.on(MessageType.AGENT_ERROR, handleAgentError);

    // Connection change handler
    pythonAgentWebSocket.onConnectionChange((connected) => {
      setState(prev => ({ ...prev, connected }));
      
      if (!connected) {
        if (enableToasts) {
          toast.warning('Lost connection to Python agent orchestrator');
        }
      } else if (connected && !state.connected) {
        if (enableToasts) {
          toast.success('Reconnected to Python agent orchestrator');
        }
      }
    });

    // Cleanup
    return () => {
      pythonAgentWebSocket.off(MessageType.AGENT_STATUS, handleAgentStatus);
      pythonAgentWebSocket.off(MessageType.AGENT_CREATED, handleAgentCreated);
      pythonAgentWebSocket.off(MessageType.TASK_UPDATE, handleTaskUpdate);
      pythonAgentWebSocket.off(MessageType.TASK_COMPLETE, handleTaskComplete);
      pythonAgentWebSocket.off(MessageType.AGENT_ERROR, handleAgentError);
    };
  }, [state.connected, enableToasts]);

  // Auto-connect
  useEffect(() => {
    if (autoConnect && !state.connected && !state.connecting) {
      connect();
    }
  }, [autoConnect, state.connected, state.connecting, connect]);

  return {
    // State
    ...state,
    
    // Connection
    connect,
    disconnect,
    reconnect: connect,
    
    // Agent management
    createAgent,
    executeCommand,
    
    // Task management
    assignTask,
    
    // System
    refreshSystemStatus,
    
    // Computed values
    activeAgents: state.agents.filter(a => a.status === 'active' || a.status === 'working'),
    managerAgents: state.agents.filter(a => a.type === 'manager'),
    workerAgents: state.agents.filter(a => a.type === 'worker'),
    specialistAgents: state.agents.filter(a => a.type === 'specialist'),
    
    // Tasks
    activeTasks: state.tasks.filter(t => t.status === 'in_progress' || t.status === 'pending'),
    
    // Service access
    service: pythonAgentWebSocket
  };
}