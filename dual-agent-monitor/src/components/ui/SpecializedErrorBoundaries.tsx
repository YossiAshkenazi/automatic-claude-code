import React, { ReactNode } from 'react';
import { Wifi, WifiOff, Database, MessageSquare, BarChart3, Settings, AlertTriangle } from 'lucide-react';
import { ErrorBoundary } from './ErrorBoundary';
import { LoadingState } from './LoadingSpinner';
import { EmptyState } from './EmptyState';
import { Button } from './Button';
import { Card, CardContent, CardHeader, CardTitle } from './Card';

interface SpecializedErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  showDetails?: boolean;
}

// WebSocket Connection Error Boundary
export function WebSocketErrorBoundary({ children, onError, showDetails }: SpecializedErrorBoundaryProps) {
  const fallback = (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-yellow-600">
          <WifiOff className="w-5 h-5" />
          Connection Issue
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">
          Real-time connection lost. Some features may not work properly.
        </p>
        <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-md">
          <p className="text-sm text-yellow-800">
            The monitoring dashboard will continue to work in fallback mode with reduced functionality.
          </p>
        </div>
        <Button 
          onClick={() => window.location.reload()} 
          className="w-full"
          variant="outline"
        >
          <Wifi className="w-4 h-4 mr-2" />
          Reconnect
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <ErrorBoundary
      fallback={fallback}
      name="WebSocket Connection"
      category="websocket"
      level="warning"
      retryable={true}
      autoRecover={true}
      maxRetries={5}
      retryDelay={3000}
      onError={onError}
      showDetails={showDetails}
    >
      {children}
    </ErrorBoundary>
  );
}

// Session List Error Boundary
export function SessionListErrorBoundary({ children, onError, showDetails }: SpecializedErrorBoundaryProps) {
  const fallback = (
    <EmptyState
      icon={<MessageSquare className="w-12 h-12" />}
      title="Session List Unavailable"
      description="Unable to load session list. This might be due to a server connection issue."
      action={{
        label: "Retry",
        onClick: () => window.location.reload()
      }}
    />
  );

  return (
    <ErrorBoundary
      fallback={fallback}
      name="Session List"
      category="data"
      level="error"
      retryable={true}
      autoRecover={true}
      maxRetries={3}
      onError={onError}
      showDetails={showDetails}
    >
      {children}
    </ErrorBoundary>
  );
}

// Analytics Dashboard Error Boundary
export function AnalyticsErrorBoundary({ children, onError, showDetails }: SpecializedErrorBoundaryProps) {
  const fallback = (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-blue-600">
          <BarChart3 className="w-5 h-5" />
          Analytics Temporarily Unavailable
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">
          The analytics dashboard encountered an error. The main monitoring features are still available.
        </p>
        <div className="bg-blue-50 border border-blue-200 p-3 rounded-md">
          <h4 className="font-medium text-blue-900 mb-1">Available alternatives:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• View individual session details</li>
            <li>• Use the timeline view</li>
            <li>• Export session data for external analysis</li>
          </ul>
        </div>
        <Button onClick={() => window.location.reload()} variant="outline">
          Retry Analytics
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <ErrorBoundary
      fallback={fallback}
      name="Analytics Dashboard"
      category="rendering"
      level="warning"
      retryable={true}
      onError={onError}
      showDetails={showDetails}
    >
      {children}
    </ErrorBoundary>
  );
}

// Database/API Error Boundary
export function DataErrorBoundary({ children, onError, showDetails }: SpecializedErrorBoundaryProps) {
  const fallback = (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-red-600">
          <Database className="w-5 h-5" />
          Data Access Error
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">
          Unable to access the database. This might be a temporary server issue.
        </p>
        <div className="bg-red-50 border border-red-200 p-3 rounded-md">
          <p className="text-sm text-red-800">
            <strong>Troubleshooting:</strong> Check if the monitoring server is running on the correct port.
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => window.location.reload()} className="flex-1">
            Retry Connection
          </Button>
          <Button 
            variant="outline" 
            onClick={() => window.open('/api/health', '_blank')}
            className="flex-1"
          >
            Check Server Status
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <ErrorBoundary
      fallback={fallback}
      name="Data Layer"
      category="api"
      level="error"
      retryable={true}
      autoRecover={false} // Don't auto-recover database errors
      onError={onError}
      showDetails={showDetails}
    >
      {children}
    </ErrorBoundary>
  );
}

// Sidebar Navigation Error Boundary
export function SidebarErrorBoundary({ children, onError, showDetails }: SpecializedErrorBoundaryProps) {
  const fallback = (
    <div className="w-16 bg-card border-r border-border flex flex-col items-center py-4 space-y-4">
      <div className="p-2 bg-yellow-100 rounded-lg">
        <AlertTriangle className="w-5 h-5 text-yellow-600" />
      </div>
      <div className="text-xs text-center text-muted-foreground px-2">
        Navigation temporarily unavailable
      </div>
      <Button 
        size="sm" 
        variant="outline" 
        onClick={() => window.location.reload()}
        className="text-xs px-2"
      >
        Fix
      </Button>
    </div>
  );

  return (
    <ErrorBoundary
      fallback={fallback}
      name="Sidebar Navigation"
      category="rendering"
      level="warning"
      retryable={true}
      autoRecover={true}
      maxRetries={2}
      onError={onError}
      showDetails={showDetails}
    >
      {children}
    </ErrorBoundary>
  );
}

// Settings Error Boundary
export function SettingsErrorBoundary({ children, onError, showDetails }: SpecializedErrorBoundaryProps) {
  const fallback = (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-orange-600">
          <Settings className="w-5 h-5" />
          Settings Error
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">
          The settings panel encountered an error. Your current configuration is preserved.
        </p>
        <div className="bg-orange-50 border border-orange-200 p-3 rounded-md">
          <p className="text-sm text-orange-800">
            <strong>Note:</strong> Existing settings continue to work normally.
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => window.location.reload()} className="flex-1">
            Reload Settings
          </Button>
          <Button variant="outline" onClick={() => window.history.back()} className="flex-1">
            Go Back
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <ErrorBoundary
      fallback={fallback}
      name="Settings Panel"
      category="rendering"
      level="warning"
      retryable={true}
      onError={onError}
      showDetails={showDetails}
    >
      {children}
    </ErrorBoundary>
  );
}

// Generic Component Error Boundary with loading support
interface ComponentErrorBoundaryProps extends SpecializedErrorBoundaryProps {
  componentName?: string;
  loading?: boolean;
  loadingText?: string;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function ComponentErrorBoundary({
  children,
  onError,
  showDetails,
  componentName = "Component",
  loading = false,
  loadingText,
  isEmpty = false,
  emptyTitle,
  emptyDescription
}: ComponentErrorBoundaryProps) {
  // Show loading state
  if (loading) {
    return (
      <LoadingState
        title={loadingText || `Loading ${componentName}...`}
        description="Please wait while we fetch the data."
      />
    );
  }

  // Show empty state
  if (isEmpty) {
    return (
      <EmptyState
        title={emptyTitle || `No ${componentName} Data`}
        description={emptyDescription || `No ${componentName.toLowerCase()} data available.`}
        icon={<MessageSquare className="w-12 h-12" />}
      />
    );
  }

  const fallback = (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-red-600">
          <AlertTriangle className="w-5 h-5" />
          {componentName} Error
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">
          The {componentName.toLowerCase()} component encountered an error and needs to be reloaded.
        </p>
        <Button onClick={() => window.location.reload()}>
          Reload {componentName}
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <ErrorBoundary
      fallback={fallback}
      name={componentName}
      category="rendering"
      level="error"
      retryable={true}
      autoRecover={true}
      onError={onError}
      showDetails={showDetails}
    >
      {children}
    </ErrorBoundary>
  );
}