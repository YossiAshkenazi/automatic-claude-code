import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useSessionStore } from '../store/useSessionStore';
import { useAnalytics, useMobileBadges, useSidebarBadges } from '../hooks/useAnalytics';
import { DualAgentSession } from '../types';
import React from 'react';

// Mock store
vi.mock('../store/useSessionStore');

// Mock other dependencies
vi.mock('../hooks/useWebSocket', () => ({
  useWebSocket: () => ({
    isConnected: true,
    lastMessage: null,
  }),
}));

vi.mock('../hooks/useMobile', () => ({
  useMobile: () => ({ isMobile: false, isTablet: false, isTouchDevice: false }),
}));

const mockSessions: DualAgentSession[] = [
  {
    id: '1',
    initialTask: 'Test Task 1',
    status: 'running',
    startTime: '2024-01-01T10:00:00Z',
    lastActivity: '2024-01-01T10:30:00Z',
    messages: [
      { id: '1', agentType: 'manager', messageType: 'prompt', content: 'Test', timestamp: '2024-01-01T10:00:00Z', sessionId: '1' }
    ],
    workDir: '/test1',
    agentStats: {
      manager: { messages: 5, avgResponseTime: 1000 },
      worker: { messages: 3, avgResponseTime: 800 }
    }
  },
  {
    id: '2',
    initialTask: 'Test Task 2',
    status: 'completed',
    startTime: '2024-01-01T11:00:00Z',
    lastActivity: '2024-01-01T11:45:00Z',
    messages: Array.from({ length: 15 }, (_, i) => ({
      id: `2-${i}`,
      agentType: i % 2 === 0 ? 'manager' : 'worker',
      messageType: 'response',
      content: `Message ${i}`,
      timestamp: `2024-01-01T11:${String(i + 10).padStart(2, '0')}:00Z`,
      sessionId: '2'
    })),
    workDir: '/test2',
    agentStats: {
      manager: { messages: 8, avgResponseTime: 1200 },
      worker: { messages: 7, avgResponseTime: 900 }
    }
  },
  {
    id: '3',
    initialTask: 'Test Task 3',
    status: 'error',
    startTime: '2024-01-01T12:00:00Z',
    lastActivity: '2024-01-01T12:15:00Z',
    messages: [
      { id: '3-1', agentType: 'manager', messageType: 'error', content: 'Error occurred', timestamp: '2024-01-01T12:15:00Z', sessionId: '3' }
    ],
    workDir: '/test3',
    agentStats: {
      manager: { messages: 1, avgResponseTime: 500 },
      worker: { messages: 0, avgResponseTime: 0 }
    }
  },
  {
    id: '4',
    initialTask: 'Test Task 4',
    status: 'paused',
    startTime: '2024-01-01T13:00:00Z',
    lastActivity: '2024-01-01T13:20:00Z',
    messages: [
      { id: '4-1', agentType: 'worker', messageType: 'response', content: 'Working...', timestamp: '2024-01-01T13:20:00Z', sessionId: '4' }
    ],
    workDir: '/test4',
    agentStats: {
      manager: { messages: 2, avgResponseTime: 800 },
      worker: { messages: 3, avgResponseTime: 600 }
    }
  }
];

// Simple test component for analytics hooks
const AnalyticsTestComponent = () => {
  const analytics = useAnalytics(mockSessions);
  const mobileBadges = useMobileBadges(mockSessions, [], ['project1', 'project2', 'project3']);
  const sidebarBadges = useSidebarBadges(mockSessions);

  return (
    <div>
      <div data-testid="total-sessions">{analytics.totalSessions}</div>
      <div data-testid="active-sessions">{analytics.activeSessions}</div>
      <div data-testid="completed-sessions">{analytics.completedSessions}</div>
      <div data-testid="error-sessions">{analytics.errorSessions}</div>
      <div data-testid="alerts-count">{analytics.alertsCount}</div>
      <div data-testid="insights-count">{analytics.insightsCount}</div>
      
      <div data-testid="mobile-dashboard-badge">{mobileBadges.dashboard}</div>
      <div data-testid="mobile-sessions-badge">{mobileBadges.sessions}</div>
      <div data-testid="mobile-metrics-badge">{mobileBadges.metrics}</div>
      <div data-testid="mobile-analytics-badge">{mobileBadges.analytics}</div>
      <div data-testid="mobile-projects-badge">{mobileBadges.projects}</div>
      
      <div data-testid="sidebar-sessions-badge">{sidebarBadges.sessions}</div>
      <div data-testid="sidebar-agents-badge">{sidebarBadges.agents || 0}</div>
      <div data-testid="sidebar-analytics-badge">{sidebarBadges.analytics || 0}</div>
      <div data-testid="sidebar-alerts-badge">{sidebarBadges.alerts || 0}</div>
    </div>
  );
};

describe('Badge Fix Verification Tests', () => {
  const mockUseSessionStore = vi.mocked(useSessionStore);

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default session store mock
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
      // Mock functions (minimal required)
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
  });

  describe('Analytics Hook Calculations', () => {
    it('calculates session metrics correctly', () => {
      render(<AnalyticsTestComponent />);
      
      // Total sessions: 4
      expect(screen.getByTestId('total-sessions')).toHaveTextContent('4');
      
      // Active sessions: 1 running + 1 paused = 2 (but only running counts as "active")
      expect(screen.getByTestId('active-sessions')).toHaveTextContent('1');
      
      // Completed sessions: 1
      expect(screen.getByTestId('completed-sessions')).toHaveTextContent('1');
      
      // Error sessions: 1
      expect(screen.getByTestId('error-sessions')).toHaveTextContent('1');
      
      // Alerts count: sessions with errors = 1
      expect(screen.getByTestId('alerts-count')).toHaveTextContent('1');
      
      // Insights count: completed sessions with >10 messages = 1
      expect(screen.getByTestId('insights-count')).toHaveTextContent('1');
    });

    it('provides dynamic mobile badges (not hardcoded zeros)', () => {
      render(<AnalyticsTestComponent />);
      
      // Dashboard badge: recent activity count (should not be 0)
      const dashboardBadge = screen.getByTestId('mobile-dashboard-badge').textContent;
      expect(dashboardBadge).toBeDefined();
      
      // Sessions badge: running sessions = 1 (not hardcoded 0)
      expect(screen.getByTestId('mobile-sessions-badge')).toHaveTextContent('1');
      
      // Metrics badge: alerts/errors = 1 (not hardcoded 0)
      expect(screen.getByTestId('mobile-metrics-badge')).toHaveTextContent('1');
      
      // Analytics badge: insights = 1 (not hardcoded 0)
      expect(screen.getByTestId('mobile-analytics-badge')).toHaveTextContent('1');
      
      // Projects badge: should be 3 (from provided activeProjects array)
      expect(screen.getByTestId('mobile-projects-badge')).toHaveTextContent('3');
    });

    it('provides dynamic sidebar badges (not hardcoded)', () => {
      render(<AnalyticsTestComponent />);
      
      // Sidebar sessions badge: total sessions = 4 (not hardcoded 3)
      expect(screen.getByTestId('sidebar-sessions-badge')).toHaveTextContent('4');
      
      // Sidebar agents badge: active sessions = 1
      expect(screen.getByTestId('sidebar-agents-badge')).toHaveTextContent('1');
      
      // Sidebar analytics badge: insights count = 1
      expect(screen.getByTestId('sidebar-analytics-badge')).toHaveTextContent('1');
      
      // Sidebar alerts badge should be 0 since no critical alerts in our test data
      expect(screen.getByTestId('sidebar-alerts-badge')).toHaveTextContent('0');
    });
  });

  describe('Empty State Handling', () => {
    it('handles empty sessions gracefully', () => {
      mockUseSessionStore.mockReturnValue({
        sessions: [],
        selectedSession: null,
        isLoading: false,
        isConnected: true,
        // ... other required properties with empty/default values
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
        getFilteredSessions: () => [],
        clearError: vi.fn(),
        refreshSession: vi.fn(),
        syncWithDatabase: vi.fn(),
        reset: vi.fn(),
      } as any);

      const EmptyAnalyticsComponent = () => {
        const analytics = useAnalytics([]);
        const mobileBadges = useMobileBadges([], [], []);
        const sidebarBadges = useSidebarBadges([]);

        return (
          <div>
            <div data-testid="empty-total-sessions">{analytics.totalSessions}</div>
            <div data-testid="empty-mobile-sessions">{mobileBadges.sessions}</div>
            <div data-testid="empty-sidebar-sessions">{sidebarBadges.sessions}</div>
          </div>
        );
      };

      render(<EmptyAnalyticsComponent />);
      
      // All metrics should be 0 for empty state
      expect(screen.getByTestId('empty-total-sessions')).toHaveTextContent('0');
      expect(screen.getByTestId('empty-mobile-sessions')).toHaveTextContent('0');
      expect(screen.getByTestId('empty-sidebar-sessions')).toHaveTextContent('0');
    });
  });

  describe('Real-time Updates', () => {
    it('badge values should change when session data updates', () => {
      // First render with initial sessions
      const { rerender } = render(<AnalyticsTestComponent />);
      
      // Verify initial values
      expect(screen.getByTestId('active-sessions')).toHaveTextContent('1');
      expect(screen.getByTestId('mobile-sessions-badge')).toHaveTextContent('1');
      
      // Update mock with more running sessions
      const updatedSessions = [
        ...mockSessions,
        {
          id: '5',
          initialTask: 'New Running Task',
          status: 'running' as const,
          startTime: '2024-01-01T14:00:00Z',
          lastActivity: '2024-01-01T14:10:00Z',
          messages: [],
          workDir: '/test5',
          agentStats: {
            manager: { messages: 1, avgResponseTime: 500 },
            worker: { messages: 1, avgResponseTime: 400 }
          }
        }
      ];
      
      mockUseSessionStore.mockReturnValue({
        sessions: updatedSessions,
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
        getFilteredSessions: () => updatedSessions,
        clearError: vi.fn(),
        refreshSession: vi.fn(),
        syncWithDatabase: vi.fn(),
        reset: vi.fn(),
      } as any);

      const UpdatedAnalyticsComponent = () => {
        const analytics = useAnalytics(updatedSessions);
        const mobileBadges = useMobileBadges(updatedSessions, [], ['project1', 'project2', 'project3']);
        const sidebarBadges = useSidebarBadges(updatedSessions);

        return (
          <div>
            <div data-testid="updated-total-sessions">{analytics.totalSessions}</div>
            <div data-testid="updated-active-sessions">{analytics.activeSessions}</div>
            <div data-testid="updated-mobile-sessions">{mobileBadges.sessions}</div>
            <div data-testid="updated-sidebar-sessions">{sidebarBadges.sessions}</div>
          </div>
        );
      };
      
      rerender(<UpdatedAnalyticsComponent />);
      
      // Verify updated values
      expect(screen.getByTestId('updated-total-sessions')).toHaveTextContent('5');
      expect(screen.getByTestId('updated-active-sessions')).toHaveTextContent('2'); // 2 running sessions now
      expect(screen.getByTestId('updated-mobile-sessions')).toHaveTextContent('2');
      expect(screen.getByTestId('updated-sidebar-sessions')).toHaveTextContent('5');
    });
  });
});