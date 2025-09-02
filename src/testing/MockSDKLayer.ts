/**
 * Mock SDK Layer for Comprehensive Testing
 * Epic 2, Story 2.2: Implement SDK Mock Layer for Testing
 * 
 * Provides controllable SDK mock layer that prevents actual SDK calls during testing
 * while preserving interface compatibility and enabling various test scenarios.
 */

import { SDKResponse, SDKResult } from '../types';

export interface SDKMockConfig {
  responses: Map<string, any>;
  latency: number; // Simulated response latency in milliseconds
  failureRate: number; // 0-1, probability of random failure
  sessionState: 'authenticated' | 'unauthenticated' | 'expired';
  enableCallHistory: boolean;
  maxHistorySize: number;
}

export interface SDKCall {
  prompt: string;
  options: any;
  timestamp: Date;
  mockResponse: boolean;
  responseTime: number;
  successful: boolean;
  error?: string;
  response?: any;
}

export interface MockResponse {
  output: string;
  exitCode: number;
  sessionId: string;
  messages: SDKResponse[];
  hasError: boolean;
  executionTime: number;
  tokensUsed?: number;
}

/**
 * Mock layer that intercepts SDK calls and provides configurable responses
 */
export class MockSDKLayer {
  private config: SDKMockConfig;
  private callHistory: SDKCall[] = [];
  private responseTemplates: Map<string, MockResponse>;
  private sessionId: string;

  constructor(config: Partial<SDKMockConfig> = {}) {
    this.config = {
      responses: new Map(),
      latency: 50, // 50ms default latency
      failureRate: 0,
      sessionState: 'authenticated',
      enableCallHistory: true,
      maxHistorySize: 100,
      ...config
    };

    this.responseTemplates = this.createDefaultResponses();
    this.sessionId = this.generateSessionId();

    // Add custom responses
    for (const [key, response] of this.config.responses) {
      this.responseTemplates.set(key, response);
    }
  }

  /**
   * Execute a mock SDK call
   */
  async execute(prompt: string, options: any = {}): Promise<SDKResult> {
    const startTime = Date.now();
    const call: SDKCall = {
      prompt,
      options,
      timestamp: new Date(),
      mockResponse: true,
      responseTime: 0,
      successful: false
    };

    try {
      // Simulate authentication check
      if (this.config.sessionState === 'unauthenticated') {
        throw new Error('Mock SDK: Not authenticated');
      }

      if (this.config.sessionState === 'expired') {
        throw new Error('Mock SDK: Session expired');
      }

      // Simulate latency
      if (this.config.latency > 0) {
        await this.simulateLatency(this.config.latency);
      }

      // Simulate random failures
      if (this.shouldSimulateFailure()) {
        throw new Error('Mock SDK: Simulated random failure');
      }

      // Generate response
      const response = this.generateResponse(prompt, options);
      
      // Update call record
      call.responseTime = Date.now() - startTime;
      call.successful = true;
      call.response = response;

      // Record call if enabled
      if (this.config.enableCallHistory) {
        this.recordCall(call);
      }

      return response;

    } catch (error) {
      // Update call record with error
      call.responseTime = Date.now() - startTime;
      call.successful = false;
      call.error = error instanceof Error ? error.message : String(error);

      // Record failed call if enabled
      if (this.config.enableCallHistory) {
        this.recordCall(call);
      }

      // Convert to SDK-compatible error response
      return this.createErrorResponse(error, call.responseTime);
    }
  }

  /**
   * Generate appropriate mock response based on prompt
   */
  private generateResponse(prompt: string, options: any): SDKResult {
    // Try to find specific response for this prompt
    const specificResponse = this.findSpecificResponse(prompt);
    if (specificResponse) {
      return this.createSDKResult(specificResponse);
    }

    // Generate contextual response based on prompt content
    const contextualResponse = this.generateContextualResponse(prompt);
    return this.createSDKResult(contextualResponse);
  }

  /**
   * Find specific response for prompt
   */
  private findSpecificResponse(prompt: string): MockResponse | null {
    // Check exact match first
    if (this.responseTemplates.has(prompt)) {
      return this.responseTemplates.get(prompt)!;
    }

    // Check for pattern matches
    for (const [pattern, response] of this.responseTemplates) {
      if (this.matchesPattern(prompt, pattern)) {
        return response;
      }
    }

    return null;
  }

  /**
   * Check if prompt matches a pattern
   */
  private matchesPattern(prompt: string, pattern: string): boolean {
    const lowerPrompt = prompt.toLowerCase();
    const lowerPattern = pattern.toLowerCase();

    // Simple keyword matching
    if (pattern.startsWith('*') && pattern.endsWith('*')) {
      const keyword = pattern.slice(1, -1);
      return lowerPrompt.includes(keyword);
    }

    // Starts with matching
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return lowerPrompt.startsWith(prefix);
    }

    // Ends with matching
    if (pattern.startsWith('*')) {
      const suffix = pattern.slice(1);
      return lowerPrompt.endsWith(suffix);
    }

    // Exact match
    return lowerPrompt === lowerPattern;
  }

  /**
   * Generate contextual response based on prompt analysis
   */
  private generateContextualResponse(prompt: string): MockResponse {
    const lowerPrompt = prompt.toLowerCase();
    
    // Task completion patterns
    if (lowerPrompt.includes('implement') || lowerPrompt.includes('create') || lowerPrompt.includes('add')) {
      return this.responseTemplates.get('implementation_success') || this.getDefaultSuccess();
    }

    // Error-related patterns
    if (lowerPrompt.includes('error') || lowerPrompt.includes('fix') || lowerPrompt.includes('debug')) {
      return this.responseTemplates.get('error_resolution') || this.getDefaultSuccess();
    }

    // Test-related patterns
    if (lowerPrompt.includes('test') || lowerPrompt.includes('validate') || lowerPrompt.includes('check')) {
      return this.responseTemplates.get('test_success') || this.getDefaultSuccess();
    }

    // Analysis patterns
    if (lowerPrompt.includes('analyze') || lowerPrompt.includes('review') || lowerPrompt.includes('explain')) {
      return this.responseTemplates.get('analysis_complete') || this.getDefaultSuccess();
    }

    // Default response
    return this.getDefaultSuccess();
  }

  /**
   * Create SDK-compatible result from mock response
   */
  private createSDKResult(mockResponse: MockResponse): SDKResult {
    return {
      output: mockResponse.output,
      exitCode: mockResponse.exitCode,
      sessionId: mockResponse.sessionId || this.sessionId,
      messages: mockResponse.messages,
      hasError: mockResponse.hasError,
      executionTime: mockResponse.executionTime
    };
  }

  /**
   * Create error response
   */
  private createErrorResponse(error: unknown, responseTime: number): SDKResult {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return {
      output: `Error: ${errorMessage}`,
      exitCode: 1,
      sessionId: this.sessionId,
      messages: [{
        type: 'error',
        error: errorMessage,
        timestamp: new Date()
      }],
      hasError: true,
      executionTime: responseTime
    };
  }

  /**
   * Create default response templates
   */
  private createDefaultResponses(): Map<string, MockResponse> {
    const templates = new Map<string, MockResponse>();

    templates.set('default', this.getDefaultSuccess());
    
    templates.set('implementation_success', {
      output: 'Mock: Implementation completed successfully. All requested features have been added with proper error handling and tests.',
      exitCode: 0,
      sessionId: this.sessionId,
      messages: [{
        type: 'result',
        content: 'Implementation completed',
        timestamp: new Date()
      }],
      hasError: false,
      executionTime: this.config.latency,
      tokensUsed: 150
    });

    templates.set('error_resolution', {
      output: 'Mock: Error has been identified and resolved. The issue was in the configuration and has been fixed.',
      exitCode: 0,
      sessionId: this.sessionId,
      messages: [{
        type: 'result',
        content: 'Error resolved',
        timestamp: new Date()
      }],
      hasError: false,
      executionTime: this.config.latency,
      tokensUsed: 120
    });

    templates.set('test_success', {
      output: 'Mock: All tests are passing. The implementation meets the requirements and handles edge cases properly.',
      exitCode: 0,
      sessionId: this.sessionId,
      messages: [{
        type: 'result',
        content: 'Tests completed',
        timestamp: new Date()
      }],
      hasError: false,
      executionTime: this.config.latency,
      tokensUsed: 80
    });

    templates.set('analysis_complete', {
      output: 'Mock: Analysis complete. The code structure is well-organized and follows best practices. No significant issues found.',
      exitCode: 0,
      sessionId: this.sessionId,
      messages: [{
        type: 'result',
        content: 'Analysis completed',
        timestamp: new Date()
      }],
      hasError: false,
      executionTime: this.config.latency,
      tokensUsed: 200
    });

    // Specific test responses
    templates.set('*auth*', {
      output: 'Mock: Authentication system implemented with JWT tokens, password hashing, and session management.',
      exitCode: 0,
      sessionId: this.sessionId,
      messages: [],
      hasError: false,
      executionTime: this.config.latency
    });

    return templates;
  }

  /**
   * Get default success response
   */
  private getDefaultSuccess(): MockResponse {
    return {
      output: 'Mock: Task completed successfully. All requirements have been implemented as requested.',
      exitCode: 0,
      sessionId: this.sessionId,
      messages: [{
        type: 'result',
        content: 'Mock execution successful',
        timestamp: new Date()
      }],
      hasError: false,
      executionTime: this.config.latency
    };
  }

  /**
   * Simulate network latency
   */
  private async simulateLatency(ms: number): Promise<void> {
    if (ms <= 0) return;
    
    // Add some randomness to make it more realistic
    const actualLatency = ms + (Math.random() * ms * 0.2) - (ms * 0.1);
    return new Promise(resolve => setTimeout(resolve, Math.max(0, actualLatency)));
  }

  /**
   * Check if should simulate failure based on failure rate
   */
  private shouldSimulateFailure(): boolean {
    return Math.random() < this.config.failureRate;
  }

  /**
   * Record a call in history
   */
  private recordCall(call: SDKCall): void {
    this.callHistory.push(call);

    // Trim history if it exceeds max size
    if (this.callHistory.length > this.config.maxHistorySize) {
      this.callHistory = this.callHistory.slice(-this.config.maxHistorySize);
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `mock-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API methods

  /**
   * Get call history
   */
  getCallHistory(): SDKCall[] {
    return [...this.callHistory];
  }

  /**
   * Get successful calls only
   */
  getSuccessfulCalls(): SDKCall[] {
    return this.callHistory.filter(call => call.successful);
  }

  /**
   * Get failed calls only
   */
  getFailedCalls(): SDKCall[] {
    return this.callHistory.filter(call => !call.successful);
  }

  /**
   * Clear call history
   */
  clearHistory(): void {
    this.callHistory = [];
  }

  /**
   * Add custom response template
   */
  addResponse(pattern: string, response: Partial<MockResponse>): void {
    const fullResponse: MockResponse = {
      output: 'Mock response',
      exitCode: 0,
      sessionId: this.sessionId,
      messages: [],
      hasError: false,
      executionTime: this.config.latency,
      ...response
    };

    this.responseTemplates.set(pattern, fullResponse);
  }

  /**
   * Remove response template
   */
  removeResponse(pattern: string): boolean {
    return this.responseTemplates.delete(pattern);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<SDKMockConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): SDKMockConfig {
    return { ...this.config };
  }

  /**
   * Get statistics about mock usage
   */
  getStatistics(): {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    averageResponseTime: number;
    successRate: number;
  } {
    const totalCalls = this.callHistory.length;
    const successfulCalls = this.getSuccessfulCalls().length;
    const failedCalls = this.getFailedCalls().length;
    const avgResponseTime = totalCalls > 0 
      ? this.callHistory.reduce((sum, call) => sum + call.responseTime, 0) / totalCalls 
      : 0;
    const successRate = totalCalls > 0 ? successfulCalls / totalCalls : 0;

    return {
      totalCalls,
      successfulCalls,
      failedCalls,
      averageResponseTime: Math.round(avgResponseTime * 100) / 100,
      successRate: Math.round(successRate * 1000) / 10 // Percentage with 1 decimal
    };
  }

  /**
   * Reset mock to initial state
   */
  reset(): void {
    this.clearHistory();
    this.sessionId = this.generateSessionId();
    this.responseTemplates = this.createDefaultResponses();
    
    // Re-add custom responses
    for (const [key, response] of this.config.responses) {
      this.responseTemplates.set(key, response);
    }
  }
}

export default MockSDKLayer;