import React from 'react';
import { Activity, AlertCircle, CheckCircle, Clock, Power, RotateCw, Wifi, WifiOff, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { Agent } from '../../types/agent';

interface StatusIndicatorProps {
  status: Agent['status'];
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showPulse?: boolean;
  className?: string;
}

const statusConfig = {
  idle: {
    icon: Clock,
    color: 'text-gray-500',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-200',
    label: 'Idle',
    description: 'Agent is ready for tasks'
  },
  active: {
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-200',
    label: 'Active',
    description: 'Agent is online and available'
  },
  working: {
    icon: Activity,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-200',
    label: 'Working',
    description: 'Agent is executing a task'
  },
  starting: {
    icon: RotateCw,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    borderColor: 'border-yellow-200',
    label: 'Starting',
    description: 'Agent is initializing'
  },
  stopping: {
    icon: Power,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    borderColor: 'border-orange-200',
    label: 'Stopping',
    description: 'Agent is shutting down'
  },
  error: {
    icon: AlertCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-200',
    label: 'Error',
    description: 'Agent encountered an error'
  },
  offline: {
    icon: WifiOff,
    color: 'text-gray-400',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-100',
    label: 'Offline',
    description: 'Agent is not responding'
  }
};

const sizeConfig = {
  sm: {
    container: 'w-6 h-6',
    icon: 'w-3 h-3',
    text: 'text-xs',
    gap: 'gap-1'
  },
  md: {
    container: 'w-8 h-8',
    icon: 'w-4 h-4',
    text: 'text-sm',
    gap: 'gap-2'
  },
  lg: {
    container: 'w-10 h-10',
    icon: 'w-5 h-5',
    text: 'text-base',
    gap: 'gap-2'
  }
};

export function StatusIndicator({ 
  status, 
  size = 'md', 
  showLabel = false, 
  showPulse = false,
  className 
}: StatusIndicatorProps) {
  const config = statusConfig[status];
  const sizeClasses = sizeConfig[size];
  const Icon = config.icon;

  const shouldPulse = showPulse && (status === 'working' || status === 'starting');

  const indicatorElement = (
    <div
      className={cn(
        'relative inline-flex items-center justify-center rounded-full border',
        sizeClasses.container,
        config.bgColor,
        config.borderColor,
        shouldPulse && 'animate-pulse',
        className
      )}
      title={config.description}
    >
      <Icon 
        className={cn(
          sizeClasses.icon,
          config.color,
          status === 'starting' && 'animate-spin'
        )} 
      />
      
      {/* Pulse ring for active states */}
      {shouldPulse && (
        <div className="absolute -top-1 -left-1 -right-1 -bottom-1">
          <div className={cn(
            'w-full h-full rounded-full border-2 animate-ping',
            status === 'working' ? 'border-blue-400' : 'border-yellow-400'
          )} />
        </div>
      )}
      
      {/* Health indicator dot for active status */}
      {status === 'active' && (
        <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-white" />
      )}
    </div>
  );

  if (showLabel) {
    return (
      <div className={cn('flex items-center', sizeClasses.gap)}>
        {indicatorElement}
        <span className={cn('font-medium', config.color, sizeClasses.text)}>
          {config.label}
        </span>
      </div>
    );
  }

  return indicatorElement;
}

// Specialized status indicators for different contexts
export function AgentConnectionStatus({ 
  isConnected, 
  lastActivity, 
  className 
}: { 
  isConnected: boolean; 
  lastActivity?: Date; 
  className?: string; 
}) {
  const Icon = isConnected ? Wifi : WifiOff;
  const color = isConnected ? 'text-green-600' : 'text-red-600';
  const bgColor = isConnected ? 'bg-green-100' : 'bg-red-100';
  
  const getActivityLabel = () => {
    if (!lastActivity) return 'Never';
    const now = new Date();
    const diff = now.getTime() - lastActivity.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn('w-6 h-6 rounded-full flex items-center justify-center', bgColor)}>
        <Icon className={cn('w-3 h-3', color)} />
      </div>
      <div className="text-xs text-gray-600">
        <div className={color}>{isConnected ? 'Connected' : 'Disconnected'}</div>
        <div>Last: {getActivityLabel()}</div>
      </div>
    </div>
  );
}

export function AgentHealthScore({ 
  score, 
  size = 'md', 
  className 
}: { 
  score: number; 
  size?: 'sm' | 'md' | 'lg';
  className?: string; 
}) {
  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    if (score >= 40) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const sizeClasses = sizeConfig[size];
  const healthColor = getHealthColor(score);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn(
        'flex items-center justify-center rounded-full',
        sizeClasses.container,
        healthColor
      )}>
        <Zap className={sizeClasses.icon} />
      </div>
      <span className={cn('font-medium', sizeClasses.text)}>
        {score}%
      </span>
    </div>
  );
}

// Usage examples and props interface for IDE support
export type StatusIndicatorVariant = {
  status: Agent['status'];
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showPulse?: boolean;
  className?: string;
};