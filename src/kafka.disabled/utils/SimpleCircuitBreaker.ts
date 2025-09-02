export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
  onStateChange?: (state: string) => void;
  onFailure?: (error: Error) => void;
  onSuccess?: () => void;
}

export class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failures = 0;
  private nextAttempt?: Date;

  constructor(private options: CircuitBreakerOptions) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN' && (!this.nextAttempt || Date.now() < this.nextAttempt.getTime())) {
      throw new Error('Circuit breaker is OPEN');
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
    this.failures = 0;
    if (this.state !== 'CLOSED') {
      this.state = 'CLOSED';
      this.options.onStateChange?.('CLOSED');
    }
  }

  private onFailure(error: Error): void {
    this.failures++;
    if (this.failures >= this.options.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = new Date(Date.now() + this.options.resetTimeout);
      this.options.onStateChange?.('OPEN');
    }
    this.options.onFailure?.(error);
  }

  getState(): string {
    return this.state;
  }
}

export default CircuitBreaker;