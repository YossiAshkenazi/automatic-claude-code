import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, Play, Pause, Square, Download, Trash2, RefreshCw, Filter, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DualAgentSession } from '../../types';
import { formatDate, formatDuration } from '../../utils/formatters';
import { cn } from '../../lib/utils';

interface MobileSessionViewProps {
  sessions: DualAgentSession[];
  selectedSessionId?: string;
  onSelectSession: (sessionId: string) => void;
  onStatusChange: (sessionId: string, status: DualAgentSession['status']) => void;
  onExportSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  loading?: boolean;
}

type FilterType = 'all' | 'running' | 'paused' | 'completed' | 'error';

interface SessionCardProps {
  session: DualAgentSession;
  isSelected: boolean;
  onSelect: () => void;
  onStatusChange: (status: DualAgentSession['status']) => void;
  onExport: () => void;
  onDelete: () => void;
}

function SessionCard({ session, isSelected, onSelect, onStatusChange, onExport, onDelete }: SessionCardProps) {
  const [showActions, setShowActions] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  // Close actions menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(event.target as Node)) {
        setShowActions(false);
      }
    };

    if (showActions) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showActions]);

  const getStatusColor = (status: DualAgentSession['status']) => {
    switch (status) {
      case 'running':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'paused':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'completed':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'error':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusActions = (status: DualAgentSession['status']) => {
    const actions = [];
    
    if (status === 'running') {
      actions.push({ icon: <Pause size={16} />, label: 'Pause', action: () => onStatusChange('paused') });
      actions.push({ icon: <Square size={16} />, label: 'Stop', action: () => onStatusChange('completed') });
    } else if (status === 'paused') {
      actions.push({ icon: <Play size={16} />, label: 'Resume', action: () => onStatusChange('running') });
      actions.push({ icon: <Square size={16} />, label: 'Stop', action: () => onStatusChange('completed') });
    } else if (status === 'completed' || status === 'error') {
      actions.push({ icon: <Play size={16} />, label: 'Restart', action: () => onStatusChange('running') });
    }
    
    return actions;
  };

  const managerMessages = session.messages.filter(m => m.agentType === 'manager').length;
  const workerMessages = session.messages.filter(m => m.agentType === 'worker').length;
  const recentMessage = session.messages[session.messages.length - 1];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={cn(
        'bg-white border rounded-xl shadow-sm transition-all duration-200',
        isSelected ? 'ring-2 ring-blue-500 border-blue-200' : 'border-gray-200 hover:border-gray-300'
      )}
    >
      {/* Main Card Content */}
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0 mr-3" onClick={onSelect}>
            <h3 className="font-medium text-gray-900 text-sm line-clamp-2 mb-1">
              {session.initialTask}
            </h3>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>ID: {session.id.slice(0, 8)}</span>
              <span>•</span>
              <span>{formatDate(session.startTime)}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <div className={cn(
              'px-2 py-1 rounded-full text-xs font-medium border',
              getStatusColor(session.status)
            )}>
              {session.status}
            </div>
            
            <div className="relative" ref={actionsRef}>
              <button
                onClick={() => setShowActions(!showActions)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Session actions"
              >
                <ChevronDown size={16} className={cn(
                  'transition-transform',
                  showActions && 'rotate-180'
                )} />
              </button>
              
              <AnimatePresence>
                {showActions && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ duration: 0.1 }}
                    className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-10 py-1 min-w-[140px]"
                  >
                    {getStatusActions(session.status).map((action, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          action.action();
                          setShowActions(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        {action.icon}
                        {action.label}
                      </button>
                    ))}
                    
                    <hr className="my-1" />
                    
                    <button
                      onClick={() => {
                        onExport();
                        setShowActions(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Download size={16} />
                      Export
                    </button>
                    
                    <button
                      onClick={() => {
                        if (confirm('Delete this session? This cannot be undone.')) {
                          onDelete();
                        }
                        setShowActions(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-3 gap-3 py-3 border-t border-gray-100">
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900">
              {session.messages.length}
            </div>
            <div className="text-xs text-gray-500">Total</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-blue-600">
              {managerMessages}
            </div>
            <div className="text-xs text-gray-500">Manager</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-600">
              {workerMessages}
            </div>
            <div className="text-xs text-gray-500">Worker</div>
          </div>
        </div>

        {/* Expandable Details */}
        <div className="border-t border-gray-100 pt-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <span>More details</span>
            <ChevronDown size={16} className={cn(
              'transition-transform',
              expanded && 'rotate-180'
            )} />
          </button>
          
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="pt-3 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Working Directory:</span>
                    <span className="text-gray-900 truncate ml-2 max-w-[60%]">
                      {session.workDir || 'Not specified'}
                    </span>
                  </div>
                  
                  {recentMessage && (
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Latest Message:</div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <div className="flex items-center gap-2 mb-1">
                          <div className={cn(
                            'w-4 h-4 rounded-full text-xs flex items-center justify-center font-medium',
                            recentMessage.agentType === 'manager'
                              ? 'bg-blue-100 text-blue-600'
                              : 'bg-green-100 text-green-600'
                          )}>
                            {recentMessage.agentType === 'manager' ? 'M' : 'W'}
                          </div>
                          <span className="text-xs text-gray-500">
                            {formatDate(recentMessage.timestamp)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-700 line-clamp-2">
                          {recentMessage.content}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

export function MobileSessionView({
  sessions,
  selectedSessionId,
  onSelectSession,
  onStatusChange,
  onExportSession,
  onDeleteSession,
  loading = false
}: MobileSessionViewProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'status' | 'messages'>('recent');
  
  const filterOptions: { value: FilterType; label: string; count: number }[] = [
    { value: 'all', label: 'All Sessions', count: sessions.length },
    { value: 'running', label: 'Running', count: sessions.filter(s => s.status === 'running').length },
    { value: 'paused', label: 'Paused', count: sessions.filter(s => s.status === 'paused').length },
    { value: 'completed', label: 'Completed', count: sessions.filter(s => s.status === 'completed').length },
    { value: 'error', label: 'Error', count: sessions.filter(s => s.status === 'error').length },
  ];

  // Filter and search sessions
  const filteredSessions = sessions
    .filter(session => {
      const matchesFilter = filter === 'all' || session.status === filter;
      const matchesSearch = !searchQuery || 
        session.initialTask.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.id.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
        case 'status':
          return a.status.localeCompare(b.status);
        case 'messages':
          return b.messages.length - a.messages.length;
        default:
          return 0;
      }
    });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-600">
          <RefreshCw className="animate-spin" size={20} />
          Loading sessions...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-safe">
      {/* Header with Search and Filters */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="p-4">
          {/* Search Bar */}
          <div className="relative mb-3">
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search sessions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Filter Toggle */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                showFilters
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              <Filter size={16} />
              Filters
              <ChevronDown size={16} className={cn(
                'transition-transform',
                showFilters && 'rotate-180'
              )} />
            </button>
            
            <div className="text-sm text-gray-500">
              {filteredSessions.length} of {sessions.length} sessions
            </div>
          </div>

          {/* Filter Options */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden mt-3"
              >
                <div className="bg-gray-50 rounded-lg p-3">
                  {/* Status Filters */}
                  <div className="mb-3">
                    <div className="text-xs font-medium text-gray-700 mb-2">Status</div>
                    <div className="flex flex-wrap gap-2">
                      {filterOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setFilter(option.value)}
                          className={cn(
                            'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                            filter === option.value
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                          )}
                        >
                          {option.label} ({option.count})
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Sort Options */}
                  <div>
                    <div className="text-xs font-medium text-gray-700 mb-2">Sort by</div>
                    <div className="flex gap-2">
                      {[
                        { value: 'recent', label: 'Recent' },
                        { value: 'status', label: 'Status' },
                        { value: 'messages', label: 'Messages' }
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setSortBy(option.value as typeof sortBy)}
                          className={cn(
                            'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                            sortBy === option.value
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Session List */}
      <div className="p-4">
        {filteredSessions.length > 0 ? (
          <div className="space-y-4">
            <AnimatePresence>
              {filteredSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  isSelected={session.id === selectedSessionId}
                  onSelect={() => onSelectSession(session.id)}
                  onStatusChange={(status) => onStatusChange(session.id, status)}
                  onExport={() => onExportSession(session.id)}
                  onDelete={() => onDeleteSession(session.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search size={24} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No sessions found</h3>
            <p className="text-gray-500 text-sm">
              {searchQuery ? 'Try adjusting your search terms' : 'No sessions match the current filter'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}