import React from 'react';
import { Card, CardContent } from './ui/Card';
import { Badge } from './ui/Badge';
import { 
  Activity, 
  Clock, 
  DollarSign, 
  AlertTriangle,
  CheckCircle,
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  Zap
} from 'lucide-react';

interface MetricsCardsProps {
  overview: {
    totalSessions: number;
    activeSessions: number;
    avgPerformance: number;
    totalCost: number;
    errorRate: number;
  };
  topSessions: Array<{
    sessionId: string;
    performanceScore: number;
    cost: number;
    duration: number;
  }>;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  status?: 'good' | 'warning' | 'error' | 'neutral';
  onClick?: () => void;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendValue,
  status = 'neutral',
  onClick
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getTrendIcon = (trend?: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'stable': return <Minus className="h-4 w-4 text-gray-500" />;
      default: return null;
    }
  };

  const getBorderColor = (status: string) => {
    switch (status) {
      case 'good': return 'border-green-200 bg-green-50';
      case 'warning': return 'border-yellow-200 bg-yellow-50';
      case 'error': return 'border-red-200 bg-red-50';
      default: return 'border-gray-200';
    }
  };

  return (
    <Card 
      className={`${getBorderColor(status)} ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-600">{title}</p>
              <div className="flex items-center space-x-1">
                {trend && trendValue && (
                  <>
                    {getTrendIcon(trend)}
                    <span className={`text-xs ${
                      trend === 'up' ? 'text-green-600' : 
                      trend === 'down' ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {trendValue}
                    </span>
                  </>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <p className={`text-2xl font-bold ${getStatusColor(status)}`}>
                {typeof value === 'number' && value % 1 !== 0 ? value.toFixed(1) : value}
              </p>
              <div className={`p-2 rounded-lg ${
                status === 'good' ? 'bg-green-100' :
                status === 'warning' ? 'bg-yellow-100' :
                status === 'error' ? 'bg-red-100' : 'bg-gray-100'
              }`}>
                {icon}
              </div>
            </div>
            
            {subtitle && (
              <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const MetricsCards: React.FC<MetricsCardsProps> = ({ overview, topSessions }) => {
  // Calculate trends (mock data - in real implementation would come from historical data)
  const trends = {
    performance: Math.random() > 0.5 ? 'up' : 'down',
    cost: Math.random() > 0.5 ? 'up' : 'down',
    errorRate: overview.errorRate < 5 ? 'down' : 'up',
    sessions: overview.activeSessions > 0 ? 'up' : 'stable'
  };

  const getPerformanceStatus = (score: number): 'good' | 'warning' | 'error' => {
    if (score >= 80) return 'good';
    if (score >= 60) return 'warning';
    return 'error';
  };

  const getCostStatus = (cost: number): 'good' | 'warning' | 'error' => {
    if (cost < 1) return 'good';
    if (cost < 5) return 'warning';
    return 'error';
  };

  const getErrorStatus = (errorRate: number): 'good' | 'warning' | 'error' => {
    if (errorRate < 5) return 'good';
    if (errorRate < 15) return 'warning';
    return 'error';
  };

  const bestSession = topSessions.length > 0 ? topSessions[0] : null;
  const avgSessionScore = topSessions.length > 0 
    ? topSessions.reduce((sum, s) => sum + s.performanceScore, 0) / topSessions.length 
    : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
      {/* Total Sessions */}
      <MetricCard
        title="Total Sessions"
        value={overview.totalSessions}
        subtitle={`${overview.activeSessions} currently active`}
        icon={<Users className="h-5 w-5 text-gray-500" />}
        trend={trends.sessions}
        trendValue={`+${overview.activeSessions}`}
        status={overview.totalSessions > 0 ? 'good' : 'neutral'}
      />

      {/* Average Performance */}
      <MetricCard
        title="Avg Performance"
        value={`${overview.avgPerformance}%`}
        subtitle="Overall system score"
        icon={<Activity className="h-5 w-5" />}
        trend={trends.performance}
        trendValue={trends.performance === 'up' ? '+2.3%' : '-1.1%'}
        status={getPerformanceStatus(overview.avgPerformance)}
      />

      {/* Total Cost */}
      <MetricCard
        title="Total Cost"
        value={`$${overview.totalCost.toFixed(2)}`}
        subtitle="All sessions combined"
        icon={<DollarSign className="h-5 w-5" />}
        trend={trends.cost}
        trendValue={trends.cost === 'up' ? '+$0.12' : '-$0.05'}
        status={getCostStatus(overview.totalCost)}
      />

      {/* Error Rate */}
      <MetricCard
        title="Error Rate"
        value={`${overview.errorRate}%`}
        subtitle="System-wide errors"
        icon={<AlertTriangle className="h-5 w-5" />}
        trend={trends.errorRate}
        trendValue={trends.errorRate === 'down' ? '-0.8%' : '+1.2%'}
        status={getErrorStatus(overview.errorRate)}
      />

      {/* Best Session Performance */}
      {bestSession && (
        <MetricCard
          title="Best Session"
          value={`${bestSession.performanceScore.toFixed(1)}%`}
          subtitle={`${bestSession.sessionId.substring(0, 8)}...`}
          icon={<Target className="h-5 w-5" />}
          status="good"
        />
      )}

      {/* Session Average */}
      {topSessions.length > 0 && (
        <MetricCard
          title="Session Avg"
          value={`${avgSessionScore.toFixed(1)}%`}
          subtitle={`Across ${topSessions.length} sessions`}
          icon={<Zap className="h-5 w-5" />}
          status={getPerformanceStatus(avgSessionScore)}
        />
      )}
    </div>
  );
};