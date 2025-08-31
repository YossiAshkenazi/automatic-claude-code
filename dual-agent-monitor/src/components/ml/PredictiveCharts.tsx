import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { LoadingSpinner } from '../ui/LoadingSpinner';

interface ForecastData {
  metric: string;
  historical: Array<{
    timestamp: Date;
    value: number;
    actual?: boolean;
  }>;
  predicted: Array<{
    timestamp: Date;
    value: number;
    confidence: number;
    range: { lower: number; upper: number };
  }>;
  seasonality: {
    detected: boolean;
    pattern: 'daily' | 'weekly' | 'monthly' | null;
    strength: number;
  };
  trend: {
    direction: 'increasing' | 'decreasing' | 'stable';
    strength: number;
    changeRate: number;
  };
}

interface ResourceForecast {
  forecastPeriod: string;
  predictions: {
    tokenUsage: ForecastData;
    cost: ForecastData;
    sessionCount: ForecastData;
    errorRate: ForecastData;
    averagePerformance: ForecastData;
  };
  recommendations: string[];
  budgetProjections: {
    conservative: number;
    expected: number;
    optimistic: number;
  };
}

interface TrendAnalysis {
  metric: string;
  timeRange: {
    start: Date;
    end: Date;
  };
  trend: {
    direction: 'up' | 'down' | 'stable';
    magnitude: number;
    significance: number;
    changePoints: Array<{
      timestamp: Date;
      beforeValue: number;
      afterValue: number;
      significance: number;
    }>;
  };
  forecast: {
    nextPeriod: number;
    confidence: number;
    scenarios: {
      best: number;
      expected: number;
      worst: number;
    };
  };
  insights: string[];
}

interface PredictiveChartsProps {
  className?: string;
  forecastDays?: number;
  autoRefresh?: boolean;
}

export const PredictiveCharts: React.FC<PredictiveChartsProps> = ({
  className = '',
  forecastDays = 7,
  autoRefresh = true
}) => {
  const [resourceForecast, setResourceForecast] = useState<ResourceForecast | null>(null);
  const [trends, setTrends] = useState<TrendAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<string>('cost');
  const [viewMode, setViewMode] = useState<'forecast' | 'trends'>('forecast');

  const availableMetrics = ['cost', 'tokenUsage', 'sessionCount', 'errorRate', 'averagePerformance'];
  const metricLabels = {
    cost: 'Cost ($)',
    tokenUsage: 'Token Usage',
    sessionCount: 'Session Count',
    errorRate: 'Error Rate (%)',
    averagePerformance: 'Performance Score'
  };

  useEffect(() => {
    loadPredictiveData();
    
    if (autoRefresh) {
      const interval = setInterval(loadPredictiveData, 3 * 60 * 1000); // 3 minutes
      return () => clearInterval(interval);
    }
  }, [forecastDays, autoRefresh]);

  const loadPredictiveData = async () => {
    try {
      setError(null);
      
      const [forecastResponse, trendsResponse] = await Promise.all([
        fetch(`/api/ml/forecast?days=${forecastDays}`),
        fetch('/api/ml/trends')
      ]);

      if (!forecastResponse.ok || !trendsResponse.ok) {
        throw new Error('Failed to load predictive data');
      }

      const [forecastData, trendsData] = await Promise.all([
        forecastResponse.json(),
        trendsResponse.json()
      ]);

      setResourceForecast(forecastData.forecast);
      setTrends(trendsData.trends || []);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load predictive data');
      console.error('Error loading predictive data:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatValue = (value: number, metric: string): string => {
    switch (metric) {
      case 'cost':
        return `$${value.toFixed(2)}`;
      case 'tokenUsage':
        return `${value.toFixed(0)}`;
      case 'sessionCount':
        return `${Math.round(value)}`;
      case 'errorRate':
        return `${(value * 100).toFixed(1)}%`;
      case 'averagePerformance':
        return `${value.toFixed(1)}`;
      default:
        return value.toFixed(2);
    }
  };

  const getTrendColor = (direction: string): string => {
    switch (direction) {
      case 'up':
      case 'increasing':
        return 'text-green-600';
      case 'down':
      case 'decreasing':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getTrendIcon = (direction: string): string => {
    switch (direction) {
      case 'up':
      case 'increasing':
        return '↗️';
      case 'down':
      case 'decreasing':
        return '↘️';
      default:
        return '➡️';
    }
  };

  const generateChartData = (forecastData: ForecastData) => {
    // Combine historical and predicted data for visualization
    const allData = [
      ...forecastData.historical.map(d => ({
        timestamp: new Date(d.timestamp).getTime(),
        value: d.value,
        type: 'historical' as const,
        confidence: 1
      })),
      ...forecastData.predicted.map(d => ({
        timestamp: new Date(d.timestamp).getTime(),
        value: d.value,
        type: 'predicted' as const,
        confidence: d.confidence,
        lower: d.range.lower,
        upper: d.range.upper
      }))
    ].sort((a, b) => a.timestamp - b.timestamp);

    return allData;
  };

  const SimpleChart: React.FC<{ data: ForecastData }> = ({ data }) => {
    const chartData = generateChartData(data);
    const maxValue = Math.max(...chartData.map(d => d.value));
    const minValue = Math.min(...chartData.map(d => d.value));
    const range = maxValue - minValue || 1;

    return (
      <div className="relative h-64 w-full bg-gray-50 rounded-lg p-4">
        <div className="absolute inset-4">
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500">
            <span>{formatValue(maxValue, selectedMetric)}</span>
            <span>{formatValue((maxValue + minValue) / 2, selectedMetric)}</span>
            <span>{formatValue(minValue, selectedMetric)}</span>
          </div>

          {/* Chart area */}
          <div className="ml-12 mr-4 h-full relative">
            {/* Historical line */}
            <svg className="absolute inset-0 w-full h-full">
              {chartData.map((point, index) => {
                if (index === 0) return null;
                const prevPoint = chartData[index - 1];
                
                const x1 = ((index - 1) / (chartData.length - 1)) * 100;
                const x2 = (index / (chartData.length - 1)) * 100;
                const y1 = ((maxValue - prevPoint.value) / range) * 100;
                const y2 = ((maxValue - point.value) / range) * 100;

                const isTransition = prevPoint.type !== point.type;
                const color = point.type === 'historical' ? '#3B82F6' : '#8B5CF6';
                const strokeWidth = point.type === 'predicted' ? 2 : 3;
                const strokeDasharray = point.type === 'predicted' ? '5,5' : 'none';

                return (
                  <line
                    key={index}
                    x1={`${x1}%`}
                    y1={`${y1}%`}
                    x2={`${x2}%`}
                    y2={`${y2}%`}
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={strokeDasharray}
                    opacity={isTransition ? 0.7 : 1}
                  />
                );
              })}

              {/* Data points */}
              {chartData.map((point, index) => {
                const x = (index / (chartData.length - 1)) * 100;
                const y = ((maxValue - point.value) / range) * 100;
                const color = point.type === 'historical' ? '#3B82F6' : '#8B5CF6';

                return (
                  <circle
                    key={index}
                    cx={`${x}%`}
                    cy={`${y}%`}
                    r="3"
                    fill={color}
                    opacity={point.type === 'predicted' ? 0.8 : 1}
                  >
                    <title>
                      {new Date(point.timestamp).toLocaleDateString()}: {formatValue(point.value, selectedMetric)}
                      {point.type === 'predicted' && ` (${(point.confidence * 100).toFixed(0)}% confidence)`}
                    </title>
                  </circle>
                );
              })}

              {/* Confidence bands for predictions */}
              {chartData.filter(d => d.type === 'predicted' && d.lower !== undefined).map((point, index, filteredData) => {
                if (index === 0) return null;
                const prevPoint = filteredData[index - 1];
                
                const baseIndex = chartData.findIndex(d => d.timestamp === point.timestamp);
                const prevBaseIndex = chartData.findIndex(d => d.timestamp === prevPoint.timestamp);
                
                const x1 = (prevBaseIndex / (chartData.length - 1)) * 100;
                const x2 = (baseIndex / (chartData.length - 1)) * 100;
                
                const y1Upper = ((maxValue - prevPoint.upper!) / range) * 100;
                const y1Lower = ((maxValue - prevPoint.lower!) / range) * 100;
                const y2Upper = ((maxValue - point.upper!) / range) * 100;
                const y2Lower = ((maxValue - point.lower!) / range) * 100;

                return (
                  <path
                    key={`band-${index}`}
                    d={`M ${x1}% ${y1Upper}% L ${x2}% ${y2Upper}% L ${x2}% ${y2Lower}% L ${x1}% ${y1Lower}% Z`}
                    fill="#8B5CF6"
                    opacity="0.2"
                  />
                );
              })}
            </svg>

            {/* Divider line between historical and predicted */}
            {chartData.some(d => d.type === 'predicted') && (
              <div 
                className="absolute top-0 bottom-0 w-0.5 bg-gray-300 opacity-50"
                style={{ 
                  left: `${(chartData.filter(d => d.type === 'historical').length / chartData.length) * 100}%` 
                }}
              />
            )}
          </div>

          {/* X-axis (simplified) */}
          <div className="absolute bottom-0 left-12 right-4 flex justify-between text-xs text-gray-500">
            {chartData.length > 0 && (
              <>
                <span>{new Date(chartData[0].timestamp).toLocaleDateString()}</span>
                <span>Today</span>
                <span>{new Date(chartData[chartData.length - 1].timestamp).toLocaleDateString()}</span>
              </>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="absolute top-2 right-2 flex space-x-4 text-xs">
          <div className="flex items-center">
            <div className="w-3 h-0.5 bg-blue-500 mr-1"></div>
            <span>Historical</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-0.5 bg-purple-500 mr-1 border-dashed border-t"></div>
            <span>Predicted</span>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
          <span className="ml-2">Loading predictive charts...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="text-center text-red-600">
          <p className="mb-4">Error loading predictive data: {error}</p>
          <Button onClick={loadPredictiveData} variant="outline">
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
          <h2 className="text-2xl font-bold text-gray-900">Predictive Analytics</h2>
          <p className="text-gray-600">Forecasting and trend analysis for optimization planning</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex rounded-md shadow-sm">
            <Button
              variant={viewMode === 'forecast' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('forecast')}
              className="rounded-r-none"
            >
              Forecast
            </Button>
            <Button
              variant={viewMode === 'trends' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('trends')}
              className="rounded-l-none"
            >
              Trends
            </Button>
          </div>
          <Button onClick={loadPredictiveData} variant="outline" size="sm">
            Refresh
          </Button>
        </div>
      </div>

      {/* Forecast View */}
      {viewMode === 'forecast' && resourceForecast && (
        <>
          {/* Budget Projections */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">
              Budget Projections ({resourceForecast.forecastPeriod})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-medium text-green-800">Optimistic</h4>
                <p className="text-2xl font-bold text-green-900">
                  ${resourceForecast.budgetProjections.optimistic.toFixed(2)}
                </p>
                <p className="text-sm text-green-700">Best case scenario</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-800">Expected</h4>
                <p className="text-2xl font-bold text-blue-900">
                  ${resourceForecast.budgetProjections.expected.toFixed(2)}
                </p>
                <p className="text-sm text-blue-700">Most likely outcome</p>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                <h4 className="font-medium text-orange-800">Conservative</h4>
                <p className="text-2xl font-bold text-orange-900">
                  ${resourceForecast.budgetProjections.conservative.toFixed(2)}
                </p>
                <p className="text-sm text-orange-700">Worst case scenario</p>
              </div>
            </div>
          </Card>

          {/* Metric Selector */}
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <label className="text-sm font-medium text-gray-700">View Metric:</label>
              <div className="flex flex-wrap gap-2">
                {availableMetrics.map(metric => (
                  <Button
                    key={metric}
                    variant={selectedMetric === metric ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedMetric(metric)}
                  >
                    {metricLabels[metric as keyof typeof metricLabels]}
                  </Button>
                ))}
              </div>
            </div>
          </Card>

          {/* Main Forecast Chart */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {metricLabels[selectedMetric as keyof typeof metricLabels]} Forecast
              </h3>
              {resourceForecast.predictions[selectedMetric as keyof typeof resourceForecast.predictions] && (
                <div className="flex items-center space-x-4 text-sm">
                  {resourceForecast.predictions[selectedMetric as keyof typeof resourceForecast.predictions].seasonality.detected && (
                    <Badge variant="outline">
                      {resourceForecast.predictions[selectedMetric as keyof typeof resourceForecast.predictions].seasonality.pattern} pattern
                    </Badge>
                  )}
                  <span className={getTrendColor(resourceForecast.predictions[selectedMetric as keyof typeof resourceForecast.predictions].trend.direction)}>
                    {getTrendIcon(resourceForecast.predictions[selectedMetric as keyof typeof resourceForecast.predictions].trend.direction)} {resourceForecast.predictions[selectedMetric as keyof typeof resourceForecast.predictions].trend.direction}
                  </span>
                </div>
              )}
            </div>

            {resourceForecast.predictions[selectedMetric as keyof typeof resourceForecast.predictions] ? (
              <SimpleChart data={resourceForecast.predictions[selectedMetric as keyof typeof resourceForecast.predictions]} />
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                No forecast data available for this metric
              </div>
            )}
          </Card>

          {/* Forecast Recommendations */}
          {resourceForecast.recommendations.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Forecast-Based Recommendations</h3>
              <ul className="space-y-2">
                {resourceForecast.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start text-sm text-gray-700">
                    <span className="text-blue-500 mr-2 mt-0.5">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      {/* Trends View */}
      {viewMode === 'trends' && (
        <div className="space-y-4">
          {trends.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="text-gray-500">
                <span className="text-4xl mb-4 block">📊</span>
                <p className="text-lg font-medium mb-2">No trend data available</p>
                <p>Wait for more historical data to be analyzed.</p>
              </div>
            </Card>
          ) : (
            trends.map((trend, index) => (
              <Card key={index} className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold capitalize">{trend.metric} Trend</h3>
                  <div className="flex items-center space-x-2">
                    <Badge 
                      className={
                        trend.trend.direction === 'up' ? 'bg-green-100 text-green-800' :
                        trend.trend.direction === 'down' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }
                    >
                      {getTrendIcon(trend.trend.direction)} {trend.trend.direction}
                    </Badge>
                    <span className="text-sm text-gray-500">
                      Significance: {(trend.trend.significance * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-800">Current Trend</h4>
                    <p className="text-lg font-bold text-blue-900">
                      {trend.trend.magnitude > 0 ? '+' : ''}{(trend.trend.magnitude * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <h4 className="font-medium text-purple-800">Next Period Forecast</h4>
                    <p className="text-lg font-bold text-purple-900">
                      {formatValue(trend.forecast.nextPeriod, trend.metric)}
                    </p>
                    <p className="text-xs text-purple-700">
                      {(trend.forecast.confidence * 100).toFixed(0)}% confidence
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-800">Scenario Range</h4>
                    <div className="text-sm text-gray-700">
                      <p>Best: {formatValue(trend.forecast.scenarios.best, trend.metric)}</p>
                      <p>Worst: {formatValue(trend.forecast.scenarios.worst, trend.metric)}</p>
                    </div>
                  </div>
                </div>

                {/* Change Points */}
                {trend.trend.changePoints.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-800 mb-2">Significant Changes</h4>
                    <div className="space-y-2">
                      {trend.trend.changePoints.slice(0, 3).map((change, changeIndex) => (
                        <div key={changeIndex} className="flex items-center justify-between p-2 bg-yellow-50 rounded text-sm">
                          <span>{new Date(change.timestamp).toLocaleDateString()}</span>
                          <span>
                            {formatValue(change.beforeValue, trend.metric)} → {formatValue(change.afterValue, trend.metric)}
                          </span>
                          <Badge variant="outline" size="sm">
                            {(change.significance * 100).toFixed(0)}% significant
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Insights */}
                {trend.insights.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-800 mb-2">Key Insights</h4>
                    <ul className="space-y-1">
                      {trend.insights.map((insight, insightIndex) => (
                        <li key={insightIndex} className="flex items-start text-sm text-gray-700">
                          <span className="text-blue-500 mr-2">•</span>
                          <span>{insight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
};