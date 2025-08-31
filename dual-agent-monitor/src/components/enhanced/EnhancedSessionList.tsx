import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  Square,
  Trash2,
  Download,
  MoreHorizontal,
  Clock,
  MessageSquare,
  Folder,
  Calendar,
  Search,
  Filter,
  SortAsc,
  SortDesc,
  Grid3X3,
  List,
  Eye,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Input } from '../ui/Input';
import { DualAgentSession } from '../../types';
import { useSessionStore } from '../../store/useSessionStore';
import { cn, formatRelativeTime, formatDuration, getStatusColor } from '../../lib/utils';
import { toast } from 'sonner';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as AlertDialog from '@radix-ui/react-alert-dialog';

interface EnhancedSessionListProps {
  onSelectSession: (sessionId: string) => void;
  className?: string;
}

type ViewMode = 'grid' | 'list';
type SortField = 'startTime' | 'lastActivity' | 'messageCount' | 'status';

export function EnhancedSessionList({ onSelectSession, className }: EnhancedSessionListProps) {
  const {
    sessions,
    selectedSession,
    updateSessionStatus,
    deleteSession,
    exportSession,
    filters,
    setFilters,
    sortBy,
    sortOrder,
    setSorting,
    getFilteredSessions,
  } = useSessionStore();

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteDialogSession, setDeleteDialogSession] = useState<DualAgentSession | null>(null);

  const filteredSessions = useMemo(() => {
    let filtered = getFilteredSessions();
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(session =>
        session.initialTask.toLowerCase().includes(term) ||
        session.workDir.toLowerCase().includes(term) ||
        session.id.toLowerCase().includes(term)
      );
    }
    
    return filtered;
  }, [getFilteredSessions, searchTerm]);

  const handleStatusChange = async (session: DualAgentSession, newStatus: DualAgentSession['status']) => {
    try {
      await updateSessionStatus(session.id, newStatus);
      toast.success(`Session ${newStatus}`);
    } catch (error) {
      toast.error(`Failed to ${newStatus} session`);
    }
  };

  const handleDeleteSession = async (session: DualAgentSession) => {
    try {
      await deleteSession(session.id);
      setDeleteDialogSession(null);
      toast.success('Session deleted');
    } catch (error) {
      toast.error('Failed to delete session');
    }
  };

  const handleExportSession = async (session: DualAgentSession, format: 'json' | 'csv') => {
    try {
      await exportSession(session.id, format);
    } catch (error) {
      toast.error('Export failed');
    }
  };

  const getSessionStatusActions = (session: DualAgentSession) => {
    const actions = [];
    
    if (session.status === 'paused') {
      actions.push({
        label: 'Resume',
        icon: Play,
        action: () => handleStatusChange(session, 'running'),
        color: 'text-green-600',
      });
    } else if (session.status === 'running') {
      actions.push({
        label: 'Pause',
        icon: Pause,
        action: () => handleStatusChange(session, 'paused'),
        color: 'text-yellow-600',
      });
    }
    
    if (['running', 'paused'].includes(session.status)) {
      actions.push({
        label: 'Stop',
        icon: Square,
        action: () => handleStatusChange(session, 'completed'),
        color: 'text-red-600',
      });
    }
    
    return actions;
  };

  const handleSortChange = (field: SortField) => {
    const newOrder = sortBy === field && sortOrder === 'desc' ? 'asc' : 'desc';
    setSorting(field, newOrder);
  };

  const renderSessionCard = (session: DualAgentSession) => {
    const isSelected = selectedSession?.id === session.id;
    const statusActions = getSessionStatusActions(session);
    const statusColor = getStatusColor(session.status);
    
    if (viewMode === 'list') {
      return (
        <Card
          key={session.id}
          className={cn(
            'transition-all duration-200 hover:shadow-md cursor-pointer',
            isSelected && 'ring-2 ring-primary shadow-lg'
          )}
          onClick={() => onSelectSession(session.id)}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">
                    {session.initialTask}
                  </h3>
                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatRelativeTime(session.startTime)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {session.messages.length}
                    </span>
                    <span className="flex items-center gap-1">
                      <Folder className="w-3 h-3" />
                      {session.workDir.split('/').pop()}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Badge className={statusColor}>
                    {session.status}
                  </Badge>
                  
                  {statusActions.map((action, index) => (
                    <Button
                      key={index}
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        action.action();
                      }}
                      className={action.color}
                    >
                      <action.icon className="w-4 h-4" />
                    </Button>
                  ))}
                  
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content align="end">
                      <DropdownMenu.Item onClick={() => onSelectSession(session.id)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenu.Item>
                      <DropdownMenu.Separator />
                      <DropdownMenu.Item onClick={() => handleExportSession(session, 'json')}>
                        <Download className="mr-2 h-4 w-4" />
                        Export JSON
                      </DropdownMenu.Item>
                      <DropdownMenu.Item onClick={() => handleExportSession(session, 'csv')}>
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                      </DropdownMenu.Item>
                      <DropdownMenu.Separator />
                      <DropdownMenu.Item 
                        onClick={() => setDeleteDialogSession(session)}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Root>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card
        key={session.id}
        className={cn(
          'transition-all duration-200 hover:shadow-lg cursor-pointer group',
          isSelected && 'ring-2 ring-primary shadow-lg'
        )}
        onClick={() => onSelectSession(session.id)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground line-clamp-2 mb-2">
                {session.initialTask}
              </h3>
              <Badge className={statusColor}>
                {session.status}
              </Badge>
            </div>
            
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="end">
                <DropdownMenu.Item onClick={() => onSelectSession(session.id)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenu.Item>
                <DropdownMenu.Separator />
                {statusActions.map((action, index) => (
                  <DropdownMenu.Item key={index} onClick={action.action}>
                    <action.icon className="mr-2 h-4 w-4" />
                    {action.label}
                  </DropdownMenu.Item>
                ))}
                <DropdownMenu.Separator />
                <DropdownMenu.Item onClick={() => handleExportSession(session, 'json')}>
                  <Download className="mr-2 h-4 w-4" />
                  Export JSON
                </DropdownMenu.Item>
                <DropdownMenu.Item onClick={() => handleExportSession(session, 'csv')}>
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </DropdownMenu.Item>
                <DropdownMenu.Separator />
                <DropdownMenu.Item 
                  onClick={() => setDeleteDialogSession(session)}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                <span>{session.messages.length} messages</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{formatRelativeTime(session.startTime)}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Folder className="w-3 h-3" />
              <span className="truncate">{session.workDir}</span>
            </div>
            
            <div className="flex items-center gap-1 pt-2">
              {statusActions.map((action, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    action.action();
                  }}
                  className={cn('opacity-0 group-hover:opacity-100 transition-opacity', action.color)}
                >
                  <action.icon className="w-3 h-3 mr-1" />
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <div className={cn('flex flex-col h-full bg-background', className)}>
        {/* Header */}
        <div className="border-b border-border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Sessions</h2>
              <p className="text-sm text-muted-foreground">
                {filteredSessions.length} of {sessions.length} sessions
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => setViewMode('grid')}
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {/* Search and Filters */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search sessions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Sort dropdown */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button variant="outline">
                  {sortOrder === 'desc' ? <SortDesc className="w-4 h-4 mr-2" /> : <SortAsc className="w-4 h-4 mr-2" />}
                  Sort
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="end">
                <DropdownMenu.Item onClick={() => handleSortChange('startTime')}>
                  Start Time
                </DropdownMenu.Item>
                <DropdownMenu.Item onClick={() => handleSortChange('lastActivity')}>
                  Last Activity
                </DropdownMenu.Item>
                <DropdownMenu.Item onClick={() => handleSortChange('messageCount')}>
                  Message Count
                </DropdownMenu.Item>
                <DropdownMenu.Item onClick={() => handleSortChange('status')}>
                  Status
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
            
            {/* Status filter */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button variant="outline">
                  <Filter className="w-4 h-4 mr-2" />
                  Status
                  {filters.status && <Badge variant="secondary" className="ml-2">1</Badge>}
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="end">
                <DropdownMenu.Item onClick={() => setFilters({ status: undefined })}>
                  All Status
                </DropdownMenu.Item>
                <DropdownMenu.Separator />
                <DropdownMenu.Item onClick={() => setFilters({ status: 'running' })}>
                  Running
                </DropdownMenu.Item>
                <DropdownMenu.Item onClick={() => setFilters({ status: 'paused' })}>
                  Paused
                </DropdownMenu.Item>
                <DropdownMenu.Item onClick={() => setFilters({ status: 'completed' })}>
                  Completed
                </DropdownMenu.Item>
                <DropdownMenu.Item onClick={() => setFilters({ status: 'error' })}>
                  Error
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </div>
        </div>
        
        {/* Sessions Grid/List */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
          {filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">No sessions found</p>
              <p className="text-sm">Create a new session to get started</p>
            </div>
          ) : (
            <div className={cn(
              viewMode === 'grid' 
                ? 'grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                : 'space-y-2'
            )}>
              <AnimatePresence>
                {filteredSessions.map((session, index) => (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2, delay: index * 0.02 }}
                  >
                    {renderSessionCard(session)}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog.Root 
        open={deleteDialogSession !== null} 
        onOpenChange={(open) => !open && setDeleteDialogSession(null)}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50" />
          <AlertDialog.Content className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] z-50 bg-card border rounded-lg shadow-lg p-6 w-full max-w-md">
            <AlertDialog.Title className="text-lg font-semibold mb-2">
              Delete Session
            </AlertDialog.Title>
            <AlertDialog.Description className="text-muted-foreground mb-4">
              Are you sure you want to delete this session? This action cannot be undone.
              {deleteDialogSession && (
                <div className="mt-2 p-2 bg-muted rounded text-sm">
                  <strong>Task:</strong> {deleteDialogSession.initialTask}
                </div>
              )}
            </AlertDialog.Description>
            <div className="flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <Button variant="outline">Cancel</Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button
                  variant="destructive"
                  onClick={() => deleteDialogSession && handleDeleteSession(deleteDialogSession)}
                >
                  Delete
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}