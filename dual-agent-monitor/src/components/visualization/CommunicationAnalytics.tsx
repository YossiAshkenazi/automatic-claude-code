import React, { useMemo, useState, useEffect } from 'react';
import { AgentMessage, DualAgentSession } from '../../types';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { 
  Activity, 
  AlertTriangle, 
  BarChart3,
  Brain,
  Clock, 
  GitBranch,
  MessageSquare, 
  Network,
  PieChart,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Workflow,
  Zap,
  AlertCircle,
  CheckCircle,
  Info,
  ArrowUp,
  ArrowDown,
  Minus
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
  Legend,
  ResponsiveContainer,
  Cell,
  PieChart as RechartsPieChart,
  Pie,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ScatterChart,
  Scatter,
  ComposedChart
} from 'recharts';
import { format, differenceInMilliseconds, subHours, subDays } from 'date-fns';

interface CommunicationAnalyticsProps {
  session: DualAgentSession;
  messages: AgentMessage[];
  comparisonSessions?: DualAgentSession[];
}

interface CommunicationPattern {
  type: 'request_response' | 'tool_chain' | 'error_recovery' | 'planning_execution';
  frequency: number;
  avgDuration: number;
  efficiency: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

interface BottleneckAnalysis {
  type: 'response_delay' | 'tool_failure' | 'context_switching' | 'error_cascade';
  severity: 'low' | 'medium' | 'high' | 'critical';
  frequency: number;
  avgImpact: number; // in milliseconds
  affectedMessages: string[];
  recommendation: string;
}

interface EfficiencyMetric {
  metric: string;
  value: number;
  unit: string;
  trend: number; // percentage change
  benchmark?: number;
  status: 'excellent' | 'good' | 'needs_improvement' | 'critical';
}

interface CollaborationPattern {
  pattern: string;
  description: string;
  frequency: number;
  successRate: number;
  avgDuration: number;
  examples: string[];
}

interface CommunicationFlow {
  from: 'manager' | 'worker';
  to: 'manager' | 'worker';
  messageType: string;
  count: number;
  avgResponseTime: number;
  successRate: number;
}

const COLORS = {
  manager: '#3b82f6',
  worker: '#10b981',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  neutral: '#6b7280',
};

export const CommunicationAnalytics: React.FC<CommunicationAnalyticsProps> = ({
  session,
  messages,
  comparisonSessions = [],
}) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1h' | '6h' | '24h' | 'session'>('session');
  const [analysisDepth, setAnalysisDepth] = useState<'basic' | 'advanced' | 'detailed'>('advanced');

  // Filter messages by timeframe
  const filteredMessages = useMemo(() => {
    if (selectedTimeframe === 'session') return messages;
    
    const now = new Date();
    const hours = selectedTimeframe === '1h' ? 1 : selectedTimeframe === '6h' ? 6 : 24;
    const cutoff = subHours(now, hours);
    
    return messages.filter(msg => new Date(msg.timestamp) > cutoff);
  }, [messages, selectedTimeframe]);

  // Analyze communication patterns
  const communicationPatterns = useMemo<CommunicationPattern[]>(() => {
    const patterns: CommunicationPattern[] = [];
    
    // Request-Response Pattern
    let requestResponseCount = 0;
    let requestResponseDurations: number[] = [];
    let requestResponseSuccesses = 0;

    // Tool Chain Pattern
    let toolChainCount = 0;
    let toolChainDurations: number[] = [];
    let toolChainSuccesses = 0;

    // Error Recovery Pattern
    let errorRecoveryCount = 0;
    let errorRecoveryDurations: number[] = [];
    let errorRecoverySuccesses = 0;

    // Planning-Execution Pattern
    let planningExecutionCount = 0;
    let planningExecutionDurations: number[] = [];
    let planningExecutionSuccesses = 0;

    for (let i = 1; i < filteredMessages.length; i++) {
      const current = filteredMessages[i];
      const previous = filteredMessages[i - 1];
      const duration = differenceInMilliseconds(new Date(current.timestamp), new Date(previous.timestamp));

      // Request-Response: Different agents, prompt -> response
      if (current.agentType !== previous.agentType && 
          previous.messageType === 'prompt' && 
          current.messageType === 'response') {
        requestResponseCount++;
        requestResponseDurations.push(duration);
        if (current.messageType !== 'error') requestResponseSuccesses++;
      }

      // Tool Chain: Sequential tool operations
      if (['tool_call', 'tool_use', 'tool_result'].includes(current.messageType) &&
          ['tool_call', 'tool_use', 'tool_result'].includes(previous.messageType)) {
        toolChainCount++;
        toolChainDurations.push(duration);
        if (current.metadata?.exitCode === 0) toolChainSuccesses++;
      }

      // Error Recovery: Error followed by recovery attempt
      if (previous.messageType === 'error' && 
          current.messageType !== 'error') {
        errorRecoveryCount++;
        errorRecoveryDurations.push(duration);
        if (current.messageType !== 'error') errorRecoverySuccesses++;
      }

      // Planning-Execution: Manager prompt -> Worker tool use
      if (previous.agentType === 'manager' && 
          current.agentType === 'worker' &&
          previous.messageType === 'prompt' && 
          ['tool_call', 'tool_use'].includes(current.messageType)) {
        planningExecutionCount++;
        planningExecutionDurations.push(duration);
        if (i + 1 < filteredMessages.length && 
            filteredMessages[i + 1].messageType === 'tool_result' &&
            filteredMessages[i + 1].metadata?.exitCode === 0) {
          planningExecutionSuccesses++;
        }
      }
    }

    // Calculate trends (simplified - would need historical data for real trends)
    const getTrend = (count: number): CommunicationPattern['trend'] => {
      if (count > filteredMessages.length * 0.3) return 'increasing';
      if (count < filteredMessages.length * 0.1) return 'decreasing';
      return 'stable';
    };

    if (requestResponseCount > 0) {
      patterns.push({
        type: 'request_response',
        frequency: requestResponseCount,
        avgDuration: requestResponseDurations.reduce((a, b) => a + b, 0) / requestResponseDurations.length,
        efficiency: (requestResponseSuccesses / requestResponseCount) * 100,
        trend: getTrend(requestResponseCount),
      });
    }

    if (toolChainCount > 0) {
      patterns.push({
        type: 'tool_chain',
        frequency: toolChainCount,
        avgDuration: toolChainDurations.reduce((a, b) => a + b, 0) / toolChainDurations.length,
        efficiency: (toolChainSuccesses / toolChainCount) * 100,
        trend: getTrend(toolChainCount),
      });
    }

    if (errorRecoveryCount > 0) {
      patterns.push({
        type: 'error_recovery',
        frequency: errorRecoveryCount,
        avgDuration: errorRecoveryDurations.reduce((a, b) => a + b, 0) / errorRecoveryDurations.length,
        efficiency: (errorRecoverySuccesses / errorRecoveryCount) * 100,
        trend: getTrend(errorRecoveryCount),
      });
    }

    if (planningExecutionCount > 0) {
      patterns.push({
        type: 'planning_execution',
        frequency: planningExecutionCount,
        avgDuration: planningExecutionDurations.reduce((a, b) => a + b, 0) / planningExecutionDurations.length,
        efficiency: (planningExecutionSuccesses / planningExecutionCount) * 100,
        trend: getTrend(planningExecutionCount),
      });
    }

    return patterns;
  }, [filteredMessages]);

  // Identify bottlenecks
  const bottlenecks = useMemo<BottleneckAnalysis[]>(() => {
    const bottleneckMap = new Map<string, BottleneckAnalysis>();

    // Calculate response times and identify delays
    const responseTimes: number[] = [];
    
    for (let i = 1; i < filteredMessages.length; i++) {
      const current = filteredMessages[i];
      const previous = filteredMessages[i - 1];
      
      if (current.agentType !== previous.agentType) {
        const responseTime = differenceInMilliseconds(new Date(current.timestamp), new Date(previous.timestamp));
        responseTimes.push(responseTime);
        
        // Identify response delays (> 10 seconds)
        if (responseTime > 10000) {
          const key = 'response_delay';
          if (!bottleneckMap.has(key)) {
            bottleneckMap.set(key, {
              type: 'response_delay',
              severity: 'medium',
              frequency: 0,
              avgImpact: 0,
              affectedMessages: [],
              recommendation: 'Consider optimizing agent response logic or reducing context complexity',
            });
          }
          const bottleneck = bottleneckMap.get(key)!;
          bottleneck.frequency++;
          bottleneck.affectedMessages.push(current.id);
          bottleneck.avgImpact = (bottleneck.avgImpact * (bottleneck.frequency - 1) + responseTime) / bottleneck.frequency;
        }
      }

      // Identify tool failures
      if (current.messageType === 'tool_result' && current.metadata?.exitCode !== 0) {
        const key = 'tool_failure';
        if (!bottleneckMap.has(key)) {
          bottleneckMap.set(key, {
            type: 'tool_failure',
            severity: 'high',
            frequency: 0,
            avgImpact: 0,
            affectedMessages: [],
            recommendation: 'Review tool execution environment and error handling',
          });
        }
        const bottleneck = bottleneckMap.get(key)!;
        bottleneck.frequency++;
        bottleneck.affectedMessages.push(current.id);
      }

      // Identify error cascades (multiple errors in sequence)
      if (current.messageType === 'error' && i > 1 && filteredMessages[i - 1].messageType === 'error') {
        const key = 'error_cascade';
        if (!bottleneckMap.has(key)) {
          bottleneckMap.set(key, {
            type: 'error_cascade',
            severity: 'critical',
            frequency: 0,
            avgImpact: 0,
            affectedMessages: [],
            recommendation: 'Implement better error handling and recovery mechanisms',
          });
        }
        const bottleneck = bottleneckMap.get(key)!;
        bottleneck.frequency++;
        bottleneck.affectedMessages.push(current.id);
      }
    }

    // Identify context switching overhead
    let contextSwitches = 0;
    for (let i = 1; i < filteredMessages.length; i++) {
      if (filteredMessages[i].agentType !== filteredMessages[i - 1].agentType) {
        contextSwitches++;
      }
    }
    
    if (contextSwitches > filteredMessages.length * 0.5) {
      bottleneckMap.set('context_switching', {
        type: 'context_switching',
        severity: 'medium',
        frequency: contextSwitches,
        avgImpact: 0,
        affectedMessages: [],
        recommendation: 'Consider batching operations to reduce agent switching overhead',
      });
    }

    return Array.from(bottleneckMap.values()).sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }, [filteredMessages]);

  // Calculate efficiency metrics
  const efficiencyMetrics = useMemo<EfficiencyMetric[]>(() => {
    const metrics: EfficiencyMetric[] = [];

    // Message throughput
    const duration = filteredMessages.length > 1 
      ? differenceInMilliseconds(
          new Date(filteredMessages[filteredMessages.length - 1].timestamp),
          new Date(filteredMessages[0].timestamp)
        )
      : 1;
    const throughput = (filteredMessages.length / duration) * 1000 * 60; // messages per minute

    metrics.push({
      metric: 'Message Throughput',
      value: throughput,
      unit: 'msgs/min',
      trend: 0, // Would need historical data
      benchmark: 10, // Expected 10 messages per minute
      status: throughput >= 10 ? 'excellent' : throughput >= 5 ? 'good' : 'needs_improvement',
    });

    // Error rate
    const errorRate = (filteredMessages.filter(m => m.messageType === 'error').length / filteredMessages.length) * 100;
    metrics.push({
      metric: 'Error Rate',
      value: errorRate,
      unit: '%',
      trend: 0,
      benchmark: 5, // Max 5% error rate
      status: errorRate <= 2 ? 'excellent' : errorRate <= 5 ? 'good' : errorRate <= 10 ? 'needs_improvement' : 'critical',
    });

    // Response time
    const responseTimes: number[] = [];
    for (let i = 1; i < filteredMessages.length; i++) {
      const current = filteredMessages[i];
      const previous = filteredMessages[i - 1];
      if (current.agentType !== previous.agentType) {
        responseTimes.push(differenceInMilliseconds(new Date(current.timestamp), new Date(previous.timestamp)));
      }
    }
    
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;

    metrics.push({
      metric: 'Avg Response Time',
      value: avgResponseTime,
      unit: 'ms',
      trend: 0,
      benchmark: 5000, // Target 5 seconds
      status: avgResponseTime <= 3000 ? 'excellent' : avgResponseTime <= 5000 ? 'good' : avgResponseTime <= 10000 ? 'needs_improvement' : 'critical',
    });

    // Tool success rate
    const toolResults = filteredMessages.filter(m => m.messageType === 'tool_result');
    const successfulTools = toolResults.filter(m => m.metadata?.exitCode === 0);
    const toolSuccessRate = toolResults.length > 0 ? (successfulTools.length / toolResults.length) * 100 : 100;

    metrics.push({
      metric: 'Tool Success Rate',
      value: toolSuccessRate,
      unit: '%',
      trend: 0,
      benchmark: 90, // Target 90% success rate
      status: toolSuccessRate >= 95 ? 'excellent' : toolSuccessRate >= 90 ? 'good' : toolSuccessRate >= 80 ? 'needs_improvement' : 'critical',
    });

    return metrics;
  }, [filteredMessages]);

  // Analyze collaboration patterns
  const collaborationPatterns = useMemo<CollaborationPattern[]>(() => {
    const patterns: CollaborationPattern[] = [];

    // Manager-directed execution
    let managerDirectedCount = 0;
    let managerDirectedSuccesses = 0;
    let managerDirectedDurations: number[] = [];
    const managerDirectedExamples: string[] = [];

    // Worker-initiated clarification
    let workerClarificationCount = 0;
    let workerClarificationSuccesses = 0;
    let workerClarificationDurations: number[] = [];
    const workerClarificationExamples: string[] = [];

    // Parallel processing
    let parallelProcessingCount = 0;
    let parallelProcessingSuccesses = 0;
    let parallelProcessingDurations: number[] = [];
    const parallelProcessingExamples: string[] = [];

    for (let i = 2; i < filteredMessages.length; i++) {
      const current = filteredMessages[i];
      const previous = filteredMessages[i - 1];
      const beforePrevious = filteredMessages[i - 2];

      // Manager-directed execution: Manager prompt -> Worker tool -> Result
      if (beforePrevious.agentType === 'manager' && 
          beforePrevious.messageType === 'prompt' &&
          previous.agentType === 'worker' && 
          ['tool_call', 'tool_use'].includes(previous.messageType) &&
          current.messageType === 'tool_result') {
        managerDirectedCount++;
        const duration = differenceInMilliseconds(new Date(current.timestamp), new Date(beforePrevious.timestamp));
        managerDirectedDurations.push(duration);
        if (current.metadata?.exitCode === 0) managerDirectedSuccesses++;
        if (managerDirectedExamples.length < 3) {
          managerDirectedExamples.push(beforePrevious.content.substring(0, 100));
        }
      }

      // Worker-initiated clarification: Worker question -> Manager response -> Worker action
      if (beforePrevious.agentType === 'worker' && 
          beforePrevious.content.includes('?') &&
          previous.agentType === 'manager' && 
          previous.messageType === 'response' &&
          current.agentType === 'worker' && 
          ['tool_call', 'tool_use'].includes(current.messageType)) {
        workerClarificationCount++;
        const duration = differenceInMilliseconds(new Date(current.timestamp), new Date(beforePrevious.timestamp));
        workerClarificationDurations.push(duration);
        workerClarificationSuccesses++; // Assume success if clarification led to action
        if (workerClarificationExamples.length < 3) {
          workerClarificationExamples.push(beforePrevious.content.substring(0, 100));
        }
      }
    }

    if (managerDirectedCount > 0) {
      patterns.push({
        pattern: 'Manager-Directed Execution',
        description: 'Manager provides instructions, Worker executes tasks',
        frequency: managerDirectedCount,
        successRate: (managerDirectedSuccesses / managerDirectedCount) * 100,
        avgDuration: managerDirectedDurations.reduce((a, b) => a + b, 0) / managerDirectedDurations.length,
        examples: managerDirectedExamples,
      });
    }

    if (workerClarificationCount > 0) {
      patterns.push({
        pattern: 'Worker-Initiated Clarification',
        description: 'Worker asks questions to clarify requirements',
        frequency: workerClarificationCount,
        successRate: (workerClarificationSuccesses / workerClarificationCount) * 100,
        avgDuration: workerClarificationDurations.reduce((a, b) => a + b, 0) / workerClarificationDurations.length,
        examples: workerClarificationExamples,
      });
    }

    return patterns.sort((a, b) => b.frequency - a.frequency);
  }, [filteredMessages]);

  // Generate communication flow data
  const communicationFlows = useMemo<CommunicationFlow[]>(() => {
    const flows = new Map<string, CommunicationFlow>();

    for (let i = 1; i < filteredMessages.length; i++) {
      const current = filteredMessages[i];
      const previous = filteredMessages[i - 1];
      
      const key = `${previous.agentType}-${current.agentType}-${current.messageType}`;
      
      if (!flows.has(key)) {
        flows.set(key, {
          from: previous.agentType,
          to: current.agentType,
          messageType: current.messageType,
          count: 0,
          avgResponseTime: 0,
          successRate: 0,
        });
      }
      
      const flow = flows.get(key)!;
      flow.count++;
      
      if (current.agentType !== previous.agentType) {
        const responseTime = differenceInMilliseconds(new Date(current.timestamp), new Date(previous.timestamp));
        flow.avgResponseTime = (flow.avgResponseTime * (flow.count - 1) + responseTime) / flow.count;
      }
      
      if (current.messageType !== 'error') {
        flow.successRate = ((flow.successRate * (flow.count - 1)) + 100) / flow.count;
      } else {
        flow.successRate = (flow.successRate * (flow.count - 1)) / flow.count;
      }
    }

    return Array.from(flows.values()).sort((a, b) => b.count - a.count);
  }, [filteredMessages]);

  const getStatusIcon = (status: EfficiencyMetric['status']) => {
    switch (status) {
      case 'excellent':
        return <CheckCircle size={16} className="text-green-500" />;
      case 'good':
        return <CheckCircle size={16} className="text-blue-500" />;
      case 'needs_improvement':
        return <AlertCircle size={16} className="text-yellow-500" />;
      case 'critical':
        return <AlertTriangle size={16} className="text-red-500" />;
      default:
        return <Info size={16} className="text-gray-500" />;
    }
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 5) return <TrendingUp size={16} className="text-green-500" />;
    if (trend < -5) return <TrendingDown size={16} className="text-red-500" />;
    return <Minus size={16} className="text-gray-500" />;
  };

  const getSeverityColor = (severity: BottleneckAnalysis['severity']) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Timeframe:</span>
              <select
                value={selectedTimeframe}
                onChange={(e) => setSelectedTimeframe(e.target.value as any)}
                className="text-sm border border-gray-300 rounded px-2 py-1"
              >
                <option value="1h">Last Hour</option>
                <option value="6h">Last 6 Hours</option>
                <option value="24h">Last 24 Hours</option>
                <option value="session">Entire Session</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Analysis:</span>
              <select
                value={analysisDepth}
                onChange={(e) => setAnalysisDepth(e.target.value as any)}
                className="text-sm border border-gray-300 rounded px-2 py-1"
              >
                <option value="basic">Basic</option>
                <option value="advanced">Advanced</option>
                <option value="detailed">Detailed</option>
              </select>
            </div>
          </div>

          <div className="text-sm text-gray-600">
            Analyzing {filteredMessages.length} messages
          </div>
        </div>
      </Card>

      {/* Efficiency Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {efficiencyMetrics.map((metric) => (
          <Card key={metric.metric} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {getStatusIcon(metric.status)}
                <span className="text-sm font-medium">{metric.metric}</span>
              </div>
              {getTrendIcon(metric.trend)}
            </div>
            
            <div className="text-2xl font-bold mb-1">
              {metric.unit === '%' || metric.unit === 'ms' 
                ? Math.round(metric.value * 10) / 10 
                : Math.round(metric.value)}
              <span className="text-lg text-gray-500 ml-1">{metric.unit}</span>
            </div>
            
            {metric.benchmark && (
              <div className="text-xs text-gray-600">
                Target: {metric.benchmark}{metric.unit}
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Communication Patterns */}
      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <Network size={20} />
          Communication Patterns
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pattern Distribution */}
          <div>
            <h4 className="font-medium mb-3">Pattern Distribution</h4>
            <div className="space-y-3">
              {communicationPatterns.map((pattern) => (
                <div key={pattern.type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium capitalize">
                      {pattern.type.replace('_', ' ')}
                    </div>
                    <div className="text-sm text-gray-600">
                      {pattern.frequency} occurrences • {Math.round(pattern.avgDuration)}ms avg
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold">
                      {Math.round(pattern.efficiency)}%
                    </div>
                    <Badge 
                      variant={pattern.trend === 'increasing' ? 'default' : pattern.trend === 'decreasing' ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {pattern.trend}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pattern Efficiency Chart */}
          <div>
            <h4 className="font-medium mb-3">Efficiency by Pattern</h4>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={communicationPatterns}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="type" 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => value.replace('_', ' ').split(' ').map((w: string) => w[0].toUpperCase()).join('')}
                />
                <YAxis />
                <Tooltip 
                  formatter={(value: number) => [`${Math.round(value)}%`, 'Efficiency']}
                  labelFormatter={(label) => label.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                />
                <Bar dataKey="efficiency" fill={COLORS.manager} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      {/* Bottleneck Analysis */}
      {bottlenecks.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <AlertTriangle size={20} />
            Bottleneck Analysis
          </h3>
          
          <div className="space-y-4">
            {bottlenecks.slice(0, 5).map((bottleneck, index) => (
              <div key={bottleneck.type} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Badge className={getSeverityColor(bottleneck.severity)}>
                      {bottleneck.severity.toUpperCase()}
                    </Badge>
                    <h4 className="font-medium capitalize">
                      {bottleneck.type.replace('_', ' ')}
                    </h4>
                  </div>
                  <div className="text-sm text-gray-600">
                    {bottleneck.frequency} occurrences
                  </div>
                </div>
                
                <div className="text-sm text-gray-700 mb-2">
                  {bottleneck.recommendation}
                </div>
                
                {bottleneck.avgImpact > 0 && (
                  <div className="text-sm text-gray-600">
                    Average impact: {Math.round(bottleneck.avgImpact)}ms
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Collaboration Patterns */}
      {collaborationPatterns.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Users size={20} />
            Collaboration Patterns
          </h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {collaborationPatterns.map((pattern) => (
              <div key={pattern.pattern} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">{pattern.pattern}</h4>
                  <div className="text-right text-sm">
                    <div className="font-semibold">{Math.round(pattern.successRate)}%</div>
                    <div className="text-gray-600">Success Rate</div>
                  </div>
                </div>
                
                <div className="text-sm text-gray-700 mb-3">
                  {pattern.description}
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-600">Frequency</div>
                    <div className="font-medium">{pattern.frequency}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Avg Duration</div>
                    <div className="font-medium">{Math.round(pattern.avgDuration / 1000)}s</div>
                  </div>
                </div>
                
                {pattern.examples.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs text-gray-600 mb-1">Examples:</div>
                    <div className="text-xs bg-gray-50 p-2 rounded">
                      {pattern.examples[0]}...
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Communication Flow Analysis */}
      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <Workflow size={20} />
          Communication Flow Analysis
        </h3>
        
        <div className="space-y-3">
          {communicationFlows.slice(0, 8).map((flow, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Badge variant={flow.from === 'manager' ? 'default' : 'secondary'}>
                    {flow.from}
                  </Badge>
                  <ArrowUp className="rotate-90 text-gray-400" size={16} />
                  <Badge variant={flow.to === 'manager' ? 'default' : 'secondary'}>
                    {flow.to}
                  </Badge>
                </div>
                <div className="text-sm text-gray-600 capitalize">
                  {flow.messageType.replace('_', ' ')}
                </div>
              </div>
              
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <div className="font-medium">{flow.count}</div>
                  <div className="text-gray-600">Count</div>
                </div>
                <div>
                  <div className="font-medium">{Math.round(flow.avgResponseTime)}ms</div>
                  <div className="text-gray-600">Avg Time</div>
                </div>
                <div>
                  <div className="font-medium">{Math.round(flow.successRate)}%</div>
                  <div className="text-gray-600">Success</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Performance Recommendations */}
      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <Target size={20} />
          Performance Recommendations
        </h3>
        
        <div className="space-y-3">
          {efficiencyMetrics.filter(m => m.status !== 'excellent').map((metric) => (
            <div key={metric.metric} className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
              <AlertCircle size={16} className="text-yellow-600 mt-1" />
              <div>
                <div className="font-medium">{metric.metric} Optimization</div>
                <div className="text-sm text-gray-700">
                  Current: {Math.round(metric.value * 10) / 10}{metric.unit}
                  {metric.benchmark && ` • Target: ${metric.benchmark}${metric.unit}`}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {metric.metric === 'Error Rate' && 
                    'Review error handling and input validation to reduce failure rates.'}
                  {metric.metric === 'Avg Response Time' && 
                    'Consider optimizing context size or implementing response caching.'}
                  {metric.metric === 'Tool Success Rate' && 
                    'Review tool configurations and error recovery mechanisms.'}
                  {metric.metric === 'Message Throughput' && 
                    'Analyze for bottlenecks in agent switching or tool execution.'}
                </div>
              </div>
            </div>
          ))}
          
          {bottlenecks.length > 0 && (
            <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
              <AlertTriangle size={16} className="text-red-600 mt-1" />
              <div>
                <div className="font-medium">Address Critical Bottlenecks</div>
                <div className="text-sm text-gray-700">
                  {bottlenecks.length} bottleneck{bottlenecks.length > 1 ? 's' : ''} identified that could impact performance.
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  Focus on {bottlenecks[0].type.replace('_', ' ')} issues first as they have the highest severity.
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};