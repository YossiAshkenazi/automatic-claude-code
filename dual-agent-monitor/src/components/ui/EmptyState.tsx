import React, { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline' | 'secondary';
  };
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: {
    container: 'p-6',
    icon: 'w-8 h-8',
    title: 'text-base',
    description: 'text-sm',
  },
  md: {
    container: 'p-8',
    icon: 'w-12 h-12',
    title: 'text-lg',
    description: 'text-sm',
  },
  lg: {
    container: 'p-12',
    icon: 'w-16 h-16',
    title: 'text-xl',
    description: 'text-base',
  },
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  size = 'md'
}: EmptyStateProps) {
  const classes = sizeClasses[size];

  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center',
      classes.container,
      className
    )}>
      {icon && (
        <div className={cn(
          'text-muted-foreground mb-4 opacity-50',
          classes.icon
        )}>
          {icon}
        </div>
      )}
      
      <h3 className={cn('font-medium text-foreground mb-2', classes.title)}>
        {title}
      </h3>
      
      {description && (
        <p className={cn('text-muted-foreground mb-4 max-w-md', classes.description)}>
          {description}
        </p>
      )}
      
      {action && (
        <Button
          onClick={action.onClick}
          variant={action.variant || 'default'}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}