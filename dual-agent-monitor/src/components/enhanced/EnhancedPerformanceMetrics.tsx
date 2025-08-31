import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  MessageSquare,
  Activity,
  Users,
  Zap,
  CheckCircle,
  AlertCircle,
  XCircle,
  BarChart as BarChartIcon,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { DualAgentSession } from '../../types';
import { useSessionStore } from '../../store/useSessionStore';
import { cn, formatDuration } from '../../lib/utils';

interface EnhancedPerformanceMetricsProps {
  className?: string;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ElementType;
  color: string;
  description: string;
}

function MetricCard({ title, value, change, icon: Icon, color, description }: MetricCardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{title}</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold">{value}</p>
              {change !== undefined && (
                <div className={cn(
                  'flex items-center gap-1 text-xs px-2 py-1 rounded-full',
                  isPositive && 'bg-success-100 text-success-700 dark:bg-success-900/20 dark:text-success-400',
                  isNegative && 'bg-error-100 text-error-700 dark:bg-error-900/20 dark:text-error-400',
                  !isPositive && !isNegative && 'bg-secondary text-secondary-foreground'
                )}>
                  {isPositive ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : isNegative ? (
                    <TrendingDown className="w-3 h-3" />
                  ) : null}
                  {Math.abs(change)}%
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <div className={cn('p-3 rounded-full', color)}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function EnhancedPerformanceMetrics({ className }: EnhancedPerformanceMetricsProps) {
  const { sessions } = useSessionStore();

  const metrics = useMemo(() => {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Recent sessions (last 24 hours)
    const recentSessions = sessions.filter(
      session => new Date(session.startTime) >= last24Hours
    );
    
    // Sessions from last week for comparison
    const lastWeekSessions = sessions.filter(
      session => new Date(session.startTime) >= last7Days && new Date(session.startTime) < last24Hours
    );

    // Basic counts
    const totalSessions = sessions.length;
    const activeSessions = sessions.filter(s => s.status === 'running').length;
    const completedSessions = sessions.filter(s => s.status === 'completed').length;
    const errorSessions = sessions.filter(s => s.status === 'error').length;

    // Message statistics
    const totalMessages = sessions.reduce((acc, session) => acc + session.messages.length, 0);
    const avgMessagesPerSession = totalSessions > 0 ? Math.round(totalMessages / totalSessions) : 0;

    // Agent activity
    const managerMessages = sessions.reduce((acc, session) =>
      acc + session.messages.filter(m => m.agentType === 'manager').length, 0
    );
    const workerMessages = sessions.reduce((acc, session) =>
      acc + session.messages.filter(m => m.agentType === 'worker').length, 0
    );

    // Session duration analysis
    const completedSessionsWithDuration = sessions.filter(s => s.status === 'completed' && s.endTime);
    const avgSessionDuration = completedSessionsWithDuration.length > 0
      ? completedSessionsWithDuration.reduce((acc, session) => {
          const duration = new Date(session.endTime!).getTime() - new Date(session.startTime).getTime();
          return acc + duration;
        }, 0) / completedSessionsWithDuration.length
      : 0;

    // Success rate
    const finishedSessions = sessions.filter(s => ['completed', 'error'].includes(s.status));
    const successRate = finishedSessions.length > 0 
      ? Math.round((completedSessions / finishedSessions.length) * 100)
      : 0;

    // Daily activity data for charts
    const dailyData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));
      
      const daySessions = sessions.filter(session => {
        const sessionDate = new Date(session.startTime);
        return sessionDate >= dayStart && sessionDate <= dayEnd;
      });

      const dayMessages = daySessions.reduce((acc, session) => acc + session.messages.length, 0);
      
      dailyData.push({
        date: dayStart.toLocaleDateString('en-US', { weekday: 'short' }),
        fullDate: dayStart.toISOString().split('T')[0],
        sessions: daySessions.length,
        messages: dayMessages,
        completed: daySessions.filter(s => s.status === 'completed').length,
        errors: daySessions.filter(s => s.status === 'error').length,
      });
    }

    // Agent distribution data
    const agentData = [
      {
        name: 'Manager',
        value: managerMessages,
        color: '#8b5cf6',
      },
      {
        name: 'Worker',
        value: workerMessages,
        color: '#3b82f6',
      },
    ];

    // Status distribution
    const statusData = [
      {
        name: 'Completed',
        value: completedSessions,
        color: '#22c55e',
      },
      {
        name: 'Running',
        value: activeSessions,
        color: '#3b82f6',
      },
      {
        name: 'Error',
        value: errorSessions,
        color: '#ef4444',
      },
      {
        name: 'Paused',
        value: sessions.filter(s => s.status === 'paused').length,
        color: '#f59e0b',
      },
    ].filter(item => item.value > 0);

    // Calculate changes compared to last week
    const recentSessionsChange = lastWeekSessions.length > 0 
      ? Math.round(((recentSessions.length - lastWeekSessions.length) / lastWeekSessions.length) * 100)
      : 0;

    return {
      totalSessions,
      activeSessions,
      completedSessions,
      errorSessions,
      totalMessages,
      avgMessagesPerSession,
      managerMessages,
      workerMessages,
      avgSessionDuration,
      successRate,
      dailyData,
      agentData,
      statusData,
      recentSessionsChange,
    };
  }, [sessions]);

  return (
    <div className={cn('space-y-6 p-6', className)}>
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <MetricCard
            title="Total Sessions"
            value={metrics.totalSessions}
            change={metrics.recentSessionsChange}
            icon={Activity}
            color="bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
            description="All time sessions created"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <MetricCard
            title="Active Sessions"
            value={metrics.activeSessions}
            icon={Zap}
            color="bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400"
            description="Currently running sessions"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <MetricCard
            title="Success Rate"
            value={`${metrics.successRate}%`}
            icon={CheckCircle}
            color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
            description="Sessions completed successfully"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <MetricCard
            title="Avg Duration"
            value={formatDuration(metrics.avgSessionDuration)}
            icon={Clock}
            color="bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400"
            description="Average session completion time"
          />
        </motion.div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Activity Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Daily Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={metrics.dailyData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(label, payload) => {
                      const data = payload?.[0]?.payload;
                      return data ? data.fullDate : label;
                    }}
                    formatter={(value, name) => [value, name === 'sessions' ? 'Sessions' : 'Messages']}
                  />
                  <Area
                    type="monotone"
                    dataKey="sessions"
                    stackId="1"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="messages"
                    stackId="2"
                    stroke="#8b5cf6"
                    fill="#8b5cf6"
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Agent Message Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Agent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={metrics.agentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {metrics.agentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} messages`, 'Messages']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500" />
                  <span className="text-sm text-muted-foreground">Manager: {metrics.managerMessages}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-sm text-muted-foreground">Worker: {metrics.workerMessages}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Status Overview and Message Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Session Status Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Session Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics.statusData.map((status) => (
                  <div key={status.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: status.color }}
                      />
                      <span className="text-sm">{status.name}</span>
                    </div>
                    <Badge variant="outline">{status.value}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Message Statistics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Message Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <div className="text-2xl font-bold text-primary">{metrics.totalMessages}</div>
                  <div className="text-sm text-muted-foreground">Total Messages</div>
                </div>
                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{metrics.avgMessagesPerSession}</div>
                  <div className="text-sm text-muted-foreground">Avg per Session</div>
                </div>
                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{metrics.completedSessions}</div>
                  <div className="text-sm text-muted-foreground">Completed</div>
                </div>
                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{metrics.errorSessions}</div>
                  <div className="text-sm text-muted-foreground">Errors</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Success/Error Trend */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChartIcon className="w-5 h-5" />
              Daily Success/Error Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={metrics.dailyData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip
                  labelFormatter={(label, payload) => {
                    const data = payload?.[0]?.payload;
                    return data ? data.fullDate : label;
                  }}
                />
                <Legend />
                <Bar dataKey="completed" fill="#22c55e" name="Completed" radius={[2, 2, 0, 0]} />
                <Bar dataKey="errors" fill="#ef4444" name="Errors" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}