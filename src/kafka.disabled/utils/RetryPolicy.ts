export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter?: boolean;
  retryCondition?: (error: Error) => boolean;
  onRetry?: (error: Error, attempt: number) => void;
  retryableErrors?: Array<new (...args: any[]) => Error>;
  nonRetryableErrors?: Array<new (...args: any[]) => Error>;
}

export interface RetryStats {
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  totalRetries: number;
  averageAttempts: number;
  lastAttemptTime?: Date;
}

export class RetryPolicy {
  private stats: RetryStats = {
    totalAttempts: 0,
    successfulAttempts: 0,
    failedAttempts: 0,
    totalRetries: 0,
    averageAttempts: 0,
  };

  constructor(private options: RetryOptions) {
    if (options.maxRetries < 0) {
      throw new Error('Max retries must be non-negative');
    }
    if (options.baseDelay <= 0) {
      throw new Error('Base delay must be positive');
    }
    if (options.maxDelay <= 0) {
      throw new Error('Max delay must be positive');
    }
    if (options.backoffMultiplier <= 0) {
      throw new Error('Backoff multiplier must be positive');
    }
  }

  async execute<T>(
    operation: () => Promise<T>,
    onRetry?: (attempt: number) => void
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      this.stats.totalAttempts++;
      this.stats.lastAttemptTime = new Date();

      try {
        const result = await operation();
        this.stats.successfulAttempts++;
        this.updateAverageAttempts();
        return result;
      } catch (error) {
        lastError = error as Error;

        // Check if this error should be retried
        if (!this.shouldRetry(error as Error, attempt)) {
          this.stats.failedAttempts++;
          this.updateAverageAttempts();
          throw error;
        }

        // Don't delay on the last attempt
        if (attempt < this.options.maxRetries) {
          this.stats.totalRetries++;
          this.options.onRetry?.(error as Error, attempt + 1);
          onRetry?.(attempt + 1);
          
          const delay = this.calculateDelay(attempt);
          await this.sleep(delay);
        }
      }
    }

    this.stats.failedAttempts++;
    this.updateAverageAttempts();
    throw lastError!;
  }

  private shouldRetry(error: Error, attempt: number): boolean {
    // Don't retry if we've reached max attempts
    if (attempt >= this.options.maxRetries) {
      return false;
    }

    // Check non-retryable errors first (these take precedence)
    if (this.options.nonRetryableErrors) {
      const isNonRetryable = this.options.nonRetryableErrors.some(
        ErrorType => error instanceof ErrorType
      );
      if (isNonRetryable) {
        return false;
      }
    }

    // Check retryable errors
    if (this.options.retryableErrors) {
      const isRetryable = this.options.retryableErrors.some(
        ErrorType => error instanceof ErrorType
      );
      if (!isRetryable) {
        return false;
      }
    }

    // Use custom retry condition if provided
    if (this.options.retryCondition) {
      return this.options.retryCondition(error);
    }

    // Default: retry all errors except if specifically configured otherwise
    return true;
  }

  private calculateDelay(attempt: number): number {
    let delay = this.options.baseDelay * Math.pow(this.options.backoffMultiplier, attempt);
    
    // Cap at max delay
    delay = Math.min(delay, this.options.maxDelay);

    // Add jitter if enabled
    if (this.options.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    return Math.floor(delay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private updateAverageAttempts(): void {
    if (this.stats.totalAttempts > 0) {
      this.stats.averageAttempts = 
        (this.stats.successfulAttempts + this.stats.failedAttempts) / 
        this.stats.totalAttempts;
    }
  }

  getStats(): RetryStats {
    return { ...this.stats };
  }

  getSuccessRate(): number {
    const totalCompletedOperations = this.stats.successfulAttempts + this.stats.failedAttempts;
    if (totalCompletedOperations === 0) return 0;
    return this.stats.successfulAttempts / totalCompletedOperations;
  }

  getRetryRate(): number {
    if (this.stats.totalAttempts === 0) return 0;
    return this.stats.totalRetries / this.stats.totalAttempts;
  }

  reset(): void {
    this.stats = {
      totalAttempts: 0,
      successfulAttempts: 0,
      failedAttempts: 0,
      totalRetries: 0,
      averageAttempts: 0,
    };
  }
}

// Utility functions for common retry scenarios
export class RetryPolicyBuilder {
  private options: Partial<RetryOptions> = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true,
  };

  maxRetries(retries: number): RetryPolicyBuilder {
    this.options.maxRetries = retries;
    return this;
  }

  baseDelay(delay: number): RetryPolicyBuilder {
    this.options.baseDelay = delay;
    return this;
  }

  maxDelay(delay: number): RetryPolicyBuilder {
    this.options.maxDelay = delay;
    return this;
  }

  exponentialBackoff(multiplier: number = 2): RetryPolicyBuilder {
    this.options.backoffMultiplier = multiplier;
    return this;
  }

  linearBackoff(): RetryPolicyBuilder {
    this.options.backoffMultiplier = 1;
    return this;
  }

  withJitter(enabled: boolean = true): RetryPolicyBuilder {
    this.options.jitter = enabled;
    return this;
  }

  retryOn(...errorTypes: Array<new (...args: any[]) => Error>): RetryPolicyBuilder {
    this.options.retryableErrors = errorTypes;
    return this;
  }

  dontRetryOn(...errorTypes: Array<new (...args: any[]) => Error>): RetryPolicyBuilder {
    this.options.nonRetryableErrors = errorTypes;
    return this;
  }

  retryCondition(condition: (error: Error) => boolean): RetryPolicyBuilder {
    this.options.retryCondition = condition;
    return this;
  }

  onRetry(callback: (error: Error, attempt: number) => void): RetryPolicyBuilder {
    this.options.onRetry = callback;
    return this;
  }

  build(): RetryPolicy {
    return new RetryPolicy(this.options as RetryOptions);
  }

  // Predefined policies
  static immediate(): RetryPolicy {
    return new RetryPolicyBuilder()
      .maxRetries(3)
      .baseDelay(0)
      .maxDelay(0)
      .withJitter(false)
      .build();
  }

  static fixed(delay: number = 1000): RetryPolicy {
    return new RetryPolicyBuilder()
      .maxRetries(3)
      .baseDelay(delay)
      .maxDelay(delay)
      .linearBackoff()
      .withJitter(false)
      .build();
  }

  static exponential(): RetryPolicy {
    return new RetryPolicyBuilder()
      .maxRetries(5)
      .baseDelay(1000)
      .maxDelay(30000)
      .exponentialBackoff(2)
      .withJitter(true)
      .build();
  }

  static linear(baseDelay: number = 1000): RetryPolicy {
    return new RetryPolicyBuilder()
      .maxRetries(3)
      .baseDelay(baseDelay)
      .maxDelay(baseDelay * 10)
      .linearBackoff()
      .withJitter(true)
      .build();
  }

  static noRetry(): RetryPolicy {
    return new RetryPolicyBuilder()
      .maxRetries(0)
      .build();
  }

  // Network-specific policies
  static networkFailures(): RetryPolicy {
    return new RetryPolicyBuilder()
      .maxRetries(3)
      .baseDelay(1000)
      .maxDelay(15000)
      .exponentialBackoff(2)
      .withJitter(true)
      .retryCondition((error) => {
        const message = error.message.toLowerCase();
        return message.includes('network') || 
               message.includes('timeout') || 
               message.includes('connection') ||
               message.includes('econnreset') ||
               message.includes('enotfound');
      })
      .build();
  }

  // Kafka-specific policies
  static kafkaProducer(): RetryPolicy {
    return new RetryPolicyBuilder()
      .maxRetries(3)
      .baseDelay(100)
      .maxDelay(5000)
      .exponentialBackoff(2)
      .withJitter(true)
      .retryCondition((error) => {
        const message = error.message.toLowerCase();
        return !message.includes('authentication') && 
               !message.includes('authorization') &&
               !message.includes('invalid topic');
      })
      .build();
  }

  static kafkaConsumer(): RetryPolicy {
    return new RetryPolicyBuilder()
      .maxRetries(5)
      .baseDelay(200)
      .maxDelay(10000)
      .exponentialBackoff(1.5)
      .withJitter(true)
      .retryCondition((error) => {
        const message = error.message.toLowerCase();
        return !message.includes('authentication') && 
               !message.includes('authorization') &&
               !message.includes('group authorization failed');
      })
      .build();
  }
}

export default RetryPolicy;