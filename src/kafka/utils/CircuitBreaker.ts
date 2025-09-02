export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
  failureTypes?: Array<new (...args: any[]) => Error>;
  onStateChange?: (state: CircuitBreakerState) => void;
  onFailure?: (error: Error) => void;
  onSuccess?: () => void;
}

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerStats {
  state: CircuitBreakerState;
  failures: number;
  successes: number;
  totalRequests: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  nextAttempt?: Date;
}

export class CircuitBreakerError extends Error {
  constructor(message: string = 'Circuit breaker is OPEN') {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

export class CircuitBreaker {
  private state: CircuitBreakerState = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private totalRequests = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private nextAttempt?: Date;
  private resetTimer?: NodeJS.Timeout;

  constructor(private options: CircuitBreakerOptions) {
    if (options.failureThreshold <= 0) {
      throw new Error('Failure threshold must be greater than 0');
    }
    if (options.resetTimeout <= 0) {
      throw new Error('Reset timeout must be greater than 0');
    }
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    if (this.state === 'OPEN') {
      if (this.canAttemptReset()) {
        this.state = 'HALF_OPEN';
        this.options.onStateChange?.('HALF_OPEN');
      } else {
        throw new CircuitBreakerError();
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  private onSuccess(): void {
    this.successes++;
    this.lastSuccessTime = new Date();
    
    if (this.state === 'HALF_OPEN') {
      this.reset();
    }

    this.options.onSuccess?.();
  }

  private onFailure(error: Error): void {
    // Check if this error type should trigger circuit breaker
    if (this.options.failureTypes && this.options.failureTypes.length > 0) {
      const shouldTrigger = this.options.failureTypes.some(
        ErrorType => error instanceof ErrorType
      );
      if (!shouldTrigger) {
        return;
      }
    }

    this.failures++;
    this.lastFailureTime = new Date();

    if (this.state === 'HALF_OPEN') {
      this.trip();
    } else if (this.failures >= this.options.failureThreshold) {
      this.trip();
    }

    this.options.onFailure?.(error);
  }

  private canAttemptReset(): boolean {
    return (
      this.nextAttempt !== undefined &&
      Date.now() >= this.nextAttempt.getTime()
    );
  }

  private trip(): void {
    this.state = 'OPEN';
    this.nextAttempt = new Date(Date.now() + this.options.resetTimeout);
    
    // Clear any existing timer
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }

    // Set timer to transition to HALF_OPEN
    this.resetTimer = setTimeout(() => {
      if (this.state === 'OPEN') {
        this.state = 'HALF_OPEN';
        this.options.onStateChange?.('HALF_OPEN');
      }
    }, this.options.resetTimeout);

    this.options.onStateChange?.('OPEN');
  }

  private reset(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.nextAttempt = undefined;
    
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = undefined;
    }

    this.options.onStateChange?.('CLOSED');
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      totalRequests: this.totalRequests,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextAttempt: this.nextAttempt,
    };
  }

  getFailureRate(): number {
    if (this.totalRequests === 0) return 0;
    return this.failures / this.totalRequests;
  }

  getSuccessRate(): number {
    if (this.totalRequests === 0) return 0;
    return this.successes / this.totalRequests;
  }

  isOpen(): boolean {
    return this.state === 'OPEN';
  }

  isClosed(): boolean {
    return this.state === 'CLOSED';
  }

  isHalfOpen(): boolean {
    return this.state === 'HALF_OPEN';
  }

  // Manual control methods
  forceOpen(): void {
    this.trip();
  }

  forceClose(): void {
    this.reset();
  }

  // Cleanup
  destroy(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = undefined;
    }
  }
}

export default CircuitBreaker;