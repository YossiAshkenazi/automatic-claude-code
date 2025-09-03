/**
 * TaskCompletionAnalyzer.ts
 * 
 * Core component for Story 1.2: SDK-Based Autopilot Logic
 * Analyzes SDK responses to determine when autopilot should continue or stop
 */

import { Logger } from '../logger';
import {
  SDKResponse,
  SDKResult,
  CompletionAnalysis,
  CompletionPattern,
  TaskContext,
  ExecutionContext,
  AutopilotError
} from '../types';

export class TaskCompletionAnalyzer {
  private logger: Logger;

  // Pattern weights for completion analysis
  private readonly PATTERN_WEIGHTS = {
    explicit_completion: 0.9,
    task_pending: 0.8,
    error_needs_fixing: 0.7,
    clarification_needed: 0.6,
    iterative_improvement: 0.5
  };

  // Continuation indicators - phrases that suggest more work is needed
  private readonly CONTINUATION_PATTERNS = [
    /(?:next|continue|then|afterwards|also need|additionally|furthermore)/i,
    /(?:let me|i'll|i will|i can|i should|we should|we need)/i,
    /(?:step \d+|phase \d+|next step|following step)/i,
    /(?:todo|to do|remaining|still need|not yet|incomplete)/i,
    /(?:build|create|implement|setup|configure|install|add|modify)/i,
    /(?:would you like|shall i|should i|do you want)/i
  ];

  // Completion indicators - phrases that suggest task is done
  private readonly COMPLETION_PATTERNS = [
    /(?:complete|completed|finished|done|ready|success|successful)/i,
    /(?:that's it|all set|you're good|everything is|all done)/i,
    /(?:working as expected|functioning properly|now available|now ready)/i,
    /(?:task accomplished|implementation complete|setup complete)/i,
    /(?:no further|no additional|nothing more|that completes)/i
  ];

  // Error patterns that need fixing
  private readonly ERROR_PATTERNS = [
    /(?:error|failed|failure|exception|crash|bug|issue|problem)/i,
    /(?:not working|doesn't work|broken|corrupted|invalid)/i,
    /(?:permission denied|access denied|unauthorized|forbidden)/i,
    /(?:file not found|directory not found|command not found)/i,
    /(?:timeout|connection|network|server error)/i
  ];

  // Question patterns that need clarification
  private readonly CLARIFICATION_PATTERNS = [
    /(?:\?|what|which|where|when|why|how)/i,
    /(?:could you|can you|would you|do you want|please specify)/i,
    /(?:unclear|ambiguous|need more|not sure|don't know)/i,
    /(?:missing information|need clarification|please provide)/i
  ];

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Analyzes an SDK response to determine completion status
   */
  async analyzeCompletion(
    sdkResponse: SDKResult,
    context: TaskContext
  ): Promise<CompletionAnalysis> {
    try {
      this.logger.debug('Analyzing task completion for SDK response');
      
      // Extract the main output text for analysis
      const outputText = sdkResponse.output || '';
      const hasError = sdkResponse.hasError;

      // Detect patterns in the response
      const patterns = this.detectPatterns(outputText, hasError);
      
      // Calculate completion confidence
      const confidence = this.calculateCompletionConfidence(patterns, outputText);
      
      // Determine if continuation is needed
      const continuationNeeded = this.shouldContinueExecution(
        patterns, 
        confidence, 
        context
      );

      // Calculate quality score based on response analysis
      const qualityScore = this.calculateQualityScore(
        outputText, 
        hasError, 
        patterns,
        sdkResponse.executionTime
      );

      // Determine completion status
      const isComplete = !continuationNeeded && confidence > 0.7;

      // Generate next action suggestion if continuation is needed
      const suggestedNextAction = continuationNeeded ? 
        this.generateNextActionSuggestion(patterns, outputText) : 
        undefined;

      const analysis: CompletionAnalysis = {
        isComplete,
        confidence,
        continuationNeeded,
        reasonForContinuation: continuationNeeded ? 
          this.generateContinuationReason(patterns) : 
          undefined,
        suggestedNextAction,
        detectedPatterns: patterns,
        qualityScore
      };

      if (this.logger.isDebugEnabled()) {
        this.logger.debug(`Completion analysis: complete=${isComplete}, confidence=${confidence.toFixed(2)}, continue=${continuationNeeded}`);
      }

      return analysis;

    } catch (error: any) {
      this.logger.error(`Error analyzing task completion: ${error.message}`);
      
      // Return safe default analysis in case of error
      return {
        isComplete: false,
        confidence: 0.3,
        continuationNeeded: true,
        reasonForContinuation: 'Analysis error occurred, assuming continuation needed',
        detectedPatterns: [],
        qualityScore: 0.5
      };
    }
  }

  /**
   * Determines if autopilot should continue based on analysis and context
   */
  shouldContinue(
    analysis: CompletionAnalysis, 
    context: ExecutionContext
  ): boolean {
    try {
      // Check iteration limits
      if (context.currentIteration >= context.maxIterations) {
        this.logger.info(`Maximum iterations (${context.maxIterations}) reached`);
        return false;
      }

      // Check timeout
      const timeElapsed = Date.now() - context.startTime.getTime();
      if (timeElapsed > (5 * 60 * 1000)) { // 5 minutes default timeout
        this.logger.info('Execution timeout reached');
        return false;
      }

      // If task is explicitly complete with high confidence, stop
      if (analysis.isComplete && analysis.confidence > 0.8) {
        this.logger.info(`Task marked complete with high confidence (${analysis.confidence.toFixed(2)})`);
        return false;
      }

      // If continuation is needed and we haven't hit limits, continue
      if (analysis.continuationNeeded && analysis.confidence > 0.4) {
        this.logger.debug(`Continuation needed: ${analysis.reasonForContinuation}`);
        return true;
      }

      // If quality score is too low, continue for improvement
      if (analysis.qualityScore < 0.6 && context.currentIteration < (context.maxIterations * 0.8)) {
        this.logger.debug(`Quality score (${analysis.qualityScore.toFixed(2)}) below threshold, continuing`);
        return true;
      }

      // Default to stopping if uncertain
      this.logger.debug('No clear continuation signal, stopping execution');
      return false;

    } catch (error: any) {
      this.logger.error(`Error in continuation decision: ${error.message}`);
      return false; // Err on the side of caution
    }
  }

  /**
   * Detects completion patterns in the response text
   */
  private detectPatterns(outputText: string, hasError: boolean): CompletionPattern[] {
    const patterns: CompletionPattern[] = [];

    // Check for explicit completion patterns
    const completionMatches = this.countPatternMatches(outputText, this.COMPLETION_PATTERNS);
    if (completionMatches > 0) {
      patterns.push({
        type: 'explicit_completion',
        confidence: Math.min(completionMatches * 0.3, 1.0),
        evidence: this.extractPatternEvidence(outputText, this.COMPLETION_PATTERNS),
        weight: this.PATTERN_WEIGHTS.explicit_completion
      });
    }

    // Check for continuation patterns
    const continuationMatches = this.countPatternMatches(outputText, this.CONTINUATION_PATTERNS);
    if (continuationMatches > 0) {
      patterns.push({
        type: 'task_pending',
        confidence: Math.min(continuationMatches * 0.2, 1.0),
        evidence: this.extractPatternEvidence(outputText, this.CONTINUATION_PATTERNS),
        weight: this.PATTERN_WEIGHTS.task_pending
      });
    }

    // Check for error patterns
    const errorMatches = this.countPatternMatches(outputText, this.ERROR_PATTERNS) || (hasError ? 1 : 0);
    if (errorMatches > 0) {
      patterns.push({
        type: 'error_needs_fixing',
        confidence: Math.min(errorMatches * 0.4, 1.0),
        evidence: this.extractPatternEvidence(outputText, this.ERROR_PATTERNS),
        weight: this.PATTERN_WEIGHTS.error_needs_fixing
      });
    }

    // Check for clarification patterns
    const clarificationMatches = this.countPatternMatches(outputText, this.CLARIFICATION_PATTERNS);
    if (clarificationMatches > 0) {
      patterns.push({
        type: 'clarification_needed',
        confidence: Math.min(clarificationMatches * 0.3, 1.0),
        evidence: this.extractPatternEvidence(outputText, this.CLARIFICATION_PATTERNS),
        weight: this.PATTERN_WEIGHTS.clarification_needed
      });
    }

    // Check for iterative improvement indicators
    const improvementIndicators = /(?:improve|optimize|enhance|refactor|better|upgrade)/gi;
    const improvementMatches = (outputText.match(improvementIndicators) || []).length;
    if (improvementMatches > 0) {
      patterns.push({
        type: 'iterative_improvement',
        confidence: Math.min(improvementMatches * 0.2, 1.0),
        evidence: outputText.match(improvementIndicators) || [],
        weight: this.PATTERN_WEIGHTS.iterative_improvement
      });
    }

    return patterns;
  }

  /**
   * Calculates completion confidence based on detected patterns
   */
  private calculateCompletionConfidence(patterns: CompletionPattern[], outputText: string): number {
    if (patterns.length === 0) {
      // No patterns detected, assume medium confidence based on output length
      return outputText.length > 100 ? 0.6 : 0.4;
    }

    let weightedScore = 0;
    let totalWeight = 0;

    for (const pattern of patterns) {
      const contribution = pattern.confidence * pattern.weight;
      
      if (pattern.type === 'explicit_completion') {
        weightedScore += contribution;
      } else if (pattern.type === 'task_pending' || pattern.type === 'error_needs_fixing') {
        weightedScore -= contribution * 0.5; // Negative contribution for continuation signals
      } else if (pattern.type === 'clarification_needed') {
        weightedScore -= contribution * 0.3;
      } else if (pattern.type === 'iterative_improvement') {
        weightedScore -= contribution * 0.2;
      }
      
      totalWeight += pattern.weight;
    }

    // Normalize the score
    const normalizedScore = totalWeight > 0 ? (weightedScore / totalWeight) : 0.5;
    
    // Ensure score is between 0 and 1
    return Math.max(0, Math.min(1, normalizedScore + 0.5));
  }

  /**
   * Determines if execution should continue based on patterns and confidence
   */
  private shouldContinueExecution(
    patterns: CompletionPattern[], 
    confidence: number, 
    context: TaskContext
  ): boolean {
    // Strong completion signals with high confidence = stop
    const hasStrongCompletion = patterns.some(p => 
      p.type === 'explicit_completion' && p.confidence > 0.7
    );
    
    if (hasStrongCompletion && confidence > 0.8) {
      return false;
    }

    // Error or task pending signals = continue
    const hasErrors = patterns.some(p => p.type === 'error_needs_fixing');
    const hasPendingTasks = patterns.some(p => 
      p.type === 'task_pending' && p.confidence > 0.5
    );
    
    if (hasErrors || hasPendingTasks) {
      return true;
    }

    // Clarification needed = continue (try to resolve)
    const needsClarification = patterns.some(p => 
      p.type === 'clarification_needed' && p.confidence > 0.6
    );
    
    if (needsClarification) {
      return true;
    }

    // If confidence is low, continue to improve
    return confidence < 0.7;
  }

  /**
   * Calculates quality score based on response characteristics
   */
  private calculateQualityScore(
    outputText: string, 
    hasError: boolean, 
    patterns: CompletionPattern[],
    executionTime: number
  ): number {
    let score = 0.7; // Base score

    // Penalize errors
    if (hasError) {
      score -= 0.3;
    }

    // Reward substantial output
    if (outputText.length > 500) {
      score += 0.1;
    } else if (outputText.length < 50) {
      score -= 0.2;
    }

    // Reward completion patterns
    const completionPattern = patterns.find(p => p.type === 'explicit_completion');
    if (completionPattern) {
      score += completionPattern.confidence * 0.2;
    }

    // Penalize error patterns
    const errorPattern = patterns.find(p => p.type === 'error_needs_fixing');
    if (errorPattern) {
      score -= errorPattern.confidence * 0.3;
    }

    // Consider execution time (reasonable time is good)
    if (executionTime > 60000) { // More than 1 minute
      score -= 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Generates a reason for continuation based on detected patterns
   */
  private generateContinuationReason(patterns: CompletionPattern[]): string {
    const reasons: string[] = [];

    for (const pattern of patterns) {
      switch (pattern.type) {
        case 'task_pending':
          reasons.push('Additional tasks or steps were identified');
          break;
        case 'error_needs_fixing':
          reasons.push('Errors were detected that need to be resolved');
          break;
        case 'clarification_needed':
          reasons.push('Response indicates need for clarification or additional information');
          break;
        case 'iterative_improvement':
          reasons.push('Opportunities for improvement or optimization were identified');
          break;
      }
    }

    return reasons.length > 0 ? reasons.join('; ') : 'Task appears incomplete based on response analysis';
  }

  /**
   * Generates suggested next action based on patterns
   */
  private generateNextActionSuggestion(patterns: CompletionPattern[], outputText: string): string {
    const errorPattern = patterns.find(p => p.type === 'error_needs_fixing');
    if (errorPattern) {
      return 'Fix the identified errors and retry the operation';
    }

    const clarificationPattern = patterns.find(p => p.type === 'clarification_needed');
    if (clarificationPattern) {
      return 'Provide additional context or clarify requirements';
    }

    const pendingPattern = patterns.find(p => p.type === 'task_pending');
    if (pendingPattern) {
      return 'Continue with the next step or pending task';
    }

    return 'Review the current output and determine next steps';
  }

  /**
   * Counts how many patterns match in the text
   */
  private countPatternMatches(text: string, patterns: RegExp[]): number {
    return patterns.reduce((count, pattern) => {
      const matches = text.match(pattern);
      return count + (matches ? matches.length : 0);
    }, 0);
  }

  /**
   * Extracts evidence of pattern matches
   */
  private extractPatternEvidence(text: string, patterns: RegExp[]): string[] {
    const evidence: string[] = [];
    
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        evidence.push(...matches.slice(0, 3)); // Limit to 3 matches per pattern
      }
    }
    
    return evidence.slice(0, 5); // Limit total evidence
  }

  /**
   * Creates an autopilot error for invalid analysis state
   */
  private createAnalysisError(message: string, sessionId: string): AutopilotError {
    return {
      type: 'validation_error',
      message,
      timestamp: new Date(),
      sessionId,
      recoverable: true,
      suggestedAction: 'Retry analysis with different parameters'
    };
  }
}