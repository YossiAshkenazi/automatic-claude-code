/**
 * Connection Monitor Utility
 * Provides advanced WebSocket connection monitoring and reliability features
 */

export interface ConnectionQualityMetrics {
  latency: number;
  jitter: number;
  packetLoss: number;
  reliability: number;
  uptime: number;
  reconnectCount: number;
}

export interface ConnectionEvents {
  onQualityChange?: (quality: 'excellent' | 'good' | 'fair' | 'poor' | 'critical') => void;
  onLatencyAlert?: (latency: number) => void;
  onPacketLossAlert?: (loss: number) => void;
  onReconnectRequired?: () => void;
}

export class ConnectionMonitor {
  private latencyHistory: number[] = [];
  private packetsSent = 0;
  private packetsReceived = 0;
  private connectionStartTime = Date.now();
  private lastReconnectTime?: number;
  private reconnectCount = 0;
  private events: ConnectionEvents = {};
  private monitoringInterval?: NodeJS.Timeout;
  private qualityCheckInterval?: NodeJS.Timeout;

  // Thresholds for connection quality assessment
  private readonly LATENCY_THRESHOLDS = {
    excellent: 50,   // < 50ms
    good: 100,       // 50-100ms
    fair: 200,       // 100-200ms
    poor: 500,       // 200-500ms
    critical: 1000   // > 500ms
  };

  private readonly PACKET_LOSS_THRESHOLDS = {
    excellent: 0.5,  // < 0.5%
    good: 2,         // 0.5-2%
    fair: 5,         // 2-5%
    poor: 10,        // 5-10%
    critical: 20     // > 10%
  };

  constructor(events: ConnectionEvents = {}) {
    this.events = events;
    this.startMonitoring();
  }

  /**
   * Record a ping/pong round-trip time
   */
  recordLatency(latency: number): void {
    this.latencyHistory.push(latency);
    
    // Keep only last 50 measurements
    if (this.latencyHistory.length > 50) {
      this.latencyHistory.shift();
    }

    // Alert on high latency
    if (latency > this.LATENCY_THRESHOLDS.poor) {
      this.events.onLatencyAlert?.(latency);
    }
  }

  /**
   * Record a packet send event
   */
  recordPacketSent(): void {
    this.packetsSent++;
  }

  /**
   * Record a packet receive event
   */
  recordPacketReceived(): void {
    this.packetsReceived++;
  }

  /**
   * Record a reconnection event
   */
  recordReconnection(): void {
    this.reconnectCount++;
    this.lastReconnectTime = Date.now();
  }

  /**
   * Calculate current connection quality metrics
   */
  getMetrics(): ConnectionQualityMetrics {
    const averageLatency = this.getAverageLatency();
    const jitter = this.calculateJitter();
    const packetLoss = this.calculatePacketLoss();
    const uptime = Date.now() - this.connectionStartTime;
    
    // Calculate reliability score (0-100)
    const reliability = this.calculateReliabilityScore(averageLatency, packetLoss);

    return {
      latency: Math.round(averageLatency * 100) / 100,
      jitter: Math.round(jitter * 100) / 100,
      packetLoss: Math.round(packetLoss * 100) / 100,
      reliability: Math.round(reliability * 100) / 100,
      uptime,
      reconnectCount: this.reconnectCount
    };
  }

  /**
   * Get current connection quality assessment
   */
  getQuality(): 'excellent' | 'good' | 'fair' | 'poor' | 'critical' {
    const metrics = this.getMetrics();
    
    // Determine quality based on latency and packet loss
    if (metrics.latency < this.LATENCY_THRESHOLDS.excellent && 
        metrics.packetLoss < this.PACKET_LOSS_THRESHOLDS.excellent) {
      return 'excellent';
    } else if (metrics.latency < this.LATENCY_THRESHOLDS.good && 
               metrics.packetLoss < this.PACKET_LOSS_THRESHOLDS.good) {
      return 'good';
    } else if (metrics.latency < this.LATENCY_THRESHOLDS.fair && 
               metrics.packetLoss < this.PACKET_LOSS_THRESHOLDS.fair) {
      return 'fair';
    } else if (metrics.latency < this.LATENCY_THRESHOLDS.poor && 
               metrics.packetLoss < this.PACKET_LOSS_THRESHOLDS.poor) {
      return 'poor';
    } else {
      return 'critical';
    }
  }

  /**
   * Get quality-based recommendations
   */
  getRecommendations(): string[] {
    const quality = this.getQuality();
    const metrics = this.getMetrics();
    const recommendations: string[] = [];

    switch (quality) {
      case 'excellent':
        recommendations.push('Connection is optimal');
        break;
      
      case 'good':
        recommendations.push('Connection is stable');
        break;
      
      case 'fair':
        if (metrics.latency > this.LATENCY_THRESHOLDS.good) {
          recommendations.push('Consider checking network conditions');
        }
        if (metrics.packetLoss > this.PACKET_LOSS_THRESHOLDS.good) {
          recommendations.push('Some packet loss detected');
        }
        break;
      
      case 'poor':
        recommendations.push('Connection quality is degraded');
        if (metrics.latency > this.LATENCY_THRESHOLDS.fair) {
          recommendations.push('High latency detected - check network');
        }
        if (metrics.packetLoss > this.PACKET_LOSS_THRESHOLDS.fair) {
          recommendations.push('Significant packet loss - may need reconnection');
        }
        break;
      
      case 'critical':
        recommendations.push('Connection is severely impaired');
        recommendations.push('Immediate reconnection recommended');
        this.events.onReconnectRequired?.();
        break;
    }

    if (metrics.reconnectCount > 3) {
      recommendations.push('Frequent reconnections detected - check network stability');
    }

    return recommendations;
  }

  /**
   * Check if connection meets reliability threshold
   */
  meetsReliabilityThreshold(threshold: number = 95): boolean {
    return this.getMetrics().reliability >= threshold;
  }

  /**
   * Get connection health report
   */
  getHealthReport(): {
    status: string;
    metrics: ConnectionQualityMetrics;
    quality: string;
    recommendations: string[];
    alert: boolean;
  } {
    const metrics = this.getMetrics();
    const quality = this.getQuality();
    const recommendations = this.getRecommendations();
    
    return {
      status: quality === 'critical' || quality === 'poor' ? 'unhealthy' : 'healthy',
      metrics,
      quality,
      recommendations,
      alert: quality === 'critical' || quality === 'poor' || !this.meetsReliabilityThreshold()
    };
  }

  /**
   * Reset monitoring data
   */
  reset(): void {
    this.latencyHistory = [];
    this.packetsSent = 0;
    this.packetsReceived = 0;
    this.connectionStartTime = Date.now();
    this.reconnectCount = 0;
    this.lastReconnectTime = undefined;
  }

  /**
   * Start continuous monitoring
   */
  private startMonitoring(): void {
    // Monitor connection quality every 5 seconds
    this.qualityCheckInterval = setInterval(() => {
      const quality = this.getQuality();
      this.events.onQualityChange?.(quality);
      
      const metrics = this.getMetrics();
      if (metrics.packetLoss > this.PACKET_LOSS_THRESHOLDS.fair) {
        this.events.onPacketLossAlert?.(metrics.packetLoss);
      }
    }, 5000);
  }

  /**
   * Stop monitoring
   */
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    if (this.qualityCheckInterval) {
      clearInterval(this.qualityCheckInterval);
    }
  }

  /**
   * Calculate average latency
   */
  private getAverageLatency(): number {
    if (this.latencyHistory.length === 0) return 0;
    return this.latencyHistory.reduce((sum, latency) => sum + latency, 0) / this.latencyHistory.length;
  }

  /**
   * Calculate jitter (latency variation)
   */
  private calculateJitter(): number {
    if (this.latencyHistory.length < 2) return 0;
    
    const average = this.getAverageLatency();
    const variance = this.latencyHistory.reduce((sum, latency) => {
      return sum + Math.pow(latency - average, 2);
    }, 0) / this.latencyHistory.length;
    
    return Math.sqrt(variance);
  }

  /**
   * Calculate packet loss percentage
   */
  private calculatePacketLoss(): number {
    if (this.packetsSent === 0) return 0;
    return ((this.packetsSent - this.packetsReceived) / this.packetsSent) * 100;
  }

  /**
   * Calculate overall reliability score
   */
  private calculateReliabilityScore(latency: number, packetLoss: number): number {
    // Base score starts at 100
    let score = 100;
    
    // Deduct points for high latency
    if (latency > this.LATENCY_THRESHOLDS.excellent) {
      score -= Math.min((latency - this.LATENCY_THRESHOLDS.excellent) / 10, 30);
    }
    
    // Deduct points for packet loss
    if (packetLoss > 0) {
      score -= Math.min(packetLoss * 3, 40);
    }
    
    // Deduct points for reconnections
    score -= Math.min(this.reconnectCount * 5, 20);
    
    return Math.max(score, 0);
  }
}

/**
 * Global connection monitor instance
 */
let globalMonitor: ConnectionMonitor | null = null;

export const getGlobalConnectionMonitor = (): ConnectionMonitor => {
  if (!globalMonitor) {
    globalMonitor = new ConnectionMonitor();
  }
  return globalMonitor;
};

export const resetGlobalConnectionMonitor = (events?: ConnectionEvents): void => {
  if (globalMonitor) {
    globalMonitor.destroy();
  }
  globalMonitor = new ConnectionMonitor(events);
};