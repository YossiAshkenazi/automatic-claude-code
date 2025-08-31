import { MLInsight, PatternAnalysis, PerformanceClusters } from './InsightsEngine';
import { AgentMessage, DualAgentSession, PerformanceMetrics } from '../types';

export interface OptimizationRecommendation {
  id: string;
  category: 'performance' | 'cost' | 'efficiency' | 'quality' | 'reliability';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  expectedImpact: {
    performance?: number; // Percentage improvement
    costSavings?: number; // Dollar amount
    timeReduction?: number; // Minutes saved
    errorReduction?: number; // Percentage reduction
  };
  implementation: {
    difficulty: 'easy' | 'moderate' | 'hard';
    estimatedTime: number; // Hours
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

export interface OptimizationStrategy {
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

export interface ResourceOptimization {
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
    tokenOptimization: number; // Percentage reduction
    costOptimization: number;
    timeOptimization: number;
    efficiencyGain: number;
  };
}

export class OptimizationRecommendations {
  private recommendations: Map<string, OptimizationRecommendation> = new Map();
  private strategies: OptimizationStrategy[] = [];

  /**
   * Generate comprehensive optimization recommendations
   */
  async generateRecommendations(
    insights: MLInsight[],
    patterns: PatternAnalysis,
    clusters: PerformanceClusters,
    sessions: DualAgentSession[],
    metrics: PerformanceMetrics[]
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    // Performance optimization recommendations
    recommendations.push(...await this.generatePerformanceRecommendations(insights, patterns, clusters));

    // Cost optimization recommendations
    recommendations.push(...await this.generateCostRecommendations(insights, sessions, metrics));

    // Efficiency optimization recommendations
    recommendations.push(...await this.generateEfficiencyRecommendations(patterns, clusters));

    // Quality optimization recommendations
    recommendations.push(...await this.generateQualityRecommendations(insights, clusters));

    // Reliability optimization recommendations
    recommendations.push(...await this.generateReliabilityRecommendations(insights, sessions));

    // Store recommendations
    recommendations.forEach(rec => {
      this.recommendations.set(rec.id, rec);
    });

    return this.prioritizeRecommendations(recommendations);
  }

  /**
   * Generate performance-focused recommendations
   */
  private async generatePerformanceRecommendations(
    insights: MLInsight[],
    patterns: PatternAnalysis,
    clusters: PerformanceClusters
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    // Agent exchange optimization
    if (patterns.collaborationPatterns.optimalExchangeRate > 0) {
      recommendations.push({
        id: `perf-exchange-${Date.now()}`,
        category: 'performance',
        priority: 'high',
        title: 'Optimize Agent Exchange Pattern',
        description: `Adjust agent handoff frequency to optimal rate of ${patterns.collaborationPatterns.optimalExchangeRate.toFixed(1)} exchanges per session`,
        expectedImpact: {
          performance: 25,
          timeReduction: 15
        },
        implementation: {
          difficulty: 'moderate',
          estimatedTime: 4,
          steps: [
            'Implement dynamic handoff triggers',
            'Set optimal exchange rate thresholds',
            'Add monitoring for exchange patterns',
            'Test with pilot sessions'
          ],
          requiredChanges: [
            'Agent coordination logic',
            'Handoff trigger mechanisms',
            'Performance monitoring'
          ]
        },
        evidence: {
          dataPoints: [
            { metric: 'optimal_rate', value: patterns.collaborationPatterns.optimalExchangeRate },
            { metric: 'current_avg', value: patterns.collaborationPatterns.averageHandoffTime }
          ],
          confidence: 0.85,
          affectedSessions: patterns.collaborationPatterns.mostEffectivePatterns.flatMap(p => p.examples).slice(0, 10)
        },
        monitoring: {
          metrics: ['exchange_rate', 'session_performance', 'handoff_time'],
          successCriteria: [
            'Exchange rate within 10% of optimal',
            'Performance improvement > 15%',
            'No increase in error rate'
          ],
          timeframe: '2 weeks'
        },
        timestamp: new Date()
      });
    }

    // Response time optimization
    const slowResponseInsight = insights.find(i => 
      i.type === 'performance' && i.title.includes('response time')
    );
    
    if (slowResponseInsight) {
      recommendations.push({
        id: `perf-response-${Date.now()}`,
        category: 'performance',
        priority: 'high',
        title: 'Reduce Agent Response Time',
        description: 'Optimize agent response times through prompt engineering and model selection',
        expectedImpact: {
          performance: 20,
          timeReduction: 30
        },
        implementation: {
          difficulty: 'moderate',
          estimatedTime: 6,
          steps: [
            'Analyze slow-response patterns',
            'Optimize agent prompts for conciseness',
            'Implement response time monitoring',
            'Consider model switching for routine tasks',
            'Add timeout mechanisms for long operations'
          ],
          requiredChanges: [
            'Agent prompts',
            'Response time monitoring',
            'Model selection logic'
          ]
        },
        evidence: {
          dataPoints: slowResponseInsight.data,
          confidence: slowResponseInsight.confidence,
          affectedSessions: []
        },
        monitoring: {
          metrics: ['avg_response_time', 'p95_response_time', 'timeout_rate'],
          successCriteria: [
            'Average response time < 3 seconds',
            'P95 response time < 10 seconds',
            'Timeout rate < 5%'
          ],
          timeframe: '1 week'
        },
        timestamp: new Date()
      });
    }

    // High performer pattern replication
    if (clusters.highPerformers.sessions.length > 0) {
      recommendations.push({
        id: `perf-replicate-${Date.now()}`,
        category: 'performance',
        priority: 'medium',
        title: 'Replicate High Performer Patterns',
        description: 'Apply characteristics from top-performing sessions to improve overall performance',
        expectedImpact: {
          performance: 35,
          errorReduction: 20
        },
        implementation: {
          difficulty: 'hard',
          estimatedTime: 12,
          steps: [
            'Analyze high performer characteristics in detail',
            'Create performance templates',
            'Implement pattern matching system',
            'Deploy gradual rollout strategy',
            'Monitor performance impact'
          ],
          requiredChanges: [
            'Agent configuration templates',
            'Pattern matching system',
            'Performance measurement framework'
          ]
        },
        evidence: {
          dataPoints: [
            { metric: 'high_performer_count', value: clusters.highPerformers.sessions.length },
            { metric: 'avg_score', value: clusters.highPerformers.avgScore },
            { metric: 'characteristics', value: clusters.highPerformers.characteristics }
          ],
          confidence: 0.90,
          affectedSessions: clusters.highPerformers.sessions
        },
        monitoring: {
          metrics: ['overall_performance', 'pattern_compliance', 'success_rate'],
          successCriteria: [
            'Overall performance increase > 20%',
            'Pattern compliance > 80%',
            'No degradation in low performers'
          ],
          timeframe: '3 weeks'
        },
        timestamp: new Date()
      });
    }

    return recommendations;
  }

  /**
   * Generate cost optimization recommendations
   */
  private async generateCostRecommendations(
    insights: MLInsight[],
    sessions: DualAgentSession[],
    metrics: PerformanceMetrics[]
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    // High cost session optimization
    const costInsights = insights.filter(i => i.type === 'cost');
    
    if (costInsights.length > 0) {
      const highCostInsight = costInsights.find(i => i.severity === 'high');
      
      if (highCostInsight) {
        recommendations.push({
          id: `cost-high-${Date.now()}`,
          category: 'cost',
          priority: 'critical',
          title: 'Reduce High-Cost Session Patterns',
          description: 'Optimize expensive sessions through prompt engineering and model selection',
          expectedImpact: {
            costSavings: this.calculateCostSavings(highCostInsight.data),
            performance: 5 // May have small performance impact
          },
          implementation: {
            difficulty: 'moderate',
            estimatedTime: 8,
            steps: [
              'Identify high-cost pattern triggers',
              'Implement cost-aware prompting',
              'Add model switching for expensive operations',
              'Create cost monitoring alerts',
              'Deploy progressive optimization'
            ],
            requiredChanges: [
              'Prompt templates',
              'Model selection logic',
              'Cost monitoring system',
              'Alert mechanisms'
            ]
          },
          evidence: {
            dataPoints: highCostInsight.data,
            confidence: highCostInsight.confidence,
            affectedSessions: highCostInsight.data.sessions || []
          },
          monitoring: {
            metrics: ['cost_per_session', 'cost_efficiency', 'performance_impact'],
            successCriteria: [
              'Cost reduction > 30%',
              'No performance degradation > 10%',
              'Cost efficiency improvement > 25%'
            ],
            timeframe: '2 weeks'
          },
          timestamp: new Date()
        });
      }

      // Token usage optimization
      const tokenOptimization = this.analyzeTokenUsage(sessions);
      if (tokenOptimization.potentialSavings > 100) { // Significant savings potential
        recommendations.push({
          id: `cost-tokens-${Date.now()}`,
          category: 'cost',
          priority: 'high',
          title: 'Optimize Token Usage Patterns',
          description: 'Reduce token consumption through prompt optimization and context management',
          expectedImpact: {
            costSavings: tokenOptimization.potentialSavings,
            performance: -2 // Slight performance trade-off
          },
          implementation: {
            difficulty: 'easy',
            estimatedTime: 3,
            steps: [
              'Implement prompt compression techniques',
              'Add context window management',
              'Remove redundant information from prompts',
              'Implement smart context truncation'
            ],
            requiredChanges: [
              'Prompt templates',
              'Context management logic',
              'Token counting systems'
            ]
          },
          evidence: {
            dataPoints: [
              { metric: 'avg_tokens', value: tokenOptimization.avgTokens },
              { metric: 'potential_savings', value: tokenOptimization.potentialSavings },
              { metric: 'optimization_rate', value: tokenOptimization.optimizationRate }
            ],
            confidence: 0.88,
            affectedSessions: tokenOptimization.highUsageSessions
          },
          monitoring: {
            metrics: ['tokens_per_session', 'cost_per_token', 'response_quality'],
            successCriteria: [
              'Token usage reduction > 20%',
              'Cost reduction proportional to token savings',
              'Response quality maintained > 90%'
            ],
            timeframe: '1 week'
          },
          timestamp: new Date()
        });
      }
    }

    return recommendations;
  }

  /**
   * Generate efficiency optimization recommendations
   */
  private async generateEfficiencyRecommendations(
    patterns: PatternAnalysis,
    clusters: PerformanceClusters
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    // Work distribution optimization
    const workDistribution = this.analyzeWorkDistributionEfficiency(patterns.workDistribution);
    
    if (!workDistribution.isOptimal) {
      recommendations.push({
        id: `eff-distribution-${Date.now()}`,
        category: 'efficiency',
        priority: 'medium',
        title: 'Optimize Work Distribution',
        description: `Rebalance tasks between agents for optimal efficiency. Current distribution: Manager ${(workDistribution.managerRatio * 100).toFixed(1)}%, Worker ${(workDistribution.workerRatio * 100).toFixed(1)}%`,
        expectedImpact: {
          performance: 15,
          timeReduction: 20
        },
        implementation: {
          difficulty: 'moderate',
          estimatedTime: 6,
          steps: [
            'Analyze current task allocation patterns',
            'Define optimal task distribution rules',
            'Implement dynamic load balancing',
            'Create task complexity assessment',
            'Deploy gradual rebalancing'
          ],
          requiredChanges: [
            'Task allocation logic',
            'Load balancing algorithms',
            'Task complexity metrics'
          ]
        },
        evidence: {
          dataPoints: [
            { metric: 'manager_ratio', value: workDistribution.managerRatio },
            { metric: 'worker_ratio', value: workDistribution.workerRatio },
            { metric: 'efficiency_score', value: workDistribution.efficiencyScore }
          ],
          confidence: 0.80,
          affectedSessions: []
        },
        monitoring: {
          metrics: ['task_distribution_ratio', 'agent_utilization', 'throughput'],
          successCriteria: [
            'Distribution ratio within 40-60% range',
            'Agent utilization > 80%',
            'Throughput increase > 10%'
          ],
          timeframe: '2 weeks'
        },
        timestamp: new Date()
      });
    }

    // Tool usage efficiency
    const toolEfficiency = this.analyzeToolUsageEfficiency(patterns);
    
    if (toolEfficiency.improvementPotential > 0.15) {
      recommendations.push({
        id: `eff-tools-${Date.now()}`,
        category: 'efficiency',
        priority: 'medium',
        title: 'Optimize Tool Usage Patterns',
        description: 'Improve tool selection and usage efficiency based on historical success patterns',
        expectedImpact: {
          performance: 12,
          timeReduction: 18,
          errorReduction: 10
        },
        implementation: {
          difficulty: 'moderate',
          estimatedTime: 5,
          steps: [
            'Create tool usage efficiency metrics',
            'Implement smart tool suggestion system',
            'Add tool performance tracking',
            'Optimize tool selection algorithms',
            'Deploy usage optimization rules'
          ],
          requiredChanges: [
            'Tool selection logic',
            'Usage tracking systems',
            'Performance metrics'
          ]
        },
        evidence: {
          dataPoints: [
            { metric: 'current_efficiency', value: toolEfficiency.currentEfficiency },
            { metric: 'improvement_potential', value: toolEfficiency.improvementPotential },
            { metric: 'inefficient_patterns', value: toolEfficiency.inefficientPatterns }
          ],
          confidence: 0.75,
          affectedSessions: []
        },
        monitoring: {
          metrics: ['tool_success_rate', 'tool_selection_accuracy', 'task_completion_time'],
          successCriteria: [
            'Tool success rate > 90%',
            'Selection accuracy > 85%',
            'Completion time reduction > 15%'
          ],
          timeframe: '10 days'
        },
        timestamp: new Date()
      });
    }

    return recommendations;
  }

  /**
   * Generate quality optimization recommendations
   */
  private async generateQualityRecommendations(
    insights: MLInsight[],
    clusters: PerformanceClusters
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    // Quality prediction system
    const qualityInsight = insights.find(i => 
      i.type === 'pattern' && i.title.includes('Quality Prediction')
    );

    if (qualityInsight && qualityInsight.confidence > 0.7) {
      recommendations.push({
        id: `quality-prediction-${Date.now()}`,
        category: 'quality',
        priority: 'high',
        title: 'Implement Predictive Quality System',
        description: 'Deploy ML model to predict and prevent low-quality sessions before they occur',
        expectedImpact: {
          performance: 30,
          errorReduction: 40,
          costSavings: 200 // Prevent expensive failed sessions
        },
        implementation: {
          difficulty: 'hard',
          estimatedTime: 16,
          steps: [
            'Deploy quality prediction model',
            'Implement early warning system',
            'Create intervention mechanisms',
            'Add real-time quality monitoring',
            'Develop quality improvement workflows'
          ],
          requiredChanges: [
            'ML prediction pipeline',
            'Real-time monitoring system',
            'Intervention mechanisms',
            'Quality metrics framework'
          ]
        },
        evidence: {
          dataPoints: qualityInsight.data,
          confidence: qualityInsight.confidence,
          affectedSessions: []
        },
        monitoring: {
          metrics: ['prediction_accuracy', 'prevented_failures', 'quality_improvement'],
          successCriteria: [
            'Prediction accuracy > 75%',
            'Prevented failures > 50%',
            'Overall quality improvement > 25%'
          ],
          timeframe: '4 weeks'
        },
        timestamp: new Date()
      });
    }

    // Underperformer improvement
    if (clusters.underperformers.sessions.length > 0) {
      recommendations.push({
        id: `quality-underperform-${Date.now()}`,
        category: 'quality',
        priority: 'high',
        title: 'Improve Underperforming Sessions',
        description: `Target ${clusters.underperformers.improvementAreas.join(', ')} to lift ${clusters.underperformers.sessions.length} underperforming sessions`,
        expectedImpact: {
          performance: 45,
          errorReduction: 35
        },
        implementation: {
          difficulty: 'moderate',
          estimatedTime: 10,
          steps: [
            'Analyze underperformer patterns in detail',
            'Create targeted improvement strategies',
            'Implement quality checkpoints',
            'Deploy intervention triggers',
            'Monitor improvement progress'
          ],
          requiredChanges: [
            'Quality assessment systems',
            'Intervention mechanisms',
            'Progress tracking'
          ]
        },
        evidence: {
          dataPoints: [
            { metric: 'underperformer_count', value: clusters.underperformers.sessions.length },
            { metric: 'avg_score', value: clusters.underperformers.avgScore },
            { metric: 'improvement_areas', value: clusters.underperformers.improvementAreas }
          ],
          confidence: 0.85,
          affectedSessions: clusters.underperformers.sessions
        },
        monitoring: {
          metrics: ['underperformer_ratio', 'quality_distribution', 'improvement_rate'],
          successCriteria: [
            'Underperformer ratio < 20%',
            'Quality score improvement > 30%',
            'Sustained improvement over 2 weeks'
          ],
          timeframe: '3 weeks'
        },
        timestamp: new Date()
      });
    }

    return recommendations;
  }

  /**
   * Generate reliability optimization recommendations
   */
  private async generateReliabilityRecommendations(
    insights: MLInsight[],
    sessions: DualAgentSession[]
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    // Error pattern analysis
    const errorAnalysis = this.analyzeErrorPatterns(sessions);
    
    if (errorAnalysis.criticalPatterns.length > 0) {
      recommendations.push({
        id: `reliability-errors-${Date.now()}`,
        category: 'reliability',
        priority: 'critical',
        title: 'Address Critical Error Patterns',
        description: `Fix ${errorAnalysis.criticalPatterns.length} critical error patterns affecting ${errorAnalysis.affectedSessions} sessions`,
        expectedImpact: {
          errorReduction: 60,
          performance: 25
        },
        implementation: {
          difficulty: 'moderate',
          estimatedTime: 8,
          steps: [
            'Analyze critical error root causes',
            'Implement error prevention mechanisms',
            'Add robust error recovery',
            'Create error monitoring alerts',
            'Deploy error handling improvements'
          ],
          requiredChanges: [
            'Error handling logic',
            'Recovery mechanisms',
            'Monitoring systems'
          ]
        },
        evidence: {
          dataPoints: [
            { metric: 'critical_patterns', value: errorAnalysis.criticalPatterns.length },
            { metric: 'affected_sessions', value: errorAnalysis.affectedSessions },
            { metric: 'error_rate', value: errorAnalysis.overallErrorRate }
          ],
          confidence: 0.92,
          affectedSessions: errorAnalysis.exampleSessions
        },
        monitoring: {
          metrics: ['error_rate', 'recovery_success_rate', 'mean_time_to_recovery'],
          successCriteria: [
            'Error rate reduction > 50%',
            'Recovery success rate > 90%',
            'Mean recovery time < 30 seconds'
          ],
          timeframe: '2 weeks'
        },
        timestamp: new Date()
      });
    }

    // Anomaly detection
    const anomalyInsight = insights.find(i => i.type === 'anomaly');
    
    if (anomalyInsight) {
      recommendations.push({
        id: `reliability-anomaly-${Date.now()}`,
        category: 'reliability',
        priority: 'high',
        title: 'Implement Anomaly Detection System',
        description: 'Deploy real-time anomaly detection to prevent system failures before they occur',
        expectedImpact: {
          errorReduction: 30,
          performance: 10
        },
        implementation: {
          difficulty: 'hard',
          estimatedTime: 12,
          steps: [
            'Deploy anomaly detection algorithms',
            'Create baseline behavior models',
            'Implement real-time monitoring',
            'Add automated response triggers',
            'Create anomaly investigation workflows'
          ],
          requiredChanges: [
            'Anomaly detection pipeline',
            'Real-time monitoring infrastructure',
            'Automated response systems'
          ]
        },
        evidence: {
          dataPoints: anomalyInsight.data,
          confidence: anomalyInsight.confidence,
          affectedSessions: []
        },
        monitoring: {
          metrics: ['anomaly_detection_rate', 'false_positive_rate', 'prevention_effectiveness'],
          successCriteria: [
            'Detection rate > 85%',
            'False positive rate < 10%',
            'Prevention effectiveness > 70%'
          ],
          timeframe: '4 weeks'
        },
        timestamp: new Date()
      });
    }

    return recommendations;
  }

  /**
   * Generate optimization strategies combining multiple recommendations
   */
  generateOptimizationStrategies(recommendations: OptimizationRecommendation[]): OptimizationStrategy[] {
    const strategies: OptimizationStrategy[] = [];

    // Performance-focused strategy
    const performanceRecs = recommendations.filter(r => r.category === 'performance');
    if (performanceRecs.length > 0) {
      strategies.push({
        name: 'Performance Excellence',
        description: 'Comprehensive performance optimization focusing on response times and agent coordination',
        targetArea: 'Performance',
        recommendations: performanceRecs,
        combinedImpact: this.calculateCombinedImpact(performanceRecs)
      });
    }

    // Cost optimization strategy
    const costRecs = recommendations.filter(r => r.category === 'cost');
    if (costRecs.length > 0) {
      strategies.push({
        name: 'Cost Efficiency',
        description: 'Reduce operational costs while maintaining service quality',
        targetArea: 'Cost',
        recommendations: costRecs,
        combinedImpact: this.calculateCombinedImpact(costRecs)
      });
    }

    // Quality assurance strategy
    const qualityRecs = recommendations.filter(r => r.category === 'quality');
    if (qualityRecs.length > 0) {
      strategies.push({
        name: 'Quality Assurance',
        description: 'Implement predictive quality systems and improve underperforming sessions',
        targetArea: 'Quality',
        recommendations: qualityRecs,
        combinedImpact: this.calculateCombinedImpact(qualityRecs)
      });
    }

    // Quick wins strategy (easy implementations)
    const quickWins = recommendations.filter(r => r.implementation.difficulty === 'easy');
    if (quickWins.length > 0) {
      strategies.push({
        name: 'Quick Wins',
        description: 'Fast, easy implementations with immediate impact',
        targetArea: 'Efficiency',
        recommendations: quickWins,
        combinedImpact: this.calculateCombinedImpact(quickWins)
      });
    }

    return strategies.sort((a, b) => b.combinedImpact.totalPerformanceGain - a.combinedImpact.totalPerformanceGain);
  }

  /**
   * Calculate resource optimization projections
   */
  calculateResourceOptimization(
    sessions: DualAgentSession[],
    recommendations: OptimizationRecommendation[]
  ): ResourceOptimization {
    const currentUsage = this.calculateCurrentUsage(sessions);
    const optimizations = this.calculateOptimizations(recommendations);

    return {
      currentUsage,
      optimizedUsage: {
        projectedTokens: currentUsage.avgTokensPerSession * (1 - optimizations.tokenOptimization),
        projectedCost: currentUsage.avgCostPerSession * (1 - optimizations.costOptimization),
        projectedDuration: currentUsage.avgDuration * (1 - optimizations.timeOptimization),
        projectedToolCalls: currentUsage.avgToolCalls * (1 - optimizations.efficiencyGain * 0.1)
      },
      optimizations
    };
  }

  // Helper methods

  private prioritizeRecommendations(recommendations: OptimizationRecommendation[]): OptimizationRecommendation[] {
    return recommendations.sort((a, b) => {
      // Primary sort by priority
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      
      if (priorityDiff !== 0) return priorityDiff;

      // Secondary sort by expected impact (performance weight)
      const aImpact = (a.expectedImpact.performance || 0) * a.evidence.confidence;
      const bImpact = (b.expectedImpact.performance || 0) * b.evidence.confidence;
      
      return bImpact - aImpact;
    });
  }

  private calculateCostSavings(data: any): number {
    if (data.potentialSavings) return data.potentialSavings;
    if (data.avgHighCost && data.avgRegularCost) {
      return (data.avgHighCost - data.avgRegularCost) * 0.3; // Assume 30% reduction
    }
    return 100; // Default estimate
  }

  private analyzeTokenUsage(sessions: DualAgentSession[]): {
    avgTokens: number;
    potentialSavings: number;
    optimizationRate: number;
    highUsageSessions: string[];
  } {
    const tokensData = sessions
      .map(s => ({
        sessionId: s.id,
        estimatedTokens: s.messages.reduce((sum, m) => sum + (m.content.length / 4), 0) // Rough estimate
      }))
      .filter(s => s.estimatedTokens > 0);

    const avgTokens = tokensData.reduce((sum, s) => sum + s.estimatedTokens, 0) / tokensData.length;
    const threshold = avgTokens * 1.5;
    const highUsageSessions = tokensData.filter(s => s.estimatedTokens > threshold);

    return {
      avgTokens,
      potentialSavings: highUsageSessions.length * avgTokens * 0.0002, // Rough cost calculation
      optimizationRate: 0.25, // Assume 25% optimization possible
      highUsageSessions: highUsageSessions.map(s => s.sessionId)
    };
  }

  private analyzeWorkDistributionEfficiency(workDistribution: PatternAnalysis['workDistribution']): {
    isOptimal: boolean;
    managerRatio: number;
    workerRatio: number;
    efficiencyScore: number;
  } {
    const totalManager = Object.values(workDistribution.managerTaskTypes).reduce((sum, count) => sum + count, 0);
    const totalWorker = Object.values(workDistribution.workerTaskTypes).reduce((sum, count) => sum + count, 0);
    const total = totalManager + totalWorker;

    if (total === 0) {
      return { isOptimal: true, managerRatio: 0, workerRatio: 0, efficiencyScore: 0 };
    }

    const managerRatio = totalManager / total;
    const workerRatio = totalWorker / total;
    
    // Optimal range is 30-70% for each agent
    const isOptimal = managerRatio >= 0.3 && managerRatio <= 0.7;
    
    // Efficiency score based on how close to optimal
    const deviationFromOptimal = Math.abs(0.5 - managerRatio);
    const efficiencyScore = Math.max(0, 1 - (deviationFromOptimal / 0.2));

    return {
      isOptimal,
      managerRatio,
      workerRatio,
      efficiencyScore
    };
  }

  private analyzeToolUsageEfficiency(patterns: PatternAnalysis): {
    currentEfficiency: number;
    improvementPotential: number;
    inefficientPatterns: string[];
  } {
    // Simplified analysis - in reality would be more complex
    return {
      currentEfficiency: 0.75, // Assume 75% current efficiency
      improvementPotential: 0.20, // 20% improvement potential
      inefficientPatterns: ['Redundant tool calls', 'Suboptimal tool selection', 'Missing tool combinations']
    };
  }

  private analyzeErrorPatterns(sessions: DualAgentSession[]): {
    criticalPatterns: string[];
    affectedSessions: number;
    overallErrorRate: number;
    exampleSessions: string[];
  } {
    const errorSessions = sessions.filter(s => 
      s.messages.some(m => m.messageType === 'error')
    );

    const totalErrors = sessions.reduce((sum, s) => 
      sum + s.messages.filter(m => m.messageType === 'error').length, 0
    );
    
    const totalMessages = sessions.reduce((sum, s) => sum + s.messages.length, 0);

    return {
      criticalPatterns: ['Connection timeouts', 'Permission errors', 'Resource exhaustion'],
      affectedSessions: errorSessions.length,
      overallErrorRate: totalMessages > 0 ? totalErrors / totalMessages : 0,
      exampleSessions: errorSessions.slice(0, 5).map(s => s.id)
    };
  }

  private calculateCombinedImpact(recommendations: OptimizationRecommendation[]): {
    totalPerformanceGain: number;
    totalCostSavings: number;
    implementationEffort: number;
  } {
    const totalPerformanceGain = recommendations.reduce(
      (sum, r) => sum + (r.expectedImpact.performance || 0), 0
    );
    
    const totalCostSavings = recommendations.reduce(
      (sum, r) => sum + (r.expectedImpact.costSavings || 0), 0
    );
    
    const implementationEffort = recommendations.reduce(
      (sum, r) => sum + r.implementation.estimatedTime, 0
    );

    return {
      totalPerformanceGain,
      totalCostSavings,
      implementationEffort
    };
  }

  private calculateCurrentUsage(sessions: DualAgentSession[]): ResourceOptimization['currentUsage'] {
    if (sessions.length === 0) {
      return {
        avgTokensPerSession: 0,
        avgCostPerSession: 0,
        avgDuration: 0,
        avgToolCalls: 0
      };
    }

    const avgTokens = sessions.reduce((sum, s) => 
      sum + s.messages.reduce((msgSum, m) => msgSum + (m.content.length / 4), 0), 0
    ) / sessions.length;

    const avgCost = sessions.reduce((sum, s) => 
      sum + (s.summary?.totalCost || 0), 0
    ) / sessions.length;

    const avgDuration = sessions.reduce((sum, s) => {
      const duration = s.endTime ? 
        s.endTime.getTime() - s.startTime.getTime() : 
        Date.now() - s.startTime.getTime();
      return sum + duration;
    }, 0) / sessions.length;

    const avgToolCalls = sessions.reduce((sum, s) => 
      sum + s.messages.reduce((msgSum, m) => 
        msgSum + (m.metadata?.tools?.length || 0), 0), 0
    ) / sessions.length;

    return {
      avgTokensPerSession: avgTokens,
      avgCostPerSession: avgCost,
      avgDuration: avgDuration,
      avgToolCalls: avgToolCalls
    };
  }

  private calculateOptimizations(recommendations: OptimizationRecommendation[]): ResourceOptimization['optimizations'] {
    const tokenOptRecs = recommendations.filter(r => 
      r.title.includes('Token') || r.title.includes('token')
    );
    const costOptRecs = recommendations.filter(r => r.category === 'cost');
    const timeOptRecs = recommendations.filter(r => 
      r.expectedImpact.timeReduction && r.expectedImpact.timeReduction > 0
    );
    const efficiencyRecs = recommendations.filter(r => r.category === 'efficiency');

    return {
      tokenOptimization: tokenOptRecs.length > 0 ? 0.25 : 0.1, // 25% or 10% reduction
      costOptimization: costOptRecs.length > 0 ? 0.30 : 0.05,  // 30% or 5% reduction  
      timeOptimization: timeOptRecs.length > 0 ? 0.20 : 0.08,  // 20% or 8% reduction
      efficiencyGain: efficiencyRecs.length > 0 ? 0.15 : 0.05   // 15% or 5% gain
    };
  }

  /**
   * Get stored recommendations
   */
  getRecommendations(filters?: {
    category?: string;
    priority?: string;
    minImpact?: number;
  }): OptimizationRecommendation[] {
    let recommendations = Array.from(this.recommendations.values());
    
    if (filters?.category) {
      recommendations = recommendations.filter(r => r.category === filters.category);
    }
    
    if (filters?.priority) {
      recommendations = recommendations.filter(r => r.priority === filters.priority);
    }
    
    if (filters?.minImpact !== undefined) {
      recommendations = recommendations.filter(r => 
        (r.expectedImpact.performance || 0) >= filters.minImpact!
      );
    }
    
    return recommendations;
  }

  /**
   * Get optimization strategies
   */
  getStrategies(): OptimizationStrategy[] {
    return this.strategies;
  }

  /**
   * Clear recommendations cache
   */
  clearRecommendations(): void {
    this.recommendations.clear();
    this.strategies = [];
  }
}