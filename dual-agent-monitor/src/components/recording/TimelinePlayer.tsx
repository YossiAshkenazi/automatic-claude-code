import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Volume2, 
  Settings, 
  Bookmark, 
  MessageSquare,
  Maximize2,
  Filter,
  Search,
  Calendar
} from 'lucide-react';

export interface TimelineEvent {
  id: string;
  recordingId: string;
  timestamp: number;
  relativeTimeMs: number;
  eventType: string;
  agentType?: 'manager' | 'worker' | 'system';
  content: string;
  metadata?: any;
  duration?: number;
}

export interface TimelinePlayerProps {
  recordingId: string;
  events: TimelineEvent[];
  duration: number;
  onTimeChange?: (timeMs: number) => void;
  onEventSelect?: (event: TimelineEvent) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  className?: string;
}

export const TimelinePlayer: React.FC<TimelinePlayerProps> = ({
  recordingId,
  events,
  duration,
  onTimeChange,
  onEventSelect,
  onPlayStateChange,
  className = ''
}) => {
  // Player state
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  
  // Filter and search state
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [agentTypeFilter, setAgentTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [timeRangeFilter, setTimeRangeFilter] = useState<{ start?: number; end?: number }>({});
  
  // UI state
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<TimelineEvent | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showEventDetails, setShowEventDetails] = useState(true);
  
  // Refs
  const timelineRef = useRef<HTMLDivElement>(null);
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);

  // Filtered events
  const filteredEvents = React.useMemo(() => {
    let filtered = events;
    
    // Event type filter
    if (eventTypeFilter !== 'all') {
      filtered = filtered.filter(event => event.eventType === eventTypeFilter);
    }
    
    // Agent type filter
    if (agentTypeFilter !== 'all') {
      filtered = filtered.filter(event => event.agentType === agentTypeFilter);
    }
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(event => 
        event.content.toLowerCase().includes(query) ||
        event.eventType.toLowerCase().includes(query) ||
        (event.agentType && event.agentType.toLowerCase().includes(query))
      );
    }
    
    // Time range filter
    if (timeRangeFilter.start !== undefined || timeRangeFilter.end !== undefined) {
      filtered = filtered.filter(event => {
        if (timeRangeFilter.start !== undefined && event.relativeTimeMs < timeRangeFilter.start) {
          return false;
        }
        if (timeRangeFilter.end !== undefined && event.relativeTimeMs > timeRangeFilter.end) {
          return false;
        }
        return true;
      });
    }
    
    return filtered.sort((a, b) => a.relativeTimeMs - b.relativeTimeMs);
  }, [events, eventTypeFilter, agentTypeFilter, searchQuery, timeRangeFilter]);

  // Get unique event types and agent types for filters
  const eventTypes = React.useMemo(() => {
    const types = new Set(events.map(e => e.eventType));
    return Array.from(types).sort();
  }, [events]);

  const agentTypes = React.useMemo(() => {
    const types = new Set(events.map(e => e.agentType).filter(Boolean));
    return Array.from(types).sort();
  }, [events]);

  // Playback control
  useEffect(() => {
    if (isPlaying) {
      playbackIntervalRef.current = setInterval(() => {
        const now = Date.now();
        const deltaTime = now - lastUpdateTimeRef.current;
        lastUpdateTimeRef.current = now;
        
        setCurrentTime(prev => {
          const newTime = Math.min(prev + (deltaTime * playbackSpeed), duration);
          
          // Find current event
          const currentEvent = filteredEvents.find(event => {
            const eventTime = event.relativeTimeMs;
            const eventEnd = eventTime + (event.duration || 1000);
            return eventTime <= newTime && newTime <= eventEnd;
          });
          
          if (currentEvent && currentEvent !== selectedEvent) {
            setSelectedEvent(currentEvent);
            onEventSelect?.(currentEvent);
          }
          
          onTimeChange?.(newTime);
          
          if (newTime >= duration) {
            setIsPlaying(false);
            onPlayStateChange?.(false);
          }
          
          return newTime;
        });
      }, 50);
      
      lastUpdateTimeRef.current = Date.now();
    } else if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }

    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, duration, filteredEvents, selectedEvent, onEventSelect, onTimeChange, onPlayStateChange]);

  // Control functions
  const togglePlayback = useCallback(() => {
    const newIsPlaying = !isPlaying;
    setIsPlaying(newIsPlaying);
    onPlayStateChange?.(newIsPlaying);
  }, [isPlaying, onPlayStateChange]);

  const seekTo = useCallback((timeMs: number) => {
    const clampedTime = Math.max(0, Math.min(timeMs, duration));
    setCurrentTime(clampedTime);
    onTimeChange?.(clampedTime);
    
    // Find and select event at this time
    const eventAtTime = filteredEvents.find(event => {
      const eventTime = event.relativeTimeMs;
      const eventEnd = eventTime + (event.duration || 1000);
      return eventTime <= clampedTime && clampedTime <= eventEnd;
    });
    
    if (eventAtTime) {
      setSelectedEvent(eventAtTime);
      onEventSelect?.(eventAtTime);
    }
  }, [duration, filteredEvents, onTimeChange, onEventSelect]);

  const skipForward = useCallback(() => {
    seekTo(currentTime + 10000); // 10 seconds
  }, [currentTime, seekTo]);

  const skipBackward = useCallback(() => {
    seekTo(currentTime - 10000); // 10 seconds
  }, [currentTime, seekTo]);

  const jumpToNextEvent = useCallback(() => {
    const nextEvent = filteredEvents.find(event => event.relativeTimeMs > currentTime);
    if (nextEvent) {
      seekTo(nextEvent.relativeTimeMs);
    }
  }, [filteredEvents, currentTime, seekTo]);

  const jumpToPreviousEvent = useCallback(() => {
    const previousEvent = [...filteredEvents]
      .reverse()
      .find(event => event.relativeTimeMs < currentTime);
    if (previousEvent) {
      seekTo(previousEvent.relativeTimeMs);
    }
  }, [filteredEvents, currentTime, seekTo]);

  // Timeline interaction handlers
  const handleTimelineClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;
    
    seekTo(newTime);
  }, [duration, seekTo]);

  const handleEventClick = useCallback((event: TimelineEvent) => {
    seekTo(event.relativeTimeMs);
    setSelectedEvent(event);
    onEventSelect?.(event);
  }, [seekTo, onEventSelect]);

  // Format time display
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

  // Get color for event type
  const getEventTypeColor = (eventType: string): string => {
    const colors: { [key: string]: string } = {
      message: '#2196f3',
      agent_communication: '#4caf50',
      system_event: '#ff9800',
      tool_call: '#9c27b0',
      error: '#f44336',
      file_operation: '#607d8b',
      performance_metric: '#795548'
    };
    return colors[eventType] || '#757575';
  };

  // Get color for agent type
  const getAgentTypeColor = (agentType?: string): string => {
    const colors: { [key: string]: string } = {
      manager: '#28a745',
      worker: '#17a2b8',
      system: '#6c757d'
    };
    return colors[agentType || 'system'] || '#6c757d';
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Timeline Player</h3>
            <p className="text-sm text-gray-600">
              {filteredEvents.length} events • Duration: {formatTime(duration)}
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowEventDetails(!showEventDetails)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Toggle Event Details"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search events..."
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Event Type</label>
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              {eventTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Agent</label>
            <select
              value={agentTypeFilter}
              onChange={(e) => setAgentTypeFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Agents</option>
              {agentTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Speed</label>
            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="0.25">0.25x</option>
              <option value="0.5">0.5x</option>
              <option value="1">1x</option>
              <option value="1.5">1.5x</option>
              <option value="2">2x</option>
              <option value="4">4x</option>
            </select>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="p-4">
        <div className="mb-4">
          <div
            ref={timelineRef}
            className="relative h-16 bg-gray-100 rounded-lg cursor-pointer overflow-hidden"
            onClick={handleTimelineClick}
          >
            {/* Progress bar */}
            <div
              className="absolute top-0 left-0 h-full bg-blue-500 opacity-30 transition-all duration-100"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />
            
            {/* Event markers */}
            {filteredEvents.map((event, index) => {
              const leftPosition = (event.relativeTimeMs / duration) * 100;
              const width = event.duration ? Math.max((event.duration / duration) * 100, 0.5) : 0.5;
              const isSelected = selectedEvent?.id === event.id;
              const isHovered = hoveredEvent?.id === event.id;
              
              return (
                <div
                  key={event.id}
                  className={`absolute top-1 h-14 rounded cursor-pointer transition-all duration-200 ${
                    isSelected ? 'ring-2 ring-blue-500 z-10' : ''
                  } ${isHovered ? 'opacity-80 transform scale-105' : 'opacity-70'}`}
                  style={{
                    left: `${leftPosition}%`,
                    width: `${width}%`,
                    backgroundColor: getEventTypeColor(event.eventType),
                    minWidth: '2px'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEventClick(event);
                  }}
                  onMouseEnter={() => setHoveredEvent(event)}
                  onMouseLeave={() => setHoveredEvent(null)}
                  title={`${event.eventType} - ${event.agentType || 'system'} at ${formatTime(event.relativeTimeMs)}`}
                />
              );
            })}
            
            {/* Playhead */}
            <div
              className="absolute top-0 w-0.5 h-full bg-blue-600 z-20"
              style={{ left: `${(currentTime / duration) * 100}%` }}
            >
              <div className="absolute -top-1 -left-2 w-4 h-4 bg-blue-600 rounded-full"></div>
            </div>
          </div>
          
          {/* Time indicators */}
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Playback controls */}
        <div className="flex items-center justify-center space-x-4 mb-4">
          <button
            onClick={jumpToPreviousEvent}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Previous Event"
          >
            <SkipBack className="w-5 h-5" />
          </button>
          
          <button
            onClick={skipBackward}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Skip back 10s"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          
          <button
            onClick={togglePlayback}
            className="p-3 bg-blue-600 text-white hover:bg-blue-700 rounded-full transition-colors"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
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
            <SkipForward className="w-4 h-4" />
          </button>
          
          <button
            onClick={jumpToNextEvent}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Next Event"
          >
            <SkipForward className="w-5 h-5" />
          </button>
        </div>

        {/* Current event details */}
        {showEventDetails && selectedEvent && (
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getEventTypeColor(selectedEvent.eventType) }}
                />
                <span className="font-medium text-gray-900">
                  {selectedEvent.eventType.replace('_', ' ').toUpperCase()}
                </span>
                {selectedEvent.agentType && (
                  <span
                    className="px-2 py-1 text-xs rounded-full text-white"
                    style={{ backgroundColor: getAgentTypeColor(selectedEvent.agentType) }}
                  >
                    {selectedEvent.agentType}
                  </span>
                )}
                <span className="text-sm text-gray-500">
                  {formatTime(selectedEvent.relativeTimeMs)}
                </span>
              </div>
            </div>
            
            <div className="bg-white rounded border p-3">
              <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono max-h-32 overflow-y-auto">
                {typeof selectedEvent.content === 'string' 
                  ? selectedEvent.content 
                  : JSON.stringify(selectedEvent.content, null, 2)}
              </pre>
            </div>
            
            {selectedEvent.metadata && (
              <div className="mt-3 text-xs text-gray-500">
                <strong>Metadata:</strong> {JSON.stringify(selectedEvent.metadata, null, 2)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TimelinePlayer;