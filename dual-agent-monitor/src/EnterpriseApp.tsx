import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './components/ui/ThemeProvider';
import { Toaster } from './components/ui/Toaster';
import { Sidebar } from './components/ui/Sidebar';
import { Header } from './components/layout/Header';
import { ResizablePanels, VerticalResizablePanels } from './components/layout/ResizablePanels';
import { EnhancedSessionList } from './components/enhanced/EnhancedSessionList';
import { EnhancedMessagePane } from './components/enhanced/EnhancedMessagePane';
import { EnhancedPerformanceMetrics } from './components/enhanced/EnhancedPerformanceMetrics';
import { useSessionStore } from './store/useSessionStore';
import { useWebSocket } from './hooks/useWebSocket';
import { WebSocketMessage } from './types';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, WifiOff, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/Card';
import { Badge } from './components/ui/Badge';
import { LoadingState, LoadingSpinner, CardSkeleton } from './components/ui/LoadingSpinner';
import { EmptyState } from './components/ui/EmptyState';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { cn } from './lib/utils';
import { toast } from 'sonner';

type ViewMode = 'overview' | 'sessions' | 'dual-pane' | 'timeline' | 'metrics' | 'agents';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
    },
  },
});

function EnterpriseAppInner() {
  const [currentView, setCurrentView] = useState<ViewMode>('overview');
  const [sidebarPath, setSidebarPath] = useState('/overview');
  
  const {
    sessions,
    selectedSession,
    isLoading,
    isLoadingSessions,
    isCreatingSession,
    error,
    connectionError,
    isConnected,
    lastConnectionTime,
    loadSessions,
    setSelectedSession,
    handleWebSocketMessage,
    setConnectionStatus,
    clearError,
  } = useSessionStore();

  const { 
    lastMessage, 
    connectionStatus, 
    lastError: wsError,
    isConnecting,
    hasError: wsHasError,
    canReconnect,
    reconnect: reconnectWs,
    reconnectAttempts,
    maxReconnectAttempts
  } = useWebSocket(`ws://${window.location.host}/ws`, {
    onOpen: () => {
      // Refresh sessions when connection is established
      if (sessions.length === 0) {
        loadSessions();
      }
    },
    onError: (error) => {
      console.error('WebSocket error:', error);
    }
  });

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      try {
        const message: WebSocketMessage = JSON.parse(lastMessage);
        handleWebSocketMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    }
  }, [lastMessage, handleWebSocketMessage]);

  // Handle connection status changes
  useEffect(() => {
    setConnectionStatus(connectionStatus === 'Open');
  }, [connectionStatus, setConnectionStatus]);

  // Load initial data
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Handle sidebar navigation
  const handleSidebarNavigation = (path: string) => {
    setSidebarPath(path);
    
    // Map paths to view modes
    if (path === '/overview') setCurrentView('overview');
    else if (path === '/sessions') setCurrentView('sessions');
    else if (path.startsWith('/agents')) setCurrentView('agents');
    else if (path.startsWith('/analytics/performance')) setCurrentView('metrics');
    else if (path.startsWith('/analytics/timeline')) setCurrentView('timeline');
    else setCurrentView('overview');
  };

  const handleSelectSession = (sessionId: string) => {
    setSelectedSession(sessionId);
    if (currentView === 'sessions') {
      setCurrentView('dual-pane');
    }
  };

  const renderMainContent = () => {
    // Show loading state when initially loading sessions
    if (isLoadingSessions && (!sessions || sessions.length === 0)) {
      return (
        <div className="flex-1 p-6">
          <LoadingState 
            title="Loading sessions..." 
            description="Fetching your dual-agent monitoring sessions"
          />
        </div>
      );
    }

    // Show error state for critical errors
    if (error && (!sessions || sessions.length === 0)) {
      return (
        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="w-5 h-5" />
                {connectionError ? 'Connection Error' : 'Error'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">{error}</p>
              <div className="flex gap-2">
                <Button 
                  onClick={loadSessions} 
                  disabled={isLoadingSessions}
                  className="flex-1"
                >
                  {isLoadingSessions ? (
                    <LoadingSpinner size="sm" className="mr-2" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Retry
                </Button>
                <Button variant="outline" onClick={clearError}>
                  Dismiss
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    switch (currentView) {
      case 'overview':
        return (
          <div className="flex-1 p-6 space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                      <motion.div
                        animate={{
                          scale: sessions && sessions.filter(s => s.status === 'running').length > 0 ? [1, 1.1, 1] : 1
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="w-6 h-6 bg-blue-600 rounded-full"
                      />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{sessions ? sessions.filter(s => s.status === 'running').length : 0}</p>
                      <p className="text-sm text-muted-foreground">Active Sessions</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                      <div className="w-6 h-6 bg-green-600 rounded-full" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{sessions ? sessions.filter(s => s.status === 'completed').length : 0}</p>
                      <p className="text-sm text-muted-foreground">Completed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                      <div className="w-6 h-6 bg-purple-600 rounded-full" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{sessions ? sessions.reduce((acc, s) => acc + (s.messages?.length || 0), 0) : 0}</p>
                      <p className="text-sm text-muted-foreground">Total Messages</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-lg",
                      isConnected 
                        ? "bg-green-100 dark:bg-green-900/20" 
                        : "bg-red-100 dark:bg-red-900/20"
                    )}>
                      <div className={cn(
                        "w-6 h-6 rounded-full",
                        isConnected ? "bg-green-600 animate-pulse" : "bg-red-600"
                      )} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {isConnected ? 'Connected' : 'Disconnected'}
                      </p>
                      <p className="text-xs text-muted-foreground">WebSocket Status</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Sessions & Performance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Recent Sessions</CardTitle>
                  {isLoadingSessions && (
                    <LoadingSpinner size="sm" />
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {isLoadingSessions && sessions.length === 0 ? (
                      // Show skeleton while loading
                      Array.from({ length: 3 }, (_, i) => (
                        <CardSkeleton key={i} showActions={false} lines={1} />
                      ))
                    ) : sessions && sessions.length > 0 ? (
                      sessions.slice(0, 5).map(session => (
                        <div 
                          key={session.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                          onClick={() => {
                            setSelectedSession(session.id);
                            setCurrentView('dual-pane');
                          }}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{session.initialTask}</p>
                            <p className="text-sm text-muted-foreground">{session.messages?.length || 0} messages</p>
                          </div>
                          <Badge variant={
                            session.status === 'running' ? 'success' :
                            session.status === 'completed' ? 'secondary' :
                            session.status === 'error' ? 'error' : 'warning'
                          }>
                            {session.status}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <EmptyState
                        title="No sessions yet"
                        description="Create your first dual-agent session to get started"
                        size="sm"
                        action={{
                          label: 'Create Session',
                          onClick: () => {
                            // TODO: Implement session creation
                            toast.info('Session creation coming soon!');
                          }
                        }}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>

              <EnhancedPerformanceMetrics className="!p-0 !space-y-0" />
            </div>
          </div>
        );

      case 'sessions':
        return (
          <div className="flex-1">
            {isLoadingSessions && sessions.length === 0 ? (
              <div className="p-6">
                <LoadingState 
                  title="Loading sessions..." 
                  description="Fetching your monitoring sessions"
                />
              </div>
            ) : (
              <EnhancedSessionList 
                onSelectSession={handleSelectSession}
                className="flex-1"
              />
            )}
          </div>
        );

      case 'dual-pane':
        if (!selectedSession) {
          return (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                title="No session selected"
                description="Select a session to view dual-agent communication and message timeline"
                action={{
                  label: 'Browse Sessions',
                  onClick: () => setCurrentView('sessions')
                }}
              />
            </div>
          );
        }
        
        return (
          <div className="flex-1 flex flex-col">
            <ResizablePanels
              leftPanel={
                <EnhancedMessagePane
                  agentType="manager"
                  messages={selectedSession?.messages || []}
                  session={selectedSession}
                  className="h-full"
                />
              }
              rightPanel={
                <EnhancedMessagePane
                  agentType="worker"
                  messages={selectedSession?.messages || []}
                  session={selectedSession}
                  className="h-full"
                />
              }
              className="flex-1"
            />
          </div>
        );

      case 'timeline':
        if (!selectedSession) {
          return (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                title="No session selected"
                description="Select a session to view the complete message timeline"
                action={{
                  label: 'Browse Sessions',
                  onClick: () => setCurrentView('sessions')
                }}
              />
            </div>
          );
        }
        
        return (
          <EnhancedMessagePane
            agentType="all"
            messages={selectedSession?.messages || []}
            session={selectedSession}
            className="flex-1"
          />
        );

      case 'metrics':
        return <EnhancedPerformanceMetrics className="flex-1" />;

      case 'agents':
        return (
          <div className="flex-1 p-6">
            <EmptyState
              title="Agent Management"
              description="Advanced agent configuration and monitoring capabilities are coming soon"
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        currentPath={sidebarPath}
        onNavigate={handleSidebarNavigation}
      />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          currentView={currentView}
          onViewChange={(view) => setCurrentView(view as ViewMode)}
        />
        
        <main className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {renderMainContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      
      {/* Connection Status Indicators */}
      <AnimatePresence>
        {/* Connection Lost */}
        {!isConnected && !isConnecting && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-4 right-4 z-50"
          >
            <Card className="bg-destructive/10 border-destructive/20">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-destructive">
                    <WifiOff className="w-4 h-4" />
                    <div>
                      <div className="text-sm font-medium">Connection Lost</div>
                      {wsError && (
                        <div className="text-xs opacity-80">{wsError}</div>
                      )}
                      {reconnectAttempts > 0 && (
                        <div className="text-xs opacity-80">
                          Attempt {reconnectAttempts}/{maxReconnectAttempts}
                        </div>
                      )}
                    </div>
                  </div>
                  {canReconnect && (
                    <Button size="sm" variant="outline" onClick={reconnectWs}>
                      Retry
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
        
        {/* Connecting */}
        {isConnecting && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-4 right-4 z-50"
          >
            <Card className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
                  <LoadingSpinner size="sm" />
                  <span className="text-sm font-medium">Connecting...</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function EnterpriseApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="dual-agent-monitor-theme">
        <ErrorBoundary 
          showDetails={process.env.NODE_ENV === 'development'}
          onError={(error, errorInfo) => {
            console.error('Application Error:', error, errorInfo);
            // TODO: Send to error reporting service
          }}
        >
          <EnterpriseAppInner />
          <Toaster />
        </ErrorBoundary>
      </ThemeProvider>
    </QueryClientProvider>
  );
}