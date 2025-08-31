/**
 * Analytics Module - Comprehensive Agent Performance Analytics
 * 
 * This module provides a complete analytics system for dual-agent monitoring,
 * including real-time metrics collection, performance analysis, and reporting.
 */

// Core Analytics Classes
export { PerformanceAnalyzer } from './PerformanceAnalyzer';
export { MetricsCollector } from './MetricsCollector';
export { AnalyticsService } from './AnalyticsService';
export { ReportGenerator } from './ReportGenerator';

// Performance Analysis Types
export type {
  AgentPerformanceData,
  SessionAnalytics,
  ComparisonAnalytics
} from './PerformanceAnalyzer';

// Metrics Collection Types
export type {
  CollectionConfig,
  RealTimeMetrics,
  AggregatedMetrics
} from './MetricsCollector';

// Analytics Service Types
export type {
  AnalyticsQuery,
  TrendData,
  AnalyticsDashboardData
} from './AnalyticsService';

// Report Generation Types
export type {
  ReportTemplate,
  GeneratedReport,
  ReportSection,
  ReportAttachment,
  ReportQuery
} from './ReportGenerator';

/**
 * Initialize and configure the complete analytics system
 */
import { AnalyticsService } from './AnalyticsService';
import { ReportGenerator } from './ReportGenerator';
import { MetricsCollector } from './MetricsCollector';
import { PerformanceAnalyzer } from './PerformanceAnalyzer';

export async function createAnalyticsSystem(dbService: any, config?: {
  enableRealTime?: boolean;
  metricsRetention?: number;
  flushInterval?: number;
  sampleRate?: number;
}): Promise<{
  analyticsService: AnalyticsService;
  reportGenerator: ReportGenerator;
  metricsCollector: MetricsCollector;
  performanceAnalyzer: PerformanceAnalyzer;
}> {
  // Initialize core components
  const performanceAnalyzer = new PerformanceAnalyzer();
  
  const metricsCollector = new MetricsCollector({
    enableRealTime: config?.enableRealTime ?? true,
    metricsRetention: config?.metricsRetention ?? 30,
    flushInterval: config?.flushInterval ?? 5000,
    sampleRate: config?.sampleRate ?? 1.0
  });

  const analyticsService = new AnalyticsService(dbService);
  const reportGenerator = new ReportGenerator(analyticsService);

  // Initialize services
  await analyticsService.initialize();

  return {
    analyticsService,
    reportGenerator,
    metricsCollector,
    performanceAnalyzer
  };
}

/**
 * Key Performance Metrics tracked by the system
 */
export const TRACKED_METRICS = {
  // Agent Performance
  RESPONSE_TIME: 'response_time',
  TOKEN_USAGE: 'token_usage',
  API_COST: 'api_cost',
  ERROR_RATE: 'error_rate',
  SUCCESS_RATE: 'success_rate',
  
  // Task Performance
  TASK_COMPLETION_RATE: 'task_completion_rate',
  QUALITY_SCORE: 'quality_score',
  TOOL_USAGE_EFFICIENCY: 'tool_usage_efficiency',
  
  // Communication Metrics
  COORDINATION_EFFICIENCY: 'coordination_efficiency',
  HANDOFF_FREQUENCY: 'handoff_frequency',
  COLLABORATION_SCORE: 'collaboration_score',
  
  // System Metrics
  THROUGHPUT: 'throughput',
  RESOURCE_UTILIZATION: 'resource_utilization',
  SESSION_DURATION: 'session_duration'
} as const;

/**
 * Alert thresholds for performance monitoring
 */
export const ALERT_THRESHOLDS = {
  HIGH_RESPONSE_TIME: 30000, // 30 seconds
  HIGH_ERROR_RATE: 0.15, // 15%
  HIGH_COST: 1.0, // $1.00 per 10 minutes
  LOW_SUCCESS_RATE: 0.70, // 70%
  LOW_COORDINATION: 0.30 // 30%
} as const;

/**
 * Utility functions for analytics calculations
 */
export const AnalyticsUtils = {
  /**
   * Calculate performance score from metrics
   */
  calculatePerformanceScore(metrics: {
    successRate: number;
    responseTime: number;
    errorRate: number;
  }): number {
    const successWeight = 0.5;
    const responseWeight = 0.3;
    const errorWeight = 0.2;
    
    const successScore = metrics.successRate * 100;
    const responseScore = Math.max(0, 100 - (metrics.responseTime / 1000));
    const errorScore = (1 - metrics.errorRate) * 100;
    
    return (
      successScore * successWeight +
      responseScore * responseWeight +
      errorScore * errorWeight
    );
  },

  /**
   * Calculate cost efficiency metric
   */
  calculateCostEfficiency(cost: number, successfulTasks: number): number {
    return successfulTasks > 0 ? cost / successfulTasks : 0;
  },

  /**
   * Determine trend direction from time series data
   */
  calculateTrend(values: number[]): 'up' | 'down' | 'stable' {
    if (values.length < 2) return 'stable';
    
    const first = values[0];
    const last = values[values.length - 1];
    const change = (last - first) / Math.abs(first);
    
    if (change > 0.05) return 'up';
    if (change < -0.05) return 'down';
    return 'stable';
  },

  /**
   * Format duration in milliseconds to human readable
   */
  formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  },

  /**
   * Format cost to currency string
   */
  formatCost(cost: number): string {
    return `$${cost.toFixed(4)}`;
  },

  /**
   * Calculate percentile from array of numbers
   */
  calculatePercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;
    
    if (upper >= sorted.length) return sorted[sorted.length - 1];
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }
};

/**
 * Export configuration constants
 */
export const ANALYTICS_CONFIG = {
  DEFAULT_RETENTION_DAYS: 30,
  DEFAULT_FLUSH_INTERVAL: 5000,
  DEFAULT_SAMPLE_RATE: 1.0,
  MAX_METRICS_BUFFER_SIZE: 1000,
  CLEANUP_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours
  
  REPORT_TEMPLATES: [
    'executive',
    'technical', 
    'comparison',
    'cost_optimization',
    'snapshot'
  ],
  
  CHART_TYPES: [
    'line',
    'bar', 
    'pie',
    'area',
    'scatter'
  ]
} as const;