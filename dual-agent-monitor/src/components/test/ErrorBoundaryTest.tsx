import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { ErrorBoundaryWrapper } from '../ui/ErrorBoundaryWrapper';
import { 
  WebSocketErrorBoundary, 
  SessionListErrorBoundary, 
  AnalyticsErrorBoundary,
  DataErrorBoundary,
  ComponentErrorBoundary
} from '../ui/SpecializedErrorBoundaries';
import { 
  LoadingState,
  WebSocketConnecting,
  DataLoading,
  SessionsLoading,
  AnalyticsLoading,
  SessionListSkeleton,
  MetricsSkeleton
} from '../ui/LoadingSpinner';

// Test component that can throw errors
function ErrorThrowingComponent({ errorType }: { errorType: string }) {
  switch (errorType) {
    case 'render':
      throw new Error('Render error for testing');
    case 'network':
      throw new Error('fetch failed: network error');
    case 'websocket':
      throw new Error('WebSocket connection failed');
    case 'api':
      throw new Error('API response error: 500 Internal Server Error');
    case 'auth':
      throw new Error('401 unauthorized access');
    default:
      return <div>Component working normally</div>;
  }
}

// Test component for loading states
function LoadingTestComponent({ loadingType }: { loadingType: string }) {
  const [isLoading, setIsLoading] = useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 3000);
    return () => clearTimeout(timer);
  }, [loadingType]);

  if (isLoading) {
    switch (loadingType) {
      case 'websocket':
        return <WebSocketConnecting />;
      case 'data':
        return <DataLoading />;
      case 'sessions':
        return <SessionsLoading />;
      case 'analytics':
        return <AnalyticsLoading />;
      case 'skeleton-session':
        return <SessionListSkeleton count={3} />;
      case 'skeleton-metrics':
        return <MetricsSkeleton rows={2} />;
      default:
        return <LoadingState title="Generic Loading" />;
    }
  }

  return <div className="p-4 text-green-600">✅ Loaded successfully!</div>;
}

export function ErrorBoundaryTest() {
  const [errorType, setErrorType] = useState<string>('none');
  const [loadingType, setLoadingType] = useState<string>('none');

  return (
    <div className="p-8 space-y-8 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Error Boundary & Loading States Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Error Boundary Tests */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Error Boundary Tests</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              <Button onClick={() => setErrorType('none')} variant="outline">
                No Error
              </Button>
              <Button onClick={() => setErrorType('render')} variant="destructive">
                Render Error
              </Button>
              <Button onClick={() => setErrorType('network')} variant="destructive">
                Network Error
              </Button>
              <Button onClick={() => setErrorType('websocket')} variant="destructive">
                WebSocket Error
              </Button>
              <Button onClick={() => setErrorType('api')} variant="destructive">
                API Error
              </Button>
              <Button onClick={() => setErrorType('auth')} variant="destructive">
                Auth Error
              </Button>
            </div>
            
            <div className="space-y-4">
              {/* Generic Error Boundary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Generic Error Boundary</CardTitle>
                </CardHeader>
                <CardContent>
                  <ErrorBoundaryWrapper componentName="Test Component" showDetails={true}>
                    <ErrorThrowingComponent errorType={errorType} />
                  </ErrorBoundaryWrapper>
                </CardContent>
              </Card>

              {/* WebSocket Error Boundary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">WebSocket Error Boundary</CardTitle>
                </CardHeader>
                <CardContent>
                  <WebSocketErrorBoundary showDetails={true}>
                    <ErrorThrowingComponent errorType={errorType === 'websocket' ? errorType : 'none'} />
                  </WebSocketErrorBoundary>
                </CardContent>
              </Card>

              {/* Session List Error Boundary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Session List Error Boundary</CardTitle>
                </CardHeader>
                <CardContent>
                  <SessionListErrorBoundary showDetails={true}>
                    <ErrorThrowingComponent errorType={errorType === 'api' ? errorType : 'none'} />
                  </SessionListErrorBoundary>
                </CardContent>
              </Card>

              {/* Analytics Error Boundary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Analytics Error Boundary</CardTitle>
                </CardHeader>
                <CardContent>
                  <AnalyticsErrorBoundary showDetails={true}>
                    <ErrorThrowingComponent errorType={errorType === 'render' ? errorType : 'none'} />
                  </AnalyticsErrorBoundary>
                </CardContent>
              </Card>

              {/* Data Error Boundary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Data Error Boundary</CardTitle>
                </CardHeader>
                <CardContent>
                  <DataErrorBoundary showDetails={true}>
                    <ErrorThrowingComponent errorType={errorType === 'network' ? errorType : 'none'} />
                  </DataErrorBoundary>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Loading States Tests */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Loading States Tests</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              <Button onClick={() => setLoadingType('none')} variant="outline">
                No Loading
              </Button>
              <Button onClick={() => setLoadingType('websocket')}>
                WebSocket Connecting
              </Button>
              <Button onClick={() => setLoadingType('data')}>
                Data Loading
              </Button>
              <Button onClick={() => setLoadingType('sessions')}>
                Sessions Loading
              </Button>
              <Button onClick={() => setLoadingType('analytics')}>
                Analytics Loading
              </Button>
              <Button onClick={() => setLoadingType('skeleton-session')}>
                Session Skeleton
              </Button>
              <Button onClick={() => setLoadingType('skeleton-metrics')}>
                Metrics Skeleton
              </Button>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Loading State Demo</CardTitle>
              </CardHeader>
              <CardContent>
                <ComponentErrorBoundary
                  componentName="Loading Test"
                  loading={loadingType !== 'none' && loadingType !== undefined}
                  loadingText="Testing loading states..."
                >
                  {loadingType !== 'none' ? (
                    <LoadingTestComponent loadingType={loadingType} />
                  ) : (
                    <div className="p-4 text-gray-600">Select a loading state to test</div>
                  )}
                </ComponentErrorBoundary>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}