import React from 'react';
import { Loader2 } from 'lucide-react';
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
}

export function LoadingState({ 
  title = "Loading...", 
  description, 
  className 
}: LoadingStateProps) {
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
    </div>
  );
}

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
}

export function Skeleton({ className, variant = 'rectangular' }: SkeletonProps) {
  const variantClasses = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-md',
  };

  return (
    <div 
      className={cn(
        'animate-pulse bg-muted',
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