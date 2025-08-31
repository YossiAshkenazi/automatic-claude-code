import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Play, Pause, Square, SkipBack, SkipForward, Settings, Bookmark, MessageSquare, Clock, Users } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { ReplayControls } from './ReplayControls';
import { ReplayTimeline } from './ReplayTimeline';
import { ReplayMetadata } from './ReplayMetadata';
import { MessagePane } from '../MessagePane';
import { apiClient } from '../../utils/api';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Badge } from '../ui/Badge';
import { formatRelativeTime, formatDuration } from '../../utils/formatters';

interface ReplayState {
  sessionId: string;
  currentIndex: number;
  totalEvents: number;
  isPlaying: boolean;
  playbackSpeed: number;
  timeline: Array<{
    id: string;
    timestamp: Date;
    type: 'message' | 'communication' | 'system_event' | 'performance_metric';
    data: any;
    index: number;
  }>;
  bookmarks: Array<{
    id: string;
    timestamp: Date;
    title: string;
    description?: string;
    tags: string[];
  }>;
  annotations: Array<{
    id: string;
    timestamp: Date;
    content: string;
    author: string;
  }>;
  segments: Array<{
    id: string;
    title: string;
    startTime: Date;
    endTime: Date;
    highlightColor?: string;
  }>;
}

interface SessionReplayPlayerProps {
  sessionId: string;
  onClose?: () => void;
  showCollaborativeFeatures?: boolean;
  isEmbedded?: boolean;
}

export function SessionReplayPlayer({ 
  sessionId, 
  onClose, 
  showCollaborativeFeatures = false,
  isEmbedded = false 
}: SessionReplayPlayerProps) {
  const [replayId, setReplayId] = useState<string | null>(null);
  const [replayState, setReplayState] = useState<ReplayState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [selectedView, setSelectedView] = useState<'timeline' | 'step' | 'comparison'>('timeline');
  const [showSettings, setShowSettings] = useState(false);
  const [collaborators, setCollaborators] = useState<string[]>([]);
  
  // WebSocket for real-time collaboration
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  // Initialize replay session
  useEffect(() => {
    initializeReplay();
    return () => {
      if (replayId) {
        cleanup();
      }
    };
  }, [sessionId]);

  // WebSocket connection for collaborative features
  useEffect(() => {
    if (replayId && showCollaborativeFeatures) {
      connectWebSocket();
      return () => {
        disconnectWebSocket();
      };
    }
  }, [replayId, showCollaborativeFeatures]);

  const initializeReplay = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.post(`/api/replay/sessions/${sessionId}/prepare`, {
        includeMetrics: true,
        includeCommunications: true,
        includeSystemEvents: true
      });
      
      setReplayId(response.data.replayId);
      setReplayState(response.data.state);
      setMetadata(response.data.metadata);
      
      // Load initial collaborative data
      if (showCollaborativeFeatures) {
        const collabResponse = await apiClient.get(`/api/replay/${response.data.replayId}/collaborators`);
        setCollaborators(collabResponse.data.collaborators || []);
      }
      
    } catch (err: any) {
      setError(err.message || 'Failed to initialize replay session');
    } finally {
      setIsLoading(false);
    }
  };

  const cleanup = async () => {
    if (replayId) {
      try {
        await apiClient.delete(`/api/replay/${replayId}`);
      } catch (err) {
        console.error('Failed to cleanup replay session:', err);
      }
    }
    disconnectWebSocket();
  };

  const connectWebSocket = () => {
    const wsUrl = `ws://${window.location.host}/replay/${replayId}`;
    wsRef.current = new WebSocket(wsUrl);
    
    wsRef.current.onopen = () => {
      console.log('Replay WebSocket connected');
    };
    
    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleWebSocketMessage(data);
    };
    
    wsRef.current.onclose = () => {
      console.log('Replay WebSocket disconnected');
      // Auto-reconnect
      reconnectTimeoutRef.current = setTimeout(() => {
        if (showCollaborativeFeatures) {
          connectWebSocket();
        }
      }, 5000);
    };
    
    wsRef.current.onerror = (error) => {
      console.error('Replay WebSocket error:', error);
    };
  };

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
  };

  const handleWebSocketMessage = (data: any) => {
    switch (data.type) {
      case 'state_update':
        setReplayState(data.state);
        break;
      case 'collaborator_joined':
        setCollaborators(prev => [...prev.filter(c => c !== data.collaborator), data.collaborator]);
        break;
      case 'collaborator_left':
        setCollaborators(prev => prev.filter(c => c !== data.collaborator));
        break;
      case 'bookmark_added':
        setReplayState(prev => prev ? {
          ...prev,
          bookmarks: [...prev.bookmarks, data.bookmark].sort((a, b) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        } : null);
        break;
      case 'annotation_added':
        setReplayState(prev => prev ? {
          ...prev,
          annotations: [...prev.annotations, data.annotation].sort((a, b) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        } : null);
        break;
    }
  };

  // Playback control handlers
  const handlePlay = async () => {
    if (!replayId) return;
    
    try {
      await apiClient.post(`/api/replay/${replayId}/play`);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'play', replayId }));
      }
    } catch (err) {
      console.error('Failed to play replay:', err);
    }
  };

  const handlePause = async () => {
    if (!replayId) return;
    
    try {
      await apiClient.post(`/api/replay/${replayId}/pause`);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'pause', replayId }));
      }
    } catch (err) {
      console.error('Failed to pause replay:', err);
    }
  };

  const handleStop = async () => {
    if (!replayId) return;
    
    try {
      await apiClient.post(`/api/replay/${replayId}/stop`);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'stop', replayId }));
      }
    } catch (err) {
      console.error('Failed to stop replay:', err);
    }
  };

  const handleStepForward = async () => {
    if (!replayId) return;
    
    try {
      await apiClient.post(`/api/replay/${replayId}/step`, { direction: 'forward' });
    } catch (err) {
      console.error('Failed to step forward:', err);
    }
  };

  const handleStepBackward = async () => {
    if (!replayId) return;
    
    try {
      await apiClient.post(`/api/replay/${replayId}/step`, { direction: 'backward' });
    } catch (err) {
      console.error('Failed to step backward:', err);
    }
  };

  const handleSeek = async (position: number) => {
    if (!replayId) return;
    
    try {
      await apiClient.post(`/api/replay/${replayId}/seek`, { position });
    } catch (err) {
      console.error('Failed to seek:', err);
    }
  };

  const handleSpeedChange = async (speed: number) => {
    if (!replayId) return;
    
    try {
      await apiClient.post(`/api/replay/${replayId}/speed`, { speed });
    } catch (err) {
      console.error('Failed to change speed:', err);
    }
  };

  // Bookmark handlers
  const handleAddBookmark = async () => {
    if (!replayId || !replayState) return;
    
    const currentEvent = replayState.timeline[replayState.currentIndex];
    if (!currentEvent) return;
    
    try {
      const bookmark = await apiClient.post(`/api/replay/${replayId}/bookmarks`, {
        timestamp: currentEvent.timestamp,
        messageIndex: replayState.currentIndex,
        title: `Bookmark at ${formatRelativeTime(new Date(currentEvent.timestamp))}`,
        tags: ['user-created'],
        createdBy: 'user'
      });
      
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ 
          type: 'bookmark_added', 
          bookmark: bookmark.data 
        }));
      }
    } catch (err) {
      console.error('Failed to add bookmark:', err);
    }
  };

  const handleJumpToBookmark = async (bookmarkId: string) => {
    if (!replayId) return;
    
    try {
      await apiClient.post(`/api/replay/${replayId}/jump`, { 
        type: 'bookmark', 
        value: bookmarkId 
      });
    } catch (err) {
      console.error('Failed to jump to bookmark:', err);
    }
  };

  // Export handlers
  const handleExport = async (format: 'json' | 'csv' | 'markdown') => {
    if (!replayId) return;
    
    try {
      const response = await apiClient.post(`/api/replay/${replayId}/export`, {
        format,
        includeBookmarks: true,
        includeAnnotations: true,
        includeSegments: true
      });
      
      // Trigger download
      const blob = new Blob([response.data], { 
        type: format === 'json' ? 'application/json' : 'text/plain' 
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `session-replay-${sessionId}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export replay:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-gray-600">Preparing session for replay...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-600">
          <h3 className="text-lg font-medium mb-2">Failed to Load Replay</h3>
          <p className="text-sm">{error}</p>
          <Button 
            onClick={initializeReplay}
            className="mt-4"
            variant="outline"
          >
            Try Again
          </Button>
        </div>
      </Card>
    );
  }

  if (!replayState || !metadata) {
    return null;
  }

  const currentEvent = replayState.timeline[replayState.currentIndex];
  const progress = replayState.totalEvents > 0 
    ? (replayState.currentIndex / (replayState.totalEvents - 1)) * 100 
    : 0;

  return (
    <div className={`replay-player ${isEmbedded ? 'embedded' : 'standalone'}`}>
      {/* Header */}
      {!isEmbedded && (
        <div className="flex items-center justify-between p-4 border-b bg-white">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Session Replay</h2>
            <Badge variant="secondary">{metadata.title}</Badge>
            {showCollaborativeFeatures && collaborators.length > 0 && (
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Users size={14} />
                <span>{collaborators.length} viewer{collaborators.length !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('json')}
            >
              Export
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings size={16} />
            </Button>
            
            {onClose && (
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
              >
                Close
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Main replay area */}
        <div className="flex-1 flex flex-col">
          {/* Controls */}
          <div className="border-b bg-gray-50 p-4">
            <ReplayControls
              replayState={replayState}
              onPlay={handlePlay}
              onPause={handlePause}
              onStop={handleStop}
              onStepForward={handleStepForward}
              onStepBackward={handleStepBackward}
              onSeek={handleSeek}
              onSpeedChange={handleSpeedChange}
              onAddBookmark={handleAddBookmark}
            />
          </div>

          {/* Timeline */}
          <div className="border-b bg-white">
            <ReplayTimeline
              replayState={replayState}
              onSeek={handleSeek}
              onJumpToBookmark={handleJumpToBookmark}
              showSegments={true}
              showBookmarks={true}
              showAnnotations={true}
            />
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-hidden">
            {selectedView === 'timeline' && (
              <div className="h-full flex">
                {/* Current message/event */}
                <div className="flex-1 overflow-auto">
                  {currentEvent && currentEvent.type === 'message' ? (
                    <MessagePane
                      messages={[{
                        ...currentEvent.data,
                        timestamp: new Date(currentEvent.timestamp)
                      }]}
                      showTimestamps={true}
                      showAgentColors={true}
                    />
                  ) : currentEvent ? (
                    <Card className="m-4 p-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{currentEvent.type.replace('_', ' ')}</Badge>
                          <span className="text-sm text-gray-500">
                            {new Date(currentEvent.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <pre className="text-sm bg-gray-50 p-3 rounded overflow-auto">
                          {JSON.stringify(currentEvent.data, null, 2)}
                        </pre>
                      </div>
                    </Card>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      <div className="text-center">
                        <Clock size={48} className="mx-auto mb-4 text-gray-300" />
                        <p>No event selected</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Event context sidebar */}
                <div className="w-80 border-l bg-gray-50 overflow-auto">
                  <div className="p-4 space-y-4">
                    {/* Current position info */}
                    <div>
                      <h3 className="font-medium text-sm text-gray-700 mb-2">Position</h3>
                      <div className="text-sm space-y-1">
                        <div>Event {replayState.currentIndex + 1} of {replayState.totalEvents}</div>
                        <div>{progress.toFixed(1)}% complete</div>
                        {currentEvent && (
                          <div className="text-gray-500">
                            {formatRelativeTime(new Date(currentEvent.timestamp))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Nearby bookmarks */}
                    {replayState.bookmarks.length > 0 && (
                      <div>
                        <h3 className="font-medium text-sm text-gray-700 mb-2">Bookmarks</h3>
                        <div className="space-y-2">
                          {replayState.bookmarks.slice(0, 5).map(bookmark => (
                            <button
                              key={bookmark.id}
                              onClick={() => handleJumpToBookmark(bookmark.id)}
                              className="w-full text-left p-2 rounded hover:bg-gray-100 text-sm"
                            >
                              <div className="font-medium">{bookmark.title}</div>
                              <div className="text-gray-500 text-xs">
                                {formatRelativeTime(new Date(bookmark.timestamp))}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Event metadata */}
                    {currentEvent && currentEvent.type === 'message' && (
                      <div>
                        <h3 className="font-medium text-sm text-gray-700 mb-2">Message Details</h3>
                        <div className="text-sm space-y-1">
                          <div>Agent: {currentEvent.data.agentType}</div>
                          <div>Type: {currentEvent.data.messageType}</div>
                          {currentEvent.data.metadata?.duration && (
                            <div>Duration: {currentEvent.data.metadata.duration}ms</div>
                          )}
                          {currentEvent.data.metadata?.cost && (
                            <div>Cost: ${currentEvent.data.metadata.cost.toFixed(4)}</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {selectedView === 'step' && (
              <div className="p-4">
                <p className="text-gray-600">Step-by-step view coming soon...</p>
              </div>
            )}

            {selectedView === 'comparison' && (
              <div className="p-4">
                <p className="text-gray-600">Multi-session comparison view coming soon...</p>
              </div>
            )}
          </div>
        </div>

        {/* Metadata sidebar */}
        <div className="w-80 border-l bg-white overflow-auto">
          <ReplayMetadata 
            metadata={metadata}
            replayState={replayState}
            onViewModeChange={setSelectedView}
            selectedViewMode={selectedView}
          />
        </div>
      </div>

      {/* Settings modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-96 max-h-96 overflow-auto">
            <div className="p-4 border-b">
              <h3 className="font-medium">Replay Settings</h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">View Mode</label>
                <select 
                  value={selectedView}
                  onChange={(e) => setSelectedView(e.target.value as any)}
                  className="w-full p-2 border rounded"
                >
                  <option value="timeline">Timeline View</option>
                  <option value="step">Step-by-Step View</option>
                  <option value="comparison">Comparison View</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Playback Speed</label>
                <input
                  type="range"
                  min="0.25"
                  max="4"
                  step="0.25"
                  value={replayState.playbackSpeed}
                  onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                  className="w-full"
                />
                <div className="text-sm text-gray-500 mt-1">
                  {replayState.playbackSpeed}x speed
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end">
              <Button 
                onClick={() => setShowSettings(false)}
                variant="outline"
              >
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}