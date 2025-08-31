import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Plus,
  RefreshCw,
  Settings,
  Download,
  Filter,
  Bell,
  Wifi,
  WifiOff,
  MoreHorizontal,
  Monitor,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { ThemeToggle } from '../ui/ThemeToggle';
import { useSessionStore } from '../../store/useSessionStore';
import { toast } from 'sonner';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '../../lib/utils';

interface HeaderProps {
  currentView?: string;
  onViewChange?: (view: string) => void;
  className?: string;
}

export function Header({ currentView = 'overview', onViewChange, className }: HeaderProps) {
  const {
    isConnected,
    sessions,
    selectedSession,
    filters,
    setFilters,
    loadSessions,
    createSession,
    exportSession,
    isLoading,
  } = useSessionStore();

  const [searchTerm, setSearchTerm] = useState(filters.searchTerm || '');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const activeSessions = sessions.filter(s => s.status === 'running').length;
  const totalMessages = sessions.reduce((acc, session) => acc + session.messages.length, 0);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setFilters({ searchTerm: value || undefined });
  };

  const handleCreateSession = async () => {
    if (!newTaskDescription.trim()) {
      toast.error('Please enter a task description');
      return;
    }

    try {
      await createSession(newTaskDescription);
      setIsCreateDialogOpen(false);
      setNewTaskDescription('');
      toast.success('Session created successfully');
    } catch (error) {
      toast.error('Failed to create session');
    }
  };

  const handleExportAll = async (format: 'json' | 'csv') => {
    try {
      const allData = {
        sessions,
        exportDate: new Date().toISOString(),
        totalSessions: sessions.length,
        totalMessages,
      };

      if (format === 'json') {
        const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `dual-agent-monitor-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        // Export messages from all sessions as CSV
        const allMessages = sessions.flatMap(session =>
          session.messages.map(msg => ({
            sessionId: session.id,
            sessionTask: session.initialTask,
            timestamp: msg.timestamp,
            agentType: msg.agentType,
            messageType: msg.messageType,
            content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
          }))
        );

        const headers = Object.keys(allMessages[0] || {});
        const csvContent = [
          headers.join(','),
          ...allMessages.map(row =>
            headers.map(header => `"${row[header as keyof typeof row] || ''}"`).join(',')
          )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `dual-agent-monitor-messages-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      toast.success(`Data exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error('Export failed');
    }
  };

  return (
    <>
      <header className={cn('bg-card border-b border-border shadow-sm', className)}>
        <div className="px-6 py-4">
          {/* Top row */}
          <div className="flex items-center justify-between">
            {/* Left section */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary rounded-lg">
                  <Monitor className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground">
                    Dual-Agent Monitor
                  </h1>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{sessions.length} sessions</span>
                    <span>{totalMessages} messages</span>
                    <div className="flex items-center gap-1">
                      <div
                        className={cn(
                          'w-2 h-2 rounded-full',
                          isConnected
                            ? 'bg-success-500 animate-pulse'
                            : 'bg-error-500'
                        )}
                      />
                      <span className={isConnected ? 'text-success-600' : 'text-error-600'}>
                        {isConnected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {activeSessions > 0 && (
                <Badge variant="success" className="animate-pulse">
                  {activeSessions} active
                </Badge>
              )}
            </div>

            {/* Right section */}
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search sessions..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>

              {/* Filter toggle */}
              <Button
                variant={Object.keys(filters).length > 1 ? 'default' : 'ghost'}
                size="icon"
                onClick={() => setIsFilterOpen(!isFilterOpen)}
              >
                <Filter className="h-4 w-4" />
              </Button>

              {/* Refresh */}
              <Button
                variant="ghost"
                size="icon"
                onClick={loadSessions}
                disabled={isLoading}
              >
                <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
              </Button>

              {/* Export dropdown */}
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <Button variant="ghost" size="icon">
                    <Download className="h-4 w-4" />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="end" className="w-48">
                  <DropdownMenu.Item onClick={() => handleExportAll('json')}>
                    <Download className="mr-2 h-4 w-4" />
                    Export as JSON
                  </DropdownMenu.Item>
                  <DropdownMenu.Item onClick={() => handleExportAll('csv')}>
                    <Download className="mr-2 h-4 w-4" />
                    Export as CSV
                  </DropdownMenu.Item>
                  {selectedSession && (
                    <>
                      <DropdownMenu.Separator />
                      <DropdownMenu.Item
                        onClick={() => exportSession(selectedSession.id, 'json')}
                      >
                        Export Current Session (JSON)
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        onClick={() => exportSession(selectedSession.id, 'csv')}
                      >
                        Export Current Session (CSV)
                      </DropdownMenu.Item>
                    </>
                  )}
                </DropdownMenu.Content>
              </DropdownMenu.Root>

              {/* Theme toggle */}
              <ThemeToggle />

              {/* Create new session */}
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Session
              </Button>

              {/* More actions */}
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="end">
                  <DropdownMenu.Item>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenu.Item>
                  <DropdownMenu.Item>
                    <Bell className="mr-2 h-4 w-4" />
                    Notifications
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator />
                  <DropdownMenu.Item>
                    About
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Root>
            </div>
          </div>

          {/* Selected session info */}
          {selectedSession && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4 p-3 bg-muted/30 rounded-lg border"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground truncate">
                    {selectedSession.initialTask}
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                    <span>ID: {selectedSession.id}</span>
                    <span>{selectedSession.messages.length} messages</span>
                    <span>Started: {new Date(selectedSession.startTime).toLocaleString()}</span>
                    <Badge
                      variant={
                        selectedSession.status === 'running'
                          ? 'success'
                          : selectedSession.status === 'error'
                          ? 'error'
                          : 'secondary'
                      }
                    >
                      {selectedSession.status}
                    </Badge>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </header>

      {/* Create Session Dialog */}
      <Dialog.Root open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] z-50 bg-card border rounded-lg shadow-lg p-6 w-full max-w-md">
            <Dialog.Title className="text-lg font-semibold mb-4">
              Create New Session
            </Dialog.Title>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Task Description
                </label>
                <textarea
                  value={newTaskDescription}
                  onChange={(e) => setNewTaskDescription(e.target.value)}
                  placeholder="Describe what you want the dual agents to work on..."
                  className="w-full h-24 px-3 py-2 border border-input rounded-md resize-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateSession}>
                  Create Session
                </Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}