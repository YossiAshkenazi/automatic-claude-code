import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface MLInsight {
  id: string;
  type: 'performance' | 'cost' | 'pattern' | 'trend' | 'anomaly';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  data: any;
  suggestions: string[];
  timestamp: Date;
}

interface PatternAnalysis {
  collaborationPatterns: {
    optimalExchangeRate: number;
    averageHandoffTime: number;
    mostEffectivePatterns: Array<{
      pattern: string;
      successRate: number;
      examples: string[];
    }>;
  };
  workDistribution: {
    managerTaskTypes: Record<string, number>;
    workerTaskTypes: Record<string, number>;
    optimalBalance: Record<string, number>;
  };
  temporalPatterns: {
    peakPerformanceHours: number[];
    seasonalTrends: Array<{
      period: string;
      performance: number;
      cost: number;
    }>;
  };
}

interface PerformanceClusters {
  highPerformers: {
    sessions: string[];
    characteristics: Record<string, any>;
    avgScore: number;
  };
  averagePerformers: {
    sessions: string[];
    characteristics: Record<string, any>;
    avgScore: number;
  };
  underPerformers: {
    sessions: string[];
    characteristics: Record<string, any>;
    avgScore: number;
    improvementAreas: string[];
  };
}

interface InsightsDashboardProps {
  className?: string;
  refreshInterval?: number;
}

export const InsightsDashboard: React.FC<InsightsDashboardProps> = ({
  className = '',
  refreshInterval = 60000 // 1 minute
}) => {
  const [insights, setInsights] = useState<MLInsight[]>([]);
  const [patterns, setPatterns] = useState<PatternAnalysis | null>(null);
  const [clusters, setClusters] = useState<PerformanceClusters | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInsightType, setSelectedInsightType] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');

  const insightTypes = ['all', 'performance', 'cost', 'pattern', 'trend', 'anomaly'];
  const severityLevels = ['all', 'critical', 'high', 'medium', 'low'];

  useEffect(() => {
    loadInsights();
    const interval = setInterval(loadInsights, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const loadInsights = async () => {
    try {
      setError(null);
      
      // Load ML insights
      const insightsResponse = await fetch('/api/ml/insights');
      if (!insightsResponse.ok) throw new Error('Failed to load insights');
      const insightsData = await insightsResponse.json();
      
      setInsights(insightsData.insights || []);
      setPatterns(insightsData.patterns || null);
      setClusters(insightsData.clusters || null);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ML insights');
      console.error('Error loading insights:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredInsights = insights.filter(insight => {
    if (selectedInsightType !== 'all' && insight.type !== selectedInsightType) {
      return false;
    }
    if (selectedSeverity !== 'all' && insight.severity !== selectedSeverity) {
      return false;
    }
    return true;
  });

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'performance': return 'bg-green-100 text-green-800 border-green-200';
      case 'cost': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'pattern': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'trend': return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'anomaly': return 'bg-pink-100 text-pink-800 border-pink-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatTimestamp = (timestamp: Date | string): string => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    return date.toLocaleString();
  };

  const getConfidenceIcon = (confidence: number): string => {
    if (confidence >= 0.8) return '🎯'; // High confidence
    if (confidence >= 0.6) return '📊'; // Medium confidence
    return '📈'; // Lower confidence
  };

  if (loading) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
          <span className="ml-2">Loading ML insights...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="text-center text-red-600">
          <p className="mb-4">Error loading ML insights: {error}</p>
          <Button onClick={loadInsights} variant="outline">
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
          <h2 className="text-2xl font-bold text-gray-900">ML Insights Dashboard</h2>
          <p className="text-gray-600">AI-powered analysis and optimization recommendations</p>
        </div>
        <Button onClick={loadInsights} variant="outline" size="sm">
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <span className="text-blue-600 text-xl">🧠</span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total Insights</p>
              <p className="text-2xl font-bold text-gray-900">{insights.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <span className="text-red-600 text-xl">⚠️</span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Critical Issues</p>
              <p className="text-2xl font-bold text-gray-900">
                {insights.filter(i => i.severity === 'critical').length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <span className="text-green-600 text-xl">📈</span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Opportunities</p>
              <p className="text-2xl font-bold text-gray-900">
                {insights.filter(i => i.type === 'pattern' || i.type === 'trend').length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <span className="text-purple-600 text-xl">💰</span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Cost Insights</p>
              <p className="text-2xl font-bold text-gray-900">
                {insights.filter(i => i.type === 'cost').length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Performance Clusters Overview */}
      {clusters && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Performance Clusters</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <h4 className="font-medium text-green-800">High Performers</h4>
              <p className="text-2xl font-bold text-green-900">{clusters.highPerformers.sessions.length}</p>
              <p className="text-sm text-green-700">Avg Score: {clusters.highPerformers.avgScore.toFixed(1)}</p>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <h4 className="font-medium text-yellow-800">Average Performers</h4>
              <p className="text-2xl font-bold text-yellow-900">{clusters.averagePerformers.sessions.length}</p>
              <p className="text-sm text-yellow-700">Avg Score: {clusters.averagePerformers.avgScore.toFixed(1)}</p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <h4 className="font-medium text-red-800">Underperformers</h4>
              <p className="text-2xl font-bold text-red-900">{clusters.underPerformers.sessions.length}</p>
              <p className="text-sm text-red-700">Avg Score: {clusters.underPerformers.avgScore.toFixed(1)}</p>
              {clusters.underPerformers.improvementAreas.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-red-800">Improvement Areas:</p>
                  <p className="text-xs text-red-700">
                    {clusters.underPerformers.improvementAreas.slice(0, 2).join(', ')}
                    {clusters.underPerformers.improvementAreas.length > 2 && '...'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Collaboration Patterns */}
      {patterns && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Collaboration Patterns</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-800">Optimal Exchange Rate</h4>
              <p className="text-xl font-bold text-blue-900">
                {patterns.collaborationPatterns.optimalExchangeRate.toFixed(1)} per session
              </p>
            </div>
            <div className="p-4 bg-indigo-50 rounded-lg">
              <h4 className="font-medium text-indigo-800">Avg Handoff Time</h4>
              <p className="text-xl font-bold text-indigo-900">
                {(patterns.collaborationPatterns.averageHandoffTime / 1000).toFixed(1)}s
              </p>
            </div>
            <div className="p-4 bg-teal-50 rounded-lg">
              <h4 className="font-medium text-teal-800">Peak Hours</h4>
              <p className="text-xl font-bold text-teal-900">
                {patterns.temporalPatterns.peakPerformanceHours.slice(0, 3).join(', ')}
              </p>
            </div>
          </div>

          {patterns.collaborationPatterns.mostEffectivePatterns.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium text-gray-800 mb-2">Most Effective Patterns</h4>
              <div className="space-y-2">
                {patterns.collaborationPatterns.mostEffectivePatterns.slice(0, 3).map((pattern, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <span className="font-mono text-sm">{pattern.pattern}</span>
                      <p className="text-xs text-gray-600">
                        Success Rate: {(pattern.successRate * 100).toFixed(1)}%
                      </p>
                    </div>
                    <Badge variant="outline">
                      {pattern.examples.length} examples
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Type:</label>
            <select
              value={selectedInsightType}
              onChange={(e) => setSelectedInsightType(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {insightTypes.map(type => (
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

          <div className="text-sm text-gray-600">
            Showing {filteredInsights.length} of {insights.length} insights
          </div>
        </div>
      </Card>

      {/* Insights List */}
      <div className="space-y-4">
        {filteredInsights.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="text-gray-500">
              <span className="text-4xl mb-4 block">🔍</span>
              <p className="text-lg font-medium mb-2">No insights found</p>
              <p>Try adjusting your filters or wait for more data to be analyzed.</p>
            </div>
          </Card>
        ) : (
          filteredInsights.map((insight) => (
            <Card key={insight.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{getConfidenceIcon(insight.confidence)}</span>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">{insight.title}</h3>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge className={getTypeColor(insight.type)}>
                        {insight.type}
                      </Badge>
                      <Badge className={getSeverityColor(insight.severity)}>
                        {insight.severity}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        Confidence: {(insight.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right text-sm text-gray-500">
                  {formatTimestamp(insight.timestamp)}
                </div>
              </div>

              <p className="text-gray-700 mb-4">{insight.description}</p>

              {/* Data Points */}
              {insight.data && Object.keys(insight.data).length > 0 && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-800 mb-2">Key Data Points</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
                    {Object.entries(insight.data).slice(0, 6).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                        <span className="font-mono text-gray-900">
                          {typeof value === 'number' 
                            ? value.toFixed(2) 
                            : String(value).length > 20 
                              ? String(value).substring(0, 20) + '...' 
                              : String(value)
                          }
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {insight.suggestions && insight.suggestions.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-medium text-gray-800 mb-2">Recommendations</h4>
                  <ul className="space-y-1">
                    {insight.suggestions.slice(0, 3).map((suggestion, index) => (
                      <li key={index} className="flex items-start text-sm text-gray-700">
                        <span className="text-blue-500 mr-2">•</span>
                        <span>{suggestion}</span>
                      </li>
                    ))}
                    {insight.suggestions.length > 3 && (
                      <li className="text-sm text-gray-500 ml-4">
                        +{insight.suggestions.length - 3} more recommendations
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Auto-refresh indicator */}
      <div className="text-center text-xs text-gray-500">
        Auto-refreshing every {Math.floor(refreshInterval / 1000)} seconds
      </div>
    </div>
  );
};