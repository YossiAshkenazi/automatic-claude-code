import React, { useState } from 'react';
import { 
  Activity, 
  Brain, 
  Clock, 
  Cpu, 
  MemoryStick, 
  MoreVertical, 
  Play, 
  Pause, 
  Square, 
  RotateCw, 
  Settings, 
  Trash2,
  Zap,
  MessageSquare,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { StatusIndicator, AgentHealthScore, AgentConnectionStatus } from './StatusIndicator';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/utils';
import type { Agent, AgentCommand } from '../../types/agent';

interface AgentCardProps {
  agent: Agent;
  isSelected?: boolean;
  isCompact?: boolean;
  onSelect?: (agent: Agent) => void;
  onCommand?: (agentId: string, command: AgentCommand) => void;
  onEdit?: (agent: Agent) => void;
  onDelete?: (agentId: string) => void;
  className?: string;
}

export function AgentCard({
  agent,
  isSelected = false,
  isCompact = false,
  onSelect,
  onCommand,
  onEdit,
  onDelete,
  className
}: AgentCardProps) {
  const [showActions, setShowActions] = useState(false);

  const handleCommand = (command: AgentCommand['type']) => {
    onCommand?.(agent.id, { type: command });
  };

  const getModelDisplay = (role: Agent['role']) => {
    switch (role) {
      case 'claude-opus': return 'Opus';
      case 'claude-sonnet': return 'Sonnet';
      case 'claude-haiku': return 'Haiku';
      default: return role;
    }
  };

  const getTypeColor = (type: Agent['type']) => {
    switch (type) {
      case 'manager': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'worker': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'specialist': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatUptime = (uptime: number) => {
    const hours = Math.floor(uptime / (1000 * 60 * 60));
    const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 3
    }).format(amount);
  };

  if (isCompact) {
    return (
      <div
        className={cn(
          'flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all hover:shadow-sm',
          isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300',
          className
        )}
        onClick={() => onSelect?.(agent)}
      >
        <div className="flex items-center gap-3">
          <StatusIndicator 
            status={agent.status} 
            size="sm" 
            showPulse={agent.status === 'working'} 
          />
          <div>
            <div className="font-medium text-sm">{agent.name}</div>
            <div className="text-xs text-gray-500">
              {getModelDisplay(agent.role)} • {agent.type}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <AgentHealthScore score={agent.metrics.healthScore} size="sm" />
          {agent.currentTask && (
            <Badge variant="secondary" className="text-xs">
              Task: {agent.currentTask.slice(0, 20)}...
            </Badge>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card
      className={cn(
        'p-4 cursor-pointer transition-all hover:shadow-md',
        isSelected ? 'ring-2 ring-blue-500 border-blue-200' : 'hover:border-gray-300',
        className
      )}
      onClick={() => onSelect?.(agent)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <StatusIndicator 
            status={agent.status} 
            size="lg" 
            showPulse={agent.status === 'working' || agent.status === 'starting'} 
          />
          <div>
            <h3 className="font-semibold text-lg">{agent.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={getTypeColor(agent.type)}>
                {agent.type}
              </Badge>
              <span className="text-sm text-gray-500">
                {getModelDisplay(agent.role)}
              </span>
            </div>
          </div>
        </div>

        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setShowActions(!showActions);
            }}
          >
            <MoreVertical className="w-4 h-4" />
          </Button>
          
          {showActions && (
            <div className="absolute right-0 top-8 z-10 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[150px]">
              {agent.status === 'idle' && (
                <button
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCommand('start');
                    setShowActions(false);
                  }}
                >
                  <Play className="w-4 h-4" />
                  Start
                </button>
              )}
              
              {(agent.status === 'active' || agent.status === 'working') && (
                <>
                  <button
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCommand('pause');
                      setShowActions(false);
                    }}
                  >
                    <Pause className="w-4 h-4" />
                    Pause
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCommand('stop');
                      setShowActions(false);
                    }}
                  >
                    <Square className="w-4 h-4" />
                    Stop
                  </button>
                </>
              )}
              
              <button
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCommand('restart');
                  setShowActions(false);
                }}
              >
                <RotateCw className="w-4 h-4" />
                Restart
              </button>
              
              <div className="border-t border-gray-100 my-1" />
              
              <button
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.(agent);
                  setShowActions(false);
                }}
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
              
              <button
                className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.(agent.id);
                  setShowActions(false);
                }}
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Current Task */}
      {agent.currentTask && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Activity className="w-4 h-4 text-blue-600 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-blue-900">Current Task</div>
              <div className="text-sm text-blue-700 mt-1">{agent.currentTask}</div>
            </div>
          </div>
        </div>
      )}

      {/* Specialization */}
      {agent.configuration.specialization && (
        <div className="mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Brain className="w-4 h-4" />
            <span>Specialization: {agent.configuration.specialization}</span>
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="space-y-2">
          <AgentHealthScore score={agent.metrics.healthScore} className="justify-start" />
          
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-gray-500" />
            <span className="text-sm">
              {agent.metrics.completedTasks}/{agent.metrics.totalTasks} tasks
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-gray-500" />
            <span className="text-sm">
              {agent.metrics.averageResponseTime.toFixed(0)}ms avg
            </span>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="text-sm">
              Up {formatUptime(agent.metrics.uptime)}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-gray-500" />
            <span className="text-sm">
              {formatCurrency(agent.metrics.totalCost)}
            </span>
          </div>
          
          {agent.metrics.failedTasks > 0 && (
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-red-600">
                {agent.metrics.failedTasks} failed
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Resource Usage */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-2">
          <MemoryStick className="w-4 h-4 text-gray-500" />
          <div className="flex-1">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>Memory</span>
              <span>{agent.metrics.memoryUsage || 0}MB</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-blue-600 h-1.5 rounded-full"
                style={{
                  width: `${Math.min(
                    ((agent.metrics.memoryUsage || 0) / agent.configuration.resourceLimits.maxMemoryMB) * 100,
                    100
                  )}%`
                }}
              />
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-gray-500" />
          <div className="flex-1">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>CPU</span>
              <span>{agent.metrics.cpuUsage || 0}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-green-600 h-1.5 rounded-full"
                style={{
                  width: `${Math.min(agent.metrics.cpuUsage || 0, 100)}%`
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Connection Status */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <AgentConnectionStatus
          isConnected={agent.status !== 'offline'}
          lastActivity={agent.lastActivity}
        />
      </div>
    </Card>
  );
}