import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { Activity, Clock, DollarSign, Target, TrendingUp, Users } from 'lucide-react';
import { DualAgentSession } from '../types';
import { formatCost } from '../utils/formatters';

interface PerformanceMetricsProps {
  session: DualAgentSession;
}

const COLORS = {
  manager: '#8b5cf6',
  worker: '#3b82f6',
  success: '#10b981',
  error: '#ef4444',
};

export function PerformanceMetrics({ session }: PerformanceMetricsProps) {
  // Prepare data for charts
  const messagesByTime = React.useMemo(() => {
    const hourlyData = new Map<string, { manager: number; worker: number; time: string }>();
    
    session.messages.forEach((message) => {
      const hour = new Date(message.timestamp).toISOString().slice(0, 13) + ':00';
      
      if (!hourlyData.has(hour)) {
        hourlyData.set(hour, { manager: 0, worker: 0, time: new Date(hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
      }
      
      const data = hourlyData.get(hour)!;
      if (message.agentType === 'manager') {
        data.manager += 1;
      } else {
        data.worker += 1;
      }
    });
    
    return Array.from(hourlyData.values()).sort((a, b) => a.time.localeCompare(b.time));
  }, [session.messages]);

  const responseTimeData = React.useMemo(() => {
    return session.messages
      .filter(m => m.metadata?.duration)
      .map((message, index) => ({
        index: index + 1,
        duration: message.metadata!.duration!,
        agent: message.agentType,
        type: message.messageType,
      }));
  }, [session.messages]);

  const agentDistribution = React.useMemo(() => {
    const managerMessages = session.messages.filter(m => m.agentType === 'manager').length;
    const workerMessages = session.messages.filter(m => m.agentType === 'worker').length;
    
    return [
      { name: 'Manager', value: managerMessages, color: COLORS.manager },
      { name: 'Worker', value: workerMessages, color: COLORS.worker },
    ];
  }, [session.messages]);

  const costOverTime = React.useMemo(() => {
    let cumulativeCost = 0;
    return session.messages
      .filter(m => m.metadata?.cost)
      .map((message, index) => {
        cumulativeCost += message.metadata!.cost!;
        return {
          index: index + 1,
          cost: cumulativeCost,
          timestamp: new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
      });
  }, [session.messages]);

  const successRate = React.useMemo(() => {
    const withExitCode = session.messages.filter(m => m.metadata?.exitCode !== undefined);
    const successful = withExitCode.filter(m => m.metadata!.exitCode === 0);
    
    return withExitCode.length > 0 ? Math.round((successful.length / withExitCode.length) * 100) : 0;
  }, [session.messages]);

  const averageResponseTime = React.useMemo(() => {
    const withDuration = session.messages.filter(m => m.metadata?.duration);
    const totalDuration = withDuration.reduce((sum, m) => sum + m.metadata!.duration!, 0);
    
    return withDuration.length > 0 ? Math.round(totalDuration / withDuration.length) : 0;
  }, [session.messages]);

  const totalCost = session.summary?.totalCost || 0;

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto">
      <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
        <Activity size={20} />
        Performance Metrics
      </h3>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Success Rate</p>
              <p className="text-2xl font-bold text-green-600">{successRate}%</p>
            </div>
            <Target className="text-green-500" size={24} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Response</p>
              <p className="text-2xl font-bold text-blue-600">{averageResponseTime}s</p>
            </div>
            <Clock className="text-blue-500" size={24} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Cost</p>
              <p className="text-2xl font-bold text-purple-600">{formatCost(totalCost)}</p>
            </div>
            <DollarSign className="text-purple-500" size={24} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Messages</p>
              <p className="text-2xl font-bold text-orange-600">{session.messages.length}</p>
            </div>
            <Users className="text-orange-500" size={24} />
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Messages Over Time */}
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
            <TrendingUp size={16} />
            Messages Over Time
          </h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={messagesByTime}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="manager"
                stroke={COLORS.manager}
                strokeWidth={2}
                name="Manager"
              />
              <Line
                type="monotone"
                dataKey="worker"
                stroke={COLORS.worker}
                strokeWidth={2}
                name="Worker"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Agent Distribution */}
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h4 className="text-sm font-medium mb-4">Agent Message Distribution</h4>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={agentDistribution}
                cx="50%"
                cy="50%"
                outerRadius={60}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {agentDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Response Time Trends */}
        {responseTimeData.length > 0 && (
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h4 className="text-sm font-medium mb-4">Response Time Trends</h4>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={responseTimeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="index" />
                <YAxis />
                <Tooltip labelFormatter={(value) => `Message ${value}`} />
                <Line
                  type="monotone"
                  dataKey="duration"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Response Time (s)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Cost Over Time */}
        {costOverTime.length > 0 && (
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h4 className="text-sm font-medium mb-4">Cumulative Cost</h4>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={costOverTime}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis tickFormatter={(value) => `$${value.toFixed(3)}`} />
                <Tooltip formatter={(value) => [`$${Number(value).toFixed(4)}`, 'Cost']} />
                <Line
                  type="monotone"
                  dataKey="cost"
                  stroke={COLORS.manager}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Tool Usage Summary */}
      {session.summary?.toolsUsed.length && (
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h4 className="text-sm font-medium mb-4">Tool Usage</h4>
          <div className="flex flex-wrap gap-2">
            {session.summary.toolsUsed.map((tool) => (
              <span
                key={tool}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}