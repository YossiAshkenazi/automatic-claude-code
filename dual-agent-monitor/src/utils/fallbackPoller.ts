/**
 * Fallback HTTP Polling Service
 * Provides reliable data fetching when WebSocket connections are unavailable
 */

export interface FallbackPollerOptions {
  pollInterval: number;
  maxRetries: number;
  retryDelay: number;
  exponentialBackoff: boolean;
  onData: (data: any) => void;
  onError: (error: Error) => void;
  onStateChange: (state: 'polling' | 'stopped' | 'error') => void;
}

export interface PollEndpoint {
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: any;
  transform?: (data: any) => any;
}

export class FallbackPoller {
  private isPolling = false;
  private pollInterval?: NodeJS.Timeout;
  private retryAttempts = 0;
  private endpoints: Map<string, PollEndpoint> = new Map();
  private options: FallbackPollerOptions;
  private abortController?: AbortController;

  constructor(options: FallbackPollerOptions) {
    this.options = options;
  }

  /**
   * Register a polling endpoint
   */
  addEndpoint(name: string, endpoint: PollEndpoint): void {
    this.endpoints.set(name, endpoint);
  }

  /**
   * Remove a polling endpoint
   */
  removeEndpoint(name: string): void {
    this.endpoints.delete(name);
  }

  /**
   * Start polling all registered endpoints
   */
  start(): void {
    if (this.isPolling) {
      console.warn('Fallback poller is already running');
      return;
    }

    console.log('Starting fallback HTTP polling');
    this.isPolling = true;
    this.retryAttempts = 0;
    this.options.onStateChange('polling');
    this.scheduleNextPoll();
  }

  /**
   * Stop polling
   */
  stop(): void {
    if (!this.isPolling) return;

    console.log('Stopping fallback HTTP polling');
    this.isPolling = false;
    
    if (this.pollInterval) {
      clearTimeout(this.pollInterval);
      this.pollInterval = undefined;
    }

    if (this.abortController) {
      this.abortController.abort();
    }

    this.options.onStateChange('stopped');
  }

  /**
   * Check if poller is active
   */
  isActive(): boolean {
    return this.isPolling;
  }

  /**
   * Get current retry attempt count
   */
  getRetryCount(): number {
    return this.retryAttempts;
  }

  /**
   * Schedule the next polling cycle
   */
  private scheduleNextPoll(): void {
    if (!this.isPolling) return;

    const delay = this.calculateDelay();
    this.pollInterval = setTimeout(() => {
      this.pollAllEndpoints();
    }, delay);
  }

  /**
   * Calculate delay for next poll (with exponential backoff if enabled)
   */
  private calculateDelay(): number {
    const { pollInterval, exponentialBackoff, retryDelay } = this.options;

    if (!exponentialBackoff || this.retryAttempts === 0) {
      return pollInterval;
    }

    // Exponential backoff for retries
    const backoffDelay = Math.min(
      retryDelay * Math.pow(2, this.retryAttempts - 1),
      30000 // Max 30 seconds
    );

    return Math.max(pollInterval, backoffDelay);
  }

  /**
   * Poll all registered endpoints
   */
  private async pollAllEndpoints(): Promise<void> {
    if (!this.isPolling) return;

    this.abortController = new AbortController();
    const results: Record<string, any> = {};
    let hasErrors = false;

    try {
      // Poll all endpoints in parallel
      const promises = Array.from(this.endpoints.entries()).map(async ([name, endpoint]) => {
        try {
          const data = await this.pollEndpoint(endpoint);
          results[name] = data;
        } catch (error) {
          console.error(`Failed to poll endpoint ${name}:`, error);
          hasErrors = true;
          results[name] = { error: error.message };
        }
      });

      await Promise.allSettled(promises);

      // Send aggregated results
      if (Object.keys(results).length > 0) {
        this.options.onData({
          type: 'fallback_poll',
          timestamp: new Date().toISOString(),
          endpoints: results,
          source: 'http_polling'
        });
      }

      // Reset retry attempts on success
      if (!hasErrors) {
        this.retryAttempts = 0;
      } else {
        this.retryAttempts++;
        
        if (this.retryAttempts >= this.options.maxRetries) {
          console.error('Max polling retries exceeded');
          this.options.onStateChange('error');
          this.options.onError(new Error('Maximum polling retries exceeded'));
          this.stop();
          return;
        }
      }

      // Schedule next poll
      this.scheduleNextPoll();

    } catch (error) {
      console.error('Critical polling error:', error);
      this.retryAttempts++;
      
      if (this.retryAttempts >= this.options.maxRetries) {
        this.options.onStateChange('error');
        this.options.onError(error as Error);
        this.stop();
      } else {
        this.scheduleNextPoll();
      }
    }
  }

  /**
   * Poll a single endpoint
   */
  private async pollEndpoint(endpoint: PollEndpoint): Promise<any> {
    const { url, method, headers, body, transform } = endpoint;

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      signal: this.abortController?.signal
    };

    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return transform ? transform(data) : data;
  }
}

/**
 * Factory function to create a pre-configured poller for dual-agent monitoring
 */
export const createDualAgentFallbackPoller = (
  baseUrl: string,
  onData: (data: any) => void,
  onError: (error: Error) => void,
  onStateChange: (state: 'polling' | 'stopped' | 'error') => void
): FallbackPoller => {
  const poller = new FallbackPoller({
    pollInterval: 5000, // 5 seconds
    maxRetries: 3,
    retryDelay: 2000,
    exponentialBackoff: true,
    onData,
    onError,
    onStateChange
  });

  // Add common endpoints
  poller.addEndpoint('health', {
    url: `${baseUrl}/api/health`,
    method: 'GET',
    transform: (data) => ({
      type: 'health_check',
      data
    })
  });

  poller.addEndpoint('sessions', {
    url: `${baseUrl}/api/sessions`,
    method: 'GET',
    transform: (data) => ({
      type: 'sessions_list',
      data: data.sessions || data
    })
  });

  poller.addEndpoint('metrics', {
    url: `${baseUrl}/api/websocket/metrics`,
    method: 'GET',
    transform: (data) => ({
      type: 'websocket_metrics',
      data
    })
  });

  return poller;
};

/**
 * Adaptive polling manager that adjusts polling frequency based on connection quality
 */
export class AdaptiveFallbackPoller extends FallbackPoller {
  private baseInterval: number;
  private qualityMetrics: {
    successRate: number;
    averageLatency: number;
    errorCount: number;
  } = {
    successRate: 100,
    averageLatency: 0,
    errorCount: 0
  };

  constructor(options: FallbackPollerOptions) {
    super(options);
    this.baseInterval = options.pollInterval;
  }

  /**
   * Update connection quality metrics to adjust polling frequency
   */
  updateQualityMetrics(metrics: {
    successRate?: number;
    averageLatency?: number;
    errorCount?: number;
  }): void {
    Object.assign(this.qualityMetrics, metrics);
    this.adjustPollingInterval();
  }

  /**
   * Adjust polling interval based on connection quality
   */
  private adjustPollingInterval(): void {
    const { successRate, averageLatency, errorCount } = this.qualityMetrics;
    
    let multiplier = 1;

    // Increase interval if success rate is low
    if (successRate < 80) {
      multiplier *= 2;
    } else if (successRate < 95) {
      multiplier *= 1.5;
    }

    // Increase interval if latency is high
    if (averageLatency > 1000) {
      multiplier *= 2;
    } else if (averageLatency > 500) {
      multiplier *= 1.3;
    }

    // Increase interval if there are many errors
    if (errorCount > 5) {
      multiplier *= 3;
    } else if (errorCount > 2) {
      multiplier *= 1.5;
    }

    // Apply limits
    const newInterval = Math.min(
      Math.max(this.baseInterval * multiplier, 1000), // Min 1 second
      60000 // Max 60 seconds
    );

    this.options.pollInterval = newInterval;
    
    console.log(`Adjusted polling interval to ${newInterval}ms based on quality metrics:`, this.qualityMetrics);
  }

  /**
   * Reset quality metrics
   */
  resetQualityMetrics(): void {
    this.qualityMetrics = {
      successRate: 100,
      averageLatency: 0,
      errorCount: 0
    };
    this.options.pollInterval = this.baseInterval;
  }
}