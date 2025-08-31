import { useEffect, useCallback, useState } from 'react';
import { useWebSocket } from './useWebSocket';
import { useSessionStore } from '../store/useSessionStore';
import { toast } from 'sonner';

export interface AgentMessage {
  id: string;
  from: 'manager' | 'worker' | 'system';
  to: 'manager' | 'worker' | 'system' | 'monitor';
  type: 'task_assignment' | 'progress_update' | 'completion_report' | 'error_report' | 'quality_check' | 'system_event';
  timestamp: Date;
  content: string;
  metadata?: {
    taskId?: string;
    sessionId?: string;
    toolsUsed?: string[];
    errorDetails?: any;
    metrics?: {
      duration?: number;
      tokens?: number;
      apiCalls?: number;
    };
  };
}

export interface AgentStatus {
  agent: 'manager' | 'worker';
  status: 'idle' | 'working' | 'error' | 'offline';
  currentTask?: string;
  lastActivity: Date;
  metrics: {
    tasksCompleted: number;
    tasksInProgress: number;
    errorCount: number;
    averageResponseTime: number;
    cpuUsage?: number;
    memoryUsage?: number;
  };
}

export interface SessionData {
  id: string;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'completed' | 'failed';
  managerAgent: AgentStatus;
  workerAgent: AgentStatus;
  messages: AgentMessage[];
  taskQueue: Array<{
    id: string;
    title: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    assignedTo?: 'manager' | 'worker';
    startTime?: Date;
    endTime?: Date;
  }>;
}

export function useAgentIntegration() {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [currentSession, setCurrentSession] = useState<SessionData | null>(null);
  const [isAgentsRunning, setIsAgentsRunning] = useState(false);
  const [agentMetrics, setAgentMetrics] = useState<{
    manager: AgentStatus['metrics'];
    worker: AgentStatus['metrics'];
  } | null>(null);

  const sessionStore = useSessionStore();
  
  // Connect to WebSocket server
  const wsUrl = process.env.VITE_WS_URL || 'ws://localhost:8080';
  const {
    isConnected,
    sendMessage: wsSendMessage,
    lastMessage,
    reconnect,
    connectionStatus
  } = useWebSocket(wsUrl, {
    onOpen: () => {
      console.log('Connected to agent integration server');
      // Request current sessions on connection
      wsSendMessage({ type: 'sessions:list' });
      wsSendMessage({ type: 'sessions:historical' });
    },
    onMessage: (message) => {
      handleWebSocketMessage(message);
    },
    onError: (error) => {
      console.error('WebSocket error:', error);
      toast.error('Connection error with agent server');
    }
  });

  const handleWebSocketMessage = useCallback((message: string) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'agent:message':
          handleAgentMessage(data.data);
          break;
          
        case 'agents:started':
          setIsAgentsRunning(true);
          toast.success(`Agents started for task: ${data.data.task}`);
          break;
          
        case 'agents:stopped':
          setIsAgentsRunning(false);
          toast.info('Agents stopped');
          break;
          
        case 'session:current':
          setCurrentSession(data.data);
          if (data.data) {
            sessionStore.setSelectedSession(data.data.id);
          }
          break;
          
        case 'sessions:list':
          setSessions(data.data);
          // Update session store with real sessions
          const storeSessions = data.data.map((s: SessionData) => ({
            id: s.id,
            name: `Session ${s.id.slice(0, 8)}`,
            createdAt: s.startTime.toString(),
            lastMessageAt: s.messages.length > 0 
              ? s.messages[s.messages.length - 1].timestamp.toString()
              : s.startTime.toString(),
            messageCount: s.messages.length,
            managerAgent: {
              name: 'Manager (Opus)',
              status: s.managerAgent.status,
              messagesCount: s.messages.filter(m => m.from === 'manager').length,
              tokensUsed: s.managerAgent.metrics.tasksCompleted * 1000, // Estimate
              lastActive: s.managerAgent.lastActivity.toString()
            },
            workerAgent: {
              name: 'Worker (Sonnet)',
              status: s.workerAgent.status,
              messagesCount: s.messages.filter(m => m.from === 'worker').length,
              tokensUsed: s.workerAgent.metrics.tasksCompleted * 800, // Estimate
              lastActive: s.workerAgent.lastActivity.toString()
            }
          }));
          sessionStore.setSessions(storeSessions);
          break;
          
        case 'task:assigned':
          toast.info(`Task assigned to ${data.data.agent}`);
          break;
          
        case 'task:completed':
          toast.success(`Task completed by ${data.data.agent}`);
          break;
          
        case 'metrics:updated':
          setAgentMetrics(data.data);
          break;
          
        case 'agent:error':
          toast.error(`${data.data.agent} error: ${data.data.error}`);
          break;
          
        case 'session:ended':
          toast.info('Session ended');
          setIsAgentsRunning(false);
          break;
          
        case 'error':
          toast.error(data.message);
          break;
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }, [sessionStore]);

  const handleAgentMessage = useCallback((message: AgentMessage) => {
    // Add message to session store
    const storeMessage = {
      id: message.id,
      role: message.from as 'manager' | 'worker',
      content: message.content,
      timestamp: message.timestamp.toString(),
      type: 'message' as const,
      metadata: {
        tools: message.metadata?.toolsUsed || [],
        duration: message.metadata?.metrics?.duration,
        tokens: message.metadata?.metrics?.tokens
      }
    };
    
    sessionStore.addMessage(storeMessage);
    
    // Update current session messages
    if (currentSession) {
      setCurrentSession({
        ...currentSession,
        messages: [...currentSession.messages, message]
      });
    }
  }, [currentSession, sessionStore]);

  // Start agents with a task
  const startAgents = useCallback(async (task: string, options?: {
    managerModel?: string;
    workerModel?: string;
    maxIterations?: number;
    verbose?: boolean;
  }) => {
    if (!isConnected) {
      toast.error('Not connected to agent server');
      return;
    }
    
    wsSendMessage({
      type: 'agents:start',
      task,
      options
    });
  }, [isConnected, wsSendMessage]);

  // Stop running agents
  const stopAgents = useCallback(() => {
    if (!isConnected) {
      toast.error('Not connected to agent server');
      return;
    }
    
    wsSendMessage({
      type: 'agents:stop'
    });
  }, [isConnected, wsSendMessage]);

  // Send message to specific agent
  const sendMessageToAgent = useCallback((agent: 'manager' | 'worker', message: string) => {
    if (!isConnected) {
      toast.error('Not connected to agent server');
      return;
    }
    
    wsSendMessage({
      type: 'message:send',
      agent,
      message
    });
  }, [isConnected, wsSendMessage]);

  // Get specific session
  const getSession = useCallback((sessionId: string) => {
    if (!isConnected) {
      toast.error('Not connected to agent server');
      return;
    }
    
    wsSendMessage({
      type: 'session:get',
      sessionId
    });
  }, [isConnected, wsSendMessage]);

  // Export session data
  const exportSession = useCallback((sessionId: string) => {
    if (!isConnected) {
      toast.error('Not connected to agent server');
      return;
    }
    
    wsSendMessage({
      type: 'session:export',
      sessionId
    });
  }, [isConnected, wsSendMessage]);

  // Load historical sessions
  const loadHistoricalSessions = useCallback(() => {
    if (!isConnected) {
      return;
    }
    
    wsSendMessage({
      type: 'sessions:historical'
    });
  }, [isConnected, wsSendMessage]);

  // Refresh sessions list
  const refreshSessions = useCallback(() => {
    if (!isConnected) {
      return;
    }
    
    wsSendMessage({
      type: 'sessions:list'
    });
  }, [isConnected, wsSendMessage]);

  // Auto-refresh sessions periodically
  useEffect(() => {
    if (!isConnected) return;
    
    const interval = setInterval(() => {
      refreshSessions();
    }, 10000); // Refresh every 10 seconds
    
    return () => clearInterval(interval);
  }, [isConnected, refreshSessions]);

  return {
    // Connection status
    isConnected,
    connectionStatus,
    reconnect,
    
    // Session data
    sessions,
    currentSession,
    
    // Agent status
    isAgentsRunning,
    agentMetrics,
    
    // Actions
    startAgents,
    stopAgents,
    sendMessageToAgent,
    getSession,
    exportSession,
    loadHistoricalSessions,
    refreshSessions
  };
}