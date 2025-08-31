import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PerformanceMetrics } from '../../components/PerformanceMetrics';

// Mock Chart.js
vi.mock('react-chartjs-2', () => ({
  Line: ({ data, options }: any) => (
    <div data-testid="line-chart">
      <div data-testid="chart-data">{JSON.stringify(data)}</div>
      <div data-testid="chart-options">{JSON.stringify(options)}</div>
    </div>
  ),
  Bar: ({ data, options }: any) => (
    <div data-testid="bar-chart">
      <div data-testid="chart-data">{JSON.stringify(data)}</div>
      <div data-testid="chart-options">{JSON.stringify(options)}</div>
    </div>
  )
}));

vi.mock('chart.js', () => ({
  Chart: {
    register: vi.fn()
  },
  CategoryScale: vi.fn(),
  LinearScale: vi.fn(),
  PointElement: vi.fn(),
  LineElement: vi.fn(),
  Title: vi.fn(),
  Tooltip: vi.fn(),
  Legend: vi.fn(),
  BarElement: vi.fn()
}));

const mockMetrics = {
  session: {
    id: 'test-session',
    averageResponseTime: 1500,
    totalMessages: 45,
    successRate: 0.95,
    duration: 180000,
    agentEfficiency: {
      manager: 0.92,
      worker: 0.97
    }
  },
  realtime: {
    currentResponseTime: 1200,
    messagesPerMinute: 5,
    errorRate: 0.02,
    activeConnections: 3
  },
  trends: {
    responseTime: [
      { timestamp: '2024-01-01T10:00:00Z', value: 1200 },
      { timestamp: '2024-01-01T10:01:00Z', value: 1300 },
      { timestamp: '2024-01-01T10:02:00Z', value: 1500 },
      { timestamp: '2024-01-01T10:03:00Z', value: 1400 },
      { timestamp: '2024-01-01T10:04:00Z', value: 1600 }
    ],
    successRate: [
      { timestamp: '2024-01-01T10:00:00Z', value: 0.92 },
      { timestamp: '2024-01-01T10:01:00Z', value: 0.94 },
      { timestamp: '2024-01-01T10:02:00Z', value: 0.95 },
      { timestamp: '2024-01-01T10:03:00Z', value: 0.93 },
      { timestamp: '2024-01-01T10:04:00Z', value: 0.96 }
    ]
  }
};

describe('PerformanceMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders performance metrics correctly', () => {
    render(<PerformanceMetrics metrics={mockMetrics} />);

    // Check key metrics display
    expect(screen.getByText('1.5s')).toBeInTheDocument(); // Average response time
    expect(screen.getByText('95%')).toBeInTheDocument(); // Success rate
    expect(screen.getByText('45')).toBeInTheDocument(); // Total messages
    expect(screen.getByText('3:00')).toBeInTheDocument(); // Duration (180000ms = 3 minutes)
  });

  it('displays real-time metrics', () => {
    render(<PerformanceMetrics metrics={mockMetrics} />);

    expect(screen.getByText('1.2s')).toBeInTheDocument(); // Current response time
    expect(screen.getByText('5/min')).toBeInTheDocument(); // Messages per minute
    expect(screen.getByText('2%')).toBeInTheDocument(); // Error rate
    expect(screen.getByText('3')).toBeInTheDocument(); // Active connections
  });

  it('shows agent efficiency comparison', () => {
    render(<PerformanceMetrics metrics={mockMetrics} />);

    expect(screen.getByText('92%')).toBeInTheDocument(); // Manager efficiency
    expect(screen.getByText('97%')).toBeInTheDocument(); // Worker efficiency
  });

  it('renders trend charts', () => {
    render(<PerformanceMetrics metrics={mockMetrics} />);

    const lineCharts = screen.getAllByTestId('line-chart');
    expect(lineCharts).toHaveLength(2); // Response time and success rate trends
  });

  it('handles missing metrics gracefully', () => {
    const incompleteMetrics = {
      session: {
        id: 'test-session',
        averageResponseTime: 1500,
        totalMessages: 45,
        successRate: 0.95,
        duration: 180000
        // Missing agentEfficiency
      }
      // Missing realtime and trends
    };

    render(<PerformanceMetrics metrics={incompleteMetrics} />);

    // Should still render basic session metrics
    expect(screen.getByText('1.5s')).toBeInTheDocument();
    expect(screen.getByText('95%')).toBeInTheDocument();

    // Should show placeholder or N/A for missing data
    expect(screen.getByText(/N\/A|No data/i)).toBeInTheDocument();
  });

  it('formats large numbers correctly', () => {
    const metricsWithLargeNumbers = {
      ...mockMetrics,
      session: {
        ...mockMetrics.session,
        totalMessages: 1250,
        duration: 3661000 // 1 hour, 1 minute, 1 second
      }
    };

    render(<PerformanceMetrics metrics={metricsWithLargeNumbers} />);

    expect(screen.getByText('1,250')).toBeInTheDocument(); // Comma-separated number
    expect(screen.getByText('1:01:01')).toBeInTheDocument(); // Hour:minute:second format
  });

  it('shows performance status indicators', () => {
    render(<PerformanceMetrics metrics={mockMetrics} />);

    // Should have status indicators (good/warning/error colors)
    const statusElements = screen.getAllByTestId(/status-indicator|performance-badge/);
    expect(statusElements.length).toBeGreaterThan(0);
  });

  it('updates charts with new data', () => {
    const { rerender } = render(<PerformanceMetrics metrics={mockMetrics} />);

    const updatedMetrics = {
      ...mockMetrics,
      session: {
        ...mockMetrics.session,
        averageResponseTime: 1800 // Changed response time
      }
    };

    rerender(<PerformanceMetrics metrics={updatedMetrics} />);

    expect(screen.getByText('1.8s')).toBeInTheDocument();
  });

  it('displays metric trends direction', () => {
    render(<PerformanceMetrics metrics={mockMetrics} />);

    // Should show trend indicators (up/down arrows or similar)
    const trendIndicators = screen.getAllByTestId(/trend-indicator|arrow-/);
    expect(trendIndicators.length).toBeGreaterThan(0);
  });

  it('handles zero or invalid values', () => {
    const metricsWithZeros = {
      session: {
        id: 'test-session',
        averageResponseTime: 0,
        totalMessages: 0,
        successRate: 0,
        duration: 0,
        agentEfficiency: {
          manager: 0,
          worker: 0
        }
      },
      realtime: {
        currentResponseTime: 0,
        messagesPerMinute: 0,
        errorRate: 0,
        activeConnections: 0
      }
    };

    render(<PerformanceMetrics metrics={metricsWithZeros} />);

    // Should display zeros appropriately
    expect(screen.getByText('0s')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});