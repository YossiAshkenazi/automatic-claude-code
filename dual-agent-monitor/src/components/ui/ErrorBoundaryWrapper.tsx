import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { reportError } from '../../utils/errorReporting';

// Simple wrapper that adds error reporting to the existing ErrorBoundary
interface ErrorBoundaryWrapperProps {
  children: React.ReactNode;
  componentName?: string;
  fallback?: React.ReactNode;
  showDetails?: boolean;
}

export function ErrorBoundaryWrapper({ 
  children, 
  componentName = 'Unknown Component',
  fallback,
  showDetails
}: ErrorBoundaryWrapperProps) {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Report error with context
    reportError(error, {
      component: componentName,
      action: 'component_render',
      additionalData: { 
        componentStack: errorInfo.componentStack,
        errorBoundary: true 
      }
    });
  };

  return (
    <ErrorBoundary
      onError={handleError}
      fallback={fallback}
      showDetails={showDetails}
    >
      {children}
    </ErrorBoundary>
  );
}

// Re-export specialized error boundaries with the wrapper
export function WebSocketErrorBoundaryWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundaryWrapper
      componentName="WebSocket Connection"
      showDetails={process.env.NODE_ENV === 'development'}
    >
      {children}
    </ErrorBoundaryWrapper>
  );
}

export function SessionListErrorBoundaryWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundaryWrapper
      componentName="Session List"
      showDetails={process.env.NODE_ENV === 'development'}
    >
      {children}
    </ErrorBoundaryWrapper>
  );
}

export function AnalyticsErrorBoundaryWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundaryWrapper
      componentName="Analytics Dashboard"
      showDetails={process.env.NODE_ENV === 'development'}
    >
      {children}
    </ErrorBoundaryWrapper>
  );
}

export function DataErrorBoundaryWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundaryWrapper
      componentName="Data Layer"
      showDetails={process.env.NODE_ENV === 'development'}
    >
      {children}
    </ErrorBoundaryWrapper>
  );
}