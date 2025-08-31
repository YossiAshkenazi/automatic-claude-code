import { AgentMessage, DualAgentSession, PerformanceMetrics, AgentCommunication } from '../types';
import { MLInsight } from './InsightsEngine';

export interface Anomaly {
  id: string;
  type: 'performance' | 'behavior' | 'pattern' | 'cost' | 'error' | 'communication';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  detectedAt: Date;
  sessionId?: string;
  agentType?: 'manager' | 'worker';
  metrics: {
    actualValue: number;
    expectedValue: number;
    deviationScore: number;
    confidenceLevel: number;
  };
  context: {
    historicalComparison: any;
    relatedEvents: string[];
    possibleCauses: string[];
  };
  recommendations: string[];
  autoResolution?: {
    possible: boolean;
    actions: string[];
    riskLevel: 'low' | 'medium' | 'high';
  };
}

export interface AnomalyPattern {
  patternId: string;
  name: string;
  description: string;
  occurrences: number;
  firstSeen: Date;
  lastSeen: Date;
  affectedSessions: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  isRecurring: boolean;
  frequency: number; // occurrences per day
  characteristics: Record<string, any>;
}

export interface BaselineMetrics {
  performance: {
    meanResponseTime: number;
    stdResponseTime: number;
    meanSuccessRate: number;
    stdSuccessRate: number;
  };
  cost: {
    meanCostPerSession: number;
    stdCostPerSession: number;
    meanTokensPerMessage: number;
    stdTokensPerMessage: number;
  };
  behavior: {
    meanMessagesPerSession: number;
    stdMessagesPerSession: number;
    meanAgentSwitches: number;
    stdAgentSwitches: number;
    meanToolUsage: number;
    stdToolUsage: number;
  };
  communication: {
    meanHandoffTime: number;
    stdHandoffTime: number;
    meanCoordinationScore: number;
    stdCoordinationScore: number;
  };
}

export interface AnomalyDetectionConfig {
  sensitivityLevel: 'low' | 'medium' | 'high';
  enableRealTimeDetection: boolean;
  autoAlertThresholds: {
    criticalAnomalies: boolean;
    highAnomalies: boolean;
    mediumAnomalies: boolean;
  };
  excludePatterns: string[];
  customThresholds: Record<string, number>;
}

export class AnomalyDetector {
  private baselines: BaselineMetrics | null = null;
  private anomalies: Map<string, Anomaly> = new Map();
  private patterns: Map<string, AnomalyPattern> = new Map();
  private config: AnomalyDetectionConfig;
  private subscribers: Set<(anomaly: Anomaly) => void> = new Set();

  constructor(config: Partial<AnomalyDetectionConfig> = {}) {
    this.config = {
      sensitivityLevel: 'medium',
      enableRealTimeDetection: true,
      autoAlertThresholds: {
        criticalAnomalies: true,
        highAnomalies: true,
        mediumAnomalies: false
      },
      excludePatterns: [],
      customThresholds: {},
      ...config
    };
  }

  /**
   * Initialize anomaly detection with historical data
   */
  async initialize(
    sessions: DualAgentSession[],
    metrics: PerformanceMetrics[],
    communications: AgentCommunication[]
  ): Promise<void> {
    console.log('Initializing Anomaly Detector...');

    if (sessions.length < 10) {
      console.warn('Insufficient historical data for baseline calculation');
      return;
    }

    // Calculate baseline metrics from historical data
    this.baselines = await this.calculateBaselines(sessions, metrics, communications);

    // Analyze historical data for existing patterns
    await this.analyzeHistoricalAnomalies(sessions, metrics);

    console.log(`Anomaly Detector initialized with baselines and ${this.patterns.size} known patterns`);
  }

  /**
   * Detect anomalies in real-time session data
   */
  async detectSessionAnomalies(
    session: DualAgentSession,
    recentMetrics: PerformanceMetrics[],
    communications: AgentCommunication[]
  ): Promise<Anomaly[]> {
    if (!this.baselines) {
      return [];
    }

    const anomalies: Anomaly[] = [];

    // Performance anomalies
    anomalies.push(...await this.detectPerformanceAnomalies(session, recentMetrics));

    // Behavioral anomalies  
    anomalies.push(...await this.detectBehavioralAnomalies(session));

    // Communication anomalies
    anomalies.push(...await this.detectCommunicationAnomalies(session, communications));

    // Cost anomalies
    anomalies.push(...await this.detectCostAnomalies(session));

    // Pattern anomalies
    anomalies.push(...await this.detectPatternAnomalies(session));

    // Store detected anomalies
    anomalies.forEach(anomaly => {
      this.anomalies.set(anomaly.id, anomaly);
      
      // Update patterns
      this.updateAnomalyPatterns(anomaly);

      // Real-time notification
      if (this.config.enableRealTimeDetection) {
        this.notifySubscribers(anomaly);
      }
    });

    return anomalies.filter(a => this.shouldReport(a));
  }

  /**
   * Detect anomalies in batch of sessions
   */
  async detectBatchAnomalies(
    sessions: DualAgentSession[],
    metrics: PerformanceMetrics[]
  ): Promise<{
    anomalies: Anomaly[];
    patterns: AnomalyPattern[];
    summary: {
      totalAnomalies: number;
      criticalCount: number;
      highCount: number;
      mediumCount: number;
      lowCount: number;
      mostCommonTypes: Array<{ type: string; count: number }>;
    };
  }> {
    const allAnomalies: Anomaly[] = [];

    for (const session of sessions) {
      const sessionMetrics = metrics.filter(m => m.sessionId === session.id);
      const sessionAnomalies = await this.detectSessionAnomalies(session, sessionMetrics, []);
      allAnomalies.push(...sessionAnomalies);
    }

    // Analyze patterns across all detected anomalies
    const patternAnalysis = this.analyzeAnomalyPatterns(allAnomalies);

    // Generate summary
    const summary = this.generateAnomalySummary(allAnomalies);

    return {
      anomalies: allAnomalies,
      patterns: Array.from(this.patterns.values()),
      summary
    };
  }

  /**
   * Predict potential anomalies based on early indicators
   */
  async predictAnomalies(
    session: DualAgentSession,
    earlyMessages: AgentMessage[]
  ): Promise<{
    predictions: Array<{
      type: Anomaly['type'];
      probability: number;
      expectedSeverity: Anomaly['severity'];
      preventionActions: string[];
    }>;
    overallRiskScore: number;
    recommendations: string[];
  }> {
    if (!this.baselines || earlyMessages.length < 2) {
      return {
        predictions: [],
        overallRiskScore: 0,
        recommendations: ['Insufficient data for anomaly prediction']
      };
    }

    const predictions = [];
    let totalRiskScore = 0;

    // Predict performance anomalies
    const perfPrediction = await this.predictPerformanceAnomalies(earlyMessages);
    if (perfPrediction.probability > 0.3) {
      predictions.push(perfPrediction);
      totalRiskScore += perfPrediction.probability;
    }

    // Predict behavioral anomalies
    const behaviorPrediction = await this.predictBehavioralAnomalies(earlyMessages);
    if (behaviorPrediction.probability > 0.3) {
      predictions.push(behaviorPrediction);
      totalRiskScore += behaviorPrediction.probability;
    }

    // Predict cost anomalies
    const costPrediction = await this.predictCostAnomalies(earlyMessages);
    if (costPrediction.probability > 0.3) {
      predictions.push(costPrediction);
      totalRiskScore += costPrediction.probability;
    }

    const overallRiskScore = Math.min(1, totalRiskScore / 3);
    const recommendations = this.generatePreventiveRecommendations(predictions, overallRiskScore);

    return {
      predictions,
      overallRiskScore,
      recommendations
    };
  }

  /**
   * Get anomaly insights and trends
   */
  getAnomalyInsights(
    timeRangeHours: number = 24
  ): {
    recentAnomalies: Anomaly[];
    trends: {
      increasing: string[];
      decreasing: string[];
      stable: string[];
    };
    hotspots: Array<{
      area: string;
      anomalyCount: number;
      severity: string;
    }>;
    recommendations: string[];
  } {
    const cutoffTime = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000);
    const recentAnomalies = Array.from(this.anomalies.values())
      .filter(a => a.detectedAt >= cutoffTime)
      .sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());

    const trends = this.analyzeTrends(recentAnomalies);
    const hotspots = this.identifyHotspots(recentAnomalies);
    const recommendations = this.generateSystemRecommendations(recentAnomalies, trends);

    return {
      recentAnomalies,
      trends,
      hotspots,
      recommendations
    };
  }

  // Performance Anomaly Detection

  private async detectPerformanceAnomalies(
    session: DualAgentSession,
    metrics: PerformanceMetrics[]
  ): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];
    
    // Response time anomalies
    const avgResponseTime = metrics.length > 0 
      ? metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length
      : 0;

    if (avgResponseTime > 0) {
      const responseTimeAnomaly = this.checkResponseTimeAnomaly(session, avgResponseTime);
      if (responseTimeAnomaly) anomalies.push(responseTimeAnomaly);
    }

    // Success rate anomalies
    if (session.summary?.successRate !== undefined) {
      const successRateAnomaly = this.checkSuccessRateAnomaly(session, session.summary.successRate);
      if (successRateAnomaly) anomalies.push(successRateAnomaly);
    }

    // Token usage anomalies
    const tokenUsage = this.estimateTokenUsage(session);
    const tokenAnomaly = this.checkTokenUsageAnomaly(session, tokenUsage);
    if (tokenAnomaly) anomalies.push(tokenAnomaly);

    return anomalies;
  }

  private checkResponseTimeAnomaly(session: DualAgentSession, avgResponseTime: number): Anomaly | null {
    if (!this.baselines) return null;

    const expected = this.baselines.performance.meanResponseTime;
    const stdDev = this.baselines.performance.stdResponseTime;
    const threshold = this.getThreshold('response_time');

    const zScore = stdDev > 0 ? Math.abs(avgResponseTime - expected) / stdDev : 0;
    
    if (zScore > threshold) {
      const severity = this.calculateSeverity(zScore, threshold);
      
      return {
        id: `perf-response-${session.id}-${Date.now()}`,
        type: 'performance',
        severity,
        title: 'Abnormal Response Time Detected',
        description: `Session response time (${avgResponseTime.toFixed(0)}ms) deviates significantly from baseline (${expected.toFixed(0)}ms)`,
        detectedAt: new Date(),
        sessionId: session.id,
        metrics: {
          actualValue: avgResponseTime,
          expectedValue: expected,
          deviationScore: zScore,
          confidenceLevel: Math.min(0.99, zScore / 10)
        },
        context: {
          historicalComparison: {
            baseline: expected,
            standardDeviation: stdDev,
            percentileRank: this.calculatePercentile(avgResponseTime, this.baselines.performance)
          },
          relatedEvents: [],
          possibleCauses: [
            'Network latency issues',
            'Agent model performance degradation',
            'Increased task complexity',
            'Resource constraints'
          ]
        },
        recommendations: [
          'Check network connectivity and latency',
          'Monitor agent model performance',
          'Review task complexity factors',
          'Consider scaling resources if pattern persists'
        ],
        autoResolution: {
          possible: false,
          actions: ['Alert system administrators', 'Log detailed performance metrics'],
          riskLevel: severity === 'critical' ? 'high' : 'medium'
        }
      };
    }

    return null;
  }

  private checkSuccessRateAnomaly(session: DualAgentSession, successRate: number): Anomaly | null {
    if (!this.baselines) return null;

    const expected = this.baselines.performance.meanSuccessRate;
    const stdDev = this.baselines.performance.stdSuccessRate;
    const threshold = this.getThreshold('success_rate');

    const zScore = stdDev > 0 ? Math.abs(successRate - expected) / stdDev : 0;

    if (zScore > threshold && successRate < expected) {
      const severity = this.calculateSeverity(zScore, threshold);

      return {
        id: `perf-success-${session.id}-${Date.now()}`,
        type: 'performance',
        severity,
        title: 'Low Success Rate Detected',
        description: `Session success rate (${(successRate * 100).toFixed(1)}%) is significantly below baseline (${(expected * 100).toFixed(1)}%)`,
        detectedAt: new Date(),
        sessionId: session.id,
        metrics: {
          actualValue: successRate,
          expectedValue: expected,
          deviationScore: zScore,
          confidenceLevel: Math.min(0.99, zScore / 8)
        },
        context: {
          historicalComparison: {
            baseline: expected,
            standardDeviation: stdDev,
            percentileRank: this.calculatePercentile(successRate, this.baselines.performance)
          },
          relatedEvents: this.findRelatedErrorEvents(session),
          possibleCauses: [
            'Agent configuration issues',
            'Task complexity mismatch',
            'Insufficient context or information',
            'Tool availability problems',
            'Communication breakdown between agents'
          ]
        },
        recommendations: [
          'Review agent prompts and configurations',
          'Analyze failed tasks for common patterns',
          'Check tool availability and functionality',
          'Consider adjusting task breakdown strategy'
        ],
        autoResolution: {
          possible: true,
          actions: [
            'Trigger agent reconfiguration',
            'Activate enhanced error recovery',
            'Request human intervention for complex tasks'
          ],
          riskLevel: 'medium'
        }
      };
    }

    return null;
  }

  private checkTokenUsageAnomaly(session: DualAgentSession, tokenUsage: number): Anomaly | null {
    if (!this.baselines) return null;

    const expected = this.baselines.cost.meanTokensPerMessage * session.messages.length;
    const threshold = this.getThreshold('token_usage');

    const deviationRatio = expected > 0 ? Math.abs(tokenUsage - expected) / expected : 0;

    if (deviationRatio > threshold && tokenUsage > expected) {
      const severity = deviationRatio > threshold * 3 ? 'high' : 'medium';

      return {
        id: `cost-tokens-${session.id}-${Date.now()}`,
        type: 'cost',
        severity,
        title: 'Excessive Token Usage Detected',
        description: `Session token usage (${tokenUsage.toFixed(0)}) significantly exceeds expected usage (${expected.toFixed(0)})`,
        detectedAt: new Date(),
        sessionId: session.id,
        metrics: {
          actualValue: tokenUsage,
          expectedValue: expected,
          deviationScore: deviationRatio,
          confidenceLevel: Math.min(0.95, deviationRatio)
        },
        context: {
          historicalComparison: {
            baseline: expected,
            deviationRatio,
            costImpact: tokenUsage * 0.0002 // Rough cost estimate
          },
          relatedEvents: [],
          possibleCauses: [
            'Verbose agent responses',
            'Inefficient prompt engineering',
            'Context window expansion',
            'Repeated error recovery attempts'
          ]
        },
        recommendations: [
          'Review and optimize agent prompts',
          'Implement response length controls',
          'Check for context window bloat',
          'Analyze error patterns causing retry loops'
        ],
        autoResolution: {
          possible: true,
          actions: [
            'Apply prompt optimization rules',
            'Truncate excessive context',
            'Implement token usage limits'
          ],
          riskLevel: 'medium'
        }
      };
    }

    return null;
  }

  // Behavioral Anomaly Detection

  private async detectBehavioralAnomalies(session: DualAgentSession): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    // Message count anomalies
    const messageCountAnomaly = this.checkMessageCountAnomaly(session);
    if (messageCountAnomaly) anomalies.push(messageCountAnomaly);

    // Agent switching anomalies
    const switchingAnomaly = this.checkAgentSwitchingAnomaly(session);
    if (switchingAnomaly) anomalies.push(switchingAnomaly);

    // Tool usage anomalies
    const toolUsageAnomaly = this.checkToolUsageAnomaly(session);
    if (toolUsageAnomaly) anomalies.push(toolUsageAnomaly);

    // Error pattern anomalies
    const errorPatternAnomaly = this.checkErrorPatternAnomaly(session);
    if (errorPatternAnomaly) anomalies.push(errorPatternAnomaly);

    return anomalies;
  }

  private checkMessageCountAnomaly(session: DualAgentSession): Anomaly | null {
    if (!this.baselines) return null;

    const messageCount = session.messages.length;
    const expected = this.baselines.behavior.meanMessagesPerSession;
    const stdDev = this.baselines.behavior.stdMessagesPerSession;
    const threshold = this.getThreshold('message_count');

    const zScore = stdDev > 0 ? Math.abs(messageCount - expected) / stdDev : 0;

    if (zScore > threshold) {
      const severity = this.calculateSeverity(zScore, threshold);
      const isExcessive = messageCount > expected;

      return {
        id: `behavior-messages-${session.id}-${Date.now()}`,
        type: 'behavior',
        severity,
        title: isExcessive ? 'Excessive Message Exchange' : 'Unusually Brief Session',
        description: `Session message count (${messageCount}) ${isExcessive ? 'exceeds' : 'is below'} expected range (${expected.toFixed(0)} ± ${(stdDev * 2).toFixed(0)})`,
        detectedAt: new Date(),
        sessionId: session.id,
        metrics: {
          actualValue: messageCount,
          expectedValue: expected,
          deviationScore: zScore,
          confidenceLevel: Math.min(0.95, zScore / 6)
        },
        context: {
          historicalComparison: {
            baseline: expected,
            standardDeviation: stdDev,
            isExcessive
          },
          relatedEvents: [],
          possibleCauses: isExcessive ? [
            'Complex task requiring extensive collaboration',
            'Agent confusion or inefficiency',
            'Error recovery loops',
            'Insufficient initial context'
          ] : [
            'Task too simple for dual-agent approach',
            'Premature session termination',
            'Configuration issues'
          ]
        },
        recommendations: isExcessive ? [
          'Analyze task complexity and breakdown',
          'Review agent efficiency patterns',
          'Check for error recovery loops',
          'Consider task preprocessing'
        ] : [
          'Review session termination conditions',
          'Check for configuration issues',
          'Consider task complexity assessment'
        ],
        autoResolution: {
          possible: isExcessive,
          actions: isExcessive ? [
            'Implement conversation length limits',
            'Trigger supervisor intervention',
            'Apply efficiency optimization rules'
          ] : [],
          riskLevel: isExcessive ? 'medium' : 'low'
        }
      };
    }

    return null;
  }

  private checkAgentSwitchingAnomaly(session: DualAgentSession): Anomaly | null {
    if (!this.baselines) return null;

    const agentSwitches = this.countAgentSwitches(session.messages);
    const expected = this.baselines.behavior.meanAgentSwitches;
    const stdDev = this.baselines.behavior.stdAgentSwitches;
    const threshold = this.getThreshold('agent_switches');

    const zScore = stdDev > 0 ? Math.abs(agentSwitches - expected) / stdDev : 0;

    if (zScore > threshold) {
      const severity = this.calculateSeverity(zScore, threshold);
      const isExcessive = agentSwitches > expected;

      return {
        id: `behavior-switches-${session.id}-${Date.now()}`,
        type: 'behavior',
        severity,
        title: isExcessive ? 'Excessive Agent Switching' : 'Poor Agent Collaboration',
        description: `Agent switching pattern (${agentSwitches} switches) deviates from optimal collaboration baseline (${expected.toFixed(1)})`,
        detectedAt: new Date(),
        sessionId: session.id,
        metrics: {
          actualValue: agentSwitches,
          expectedValue: expected,
          deviationScore: zScore,
          confidenceLevel: Math.min(0.90, zScore / 5)
        },
        context: {
          historicalComparison: {
            baseline: expected,
            standardDeviation: stdDev,
            collaborationScore: this.calculateCollaborationScore(session.messages)
          },
          relatedEvents: [],
          possibleCauses: isExcessive ? [
            'Unclear task boundaries',
            'Agent confusion about responsibilities',
            'Inefficient handoff mechanisms'
          ] : [
            'One agent dominating conversation',
            'Poor task distribution',
            'Agent availability issues'
          ]
        },
        recommendations: isExcessive ? [
          'Clarify agent role definitions',
          'Optimize handoff trigger conditions',
          'Implement switching throttling'
        ] : [
          'Review task distribution balance',
          'Check agent availability and responsiveness',
          'Encourage more collaborative patterns'
        ],
        autoResolution: {
          possible: true,
          actions: [
            'Adjust collaboration parameters',
            'Apply role clarification prompts',
            'Implement coordination optimization'
          ],
          riskLevel: 'medium'
        }
      };
    }

    return null;
  }

  private checkToolUsageAnomaly(session: DualAgentSession): Anomaly | null {
    if (!this.baselines) return null;

    const toolUsage = session.messages.reduce((sum, m) => sum + (m.metadata?.tools?.length || 0), 0);
    const expected = this.baselines.behavior.meanToolUsage;
    const threshold = this.getThreshold('tool_usage');

    const deviationRatio = expected > 0 ? Math.abs(toolUsage - expected) / expected : 0;

    if (deviationRatio > threshold) {
      const severity = deviationRatio > threshold * 2 ? 'high' : 'medium';
      const isExcessive = toolUsage > expected;

      return {
        id: `behavior-tools-${session.id}-${Date.now()}`,
        type: 'behavior',
        severity,
        title: isExcessive ? 'Excessive Tool Usage' : 'Insufficient Tool Utilization',
        description: `Tool usage pattern (${toolUsage} calls) ${isExcessive ? 'exceeds' : 'falls below'} expected baseline (${expected.toFixed(1)})`,
        detectedAt: new Date(),
        sessionId: session.id,
        metrics: {
          actualValue: toolUsage,
          expectedValue: expected,
          deviationScore: deviationRatio,
          confidenceLevel: Math.min(0.88, deviationRatio)
        },
        context: {
          historicalComparison: {
            baseline: expected,
            deviationRatio,
            toolDiversity: new Set(session.messages.flatMap(m => m.metadata?.tools || [])).size
          },
          relatedEvents: [],
          possibleCauses: isExcessive ? [
            'Inefficient tool selection',
            'Repetitive tool calls due to errors',
            'Agent over-reliance on tools'
          ] : [
            'Task not requiring tool usage',
            'Tool availability issues',
            'Agent under-utilizing available tools'
          ]
        },
        recommendations: isExcessive ? [
          'Optimize tool selection algorithms',
          'Implement tool usage efficiency rules',
          'Check for error-driven retry loops'
        ] : [
          'Review tool availability and accessibility',
          'Encourage appropriate tool usage',
          'Check task-tool matching logic'
        ],
        autoResolution: {
          possible: true,
          actions: [
            'Apply tool usage optimization',
            'Adjust tool selection logic',
            'Implement usage efficiency monitoring'
          ],
          riskLevel: 'medium'
        }
      };
    }

    return null;
  }

  private checkErrorPatternAnomaly(session: DualAgentSession): Anomaly | null {
    const errorMessages = session.messages.filter(m => m.messageType === 'error');
    
    if (errorMessages.length === 0) return null;

    const errorRate = errorMessages.length / session.messages.length;
    const errorTypes = this.categorizeErrors(errorMessages);
    const hasRecurringErrors = this.detectRecurringErrors(errorMessages);

    if (errorRate > 0.1 || hasRecurringErrors) { // 10% error threshold
      return {
        id: `behavior-errors-${session.id}-${Date.now()}`,
        type: 'error',
        severity: errorRate > 0.2 ? 'high' : 'medium',
        title: hasRecurringErrors ? 'Recurring Error Pattern' : 'High Error Rate',
        description: `Session shows ${hasRecurringErrors ? 'recurring error patterns' : `high error rate (${(errorRate * 100).toFixed(1)}%)`}`,
        detectedAt: new Date(),
        sessionId: session.id,
        metrics: {
          actualValue: errorRate,
          expectedValue: 0.05, // Expected error rate
          deviationScore: errorRate / 0.05,
          confidenceLevel: 0.85
        },
        context: {
          historicalComparison: {
            errorTypes,
            recurringPatterns: hasRecurringErrors,
            errorDistribution: this.analyzeErrorDistribution(errorMessages)
          },
          relatedEvents: errorMessages.slice(0, 3).map(m => m.content),
          possibleCauses: [
            'System instability',
            'Configuration issues',
            'Resource constraints',
            'Agent prompt problems'
          ]
        },
        recommendations: [
          'Analyze error root causes',
          'Implement enhanced error recovery',
          'Review system stability',
          'Check configuration and resources'
        ],
        autoResolution: {
          possible: true,
          actions: [
            'Activate enhanced error recovery',
            'Apply configuration fixes',
            'Implement error prevention rules'
          ],
          riskLevel: 'high'
        }
      };
    }

    return null;
  }

  // Communication Anomaly Detection

  private async detectCommunicationAnomalies(
    session: DualAgentSession,
    communications: AgentCommunication[]
  ): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    if (communications.length === 0) return anomalies;

    // Handoff time anomalies
    const handoffAnomaly = this.checkHandoffTimeAnomaly(session, communications);
    if (handoffAnomaly) anomalies.push(handoffAnomaly);

    // Coordination score anomalies
    const coordinationAnomaly = this.checkCoordinationAnomaly(session, communications);
    if (coordinationAnomaly) anomalies.push(coordinationAnomaly);

    return anomalies;
  }

  private checkHandoffTimeAnomaly(
    session: DualAgentSession,
    communications: AgentCommunication[]
  ): Anomaly | null {
    if (!this.baselines || communications.length < 2) return null;

    const handoffTimes = this.calculateHandoffTimes(communications);
    if (handoffTimes.length === 0) return null;

    const avgHandoffTime = handoffTimes.reduce((sum, time) => sum + time, 0) / handoffTimes.length;
    const expected = this.baselines.communication.meanHandoffTime;
    const stdDev = this.baselines.communication.stdHandoffTime;
    const threshold = this.getThreshold('handoff_time');

    const zScore = stdDev > 0 ? Math.abs(avgHandoffTime - expected) / stdDev : 0;

    if (zScore > threshold && avgHandoffTime > expected) {
      const severity = this.calculateSeverity(zScore, threshold);

      return {
        id: `comm-handoff-${session.id}-${Date.now()}`,
        type: 'communication',
        severity,
        title: 'Slow Agent Handoff Times',
        description: `Average handoff time (${(avgHandoffTime / 1000).toFixed(1)}s) significantly exceeds baseline (${(expected / 1000).toFixed(1)}s)`,
        detectedAt: new Date(),
        sessionId: session.id,
        metrics: {
          actualValue: avgHandoffTime,
          expectedValue: expected,
          deviationScore: zScore,
          confidenceLevel: Math.min(0.90, zScore / 4)
        },
        context: {
          historicalComparison: {
            baseline: expected,
            standardDeviation: stdDev,
            handoffCount: handoffTimes.length
          },
          relatedEvents: [],
          possibleCauses: [
            'Agent processing delays',
            'Network latency issues',
            'Complex handoff negotiations',
            'Resource contention'
          ]
        },
        recommendations: [
          'Optimize agent response times',
          'Check network performance',
          'Simplify handoff protocols',
          'Monitor resource utilization'
        ],
        autoResolution: {
          possible: false,
          actions: ['Monitor handoff performance', 'Log detailed timing metrics'],
          riskLevel: 'medium'
        }
      };
    }

    return null;
  }

  private checkCoordinationAnomaly(
    session: DualAgentSession,
    communications: AgentCommunication[]
  ): Anomaly | null {
    if (!this.baselines) return null;

    const coordinationScore = this.calculateCoordinationScore(session.messages);
    const expected = this.baselines.communication.meanCoordinationScore;
    const threshold = this.getThreshold('coordination');

    const deviation = Math.abs(coordinationScore - expected);
    
    if (deviation > threshold && coordinationScore < expected) {
      return {
        id: `comm-coord-${session.id}-${Date.now()}`,
        type: 'communication',
        severity: 'medium',
        title: 'Poor Agent Coordination',
        description: `Agent coordination score (${coordinationScore.toFixed(2)}) below expected level (${expected.toFixed(2)})`,
        detectedAt: new Date(),
        sessionId: session.id,
        metrics: {
          actualValue: coordinationScore,
          expectedValue: expected,
          deviationScore: deviation / expected,
          confidenceLevel: 0.80
        },
        context: {
          historicalComparison: {
            baseline: expected,
            deviation,
            communicationCount: communications.length
          },
          relatedEvents: [],
          possibleCauses: [
            'Unclear role definitions',
            'Poor task breakdown',
            'Communication protocol issues',
            'Agent prompt problems'
          ]
        },
        recommendations: [
          'Review agent role definitions',
          'Improve task breakdown strategy',
          'Enhance communication protocols',
          'Optimize agent prompts for coordination'
        ],
        autoResolution: {
          possible: true,
          actions: [
            'Apply coordination improvement prompts',
            'Adjust collaboration parameters',
            'Implement coordination monitoring'
          ],
          riskLevel: 'medium'
        }
      };
    }

    return null;
  }

  // Cost Anomaly Detection

  private async detectCostAnomalies(session: DualAgentSession): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    if (!session.summary?.totalCost) return anomalies;

    const costAnomaly = this.checkCostAnomaly(session, session.summary.totalCost);
    if (costAnomaly) anomalies.push(costAnomaly);

    return anomalies;
  }

  private checkCostAnomaly(session: DualAgentSession, totalCost: number): Anomaly | null {
    if (!this.baselines) return null;

    const expected = this.baselines.cost.meanCostPerSession;
    const threshold = this.getThreshold('session_cost');

    const deviationRatio = expected > 0 ? Math.abs(totalCost - expected) / expected : 0;

    if (deviationRatio > threshold && totalCost > expected) {
      const severity = deviationRatio > threshold * 2 ? 'high' : 'medium';

      return {
        id: `cost-session-${session.id}-${Date.now()}`,
        type: 'cost',
        severity,
        title: 'High Session Cost',
        description: `Session cost ($${totalCost.toFixed(2)}) significantly exceeds baseline ($${expected.toFixed(2)})`,
        detectedAt: new Date(),
        sessionId: session.id,
        metrics: {
          actualValue: totalCost,
          expectedValue: expected,
          deviationScore: deviationRatio,
          confidenceLevel: Math.min(0.95, deviationRatio)
        },
        context: {
          historicalComparison: {
            baseline: expected,
            deviationRatio,
            costEfficiency: this.calculateCostEfficiency(session, totalCost)
          },
          relatedEvents: [],
          possibleCauses: [
            'Extended session duration',
            'High token usage',
            'Expensive model usage',
            'Error-driven retry loops'
          ]
        },
        recommendations: [
          'Review session efficiency',
          'Optimize token usage',
          'Check model selection strategy',
          'Analyze error patterns'
        ],
        autoResolution: {
          possible: true,
          actions: [
            'Implement cost monitoring alerts',
            'Apply token optimization',
            'Trigger cost review protocol'
          ],
          riskLevel: 'medium'
        }
      };
    }

    return null;
  }

  // Pattern Anomaly Detection

  private async detectPatternAnomalies(session: DualAgentSession): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    // Check against known problematic patterns
    for (const [patternId, pattern] of this.patterns) {
      if (pattern.severity === 'critical' || pattern.severity === 'high') {
        const matches = this.checkPatternMatch(session, pattern);
        if (matches) {
          anomalies.push(this.createPatternAnomaly(session, pattern));
        }
      }
    }

    return anomalies;
  }

  private checkPatternMatch(session: DualAgentSession, pattern: AnomalyPattern): boolean {
    // Simplified pattern matching - in reality would be more sophisticated
    const sessionCharacteristics = this.extractSessionCharacteristics(session);
    
    let matchCount = 0;
    let totalChecks = 0;

    for (const [key, expectedValue] of Object.entries(pattern.characteristics)) {
      if (sessionCharacteristics[key] !== undefined) {
        totalChecks++;
        const actualValue = sessionCharacteristics[key];
        
        // Allow for some tolerance in matching
        const tolerance = 0.2;
        if (typeof expectedValue === 'number' && typeof actualValue === 'number') {
          const diff = Math.abs(actualValue - expectedValue) / Math.max(expectedValue, 1);
          if (diff <= tolerance) matchCount++;
        } else if (expectedValue === actualValue) {
          matchCount++;
        }
      }
    }

    return totalChecks > 0 && (matchCount / totalChecks) >= 0.7; // 70% match threshold
  }

  private createPatternAnomaly(session: DualAgentSession, pattern: AnomalyPattern): Anomaly {
    return {
      id: `pattern-${pattern.patternId}-${session.id}-${Date.now()}`,
      type: 'pattern',
      severity: pattern.severity,
      title: `Known Problem Pattern: ${pattern.name}`,
      description: pattern.description,
      detectedAt: new Date(),
      sessionId: session.id,
      metrics: {
        actualValue: 1,
        expectedValue: 0,
        deviationScore: 1,
        confidenceLevel: 0.85
      },
      context: {
        historicalComparison: {
          patternOccurrences: pattern.occurrences,
          firstSeen: pattern.firstSeen,
          lastSeen: pattern.lastSeen,
          frequency: pattern.frequency
        },
        relatedEvents: pattern.affectedSessions.slice(-3),
        possibleCauses: [`Known pattern: ${pattern.name}`]
      },
      recommendations: [
        'Apply known mitigation strategies for this pattern',
        'Check recent changes that might trigger this pattern',
        'Consider preventive measures'
      ],
      autoResolution: {
        possible: true,
        actions: [
          'Apply pattern-specific fixes',
          'Activate enhanced monitoring',
          'Trigger escalation if pattern persists'
        ],
        riskLevel: pattern.severity === 'critical' ? 'high' : 'medium'
      }
    };
  }

  // Prediction Methods

  private async predictPerformanceAnomalies(
    earlyMessages: AgentMessage[]
  ): Promise<{
    type: 'performance';
    probability: number;
    expectedSeverity: Anomaly['severity'];
    preventionActions: string[];
  }> {
    const features = this.extractEarlyFeatures(earlyMessages);
    
    // Simple rule-based prediction
    let probability = 0;
    
    if (features.initialResponseTime > 10000) probability += 0.3;
    if (features.errorCount > 0) probability += 0.4;
    if (features.agentAlternation < 0.2) probability += 0.2;
    
    probability = Math.min(1, probability);
    
    const expectedSeverity: Anomaly['severity'] = probability > 0.7 ? 'high' : 
                                                 probability > 0.5 ? 'medium' : 'low';

    return {
      type: 'performance',
      probability,
      expectedSeverity,
      preventionActions: [
        'Monitor response times closely',
        'Implement early intervention triggers',
        'Prepare error recovery protocols'
      ]
    };
  }

  private async predictBehavioralAnomalies(
    earlyMessages: AgentMessage[]
  ): Promise<{
    type: 'behavior';
    probability: number;
    expectedSeverity: Anomaly['severity'];
    preventionActions: string[];
  }> {
    const features = this.extractEarlyFeatures(earlyMessages);
    
    let probability = 0;
    
    if (features.messageCount > 10) probability += 0.2; // Many early messages
    if (features.toolDiversity === 0) probability += 0.3; // No tool usage
    if (features.agentAlternation > 0.8) probability += 0.3; // Too much switching
    
    probability = Math.min(1, probability);
    
    const expectedSeverity: Anomaly['severity'] = probability > 0.6 ? 'medium' : 'low';

    return {
      type: 'behavior',
      probability,
      expectedSeverity,
      preventionActions: [
        'Monitor conversation length',
        'Ensure appropriate tool usage',
        'Balance agent interactions'
      ]
    };
  }

  private async predictCostAnomalies(
    earlyMessages: AgentMessage[]
  ): Promise<{
    type: 'cost';
    probability: number;
    expectedSeverity: Anomaly['severity'];
    preventionActions: string[];
  }> {
    const features = this.extractEarlyFeatures(earlyMessages);
    
    let probability = 0;
    
    if (features.avgMessageLength > 1000) probability += 0.3; // Long messages
    if (features.toolCallCount > 5) probability += 0.2; // Many tool calls
    if (features.messageCount > 8) probability += 0.2; // Many early messages
    
    probability = Math.min(1, probability);
    
    const expectedSeverity: Anomaly['severity'] = probability > 0.7 ? 'high' : 
                                                 probability > 0.4 ? 'medium' : 'low';

    return {
      type: 'cost',
      probability,
      expectedSeverity,
      preventionActions: [
        'Implement token usage limits',
        'Monitor message length',
        'Control tool usage frequency'
      ]
    };
  }

  // Utility Methods

  private calculateBaselines(
    sessions: DualAgentSession[],
    metrics: PerformanceMetrics[],
    communications: AgentCommunication[]
  ): BaselineMetrics {
    // Performance baselines
    const responseTimes = metrics.map(m => m.responseTime);
    const successRates = sessions
      .filter(s => s.summary?.successRate !== undefined)
      .map(s => s.summary!.successRate);

    // Cost baselines
    const costsPerSession = sessions
      .filter(s => s.summary?.totalCost !== undefined)
      .map(s => s.summary!.totalCost);
    const tokensPerMessage = sessions.flatMap(s => 
      s.messages.map(m => this.estimateMessageTokens(m))
    );

    // Behavior baselines
    const messagesPerSession = sessions.map(s => s.messages.length);
    const agentSwitches = sessions.map(s => this.countAgentSwitches(s.messages));
    const toolUsage = sessions.map(s => 
      s.messages.reduce((sum, m) => sum + (m.metadata?.tools?.length || 0), 0)
    );

    // Communication baselines
    const handoffTimes = this.calculateAllHandoffTimes(communications);
    const coordinationScores = sessions.map(s => this.calculateCoordinationScore(s.messages));

    return {
      performance: {
        meanResponseTime: this.calculateMean(responseTimes),
        stdResponseTime: this.calculateStandardDeviation(responseTimes),
        meanSuccessRate: this.calculateMean(successRates),
        stdSuccessRate: this.calculateStandardDeviation(successRates)
      },
      cost: {
        meanCostPerSession: this.calculateMean(costsPerSession.filter(c => c !== undefined) as number[]),
        stdCostPerSession: this.calculateStandardDeviation(costsPerSession.filter(c => c !== undefined) as number[]),
        meanTokensPerMessage: this.calculateMean(tokensPerMessage.filter(t => t !== undefined) as number[]),
        stdTokensPerMessage: this.calculateStandardDeviation(tokensPerMessage.filter(t => t !== undefined) as number[])
      },
      behavior: {
        meanMessagesPerSession: this.calculateMean(messagesPerSession),
        stdMessagesPerSession: this.calculateStandardDeviation(messagesPerSession),
        meanAgentSwitches: this.calculateMean(agentSwitches),
        stdAgentSwitches: this.calculateStandardDeviation(agentSwitches),
        meanToolUsage: this.calculateMean(toolUsage),
        stdToolUsage: this.calculateStandardDeviation(toolUsage)
      },
      communication: {
        meanHandoffTime: this.calculateMean(handoffTimes),
        stdHandoffTime: this.calculateStandardDeviation(handoffTimes),
        meanCoordinationScore: this.calculateMean(coordinationScores),
        stdCoordinationScore: this.calculateStandardDeviation(coordinationScores)
      }
    };
  }

  private async analyzeHistoricalAnomalies(
    sessions: DualAgentSession[],
    metrics: PerformanceMetrics[]
  ): Promise<void> {
    // Analyze historical sessions for recurring anomaly patterns
    for (const session of sessions) {
      const sessionMetrics = metrics.filter(m => m.sessionId === session.id);
      const anomalies = await this.detectSessionAnomalies(session, sessionMetrics, []);
      
      anomalies.forEach(anomaly => {
        this.updateAnomalyPatterns(anomaly);
      });
    }
  }

  private updateAnomalyPatterns(anomaly: Anomaly): void {
    const patternKey = this.generatePatternKey(anomaly);
    
    if (this.patterns.has(patternKey)) {
      const pattern = this.patterns.get(patternKey)!;
      pattern.occurrences++;
      pattern.lastSeen = anomaly.detectedAt;
      if (anomaly.sessionId) {
        pattern.affectedSessions.push(anomaly.sessionId);
      }
      
      // Update frequency calculation
      const daysDiff = (pattern.lastSeen.getTime() - pattern.firstSeen.getTime()) / (24 * 60 * 60 * 1000);
      pattern.frequency = daysDiff > 0 ? pattern.occurrences / daysDiff : 0;
      pattern.isRecurring = pattern.occurrences >= 3 && pattern.frequency > 0.1; // More than once per 10 days
    } else {
      const newPattern: AnomalyPattern = {
        patternId: patternKey,
        name: `${anomaly.type} - ${anomaly.title}`,
        description: anomaly.description,
        occurrences: 1,
        firstSeen: anomaly.detectedAt,
        lastSeen: anomaly.detectedAt,
        affectedSessions: anomaly.sessionId ? [anomaly.sessionId] : [],
        severity: anomaly.severity,
        isRecurring: false,
        frequency: 0,
        characteristics: this.extractAnomalyCharacteristics(anomaly)
      };
      
      this.patterns.set(patternKey, newPattern);
    }
  }

  private generatePatternKey(anomaly: Anomaly): string {
    return `${anomaly.type}-${anomaly.title.toLowerCase().replace(/\s+/g, '-')}`;
  }

  private extractAnomalyCharacteristics(anomaly: Anomaly): Record<string, any> {
    return {
      type: anomaly.type,
      severity: anomaly.severity,
      deviationScore: anomaly.metrics.deviationScore,
      confidenceLevel: anomaly.metrics.confidenceLevel
    };
  }

  private extractSessionCharacteristics(session: DualAgentSession): Record<string, any> {
    return {
      messageCount: session.messages.length,
      managerMessages: session.messages.filter(m => m.agentType === 'manager').length,
      workerMessages: session.messages.filter(m => m.agentType === 'worker').length,
      errorCount: session.messages.filter(m => m.messageType === 'error').length,
      toolUsage: session.messages.reduce((sum, m) => sum + (m.metadata?.tools?.length || 0), 0),
      agentSwitches: this.countAgentSwitches(session.messages),
      avgMessageLength: session.messages.reduce((sum, m) => sum + m.content.length, 0) / Math.max(session.messages.length, 1)
    };
  }

  private extractEarlyFeatures(messages: AgentMessage[]): Record<string, number> {
    return {
      messageCount: messages.length,
      errorCount: messages.filter(m => m.messageType === 'error').length,
      toolCallCount: messages.reduce((sum, m) => sum + (m.metadata?.tools?.length || 0), 0),
      avgMessageLength: messages.reduce((sum, m) => sum + m.content.length, 0) / Math.max(messages.length, 1),
      initialResponseTime: messages[1]?.metadata?.duration || 0,
      agentAlternation: this.calculateAlternationRate(messages),
      toolDiversity: new Set(messages.flatMap(m => m.metadata?.tools || [])).size
    };
  }

  private shouldReport(anomaly: Anomaly): boolean {
    const thresholds = this.config.autoAlertThresholds;
    
    switch (anomaly.severity) {
      case 'critical': return thresholds.criticalAnomalies;
      case 'high': return thresholds.highAnomalies;
      case 'medium': return thresholds.mediumAnomalies;
      case 'low': return false; // Never auto-report low severity
      default: return false;
    }
  }

  private notifySubscribers(anomaly: Anomaly): void {
    this.subscribers.forEach(callback => {
      try {
        callback(anomaly);
      } catch (error) {
        console.error('Error in anomaly notification callback:', error);
      }
    });
  }

  private getThreshold(metric: string): number {
    const customThreshold = this.config.customThresholds[metric];
    if (customThreshold) return customThreshold;

    const sensitivityMultipliers = {
      low: 3.0,
      medium: 2.0,
      high: 1.5
    };

    return sensitivityMultipliers[this.config.sensitivityLevel];
  }

  private calculateSeverity(zScore: number, threshold: number): Anomaly['severity'] {
    if (zScore > threshold * 3) return 'critical';
    if (zScore > threshold * 2) return 'high';
    if (zScore > threshold * 1.5) return 'medium';
    return 'low';
  }

  private calculateMean(values: number[]): number {
    return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
  }

  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = this.calculateMean(values);
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return Math.sqrt(variance);
  }

  private calculatePercentile(value: number, baseline: any): number {
    // Simplified percentile calculation
    return value > baseline.meanResponseTime ? 75 : 25;
  }

  private countAgentSwitches(messages: AgentMessage[]): number {
    let switches = 0;
    for (let i = 1; i < messages.length; i++) {
      if (messages[i].agentType !== messages[i-1].agentType) {
        switches++;
      }
    }
    return switches;
  }

  private calculateAlternationRate(messages: AgentMessage[]): number {
    if (messages.length < 2) return 0;
    const switches = this.countAgentSwitches(messages);
    return switches / (messages.length - 1);
  }

  private calculateCollaborationScore(messages: AgentMessage[]): number {
    if (messages.length < 2) return 0;
    
    const alternationRate = this.calculateAlternationRate(messages);
    // Optimal alternation rate is around 0.3-0.7
    const optimalRange = alternationRate >= 0.3 && alternationRate <= 0.7;
    
    return optimalRange ? alternationRate : Math.max(0, 1 - Math.abs(alternationRate - 0.5) * 2);
  }

  private calculateCoordinationScore(messages: AgentMessage[]): number {
    // Simplified coordination score based on alternation and response patterns
    const alternationRate = this.calculateAlternationRate(messages);
    const hasErrors = messages.some(m => m.messageType === 'error');
    
    let score = alternationRate * 0.7; // Base score from alternation
    
    if (hasErrors) score -= 0.2; // Penalty for errors
    if (messages.length < 3) score -= 0.1; // Penalty for very short sessions
    
    return Math.max(0, Math.min(1, score));
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

  private calculateAllHandoffTimes(communications: AgentCommunication[]): number[] {
    return this.calculateHandoffTimes(communications);
  }

  private estimateTokenUsage(session: DualAgentSession): number {
    return session.messages.reduce((sum, m) => sum + this.estimateMessageTokens(m), 0);
  }

  private estimateMessageTokens(message: AgentMessage): number {
    return message.content.length / 4; // Rough estimate: 4 characters per token
  }

  private calculateCostEfficiency(session: DualAgentSession, cost: number): number {
    const performance = session.summary?.successRate || 0;
    return cost > 0 ? performance / cost : 0;
  }

  private findRelatedErrorEvents(session: DualAgentSession): string[] {
    return session.messages
      .filter(m => m.messageType === 'error')
      .slice(0, 3)
      .map(m => `Error at ${m.timestamp.toISOString()}: ${m.content.substring(0, 100)}...`);
  }

  private categorizeErrors(errorMessages: AgentMessage[]): Record<string, number> {
    const categories: Record<string, number> = {};
    
    errorMessages.forEach(message => {
      // Simple error categorization based on content
      const content = message.content.toLowerCase();
      let category = 'unknown';
      
      if (content.includes('timeout')) category = 'timeout';
      else if (content.includes('permission')) category = 'permission';
      else if (content.includes('network')) category = 'network';
      else if (content.includes('parse') || content.includes('syntax')) category = 'parsing';
      else if (content.includes('file') || content.includes('not found')) category = 'file_system';
      
      categories[category] = (categories[category] || 0) + 1;
    });
    
    return categories;
  }

  private detectRecurringErrors(errorMessages: AgentMessage[]): boolean {
    if (errorMessages.length < 2) return false;
    
    const errorContents = errorMessages.map(m => m.content.toLowerCase().substring(0, 50));
    const uniqueErrors = new Set(errorContents);
    
    return uniqueErrors.size < errorMessages.length * 0.7; // Less than 70% unique = recurring
  }

  private analyzeErrorDistribution(errorMessages: AgentMessage[]): any {
    return {
      totalErrors: errorMessages.length,
      errorTypes: this.categorizeErrors(errorMessages),
      temporalDistribution: this.analyzeErrorTiming(errorMessages)
    };
  }

  private analyzeErrorTiming(errorMessages: AgentMessage[]): any {
    if (errorMessages.length === 0) return {};
    
    const firstError = errorMessages[0].timestamp;
    const lastError = errorMessages[errorMessages.length - 1].timestamp;
    const duration = lastError.getTime() - firstError.getTime();
    
    return {
      firstErrorTime: firstError,
      lastErrorTime: lastError,
      errorSpan: duration,
      errorRate: errorMessages.length / Math.max(duration / 60000, 1) // errors per minute
    };
  }

  private analyzeAnomalyPatterns(anomalies: Anomaly[]): void {
    // Update pattern statistics based on batch analysis
    const typeGroups = anomalies.reduce((groups, anomaly) => {
      if (!groups[anomaly.type]) groups[anomaly.type] = [];
      groups[anomaly.type].push(anomaly);
      return groups;
    }, {} as Record<string, Anomaly[]>);

    // Update existing patterns or create new ones
    Object.entries(typeGroups).forEach(([type, groupAnomalies]) => {
      groupAnomalies.forEach(anomaly => {
        this.updateAnomalyPatterns(anomaly);
      });
    });
  }

  private generateAnomalySummary(
    anomalies: Anomaly[]
  ): {
    totalAnomalies: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    mostCommonTypes: Array<{ type: string; count: number }>;
  } {
    const severityCounts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    const typeCounts: Record<string, number> = {};

    anomalies.forEach(anomaly => {
      severityCounts[anomaly.severity]++;
      typeCounts[anomaly.type] = (typeCounts[anomaly.type] || 0) + 1;
    });

    const mostCommonTypes = Object.entries(typeCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalAnomalies: anomalies.length,
      criticalCount: severityCounts.critical,
      highCount: severityCounts.high,
      mediumCount: severityCounts.medium,
      lowCount: severityCounts.low,
      mostCommonTypes
    };
  }

  private analyzeTrends(anomalies: Anomaly[]): {
    increasing: string[];
    decreasing: string[];
    stable: string[];
  } {
    // Simple trend analysis based on recent vs older anomalies
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const twoHoursAgo = now - 2 * 60 * 60 * 1000;

    const recentAnomalies = anomalies.filter(a => a.detectedAt.getTime() > oneHourAgo);
    const olderAnomalies = anomalies.filter(a => 
      a.detectedAt.getTime() <= oneHourAgo && a.detectedAt.getTime() > twoHoursAgo
    );

    const recentTypes = this.getAnomalyTypeCounts(recentAnomalies);
    const olderTypes = this.getAnomalyTypeCounts(olderAnomalies);

    const increasing: string[] = [];
    const decreasing: string[] = [];
    const stable: string[] = [];

    const allTypes = new Set([...Object.keys(recentTypes), ...Object.keys(olderTypes)]);

    allTypes.forEach(type => {
      const recent = recentTypes[type] || 0;
      const older = olderTypes[type] || 0;
      
      if (recent > older * 1.5) {
        increasing.push(type);
      } else if (recent < older * 0.5) {
        decreasing.push(type);
      } else {
        stable.push(type);
      }
    });

    return { increasing, decreasing, stable };
  }

  private getAnomalyTypeCounts(anomalies: Anomaly[]): Record<string, number> {
    return anomalies.reduce((counts, anomaly) => {
      counts[anomaly.type] = (counts[anomaly.type] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
  }

  private identifyHotspots(anomalies: Anomaly[]): Array<{
    area: string;
    anomalyCount: number;
    severity: string;
  }> {
    const areas: Record<string, { count: number; severities: string[] }> = {};

    anomalies.forEach(anomaly => {
      const area = anomaly.sessionId || anomaly.type;
      if (!areas[area]) {
        areas[area] = { count: 0, severities: [] };
      }
      areas[area].count++;
      areas[area].severities.push(anomaly.severity);
    });

    return Object.entries(areas)
      .map(([area, data]) => {
        const avgSeverity = this.calculateAverageSeverity(data.severities);
        return {
          area,
          anomalyCount: data.count,
          severity: avgSeverity
        };
      })
      .sort((a, b) => b.anomalyCount - a.anomalyCount)
      .slice(0, 10);
  }

  private calculateAverageSeverity(severities: string[]): string {
    const severityScores = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4
    };

    const avgScore = severities.reduce((sum, severity) => 
      sum + severityScores[severity as keyof typeof severityScores], 0
    ) / severities.length;

    if (avgScore >= 3.5) return 'critical';
    if (avgScore >= 2.5) return 'high';
    if (avgScore >= 1.5) return 'medium';
    return 'low';
  }

  private generateSystemRecommendations(
    anomalies: Anomaly[],
    trends: { increasing: string[]; decreasing: string[]; stable: string[] }
  ): string[] {
    const recommendations: string[] = [];

    if (anomalies.filter(a => a.severity === 'critical').length > 0) {
      recommendations.push('Immediate attention required for critical anomalies');
    }

    if (trends.increasing.length > 0) {
      recommendations.push(`Monitor increasing anomaly trends in: ${trends.increasing.join(', ')}`);
    }

    const performanceAnomalies = anomalies.filter(a => a.type === 'performance').length;
    if (performanceAnomalies > anomalies.length * 0.3) {
      recommendations.push('Performance anomalies are prevalent - consider system optimization');
    }

    const errorAnomalies = anomalies.filter(a => a.type === 'error').length;
    if (errorAnomalies > anomalies.length * 0.2) {
      recommendations.push('High error anomaly rate detected - review system stability');
    }

    return recommendations;
  }

  private generatePreventiveRecommendations(
    predictions: Array<{
      type: Anomaly['type'];
      probability: number;
      expectedSeverity: Anomaly['severity'];
      preventionActions: string[];
    }>,
    overallRiskScore: number
  ): string[] {
    const recommendations: string[] = [];

    if (overallRiskScore > 0.7) {
      recommendations.push('High anomaly risk detected - implement immediate monitoring');
    }

    const highRiskPredictions = predictions.filter(p => p.probability > 0.6);
    if (highRiskPredictions.length > 0) {
      recommendations.push('Activate preventive measures for high-risk predictions');
      recommendations.push(...highRiskPredictions.flatMap(p => p.preventionActions));
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Subscribe to real-time anomaly notifications
   */
  subscribe(callback: (anomaly: Anomaly) => void): () => void {
    this.subscribers.add(callback);
    
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Get all detected anomalies
   */
  getAnomalies(filters?: {
    type?: Anomaly['type'];
    severity?: Anomaly['severity'];
    sessionId?: string;
    since?: Date;
  }): Anomaly[] {
    let anomalies = Array.from(this.anomalies.values());

    if (filters?.type) {
      anomalies = anomalies.filter(a => a.type === filters.type);
    }

    if (filters?.severity) {
      anomalies = anomalies.filter(a => a.severity === filters.severity);
    }

    if (filters?.sessionId) {
      anomalies = anomalies.filter(a => a.sessionId === filters.sessionId);
    }

    if (filters?.since) {
      anomalies = anomalies.filter(a => a.detectedAt >= filters.since!);
    }

    return anomalies.sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
  }

  /**
   * Get anomaly patterns
   */
  getPatterns(): AnomalyPattern[] {
    return Array.from(this.patterns.values())
      .sort((a, b) => b.occurrences - a.occurrences);
  }

  /**
   * Get baseline metrics
   */
  getBaselines(): BaselineMetrics | null {
    return this.baselines;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AnomalyDetectionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Clear anomalies and patterns
   */
  clearAnomalies(): void {
    this.anomalies.clear();
    this.patterns.clear();
  }

  /**
   * Get configuration
   */
  getConfig(): AnomalyDetectionConfig {
    return { ...this.config };
  }
}