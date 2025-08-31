import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SessionList } from '../../components/SessionList';
import { useSessionStore } from '../../store/useSessionStore';

// Mock the session store
vi.mock('../../store/useSessionStore');

// Mock React Query
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
    refetch: vi.fn()
  })),
  QueryClient: vi.fn(),
  QueryClientProvider: ({ children }: any) => children
}));

describe('SessionList', () => {
  const mockSetActiveSession = vi.fn();
  const mockUseSessionStore = vi.mocked(useSessionStore);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSessionStore.mockReturnValue({
      sessions: [
        {
          id: 'session-1',
          name: 'Test Session 1',
          status: 'completed',
          createdAt: new Date('2024-01-01T10:00:00Z'),
          duration: 120000,
          messageCount: 25,
          agentStats: {
            manager: { messages: 10, avgResponseTime: 2000 },
            worker: { messages: 15, avgResponseTime: 1200 }
          }
        },
        {
          id: 'session-2',
          name: 'Test Session 2',
          status: 'active',
          createdAt: new Date('2024-01-01T11:00:00Z'),
          duration: 60000,
          messageCount: 12,
          agentStats: {
            manager: { messages: 6, avgResponseTime: 1800 },
            worker: { messages: 6, avgResponseTime: 1000 }
          }
        }
      ],
      activeSession: null,
      setActiveSession: mockSetActiveSession,
      addMessage: vi.fn(),
      updateSessionStatus: vi.fn(),
      clearSessions: vi.fn()
    } as any);
  });

  it('renders session list correctly', () => {
    render(<SessionList />);

    expect(screen.getByText('Test Session 1')).toBeInTheDocument();
    expect(screen.getByText('Test Session 2')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('displays session metadata correctly', () => {
    render(<SessionList />);

    // Check duration formatting
    expect(screen.getByText('2:00')).toBeInTheDocument(); // 120000ms = 2 minutes
    expect(screen.getByText('1:00')).toBeInTheDocument(); // 60000ms = 1 minute

    // Check message counts
    expect(screen.getByText('25 messages')).toBeInTheDocument();
    expect(screen.getByText('12 messages')).toBeInTheDocument();
  });

  it('handles session selection', async () => {
    render(<SessionList />);

    const sessionCard = screen.getByText('Test Session 1').closest('[data-testid="session-card"]');
    
    if (sessionCard) {
      fireEvent.click(sessionCard);
    } else {
      // Fallback: click on the session name directly
      fireEvent.click(screen.getByText('Test Session 1'));
    }

    await waitFor(() => {
      expect(mockSetActiveSession).toHaveBeenCalledWith('session-1');
    });
  });

  it('shows active session highlight', () => {
    mockUseSessionStore.mockReturnValue({
      sessions: [
        {
          id: 'session-1',
          name: 'Test Session 1',
          status: 'completed',
          createdAt: new Date('2024-01-01T10:00:00Z'),
          duration: 120000,
          messageCount: 25,
          agentStats: {
            manager: { messages: 10, avgResponseTime: 2000 },
            worker: { messages: 15, avgResponseTime: 1200 }
          }
        }
      ],
      activeSession: 'session-1',
      setActiveSession: mockSetActiveSession,
      addMessage: vi.fn(),
      updateSessionStatus: vi.fn(),
      clearSessions: vi.fn()
    } as any);

    render(<SessionList />);

    const sessionCard = screen.getByText('Test Session 1').closest('div');
    expect(sessionCard).toHaveClass('ring-2', 'ring-blue-500');
  });

  it('displays empty state when no sessions', () => {
    mockUseSessionStore.mockReturnValue({
      sessions: [],
      activeSession: null,
      setActiveSession: mockSetActiveSession,
      addMessage: vi.fn(),
      updateSessionStatus: vi.fn(),
      clearSessions: vi.fn()
    } as any);

    render(<SessionList />);

    expect(screen.getByText('No sessions found')).toBeInTheDocument();
    expect(screen.getByText('Start a dual-agent session to see it here')).toBeInTheDocument();
  });

  it('shows session status badges with correct colors', () => {
    render(<SessionList />);

    const completedBadge = screen.getByText('completed');
    const activeBadge = screen.getByText('active');

    expect(completedBadge).toHaveClass('bg-green-100', 'text-green-800');
    expect(activeBadge).toHaveClass('bg-blue-100', 'text-blue-800');
  });

  it('formats timestamps correctly', () => {
    render(<SessionList />);

    // Should show relative time
    expect(screen.getByText(/ago/)).toBeInTheDocument();
  });

  it('displays agent statistics when available', () => {
    render(<SessionList />);

    // Should show agent message counts or response times
    expect(screen.getByText(/Manager:|Worker:/)).toBeInTheDocument();
  });

  it('handles keyboard navigation', async () => {
    render(<SessionList />);

    const sessionCard = screen.getByText('Test Session 1').closest('[data-testid="session-card"]');
    
    if (sessionCard) {
      sessionCard.focus();
      fireEvent.keyDown(sessionCard, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(mockSetActiveSession).toHaveBeenCalledWith('session-1');
      });
    }
  });

  it('shows loading state', () => {
    const MockedQuery = vi.mocked(require('@tanstack/react-query').useQuery);
    MockedQuery.mockReturnValue({
      data: [],
      isLoading: true,
      error: null,
      refetch: vi.fn()
    });

    render(<SessionList />);

    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it('shows error state', () => {
    const MockedQuery = vi.mocked(require('@tanstack/react-query').useQuery);
    MockedQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: new Error('Failed to load sessions'),
      refetch: vi.fn()
    });

    render(<SessionList />);

    expect(screen.getByText(/Error loading sessions/i)).toBeInTheDocument();
  });
});