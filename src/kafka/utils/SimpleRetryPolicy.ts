export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  onRetry?: (error: Error, attempt: number) => void;
}

export class RetryPolicy {
  constructor(private options: RetryOptions) {}

  async execute<T>(operation: () => Promise<T>, onRetry?: (attempt: number) => void): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.options.maxRetries) {
          this.options.onRetry?.(error as Error, attempt + 1);
          onRetry?.(attempt + 1);
          
          const delay = Math.min(
            this.options.baseDelay * Math.pow(this.options.backoffMultiplier, attempt),
            this.options.maxDelay
          );
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }
}

export default RetryPolicy;