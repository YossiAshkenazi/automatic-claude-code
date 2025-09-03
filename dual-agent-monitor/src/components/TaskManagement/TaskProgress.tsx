import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Play, 
  Pause, 
  RotateCcw,
  User,
  Brain,
  Zap,
  Calendar,
  BarChart3
} from 'lucide-react';
import { Task } from '../../types';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { formatDate } from '../../utils/formatters';
import { cn } from '../../lib/utils';

interface TaskProgressProps {
  task: Task;
  onUpdateProgress?: (taskId: string, progress: number, status?: Task['status']) => void;
  onUpdateStatus?: (taskId: string, status: Task['status']) => void;
  realTimeUpdates?: boolean;
  showDetailedMetrics?: boolean;
  className?: string;
}

interface ProgressMetric {
  label: string;
  value: number;
  unit: string;
  trend?: 'up' | 'down' | 'stable';
  color?: string;
}

const statusConfig = {
  pending: { 
    color: 'bg-gray-100 text-gray-700 border-gray-200', 
    icon: Clock, 
    label: 'Pending',
    description: 'Task is waiting to be started'
  },
  assigned: { 
    color: 'bg-blue-100 text-blue-700 border-blue-200', 
    icon: User, 
    label: 'Assigned',
    description: 'Task has been assigned to an agent'
  },
  in_progress: { 
    color: 'bg-yellow-100 text-yellow-700 border-yellow-200', 
    icon: Play, 
    label: 'In Progress',
    description: 'Task is currently being executed'
  },
  completed: { 
    color: 'bg-green-100 text-green-700 border-green-200', 
    icon: CheckCircle, 
    label: 'Completed',
    description: 'Task has been successfully completed'
  },
  failed: { 
    color: 'bg-red-100 text-red-700 border-red-200', 
    icon: AlertTriangle, 
    label: 'Failed',
    description: 'Task execution encountered an error'
  },
  cancelled: { 
    color: 'bg-gray-100 text-gray-500 border-gray-200', 
    icon: Pause, 
    label: 'Cancelled',
    description: 'Task was cancelled before completion'
  }
};

const agentConfig = {
  manager: { icon: Brain, color: 'text-blue-600', label: 'Manager' },
  worker: { icon: Zap, color: 'text-green-600', label: 'Worker' }
};

export function TaskProgress({
  task,
  onUpdateProgress,
  onUpdateStatus,
  realTimeUpdates = true,
  showDetailedMetrics = true,
  className
}: TaskProgressProps) {
  const [localProgress, setLocalProgress] = useState(task.progress);
  const [isUpdating, setIsUpdating] = useState(false);

  // Update local progress when task changes
  useEffect(() => {
    setLocalProgress(task.progress);
  }, [task.progress]);

  const currentStatus = statusConfig[task.status];
  const StatusIcon = currentStatus.icon;
  const AgentIcon = task.assignedAgent ? agentConfig[task.assignedAgent]?.icon : User;

  // Calculate progress metrics
  const metrics: ProgressMetric[] = useMemo(() => {
    const now = new Date();
    const startTime = new Date(task.createdAt);
    const lastUpdate = new Date(task.updatedAt);
    
    const elapsedMinutes = Math.floor((now.getTime() - startTime.getTime()) / (1000 * 60));
    const timeSinceUpdate = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60));
    
    const estimatedCompletion = task.estimatedDuration 
      ? Math.floor((task.estimatedDuration * 100) / Math.max(task.progress, 1))
      : null;
    
    const progressRate = elapsedMinutes > 0 ? task.progress / elapsedMinutes : 0;
    
    return [
      {
        label: 'Progress',
        value: task.progress,
        unit: '%',
        color: task.progress >= 75 ? 'text-green-600' : task.progress >= 50 ? 'text-yellow-600' : 'text-gray-600'
      },
      {
        label: 'Elapsed Time',
        value: elapsedMinutes,
        unit: 'min',
        color: 'text-blue-600'
      },
      {
        label: 'Progress Rate',
        value: Math.round(progressRate * 100) / 100,
        unit: '%/min',
        trend: progressRate > 1 ? 'up' : progressRate < 0.5 ? 'down' : 'stable',
        color: 'text-purple-600'
      },
      ...(estimatedCompletion ? [{
        label: 'Est. Total Time',
        value: estimatedCompletion,
        unit: 'min',
        color: 'text-orange-600'
      }] : []),
      {
        label: 'Last Update',
        value: timeSinceUpdate,
        unit: 'min ago',
        color: 'text-gray-600'
      }
    ];
  }, [task]);

  const handleProgressChange = async (newProgress: number) => {
    setLocalProgress(newProgress);
    setIsUpdating(true);
    
    try {
      // Determine if status should change based on progress
      let newStatus = task.status;
      if (newProgress === 100 && task.status !== 'completed') {
        newStatus = 'completed';
      } else if (newProgress > 0 && task.status === 'pending') {
        newStatus = 'in_progress';
      }
      
      await onUpdateProgress?.(task.id, newProgress, newStatus !== task.status ? newStatus : undefined);
    } catch (error) {
      console.error('Failed to update progress:', error);
      setLocalProgress(task.progress); // Revert on error
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStatusChange = async (newStatus: Task['status']) => {
    setIsUpdating(true);
    
    try {
      await onUpdateStatus?.(task.id, newStatus);
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return 'bg-green-500';
    if (progress >= 75) return 'bg-green-400';
    if (progress >= 50) return 'bg-yellow-400';
    if (progress >= 25) return 'bg-orange-400';
    return 'bg-red-400';
  };

  const isOverdue = task.estimatedDuration && 
    task.actualDuration && 
    task.actualDuration > task.estimatedDuration;

  const canUpdateProgress = ['assigned', 'in_progress'].includes(task.status);
  const canChangeStatus = onUpdateStatus;

  return (
    <Card className={cn('p-6', className)}>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 truncate">
            {task.title}
          </h3>
          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
            {task.description}
          </p>
          
          {/* Task Meta */}
          <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Calendar size={14} />
              <span>{formatDate(task.createdAt)}</span>
            </div>
            
            {task.assignedAgent && (
              <div className="flex items-center gap-1">
                <AgentIcon size={14} />
                <span className="capitalize">{task.assignedAgent}</span>
              </div>
            )}
            
            {task.estimatedDuration && (
              <div className="flex items-center gap-1">
                <Clock size={14} />
                <span>{task.estimatedDuration}min est.</span>
                {isOverdue && <AlertTriangle size={14} className="text-red-500" />}
              </div>
            )}
          </div>
        </div>
        
        {/* Status Badge */}
        <div className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium border',
          currentStatus.color
        )}>
          <StatusIcon size={16} />
          <span>{currentStatus.label}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Progress</span>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-gray-900">{Math.round(localProgress)}%</span>
            {isUpdating && (
              <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
            )}
          </div>
        </div>
        
        <div className="relative">
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={cn(
                'h-3 rounded-full transition-all duration-500 relative',
                getProgressColor(localProgress)
              )}
              style={{ width: `${Math.min(localProgress, 100)}%` }}
            >
              {/* Progress glow effect */}
              <div className="absolute inset-0 rounded-full bg-white opacity-30" />
            </div>
          </div>
          
          {/* Progress slider for interactive updates */}
          {canUpdateProgress && onUpdateProgress && (
            <input
              type="range"
              min="0"
              max="100"
              value={localProgress}
              onChange={(e) => setLocalProgress(parseFloat(e.target.value))}
              onMouseUp={(e) => handleProgressChange(parseFloat((e.target as HTMLInputElement).value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isUpdating}
            />
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      {showDetailedMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          {metrics.map((metric, index) => (
            <div key={index} className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">{metric.label}</span>
                {metric.trend && (
                  <TrendingUp 
                    size={12} 
                    className={cn(
                      metric.trend === 'up' ? 'text-green-500 rotate-0' :
                      metric.trend === 'down' ? 'text-red-500 rotate-180' :
                      'text-gray-400'
                    )}
                  />
                )}
              </div>
              <div className={cn('text-lg font-bold', metric.color)}>
                {metric.value}
                <span className="text-xs font-normal text-gray-500 ml-1">
                  {metric.unit}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      {canChangeStatus && (
        <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
          <span className="text-sm font-medium text-gray-700">Quick Actions:</span>
          
          {task.status === 'pending' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleStatusChange('in_progress')}
              disabled={isUpdating}
            >
              <Play size={14} />
              Start Task
            </Button>
          )}
          
          {task.status === 'in_progress' && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleStatusChange('completed')}
                disabled={isUpdating}
              >
                <CheckCircle size={14} />
                Mark Complete
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleStatusChange('paused')}
                disabled={isUpdating}
              >
                <Pause size={14} />
                Pause
              </Button>
            </>
          )}
          
          {task.status === 'failed' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleStatusChange('in_progress')}
              disabled={isUpdating}
            >
              <RotateCcw size={14} />
              Retry Task
            </Button>
          )}
          
          {task.status === 'completed' && task.progress < 100 && onUpdateProgress && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleProgressChange(100)}
              disabled={isUpdating}
            >
              <BarChart3 size={14} />
              Set 100%
            </Button>
          )}
        </div>
      )}

      {/* Status Description */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          <strong>Status:</strong> {currentStatus.description}
        </p>
        {task.result?.error && (
          <p className="text-xs text-red-600 mt-1">
            <strong>Error:</strong> {task.result.error}
          </p>
        )}
        {task.result?.output && task.status === 'completed' && (
          <div className="mt-2">
            <p className="text-xs text-gray-600 mb-1"><strong>Output:</strong></p>
            <div className="text-xs text-gray-700 bg-gray-50 rounded p-2 max-h-20 overflow-y-auto">
              {task.result.output}
            </div>
          </div>
        )}
      </div>

      {/* Real-time indicator */}
      {realTimeUpdates && (
        <div className="flex items-center justify-center mt-4">
          <div className="flex items-center gap-2 text-xs text-green-600">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Real-time updates enabled
          </div>
        </div>
      )}
    </Card>
  );
}