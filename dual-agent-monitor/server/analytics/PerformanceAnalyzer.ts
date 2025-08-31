import { AgentMessage, PerformanceMetrics, DualAgentSession, AgentCommunication } from '../types';

export interface AgentPerformanceData {
  agentType: 'manager' | 'worker';
  avgResponseTime: number;
  totalMessages: number;
  totalTokens: number;
  totalCost: number;
  errorRate: number;
  successRate: number;
  coordinationEfficiency: number;
  taskCompletionRate: number;
  qualityScore: number;
}

export interface SessionAnalytics {
  sessionId: string;
  overallPerformance: {
    totalDuration: number;
    totalCost: number;
    successRate: number;
    efficiency: number;
  };
  managerPerformance: AgentPerformanceData;
  workerPerformance: AgentPerformanceData;
  coordinationMetrics: {
    communicationFrequency: number;
    avgResponseTime: number;
    handoffEfficiency: number;
    collaborationScore: number;
  };
  trends: {
    performanceOverTime: Array<{
      timestamp: Date;
      managerScore: number;
      workerScore: number;
      coordinationScore: number;
    }>;
  };
}

export interface ComparisonAnalytics {
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

export class PerformanceAnalyzer {
  private performanceCache = new Map<string, SessionAnalytics>();

  /**
   * Analyze performance for a specific session
   */
  async analyzeSession(
    session: DualAgentSession,
    communications: AgentCommunication[],
    metrics: PerformanceMetrics[]
  ): Promise<SessionAnalytics> {
    const sessionId = session.id;
    
    // Check cache first
    if (this.performanceCache.has(sessionId)) {
      return this.performanceCache.get(sessionId)!;
    }

    const managerMessages = session.messages.filter(m => m.agentType === 'manager');
    const workerMessages = session.messages.filter(m => m.agentType === 'worker');
    const managerMetrics = metrics.filter(m => m.agentType === 'manager');
    const workerMetrics = metrics.filter(m => m.agentType === 'worker');

    const analysis: SessionAnalytics = {
      sessionId,
      overallPerformance: this.calculateOverallPerformance(session, metrics),
      managerPerformance: this.calculateAgentPerformance('manager', managerMessages, managerMetrics),
      workerPerformance: this.calculateAgentPerformance('worker', workerMessages, workerMetrics),
      coordinationMetrics: this.calculateCoordinationMetrics(communications, session.messages),
      trends: this.calculateTrends(session.messages, metrics)
    };

    // Cache the result
    this.performanceCache.set(sessionId, analysis);
    
    return analysis;
  }

  /**
   * Compare performance across multiple sessions
   */
  async comparePerformance(sessions: DualAgentSession[]): Promise<ComparisonAnalytics> {
    const comparison: ComparisonAnalytics = {
      sessions: sessions.map(s => s.id),
      metrics: {
        avgResponseTime: { manager: [], worker: [] },
        successRate: { manager: [], worker: [] },
        costEfficiency: { manager: [], worker: [] },
        coordinationEfficiency: []
      },
      trends: {
        improvement: false,
        degradation: false,
        stable: false
      }
    };

    for (const session of sessions) {
      const managerMessages = session.messages.filter(m => m.agentType === 'manager');
      const workerMessages = session.messages.filter(m => m.agentType === 'worker');

      // Calculate response times
      comparison.metrics.avgResponseTime.manager.push(
        this.calculateAvgResponseTime(managerMessages)
      );
      comparison.metrics.avgResponseTime.worker.push(
        this.calculateAvgResponseTime(workerMessages)
      );

      // Calculate success rates
      comparison.metrics.successRate.manager.push(
        this.calculateSuccessRate(managerMessages)
      );
      comparison.metrics.successRate.worker.push(
        this.calculateSuccessRate(workerMessages)
      );

      // Calculate cost efficiency
      comparison.metrics.costEfficiency.manager.push(
        this.calculateCostEfficiency(managerMessages)
      );
      comparison.metrics.costEfficiency.worker.push(
        this.calculateCostEfficiency(workerMessages)
      );

      // Calculate coordination efficiency (simplified)
      const coordinationScore = this.calculateCoordinationScore(session.messages);
      comparison.metrics.coordinationEfficiency.push(coordinationScore);
    }

    // Analyze trends
    comparison.trends = this.analyzeTrends(comparison.metrics);

    return comparison;
  }

  /**
   * Get real-time performance insights
   */
  getRealTimeInsights(
    recentMessages: AgentMessage[],
    recentMetrics: PerformanceMetrics[]
  ): {
    currentPerformance: { manager: number; worker: number };
    alerts: Array<{ type: 'warning' | 'error' | 'info'; message: string }>;
    recommendations: string[];
  } {
    const managerMessages = recentMessages.filter(m => m.agentType === 'manager');
    const workerMessages = recentMessages.filter(m => m.agentType === 'worker');
    
    const currentPerformance = {
      manager: this.calculatePerformanceScore(managerMessages),
      worker: this.calculatePerformanceScore(workerMessages)
    };

    const alerts = this.generateAlerts(recentMessages, recentMetrics);
    const recommendations = this.generateRecommendations(currentPerformance, alerts);

    return {
      currentPerformance,
      alerts,
      recommendations
    };
  }

  private calculateOverallPerformance(session: DualAgentSession, metrics: PerformanceMetrics[]) {
    const totalDuration = session.endTime && session.startTime 
      ? session.endTime.getTime() - session.startTime.getTime()
      : Date.now() - session.startTime.getTime();

    const totalCost = metrics.reduce((sum, m) => sum + (m.cost || 0), 0);
    const avgErrorRate = metrics.length > 0 
      ? metrics.reduce((sum, m) => sum + m.errorRate, 0) / metrics.length
      : 0;
    
    const successRate = 1 - avgErrorRate;
    const efficiency = this.calculateEfficiencyScore(session.messages, totalDuration);

    return {
      totalDuration,
      totalCost,
      successRate,
      efficiency
    };
  }

  private calculateAgentPerformance(
    agentType: 'manager' | 'worker',
    messages: AgentMessage[],
    metrics: PerformanceMetrics[]
  ): AgentPerformanceData {
    const avgResponseTime = this.calculateAvgResponseTime(messages);
    const totalTokens = messages.reduce((sum, m) => sum + (m.metadata?.tools?.length || 0), 0);
    const totalCost = metrics.reduce((sum, m) => sum + (m.cost || 0), 0);
    const errorRate = metrics.length > 0 
      ? metrics.reduce((sum, m) => sum + m.errorRate, 0) / metrics.length
      : 0;

    return {
      agentType,
      avgResponseTime,
      totalMessages: messages.length,
      totalTokens,
      totalCost,
      errorRate,
      successRate: 1 - errorRate,
      coordinationEfficiency: this.calculateCoordinationEfficiency(messages),
      taskCompletionRate: this.calculateTaskCompletionRate(messages),
      qualityScore: this.calculateQualityScore(messages)
    };
  }

  private calculateCoordinationMetrics(
    communications: AgentCommunication[],
    messages: AgentMessage[]
  ) {
    const communicationFrequency = communications.length / (messages.length || 1);
    const avgResponseTime = this.calculateCommAvgResponseTime(communications);
    const handoffEfficiency = this.calculateHandoffEfficiency(communications, messages);
    const collaborationScore = this.calculateCollaborationScore(communications);

    return {
      communicationFrequency,
      avgResponseTime,
      handoffEfficiency,
      collaborationScore
    };
  }

  private calculateTrends(messages: AgentMessage[], metrics: PerformanceMetrics[]) {
    const performanceOverTime: Array<{
      timestamp: Date;
      managerScore: number;
      workerScore: number;
      coordinationScore: number;
    }> = [];

    // Group messages and metrics by time windows (e.g., every 5 minutes)
    const timeWindows = this.groupByTimeWindows(messages, metrics, 5 * 60 * 1000); // 5 minutes
    
    for (const [timestamp, data] of timeWindows) {
      const managerMessages = data.messages.filter(m => m.agentType === 'manager');
      const workerMessages = data.messages.filter(m => m.agentType === 'worker');
      
      performanceOverTime.push({
        timestamp: new Date(timestamp),
        managerScore: this.calculatePerformanceScore(managerMessages),
        workerScore: this.calculatePerformanceScore(workerMessages),
        coordinationScore: this.calculateCoordinationScore(data.messages)
      });
    }

    return { performanceOverTime };
  }

  private calculateAvgResponseTime(messages: AgentMessage[]): number {
    const responseTimes = messages
      .filter(m => m.metadata?.duration)
      .map(m => m.metadata!.duration!);
    
    return responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0;
  }

  private calculateSuccessRate(messages: AgentMessage[]): number {
    const errorMessages = messages.filter(m => m.messageType === 'error').length;
    return messages.length > 0 ? 1 - (errorMessages / messages.length) : 1;
  }

  private calculateCostEfficiency(messages: AgentMessage[]): number {
    const totalCost = messages.reduce((sum, m) => sum + (m.metadata?.cost || 0), 0);
    const successfulMessages = messages.filter(m => m.messageType !== 'error').length;
    
    return successfulMessages > 0 ? totalCost / successfulMessages : 0;
  }

  private calculateCoordinationScore(messages: AgentMessage[]): number {
    // Simple coordination score based on message patterns
    const managerMessages = messages.filter(m => m.agentType === 'manager');
    const workerMessages = messages.filter(m => m.agentType === 'worker');
    
    if (managerMessages.length === 0 || workerMessages.length === 0) return 0;
    
    const ratio = Math.min(managerMessages.length, workerMessages.length) / 
                  Math.max(managerMessages.length, workerMessages.length);
    
    return ratio * 100;
  }

  private calculatePerformanceScore(messages: AgentMessage[]): number {
    if (messages.length === 0) return 0;

    const successRate = this.calculateSuccessRate(messages);
    const avgResponseTime = this.calculateAvgResponseTime(messages);
    const responseTimeScore = avgResponseTime > 0 ? Math.max(0, 100 - avgResponseTime / 1000) : 100;
    
    return (successRate * 50) + (responseTimeScore * 0.5);
  }

  private calculateCoordinationEfficiency(messages: AgentMessage[]): number {
    // Analyze communication patterns for efficiency
    return Math.random() * 100; // Placeholder - implement based on actual patterns
  }

  private calculateTaskCompletionRate(messages: AgentMessage[]): number {
    const completionIndicators = messages.filter(m => 
      m.content.toLowerCase().includes('completed') ||
      m.content.toLowerCase().includes('finished') ||
      m.content.toLowerCase().includes('done')
    );
    
    return messages.length > 0 ? (completionIndicators.length / messages.length) * 100 : 0;
  }

  private calculateQualityScore(messages: AgentMessage[]): number {
    const errorRate = messages.filter(m => m.messageType === 'error').length / messages.length;
    const toolUsageRate = messages.filter(m => m.metadata?.tools?.length).length / messages.length;
    
    return (1 - errorRate) * 50 + toolUsageRate * 50;
  }

  private calculateEfficiencyScore(messages: AgentMessage[], duration: number): number {
    const messagesPerMinute = messages.length / (duration / (60 * 1000));
    return Math.min(100, messagesPerMinute * 10);
  }

  private calculateCommAvgResponseTime(communications: AgentCommunication[]): number {
    // Calculate response time between communications
    const responseTimes: number[] = [];
    
    for (let i = 1; i < communications.length; i++) {
      const timeDiff = communications[i].timestamp.getTime() - communications[i-1].timestamp.getTime();
      responseTimes.push(timeDiff);
    }
    
    return responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0;
  }

  private calculateHandoffEfficiency(communications: AgentCommunication[], messages: AgentMessage[]): number {
    // Measure how efficiently agents hand off work to each other
    const handoffs = communications.filter(c => 
      c.messageType === 'instruction' || c.messageType === 'result'
    );
    
    return handoffs.length / Math.max(1, messages.length) * 100;
  }

  private calculateCollaborationScore(communications: AgentCommunication[]): number {
    const totalComms = communications.length;
    const questions = communications.filter(c => c.messageType === 'question').length;
    const feedback = communications.filter(c => c.messageType === 'feedback').length;
    
    return totalComms > 0 ? ((questions + feedback) / totalComms) * 100 : 0;
  }

  private groupByTimeWindows(
    messages: AgentMessage[], 
    metrics: PerformanceMetrics[], 
    windowMs: number
  ): Map<number, { messages: AgentMessage[]; metrics: PerformanceMetrics[] }> {
    const windows = new Map();
    
    [...messages, ...metrics].forEach(item => {
      const windowKey = Math.floor(item.timestamp.getTime() / windowMs) * windowMs;
      if (!windows.has(windowKey)) {
        windows.set(windowKey, { messages: [], metrics: [] });
      }
      
      if ('agentType' in item && 'messageType' in item) {
        windows.get(windowKey).messages.push(item);
      } else {
        windows.get(windowKey).metrics.push(item);
      }
    });
    
    return windows;
  }

  private analyzeTrends(metrics: ComparisonAnalytics['metrics']): ComparisonAnalytics['trends'] {
    // Simple trend analysis - compare first and last values
    const managerResponseTrend = this.getTrend(metrics.avgResponseTime.manager);
    const workerResponseTrend = this.getTrend(metrics.avgResponseTime.worker);
    const coordinationTrend = this.getTrend(metrics.coordinationEfficiency);
    
    const improving = managerResponseTrend < 0 || workerResponseTrend < 0 || coordinationTrend > 0;
    const degrading = managerResponseTrend > 0 || workerResponseTrend > 0 || coordinationTrend < 0;
    
    return {
      improvement: improving && !degrading,
      degradation: degrading && !improving,
      stable: !improving && !degrading
    };
  }

  private getTrend(values: number[]): number {
    if (values.length < 2) return 0;
    return values[values.length - 1] - values[0];
  }

  private generateAlerts(
    messages: AgentMessage[], 
    metrics: PerformanceMetrics[]
  ): Array<{ type: 'warning' | 'error' | 'info'; message: string }> {
    const alerts = [];
    
    // High error rate alert
    const recentErrors = messages.filter(m => 
      m.messageType === 'error' && 
      Date.now() - m.timestamp.getTime() < 5 * 60 * 1000
    ).length;
    
    if (recentErrors > 3) {
      alerts.push({
        type: 'error' as const,
        message: `High error rate detected: ${recentErrors} errors in the last 5 minutes`
      });
    }
    
    // Slow response time alert
    const avgResponseTime = this.calculateAvgResponseTime(messages.slice(-10));
    if (avgResponseTime > 30000) { // 30 seconds
      alerts.push({
        type: 'warning' as const,
        message: `Slow response time: average ${Math.round(avgResponseTime/1000)}s in recent messages`
      });
    }
    
    // High cost alert
    const recentCost = metrics
      .filter(m => Date.now() - m.timestamp.getTime() < 10 * 60 * 1000)
      .reduce((sum, m) => sum + (m.cost || 0), 0);
    
    if (recentCost > 1.0) { // $1.00
      alerts.push({
        type: 'warning' as const,
        message: `High cost detected: $${recentCost.toFixed(2)} in the last 10 minutes`
      });
    }
    
    return alerts;
  }

  private generateRecommendations(
    currentPerformance: { manager: number; worker: number },
    alerts: Array<{ type: string; message: string }>
  ): string[] {
    const recommendations = [];
    
    if (currentPerformance.manager < 70) {
      recommendations.push("Consider adjusting manager agent model or prompting strategy");
    }
    
    if (currentPerformance.worker < 70) {
      recommendations.push("Worker agent may benefit from more specific instructions");
    }
    
    if (alerts.some(a => a.type === 'error')) {
      recommendations.push("Review recent error patterns and adjust error handling");
    }
    
    if (alerts.some(a => a.message.includes('response time'))) {
      recommendations.push("Consider optimizing prompt length or switching to faster model");
    }
    
    if (Math.abs(currentPerformance.manager - currentPerformance.worker) > 30) {
      recommendations.push("Large performance gap detected - review task distribution");
    }
    
    return recommendations;
  }

  /**
   * Clear performance cache
   */
  clearCache(): void {
    this.performanceCache.clear();
  }

  /**
   * Get cached session count
   */
  getCacheSize(): number {
    return this.performanceCache.size;
  }
}