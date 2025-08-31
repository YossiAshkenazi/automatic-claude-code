import { PerformanceMetrics, AgentMessage, DualAgentSession } from '../types';
import { v4 as uuidv4 } from 'uuid';

export interface CollectionConfig {
  sampleRate: number; // 0-1, percentage of messages to analyze
  batchSize: number;
  flushInterval: number; // milliseconds
  enableRealTime: boolean;
  metricsRetention: number; // days
}

export interface RealTimeMetrics {
  timestamp: Date;
  sessionId: string;
  agentType: 'manager' | 'worker';
  responseTime: number;
  tokensUsed?: number;
  cost?: number;
  errorRate: number;
  throughput: number; // messages per minute
  memoryUsage?: number;
  cpuUsage?: number;
}

export interface AggregatedMetrics {
  timeWindow: string;
  sessionId: string;
  managerMetrics: {
    avgResponseTime: number;
    totalMessages: number;
    errorRate: number;
    totalCost: number;
  };
  workerMetrics: {
    avgResponseTime: number;
    totalMessages: number;
    errorRate: number;
    totalCost: number;
  };
  systemMetrics: {
    throughput: number;
    coordinationEfficiency: number;
    resourceUtilization: number;
  };
}

export class MetricsCollector {
  private metricsBuffer: RealTimeMetrics[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private config: CollectionConfig;
  private callbacks: Array<(metrics: RealTimeMetrics) => void> = [];
  private aggregationCache = new Map<string, AggregatedMetrics>();

  constructor(config: Partial<CollectionConfig> = {}) {
    this.config = {
      sampleRate: 1.0,
      batchSize: 100,
      flushInterval: 5000,
      enableRealTime: true,
      metricsRetention: 30,
      ...config
    };

    if (this.config.enableRealTime) {
      this.startCollection();
    }
  }

  /**
   * Start collecting metrics in real-time
   */
  startCollection(): void {
    if (this.flushTimer) return;

    this.flushTimer = setInterval(() => {
      this.flushMetrics();
    }, this.config.flushInterval);

    console.log('Metrics collection started');
  }

  /**
   * Stop collecting metrics
   */
  stopCollection(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush remaining metrics
    if (this.metricsBuffer.length > 0) {
      this.flushMetrics();
    }

    console.log('Metrics collection stopped');
  }

  /**
   * Collect metrics from an agent message
   */
  collectFromMessage(message: AgentMessage, session: DualAgentSession): void {
    // Sample based on configured rate
    if (Math.random() > this.config.sampleRate) {
      return;
    }

    const now = new Date();
    const responseTime = message.metadata?.duration || 0;
    const tokensUsed = message.metadata?.tools ? message.metadata.tools.length : undefined;
    const cost = message.metadata?.cost;

    // Calculate error rate for this message (0 or 1)
    const errorRate = message.messageType === 'error' ? 1 : 0;

    // Calculate throughput (simplified)
    const recentMessages = session.messages.filter(m => 
      now.getTime() - m.timestamp.getTime() < 60000 && // last minute
      m.agentType === message.agentType
    );
    const throughput = recentMessages.length;

    const metrics: RealTimeMetrics = {
      timestamp: now,
      sessionId: message.sessionId,
      agentType: message.agentType,
      responseTime,
      tokensUsed,
      cost,
      errorRate,
      throughput,
      memoryUsage: this.getMemoryUsage(),
      cpuUsage: this.getCpuUsage()
    };

    this.metricsBuffer.push(metrics);

    // Notify real-time subscribers
    this.notifyCallbacks(metrics);

    // Flush if buffer is full
    if (this.metricsBuffer.length >= this.config.batchSize) {
      this.flushMetrics();
    }
  }

  /**
   * Collect performance metrics manually
   */
  async collectPerformanceMetrics(
    sessionId: string,
    agentType: 'manager' | 'worker',
    responseTime: number,
    tokensUsed?: number,
    cost?: number,
    errorRate: number = 0
  ): Promise<PerformanceMetrics> {
    const metrics: PerformanceMetrics = {
      sessionId,
      agentType,
      responseTime,
      tokensUsed,
      cost,
      errorRate,
      timestamp: new Date()
    };

    // Add to real-time metrics if enabled
    if (this.config.enableRealTime) {
      const realtimeMetrics: RealTimeMetrics = {
        ...metrics,
        throughput: 0, // Would need session context to calculate
        memoryUsage: this.getMemoryUsage(),
        cpuUsage: this.getCpuUsage()
      };

      this.metricsBuffer.push(realtimeMetrics);
      this.notifyCallbacks(realtimeMetrics);
    }

    return metrics;
  }

  /**
   * Aggregate metrics for a time window
   */
  aggregateMetrics(
    sessionId: string,
    timeWindow: string,
    messages: AgentMessage[]
  ): AggregatedMetrics {
    const cacheKey = `${sessionId}-${timeWindow}`;
    
    if (this.aggregationCache.has(cacheKey)) {
      return this.aggregationCache.get(cacheKey)!;
    }

    const managerMessages = messages.filter(m => m.agentType === 'manager');
    const workerMessages = messages.filter(m => m.agentType === 'worker');

    const aggregated: AggregatedMetrics = {
      timeWindow,
      sessionId,
      managerMetrics: this.aggregateAgentMetrics(managerMessages),
      workerMetrics: this.aggregateAgentMetrics(workerMessages),
      systemMetrics: this.calculateSystemMetrics(messages)
    };

    this.aggregationCache.set(cacheKey, aggregated);
    
    return aggregated;
  }

  /**
   * Get real-time metrics stream
   */
  getRealTimeStream(): AsyncIterableIterator<RealTimeMetrics[]> {
    const self = this;
    
    return (async function* () {
      while (true) {
        await new Promise(resolve => setTimeout(resolve, self.config.flushInterval));
        if (self.metricsBuffer.length > 0) {
          yield [...self.metricsBuffer];
          self.metricsBuffer = [];
        }
      }
    })();
  }

  /**
   * Subscribe to real-time metrics updates
   */
  subscribe(callback: (metrics: RealTimeMetrics) => void): () => void {
    this.callbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get metrics summary for time period
   */
  getMetricsSummary(
    sessionId: string,
    timeRange: { start: Date; end: Date }
  ): {
    totalMetrics: number;
    avgResponseTime: number;
    totalCost: number;
    errorRate: number;
    peakThroughput: number;
    agentBreakdown: {
      manager: { messages: number; avgResponseTime: number; errorRate: number };
      worker: { messages: number; avgResponseTime: number; errorRate: number };
    };
  } {
    const relevantMetrics = this.metricsBuffer.filter(m => 
      m.sessionId === sessionId &&
      m.timestamp >= timeRange.start &&
      m.timestamp <= timeRange.end
    );

    const managerMetrics = relevantMetrics.filter(m => m.agentType === 'manager');
    const workerMetrics = relevantMetrics.filter(m => m.agentType === 'worker');

    return {
      totalMetrics: relevantMetrics.length,
      avgResponseTime: this.calculateAverage(relevantMetrics.map(m => m.responseTime)),
      totalCost: relevantMetrics.reduce((sum, m) => sum + (m.cost || 0), 0),
      errorRate: this.calculateAverage(relevantMetrics.map(m => m.errorRate)),
      peakThroughput: Math.max(...relevantMetrics.map(m => m.throughput), 0),
      agentBreakdown: {
        manager: {
          messages: managerMetrics.length,
          avgResponseTime: this.calculateAverage(managerMetrics.map(m => m.responseTime)),
          errorRate: this.calculateAverage(managerMetrics.map(m => m.errorRate))
        },
        worker: {
          messages: workerMetrics.length,
          avgResponseTime: this.calculateAverage(workerMetrics.map(m => m.responseTime)),
          errorRate: this.calculateAverage(workerMetrics.map(m => m.errorRate))
        }
      }
    };
  }

  /**
   * Clean up old metrics based on retention policy
   */
  cleanupOldMetrics(): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.metricsRetention);

    const initialCount = this.metricsBuffer.length;
    this.metricsBuffer = this.metricsBuffer.filter(m => m.timestamp > cutoffDate);

    // Clean aggregation cache
    this.aggregationCache.clear();

    const removedCount = initialCount - this.metricsBuffer.length;
    console.log(`Cleaned up ${removedCount} old metrics`);
    
    return removedCount;
  }

  /**
   * Get collector statistics
   */
  getCollectorStats(): {
    isCollecting: boolean;
    bufferSize: number;
    totalCollected: number;
    cacheSize: number;
    config: CollectionConfig;
  } {
    return {
      isCollecting: this.flushTimer !== null,
      bufferSize: this.metricsBuffer.length,
      totalCollected: this.metricsBuffer.length, // Simplified
      cacheSize: this.aggregationCache.size,
      config: this.config
    };
  }

  /**
   * Update collection configuration
   */
  updateConfig(newConfig: Partial<CollectionConfig>): void {
    const wasCollecting = this.flushTimer !== null;
    
    if (wasCollecting) {
      this.stopCollection();
    }

    this.config = { ...this.config, ...newConfig };

    if (wasCollecting && this.config.enableRealTime) {
      this.startCollection();
    }
  }

  private flushMetrics(): void {
    if (this.metricsBuffer.length === 0) return;

    // In a real implementation, this would save to database
    console.log(`Flushing ${this.metricsBuffer.length} metrics to storage`);
    
    // For now, just clear the buffer
    this.metricsBuffer = [];
  }

  private notifyCallbacks(metrics: RealTimeMetrics): void {
    this.callbacks.forEach(callback => {
      try {
        callback(metrics);
      } catch (error) {
        console.error('Error in metrics callback:', error);
      }
    });
  }

  private aggregateAgentMetrics(messages: AgentMessage[]) {
    if (messages.length === 0) {
      return {
        avgResponseTime: 0,
        totalMessages: 0,
        errorRate: 0,
        totalCost: 0
      };
    }

    const responseTimes = messages
      .filter(m => m.metadata?.duration)
      .map(m => m.metadata!.duration!);
    
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0;

    const errorMessages = messages.filter(m => m.messageType === 'error').length;
    const errorRate = errorMessages / messages.length;

    const totalCost = messages.reduce((sum, m) => sum + (m.metadata?.cost || 0), 0);

    return {
      avgResponseTime,
      totalMessages: messages.length,
      errorRate,
      totalCost
    };
  }

  private calculateSystemMetrics(messages: AgentMessage[]) {
    const timeSpan = messages.length > 1 
      ? messages[messages.length - 1].timestamp.getTime() - messages[0].timestamp.getTime()
      : 1;
    
    const throughput = (messages.length / timeSpan) * 60000; // messages per minute

    // Simple coordination efficiency based on agent alternation
    let coordination = 0;
    if (messages.length > 1) {
      let alternations = 0;
      for (let i = 1; i < messages.length; i++) {
        if (messages[i].agentType !== messages[i-1].agentType) {
          alternations++;
        }
      }
      coordination = alternations / (messages.length - 1);
    }

    return {
      throughput,
      coordinationEfficiency: coordination * 100,
      resourceUtilization: (this.getMemoryUsage() || 0) + (this.getCpuUsage() || 0)
    };
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private getMemoryUsage(): number | undefined {
    try {
      const memUsage = process.memoryUsage();
      return Math.round(memUsage.heapUsed / 1024 / 1024); // MB
    } catch {
      return undefined;
    }
  }

  private getCpuUsage(): number | undefined {
    try {
      const cpuUsage = process.cpuUsage();
      return Math.round((cpuUsage.user + cpuUsage.system) / 1000000); // Convert to seconds
    } catch {
      return undefined;
    }
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(
    sessionId?: string,
    timeRange?: { start: Date; end: Date }
  ): RealTimeMetrics[] {
    let metrics = [...this.metricsBuffer];

    if (sessionId) {
      metrics = metrics.filter(m => m.sessionId === sessionId);
    }

    if (timeRange) {
      metrics = metrics.filter(m => 
        m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
      );
    }

    return metrics;
  }

  /**
   * Import metrics from external source
   */
  importMetrics(metrics: RealTimeMetrics[]): void {
    this.metricsBuffer.push(...metrics);
    
    // Notify callbacks for each imported metric
    if (this.config.enableRealTime) {
      metrics.forEach(metric => this.notifyCallbacks(metric));
    }
  }
}