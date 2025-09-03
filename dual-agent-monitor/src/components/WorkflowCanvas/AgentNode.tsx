import React, { memo, useState, useEffect } from 'react';
import { Handle, Position, NodeProps, useNodeId } from 'reactflow';
import { 
  User, 
  Brain, 
  Activity, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  WifiOff,
  MoreVertical,
  Play,
  Pause,
  Square
} from 'lucide-react';
import { AgentNodeData } from './types';
import { formatDistanceToNow } from 'date-fns';

export interface AgentNodeProps {
  data: AgentNodeData;
  selected?: boolean;
  onTaskAssign?: (taskId: string) => void;
}

const AgentNode = memo<NodeProps<AgentNodeData>>(({ data, selected }) => {
  const nodeId = useNodeId();
  const [showControls, setShowControls] = useState(false);
  const [pulseAnimation, setPulseAnimation] = useState(false);

  // Trigger pulse animation when status changes
  useEffect(() => {
    setPulseAnimation(true);
    const timeout = setTimeout(() => setPulseAnimation(false), 1000);
    return () => clearTimeout(timeout);
  }, [data.status]);

  const getStatusIcon = () => {
    switch (data.status) {
      case 'idle':
        return <Clock className="w-4 h-4 text-gray-500" />;
      case 'busy':
        return <Activity className="w-4 h-4 text-blue-500 animate-pulse" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'offline':
        return <WifiOff className="w-4 h-4 text-gray-400" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (data.status) {
      case 'idle':
        return 'bg-gray-100 border-gray-300';
      case 'busy':
        return 'bg-blue-50 border-blue-300';
      case 'error':
        return 'bg-red-50 border-red-300';
      case 'offline':
        return 'bg-gray-50 border-gray-200';
      default:
        return 'bg-gray-100 border-gray-300';
    }
  };

  const getAgentIcon = () => {
    return data.agentType === 'manager' ? (
      <Brain className="w-6 h-6 text-purple-600" />
    ) : (
      <User className="w-6 h-6 text-blue-600" />
    );
  };

  const getPerformanceColor = (rate: number) => {
    if (rate >= 0.8) return 'text-green-600';
    if (rate >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const handleControlAction = (action: 'start' | 'pause' | 'stop') => {
    console.log(`Agent ${data.agentId} action:`, action);
    // TODO: Implement agent control actions via WebSocket
  };

  return (
    <div
      className={`
        relative w-64 bg-white rounded-xl shadow-lg border-2 transition-all duration-300
        ${selected ? 'ring-2 ring-blue-400 ring-opacity-75' : ''}
        ${getStatusColor()}
        ${pulseAnimation ? 'animate-pulse' : ''}
        hover:shadow-xl hover:scale-105
      `}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Connection Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-blue-500 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-blue-500 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-green-500 !border-2 !border-white"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-green-500 !border-2 !border-white"
      />

      {/* Control Buttons */}
      {showControls && (
        <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => handleControlAction('start')}
            className="p-1 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors"
            title="Start Agent"
          >
            <Play className="w-3 h-3" />
          </button>
          <button
            onClick={() => handleControlAction('pause')}
            className="p-1 bg-yellow-500 text-white rounded-full hover:bg-yellow-600 transition-colors"
            title="Pause Agent"
          >
            <Pause className="w-3 h-3" />
          </button>
          <button
            onClick={() => handleControlAction('stop')}
            className="p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
            title="Stop Agent"
          >
            <Square className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="p-4 pb-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {getAgentIcon()}
            <div>
              <h3 className="font-semibold text-gray-800">
                {data.name}
              </h3>
              <p className="text-xs text-gray-500 capitalize">
                {data.agentType} Agent
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className="text-xs font-medium text-gray-600 capitalize">
              {data.status}
            </span>
          </div>
        </div>
      </div>

      {/* Current Task */}
      {data.currentTask && (
        <div className="px-4 pb-2">
          <div className="bg-blue-50 rounded-lg p-2">
            <p className="text-xs text-gray-600 mb-1">Current Task:</p>
            <p className="text-sm font-medium text-blue-800 truncate">
              {data.currentTask}
            </p>
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className="px-4 pb-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1">
            <Activity className="w-3 h-3 text-gray-400" />
            <span className="text-gray-600">{data.messageCount} msgs</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-green-500" />
            <span className="text-gray-600">{data.performance.tasksCompleted} done</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-gray-400" />
            <span className="text-gray-600">
              {data.performance.averageResponseTime}ms avg
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium">
              Success: <span className={getPerformanceColor(data.performance.successRate)}>
                {Math.round(data.performance.successRate * 100)}%
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Last Activity */}
      {data.lastActivity && (
        <div className="px-4 pb-3 border-t border-gray-100 pt-2">
          <p className="text-xs text-gray-500">
            Last active {formatDistanceToNow(data.lastActivity, { addSuffix: true })}
          </p>
        </div>
      )}

      {/* Performance Indicator */}
      <div className="px-4 pb-3">
        <div className="w-full bg-gray-200 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all duration-500 ${
              data.performance.successRate >= 0.8
                ? 'bg-green-500'
                : data.performance.successRate >= 0.6
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${data.performance.successRate * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Status Pulse Effect */}
      {data.status === 'busy' && (
        <div className="absolute inset-0 rounded-xl border-2 border-blue-400 animate-ping opacity-20"></div>
      )}
    </div>
  );
});

AgentNode.displayName = 'AgentNode';

export { AgentNode };