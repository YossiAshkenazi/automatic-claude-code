import React, { useState, useMemo } from 'react';
import { useDrop } from 'react-dnd';
import { 
  Filter, 
  Search, 
  SortAsc, 
  SortDesc, 
  Grid, 
  List, 
  Plus,
  Users,
  Clock,
  CheckCircle,
  AlertCircle,
  Pause
} from 'lucide-react';
import { Task, TaskFilter } from '../../types';
import { TaskCard } from './TaskCard';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';

interface TaskQueueProps {
  tasks: Task[];
  loading?: boolean;
  onCreateTask?: () => void;
  onSelectTask?: (task: Task) => void;
  onUpdateTask?: (taskId: string, updates: Partial<Task>) => void;
  onDeleteTask?: (taskId: string) => void;
  onDuplicateTask?: (taskId: string) => void;
  onAssignTask?: (taskId: string, agentType: Task['assignedAgent']) => void;
  onFilterChange?: (filter: TaskFilter) => void;
  selectedTask?: Task | null;
  filter?: TaskFilter;
  title?: string;
  showCreateButton?: boolean;
  enableDragDrop?: boolean;
  compact?: boolean;
}

type ViewMode = 'grid' | 'list';
type SortField = 'createdAt' | 'updatedAt' | 'priority' | 'title' | 'progress';
type SortOrder = 'asc' | 'desc';

const statusConfig = {
  pending: { color: 'bg-gray-100 text-gray-700', icon: Clock, count: 0 },
  assigned: { color: 'bg-blue-100 text-blue-700', icon: Users, count: 0 },
  in_progress: { color: 'bg-yellow-100 text-yellow-700', icon: Clock, count: 0 },
  completed: { color: 'bg-green-100 text-green-700', icon: CheckCircle, count: 0 },
  failed: { color: 'bg-red-100 text-red-700', icon: AlertCircle, count: 0 },
  cancelled: { color: 'bg-gray-100 text-gray-500', icon: Pause, count: 0 }
};

const priorityConfig = {
  low: { color: 'bg-green-100 text-green-700', weight: 1 },
  medium: { color: 'bg-yellow-100 text-yellow-700', weight: 2 },
  high: { color: 'bg-orange-100 text-orange-700', weight: 3 },
  urgent: { color: 'bg-red-100 text-red-700', weight: 4 }
};

const ItemTypes = {
  TASK: 'task'
};

export function TaskQueue({
  tasks,
  loading = false,
  onCreateTask,
  onSelectTask,
  onUpdateTask,
  onDeleteTask,
  onDuplicateTask,
  onAssignTask,
  onFilterChange,
  selectedTask,
  filter = {},
  title = 'Task Queue',
  showCreateButton = true,
  enableDragDrop = true,
  compact = false
}: TaskQueueProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchTerm, setSearchTerm] = useState(filter.searchTerm || '');
  const [showFilters, setShowFilters] = useState(false);

  // Drop zone for drag and drop
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: ItemTypes.TASK,
    drop: (item: { task: Task }) => {
      // Handle task dropping into queue
      console.log('Task dropped into queue:', item.task);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop()
    })
  });

  // Compute task statistics
  const taskStats = useMemo(() => {
    const stats = { ...statusConfig };
    tasks.forEach(task => {
      if (stats[task.status]) {
        stats[task.status].count++;
      }
    });
    return stats;
  }, [tasks]);

  // Sort and filter tasks
  const sortedAndFilteredTasks = useMemo(() => {
    let filteredTasks = [...tasks];

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filteredTasks = filteredTasks.filter(task =>
        task.title.toLowerCase().includes(searchLower) ||
        task.description.toLowerCase().includes(searchLower) ||
        task.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    // Apply other filters
    if (filter.status?.length) {
      filteredTasks = filteredTasks.filter(task => filter.status!.includes(task.status));
    }
    if (filter.priority?.length) {
      filteredTasks = filteredTasks.filter(task => filter.priority!.includes(task.priority));
    }
    if (filter.assignedAgent?.length) {
      filteredTasks = filteredTasks.filter(task => filter.assignedAgent!.includes(task.assignedAgent));
    }
    if (filter.tags?.length) {
      filteredTasks = filteredTasks.filter(task =>
        filter.tags!.some(filterTag => task.tags.includes(filterTag))
      );
    }

    // Sort tasks
    filteredTasks.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'priority':
          aValue = priorityConfig[a.priority]?.weight || 0;
          bValue = priorityConfig[b.priority]?.weight || 0;
          break;
        case 'progress':
          aValue = a.progress;
          bValue = b.progress;
          break;
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'createdAt':
        case 'updatedAt':
          aValue = new Date(a[sortField]).getTime();
          bValue = new Date(b[sortField]).getTime();
          break;
        default:
          aValue = a[sortField];
          bValue = b[sortField];
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filteredTasks;
  }, [tasks, searchTerm, filter, sortField, sortOrder]);

  const handleSortChange = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    onFilterChange?.({ ...filter, searchTerm: value.trim() || undefined });
  };

  const handleStatusFilter = (status: Task['status']) => {
    const currentStatuses = filter.status || [];
    const newStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter(s => s !== status)
      : [...currentStatuses, status];
    
    onFilterChange?.({ 
      ...filter, 
      status: newStatuses.length > 0 ? newStatuses : undefined 
    });
  };

  const handlePriorityFilter = (priority: Task['priority']) => {
    const currentPriorities = filter.priority || [];
    const newPriorities = currentPriorities.includes(priority)
      ? currentPriorities.filter(p => p !== priority)
      : [...currentPriorities, priority];
    
    onFilterChange?.({ 
      ...filter, 
      priority: newPriorities.length > 0 ? newPriorities : undefined 
    });
  };

  const clearFilters = () => {
    setSearchTerm('');
    onFilterChange?.({});
  };

  const totalFilters = [
    filter.status?.length || 0,
    filter.priority?.length || 0,
    filter.assignedAgent?.length || 0,
    filter.tags?.length || 0,
    filter.searchTerm ? 1 : 0
  ].reduce((sum, count) => sum + count, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-gray-600">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
          Loading tasks...
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={drop}
      className={`bg-white rounded-lg border ${
        isOver && canDrop ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
      } transition-colors`}
    >
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <Badge variant="secondary">
              {sortedAndFilteredTasks.length} of {tasks.length}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center border border-gray-300 rounded-lg">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 ${
                  viewMode === 'grid'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Grid size={16} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 ${
                  viewMode === 'list'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <List size={16} />
              </button>
            </div>

            {/* Filter Toggle */}
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className={totalFilters > 0 ? 'bg-blue-50 border-blue-300' : ''}
            >
              <Filter size={16} />
              {totalFilters > 0 && (
                <Badge variant="default" className="ml-1 text-xs">
                  {totalFilters}
                </Badge>
              )}
            </Button>

            {/* Create Task Button */}
            {showCreateButton && onCreateTask && (
              <Button onClick={onCreateTask}>
                <Plus size={16} />
                Create Task
              </Button>
            )}
          </div>
        </div>

        {/* Task Statistics */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(taskStats).map(([status, config]) => (
            <button
              key={status}
              onClick={() => handleStatusFilter(status as Task['status'])}
              className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm transition-colors ${
                filter.status?.includes(status as Task['status'])
                  ? config.color
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <config.icon size={14} />
              <span className="capitalize">{status.replace('_', ' ')}</span>
              <Badge variant="secondary" className="text-xs">
                {config.count}
              </Badge>
            </button>
          ))}
        </div>

        {/* Search and Filters */}
        <div className="mt-4 space-y-4">
          {/* Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-3 text-gray-400" />
              <Input
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search tasks..."
                className="pl-9"
              />
            </div>
            {totalFilters > 0 && (
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="p-4 bg-gray-50 rounded-lg space-y-4">
              {/* Priority Filters */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priority
                </label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(priorityConfig).map(([priority, config]) => (
                    <button
                      key={priority}
                      onClick={() => handlePriorityFilter(priority as Task['priority'])}
                      className={`px-3 py-1 rounded text-sm transition-colors ${
                        filter.priority?.includes(priority as Task['priority'])
                          ? config.color
                          : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
                      }`}
                    >
                      {priority.charAt(0).toUpperCase() + priority.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort Options */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sort by
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { field: 'createdAt' as const, label: 'Created' },
                    { field: 'updatedAt' as const, label: 'Updated' },
                    { field: 'priority' as const, label: 'Priority' },
                    { field: 'progress' as const, label: 'Progress' },
                    { field: 'title' as const, label: 'Title' }
                  ].map(({ field, label }) => (
                    <button
                      key={field}
                      onClick={() => handleSortChange(field)}
                      className={`flex items-center gap-1 px-3 py-1 rounded text-sm transition-colors ${
                        sortField === field
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
                      }`}
                    >
                      {label}
                      {sortField === field && (
                        sortOrder === 'asc' ? <SortAsc size={14} /> : <SortDesc size={14} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Task List */}
      <div className="p-6">
        {sortedAndFilteredTasks.length === 0 ? (
          <EmptyState
            icon={tasks.length === 0 ? Plus : Filter}
            title={tasks.length === 0 ? 'No tasks yet' : 'No tasks match your filters'}
            description={
              tasks.length === 0
                ? 'Create your first task to get started'
                : 'Try adjusting your search or filter criteria'
            }
            action={
              tasks.length === 0 && showCreateButton && onCreateTask
                ? { label: 'Create Task', onClick: onCreateTask }
                : totalFilters > 0
                ? { label: 'Clear Filters', onClick: clearFilters }
                : undefined
            }
          />
        ) : (
          <div
            className={
              viewMode === 'grid'
                ? `grid gap-4 ${
                    compact
                      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                  }`
                : 'space-y-3'
            }
          >
            {sortedAndFilteredTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onSelect={onSelectTask}
                onUpdate={onUpdateTask}
                onDelete={onDeleteTask}
                onDuplicate={onDuplicateTask}
                onAssign={onAssignTask}
                selectedTask={selectedTask}
                compact={compact || viewMode === 'list'}
                enableDragDrop={enableDragDrop}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}