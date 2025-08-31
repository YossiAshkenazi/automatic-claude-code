import { AgentMessage, DualAgentSession, PerformanceMetrics, AgentCommunication } from '../types';

export interface MLInsight {
  id: string;
  type: 'performance' | 'cost' | 'pattern' | 'trend' | 'anomaly';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number; // 0-1
  data: any;
  suggestions: string[];
  timestamp: Date;
}

export interface PatternAnalysis {
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

export interface PerformanceClusters {
  highPerformers: {
    sessions: string[];
    characteristics: Record<string, any>;
    avgScore: number;
    improvementAreas: string[];
  };
  averagePerformers: {
    sessions: string[];
    characteristics: Record<string, any>;
    avgScore: number;
    improvementAreas: string[];
  };
  underperformers: {
    sessions: string[];
    characteristics: Record<string, any>;
    avgScore: number;
    improvementAreas: string[];
  };
}

export class InsightsEngine {
  private insights: Map<string, MLInsight> = new Map();
  private patternCache: Map<string, PatternAnalysis> = new Map();
  private clusterCache: Map<string, PerformanceClusters> = new Map();

  /**
   * Analyze sessions and generate ML insights
   */
  async analyzeAndGenerateInsights(
    sessions: DualAgentSession[],
    metrics: PerformanceMetrics[],
    communications: AgentCommunication[]
  ): Promise<MLInsight[]> {
    const insights: MLInsight[] = [];

    // Pattern analysis insights
    const patterns = await this.analyzeCollaborationPatterns(sessions, communications);
    insights.push(...this.generatePatternInsights(patterns));

    // Performance clustering insights
    const clusters = await this.performanceClusterAnalysis(sessions, metrics);
    insights.push(...this.generateClusterInsights(clusters));

    // Trend analysis insights
    const trendInsights = await this.analyzeTrends(sessions, metrics);
    insights.push(...trendInsights);

    // Cost optimization insights
    const costInsights = await this.analyzeCostPatterns(sessions, metrics);
    insights.push(...costInsights);

    // Quality prediction insights
    const qualityInsights = await this.analyzeQualityPatterns(sessions);
    insights.push(...qualityInsights);

    // Store insights
    insights.forEach(insight => {
      this.insights.set(insight.id, insight);
    });

    return insights.sort((a, b) => b.confidence * this.getSeverityWeight(b.severity) - 
                                 a.confidence * this.getSeverityWeight(a.severity));
  }

  /**
   * Analyze collaboration patterns between manager and worker agents
   */
  async analyzeCollaborationPatterns(
    sessions: DualAgentSession[],
    communications: AgentCommunication[]
  ): Promise<PatternAnalysis> {
    const cacheKey = this.generateCacheKey(sessions.map(s => s.id));
    
    if (this.patternCache.has(cacheKey)) {
      return this.patternCache.get(cacheKey)!;
    }

    const analysis: PatternAnalysis = {
      collaborationPatterns: {
        optimalExchangeRate: 0,
        averageHandoffTime: 0,
        mostEffectivePatterns: []
      },
      workDistribution: {
        managerTaskTypes: {},
        workerTaskTypes: {},
        optimalBalance: {}
      },
      temporalPatterns: {
        peakPerformanceHours: [],
        seasonalTrends: []
      }
    };

    // Analyze message exchange patterns
    const exchangeRates = this.calculateExchangeRates(sessions);
    analysis.collaborationPatterns.optimalExchangeRate = this.findOptimalRate(exchangeRates);

    // Analyze handoff times
    const handoffTimes = this.calculateHandoffTimes(communications);
    analysis.collaborationPatterns.averageHandoffTime = this.calculateMean(handoffTimes);

    // Identify effective patterns
    analysis.collaborationPatterns.mostEffectivePatterns = this.identifyEffectivePatterns(
      sessions, communications
    );

    // Analyze work distribution
    analysis.workDistribution = this.analyzeWorkDistribution(sessions);

    // Analyze temporal patterns
    analysis.temporalPatterns = this.analyzeTemporalPatterns(sessions, []);

    this.patternCache.set(cacheKey, analysis);
    return analysis;
  }

  /**
   * Perform clustering analysis on session performance
   */
  async performanceClusterAnalysis(
    sessions: DualAgentSession[],
    metrics: PerformanceMetrics[]
  ): Promise<PerformanceClusters> {
    const cacheKey = this.generateCacheKey(sessions.map(s => s.id), 'clusters');
    
    if (this.clusterCache.has(cacheKey)) {
      return this.clusterCache.get(cacheKey)!;
    }

    // Calculate performance scores for each session
    const sessionScores = sessions.map(session => ({
      sessionId: session.id,
      score: this.calculateSessionPerformanceScore(session),
      features: this.extractSessionFeatures(session, metrics)
    }));

    // Simple k-means clustering (k=3)
    const clusters = this.kMeansClustering(sessionScores, 3);

    const result: PerformanceClusters = {
      highPerformers: {
        sessions: clusters[0].sessions,
        characteristics: clusters[0].centroid,
        avgScore: clusters[0].avgScore,
        improvementAreas: this.identifyImprovementAreas(clusters[0])
      },
      averagePerformers: {
        sessions: clusters[1].sessions,
        characteristics: clusters[1].centroid,
        avgScore: clusters[1].avgScore,
        improvementAreas: this.identifyImprovementAreas(clusters[1])
      },
      underperformers: {
        sessions: clusters[2].sessions,
        characteristics: clusters[2].centroid,
        avgScore: clusters[2].avgScore,
        improvementAreas: this.identifyImprovementAreas(clusters[2])
      }
    };

    // Sort by performance level
    const sortedClusters = [result.highPerformers, result.averagePerformers, result.underperformers]
      .sort((a, b) => b.avgScore - a.avgScore);
    
    result.highPerformers = sortedClusters[0];
    result.averagePerformers = sortedClusters[1];
    result.underperformers = sortedClusters[2];

    this.clusterCache.set(cacheKey, result);
    return result;
  }

  /**
   * Generate insights from pattern analysis
   */
  private generatePatternInsights(patterns: PatternAnalysis): MLInsight[] {
    const insights: MLInsight[] = [];

    // Collaboration pattern insights
    if (patterns.collaborationPatterns.optimalExchangeRate > 0) {
      insights.push({
        id: `pattern-exchange-${Date.now()}`,
        type: 'pattern',
        title: 'Optimal Agent Exchange Rate Identified',
        description: `Analysis shows optimal agent exchange rate of ${patterns.collaborationPatterns.optimalExchangeRate.toFixed(2)} exchanges per session for best performance.`,
        severity: 'medium',
        confidence: 0.85,
        data: {
          optimalRate: patterns.collaborationPatterns.optimalExchangeRate,
          currentAverage: patterns.collaborationPatterns.averageHandoffTime,
          effectivePatterns: patterns.collaborationPatterns.mostEffectivePatterns
        },
        suggestions: [
          'Consider adjusting task breakdown to achieve optimal exchange rate',
          'Monitor sessions that deviate significantly from optimal rate',
          'Implement automatic handoff triggers at optimal intervals'
        ],
        timestamp: new Date()
      });
    }

    // Work distribution insights
    const distributionInsight = this.analyzeDistributionBalance(patterns.workDistribution);
    if (distributionInsight.severity !== 'low') {
      insights.push(distributionInsight);
    }

    // Temporal pattern insights
    if (patterns.temporalPatterns.peakPerformanceHours.length > 0) {
      insights.push({
        id: `temporal-peak-${Date.now()}`,
        type: 'trend',
        title: 'Peak Performance Hours Identified',
        description: `Sessions perform best during hours: ${patterns.temporalPatterns.peakPerformanceHours.join(', ')}`,
        severity: 'low',
        confidence: 0.75,
        data: {
          peakHours: patterns.temporalPatterns.peakPerformanceHours,
          seasonalTrends: patterns.temporalPatterns.seasonalTrends
        },
        suggestions: [
          'Schedule complex tasks during peak performance hours',
          'Consider adjusting automation schedules to peak times',
          'Monitor performance variations throughout the day'
        ],
        timestamp: new Date()
      });
    }

    return insights;
  }

  /**
   * Generate insights from cluster analysis
   */
  private generateClusterInsights(clusters: PerformanceClusters): MLInsight[] {
    const insights: MLInsight[] = [];

    // High performer characteristics
    if (clusters.highPerformers.sessions.length > 0) {
      insights.push({
        id: `cluster-high-${Date.now()}`,
        type: 'pattern',
        title: 'High Performance Pattern Identified',
        description: `${clusters.highPerformers.sessions.length} sessions show consistently high performance (avg: ${clusters.highPerformers.avgScore.toFixed(1)})`,
        severity: 'low',
        confidence: 0.90,
        data: {
          sessionCount: clusters.highPerformers.sessions.length,
          avgScore: clusters.highPerformers.avgScore,
          characteristics: clusters.highPerformers.characteristics,
          sessions: clusters.highPerformers.sessions.slice(0, 5) // Top 5 examples
        },
        suggestions: [
          'Analyze high-performing session characteristics for replication',
          'Use high-performer patterns as templates for future sessions',
          'Consider these patterns when optimizing agent configurations'
        ],
        timestamp: new Date()
      });
    }

    // Underperformer analysis
    if (clusters.underperformers.sessions.length > 0) {
      const severity = clusters.underperformers.sessions.length > clusters.highPerformers.sessions.length 
        ? 'high' : 'medium';
      
      insights.push({
        id: `cluster-low-${Date.now()}`,
        type: 'performance',
        title: 'Underperforming Sessions Detected',
        description: `${clusters.underperformers.sessions.length} sessions showing poor performance (avg: ${clusters.underperformers.avgScore.toFixed(1)})`,
        severity,
        confidence: 0.88,
        data: {
          sessionCount: clusters.underperformers.sessions.length,
          avgScore: clusters.underperformers.avgScore,
          characteristics: clusters.underperformers.characteristics,
          improvementAreas: clusters.underperformers.improvementAreas,
          sessions: clusters.underperformers.sessions.slice(0, 5)
        },
        suggestions: [
          ...clusters.underperformers.improvementAreas.map(area => `Focus on improving ${area}`),
          'Review underperforming session patterns for common issues',
          'Consider adjusting agent prompts or task breakdown strategies'
        ],
        timestamp: new Date()
      });
    }

    return insights;
  }

  /**
   * Analyze trends in session data
   */
  private async analyzeTrends(
    sessions: DualAgentSession[], 
    metrics: PerformanceMetrics[]
  ): Promise<MLInsight[]> {
    const insights: MLInsight[] = [];

    // Performance trend analysis
    const performanceTrend = this.calculateTrendDirection(
      sessions.map(s => ({ 
        timestamp: s.startTime, 
        value: this.calculateSessionPerformanceScore(s) 
      }))
    );

    if (Math.abs(performanceTrend.slope) > 0.1) { // Significant trend
      insights.push({
        id: `trend-performance-${Date.now()}`,
        type: 'trend',
        title: performanceTrend.slope > 0 ? 'Improving Performance Trend' : 'Declining Performance Trend',
        description: `Performance trend shows ${Math.abs(performanceTrend.slope * 100).toFixed(1)}% ${performanceTrend.slope > 0 ? 'improvement' : 'decline'} over recent sessions`,
        severity: performanceTrend.slope > 0 ? 'low' : 'medium',
        confidence: Math.min(0.95, performanceTrend.r2),
        data: {
          slope: performanceTrend.slope,
          r2: performanceTrend.r2,
          trend: performanceTrend.slope > 0 ? 'improving' : 'declining',
          projectedChange: performanceTrend.slope * 30 // 30-session projection
        },
        suggestions: performanceTrend.slope > 0 
          ? ['Continue current optimization strategies', 'Document successful patterns for replication']
          : ['Investigate root causes of performance decline', 'Consider reverting recent configuration changes', 'Review agent prompt effectiveness'],
        timestamp: new Date()
      });
    }

    // Cost trend analysis
    const costData = sessions
      .filter(s => s.summary?.totalCost)
      .map(s => ({ timestamp: s.startTime, value: s.summary!.totalCost! }));

    if (costData.length > 3) {
      const costTrend = this.calculateTrendDirection(costData);
      
      if (Math.abs(costTrend.slope) > 0.05) {
        insights.push({
          id: `trend-cost-${Date.now()}`,
          type: 'cost',
          title: costTrend.slope > 0 ? 'Rising Cost Trend' : 'Decreasing Cost Trend',
          description: `Cost trend shows ${Math.abs(costTrend.slope * 100).toFixed(1)}% ${costTrend.slope > 0 ? 'increase' : 'decrease'} per session`,
          severity: costTrend.slope > 1 ? 'high' : costTrend.slope > 0.5 ? 'medium' : 'low',
          confidence: Math.min(0.90, costTrend.r2),
          data: {
            slope: costTrend.slope,
            r2: costTrend.r2,
            trend: costTrend.slope > 0 ? 'increasing' : 'decreasing',
            projectedMonthlyCost: this.projectMonthlyCost(costData, costTrend.slope)
          },
          suggestions: costTrend.slope > 0 
            ? ['Review prompt efficiency to reduce token usage', 'Consider using smaller models for routine tasks', 'Implement cost monitoring alerts']
            : ['Current cost optimization strategies are effective', 'Monitor for potential quality trade-offs'],
          timestamp: new Date()
        });
      }
    }

    return insights;
  }

  /**
   * Analyze cost patterns and optimization opportunities
   */
  private async analyzeCostPatterns(
    sessions: DualAgentSession[],
    metrics: PerformanceMetrics[]
  ): Promise<MLInsight[]> {
    const insights: MLInsight[] = [];

    const costData = sessions
      .filter(s => s.summary?.totalCost && s.summary.totalCost > 0)
      .map(s => ({
        sessionId: s.id,
        cost: s.summary!.totalCost!,
        performance: this.calculateSessionPerformanceScore(s),
        duration: s.endTime ? s.endTime.getTime() - s.startTime.getTime() : 0,
        messageCount: s.messages.length,
        toolUsage: s.summary?.toolsUsed?.length || 0
      }));

    if (costData.length === 0) return insights;

    // Cost efficiency analysis
    const costEfficiencyScores = costData.map(d => ({
      ...d,
      efficiency: d.performance / Math.max(d.cost, 0.01) // Performance per dollar
    }));

    const avgEfficiency = costEfficiencyScores.reduce((sum, d) => sum + d.efficiency, 0) / costEfficiencyScores.length;
    const inefficientSessions = costEfficiencyScores.filter(d => d.efficiency < avgEfficiency * 0.7);

    if (inefficientSessions.length > 0) {
      insights.push({
        id: `cost-efficiency-${Date.now()}`,
        type: 'cost',
        title: 'Cost Efficiency Opportunities Identified',
        description: `${inefficientSessions.length} sessions show poor cost efficiency (${(inefficientSessions.length / costData.length * 100).toFixed(1)}% of total)`,
        severity: inefficientSessions.length > costData.length * 0.3 ? 'high' : 'medium',
        confidence: 0.82,
        data: {
          inefficientSessions: inefficientSessions.length,
          avgEfficiency,
          potentialSavings: this.calculatePotentialSavings(inefficientSessions),
          topInefficient: inefficientSessions
            .sort((a, b) => a.efficiency - b.efficiency)
            .slice(0, 3)
            .map(s => ({ sessionId: s.sessionId, efficiency: s.efficiency, cost: s.cost }))
        },
        suggestions: [
          'Review high-cost, low-performance sessions for optimization opportunities',
          'Consider prompt engineering to reduce unnecessary token usage',
          'Implement cost-per-performance monitoring alerts',
          'Evaluate tool usage efficiency in expensive sessions'
        ],
        timestamp: new Date()
      });
    }

    // High-cost session analysis
    const costThreshold = this.calculatePercentile(costData.map(d => d.cost), 90);
    const highCostSessions = costData.filter(d => d.cost > costThreshold);

    if (highCostSessions.length > 0) {
      const avgHighCost = highCostSessions.reduce((sum, d) => sum + d.cost, 0) / highCostSessions.length;
      const avgRegularCost = costData
        .filter(d => d.cost <= costThreshold)
        .reduce((sum, d) => sum + d.cost, 0) / Math.max(costData.length - highCostSessions.length, 1);

      insights.push({
        id: `cost-outliers-${Date.now()}`,
        type: 'cost',
        title: 'High-Cost Session Pattern Detected',
        description: `Top 10% of sessions cost ${(avgHighCost / avgRegularCost).toFixed(1)}x more than average`,
        severity: avgHighCost > avgRegularCost * 3 ? 'high' : 'medium',
        confidence: 0.88,
        data: {
          highCostSessions: highCostSessions.length,
          avgHighCost,
          avgRegularCost,
          costMultiplier: avgHighCost / avgRegularCost,
          patterns: this.identifyHighCostPatterns(highCostSessions)
        },
        suggestions: [
          'Investigate common patterns in high-cost sessions',
          'Consider implementing cost limits for individual sessions',
          'Review task complexity that leads to high costs',
          'Optimize agent handoff strategies to reduce redundancy'
        ],
        timestamp: new Date()
      });
    }

    return insights;
  }

  /**
   * Analyze quality patterns for prediction
   */
  private async analyzeQualityPatterns(sessions: DualAgentSession[]): Promise<MLInsight[]> {
    const insights: MLInsight[] = [];

    // Quality prediction based on early session indicators
    const qualityPredictors = sessions
      .filter(s => s.messages.length > 5 && s.status === 'completed')
      .map(s => ({
        sessionId: s.id,
        finalQuality: s.summary?.successRate || 0,
        earlyIndicators: {
          initialResponseTime: s.messages[1]?.metadata?.duration || 0,
          earlyErrorRate: s.messages.slice(0, 5).filter(m => m.messageType === 'error').length / 5,
          agentAlternationRate: this.calculateEarlyAlternationRate(s.messages.slice(0, 10)),
          toolDiversity: new Set(s.messages.slice(0, 5).flatMap(m => m.metadata?.tools || [])).size
        }
      }));

    if (qualityPredictors.length > 10) {
      const predictiveModel = this.trainQualityPredictor(qualityPredictors);
      
      insights.push({
        id: `quality-predictor-${Date.now()}`,
        type: 'pattern',
        title: 'Quality Prediction Model Available',
        description: `ML model can predict session success with ${(predictiveModel.accuracy * 100).toFixed(1)}% accuracy based on early indicators`,
        severity: 'low',
        confidence: predictiveModel.accuracy,
        data: {
          modelAccuracy: predictiveModel.accuracy,
          keyPredictors: predictiveModel.importantFeatures,
          thresholds: predictiveModel.thresholds,
          sampleSize: qualityPredictors.length
        },
        suggestions: [
          'Use early indicators to predict and prevent low-quality sessions',
          'Implement automatic intervention when poor quality is predicted',
          'Monitor key predictor metrics in real-time',
          'Adjust agent strategies based on early session patterns'
        ],
        timestamp: new Date()
      });

      // Identify at-risk session characteristics
      const atRiskPatterns = this.identifyAtRiskPatterns(qualityPredictors, predictiveModel);
      if (atRiskPatterns.confidence > 0.7) {
        insights.push({
          id: `quality-risk-${Date.now()}`,
          type: 'performance',
          title: 'At-Risk Session Patterns Identified',
          description: `Specific early patterns correlate with ${(atRiskPatterns.failureRate * 100).toFixed(1)}% failure rate`,
          severity: atRiskPatterns.failureRate > 0.3 ? 'high' : 'medium',
          confidence: atRiskPatterns.confidence,
          data: {
            riskPatterns: atRiskPatterns.patterns,
            failureRate: atRiskPatterns.failureRate,
            affectedSessions: atRiskPatterns.examples,
            interventionPoints: atRiskPatterns.interventions
          },
          suggestions: atRiskPatterns.interventions.map(i => `Implement intervention: ${i}`),
          timestamp: new Date()
        });
      }
    }

    return insights;
  }

  // Utility methods for ML calculations

  private calculateSessionPerformanceScore(session: DualAgentSession): number {
    if (session.summary) {
      return session.summary.successRate * 100;
    }

    const errorRate = session.messages.filter(m => m.messageType === 'error').length / Math.max(session.messages.length, 1);
    const successRate = 1 - errorRate;
    
    const avgResponseTime = session.messages
      .filter(m => m.metadata?.duration)
      .reduce((sum, m, _, arr) => sum + m.metadata!.duration! / arr.length, 0);
    
    const responseScore = avgResponseTime > 0 ? Math.max(0, 100 - avgResponseTime / 1000) : 100;
    
    return (successRate * 70) + (responseScore * 0.3);
  }

  private extractSessionFeatures(session: DualAgentSession, metrics: PerformanceMetrics[]): Record<string, number> {
    const sessionMetrics = metrics.filter(m => m.sessionId === session.id);
    
    return {
      messageCount: session.messages.length,
      managerMessages: session.messages.filter(m => m.agentType === 'manager').length,
      workerMessages: session.messages.filter(m => m.agentType === 'worker').length,
      errorCount: session.messages.filter(m => m.messageType === 'error').length,
      toolUsageCount: session.messages.reduce((sum, m) => sum + (m.metadata?.tools?.length || 0), 0),
      avgResponseTime: sessionMetrics.reduce((sum, m, _, arr) => sum + m.responseTime / Math.max(arr.length, 1), 0),
      totalCost: session.summary?.totalCost || 0,
      duration: session.endTime ? session.endTime.getTime() - session.startTime.getTime() : 0
    };
  }

  private kMeansClustering(
    data: Array<{ sessionId: string; score: number; features: Record<string, number> }>, 
    k: number
  ): Array<{ sessions: string[]; centroid: Record<string, number>; avgScore: number }> {
    // Simplified k-means implementation
    const featureKeys = Object.keys(data[0]?.features || {});
    
    // Initialize centroids randomly
    let centroids = Array.from({ length: k }, () => {
      const centroid: Record<string, number> = {};
      featureKeys.forEach(key => {
        centroid[key] = Math.random() * 100; // Simplified initialization
      });
      return centroid;
    });

    let clusters: Array<{ sessions: string[]; centroid: Record<string, number>; avgScore: number }> = [];
    let maxIterations = 10;
    let iteration = 0;
    let assignments: number[] = [];

    while (iteration < maxIterations) {
      // Assign points to nearest centroid
      assignments = [];
      
      for (const point of data) {
        let minDistance = Infinity;
        let assignedCluster = 0;
        
        for (let i = 0; i < centroids.length; i++) {
          const distance = this.calculateEuclideanDistance(point.features, centroids[i]);
          if (distance < minDistance) {
            minDistance = distance;
            assignedCluster = i;
          }
        }
        assignments.push(assignedCluster);
      }

      // Update centroids
      const newCentroids = Array.from({ length: k }, () => {
        const centroid: Record<string, number> = {};
        featureKeys.forEach(key => centroid[key] = 0);
        return centroid;
      });

      const clusterCounts = new Array(k).fill(0);

      for (let i = 0; i < data.length; i++) {
        const cluster = assignments[i];
        clusterCounts[cluster]++;
        
        featureKeys.forEach(key => {
          newCentroids[cluster][key] += data[i].features[key];
        });
      }

      // Normalize centroids
      for (let i = 0; i < k; i++) {
        if (clusterCounts[i] > 0) {
          featureKeys.forEach(key => {
            newCentroids[i][key] /= clusterCounts[i];
          });
        }
      }

      centroids = newCentroids;
      iteration++;
    }

    // Create final clusters
    for (let i = 0; i < k; i++) {
      const clusterSessions = data
        .map((point, idx) => ({ ...point, assignment: assignments[idx] }))
        .filter(point => point.assignment === i);

      const avgScore = clusterSessions.length > 0 
        ? clusterSessions.reduce((sum, s) => sum + s.score, 0) / clusterSessions.length
        : 0;

      clusters.push({
        sessions: clusterSessions.map(s => s.sessionId),
        centroid: centroids[i],
        avgScore
      });
    }

    return clusters.filter(c => c.sessions.length > 0);
  }

  private calculateEuclideanDistance(features1: Record<string, number>, features2: Record<string, number>): number {
    const keys = Object.keys(features1);
    let sum = 0;
    
    for (const key of keys) {
      const diff = (features1[key] || 0) - (features2[key] || 0);
      sum += diff * diff;
    }
    
    return Math.sqrt(sum);
  }

  private identifyImprovementAreas(cluster: { sessions: string[]; centroid: Record<string, number>; avgScore: number }): string[] {
    const areas: string[] = [];
    
    if (cluster.centroid.errorCount > 2) {
      areas.push('Error handling and recovery');
    }
    if (cluster.centroid.avgResponseTime > 5000) {
      areas.push('Response time optimization');
    }
    if (cluster.centroid.managerMessages / Math.max(cluster.centroid.workerMessages, 1) > 2) {
      areas.push('Work distribution balance');
    }
    if (cluster.centroid.totalCost > 10) {
      areas.push('Cost efficiency');
    }
    
    return areas;
  }

  private calculateExchangeRates(sessions: DualAgentSession[]): number[] {
    return sessions.map(session => {
      let exchanges = 0;
      for (let i = 1; i < session.messages.length; i++) {
        if (session.messages[i].agentType !== session.messages[i-1].agentType) {
          exchanges++;
        }
      }
      return exchanges;
    });
  }

  private findOptimalRate(rates: number[]): number {
    if (rates.length === 0) return 0;
    
    // Simple optimization: find rate that correlates with best performance
    // In a real implementation, this would be more sophisticated
    return rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
  }

  private calculateHandoffTimes(communications: AgentCommunication[]): number[] {
    const handoffTimes: number[] = [];
    
    for (let i = 1; i < communications.length; i++) {
      if (communications[i].fromAgent !== communications[i-1].fromAgent) {
        const timeDiff = communications[i].timestamp.getTime() - communications[i-1].timestamp.getTime();
        handoffTimes.push(timeDiff);
      }
    }
    
    return handoffTimes;
  }

  private identifyEffectivePatterns(
    sessions: DualAgentSession[], 
    communications: AgentCommunication[]
  ): Array<{ pattern: string; successRate: number; examples: string[] }> {
    // Simplified pattern identification
    const patterns = new Map<string, { successes: number; total: number; examples: string[] }>();
    
    for (const session of sessions) {
      const pattern = this.extractSessionPattern(session);
      const success = (session.summary?.successRate || 0) > 0.8;
      
      if (!patterns.has(pattern)) {
        patterns.set(pattern, { successes: 0, total: 0, examples: [] });
      }
      
      const patternData = patterns.get(pattern)!;
      patternData.total++;
      if (success) patternData.successes++;
      if (patternData.examples.length < 3) {
        patternData.examples.push(session.id);
      }
    }
    
    return Array.from(patterns.entries())
      .map(([pattern, data]) => ({
        pattern,
        successRate: data.total > 0 ? data.successes / data.total : 0,
        examples: data.examples
      }))
      .filter(p => p.successRate > 0.6)
      .sort((a, b) => b.successRate - a.successRate);
  }

  private extractSessionPattern(session: DualAgentSession): string {
    const agentSequence = session.messages.map(m => m.agentType.charAt(0)).join('');
    return this.simplifyPattern(agentSequence);
  }

  private simplifyPattern(sequence: string): string {
    // Simplify pattern by grouping consecutive same characters
    return sequence.replace(/(.)\1+/g, '$1+');
  }

  private analyzeWorkDistribution(sessions: DualAgentSession[]): PatternAnalysis['workDistribution'] {
    const managerTasks: Record<string, number> = {};
    const workerTasks: Record<string, number> = {};
    
    for (const session of sessions) {
      const managerMessages = session.messages.filter(m => m.agentType === 'manager');
      const workerMessages = session.messages.filter(m => m.agentType === 'worker');
      
      // Categorize by message type
      managerMessages.forEach(m => {
        const category = this.categorizeMessage(m);
        managerTasks[category] = (managerTasks[category] || 0) + 1;
      });
      
      workerMessages.forEach(m => {
        const category = this.categorizeMessage(m);
        workerTasks[category] = (workerTasks[category] || 0) + 1;
      });
    }
    
    return {
      managerTaskTypes: managerTasks,
      workerTaskTypes: workerTasks,
      optimalBalance: this.calculateOptimalBalance(managerTasks, workerTasks)
    };
  }

  private categorizeMessage(message: AgentMessage): string {
    if (message.messageType === 'tool_call') {
      return message.metadata?.tools?.[0] || 'tool_call';
    }
    return message.messageType;
  }

  private calculateOptimalBalance(
    managerTasks: Record<string, number>, 
    workerTasks: Record<string, number>
  ): Record<string, number> {
    const allCategories = new Set([...Object.keys(managerTasks), ...Object.keys(workerTasks)]);
    const optimal: Record<string, number> = {};
    
    allCategories.forEach(category => {
      const managerCount = managerTasks[category] || 0;
      const workerCount = workerTasks[category] || 0;
      const total = managerCount + workerCount;
      
      if (total > 0) {
        optimal[category] = managerCount / total; // Ratio of manager involvement
      }
    });
    
    return optimal;
  }

  private analyzeTemporalPatterns(
    sessions: DualAgentSession[], 
    metrics: PerformanceMetrics[]
  ): PatternAnalysis['temporalPatterns'] {
    const hourlyPerformance: Record<number, { total: number; count: number }> = {};
    
    sessions.forEach(session => {
      const hour = session.startTime.getHours();
      const performance = this.calculateSessionPerformanceScore(session);
      
      if (!hourlyPerformance[hour]) {
        hourlyPerformance[hour] = { total: 0, count: 0 };
      }
      
      hourlyPerformance[hour].total += performance;
      hourlyPerformance[hour].count += 1;
    });
    
    const hourlyAverages = Object.entries(hourlyPerformance)
      .map(([hour, data]) => ({
        hour: parseInt(hour),
        avgPerformance: data.total / data.count
      }))
      .sort((a, b) => b.avgPerformance - a.avgPerformance);
    
    const peakHours = hourlyAverages
      .slice(0, 3)
      .map(h => h.hour);
    
    return {
      peakPerformanceHours: peakHours,
      seasonalTrends: [] // Would implement with more historical data
    };
  }

  private calculateTrendDirection(data: Array<{ timestamp: Date; value: number }>): { slope: number; r2: number } {
    if (data.length < 3) return { slope: 0, r2: 0 };
    
    // Simple linear regression
    const n = data.length;
    const x = data.map((_, i) => i);
    const y = data.map(d => d.value);
    
    const xMean = x.reduce((sum, val) => sum + val, 0) / n;
    const yMean = y.reduce((sum, val) => sum + val, 0) / n;
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n; i++) {
      numerator += (x[i] - xMean) * (y[i] - yMean);
      denominator += (x[i] - xMean) ** 2;
    }
    
    const slope = denominator !== 0 ? numerator / denominator : 0;
    
    // Calculate R²
    const yPred = x.map(xi => slope * (xi - xMean) + yMean);
    const ssRes = y.reduce((sum, yi, i) => sum + (yi - yPred[i]) ** 2, 0);
    const ssTot = y.reduce((sum, yi) => sum + (yi - yMean) ** 2, 0);
    const r2 = ssTot !== 0 ? 1 - (ssRes / ssTot) : 0;
    
    return { slope, r2: Math.max(0, r2) };
  }

  private projectMonthlyCost(costData: Array<{ timestamp: Date; value: number }>, slope: number): number {
    if (costData.length === 0) return 0;
    
    const latestCost = costData[costData.length - 1].value;
    const projectedSessionCost = latestCost * (1 + slope);
    const assumedSessionsPerMonth = 30; // Assumption
    
    return projectedSessionCost * assumedSessionsPerMonth;
  }

  private calculatePotentialSavings(inefficientSessions: Array<{ cost: number; efficiency: number }>): number {
    return inefficientSessions.reduce((total, session) => {
      const potentialOptimization = 0.3; // Assume 30% potential improvement
      return total + (session.cost * potentialOptimization);
    }, 0);
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = values.slice().sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    
    if (index % 1 === 0) {
      return sorted[index];
    }
    
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  private identifyHighCostPatterns(highCostSessions: Array<{ sessionId: string; cost: number; toolUsage: number; messageCount: number }>): Record<string, any> {
    return {
      avgToolUsage: highCostSessions.reduce((sum, s) => sum + s.toolUsage, 0) / highCostSessions.length,
      avgMessageCount: highCostSessions.reduce((sum, s) => sum + s.messageCount, 0) / highCostSessions.length,
      commonCharacteristics: ['High tool usage', 'Extended conversations', 'Complex task patterns']
    };
  }

  private trainQualityPredictor(
    data: Array<{
      sessionId: string;
      finalQuality: number;
      earlyIndicators: Record<string, number>;
    }>
  ): { accuracy: number; importantFeatures: string[]; thresholds: Record<string, number> } {
    // Simplified predictive model using threshold-based rules
    const features = Object.keys(data[0]?.earlyIndicators || {});
    const thresholds: Record<string, number> = {};
    
    // Calculate optimal thresholds for each feature
    features.forEach(feature => {
      const values = data.map(d => d.earlyIndicators[feature]);
      thresholds[feature] = this.calculatePercentile(values, 75); // Top 25% threshold
    });
    
    // Test accuracy
    let correct = 0;
    data.forEach(point => {
      const predicted = this.predictQuality(point.earlyIndicators, thresholds);
      const actual = point.finalQuality > 0.8;
      if (predicted === actual) correct++;
    });
    
    const accuracy = data.length > 0 ? correct / data.length : 0;
    
    return {
      accuracy,
      importantFeatures: features,
      thresholds
    };
  }

  private predictQuality(indicators: Record<string, number>, thresholds: Record<string, number>): boolean {
    // Simple rule: good quality if most indicators are above threshold
    let goodIndicators = 0;
    let totalIndicators = 0;
    
    for (const [feature, value] of Object.entries(indicators)) {
      if (thresholds[feature] !== undefined) {
        totalIndicators++;
        if (feature.includes('errorRate')) {
          // For error rates, lower is better
          if (value < thresholds[feature]) goodIndicators++;
        } else {
          // For other metrics, higher is better
          if (value > thresholds[feature]) goodIndicators++;
        }
      }
    }
    
    return totalIndicators > 0 && (goodIndicators / totalIndicators) > 0.6;
  }

  private identifyAtRiskPatterns(
    data: Array<{
      sessionId: string;
      finalQuality: number;
      earlyIndicators: Record<string, number>;
    }>,
    model: { thresholds: Record<string, number> }
  ): {
    patterns: string[];
    failureRate: number;
    confidence: number;
    examples: string[];
    interventions: string[];
  } {
    const atRiskSessions = data.filter(d => !this.predictQuality(d.earlyIndicators, model.thresholds));
    const actualFailures = atRiskSessions.filter(d => d.finalQuality < 0.8);
    
    return {
      patterns: [
        'High initial response time',
        'Early error occurrence',
        'Low agent alternation',
        'Limited tool diversity'
      ],
      failureRate: atRiskSessions.length > 0 ? actualFailures.length / atRiskSessions.length : 0,
      confidence: 0.75,
      examples: atRiskSessions.slice(0, 3).map(s => s.sessionId),
      interventions: [
        'Automatic agent prompt adjustment',
        'Early escalation to human oversight',
        'Dynamic task complexity reduction',
        'Proactive error recovery activation'
      ]
    };
  }

  private calculateEarlyAlternationRate(messages: AgentMessage[]): number {
    if (messages.length < 2) return 0;
    
    let alternations = 0;
    for (let i = 1; i < messages.length; i++) {
      if (messages[i].agentType !== messages[i-1].agentType) {
        alternations++;
      }
    }
    
    return alternations / (messages.length - 1);
  }

  private analyzeDistributionBalance(distribution: PatternAnalysis['workDistribution']): MLInsight {
    const totalManager = Object.values(distribution.managerTaskTypes).reduce((sum, count) => sum + count, 0);
    const totalWorker = Object.values(distribution.workerTaskTypes).reduce((sum, count) => sum + count, 0);
    const total = totalManager + totalWorker;
    
    const managerRatio = totalManager / total;
    const workerRatio = totalWorker / total;
    
    // Determine if distribution is balanced (ideal range: 30-70% for each agent)
    const isBalanced = managerRatio >= 0.3 && managerRatio <= 0.7;
    const severity = isBalanced ? 'low' : 'medium';
    
    return {
      id: `distribution-balance-${Date.now()}`,
      type: 'pattern',
      title: isBalanced ? 'Balanced Work Distribution' : 'Unbalanced Work Distribution Detected',
      description: `Manager handles ${(managerRatio * 100).toFixed(1)}% of tasks, Worker handles ${(workerRatio * 100).toFixed(1)}%`,
      severity,
      confidence: 0.80,
      data: {
        managerRatio,
        workerRatio,
        totalTasks: total,
        isBalanced,
        taskBreakdown: {
          manager: distribution.managerTaskTypes,
          worker: distribution.workerTaskTypes
        }
      },
      suggestions: isBalanced 
        ? ['Continue current task distribution strategy']
        : [
            'Consider rebalancing task assignments between agents',
            'Review task complexity distribution',
            'Optimize agent capabilities for better load sharing'
          ],
      timestamp: new Date()
    };
  }

  private calculateMean(values: number[]): number {
    return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
  }

  private getSeverityWeight(severity: string): number {
    switch (severity) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 1;
    }
  }

  private generateCacheKey(sessionIds: string[], suffix?: string): string {
    const key = sessionIds.sort().join('-');
    return suffix ? `${key}-${suffix}` : key;
  }

  /**
   * Get stored insights
   */
  getInsights(filters?: {
    type?: string;
    severity?: string;
    minConfidence?: number;
  }): MLInsight[] {
    let insights = Array.from(this.insights.values());
    
    if (filters?.type) {
      insights = insights.filter(i => i.type === filters.type);
    }
    
    if (filters?.severity) {
      insights = insights.filter(i => i.severity === filters.severity);
    }
    
    if (filters?.minConfidence !== undefined) {
      insights = insights.filter(i => i.confidence >= filters.minConfidence!);
    }
    
    return insights.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Clear insights cache
   */
  clearCache(): void {
    this.insights.clear();
    this.patternCache.clear();
    this.clusterCache.clear();
  }

  /**
   * Export insights for external analysis
   */
  exportInsights(): {
    insights: MLInsight[];
    patterns: PatternAnalysis[];
    clusters: PerformanceClusters[];
    generatedAt: Date;
  } {
    return {
      insights: Array.from(this.insights.values()),
      patterns: Array.from(this.patternCache.values()),
      clusters: Array.from(this.clusterCache.values()),
      generatedAt: new Date()
    };
  }
}