import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug, Clock, Wifi, WifiOff } from 'lucide-react';
import { Button } from './Button';
import { Card, CardContent, CardHeader, CardTitle } from './Card';
import { toast } from 'sonner';

type ErrorLevel = 'error' | 'warning' | 'critical';
type ErrorCategory = 'network' | 'rendering' | 'api' | 'websocket' | 'data' | 'auth' | 'unknown';

interface ErrorDetails {
  level: ErrorLevel;
  category: ErrorCategory;
  retryable: boolean;
  userMessage?: string;
  technicalDetails?: string;
  recoveryActions?: string[];
}

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  showDetails?: boolean;
  level?: ErrorLevel;
  category?: ErrorCategory;
  retryable?: boolean;
  name?: string; // Component name for logging
  autoRecover?: boolean; // Attempt automatic recovery
  maxRetries?: number;
  retryDelay?: number;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  retryCount: number;
  isRetrying: boolean;
  lastErrorTime: number;
}

export class ErrorBoundary extends Component<Props, State> {
  private retryTimeoutId?: NodeJS.Timeout;
  
  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: 0,
      isRetrying: false,
      lastErrorTime: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { 
      hasError: true, 
      error, 
      errorInfo: null,
      lastErrorTime: Date.now()
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    
    // Enhanced error logging with context
    const errorDetails = this.categorizeError(error);
    const context = {
      component: this.props.name || 'Unknown',
      level: errorDetails.level,
      category: errorDetails.category,
      retryable: errorDetails.retryable,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      stackTrace: error.stack,
      componentStack: errorInfo.componentStack
    };
    
    console.error('ErrorBoundary caught an error:', { error, errorInfo, context });
    
    // Report to error tracking service (if available)
    if (typeof window !== 'undefined' && (window as any).errorReporter) {
      (window as any).errorReporter.captureException(error, {
        tags: {
          component: this.props.name,
          category: errorDetails.category,
          level: errorDetails.level
        },
        extra: context
      });
    }
    
    // Call user-provided error handler
    this.props.onError?.(error, errorInfo);
    
    // Show toast notification for non-critical errors
    if (errorDetails.level !== 'critical') {
      toast.error(
        errorDetails.userMessage || `Component error: ${this.props.name || 'Unknown'}`,
        {
          action: errorDetails.retryable ? {
            label: 'Retry',
            onClick: () => this.handleRetry()
          } : undefined
        }
      );
    }
    
    // Attempt auto-recovery if enabled
    if (this.props.autoRecover && errorDetails.retryable && this.state.retryCount < (this.props.maxRetries || 3)) {
      this.scheduleAutoRetry();
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }
  
  categorizeError = (error: Error): ErrorDetails => {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';
    
    // Network errors
    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return {
        level: 'warning',
        category: 'network',
        retryable: true,
        userMessage: 'Network connection issue. Please check your internet connection.',
        recoveryActions: ['Check internet connection', 'Retry request', 'Refresh page']
      };
    }
    
    // WebSocket errors
    if (message.includes('websocket') || message.includes('ws:') || message.includes('socket')) {
      return {
        level: 'warning',
        category: 'websocket',
        retryable: true,
        userMessage: 'Real-time connection lost. Attempting to reconnect.',
        recoveryActions: ['Check connection', 'Wait for reconnection', 'Refresh page']
      };
    }
    
    // API errors
    if (message.includes('api') || message.includes('response') || stack.includes('apiClient')) {
      return {
        level: 'error',
        category: 'api',
        retryable: true,
        userMessage: 'Server communication error. Please try again.',
        recoveryActions: ['Retry request', 'Check server status', 'Contact support']
      };
    }
    
    // Authentication errors
    if (message.includes('auth') || message.includes('unauthorized') || message.includes('forbidden')) {
      return {
        level: 'error',
        category: 'auth',
        retryable: false,
        userMessage: 'Authentication required. Please log in again.',
        recoveryActions: ['Log in again', 'Clear browser cache', 'Contact administrator']
      };
    }
    
    // Data/rendering errors
    if (message.includes('render') || stack.includes('react') || message.includes('component')) {
      return {
        level: 'error',
        category: 'rendering',
        retryable: true,
        userMessage: 'Display error occurred. The component will be reloaded.',
        recoveryActions: ['Reload component', 'Refresh page', 'Clear browser cache']
      };
    }
    
    // Critical system errors
    if (message.includes('chunk') || message.includes('module') || message.includes('import')) {
      return {
        level: 'critical',
        category: 'unknown',
        retryable: false,
        userMessage: 'System error occurred. Please refresh the page.',
        recoveryActions: ['Refresh page', 'Clear browser cache', 'Try incognito mode']
      };
    }
    
    // Default categorization
    return {
      level: 'error',
      category: 'unknown',
      retryable: true,
      userMessage: 'An unexpected error occurred.',
      recoveryActions: ['Try again', 'Refresh page', 'Contact support']
    };
  };
  
  scheduleAutoRetry = () => {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
    
    const delay = this.props.retryDelay || 2000 * Math.pow(2, this.state.retryCount); // Exponential backoff
    
    this.setState({ isRetrying: true });
    
    this.retryTimeoutId = setTimeout(() => {
      this.handleRetry();
    }, delay);
  };
  
  handleRetry = () => {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
    
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1,
      isRetrying: false
    }));
    
    toast.success(`Retrying... (attempt ${this.state.retryCount + 1})`);
  };
  
  handleReset = () => {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
    
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null, 
      retryCount: 0,
      isRetrying: false,
      lastErrorTime: 0
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError && !this.state.isRetrying) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorDetails = this.state.error ? this.categorizeError(this.state.error) : null;
      const isRetryable = errorDetails?.retryable && this.state.retryCount < (this.props.maxRetries || 3);
      
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle className={`flex items-center gap-3 ${
                errorDetails?.level === 'critical' ? 'text-red-600' : 
                errorDetails?.level === 'warning' ? 'text-yellow-600' : 'text-destructive'
              }`}>
                {errorDetails?.level === 'critical' ? (
                  <Bug className="w-6 h-6" />
                ) : errorDetails?.category === 'network' ? (
                  <WifiOff className="w-6 h-6" />
                ) : errorDetails?.category === 'websocket' ? (
                  <Wifi className="w-6 h-6" />
                ) : (
                  <AlertTriangle className="w-6 h-6" />
                )}
                {errorDetails?.level === 'critical' ? 'Critical System Error' : 
                 errorDetails?.category === 'network' ? 'Connection Problem' :
                 errorDetails?.category === 'websocket' ? 'Real-time Connection Lost' :
                 `Component Error${this.props.name ? `: ${this.props.name}` : ''}`}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                {errorDetails?.userMessage || 'An unexpected error occurred in the application. Please try refreshing the page or contact support if the problem persists.'}
              </p>
              
              {this.state.retryCount > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-md">
                  <div className="flex items-center gap-2 text-yellow-800">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      Retry attempt {this.state.retryCount} of {this.props.maxRetries || 3}
                    </span>
                  </div>
                </div>
              )}
              
              {errorDetails?.recoveryActions && (
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-md">
                  <h4 className="font-medium text-blue-900 mb-2">Suggested Actions:</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    {errorDetails.recoveryActions.map((action, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <div className="w-1 h-1 bg-blue-600 rounded-full" />
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {this.props.showDetails && this.state.error && (
                <details className="bg-muted p-4 rounded-md">
                  <summary className="font-medium cursor-pointer">
                    Technical Details
                  </summary>
                  <div className="mt-2 space-y-2">
                    <div>
                      <strong>Error:</strong>
                      <pre className="text-sm mt-1 overflow-auto bg-gray-100 p-2 rounded">
                        {this.state.error.message}
                      </pre>
                    </div>
                    <div>
                      <strong>Category:</strong> {errorDetails?.category || 'unknown'}
                    </div>
                    <div>
                      <strong>Level:</strong> {errorDetails?.level || 'error'}
                    </div>
                    <div>
                      <strong>Retryable:</strong> {errorDetails?.retryable ? 'Yes' : 'No'}
                    </div>
                    <div>
                      <strong>Timestamp:</strong> {new Date(this.state.lastErrorTime).toLocaleString()}
                    </div>
                    {this.state.error.stack && (
                      <div>
                        <strong>Stack Trace:</strong>
                        <pre className="text-sm mt-1 overflow-auto max-h-32 bg-gray-100 p-2 rounded">
                          {this.state.error.stack}
                        </pre>
                      </div>
                    )}
                    {this.state.errorInfo?.componentStack && (
                      <div>
                        <strong>Component Stack:</strong>
                        <pre className="text-sm mt-1 overflow-auto max-h-32 bg-gray-100 p-2 rounded">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              )}

              <div className="flex gap-3">
                {isRetryable && (
                  <Button onClick={this.handleRetry} className="flex-1" disabled={this.state.isRetrying}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${this.state.isRetrying ? 'animate-spin' : ''}`} />
                    {this.state.isRetrying ? 'Retrying...' : 'Try Again'}
                  </Button>
                )}
                <Button 
                  variant={isRetryable ? "outline" : "default"} 
                  onClick={this.handleReload} 
                  className={isRetryable ? "flex-1" : "w-full"}
                >
                  <Home className="w-4 h-4 mr-2" />
                  Reload Page
                </Button>
                {isRetryable && (
                  <Button variant="outline" onClick={this.handleReset} className="flex-1">
                    Reset
                  </Button>
                )}
              </div>
              
              {errorDetails?.level === 'critical' && (
                <div className="bg-red-50 border border-red-200 p-3 rounded-md">
                  <p className="text-sm text-red-800">
                    <strong>Critical Error:</strong> If this problem persists, please contact support with the technical details above.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }
    
    if (this.state.isRetrying) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
            <p className="text-sm text-muted-foreground">Recovering from error...</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}