import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area,
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  ScatterChart,
  Scatter,
  ReferenceLine
} from 'recharts';
import { 
  Activity, 
  Clock, 
  DollarSign, 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';

interface TrendData {
  timestamp: Date;
  value: number;
  label: string;
}

interface RealTimeMetrics {
  timestamp: Date;
  sessionId: string;
  agentType: 'manager' | 'worker';
  responseTime: number;
  tokensUsed?: number;
  cost?: number;
  errorRate: number;
  throughput: number;
}

interface PerformanceChartsProps {
  trends: {
    manager: TrendData[];
    worker: TrendData[];
    coordination: TrendData[];
  };
  realTimeMetrics: RealTimeMetrics[];
  timeRange: string;
}

export const PerformanceCharts: React.FC<PerformanceChartsProps> = ({
  trends,
  realTimeMetrics,
  timeRange
}) => {
  const [selectedChart, setSelectedChart] = useState<'performance' | 'response-time' | 'cost' | 'real-time'>('performance');

  // Prepare chart data
  const performanceData = trends.manager.map((item, index) => ({
    time: item.label,
    timestamp: item.timestamp.getTime(),
    manager: item.value,
    worker: trends.worker[index]?.value || 0,
    coordination: trends.coordination[index]?.value || 0
  }));

  const responseTimeData = realTimeMetrics
    .filter(m => m.responseTime > 0)
    .slice(-50) // Last 50 data points
    .map(m => ({
      time: new Date(m.timestamp).toLocaleTimeString(),
      timestamp: m.timestamp.getTime(),
      manager: m.agentType === 'manager' ? m.responseTime : null,
      worker: m.agentType === 'worker' ? m.responseTime : null,
      agentType: m.agentType
    }));

  const costData = realTimeMetrics
    .filter(m => m.cost && m.cost > 0)
    .reduce((acc, metric) => {
      const hourKey = new Date(metric.timestamp).toLocaleString('en-US', { 
        hour: 'numeric', 
        hour12: true 
      });
      
      if (!acc[hourKey]) {
        acc[hourKey] = { time: hourKey, manager: 0, worker: 0 };
      }
      
      acc[hourKey][metric.agentType] += metric.cost;
      return acc;
    }, {} as Record<string, any>);

  const costChartData = Object.values(costData);

  const realTimeScatterData = realTimeMetrics
    .slice(-100)
    .map(m => ({
      responseTime: m.responseTime,
      throughput: m.throughput,
      agentType: m.agentType,
      cost: m.cost || 0,
      errorRate: m.errorRate * 100,
      timestamp: m.timestamp
    }));

  // Calculate trend indicators
  const calculateTrend = (data: number[]): 'up' | 'down' | 'stable' => {
    if (data.length < 2) return 'stable';
    const recent = data.slice(-3);
    const earlier = data.slice(-6, -3);
    
    if (recent.length === 0 || earlier.length === 0) return 'stable';
    
    const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const earlierAvg = earlier.reduce((sum, val) => sum + val, 0) / earlier.length;
    
    const change = (recentAvg - earlierAvg) / earlierAvg;
    
    if (Math.abs(change) < 0.05) return 'stable';
    return change > 0 ? 'up' : 'down';
  };

  const managerTrend = calculateTrend(trends.manager.map(t => t.value));
  const workerTrend = calculateTrend(trends.worker.map(t => t.value));
  const coordinationTrend = calculateTrend(trends.coordination.map(t => t.value));

  const TrendIcon = ({ trend }: { trend: 'up' | 'down' | 'stable' }) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-medium">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color }} className="text-sm">
            {entry.name}: {
              entry.name.includes('Cost') ? `$${entry.value.toFixed(3)}` :
              entry.name.includes('Time') ? `${entry.value.toFixed(0)}ms` :
              `${entry.value.toFixed(1)}${entry.name.includes('Rate') ? '%' : ''}`
            }
          </p>
        ))}
      </div>
    );
  };

  const renderChart = () => {
    switch (selectedChart) {
      case 'performance':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="time" 
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                domain={[0, 100]}
                tick={{ fontSize: 12 }}
                label={{ value: 'Performance Score', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="manager"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Manager"
                dot={{ fill: '#3b82f6', r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="worker"
                stroke="#10b981"
                strokeWidth={2}
                name="Worker"
                dot={{ fill: '#10b981', r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="coordination"
                stroke="#f59e0b"
                strokeWidth={2}
                name="Coordination"
                dot={{ fill: '#f59e0b', r: 4 }}
              />
              <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="5 5" label="Target" />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'response-time':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={responseTimeData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="time" 
                tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                label={{ value: 'Response Time (ms)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area
                type="monotone"
                dataKey="manager"
                stackId="1"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.3}
                name="Manager Response Time"
              />
              <Area
                type="monotone"
                dataKey="worker"
                stackId="2"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.3}
                name="Worker Response Time"
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'cost':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={costChartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="time" tick={{ fontSize: 12 }} />
              <YAxis 
                tick={{ fontSize: 12 }}
                label={{ value: 'Cost ($)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar
                dataKey="manager"
                fill="#3b82f6"
                name="Manager Cost"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="worker"
                fill="#10b981"
                name="Worker Cost"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'real-time':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart data={realTimeScatterData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="responseTime"
                type="number"
                tick={{ fontSize: 12 }}
                label={{ value: 'Response Time (ms)', position: 'insideBottom', offset: -5 }}
              />
              <YAxis 
                dataKey="throughput"
                type="number"
                tick={{ fontSize: 12 }}
                label={{ value: 'Throughput (msg/min)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                      <p className="font-medium">{data.agentType} Agent</p>
                      <p className="text-sm">Response Time: {data.responseTime}ms</p>
                      <p className="text-sm">Throughput: {data.throughput} msg/min</p>
                      <p className="text-sm">Error Rate: {data.errorRate.toFixed(1)}%</p>
                      {data.cost > 0 && <p className="text-sm">Cost: ${data.cost.toFixed(3)}</p>}
                    </div>
                  );
                }}
              />
              <Scatter
                name="Manager"
                data={realTimeScatterData.filter(d => d.agentType === 'manager')}
                fill="#3b82f6"
              />
              <Scatter
                name="Worker"
                data={realTimeScatterData.filter(d => d.agentType === 'worker')}
                fill="#10b981"
              />
            </ScatterChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Performance Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Manager Performance</p>
                <p className="text-2xl font-bold">
                  {trends.manager.length > 0 
                    ? `${trends.manager[trends.manager.length - 1].value.toFixed(1)}%`
                    : 'N/A'
                  }
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <TrendIcon trend={managerTrend} />
                <Activity className="h-8 w-8 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Worker Performance</p>
                <p className="text-2xl font-bold">
                  {trends.worker.length > 0 
                    ? `${trends.worker[trends.worker.length - 1].value.toFixed(1)}%`
                    : 'N/A'
                  }
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <TrendIcon trend={workerTrend} />
                <Activity className="h-8 w-8 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Coordination Score</p>
                <p className="text-2xl font-bold">
                  {trends.coordination.length > 0 
                    ? `${trends.coordination[trends.coordination.length - 1].value.toFixed(1)}%`
                    : 'N/A'
                  }
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <TrendIcon trend={coordinationTrend} />
                <Activity className="h-8 w-8 text-yellow-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Performance Analytics</CardTitle>
              <CardDescription>
                Real-time and historical performance metrics for both agents
              </CardDescription>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant={selectedChart === 'performance' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedChart('performance')}
              >
                <Activity className="h-4 w-4 mr-2" />
                Performance
              </Button>
              <Button
                variant={selectedChart === 'response-time' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedChart('response-time')}
              >
                <Clock className="h-4 w-4 mr-2" />
                Response Time
              </Button>
              <Button
                variant={selectedChart === 'cost' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedChart('cost')}
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Cost
              </Button>
              <Button
                variant={selectedChart === 'real-time' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedChart('real-time')}
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Real-time
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {renderChart()}
          
          {/* Chart Legend/Info */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-sm text-gray-600">Data Points</div>
              <div className="font-medium">
                {selectedChart === 'real-time' ? realTimeScatterData.length : performanceData.length}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Time Range</div>
              <div className="font-medium">{timeRange.toUpperCase()}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Last Update</div>
              <div className="font-medium">
                {new Date().toLocaleTimeString()}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Chart Type</div>
              <div className="font-medium capitalize">
                {selectedChart.replace('-', ' ')}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};