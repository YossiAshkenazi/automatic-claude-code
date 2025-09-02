/**
 * Context Detection for SDK Session Isolation
 * Epic 2, Story 2.1: Analyze and Document SDK Session Detection Behavior
 * 
 * Provides execution context awareness to distinguish between test, development,
 * and production execution environments for proper SDK session isolation.
 */

export interface ExecutionContext {
  mode: 'test' | 'development' | 'production';
  isTestRunner: boolean;
  isManualTest: boolean;
  isCI: boolean;
  processIsolation: boolean;
  testFramework?: 'jest' | 'vitest' | 'manual' | 'unknown';
  sessionId?: string;
}

export interface ContextDetectionResult {
  context: ExecutionContext;
  confidence: number; // 0-1, how confident we are in the detection
  reasons: string[]; // Why we detected this context
  warnings: string[]; // Any potential issues or ambiguities
}

/**
 * Detects the execution context to enable appropriate SDK behavior
 */
export class ContextDetector {
  private static cachedContext?: ContextDetectionResult;
  private static cacheExpiry?: number;
  private static readonly CACHE_DURATION_MS = 5000; // 5 second cache

  /**
   * Detect the current execution context with caching
   */
  static detectExecutionContext(forceRefresh = false): ContextDetectionResult {
    // Return cached result if still valid
    if (!forceRefresh && this.cachedContext && this.cacheExpiry) {
      if (Date.now() < this.cacheExpiry) {
        return this.cachedContext;
      }
    }

    const context = this.performDetection();
    
    // Cache the result
    this.cachedContext = context;
    this.cacheExpiry = Date.now() + this.CACHE_DURATION_MS;
    
    return context;
  }

  /**
   * Perform the actual context detection
   */
  private static performDetection(): ContextDetectionResult {
    const reasons: string[] = [];
    const warnings: string[] = [];
    let confidence = 1.0;

    // Detect execution mode
    const mode = this.detectMode(reasons, warnings);
    
    // Detect test runner
    const testRunnerInfo = this.detectTestRunner(reasons);
    
    // Detect manual test execution
    const isManualTest = this.isManualTestExecution(reasons);
    
    // Detect CI environment
    const isCI = this.isCIEnvironment(reasons);

    // Determine process isolation
    const processIsolation = this.shouldEnableProcessIsolation(mode, testRunnerInfo.isTestRunner, isCI);

    // Generate session ID for test isolation
    const sessionId = mode === 'test' ? this.generateTestSessionId() : undefined;

    // Adjust confidence based on ambiguity
    if (mode === 'production' && (testRunnerInfo.isTestRunner || isManualTest)) {
      confidence = 0.7;
      warnings.push('Production mode detected but test indicators present');
    }

    if (testRunnerInfo.framework === 'unknown' && testRunnerInfo.isTestRunner) {
      confidence = Math.min(confidence, 0.8);
      warnings.push('Test runner detected but framework unknown');
    }

    const context: ExecutionContext = {
      mode,
      isTestRunner: testRunnerInfo.isTestRunner,
      isManualTest,
      isCI,
      processIsolation,
      testFramework: testRunnerInfo.framework,
      sessionId
    };

    return {
      context,
      confidence,
      reasons,
      warnings
    };
  }

  /**
   * Detect the execution mode (test/development/production)
   */
  private static detectMode(reasons: string[], warnings: string[]): 'test' | 'development' | 'production' {
    // Explicit test mode
    if (process.env.NODE_ENV === 'test') {
      reasons.push('NODE_ENV=test');
      return 'test';
    }

    if (process.env.ACC_TEST_MODE === 'true') {
      reasons.push('ACC_TEST_MODE=true');
      return 'test';
    }

    // Check for test runner context
    if (this.isRunningInTestRunner()) {
      reasons.push('Test runner detected in process');
      return 'test';
    }

    // Manual test execution
    if (this.isManualTestExecution()) {
      reasons.push('Manual test execution detected');
      return 'test';
    }

    // Development mode
    if (process.env.NODE_ENV === 'development') {
      reasons.push('NODE_ENV=development');
      return 'development';
    }

    // Check for development indicators
    if (process.cwd().includes('node_modules') || 
        process.argv.some(arg => arg.includes('nodemon') || arg.includes('ts-node'))) {
      reasons.push('Development tooling detected');
      return 'development';
    }

    // Default to production
    reasons.push('No specific mode indicators found');
    return 'production';
  }

  /**
   * Detect test runner and framework
   */
  private static detectTestRunner(reasons: string[]): { isTestRunner: boolean; framework?: 'jest' | 'vitest' | 'manual' | 'unknown' } {
    // Jest detection
    if (process.env.JEST_WORKER_ID || 
        process.env.JEST_WORKER_THREADS ||
        process.argv.some(arg => arg.includes('jest'))) {
      reasons.push('Jest test runner detected');
      return { isTestRunner: true, framework: 'jest' };
    }

    // Vitest detection
    if (process.env.VITEST || 
        process.env.VITE_TEST ||
        process.argv.some(arg => arg.includes('vitest'))) {
      reasons.push('Vitest test runner detected');
      return { isTestRunner: true, framework: 'vitest' };
    }

    // Generic test detection
    if (process.argv.some(arg => 
        arg.includes('test') && 
        !arg.includes('testSDKAutopilot') // Exclude our manual test
      )) {
      reasons.push('Generic test command detected');
      return { isTestRunner: true, framework: 'unknown' };
    }

    // Manual test detection
    if (this.isManualTestExecution()) {
      reasons.push('Manual test execution detected');
      return { isTestRunner: true, framework: 'manual' };
    }

    return { isTestRunner: false };
  }

  /**
   * Check if running in a test runner
   */
  private static isRunningInTestRunner(): boolean {
    return !!(
      process.env.JEST_WORKER_ID ||
      process.env.JEST_WORKER_THREADS ||
      process.env.VITEST ||
      process.env.VITE_TEST ||
      process.argv.some(arg => arg.includes('jest') || arg.includes('vitest'))
    );
  }

  /**
   * Check if this is manual test execution
   */
  private static isManualTestExecution(reasons?: string[]): boolean {
    const isManual = process.argv.some(arg => 
      arg.includes('testSDKAutopilot') || 
      arg.includes('manual/test') ||
      arg.includes('manual\\test') || // Windows path
      arg.includes('__tests__/manual') ||
      arg.includes('__tests__\\manual')
    );

    if (isManual && reasons) {
      reasons.push('Manual test file detected in argv');
    }

    return isManual;
  }

  /**
   * Check if running in CI environment
   */
  private static isCIEnvironment(reasons: string[]): boolean {
    const ciIndicators = [
      'CI',
      'CONTINUOUS_INTEGRATION',
      'GITHUB_ACTIONS',
      'TRAVIS',
      'CIRCLECI',
      'JENKINS_URL',
      'BUILDKITE',
      'DRONE'
    ];

    for (const indicator of ciIndicators) {
      if (process.env[indicator] === 'true' || process.env[indicator] === '1') {
        reasons.push(`CI environment detected: ${indicator}`);
        return true;
      }
    }

    return false;
  }

  /**
   * Determine if process isolation should be enabled
   */
  private static shouldEnableProcessIsolation(
    mode: string,
    isTestRunner: boolean,
    isCI: boolean
  ): boolean {
    // Always enable for tests
    if (mode === 'test' || isTestRunner) {
      return true;
    }

    // Enable in CI for safety
    if (isCI) {
      return true;
    }

    // Check explicit setting
    if (process.env.ACC_PROCESS_ISOLATION === 'true') {
      return true;
    }

    if (process.env.ACC_PROCESS_ISOLATION === 'false') {
      return false;
    }

    // Default: enable for non-production
    return mode !== 'production';
  }

  /**
   * Generate a unique session ID for test isolation
   */
  private static generateTestSessionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    const pid = process.pid;
    return `test-${timestamp}-${pid}-${random}`;
  }

  /**
   * Check if the current context is safe for testing
   */
  static isTestingSafe(): boolean {
    const detection = this.detectExecutionContext();
    return detection.context.mode === 'test' || 
           detection.context.processIsolation ||
           detection.confidence >= 0.8;
  }

  /**
   * Get a human-readable description of the current context
   */
  static getContextDescription(): string {
    const detection = this.detectExecutionContext();
    const ctx = detection.context;
    
    let description = `Mode: ${ctx.mode}`;
    
    if (ctx.isTestRunner) {
      description += ` | Test Runner: ${ctx.testFramework || 'unknown'}`;
    }
    
    if (ctx.isManualTest) {
      description += ` | Manual Test`;
    }
    
    if (ctx.isCI) {
      description += ` | CI Environment`;
    }
    
    if (ctx.processIsolation) {
      description += ` | Process Isolation Enabled`;
    }
    
    description += ` | Confidence: ${(detection.confidence * 100).toFixed(1)}%`;
    
    return description;
  }

  /**
   * Clear the cached context (useful for testing this class)
   */
  static clearCache(): void {
    this.cachedContext = undefined;
    this.cacheExpiry = undefined;
  }
}

export default ContextDetector;