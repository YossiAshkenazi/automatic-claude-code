import React, { useState, useCallback } from 'react';
import { Plus, RefreshCw, Settings, BarChart3, MessageSquare, Users, AlertCircle, Send } from 'lucide-react';
import { AgentList } from './AgentList';
import { AgentCreator } from './AgentCreator';
import { AgentSettings } from './AgentSettings';
import { AgentInteractionDisplay } from './AgentInteractionDisplay';
import { ConnectionStatus } from './ConnectionStatus';
import { TaskAssignmentModal } from './TaskAssignmentModal';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { useRealAgentManager } from '../../hooks/useRealAgentManager';
import { cn } from '../../lib/utils';
import type { Agent, CreateAgentRequest, UpdateAgentRequest } from '../../types/agent';

interface MultiAgentDashboardProps {
  className?: string;
}

type ViewMode = 'overview' | 'list' | 'interactions';

export function MultiAgentDashboard({ className }: MultiAgentDashboardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [showAgentCreator, setShowAgentCreator] = useState(false);
  const [showAgentSettings, setShowAgentSettings] = useState(false);
  const [showTaskAssignment, setShowTaskAssignment] = useState(false);

  const {
    // State
    agents,
    tasks,
    events,
    loading,
    error,
    connected: isConnected,
    connecting,
    
    // Actions
    createAgent,
    executeCommand,
    assignTask,
    connect,
    disconnect,
    reconnect,
    refreshSystemStatus,
    
    // Computed
    activeAgents,
    managerAgents,
    workerAgents,
    specialistAgents,
    activeTasks,
    
    // Service
    service
  } = useRealAgentManager({
    autoConnect: true,
    enableToasts: true
  });

  // Mock data for now - these will come from the backend later
  const communications: any[] = [];
  const recentCommunications: any[] = [];
  const selectedAgent = null;

  const handleCreateAgent = useCallback(async (request: CreateAgentRequest): Promise<Agent> => {
    const agent = await createAgent(request);
    return agent;
  }, [createAgent]);

  const handleUpdateAgent = useCallback(async (request: UpdateAgentRequest) => {
    // TODO: Implement agent updates via Python backend
    console.log('Update agent request:', request);
  }, []);

  const handleDeleteAgent = useCallback(async (agentId: string) => {
    if (confirm('Are you sure you want to delete this agent? This action cannot be undone.')) {
      // TODO: Implement agent deletion via Python backend
      console.log('Delete agent:', agentId);
    }
  }, []);

  const handleAgentCommand = useCallback(async (agentId: string, command: any) => {
    try {
      await executeCommand(agentId, command.type, command.parameters || {});
    } catch (error) {
      console.error('Agent command failed:', error);
    }
  }, [executeCommand]);

  const getOverviewStats = () => {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const totalCost = agents.reduce((sum, agent) => sum + (agent.metrics?.totalCost || 0), 0);
    const avgHealthScore = agents.length > 0 
      ? agents.reduce((sum, agent) => sum + (agent.metrics?.healthScore || 100), 0) / agents.length
      : 100;

    return {
      totalTasks,
      completedTasks,
      totalCost,
      avgHealthScore
    };
  };

  const stats = getOverviewStats();

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Agents</p>
              <p className="text-2xl font-bold text-gray-900">{agents.length}</p>
            </div>
            <Users className="w-8 h-8 text-blue-600" />
          </div>
          <div className="mt-2 text-xs text-gray-500">
            {activeAgents.length} active
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Tasks Completed</p>
              <p className="text-2xl font-bold text-gray-900">{stats.completedTasks}</p>
            </div>
            <BarChart3 className="w-8 h-8 text-green-600" />
          </div>
          <div className="mt-2 text-xs text-gray-500">
            {stats.totalTasks} total tasks
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Communications</p>
              <p className="text-2xl font-bold text-gray-900">{communications.length}</p>
            </div>
            <MessageSquare className="w-8 h-8 text-purple-600" />
          </div>
          <div className="mt-2 text-xs text-gray-500">
            {recentCommunications.length} recent
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Cost</p>
              <p className="text-2xl font-bold text-gray-900">
                ${stats.totalCost.toFixed(2)}
              </p>
            </div>
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center',
              stats.avgHealthScore >= 80 ? 'bg-green-100' :
              stats.avgHealthScore >= 60 ? 'bg-yellow-100' : 'bg-red-100'
            )}>
              <span className={cn(
                'text-sm font-medium',
                stats.avgHealthScore >= 80 ? 'text-green-600' :
                stats.avgHealthScore >= 60 ? 'text-yellow-600' : 'text-red-600'
              )}>
                {Math.round(stats.avgHealthScore)}%
              </span>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            avg health score
          </div>
        </Card>
      </div>

      {/* Agent Types Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Agent Types</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <span className="text-sm text-gray-600">Managers</span>
              </div>
              <Badge variant="secondary">{managerAgents.length}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-sm text-gray-600">Workers</span>
              </div>
              <Badge variant="secondary">{workerAgents.length}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-600">Specialists</span>
              </div>
              <Badge variant="secondary">{specialistAgents.length}</Badge>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Active Tasks</h3>
          <div className="space-y-2">
            {activeTasks.slice(0, 3).map((task) => {
              const assignedAgent = agents.find(a => a.id === task.assignedTo);
              return (
                <div key={task.id} className="text-sm">
                  <div className="font-medium text-gray-900">{task.title}</div>
                  <div className="text-gray-500">
                    Assigned to {assignedAgent?.name || 'Unknown Agent'}
                  </div>
                </div>
              );
            })}
            {activeTasks.length === 0 && (
              <p className="text-sm text-gray-500">No active tasks</p>
            )}
            {activeTasks.length > 3 && (
              <div className="text-sm text-blue-600">
                +{activeTasks.length - 3} more tasks
              </div>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Recent Events</h3>
          <div className="space-y-2">
            {events.slice(0, 3).map((event) => {
              const agent = agents.find(a => a.id === event.agentId);
              return (
                <div key={event.id} className="text-sm">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'w-2 h-2 rounded-full',
                      event.severity === 'success' ? 'bg-green-500' :
                      event.severity === 'warning' ? 'bg-yellow-500' :
                      event.severity === 'error' ? 'bg-red-500' : 'bg-blue-500'
                    )}></div>
                    <span className="font-medium text-gray-900">{event.type}</span>
                  </div>
                  <div className="text-gray-500 ml-4">
                    {agent?.name || 'Unknown Agent'} • {new Date(event.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              );
            })}
            {events.length === 0 && (
              <p className="text-sm text-gray-500">No recent events</p>
            )}
          </div>
        </Card>
      </div>

      {/* Recent Communications */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Recent Communications</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode('interactions')}
          >
            View All
          </Button>
        </div>
        
        {recentCommunications.length > 0 ? (
          <div className="space-y-3">
            {recentCommunications.slice(0, 5).map((comm) => {
              const fromAgent = agents.find(a => a.id === comm.fromAgent);
              const toAgent = agents.find(a => a.id === comm.toAgent);
              
              return (
                <div key={comm.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">
                        {fromAgent?.name || 'Unknown'} → {toAgent?.name || 'Unknown'}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {comm.messageType.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 truncate">{comm.content}</p>
                  </div>
                  <div className="text-xs text-gray-500 ml-4">
                    {new Date(comm.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-4">
            No communications yet. Agent interactions will appear here.
          </p>
        )}
      </Card>
    </div>
  );

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Multi-Agent Dashboard</h1>
          <div className="mt-2">
            <ConnectionStatus
              connected={isConnected}
              connecting={connecting}
              error={error}
              onReconnect={reconnect}
              onDismissError={() => console.log('Clear error')}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Buttons */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            <Button
              variant={viewMode === 'overview' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('overview')}
              className="rounded-none"
            >
              Overview
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-none"
            >
              Agents
            </Button>
            <Button
              variant={viewMode === 'interactions' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('interactions')}
              className="rounded-none"
            >
              Communications
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={refreshSystemStatus}
            disabled={loading}
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </Button>

          <Button
            variant="outline"
            onClick={() => setShowTaskAssignment(true)}
            disabled={!isConnected || activeAgents.length === 0}
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline ml-2">Assign Task</span>
          </Button>

          <Button
            onClick={() => setShowAgentCreator(true)}
            disabled={agents.length >= 5}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline ml-2">Create Agent</span>
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {viewMode === 'overview' && renderOverview()}
        
        {viewMode === 'list' && (
          <AgentList
            agents={agents}
            selectedAgent={selectedAgent}
            loading={loading}
            error={error}
            onSelectAgent={(agentId) => console.log('Selected agent:', agentId)}
            onCreateAgent={() => setShowAgentCreator(true)}
            onCommand={handleAgentCommand}
            onEditAgent={(agent) => {
              console.log('Edit agent:', agent.id);
              setShowAgentSettings(true);
            }}
            onDeleteAgent={handleDeleteAgent}
            onRefresh={refreshSystemStatus}
          />
        )}
        
        {viewMode === 'interactions' && (
          <div className="p-6">
            <AgentInteractionDisplay
              agents={agents}
              communications={communications}
              isRealTime={isConnected}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      <AgentCreator
        isOpen={showAgentCreator}
        onClose={() => setShowAgentCreator(false)}
        onCreate={handleCreateAgent}
        existingAgents={agents}
        maxAgents={5}
      />

      <AgentSettings
        agent={selectedAgent}
        isOpen={showAgentSettings}
        onClose={() => setShowAgentSettings(false)}
        onUpdate={handleUpdateAgent}
        onDelete={handleDeleteAgent}
      />

      <TaskAssignmentModal
        isOpen={showTaskAssignment}
        onClose={() => setShowTaskAssignment(false)}
        agents={agents}
        onAssignTask={assignTask}
      />
    </div>
  );
}