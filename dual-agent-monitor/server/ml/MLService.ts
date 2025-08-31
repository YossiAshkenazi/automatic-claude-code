import { InMemoryDatabaseService } from '../database/InMemoryDatabaseService';
import { DatabaseService } from '../database/DatabaseService';
import { AgentMessage, DualAgentSession, PerformanceMetrics, AgentCommunication } from '../types';
import { InsightsEngine, MLInsight, PatternAnalysis, PerformanceClusters } from './InsightsEngine';
import { OptimizationRecommendations, OptimizationRecommendation, OptimizationStrategy, ResourceOptimization } from './OptimizationRecommendations';
import { PredictiveAnalytics, PredictionModel, Prediction, ResourceForecast, TrendAnalysis } from './PredictiveAnalytics';
import { AnomalyDetector, Anomaly, AnomalyPattern, AnomalyDetectionConfig } from './AnomalyDetector';

export interface MLServiceConfig {
  enableRealTimeAnalysis: boolean;
  insightGenerationInterval: number; // milliseconds
  anomalyDetectionSensitivity: 'low' | 'medium' | 'high';
  predictionModelRetranInterval: number; // milliseconds
  maxInsightsHistory: number;
}

export interface MLServiceStatus {
  initialized: boolean;
  modelsCount: number;
  insightsCount: number;
  anomaliesCount: number;
  recommendationsCount: number;
  lastAnalysisTime: Date | null;
  systemHealth: {
    insightsEngine: boolean;
    optimizationEngine: boolean;
    predictiveEngine: boolean;
    anomalyDetector: boolean;
  };
}

export class MLService {
  private dbService: DatabaseService | InMemoryDatabaseService;
  public insightsEngine: InsightsEngine;
  private optimizationRecommendations: OptimizationRecommendations;
  private predictiveAnalytics: PredictiveAnalytics;
  private anomalyDetector: AnomalyDetector;
  
  private config: MLServiceConfig;
  private initialized = false;
  private analysisInterval: NodeJS.Timeout | null = null;
  private retrainInterval: NodeJS.Timeout | null = null;
  
  // Cache for frequently accessed data
  private cache = {
    insights: [] as MLInsight[],
    recommendations: [] as OptimizationRecommendation[],
    strategies: [] as OptimizationStrategy[],
    resourceOptimization: null as ResourceOptimization | null,
    resourceForecast: null as ResourceForecast | null,
    trends: [] as TrendAnalysis[],
    anomalies: [] as Anomaly[],
    anomalyPatterns: [] as AnomalyPattern[],
    anomalyInsights: null as any | null,
    lastUpdate: new Date()
  };

  // Subscribers for real-time updates
  private subscribers: Set<(data: any) => void> = new Set();

  constructor(
    dbService: DatabaseService | InMemoryDatabaseService,
    config: Partial<MLServiceConfig> = {}
  ) {
    this.dbService = dbService;
    this.config = {
      enableRealTimeAnalysis: true,
      insightGenerationInterval: 5 * 60 * 1000, // 5 minutes
      anomalyDetectionSensitivity: 'medium',
      predictionModelRetranInterval: 60 * 60 * 1000, // 1 hour
      maxInsightsHistory: 1000,
      ...config
    };

    this.insightsEngine = new InsightsEngine();
    this.optimizationRecommendations = new OptimizationRecommendations();
    this.predictiveAnalytics = new PredictiveAnalytics();
    this.anomalyDetector = new AnomalyDetector({
      sensitivityLevel: this.config.anomalyDetectionSensitivity,
      enableRealTimeDetection: this.config.enableRealTimeAnalysis,
      autoAlertThresholds: {
        criticalAnomalies: true,
        highAnomalies: true,
        mediumAnomalies: false
      }
    });
  }

  /**
   * Initialize ML service with historical data
   */
  async initialize(): Promise<void> {
    console.log('Initializing ML Service...');

    try {
      // Load historical data
      const sessions = await this.dbService.getAllSessions();
      const allMetrics: PerformanceMetrics[] = [];
      const allCommunications: AgentCommunication[] = [];

      // Collect metrics and communications from all sessions
      for (const session of sessions) {
        try {
          const sessionMetrics = await this.dbService.getSessionMetrics(session.id);
          const sessionCommunications = await this.dbService.getSessionCommunications(session.id);
          
          allMetrics.push(...sessionMetrics);
          allCommunications.push(...sessionCommunications);
        } catch (error) {
          console.warn(`Failed to load data for session ${session.id}:`, error);
        }
      }

      // Initialize ML engines
      await Promise.all([
        this.predictiveAnalytics.initialize(sessions, allMetrics),
        this.anomalyDetector.initialize(sessions, allMetrics, allCommunications)
      ]);

      // Generate initial insights and recommendations
      await this.performFullAnalysis();

      // Set up real-time analysis if enabled
      if (this.config.enableRealTimeAnalysis) {
        this.setupRealTimeAnalysis();
      }

      // Set up model retraining
      this.setupModelRetraining();

      // Subscribe to anomaly alerts
      this.anomalyDetector.subscribe((anomaly) => {
        this.handleAnomalyAlert(anomaly);
      });

      this.initialized = true;
      console.log(`ML Service initialized with ${sessions.length} sessions and ${allMetrics.length} metrics`);

    } catch (error) {
      console.error('Error initializing ML Service:', error);
      throw error;
    }
  }

  /**
   * Perform comprehensive analysis of all data
   */
  async performFullAnalysis(): Promise<void> {
    console.log('Performing full ML analysis...');
    
    try {
      const sessions = await this.dbService.getAllSessions();
      const allMetrics: PerformanceMetrics[] = [];
      const allCommunications: AgentCommunication[] = [];

      // Collect all data
      for (const session of sessions) {
        try {
          const sessionMetrics = await this.dbService.getSessionMetrics(session.id);
          const sessionCommunications = await this.dbService.getSessionCommunications(session.id);
          
          allMetrics.push(...sessionMetrics);
          allCommunications.push(...sessionCommunications);
        } catch (error) {
          console.warn(`Failed to load data for session ${session.id}:`, error);
        }
      }

      // Generate insights
      const insights = await this.insightsEngine.analyzeAndGenerateInsights(
        sessions,
        allMetrics,
        allCommunications
      );

      // Get patterns and clusters
      const patterns = await this.insightsEngine.analyzeCollaborationPatterns(sessions, allCommunications);
      const clusters = await this.insightsEngine.performanceClusterAnalysis(sessions, allMetrics);

      // Generate recommendations
      const recommendations = await this.optimizationRecommendations.generateRecommendations(
        insights,
        patterns,
        clusters,
        sessions,
        allMetrics
      );

      // Generate strategies
      const strategies = this.optimizationRecommendations.generateOptimizationStrategies(recommendations);

      // Calculate resource optimization
      const resourceOptimization = this.optimizationRecommendations.calculateResourceOptimization(
        sessions,
        recommendations
      );

      // Generate forecasts
      const resourceForecast = await this.predictiveAnalytics.generateResourceForecast(sessions);

      // Analyze trends
      const trends = await this.predictiveAnalytics.analyzeTrends(sessions, allMetrics);

      // Detect anomalies
      const anomalyBatch = await this.anomalyDetector.detectBatchAnomalies(sessions, allMetrics);
      const anomalyPatterns = this.anomalyDetector.getPatterns();
      const anomalyInsights = this.anomalyDetector.getAnomalyInsights();

      // Update cache
      this.cache = {
        insights,
        recommendations,
        strategies,
        resourceOptimization,
        resourceForecast,
        trends,
        anomalies: anomalyBatch.anomalies,
        anomalyPatterns,
        anomalyInsights,
        lastUpdate: new Date()
      };

      // Notify subscribers
      this.notifySubscribers('analysis:complete', {
        insights,
        recommendations,
        anomalies: anomalyBatch.anomalies,
        summary: {
          insightsCount: insights.length,
          recommendationsCount: recommendations.length,
          anomaliesCount: anomalyBatch.anomalies.length,
          analysisTime: new Date()
        }
      });

      console.log(`Full analysis complete: ${insights.length} insights, ${recommendations.length} recommendations, ${anomalyBatch.anomalies.length} anomalies`);

    } catch (error) {
      console.error('Error performing full analysis:', error);
      throw error;
    }
  }

  /**
   * Analyze a single session in real-time
   */
  async analyzeSession(
    session: DualAgentSession,
    includeRecommendations: boolean = true
  ): Promise<{
    insights: MLInsight[];
    anomalies: Anomaly[];
    predictions: any;
    recommendations: OptimizationRecommendation[];
  }> {
    try {
      const sessionMetrics = await this.dbService.getSessionMetrics(session.id);
      const sessionCommunications = await this.dbService.getSessionCommunications(session.id);

      // Detect anomalies in real-time
      const anomalies = await this.anomalyDetector.detectSessionAnomalies(
        session,
        sessionMetrics,
        sessionCommunications
      );

      // Predict session outcome if session is still running
      let predictions = null;
      if (session.status === 'running' && session.messages.length >= 2) {
        predictions = await this.predictiveAnalytics.predictSessionOutcome(
          session.id,
          session.messages.slice(0, Math.min(5, session.messages.length))
        );
      }

      // Generate session-specific insights (simplified version)
      const sessionInsights = await this.generateSessionInsights(session, anomalies, predictions);

      // Generate session-specific recommendations if requested
      let recommendations: OptimizationRecommendation[] = [];
      if (includeRecommendations && anomalies.length > 0) {
        recommendations = await this.generateSessionRecommendations(session, anomalies);
      }

      return {
        insights: sessionInsights,
        anomalies,
        predictions,
        recommendations
      };

    } catch (error) {
      console.error(`Error analyzing session ${session.id}:`, error);
      throw error;
    }
  }

  /**
   * Get current insights
   */
  getInsights(filters?: {
    type?: string;
    severity?: string;
    minConfidence?: number;
  }): MLInsight[] {
    return this.cache.insights.filter(insight => {
      if (filters?.type && insight.type !== filters.type) return false;
      if (filters?.severity && insight.severity !== filters.severity) return false;
      if (filters?.minConfidence && insight.confidence < filters.minConfidence) return false;
      return true;
    });
  }

  /**
   * Get current recommendations
   */
  getRecommendations(filters?: {
    category?: string;
    priority?: string;
    minImpact?: number;
  }): OptimizationRecommendation[] {
    return this.cache.recommendations.filter(rec => {
      if (filters?.category && rec.category !== filters.category) return false;
      if (filters?.priority && rec.priority !== filters.priority) return false;
      if (filters?.minImpact && (rec.expectedImpact.performance || 0) < filters.minImpact) return false;
      return true;
    });
  }

  /**
   * Get optimization strategies
   */
  getOptimizationStrategies(): OptimizationStrategy[] {
    return this.cache.strategies;
  }

  /**
   * Get resource optimization data
   */
  getResourceOptimization(): ResourceOptimization | null {
    return this.cache.resourceOptimization;
  }

  /**
   * Get resource forecast
   */
  getResourceForecast(days?: number): Promise<ResourceForecast | null> {
    if (days && days !== 30) {
      // Generate new forecast for different time period
      return this.generateCustomForecast(days);
    }
    return Promise.resolve(this.cache.resourceForecast);
  }

  /**
   * Get trend analysis
   */
  getTrends(): TrendAnalysis[] {
    return this.cache.trends;
  }

  /**
   * Get anomalies
   */
  getAnomalies(filters?: {
    type?: 'performance' | 'behavior' | 'pattern' | 'cost' | 'error' | 'communication';
    severity?: 'low' | 'medium' | 'high' | 'critical';
    sessionId?: string;
    since?: Date;
  }): Anomaly[] {
    return this.anomalyDetector.getAnomalies(filters);
  }

  /**
   * Get anomaly patterns
   */
  getAnomalyPatterns(): AnomalyPattern[] {
    return this.cache.anomalyPatterns;
  }

  /**
   * Get anomaly insights
   */
  getAnomalyInsights(): any | null {
    return this.cache.anomalyInsights;
  }

  /**
   * Get prediction models
   */
  getPredictionModels(): PredictionModel[] {
    return this.predictiveAnalytics.getModels();
  }

  /**
   * Get service status
   */
  getStatus(): MLServiceStatus {
    return {
      initialized: this.initialized,
      modelsCount: this.predictiveAnalytics.getModels().length,
      insightsCount: this.cache.insights.length,
      anomaliesCount: this.cache.anomalies.length,
      recommendationsCount: this.cache.recommendations.length,
      lastAnalysisTime: this.cache.lastUpdate,
      systemHealth: {
        insightsEngine: true,
        optimizationEngine: true,
        predictiveEngine: this.predictiveAnalytics.getModels().length > 0,
        anomalyDetector: this.anomalyDetector.getBaselines() !== null
      }
    };
  }

  /**
   * Subscribe to ML updates
   */
  subscribe(callback: (data: any) => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MLServiceConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Update anomaly detector config
    this.anomalyDetector.updateConfig({
      sensitivityLevel: this.config.anomalyDetectionSensitivity,
      enableRealTimeDetection: this.config.enableRealTimeAnalysis
    });

    // Restart intervals if needed
    if (this.config.enableRealTimeAnalysis) {
      this.setupRealTimeAnalysis();
    } else if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }

    this.setupModelRetraining();
  }

  /**
   * Force retrain all models
   */
  async retrainModels(): Promise<void> {
    console.log('Retraining ML models...');
    
    try {
      const sessions = await this.dbService.getAllSessions();
      const allMetrics: PerformanceMetrics[] = [];

      for (const session of sessions) {
        const sessionMetrics = await this.dbService.getSessionMetrics(session.id);
        allMetrics.push(...sessionMetrics);
      }

      // Reinitialize predictive analytics with fresh data
      await this.predictiveAnalytics.initialize(sessions, allMetrics);
      
      console.log('Model retraining complete');
      
      // Notify subscribers
      this.notifySubscribers('models:retrained', {
        modelsCount: this.predictiveAnalytics.getModels().length,
        retrainTime: new Date()
      });

    } catch (error) {
      console.error('Error retraining models:', error);
      throw error;
    }
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache = {
      insights: [],
      recommendations: [],
      strategies: [],
      resourceOptimization: null,
      resourceForecast: null,
      trends: [],
      anomalies: [],
      anomalyPatterns: [],
      anomalyInsights: null,
      lastUpdate: new Date()
    };

    this.insightsEngine.clearCache();
    this.optimizationRecommendations.clearRecommendations();
    this.predictiveAnalytics.clearModels();
    this.anomalyDetector.clearAnomalies();
  }

  /**
   * Shutdown ML service
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down ML Service...');

    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }

    if (this.retrainInterval) {
      clearInterval(this.retrainInterval);
    }

    this.subscribers.clear();
    this.clearCache();

    console.log('ML Service shutdown complete');
  }

  // Private methods

  private setupRealTimeAnalysis(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }

    this.analysisInterval = setInterval(async () => {
      try {
        await this.performIncrementalAnalysis();
      } catch (error) {
        console.error('Error in real-time analysis:', error);
      }
    }, this.config.insightGenerationInterval);
  }

  private setupModelRetraining(): void {
    if (this.retrainInterval) {
      clearInterval(this.retrainInterval);
    }

    this.retrainInterval = setInterval(async () => {
      try {
        await this.retrainModels();
      } catch (error) {
        console.error('Error in scheduled model retraining:', error);
      }
    }, this.config.predictionModelRetranInterval);
  }

  private async performIncrementalAnalysis(): Promise<void> {
    // Only analyze recent data to avoid full recomputation
    const recentTime = new Date(Date.now() - this.config.insightGenerationInterval * 2);
    const recentSessions = (await this.dbService.getAllSessions())
      .filter(s => s.startTime > recentTime);

    if (recentSessions.length === 0) return;

    // Analyze recent sessions for anomalies
    for (const session of recentSessions) {
      if (session.status === 'running') {
        const analysis = await this.analyzeSession(session, false);
        
        if (analysis.anomalies.length > 0) {
          this.notifySubscribers('anomalies:detected', {
            sessionId: session.id,
            anomalies: analysis.anomalies
          });
        }
      }
    }
  }

  private async generateSessionInsights(
    session: DualAgentSession,
    anomalies: Anomaly[],
    predictions: any
  ): Promise<MLInsight[]> {
    const insights: MLInsight[] = [];

    // Generate insight from anomalies
    for (const anomaly of anomalies) {
      if (anomaly.severity === 'critical' || anomaly.severity === 'high') {
        insights.push({
          id: `session-${session.id}-${anomaly.id}`,
          type: 'anomaly',
          title: `Session Anomaly: ${anomaly.title}`,
          description: anomaly.description,
          severity: anomaly.severity,
          confidence: anomaly.metrics.confidenceLevel,
          data: {
            anomalyType: anomaly.type,
            deviationScore: anomaly.metrics.deviationScore,
            actualValue: anomaly.metrics.actualValue,
            expectedValue: anomaly.metrics.expectedValue
          },
          suggestions: anomaly.recommendations,
          timestamp: anomaly.detectedAt
        });
      }
    }

    // Generate insight from predictions
    if (predictions && predictions.riskFactors.length > 0) {
      insights.push({
        id: `session-${session.id}-prediction`,
        type: 'trend',
        title: 'Session Risk Prediction',
        description: `Predicted quality: ${(predictions.predictedQuality * 100).toFixed(1)}%, Risk factors detected: ${predictions.riskFactors.length}`,
        severity: predictions.predictedQuality < 0.7 ? 'high' : 'medium',
        confidence: predictions.confidence,
        data: {
          predictedQuality: predictions.predictedQuality,
          predictedCost: predictions.predictedCost,
          predictedDuration: predictions.predictedDuration,
          riskFactors: predictions.riskFactors
        },
        suggestions: predictions.recommendations,
        timestamp: new Date()
      });
    }

    return insights;
  }

  private async generateSessionRecommendations(
    session: DualAgentSession,
    anomalies: Anomaly[]
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    // Generate recommendations based on critical anomalies
    const criticalAnomalies = anomalies.filter(a => a.severity === 'critical');
    
    for (const anomaly of criticalAnomalies) {
      if (anomaly.autoResolution?.possible) {
        recommendations.push({
          id: `session-${session.id}-${anomaly.id}-fix`,
          category: 'reliability',
          priority: 'critical',
          title: `Fix ${anomaly.title}`,
          description: `Apply automatic resolution for detected anomaly in session ${session.id}`,
          expectedImpact: {
            errorReduction: 50,
            performance: 20
          },
          implementation: {
            difficulty: 'easy',
            estimatedTime: 0.5,
            steps: anomaly.autoResolution.actions,
            requiredChanges: ['Automatic system adjustment']
          },
          evidence: {
            dataPoints: [
              { metric: 'anomaly_severity', value: anomaly.severity },
              { metric: 'confidence', value: anomaly.metrics.confidenceLevel }
            ],
            confidence: anomaly.metrics.confidenceLevel,
            affectedSessions: [session.id]
          },
          monitoring: {
            metrics: ['error_rate', 'performance_score'],
            successCriteria: ['Anomaly resolved', 'No performance degradation'],
            timeframe: '5 minutes'
          },
          timestamp: new Date()
        });
      }
    }

    return recommendations;
  }

  private async generateCustomForecast(days: number): Promise<ResourceForecast | null> {
    try {
      const sessions = await this.dbService.getAllSessions();
      return await this.predictiveAnalytics.generateResourceForecast(sessions, days);
    } catch (error) {
      console.error('Error generating custom forecast:', error);
      return null;
    }
  }

  private handleAnomalyAlert(anomaly: Anomaly): void {
    // Notify subscribers of real-time anomaly
    this.notifySubscribers('anomaly:detected', {
      anomaly,
      timestamp: new Date()
    });

    // Add to cache
    this.cache.anomalies.unshift(anomaly);
    
    // Limit cache size
    if (this.cache.anomalies.length > this.config.maxInsightsHistory) {
      this.cache.anomalies = this.cache.anomalies.slice(0, this.config.maxInsightsHistory);
    }
  }

  private notifySubscribers(event: string, data: any): void {
    this.subscribers.forEach(callback => {
      try {
        callback({ event, data, timestamp: new Date() });
      } catch (error) {
        console.error('Error in ML service subscriber callback:', error);
      }
    });
  }
}