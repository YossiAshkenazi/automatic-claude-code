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
}

export interface TestSDKInstance {
  sdk: TestSDKClaudeExecutor;
  sessionId: string;
  cleanup: () => Promise<void>;
  getMockLayer?: () => MockSDKLayer;
}

/**
 * Factory for creating test-specific SDK instances
 */
export class TestSDKFactory {
  private static instances: Map<string, TestSDKInstance> = new Map();
  private static instanceCounter = 0;

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
    
    // Create SDK with test configuration
    const sdk = new TestSDKClaudeExecutor(options, context, logger);
    
    // Configure mock layer if needed
    let mockLayer: MockSDKLayer | undefined;
    if (options.mockLevel !== 'none') {
      mockLayer = this.configureMockLayer(sdk, options);
    }

    // Create cleanup function
    const cleanup = async () => {
      await this.cleanupInstance(instanceId);
    };

    const instance: TestSDKInstance = {
      sdk,
      sessionId: instanceId,
      cleanup,
      getMockLayer: mockLayer ? () => mockLayer! : undefined
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
      // Cleanup SDK resources
      if (instance.sdk.cleanup) {
        await instance.sdk.cleanup();
      }

      // Clear test environment variables for this instance
      if (process.env.ACC_TEST_INSTANCE_ID === instanceId) {
        delete process.env.ACC_TEST_INSTANCE_ID;
        delete process.env.ACC_TEST_SESSION_ID;
      }

      // Remove from tracking
      this.instances.delete(instanceId);

    } catch (error) {
      console.warn(`Failed to cleanup test SDK instance ${instanceId}:`, error);
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
}

/**
 * Test-specific SDK executor with enhanced session detection and mock support
 */
export class TestSDKClaudeExecutor extends SDKClaudeExecutor {
  private testOptions: TestSDKOptions;
  private executionContext: ExecutionContext;
  private sessionDetector: EnhancedSessionDetector;
  private mockLayer?: MockSDKLayer;

  constructor(testOptions: TestSDKOptions, context: ExecutionContext, logger?: Logger) {
    super(logger || new Logger('test-sdk', { essentialMode: true, enableFileLogging: false }));
    this.testOptions = testOptions;
    this.executionContext = context;
    this.sessionDetector = new EnhancedSessionDetector(
      context,
      logger,
      testOptions.sessionDetectionOptions
    );
  }

  /**
   * Override session detection for tests
   */
  protected detectNestedSession(): boolean {
    const result = this.sessionDetector.detectNestedSession();
    
    if (this.logger && this.testOptions.enableLogging) {
      this.logger.debug('Test SDK session detection', {
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
      if (this.logger && this.testOptions.enableLogging) {
        this.logger.debug('Mock authentication enabled - returning true');
      }
      return true; // Mock successful authentication
    }

    if (this.testOptions.authentication === 'bypass') {
      if (this.logger && this.testOptions.enableLogging) {
        this.logger.debug('Authentication bypass enabled - returning true');
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
      if (this.logger && typeof this.logger.close === 'function') {
        this.logger.close();
      }

    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to cleanup test SDK executor', { error: error.message });
      }
    }
  }
}

export default TestSDKFactory;