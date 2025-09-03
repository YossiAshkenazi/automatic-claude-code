import { useState, useCallback, useEffect, useRef } from 'react';
import { useWebSocket } from './useWebSocket';
import { toast } from 'sonner';
import type { 
  Agent, 
  AgentConfiguration, 
  AgentCommunication, 
  AgentTask, 
  CreateAgentRequest,
  UpdateAgentRequest,
  AgentCommand,
  AgentStatusUpdate,
  AgentEvent
} from '../types/agent';

interface UseAgentManagerOptions {
  maxAgents?: number;
  autoReconnect?: boolean;
  refreshInterval?: number;
}

interface AgentManagerState {
  agents: Agent[];
  communications: AgentCommunication[];
  tasks: AgentTask[];
  events: AgentEvent[];
  loading: boolean;
  error: string | null;
  selectedAgent: Agent | null;
}

export function useAgentManager(options: UseAgentManagerOptions = {}) {
  const {
    maxAgents = 5,
    autoReconnect = true,
    refreshInterval = 5000
  } = options;

  const [state, setState] = useState<AgentManagerState>({
    agents: [],
    communications: [],
    tasks: [],
    events: [],
    loading: false,
    error: null,
    selectedAgent: null
  });

  const refreshTimeoutRef = useRef<NodeJS.Timeout>();

  // WebSocket connection for real-time updates
  const {
    isConnected,
    sendMessage: wsSendMessage,
    lastMessage,
    reconnect,
    connectionStatus
  } = useWebSocket('ws://localhost:4005/agents', {
    maxReconnectAttempts: autoReconnect ? 10 : 0,
    onOpen: () => {
      console.log('Connected to agent management server');
      // Request current agent list on connection
      wsSendMessage({ type: 'agents:list' });
      wsSendMessage({ type: 'communications:list' });
      wsSendMessage({ type: 'tasks:list' });
    },
    onMessage: handleWebSocketMessage,
    onError: (error) => {
      console.error('Agent WebSocket error:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Connection error with agent server' 
      }));
    }
  });

  // Handle WebSocket messages
  function handleWebSocketMessage(message: string) {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'agents:list':
          setState(prev => ({
            ...prev,
            agents: data.payload,
            error: null
          }));
          break;

        case 'agent:created':
          const newAgent = data.payload as Agent;
          setState(prev => ({
            ...prev,
            agents: [...prev.agents, newAgent]
          }));
          toast.success(`Agent ${newAgent.name} created successfully`);
          break;

        case 'agent:updated':
          const updatedAgent = data.payload as Agent;
          setState(prev => ({
            ...prev,
            agents: prev.agents.map(agent =>
              agent.id === updatedAgent.id ? updatedAgent : agent
            ),
            selectedAgent: prev.selectedAgent?.id === updatedAgent.id ? updatedAgent : prev.selectedAgent
          }));
          break;

        case 'agent:deleted':
          const deletedAgentId = data.payload.id;
          setState(prev => ({
            ...prev,
            agents: prev.agents.filter(agent => agent.id !== deletedAgentId),
            selectedAgent: prev.selectedAgent?.id === deletedAgentId ? null : prev.selectedAgent
          }));
          toast.info('Agent deleted');
          break;

        case 'agent:status_update':
          const statusUpdate = data.payload as AgentStatusUpdate;
          setState(prev => ({
            ...prev,
            agents: prev.agents.map(agent =>
              agent.id === statusUpdate.agentId
                ? {
                    ...agent,
                    status: statusUpdate.status,
                    metrics: statusUpdate.metrics ? { ...agent.metrics, ...statusUpdate.metrics } : agent.metrics,
                    currentTask: statusUpdate.currentTask ?? agent.currentTask,
                    lastActivity: statusUpdate.lastActivity ?? agent.lastActivity
                  }
                : agent
            )
          }));
          break;

        case 'agent:communication':
          const communication = data.payload as AgentCommunication;
          setState(prev => ({
            ...prev,
            communications: [communication, ...prev.communications.slice(0, 99)] // Keep last 100
          }));
          
          // Show toast for important communications
          if (communication.metadata?.responseRequired) {
            toast.info(`Message from ${getAgentName(communication.fromAgent)}`, {
              description: communication.content.slice(0, 100) + (communication.content.length > 100 ? '...' : '')
            });
          }
          break;

        case 'agent:task_assigned':
          const assignedTask = data.payload as AgentTask;
          setState(prev => ({
            ...prev,
            tasks: [assignedTask, ...prev.tasks]
          }));
          toast.success(`Task assigned: ${assignedTask.title}`);
          break;

        case 'agent:task_completed':
          const completedTask = data.payload as AgentTask;
          setState(prev => ({
            ...prev,
            tasks: prev.tasks.map(task =>
              task.id === completedTask.id ? completedTask : task
            )
          }));
          toast.success(`Task completed: ${completedTask.title}`);
          break;

        case 'agent:error':
          const agentError = data.payload;
          setState(prev => ({
            ...prev,
            error: `Agent ${agentError.agentName}: ${agentError.error}`
          }));
          toast.error(`Agent Error: ${agentError.agentName}`, {
            description: agentError.error
          });
          break;

        case 'agent:event':
          const event = data.payload as AgentEvent;
          setState(prev => ({
            ...prev,
            events: [event, ...prev.events.slice(0, 199)] // Keep last 200 events
          }));
          break;

        case 'error':
          setState(prev => ({
            ...prev,
            error: data.payload.message || 'Unknown error occurred'
          }));
          toast.error('Error', { description: data.payload.message });
          break;

        default:
          console.log('Unknown agent WebSocket message:', data.type);
      }
    } catch (error) {
      console.error('Error parsing agent WebSocket message:', error);
    }
  }

  // Helper function to get agent name by ID
  const getAgentName = useCallback((agentId: string) => {
    const agent = state.agents.find(a => a.id === agentId);
    return agent?.name || `Agent ${agentId.slice(0, 8)}`;
  }, [state.agents]);

  // Create a new agent
  const createAgent = useCallback(async (request: CreateAgentRequest): Promise<Agent> => {
    if (state.agents.length >= maxAgents) {
      throw new Error(`Maximum number of agents (${maxAgents}) reached`);
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      if (!isConnected) {
        throw new Error('Not connected to agent server');
      }

      // Default configuration
      const defaultConfig: AgentConfiguration = {
        model: request.role === 'claude-opus' ? 'claude-3-opus-20240229' : 
               request.role === 'claude-sonnet' ? 'claude-3-sonnet-20240229' : 
               'claude-3-haiku-20240307',
        maxTokens: 4000,
        temperature: 0.1,
        maxIterations: 10,
        timeoutSeconds: 300,
        capabilities: ['general', 'coding', 'analysis'],
        resourceLimits: {
          maxMemoryMB: 512,
          maxCpuPercent: 50
        },
        ...request.configuration
      };

      const createRequest = {
        ...request,
        configuration: defaultConfig
      };

      wsSendMessage({
        type: 'agent:create',
        payload: createRequest
      });

      // Return a promise that resolves when the agent is created
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Agent creation timeout'));
        }, 30000);

        const checkForAgent = () => {
          const agent = state.agents.find(a => a.name === request.name);
          if (agent) {
            clearTimeout(timeout);
            setState(prev => ({ ...prev, loading: false }));
            resolve(agent);
          } else {
            setTimeout(checkForAgent, 1000);
          }
        };

        checkForAgent();
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to create agent'
      }));
      throw error;
    }
  }, [state.agents.length, maxAgents, isConnected, wsSendMessage, state.agents]);

  // Update agent configuration
  const updateAgent = useCallback(async (request: UpdateAgentRequest) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      if (!isConnected) {
        throw new Error('Not connected to agent server');
      }

      wsSendMessage({
        type: 'agent:update',
        payload: request
      });

      setState(prev => ({ ...prev, loading: false }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to update agent'
      }));
      throw error;
    }
  }, [isConnected, wsSendMessage]);

  // Delete an agent
  const deleteAgent = useCallback(async (agentId: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      if (!isConnected) {
        throw new Error('Not connected to agent server');
      }

      wsSendMessage({
        type: 'agent:delete',
        payload: { id: agentId }
      });

      setState(prev => ({ ...prev, loading: false }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to delete agent'
      }));
      throw error;
    }
  }, [isConnected, wsSendMessage]);

  // Send command to agent
  const sendCommand = useCallback(async (agentId: string, command: AgentCommand) => {
    try {
      if (!isConnected) {
        throw new Error('Not connected to agent server');
      }

      wsSendMessage({
        type: 'agent:command',
        payload: {
          agentId,
          command
        }
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to send command'
      }));
      throw error;
    }
  }, [isConnected, wsSendMessage]);

  // Start an agent
  const startAgent = useCallback((agentId: string) => {
    return sendCommand(agentId, { type: 'start' });
  }, [sendCommand]);

  // Stop an agent
  const stopAgent = useCallback((agentId: string) => {
    return sendCommand(agentId, { type: 'stop' });
  }, [sendCommand]);

  // Restart an agent
  const restartAgent = useCallback((agentId: string) => {
    return sendCommand(agentId, { type: 'restart' });
  }, [sendCommand]);

  // Assign task to agent
  const assignTask = useCallback(async (agentId: string, task: Omit<AgentTask, 'id' | 'assignedTo' | 'createdAt' | 'status'>) => {
    try {
      if (!isConnected) {
        throw new Error('Not connected to agent server');
      }

      const fullTask: AgentTask = {
        ...task,
        id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        assignedTo: agentId,
        createdAt: new Date(),
        status: 'pending'
      };

      wsSendMessage({
        type: 'agent:assign_task',
        payload: fullTask
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to assign task'
      }));
      throw error;
    }
  }, [isConnected, wsSendMessage]);

  // Select agent for detailed view
  const selectAgent = useCallback((agentId: string | null) => {
    const agent = agentId ? state.agents.find(a => a.id === agentId) : null;
    setState(prev => ({ ...prev, selectedAgent: agent }));
  }, [state.agents]);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Refresh agent data
  const refresh = useCallback(() => {
    if (isConnected) {
      wsSendMessage({ type: 'agents:list' });
      wsSendMessage({ type: 'communications:list' });
      wsSendMessage({ type: 'tasks:list' });
    }
  }, [isConnected, wsSendMessage]);

  // Auto-refresh data periodically
  useEffect(() => {
    if (refreshInterval > 0 && isConnected) {
      refreshTimeoutRef.current = setInterval(() => {
        refresh();
      }, refreshInterval);

      return () => {
        if (refreshTimeoutRef.current) {
          clearInterval(refreshTimeoutRef.current);
        }
      };
    }
  }, [refreshInterval, isConnected, refresh]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearInterval(refreshTimeoutRef.current);
      }
    };
  }, []);

  return {
    // State
    ...state,
    
    // Connection info
    isConnected,
    connectionStatus,
    
    // Actions
    createAgent,
    updateAgent,
    deleteAgent,
    startAgent,
    stopAgent,
    restartAgent,
    assignTask,
    selectAgent,
    clearError,
    refresh,
    reconnect,
    
    // Computed values
    activeAgents: state.agents.filter(a => a.status === 'active' || a.status === 'working'),
    managerAgents: state.agents.filter(a => a.type === 'manager'),
    workerAgents: state.agents.filter(a => a.type === 'worker'),
    specialistAgents: state.agents.filter(a => a.type === 'specialist'),
    
    // Recent communications (last 20)
    recentCommunications: state.communications.slice(0, 20),
    
    // Active tasks
    activeTasks: state.tasks.filter(t => t.status === 'in_progress' || t.status === 'pending'),
    
    // Recent events (last 50)
    recentEvents: state.events.slice(0, 50)
  };
}