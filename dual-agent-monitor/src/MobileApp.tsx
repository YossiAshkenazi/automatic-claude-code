import React, { useState, useEffect } from 'react';
import { Monitor, Plus, RefreshCw, Wifi, WifiOff, BarChart3, Clock, List, Globe, Network, Activity, Brain, GitBranch, Home } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DualAgentSession, AgentMessage, WebSocketMessage } from './types';
import { useWebSocket } from './hooks/useWebSocket';
import { useMobile } from './hooks/useMobile';
import { apiClient } from './utils/api';
import { formatDate } from './utils/formatters';

// Mobile-optimized components
import { 
  MobileNavigation, 
  MobileDashboard, 
  MobileSessionView, 
  MobileMetrics, 
  MobileReplay 
} from './components/mobile';

// Responsive layout components
import { 
  ResponsiveLayout, 
  ResponsiveCard, 
  BottomNavigation 
} from './components/layout/ResponsiveLayout';

// Desktop components (fallback)
import { MessagePane } from './components/MessagePane';
import { SessionControls } from './components/SessionControls';
import { Timeline } from './components/Timeline';
import { SessionList } from './components/SessionList';
import { PerformanceMetrics } from './components/PerformanceMetrics';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { CrossProjectView } from './components/CrossProjectView';
import { 
  MessageFlowDiagram,
  CommunicationTimeline,
  AgentActivityMonitor,
  CommunicationAnalytics
} from './components/visualization';

type ViewMode = 'dashboard' | 'sessions' | 'dual-pane' | 'timeline' | 'metrics' | 'analytics' | 'cross-project' | 'message-flow' | 'comm-timeline' | 'agent-activity' | 'comm-analytics' | 'replay';

function MobileApp() {
  const [sessions, setSessions] = useState<DualAgentSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<DualAgentSession | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d' | '30d'>('24h');
  const [refreshing, setRefreshing] = useState(false);
  
  // Cross-project state
  const [allEvents, setAllEvents] = useState<any[]>([]);
  const [activeProjects, setActiveProjects] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('all');

  const mobile = useMobile();
  const { isConnected, lastMessage } = useWebSocket('ws://localhost:4005');

  // Load initial data
  useEffect(() => {
    loadSessions();
    loadCrossProjectData();
  }, []);

  // Refresh data periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (viewMode === 'cross-project' || viewMode === 'dashboard') {
        loadCrossProjectData();
      }
    }, 10000);
    
    return () => clearInterval(interval);
  }, [viewMode]);

  // Handle WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    try {
      const message = JSON.parse(lastMessage) as WebSocketMessage;
      handleWebSocketMessage(message);
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }, [lastMessage]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const result = await apiClient.getSessions({
        page: 1,
        limit: 100,
        sortBy: 'lastActivity',
        sortOrder: 'desc'
      });
      setSessions(result.sessions);
      
      // Auto-select the most recent active session
      const activeSession = result.sessions.find(s => s.status === 'running' || s.status === 'paused');
      if (activeSession && !selectedSession) {
        setSelectedSession(activeSession);
      }
    } catch (err) {
      setError('Failed to load sessions');
      console.error('Error loading sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCrossProjectData = async () => {
    try {
      const [events, projects] = await Promise.all([
        apiClient.getRecentEvents(120),
        apiClient.getActiveProjects()
      ]);
      
      setAllEvents(events);
      setActiveProjects(projects);
      
      if (error && error.includes('cross-project')) {
        setError(null);
      }
    } catch (err) {
      console.error('Error loading cross-project data:', err);
      setError('Failed to load cross-project data');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadSessions(),
        loadCrossProjectData()
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleWebSocketMessage = (message: WebSocketMessage) => {
    switch (message.type) {
      case 'new_message':
        const newMessage = message.data as AgentMessage;
        updateSessionWithMessage(newMessage);
        break;
        
      case 'session_update':
        const updatedSession = message.data as DualAgentSession;
        updateSession(updatedSession);
        break;
        
      case 'session_list':
        const sessionList = message.data as DualAgentSession[];
        setSessions(sessionList);
        break;
    }
  };

  const updateSessionWithMessage = (message: AgentMessage) => {
    setSessions(prev => prev.map(session => {
      if (session.id === message.sessionId) {
        const updatedSession = {
          ...session,
          messages: [...session.messages, message],
        };
        
        if (selectedSession?.id === session.id) {
          setSelectedSession(updatedSession);
        }
        
        return updatedSession;
      }
      return session;
    }));
  };

  const updateSession = (updatedSession: DualAgentSession) => {
    setSessions(prev => prev.map(session => 
      session.id === updatedSession.id ? updatedSession : session
    ));
    
    if (selectedSession?.id === updatedSession.id) {
      setSelectedSession(updatedSession);
    }
  };

  const handleSessionSelect = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setSelectedSession(session);
      setViewMode(mobile.isMobile ? 'dual-pane' : 'dual-pane');
    }
  };

  const handleStatusChange = async (sessionId: string, status: DualAgentSession['status']) => {
    try {
      await apiClient.updateSessionStatus(sessionId, status);
      setSessions(prev => prev.map(session => 
        session.id === sessionId ? { ...session, status } : session
      ));
      
      if (selectedSession?.id === sessionId) {
        setSelectedSession(prev => prev ? { ...prev, status } : null);
      }
    } catch (err) {
      console.error('Error updating session status:', err);
      setError(`Failed to update session status: ${err}`);
    }
  };

  const createNewSession = async () => {
    const task = prompt('Enter initial task description:');
    if (!task) return;
    
    const workDir = prompt('Working directory (optional):', process.cwd?.() || '') || undefined;
    
    try {
      const newSession = await apiClient.createSession(task, workDir);
      setSessions(prev => [newSession, ...prev]);
      setSelectedSession(newSession);
      setViewMode('dual-pane');
    } catch (err) {
      console.error('Error creating session:', err);
      setError(`Failed to create session: ${err}`);
    }
  };

  const handleExportSession = async (sessionId: string) => {
    try {
      await apiClient.exportSession(sessionId, { format: 'json', includeMetadata: true });
    } catch (err) {
      console.error('Error exporting session:', err);
      setError(`Failed to export session: ${err}`);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this session? This action cannot be undone.')) {
      return;
    }

    try {
      await apiClient.deleteSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      
      if (selectedSession?.id === sessionId) {
        setSelectedSession(null);
        setViewMode('dashboard');
      }
    } catch (err) {
      console.error('Error deleting session:', err);
      setError(`Failed to delete session: ${err}`);
    }
  };

  // Bottom navigation items for mobile
  const bottomNavItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <Home size={20} />,
      badge: 0
    },
    {
      id: 'sessions',
      label: 'Sessions',
      icon: <List size={20} />,
      badge: sessions.filter(s => s.status === 'running').length
    },
    {
      id: 'metrics',
      label: 'Metrics',
      icon: <BarChart3 size={20} />,
      badge: 0
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: <Activity size={20} />,
      badge: 0
    },
    {
      id: 'cross-project',
      label: 'Projects',
      icon: <Globe size={20} />,
      badge: activeProjects.length
    }
  ];

  const renderMobileContent = () => {
    switch (viewMode) {
      case 'dashboard':
        return (
          <MobileDashboard
            sessions={sessions}
            selectedSession={selectedSession}
            isConnected={isConnected}
            onSessionSelect={handleSessionSelect}
          />
        );
        
      case 'sessions':
        return (
          <MobileSessionView
            sessions={sessions}
            selectedSessionId={selectedSession?.id}
            onSelectSession={handleSessionSelect}
            onStatusChange={handleStatusChange}
            onExportSession={handleExportSession}
            onDeleteSession={handleDeleteSession}
            loading={loading}
          />
        );
        
      case 'metrics':
        return (
          <MobileMetrics
            sessions={sessions}
            selectedSession={selectedSession}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        );
        
      case 'replay':
        return selectedSession ? (
          <MobileReplay
            session={selectedSession}
            onClose={() => setViewMode('dashboard')}
          />
        ) : null;
        
      case 'cross-project':
        return (
          <div className="p-4">
            <CrossProjectView
              events={allEvents}
              activeProjects={activeProjects}
              selectedProject={selectedProject}
              onProjectChange={setSelectedProject}
              onRefresh={loadCrossProjectData}
            />
          </div>
        );
        
      case 'analytics':
        return (
          <div className="p-4">
            <AnalyticsDashboard
              sessionIds={sessions.map(s => s.id)}
              selectedSessionId={selectedSession?.id}
              onSessionSelect={handleSessionSelect}
            />
          </div>
        );
        
      case 'dual-pane':
        if (!selectedSession) {
          return (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <Monitor size={48} className="mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium mb-2 text-gray-900">No session selected</h3>
                <p className="text-sm text-gray-500">Select a session to view details</p>
              </div>
            </div>
          );
        }
        
        return (
          <div className="flex flex-col h-full">
            <div className="p-4 bg-white border-b border-gray-200">
              <SessionControls 
                session={selectedSession}
                onStatusChange={handleStatusChange}
                onExport={() => handleExportSession(selectedSession.id)}
                onDelete={() => handleDeleteSession(selectedSession.id)}
              />
            </div>
            
            <div className="flex-1 overflow-hidden">
              {/* Mobile: Stack agents vertically */}
              <div className="h-full flex flex-col">
                <div className="flex-1 border-b border-gray-200">
                  <MessagePane
                    agentType="manager"
                    messages={selectedSession.messages}
                    session={selectedSession}
                  />
                </div>
                <div className="flex-1">
                  <MessagePane
                    agentType="worker"
                    messages={selectedSession.messages}
                    session={selectedSession}
                  />
                </div>
              </div>
            </div>
          </div>
        );
        
      default:
        return (
          <div className="p-4">
            <p className="text-center text-gray-500">View not implemented for mobile</p>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-600">
          <RefreshCw className="animate-spin" size={20} />
          Loading...
        </div>
      </div>
    );
  }

  // Mobile layout
  if (mobile.isMobile) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col pb-16">
        {/* Error Banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mx-4 mt-4 rounded-lg"
            >
              <p className="text-sm">{error}</p>
              <button
                onClick={() => setError(null)}
                className="mt-2 text-xs text-red-600 underline"
              >
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={viewMode}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              {renderMobileContent()}
            </motion.div>
          </AnimatePresence>
        </div>
        
        {/* Bottom Navigation */}
        <BottomNavigation
          items={bottomNavItems}
          activeItem={viewMode}
          onItemSelect={(id) => setViewMode(id as ViewMode)}
        />
        
        {/* Floating Action Button */}
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={createNewSession}
          className="fixed bottom-20 right-4 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center z-50"
        >
          <Plus size={24} />
        </motion.button>
      </div>
    );
  }

  // Fallback to desktop layout for tablet/desktop
  return (
    <ResponsiveLayout
      currentView={viewMode as any}
      onViewChange={setViewMode as any}
      isConnected={isConnected}
      selectedSessionTitle={selectedSession?.initialTask}
      onRefresh={handleRefresh}
    >
      {/* Desktop/Tablet content would go here - use existing App.tsx content */}
      <div className="p-6">
        <p className="text-center text-gray-500">Desktop/Tablet view - implement existing App.tsx logic</p>
      </div>
    </ResponsiveLayout>
  );
}

export default MobileApp;