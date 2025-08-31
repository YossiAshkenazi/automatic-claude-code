import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { LoadingSpinner } from '../ui/LoadingSpinner';

interface OptimizationRecommendation {
  id: string;
  category: 'performance' | 'cost' | 'efficiency' | 'quality' | 'reliability';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  expectedImpact: {
    performance?: number;
    costSavings?: number;
    timeReduction?: number;
    errorReduction?: number;
  };
  implementation: {
    difficulty: 'easy' | 'moderate' | 'hard';
    estimatedTime: number;
    steps: string[];
    requiredChanges: string[];
  };
  evidence: {
    dataPoints: any[];
    confidence: number;
    affectedSessions: string[];
  };
  monitoring: {
    metrics: string[];
    successCriteria: string[];
    timeframe: string;
  };
  timestamp: Date;
}

interface OptimizationStrategy {
  name: string;
  description: string;
  targetArea: string;
  recommendations: OptimizationRecommendation[];
  combinedImpact: {
    totalPerformanceGain: number;
    totalCostSavings: number;
    implementationEffort: number;
  };
}

interface ResourceOptimization {
  currentUsage: {
    avgTokensPerSession: number;
    avgCostPerSession: number;
    avgDuration: number;
    avgToolCalls: number;
  };
  optimizedUsage: {
    projectedTokens: number;
    projectedCost: number;
    projectedDuration: number;
    projectedToolCalls: number;
  };
  optimizations: {
    tokenOptimization: number;
    costOptimization: number;
    timeOptimization: number;
    efficiencyGain: number;
  };
}

interface OptimizationRecommendationsProps {
  className?: string;
  autoRefresh?: boolean;
}

export const OptimizationRecommendations: React.FC<OptimizationRecommendationsProps> = ({
  className = '',
  autoRefresh = true
}) => {
  const [recommendations, setRecommendations] = useState<OptimizationRecommendation[]>([]);
  const [strategies, setStrategies] = useState<OptimizationStrategy[]>([]);
  const [resourceOptimization, setResourceOptimization] = useState<ResourceOptimization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [expandedRec, setExpandedRec] = useState<string | null>(null);

  const categories = ['all', 'performance', 'cost', 'efficiency', 'quality', 'reliability'];
  const priorities = ['all', 'critical', 'high', 'medium', 'low'];
  const difficulties = ['all', 'easy', 'moderate', 'hard'];

  useEffect(() => {
    loadOptimizations();
    
    if (autoRefresh) {
      const interval = setInterval(loadOptimizations, 2 * 60 * 1000); // 2 minutes
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const loadOptimizations = async () => {
    try {
      setError(null);
      
      const [recsResponse, strategiesResponse, resourceResponse] = await Promise.all([
        fetch('/api/ml/recommendations'),
        fetch('/api/ml/strategies'),
        fetch('/api/ml/resource-optimization')
      ]);

      if (!recsResponse.ok || !strategiesResponse.ok || !resourceResponse.ok) {
        throw new Error('Failed to load optimization data');
      }

      const [recsData, strategiesData, resourceData] = await Promise.all([
        recsResponse.json(),
        strategiesResponse.json(),
        resourceResponse.json()
      ]);

      setRecommendations(recsData.recommendations || []);
      setStrategies(strategiesData.strategies || []);
      setResourceOptimization(resourceData.resourceOptimization || null);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load optimization recommendations');
      console.error('Error loading optimizations:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredRecommendations = recommendations.filter(rec => {
    if (selectedCategory !== 'all' && rec.category !== selectedCategory) return false;
    if (selectedPriority !== 'all' && rec.priority !== selectedPriority) return false;
    if (selectedDifficulty !== 'all' && rec.implementation.difficulty !== selectedDifficulty) return false;
    return true;
  });

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'performance': return 'bg-green-100 text-green-800 border-green-200';
      case 'cost': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'efficiency': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'quality': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'reliability': return 'bg-teal-100 text-teal-800 border-teal-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getDifficultyIcon = (difficulty: string): string => {
    switch (difficulty) {
      case 'easy': return '🟢';
      case 'moderate': return '🟡';
      case 'hard': return '🔴';
      default: return '⚪';
    }
  };

  const formatImpact = (impact: OptimizationRecommendation['expectedImpact']): string => {
    const impacts: string[] = [];
    
    if (impact.performance) impacts.push(`+${impact.performance}% performance`);
    if (impact.costSavings) impacts.push(`$${impact.costSavings.toFixed(2)} savings`);
    if (impact.timeReduction) impacts.push(`-${impact.timeReduction}min time`);
    if (impact.errorReduction) impacts.push(`-${impact.errorReduction}% errors`);
    
    return impacts.length > 0 ? impacts.join(', ') : 'Various benefits';
  };

  const toggleExpansion = (recId: string) => {
    setExpandedRec(expandedRec === recId ? null : recId);
  };

  if (loading) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
          <span className="ml-2">Loading optimization recommendations...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="text-center text-red-600">
          <p className="mb-4">Error loading recommendations: {error}</p>
          <Button onClick={loadOptimizations} variant="outline">
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
          <h2 className="text-2xl font-bold text-gray-900">Optimization Recommendations</h2>
          <p className="text-gray-600">AI-generated actionable optimization strategies</p>
        </div>
        <Button onClick={loadOptimizations} variant="outline" size="sm">
          Refresh
        </Button>
      </div>

      {/* Resource Optimization Summary */}
      {resourceOptimization && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Resource Optimization Projection</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-800">Token Usage</h4>
              <div className="text-sm text-blue-600 mt-1">
                <p>Current: {resourceOptimization.currentUsage.avgTokensPerSession.toFixed(0)}</p>
                <p>Optimized: {resourceOptimization.optimizedUsage.projectedTokens.toFixed(0)}</p>
                <p className="font-semibold text-green-600">
                  {(resourceOptimization.optimizations.tokenOptimization * 100).toFixed(0)}% reduction
                </p>
              </div>
            </div>

            <div className="p-4 bg-purple-50 rounded-lg">
              <h4 className="font-medium text-purple-800">Cost per Session</h4>
              <div className="text-sm text-purple-600 mt-1">
                <p>Current: ${resourceOptimization.currentUsage.avgCostPerSession.toFixed(2)}</p>
                <p>Optimized: ${resourceOptimization.optimizedUsage.projectedCost.toFixed(2)}</p>
                <p className="font-semibold text-green-600">
                  {(resourceOptimization.optimizations.costOptimization * 100).toFixed(0)}% reduction
                </p>
              </div>
            </div>

            <div className="p-4 bg-green-50 rounded-lg">
              <h4 className="font-medium text-green-800">Duration</h4>
              <div className="text-sm text-green-600 mt-1">
                <p>Current: {(resourceOptimization.currentUsage.avgDuration / 60000).toFixed(1)}min</p>
                <p>Optimized: {(resourceOptimization.optimizedUsage.projectedDuration / 60000).toFixed(1)}min</p>
                <p className="font-semibold text-green-600">
                  {(resourceOptimization.optimizations.timeOptimization * 100).toFixed(0)}% reduction
                </p>
              </div>
            </div>

            <div className="p-4 bg-orange-50 rounded-lg">
              <h4 className="font-medium text-orange-800">Efficiency Gain</h4>
              <div className="text-sm text-orange-600 mt-1">
                <p>Tool Calls: {resourceOptimization.currentUsage.avgToolCalls.toFixed(1)}</p>
                <p>Optimized: {resourceOptimization.optimizedUsage.projectedToolCalls.toFixed(1)}</p>
                <p className="font-semibold text-green-600">
                  +{(resourceOptimization.optimizations.efficiencyGain * 100).toFixed(0)}% efficiency
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Optimization Strategies */}
      {strategies.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Recommended Strategies</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {strategies.slice(0, 4).map((strategy, index) => (
              <div key={index} className="p-4 border rounded-lg bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">{strategy.name}</h4>
                  <Badge variant="outline">{strategy.targetArea}</Badge>
                </div>
                <p className="text-sm text-gray-600 mb-3">{strategy.description}</p>
                
                <div className="space-y-1 text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span>Performance Gain:</span>
                    <span className="font-semibold text-green-600">
                      +{strategy.combinedImpact.totalPerformanceGain.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cost Savings:</span>
                    <span className="font-semibold text-purple-600">
                      ${strategy.combinedImpact.totalCostSavings.toFixed(0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Implementation Effort:</span>
                    <span className="font-semibold text-orange-600">
                      {strategy.combinedImpact.implementationEffort.toFixed(0)}h
                    </span>
                  </div>
                </div>
                
                <div className="mt-3">
                  <Badge variant="outline" size="sm">
                    {strategy.recommendations.length} recommendation{strategy.recommendations.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Category:</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Priority:</label>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {priorities.map(priority => (
                <option key={priority} value={priority}>
                  {priority.charAt(0).toUpperCase() + priority.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Difficulty:</label>
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {difficulties.map(diff => (
                <option key={diff} value={diff}>
                  {diff.charAt(0).toUpperCase() + diff.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="text-sm text-gray-600">
            Showing {filteredRecommendations.length} of {recommendations.length} recommendations
          </div>
        </div>
      </Card>

      {/* Recommendations List */}
      <div className="space-y-4">
        {filteredRecommendations.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="text-gray-500">
              <span className="text-4xl mb-4 block">🎯</span>
              <p className="text-lg font-medium mb-2">No recommendations found</p>
              <p>Try adjusting your filters or wait for more optimization analysis.</p>
            </div>
          </Card>
        ) : (
          filteredRecommendations.map((rec) => (
            <Card key={rec.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{getDifficultyIcon(rec.implementation.difficulty)}</span>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">{rec.title}</h3>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge className={getCategoryColor(rec.category)}>
                        {rec.category}
                      </Badge>
                      <Badge className={getPriorityColor(rec.priority)}>
                        {rec.priority} priority
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {rec.implementation.difficulty} • {rec.implementation.estimatedTime}h
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleExpansion(rec.id)}
                  className="text-blue-600"
                >
                  {expandedRec === rec.id ? 'Less' : 'More'}
                </Button>
              </div>

              <p className="text-gray-700 mb-4">{rec.description}</p>

              {/* Expected Impact */}
              <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-medium text-green-800 mb-2">Expected Impact</h4>
                <p className="text-sm text-green-700">{formatImpact(rec.expectedImpact)}</p>
                <div className="mt-2 text-xs text-green-600">
                  Confidence: {(rec.evidence.confidence * 100).toFixed(0)}% • 
                  Affects {rec.evidence.affectedSessions.length} sessions
                </div>
              </div>

              {/* Expanded Details */}
              {expandedRec === rec.id && (
                <div className="space-y-4 border-t pt-4">
                  {/* Implementation Steps */}
                  <div>
                    <h4 className="font-medium text-gray-800 mb-2">Implementation Steps</h4>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
                      {rec.implementation.steps.map((step, index) => (
                        <li key={index}>{step}</li>
                      ))}
                    </ol>
                  </div>

                  {/* Required Changes */}
                  {rec.implementation.requiredChanges.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-800 mb-2">Required Changes</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                        {rec.implementation.requiredChanges.map((change, index) => (
                          <li key={index}>{change}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Success Criteria */}
                  <div>
                    <h4 className="font-medium text-gray-800 mb-2">Success Criteria</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                      {rec.monitoring.successCriteria.map((criteria, index) => (
                        <li key={index}>{criteria}</li>
                      ))}
                    </ul>
                    <p className="text-xs text-gray-600 mt-2">
                      Monitor for: {rec.monitoring.timeframe}
                    </p>
                  </div>

                  {/* Monitoring Metrics */}
                  <div>
                    <h4 className="font-medium text-gray-800 mb-2">Key Metrics to Monitor</h4>
                    <div className="flex flex-wrap gap-2">
                      {rec.monitoring.metrics.map((metric, index) => (
                        <Badge key={index} variant="outline" size="sm">
                          {metric}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Evidence Data Points */}
                  {rec.evidence.dataPoints.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-800 mb-2">Supporting Evidence</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        {rec.evidence.dataPoints.slice(0, 4).map((point, index) => (
                          <div key={index} className="flex justify-between p-2 bg-gray-50 rounded">
                            <span className="text-gray-600 capitalize">{point.metric || `Data ${index + 1}`}:</span>
                            <span className="font-mono text-gray-900">
                              {typeof point.value === 'number' 
                                ? point.value.toFixed(2) 
                                : String(point.value)
                              }
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between text-xs text-gray-500 mt-4 pt-4 border-t">
                <span>Generated: {new Date(rec.timestamp).toLocaleString()}</span>
                <div className="space-x-4">
                  <span>Confidence: {(rec.evidence.confidence * 100).toFixed(0)}%</span>
                  <span>Sessions: {rec.evidence.affectedSessions.length}</span>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Summary Stats */}
      <Card className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-blue-600">{recommendations.length}</p>
            <p className="text-sm text-gray-600">Total Recommendations</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">
              {recommendations.filter(r => r.priority === 'critical').length}
            </p>
            <p className="text-sm text-gray-600">Critical Priority</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">
              {recommendations.filter(r => r.implementation.difficulty === 'easy').length}
            </p>
            <p className="text-sm text-gray-600">Easy to Implement</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-purple-600">
              ${recommendations.reduce((sum, r) => sum + (r.expectedImpact.costSavings || 0), 0).toFixed(0)}
            </p>
            <p className="text-sm text-gray-600">Total Savings Potential</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-orange-600">
              {recommendations.reduce((sum, r) => sum + r.implementation.estimatedTime, 0)}h
            </p>
            <p className="text-sm text-gray-600">Total Implementation Time</p>
          </div>
        </div>
      </Card>
    </div>
  );
};