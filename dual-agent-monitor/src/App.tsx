import React, { useState, useEffect } from 'react';
import { Monitor, Plus, RefreshCw, Wifi, WifiOff, BarChart3, Clock, List } from 'lucide-react';
import { DualAgentSession, AgentMessage, WebSocketMessage } from './types';
import { useWebSocket } from './hooks/useWebSocket';
import { apiClient } from './utils/api';
import { MessagePane } from './components/MessagePane';
import { SessionControls } from './components/SessionControls';
import { Timeline } from './components/Timeline';
import { SessionList } from './components/SessionList';
import { PerformanceMetrics } from './components/PerformanceMetrics';
import { formatDate } from './utils/formatters';

type ViewMode = 'dual-pane' | 'timeline' | 'metrics' | 'sessions';

function App() {
  const [sessions, setSessions] = useState<DualAgentSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<DualAgentSession | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('dual-pane');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { isConnected, lastMessage } = useWebSocket('ws://localhost:6003');

  // Load initial sessions
  useEffect(() => {
    loadSessions();
  }, []);

  // Handle WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    handleWebSocketMessage(lastMessage);
  }, [lastMessage]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const sessionsData = await apiClient.getSessions();
      setSessions(sessionsData);
      
      // Auto-select the most recent active session
      const activeSession = sessionsData.find(s => s.status === 'running' || s.status === 'paused');
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
      // The WebSocket will handle the update
    } catch (err) {
      console.error('Error updating session status:', err);
    }
  };

  const createNewSession = async () => {
    const task = prompt('Enter initial task description:');
    if (!task) return;
    
    try {
      const newSession = await apiClient.createSession(task);
      setSessions(prev => [newSession, ...prev]);
      setSelectedSession(newSession);
      setViewMode('dual-pane');
    } catch (err) {
      console.error('Error creating session:', err);
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
              {getViewModeButton('sessions', <List size={18} />, 'Sessions')}
              {getViewModeButton('dual-pane', <Monitor size={18} />, 'Dual Pane')}
              {getViewModeButton('timeline', <Clock size={18} />, 'Timeline')}
              {getViewModeButton('metrics', <BarChart3 size={18} />, 'Metrics')}
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
        {viewMode === 'sessions' ? (
          <div className="w-full">
            <SessionList 
              sessions={sessions}
              selectedSessionId={selectedSession?.id}
              onSelectSession={handleSessionSelect}
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
                />
                <Timeline session={selectedSession} />
              </div>
            )}
            
            {viewMode === 'metrics' && (
              <div className="w-full">
                <SessionControls 
                  session={selectedSession}
                  onStatusChange={handleStatusChange}
                />
                <PerformanceMetrics session={selectedSession} />
              </div>
            )}
          </>
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
  );
}

export default App;