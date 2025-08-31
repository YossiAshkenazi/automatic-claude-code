import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { DualAgentSession, AgentMessage, WebSocketMessage } from '../types';
import { apiClient } from '../utils/api';
import { toast } from 'sonner';

interface SessionFilters {
  status?: string;
  agentType?: string;
  dateRange?: { start: Date; end: Date };
  searchTerm?: string;
}

interface SessionStore {
  // State
  sessions: DualAgentSession[];
  selectedSession: DualAgentSession | null;
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;
  filters: SessionFilters;
  sortBy: 'startTime' | 'lastActivity' | 'messageCount';
  sortOrder: 'asc' | 'desc';

  // Actions
  setSessions: (sessions: DualAgentSession[]) => void;
  addSession: (session: DualAgentSession) => void;
  updateSession: (sessionId: string, updates: Partial<DualAgentSession>) => void;
  removeSession: (sessionId: string) => void;
  setSelectedSession: (sessionId: string | null) => void;
  
  // Message actions
  addMessage: (message: AgentMessage) => void;
  updateMessage: (messageId: string, updates: Partial<AgentMessage>) => void;
  
  // WebSocket actions
  handleWebSocketMessage: (message: WebSocketMessage) => void;
  setConnectionStatus: (connected: boolean) => void;
  
  // API actions
  loadSessions: () => Promise<void>;
  createSession: (task: string) => Promise<void>;
  updateSessionStatus: (sessionId: string, status: DualAgentSession['status']) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  exportSession: (sessionId: string, format: 'json' | 'csv') => Promise<void>;
  
  // Filter and search
  setFilters: (filters: Partial<SessionFilters>) => void;
  setSorting: (sortBy: 'startTime' | 'lastActivity' | 'messageCount', order: 'asc' | 'desc') => void;
  getFilteredSessions: () => DualAgentSession[];
  
  // Utilities
  clearError: () => void;
  reset: () => void;
}

export const useSessionStore = create<SessionStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      // Initial state
      sessions: [],
      selectedSession: null,
      isLoading: false,
      error: null,
      isConnected: false,
      filters: {},
      sortBy: 'startTime',
      sortOrder: 'desc',

      // Basic setters
      setSessions: (sessions) => set({ sessions }),
      
      addSession: (session) =>
        set((state) => ({
          sessions: [session, ...state.sessions],
        })),

      updateSession: (sessionId, updates) =>
        set((state) => ({
          sessions: (state.sessions || []).map((session) =>
            session.id === sessionId ? { ...session, ...updates } : session
          ),
          selectedSession:
            state.selectedSession?.id === sessionId
              ? { ...state.selectedSession, ...updates }
              : state.selectedSession,
        })),

      removeSession: (sessionId) =>
        set((state) => ({
          sessions: (state.sessions || []).filter((session) => session.id !== sessionId),
          selectedSession:
            state.selectedSession?.id === sessionId ? null : state.selectedSession,
        })),

      setSelectedSession: (sessionId) => {
        const sessions = get().sessions || [];
        const session = sessionId ? sessions.find((s) => s.id === sessionId) : null;
        set({ selectedSession: session });
      },

      // Message actions
      addMessage: (message) =>
        set((state) => {
          const updatedSessions = (state.sessions || []).map((session) =>
            session.id === message.sessionId
              ? {
                  ...session,
                  messages: [...(session.messages || []), message],
                  lastActivity: message.timestamp,
                }
              : session
          );

          const updatedSelectedSession =
            state.selectedSession?.id === message.sessionId
              ? {
                  ...state.selectedSession,
                  messages: [...(state.selectedSession.messages || []), message],
                  lastActivity: message.timestamp,
                }
              : state.selectedSession;

          return {
            sessions: updatedSessions,
            selectedSession: updatedSelectedSession,
          };
        }),

      updateMessage: (messageId, updates) =>
        set((state) => {
          const updatedSessions = (state.sessions || []).map((session) => ({
            ...session,
            messages: (session.messages || []).map((msg) =>
              msg.id === messageId ? { ...msg, ...updates } : msg
            ),
          }));

          const updatedSelectedSession = state.selectedSession
            ? {
                ...state.selectedSession,
                messages: (state.selectedSession.messages || []).map((msg) =>
                  msg.id === messageId ? { ...msg, ...updates } : msg
                ),
              }
            : null;

          return {
            sessions: updatedSessions,
            selectedSession: updatedSelectedSession,
          };
        }),

      // WebSocket handling
      handleWebSocketMessage: (message) => {
        const { type, data } = message;
        
        switch (type) {
          case 'new_message':
            get().addMessage(data as AgentMessage);
            toast.success('New message received', {
              description: `From ${(data as AgentMessage).agentType}`,
            });
            break;
            
          case 'session_update':
            get().updateSession((data as DualAgentSession).id, data as Partial<DualAgentSession>);
            break;
            
          case 'session_list':
            get().setSessions(data as DualAgentSession[]);
            break;
            
          case 'session_created':
            get().addSession(data as DualAgentSession);
            toast.success('New session created', {
              description: `Session ${(data as DualAgentSession).id}`,
            });
            break;
            
          case 'session_deleted':
            get().removeSession((data as { id: string }).id);
            toast.info('Session deleted');
            break;
            
          case 'error':
            set({ error: (data as { message: string }).message });
            toast.error('Error', {
              description: (data as { message: string }).message,
            });
            break;
            
          default:
            console.log('Unknown WebSocket message type:', type);
        }
      },

      setConnectionStatus: (connected) => {
        set({ isConnected: connected });
        if (connected) {
          toast.success('Connected to server');
        } else {
          toast.error('Disconnected from server');
        }
      },

      // API actions
      loadSessions: async () => {
        set({ isLoading: true, error: null });
        try {
          const sessions = await apiClient.getSessions();
          set({ sessions, isLoading: false });
          
          // Auto-select most recent active session
          const activeSession = sessions.find(s => s.status === 'running' || s.status === 'paused');
          if (activeSession && !get().selectedSession) {
            get().setSelectedSession(activeSession.id);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load sessions';
          set({ error: errorMessage, isLoading: false });
          toast.error('Failed to load sessions', { description: errorMessage });
        }
      },

      createSession: async (task) => {
        set({ isLoading: true, error: null });
        try {
          const session = await apiClient.createSession(task);
          get().addSession(session);
          get().setSelectedSession(session.id);
          set({ isLoading: false });
          toast.success('Session created successfully');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to create session';
          set({ error: errorMessage, isLoading: false });
          toast.error('Failed to create session', { description: errorMessage });
        }
      },

      updateSessionStatus: async (sessionId, status) => {
        try {
          await apiClient.updateSessionStatus(sessionId, status);
          get().updateSession(sessionId, { status });
          toast.success(`Session ${status}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to update session status';
          set({ error: errorMessage });
          toast.error('Failed to update session status', { description: errorMessage });
        }
      },

      deleteSession: async (sessionId) => {
        try {
          await apiClient.deleteSession?.(sessionId);
          get().removeSession(sessionId);
          toast.success('Session deleted');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to delete session';
          set({ error: errorMessage });
          toast.error('Failed to delete session', { description: errorMessage });
        }
      },

      exportSession: async (sessionId, format) => {
        try {
          const sessions = get().sessions || [];
          const session = sessions.find(s => s.id === sessionId);
          if (!session) throw new Error('Session not found');
          
          if (format === 'json') {
            const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `session-${sessionId}-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          } else if (format === 'csv') {
            const csvData = (session.messages || []).map(msg => ({
              timestamp: msg.timestamp,
              agentType: msg.agentType,
              messageType: msg.messageType,
              content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
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
          const errorMessage = error instanceof Error ? error.message : 'Failed to export session';
          set({ error: errorMessage });
          toast.error('Export failed', { description: errorMessage });
        }
      },

      // Filter and search
      setFilters: (newFilters) =>
        set((state) => ({
          filters: { ...state.filters, ...newFilters },
        })),

      setSorting: (sortBy, sortOrder) => set({ sortBy, sortOrder }),

      getFilteredSessions: () => {
        const { sessions, filters, sortBy, sortOrder } = get();
        
        let filtered = (sessions || []).filter((session) => {
          if (filters.status && session.status !== filters.status) return false;
          if (filters.searchTerm) {
            const term = filters.searchTerm.toLowerCase();
            const searchableText = [
              session.initialTask,
              session.workDir,
              ...(session.messages || []).map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content))
            ].join(' ').toLowerCase();
            
            if (!searchableText.includes(term)) return false;
          }
          if (filters.dateRange) {
            const sessionDate = new Date(session.startTime);
            if (sessionDate < filters.dateRange.start || sessionDate > filters.dateRange.end) {
              return false;
            }
          }
          return true;
        });

        // Sort
        filtered.sort((a, b) => {
          let aValue: any, bValue: any;
          
          switch (sortBy) {
            case 'startTime':
              aValue = new Date(a.startTime);
              bValue = new Date(b.startTime);
              break;
            case 'lastActivity':
              aValue = new Date(a.lastActivity || a.startTime);
              bValue = new Date(b.lastActivity || b.startTime);
              break;
            case 'messageCount':
              aValue = (a.messages || []).length;
              bValue = (b.messages || []).length;
              break;
            default:
              return 0;
          }
          
          if (sortOrder === 'desc') {
            return bValue > aValue ? 1 : bValue < aValue ? -1 : 0;
          } else {
            return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
          }
        });

        return filtered;
      },

      // Utilities
      clearError: () => set({ error: null }),
      
      reset: () =>
        set({
          sessions: [],
          selectedSession: null,
          isLoading: false,
          error: null,
          isConnected: false,
          filters: {},
          sortBy: 'startTime',
          sortOrder: 'desc',
        }),
    })),
    { name: 'session-store' }
  )
);