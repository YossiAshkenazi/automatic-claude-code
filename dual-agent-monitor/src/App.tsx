import React, { useState, useEffect } from 'react';
import { Monitor, Plus, RefreshCw, Wifi, WifiOff, BarChart3, Clock, List, Globe, Network, Activity, Brain, GitBranch } from 'lucide-react';
import { DualAgentSession, AgentMessage, WebSocketMessage } from './types';
import { useWebSocket } from './hooks/useWebSocket';
import { useMobile } from './hooks/useMobile';
import { usePWA } from './hooks/usePWA';
import { apiClient } from './utils/api';
import { formatDate } from './utils/formatters';

// Mobile-optimized components
import MobileApp from './MobileApp';

// Desktop components
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

// Responsive layout
import { ResponsiveLayout } from './components/layout/ResponsiveLayout';

type ViewMode = 'dual-pane' | 'timeline' | 'metrics' | 'analytics' | 'sessions' | 'cross-project' | 'message-flow' | 'comm-timeline' | 'agent-activity' | 'comm-analytics';

function App() {
  const mobile = useMobile();
  const pwa = usePWA();
  
  // If mobile device, use mobile-optimized app
  if (mobile.isMobile) {
    return <MobileApp />;
  }
  const [sessions, setSessions] = useState<DualAgentSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<DualAgentSession | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('cross-project');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Cross-project state
  const [allEvents, setAllEvents] = useState<any[]>([]);
  const [activeProjects, setActiveProjects] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('all');

  const { isConnected, lastMessage } = useWebSocket('ws://localhost:4007');

  // Load initial data
  useEffect(() => {
    loadSessions();
    loadCrossProjectData();
  }, []);

  // Refresh cross-project data every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (viewMode === 'cross-project') {
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
      // Use enhanced pagination with sorting by lastActivity
      const result = await apiClient.getSessions({
        page: 1,
        limit: 50,
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
        apiClient.getRecentEvents(120), // Last 2 hours
        apiClient.getActiveProjects()
      ]);
      
      setAllEvents(events);
      setActiveProjects(projects);
      
      // Reset error on successful load
      if (error && error.includes('cross-project')) {
        setError(null);
      }
    } catch (err) {
      console.error('Error loading cross-project data:', err);
      setError('Failed to load cross-project data - check if observability server is running');
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
        
      default:
        console.log('Unknown message type:', message.type);
    }
  };

  const updateSessionWithMessage = (message: AgentMessage) => {
    setSessions(prev => prev.map(session => {
      if (session.id === message.sessionId) {
        const updatedSession = {
          ...session,
          messages: [...session.messages, message],
        };
        
        // Update selected session if it matches
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
      setViewMode('dual-pane');
    }
  };

  const handleStatusChange = async (sessionId: string, status: DualAgentSession['status']) => {
    try {
      await apiClient.updateSessionStatus(sessionId, status);
      // Immediately update local state for better UX
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
        setViewMode('sessions');
      }
    } catch (err) {
      console.error('Error deleting session:', err);
      setError(`Failed to delete session: ${err}`);
    }
  };

  const getViewModeButton = (mode: ViewMode, icon: React.ReactNode, label: string) => (
    <button
      onClick={() => setViewMode(mode)}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
        viewMode === mode
          ? 'bg-blue-100 text-blue-700'
          : 'hover:bg-gray-100 text-gray-600'
      }`}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  );

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

  return (
    <ResponsiveLayout
      currentView={viewMode as any}
      onViewChange={setViewMode as any}
      isConnected={isConnected}
      selectedSessionTitle={selectedSession?.initialTask}
      onRefresh={async () => {
        await Promise.all([loadSessions(), loadCrossProjectData()]);
      }}
      showHeader={true}
    >
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Monitor className="text-blue-600" size={24} />
            <h1 className="text-xl font-semibold text-gray-900">
              Dual-Agent Claude Code Monitor
            </h1>
            <div className={`flex items-center gap-2 px-2 py-1 rounded-full text-xs ${
              isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
              {isConnected ? 'Connected' : 'Disconnected'}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* View Mode Buttons */}
            <div className="flex items-center gap-1 mr-4">
              {getViewModeButton('cross-project', <Globe size={18} />, 'All Projects')}
              {getViewModeButton('sessions', <List size={18} />, 'Sessions')}
              {getViewModeButton('dual-pane', <Monitor size={18} />, 'Dual Pane')}
              {getViewModeButton('timeline', <Clock size={18} />, 'Timeline')}
              {getViewModeButton('analytics', <BarChart3 size={18} />, 'Analytics')}
              {getViewModeButton('message-flow', <Network size={18} />, 'Message Flow')}
              {getViewModeButton('comm-timeline', <GitBranch size={18} />, 'Comm Timeline')}
              {getViewModeButton('agent-activity', <Activity size={18} />, 'Agent Activity')}
              {getViewModeButton('comm-analytics', <Brain size={18} />, 'Comm Analytics')}
              {getViewModeButton('metrics', <BarChart3 size={18} />, 'Legacy Metrics')}
            </div>
            
            <button
              onClick={createNewSession}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Plus size={18} />
              <span className="hidden md:inline">New Session</span>
            </button>
            
            <button
              onClick={loadSessions}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh sessions"
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>
        
        {selectedSession && viewMode !== 'sessions' && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-medium text-gray-900">
                  {selectedSession.initialTask}
                </h2>
                <p className="text-sm text-gray-500">
                  Started {formatDate(selectedSession.startTime)} • {selectedSession.workDir}
                </p>
              </div>
              <div className="text-right text-sm text-gray-500">
                <div>Session ID: {selectedSession.id}</div>
                <div>{selectedSession.messages.length} messages</div>
              </div>
            </div>
          </div>
        )}
      </header>

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4">
          <p>{error}</p>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex">
        {viewMode === 'cross-project' ? (
          <div className="w-full">
            <CrossProjectView
              events={allEvents}
              activeProjects={activeProjects}
              selectedProject={selectedProject}
              onProjectChange={setSelectedProject}
              onRefresh={loadCrossProjectData}
            />
          </div>
        ) : viewMode === 'sessions' ? (
          <div className="w-full">
            <SessionList 
              sessions={sessions}
              selectedSessionId={selectedSession?.id}
              onSelectSession={handleSessionSelect}
              onExportSession={handleExportSession}
              showPersistenceStatus={true}
            />
          </div>
        ) : selectedSession ? (
          <>
            {viewMode === 'dual-pane' && (
              <>
                {/* Session Controls */}
                <div className="w-full">
                  <SessionControls 
                    session={selectedSession}
                    onStatusChange={handleStatusChange}
                    onExport={() => handleExportSession(selectedSession.id)}
                    onDelete={() => handleDeleteSession(selectedSession.id)}
                  />
                  
                  <div className="flex h-[calc(100vh-200px)]">
                    {/* Left Pane - Manager */}
                    <div className="w-1/2 border-r border-gray-200">
                      <MessagePane
                        agentType="manager"
                        messages={selectedSession.messages}
                        session={selectedSession}
                      />
                    </div>
                    
                    {/* Right Pane - Worker */}
                    <div className="w-1/2">
                      <MessagePane
                        agentType="worker"
                        messages={selectedSession.messages}
                        session={selectedSession}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
            
            {viewMode === 'timeline' && (
              <div className="w-full">
                <SessionControls 
                  session={selectedSession}
                  onStatusChange={handleStatusChange}
                  onExport={() => handleExportSession(selectedSession.id)}
                  onDelete={() => handleDeleteSession(selectedSession.id)}
                />
                <Timeline session={selectedSession} />
              </div>
            )}
            
            {viewMode === 'analytics' && (
              <div className="w-full">
                <div className="p-6">
                  <AnalyticsDashboard
                    sessionIds={selectedSession ? [selectedSession.id] : sessions.map(s => s.id)}
                    selectedSessionId={selectedSession?.id}
                    onSessionSelect={handleSessionSelect}
                  />
                </div>
              </div>
            )}
            
            {viewMode === 'metrics' && (
              <div className="w-full">
                <SessionControls 
                  session={selectedSession}
                  onStatusChange={handleStatusChange}
                  onExport={() => handleExportSession(selectedSession.id)}
                  onDelete={() => handleDeleteSession(selectedSession.id)}
                />
                <PerformanceMetrics session={selectedSession} />
              </div>
            )}
            
            {viewMode === 'message-flow' && (
              <div className="w-full">
                <SessionControls 
                  session={selectedSession}
                  onStatusChange={handleStatusChange}
                  onExport={() => handleExportSession(selectedSession.id)}
                  onDelete={() => handleDeleteSession(selectedSession.id)}
                />
                <div className="p-6 h-[calc(100vh-200px)]">
                  <MessageFlowDiagram
                    session={selectedSession}
                    messages={selectedSession.messages}
                    isRealTime={isConnected}
                    onMessageSelect={(messageId) => console.log('Selected message:', messageId)}
                    showFilters={true}
                  />
                </div>
              </div>
            )}
            
            {viewMode === 'comm-timeline' && (
              <div className="w-full">
                <SessionControls 
                  session={selectedSession}
                  onStatusChange={handleStatusChange}
                  onExport={() => handleExportSession(selectedSession.id)}
                  onDelete={() => handleDeleteSession(selectedSession.id)}
                />
                <div className="p-6">
                  <CommunicationTimeline
                    session={selectedSession}
                    messages={selectedSession.messages}
                    isRealTime={isConnected}
                    onMessageSelect={(messageId) => console.log('Selected message:', messageId)}
                    height={600}
                  />
                </div>
              </div>
            )}
            
            {viewMode === 'agent-activity' && (
              <div className="w-full">
                <SessionControls 
                  session={selectedSession}
                  onStatusChange={handleStatusChange}
                  onExport={() => handleExportSession(selectedSession.id)}
                  onDelete={() => handleDeleteSession(selectedSession.id)}
                />
                <div className="p-6">
                  <AgentActivityMonitor
                    session={selectedSession}
                    messages={selectedSession.messages}
                    isRealTime={isConnected}
                    refreshInterval={5000}
                  />
                </div>
              </div>
            )}
            
            {viewMode === 'comm-analytics' && (
              <div className="w-full">
                <SessionControls 
                  session={selectedSession}
                  onStatusChange={handleStatusChange}
                  onExport={() => handleExportSession(selectedSession.id)}
                  onDelete={() => handleDeleteSession(selectedSession.id)}
                />
                <div className="p-6">
                  <CommunicationAnalytics
                    session={selectedSession}
                    messages={selectedSession.messages}
                    comparisonSessions={sessions.filter(s => s.id !== selectedSession.id)}
                  />
                </div>
              </div>
            )}
          </>
        ) : viewMode === 'analytics' ? (
          <div className="w-full">
            <div className="p-6">
              <AnalyticsDashboard
                sessionIds={sessions.map(s => s.id)}
                selectedSessionId={selectedSession?.id}
                onSessionSelect={handleSessionSelect}
              />
            </div>
          </div>
        ) : (
          <div className="w-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Monitor size={48} className="mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">No session selected</h3>
              <p className="text-sm">Select a session from the list or create a new one to start monitoring</p>
            </div>
          </div>
        )}
      </main>
    </div>
    </ResponsiveLayout>
  );
}

export default App;