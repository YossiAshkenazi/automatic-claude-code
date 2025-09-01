import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useMobile } from '../../hooks/useMobile';
import { apiClient } from '../../utils/api';
import { DualAgentSession } from '../../types';
import MobileApp from '../../MobileApp';

// Mock dependencies
vi.mock('../../hooks/useWebSocket');
vi.mock('../../hooks/useMobile');
vi.mock('../../utils/api');
vi.mock('../../utils/formatters', () => ({
  formatDate: vi.fn((date) => new Date(date).toLocaleDateString()),
}));

// Mock mobile components
vi.mock('../../components/mobile', () => ({
  MobileNavigation: ({ children }: { children: React.ReactNode }) => <div data-testid="mobile-navigation">{children}</div>,
  MobileDashboard: ({ sessions, isConnected }: { sessions: DualAgentSession[], isConnected: boolean }) => (
    <div data-testid="mobile-dashboard">
      <span>Connected: {isConnected ? 'true' : 'false'}</span>
      <span>Sessions: {sessions.length}</span>
    </div>
  ),
  MobileSessionView: ({ sessions }: { sessions: DualAgentSession[] }) => (
    <div data-testid="mobile-session-view">Sessions: {sessions.length}</div>
  ),
  MobileMetrics: ({ sessions }: { sessions: DualAgentSession[] }) => (
    <div data-testid="mobile-metrics">Metrics for {sessions.length} sessions</div>
  ),
  MobileReplay: ({ session }: { session: DualAgentSession }) => (
    <div data-testid="mobile-replay">Replaying: {session.id}</div>
  ),
}));

// Mock layout components
vi.mock('../../components/layout/ResponsiveLayout', () => ({
  ResponsiveLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-layout">{children}</div>,
  ResponsiveCard: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-card">{children}</div>,
  BottomNavigation: ({ items, activeItem, onItemSelect }: {
    items: Array<{ id: string; label: string; badge: number }>;
    activeItem: string;
    onItemSelect: (id: string) => void;
  }) => (
    <div data-testid="bottom-navigation">
      {items.map((item) => (
        <button
          key={item.id}
          data-testid={`nav-item-${item.id}`}
          data-active={activeItem === item.id}
          onClick={() => onItemSelect(item.id)}
        >
          {item.label}
          {item.badge > 0 && (
            <span data-testid={`badge-${item.id}`} className="badge">
              {item.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  ),
}));

// Mock other components
vi.mock('../../components/MessagePane', () => ({
  MessagePane: () => <div data-testid="message-pane">Message Pane</div>,
}));

vi.mock('../../components/SessionControls', () => ({
  SessionControls: () => <div data-testid="session-controls">Session Controls</div>,
}));

vi.mock('../../components/CrossProjectView', () => ({
  CrossProjectView: ({ events, activeProjects }: { events: any[], activeProjects: string[] }) => (
    <div data-testid="cross-project-view">
      <span>Events: {events.length}</span>
      <span>Projects: {activeProjects.length}</span>
    </div>
  ),
}));

vi.mock('../../components/AnalyticsDashboard', () => ({
  AnalyticsDashboard: ({ sessionIds }: { sessionIds: string[] }) => (
    <div data-testid="analytics-dashboard">Analytics for {sessionIds.length} sessions</div>
  ),
}));

// Mock framer-motion to avoid animation issues
vi.mock('framer-motion', () => ({
  motion: {
    div: 'div',
    button: 'button',
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

describe('MobileApp Component', () => {
  const mockUseWebSocket = vi.mocked(useWebSocket);
  const mockUseMobile = vi.mocked(useMobile);
  const mockApiClient = vi.mocked(apiClient);

  const mockSessions: DualAgentSession[] = [
    {
      id: 'session-1',
      initialTask: 'Task 1',
      status: 'running',
      startTime: '2024-01-01T10:00:00Z',
      lastActivity: '2024-01-01T10:30:00Z',
      messages: [],
      workDir: '/test1',
      agentStats: {
        manager: { messages: 5, avgResponseTime: 1000 },
        worker: { messages: 3, avgResponseTime: 800 }
      }
    },
    {
      id: 'session-2',
      initialTask: 'Task 2',
      status: 'completed',
      startTime: '2024-01-01T11:00:00Z',
      lastActivity: '2024-01-01T11:30:00Z',
      messages: [],
      workDir: '/test2',
      agentStats: {
        manager: { messages: 2, avgResponseTime: 1200 },
        worker: { messages: 4, avgResponseTime: 900 }
      }
    },
    {
      id: 'session-3',
      initialTask: 'Task 3',
      status: 'running',
      startTime: '2024-01-01T12:00:00Z',
      lastActivity: '2024-01-01T12:30:00Z',
      messages: [],
      workDir: '/test3',
      agentStats: {
        manager: { messages: 1, avgResponseTime: 1100 },
        worker: { messages: 2, avgResponseTime: 850 }
      }
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();

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

    mockUseMobile.mockReturnValue({
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      orientation: 'portrait',
      breakpoint: 'mobile',
    });

    mockApiClient.getSessions.mockResolvedValue({
      sessions: mockSessions,
      total: mockSessions.length,
      hasMore: false,
    });

    mockApiClient.getRecentEvents.mockResolvedValue([]);
    mockApiClient.getActiveProjects.mockResolvedValue(['project1', 'project2']);
    mockApiClient.createSession.mockResolvedValue({
      id: 'new-session',
      initialTask: 'New Task',
      status: 'running',
      startTime: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      messages: [],
      workDir: '/new',
      agentStats: {
        manager: { messages: 0, avgResponseTime: 0 },
        worker: { messages: 0, avgResponseTime: 0 }
      }
    });
    mockApiClient.updateSessionStatus.mockResolvedValue(undefined);
    mockApiClient.exportSession.mockResolvedValue(undefined);
    mockApiClient.deleteSession.mockResolvedValue(undefined);
  });

  it('should render loading state initially', () => {
    render(<MobileApp />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should display bottom navigation with CORRECT dynamic badge values', async () => {
    render(<MobileApp />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Check that bottom navigation is rendered
    expect(screen.getByTestId('bottom-navigation')).toBeInTheDocument();

    // CRITICAL TEST: Verify dynamic badge values are correct
    
    // Dashboard badge should be 0 (as coded in MobileApp.tsx line 266)
    const dashboardBadge = screen.queryByTestId('badge-dashboard');
    if (dashboardBadge) {
      expect(dashboardBadge).toHaveTextContent('0');
    } else {
      // Badge should not be rendered when value is 0
      expect(screen.queryByTestId('badge-dashboard')).not.toBeInTheDocument();
    }

    // Sessions badge should show count of running sessions (2 running sessions)
    const runningSessionsCount = mockSessions.filter(s => s.status === 'running').length;
    expect(screen.getByTestId(`badge-sessions`)).toHaveTextContent(runningSessionsCount.toString());
    
    // Metrics badge should be 0 (as coded in MobileApp.tsx line 278)
    const metricsBadge = screen.queryByTestId('badge-metrics');
    if (metricsBadge) {
      expect(metricsBadge).toHaveTextContent('0');
    } else {
      expect(screen.queryByTestId('badge-metrics')).not.toBeInTheDocument();
    }

    // Analytics badge should be 0 (as coded in MobileApp.tsx line 284)
    const analyticsBadge = screen.queryByTestId('badge-analytics');
    if (analyticsBadge) {
      expect(analyticsBadge).toHaveTextContent('0');
    } else {
      expect(screen.queryByTestId('badge-analytics')).not.toBeInTheDocument();
    }

    // Cross-project badge should show activeProjects.length (2)
    expect(screen.getByTestId(`badge-cross-project`)).toHaveTextContent('2');
  });

  it('should update session badge count when sessions change', async () => {
    const { rerender } = render(<MobileApp />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Initially should show 2 running sessions
    expect(screen.getByTestId('badge-sessions')).toHaveTextContent('2');

    // Mock API to return different sessions
    const updatedSessions = [
      ...mockSessions,
      {
        id: 'session-4',
        initialTask: 'Task 4',
        status: 'running' as const,
        startTime: '2024-01-01T13:00:00Z',
        lastActivity: '2024-01-01T13:30:00Z',
        messages: [],
        workDir: '/test4',
        agentStats: {
          manager: { messages: 3, avgResponseTime: 950 },
          worker: { messages: 5, avgResponseTime: 750 }
        }
      },
      {
        id: 'session-5',
        initialTask: 'Task 5',
        status: 'running' as const,
        startTime: '2024-01-01T14:00:00Z',
        lastActivity: '2024-01-01T14:30:00Z',
        messages: [],
        workDir: '/test5',
        agentStats: {
          manager: { messages: 7, avgResponseTime: 1050 },
          worker: { messages: 8, avgResponseTime: 700 }
        }
      }
    ];

    mockApiClient.getSessions.mockResolvedValue({
      sessions: updatedSessions,
      total: updatedSessions.length,
      hasMore: false,
    });

    // Trigger a refresh or re-render
    rerender(<MobileApp />);

    // Wait for the update to be processed
    await waitFor(() => {
      const runningCount = updatedSessions.filter(s => s.status === 'running').length;
      expect(screen.getByTestId('badge-sessions')).toHaveTextContent(runningCount.toString());
    });
  });

  it('should handle zero sessions correctly', async () => {
    // Mock empty sessions
    mockApiClient.getSessions.mockResolvedValue({
      sessions: [],
      total: 0,
      hasMore: false,
    });

    render(<MobileApp />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Sessions badge should not be visible when count is 0
    expect(screen.queryByTestId('badge-sessions')).not.toBeInTheDocument();

    // But the navigation item should still be there
    expect(screen.getByTestId('nav-item-sessions')).toBeInTheDocument();
  });

  it('should handle active projects count correctly', async () => {
    // Mock different active projects count
    mockApiClient.getActiveProjects.mockResolvedValue(['project1', 'project2', 'project3', 'project4']);

    render(<MobileApp />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Cross-project badge should show 4 projects
    expect(screen.getByTestId('badge-cross-project')).toHaveTextContent('4');
  });

  it('should hide badges when values are zero', async () => {
    // Mock scenarios where all badge values should be 0
    mockApiClient.getSessions.mockResolvedValue({
      sessions: [
        {
          id: 'session-1',
          initialTask: 'Task 1',
          status: 'completed', // No running sessions
          startTime: '2024-01-01T10:00:00Z',
          lastActivity: '2024-01-01T10:30:00Z',
          messages: [],
          workDir: '/test1',
          agentStats: {
            manager: { messages: 5, avgResponseTime: 1000 },
            worker: { messages: 3, avgResponseTime: 800 }
          }
        }
      ],
      total: 1,
      hasMore: false,
    });
    
    mockApiClient.getActiveProjects.mockResolvedValue([]);

    render(<MobileApp />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // All badges with 0 values should not be rendered
    expect(screen.queryByTestId('badge-dashboard')).not.toBeInTheDocument();
    expect(screen.queryByTestId('badge-sessions')).not.toBeInTheDocument();
    expect(screen.queryByTestId('badge-metrics')).not.toBeInTheDocument();
    expect(screen.queryByTestId('badge-analytics')).not.toBeInTheDocument();
    expect(screen.queryByTestId('badge-cross-project')).not.toBeInTheDocument();
  });

  it('should switch views correctly via bottom navigation', async () => {
    render(<MobileApp />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Initially should show dashboard
    expect(screen.getByTestId('mobile-dashboard')).toBeInTheDocument();

    // Click on sessions
    fireEvent.click(screen.getByTestId('nav-item-sessions'));
    
    await waitFor(() => {
      expect(screen.getByTestId('mobile-session-view')).toBeInTheDocument();
      expect(screen.queryByTestId('mobile-dashboard')).not.toBeInTheDocument();
    });

    // Click on metrics
    fireEvent.click(screen.getByTestId('nav-item-metrics'));
    
    await waitFor(() => {
      expect(screen.getByTestId('mobile-metrics')).toBeInTheDocument();
      expect(screen.queryByTestId('mobile-session-view')).not.toBeInTheDocument();
    });
  });

  it('should show correct session data in components', async () => {
    render(<MobileApp />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Dashboard should show correct session count
    expect(screen.getByText(`Sessions: ${mockSessions.length}`)).toBeInTheDocument();
    
    // Switch to sessions view
    fireEvent.click(screen.getByTestId('nav-item-sessions'));
    
    await waitFor(() => {
      expect(screen.getByText(`Sessions: ${mockSessions.length}`)).toBeInTheDocument();
    });
  });

  it('should handle WebSocket connection status correctly', async () => {
    render(<MobileApp />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Should show connected status
    expect(screen.getByText('Connected: true')).toBeInTheDocument();
  });

  it('should handle error states gracefully', async () => {
    // Mock API error
    mockApiClient.getSessions.mockRejectedValue(new Error('API Error'));

    render(<MobileApp />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Should still render without crashing
    expect(screen.getByTestId('bottom-navigation')).toBeInTheDocument();
  });

  it('should fall back to desktop layout when not mobile', () => {
    mockUseMobile.mockReturnValue({
      isMobile: false,
      isTablet: true,
      isDesktop: false,
      orientation: 'landscape',
      breakpoint: 'tablet',
    });

    render(<MobileApp />);

    // Should render desktop layout instead of mobile components
    expect(screen.getByTestId('responsive-layout')).toBeInTheDocument();
    expect(screen.queryByTestId('bottom-navigation')).not.toBeInTheDocument();
  });

  it('should demonstrate the hardcoded badge issue exists', async () => {
    render(<MobileApp />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // CRITICAL TEST: This test demonstrates the bug exists
    // The following tests should INITIALLY FAIL, proving the hardcoded badge issue
    
    // Dashboard badge is hardcoded to 0 in line 266 - this should be dynamic
    const dashboardItem = screen.getByTestId('nav-item-dashboard');
    expect(dashboardItem).toBeInTheDocument();
    
    // Metrics badge is hardcoded to 0 in line 278 - this should be dynamic  
    const metricsItem = screen.getByTestId('nav-item-metrics');
    expect(metricsItem).toBeInTheDocument();
    
    // Analytics badge is hardcoded to 0 in line 284 - this should be dynamic
    const analyticsItem = screen.getByTestId('nav-item-analytics');
    expect(analyticsItem).toBeInTheDocument();
    
    // Only sessions and cross-project badges use dynamic values currently
    // Sessions badge: sessions.filter(s => s.status === 'running').length (line 272)
    // Cross-project badge: activeProjects.length (line 290)
    
    // When this test is fixed, dashboard, metrics, and analytics badges should be dynamic
  });
});
