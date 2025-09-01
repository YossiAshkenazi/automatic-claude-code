// Enhanced error types for robust error handling

export type ErrorLevel = 'info' | 'warning' | 'error' | 'critical';
export type ErrorCategory = 'network' | 'rendering' | 'api' | 'websocket' | 'data' | 'auth' | 'validation' | 'performance' | 'unknown';
export type ErrorRecoveryAction = 'retry' | 'reload' | 'navigate' | 'login' | 'clear_cache' | 'contact_support';

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  sessionId?: string;
  timestamp: Date;
  userAgent?: string;
  url?: string;
  additionalData?: Record<string, any>;
}

export interface RecoveryAction {
  type: ErrorRecoveryAction;
  label: string;
  description?: string;
  handler: () => void | Promise<void>;
  primary?: boolean;
}

export interface ErrorDetails {
  id: string;
  level: ErrorLevel;
  category: ErrorCategory;
  message: string;
  technicalMessage?: string;
  userMessage?: string;
  context: ErrorContext;
  recoveryActions: RecoveryAction[];
  retryable: boolean;
  autoRecoverable: boolean;
  maxRetries?: number;
  retryDelay?: number;
  metadata?: Record<string, any>;
}

export interface ErrorState {
  hasError: boolean;
  error: ErrorDetails | null;
  retryCount: number;
  isRetrying: boolean;
  lastErrorTime?: Date;
}

// Enhanced API Error with more context
export interface ApiErrorResponse {
  message: string;
  status: number;
  code?: string;
  details?: Record<string, any>;
  timestamp?: string;
  requestId?: string;
}

export class EnhancedError extends Error {
  public readonly id: string;
  public readonly level: ErrorLevel;
  public readonly category: ErrorCategory;
  public readonly context: ErrorContext;
  public readonly retryable: boolean;
  public readonly userMessage?: string;
  public readonly recoveryActions: RecoveryAction[];

  constructor(
    message: string,
    options: {
      level?: ErrorLevel;
      category?: ErrorCategory;
      context?: Partial<ErrorContext>;
      retryable?: boolean;
      userMessage?: string;
      recoveryActions?: RecoveryAction[];
      cause?: Error;
    } = {}
  ) {
    super(message, { cause: options.cause });
    
    this.id = this.generateErrorId();
    this.level = options.level || 'error';
    this.category = options.category || 'unknown';
    this.context = {
      timestamp: new Date(),
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      ...options.context
    };
    this.retryable = options.retryable ?? false;
    this.userMessage = options.userMessage;
    this.recoveryActions = options.recoveryActions || [];
    
    // Set the error name for better stack traces
    this.name = `${this.category}Error`;
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      message: this.message,
      level: this.level,
      category: this.category,
      context: this.context,
      retryable: this.retryable,
      userMessage: this.userMessage,
      stack: this.stack,
      cause: this.cause instanceof Error ? {
        name: this.cause.name,
        message: this.cause.message,
        stack: this.cause.stack
      } : this.cause
    };
  }
}

// Specific error types for different scenarios
export class NetworkError extends EnhancedError {
  constructor(message: string, options: Partial<ConstructorParameters<typeof EnhancedError>[1]> = {}) {
    super(message, {
      ...options,
      level: 'warning',
      category: 'network',
      retryable: true,
      userMessage: options.userMessage || 'Network connection issue. Please check your internet connection.',
      recoveryActions: options.recoveryActions || [
        {
          type: 'retry',
          label: 'Try Again',
          description: 'Retry the network request',
          handler: () => window.location.reload(),
          primary: true
        },
        {
          type: 'clear_cache',
          label: 'Clear Cache',
          description: 'Clear browser cache and try again',
          handler: () => {
            if ('caches' in window) {
              caches.keys().then(names => {
                names.forEach(name => caches.delete(name));
              }).then(() => window.location.reload());
            } else {
              window.location.reload();
            }
          }
        }
      ]
    });
  }
}

export class WebSocketError extends EnhancedError {
  constructor(message: string, options: Partial<ConstructorParameters<typeof EnhancedError>[1]> = {}) {
    super(message, {
      ...options,
      level: 'warning',
      category: 'websocket',
      retryable: true,
      userMessage: options.userMessage || 'Real-time connection lost. The system will attempt to reconnect automatically.',
      recoveryActions: options.recoveryActions || [
        {
          type: 'retry',
          label: 'Reconnect',
          description: 'Attempt to reconnect to real-time server',
          handler: () => window.location.reload(),
          primary: true
        }
      ]
    });
  }
}

export class ApiError extends EnhancedError {
  public readonly status?: number;
  public readonly requestId?: string;

  constructor(
    message: string, 
    status?: number, 
    options: Partial<ConstructorParameters<typeof EnhancedError>[1]> & { requestId?: string } = {}
  ) {
    super(message, {
      ...options,
      level: status && status >= 500 ? 'error' : 'warning',
      category: 'api',
      retryable: !status || status >= 500 || status === 429,
      userMessage: options.userMessage || ApiError.getDefaultUserMessage(status),
      recoveryActions: options.recoveryActions || ApiError.getDefaultRecoveryActions(status)
    });

    this.status = status;
    this.requestId = options.requestId;
  }

  private static getDefaultUserMessage(status?: number): string {
    if (!status) return 'Server communication failed. Please try again.';
    
    switch (Math.floor(status / 100)) {
      case 4:
        if (status === 401) return 'Please log in again to continue.';
        if (status === 403) return 'You do not have permission to perform this action.';
        if (status === 404) return 'The requested resource was not found.';
        if (status === 429) return 'Too many requests. Please wait a moment and try again.';
        return 'Invalid request. Please check your input and try again.';
      case 5:
        return 'Server error occurred. Please try again in a few moments.';
      default:
        return 'Server communication failed. Please try again.';
    }
  }

  private static getDefaultRecoveryActions(status?: number): RecoveryAction[] {
    const actions: RecoveryAction[] = [
      {
        type: 'retry',
        label: 'Try Again',
        description: 'Retry the request',
        handler: () => window.location.reload(),
        primary: true
      }
    ];

    if (status === 401) {
      actions.unshift({
        type: 'login',
        label: 'Log In',
        description: 'Log in again to continue',
        handler: () => {
          // Navigate to login or clear auth state
          localStorage.removeItem('authToken');
          window.location.href = '/login';
        },
        primary: true
      });
    }

    if (status && status >= 500) {
      actions.push({
        type: 'contact_support',
        label: 'Contact Support',
        description: 'Report this issue to support',
        handler: () => {
          window.open('mailto:support@example.com?subject=Server Error&body=Error: ' + status, '_blank');
        }
      });
    }

    return actions;
  }
}

export class AuthenticationError extends EnhancedError {
  constructor(message: string, options: Partial<ConstructorParameters<typeof EnhancedError>[1]> = {}) {
    super(message, {
      ...options,
      level: 'error',
      category: 'auth',
      retryable: false,
      userMessage: options.userMessage || 'Authentication required. Please log in again.',
      recoveryActions: options.recoveryActions || [
        {
          type: 'login',
          label: 'Log In',
          description: 'Log in to continue',
          handler: () => {
            localStorage.removeItem('authToken');
            window.location.href = '/login';
          },
          primary: true
        },
        {
          type: 'clear_cache',
          label: 'Clear Data',
          description: 'Clear stored authentication data',
          handler: () => {
            localStorage.clear();
            sessionStorage.clear();
            window.location.reload();
          }
        }
      ]
    });
  }
}

export class DataError extends EnhancedError {
  constructor(message: string, options: Partial<ConstructorParameters<typeof EnhancedError>[1]> = {}) {
    super(message, {
      ...options,
      level: 'error',
      category: 'data',
      retryable: true,
      userMessage: options.userMessage || 'Data access error. The information might be temporarily unavailable.',
      recoveryActions: options.recoveryActions || [
        {
          type: 'retry',
          label: 'Refresh Data',
          description: 'Reload the data from server',
          handler: () => window.location.reload(),
          primary: true
        }
      ]
    });
  }
}

export class ValidationError extends EnhancedError {
  public readonly field?: string;
  public readonly validationRules?: string[];

  constructor(
    message: string, 
    field?: string, 
    options: Partial<ConstructorParameters<typeof EnhancedError>[1]> & { validationRules?: string[] } = {}
  ) {
    super(message, {
      ...options,
      level: 'warning',
      category: 'validation',
      retryable: false,
      userMessage: options.userMessage || `Invalid ${field || 'input'}: ${message}`,
      recoveryActions: options.recoveryActions || []
    });

    this.field = field;
    this.validationRules = options.validationRules;
  }
}

// Error factory for creating appropriate error instances
export class ErrorFactory {
  static createFromHttpResponse(response: Response, body?: any): ApiError {
    const message = body?.message || `HTTP ${response.status}: ${response.statusText}`;
    return new ApiError(message, response.status, {
      requestId: response.headers.get('X-Request-ID') || undefined,
      context: {
        url: response.url,
        additionalData: body
      }
    });
  }

  static createFromWebSocketError(event: Event): WebSocketError {
    return new WebSocketError('WebSocket connection failed', {
      context: {
        additionalData: { event: event.type }
      }
    });
  }

  static createFromNetworkError(error: Error): NetworkError {
    return new NetworkError(error.message, {
      cause: error,
      context: {
        additionalData: { originalError: error.name }
      }
    });
  }

  static createFromUnknownError(error: unknown, context?: Partial<ErrorContext>): EnhancedError {
    if (error instanceof EnhancedError) {
      return error;
    }

    if (error instanceof Error) {
      return new EnhancedError(error.message, {
        cause: error,
        category: 'unknown',
        level: 'error',
        retryable: true,
        context
      });
    }

    const message = typeof error === 'string' ? error : 'An unknown error occurred';
    return new EnhancedError(message, {
      category: 'unknown',
      level: 'error',
      retryable: true,
      context: {
        ...context,
        additionalData: { originalError: error }
      }
    });
  }
}