import React, { useMemo, useState, useEffect, useRef } from 'react';
import { AgentMessage, DualAgentSession } from '../../types';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { 
  Activity, 
  AlertTriangle, 
  BarChart3,
  Clock, 
  Cpu,
  Database,
  MessageSquare, 
  Pause,
  Play,
  TrendingDown,
  TrendingUp,
  Users,
  Wifi,
  WifiOff,
  Zap,
  Target,
  Timer,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
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
  Cell,
  PieChart,
  Pie,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis
} from 'recharts';
import { format, subHours, startOfHour, differenceInMilliseconds, isAfter, isBefore } from 'date-fns';

interface AgentActivityMonitorProps {
  session: DualAgentSession;
  messages: AgentMessage[];
  isRealTime?: boolean;
  refreshInterval?: number;
}

interface ActivityData {
  timestamp: Date;
  managerActivity: number;
  workerActivity: number;
  totalActivity: number;
  responseTime: number;
  errors: number;
}

interface AgentMetrics {
  agent: 'manager' | 'worker';
  messagesCount: number;
  avgResponseTime: number;
  errorRate: number;
  toolsUsed: string[];
  lastActivity: Date | null;
  workloadDistribution: number;
  efficiency: number;
  currentStatus: 'active' | 'idle' | 'error' | 'offline';
}

interface HeatmapData {
  hour: number;
  day: string;
  activity: number;
  agent: 'manager' | 'worker';
}

interface WorkloadData {
  name: string;
  manager: number;
  worker: number;
  efficiency: number;
}

const COLORS = {
  manager: '#3b82f6',
  worker: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  success: '#22c55e',
  idle: '#6b7280',
};

export const AgentActivityMonitor: React.FC<AgentActivityMonitorProps> = ({
  session,
  messages,
  isRealTime = false,
  refreshInterval = 5000,
}) => {
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | 'all'>('6h');
  const [selectedMetric, setSelectedMetric] = useState<'activity' | 'response_time' | 'errors' | 'workload'>('activity');
  const [isLive, setIsLive] = useState(isRealTime);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const updateInterval = useRef<NodeJS.Timeout>();

  // Filter messages based on time range
  const filteredMessages = useMemo(() => {
    if (timeRange === 'all') return messages;
    
    const now = new Date();
    const hours = timeRange === '1h' ? 1 : timeRange === '6h' ? 6 : 24;
    const cutoff = subHours(now, hours);
    
    return messages.filter(msg => isAfter(new Date(msg.timestamp), cutoff));
  }, [messages, timeRange]);

  // Calculate agent metrics
  const agentMetrics = useMemo<AgentMetrics[]>(() => {
    const managerMessages = filteredMessages.filter(m => m.agentType === 'manager');
    const workerMessages = filteredMessages.filter(m => m.agentType === 'worker');
    
    const calculateMetrics = (msgs: AgentMessage[], agentType: 'manager' | 'worker'): AgentMetrics => {
      if (msgs.length === 0) {
        return {
          agent: agentType,
          messagesCount: 0,
          avgResponseTime: 0,
          errorRate: 0,
          toolsUsed: [],
          lastActivity: null,
          workloadDistribution: 0,
          efficiency: 0,
          currentStatus: 'offline',
        };
      }

      // Calculate response times (time to respond to other agent)
      const responseTimes: number[] = [];
      const otherAgentType = agentType === 'manager' ? 'worker' : 'manager';
      
      filteredMessages.forEach((msg, index) => {
        if (msg.agentType === agentType && index > 0) {
          const previousMsg = filteredMessages[index - 1];
          if (previousMsg.agentType === otherAgentType) {
            const responseTime = differenceInMilliseconds(new Date(msg.timestamp), new Date(previousMsg.timestamp));
            responseTimes.push(responseTime);
          }
        }
      });

      const errors = msgs.filter(m => m.messageType === 'error');
      const tools = msgs.flatMap(m => m.metadata?.tools || []);
      const uniqueTools = Array.from(new Set(tools));
      const lastActivity = msgs.length > 0 ? new Date(msgs[msgs.length - 1].timestamp) : null;
      
      // Calculate current status
      let currentStatus: AgentMetrics['currentStatus'] = 'idle';
      if (lastActivity) {
        const timeSinceLastActivity = Date.now() - lastActivity.getTime();
        if (timeSinceLastActivity < 30000) { // Active if last activity within 30 seconds
          currentStatus = errors.length > msgs.length * 0.1 ? 'error' : 'active';
        } else if (timeSinceLastActivity < 300000) { // Idle if within 5 minutes
          currentStatus = 'idle';
        } else {
          currentStatus = 'offline';
        }
      }

      // Calculate efficiency (successful operations / total operations)
      const successfulOps = msgs.filter(m => 
        m.messageType === 'tool_result' && m.metadata?.exitCode === 0
      ).length;
      const totalOps = msgs.filter(m => 
        ['tool_call', 'tool_use', 'tool_result'].includes(m.messageType)
      ).length;
      const efficiency = totalOps > 0 ? (successfulOps / totalOps) * 100 : 0;

      return {
        agent: agentType,
        messagesCount: msgs.length,
        avgResponseTime: responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0,
        errorRate: (errors.length / msgs.length) * 100,
        toolsUsed: uniqueTools,
        lastActivity,
        workloadDistribution: (msgs.length / filteredMessages.length) * 100,
        efficiency,
        currentStatus,
      };
    };

    return [
      calculateMetrics(managerMessages, 'manager'),
      calculateMetrics(workerMessages, 'worker'),
    ];
  }, [filteredMessages]);

  // Generate activity data over time
  const activityData = useMemo<ActivityData[]>(() => {
    if (filteredMessages.length === 0) return [];

    const hourlyData = new Map<string, ActivityData>();
    const startTime = new Date(filteredMessages[0].timestamp);
    const endTime = new Date(filteredMessages[filteredMessages.length - 1].timestamp);
    
    // Initialize hourly buckets
    let current = startOfHour(startTime);
    while (isBefore(current, endTime)) {
      const key = format(current, 'yyyy-MM-dd HH:00');
      hourlyData.set(key, {
        timestamp: new Date(current),
        managerActivity: 0,
        workerActivity: 0,
        totalActivity: 0,
        responseTime: 0,
        errors: 0,
      });
      current = new Date(current.getTime() + 60 * 60 * 1000); // Add 1 hour
    }

    // Fill with actual data
    const responseTimes = new Map<string, number[]>();
    
    filteredMessages.forEach((msg, index) => {
      const hourKey = format(new Date(msg.timestamp), 'yyyy-MM-dd HH:00');
      const data = hourlyData.get(hourKey);
      if (!data) return;

      if (msg.agentType === 'manager') {
        data.managerActivity++;
      } else {
        data.workerActivity++;
      }
      data.totalActivity++;

      if (msg.messageType === 'error') {
        data.errors++;
      }

      // Track response times
      if (index > 0) {
        const prevMsg = filteredMessages[index - 1];
        if (prevMsg.agentType !== msg.agentType) {
          const responseTime = differenceInMilliseconds(new Date(msg.timestamp), new Date(prevMsg.timestamp));
          if (!responseTimes.has(hourKey)) {
            responseTimes.set(hourKey, []);
          }
          responseTimes.get(hourKey)!.push(responseTime);
        }
      }
    });

    // Calculate average response times
    responseTimes.forEach((times, hourKey) => {
      const data = hourlyData.get(hourKey);
      if (data && times.length > 0) {
        data.responseTime = times.reduce((a, b) => a + b, 0) / times.length;
      }
    });

    return Array.from(hourlyData.values()).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [filteredMessages]);

  // Generate heatmap data for communication frequency
  const heatmapData = useMemo<HeatmapData[]>(() => {
    const data: HeatmapData[] = [];
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    // Initialize grid
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        data.push({
          hour,
          day: days[day],
          activity: 0,
          agent: 'manager',
        });
        data.push({
          hour,
          day: days[day],
          activity: 0,
          agent: 'worker',
        });
      }
    }

    // Fill with actual activity
    filteredMessages.forEach(msg => {
      const date = new Date(msg.timestamp);
      const hour = date.getHours();
      const dayIndex = date.getDay();
      const dayName = days[dayIndex === 0 ? 6 : dayIndex - 1]; // Adjust for Monday start

      const entry = data.find(d => d.hour === hour && d.day === dayName && d.agent === msg.agentType);
      if (entry) {
        entry.activity++;
      }
    });

    return data;
  }, [filteredMessages]);

  // Generate workload distribution data
  const workloadData = useMemo<WorkloadData[]>(() => {
    const categories = ['Prompts', 'Tool Calls', 'Responses', 'Errors'];
    
    return categories.map(category => {
      let managerCount = 0;
      let workerCount = 0;
      
      filteredMessages.forEach(msg => {
        let matches = false;
        switch (category) {
          case 'Prompts':
            matches = msg.messageType === 'prompt';
            break;
          case 'Tool Calls':
            matches = ['tool_call', 'tool_use'].includes(msg.messageType);
            break;
          case 'Responses':
            matches = msg.messageType === 'response';
            break;
          case 'Errors':
            matches = msg.messageType === 'error';
            break;
        }
        
        if (matches) {
          if (msg.agentType === 'manager') {
            managerCount++;
          } else {
            workerCount++;
          }
        }
      });
      
      const total = managerCount + workerCount;
      const efficiency = total > 0 ? ((total - (category === 'Errors' ? total : 0)) / total) * 100 : 100;
      
      return {
        name: category,
        manager: managerCount,
        worker: workerCount,
        efficiency,
      };
    });
  }, [filteredMessages]);

  // Real-time updates
  useEffect(() => {
    if (isLive) {
      updateInterval.current = setInterval(() => {
        setLastUpdate(new Date());
      }, refreshInterval);
    } else {
      if (updateInterval.current) {
        clearInterval(updateInterval.current);
      }
    }

    return () => {
      if (updateInterval.current) {
        clearInterval(updateInterval.current);
      }
    };
  }, [isLive, refreshInterval]);

  const getStatusIcon = (status: AgentMetrics['currentStatus']) => {
    switch (status) {
      case 'active':
        return <CheckCircle size={16} className="text-green-500" />;
      case 'idle':
        return <Clock size={16} className="text-yellow-500" />;
      case 'error':
        return <XCircle size={16} className="text-red-500" />;
      case 'offline':
        return <WifiOff size={16} className="text-gray-500" />;
      default:
        return <AlertCircle size={16} className="text-gray-500" />;
    }
  };

  const getStatusColor = (status: AgentMetrics['currentStatus']) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'idle': return 'text-yellow-600 bg-yellow-100';
      case 'error': return 'text-red-600 bg-red-100';
      case 'offline': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsLive(!isLive)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                isLive 
                  ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {isLive ? <Pause size={16} /> : <Play size={16} />}
              {isLive ? 'Live' : 'Paused'}
            </button>
            
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Time Range:</span>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as any)}
                className="text-sm border border-gray-300 rounded px-2 py-1"
              >
                <option value="1h">Last Hour</option>
                <option value="6h">Last 6 Hours</option>
                <option value="24h">Last 24 Hours</option>
                <option value="all">All Time</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Metric:</span>
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value as any)}
                className="text-sm border border-gray-300 rounded px-2 py-1"
              >
                <option value="activity">Activity</option>
                <option value="response_time">Response Time</option>
                <option value="errors">Errors</option>
                <option value="workload">Workload</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Wifi size={16} className={isLive ? 'text-green-500' : 'text-gray-400'} />
            <span>Last update: {format(lastUpdate, 'HH:mm:ss')}</span>
          </div>
        </div>
      </Card>

      {/* Agent Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {agentMetrics.map((metrics) => (
          <Card key={metrics.agent} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {metrics.agent === 'manager' ? (
                  <Users size={24} className="text-blue-600" />
                ) : (
                  <Cpu size={24} className="text-green-600" />
                )}
                <div>
                  <h3 className="font-semibold text-lg capitalize">{metrics.agent} Agent</h3>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(metrics.currentStatus)}
                    <span className={`text-sm px-2 py-1 rounded-full ${getStatusColor(metrics.currentStatus)}`}>
                      {metrics.currentStatus.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-2xl font-bold">{metrics.messagesCount}</div>
                <div className="text-sm text-gray-600">Messages</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Timer size={16} className="text-blue-500" />
                  <span className="text-sm font-medium">Avg Response</span>
                </div>
                <div className="text-lg font-semibold">
                  {Math.round(metrics.avgResponseTime)}ms
                </div>
              </div>
              
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Target size={16} className="text-green-500" />
                  <span className="text-sm font-medium">Efficiency</span>
                </div>
                <div className="text-lg font-semibold">
                  {Math.round(metrics.efficiency)}%
                </div>
              </div>
              
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle size={16} className="text-red-500" />
                  <span className="text-sm font-medium">Error Rate</span>
                </div>
                <div className="text-lg font-semibold">
                  {Math.round(metrics.errorRate * 10) / 10}%
                </div>
              </div>
              
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 size={16} className="text-purple-500" />
                  <span className="text-sm font-medium">Workload</span>
                </div>
                <div className="text-lg font-semibold">
                  {Math.round(metrics.workloadDistribution)}%
                </div>
              </div>
            </div>

            {metrics.toolsUsed.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">Tools Used</div>
                <div className="flex flex-wrap gap-2">
                  {metrics.toolsUsed.slice(0, 6).map(tool => (
                    <Badge key={tool} variant="outline" className="text-xs">
                      {tool}
                    </Badge>
                  ))}
                  {metrics.toolsUsed.length > 6 && (
                    <Badge variant="outline" className="text-xs">
                      +{metrics.toolsUsed.length - 6}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {metrics.lastActivity && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="text-xs text-gray-600">
                  Last activity: {format(metrics.lastActivity, 'HH:mm:ss')} 
                  ({format(metrics.lastActivity, 'MMM dd')})
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Activity Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Over Time */}
        <Card className="p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Activity size={18} />
            Activity Over Time
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={activityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(timestamp) => format(new Date(timestamp), 'HH:mm')}
              />
              <YAxis />
              <Tooltip 
                labelFormatter={(timestamp) => format(new Date(timestamp), 'MMM dd, HH:mm')}
                formatter={(value: number, name: string) => [value, name.replace('Activity', '')]}
              />
              <Area 
                type="monotone" 
                dataKey="managerActivity" 
                stackId="1"
                stroke={COLORS.manager} 
                fill={COLORS.manager}
                fillOpacity={0.6}
                name="Manager Activity"
              />
              <Area 
                type="monotone" 
                dataKey="workerActivity" 
                stackId="1"
                stroke={COLORS.worker} 
                fill={COLORS.worker}
                fillOpacity={0.6}
                name="Worker Activity"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Response Time Trends */}
        <Card className="p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Clock size={18} />
            Response Time Trends
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={activityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(timestamp) => format(new Date(timestamp), 'HH:mm')}
              />
              <YAxis />
              <Tooltip 
                labelFormatter={(timestamp) => format(new Date(timestamp), 'MMM dd, HH:mm')}
                formatter={(value: number) => [`${Math.round(value)}ms`, 'Response Time']}
              />
              <Line 
                type="monotone" 
                dataKey="responseTime" 
                stroke={COLORS.warning}
                strokeWidth={3}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Workload Distribution */}
        <Card className="p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <BarChart3 size={18} />
            Workload Distribution
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={workloadData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="manager" fill={COLORS.manager} name="Manager" />
              <Bar dataKey="worker" fill={COLORS.worker} name="Worker" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Communication Frequency Heatmap */}
        <Card className="p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Zap size={18} />
            Communication Frequency
          </h3>
          <div className="h-[300px] flex items-center justify-center">
            <div className="text-sm text-gray-500">
              Heatmap visualization would be implemented here with a specialized library
              <br />
              Showing communication patterns by hour and day of week
            </div>
          </div>
        </Card>
      </div>

      {/* Performance Indicators */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Performance Indicators</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 text-blue-600" />
            <div className="text-2xl font-bold text-blue-600">
              {filteredMessages.length}
            </div>
            <div className="text-sm text-gray-600">Total Messages</div>
          </div>
          
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-600" />
            <div className="text-2xl font-bold text-green-600">
              {Math.round(agentMetrics.reduce((sum, m) => sum + m.efficiency, 0) / agentMetrics.length)}%
            </div>
            <div className="text-sm text-gray-600">Avg Efficiency</div>
          </div>
          
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <Timer className="w-8 h-8 mx-auto mb-2 text-yellow-600" />
            <div className="text-2xl font-bold text-yellow-600">
              {Math.round(agentMetrics.reduce((sum, m) => sum + m.avgResponseTime, 0) / agentMetrics.length)}ms
            </div>
            <div className="text-sm text-gray-600">Avg Response</div>
          </div>
          
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-600" />
            <div className="text-2xl font-bold text-red-600">
              {filteredMessages.filter(m => m.messageType === 'error').length}
            </div>
            <div className="text-sm text-gray-600">Errors</div>
          </div>
        </div>
      </Card>
    </div>
  );
};