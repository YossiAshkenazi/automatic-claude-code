import { PerformanceAnalyzer, SessionAnalytics, ComparisonAnalytics } from './PerformanceAnalyzer.js';
import { MetricsCollector, RealTimeMetrics, AggregatedMetrics } from './MetricsCollector.js';
import { AgentMessage, DualAgentSession, PerformanceMetrics, AgentCommunication } from '../types.js';
import { DatabaseService } from '../database/DatabaseService.js';
import { InMemoryDatabaseService } from '../database/InMemoryDatabaseService.js';

export interface AnalyticsQuery {
  sessionIds?: string[];
  agentType?: 'manager' | 'worker';
  timeRange?: {
    start: Date;
    end: Date;
  };
  aggregation?: 'minute' | 'hour' | 'day';
  includeRealTime?: boolean;
}

export interface TrendData {
  timestamp: Date;
  value: number;
  label: string;
}

export interface AnalyticsDashboardData {
  overview: {
    totalSessions: number;
    activeSessions: number;
    avgPerformance: number;
    totalCost: number;
    errorRate: number;
  };
  performanceTrends: {
    manager: TrendData[];
    worker: TrendData[];
    coordination: TrendData[];
  };
  realTimeMetrics: RealTimeMetrics[];
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

export class AnalyticsService {
  private analyzer: PerformanceAnalyzer;
  private collector: MetricsCollector;
  private dbService: DatabaseService | InMemoryDatabaseService;
  private realTimeSubscribers = new Set<(data: RealTimeMetrics) => void>();

  constructor(dbService: DatabaseService | InMemoryDatabaseService) {
    this.dbService = dbService;
    this.analyzer = new PerformanceAnalyzer();
    this.collector = new MetricsCollector({
      enableRealTime: true,
      flushInterval: 5000,
      sampleRate: 1.0
    });

    // Subscribe to real-time metrics
    this.collector.subscribe(this.handleRealTimeMetrics.bind(this));
  }

  /**
   * Initialize analytics service
   */
  async initialize(): Promise<void> {
    console.log('Initializing Analytics Service...');
    
    // Start metrics collection
    this.collector.startCollection();
    
    // Set up periodic cleanup
    setInterval(() => {
      this.collector.cleanupOldMetrics();
      this.analyzer.clearCache();
    }, 24 * 60 * 60 * 1000); // Daily cleanup

    console.log('Analytics Service initialized');
  }

  /**
   * Analyze session performance
   */
  async analyzeSession(sessionId: string): Promise<SessionAnalytics> {
    try {
      const session = await this.dbService.getSession(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      const communications = await this.dbService.getSessionCommunications(sessionId);
      const metrics = await this.dbService.getSessionMetrics(sessionId);

      return await this.analyzer.analyzeSession(session, communications, metrics);
    } catch (error) {
      console.error('Error analyzing session:', error);
      throw error;
    }
  }

  /**
   * Compare performance across multiple sessions
   */
  async compareSessionPerformance(sessionIds: string[]): Promise<ComparisonAnalytics> {
    try {
      const sessions: DualAgentSession[] = [];
      
      for (const sessionId of sessionIds) {
        const session = await this.dbService.getSession(sessionId);
        if (session) {
          sessions.push(session);
        }
      }

      if (sessions.length === 0) {
        throw new Error('No valid sessions found for comparison');
      }

      return await this.analyzer.comparePerformance(sessions);
    } catch (error) {
      console.error('Error comparing sessions:', error);
      throw error;
    }
  }

  /**
   * Get analytics dashboard data
   */
  async getDashboardData(query: AnalyticsQuery = {}): Promise<AnalyticsDashboardData> {
    try {
      const sessions = await this.getSessionsForQuery(query);
      const recentMessages = await this.getRecentMessages(query);
      const recentMetrics = await this.getRecentMetrics(query);

      const overview = await this.calculateOverview(sessions);
      const trends = await this.calculatePerformanceTrends(sessions, query.aggregation || 'hour');
      const topSessions = await this.getTopPerformingSessions(sessions);
      const insights = this.analyzer.getRealTimeInsights(recentMessages, recentMetrics);

      return {
        overview,
        performanceTrends: trends,
        realTimeMetrics: query.includeRealTime ? this.collector.exportMetrics() : [],
        topSessions,
        alerts: insights.alerts.map(alert => ({
          ...alert,
          timestamp: new Date()
        })),
        recommendations: insights.recommendations
      };
    } catch (error) {
      console.error('Error getting dashboard data:', error);
      throw error;
    }
  }

  /**
   * Get performance trends for specific time range
   */
  async getPerformanceTrends(
    sessionIds: string[],
    timeRange: { start: Date; end: Date },
    granularity: 'minute' | 'hour' | 'day' = 'hour'
  ): Promise<{
    responseTime: TrendData[];
    errorRate: TrendData[];
    cost: TrendData[];
    throughput: TrendData[];
  }> {
    const trends = {
      responseTime: [] as TrendData[],
      errorRate: [] as TrendData[],
      cost: [] as TrendData[],
      throughput: [] as TrendData[]
    };

    const timeWindows = this.generateTimeWindows(timeRange, granularity);

    for (const window of timeWindows) {
      const windowMetrics = await this.getMetricsForTimeWindow(sessionIds, window);
      
      trends.responseTime.push({
        timestamp: window.start,
        value: this.calculateAverageResponseTime(windowMetrics),
        label: this.formatTimeLabel(window.start, granularity)
      });

      trends.errorRate.push({
        timestamp: window.start,
        value: this.calculateErrorRate(windowMetrics),
        label: this.formatTimeLabel(window.start, granularity)
      });

      trends.cost.push({
        timestamp: window.start,
        value: this.calculateTotalCost(windowMetrics),
        label: this.formatTimeLabel(window.start, granularity)
      });

      trends.throughput.push({
        timestamp: window.start,
        value: this.calculateThroughput(windowMetrics, window),
        label: this.formatTimeLabel(window.start, granularity)
      });
    }

    return trends;
  }

  /**
   * Get real-time performance metrics
   */
  getRealTimeMetrics(): RealTimeMetrics[] {
    return this.collector.exportMetrics();
  }

  /**
   * Subscribe to real-time metrics updates
   */
  subscribeToRealTime(callback: (metrics: RealTimeMetrics) => void): () => void {
    this.realTimeSubscribers.add(callback);
    
    return () => {
      this.realTimeSubscribers.delete(callback);
    };
  }

  /**
   * Collect metrics from agent message
   */
  async collectMetricsFromMessage(message: AgentMessage, session: DualAgentSession): Promise<void> {
    this.collector.collectFromMessage(message, session);

    // Also store in database
    const performanceMetrics: PerformanceMetrics = {
      sessionId: message.sessionId,
      agentType: message.agentType,
      responseTime: message.metadata?.duration || 0,
      tokensUsed: message.metadata?.tools?.length,
      cost: message.metadata?.cost,
      errorRate: message.messageType === 'error' ? 1 : 0,
      timestamp: message.timestamp
    };

    // Store would be implemented in database service
    // await this.dbService.addPerformanceMetrics(performanceMetrics);
  }

  /**
   * Generate analytics report
   */
  async generateReport(
    sessionIds: string[],
    reportType: 'summary' | 'detailed' | 'comparison' = 'summary'
  ): Promise<{
    title: string;
    generatedAt: Date;
    sessions: string[];
    data: any;
    insights: string[];
  }> {
    const report = {
      title: `Analytics Report - ${reportType}`,
      generatedAt: new Date(),
      sessions: sessionIds,
      data: {},
      insights: [] as string[]
    };

    switch (reportType) {
      case 'summary':
        report.data = await this.generateSummaryReport(sessionIds);
        break;
      case 'detailed':
        report.data = await this.generateDetailedReport(sessionIds);
        break;
      case 'comparison':
        report.data = await this.compareSessionPerformance(sessionIds);
        break;
    }

    // Generate insights
    report.insights = await this.generateReportInsights(report.data, reportType);

    return report;
  }

  /**
   * Export analytics data
   */
  async exportAnalytics(
    format: 'json' | 'csv',
    query: AnalyticsQuery
  ): Promise<string | object> {
    const data = await this.getDashboardData(query);

    if (format === 'csv') {
      return this.convertToCSV(data);
    }

    return data;
  }

  private async handleRealTimeMetrics(metrics: RealTimeMetrics): Promise<void> {
    // Broadcast to subscribers
    this.realTimeSubscribers.forEach(callback => {
      try {
        callback(metrics);
      } catch (error) {
        console.error('Error in real-time metrics callback:', error);
      }
    });
  }

  private async getSessionsForQuery(query: AnalyticsQuery): Promise<DualAgentSession[]> {
    if (query.sessionIds) {
      const sessions: DualAgentSession[] = [];
      for (const id of query.sessionIds) {
        const session = await this.dbService.getSession(id);
        if (session) sessions.push(session);
      }
      return sessions;
    }

    return await this.dbService.getAllSessions();
  }

  private async getRecentMessages(query: AnalyticsQuery): Promise<AgentMessage[]> {
    const cutoff = new Date(Date.now() - 10 * 60 * 1000); // Last 10 minutes
    const sessions = await this.getSessionsForQuery(query);
    
    return sessions
      .flatMap(s => s.messages)
      .filter(m => m.timestamp > cutoff)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 100);
  }

  private async getRecentMetrics(query: AnalyticsQuery): Promise<PerformanceMetrics[]> {
    // This would be implemented with proper database queries
    return [];
  }

  private async calculateOverview(sessions: DualAgentSession[]) {
    const totalSessions = sessions.length;
    const activeSessions = sessions.filter(s => s.status === 'running').length;
    
    const allMessages = sessions.flatMap(s => s.messages);
    const errorMessages = allMessages.filter(m => m.messageType === 'error');
    const errorRate = allMessages.length > 0 ? errorMessages.length / allMessages.length : 0;
    
    const totalCost = allMessages.reduce((sum, m) => sum + (m.metadata?.cost || 0), 0);
    
    const avgPerformance = sessions.length > 0 
      ? sessions.reduce((sum, s) => sum + this.calculateSessionScore(s), 0) / sessions.length 
      : 0;

    return {
      totalSessions,
      activeSessions,
      avgPerformance: Math.round(avgPerformance),
      totalCost: Math.round(totalCost * 100) / 100,
      errorRate: Math.round(errorRate * 1000) / 10 // Percentage with 1 decimal
    };
  }

  private async calculatePerformanceTrends(
    sessions: DualAgentSession[],
    granularity: string
  ): Promise<{
    manager: TrendData[];
    worker: TrendData[];
    coordination: TrendData[];
  }> {
    const trends = {
      manager: [] as TrendData[],
      worker: [] as TrendData[],
      coordination: [] as TrendData[]
    };

    if (sessions.length === 0) return trends;

    // Group sessions by time windows
    const timeGroups = this.groupSessionsByTime(sessions, granularity);

    for (const [timestamp, groupSessions] of timeGroups) {
      const managerMessages = groupSessions.flatMap(s => s.messages.filter(m => m.agentType === 'manager'));
      const workerMessages = groupSessions.flatMap(s => s.messages.filter(m => m.agentType === 'worker'));
      const allMessages = groupSessions.flatMap(s => s.messages);

      const date = new Date(timestamp);
      const label = this.formatTimeLabel(date, granularity);

      trends.manager.push({
        timestamp: date,
        value: this.calculatePerformanceScore(managerMessages),
        label
      });

      trends.worker.push({
        timestamp: date,
        value: this.calculatePerformanceScore(workerMessages),
        label
      });

      trends.coordination.push({
        timestamp: date,
        value: this.calculateCoordinationScore(allMessages),
        label
      });
    }

    return trends;
  }

  private async getTopPerformingSessions(sessions: DualAgentSession[]) {
    return sessions
      .map(session => ({
        sessionId: session.id,
        performanceScore: this.calculateSessionScore(session),
        cost: session.messages.reduce((sum, m) => sum + (m.metadata?.cost || 0), 0),
        duration: session.endTime && session.startTime 
          ? session.endTime.getTime() - session.startTime.getTime()
          : Date.now() - session.startTime.getTime()
      }))
      .sort((a, b) => b.performanceScore - a.performanceScore)
      .slice(0, 5);
  }

  private calculateSessionScore(session: DualAgentSession): number {
    const errorRate = session.messages.filter(m => m.messageType === 'error').length / Math.max(session.messages.length, 1);
    const successRate = 1 - errorRate;
    
    const avgResponseTime = this.calculateAverageResponseTime(session.messages);
    const responseScore = avgResponseTime > 0 ? Math.max(0, 100 - avgResponseTime / 1000) : 100;
    
    return (successRate * 70) + (responseScore * 0.3);
  }

  private calculatePerformanceScore(messages: AgentMessage[]): number {
    if (messages.length === 0) return 0;

    const errorRate = messages.filter(m => m.messageType === 'error').length / messages.length;
    const successRate = 1 - errorRate;
    
    const avgResponseTime = this.calculateAverageResponseTime(messages);
    const responseScore = avgResponseTime > 0 ? Math.max(0, 100 - avgResponseTime / 1000) : 100;
    
    return (successRate * 50) + (responseScore * 0.5);
  }

  private calculateCoordinationScore(messages: AgentMessage[]): number {
    if (messages.length < 2) return 0;

    let alternations = 0;
    for (let i = 1; i < messages.length; i++) {
      if (messages[i].agentType !== messages[i-1].agentType) {
        alternations++;
      }
    }

    return (alternations / (messages.length - 1)) * 100;
  }

  private calculateAverageResponseTime(messages: AgentMessage[]): number {
    const responseTimes = messages
      .filter(m => m.metadata?.duration)
      .map(m => m.metadata!.duration!);
    
    return responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0;
  }

  private calculateErrorRate(messages: AgentMessage[]): number {
    if (messages.length === 0) return 0;
    const errors = messages.filter(m => m.messageType === 'error').length;
    return (errors / messages.length) * 100;
  }

  private calculateTotalCost(messages: AgentMessage[]): number {
    return messages.reduce((sum, m) => sum + (m.metadata?.cost || 0), 0);
  }

  private calculateThroughput(
    messages: AgentMessage[], 
    window: { start: Date; end: Date }
  ): number {
    const durationMinutes = (window.end.getTime() - window.start.getTime()) / (60 * 1000);
    return durationMinutes > 0 ? messages.length / durationMinutes : 0;
  }

  private generateTimeWindows(
    timeRange: { start: Date; end: Date },
    granularity: string
  ): Array<{ start: Date; end: Date }> {
    const windows = [];
    const windowSize = this.getWindowSize(granularity);
    
    let current = new Date(timeRange.start);
    while (current < timeRange.end) {
      const next = new Date(current.getTime() + windowSize);
      windows.push({
        start: new Date(current),
        end: next < timeRange.end ? next : new Date(timeRange.end)
      });
      current = next;
    }
    
    return windows;
  }

  private getWindowSize(granularity: string): number {
    switch (granularity) {
      case 'minute': return 60 * 1000;
      case 'hour': return 60 * 60 * 1000;
      case 'day': return 24 * 60 * 60 * 1000;
      default: return 60 * 60 * 1000;
    }
  }

  private groupSessionsByTime(
    sessions: DualAgentSession[],
    granularity: string
  ): Map<number, DualAgentSession[]> {
    const groups = new Map<number, DualAgentSession[]>();
    const windowSize = this.getWindowSize(granularity);

    for (const session of sessions) {
      const windowKey = Math.floor(session.startTime.getTime() / windowSize) * windowSize;
      if (!groups.has(windowKey)) {
        groups.set(windowKey, []);
      }
      groups.get(windowKey)!.push(session);
    }

    return groups;
  }

  private async getMetricsForTimeWindow(
    sessionIds: string[],
    window: { start: Date; end: Date }
  ): Promise<AgentMessage[]> {
    const sessions = await Promise.all(
      sessionIds.map(id => this.dbService.getSession(id))
    );

    return sessions
      .filter((s): s is DualAgentSession => s !== null)
      .flatMap(s => s.messages)
      .filter(m => m.timestamp >= window.start && m.timestamp <= window.end);
  }

  private formatTimeLabel(date: Date, granularity: string): string {
    switch (granularity) {
      case 'minute':
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      case 'hour':
        return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' });
      case 'day':
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      default:
        return date.toISOString();
    }
  }

  private async generateSummaryReport(sessionIds: string[]): Promise<any> {
    const dashboardData = await this.getDashboardData({ sessionIds });
    return {
      type: 'summary',
      overview: dashboardData.overview,
      topSessions: dashboardData.topSessions,
      alerts: dashboardData.alerts
    };
  }

  private async generateDetailedReport(sessionIds: string[]): Promise<any> {
    const detailed: Record<string, any> = {};
    
    for (const sessionId of sessionIds) {
      detailed[sessionId] = await this.analyzeSession(sessionId);
    }
    
    return detailed;
  }

  private async generateReportInsights(data: any, reportType: string): Promise<string[]> {
    const insights: string[] = [];
    
    if (reportType === 'summary' && data.overview) {
      if (data.overview.errorRate > 10) {
        insights.push('High error rate detected across sessions - consider reviewing agent configurations');
      }
      
      if (data.overview.avgPerformance < 70) {
        insights.push('Below-average performance detected - optimization recommended');
      }
      
      if (data.overview.totalCost > 100) {
        insights.push('High cost usage - consider optimizing prompt efficiency');
      }
    }
    
    return insights;
  }

  private convertToCSV(data: any): string {
    // Simple CSV conversion - would be more sophisticated in real implementation
    const headers = Object.keys(data.overview || {});
    const values = Object.values(data.overview || {});
    
    return `${headers.join(',')}\n${values.join(',')}`;
  }

  /**
   * Shutdown analytics service
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down Analytics Service...');
    
    this.collector.stopCollection();
    this.analyzer.clearCache();
    this.realTimeSubscribers.clear();
    
    console.log('Analytics Service shutdown complete');
  }
}