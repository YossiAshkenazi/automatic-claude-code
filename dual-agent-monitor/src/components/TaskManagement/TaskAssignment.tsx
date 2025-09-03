import React, { useState } from 'react';
import { useDrop } from 'react-dnd';
import { User, Users, Brain, Zap, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { Task } from '../../types';
import { TaskCard } from './TaskCard';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';

interface TaskAssignmentProps {
  tasks: Task[];
  onAssignTask: (taskId: string, agentType: Task['assignedAgent'], sessionId?: string) => void;
  onCreateSession?: (agentType: 'manager' | 'worker', taskIds: string[]) => void;
  activeSessions?: Array<{
    id: string;
    agentType: 'manager' | 'worker';
    status: 'running' | 'paused' | 'completed';
    taskCount: number;
  }>;
  className?: string;
}

const ItemTypes = {
  TASK: 'task'
};

const agentConfig = {
  manager: {
    icon: Brain,
    color: 'bg-blue-50 border-blue-200 text-blue-700',
    hoverColor: 'hover:bg-blue-100',
    activeColor: 'bg-blue-100 border-blue-300',
    description: 'Strategic planning, coordination, and high-level decisions'
  },
  worker: {
    icon: Zap,
    color: 'bg-green-50 border-green-200 text-green-700',
    hoverColor: 'hover:bg-green-100',
    activeColor: 'bg-green-100 border-green-300',
    description: 'Task execution, implementation, and detailed work'
  },
  unassigned: {
    icon: Users,
    color: 'bg-gray-50 border-gray-200 text-gray-700',
    hoverColor: 'hover:bg-gray-100',
    activeColor: 'bg-gray-100 border-gray-300',
    description: 'Available for assignment to any agent'
  }
};

interface DropZoneProps {
  agentType: 'manager' | 'worker' | 'unassigned';
  tasks: Task[];
  isActive: boolean;
  onDrop: (task: Task, agentType: Task['assignedAgent']) => void;
  onCreateSession?: (agentType: 'manager' | 'worker', taskIds: string[]) => void;
  activeSessions?: Array<{
    id: string;
    agentType: 'manager' | 'worker';
    status: 'running' | 'paused' | 'completed';
    taskCount: number;
  }>;
}

function DropZone({ 
  agentType, 
  tasks, 
  isActive, 
  onDrop, 
  onCreateSession,
  activeSessions = []
}: DropZoneProps) {
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: ItemTypes.TASK,
    drop: (item: { task: Task }) => {
      const targetAgent = agentType === 'unassigned' ? null : agentType;
      onDrop(item.task, targetAgent);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop()
    })
  });

  const config = agentConfig[agentType];
  const Icon = config.icon;
  
  // Filter active sessions for this agent type
  const agentSessions = activeSessions.filter(session => 
    session.agentType === agentType || agentType === 'unassigned'
  );

  // Calculate task statistics
  const taskStats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    failed: tasks.filter(t => t.status === 'failed').length
  };

  const canCreateSession = agentType !== 'unassigned' && 
    tasks.some(t => t.status === 'pending' || t.status === 'assigned');

  return (
    <div
      ref={drop}
      className={cn(
        'border-2 border-dashed rounded-lg p-6 transition-all duration-200',
        config.color,
        isOver && canDrop && config.activeColor,
        !isOver && config.hoverColor,
        'min-h-[400px]'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-white">
            <Icon size={24} />
          </div>
          <div>
            <h3 className="font-semibold text-lg capitalize">
              {agentType === 'unassigned' ? 'Unassigned' : `${agentType} Agent`}
            </h3>
            <p className="text-sm opacity-75">{config.description}</p>
          </div>
        </div>
        
        <Badge variant="secondary" className="text-lg font-semibold">
          {taskStats.total}
        </Badge>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Pending</span>
            <Badge variant="outline">{taskStats.pending}</Badge>
          </div>
        </div>
        <div className="bg-white rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">In Progress</span>
            <Badge variant="outline">{taskStats.inProgress}</Badge>
          </div>
        </div>
        <div className="bg-white rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Completed</span>
            <Badge variant="outline">{taskStats.completed}</Badge>
          </div>
        </div>
        <div className="bg-white rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Failed</span>
            <Badge variant="outline">{taskStats.failed}</Badge>
          </div>
        </div>
      </div>

      {/* Active Sessions */}
      {agentSessions.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium mb-3">Active Sessions</h4>
          <div className="space-y-2">
            {agentSessions.map((session) => (
              <div key={session.id} className="bg-white rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'w-2 h-2 rounded-full',
                      session.status === 'running' ? 'bg-green-500' :
                      session.status === 'paused' ? 'bg-yellow-500' : 'bg-gray-400'
                    )} />
                    <span className="text-sm font-medium">{session.id.slice(0, 8)}...</span>
                    <Badge variant="secondary" className="text-xs">
                      {session.taskCount} tasks
                    </Badge>
                  </div>
                  <span className="text-xs text-gray-500 capitalize">
                    {session.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Session Button */}
      {canCreateSession && onCreateSession && (
        <div className="mb-6">
          <Button
            onClick={() => {
              const eligibleTasks = tasks.filter(t => t.status === 'pending' || t.status === 'assigned');
              if (eligibleTasks.length > 0) {
                onCreateSession(agentType as 'manager' | 'worker', eligibleTasks.map(t => t.id));
              }
            }}
            variant="outline"
            className="w-full"
            disabled={!canCreateSession}
          >
            <Users size={16} />
            Create Session ({tasks.filter(t => t.status === 'pending' || t.status === 'assigned').length} tasks)
          </Button>
        </div>
      )}

      {/* Drop Zone Indication */}
      {isOver && canDrop && (
        <div className="mb-4 p-4 bg-white rounded-lg border-2 border-dashed border-blue-400 text-center">
          <div className="flex items-center justify-center gap-2 text-blue-600">
            <Icon size={20} />
            <span className="font-medium">
              Drop task to assign to {agentType === 'unassigned' ? 'unassigned' : `${agentType} agent`}
            </span>
          </div>
        </div>
      )}

      {/* Task List */}
      <div className="space-y-3">
        {tasks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Icon size={48} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">
              {agentType === 'unassigned' 
                ? 'No unassigned tasks'
                : `No tasks assigned to ${agentType} agent`
              }
            </p>
            <p className="text-xs mt-1 opacity-75">
              Drag tasks here to assign them
            </p>
          </div>
        ) : (
          <div className="max-h-[500px] overflow-y-auto space-y-3">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                compact={true}
                showActions={false}
                enableDragDrop={true}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function TaskAssignment({
  tasks,
  onAssignTask,
  onCreateSession,
  activeSessions = [],
  className
}: TaskAssignmentProps) {
  const [selectedAgent, setSelectedAgent] = useState<'all' | 'manager' | 'worker' | 'unassigned'>('all');

  // Group tasks by assignment
  const taskGroups = {
    manager: tasks.filter(task => task.assignedAgent === 'manager'),
    worker: tasks.filter(task => task.assignedAgent === 'worker'),
    unassigned: tasks.filter(task => !task.assignedAgent)
  };

  const handleDrop = (task: Task, agentType: Task['assignedAgent']) => {
    if (task.assignedAgent !== agentType) {
      onAssignTask(task.id, agentType);
    }
  };

  const totalTasks = tasks.length;
  const assignedTasks = taskGroups.manager.length + taskGroups.worker.length;
  const assignmentRate = totalTasks > 0 ? Math.round((assignedTasks / totalTasks) * 100) : 0;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Task Assignment</h2>
          <p className="text-sm text-gray-600 mt-1">
            Drag and drop tasks to assign them to agents
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Assignment Progress */}
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">{assignmentRate}%</div>
            <div className="text-xs text-gray-500">Tasks Assigned</div>
            <div className="text-xs text-gray-400">
              {assignedTasks} of {totalTasks} tasks
            </div>
          </div>
          
          {/* Filter Toggle */}
          <div className="flex items-center border border-gray-300 rounded-lg">
            {(['all', 'manager', 'worker', 'unassigned'] as const).map((agent) => (
              <button
                key={agent}
                onClick={() => setSelectedAgent(agent)}
                className={cn(
                  'px-3 py-2 text-sm transition-colors first:rounded-l-lg last:rounded-r-lg',
                  selectedAgent === agent
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50'
                )}
              >
                {agent === 'all' ? 'All' : agent.charAt(0).toUpperCase() + agent.slice(1)}
                {agent !== 'all' && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {agent === 'unassigned' ? taskGroups.unassigned.length : taskGroups[agent].length}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Assignment Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Brain size={24} className="text-blue-600" />
            <div>
              <div className="text-2xl font-bold text-blue-900">{taskGroups.manager.length}</div>
              <div className="text-sm text-blue-700">Manager Tasks</div>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Zap size={24} className="text-green-600" />
            <div>
              <div className="text-2xl font-bold text-green-900">{taskGroups.worker.length}</div>
              <div className="text-sm text-green-700">Worker Tasks</div>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Users size={24} className="text-gray-600" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{taskGroups.unassigned.length}</div>
              <div className="text-sm text-gray-700">Unassigned</div>
            </div>
          </div>
        </div>
      </div>

      {/* Drop Zones */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {(selectedAgent === 'all' || selectedAgent === 'manager') && (
          <DropZone
            agentType="manager"
            tasks={taskGroups.manager}
            isActive={selectedAgent === 'manager'}
            onDrop={handleDrop}
            onCreateSession={onCreateSession}
            activeSessions={activeSessions}
          />
        )}
        
        {(selectedAgent === 'all' || selectedAgent === 'worker') && (
          <DropZone
            agentType="worker"
            tasks={taskGroups.worker}
            isActive={selectedAgent === 'worker'}
            onDrop={handleDrop}
            onCreateSession={onCreateSession}
            activeSessions={activeSessions}
          />
        )}
        
        {(selectedAgent === 'all' || selectedAgent === 'unassigned') && (
          <DropZone
            agentType="unassigned"
            tasks={taskGroups.unassigned}
            isActive={selectedAgent === 'unassigned'}
            onDrop={handleDrop}
            activeSessions={activeSessions}
          />
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Quick Actions</h3>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const unassignedTasks = taskGroups.unassigned.slice(0, Math.ceil(taskGroups.unassigned.length / 2));
              unassignedTasks.forEach(task => onAssignTask(task.id, 'manager'));
            }}
            disabled={taskGroups.unassigned.length === 0}
          >
            <Brain size={14} />
            Assign Half to Manager
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const unassignedTasks = taskGroups.unassigned.slice(Math.ceil(taskGroups.unassigned.length / 2));
              unassignedTasks.forEach(task => onAssignTask(task.id, 'worker'));
            }}
            disabled={taskGroups.unassigned.length === 0}
          >
            <Zap size={14} />
            Assign Half to Worker
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              [...taskGroups.manager, ...taskGroups.worker].forEach(task => onAssignTask(task.id, null));
            }}
            disabled={assignedTasks === 0}
          >
            <Users size={14} />
            Unassign All
          </Button>
        </div>
      </div>
    </div>
  );
}