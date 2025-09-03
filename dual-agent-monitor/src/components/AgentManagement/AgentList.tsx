import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Grid, 
  List, 
  Plus, 
  RefreshCw, 
  SortAsc, 
  SortDesc,
  Users,
  Activity,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { AgentCard } from './AgentCard';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { cn } from '../../lib/utils';
import type { Agent, AgentCommand } from '../../types/agent';

interface AgentListProps {
  agents: Agent[];
  selectedAgent?: Agent | null;
  loading?: boolean;
  error?: string | null;
  onSelectAgent?: (agent: Agent) => void;
  onCreateAgent?: () => void;
  onCommand?: (agentId: string, command: AgentCommand) => void;
  onEditAgent?: (agent: Agent) => void;
  onDeleteAgent?: (agentId: string) => void;
  onRefresh?: () => void;
  className?: string;
}

type ViewMode = 'grid' | 'list';
type SortField = 'name' | 'status' | 'type' | 'lastActivity' | 'healthScore';
type SortOrder = 'asc' | 'desc';
type StatusFilter = 'all' | 'active' | 'idle' | 'working' | 'error' | 'offline';
type TypeFilter = 'all' | 'manager' | 'worker' | 'specialist';

export function AgentList({
  agents,
  selectedAgent,
  loading = false,
  error,
  onSelectAgent,
  onCreateAgent,
  onCommand,
  onEditAgent,
  onDeleteAgent,
  onRefresh,
  className
}: AgentListProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sortField, setSortField] = useState<SortField>('lastActivity');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [showFilters, setShowFilters] = useState(false);

  // Filter and sort agents
  const filteredAndSortedAgents = useMemo(() => {
    let filtered = agents.filter(agent => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        if (!agent.name.toLowerCase().includes(searchLower) &&
            !agent.type.toLowerCase().includes(searchLower) &&
            !(agent.configuration.specialization?.toLowerCase() || '').includes(searchLower) &&
            !(agent.currentTask?.toLowerCase() || '').includes(searchLower)) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all' && agent.status !== statusFilter) {
        return false;
      }

      // Type filter
      if (typeFilter !== 'all' && agent.type !== typeFilter) {
        return false;
      }

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'type':
          aValue = a.type;
          bValue = b.type;
          break;
        case 'lastActivity':
          aValue = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
          bValue = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
          break;
        case 'healthScore':
          aValue = a.metrics.healthScore;
          bValue = b.metrics.healthScore;
          break;
        default:
          return 0;
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return bValue > aValue ? 1 : bValue < aValue ? -1 : 0;
      }
    });

    return filtered;
  }, [agents, searchTerm, statusFilter, typeFilter, sortField, sortOrder]);

  // Get agent counts by status
  const agentStats = useMemo(() => {
    const stats = agents.reduce((acc, agent) => {
      acc[agent.status] = (acc[agent.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: agents.length,
      active: stats.active || 0,
      working: stats.working || 0,
      idle: stats.idle || 0,
      error: stats.error || 0,
      offline: stats.offline || 0
    };
  }, [agents]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />;
  };

  if (error) {
    return (
      <div className={cn('p-6', className)}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <h3 className="font-medium text-red-900">Error Loading Agents</h3>
          </div>
          <p className="text-red-700 mt-2">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            className="mt-3"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 p-6 border-b border-gray-200">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Agent Management
              </h2>
              <p className="text-gray-600">
                Manage and monitor your Claude agents
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={loading}
              >
                <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                <span className="hidden sm:inline ml-2">Refresh</span>
              </Button>
              
              <Button onClick={onCreateAgent}>
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline ml-2">Create Agent</span>
              </Button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600">
                {agentStats.total} Total
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm text-gray-600">
                {agentStats.active} Active
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-gray-600">
                {agentStats.working} Working
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600">
                {agentStats.idle} Idle
              </span>
            </div>
            
            {agentStats.error > 0 && (
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm text-gray-600">
                  {agentStats.error} Error
                </span>
              </div>
            )}
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search agents by name, type, or specialization..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={showFilters ? 'bg-gray-100' : ''}
              >
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline ml-2">Filters</span>
                {(statusFilter !== 'all' || typeFilter !== 'all') && (
                  <Badge variant="secondary" className="ml-2">
                    {(statusFilter !== 'all' ? 1 : 0) + (typeFilter !== 'all' ? 1 : 0)}
                  </Badge>
                )}
              </Button>
              
              <div className="flex items-center border border-gray-200 rounded-lg">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="rounded-r-none"
                >
                  <Grid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-l-none"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="working">Working</option>
                    <option value="idle">Idle</option>
                    <option value="error">Error</option>
                    <option value="offline">Offline</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type
                  </label>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="all">All Types</option>
                    <option value="manager">Manager</option>
                    <option value="worker">Worker</option>
                    <option value="specialist">Specialist</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sort By
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={sortField}
                      onChange={(e) => setSortField(e.target.value as SortField)}
                      className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="name">Name</option>
                      <option value="status">Status</option>
                      <option value="type">Type</option>
                      <option value="lastActivity">Last Activity</option>
                      <option value="healthScore">Health Score</option>
                    </select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    >
                      {getSortIcon(sortField) || <SortAsc className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStatusFilter('all');
                    setTypeFilter('all');
                    setSortField('lastActivity');
                    setSortOrder('desc');
                    setSearchTerm('');
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Agent List/Grid */}
      <div className="flex-1 p-6 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-600">Loading agents...</span>
          </div>
        ) : filteredAndSortedAgents.length === 0 ? (
          <EmptyState
            icon={agents.length === 0 ? Plus : Search}
            title={agents.length === 0 ? 'No agents created yet' : 'No agents found'}
            description={
              agents.length === 0
                ? 'Create your first Claude agent to get started with multi-agent workflows'
                : 'Try adjusting your search or filter criteria'
            }
            action={
              agents.length === 0 && onCreateAgent ? (
                <Button onClick={onCreateAgent}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Agent
                </Button>
              ) : undefined
            }
          />
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredAndSortedAgents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                isSelected={selectedAgent?.id === agent.id}
                onSelect={onSelectAgent}
                onCommand={onCommand}
                onEdit={onEditAgent}
                onDelete={onDeleteAgent}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAndSortedAgents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                isSelected={selectedAgent?.id === agent.id}
                isCompact={true}
                onSelect={onSelectAgent}
                onCommand={onCommand}
                onEdit={onEditAgent}
                onDelete={onDeleteAgent}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}