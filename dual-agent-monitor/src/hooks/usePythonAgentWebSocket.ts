/**
 * React hook for interfacing with Python agent orchestrator WebSocket.
 * 
 * Provides:
 * - Connection management with automatic reconnection
 * - Agent creation and management
 * - Task assignment and tracking
 * - Real-time event subscriptions
 * - Command execution with response correlation
 * - System status monitoring
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { 
  PythonAgentWebSocketService,
  pythonAgentWebSocket,
  MessageType, 
  AgentType, 
  AgentInfo, 
  TaskInfo, 
  TaskStatus,
  SystemStatus,
  PythonMessage,
  EventHandler
} from '../services/PythonAgentWebSocketService';

interface ConnectionState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  reconnectAttempts: number;
  lastConnected: Date | null;
}

interface AgentState {
  agents: Record<string, AgentInfo>;
  loading: boolean;
  error: string | null;
}

interface TaskState {
  tasks: Record<string, TaskInfo>;
  loading: boolean;
  error: string | null;
}

interface SystemState {
  status: SystemStatus | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export interface UsePythonAgentWebSocketOptions {
  autoConnect?: boolean;
  enableToasts?: boolean;
  statusRefreshInterval?: number; // ms
}

export function usePythonAgentWebSocket(options: UsePythonAgentWebSocketOptions = {}) {
  const {
    autoConnect = true,
    enableToasts = true,
    statusRefreshInterval = 30000
  } = options;

  // Connection state
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    connected: false,
    connecting: false,
    error: null,
    reconnectAttempts: 0,
    lastConnected: null
  });

  // Agent state
  const [agentState, setAgentState] = useState<AgentState>({
    agents: {},
    loading: false,
    error: null
  });

  // Task state  
  const [taskState, setTaskState] = useState<TaskState>({
    tasks: {},
    loading: false,
    error: null
  });

  // System state
  const [systemState, setSystemState] = useState<SystemState>({
    status: null,
    loading: false,
    error: null,
    lastUpdated: null
  });

  // Refs for cleanup
  const eventHandlersRef = useRef<Map<MessageType, EventHandler>>(new Map());
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Connection management
  const connect = useCallback(async () => {
    if (connectionState.connecting || connectionState.connected) return;

    setConnectionState(prev => ({ ...prev, connecting: true, error: null }));

    try {
      const success = await pythonAgentWebSocket.connect();
      
      if (success) {
        setConnectionState(prev => ({
          ...prev,
          connected: true,
          connecting: false,
          error: null,
          reconnectAttempts: 0,
          lastConnected: new Date()
        }));

        if (enableToasts) {
          toast.success('Connected to Python agent orchestrator');
        }

        // Start system status updates
        startStatusUpdates();
      } else {
        throw new Error('Failed to connect');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      setConnectionState(prev => ({
        ...prev,
        connected: false,
        connecting: false,
        error: errorMessage,
        reconnectAttempts: prev.reconnectAttempts + 1
      }));

      if (enableToasts) {
        toast.error(`Connection failed: ${errorMessage}`);
      }
    }
  }, [connectionState.connecting, connectionState.connected, enableToasts]);

  const disconnect = useCallback(() => {
    pythonAgentWebSocket.disconnect();
    stopStatusUpdates();
    
    setConnectionState(prev => ({
      ...prev,
      connected: false,
      connecting: false
    }));

    if (enableToasts) {
      toast.info('Disconnected from Python agent orchestrator');
    }
  }, [enableToasts]);

  // Agent management
  const createAgent = useCallback(async (
    type: AgentType, 
    model: string = 'sonnet',
    capabilities: string[] = []
  ): Promise<AgentInfo | null> => {
    setAgentState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const agentInfo = await pythonAgentWebSocket.createAgent(type, model, capabilities);
      
      setAgentState(prev => ({
        ...prev,
        agents: { ...prev.agents, [agentInfo.id]: agentInfo },
        loading: false
      }));

      if (enableToasts) {
        toast.success(`Created ${type} agent: ${agentInfo.id}`);
      }

      return agentInfo;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create agent';
      setAgentState(prev => ({ ...prev, loading: false, error: errorMessage }));

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

  // Task management
  const assignTask = useCallback(async (
    taskData: Partial<TaskInfo>,
    agentId?: string
  ): Promise<TaskInfo | null> => {
    setTaskState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const task = await pythonAgentWebSocket.assignTask(taskData, agentId);
      
      setTaskState(prev => ({
        ...prev,
        tasks: { ...prev.tasks, [task.id]: task },
        loading: false
      }));

      if (enableToasts) {
        toast.success(`Task assigned: ${task.title}`);
      }

      return task;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to assign task';
      setTaskState(prev => ({ ...prev, loading: false, error: errorMessage }));

      if (enableToasts) {
        toast.error(`Task assignment failed: ${errorMessage}`);
      }

      return null;
    }
  }, [enableToasts]);

  // System status
  const refreshSystemStatus = useCallback(async () => {
    setSystemState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const status = await pythonAgentWebSocket.getSystemStatus();
      setSystemState(prev => ({
        ...prev,
        status,
        loading: false,
        lastUpdated: new Date()
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get system status';
      setSystemState(prev => ({ ...prev, loading: false, error: errorMessage }));
    }
  }, []);

  const startStatusUpdates = useCallback(() => {
    refreshSystemStatus();
    statusIntervalRef.current = setInterval(refreshSystemStatus, statusRefreshInterval);
  }, [refreshSystemStatus, statusRefreshInterval]);

  const stopStatusUpdates = useCallback(() => {
    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current);
      statusIntervalRef.current = null;
    }
  }, []);

  // Event subscriptions
  const subscribeToEvents = useCallback(() => {
    // Agent events
    const handleAgentStatus = (message: PythonMessage) => {
      const agentInfo = message.payload.agent;
      if (agentInfo) {
        setAgentState(prev => ({
          ...prev,
          agents: { ...prev.agents, [agentInfo.id]: agentInfo }
        }));
      }
    };

    const handleAgentCreated = (message: PythonMessage) => {
      const agentInfo = message.payload.agent;
      if (agentInfo) {
        setAgentState(prev => ({
          ...prev,
          agents: { ...prev.agents, [agentInfo.id]: agentInfo }
        }));
        
        if (enableToasts) {
          toast.info(`New ${agentInfo.type} agent created: ${agentInfo.id}`);
        }
      }
    };

    const handleAgentError = (message: PythonMessage) => {
      const { agent_id, error_message } = message.payload;
      
      if (enableToasts) {
        toast.error(`Agent ${agent_id} error: ${error_message}`);
      }
    };

    // Task events
    const handleTaskUpdate = (message: PythonMessage) => {
      const taskInfo = message.payload.task;
      if (taskInfo) {
        setTaskState(prev => ({
          ...prev,
          tasks: { ...prev.tasks, [taskInfo.id]: taskInfo }
        }));
      }
    };

    const handleTaskComplete = (message: PythonMessage) => {
      const taskInfo = message.payload.task;
      if (taskInfo) {
        setTaskState(prev => ({
          ...prev,
          tasks: { ...prev.tasks, [taskInfo.id]: taskInfo }
        }));
        
        if (enableToasts) {
          toast.success(`Task completed: ${taskInfo.title}`);
        }
      }
    };

    const handleTaskFailed = (message: PythonMessage) => {
      const taskInfo = message.payload.task;
      if (taskInfo) {
        setTaskState(prev => ({
          ...prev,
          tasks: { ...prev.tasks, [taskInfo.id]: taskInfo }
        }));
        
        if (enableToasts) {
          toast.error(`Task failed: ${taskInfo.title}`);
        }
      }
    };

    // System events
    const handleSystemError = (message: PythonMessage) => {
      const { error_message } = message.payload;
      
      if (enableToasts) {
        toast.error(`System error: ${error_message}`);
      }
    };

    // Register event handlers
    const handlers = new Map<MessageType, EventHandler>([
      [MessageType.AGENT_STATUS, handleAgentStatus],
      [MessageType.AGENT_CREATED, handleAgentCreated],
      [MessageType.AGENT_ERROR, handleAgentError],
      [MessageType.TASK_UPDATE, handleTaskUpdate],
      [MessageType.TASK_COMPLETE, handleTaskComplete],
      [MessageType.TASK_FAILED, handleTaskFailed],
      [MessageType.SYSTEM_ERROR, handleSystemError]
    ]);

    handlers.forEach((handler, messageType) => {
      pythonAgentWebSocket.on(messageType, handler);
      eventHandlersRef.current.set(messageType, handler);
    });

    // Connection change handler
    pythonAgentWebSocket.onConnectionChange((connected) => {
      setConnectionState(prev => ({ ...prev, connected }));
      
      if (!connected) {
        stopStatusUpdates();
        if (enableToasts) {
          toast.warning('Lost connection to Python agent orchestrator');
        }
      } else if (connected && prev => prev.reconnectAttempts > 0) {
        startStatusUpdates();
        if (enableToasts) {
          toast.success('Reconnected to Python agent orchestrator');
        }
      }
    });
  }, [enableToasts, startStatusUpdates, stopStatusUpdates]);

  // Cleanup event subscriptions
  const unsubscribeFromEvents = useCallback(() => {
    eventHandlersRef.current.forEach((handler, messageType) => {
      pythonAgentWebSocket.off(messageType, handler);
    });
    eventHandlersRef.current.clear();
  }, []);

  // Effects
  useEffect(() => {
    subscribeToEvents();

    if (autoConnect) {
      connect();
    }

    return () => {
      unsubscribeFromEvents();
      stopStatusUpdates();
    };
  }, [autoConnect, connect, subscribeToEvents, unsubscribeFromEvents, stopStatusUpdates]);

  // Service statistics
  const getServiceStats = useCallback(() => {
    return pythonAgentWebSocket.getStats();
  }, []);

  return {
    // Connection state
    connectionState,
    connect,
    disconnect,
    
    // Agent management
    agentState,
    createAgent,
    executeCommand,
    
    // Task management
    taskState,
    assignTask,
    
    // System monitoring
    systemState,
    refreshSystemStatus,
    
    // Utilities
    getServiceStats,
    
    // Direct service access for advanced use
    service: pythonAgentWebSocket
  };
}