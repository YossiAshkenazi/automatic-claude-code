import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, Settings, Bookmark, MessageSquare, Download } from 'lucide-react';
import { 
  SessionRecording, 
  RecordingInteraction, 
  PlaybackSession, 
  RecordingAnnotation, 
  RecordingBookmark,
  PlaybackSettings 
} from '../../types';

interface SessionRecordingViewerProps {
  recording: SessionRecording;
  onPlaybackStateChange?: (state: PlaybackState) => void;
  onAddAnnotation?: (annotation: NewAnnotation) => void;
  onAddBookmark?: (bookmark: NewBookmark) => void;
  onExportRecording?: (format: string) => void;
  userId?: string;
  className?: string;
}

interface PlaybackState {
  currentPosition: number;
  isPlaying: boolean;
  playbackSpeed: number;
  duration: number;
}

interface NewAnnotation {
  timestampMs: number;
  annotationType: 'note' | 'highlight' | 'bookmark' | 'flag' | 'question';
  title: string;
  content: string;
  color?: string;
}

interface NewBookmark {
  timestampMs: number;
  title: string;
  description?: string;
}

export const SessionRecordingViewer: React.FC<SessionRecordingViewerProps> = ({
  recording,
  onPlaybackStateChange,
  onAddAnnotation,
  onAddBookmark,
  onExportRecording,
  userId,
  className = ''
}) => {
  // State management
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    currentPosition: 0,
    isPlaying: false,
    playbackSpeed: 1,
    duration: recording.playbackDurationMs || 0
  });

  const [interactions, setInteractions] = useState<RecordingInteraction[]>([]);
  const [annotations, setAnnotations] = useState<RecordingAnnotation[]>([]);
  const [bookmarks, setBookmarks] = useState<RecordingBookmark[]>([]);
  const [currentInteraction, setCurrentInteraction] = useState<RecordingInteraction | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAnnotationModal, setShowAnnotationModal] = useState(false);
  const [showBookmarkModal, setShowBookmarkModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<PlaybackSettings>({
    autoPlay: false,
    showAnnotations: true,
    showBookmarks: true,
    showTimestamps: true,
    highlightChanges: true,
    skipLongPauses: true,
    maxPauseDurationMs: 5000
  });

  const timelineRef = useRef<HTMLDivElement>(null);
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load recording data
  useEffect(() => {
    const loadRecordingData = async () => {
      try {
        setLoading(true);
        
        // In a real implementation, these would be API calls
        const [interactionsData, annotationsData, bookmarksData] = await Promise.all([
          fetchRecordingInteractions(recording.id),
          fetchRecordingAnnotations(recording.id),
          fetchRecordingBookmarks(recording.id)
        ]);
        
        setInteractions(interactionsData);
        setAnnotations(annotationsData);
        setBookmarks(bookmarksData);
        
        if (interactionsData.length > 0) {
          setCurrentInteraction(interactionsData[0]);
        }
      } catch (error) {
        console.error('Failed to load recording data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadRecordingData();
  }, [recording.id]);

  // Playback control
  useEffect(() => {
    if (playbackState.isPlaying) {
      playbackIntervalRef.current = setInterval(() => {
        setPlaybackState(prev => {
          const newPosition = prev.currentPosition + (100 * prev.playbackSpeed);
          
          if (newPosition >= prev.duration) {
            // End of recording reached
            return { ...prev, currentPosition: prev.duration, isPlaying: false };
          }
          
          // Update current interaction
          const currentInt = interactions.find(
            int => int.relativeTimeMs <= newPosition && 
                  (!interactions.find(next => next.relativeTimeMs > int.relativeTimeMs && next.relativeTimeMs <= newPosition))
          );
          
          if (currentInt && currentInt !== currentInteraction) {
            setCurrentInteraction(currentInt);
          }
          
          return { ...prev, currentPosition: newPosition };
        });
      }, 100);
    } else if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }

    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    };
  }, [playbackState.isPlaying, playbackState.playbackSpeed, interactions, currentInteraction]);

  // Notify parent of playback state changes
  useEffect(() => {
    if (onPlaybackStateChange) {
      onPlaybackStateChange(playbackState);
    }
  }, [playbackState, onPlaybackStateChange]);

  // Control functions
  const togglePlayback = useCallback(() => {
    setPlaybackState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
  }, []);

  const seekTo = useCallback((position: number) => {
    const clampedPosition = Math.max(0, Math.min(position, playbackState.duration));
    setPlaybackState(prev => ({ ...prev, currentPosition: clampedPosition }));
    
    // Find and set current interaction
    const targetInteraction = interactions.find(
      int => int.relativeTimeMs <= clampedPosition &&
            (!interactions.find(next => next.relativeTimeMs > int.relativeTimeMs && next.relativeTimeMs <= clampedPosition))
    );
    
    if (targetInteraction) {
      setCurrentInteraction(targetInteraction);
    }
  }, [playbackState.duration, interactions]);

  const changeSpeed = useCallback((speed: number) => {
    setPlaybackState(prev => ({ ...prev, playbackSpeed: speed }));
  }, []);

  const skipForward = useCallback(() => {
    seekTo(playbackState.currentPosition + 10000); // 10 seconds
  }, [playbackState.currentPosition, seekTo]);

  const skipBackward = useCallback(() => {
    seekTo(playbackState.currentPosition - 10000); // 10 seconds
  }, [playbackState.currentPosition, seekTo]);

  const handleTimelineClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newPosition = percentage * playbackState.duration;
    
    seekTo(newPosition);
  }, [playbackState.duration, seekTo]);

  const addAnnotation = useCallback(() => {
    if (!onAddAnnotation) return;
    
    setShowAnnotationModal(true);
  }, [onAddAnnotation]);

  const addBookmark = useCallback(() => {
    if (!onAddBookmark) return;
    
    setShowBookmarkModal(true);
  }, [onAddBookmark]);

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000) % 60;
    const minutes = Math.floor(ms / 60000) % 60;
    const hours = Math.floor(ms / 3600000);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  };

  const getInteractionTypeColor = (type: string): string => {
    const colors = {
      message: '#2196f3',
      system_event: '#ff9800',
      agent_communication: '#4caf50',
      error: '#f44336',
      tool_call: '#9c27b0',
      performance_metric: '#607d8b'
    };
    return colors[type] || '#757575';
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-600">Loading recording...</span>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-lg ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {recording.recordingName || `Recording ${recording.id.slice(0, 8)}`}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {recording.description || 'Session recording playback'}
            </p>
            <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
              <span>Duration: {formatTime(recording.playbackDurationMs || 0)}</span>
              <span>Interactions: {interactions.length}</span>
              <span>Quality: {recording.recordingQuality}</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            
            {onExportRecording && (
              <button
                onClick={() => onExportRecording('json')}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Export Recording"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        {/* Timeline and Controls */}
        <div className="mb-6">
          {/* Timeline */}
          <div className="relative mb-4">
            <div
              ref={timelineRef}
              className="h-12 bg-gray-100 rounded-lg cursor-pointer relative overflow-hidden"
              onClick={handleTimelineClick}
            >
              {/* Progress bar */}
              <div
                className="absolute top-0 left-0 h-full bg-blue-500 opacity-30 transition-all duration-100"
                style={{ width: `${(playbackState.currentPosition / playbackState.duration) * 100}%` }}
              />
              
              {/* Interaction markers */}
              {interactions.map((interaction, index) => (
                <div
                  key={index}
                  className="absolute top-1 w-1 h-10 rounded-full opacity-70"
                  style={{
                    left: `${(interaction.relativeTimeMs / playbackState.duration) * 100}%`,
                    backgroundColor: getInteractionTypeColor(interaction.interactionType)
                  }}
                  title={`${interaction.interactionType} at ${formatTime(interaction.relativeTimeMs)}`}
                />
              ))}
              
              {/* Bookmark markers */}
              {bookmarks.map((bookmark, index) => (
                <div
                  key={index}
                  className="absolute top-0 w-2 h-12 flex items-center justify-center cursor-pointer"
                  style={{ left: `${(bookmark.timestampMs / playbackState.duration) * 100}%` }}
                  title={bookmark.title}
                >
                  <Bookmark className="w-3 h-3 text-blue-600 fill-current" />
                </div>
              ))}
              
              {/* Playhead */}
              <div
                className="absolute top-0 w-0.5 h-full bg-blue-600"
                style={{ left: `${(playbackState.currentPosition / playbackState.duration) * 100}%` }}
              >
                <div className="absolute -top-1 -left-2 w-4 h-4 bg-blue-600 rounded-full"></div>
              </div>
            </div>
            
            {/* Time indicators */}
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{formatTime(playbackState.currentPosition)}</span>
              <span>{formatTime(playbackState.duration)}</span>
            </div>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center justify-center space-x-4">
            <button
              onClick={skipBackward}
              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Skip back 10s"
            >
              <SkipBack className="w-5 h-5" />
            </button>
            
            <button
              onClick={togglePlayback}
              className="p-3 bg-blue-600 text-white hover:bg-blue-700 rounded-full transition-colors"
              title={playbackState.isPlaying ? 'Pause' : 'Play'}
            >
              {playbackState.isPlaying ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6" />
              )}
            </button>
            
            <button
              onClick={skipForward}
              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Skip forward 10s"
            >
              <SkipForward className="w-5 h-5" />
            </button>
            
            {/* Speed Control */}
            <div className="flex items-center space-x-1 ml-4">
              <span className="text-sm text-gray-600 mr-2">Speed:</span>
              {[0.5, 1, 1.5, 2].map(speed => (
                <button
                  key={speed}
                  onClick={() => changeSpeed(speed)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    playbackState.playbackSpeed === speed
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Current Interaction Display */}
        {currentInteraction && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getInteractionTypeColor(currentInteraction.interactionType) }}
                />
                <span className="font-medium text-gray-900">
                  {currentInteraction.interactionType.replace('_', ' ').toUpperCase()}
                </span>
                <span className="text-sm text-gray-500">
                  {currentInteraction.agentType && `${currentInteraction.agentType} agent`}
                </span>
                <span className="text-sm text-gray-500">
                  {formatTime(currentInteraction.relativeTimeMs)}
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={addAnnotation}
                  className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                  title="Add annotation"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
                <button
                  onClick={addBookmark}
                  className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                  title="Add bookmark"
                >
                  <Bookmark className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="bg-white rounded border p-3">
              <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
                {typeof currentInteraction.content === 'string' 
                  ? currentInteraction.content 
                  : JSON.stringify(currentInteraction.content, null, 2)}
              </pre>
            </div>
            
            {currentInteraction.metadata && (
              <div className="mt-3 text-xs text-gray-500">
                <strong>Metadata:</strong> {JSON.stringify(currentInteraction.metadata)}
              </div>
            )}
          </div>
        )}

        {/* Annotations and Bookmarks Panel */}
        {(settings.showAnnotations || settings.showBookmarks) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {settings.showAnnotations && (
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Annotations</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {annotations.map(annotation => (
                    <div
                      key={annotation.id}
                      className="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => seekTo(annotation.timestampMs)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{annotation.title}</span>
                        <span className="text-xs text-gray-500">
                          {formatTime(annotation.timestampMs)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{annotation.content}</p>
                    </div>
                  ))}
                  {annotations.length === 0 && (
                    <p className="text-sm text-gray-500 italic">No annotations yet</p>
                  )}
                </div>
              </div>
            )}

            {settings.showBookmarks && (
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Bookmarks</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {bookmarks.map(bookmark => (
                    <div
                      key={bookmark.id}
                      className="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors flex items-center"
                      onClick={() => seekTo(bookmark.timestampMs)}
                    >
                      <Bookmark className="w-4 h-4 text-blue-600 mr-3 flex-shrink-0" />
                      <div className="flex-grow">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{bookmark.title}</span>
                          <span className="text-xs text-gray-500">
                            {formatTime(bookmark.timestampMs)}
                          </span>
                        </div>
                        {bookmark.description && (
                          <p className="text-sm text-gray-600 mt-1">{bookmark.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {bookmarks.length === 0 && (
                    <p className="text-sm text-gray-500 italic">No bookmarks yet</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Mock API functions - replace with real API calls
const fetchRecordingInteractions = async (recordingId: string): Promise<RecordingInteraction[]> => {
  // This would be replaced with actual API call
  return [];
};

const fetchRecordingAnnotations = async (recordingId: string): Promise<RecordingAnnotation[]> => {
  // This would be replaced with actual API call
  return [];
};

const fetchRecordingBookmarks = async (recordingId: string): Promise<RecordingBookmark[]> => {
  // This would be replaced with actual API call
  return [];
};

export default SessionRecordingViewer;