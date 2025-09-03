import { useState, useCallback, useEffect, useRef } from 'react';
import { Task, TaskQueue, TaskFilter, TaskMetrics, TaskTemplate } from '../types';
import { apiClient } from '../utils/api';
import { toast } from 'sonner';
import { useWebSocket } from './useWebSocket';

interface UseTaskManagerOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  enableRealtimeUpdates?: boolean;
}

interface TaskManagerState {
  tasks: Task[];
  queues: TaskQueue[];
  templates: TaskTemplate[];
  metrics: TaskMetrics | null;
  loading: boolean;
  error: string | null;
  selectedTask: Task | null;
  filter: TaskFilter;
}

export function useTaskManager(options: UseTaskManagerOptions = {}) {
  const {
    autoRefresh = true,
    refreshInterval = 10000,
    enableRealtimeUpdates = true
  } = options;

  const [state, setState] = useState<TaskManagerState>({
    tasks: [],
    queues: [],
    templates: [],
    metrics: null,
    loading: false,
    error: null,
    selectedTask: null,
    filter: {}
  });

  const refreshTimeoutRef = useRef<NodeJS.Timeout>();
  const isMountedRef = useRef(true);

  // WebSocket integration for real-time updates
  const { isConnected, sendMessage, lastMessage } = useWebSocket('ws://localhost:4005', {
    maxReconnectAttempts: 5,
    reconnectInterval: 2000
  });

  // Handle WebSocket messages for real-time task updates
  useEffect(() => {
    if (!enableRealtimeUpdates || !lastMessage) return;

    try {
      const message = JSON.parse(lastMessage);
      
      switch (message.type) {
        case 'task_created':
          handleTaskCreated(message.data);
          break;
        case 'task_updated':
          handleTaskUpdated(message.data);
          break;
        case 'task_deleted':
          handleTaskDeleted(message.data.taskId);
          break;
        case 'task_progress':
          handleTaskProgress(message.data);
          break;
        case 'task_assigned':
          handleTaskAssigned(message.data);
          break;
        case 'queue_updated':
          handleQueueUpdated(message.data);
          break;
      }
    } catch (error) {
      console.warn('Failed to parse task WebSocket message:', error);
    }
  }, [lastMessage, enableRealtimeUpdates]);

  // Real-time event handlers
  const handleTaskCreated = useCallback((task: Task) => {
    setState(prev => ({
      ...prev,
      tasks: [task, ...prev.tasks]
    }));
    toast.success(`Task "${task.title}" created`);
  }, []);

  const handleTaskUpdated = useCallback((updatedTask: Task) => {
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.map(task => 
        task.id === updatedTask.id ? updatedTask : task
      ),
      selectedTask: prev.selectedTask?.id === updatedTask.id ? updatedTask : prev.selectedTask
    }));
  }, []);

  const handleTaskDeleted = useCallback((taskId: string) => {
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.filter(task => task.id !== taskId),
      selectedTask: prev.selectedTask?.id === taskId ? null : prev.selectedTask
    }));
    toast.info('Task deleted');
  }, []);

  const handleTaskProgress = useCallback((progressData: { taskId: string; progress: number; status?: Task['status'] }) => {
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.map(task => 
        task.id === progressData.taskId 
          ? { ...task, progress: progressData.progress, status: progressData.status || task.status, updatedAt: new Date() }
          : task
      )
    }));
  }, []);

  const handleTaskAssigned = useCallback((assignmentData: { taskId: string; assignedAgent: Task['assignedAgent']; sessionId?: string }) => {
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.map(task => 
        task.id === assignmentData.taskId 
          ? { 
              ...task, 
              assignedAgent: assignmentData.assignedAgent,
              sessionId: assignmentData.sessionId,
              status: assignmentData.assignedAgent ? 'assigned' : 'pending',
              updatedAt: new Date()
            }
          : task
      )
    }));
    toast.success(`Task assigned to ${assignmentData.assignedAgent || 'unassigned'}`);
  }, []);

  const handleQueueUpdated = useCallback((updatedQueue: TaskQueue) => {
    setState(prev => ({
      ...prev,
      queues: prev.queues.map(queue => 
        queue.id === updatedQueue.id ? updatedQueue : queue
      )
    }));
  }, []);

  // API methods
  const loadTasks = useCallback(async (filter?: TaskFilter) => {
    if (!isMountedRef.current) return;
    
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const tasks = await apiClient.request<Task[]>('/tasks', {
        method: 'POST',
        body: JSON.stringify({ filter })
      });
      
      if (isMountedRef.current) {
        setState(prev => ({ ...prev, tasks, loading: false }));
      }
    } catch (error: any) {
      if (isMountedRef.current) {
        setState(prev => ({ ...prev, error: error.message, loading: false }));
        toast.error(`Failed to load tasks: ${error.message}`);
      }
    }
  }, []);

  const loadQueues = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    try {
      const queues = await apiClient.request<TaskQueue[]>('/task-queues');
      if (isMountedRef.current) {
        setState(prev => ({ ...prev, queues }));
      }
    } catch (error: any) {
      console.error('Failed to load task queues:', error);
    }
  }, []);

  const loadMetrics = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    try {
      const metrics = await apiClient.request<TaskMetrics>('/tasks/metrics');
      if (isMountedRef.current) {
        setState(prev => ({ ...prev, metrics }));
      }
    } catch (error: any) {
      console.error('Failed to load task metrics:', error);
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    try {
      const templates = await apiClient.request<TaskTemplate[]>('/task-templates');
      if (isMountedRef.current) {
        setState(prev => ({ ...prev, templates }));
      }
    } catch (error: any) {
      console.error('Failed to load task templates:', error);
    }
  }, []);

  const createTask = useCallback(async (taskData: Partial<Task>): Promise<Task | null> => {
    try {
      const newTask = await apiClient.request<Task>('/tasks', {
        method: 'POST',
        body: JSON.stringify(taskData)
      });
      
      // Task will be added via WebSocket real-time update
      if (!enableRealtimeUpdates) {
        setState(prev => ({
          ...prev,
          tasks: [newTask, ...prev.tasks]
        }));
        toast.success(`Task "${newTask.title}" created`);
      }
      
      return newTask;
    } catch (error: any) {
      toast.error(`Failed to create task: ${error.message}`);
      return null;
    }
  }, [enableRealtimeUpdates]);

  const updateTask = useCallback(async (taskId: string, updates: Partial<Task>): Promise<boolean> => {
    try {
      const updatedTask = await apiClient.request<Task>(`/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      });
      
      if (!enableRealtimeUpdates) {
        setState(prev => ({
          ...prev,
          tasks: prev.tasks.map(task => task.id === taskId ? updatedTask : task),
          selectedTask: prev.selectedTask?.id === taskId ? updatedTask : prev.selectedTask
        }));
        toast.success('Task updated');
      }
      
      return true;
    } catch (error: any) {
      toast.error(`Failed to update task: ${error.message}`);
      return false;
    }
  }, [enableRealtimeUpdates]);

  const deleteTask = useCallback(async (taskId: string): Promise<boolean> => {
    try {
      await apiClient.request(`/tasks/${taskId}`, {
        method: 'DELETE'
      });
      
      if (!enableRealtimeUpdates) {
        setState(prev => ({
          ...prev,
          tasks: prev.tasks.filter(task => task.id !== taskId),
          selectedTask: prev.selectedTask?.id === taskId ? null : prev.selectedTask
        }));
        toast.success('Task deleted');
      }
      
      return true;
    } catch (error: any) {
      toast.error(`Failed to delete task: ${error.message}`);
      return false;
    }
  }, [enableRealtimeUpdates]);

  const assignTask = useCallback(async (taskId: string, agentType: Task['assignedAgent'], sessionId?: string): Promise<boolean> => {
    try {
      await apiClient.request(`/tasks/${taskId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ assignedAgent: agentType, sessionId })
      });
      
      if (!enableRealtimeUpdates) {
        setState(prev => ({
          ...prev,
          tasks: prev.tasks.map(task => 
            task.id === taskId 
              ? { ...task, assignedAgent: agentType, sessionId, status: agentType ? 'assigned' : 'pending', updatedAt: new Date() }
              : task
          )
        }));
        toast.success(`Task assigned to ${agentType || 'unassigned'}`);
      }
      
      return true;
    } catch (error: any) {
      toast.error(`Failed to assign task: ${error.message}`);
      return false;
    }
  }, [enableRealtimeUpdates]);

  const updateTaskProgress = useCallback(async (taskId: string, progress: number, status?: Task['status']): Promise<boolean> => {
    try {
      await apiClient.request(`/tasks/${taskId}/progress`, {
        method: 'POST',
        body: JSON.stringify({ progress, status })
      });
      
      if (!enableRealtimeUpdates) {
        setState(prev => ({
          ...prev,
          tasks: prev.tasks.map(task => 
            task.id === taskId 
              ? { ...task, progress, status: status || task.status, updatedAt: new Date() }
              : task
          )
        }));
      }
      
      return true;
    } catch (error: any) {
      toast.error(`Failed to update task progress: ${error.message}`);
      return false;
    }
  }, [enableRealtimeUpdates]);

  const duplicateTask = useCallback(async (taskId: string): Promise<Task | null> => {
    const originalTask = state.tasks.find(t => t.id === taskId);
    if (!originalTask) {
      toast.error('Task not found');
      return null;
    }
    
    const duplicatedTask = {
      ...originalTask,
      title: `${originalTask.title} (Copy)`,
      status: 'pending' as const,
      assignedAgent: null,
      sessionId: undefined,
      progress: 0,
      result: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: undefined
    };
    
    delete (duplicatedTask as any).id; // Remove ID to create new task
    
    return await createTask(duplicatedTask);
  }, [state.tasks, createTask]);

  const bulkUpdateTasks = useCallback(async (taskIds: string[], updates: Partial<Task>): Promise<boolean> => {
    try {
      await apiClient.request('/tasks/bulk-update', {
        method: 'POST',
        body: JSON.stringify({ taskIds, updates })
      });
      
      if (!enableRealtimeUpdates) {
        setState(prev => ({
          ...prev,
          tasks: prev.tasks.map(task => 
            taskIds.includes(task.id) 
              ? { ...task, ...updates, updatedAt: new Date() }
              : task
          )
        }));
        toast.success(`${taskIds.length} tasks updated`);
      }
      
      return true;
    } catch (error: any) {
      toast.error(`Failed to bulk update tasks: ${error.message}`);
      return false;
    }
  }, [enableRealtimeUpdates]);

  // Filter and search
  const applyFilter = useCallback((filter: TaskFilter) => {
    setState(prev => ({ ...prev, filter }));
    loadTasks(filter);
  }, [loadTasks]);

  const clearFilter = useCallback(() => {
    setState(prev => ({ ...prev, filter: {} }));
    loadTasks();
  }, [loadTasks]);

  // Selection
  const selectTask = useCallback((task: Task | null) => {
    setState(prev => ({ ...prev, selectedTask: task }));
  }, []);

  // Auto-refresh setup
  useEffect(() => {
    const setupAutoRefresh = () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      
      if (autoRefresh && isMountedRef.current) {
        refreshTimeoutRef.current = setTimeout(() => {
          Promise.all([
            loadTasks(state.filter),
            loadQueues(),
            loadMetrics()
          ]);
          setupAutoRefresh(); // Schedule next refresh
        }, refreshInterval);
      }
    };
    
    setupAutoRefresh();
    
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, state.filter, loadTasks, loadQueues, loadMetrics]);

  // Initial data load
  useEffect(() => {
    isMountedRef.current = true;
    
    Promise.all([
      loadTasks(),
      loadQueues(),
      loadMetrics(),
      loadTemplates()
    ]);
    
    return () => {
      isMountedRef.current = false;
    };
  }, [loadTasks, loadQueues, loadMetrics, loadTemplates]);

  // Computed values
  const filteredTasks = state.tasks.filter(task => {
    const { filter } = state;
    
    if (filter.status?.length && !filter.status.includes(task.status)) return false;
    if (filter.priority?.length && !filter.priority.includes(task.priority)) return false;
    if (filter.assignedAgent?.length && !filter.assignedAgent.includes(task.assignedAgent)) return false;
    if (filter.tags?.length && !filter.tags.some(tag => task.tags.includes(tag))) return false;
    if (filter.searchTerm && !task.title.toLowerCase().includes(filter.searchTerm.toLowerCase()) && 
        !task.description.toLowerCase().includes(filter.searchTerm.toLowerCase())) return false;
    if (filter.dateRange) {
      const taskDate = new Date(task.createdAt);
      if (taskDate < filter.dateRange.start || taskDate > filter.dateRange.end) return false;
    }
    
    return true;
  });

  const tasksByStatus = filteredTasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const tasksByPriority = filteredTasks.reduce((acc, task) => {
    acc[task.priority] = (acc[task.priority] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const tasksByAgent = filteredTasks.reduce((acc, task) => {
    const agent = task.assignedAgent || 'unassigned';
    acc[agent] = (acc[agent] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    // State
    tasks: filteredTasks,
    allTasks: state.tasks,
    queues: state.queues,
    templates: state.templates,
    metrics: state.metrics,
    loading: state.loading,
    error: state.error,
    selectedTask: state.selectedTask,
    filter: state.filter,
    
    // Computed values
    tasksByStatus,
    tasksByPriority,
    tasksByAgent,
    
    // Actions
    createTask,
    updateTask,
    deleteTask,
    assignTask,
    updateTaskProgress,
    duplicateTask,
    bulkUpdateTasks,
    
    // Filter & search
    applyFilter,
    clearFilter,
    
    // Selection
    selectTask,
    
    // Data loading
    loadTasks,
    loadQueues,
    loadMetrics,
    loadTemplates,
    refresh: () => Promise.all([
      loadTasks(state.filter),
      loadQueues(),
      loadMetrics()
    ]),
    
    // WebSocket
    isConnected,
    sendMessage
  };
}