import { AgentMessage, DualAgentSession, PerformanceMetrics } from '../types';
import { MLInsight } from './InsightsEngine';

export interface PredictionModel {
  id: string;
  name: string;
  type: 'performance' | 'cost' | 'duration' | 'quality' | 'resource_usage';
  accuracy: number;
  lastTrained: Date;
  features: string[];
  parameters: Record<string, any>;
  validationResults: {
    mse: number; // Mean squared error
    mae: number; // Mean absolute error
    r2: number;  // R-squared
    accuracy: number; // For classification models
  };
}

export interface Prediction {
  id: string;
  modelId: string;
  targetMetric: string;
  predictedValue: number;
  confidence: number;
  predictionRange: {
    lower: number;
    upper: number;
  };
  timeframe: string;
  generatedAt: Date;
  factors: Array<{
    factor: string;
    impact: number;
    importance: number;
  }>;
}

export interface ForecastData {
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

export interface ResourceForecast {
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

export interface TrendAnalysis {
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

export class PredictiveAnalytics {
  private models: Map<string, PredictionModel> = new Map();
  private predictions: Map<string, Prediction> = new Map();
  private trainingData: Map<string, any[]> = new Map();

  /**
   * Initialize predictive analytics with historical data
   */
  async initialize(
    sessions: DualAgentSession[],
    metrics: PerformanceMetrics[]
  ): Promise<void> {
    console.log('Initializing Predictive Analytics...');

    // Prepare training data
    await this.prepareTrainingData(sessions, metrics);

    // Train initial models
    await this.trainPredictionModels();

    console.log(`Predictive Analytics initialized with ${this.models.size} models`);
  }

  /**
   * Generate comprehensive resource forecast
   */
  async generateResourceForecast(
    sessions: DualAgentSession[],
    forecastDays: number = 30
  ): Promise<ResourceForecast> {
    const forecastPeriod = `${forecastDays} days`;
    
    // Prepare time series data
    const timeSeriesData = this.prepareTimeSeriesData(sessions, forecastDays);

    // Generate individual forecasts
    const predictions = {
      tokenUsage: await this.forecastTokenUsage(timeSeriesData.tokens),
      cost: await this.forecastCosts(timeSeriesData.costs),
      sessionCount: await this.forecastSessionCount(timeSeriesData.sessions),
      errorRate: await this.forecastErrorRate(timeSeriesData.errors),
      averagePerformance: await this.forecastPerformance(timeSeriesData.performance)
    };

    // Calculate budget projections
    const budgetProjections = this.calculateBudgetProjections(predictions.cost);

    // Generate recommendations based on forecasts
    const recommendations = this.generateForecastRecommendations(predictions);

    return {
      forecastPeriod,
      predictions,
      recommendations,
      budgetProjections
    };
  }

  /**
   * Predict session outcome based on early indicators
   */
  async predictSessionOutcome(
    sessionId: string,
    earlyMessages: AgentMessage[]
  ): Promise<{
    predictedQuality: number;
    predictedCost: number;
    predictedDuration: number;
    confidence: number;
    riskFactors: string[];
    recommendations: string[];
  }> {
    if (earlyMessages.length < 2) {
      return {
        predictedQuality: 0.5,
        predictedCost: 0,
        predictedDuration: 0,
        confidence: 0.1,
        riskFactors: ['Insufficient data for prediction'],
        recommendations: ['Continue session to gather more data points']
      };
    }

    // Extract features from early messages
    const features = this.extractEarlyFeatures(earlyMessages);

    // Get predictions from trained models
    const qualityModel = this.models.get('session-quality');
    const costModel = this.models.get('session-cost');
    const durationModel = this.models.get('session-duration');

    const predictedQuality = qualityModel ? 
      this.runPrediction(qualityModel, features) : 0.5;
    
    const predictedCost = costModel ? 
      this.runPrediction(costModel, features) : 5.0;
    
    const predictedDuration = durationModel ? 
      this.runPrediction(durationModel, features) : 600000; // 10 minutes

    // Calculate overall confidence
    const confidence = this.calculatePredictionConfidence([
      qualityModel, costModel, durationModel
    ].filter(m => m !== undefined));

    // Identify risk factors
    const riskFactors = this.identifyRiskFactors(features, {
      quality: predictedQuality,
      cost: predictedCost,
      duration: predictedDuration
    });

    // Generate recommendations
    const recommendations = this.generateSessionRecommendations(
      features, predictedQuality, riskFactors
    );

    return {
      predictedQuality,
      predictedCost,
      predictedDuration,
      confidence,
      riskFactors,
      recommendations
    };
  }

  /**
   * Analyze trends in historical data
   */
  async analyzeTrends(
    sessions: DualAgentSession[],
    metrics: PerformanceMetrics[],
    timeRangeHours: number = 168 // 1 week default
  ): Promise<TrendAnalysis[]> {
    const analyses: TrendAnalysis[] = [];
    const cutoffTime = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000);

    // Filter data to time range
    const recentSessions = sessions.filter(s => s.startTime >= cutoffTime);
    const recentMetrics = metrics.filter(m => m.timestamp >= cutoffTime);

    // Analyze performance trend
    const performanceTrend = await this.analyzeSingleTrend(
      'performance',
      this.extractPerformanceTimeSeries(recentSessions),
      { start: cutoffTime, end: new Date() }
    );
    analyses.push(performanceTrend);

    // Analyze cost trend
    const costTrend = await this.analyzeSingleTrend(
      'cost',
      this.extractCostTimeSeries(recentSessions),
      { start: cutoffTime, end: new Date() }
    );
    analyses.push(costTrend);

    // Analyze error rate trend
    const errorTrend = await this.analyzeSingleTrend(
      'error_rate',
      this.extractErrorRateTimeSeries(recentSessions),
      { start: cutoffTime, end: new Date() }
    );
    analyses.push(errorTrend);

    // Analyze response time trend
    const responseTimeTrend = await this.analyzeSingleTrend(
      'response_time',
      this.extractResponseTimeTimeSeries(recentMetrics),
      { start: cutoffTime, end: new Date() }
    );
    analyses.push(responseTimeTrend);

    return analyses.filter(a => a.trend.significance > 0.1); // Filter significant trends
  }

  /**
   * Predict optimal resource allocation
   */
  async predictOptimalAllocation(
    currentSessions: DualAgentSession[],
    targetMetrics: {
      maxCost?: number;
      minPerformance?: number;
      maxDuration?: number;
    }
  ): Promise<{
    recommendedConfiguration: {
      managerModel: string;
      workerModel: string;
      maxConcurrentSessions: number;
      taskDistributionRatio: number;
    };
    expectedOutcomes: {
      averageCost: number;
      averagePerformance: number;
      averageDuration: number;
      errorRate: number;
    };
    confidence: number;
    tradeoffs: string[];
  }> {
    // Analyze current allocation patterns
    const currentPatterns = this.analyzeCurrentAllocation(currentSessions);
    
    // Model different allocation scenarios
    const scenarios = this.generateAllocationScenarios(targetMetrics);
    
    // Evaluate each scenario
    const evaluations = await Promise.all(
      scenarios.map(scenario => this.evaluateAllocationScenario(scenario, currentPatterns))
    );
    
    // Select optimal scenario
    const optimalScenario = evaluations.reduce((best, current) => 
      current.score > best.score ? current : best
    );

    return {
      recommendedConfiguration: optimalScenario.configuration,
      expectedOutcomes: optimalScenario.outcomes,
      confidence: optimalScenario.confidence,
      tradeoffs: optimalScenario.tradeoffs
    };
  }

  /**
   * Generate load forecasting for capacity planning
   */
  async generateLoadForecast(
    historicalSessions: DualAgentSession[],
    forecastHours: number = 24
  ): Promise<{
    hourlyForecast: Array<{
      hour: Date;
      predictedSessions: number;
      confidence: number;
      resourceRequirements: {
        estimatedTokens: number;
        estimatedCost: number;
        recommendedCapacity: number;
      };
    }>;
    peakLoadPrediction: {
      expectedPeakTime: Date;
      predictedLoad: number;
      capacityRecommendation: number;
    };
    alerts: string[];
  }> {
    // Extract hourly patterns from historical data
    const hourlyPatterns = this.extractHourlyPatterns(historicalSessions);
    
    // Detect seasonal patterns (daily, weekly)
    const seasonality = this.detectSeasonality(hourlyPatterns);
    
    // Generate hourly forecasts
    const hourlyForecast = [];
    const currentTime = new Date();
    
    for (let i = 0; i < forecastHours; i++) {
      const forecastTime = new Date(currentTime.getTime() + i * 60 * 60 * 1000);
      const prediction = this.predictHourlyLoad(forecastTime, hourlyPatterns, seasonality);
      
      hourlyForecast.push({
        hour: forecastTime,
        predictedSessions: prediction.sessionCount,
        confidence: prediction.confidence,
        resourceRequirements: {
          estimatedTokens: prediction.sessionCount * this.getAverageTokensPerSession(),
          estimatedCost: prediction.sessionCount * this.getAverageCostPerSession(),
          recommendedCapacity: Math.ceil(prediction.sessionCount * 1.2) // 20% buffer
        }
      });
    }

    // Identify peak load
    const peakPrediction = hourlyForecast.reduce((peak, current) => 
      current.predictedSessions > peak.predictedSessions ? current : peak
    );

    // Generate capacity alerts
    const alerts = this.generateCapacityAlerts(hourlyForecast);

    return {
      hourlyForecast,
      peakLoadPrediction: {
        expectedPeakTime: peakPrediction.hour,
        predictedLoad: peakPrediction.predictedSessions,
        capacityRecommendation: peakPrediction.resourceRequirements.recommendedCapacity
      },
      alerts
    };
  }

  // Training and Model Management

  private async prepareTrainingData(
    sessions: DualAgentSession[],
    metrics: PerformanceMetrics[]
  ): Promise<void> {
    // Prepare session quality prediction data
    const qualityData = sessions
      .filter(s => s.status === 'completed' && s.summary)
      .map(s => ({
        features: this.extractSessionFeatures(s),
        target: s.summary!.successRate
      }));
    
    this.trainingData.set('session-quality', qualityData);

    // Prepare cost prediction data
    const costData = sessions
      .filter(s => s.summary?.totalCost !== undefined)
      .map(s => ({
        features: this.extractSessionFeatures(s),
        target: s.summary!.totalCost!
      }));
    
    this.trainingData.set('session-cost', costData);

    // Prepare duration prediction data
    const durationData = sessions
      .filter(s => s.endTime)
      .map(s => ({
        features: this.extractSessionFeatures(s),
        target: s.endTime!.getTime() - s.startTime.getTime()
      }));
    
    this.trainingData.set('session-duration', durationData);

    // Prepare performance metrics data
    const performanceData = metrics.map(m => ({
      features: this.extractMetricFeatures(m),
      target: m.responseTime
    }));
    
    this.trainingData.set('response-time', performanceData);
  }

  private async trainPredictionModels(): Promise<void> {
    // Train session quality model
    const qualityData = this.trainingData.get('session-quality');
    if (qualityData && qualityData.length > 10) {
      const qualityModel = await this.trainRegressionModel(
        'session-quality',
        'Session Quality Predictor',
        'quality',
        qualityData
      );
      this.models.set('session-quality', qualityModel);
    }

    // Train cost prediction model
    const costData = this.trainingData.get('session-cost');
    if (costData && costData.length > 10) {
      const costModel = await this.trainRegressionModel(
        'session-cost',
        'Session Cost Predictor',
        'cost',
        costData
      );
      this.models.set('session-cost', costModel);
    }

    // Train duration prediction model
    const durationData = this.trainingData.get('session-duration');
    if (durationData && durationData.length > 10) {
      const durationModel = await this.trainRegressionModel(
        'session-duration',
        'Session Duration Predictor',
        'duration',
        durationData
      );
      this.models.set('session-duration', durationModel);
    }
  }

  private async trainRegressionModel(
    id: string,
    name: string,
    type: PredictionModel['type'],
    trainingData: Array<{ features: Record<string, number>; target: number }>
  ): Promise<PredictionModel> {
    if (trainingData.length === 0) {
      throw new Error(`No training data available for model ${id}`);
    }

    // Simple linear regression implementation
    const featureNames = Object.keys(trainingData[0].features);
    const X = trainingData.map(d => featureNames.map(f => d.features[f] || 0));
    const y = trainingData.map(d => d.target);

    // Calculate means
    const xMeans = featureNames.map((_, i) => 
      X.reduce((sum, row) => sum + row[i], 0) / X.length
    );
    const yMean = y.reduce((sum, val) => sum + val, 0) / y.length;

    // Calculate coefficients using normal equation (simplified)
    const coefficients = this.calculateLinearRegressionCoefficients(X, y, xMeans, yMean);

    // Validate model
    const predictions = X.map(row => this.predictWithCoefficients(row, coefficients, xMeans, yMean));
    const validation = this.validateRegressionModel(y, predictions);

    const model: PredictionModel = {
      id,
      name,
      type,
      accuracy: validation.r2,
      lastTrained: new Date(),
      features: featureNames,
      parameters: {
        coefficients,
        xMeans,
        yMean,
        intercept: coefficients[coefficients.length - 1] || yMean
      },
      validationResults: validation
    };

    return model;
  }

  private calculateLinearRegressionCoefficients(
    X: number[][],
    y: number[],
    xMeans: number[],
    yMean: number
  ): number[] {
    // Simplified coefficient calculation
    const n = X.length;
    const p = X[0].length;
    
    if (n < p) {
      // Not enough data for proper regression, return mean-based coefficients
      return new Array(p).fill(0).concat([yMean]);
    }

    // Calculate correlation-based coefficients (simplified approach)
    const coefficients: number[] = [];
    
    for (let i = 0; i < p; i++) {
      const xValues = X.map(row => row[i]);
      const correlation = this.calculateCorrelation(xValues, y);
      const stdX = this.calculateStandardDeviation(xValues);
      const stdY = this.calculateStandardDeviation(y);
      
      const coefficient = stdY > 0 && stdX > 0 ? correlation * (stdY / stdX) : 0;
      coefficients.push(coefficient);
    }

    // Calculate intercept
    const intercept = yMean - coefficients.reduce((sum, coef, i) => sum + coef * xMeans[i], 0);
    coefficients.push(intercept);

    return coefficients;
  }

  private predictWithCoefficients(
    features: number[],
    coefficients: number[],
    xMeans: number[],
    yMean: number
  ): number {
    let prediction = coefficients[coefficients.length - 1]; // intercept
    
    for (let i = 0; i < features.length && i < coefficients.length - 1; i++) {
      prediction += coefficients[i] * features[i];
    }
    
    return prediction;
  }

  private validateRegressionModel(
    actual: number[],
    predicted: number[]
  ): PredictionModel['validationResults'] {
    const n = actual.length;
    
    // Mean Squared Error
    const mse = actual.reduce((sum, act, i) => 
      sum + Math.pow(act - predicted[i], 2), 0) / n;
    
    // Mean Absolute Error  
    const mae = actual.reduce((sum, act, i) => 
      sum + Math.abs(act - predicted[i]), 0) / n;
    
    // R-squared
    const actualMean = actual.reduce((sum, val) => sum + val, 0) / n;
    const totalSumSquares = actual.reduce((sum, val) => sum + Math.pow(val - actualMean, 2), 0);
    const residualSumSquares = actual.reduce((sum, val, i) => 
      sum + Math.pow(val - predicted[i], 2), 0);
    
    const r2 = totalSumSquares > 0 ? 1 - (residualSumSquares / totalSumSquares) : 0;
    
    // Accuracy (for classification-like interpretation)
    const accuracy = Math.max(0, r2);

    return { mse, mae, r2, accuracy };
  }

  private runPrediction(model: PredictionModel, features: Record<string, number>): number {
    const featureVector = model.features.map(f => features[f] || 0);
    
    return this.predictWithCoefficients(
      featureVector,
      model.parameters.coefficients,
      model.parameters.xMeans,
      model.parameters.yMean
    );
  }

  // Feature extraction methods

  private extractSessionFeatures(session: DualAgentSession): Record<string, number> {
    return {
      messageCount: session.messages.length,
      managerMessages: session.messages.filter(m => m.agentType === 'manager').length,
      workerMessages: session.messages.filter(m => m.agentType === 'worker').length,
      errorCount: session.messages.filter(m => m.messageType === 'error').length,
      toolCallCount: session.messages.reduce((sum, m) => sum + (m.metadata?.tools?.length || 0), 0),
      avgMessageLength: session.messages.reduce((sum, m) => sum + m.content.length, 0) / Math.max(session.messages.length, 1),
      agentSwitches: this.countAgentSwitches(session.messages),
      timeOfDay: session.startTime.getHours(),
      dayOfWeek: session.startTime.getDay()
    };
  }

  private extractEarlyFeatures(messages: AgentMessage[]): Record<string, number> {
    if (messages.length === 0) return {};

    return {
      messageCount: messages.length,
      errorCount: messages.filter(m => m.messageType === 'error').length,
      toolCallCount: messages.reduce((sum, m) => sum + (m.metadata?.tools?.length || 0), 0),
      avgMessageLength: messages.reduce((sum, m) => sum + m.content.length, 0) / messages.length,
      initialResponseTime: messages[1]?.metadata?.duration || 0,
      agentAlternation: this.calculateAlternationRate(messages),
      firstErrorPosition: Math.max(0, messages.findIndex(m => m.messageType === 'error')),
      toolDiversity: new Set(messages.flatMap(m => m.metadata?.tools || [])).size
    };
  }

  private extractMetricFeatures(metric: PerformanceMetrics): Record<string, number> {
    return {
      tokensUsed: metric.tokensUsed || 0,
      cost: metric.cost || 0,
      errorRate: metric.errorRate,
      timeOfDay: metric.timestamp.getHours(),
      dayOfWeek: metric.timestamp.getDay(),
      agentType: metric.agentType === 'manager' ? 1 : 0
    };
  }

  // Time series and forecasting methods

  private prepareTimeSeriesData(
    sessions: DualAgentSession[],
    forecastDays: number
  ): {
    tokens: Array<{ timestamp: Date; value: number }>;
    costs: Array<{ timestamp: Date; value: number }>;
    sessions: Array<{ timestamp: Date; value: number }>;
    errors: Array<{ timestamp: Date; value: number }>;
    performance: Array<{ timestamp: Date; value: number }>;
  } {
    const cutoffTime = new Date(Date.now() - forecastDays * 2 * 24 * 60 * 60 * 1000); // 2x forecast period
    const recentSessions = sessions.filter(s => s.startTime >= cutoffTime);

    // Group by day and aggregate
    const dailyData = new Map<string, {
      sessionCount: number;
      totalTokens: number;
      totalCost: number;
      totalErrors: number;
      performanceScores: number[];
    }>();

    recentSessions.forEach(session => {
      const dateKey = session.startTime.toDateString();
      
      if (!dailyData.has(dateKey)) {
        dailyData.set(dateKey, {
          sessionCount: 0,
          totalTokens: 0,
          totalCost: 0,
          totalErrors: 0,
          performanceScores: []
        });
      }

      const dayData = dailyData.get(dateKey)!;
      dayData.sessionCount++;
      dayData.totalCost += session.summary?.totalCost || 0;
      dayData.totalErrors += session.messages.filter(m => m.messageType === 'error').length;
      dayData.totalTokens += this.estimateTokens(session);
      
      if (session.summary?.successRate) {
        dayData.performanceScores.push(session.summary.successRate * 100);
      }
    });

    // Convert to time series arrays
    const sortedDates = Array.from(dailyData.keys()).sort();

    return {
      tokens: sortedDates.map(date => ({
        timestamp: new Date(date),
        value: dailyData.get(date)!.totalTokens
      })),
      costs: sortedDates.map(date => ({
        timestamp: new Date(date),
        value: dailyData.get(date)!.totalCost
      })),
      sessions: sortedDates.map(date => ({
        timestamp: new Date(date),
        value: dailyData.get(date)!.sessionCount
      })),
      errors: sortedDates.map(date => ({
        timestamp: new Date(date),
        value: dailyData.get(date)!.totalErrors
      })),
      performance: sortedDates.map(date => {
        const scores = dailyData.get(date)!.performanceScores;
        const avgScore = scores.length > 0 ? 
          scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
        return {
          timestamp: new Date(date),
          value: avgScore
        };
      })
    };
  }

  private async forecastTokenUsage(
    historicalData: Array<{ timestamp: Date; value: number }>
  ): Promise<ForecastData> {
    return this.generateTimeSeries('Token Usage', historicalData);
  }

  private async forecastCosts(
    historicalData: Array<{ timestamp: Date; value: number }>
  ): Promise<ForecastData> {
    return this.generateTimeSeries('Cost', historicalData);
  }

  private async forecastSessionCount(
    historicalData: Array<{ timestamp: Date; value: number }>
  ): Promise<ForecastData> {
    return this.generateTimeSeries('Session Count', historicalData);
  }

  private async forecastErrorRate(
    historicalData: Array<{ timestamp: Date; value: number }>
  ): Promise<ForecastData> {
    return this.generateTimeSeries('Error Rate', historicalData);
  }

  private async forecastPerformance(
    historicalData: Array<{ timestamp: Date; value: number }>
  ): Promise<ForecastData> {
    return this.generateTimeSeries('Performance', historicalData);
  }

  private generateTimeSeries(
    metric: string,
    historical: Array<{ timestamp: Date; value: number }>
  ): ForecastData {
    if (historical.length < 3) {
      // Not enough data for meaningful forecast
      return {
        metric,
        historical,
        predicted: [],
        seasonality: { detected: false, pattern: null, strength: 0 },
        trend: { direction: 'stable', strength: 0, changeRate: 0 }
      };
    }

    // Detect trend
    const trend = this.detectTrend(historical);
    
    // Detect seasonality
    const seasonality = this.detectSeasonalityInData(historical);

    // Generate predictions using simple trend extrapolation
    const predicted = this.generatePredictions(historical, trend, seasonality, 7); // 7 days forecast

    return {
      metric,
      historical,
      predicted,
      seasonality,
      trend
    };
  }

  private detectTrend(data: Array<{ timestamp: Date; value: number }>): ForecastData['trend'] {
    if (data.length < 2) {
      return { direction: 'stable', strength: 0, changeRate: 0 };
    }

    // Simple linear trend detection
    const values = data.map(d => d.value);
    const trend = this.calculateTrendSlope(values);

    let direction: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (Math.abs(trend.slope) > 0.1) {
      direction = trend.slope > 0 ? 'increasing' : 'decreasing';
    }

    return {
      direction,
      strength: Math.abs(trend.slope),
      changeRate: trend.slope
    };
  }

  private detectSeasonalityInData(
    data: Array<{ timestamp: Date; value: number }>
  ): ForecastData['seasonality'] {
    if (data.length < 7) {
      return { detected: false, pattern: null, strength: 0 };
    }

    // Check for weekly seasonality (simplified)
    const dayOfWeekData = new Map<number, number[]>();
    
    data.forEach(point => {
      const dayOfWeek = point.timestamp.getDay();
      if (!dayOfWeekData.has(dayOfWeek)) {
        dayOfWeekData.set(dayOfWeek, []);
      }
      dayOfWeekData.get(dayOfWeek)!.push(point.value);
    });

    // Calculate variance between days
    const dayAverages = Array.from(dayOfWeekData.entries()).map(([day, values]) => ({
      day,
      average: values.reduce((sum, val) => sum + val, 0) / values.length
    }));

    const overallAverage = dayAverages.reduce((sum, d) => sum + d.average, 0) / dayAverages.length;
    const variance = dayAverages.reduce((sum, d) => sum + Math.pow(d.average - overallAverage, 2), 0) / dayAverages.length;
    const strength = Math.sqrt(variance) / Math.max(overallAverage, 1);

    return {
      detected: strength > 0.2, // 20% threshold
      pattern: strength > 0.2 ? 'weekly' : null,
      strength
    };
  }

  private generatePredictions(
    historical: Array<{ timestamp: Date; value: number }>,
    trend: ForecastData['trend'],
    seasonality: ForecastData['seasonality'],
    forecastDays: number
  ): ForecastData['predicted'] {
    const lastPoint = historical[historical.length - 1];
    const predictions: ForecastData['predicted'] = [];

    for (let i = 1; i <= forecastDays; i++) {
      const forecastDate = new Date(lastPoint.timestamp.getTime() + i * 24 * 60 * 60 * 1000);
      
      // Base prediction using trend
      let predictedValue = lastPoint.value + (trend.changeRate * i);
      
      // Apply seasonality if detected
      if (seasonality.detected && seasonality.pattern === 'weekly') {
        const dayOfWeek = forecastDate.getDay();
        const seasonalMultiplier = this.getSeasonalMultiplier(dayOfWeek, historical);
        predictedValue *= seasonalMultiplier;
      }

      // Ensure non-negative predictions
      predictedValue = Math.max(0, predictedValue);

      // Calculate confidence (decreases with distance)
      const confidence = Math.max(0.1, 0.9 - (i * 0.1));

      // Calculate prediction range
      const uncertainty = predictedValue * (0.1 + i * 0.05); // Increasing uncertainty
      
      predictions.push({
        timestamp: forecastDate,
        value: predictedValue,
        confidence,
        range: {
          lower: Math.max(0, predictedValue - uncertainty),
          upper: predictedValue + uncertainty
        }
      });
    }

    return predictions;
  }

  private getSeasonalMultiplier(
    dayOfWeek: number,
    historical: Array<{ timestamp: Date; value: number }>
  ): number {
    // Calculate average for this day of week vs overall average
    const dayValues = historical
      .filter(h => h.timestamp.getDay() === dayOfWeek)
      .map(h => h.value);
    
    if (dayValues.length === 0) return 1;

    const dayAverage = dayValues.reduce((sum, val) => sum + val, 0) / dayValues.length;
    const overallAverage = historical.reduce((sum, h) => sum + h.value, 0) / historical.length;

    return overallAverage > 0 ? dayAverage / overallAverage : 1;
  }

  // Utility methods

  private calculateTrendSlope(values: number[]): { slope: number; r2: number } {
    if (values.length < 2) return { slope: 0, r2: 0 };

    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;

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
    const r2 = ssTot !== 0 ? Math.max(0, 1 - (ssRes / ssTot)) : 0;

    return { slope, r2 };
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;

    const n = x.length;
    const xMean = x.reduce((sum, val) => sum + val, 0) / n;
    const yMean = y.reduce((sum, val) => sum + val, 0) / n;

    let numerator = 0;
    let xSumSquares = 0;
    let ySumSquares = 0;

    for (let i = 0; i < n; i++) {
      const xDiff = x[i] - xMean;
      const yDiff = y[i] - yMean;
      
      numerator += xDiff * yDiff;
      xSumSquares += xDiff * xDiff;
      ySumSquares += yDiff * yDiff;
    }

    const denominator = Math.sqrt(xSumSquares * ySumSquares);
    return denominator !== 0 ? numerator / denominator : 0;
  }

  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return Math.sqrt(variance);
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

  private estimateTokens(session: DualAgentSession): number {
    return session.messages.reduce((sum, m) => sum + (m.content.length / 4), 0); // Rough estimate
  }

  private calculatePredictionConfidence(models: PredictionModel[]): number {
    if (models.length === 0) return 0.1;
    
    const avgAccuracy = models.reduce((sum, m) => sum + m.accuracy, 0) / models.length;
    return Math.min(0.95, Math.max(0.1, avgAccuracy));
  }

  private identifyRiskFactors(
    features: Record<string, number>,
    predictions: { quality: number; cost: number; duration: number }
  ): string[] {
    const riskFactors: string[] = [];

    if (predictions.quality < 0.7) {
      riskFactors.push('Low predicted quality score');
    }

    if (predictions.cost > 10) {
      riskFactors.push('High predicted cost');
    }

    if (predictions.duration > 20 * 60 * 1000) { // 20 minutes
      riskFactors.push('Extended predicted duration');
    }

    if (features.errorCount > 0) {
      riskFactors.push('Early errors detected');
    }

    if (features.initialResponseTime > 10000) {
      riskFactors.push('Slow initial response time');
    }

    if (features.agentAlternation < 0.1) {
      riskFactors.push('Low agent collaboration');
    }

    return riskFactors;
  }

  private generateSessionRecommendations(
    features: Record<string, number>,
    predictedQuality: number,
    riskFactors: string[]
  ): string[] {
    const recommendations: string[] = [];

    if (predictedQuality < 0.7) {
      recommendations.push('Consider additional quality checkpoints');
      recommendations.push('Implement early intervention mechanisms');
    }

    if (riskFactors.includes('Early errors detected')) {
      recommendations.push('Activate enhanced error recovery protocols');
    }

    if (riskFactors.includes('Low agent collaboration')) {
      recommendations.push('Encourage more frequent agent handoffs');
    }

    if (features.toolDiversity < 2) {
      recommendations.push('Consider expanding tool usage diversity');
    }

    return recommendations;
  }

  private calculateBudgetProjections(costForecast: ForecastData): ResourceForecast['budgetProjections'] {
    const predictions = costForecast.predicted;
    
    if (predictions.length === 0) {
      return { conservative: 0, expected: 0, optimistic: 0 };
    }

    const totalExpected = predictions.reduce((sum, p) => sum + p.value, 0);
    const totalConservative = predictions.reduce((sum, p) => sum + p.range.upper, 0);
    const totalOptimistic = predictions.reduce((sum, p) => sum + p.range.lower, 0);

    return {
      conservative: Math.round(totalConservative * 100) / 100,
      expected: Math.round(totalExpected * 100) / 100,
      optimistic: Math.round(totalOptimistic * 100) / 100
    };
  }

  private generateForecastRecommendations(predictions: ResourceForecast['predictions']): string[] {
    const recommendations: string[] = [];

    // Cost recommendations
    if (predictions.cost.trend.direction === 'increasing' && predictions.cost.trend.strength > 0.2) {
      recommendations.push('Monitor rising cost trends - consider optimization strategies');
    }

    // Performance recommendations
    if (predictions.averagePerformance.trend.direction === 'decreasing') {
      recommendations.push('Address declining performance trend through system optimization');
    }

    // Error rate recommendations
    if (predictions.errorRate.trend.direction === 'increasing') {
      recommendations.push('Investigate and address increasing error patterns');
    }

    // Capacity recommendations
    if (predictions.sessionCount.trend.direction === 'increasing' && predictions.sessionCount.trend.strength > 0.3) {
      recommendations.push('Plan for capacity scaling due to growing session volume');
    }

    return recommendations;
  }

  private async analyzeSingleTrend(
    metric: string,
    timeSeries: Array<{ timestamp: Date; value: number }>,
    timeRange: { start: Date; end: Date }
  ): Promise<TrendAnalysis> {
    const trend = this.detectTrend(timeSeries);
    const changePoints = this.detectChangePoints(timeSeries);

    // Generate forecast for next period
    const forecastDuration = timeRange.end.getTime() - timeRange.start.getTime();
    const nextPeriodForecast = this.generateSinglePeriodForecast(
      timeSeries,
      trend,
      forecastDuration
    );

    const insights = this.generateTrendInsights(metric, trend, changePoints);

    return {
      metric,
      timeRange,
      trend: {
        direction: trend.direction === 'increasing' ? 'up' : 
                  trend.direction === 'decreasing' ? 'down' : 'stable',
        magnitude: trend.strength,
        significance: Math.min(1, trend.strength * 2),
        changePoints
      },
      forecast: nextPeriodForecast,
      insights
    };
  }

  private detectChangePoints(
    timeSeries: Array<{ timestamp: Date; value: number }>
  ): Array<{
    timestamp: Date;
    beforeValue: number;
    afterValue: number;
    significance: number;
  }> {
    // Simplified change point detection
    const changePoints = [];
    const windowSize = Math.max(3, Math.floor(timeSeries.length / 5));

    for (let i = windowSize; i < timeSeries.length - windowSize; i++) {
      const beforeWindow = timeSeries.slice(i - windowSize, i);
      const afterWindow = timeSeries.slice(i, i + windowSize);

      const beforeMean = beforeWindow.reduce((sum, p) => sum + p.value, 0) / beforeWindow.length;
      const afterMean = afterWindow.reduce((sum, p) => sum + p.value, 0) / afterWindow.length;

      const changeRatio = Math.abs(afterMean - beforeMean) / Math.max(beforeMean, 1);
      
      if (changeRatio > 0.3) { // 30% change threshold
        changePoints.push({
          timestamp: timeSeries[i].timestamp,
          beforeValue: beforeMean,
          afterValue: afterMean,
          significance: Math.min(1, changeRatio)
        });
      }
    }

    return changePoints.slice(0, 3); // Limit to top 3 change points
  }

  private generateSinglePeriodForecast(
    timeSeries: Array<{ timestamp: Date; value: number }>,
    trend: ForecastData['trend'],
    forecastDuration: number
  ): TrendAnalysis['forecast'] {
    if (timeSeries.length === 0) {
      return {
        nextPeriod: 0,
        confidence: 0.1,
        scenarios: { best: 0, expected: 0, worst: 0 }
      };
    }

    const lastValue = timeSeries[timeSeries.length - 1].value;
    const trendAdjustment = trend.changeRate * (forecastDuration / (24 * 60 * 60 * 1000)); // Per day

    const expected = Math.max(0, lastValue + trendAdjustment);
    const uncertainty = expected * 0.2; // 20% uncertainty

    return {
      nextPeriod: expected,
      confidence: Math.max(0.1, 0.8 - (trend.strength * 0.3)), // Lower confidence for volatile trends
      scenarios: {
        best: expected + uncertainty,
        expected,
        worst: Math.max(0, expected - uncertainty)
      }
    };
  }

  private generateTrendInsights(
    metric: string,
    trend: ForecastData['trend'],
    changePoints: Array<{ timestamp: Date; significance: number }>
  ): string[] {
    const insights: string[] = [];

    if (trend.direction === 'increasing' && trend.strength > 0.3) {
      insights.push(`${metric} shows strong upward trend (${(trend.strength * 100).toFixed(1)}% change rate)`);
    } else if (trend.direction === 'decreasing' && trend.strength > 0.3) {
      insights.push(`${metric} shows concerning downward trend (${(trend.strength * 100).toFixed(1)}% decline rate)`);
    }

    if (changePoints.length > 0) {
      const significantChanges = changePoints.filter(cp => cp.significance > 0.5);
      if (significantChanges.length > 0) {
        insights.push(`${significantChanges.length} significant change point(s) detected in recent period`);
      }
    }

    if (trend.strength > 0.5) {
      insights.push(`High volatility detected - consider implementing stabilization measures`);
    }

    return insights;
  }

  // Additional helper methods for resource allocation and load forecasting
  
  private extractPerformanceTimeSeries(sessions: DualAgentSession[]): Array<{ timestamp: Date; value: number }> {
    return sessions
      .filter(s => s.summary?.successRate !== undefined)
      .map(s => ({
        timestamp: s.startTime,
        value: s.summary!.successRate * 100
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private extractCostTimeSeries(sessions: DualAgentSession[]): Array<{ timestamp: Date; value: number }> {
    return sessions
      .filter(s => s.summary?.totalCost !== undefined)
      .map(s => ({
        timestamp: s.startTime,
        value: s.summary!.totalCost as number
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private extractErrorRateTimeSeries(sessions: DualAgentSession[]): Array<{ timestamp: Date; value: number }> {
    return sessions.map(s => {
      const errorRate = s.messages.filter(m => m.messageType === 'error').length / Math.max(s.messages.length, 1);
      return {
        timestamp: s.startTime,
        value: errorRate * 100
      };
    }).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private extractResponseTimeTimeSeries(metrics: PerformanceMetrics[]): Array<{ timestamp: Date; value: number }> {
    return metrics
      .map(m => ({
        timestamp: m.timestamp,
        value: m.responseTime
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private analyzeCurrentAllocation(sessions: DualAgentSession[]): any {
    // Analyze current resource allocation patterns
    return {
      avgSessionsPerHour: sessions.length / 24,
      avgCostPerSession: sessions.reduce((sum, s) => sum + (s.summary?.totalCost || 0), 0) / sessions.length,
      avgPerformance: sessions.reduce((sum, s) => sum + (s.summary?.successRate || 0), 0) / sessions.length
    };
  }

  private generateAllocationScenarios(targetMetrics: any): any[] {
    // Generate different allocation scenarios
    return [
      {
        name: 'cost-optimized',
        managerModel: 'sonnet',
        workerModel: 'sonnet',
        maxConcurrentSessions: 3,
        taskDistributionRatio: 0.3
      },
      {
        name: 'performance-optimized',
        managerModel: 'opus',
        workerModel: 'sonnet',
        maxConcurrentSessions: 2,
        taskDistributionRatio: 0.5
      },
      {
        name: 'balanced',
        managerModel: 'opus',
        workerModel: 'sonnet',
        maxConcurrentSessions: 4,
        taskDistributionRatio: 0.4
      }
    ];
  }

  private async evaluateAllocationScenario(scenario: any, currentPatterns: any): Promise<any> {
    // Evaluate allocation scenario
    return {
      configuration: scenario,
      outcomes: {
        averageCost: currentPatterns.avgCostPerSession * 0.9,
        averagePerformance: currentPatterns.avgPerformance * 1.1,
        averageDuration: 600000,
        errorRate: 0.05
      },
      confidence: 0.75,
      tradeoffs: ['May increase response time for cost savings'],
      score: 0.85
    };
  }

  private extractHourlyPatterns(sessions: DualAgentSession[]): Map<number, number[]> {
    const hourlyData = new Map<number, number[]>();
    
    sessions.forEach(session => {
      const hour = session.startTime.getHours();
      if (!hourlyData.has(hour)) {
        hourlyData.set(hour, []);
      }
      hourlyData.get(hour)!.push(1); // Count of sessions
    });

    return hourlyData;
  }

  private detectSeasonality(hourlyPatterns: Map<number, number[]>): any {
    return {
      detected: true,
      pattern: 'daily',
      peakHours: [9, 10, 11, 14, 15, 16]
    };
  }

  private predictHourlyLoad(
    forecastTime: Date,
    hourlyPatterns: Map<number, number[]>,
    seasonality: any
  ): { sessionCount: number; confidence: number } {
    const hour = forecastTime.getHours();
    const historicalData = hourlyPatterns.get(hour) || [0];
    const avgSessions = historicalData.reduce((sum, count) => sum + count, 0) / historicalData.length;

    return {
      sessionCount: Math.round(avgSessions),
      confidence: historicalData.length > 5 ? 0.8 : 0.4
    };
  }

  private generateCapacityAlerts(
    hourlyForecast: Array<{
      hour: Date;
      predictedSessions: number;
      resourceRequirements: any;
    }>
  ): string[] {
    const alerts: string[] = [];
    const maxLoad = Math.max(...hourlyForecast.map(f => f.predictedSessions));
    
    if (maxLoad > 10) {
      alerts.push('High load predicted - consider increasing capacity');
    }

    const totalCost = hourlyForecast.reduce((sum, f) => sum + f.resourceRequirements.estimatedCost, 0);
    if (totalCost > 500) {
      alerts.push('High cost forecast - consider optimization strategies');
    }

    return alerts;
  }

  private getAverageTokensPerSession(): number {
    return 5000; // Default estimate
  }

  private getAverageCostPerSession(): number {
    return 2.50; // Default estimate
  }

  /**
   * Get trained models
   */
  getModels(): PredictionModel[] {
    return Array.from(this.models.values());
  }

  /**
   * Get recent predictions
   */
  getPredictions(limit: number = 10): Prediction[] {
    return Array.from(this.predictions.values())
      .sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime())
      .slice(0, limit);
  }

  /**
   * Clear models and predictions
   */
  clearModels(): void {
    this.models.clear();
    this.predictions.clear();
    this.trainingData.clear();
  }
}