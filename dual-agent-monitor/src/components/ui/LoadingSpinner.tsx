import React from 'react';
import { Loader2, Wifi, Database, MessageSquare, BarChart3, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  text?: string;
  centered?: boolean;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
};

export function LoadingSpinner({ 
  size = 'md', 
  className, 
  text,
  centered = false 
}: LoadingSpinnerProps) {
  const content = (
    <>
      <Loader2 className={cn(sizeClasses[size], 'animate-spin', className)} />
      {text && (
        <p className="text-muted-foreground mt-2">{text}</p>
      )}
    </>
  );

  if (centered) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        {content}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {content}
    </div>
  );
}

interface LoadingStateProps {
  title?: string;
  description?: string;
  className?: string;
  showProgress?: boolean;
  progress?: number;
  timeout?: number;
  onTimeout?: () => void;
}

export function LoadingState({ 
  title = "Loading...", 
  description, 
  className,
  showProgress = false,
  progress = 0,
  timeout,
  onTimeout
}: LoadingStateProps) {
  React.useEffect(() => {
    if (timeout && onTimeout) {
      const timer = setTimeout(() => {
        onTimeout();
      }, timeout);
      
      return () => clearTimeout(timer);
    }
  }, [timeout, onTimeout]);
  
  return (
    <div className={cn(
      "flex flex-col items-center justify-center p-8 text-center",
      className
    )}>
      <LoadingSpinner size="lg" />
      <h3 className="font-medium text-lg mt-4">{title}</h3>
      {description && (
        <p className="text-muted-foreground mt-2 max-w-md">{description}</p>
      )}
      {showProgress && (
        <div className="w-full max-w-xs mt-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-1">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  animate?: boolean;
}

export function Skeleton({ className, variant = 'rectangular', animate = true }: SkeletonProps) {
  const variantClasses = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-md',
  };

  return (
    <div 
      className={cn(
        'bg-muted',
        animate && 'animate-pulse',
        variantClasses[variant],
        className
      )} 
    />
  );
}

interface CardSkeletonProps {
  showActions?: boolean;
  lines?: number;
}

export function CardSkeleton({ showActions = true, lines = 3 }: CardSkeletonProps) {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        {showActions && (
          <div className="flex gap-2">
            <Skeleton variant="circular" className="w-8 h-8" />
            <Skeleton variant="circular" className="w-8 h-8" />
          </div>
        )}
      </div>
      
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className="h-3 w-full" />
      ))}
      
      <div className="flex justify-between items-center pt-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  );
}

// Specialized loading states for different contexts
interface ContextualLoadingProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export function WebSocketConnecting({ className, size = 'md', text }: ContextualLoadingProps) {
  return (
    <div className={cn('flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg', className)}>
      <Wifi className={cn('animate-pulse text-yellow-600', {
        'w-4 h-4': size === 'sm',
        'w-5 h-5': size === 'md',
        'w-6 h-6': size === 'lg'
      })} />
      <div>
        <p className="text-sm font-medium text-yellow-800">
          {text || 'Connecting to real-time server...'}
        </p>
        <p className="text-xs text-yellow-600">Please wait while we establish connection</p>
      </div>
    </div>
  );
}

export function DataLoading({ className, size = 'md', text }: ContextualLoadingProps) {
  return (
    <div className={cn('flex items-center gap-3 p-4', className)}>
      <Database className={cn('animate-pulse text-blue-600', {
        'w-4 h-4': size === 'sm',
        'w-5 h-5': size === 'md',
        'w-6 h-6': size === 'lg'
      })} />
      <div>
        <p className="text-sm font-medium text-gray-700">
          {text || 'Loading data...'}
        </p>
        <p className="text-xs text-gray-500">Fetching from database</p>
      </div>
    </div>
  );
}

export function SessionsLoading({ className, size = 'md', text }: ContextualLoadingProps) {
  return (
    <div className={cn('flex items-center gap-3 p-4', className)}>
      <MessageSquare className={cn('animate-pulse text-purple-600', {
        'w-4 h-4': size === 'sm',
        'w-5 h-5': size === 'md',
        'w-6 h-6': size === 'lg'
      })} />
      <div>
        <p className="text-sm font-medium text-gray-700">
          {text || 'Loading sessions...'}
        </p>
        <p className="text-xs text-gray-500">Retrieving session history</p>
      </div>
    </div>
  );
}

export function AnalyticsLoading({ className, size = 'md', text }: ContextualLoadingProps) {
  return (
    <div className={cn('flex items-center gap-3 p-4', className)}>
      <BarChart3 className={cn('animate-pulse text-green-600', {
        'w-4 h-4': size === 'sm',
        'w-5 h-5': size === 'md',
        'w-6 h-6': size === 'lg'
      })} />
      <div>
        <p className="text-sm font-medium text-gray-700">
          {text || 'Loading analytics...'}
        </p>
        <p className="text-xs text-gray-500">Computing performance metrics</p>
      </div>
    </div>
  );
}

export function RealtimeLoading({ className, size = 'md', text }: ContextualLoadingProps) {
  return (
    <div className={cn('flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg', className)}>
      <Clock className={cn('animate-spin text-blue-600', {
        'w-4 h-4': size === 'sm',
        'w-5 h-5': size === 'md',
        'w-6 h-6': size === 'lg'
      })} />
      <div>
        <p className="text-sm font-medium text-blue-800">
          {text || 'Syncing real-time data...'}
        </p>
        <p className="text-xs text-blue-600">Live updates in progress</p>
      </div>
    </div>
  );
}

// Enhanced skeleton patterns
interface SessionListSkeletonProps {
  count?: number;
  showStatus?: boolean;
}

export function SessionListSkeleton({ count = 5, showStatus = true }: SessionListSkeletonProps) {
  return (
    <div className="divide-y divide-gray-200">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              {showStatus && <Skeleton variant="circular" className="w-4 h-4" />}
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-5 w-3/4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton variant="circular" className="w-6 h-6" />
              <Skeleton variant="circular" className="w-6 h-6" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Skeleton variant="circular" className="w-2 h-2" />
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="flex items-center gap-1">
              <Skeleton variant="circular" className="w-2 h-2" />
              <Skeleton className="h-3 w-14" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

interface MetricsSkeletonProps {
  rows?: number;
  showCharts?: boolean;
}

export function MetricsSkeleton({ rows = 3, showCharts = true }: MetricsSkeletonProps) {
  return (
    <div className="space-y-6">
      {/* Metrics cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="p-4 border rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton variant="circular" className="w-8 h-8" />
            </div>
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
      
      {/* Chart placeholders */}
      {showCharts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="border rounded-lg p-4">
              <Skeleton className="h-6 w-32 mb-4" />
              <Skeleton className="h-64 w-full" />
            </div>
          ))}
        </div>
      )}
      
      {/* Table skeleton */}
      <div className="border rounded-lg">
        <div className="p-4 border-b">
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="divide-y">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton variant="circular" className="w-8 h-8" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}