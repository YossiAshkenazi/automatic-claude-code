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
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const [sessionCache, setSessionCache] = useState<Map<string, SessionData>>(new Map());

  const sessionStore = useSessionStore();
  
  // Connect to WebSocket server
  const wsUrl = process.env.VITE_WS_URL || 'ws://localhost:4005';
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
          const sessionData = data.data;
          setCurrentSession(sessionData);
          if (sessionData) {
            // Update cache with latest session data
            setSessionCache(prev => new Map(prev).set(sessionData.id, sessionData));
            sessionStore.setSelectedSession(sessionData.id);
          }
          break;
          
        case 'sessions:list':
        case 'sessions:historical':
          const sessionsList = data.data;
          setSessions(sessionsList);
          
          // Update cache with all sessions
          setSessionCache(prev => {
            const newCache = new Map(prev);
            sessionsList.forEach((session: SessionData) => {
              newCache.set(session.id, session);
            });
            return newCache;
          });
          
          // Update session store with persistent session data
          const storeSessions = sessionsList.map((s: SessionData) => ({
            id: s.id,
            name: `Session ${s.id.slice(0, 8)}`,
            createdAt: s.startTime.toString(),
            lastMessageAt: s.messages.length > 0 
              ? s.messages[s.messages.length - 1].timestamp.toString()
              : s.startTime.toString(),
            messageCount: s.messages.length,
            status: s.status,
            initialTask: s.taskQueue.length > 0 ? s.taskQueue[0].title : 'Unknown task',
            managerAgent: {
              name: 'Manager (Opus)',
              status: s.managerAgent.status,
              messagesCount: s.messages.filter(m => m.from === 'manager').length,
              tokensUsed: s.managerAgent.metrics.tasksCompleted * 1000,
              lastActive: s.managerAgent.lastActivity.toString()
            },
            workerAgent: {
              name: 'Worker (Sonnet)',
              status: s.workerAgent.status,
              messagesCount: s.messages.filter(m => m.from === 'worker').length,
              tokensUsed: s.workerAgent.metrics.tasksCompleted * 800,
              lastActive: s.workerAgent.lastActivity.toString()
            }
          }));
          sessionStore.setSessions(storeSessions);
          
          // Clear loading states
          if (data.type === 'sessions:historical') {
            setIsLoadingHistory(false);
          }
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
          const endedSessionId = data.data?.sessionId;
          toast.info('Session ended');
          setIsAgentsRunning(false);
          
          // Update session status in cache and state
          if (endedSessionId) {
            setSessionCache(prev => {
              const newCache = new Map(prev);
              const session = newCache.get(endedSessionId);
              if (session) {
                newCache.set(endedSessionId, {
                  ...session,
                  status: 'completed',
                  endTime: new Date()
                });
              }
              return newCache;
            });
            
            setSessions(prev => prev.map(s => 
              s.id === endedSessionId 
                ? { ...s, status: 'completed', endTime: new Date() }
                : s
            ));
          }
          break;
          
        case 'session:persistence:error':
          const persistenceErr = data.data?.error || data.message || 'Session persistence error';
          setPersistenceError(persistenceErr);
          toast.error('Session persistence issue', {
            description: persistenceErr
          });
          break;
          
        case 'session:restored':
          const restoredSession = data.data;
          toast.success('Session restored from database');
          if (restoredSession) {
            setCurrentSession(restoredSession);
            sessionStore.setSelectedSession(restoredSession.id);
          }
          break;
          
        case 'error':
          const errorMsg = data.message || 'Unknown error';
          setPersistenceError(errorMsg);
          toast.error(errorMsg);
          break;
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }, [sessionStore, isLoadingHistory]);

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

  // Load historical sessions with enhanced error handling
  const loadHistoricalSessions = useCallback(async (options?: {
    limit?: number;
    includeMessages?: boolean;
    dateRange?: { start: Date; end: Date };
  }) => {
    if (!isConnected) {
      setPersistenceError('Not connected to server');
      return;
    }
    
    setIsLoadingHistory(true);
    setPersistenceError(null);
    
    try {
      wsSendMessage({
        type: 'sessions:historical',
        options: {
          limit: options?.limit || 50,
          includeMessages: options?.includeMessages ?? true,
          dateRange: options?.dateRange
        }
      });
    } catch (error) {
      setIsLoadingHistory(false);
      const errorMsg = error instanceof Error ? error.message : 'Failed to load historical sessions';
      setPersistenceError(errorMsg);
      toast.error(errorMsg);
    }
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

  // Auto-refresh sessions periodically with persistence awareness
  useEffect(() => {
    if (!isConnected) return;
    
    const interval = setInterval(() => {
      // Only refresh if we're not currently loading historical data
      if (!isLoadingHistory) {
        refreshSessions();
      }
    }, 15000); // Refresh every 15 seconds (less frequent for DB operations)
    
    return () => clearInterval(interval);
  }, [isConnected, refreshSessions, isLoadingHistory]);
  
  // Load historical sessions on initial connection
  useEffect(() => {
    if (isConnected && sessions.length === 0) {
      // Load recent sessions with messages
      loadHistoricalSessions({
        limit: 20,
        includeMessages: true,
        dateRange: {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          end: new Date()
        }
      });
    }
  }, [isConnected, sessions.length, loadHistoricalSessions]);

  // Clear persistence error
  const clearPersistenceError = useCallback(() => {
    setPersistenceError(null);
  }, []);
  
  // Get cached session data
  const getCachedSession = useCallback((sessionId: string): SessionData | null => {
    return sessionCache.get(sessionId) || null;
  }, [sessionCache]);
  
  // Enhanced export with persistence check
  const exportSessionData = useCallback(async (sessionId: string, format: 'json' | 'csv' = 'json') => {
    const session = getCachedSession(sessionId);
    if (!session) {
      toast.error('Session not found in cache');
      return;
    }
    
    try {
      const exportData = {
        ...session,
        exportMetadata: {
          exportedAt: new Date().toISOString(),
          format,
          version: '1.0'
        }
      };
      
      if (format === 'json') {
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `session-${sessionId}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else if (format === 'csv') {
        const csvData = session.messages.map(msg => ({
          timestamp: msg.timestamp,
          from: msg.from,
          to: msg.to,
          type: msg.type,
          content: typeof msg.content === 'string' ? msg.content.replace(/["\n\r]/g, ' ') : JSON.stringify(msg.content),
          taskId: msg.metadata?.taskId || '',
          tools: msg.metadata?.toolsUsed?.join(';') || ''
        }));
        
        const headers = Object.keys(csvData[0] || {});
        const csvContent = [
          headers.join(','),
          ...csvData.map(row => headers.map(header => `"${row[header as keyof typeof row] || ''}"`).join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `session-${sessionId}-messages-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      
      toast.success(`Session exported as ${format.toUpperCase()}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Export failed';
      toast.error(errorMsg);
    }
  }, [getCachedSession]);

  return {
    // Connection status
    isConnected,
    connectionStatus,
    reconnect,
    
    // Session data
    sessions,
    currentSession,
    sessionCache: Array.from(sessionCache.values()),
    
    // Agent status
    isAgentsRunning,
    agentMetrics,
    
    // Loading states
    isLoadingHistory,
    persistenceError,
    
    // Actions
    startAgents,
    stopAgents,
    sendMessageToAgent,
    getSession,
    exportSession,
    exportSessionData,
    loadHistoricalSessions,
    refreshSessions,
    getCachedSession,
    clearPersistenceError
  };
}