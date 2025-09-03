import React, { memo } from 'react';
import { getBezierPath, EdgeProps, EdgeLabelRenderer } from 'reactflow';
import { MessageSquare, ArrowRight, Zap, CheckCircle, XCircle } from 'lucide-react';

interface ConnectionLineProps extends EdgeProps {
  data?: {
    taskId?: string;
    messageId?: string;
    progress?: number;
    status?: 'pending' | 'in-progress' | 'completed' | 'failed';
    animated?: boolean;
    color?: string;
    messageType?: 'prompt' | 'response' | 'tool_call' | 'tool_result' | 'system';
    timestamp?: Date;
  };
}

const ConnectionLine = memo<ConnectionLineProps>(({ 
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const getEdgeColor = () => {
    if (data?.color) return data.color;
    
    switch (data?.status) {
      case 'completed':
        return '#10b981'; // green-500
      case 'failed':
        return '#ef4444'; // red-500
      case 'in-progress':
        return '#f59e0b'; // amber-500
      case 'pending':
        return '#6b7280'; // gray-500
      default:
        return data?.messageType ? '#3b82f6' : '#8b5cf6'; // blue-500 for messages, purple-500 for tasks
    }
  };

  const getEdgeWidth = () => {
    if (selected) return 3;
    if (data?.status === 'in-progress') return 2.5;
    return 2;
  };

  const getAnimationClass = () => {
    if (data?.animated || data?.status === 'in-progress') {
      return 'animate-pulse';
    }
    return '';
  };

  const getLabelIcon = () => {
    if (data?.messageType) {
      switch (data.messageType) {
        case 'prompt':
          return <MessageSquare className="w-3 h-3 text-blue-600" />;
        case 'response':
          return <ArrowRight className="w-3 h-3 text-green-600" />;
        case 'tool_call':
          return <Zap className="w-3 h-3 text-orange-600" />;
        case 'tool_result':
          return <CheckCircle className="w-3 h-3 text-green-600" />;
        case 'system':
          return <XCircle className="w-3 h-3 text-gray-600" />;
        default:
          return <MessageSquare className="w-3 h-3 text-blue-600" />;
      }
    }
    
    switch (data?.status) {
      case 'completed':
        return <CheckCircle className="w-3 h-3 text-green-600" />;
      case 'failed':
        return <XCircle className="w-3 h-3 text-red-600" />;
      case 'in-progress':
        return <Zap className="w-3 h-3 text-orange-600 animate-pulse" />;
      default:
        return <ArrowRight className="w-3 h-3 text-gray-600" />;
    }
  };

  const getProgressDashArray = () => {
    if (data?.progress !== undefined) {
      const totalLength = 100; // Approximate path length
      const progressLength = (data.progress / 100) * totalLength;
      return `${progressLength} ${totalLength - progressLength}`;
    }
    return undefined;
  };

  return (
    <>
      {/* Main edge path */}
      <path
        id={id}
        className={`react-flow__edge-path ${getAnimationClass()}`}
        d={edgePath}
        stroke={getEdgeColor()}
        strokeWidth={getEdgeWidth()}
        strokeDasharray={data?.status === 'pending' ? '5,5' : getProgressDashArray()}
        fill="none"
      />
      
      {/* Progress overlay for in-progress tasks */}
      {data?.progress !== undefined && data.progress < 100 && (
        <path
          d={edgePath}
          stroke={getEdgeColor()}
          strokeWidth={getEdgeWidth() + 1}
          strokeDasharray={getProgressDashArray()}
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
          className="animate-pulse"
        />
      )}
      
      {/* Glow effect for active connections */}
      {(data?.status === 'in-progress' || data?.animated) && (
        <path
          d={edgePath}
          stroke={getEdgeColor()}
          strokeWidth={getEdgeWidth() + 4}
          fill="none"
          opacity="0.2"
          className="animate-pulse"
        />
      )}
      
      {/* Edge label */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className={`
            flex items-center gap-1 px-2 py-1 bg-white border rounded-full shadow-sm text-xs
            transition-all duration-200
            ${selected ? 'bg-blue-50 border-blue-300' : 'border-gray-300'}
            hover:shadow-md hover:scale-105
          `}
        >
          {getLabelIcon()}
          
          {/* Label text */}
          {data?.messageType && (
            <span className="font-medium text-gray-700 capitalize">
              {data.messageType.replace('_', ' ')}
            </span>
          )}
          
          {data?.taskId && (
            <span className="font-medium text-gray-700">
              Task {data.taskId.slice(-4)}
            </span>
          )}
          
          {/* Progress percentage */}
          {data?.progress !== undefined && data.progress < 100 && (
            <span className="text-xs text-gray-500">
              {data.progress}%
            </span>
          )}
          
          {/* Timestamp for messages */}
          {data?.timestamp && (
            <span className="text-xs text-gray-400">
              {new Date(data.timestamp).toLocaleTimeString('en-US', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </span>
          )}
        </div>
      </EdgeLabelRenderer>
      
      {/* Flow direction indicators */}
      <defs>
        <marker
          id={`arrowhead-${id}`}
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon
            points="0 0, 10 3.5, 0 7"
            fill={getEdgeColor()}
          />
        </marker>
      </defs>
      
      {/* Arrow marker */}
      <path
        d={edgePath}
        stroke="transparent"
        strokeWidth={getEdgeWidth()}
        fill="none"
        markerEnd={`url(#arrowhead-${id})`}
      />
    </>
  );
});

ConnectionLine.displayName = 'ConnectionLine';

export { ConnectionLine };