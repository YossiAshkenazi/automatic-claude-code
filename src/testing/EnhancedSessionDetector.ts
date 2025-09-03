/**
 * Enhanced Session Detection for SDK Testing
 * Epic 2, Story 2.2: Implement SDK Mock Layer for Testing
 * 
 * Context-aware session detection that respects test isolation and prevents
 * false positive nested session detection during testing.
 */

import { Logger } from '../logger';
import { ExecutionContext, ContextDetector } from './ContextDetector';

export interface SessionDetectionResult {
  isNested: boolean;
  reason: string;
  shouldBypassAuth: boolean;
  sessionContext: 'test' | 'development' | 'production';
  parentSessionId?: string;
  confidence: number; // 0-1, confidence in the detection
  detectionMethod: 'explicit' | 'environment' | 'process' | 'heuristic';
  warnings: string[];
}

export interface SessionDetectionOptions {
  respectTestMode?: boolean;
  strictTestIsolation?: boolean;
  allowNestedTesting?: boolean;
  logDetection?: boolean;
}

/**
 * Enhanced session detector that provides context-aware session detection
 */
export class EnhancedSessionDetector {
  private context: ExecutionContext;
  private logger?: Logger;
  private options: Required<SessionDetectionOptions>;

  constructor(context?: ExecutionContext, logger?: Logger, options: SessionDetectionOptions = {}) {
    this.context = context || ContextDetector.detectExecutionContext().context;
    this.logger = logger;
    this.options = {
      respectTestMode: options.respectTestMode ?? true,
      strictTestIsolation: options.strictTestIsolation ?? true,
      allowNestedTesting: options.allowNestedTesting ?? false,
      logDetection: options.logDetection ?? false
    };
  }

  /**
   * Detect nested session with context awareness
   */
  detectNestedSession(): SessionDetectionResult {
    const result = this.context.mode === 'test' 
      ? this.detectTestModeSession()
      : this.detectProductionSession();

    if (this.options.logDetection && this.logger) {
      this.logger.debug('Enhanced session detection completed', {
        mode: this.context.mode,
        isNested: result.isNested,
        reason: result.reason,
        confidence: result.confidence,
        method: result.detectionMethod
      });
    }

    return result;
  }

  /**
   * Test mode session detection - more restrictive and isolation-aware
   */
  private detectTestModeSession(): SessionDetectionResult {
    const warnings: string[] = [];

    // Check for explicit test nesting
    const explicitNesting = this.checkExplicitTestNesting();
    if (explicitNesting.isNested) {
      return explicitNesting;
    }

    // Check for parent test session
    const parentSession = this.checkParentTestSession();
    if (parentSession.isNested) {
      return parentSession;
    }

    // In strict test isolation mode, never consider nested unless explicit
    if (this.options.strictTestIsolation) {
      return {
        isNested: false,
        reason: 'strict_test_isolation_mode',
        shouldBypassAuth: false, // Tests should handle their own auth
        sessionContext: 'test',
        confidence: 0.95,
        detectionMethod: 'explicit',
        warnings
      };
    }

    // Relaxed test mode - check for actual nesting indicators
    return this.checkRelaxedTestNesting(warnings);
  }

  /**
   * Production mode session detection - uses original logic but enhanced
   */
  private detectProductionSession(): SessionDetectionResult {
    const warnings: string[] = [];

    // Environment-based detection (highest confidence)
    const envResult = this.checkEnvironmentVariables();
    if (envResult.isNested) {
      return envResult;
    }

    // Process-based detection (medium confidence)
    const processResult = this.checkProcessIndicators(warnings);
    if (processResult.isNested) {
      return processResult;
    }

    // No nesting detected
    return {
      isNested: false,
      reason: 'no_nesting_indicators_found',
      shouldBypassAuth: false,
      sessionContext: 'production',
      confidence: 0.9,
      detectionMethod: 'heuristic',
      warnings
    };
  }

  /**
   * Check for explicit test nesting configuration
   */
  private checkExplicitTestNesting(): SessionDetectionResult {
    if (process.env.ACC_NESTED_TEST === 'true') {
      return {
        isNested: true,
        reason: 'explicit_nested_test_configuration',
        shouldBypassAuth: false,
        sessionContext: 'test',
        parentSessionId: process.env.ACC_PARENT_SESSION_ID,
        confidence: 1.0,
        detectionMethod: 'explicit',
        warnings: []
      };
    }

    return { 
      isNested: false, 
      reason: 'no_explicit_nesting',
      shouldBypassAuth: false,
      sessionContext: 'test',
      confidence: 1.0,
      detectionMethod: 'explicit',
      warnings: []
    };
  }

  /**
   * Check for parent test session
   */
  private checkParentTestSession(): SessionDetectionResult {
    const parentSessionId = process.env.ACC_PARENT_SESSION_ID || 
                           process.env.ACC_TEST_SESSION_ID;

    if (parentSessionId && this.options.allowNestedTesting) {
      return {
        isNested: true,
        reason: 'parent_test_session_detected',
        shouldBypassAuth: false,
        sessionContext: 'test',
        parentSessionId,
        confidence: 0.9,
        detectionMethod: 'environment',
        warnings: []
      };
    }

    return {
      isNested: false,
      reason: 'no_parent_session',
      shouldBypassAuth: false,
      sessionContext: 'test',
      confidence: 0.9,
      detectionMethod: 'environment',
      warnings: []
    };
  }

  /**
   * Relaxed test nesting check - for when strict isolation is disabled
   */
  private checkRelaxedTestNesting(warnings: string[]): SessionDetectionResult {
    const indicators = this.gatherNestingIndicators();

    // If we find strong indicators even in test mode, warn but don't assume nested
    if (indicators.strongIndicators > 0) {
      warnings.push(`Found ${indicators.strongIndicators} strong nesting indicators in test mode`);
      warnings.push('Consider enabling strict test isolation or explicit test configuration');
      
      return {
        isNested: false, // Still don't assume nested in test mode
        reason: 'test_mode_with_production_indicators',
        shouldBypassAuth: false,
        sessionContext: 'test',
        confidence: 0.6,
        detectionMethod: 'heuristic',
        warnings
      };
    }

    return {
      isNested: false,
      reason: 'no_nesting_in_test_mode',
      shouldBypassAuth: false,
      sessionContext: 'test',
      confidence: 0.85,
      detectionMethod: 'heuristic',
      warnings
    };
  }

  /**
   * Check environment variables for nesting
   */
  private checkEnvironmentVariables(): SessionDetectionResult {
    const claudeCodeEnv = process.env.CLAUDECODE === '1';
    const entryPointEnv = process.env.CLAUDE_CODE_ENTRYPOINT === 'cli';
    
    if (claudeCodeEnv || entryPointEnv) {
      return {
        isNested: true,
        reason: claudeCodeEnv ? 'CLAUDECODE_environment_variable' : 'CLAUDE_CODE_ENTRYPOINT_cli',
        shouldBypassAuth: true, // Assume parent session is authenticated
        sessionContext: 'production',
        confidence: 0.95,
        detectionMethod: 'environment',
        warnings: []
      };
    }

    return {
      isNested: false,
      reason: 'no_environment_indicators',
      shouldBypassAuth: false,
      sessionContext: 'production',
      confidence: 0.9,
      detectionMethod: 'environment',
      warnings: []
    };
  }

  /**
   * Check process-based indicators
   */
  private checkProcessIndicators(warnings: string[]): SessionDetectionResult {
    const indicators = this.gatherNestingIndicators();
    
    // Strong indicators suggest actual nesting
    if (indicators.strongIndicators >= 2) {
      return {
        isNested: true,
        reason: `multiple_process_indicators_${indicators.strongIndicators}`,
        shouldBypassAuth: true,
        sessionContext: 'production',
        confidence: 0.8,
        detectionMethod: 'process',
        warnings: indicators.warnings
      };
    }

    // Weak indicators might be false positives
    if (indicators.weakIndicators > 0) {
      warnings.push(...indicators.warnings);
      warnings.push('Weak nesting indicators found - might be false positive');
      
      return {
        isNested: false,
        reason: 'weak_indicators_insufficient',
        shouldBypassAuth: false,
        sessionContext: 'production',
        confidence: 0.7,
        detectionMethod: 'heuristic',
        warnings
      };
    }

    return {
      isNested: false,
      reason: 'no_process_indicators',
      shouldBypassAuth: false,
      sessionContext: 'production',
      confidence: 0.85,
      detectionMethod: 'process',
      warnings
    };
  }

  /**
   * Gather nesting indicators from process state
   */
  private gatherNestingIndicators(): {
    strongIndicators: number;
    weakIndicators: number;
    warnings: string[];
  } {
    let strongIndicators = 0;
    let weakIndicators = 0;
    const warnings: string[] = [];

    // Check argv for claude references
    const hasClaudeInArgv = process.argv.some(arg => {
      const lowerArg = arg.toLowerCase();
      // Exclude our own test files and common false positives
      return lowerArg.includes('claude') && 
             !lowerArg.includes('testsdkautopilot') &&
             !lowerArg.includes('test') &&
             !lowerArg.includes('automatic-claude-code');
    });

    if (hasClaudeInArgv) {
      strongIndicators++;
      warnings.push('Claude reference found in process arguments');
    }

    // Check process title
    const processTitle = process.title?.toLowerCase() || '';
    const hasClaudeInTitle = processTitle.includes('claude') && 
                            !processTitle.includes('automatic-claude-code');
    
    if (hasClaudeInTitle) {
      strongIndicators++;
      warnings.push('Claude reference found in process title');
    }

    // Check for parent process indicators (weaker signal)
    if (process.ppid && process.ppid !== 1) {
      weakIndicators++;
      warnings.push('Process has parent process (might indicate nesting)');
    }

    // Check for specific working directories that suggest nesting
    const cwd = process.cwd().toLowerCase();
    if (cwd.includes('claude') && !cwd.includes('automatic-claude-code')) {
      weakIndicators++;
      warnings.push('Working directory suggests Claude environment');
    }

    return {
      strongIndicators,
      weakIndicators,
      warnings
    };
  }

  /**
   * Get a detailed explanation of the session detection result
   */
  getDetectionExplanation(result: SessionDetectionResult): string {
    let explanation = `Session detection in ${result.sessionContext} mode: `;
    
    if (result.isNested) {
      explanation += `NESTED session detected (${result.reason})`;
    } else {
      explanation += `ISOLATED session detected (${result.reason})`;
    }

    explanation += ` | Confidence: ${(result.confidence * 100).toFixed(1)}%`;
    explanation += ` | Method: ${result.detectionMethod}`;
    
    if (result.shouldBypassAuth) {
      explanation += ` | Auth: BYPASS`;
    }
    
    if (result.warnings.length > 0) {
      explanation += ` | Warnings: ${result.warnings.length}`;
    }

    return explanation;
  }

  /**
   * Create a detector instance optimized for testing
   */
  static forTesting(options: SessionDetectionOptions = {}): EnhancedSessionDetector {
    const testOptions = {
      respectTestMode: true,
      strictTestIsolation: true,
      allowNestedTesting: false,
      logDetection: false,
      ...options
    };

    return new EnhancedSessionDetector(undefined, undefined, testOptions);
  }

  /**
   * Create a detector instance for production use
   */
  static forProduction(logger?: Logger): EnhancedSessionDetector {
    const prodOptions = {
      respectTestMode: false,
      strictTestIsolation: false,
      allowNestedTesting: true,
      logDetection: true
    };

    return new EnhancedSessionDetector(undefined, logger, prodOptions);
  }
}

export default EnhancedSessionDetector;