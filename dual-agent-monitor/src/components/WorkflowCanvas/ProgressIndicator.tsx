import React, { memo, useEffect, useState } from 'react';
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  XCircle, 
  Play, 
  Pause,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';

interface ProgressIndicatorProps {
  progress: number;
  status?: 'pending' | 'in-progress' | 'completed' | 'failed' | 'paused';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showIcon?: boolean;
  animated?: boolean;
  color?: string;
  className?: string;
  trend?: 'up' | 'down' | 'stable';
  estimatedCompletion?: Date;
  onProgressClick?: () => void;
}

const ProgressIndicator = memo<ProgressIndicatorProps>(({ 
  progress,
  status = 'in-progress',
  size = 'md',
  showLabel = true,
  showIcon = true,
  animated = true,
  color,
  className = '',
  trend,
  estimatedCompletion,
  onProgressClick
}) => {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const [pulseAnimation, setPulseAnimation] = useState(false);

  // Animate progress changes
  useEffect(() => {
    if (animated) {
      const timeout = setTimeout(() => {
        setAnimatedProgress(progress);
      }, 100);
      return () => clearTimeout(timeout);
    } else {
      setAnimatedProgress(progress);
    }
  }, [progress, animated]);

  // Trigger pulse animation on status change
  useEffect(() => {
    setPulseAnimation(true);
    const timeout = setTimeout(() => setPulseAnimation(false), 1000);
    return () => clearTimeout(timeout);
  }, [status]);

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return {
          container: 'w-16 h-16',
          circle: 'w-14 h-14',
          strokeWidth: 2,
          textSize: 'text-xs',
          iconSize: 'w-3 h-3'
        };
      case 'lg':
        return {
          container: 'w-32 h-32',
          circle: 'w-28 h-28',
          strokeWidth: 4,
          textSize: 'text-lg',
          iconSize: 'w-6 h-6'
        };
      default: // md
        return {
          container: 'w-24 h-24',
          circle: 'w-20 h-20',
          strokeWidth: 3,
          textSize: 'text-sm',
          iconSize: 'w-4 h-4'
        };
    }
  };

  const getProgressColor = () => {
    if (color) return color;
    
    switch (status) {
      case 'completed':
        return '#10b981'; // green-500
      case 'failed':
        return '#ef4444'; // red-500
      case 'paused':
        return '#f59e0b'; // amber-500
      case 'pending':
        return '#6b7280'; // gray-500
      default: // in-progress
        if (progress >= 90) return '#10b981'; // green-500
        if (progress >= 70) return '#3b82f6'; // blue-500
        if (progress >= 50) return '#f59e0b'; // amber-500
        if (progress >= 25) return '#f97316'; // orange-500
        return '#ef4444'; // red-500
    }
  };

  const getStatusIcon = () => {
    const { iconSize } = getSizeClasses();
    
    switch (status) {
      case 'completed':
        return <CheckCircle className={`${iconSize} text-green-500`} />;
      case 'failed':
        return <XCircle className={`${iconSize} text-red-500`} />;
      case 'paused':
        return <Pause className={`${iconSize} text-amber-500`} />;
      case 'pending':
        return <Clock className={`${iconSize} text-gray-500`} />;
      default: // in-progress
        return <Play className={`${iconSize} text-blue-500 animate-pulse`} />;
    }
  };

  const getTrendIcon = () => {
    const { iconSize } = getSizeClasses();
    
    switch (trend) {
      case 'up':
        return <TrendingUp className={`${iconSize} text-green-500`} />;
      case 'down':
        return <TrendingDown className={`${iconSize} text-red-500`} />;
      case 'stable':
        return <Minus className={`${iconSize} text-gray-500`} />;
      default:
        return null;
    }
  };

  const getEstimatedCompletion = () => {
    if (!estimatedCompletion || status === 'completed' || status === 'failed') {
      return null;
    }
    
    const timeLeft = estimatedCompletion.getTime() - Date.now();
    const minutes = Math.floor(timeLeft / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m left`;
    } else if (minutes > 0) {
      return `${minutes}m left`;
    } else {
      return 'Almost done';
    }
  };

  const { container, circle, strokeWidth, textSize, iconSize } = getSizeClasses();
  const circumference = 2 * Math.PI * 40; // radius of 40
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (animatedProgress / 100) * circumference;

  return (
    <div className={`relative ${container} ${className}`}>
      {/* Background circle */}
      <svg className={`${circle} transform -rotate-90 transition-transform duration-300`}>
        <circle
          cx="50%"
          cy="50%"
          r="40"
          stroke="#e5e7eb" // gray-200
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        
        {/* Progress circle */}
        <circle
          cx="50%"
          cy="50%"
          r="40"
          stroke={getProgressColor()}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={`transition-all duration-500 ease-out ${
            animated && status === 'in-progress' ? 'animate-pulse' : ''
          }`}
        />
        
        {/* Pulse effect for active progress */}
        {pulseAnimation && (
          <circle
            cx="50%"
            cy="50%"
            r="40"
            stroke={getProgressColor()}
            strokeWidth={strokeWidth + 2}
            fill="transparent"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            opacity="0.5"
            className="animate-ping"
          />
        )}
      </svg>
      
      {/* Center content */}
      <div 
        className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer"
        onClick={onProgressClick}
      >
        {/* Status icon */}
        {showIcon && (
          <div className="mb-1">
            {getStatusIcon()}
          </div>
        )}
        
        {/* Progress percentage */}
        {showLabel && (
          <div className={`font-bold text-gray-800 ${textSize}`}>
            {Math.round(progress)}%
          </div>
        )}
        
        {/* Trend indicator */}
        {trend && (
          <div className="mt-1">
            {getTrendIcon()}
          </div>
        )}
      </div>
      
      {/* Estimated completion */}
      {getEstimatedCompletion() && (
        <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
          <div className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full shadow-sm border">
            {getEstimatedCompletion()}
          </div>
        </div>
      )}
      
      {/* Progress details tooltip */}
      <div className="absolute opacity-0 hover:opacity-100 transition-opacity duration-200 -top-12 left-1/2 transform -translate-x-1/2 whitespace-nowrap pointer-events-none">
        <div className="bg-gray-800 text-white text-xs px-3 py-1 rounded-lg shadow-lg">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-3 h-3" />
            <span>{Math.round(progress)}% complete</span>
          </div>
          {status !== 'completed' && status !== 'failed' && (
            <div className="text-gray-300 mt-1 capitalize">
              Status: {status.replace('-', ' ')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

ProgressIndicator.displayName = 'ProgressIndicator';

export { ProgressIndicator };