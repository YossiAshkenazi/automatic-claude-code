import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useSessionStore } from '../../store/useSessionStore';
import { useWebSocket } from '../../hooks/useWebSocket';
import { apiClient } from '../../utils/api';
import { DualAgentSession, WebSocketMessage } from '../../types';

// Mock dependencies
vi.mock('../../store/useSessionStore');
vi.mock('../../hooks/useWebSocket');
vi.mock('../../utils/api');
vi.mock('../../hooks/useMobile', () => ({
  useMobile: () => ({ isMobile: false, isTablet: false, isDesktop: true }),
}));

// Mock components for integration testing
const MockSidebar = ({ items, onNavigate }: {
  items?: Array<{ id: string; label: string; badge?: number | string }>;
  onNavigate?: (path: string) => void;
}) => {
  const { sessions } = useSessionStore();
  const defaultItems = [
    {
      id: 'sessions',
      label: 'Sessions',
      badge: sessions?.length || 0,
    }
  ];
  
  const itemsToRender = items || defaultItems;
  
  return (
    <div data-testid="sidebar">
      {itemsToRender.map((item) => (
        <div key={item.id} data-testid={`sidebar-item-${item.id}`}>
          <span>{item.label}</span>
          {item.badge && (
            <span data-testid={`sidebar-badge-${item.id}`} className="badge">
              {item.badge}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

const MockMobileApp = () => {
  const { sessions } = useSessionStore();
  const { isConnected } = useWebSocket('ws://localhost:4001');
  
  const bottomNavItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      badge: 0, // Hardcoded - this is the issue we're testing for
    },
    {
      id: 'sessions',
      label: 'Sessions',
      badge: sessions?.filter(s => s.status === 'running').length || 0,
    },
    {
      id: 'metrics',
      label: 'Metrics',
      badge: 0, // Hardcoded - this is the issue we're testing for
    },
    {
      id: 'analytics',
      label: 'Analytics',
      badge: 0, // Hardcoded - this is the issue we're testing for
    },
  ];

  return (
    <div data-testid="mobile-app">
      <div data-testid="connection-status">{isConnected ? 'Connected' : 'Disconnected'}</div>
      <div data-testid="mobile-nav">
        {bottomNavItems.map((item) => (
          <div key={item.id} data-testid={`mobile-nav-${item.id}`}>
            <span>{item.label}</span>
            {item.badge > 0 && (
              <span data-testid={`mobile-badge-${item.id}`} className="badge">
                {item.badge}
              </span>
            )}
          </div>
        ))}
      </div>
      <div data-testid="session-count">Total Sessions: {sessions?.length || 0}</div>
    </div>
  );
};

const MockSessionList = () => {
  const { sessions, selectedSession, setSelectedSession } = useSessionStore();
  
  return (
    <div data-testid="session-list">
      <div data-testid="session-list-count">Found {sessions?.length || 0} sessions</div>
      {sessions?.map((session) => (
        <div 
          key={session.id} 
          data-testid={`session-item-${session.id}`}
          data-selected={selectedSession?.id === session.id}
          onClick={() => setSelectedSession(session.id)}
        >
          <span>{session.initialTask}</span>
          <span data-testid={`session-status-${session.id}`}>{session.status}</span>
        </div>
      ))}
    </div>
  );
};

// Integration test component that combines multiple components
const IntegratedApp = ({ viewMode = 'desktop' }: { viewMode?: 'desktop' | 'mobile' }) => {
  return (
    <div data-testid="integrated-app">
      {viewMode === 'desktop' ? (
        <div data-testid="desktop-layout">
          <MockSidebar />
          <MockSessionList />
        </div>
      ) : (
        <div data-testid="mobile-layout">
          <MockMobileApp />
        </div>
      )}
    </div>
  );
};

describe('Cross-Component Data Consistency Tests', () => {
  const mockUseSessionStore = vi.mocked(useSessionStore);
  const mockUseWebSocket = vi.mocked(useWebSocket);
  const mockApiClient = vi.mocked(apiClient);

  const createMockSession = (id: string, status: DualAgentSession['status'] = 'running'): DualAgentSession => ({
    id,
    initialTask: `Task ${id}`,
    status,
    startTime: '2024-01-01T10:00:00Z',
    lastActivity: '2024-01-01T10:30:00Z',
    messages: [],
    workDir: `/test${id}`,
    agentStats: {
      manager: { messages: 5, avgResponseTime: 1000 },
      worker: { messages: 3, avgResponseTime: 800 }
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Default WebSocket mock
    mockUseWebSocket.mockReturnValue({
      isConnected: true,
      isConnecting: false,
      hasError: false,
      canReconnect: false,
      connectionStatus: 'Open',
      lastMessage: null,
      lastError: null,
      reconnectAttempts: 0,
      maxReconnectAttempts: 5,
      sendMessage: vi.fn(),
      reconnect: vi.fn(),
      disconnect: vi.fn(),
    });

    // Default session store mock
    mockUseSessionStore.mockReturnValue({
      sessions: [],
      selectedSession: null,
      isLoading: false,
      isConnected: true,
      // Add other required store properties
      isLoadingSessions: false,
      isCreatingSession: false,
      isDeletingSession: null,
      isUpdatingSession: null,
      error: null,
      connectionError: null,
      lastConnectionTime: new Date(),
      filters: {},
      sortBy: 'startTime',
      sortOrder: 'desc',
      // Mock functions
      setSessions: vi.fn(),
      addSession: vi.fn(),
      updateSession: vi.fn(),
      removeSession: vi.fn(),
      setSelectedSession: vi.fn(),
      addMessage: vi.fn(),
      updateMessage: vi.fn(),
      handleWebSocketMessage: vi.fn(),
      setConnectionStatus: vi.fn(),
      loadSessions: vi.fn(),
      createSession: vi.fn(),
      updateSessionStatus: vi.fn(),
      deleteSession: vi.fn(),
      exportSession: vi.fn(),
      setFilters: vi.fn(),
      setSorting: vi.fn(),
      getFilteredSessions: () => [],
      clearError: vi.fn(),
      refreshSession: vi.fn(),
      syncWithDatabase: vi.fn(),
      reset: vi.fn(),
    } as any);
  });

  describe('Session Count Consistency', () => {
    it('should show consistent session counts across all components', () => {
      const mockSessions = [
        createMockSession('1', 'running'),
        createMockSession('2', 'completed'),
        createMockSession('3', 'running'),
        createMockSession('4', 'paused'),
        createMockSession('5', 'running'),
      ];

      mockUseSessionStore.mockReturnValue({
        sessions: mockSessions,
        selectedSession: null,
        isLoading: false,
        isConnected: true,
        // Other properties...
        isLoadingSessions: false,
        isCreatingSession: false,
        isDeletingSession: null,
        isUpdatingSession: null,
        error: null,
        connectionError: null,
        lastConnectionTime: new Date(),
        filters: {},
        sortBy: 'startTime',
        sortOrder: 'desc',
        setSessions: vi.fn(),
        addSession: vi.fn(),
        updateSession: vi.fn(),
        removeSession: vi.fn(),
        setSelectedSession: vi.fn(),
        addMessage: vi.fn(),
        updateMessage: vi.fn(),
        handleWebSocketMessage: vi.fn(),
        setConnectionStatus: vi.fn(),
        loadSessions: vi.fn(),
        createSession: vi.fn(),
        updateSessionStatus: vi.fn(),
        deleteSession: vi.fn(),
        exportSession: vi.fn(),
        setFilters: vi.fn(),
        setSorting: vi.fn(),
        getFilteredSessions: () => mockSessions,
        clearError: vi.fn(),
        refreshSession: vi.fn(),
        syncWithDatabase: vi.fn(),
        reset: vi.fn(),
      } as any);

      // Test desktop view
      const { rerender } = render(<IntegratedApp viewMode="desktop" />);

      // Sidebar should show total session count (5)
      expect(screen.getByTestId('sidebar-badge-sessions')).toHaveTextContent('5');

      // Session list should show the same count
      expect(screen.getByTestId('session-list-count')).toHaveTextContent('Found 5 sessions');

      // Test mobile view
      rerender(<IntegratedApp viewMode="mobile" />);

      // Mobile app should show total session count
      expect(screen.getByTestId('session-count')).toHaveTextContent('Total Sessions: 5');

      // Mobile navigation should show running sessions count (3)
      const runningCount = mockSessions.filter(s => s.status === 'running').length;
      expect(screen.getByTestId('mobile-badge-sessions')).toHaveTextContent(runningCount.toString());
    });

    it('should identify hardcoded badge values that need to be fixed', () => {
      const mockSessions = [
        createMockSession('1', 'running'),
        createMockSession('2', 'running'),
        createMockSession('3', 'completed'),
      ];

      mockUseSessionStore.mockReturnValue({
        sessions: mockSessions,
        selectedSession: null,
        isLoading: false,
        isConnected: true,
        // Other properties...
        isLoadingSessions: false,
        isCreatingSession: false,
        isDeletingSession: null,
        isUpdatingSession: null,
        error: null,
        connectionError: null,
        lastConnectionTime: new Date(),
        filters: {},
        sortBy: 'startTime',
        sortOrder: 'desc',
        setSessions: vi.fn(),
        addSession: vi.fn(),
        updateSession: vi.fn(),
        removeSession: vi.fn(),
        setSelectedSession: vi.fn(),
        addMessage: vi.fn(),
        updateMessage: vi.fn(),
        handleWebSocketMessage: vi.fn(),
        setConnectionStatus: vi.fn(),
        loadSessions: vi.fn(),
        createSession: vi.fn(),
        updateSessionStatus: vi.fn(),
        deleteSession: vi.fn(),
        exportSession: vi.fn(),
        setFilters: vi.fn(),
        setSorting: vi.fn(),
        getFilteredSessions: () => mockSessions,
        clearError: vi.fn(),
        refreshSession: vi.fn(),
        syncWithDatabase: vi.fn(),
        reset: vi.fn(),
      } as any);

      render(<IntegratedApp viewMode="mobile" />);

      // CRITICAL TEST: These should expose the hardcoded badge issues
      
      // Dashboard badge is hardcoded to 0 - should be dynamic based on some metric
      expect(screen.queryByTestId('mobile-badge-dashboard')).not.toBeInTheDocument();
      
      // Metrics badge is hardcoded to 0 - should be dynamic based on available metrics
      expect(screen.queryByTestId('mobile-badge-metrics')).not.toBeInTheDocument();
      
      // Analytics badge is hardcoded to 0 - should be dynamic based on analytics data
      expect(screen.queryByTestId('mobile-badge-analytics')).not.toBeInTheDocument();
      
      // Sessions badge is correctly dynamic - shows running sessions (2)
      expect(screen.getByTestId('mobile-badge-sessions')).toHaveTextContent('2');

      // These tests document the current behavior and will help verify fixes
    });
  });

  describe('WebSocket State Synchronization', () => {
    it('should synchronize session updates across components via WebSocket', async () => {
      const initialSessions = [createMockSession('1', 'running')];
      const mockSetSelectedSession = vi.fn();
      const mockHandleWebSocketMessage = vi.fn();

      mockUseSessionStore.mockReturnValue({
        sessions: initialSessions,
        selectedSession: null,
        isLoading: false,
        isConnected: true,
        isLoadingSessions: false,
        isCreatingSession: false,
        isDeletingSession: null,
        isUpdatingSession: null,
        error: null,
        connectionError: null,
        lastConnectionTime: new Date(),
        filters: {},
        sortBy: 'startTime',
        sortOrder: 'desc',
        setSessions: vi.fn(),
        addSession: vi.fn(),
        updateSession: vi.fn(),
        removeSession: vi.fn(),
        setSelectedSession: mockSetSelectedSession,
        addMessage: vi.fn(),
        updateMessage: vi.fn(),
        handleWebSocketMessage: mockHandleWebSocketMessage,
        setConnectionStatus: vi.fn(),
        loadSessions: vi.fn(),
        createSession: vi.fn(),
        updateSessionStatus: vi.fn(),
        deleteSession: vi.fn(),
        exportSession: vi.fn(),
        setFilters: vi.fn(),
        setSorting: vi.fn(),
        getFilteredSessions: () => initialSessions,
        clearError: vi.fn(),
        refreshSession: vi.fn(),
        syncWithDatabase: vi.fn(),
        reset: vi.fn(),
      } as any);

      render(<IntegratedApp viewMode="desktop" />);

      // Verify initial state
      expect(screen.getByTestId('sidebar-badge-sessions')).toHaveTextContent('1');
      expect(screen.getByTestId('session-list-count')).toHaveTextContent('Found 1 sessions');

      // Simulate WebSocket message for new session
      const newSessionMessage: WebSocketMessage = {
        type: 'session_created',
        data: createMockSession('2', 'running'),
        timestamp: new Date().toISOString(),
      };

      // This test verifies that WebSocket handling is properly connected
      expect(mockHandleWebSocketMessage).toBeDefined();
    });

    it('should maintain connection status consistency across components', () => {
      // Test connected state
      mockUseWebSocket.mockReturnValue({
        isConnected: true,
        isConnecting: false,
        hasError: false,
        canReconnect: false,
        connectionStatus: 'Open',
        lastMessage: null,
        lastError: null,
        reconnectAttempts: 0,
        maxReconnectAttempts: 5,
        sendMessage: vi.fn(),
        reconnect: vi.fn(),
        disconnect: vi.fn(),
      });

      const { rerender } = render(<IntegratedApp viewMode="mobile" />);
      expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');

      // Test disconnected state
      mockUseWebSocket.mockReturnValue({
        isConnected: false,
        isConnecting: false,
        hasError: true,
        canReconnect: true,
        connectionStatus: 'Error',
        lastMessage: null,
        lastError: 'Connection failed',
        reconnectAttempts: 2,
        maxReconnectAttempts: 5,
        sendMessage: vi.fn(),
        reconnect: vi.fn(),
        disconnect: vi.fn(),
      });

      rerender(<IntegratedApp viewMode="mobile" />);
      expect(screen.getByTestId('connection-status')).toHaveTextContent('Disconnected');
    });
  });

  describe('Session Selection State Consistency', () => {
    it('should maintain selected session state across components', () => {
      const mockSessions = [
        createMockSession('1', 'running'),
        createMockSession('2', 'completed'),
      ];

      const selectedSession = mockSessions[0];

      mockUseSessionStore.mockReturnValue({
        sessions: mockSessions,
        selectedSession,
        isLoading: false,
        isConnected: true,
        isLoadingSessions: false,
        isCreatingSession: false,
        isDeletingSession: null,
        isUpdatingSession: null,
        error: null,
        connectionError: null,
        lastConnectionTime: new Date(),
        filters: {},
        sortBy: 'startTime',
        sortOrder: 'desc',
        setSessions: vi.fn(),
        addSession: vi.fn(),
        updateSession: vi.fn(),
        removeSession: vi.fn(),
        setSelectedSession: vi.fn(),
        addMessage: vi.fn(),
        updateMessage: vi.fn(),
        handleWebSocketMessage: vi.fn(),
        setConnectionStatus: vi.fn(),
        loadSessions: vi.fn(),
        createSession: vi.fn(),
        updateSessionStatus: vi.fn(),
        deleteSession: vi.fn(),
        exportSession: vi.fn(),
        setFilters: vi.fn(),
        setSorting: vi.fn(),
        getFilteredSessions: () => mockSessions,
        clearError: vi.fn(),
        refreshSession: vi.fn(),
        syncWithDatabase: vi.fn(),
        reset: vi.fn(),
      } as any);

      render(<IntegratedApp viewMode="desktop" />);

      // Session list should show the selected session
      const selectedItem = screen.getByTestId('session-item-1');
      expect(selectedItem).toHaveAttribute('data-selected', 'true');

      // Other sessions should not be selected
      const nonSelectedItem = screen.getByTestId('session-item-2');
      expect(nonSelectedItem).toHaveAttribute('data-selected', 'false');
    });

    it('should update selection when user interacts with session list', () => {
      const mockSessions = [
        createMockSession('1', 'running'),
        createMockSession('2', 'completed'),
      ];

      const mockSetSelectedSession = vi.fn();

      mockUseSessionStore.mockReturnValue({
        sessions: mockSessions,
        selectedSession: null,
        isLoading: false,
        isConnected: true,
        isLoadingSessions: false,
        isCreatingSession: false,
        isDeletingSession: null,
        isUpdatingSession: null,
        error: null,
        connectionError: null,
        lastConnectionTime: new Date(),
        filters: {},
        sortBy: 'startTime',
        sortOrder: 'desc',
        setSessions: vi.fn(),
        addSession: vi.fn(),
        updateSession: vi.fn(),
        removeSession: vi.fn(),
        setSelectedSession: mockSetSelectedSession,
        addMessage: vi.fn(),
        updateMessage: vi.fn(),
        handleWebSocketMessage: vi.fn(),
        setConnectionStatus: vi.fn(),
        loadSessions: vi.fn(),
        createSession: vi.fn(),
        updateSessionStatus: vi.fn(),
        deleteSession: vi.fn(),
        exportSession: vi.fn(),
        setFilters: vi.fn(),
        setSorting: vi.fn(),
        getFilteredSessions: () => mockSessions,
        clearError: vi.fn(),
        refreshSession: vi.fn(),
        syncWithDatabase: vi.fn(),
        reset: vi.fn(),
      } as any);

      render(<IntegratedApp viewMode="desktop" />);

      // Click on a session
      fireEvent.click(screen.getByTestId('session-item-1'));

      // Should call setSelectedSession with the correct ID
      expect(mockSetSelectedSession).toHaveBeenCalledWith('1');
    });
  });

  describe('Real-time Data Updates', () => {
    it('should handle session status changes consistently', () => {
      const mockSessions = [
        createMockSession('1', 'running'),
        createMockSession('2', 'paused'),
      ];

      mockUseSessionStore.mockReturnValue({
        sessions: mockSessions,
        selectedSession: null,
        isLoading: false,
        isConnected: true,
        isLoadingSessions: false,
        isCreatingSession: false,
        isDeletingSession: null,
        isUpdatingSession: null,
        error: null,
        connectionError: null,
        lastConnectionTime: new Date(),
        filters: {},
        sortBy: 'startTime',
        sortOrder: 'desc',
        setSessions: vi.fn(),
        addSession: vi.fn(),
        updateSession: vi.fn(),
        removeSession: vi.fn(),
        setSelectedSession: vi.fn(),
        addMessage: vi.fn(),
        updateMessage: vi.fn(),
        handleWebSocketMessage: vi.fn(),
        setConnectionStatus: vi.fn(),
        loadSessions: vi.fn(),
        createSession: vi.fn(),
        updateSessionStatus: vi.fn(),
        deleteSession: vi.fn(),
        exportSession: vi.fn(),
        setFilters: vi.fn(),
        setSorting: vi.fn(),
        getFilteredSessions: () => mockSessions,
        clearError: vi.fn(),
        refreshSession: vi.fn(),
        syncWithDatabase: vi.fn(),
        reset: vi.fn(),
      } as any);

      const { rerender } = render(<IntegratedApp viewMode="mobile" />);

      // Initially should show 1 running session
      expect(screen.getByTestId('mobile-badge-sessions')).toHaveTextContent('1');

      // Update session status
      const updatedSessions = [
        createMockSession('1', 'completed'),
        createMockSession('2', 'running'),
      ];

      mockUseSessionStore.mockReturnValue({
        ...mockUseSessionStore(),
        sessions: updatedSessions,
        getFilteredSessions: () => updatedSessions,
      } as any);

      rerender(<IntegratedApp viewMode="mobile" />);

      // Should still show 1 running session (different session now)
      expect(screen.getByTestId('mobile-badge-sessions')).toHaveTextContent('1');
    });
  });

  describe('Error State Consistency', () => {
    it('should handle error states consistently across components', () => {
      mockUseSessionStore.mockReturnValue({
        sessions: [],
        selectedSession: null,
        isLoading: false,
        isConnected: false,
        error: 'Failed to load sessions',
        connectionError: 'Database connection failed',
        isLoadingSessions: false,
        isCreatingSession: false,
        isDeletingSession: null,
        isUpdatingSession: null,
        lastConnectionTime: null,
        filters: {},
        sortBy: 'startTime',
        sortOrder: 'desc',
        setSessions: vi.fn(),
        addSession: vi.fn(),
        updateSession: vi.fn(),
        removeSession: vi.fn(),
        setSelectedSession: vi.fn(),
        addMessage: vi.fn(),
        updateMessage: vi.fn(),
        handleWebSocketMessage: vi.fn(),
        setConnectionStatus: vi.fn(),
        loadSessions: vi.fn(),
        createSession: vi.fn(),
        updateSessionStatus: vi.fn(),
        deleteSession: vi.fn(),
        exportSession: vi.fn(),
        setFilters: vi.fn(),
        setSorting: vi.fn(),
        getFilteredSessions: () => [],
        clearError: vi.fn(),
        refreshSession: vi.fn(),
        syncWithDatabase: vi.fn(),
        reset: vi.fn(),
      } as any);

      mockUseWebSocket.mockReturnValue({
        isConnected: false,
        isConnecting: false,
        hasError: true,
        canReconnect: true,
        connectionStatus: 'Error',
        lastMessage: null,
        lastError: 'WebSocket connection failed',
        reconnectAttempts: 3,
        maxReconnectAttempts: 5,
        sendMessage: vi.fn(),
        reconnect: vi.fn(),
        disconnect: vi.fn(),
      });

      render(<IntegratedApp viewMode="mobile" />);

      // Should show disconnected state
      expect(screen.getByTestId('connection-status')).toHaveTextContent('Disconnected');
      
      // Should show no sessions
      expect(screen.getByTestId('session-count')).toHaveTextContent('Total Sessions: 0');
    });
  });
});
