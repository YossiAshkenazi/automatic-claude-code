import React, { useState, useCallback } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { 
  Plus, 
  Filter,
  BarChart3,
  Users,
  Clock,
  CheckCircle,
  Settings,
  Layout,
  Kanban,
  List
} from 'lucide-react';
import { Task } from '../../types';
import { useTaskManager } from '../../hooks/useTaskManager';
import { TaskCreator } from './TaskCreator';
import { TaskQueue } from './TaskQueue';
import { TaskAssignment } from './TaskAssignment';
import { TaskProgress } from './TaskProgress';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { cn } from '../../lib/utils';

interface TaskManagementProps {
  className?: string;
  activeSessions?: Array<{
    id: string;
    agentType: 'manager' | 'worker';
    status: 'running' | 'paused' | 'completed';
    taskCount: number;
  }>;
  onCreateSession?: (agentType: 'manager' | 'worker', taskIds: string[]) => void;
}

type ViewMode = 'overview' | 'queue' | 'assignment' | 'progress' | 'analytics';

const viewConfig = {
  overview: { icon: Layout, label: 'Overview' },
  queue: { icon: List, label: 'Task Queue' },
  assignment: { icon: Users, label: 'Assignment' },
  progress: { icon: BarChart3, label: 'Progress' },
  analytics: { icon: BarChart3, label: 'Analytics' }
};

export function TaskManagement({ 
  className, 
  activeSessions = [],
  onCreateSession 
}: TaskManagementProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [showTaskCreator, setShowTaskCreator] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  // Task management hook with real-time updates
  const {
    tasks,
    loading,
    error,
    selectedTask,
    filter,
    metrics,
    tasksByStatus,
    tasksByPriority,
    tasksByAgent,
    createTask,
    updateTask,
    deleteTask,
    assignTask,
    updateTaskProgress,
    duplicateTask,
    bulkUpdateTasks,
    selectTask,
    applyFilter,
    refresh,
    isConnected
  } = useTaskManager({
    autoRefresh: true,
    refreshInterval: 10000,
    enableRealtimeUpdates: true
  });

  const handleCreateTask = useCallback(async (taskData: Partial<Task>) => {
    return await createTask(taskData);
  }, [createTask]);

  const handleUpdateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
    return await updateTask(taskId, updates);
  }, [updateTask]);

  const handleDeleteTask = useCallback(async (taskId: string) => {
    return await deleteTask(taskId);
  }, [deleteTask]);

  const handleDuplicateTask = useCallback(async (taskId: string) => {
    return await duplicateTask(taskId);
  }, [duplicateTask]);

  const handleAssignTask = useCallback(async (taskId: string, agentType: Task['assignedAgent']) => {
    return await assignTask(taskId, agentType);
  }, [assignTask]);

  const handleTaskProgressUpdate = useCallback(async (taskId: string, progress: number, status?: Task['status']) => {
    return await updateTaskProgress(taskId, progress, status);
  }, [updateTaskProgress]);

  // Calculate overview metrics
  const overviewStats = {
    total: tasks.length,
    pending: tasksByStatus.pending || 0,
    in_progress: tasksByStatus.in_progress || 0,
    completed: tasksByStatus.completed || 0,
    failed: tasksByStatus.failed || 0,
    manager_assigned: tasksByAgent.manager || 0,
    worker_assigned: tasksByAgent.worker || 0,
    unassigned: tasksByAgent.unassigned || 0,
    high_priority: tasksByPriority.high || 0,
    urgent_priority: tasksByPriority.urgent || 0
  };

  const completionRate = overviewStats.total > 0 
    ? Math.round((overviewStats.completed / overviewStats.total) * 100) 
    : 0;

  const assignmentRate = overviewStats.total > 0 
    ? Math.round(((overviewStats.manager_assigned + overviewStats.worker_assigned) / overviewStats.total) * 100)
    : 0;

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-600 mb-2">
            <Settings size={48} className="mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Task Management Error</h3>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <Button onClick={refresh} variant="outline">
            <Settings size={16} />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className={cn('space-y-6', className)}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Kanban size={24} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Task Management</h1>
              <p className="text-sm text-gray-600">
                Create, assign, and monitor tasks across agents
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Connection Status */}
            <div className={cn(
              'flex items-center gap-2 px-3 py-1 rounded-full text-sm',
              isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            )}>
              <div className={cn(
                'w-2 h-2 rounded-full',
                isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              )} />
              {isConnected ? 'Real-time' : 'Disconnected'}
            </div>
            
            {/* Create Task Button */}
            <Button onClick={() => setShowTaskCreator(true)}>
              <Plus size={16} />
              Create Task
            </Button>
          </div>
        </div>

        {/* View Navigation */}
        <div className="flex items-center gap-1 border-b border-gray-200 pb-4">
          {Object.entries(viewConfig).map(([view, config]) => {
            const Icon = config.icon;
            const isActive = viewMode === view;
            
            return (
              <button
                key={view}
                onClick={() => setViewMode(view as ViewMode)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                <Icon size={16} />
                {config.label}
              </button>
            );
          })}
        </div>

        {/* Overview Dashboard */}
        {viewMode === 'overview' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Layout size={20} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{overviewStats.total}</div>
                    <div className="text-sm text-gray-600">Total Tasks</div>
                  </div>
                </div>
              </Card>
              
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle size={20} className="text-green-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-900">{completionRate}%</div>
                    <div className="text-sm text-gray-600">Completion Rate</div>
                    <div className="text-xs text-gray-500">
                      {overviewStats.completed} of {overviewStats.total}
                    </div>
                  </div>
                </div>
              </Card>
              
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-900">{assignmentRate}%</div>
                    <div className="text-sm text-gray-600">Assigned</div>
                    <div className="text-xs text-gray-500">
                      {overviewStats.manager_assigned + overviewStats.worker_assigned} of {overviewStats.total}
                    </div>
                  </div>
                </div>
              </Card>
              
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Clock size={20} className="text-orange-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-orange-900">{overviewStats.in_progress}</div>
                    <div className="text-sm text-gray-600">In Progress</div>
                    <div className="text-xs text-gray-500">
                      Active tasks
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Recent Tasks & Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Tasks */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Tasks</h3>
                <TaskQueue
                  tasks={tasks.slice(0, 5)}
                  loading={loading}
                  onSelectTask={selectTask}
                  onUpdateTask={handleUpdateTask}
                  onDeleteTask={handleDeleteTask}
                  onDuplicateTask={handleDuplicateTask}
                  onAssignTask={handleAssignTask}
                  selectedTask={selectedTask}
                  compact={true}
                  showCreateButton={false}
                  enableDragDrop={false}
                />
              </Card>

              {/* Quick Assignment */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Assignment</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <div className="text-lg font-bold text-blue-900">{overviewStats.manager_assigned}</div>
                      <div className="text-xs text-blue-600">Manager</div>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg">
                      <div className="text-lg font-bold text-green-900">{overviewStats.worker_assigned}</div>
                      <div className="text-xs text-green-600">Worker</div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-lg font-bold text-gray-900">{overviewStats.unassigned}</div>
                      <div className="text-xs text-gray-600">Unassigned</div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => setViewMode('assignment')}
                    >
                      <Users size={16} />
                      Manage Assignments
                    </Button>
                    {overviewStats.unassigned > 0 && onCreateSession && (
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => {
                          const unassignedTasks = tasks.filter(t => !t.assignedAgent);
                          if (unassignedTasks.length > 0) {
                            // Auto-assign and create session
                            const half = Math.ceil(unassignedTasks.length / 2);
                            unassignedTasks.slice(0, half).forEach(t => handleAssignTask(t.id, 'manager'));
                            unassignedTasks.slice(half).forEach(t => handleAssignTask(t.id, 'worker'));
                          }
                        }}
                      >
                        <Settings size={16} />
                        Auto-Assign All
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Task Queue View */}
        {viewMode === 'queue' && (
          <TaskQueue
            tasks={tasks}
            loading={loading}
            onCreateTask={() => setShowTaskCreator(true)}
            onSelectTask={selectTask}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
            onDuplicateTask={handleDuplicateTask}
            onAssignTask={handleAssignTask}
            onFilterChange={applyFilter}
            selectedTask={selectedTask}
            filter={filter}
            showCreateButton={true}
            enableDragDrop={true}
          />
        )}

        {/* Task Assignment View */}
        {viewMode === 'assignment' && (
          <TaskAssignment
            tasks={tasks}
            onAssignTask={handleAssignTask}
            onCreateSession={onCreateSession}
            activeSessions={activeSessions}
          />
        )}

        {/* Progress View */}
        {viewMode === 'progress' && (
          <div className="space-y-6">
            {selectedTask ? (
              <TaskProgress
                task={selectedTask}
                onUpdateProgress={handleTaskProgressUpdate}
                onUpdateStatus={(taskId, status) => handleUpdateTask(taskId, { status })}
                realTimeUpdates={isConnected}
                showDetailedMetrics={true}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tasks.filter(t => t.status === 'in_progress' || t.status === 'assigned').map((task) => (
                  <TaskProgress
                    key={task.id}
                    task={task}
                    onUpdateProgress={handleTaskProgressUpdate}
                    onUpdateStatus={(taskId, status) => handleUpdateTask(taskId, { status })}
                    realTimeUpdates={isConnected}
                    showDetailedMetrics={false}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Analytics View */}
        {viewMode === 'analytics' && (
          <div className="space-y-6">
            <div className="text-center py-12">
              <BarChart3 size={48} className="mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Analytics Dashboard</h3>
              <p className="text-gray-600">
                Advanced analytics and reporting features coming soon
              </p>
            </div>
          </div>
        )}

        {/* Task Creator Modal */}
        <TaskCreator
          isOpen={showTaskCreator}
          onClose={() => setShowTaskCreator(false)}
          onCreateTask={handleCreateTask}
          templates={[]} // TODO: Load from templates API
        />
      </div>
    </DndProvider>
  );
}

export default TaskManagement;