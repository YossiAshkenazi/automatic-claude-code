import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, BarChart3, Clock, Users, Zap, Activity, Target, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { DualAgentSession } from '../../types';
import { formatDuration } from '../../utils/formatters';
import { cn } from '../../lib/utils';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface MobileMetricsProps {
  sessions: DualAgentSession[];
  selectedSession?: DualAgentSession | null;
  timeRange: '1h' | '6h' | '24h' | '7d' | '30d';
  onTimeRangeChange: (range: '1h' | '6h' | '24h' | '7d' | '30d') => void;
  refreshing?: boolean;
  onRefresh?: () => void;
}

interface MetricCard {
  title: string;
  value: string | number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}

interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    borderColor?: string;
    backgroundColor?: string | string[];
    fill?: boolean;
    tension?: number;
  }[];
}

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      mode: 'index' as const,
      intersect: false,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      titleColor: 'white',
      bodyColor: 'white',
      cornerRadius: 8,
      displayColors: false
    }
  },
  scales: {
    x: {
      display: true,
      grid: {
        display: false
      },
      ticks: {
        maxTicksLimit: 6,
        font: {
          size: 10
        }
      }
    },
    y: {
      display: true,
      grid: {
        display: true,
        color: 'rgba(0, 0, 0, 0.05)'
      },
      ticks: {
        maxTicksLimit: 5,
        font: {
          size: 10
        }
      }
    }
  },
  elements: {
    point: {
      radius: 3,
      hoverRadius: 6
    },
    line: {
      borderWidth: 2
    }
  }
};

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: {
        font: {
          size: 11
        },
        padding: 15,
        usePointStyle: true
      }
    },
    tooltip: {
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      titleColor: 'white',
      bodyColor: 'white',
      cornerRadius: 8
    }
  },
  cutout: '60%'
};

export function MobileMetrics({ 
  sessions, 
  selectedSession, 
  timeRange, 
  onTimeRangeChange, 
  refreshing = false,
  onRefresh 
}: MobileMetricsProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'agents'>('overview');

  const metrics = useMemo(() => {
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - getTimeRangeMs(timeRange));
    
    const recentSessions = sessions.filter(session => 
      new Date(session.startTime) > cutoffTime
    );
    
    const previousPeriodSessions = sessions.filter(session => {
      const sessionTime = new Date(session.startTime);
      const previousCutoff = new Date(cutoffTime.getTime() - getTimeRangeMs(timeRange));
      return sessionTime > previousCutoff && sessionTime <= cutoffTime;
    });

    const totalMessages = recentSessions.reduce((acc, s) => acc + s.messages.length, 0);
    const prevTotalMessages = previousPeriodSessions.reduce((acc, s) => acc + s.messages.length, 0);
    const messageChange = prevTotalMessages > 0 ? ((totalMessages - prevTotalMessages) / prevTotalMessages) * 100 : 0;

    const activeSessionsCount = recentSessions.filter(s => s.status === 'running').length;
    const prevActiveSessionsCount = previousPeriodSessions.filter(s => s.status === 'running').length;
    const activeChange = prevActiveSessionsCount > 0 ? ((activeSessionsCount - prevActiveSessionsCount) / prevActiveSessionsCount) * 100 : 0;

    const avgMessages = recentSessions.length > 0 ? Math.round(totalMessages / recentSessions.length) : 0;
    const prevAvgMessages = previousPeriodSessions.length > 0 ? Math.round(prevTotalMessages / previousPeriodSessions.length) : 0;
    const avgChange = prevAvgMessages > 0 ? ((avgMessages - prevAvgMessages) / prevAvgMessages) * 100 : 0;

    const completionRate = recentSessions.length > 0 
      ? (recentSessions.filter(s => s.status === 'completed').length / recentSessions.length) * 100 
      : 0;
    const prevCompletionRate = previousPeriodSessions.length > 0 
      ? (previousPeriodSessions.filter(s => s.status === 'completed').length / previousPeriodSessions.length) * 100 
      : 0;
    const completionChange = prevCompletionRate > 0 ? completionRate - prevCompletionRate : 0;

    const metricsData: MetricCard[] = [
      {
        title: 'Total Messages',
        value: totalMessages.toLocaleString(),
        change: messageChange,
        trend: messageChange > 0 ? 'up' : messageChange < 0 ? 'down' : 'stable',
        icon: <BarChart3 size={20} />,
        color: 'blue',
        subtitle: `${recentSessions.length} sessions`
      },
      {
        title: 'Active Sessions',
        value: activeSessionsCount,
        change: activeChange,
        trend: activeChange > 0 ? 'up' : activeChange < 0 ? 'down' : 'stable',
        icon: <Activity size={20} />,
        color: 'green',
        subtitle: 'Currently running'
      },
      {
        title: 'Avg Messages/Session',
        value: avgMessages,
        change: avgChange,
        trend: avgChange > 0 ? 'up' : avgChange < 0 ? 'down' : 'stable',
        icon: <Target size={20} />,
        color: 'purple',
        subtitle: 'Per session'
      },
      {
        title: 'Completion Rate',
        value: `${Math.round(completionRate)}%`,
        change: completionChange,
        trend: completionChange > 0 ? 'up' : completionChange < 0 ? 'down' : 'stable',
        icon: <Users size={20} />,
        color: completionRate > 70 ? 'green' : completionRate > 40 ? 'orange' : 'red',
        subtitle: 'Success rate'
      }
    ];

    return metricsData;
  }, [sessions, timeRange]);

  const chartData = useMemo(() => {
    const now = new Date();
    const intervals = getTimeIntervals(timeRange);
    
    const messageData = intervals.map(interval => {
      return sessions
        .filter(session => {
          const sessionTime = new Date(session.startTime);
          return sessionTime >= interval.start && sessionTime < interval.end;
        })
        .reduce((acc, session) => acc + session.messages.length, 0);
    });

    const sessionData = intervals.map(interval => {
      return sessions.filter(session => {
        const sessionTime = new Date(session.startTime);
        return sessionTime >= interval.start && sessionTime < interval.end;
      }).length;
    });

    return {
      labels: intervals.map(interval => formatIntervalLabel(interval.start, timeRange)),
      datasets: [
        {
          label: 'Messages',
          data: messageData,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4
        }
      ]
    };
  }, [sessions, timeRange]);

  const agentDistribution = useMemo(() => {
    const managerMessages = sessions.reduce((acc, session) => 
      acc + session.messages.filter(m => m.agentType === 'manager').length, 0
    );
    const workerMessages = sessions.reduce((acc, session) => 
      acc + session.messages.filter(m => m.agentType === 'worker').length, 0
    );

    return {
      labels: ['Manager', 'Worker'],
      datasets: [{
        data: [managerMessages, workerMessages],
        backgroundColor: ['#3b82f6', '#10b981'],
        borderWidth: 0
      }]
    };
  }, [sessions]);

  const statusDistribution = useMemo(() => {
    const statusCounts = sessions.reduce((acc, session) => {
      acc[session.status] = (acc[session.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      labels: Object.keys(statusCounts).map(status => 
        status.charAt(0).toUpperCase() + status.slice(1)
      ),
      datasets: [{
        data: Object.values(statusCounts),
        backgroundColor: [
          '#10b981', // running - green
          '#f59e0b', // paused - orange
          '#3b82f6', // completed - blue
          '#ef4444'  // error - red
        ],
        borderWidth: 0
      }]
    };
  }, [sessions]);

  const getColorClasses = (color: string) => {
    const classes = {
      blue: 'bg-blue-50 text-blue-700 border-blue-200',
      green: 'bg-green-50 text-green-700 border-green-200',
      purple: 'bg-purple-50 text-purple-700 border-purple-200',
      orange: 'bg-orange-50 text-orange-700 border-orange-200',
      red: 'bg-red-50 text-red-700 border-red-200'
    };
    return classes[color as keyof typeof classes] || classes.blue;
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable', change: number) => {
    if (trend === 'up') {
      return <TrendingUp size={14} className="text-green-500" />;
    } else if (trend === 'down') {
      return <TrendingDown size={14} className="text-red-500" />;
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-safe">
      {/* Header Controls */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-semibold text-gray-900">Performance Metrics</h1>
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw size={18} className={cn(
                'text-gray-600',
                refreshing && 'animate-spin'
              )} />
            </button>
          </div>

          {/* Time Range Selector */}
          <div className="flex gap-2 mb-4">
            {(['1h', '6h', '24h', '7d', '30d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => onTimeRangeChange(range)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  timeRange === range
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Tab Navigation */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            {[
              { id: 'overview', label: 'Overview', icon: <BarChart3 size={16} /> },
              { id: 'performance', label: 'Performance', icon: <Zap size={16} /> },
              { id: 'agents', label: 'Agents', icon: <Users size={16} /> }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                {tab.icon}
                <span className="hidden xs:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Metrics Cards */}
            <div className="grid grid-cols-2 gap-3">
              {metrics.map((metric, index) => (
                <motion.div
                  key={metric.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={cn(
                    'p-4 rounded-xl border',
                    getColorClasses(metric.color)
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="p-2 bg-white/50 rounded-lg">
                      {metric.icon}
                    </div>
                    {getTrendIcon(metric.trend, metric.change)}
                  </div>
                  
                  <div className="text-2xl font-bold mb-1">
                    {metric.value}
                  </div>
                  
                  <div className="text-sm font-medium mb-1">
                    {metric.title}
                  </div>
                  
                  <div className="flex items-center justify-between text-xs">
                    <span className="opacity-70">{metric.subtitle}</span>
                    {metric.change !== 0 && (
                      <span className={cn(
                        'font-medium',
                        metric.trend === 'up' ? 'text-green-600' : 
                        metric.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                      )}>
                        {metric.change > 0 ? '+' : ''}{Math.round(metric.change)}%
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Message Activity Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-xl border border-gray-200 p-4"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Message Activity</h3>
              <div className="h-48">
                <Line data={chartData} options={chartOptions} />
              </div>
            </motion.div>
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="space-y-6">
            {/* Session Status Distribution */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl border border-gray-200 p-4"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Session Status</h3>
              <div className="h-48">
                <Doughnut data={statusDistribution} options={doughnutOptions} />
              </div>
            </motion.div>

            {/* Performance Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-xl border border-gray-200 p-4"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Total Sessions</span>
                  <span className="font-semibold">{sessions.length}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Success Rate</span>
                  <span className="font-semibold text-green-600">
                    {Math.round((sessions.filter(s => s.status === 'completed').length / sessions.length) * 100)}%
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Error Rate</span>
                  <span className="font-semibold text-red-600">
                    {Math.round((sessions.filter(s => s.status === 'error').length / sessions.length) * 100)}%
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">Avg Session Length</span>
                  <span className="font-semibold">
                    {Math.round(sessions.reduce((acc, s) => acc + s.messages.length, 0) / sessions.length)} messages
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {activeTab === 'agents' && (
          <div className="space-y-6">
            {/* Agent Distribution */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl border border-gray-200 p-4"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Agent Message Distribution</h3>
              <div className="h-48">
                <Doughnut data={agentDistribution} options={doughnutOptions} />
              </div>
            </motion.div>

            {/* Agent Performance */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-xl border border-gray-200 p-4"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Agent Performance</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-blue-600 font-bold">M</span>
                  </div>
                  <div className="text-lg font-bold text-blue-700">
                    {sessions.reduce((acc, s) => acc + s.messages.filter(m => m.agentType === 'manager').length, 0)}
                  </div>
                  <div className="text-sm text-blue-600">Manager Messages</div>
                  <div className="text-xs text-blue-500 mt-1">
                    Avg: {Math.round(sessions.reduce((acc, s) => acc + s.messages.filter(m => m.agentType === 'manager').length, 0) / sessions.length)}
                  </div>
                </div>
                
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-green-600 font-bold">W</span>
                  </div>
                  <div className="text-lg font-bold text-green-700">
                    {sessions.reduce((acc, s) => acc + s.messages.filter(m => m.agentType === 'worker').length, 0)}
                  </div>
                  <div className="text-sm text-green-600">Worker Messages</div>
                  <div className="text-xs text-green-500 mt-1">
                    Avg: {Math.round(sessions.reduce((acc, s) => acc + s.messages.filter(m => m.agentType === 'worker').length, 0) / sessions.length)}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper functions
function getTimeRangeMs(timeRange: string): number {
  const multipliers = {
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000
  };
  return multipliers[timeRange as keyof typeof multipliers] || multipliers['24h'];
}

function getTimeIntervals(timeRange: string) {
  const now = new Date();
  const rangeMs = getTimeRangeMs(timeRange);
  const start = new Date(now.getTime() - rangeMs);
  
  const intervals = [];
  const intervalCount = 12;
  const intervalMs = rangeMs / intervalCount;
  
  for (let i = 0; i < intervalCount; i++) {
    const intervalStart = new Date(start.getTime() + i * intervalMs);
    const intervalEnd = new Date(start.getTime() + (i + 1) * intervalMs);
    intervals.push({ start: intervalStart, end: intervalEnd });
  }
  
  return intervals;
}

function formatIntervalLabel(date: Date, timeRange: string): string {
  if (timeRange === '1h' || timeRange === '6h') {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } else if (timeRange === '24h') {
    return date.toLocaleTimeString('en-US', { hour: '2-digit' });
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}