import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useSessionStore } from '../../store/useSessionStore';
import { apiClient } from '../../utils/api';
import { DualAgentSession, AgentMessage, WebSocketMessage } from '../../types';

// Mock dependencies
vi.mock('../../utils/api');
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

describe('useSessionStore', () => {
  const mockApiClient = vi.mocked(apiClient);

  const createMockSession = (id: string, status: DualAgentSession['status'] = 'running'): DualAgentSession => ({
    id,
    initialTask: `Task ${id}`,
    status,
    startTime: '2024-01-01T10:00:00Z',
    lastActivity: '2024-01-01T11:00:00Z',
    messages: [],
    workDir: `/test${id}`,
    agentStats: {
      manager: { messages: 5, avgResponseTime: 1000 },
      worker: { messages: 3, avgResponseTime: 800 }
    }
  });

  const createMockMessage = (sessionId: string, agentType: 'manager' | 'worker'): AgentMessage => ({
    id: `msg-${Date.now()}`,
    sessionId,
    agentType,
    messageType: 'response',
    content: `Message from ${agentType}`,
    timestamp: new Date().toISOString(),
    metadata: {}
  });

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset the store state
    const { result } = renderHook(() => useSessionStore());
    act(() => {
      result.current.reset();
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useSessionStore());

      expect(result.current.sessions).toEqual([]);
      expect(result.current.selectedSession).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isLoadingSessions).toBe(false);
      expect(result.current.isCreatingSession).toBe(false);
      expect(result.current.isDeletingSession).toBeNull();
      expect(result.current.isUpdatingSession).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.connectionError).toBeNull();
      expect(result.current.isConnected).toBe(false);
      expect(result.current.lastConnectionTime).toBeNull();
      expect(result.current.filters).toEqual({});
      expect(result.current.sortBy).toBe('startTime');
      expect(result.current.sortOrder).toBe('desc');
    });
  });

  describe('Session Management', () => {
    it('should add sessions correctly', () => {
      const { result } = renderHook(() => useSessionStore());
      const mockSession = createMockSession('1');

      act(() => {
        result.current.addSession(mockSession);
      });

      expect(result.current.sessions).toHaveLength(1);
      expect(result.current.sessions[0]).toEqual(mockSession);
    });

    it('should set sessions correctly and maintain order', () => {
      const { result } = renderHook(() => useSessionStore());
      const mockSessions = [
        createMockSession('1'),
        createMockSession('2'),
        createMockSession('3'),
      ];

      act(() => {
        result.current.setSessions(mockSessions);
      });

      expect(result.current.sessions).toHaveLength(3);
      expect(result.current.sessions).toEqual(mockSessions);
    });

    it('should update session correctly', () => {
      const { result } = renderHook(() => useSessionStore());
      const mockSession = createMockSession('1', 'running');

      act(() => {
        result.current.setSessions([mockSession]);
      });

      act(() => {
        result.current.updateSession('1', { status: 'completed' });
      });

      expect(result.current.sessions[0].status).toBe('completed');
    });

    it('should remove session correctly', () => {
      const { result } = renderHook(() => useSessionStore());
      const mockSessions = [
        createMockSession('1'),
        createMockSession('2'),
      ];

      act(() => {
        result.current.setSessions(mockSessions);
      });

      act(() => {
        result.current.removeSession('1');
      });

      expect(result.current.sessions).toHaveLength(1);
      expect(result.current.sessions[0].id).toBe('2');
    });

    it('should handle selected session correctly', () => {
      const { result } = renderHook(() => useSessionStore());
      const mockSession = createMockSession('1');

      act(() => {
        result.current.setSessions([mockSession]);
      });

      act(() => {
        result.current.setSelectedSession('1');
      });

      expect(result.current.selectedSession).toEqual(mockSession);

      act(() => {
        result.current.setSelectedSession(null);
      });

      expect(result.current.selectedSession).toBeNull();
    });

    it('should clear selected session when session is removed', () => {
      const { result } = renderHook(() => useSessionStore());
      const mockSession = createMockSession('1');

      act(() => {
        result.current.setSessions([mockSession]);
        result.current.setSelectedSession('1');
      });

      expect(result.current.selectedSession).toEqual(mockSession);

      act(() => {
        result.current.removeSession('1');
      });

      expect(result.current.selectedSession).toBeNull();
    });
  });

  describe('Message Management', () => {
    it('should add message to correct session', () => {
      const { result } = renderHook(() => useSessionStore());
      const mockSession = createMockSession('1');
      const mockMessage = createMockMessage('1', 'manager');

      act(() => {
        result.current.setSessions([mockSession]);
        result.current.setSelectedSession('1');
      });

      act(() => {
        result.current.addMessage(mockMessage);
      });

      expect(result.current.sessions[0].messages).toHaveLength(1);
      expect(result.current.sessions[0].messages[0]).toEqual(mockMessage);
      expect(result.current.selectedSession?.messages).toHaveLength(1);
      expect(result.current.selectedSession?.messages[0]).toEqual(mockMessage);
    });

    it('should update lastActivity when message is added', () => {
      const { result } = renderHook(() => useSessionStore());
      const mockSession = createMockSession('1');
      const mockMessage = createMockMessage('1', 'worker');

      act(() => {
        result.current.setSessions([mockSession]);
      });

      const originalActivity = result.current.sessions[0].lastActivity;

      act(() => {
        result.current.addMessage(mockMessage);
      });

      expect(result.current.sessions[0].lastActivity).toBe(mockMessage.timestamp);
      expect(result.current.sessions[0].lastActivity).not.toBe(originalActivity);
    });

    it('should update message correctly', () => {
      const { result } = renderHook(() => useSessionStore());
      const mockSession = createMockSession('1');
      const mockMessage = createMockMessage('1', 'manager');

      act(() => {
        result.current.setSessions([{ ...mockSession, messages: [mockMessage] }]);
      });

      const updatedContent = 'Updated message content';

      act(() => {
        result.current.updateMessage(mockMessage.id, { content: updatedContent });
      });

      expect(result.current.sessions[0].messages[0].content).toBe(updatedContent);
    });
  });

  describe('WebSocket Message Handling', () => {
    it('should handle new_message WebSocket events', () => {
      const { result } = renderHook(() => useSessionStore());
      const mockSession = createMockSession('1');
      const mockMessage = createMockMessage('1', 'worker');

      act(() => {
        result.current.setSessions([mockSession]);
      });

      const wsMessage: WebSocketMessage = {
        type: 'new_message',
        data: mockMessage,
        timestamp: new Date().toISOString(),
      };

      act(() => {
        result.current.handleWebSocketMessage(wsMessage);
      });

      expect(result.current.sessions[0].messages).toHaveLength(1);
      expect(result.current.sessions[0].messages[0]).toEqual(mockMessage);
    });

    it('should handle session_update WebSocket events', () => {
      const { result } = renderHook(() => useSessionStore());
      const mockSession = createMockSession('1', 'running');

      act(() => {
        result.current.setSessions([mockSession]);
      });

      const updatedSession = { ...mockSession, status: 'completed' as const };
      const wsMessage: WebSocketMessage = {
        type: 'session_update',
        data: updatedSession,
        timestamp: new Date().toISOString(),
      };

      act(() => {
        result.current.handleWebSocketMessage(wsMessage);
      });

      expect(result.current.sessions[0].status).toBe('completed');
    });

    it('should handle session_created WebSocket events', () => {
      const { result } = renderHook(() => useSessionStore());
      const newSession = createMockSession('2');

      const wsMessage: WebSocketMessage = {
        type: 'session_created',
        data: newSession,
        timestamp: new Date().toISOString(),
      };

      act(() => {
        result.current.handleWebSocketMessage(wsMessage);
      });

      expect(result.current.sessions).toHaveLength(1);
      expect(result.current.sessions[0]).toEqual(newSession);
    });

    it('should handle session_deleted WebSocket events', () => {
      const { result } = renderHook(() => useSessionStore());
      const mockSession = createMockSession('1');

      act(() => {
        result.current.setSessions([mockSession]);
      });

      const wsMessage: WebSocketMessage = {
        type: 'session_deleted',
        data: { id: '1' },
        timestamp: new Date().toISOString(),
      };

      act(() => {
        result.current.handleWebSocketMessage(wsMessage);
      });

      expect(result.current.sessions).toHaveLength(0);
    });

    it('should handle session_list WebSocket events', () => {
      const { result } = renderHook(() => useSessionStore());
      const mockSessions = [
        createMockSession('1'),
        createMockSession('2'),
      ];

      const wsMessage: WebSocketMessage = {
        type: 'session_list',
        data: mockSessions,
        timestamp: new Date().toISOString(),
      };

      act(() => {
        result.current.handleWebSocketMessage(wsMessage);
      });

      expect(result.current.sessions).toEqual(mockSessions);
    });

    it('should handle error WebSocket events', () => {
      const { result } = renderHook(() => useSessionStore());
      const errorMessage = 'Test error message';

      const wsMessage: WebSocketMessage = {
        type: 'error',
        data: { message: errorMessage },
        timestamp: new Date().toISOString(),
      };

      act(() => {
        result.current.handleWebSocketMessage(wsMessage);
      });

      expect(result.current.error).toBe(errorMessage);
    });
  });

  describe('Connection Status Management', () => {
    it('should update connection status correctly', () => {
      const { result } = renderHook(() => useSessionStore());

      expect(result.current.isConnected).toBe(false);
      expect(result.current.lastConnectionTime).toBeNull();

      act(() => {
        result.current.setConnectionStatus(true);
      });

      expect(result.current.isConnected).toBe(true);
      expect(result.current.lastConnectionTime).toBeInstanceOf(Date);
      expect(result.current.connectionError).toBeNull();

      act(() => {
        result.current.setConnectionStatus(false);
      });

      expect(result.current.isConnected).toBe(false);
      expect(result.current.connectionError).toBe('Lost connection to server');
    });
  });

  describe('API Actions', () => {
    it('should load sessions successfully', async () => {
      const { result } = renderHook(() => useSessionStore());
      const mockSessions = [createMockSession('1'), createMockSession('2')];
      
      mockApiClient.getSessions.mockResolvedValue({
        sessions: mockSessions,
        total: 2,
        hasMore: false,
      });

      await act(async () => {
        const response = await result.current.loadSessions();
        expect(response.sessions).toEqual(mockSessions);
        expect(response.total).toBe(2);
        expect(response.hasMore).toBe(false);
      });

      expect(result.current.sessions).toEqual(mockSessions);
      expect(result.current.isLoadingSessions).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle loadSessions API error', async () => {
      const { result } = renderHook(() => useSessionStore());
      const errorMessage = 'Failed to load sessions';
      
      mockApiClient.getSessions.mockRejectedValue(new Error(errorMessage));

      await act(async () => {
        try {
          await result.current.loadSessions();
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      });

      expect(result.current.error).toBe(errorMessage);
      expect(result.current.isLoadingSessions).toBe(false);
    });

    it('should create session successfully', async () => {
      const { result } = renderHook(() => useSessionStore());
      const newSession = createMockSession('new');
      const task = 'Create new session';
      
      mockApiClient.createSession.mockResolvedValue(newSession);

      await act(async () => {
        await result.current.createSession(task);
      });

      expect(result.current.sessions).toContain(newSession);
      expect(result.current.selectedSession).toEqual(newSession);
      expect(result.current.isCreatingSession).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle createSession API error', async () => {
      const { result } = renderHook(() => useSessionStore());
      const errorMessage = 'Failed to create session';
      const task = 'Create new session';
      
      mockApiClient.createSession.mockRejectedValue(new Error(errorMessage));

      await act(async () => {
        try {
          await result.current.createSession(task);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      });

      expect(result.current.error).toBe(errorMessage);
      expect(result.current.isCreatingSession).toBe(false);
    });

    it('should update session status successfully', async () => {
      const { result } = renderHook(() => useSessionStore());
      const mockSession = createMockSession('1', 'running');
      
      act(() => {
        result.current.setSessions([mockSession]);
      });

      mockApiClient.updateSessionStatus.mockResolvedValue(undefined);

      await act(async () => {
        await result.current.updateSessionStatus('1', 'completed');
      });

      expect(result.current.sessions[0].status).toBe('completed');
      expect(result.current.isUpdatingSession).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should delete session successfully', async () => {
      const { result } = renderHook(() => useSessionStore());
      const mockSession = createMockSession('1');
      
      act(() => {
        result.current.setSessions([mockSession]);
      });

      mockApiClient.deleteSession.mockResolvedValue(undefined);

      await act(async () => {
        await result.current.deleteSession('1');
      });

      expect(result.current.sessions).toHaveLength(0);
      expect(result.current.isDeletingSession).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe('Filtering and Sorting', () => {
    it('should filter sessions correctly', () => {
      const { result } = renderHook(() => useSessionStore());
      const mockSessions = [
        createMockSession('1', 'running'),
        createMockSession('2', 'completed'),
        createMockSession('3', 'running'),
      ];

      act(() => {
        result.current.setSessions(mockSessions);
      });

      act(() => {
        result.current.setFilters({ status: 'running' });
      });

      const filtered = result.current.getFilteredSessions();
      expect(filtered).toHaveLength(2);
      expect(filtered.every(s => s.status === 'running')).toBe(true);
    });

    it('should sort sessions correctly', () => {
      const { result } = renderHook(() => useSessionStore());
      const mockSessions = [
        { ...createMockSession('1'), startTime: '2024-01-01T10:00:00Z' },
        { ...createMockSession('2'), startTime: '2024-01-01T12:00:00Z' },
        { ...createMockSession('3'), startTime: '2024-01-01T08:00:00Z' },
      ];

      act(() => {
        result.current.setSessions(mockSessions);
        result.current.setSorting('startTime', 'asc');
      });

      const sorted = result.current.getFilteredSessions();
      expect(sorted[0].id).toBe('3'); // Earliest time
      expect(sorted[1].id).toBe('1');
      expect(sorted[2].id).toBe('2'); // Latest time
    });

    it('should search sessions correctly', () => {
      const { result } = renderHook(() => useSessionStore());
      const mockSessions = [
        { ...createMockSession('1'), initialTask: 'Create user authentication' },
        { ...createMockSession('2'), initialTask: 'Build dashboard' },
        { ...createMockSession('3'), initialTask: 'User profile management' },
      ];

      act(() => {
        result.current.setSessions(mockSessions);
        result.current.setFilters({ searchTerm: 'user' });
      });

      const filtered = result.current.getFilteredSessions();
      expect(filtered).toHaveLength(2);
      expect(filtered.some(s => s.id === '1')).toBe(true);
      expect(filtered.some(s => s.id === '3')).toBe(true);
    });
  });

  describe('Data Consistency Critical Tests', () => {
    it('should maintain consistent session counts across all operations', () => {
      const { result } = renderHook(() => useSessionStore());
      const initialSessions = [
        createMockSession('1', 'running'),
        createMockSession('2', 'completed'),
        createMockSession('3', 'running'),
      ];

      // Set initial sessions
      act(() => {
        result.current.setSessions(initialSessions);
      });

      expect(result.current.sessions).toHaveLength(3);
      expect(result.current.getFilteredSessions()).toHaveLength(3);

      // Filter to running sessions
      act(() => {
        result.current.setFilters({ status: 'running' });
      });

      const runningCount = result.current.getFilteredSessions().length;
      expect(runningCount).toBe(2);

      // Add new running session
      const newSession = createMockSession('4', 'running');
      act(() => {
        result.current.addSession(newSession);
      });

      // Verify counts are updated consistently
      expect(result.current.sessions).toHaveLength(4);
      expect(result.current.getFilteredSessions()).toHaveLength(3); // 3 running sessions now

      // Remove a running session
      act(() => {
        result.current.removeSession('1');
      });

      expect(result.current.sessions).toHaveLength(3);
      expect(result.current.getFilteredSessions()).toHaveLength(2); // 2 running sessions now
    });

    it('should handle concurrent updates without data corruption', () => {
      const { result } = renderHook(() => useSessionStore());
      const mockSession = createMockSession('1');

      act(() => {
        result.current.setSessions([mockSession]);
        result.current.setSelectedSession('1');
      });

      // Simulate concurrent updates
      act(() => {
        result.current.updateSession('1', { status: 'paused' });
        result.current.addMessage(createMockMessage('1', 'manager'));
        result.current.updateSession('1', { status: 'running' });
      });

      // Verify final state is consistent
      expect(result.current.sessions[0].status).toBe('running');
      expect(result.current.sessions[0].messages).toHaveLength(1);
      expect(result.current.selectedSession?.status).toBe('running');
      expect(result.current.selectedSession?.messages).toHaveLength(1);
    });

    it('should maintain referential integrity between sessions and selectedSession', () => {
      const { result } = renderHook(() => useSessionStore());
      const mockSession = createMockSession('1');

      act(() => {
        result.current.setSessions([mockSession]);
        result.current.setSelectedSession('1');
      });

      // Update session should also update selectedSession
      act(() => {
        result.current.updateSession('1', { status: 'completed' });
      });

      expect(result.current.sessions[0].status).toBe('completed');
      expect(result.current.selectedSession?.status).toBe('completed');

      // Add message should update both
      const message = createMockMessage('1', 'worker');
      act(() => {
        result.current.addMessage(message);
      });

      expect(result.current.sessions[0].messages).toContain(message);
      expect(result.current.selectedSession?.messages).toContain(message);
    });

    it('should handle rapid state changes without inconsistencies', async () => {
      const { result } = renderHook(() => useSessionStore());
      
      // Simulate rapid state changes
      const operations = Array.from({ length: 10 }, (_, i) => createMockSession(`${i + 1}`));
      
      act(() => {
        operations.forEach(session => {
          result.current.addSession(session);
        });
      });

      expect(result.current.sessions).toHaveLength(10);

      // Rapid updates
      act(() => {
        operations.forEach((_, i) => {
          result.current.updateSession(`${i + 1}`, { status: 'completed' });
        });
      });

      expect(result.current.sessions.every(s => s.status === 'completed')).toBe(true);

      // Rapid deletions
      act(() => {
        operations.slice(0, 5).forEach((_, i) => {
          result.current.removeSession(`${i + 1}`);
        });
      });

      expect(result.current.sessions).toHaveLength(5);
    });
  });

  describe('Memory Management', () => {
    it('should clear state correctly on reset', () => {
      const { result } = renderHook(() => useSessionStore());
      const mockSessions = [createMockSession('1'), createMockSession('2')];

      act(() => {
        result.current.setSessions(mockSessions);
        result.current.setSelectedSession('1');
        result.current.setConnectionStatus(true);
        result.current.setFilters({ status: 'running' });
      });

      // Verify state is set
      expect(result.current.sessions).toHaveLength(2);
      expect(result.current.selectedSession).not.toBeNull();
      expect(result.current.isConnected).toBe(true);

      // Reset
      act(() => {
        result.current.reset();
      });

      // Verify clean slate
      expect(result.current.sessions).toEqual([]);
      expect(result.current.selectedSession).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isConnected).toBe(false);
      expect(result.current.filters).toEqual({});
      expect(result.current.error).toBeNull();
    });

    it('should handle large datasets efficiently', () => {
      const { result } = renderHook(() => useSessionStore());
      
      // Create large dataset
      const largeSessions = Array.from({ length: 1000 }, (_, i) => 
        createMockSession(`${i + 1}`, i % 3 === 0 ? 'running' : 'completed')
      );

      const startTime = performance.now();
      
      act(() => {
        result.current.setSessions(largeSessions);
      });

      const setTime = performance.now() - startTime;
      expect(setTime).toBeLessThan(100); // Should complete within 100ms

      const filterStart = performance.now();
      
      act(() => {
        result.current.setFilters({ status: 'running' });
      });
      
      const filtered = result.current.getFilteredSessions();
      const filterTime = performance.now() - filterStart;
      
      expect(filterTime).toBeLessThan(50); // Filtering should be fast
      expect(filtered.length).toBeGreaterThan(0);
    });
  });
});
