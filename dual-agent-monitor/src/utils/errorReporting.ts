import { toast } from 'sonner';
import { EnhancedError, ErrorDetails, ErrorLevel, ErrorCategory } from '../types/errors';

interface ErrorReport {
  id: string;
  timestamp: Date;
  error: ErrorDetails;
  stackTrace?: string;
  reproductionSteps?: string[];
  userAgent: string;
  url: string;
  userId?: string;
  sessionId?: string;
  buildVersion?: string;
}

interface ErrorReportingConfig {
  enableConsoleLogging: boolean;
  enableToastNotifications: boolean;
  enableRemoteReporting: boolean;
  remoteEndpoint?: string;
  maxReportsPerSession: number;
  excludeCategories: ErrorCategory[];
  excludeLevels: ErrorLevel[];
  enableStackTrace: boolean;
  enableUserContext: boolean;
  enablePerformanceMetrics: boolean;
}

class ErrorReportingService {
  private config: ErrorReportingConfig;
  private reportCount = 0;
  private reports: ErrorReport[] = [];
  private sessionId: string;
  private performanceObserver?: PerformanceObserver;

  constructor(config: Partial<ErrorReportingConfig> = {}) {
    this.config = {
      enableConsoleLogging: true,
      enableToastNotifications: true,
      enableRemoteReporting: false,
      maxReportsPerSession: 100,
      excludeCategories: [],
      excludeLevels: ['info'],
      enableStackTrace: true,
      enableUserContext: true,
      enablePerformanceMetrics: false,
      ...config
    };

    this.sessionId = this.generateSessionId();
    this.initializePerformanceMonitoring();
    this.setupGlobalErrorHandlers();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializePerformanceMonitoring() {
    if (this.config.enablePerformanceMetrics && 'PerformanceObserver' in window) {
      try {
        this.performanceObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.entryType === 'navigation' && (entry as PerformanceNavigationTiming).loadEventEnd > 5000) {
              this.reportError(new EnhancedError('Slow page load detected', {
                category: 'performance',
                level: 'warning',
                context: {
                  additionalData: {
                    loadTime: (entry as PerformanceNavigationTiming).loadEventEnd,
                    entry: entry.toJSON()
                  }
                }
              }));
            }
          });
        });

        this.performanceObserver.observe({ entryTypes: ['navigation', 'measure'] });
      } catch (error) {
        console.warn('Performance monitoring not available:', error);
      }
    }
  }

  private setupGlobalErrorHandlers() {
    // Global error handler
    window.addEventListener('error', (event) => {
      const error = new EnhancedError(event.message, {
        category: 'unknown',
        level: 'error',
        context: {
          component: 'Global',
          additionalData: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            stack: event.error?.stack
          }
        }
      });
      this.reportError(error);
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      const error = new EnhancedError(
        event.reason instanceof Error ? event.reason.message : 'Unhandled promise rejection',
        {
          category: 'unknown',
          level: 'error',
          context: {
            component: 'Global',
            additionalData: {
              reason: event.reason,
              promise: event.promise
            }
          },
          cause: event.reason instanceof Error ? event.reason : undefined
        }
      );
      this.reportError(error);
    });

    // Network error detection
    window.addEventListener('online', () => {
      toast.success('Connection restored');
    });

    window.addEventListener('offline', () => {
      const error = new EnhancedError('Network connection lost', {
        category: 'network',
        level: 'warning',
        retryable: true,
        userMessage: 'You are currently offline. Some features may not work properly.'
      });
      this.reportError(error);
    });
  }

  public reportError(error: Error | EnhancedError, context?: Partial<ErrorDetails['context']>) {
    // Convert to EnhancedError if needed
    const enhancedError = error instanceof EnhancedError 
      ? error 
      : new EnhancedError(error.message, {
          cause: error,
          context
        });

    // Check if we should exclude this error
    if (this.shouldExcludeError(enhancedError)) {
      return;
    }

    // Check report limit
    if (this.reportCount >= this.config.maxReportsPerSession) {
      console.warn('Error reporting limit reached for this session');
      return;
    }

    const errorDetails: ErrorDetails = {
      id: enhancedError.id,
      level: enhancedError.level,
      category: enhancedError.category,
      message: error.message,
      technicalMessage: error.message,
      userMessage: enhancedError.userMessage,
      context: {
        ...enhancedError.context,
        ...context,
        sessionId: this.sessionId
      },
      recoveryActions: enhancedError.recoveryActions,
      retryable: enhancedError.retryable,
      autoRecoverable: enhancedError.retryable,
      metadata: {
        errorId: enhancedError.id,
        timestamp: enhancedError.context.timestamp,
        reportCount: this.reportCount + 1
      }
    };

    const report: ErrorReport = {
      id: enhancedError.id,
      timestamp: new Date(),
      error: errorDetails,
      stackTrace: this.config.enableStackTrace ? error.stack : undefined,
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: this.getUserId(),
      sessionId: this.sessionId,
      buildVersion: this.getBuildVersion()
    };

    this.reports.push(report);
    this.reportCount++;

    // Console logging
    if (this.config.enableConsoleLogging) {
      this.logToConsole(report);
    }

    // Toast notifications
    if (this.config.enableToastNotifications) {
      this.showToastNotification(errorDetails);
    }

    // Remote reporting
    if (this.config.enableRemoteReporting && this.config.remoteEndpoint) {
      this.sendRemoteReport(report);
    }

    // Store in local storage for debugging
    this.storeLocalReport(report);
  }

  private shouldExcludeError(error: EnhancedError): boolean {
    return this.config.excludeCategories.includes(error.category) ||
           this.config.excludeLevels.includes(error.level);
  }

  private logToConsole(report: ErrorReport) {
    const { error } = report;
    const logMethod = error.level === 'critical' ? 'error' :
                     error.level === 'error' ? 'error' :
                     error.level === 'warning' ? 'warn' : 'info';

    console.group(`🚨 ${error.category.toUpperCase()} ERROR (${error.level})`);
    console[logMethod]('Message:', error.message);
    console[logMethod]('ID:', error.id);
    console[logMethod]('Category:', error.category);
    console[logMethod]('Context:', error.context);
    
    if (report.stackTrace) {
      console[logMethod]('Stack Trace:', report.stackTrace);
    }
    
    if (error.recoveryActions.length > 0) {
      console[logMethod]('Recovery Actions:', error.recoveryActions.map(a => a.label));
    }
    
    console.groupEnd();
  }

  private showToastNotification(error: ErrorDetails) {
    const message = error.userMessage || error.message;
    
    const toastOptions = {
      action: error.recoveryActions.find(a => a.primary) ? {
        label: error.recoveryActions.find(a => a.primary)!.label,
        onClick: error.recoveryActions.find(a => a.primary)!.handler
      } : undefined,
      duration: error.level === 'critical' ? Infinity : 
               error.level === 'error' ? 10000 : 
               error.level === 'warning' ? 5000 : 3000
    };

    switch (error.level) {
      case 'critical':
        toast.error(message, toastOptions);
        break;
      case 'error':
        toast.error(message, toastOptions);
        break;
      case 'warning':
        toast.warning(message, toastOptions);
        break;
      default:
        toast.info(message, toastOptions);
    }
  }

  private async sendRemoteReport(report: ErrorReport) {
    try {
      const response = await fetch(this.config.remoteEndpoint!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...report,
          // Add additional context
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight
          },
          connection: (navigator as any).connection ? {
            effectiveType: (navigator as any).connection.effectiveType,
            downlink: (navigator as any).connection.downlink,
            rtt: (navigator as any).connection.rtt
          } : undefined
        })
      });

      if (!response.ok) {
        console.warn('Failed to send error report:', response.status, response.statusText);
      }
    } catch (networkError) {
      console.warn('Network error while sending error report:', networkError);
    }
  }

  private storeLocalReport(report: ErrorReport) {
    try {
      const key = `error_reports_${this.sessionId}`;
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      existing.push({
        ...report,
        // Limit stored data size
        stackTrace: report.stackTrace?.substring(0, 1000),
        error: {
          ...report.error,
          context: {
            ...report.error.context,
            // Remove potentially large data
            additionalData: undefined
          }
        }
      });
      
      // Keep only last 10 reports per session
      if (existing.length > 10) {
        existing.splice(0, existing.length - 10);
      }
      
      localStorage.setItem(key, JSON.stringify(existing));
    } catch (storageError) {
      console.warn('Failed to store error report locally:', storageError);
    }
  }

  private getUserId(): string | undefined {
    // Try to get user ID from various sources
    return localStorage.getItem('userId') || 
           localStorage.getItem('user_id') ||
           sessionStorage.getItem('userId') ||
           undefined;
  }

  private getBuildVersion(): string | undefined {
    // Try to get build version from various sources
    return process.env.REACT_APP_VERSION ||
           (window as any).__APP_VERSION__ ||
           document.querySelector('meta[name="version"]')?.getAttribute('content') ||
           '1.0.0';
  }

  // Public methods
  public getReports(): ErrorReport[] {
    return [...this.reports];
  }

  public getReportsByCategory(category: ErrorCategory): ErrorReport[] {
    return this.reports.filter(report => report.error.category === category);
  }

  public getReportsByLevel(level: ErrorLevel): ErrorReport[] {
    return this.reports.filter(report => report.error.level === level);
  }

  public clearReports(): void {
    this.reports = [];
    this.reportCount = 0;
    
    // Clear local storage
    const key = `error_reports_${this.sessionId}`;
    localStorage.removeItem(key);
  }

  public exportReports(): string {
    return JSON.stringify({
      sessionId: this.sessionId,
      reportCount: this.reportCount,
      timestamp: new Date().toISOString(),
      reports: this.reports,
      config: this.config
    }, null, 2);
  }

  public updateConfig(newConfig: Partial<ErrorReportingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public destroy(): void {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
    this.clearReports();
  }
}

// Global singleton instance
let errorReporter: ErrorReportingService | null = null;

export function initializeErrorReporting(config?: Partial<ErrorReportingConfig>): ErrorReportingService {
  if (errorReporter) {
    errorReporter.destroy();
  }
  
  errorReporter = new ErrorReportingService(config);
  
  // Make it globally available for external error reporting
  (window as any).errorReporter = errorReporter;
  
  return errorReporter;
}

export function getErrorReporter(): ErrorReportingService | null {
  return errorReporter;
}

export function reportError(error: Error | EnhancedError, context?: any): void {
  if (errorReporter) {
    errorReporter.reportError(error, context);
  } else {
    console.error('Error reporter not initialized:', error);
  }
}

// Helper function to wrap async functions with error reporting
export function withErrorReporting<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: string
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      reportError(error instanceof Error ? error : new Error(String(error)), {
        component: context || fn.name,
        action: 'async_function_call',
        additionalData: { args }
      });
      throw error;
    }
  }) as T;
}

// Helper function to wrap components with error reporting
export function withComponentErrorReporting<P extends {}>(
  Component: React.ComponentType<P>,
  componentName?: string
) {
  return function WrappedComponent(props: P) {
    const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
      reportError(error, {
        component: componentName || Component.name,
        action: 'component_render',
        additionalData: { errorInfo }
      });
    };

    return (
      <React.ErrorBoundary
        fallback={<div>Component Error</div>}
        onError={handleError}
      >
        <Component {...props} />
      </React.ErrorBoundary>
    );
  };
}