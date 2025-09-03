import React, { memo, useState, useEffect } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  XCircle, 
  Play, 
  User, 
  Brain,
  FileText,
  Wrench,
  ArrowRight,
  MoreVertical
} from 'lucide-react';
import { TaskFlowData } from './types';
import { formatDistanceToNow, format } from 'date-fns';

export interface TaskNodeProps {
  data: TaskFlowData;
  selected?: boolean;
  onStatusChange?: (status: TaskFlowData['status']) => void;
  onAgentAssign?: (agentType: 'manager' | 'worker') => void;
}

const TaskFlow = memo<NodeProps<TaskFlowData>>(({ data, selected }) => {
  const [showActions, setShowActions] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Trigger animation when status changes
  useEffect(() => {
    setIsAnimating(true);
    const timeout = setTimeout(() => setIsAnimating(false), 600);
    return () => clearTimeout(timeout);
  }, [data.status]);

  const getStatusIcon = () => {
    switch (data.status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-gray-500" />;
      case 'assigned':
        return <User className="w-4 h-4 text-blue-500" />;
      case 'in-progress':
        return <Play className="w-4 h-4 text-orange-500 animate-pulse" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (data.status) {
      case 'pending':
        return 'bg-gray-50 border-gray-300';
      case 'assigned':
        return 'bg-blue-50 border-blue-300';
      case 'in-progress':
        return 'bg-orange-50 border-orange-300';
      case 'completed':
        return 'bg-green-50 border-green-300';
      case 'failed':
        return 'bg-red-50 border-red-300';
      default:
        return 'bg-gray-50 border-gray-300';
    }
  };

  const getPriorityColor = () => {
    switch (data.priority) {
      case 'urgent':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getProgressColor = () => {
    if (data.progress >= 100) return 'bg-green-500';
    if (data.progress >= 75) return 'bg-blue-500';
    if (data.progress >= 50) return 'bg-orange-500';
    if (data.progress >= 25) return 'bg-yellow-500';
    return 'bg-gray-500';
  };

  const getDuration = () => {
    if (data.completedAt && data.startedAt) {
      return data.actualDuration || (data.completedAt.getTime() - data.startedAt.getTime());
    }
    if (data.startedAt) {
      return Date.now() - data.startedAt.getTime();
    }
    return data.estimatedDuration;
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return 'N/A';
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const handleAssignAgent = (agentType: 'manager' | 'worker') => {
    console.log('Assign to:', agentType);
    // TODO: Implement agent assignment
  };

  const handleStatusChange = (status: TaskFlowData['status']) => {
    console.log('Status change:', status);
    // TODO: Implement status change
  };

  return (
    <div
      className={`
        relative w-80 bg-white rounded-lg shadow-md border-2 transition-all duration-300
        ${selected ? 'ring-2 ring-blue-400 ring-opacity-75' : ''}
        ${getStatusColor()}
        ${isAnimating ? 'scale-105' : ''}
        hover:shadow-lg cursor-pointer
      `}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Connection Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-purple-500 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-purple-500 !border-2 !border-white"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-orange-500 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-orange-500 !border-2 !border-white"
      />

      {/* Priority Indicator */}
      <div className={`absolute -top-2 -left-2 w-4 h-4 rounded-full ${getPriorityColor()}`}></div>

      {/* Quick Actions */}
      {showActions && data.status === 'pending' && (
        <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => handleAssignAgent('manager')}
            className="p-1 bg-purple-500 text-white rounded-full hover:bg-purple-600 transition-colors"
            title="Assign to Manager"
          >
            <Brain className="w-3 h-3" />
          </button>
          <button
            onClick={() => handleAssignAgent('worker')}
            className="p-1 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
            title="Assign to Worker"
          >
            <User className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="p-4 pb-2">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-800 truncate">
              {data.title}
            </h3>
            {data.description && (
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                {data.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 ml-2">
            {getStatusIcon()}
            <span className="text-xs font-medium text-gray-600 capitalize">
              {data.status.replace('-', ' ')}
            </span>
          </div>
        </div>
      </div>

      {/* Assigned Agent */}
      {data.assignedAgent && (
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 text-sm">
            {data.assignedAgent === 'manager' ? (
              <Brain className="w-4 h-4 text-purple-600" />
            ) : (
              <User className="w-4 h-4 text-blue-600" />
            )}
            <span className="text-gray-600">Assigned to {data.assignedAgent}</span>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-600">Progress</span>
          <span className="text-xs font-medium text-gray-800">{data.progress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${getProgressColor()}`}
            style={{ width: `${data.progress}%` }}
          ></div>
        </div>
      </div>

      {/* Metadata */}
      {data.metadata && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-3 text-xs text-gray-600">
            {data.metadata.files && data.metadata.files.length > 0 && (
              <div className="flex items-center gap-1">
                <FileText className="w-3 h-3" />
                <span>{data.metadata.files.length} files</span>
              </div>
            )}
            {data.metadata.tools && data.metadata.tools.length > 0 && (
              <div className="flex items-center gap-1">
                <Wrench className="w-3 h-3" />
                <span>{data.metadata.tools.length} tools</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Timing Information */}
      <div className="px-4 pb-3 border-t border-gray-100 pt-2">
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
          <div>
            <p className="font-medium">Created:</p>
            <p>{format(data.createdAt, 'MMM d, HH:mm')}</p>
          </div>
          <div>
            <p className="font-medium">Duration:</p>
            <p>{formatDuration(getDuration())}</p>
          </div>
          {data.startedAt && (
            <div>
              <p className="font-medium">Started:</p>
              <p>{formatDistanceToNow(data.startedAt, { addSuffix: true })}</p>
            </div>
          )}
          {data.completedAt && (
            <div>
              <p className="font-medium">Completed:</p>
              <p>{formatDistanceToNow(data.completedAt, { addSuffix: true })}</p>
            </div>
          )}
        </div>
      </div>

      {/* Status-specific animations */}
      {data.status === 'in-progress' && (
        <div className="absolute inset-0 rounded-lg border-2 border-orange-400 animate-pulse opacity-30"></div>
      )}
      {data.status === 'completed' && (
        <div className="absolute top-2 right-2">
          <CheckCircle className="w-6 h-6 text-green-500 animate-bounce" />
        </div>
      )}
    </div>
  );
});

TaskFlow.displayName = 'TaskFlow';

export { TaskFlow };