import React from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { Clock, User, Tag, AlertCircle, CheckCircle, Pause, Play, Trash2, Copy, ExternalLink } from 'lucide-react';
import { Task } from '../../types';
import { formatDate } from '../../utils/formatters';
import { cn } from '../../lib/utils';

interface TaskCardProps {
  task: Task;
  onSelect?: (task: Task) => void;
  onUpdate?: (taskId: string, updates: Partial<Task>) => void;
  onDelete?: (taskId: string) => void;
  onDuplicate?: (taskId: string) => void;
  onAssign?: (taskId: string, agentType: Task['assignedAgent']) => void;
  selectedTask?: Task | null;
  compact?: boolean;
  showActions?: boolean;
  enableDragDrop?: boolean;
}

const ItemTypes = {
  TASK: 'task'
};

const statusConfig = {
  pending: { color: 'bg-gray-100 text-gray-700', icon: Clock, label: 'Pending' },
  assigned: { color: 'bg-blue-100 text-blue-700', icon: User, label: 'Assigned' },
  in_progress: { color: 'bg-yellow-100 text-yellow-700', icon: Play, label: 'In Progress' },
  completed: { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Completed' },
  failed: { color: 'bg-red-100 text-red-700', icon: AlertCircle, label: 'Failed' },
  cancelled: { color: 'bg-gray-100 text-gray-500', icon: Pause, label: 'Cancelled' }
};

const priorityConfig = {
  low: { color: 'bg-green-50 border-green-200 text-green-700', weight: 1 },
  medium: { color: 'bg-yellow-50 border-yellow-200 text-yellow-700', weight: 2 },
  high: { color: 'bg-orange-50 border-orange-200 text-orange-700', weight: 3 },
  urgent: { color: 'bg-red-50 border-red-200 text-red-700', weight: 4 }
};

export function TaskCard({
  task,
  onSelect,
  onUpdate,
  onDelete,
  onDuplicate,
  onAssign,
  selectedTask,
  compact = false,
  showActions = true,
  enableDragDrop = true
}: TaskCardProps) {
  const isSelected = selectedTask?.id === task.id;
  const StatusIcon = statusConfig[task.status]?.icon || Clock;
  
  // Drag and drop setup
  const [{ isDragging }, drag] = useDrag({
    type: ItemTypes.TASK,
    item: () => ({ task }),
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    }),
    canDrag: enableDragDrop
  });

  const [{ isOver, canDrop }, drop] = useDrop({
    accept: ItemTypes.TASK,
    drop: (item: { task: Task }) => {
      // Handle task reordering or reassignment
      if (item.task.id !== task.id) {
        // This would trigger a reorder or reassignment
        console.log('Task dropped:', item.task, 'onto:', task);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop()
    })
  });

  const handleClick = () => {
    onSelect?.(task);
  };

  const handleStatusToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    let newStatus: Task['status'];
    
    switch (task.status) {
      case 'pending':
        newStatus = 'in_progress';
        break;
      case 'in_progress':
        newStatus = 'completed';
        break;
      case 'completed':
        newStatus = 'pending';
        break;
      default:
        newStatus = 'in_progress';
    }
    
    onUpdate?.(task.id, { status: newStatus });
  };

  const handleAssignmentChange = (e: React.MouseEvent, agentType: Task['assignedAgent']) => {
    e.stopPropagation();
    onAssign?.(task.id, agentType);
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDuplicate?.(task.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${task.title}"?`)) {
      onDelete?.(task.id);
    }
  };

  const progressPercentage = Math.round(task.progress);
  const isOverdue = task.estimatedDuration && 
    task.status === 'in_progress' && 
    task.actualDuration && 
    task.actualDuration > task.estimatedDuration;

  const cardRef = enableDragDrop ? (node: HTMLDivElement) => drag(drop(node)) : undefined;

  return (
    <div
      ref={cardRef}
      onClick={handleClick}
      className={cn(
        'bg-white rounded-lg border cursor-pointer transition-all duration-200',
        'hover:shadow-md hover:border-blue-300',
        isSelected && 'ring-2 ring-blue-500 border-blue-500',
        isDragging && 'opacity-50 transform rotate-1',
        isOver && canDrop && 'ring-2 ring-green-400 border-green-400',
        priorityConfig[task.priority]?.color,
        compact ? 'p-3' : 'p-4'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h3 className={cn(
            'font-medium text-gray-900 line-clamp-2',
            compact ? 'text-sm' : 'text-base'
          )}>
            {task.title}
          </h3>
          {!compact && (
            <p className="text-sm text-gray-600 mt-1 line-clamp-3">
              {task.description}
            </p>
          )}
        </div>
        
        {/* Status Badge */}
        <div className={cn(
          'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
          statusConfig[task.status]?.color
        )}>
          <StatusIcon size={12} />
          {statusConfig[task.status]?.label}
        </div>
      </div>

      {/* Progress Bar */}
      {task.progress > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
            <span>Progress</span>
            <span>{progressPercentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                task.status === 'completed' ? 'bg-green-500' :
                task.status === 'failed' ? 'bg-red-500' :
                isOverdue ? 'bg-orange-500' : 'bg-blue-500'
              )}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className={cn(
        'flex items-center justify-between',
        compact ? 'text-xs' : 'text-sm'
      )}>
        <div className="flex items-center gap-3 text-gray-500">
          {/* Priority Indicator */}
          <div className={cn(
            'px-2 py-1 rounded text-xs font-medium',
            priorityConfig[task.priority]?.color
          )}>
            {task.priority.toUpperCase()}
          </div>

          {/* Agent Assignment */}
          {task.assignedAgent && (
            <div className="flex items-center gap-1">
              <User size={12} />
              <span className="capitalize">{task.assignedAgent}</span>
            </div>
          )}

          {/* Tags */}
          {task.tags.length > 0 && (
            <div className="flex items-center gap-1">
              <Tag size={12} />
              <span>{task.tags.slice(0, 2).join(', ')}</span>
              {task.tags.length > 2 && (
                <span className="text-gray-400">+{task.tags.length - 2}</span>
              )}
            </div>
          )}

          {/* Duration */}
          {task.estimatedDuration && (
            <div className="flex items-center gap-1">
              <Clock size={12} />
              <span>
                {task.estimatedDuration}m
                {task.actualDuration && ` (${task.actualDuration}m)`}
              </span>
            </div>
          )}
        </div>

        {/* Created Date */}
        <span className="text-gray-400 text-xs">
          {formatDate(task.createdAt)}
        </span>
      </div>

      {/* Actions */}
      {showActions && !compact && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
          {/* Assignment Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => handleAssignmentChange(e, 'manager')}
              className={cn(
                'px-2 py-1 text-xs rounded transition-colors',
                task.assignedAgent === 'manager'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-blue-50'
              )}
            >
              Manager
            </button>
            <button
              onClick={(e) => handleAssignmentChange(e, 'worker')}
              className={cn(
                'px-2 py-1 text-xs rounded transition-colors',
                task.assignedAgent === 'worker'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-green-50'
              )}
            >
              Worker
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleStatusToggle}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title="Toggle status"
            >
              {task.status === 'completed' ? (
                <Pause size={14} className="text-gray-600" />
              ) : (
                <Play size={14} className="text-green-600" />
              )}
            </button>
            
            <button
              onClick={handleDuplicate}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title="Duplicate task"
            >
              <Copy size={14} className="text-gray-600" />
            </button>

            {task.sessionId && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // Navigate to session view
                  window.open(`/session/${task.sessionId}`, '_blank');
                }}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="View session"
              >
                <ExternalLink size={14} className="text-blue-600" />
              </button>
            )}
            
            <button
              onClick={handleDelete}
              className="p-1 hover:bg-red-50 rounded transition-colors"
              title="Delete task"
            >
              <Trash2 size={14} className="text-red-600" />
            </button>
          </div>
        </div>
      )}

      {/* Compact Actions */}
      {showActions && compact && (
        <div className="flex items-center justify-end gap-1 mt-2">
          <button
            onClick={handleStatusToggle}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <Play size={12} className="text-green-600" />
          </button>
          <button
            onClick={handleDuplicate}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <Copy size={12} className="text-gray-600" />
          </button>
          <button
            onClick={handleDelete}
            className="p-1 hover:bg-red-50 rounded"
          >
            <Trash2 size={12} className="text-red-600" />
          </button>
        </div>
      )}
    </div>
  );
}