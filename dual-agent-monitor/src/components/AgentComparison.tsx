import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { LoadingSpinner } from './ui/LoadingSpinner';
import { 
  RadarChart, 
  Radar, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell
} from 'recharts';
import { 
  Users, 
  Target, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Zap,
  DollarSign
} from 'lucide-react';

interface AgentComparisonProps {
  sessionIds: string[];
  selectedSessionId?: string;
  onSessionSelect?: (sessionId: string) => void;
}

interface ComparisonData {
  sessions: string[];
  metrics: {
    avgResponseTime: {
      manager: number[];
      worker: number[];
    };
    successRate: {
      manager: number[];
      worker: number[];
    };
    costEfficiency: {
      manager: number[];
      worker: number[];
    };
    coordinationEfficiency: number[];
  };
  trends: {
    improvement: boolean;
    degradation: boolean;
    stable: boolean;
  };
}

interface AgentMetrics {
  agent: string;
  performance: number;
  responseTime: number;
  successRate: number;
  costEfficiency: number;
  coordination: number;
  adaptability: number;
}

export const AgentComparison: React.FC<AgentComparisonProps> = ({
  sessionIds,
  selectedSessionId,
  onSessionSelect
}) => {
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'radar' | 'bar' | 'summary'>('radar');

  const fetchComparisonData = async () => {
    if (sessionIds.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/analytics/comparison', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionIds })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setComparisonData(data);
    } catch (err: any) {
      console.error('Error fetching comparison data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComparisonData();
  }, [sessionIds]);

  if (sessionIds.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-gray-500">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Select sessions to compare agent performance</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <LoadingSpinner />
            <span className="ml-2">Analyzing agent performance...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <span className="text-red-700">Error loading comparison: {error}</span>
          </div>
          <Button onClick={fetchComparisonData} className="mt-4" variant="outline" size="sm">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!comparisonData) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-gray-500">
            No comparison data available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Prepare radar chart data
  const radarData = [
    {
      metric: 'Response Time',
      manager: 100 - (comparisonData.metrics.avgResponseTime.manager.reduce((a, b) => a + b, 0) / comparisonData.metrics.avgResponseTime.manager.length / 1000) * 10,
      worker: 100 - (comparisonData.metrics.avgResponseTime.worker.reduce((a, b) => a + b, 0) / comparisonData.metrics.avgResponseTime.worker.length / 1000) * 10,
      fullMark: 100
    },
    {
      metric: 'Success Rate',
      manager: comparisonData.metrics.successRate.manager.reduce((a, b) => a + b, 0) / comparisonData.metrics.successRate.manager.length * 100,
      worker: comparisonData.metrics.successRate.worker.reduce((a, b) => a + b, 0) / comparisonData.metrics.successRate.worker.length * 100,
      fullMark: 100
    },
    {
      metric: 'Cost Efficiency',
      manager: Math.max(0, 100 - (comparisonData.metrics.costEfficiency.manager.reduce((a, b) => a + b, 0) / comparisonData.metrics.costEfficiency.manager.length) * 1000),
      worker: Math.max(0, 100 - (comparisonData.metrics.costEfficiency.worker.reduce((a, b) => a + b, 0) / comparisonData.metrics.costEfficiency.worker.length) * 1000),
      fullMark: 100
    },
    {
      metric: 'Coordination',
      manager: comparisonData.metrics.coordinationEfficiency.reduce((a, b) => a + b, 0) / comparisonData.metrics.coordinationEfficiency.length,
      worker: comparisonData.metrics.coordinationEfficiency.reduce((a, b) => a + b, 0) / comparisonData.metrics.coordinationEfficiency.length,
      fullMark: 100
    }
  ];

  // Prepare bar chart data
  const barData = sessionIds.map((sessionId, index) => ({
    session: `Session ${index + 1}`,
    sessionId,
    managerResponseTime: comparisonData.metrics.avgResponseTime.manager[index] || 0,
    workerResponseTime: comparisonData.metrics.avgResponseTime.worker[index] || 0,
    managerSuccess: (comparisonData.metrics.successRate.manager[index] || 0) * 100,
    workerSuccess: (comparisonData.metrics.successRate.worker[index] || 0) * 100,
    coordination: comparisonData.metrics.coordinationEfficiency[index] || 0
  }));

  const calculateOverallScore = (agent: 'manager' | 'worker'): number => {
    const responseTimeScore = 100 - (comparisonData.metrics.avgResponseTime[agent].reduce((a, b) => a + b, 0) / comparisonData.metrics.avgResponseTime[agent].length / 1000) * 10;
    const successScore = comparisonData.metrics.successRate[agent].reduce((a, b) => a + b, 0) / comparisonData.metrics.successRate[agent].length * 100;
    const costScore = Math.max(0, 100 - (comparisonData.metrics.costEfficiency[agent].reduce((a, b) => a + b, 0) / comparisonData.metrics.costEfficiency[agent].length) * 1000);
    
    return (responseTimeScore * 0.3 + successScore * 0.5 + costScore * 0.2);
  };

  const managerScore = calculateOverallScore('manager');
  const workerScore = calculateOverallScore('worker');
  const avgCoordination = comparisonData.metrics.coordinationEfficiency.reduce((a, b) => a + b, 0) / comparisonData.metrics.coordinationEfficiency.length;

  const renderChart = () => {
    switch (viewMode) {
      case 'radar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
              <PolarRadiusAxis 
                angle={90} 
                domain={[0, 100]} 
                tick={{ fontSize: 10 }}
                tickCount={4}
              />
              <Radar
                name="Manager"
                dataKey="manager"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.3}
                strokeWidth={2}
              />
              <Radar
                name="Worker"
                dataKey="worker"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.3}
                strokeWidth={2}
              />
              <Legend />
              <Tooltip
                content={({ payload, label }) => {
                  if (!payload || payload.length === 0) return null;
                  return (
                    <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                      <p className="font-medium">{label}</p>
                      {payload.map((entry: any, index: number) => (
                        <p key={index} style={{ color: entry.color }} className="text-sm">
                          {entry.name}: {entry.value.toFixed(1)}
                        </p>
                      ))}
                    </div>
                  );
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="session" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  return (
                    <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                      <p className="font-medium">{label}</p>
                      {payload.map((entry: any, index: number) => (
                        <p key={index} style={{ color: entry.color }} className="text-sm">
                          {entry.name}: {
                            entry.dataKey.includes('ResponseTime') ? `${entry.value.toFixed(0)}ms` :
                            entry.dataKey.includes('Success') ? `${entry.value.toFixed(1)}%` :
                            `${entry.value.toFixed(1)}%`
                          }
                        </p>
                      ))}
                    </div>
                  );
                }}
              />
              <Legend />
              <Bar dataKey="managerSuccess" fill="#3b82f6" name="Manager Success Rate" />
              <Bar dataKey="workerSuccess" fill="#10b981" name="Worker Success Rate" />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'summary':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Manager Summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center">
                  <Target className="h-5 w-5 mr-2 text-blue-500" />
                  Manager Agent
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Overall Score</span>
                    <Badge variant={managerScore >= 80 ? 'default' : managerScore >= 60 ? 'secondary' : 'destructive'}>
                      {managerScore.toFixed(1)}%
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Avg Response Time</span>
                      <span>
                        {(comparisonData.metrics.avgResponseTime.manager.reduce((a, b) => a + b, 0) / comparisonData.metrics.avgResponseTime.manager.length / 1000).toFixed(1)}s
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Success Rate</span>
                      <span>
                        {(comparisonData.metrics.successRate.manager.reduce((a, b) => a + b, 0) / comparisonData.metrics.successRate.manager.length * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Cost Efficiency</span>
                      <span>
                        ${(comparisonData.metrics.costEfficiency.manager.reduce((a, b) => a + b, 0) / comparisonData.metrics.costEfficiency.manager.length).toFixed(3)}/msg
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Worker Summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center">
                  <Zap className="h-5 w-5 mr-2 text-green-500" />
                  Worker Agent
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Overall Score</span>
                    <Badge variant={workerScore >= 80 ? 'default' : workerScore >= 60 ? 'secondary' : 'destructive'}>
                      {workerScore.toFixed(1)}%
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Avg Response Time</span>
                      <span>
                        {(comparisonData.metrics.avgResponseTime.worker.reduce((a, b) => a + b, 0) / comparisonData.metrics.avgResponseTime.worker.length / 1000).toFixed(1)}s
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Success Rate</span>
                      <span>
                        {(comparisonData.metrics.successRate.worker.reduce((a, b) => a + b, 0) / comparisonData.metrics.successRate.worker.length * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Cost Efficiency</span>
                      <span>
                        ${(comparisonData.metrics.costEfficiency.worker.reduce((a, b) => a + b, 0) / comparisonData.metrics.costEfficiency.worker.length).toFixed(3)}/msg
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Coordination Summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center">
                  <Users className="h-5 w-5 mr-2 text-yellow-500" />
                  Coordination
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Efficiency Score</span>
                    <Badge variant={avgCoordination >= 70 ? 'default' : avgCoordination >= 50 ? 'secondary' : 'destructive'}>
                      {avgCoordination.toFixed(1)}%
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Sessions Analyzed</span>
                      <span>{sessionIds.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Trend</span>
                      <span className="flex items-center">
                        {comparisonData.trends.improvement ? (
                          <>
                            <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                            <span className="text-green-600">Improving</span>
                          </>
                        ) : comparisonData.trends.degradation ? (
                          <>
                            <AlertTriangle className="h-4 w-4 text-red-500 mr-1" />
                            <span className="text-red-600">Declining</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 text-gray-500 mr-1" />
                            <span className="text-gray-600">Stable</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Agent Performance Comparison
            </CardTitle>
            <CardDescription>
              Compare manager and worker agent performance across {sessionIds.length} sessions
            </CardDescription>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant={viewMode === 'summary' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('summary')}
            >
              <Target className="h-4 w-4 mr-2" />
              Summary
            </Button>
            <Button
              variant={viewMode === 'radar' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('radar')}
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Radar
            </Button>
            <Button
              variant={viewMode === 'bar' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('bar')}
            >
              <BarChart className="h-4 w-4 mr-2" />
              Bar Chart
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {renderChart()}
        
        {/* Quick Insights */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium mb-3 flex items-center">
            <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
            Key Insights
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Best Performer:</strong>{' '}
              <span className={managerScore > workerScore ? 'text-blue-600' : 'text-green-600'}>
                {managerScore > workerScore ? 'Manager' : 'Worker'} Agent
              </span>{' '}
              ({Math.max(managerScore, workerScore).toFixed(1)}% overall score)
            </div>
            
            <div>
              <strong>Coordination Trend:</strong>{' '}
              <span className={
                comparisonData.trends.improvement ? 'text-green-600' :
                comparisonData.trends.degradation ? 'text-red-600' : 'text-gray-600'
              }>
                {comparisonData.trends.improvement ? 'Improving' :
                 comparisonData.trends.degradation ? 'Declining' : 'Stable'}
              </span>
            </div>
            
            <div>
              <strong>Performance Gap:</strong>{' '}
              <span className={Math.abs(managerScore - workerScore) > 20 ? 'text-red-600' : 'text-green-600'}>
                {Math.abs(managerScore - workerScore).toFixed(1)}% difference
              </span>
            </div>
            
            <div>
              <strong>Coordination Score:</strong>{' '}
              <span className={avgCoordination >= 70 ? 'text-green-600' : avgCoordination >= 50 ? 'text-yellow-600' : 'text-red-600'}>
                {avgCoordination.toFixed(1)}% efficiency
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};