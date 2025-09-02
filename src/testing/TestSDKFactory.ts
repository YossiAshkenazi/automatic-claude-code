/**
 * Test SDK Factory for Clean SDK Instantiation
 * Epic 2, Story 2.3: Create Test-Specific SDK Initialization Pattern
 * 
 * Provides clean SDK component instantiation for tests with configurable behavior,
 * isolated instances, and automatic memory cleanup.
 */

import { Logger } from '../logger';
import { SDKClaudeExecutor } from '../services/sdkClaudeExecutor';
import { ContextDetector, ExecutionContext } from './ContextDetector';
import { EnhancedSessionDetector, SessionDetectionOptions } from './EnhancedSessionDetector';
import { MockSDKLayer } from './MockSDKLayer';
import ProcessHandleTracker, { 
  HandleTrackingOptions, 
  ProcessTerminationOptions, 
  HandleCleanupResult 
} from './ProcessHandleTracker';

export interface TestSDKOptions {
  mockLevel: 'none' | 'session_only' | 'full_mock';
  sessionBehavior: 'isolated' | 'shared' | 'bypass';
  authentication: 'mock' | 'bypass' | 'real';
  processIsolation: boolean;
  timeoutMs?: number;
  enableLogging?: boolean;
  logLevel?: 'debug' | 'info' | 'warning' | 'error';
  sessionDetectionOptions?: SessionDetectionOptions;
  mockResponses?: Map<string, any>;
  // Process handle tracking options
  enableHandleTracking?: boolean;
  handleTrackingOptions?: HandleTrackingOptions;
  terminationOptions?: ProcessTerminationOptions;
}

export interface TestSDKInstance {
  sdk: TestSDKClaudeExecutor;
  sessionId: string;
  cleanup: () => Promise<void>;
  getMockLayer?: () => MockSDKLayer;
  // Process handle management
  handleTracker?: ProcessHandleTracker;
  forceTermination?: (options?: ProcessTerminationOptions) => Promise<void>;
  getHandleStatistics?: () => any;
}

/**
 * Factory for creating test-specific SDK instances
 */
export class TestSDKFactory {
  private static instances: Map<string, TestSDKInstance> = new Map();
  private static instanceCounter = 0;
  private static globalHandleTracker?: ProcessHandleTracker;

  /**
   * Create an isolated SDK instance for testing
   */
  static createIsolated(overrides: Partial<TestSDKOptions> = {}): TestSDKInstance {
    const options: TestSDKOptions = {
      mockLevel: 'session_only',
      sessionBehavior: 'isolated',
      authentication: 'mock',
      processIsolation: true,
      enableLogging: false,
      logLevel: 'error',
      enableHandleTracking: true, // Enable handle tracking by default for tests
      ...overrides
    };

    return this.createTestSDK(options);
  }

  /**
   * Create a fully mocked SDK instance for unit tests
   */
  static createFullMock(mockResponses?: Map<string, any>): TestSDKInstance {
    const options: TestSDKOptions = {
      mockLevel: 'full_mock',
      sessionBehavior: 'bypass',
      authentication: 'mock',
      processIsolation: true,
      enableLogging: false,
      enableHandleTracking: true, // Enable handle tracking for mocked tests
      mockResponses
    };

    return this.createTestSDK(options);
  }

  /**
   * Create a real SDK instance with minimal mocking (integration tests)
   */
  static createIntegration(overrides: Partial<TestSDKOptions> = {}): TestSDKInstance {
    const options: TestSDKOptions = {
      mockLevel: 'none',
      sessionBehavior: 'isolated',
      authentication: 'real',
      processIsolation: true,
      enableLogging: true,
      logLevel: 'info',
      timeoutMs: 30000, // 30 second timeout for real operations
      enableHandleTracking: true, // Critical for integration tests to prevent hanging
      ...overrides
    };

    return this.createTestSDK(options);
  }

  /**
   * Create a test SDK instance with custom configuration
   */
  static createTestSDK(options: TestSDKOptions): TestSDKInstance {
    const instanceId = this.generateInstanceId();
    const context = ContextDetector.detectExecutionContext().context;
    
    // Setup test environment
    this.setupTestEnvironment(options, instanceId);
    
    // Create logger
    const logger = this.createTestLogger(options, instanceId);
    
    // Initialize handle tracking if enabled
    let handleTracker: ProcessHandleTracker | undefined;
    if (options.enableHandleTracking) {
      handleTracker = this.initializeHandleTracking(options, logger, instanceId);
    }
    
    // Create SDK with test configuration
    const sdk = new TestSDKClaudeExecutor(options, context, logger);
    
    // Configure mock layer if needed
    let mockLayer: MockSDKLayer | undefined;
    if (options.mockLevel !== 'none') {
      mockLayer = this.configureMockLayer(sdk, options);
    }

    // Create enhanced cleanup function with handle tracking
    const cleanup = async () => {
      await this.cleanupInstance(instanceId);
    };

    // Create force termination function
    const forceTermination = async (terminationOptions?: ProcessTerminationOptions) => {
      if (handleTracker) {
        await handleTracker.enforceProcessTermination({
          ...options.terminationOptions,
          ...terminationOptions
        });
      }
    };

    // Create handle statistics function
    const getHandleStatistics = () => {
      return handleTracker ? handleTracker.getStatistics() : undefined;
    };

    const instance: TestSDKInstance = {
      sdk,
      sessionId: instanceId,
      cleanup,
      getMockLayer: mockLayer ? () => mockLayer! : undefined,
      handleTracker,
      forceTermination,
      getHandleStatistics
    };

    // Register instance for tracking
    this.instances.set(instanceId, instance);

    return instance;
  }

  /**
   * Setup test-specific environment variables
   */
  private static setupTestEnvironment(options: TestSDKOptions, instanceId: string): void {
    // Clear potentially interfering environment variables
    if (options.processIsolation) {
      delete process.env.CLAUDECODE;
      delete process.env.CLAUDE_CODE_ENTRYPOINT;
    }

    // Set test-specific variables
    process.env.ACC_TEST_MODE = 'true';
    process.env.ACC_PROCESS_ISOLATION = options.processIsolation ? 'true' : 'false';
    process.env.ACC_SESSION_BEHAVIOR = options.sessionBehavior;
    process.env.ACC_TEST_INSTANCE_ID = instanceId;

    // Set session-specific variables
    if (options.sessionBehavior === 'isolated') {
      process.env.ACC_TEST_SESSION_ID = instanceId;
    } else if (options.sessionBehavior === 'bypass') {
      process.env.ACC_NESTED_TEST = 'false';
    }

    // Set authentication mode
    if (options.authentication === 'mock' || options.authentication === 'bypass') {
      process.env.ACC_MOCK_AUTH = 'true';
    }
  }

  /**
   * Create a test-specific logger
   */
  private static createTestLogger(options: TestSDKOptions, instanceId: string): Logger | undefined {
    if (!options.enableLogging) {
      return undefined;
    }

    return new Logger(`test-sdk-${instanceId}`, {
      essentialMode: options.logLevel !== 'debug',
      enableFileLogging: false // Don't create log files for tests
    });
  }

  /**
   * Configure mock layer for SDK
   */
  private static configureMockLayer(sdk: TestSDKClaudeExecutor, options: TestSDKOptions): MockSDKLayer {
    const mockLayer = new MockSDKLayer({
      responses: options.mockResponses || new Map(),
      latency: 10, // Fast responses for tests
      failureRate: 0, // No random failures by default
      sessionState: 'authenticated'
    });

    // Attach mock layer to SDK
    sdk.setMockLayer(mockLayer);

    return mockLayer;
  }

  /**
   * Initialize handle tracking for an instance
   */
  private static initializeHandleTracking(
    options: TestSDKOptions, 
    logger: Logger | undefined, 
    instanceId: string
  ): ProcessHandleTracker {
    // Use global tracker or create instance-specific tracker
    const effectiveLogger = logger || new Logger(`handle-tracker-${instanceId}`, { 
      essentialMode: true, 
      enableFileLogging: false 
    });

    const tracker = ProcessHandleTracker.getInstance(effectiveLogger, {
      enableAutomaticRegistration: true,
      trackPromises: true,
      trackStreams: true,
      trackChildProcesses: true,
      maxHandleAge: 60000, // 1 minute for tests
      enableLeakDetection: true,
      handleLimit: 500, // Lower limit for tests
      ...options.handleTrackingOptions
    });

    // Start tracking for this test instance
    tracker.startTracking();

    // Register a custom cleanup handle for this test instance
    tracker.registerHandle('custom', {
      instanceId,
      cleanup: async () => {
        effectiveLogger?.debug(`Cleaning up test instance ${instanceId}`);
      }
    }, `test-instance-${instanceId}`, { testInstance: true });

    effectiveLogger?.debug('Handle tracking initialized for test instance', { instanceId });
    return tracker;
  }

  /**
   * Generate unique instance ID
   */
  private static generateInstanceId(): string {
    this.instanceCounter++;
    const timestamp = Date.now();
    const counter = this.instanceCounter.toString().padStart(3, '0');
    return `test-sdk-${timestamp}-${counter}`;
  }

  /**
   * Cleanup a specific instance
   */
  private static async cleanupInstance(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return;
    }

    try {
      // Cleanup handle tracker first (most critical for preventing hangs)
      if (instance.handleTracker) {
        try {
          const cleanupResult = await instance.handleTracker.forceCleanupAll({
            maxWaitTime: 3000,
            forceKillAfter: 2000,
            enableSigkillFallback: false, // Don't kill process during test cleanup
            logCleanupProgress: false
          });

          if (cleanupResult.failedHandles > 0) {
            console.warn(`Handle cleanup for instance ${instanceId} had ${cleanupResult.failedHandles} failures`);
          }

          // Stop tracking
          instance.handleTracker.stopTracking();
        } catch (error: any) {
          console.warn(`Handle tracker cleanup failed for instance ${instanceId}:`, error.message);
        }
      }

      // Cleanup SDK resources
      if (instance.sdk.cleanup) {
        await instance.sdk.cleanup();
      }

      // Cleanup mock layer
      if (instance.getMockLayer) {
        const mockLayer = instance.getMockLayer();
        if (mockLayer && mockLayer.clearHistory) {
          mockLayer.clearHistory();
        }
      }

      // Clear test environment variables for this instance
      if (process.env.ACC_TEST_INSTANCE_ID === instanceId) {
        delete process.env.ACC_TEST_INSTANCE_ID;
        delete process.env.ACC_TEST_SESSION_ID;
      }

      // Remove from tracking
      this.instances.delete(instanceId);

    } catch (error: any) {
      console.warn(`Failed to cleanup test SDK instance ${instanceId}:`, error.message);
    }
  }

  /**
   * Cleanup all test instances (useful for test teardown)
   */
  static async cleanupAll(): Promise<void> {
    const cleanupPromises = Array.from(this.instances.keys()).map(id => 
      this.cleanupInstance(id)
    );

    await Promise.all(cleanupPromises);
    this.instances.clear();

    // Cleanup global handle tracker
    if (this.globalHandleTracker) {
      try {
        await this.globalHandleTracker.forceCleanupAll({
          maxWaitTime: 5000,
          forceKillAfter: 3000,
          enableSigkillFallback: false, // Don't kill during test cleanup
          logCleanupProgress: true
        });
        this.globalHandleTracker.stopTracking();
        ProcessHandleTracker.destroy();
        this.globalHandleTracker = undefined;
      } catch (error: any) {
        console.warn('Global handle tracker cleanup failed:', error.message);
      }
    }

    // Clear global test environment
    delete process.env.ACC_TEST_MODE;
    delete process.env.ACC_PROCESS_ISOLATION;
    delete process.env.ACC_SESSION_BEHAVIOR;
    delete process.env.ACC_MOCK_AUTH;
  }

  /**
   * Get all active instances (useful for debugging)
   */
  static getActiveInstances(): string[] {
    return Array.from(this.instances.keys());
  }

  /**
   * Clear specific instance without cleanup (emergency)
   */
  static forceRemoveInstance(instanceId: string): void {
    this.instances.delete(instanceId);
  }

  /**
   * Force terminate all processes and cleanup handles (emergency use)
   */
  static async emergencyShutdown(): Promise<void> {
    console.warn('Emergency shutdown initiated - forcing cleanup of all instances');
    
    // Force cleanup all instances without waiting
    for (const [instanceId, instance] of this.instances) {
      try {
        if (instance.handleTracker) {
          await instance.handleTracker.enforceProcessTermination({
            maxWaitTime: 2000,
            forceKillAfter: 1000,
            enableSigkillFallback: true,
            logCleanupProgress: false
          });
        }
      } catch (error: any) {
        console.error(`Emergency cleanup failed for instance ${instanceId}:`, error.message);
      }
    }

    this.instances.clear();
    
    // Destroy global tracker
    if (this.globalHandleTracker) {
      ProcessHandleTracker.destroy();
      this.globalHandleTracker = undefined;
    }
  }

  /**
   * Get comprehensive handle statistics across all instances
   */
  static getGlobalHandleStatistics(): any {
    const stats = {
      totalInstances: this.instances.size,
      instanceStats: new Map(),
      globalTrackerStats: null as any
    };

    // Collect stats from each instance
    for (const [instanceId, instance] of this.instances) {
      if (instance.getHandleStatistics) {
        stats.instanceStats.set(instanceId, instance.getHandleStatistics());
      }
    }

    // Global tracker stats
    if (this.globalHandleTracker) {
      stats.globalTrackerStats = this.globalHandleTracker.getStatistics();
    }

    return stats;
  }

  /**
   * Check for leaked handles across all instances
   */
  static getLeakedHandles(): any[] {
    const leakedHandles: any[] = [];

    for (const [instanceId, instance] of this.instances) {
      if (instance.handleTracker) {
        const leaked = instance.handleTracker.getLeakedHandles();
        leakedHandles.push(...leaked.map(handle => ({ 
          ...handle, 
          instanceId 
        })));
      }
    }

    return leakedHandles;
  }

  /**
   * Enable process termination timeout for tests (safety net)
   */
  static enableTestTerminationTimeout(timeoutMs: number = 30000): void {
    setTimeout(() => {
      console.error('Test termination timeout reached - forcing emergency shutdown');
      this.emergencyShutdown().then(() => {
        process.exit(1);
      }).catch(() => {
        process.exit(1);
      });
    }, timeoutMs);
  }
}

/**
 * Test-specific SDK executor with enhanced session detection and mock support
 */
export class TestSDKClaudeExecutor extends SDKClaudeExecutor {
  private testOptions: TestSDKOptions;
  private executionContext: ExecutionContext;
  private sessionDetector: EnhancedSessionDetector;
  private mockLayer?: MockSDKLayer;
  protected testLogger?: Logger; // Our own reference to the logger

  constructor(testOptions: TestSDKOptions, context: ExecutionContext, logger?: Logger) {
    const effectiveLogger = logger || new Logger('test-sdk', { essentialMode: true, enableFileLogging: false });
    super(effectiveLogger);
    this.testOptions = testOptions;
    this.executionContext = context;
    this.testLogger = effectiveLogger; // Store our own reference
    this.sessionDetector = new EnhancedSessionDetector(
      context,
      effectiveLogger,
      testOptions.sessionDetectionOptions
    );
  }

  /**
   * Override session detection for tests
   */
  private detectNestedSessionOverride(): boolean {
    const result = this.sessionDetector.detectNestedSession();
    
    if (this.testLogger && this.testOptions.enableLogging) {
      this.testLogger.debug('Test SDK session detection', {
        isNested: result.isNested,
        reason: result.reason,
        confidence: result.confidence,
        sessionBehavior: this.testOptions.sessionBehavior
      });
    }

    // Override based on test configuration
    if (this.testOptions.sessionBehavior === 'bypass') {
      return false; // Never consider nested in bypass mode
    }

    if (this.testOptions.sessionBehavior === 'isolated') {
      return false; // Isolated tests are never nested
    }

    // 'shared' mode respects the actual detection result
    return result.isNested;
  }

  /**
   * Override authentication for tests
   */
  async checkBrowserAuthentication(): Promise<boolean> {
    if (this.testOptions.authentication === 'mock') {
      if (this.testLogger && this.testOptions.enableLogging) {
        this.testLogger.debug('Mock authentication enabled - returning true');
      }
      return true; // Mock successful authentication
    }

    if (this.testOptions.authentication === 'bypass') {
      if (this.testLogger && this.testOptions.enableLogging) {
        this.testLogger.debug('Authentication bypass enabled - returning true');
      }
      return true; // Bypass authentication checks
    }

    // Real authentication
    return super.checkBrowserAuthentication();
  }

  /**
   * Override SDK execution for mocking
   */
  async executeWithSDK(prompt: string, options: any = {}): Promise<any> {
    // Use mock layer if available
    if (this.mockLayer && this.testOptions.mockLevel !== 'none') {
      return this.mockLayer.execute(prompt, options);
    }

    // Use real SDK execution
    return super.executeWithSDK(prompt, options);
  }

  /**
   * Set mock layer for this instance
   */
  setMockLayer(mockLayer: MockSDKLayer): void {
    this.mockLayer = mockLayer;
  }

  /**
   * Get the session detector (useful for testing)
   */
  getSessionDetector(): EnhancedSessionDetector {
    return this.sessionDetector;
  }

  /**
   * Cleanup test-specific resources
   */
  async cleanup(): Promise<void> {
    try {
      // Clear any test-specific state
      if (this.mockLayer) {
        this.mockLayer.clearHistory();
      }

      // Close logger if it exists
      if (this.testLogger && typeof this.testLogger.close === 'function') {
        this.testLogger.close();
      }

    } catch (error: any) {
      if (this.testLogger) {
        this.testLogger.error('Failed to cleanup test SDK executor', { error: error.message });
      }
    }
  }
}

export default TestSDKFactory;