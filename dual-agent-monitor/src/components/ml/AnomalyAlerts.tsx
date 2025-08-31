import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { LoadingSpinner } from '../ui/LoadingSpinner';

interface Anomaly {
  id: string;
  type: 'performance' | 'behavior' | 'pattern' | 'cost' | 'error' | 'communication';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  detectedAt: Date;
  sessionId?: string;
  agentType?: 'manager' | 'worker';
  metrics: {
    actualValue: number;
    expectedValue: number;
    deviationScore: number;
    confidenceLevel: number;
  };
  context: {
    historicalComparison: any;
    relatedEvents: string[];
    possibleCauses: string[];
  };
  recommendations: string[];
  autoResolution?: {
    possible: boolean;
    actions: string[];
    riskLevel: 'low' | 'medium' | 'high';
  };
}

interface AnomalyPattern {
  patternId: string;
  name: string;
  description: string;
  occurrences: number;
  firstSeen: Date;
  lastSeen: Date;
  affectedSessions: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  isRecurring: boolean;
  frequency: number;
  characteristics: Record<string, any>;
}

interface AnomalyInsights {
  recentAnomalies: Anomaly[];
  trends: {
    increasing: string[];
    decreasing: string[];
    stable: string[];
  };
  hotspots: Array<{
    area: string;
    anomalyCount: number;
    severity: string;
  }>;
  recommendations: string[];
}

interface AnomalyAlertsProps {
  className?: string;
  maxAnomalies?: number;
  autoRefresh?: boolean;
  showPatterns?: boolean;
}

export const AnomalyAlerts: React.FC<AnomalyAlertsProps> = ({
  className = '',
  maxAnomalies = 50,
  autoRefresh = true,
  showPatterns = true
}) => {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [patterns, setPatterns] = useState<AnomalyPattern[]>([]);
  const [insights, setInsights] = useState<AnomalyInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'alerts' | 'patterns' | 'insights'>('alerts');
  const [acknowledgedAnomalies, setAcknowledgedAnomalies] = useState<Set<string>>(new Set());

  const anomalyTypes = ['all', 'performance', 'behavior', 'pattern', 'cost', 'error', 'communication'];
  const severityLevels = ['all', 'critical', 'high', 'medium', 'low'];

  useEffect(() => {
    loadAnomalyData();
    
    if (autoRefresh) {
      const interval = setInterval(loadAnomalyData, 30 * 1000); // 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const loadAnomalyData = async () => {
    try {
      setError(null);
      
      const [anomaliesResponse, patternsResponse, insightsResponse] = await Promise.all([
        fetch(`/api/ml/anomalies?limit=${maxAnomalies}`),
        fetch('/api/ml/anomaly-patterns'),
        fetch('/api/ml/anomaly-insights')
      ]);

      if (!anomaliesResponse.ok || !patternsResponse.ok || !insightsResponse.ok) {
        throw new Error('Failed to load anomaly data');
      }

      const [anomaliesData, patternsData, insightsData] = await Promise.all([
        anomaliesResponse.json(),
        patternsResponse.json(),
        insightsResponse.json()
      ]);

      setAnomalies(anomaliesData.anomalies || []);
      setPatterns(patternsData.patterns || []);
      setInsights(insightsData.insights || null);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load anomaly data');
      console.error('Error loading anomaly data:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredAnomalies = anomalies.filter(anomaly => {
    if (selectedType !== 'all' && anomaly.type !== selectedType) return false;
    if (selectedSeverity !== 'all' && anomaly.severity !== selectedSeverity) return false;
    return true;
  });

  const unacknowledgedAnomalies = filteredAnomalies.filter(a => !acknowledgedAnomalies.has(a.id));

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'performance': return 'bg-green-100 text-green-800 border-green-200';
      case 'behavior': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'pattern': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'cost': return 'bg-pink-100 text-pink-800 border-pink-200';
      case 'error': return 'bg-red-100 text-red-800 border-red-200';
      case 'communication': return 'bg-teal-100 text-teal-800 border-teal-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSeverityIcon = (severity: string): string => {
    switch (severity) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '⚡';
      case 'low': return 'ℹ️';
      default: return '📊';
    }
  };

  const acknowledgeAnomaly = (anomalyId: string) => {
    setAcknowledgedAnomalies(prev => new Set([...prev, anomalyId]));
  };

  const acknowledgeAll = () => {
    setAcknowledgedAnomalies(new Set(filteredAnomalies.map(a => a.id)));
  };

  const formatTimestamp = (timestamp: Date | string): string => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60 * 1000) return 'Just now';
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}m ago`;
    if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))}h ago`;
    return date.toLocaleDateString();
  };

  const getDeviationColor = (deviationScore: number): string => {
    if (deviationScore > 3) return 'text-red-600';
    if (deviationScore > 2) return 'text-orange-600';
    if (deviationScore > 1) return 'text-yellow-600';
    return 'text-blue-600';
  };

  if (loading) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
          <span className="ml-2">Loading anomaly alerts...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="text-center text-red-600">
          <p className="mb-4">Error loading anomaly data: {error}</p>
          <Button onClick={loadAnomalyData} variant="outline">
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Anomaly Detection & Alerts</h2>
          <p className="text-gray-600">Real-time monitoring and pattern recognition</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex rounded-md shadow-sm">
            <Button
              variant={viewMode === 'alerts' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('alerts')}
              className="rounded-r-none"
            >
              Alerts ({unacknowledgedAnomalies.length})
            </Button>
            {showPatterns && (
              <Button
                variant={viewMode === 'patterns' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('patterns')}
                className="rounded-none"
              >
                Patterns ({patterns.length})
              </Button>
            )}
            <Button
              variant={viewMode === 'insights' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('insights')}
              className="rounded-l-none"
            >
              Insights
            </Button>
          </div>
          <Button onClick={loadAnomalyData} variant="outline" size="sm">
            Refresh
          </Button>
        </div>
      </div>

      {/* Alert Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <span className="text-red-600 text-xl">🚨</span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Critical</p>
              <p className="text-2xl font-bold text-gray-900">
                {anomalies.filter(a => a.severity === 'critical' && !acknowledgedAnomalies.has(a.id)).length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <span className="text-orange-600 text-xl">⚠️</span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">High Priority</p>
              <p className="text-2xl font-bold text-gray-900">
                {anomalies.filter(a => a.severity === 'high' && !acknowledgedAnomalies.has(a.id)).length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <span className="text-blue-600 text-xl">📊</span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total Active</p>
              <p className="text-2xl font-bold text-gray-900">{unacknowledgedAnomalies.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <span className="text-purple-600 text-xl">🔄</span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Recurring</p>
              <p className="text-2xl font-bold text-gray-900">
                {patterns.filter(p => p.isRecurring).length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Alerts View */}
      {viewMode === 'alerts' && (
        <>
          {/* Filters and Actions */}
          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700">Type:</label>
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {anomalyTypes.map(type => (
                      <option key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700">Severity:</label>
                  <select
                    value={selectedSeverity}
                    onChange={(e) => setSelectedSeverity(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {severityLevels.map(severity => (
                      <option key={severity} value={severity}>
                        {severity.charAt(0).toUpperCase() + severity.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {unacknowledgedAnomalies.length > 0 && (
                <Button onClick={acknowledgeAll} variant="outline" size="sm">
                  Acknowledge All ({unacknowledgedAnomalies.length})
                </Button>
              )}
            </div>
          </Card>

          {/* Anomalies List */}
          <div className="space-y-4">
            {filteredAnomalies.length === 0 ? (
              <Card className="p-8 text-center">
                <div className="text-gray-500">
                  <span className="text-4xl mb-4 block">✅</span>
                  <p className="text-lg font-medium mb-2">No anomalies detected</p>
                  <p>All systems are operating within normal parameters.</p>
                </div>
              </Card>
            ) : (
              filteredAnomalies.map((anomaly) => (
                <Card 
                  key={anomaly.id} 
                  className={`p-6 transition-all ${
                    acknowledgedAnomalies.has(anomaly.id) 
                      ? 'opacity-60 bg-gray-50' 
                      : 'hover:shadow-lg'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{getSeverityIcon(anomaly.severity)}</span>
                      <div>
                        <h3 className="font-semibold text-gray-900 text-lg">{anomaly.title}</h3>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge className={getTypeColor(anomaly.type)}>
                            {anomaly.type}
                          </Badge>
                          <Badge className={getSeverityColor(anomaly.severity)}>
                            {anomaly.severity}
                          </Badge>
                          {anomaly.sessionId && (
                            <Badge variant="outline" size="sm">
                              Session: {anomaly.sessionId.substring(0, 8)}...
                            </Badge>
                          )}
                          {anomaly.agentType && (
                            <Badge variant="outline" size="sm">
                              {anomaly.agentType}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500 mb-2">
                        {formatTimestamp(anomaly.detectedAt)}
                      </div>
                      {!acknowledgedAnomalies.has(anomaly.id) && (
                        <Button
                          onClick={() => acknowledgeAnomaly(anomaly.id)}
                          variant="outline"
                          size="sm"
                        >
                          Acknowledge
                        </Button>
                      )}
                    </div>
                  </div>

                  <p className="text-gray-700 mb-4">{anomaly.description}</p>

                  {/* Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Actual Value</p>
                      <p className="font-bold text-gray-900">
                        {typeof anomaly.metrics.actualValue === 'number' 
                          ? anomaly.metrics.actualValue.toFixed(2) 
                          : anomaly.metrics.actualValue}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Expected Value</p>
                      <p className="font-bold text-gray-900">
                        {typeof anomaly.metrics.expectedValue === 'number' 
                          ? anomaly.metrics.expectedValue.toFixed(2) 
                          : anomaly.metrics.expectedValue}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Deviation Score</p>
                      <p className={`font-bold ${getDeviationColor(anomaly.metrics.deviationScore)}`}>
                        {anomaly.metrics.deviationScore.toFixed(1)}σ
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Confidence</p>
                      <p className="font-bold text-gray-900">
                        {(anomaly.metrics.confidenceLevel * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>

                  {/* Possible Causes */}
                  {anomaly.context.possibleCauses.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-medium text-gray-800 mb-2">Possible Causes</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                        {anomaly.context.possibleCauses.slice(0, 3).map((cause, index) => (
                          <li key={index}>{cause}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Recommendations */}
                  {anomaly.recommendations.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-medium text-gray-800 mb-2">Recommended Actions</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                        {anomaly.recommendations.slice(0, 3).map((rec, index) => (
                          <li key={index}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Auto-Resolution */}
                  {anomaly.autoResolution && (
                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-800">Auto-Resolution</h4>
                          <p className="text-sm text-gray-600">
                            {anomaly.autoResolution.possible ? 'Available' : 'Not available'} • 
                            Risk Level: {anomaly.autoResolution.riskLevel}
                          </p>
                        </div>
                        {anomaly.autoResolution.possible && (
                          <Button variant="outline" size="sm" disabled>
                            Apply Auto-Fix
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              ))
            )}
          </div>
        </>
      )}

      {/* Patterns View */}
      {viewMode === 'patterns' && showPatterns && (
        <div className="space-y-4">
          {patterns.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="text-gray-500">
                <span className="text-4xl mb-4 block">🔍</span>
                <p className="text-lg font-medium mb-2">No patterns detected</p>
                <p>Not enough historical data to identify recurring patterns.</p>
              </div>
            </Card>
          ) : (
            patterns.map((pattern) => (
              <Card key={pattern.patternId} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">{pattern.name}</h3>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge className={getSeverityColor(pattern.severity)}>
                        {pattern.severity}
                      </Badge>
                      {pattern.isRecurring && (
                        <Badge className="bg-red-100 text-red-800 border-red-200">
                          Recurring
                        </Badge>
                      )}
                      <span className="text-sm text-gray-500">
                        {pattern.occurrences} occurrences
                      </span>
                    </div>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <p>First: {new Date(pattern.firstSeen).toLocaleDateString()}</p>
                    <p>Last: {new Date(pattern.lastSeen).toLocaleDateString()}</p>
                  </div>
                </div>

                <p className="text-gray-700 mb-4">{pattern.description}</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <h4 className="font-medium text-gray-800 mb-1">Frequency</h4>
                    <p className="text-gray-600">{pattern.frequency.toFixed(2)} per day</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-800 mb-1">Affected Sessions</h4>
                    <p className="text-gray-600">{pattern.affectedSessions.length} sessions</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-800 mb-1">Pattern ID</h4>
                    <p className="font-mono text-gray-600 text-xs">{pattern.patternId}</p>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Insights View */}
      {viewMode === 'insights' && insights && (
        <div className="space-y-6">
          {/* Trends */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Anomaly Trends</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <h4 className="font-medium text-red-800 mb-2">Increasing</h4>
                {insights.trends.increasing.length > 0 ? (
                  <ul className="space-y-1 text-sm text-red-700">
                    {insights.trends.increasing.map((trend, index) => (
                      <li key={index}>{trend}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-red-600">None detected</p>
                )}
              </div>
              
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-medium text-green-800 mb-2">Decreasing</h4>
                {insights.trends.decreasing.length > 0 ? (
                  <ul className="space-y-1 text-sm text-green-700">
                    {insights.trends.decreasing.map((trend, index) => (
                      <li key={index}>{trend}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-green-600">None detected</p>
                )}
              </div>
              
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-800 mb-2">Stable</h4>
                {insights.trends.stable.length > 0 ? (
                  <ul className="space-y-1 text-sm text-blue-700">
                    {insights.trends.stable.map((trend, index) => (
                      <li key={index}>{trend}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-blue-600">None detected</p>
                )}
              </div>
            </div>
          </Card>

          {/* Hotspots */}
          {insights.hotspots.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Anomaly Hotspots</h3>
              <div className="space-y-2">
                {insights.hotspots.slice(0, 5).map((hotspot, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <span className="font-medium text-gray-900">{hotspot.area}</span>
                      <Badge className={getSeverityColor(hotspot.severity)} size="sm">
                        {hotspot.severity}
                      </Badge>
                    </div>
                    <span className="text-sm font-medium text-gray-600">
                      {hotspot.anomalyCount} anomalies
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* System Recommendations */}
          {insights.recommendations.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">System Recommendations</h3>
              <ul className="space-y-2">
                {insights.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start text-sm text-gray-700">
                    <span className="text-blue-500 mr-2 mt-0.5">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};