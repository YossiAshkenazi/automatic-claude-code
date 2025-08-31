import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Separator } from './ui/Separator';
import { PerformanceCharts } from './PerformanceCharts';
import { AgentComparison } from './AgentComparison';
import { MetricsCards } from './MetricsCards';
import { LoadingSpinner } from './ui/LoadingSpinner';
import { 
  BarChart3, 
  TrendingUp, 
  AlertTriangle, 
  RefreshCw,
  Download,
  Settings,
  Eye,
  EyeOff
} from 'lucide-react';

interface AnalyticsDashboardProps {
  sessionIds?: string[];
  selectedSessionId?: string;
  onSessionSelect?: (sessionId: string) => void;
}

interface DashboardData {
  overview: {
    totalSessions: number;
    activeSessions: number;
    avgPerformance: number;
    totalCost: number;
    errorRate: number;
  };
  performanceTrends: {
    manager: Array<{ timestamp: Date; value: number; label: string }>;
    worker: Array<{ timestamp: Date; value: number; label: string }>;
    coordination: Array<{ timestamp: Date; value: number; label: string }>;
  };
  realTimeMetrics: Array<{
    timestamp: Date;
    sessionId: string;
    agentType: 'manager' | 'worker';
    responseTime: number;
    tokensUsed?: number;
    cost?: number;
    errorRate: number;
    throughput: number;
  }>;
  topSessions: Array<{
    sessionId: string;
    performanceScore: number;
    cost: number;
    duration: number;
  }>;
  alerts: Array<{
    type: 'warning' | 'error' | 'info';
    message: string;
    timestamp: Date;
  }>;
  recommendations: string[];
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  sessionIds = [],
  selectedSessionId,
  onSessionSelect
}) => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds
  const [showRealTime, setShowRealTime] = useState(true);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');

  const fetchDashboardData = async () => {
    try {
      setError(null);
      
      const params = new URLSearchParams();
      
      if (sessionIds.length > 0) {
        sessionIds.forEach(id => params.append('sessionIds', id));
      }
      
      if (showRealTime) {
        params.set('includeRealTime', 'true');
      }

      // Add time range
      const now = new Date();
      const start = new Date();
      switch (timeRange) {
        case '1h':
          start.setHours(now.getHours() - 1);
          break;
        case '24h':
          start.setHours(now.getHours() - 24);
          break;
        case '7d':
          start.setDate(now.getDate() - 7);
          break;
        case '30d':
          start.setDate(now.getDate() - 30);
          break;
      }
      
      params.set('timeRange', JSON.stringify({ start: start.toISOString(), end: now.toISOString() }));
      
      const response = await fetch(`/api/analytics/dashboard?${params}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setDashboardData(data);
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [sessionIds, showRealTime, timeRange]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchDashboardData, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, sessionIds, showRealTime, timeRange]);

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const query = {
        sessionIds,
        timeRange: { start: new Date(Date.now() - 24 * 60 * 60 * 1000), end: new Date() }
      };

      const response = await fetch('/api/analytics/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format, query })
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(`Export failed: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner />
        <span className="ml-2">Loading analytics dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <span className="text-red-700">Error loading dashboard: {error}</span>
          </div>
          <Button 
            onClick={fetchDashboardData} 
            className="mt-4"
            variant="outline"
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!dashboardData) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-gray-500">
            No analytics data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold flex items-center">
            <BarChart3 className="h-6 w-6 mr-2" />
            Analytics Dashboard
          </h2>
          
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium">Time Range:</label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="px-3 py-1 border rounded-md text-sm"
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRealTime(!showRealTime)}
          >
            {showRealTime ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
            Real-time
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto-refresh
          </Button>
          
          <div className="flex items-center space-x-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('json')}
            >
              <Download className="h-4 w-4 mr-2" />
              JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('csv')}
            >
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDashboardData}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {dashboardData.alerts.length > 0 && (
        <div className="space-y-2">
          {dashboardData.alerts.map((alert, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg border-l-4 ${
                alert.type === 'error' 
                  ? 'bg-red-50 border-red-400 text-red-700'
                  : alert.type === 'warning'
                  ? 'bg-yellow-50 border-yellow-400 text-yellow-700'
                  : 'bg-blue-50 border-blue-400 text-blue-700'
              }`}
            >
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium">{alert.message}</span>
                <span className="text-sm opacity-75">
                  {new Date(alert.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Key Metrics Cards */}
      <MetricsCards 
        overview={dashboardData.overview}
        topSessions={dashboardData.topSessions}
      />

      {/* Performance Charts */}
      <PerformanceCharts 
        trends={dashboardData.performanceTrends}
        realTimeMetrics={showRealTime ? dashboardData.realTimeMetrics : []}
        timeRange={timeRange}
      />

      {/* Agent Comparison */}
      <AgentComparison 
        sessionIds={sessionIds}
        selectedSessionId={selectedSessionId}
        onSessionSelect={onSessionSelect}
      />

      {/* Recommendations */}
      {dashboardData.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Optimization Recommendations
            </CardTitle>
            <CardDescription>
              AI-generated insights to improve agent performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboardData.recommendations.map((recommendation, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <Badge variant="outline" className="mt-0.5">
                      {index + 1}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-700">{recommendation}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Session Summary */}
      {dashboardData.topSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Performing Sessions</CardTitle>
            <CardDescription>
              Sessions ranked by performance score
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboardData.topSessions.map((session, index) => (
                <div
                  key={session.sessionId}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                    session.sessionId === selectedSessionId 
                      ? 'bg-blue-50 border-blue-200'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => onSessionSelect?.(session.sessionId)}
                >
                  <div className="flex items-center space-x-3">
                    <Badge variant={index < 3 ? 'default' : 'secondary'}>
                      #{index + 1}
                    </Badge>
                    <div>
                      <div className="font-medium">
                        {session.sessionId.substring(0, 8)}...
                      </div>
                      <div className="text-sm text-gray-500">
                        Duration: {Math.round(session.duration / 60000)}m
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="font-medium">
                        {session.performanceScore.toFixed(1)}%
                      </div>
                      <div className="text-sm text-gray-500">
                        ${session.cost.toFixed(3)}
                      </div>
                    </div>
                    <div className={`w-2 h-8 rounded ${
                      session.performanceScore >= 90 ? 'bg-green-400' :
                      session.performanceScore >= 70 ? 'bg-yellow-400' : 'bg-red-400'
                    }`} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};