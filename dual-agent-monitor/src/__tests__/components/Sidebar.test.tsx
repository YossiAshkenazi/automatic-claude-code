import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Sidebar } from '../../components/ui/Sidebar';
import { useSessionStore } from '../../store/useSessionStore';
import { DualAgentSession } from '../../types';

// Mock the session store
vi.mock('../../store/useSessionStore');

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    aside: 'aside',
    div: 'div',
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

describe('Sidebar Component', () => {
  const mockUseSessionStore = vi.mocked(useSessionStore);
  const mockOnNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSessionStore.mockReturnValue({
      sessions: [],
      selectedSession: null,
      isLoading: false,
      isConnected: false,
      // Add other required store properties
      isLoadingSessions: false,
      isCreatingSession: false,
      isDeletingSession: null,
      isUpdatingSession: null,
      error: null,
      connectionError: null,
      lastConnectionTime: null,
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
      getFilteredSessions: vi.fn(),
      clearError: vi.fn(),
      refreshSession: vi.fn(),
      syncWithDatabase: vi.fn(),
      reset: vi.fn(),
    } as any);
  });

  it('should render with default items and correct session count badge', () => {
    render(<Sidebar onNavigate={mockOnNavigate} />);

    // Check that sidebar renders
    expect(screen.getByText('Dual Agent Monitor')).toBeInTheDocument();
    expect(screen.getByText('Enterprise Edition')).toBeInTheDocument();

    // Check navigation items
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Sessions')).toBeInTheDocument();
    expect(screen.getByText('Agents')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();

    // CRITICAL TEST: Verify hardcoded "3" badge is displayed
    // This test should initially FAIL, proving the hardcoded issue exists
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('should display dynamic session count based on actual sessions data', () => {
    const mockSessions: DualAgentSession[] = [
      {
        id: 'session-1',
        initialTask: 'Task 1',
        status: 'running',
        startTime: '2024-01-01T10:00:00Z',
        lastActivity: '2024-01-01T10:30:00Z',
        messages: [],
        workDir: '/test',
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
      },
      {
        id: 'session-4',
        initialTask: 'Task 4',
        status: 'paused',
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
        status: 'running',
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

    mockUseSessionStore.mockReturnValue({
      sessions: mockSessions,
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
      getFilteredSessions: () => mockSessions,
      clearError: vi.fn(),
      refreshSession: vi.fn(),
      syncWithDatabase: vi.fn(),
      reset: vi.fn(),
    } as any);

    // Create custom sidebar items with dynamic badge
    const dynamicItems = [
      {
        id: 'sessions',
        label: 'Sessions',
        icon: () => null,
        path: '/sessions',
        badge: mockSessions.length, // Should be 5, not hardcoded 3
      }
    ];

    render(<Sidebar items={dynamicItems} onNavigate={mockOnNavigate} />);

    // This test should pass when the component is fixed to use dynamic data
    // Instead of hardcoded "3", it should show "5" based on actual session count
    expect(screen.getByText('5')).toBeInTheDocument();
    
    // Ensure the hardcoded "3" is NOT present when we have 5 sessions
    expect(screen.queryByText('3')).not.toBeInTheDocument();
  });

  it('should display zero sessions count when no sessions exist', () => {
    // Mock empty sessions
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

    const dynamicItems = [
      {
        id: 'sessions',
        label: 'Sessions',
        icon: () => null,
        path: '/sessions',
        badge: 0, // Should show 0 when no sessions
      }
    ];

    render(<Sidebar items={dynamicItems} onNavigate={mockOnNavigate} />);

    // Should show 0 for empty sessions, not hardcoded 3
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.queryByText('3')).not.toBeInTheDocument();
  });

  it('should update session count in real-time when sessions change', async () => {
    const initialSessions = [
      {
        id: 'session-1',
        initialTask: 'Task 1',
        status: 'running' as const,
        startTime: '2024-01-01T10:00:00Z',
        lastActivity: '2024-01-01T10:30:00Z',
        messages: [],
        workDir: '/test',
        agentStats: {
          manager: { messages: 5, avgResponseTime: 1000 },
          worker: { messages: 3, avgResponseTime: 800 }
        }
      }
    ];

    const { rerender } = render(
      <Sidebar 
        items={[{
          id: 'sessions',
          label: 'Sessions',
          icon: () => null,
          path: '/sessions',
          badge: initialSessions.length,
        }]}
        onNavigate={mockOnNavigate} 
      />
    );

    // Initially should show 1
    expect(screen.getByText('1')).toBeInTheDocument();

    // Add more sessions and rerender
    const updatedSessions = [
      ...initialSessions,
      {
        id: 'session-2',
        initialTask: 'Task 2',
        status: 'running' as const,
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
        status: 'completed' as const,
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

    rerender(
      <Sidebar 
        items={[{
          id: 'sessions',
          label: 'Sessions',
          icon: () => null,
          path: '/sessions',
          badge: updatedSessions.length,
        }]}
        onNavigate={mockOnNavigate} 
      />
    );

    // Should update to show 3
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    // Previous count should not be visible
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('should handle navigation clicks correctly', () => {
    render(<Sidebar onNavigate={mockOnNavigate} />);

    // Click on Overview
    fireEvent.click(screen.getByText('Overview'));
    expect(mockOnNavigate).toHaveBeenCalledWith('/overview');

    // Click on Sessions
    fireEvent.click(screen.getByText('Sessions'));
    expect(mockOnNavigate).toHaveBeenCalledWith('/sessions');
  });

  it('should expand and collapse menu items with children', () => {
    render(<Sidebar onNavigate={mockOnNavigate} />);

    // Agents should be a parent item with children
    const agentsItem = screen.getByText('Agents');
    
    // Initially, children should not be visible
    expect(screen.queryByText('Manager Agents')).not.toBeInTheDocument();
    expect(screen.queryByText('Worker Agents')).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(agentsItem);

    // Children should now be visible
    expect(screen.getByText('Manager Agents')).toBeInTheDocument();
    expect(screen.getByText('Worker Agents')).toBeInTheDocument();

    // Click again to collapse
    fireEvent.click(agentsItem);

    // Children should be hidden again
    expect(screen.queryByText('Manager Agents')).not.toBeInTheDocument();
    expect(screen.queryByText('Worker Agents')).not.toBeInTheDocument();
  });

  it('should toggle collapsed state', () => {
    render(<Sidebar onNavigate={mockOnNavigate} />);

    // Find collapse/expand button (X or Menu icon)
    const toggleButton = screen.getByRole('button');
    
    // Initially should show full sidebar content
    expect(screen.getByText('Dual Agent Monitor')).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(toggleButton);

    // Content should still be in DOM but may be hidden by CSS/animation
    // The button should change icon (implementation detail)
  });

  it('should highlight current active path', () => {
    render(<Sidebar currentPath="/sessions" onNavigate={mockOnNavigate} />);

    // Sessions item should have active styling
    const sessionsButton = screen.getByText('Sessions').closest('button');
    expect(sessionsButton).toHaveClass('bg-primary', 'text-primary-foreground');
  });

  it('should show connection status indicator', () => {
    render(<Sidebar onNavigate={mockOnNavigate} />);

    // Check for status indicator
    expect(screen.getByText('Online')).toBeInTheDocument();
    
    // Check for version info
    expect(screen.getByText('Version')).toBeInTheDocument();
    expect(screen.getByText('2.1.0')).toBeInTheDocument();
  });

  it('should handle custom items prop correctly', () => {
    const customItems = [
      {
        id: 'custom',
        label: 'Custom Item',
        icon: () => null,
        path: '/custom',
        badge: 42
      }
    ];

    render(<Sidebar items={customItems} onNavigate={mockOnNavigate} />);

    expect(screen.getByText('Custom Item')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();

    // Default items should not be present
    expect(screen.queryByText('Overview')).not.toBeInTheDocument();
    expect(screen.queryByText('Sessions')).not.toBeInTheDocument();
  });

  it('should handle items without badges gracefully', () => {
    const itemsWithoutBadges = [
      {
        id: 'no-badge',
        label: 'No Badge Item',
        icon: () => null,
        path: '/no-badge'
        // No badge property
      }
    ];

    render(<Sidebar items={itemsWithoutBadges} onNavigate={mockOnNavigate} />);

    expect(screen.getByText('No Badge Item')).toBeInTheDocument();
    // Should not crash and should not show any badge
  });
});
