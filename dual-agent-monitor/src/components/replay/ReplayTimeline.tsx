import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Bookmark, 
  MessageSquare, 
  AlertCircle, 
  Zap, 
  Clock, 
  ChevronLeft, 
  ChevronRight,
  Eye,
  EyeOff,
  Filter
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { formatRelativeTime, formatDuration } from '../../utils/formatters';

interface ReplayTimelineProps {
  replayState: {
    currentIndex: number;
    totalEvents: number;
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
  };
  onSeek: (position: number) => void;
  onJumpToBookmark: (bookmarkId: string) => void;
  showSegments?: boolean;
  showBookmarks?: boolean;
  showAnnotations?: boolean;
  height?: number;
}

interface TimelineEvent {
  id: string;
  timestamp: Date;
  type: string;
  data: any;
  index: number;
  x: number; // Calculated position
}

interface TimelineBookmark {
  id: string;
  timestamp: Date;
  title: string;
  x: number; // Calculated position
  index: number;
}

interface TimelineSegment {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  startX: number;
  endX: number;
  width: number;
  color: string;
}

export function ReplayTimeline({
  replayState,
  onSeek,
  onJumpToBookmark,
  showSegments = true,
  showBookmarks = true,
  showAnnotations = true,
  height = 200
}: ReplayTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [eventTypeFilters, setEventTypeFilters] = useState({
    message: true,
    communication: true,
    system_event: true,
    performance_metric: true
  });
  
  // Calculate timeline dimensions and positions
  const timelineData = useMemo(() => {
    if (replayState.timeline.length === 0 || containerWidth === 0) {
      return { events: [], bookmarks: [], segments: [], duration: 0, startTime: new Date() };
    }

    const startTime = new Date(replayState.timeline[0].timestamp);
    const endTime = new Date(replayState.timeline[replayState.timeline.length - 1].timestamp);
    const duration = endTime.getTime() - startTime.getTime();
    
    // Calculate event positions
    const events: TimelineEvent[] = replayState.timeline
      .filter(event => eventTypeFilters[event.type as keyof typeof eventTypeFilters])
      .map(event => ({
        ...event,
        x: duration > 0 
          ? ((new Date(event.timestamp).getTime() - startTime.getTime()) / duration) * containerWidth
          : 0
      }));

    // Calculate bookmark positions
    const bookmarks: TimelineBookmark[] = showBookmarks
      ? replayState.bookmarks.map(bookmark => ({
          ...bookmark,
          x: duration > 0
            ? ((new Date(bookmark.timestamp).getTime() - startTime.getTime()) / duration) * containerWidth
            : 0,
          index: replayState.timeline.findIndex(e => 
            Math.abs(new Date(e.timestamp).getTime() - new Date(bookmark.timestamp).getTime()) < 1000
          )
        }))
      : [];

    // Calculate segment positions
    const segments: TimelineSegment[] = showSegments
      ? replayState.segments.map(segment => {
          const startX = duration > 0
            ? ((new Date(segment.startTime).getTime() - startTime.getTime()) / duration) * containerWidth
            : 0;
          const endX = duration > 0
            ? ((new Date(segment.endTime).getTime() - startTime.getTime()) / duration) * containerWidth
            : containerWidth;
          
          return {
            ...segment,
            startX,
            endX,
            width: Math.max(endX - startX, 4), // Minimum width of 4px
            color: segment.highlightColor || '#3B82F6'
          };
        })
      : [];

    return { events, bookmarks, segments, duration, startTime };
  }, [replayState, containerWidth, eventTypeFilters, showSegments, showBookmarks]);

  // Current position indicator
  const currentPosition = useMemo(() => {
    if (replayState.timeline.length === 0 || containerWidth === 0) return 0;
    
    const progress = replayState.totalEvents > 0 
      ? replayState.currentIndex / (replayState.totalEvents - 1)
      : 0;
    return progress * containerWidth;
  }, [replayState.currentIndex, replayState.totalEvents, containerWidth]);

  // Handle container resize
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Handle timeline click
  const handleTimelineClick = (event: React.MouseEvent) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const progress = clickX / containerWidth;
    const targetIndex = Math.round(progress * (replayState.totalEvents - 1));
    
    onSeek(Math.max(0, Math.min(targetIndex, replayState.totalEvents - 1)));
  };

  // Handle zoom and pan
  const handleWheel = (event: React.WheelEvent) => {
    event.preventDefault();
    
    if (event.ctrlKey || event.metaKey) {
      // Zoom
      const zoomFactor = event.deltaY > 0 ? 1.1 : 0.9;
      const mouseX = event.clientX - containerRef.current!.getBoundingClientRect().left;
      const mouseProgress = mouseX / containerWidth;
      
      const currentRangeSize = visibleRange.end - visibleRange.start;
      const newRangeSize = Math.min(1, Math.max(0.01, currentRangeSize * zoomFactor));
      
      const newStart = Math.max(0, mouseProgress - (mouseProgress - visibleRange.start) * (newRangeSize / currentRangeSize));
      const newEnd = Math.min(1, newStart + newRangeSize);
      
      setVisibleRange({ start: newStart, end: newEnd });
    } else {
      // Pan
      const panAmount = event.deltaX / containerWidth * 0.1;
      const rangeSize = visibleRange.end - visibleRange.start;
      
      let newStart = visibleRange.start + panAmount;
      let newEnd = visibleRange.end + panAmount;
      
      if (newStart < 0) {
        newStart = 0;
        newEnd = rangeSize;
      } else if (newEnd > 1) {
        newEnd = 1;
        newStart = 1 - rangeSize;
      }
      
      setVisibleRange({ start: newStart, end: newEnd });
    }
  };

  const getEventIcon = (event: TimelineEvent) => {
    switch (event.type) {
      case 'message':
        if (event.data.messageType === 'error') {
          return <AlertCircle size={12} className="text-red-500" />;
        }
        if (event.data.messageType === 'tool_call') {
          return <Zap size={12} className="text-orange-500" />;
        }
        return <MessageSquare size={12} className="text-blue-500" />;
      case 'system_event':
        return <Clock size={12} className="text-gray-500" />;
      case 'performance_metric':
        return <div className="w-2 h-2 rounded-full bg-green-500" />;
      default:
        return <div className="w-2 h-2 rounded-full bg-gray-400" />;
    }
  };

  const getEventColor = (event: TimelineEvent) => {
    if (event.type === 'message') {
      if (event.data.messageType === 'error') return 'bg-red-500';
      if (event.data.agentType === 'manager') return 'bg-purple-500';
      if (event.data.agentType === 'worker') return 'bg-blue-500';
    }
    if (event.type === 'system_event') return 'bg-gray-500';
    if (event.type === 'communication') return 'bg-green-500';
    return 'bg-gray-400';
  };

  const resetZoom = () => {
    setVisibleRange({ start: 0, end: 1 });
  };

  const zoomToSelection = () => {
    const currentProgress = replayState.currentIndex / (replayState.totalEvents - 1);
    const zoomRange = 0.1; // 10% of timeline
    const newStart = Math.max(0, currentProgress - zoomRange / 2);
    const newEnd = Math.min(1, newStart + zoomRange);
    setVisibleRange({ start: newStart, end: newEnd });
  };

  return (
    <div className="bg-white border-b">
      {/* Controls */}
      <div className="flex items-center justify-between p-3 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Timeline</span>
          <Badge variant="outline" className="text-xs">
            {timelineData.events.length} events
          </Badge>
          {timelineData.duration > 0 && (
            <span className="text-xs text-gray-500">
              Duration: {formatDuration(timelineData.duration)}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={14} />
            Filters
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={zoomToSelection}
            title="Zoom to current position"
          >
            <Eye size={14} />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={resetZoom}
            title="Reset zoom"
          >
            <EyeOff size={14} />
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="p-3 border-b bg-gray-50">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Show:</span>
            {Object.entries(eventTypeFilters).map(([type, enabled]) => (
              <label key={type} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEventTypeFilters(prev => ({
                    ...prev,
                    [type]: e.target.checked
                  }))}
                  className="rounded"
                />
                {type.replace('_', ' ')}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Timeline visualization */}
      <div 
        ref={containerRef}
        className="relative overflow-hidden cursor-pointer"
        style={{ height: `${height}px` }}
        onClick={handleTimelineClick}
        onWheel={handleWheel}
      >
        {containerWidth > 0 && (
          <>
            {/* Segments background */}
            {timelineData.segments.map(segment => (
              <div
                key={segment.id}
                className="absolute top-0 bottom-0 opacity-20 rounded"
                style={{
                  left: `${segment.startX}px`,
                  width: `${segment.width}px`,
                  backgroundColor: segment.color
                }}
                title={segment.title}
              />
            ))}

            {/* Time grid lines */}
            {Array.from({ length: 10 }, (_, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 border-l border-gray-200"
                style={{ left: `${(i / 9) * containerWidth}px` }}
              />
            ))}

            {/* Events */}
            <div className="absolute top-8 left-0 right-0">
              {timelineData.events.map(event => (
                <div
                  key={event.id}
                  className={`absolute w-1 h-12 rounded-full ${getEventColor(event)} opacity-80 hover:opacity-100`}
                  style={{ 
                    left: `${event.x}px`,
                    transform: 'translateX(-50%)'
                  }}
                  title={`${event.type}: ${formatRelativeTime(new Date(event.timestamp))}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSeek(event.index);
                  }}
                />
              ))}
            </div>

            {/* Agent activity lanes */}
            <div className="absolute top-24 left-0 right-0 h-16">
              {/* Manager lane */}
              <div className="h-6 border-b border-gray-200">
                <span className="text-xs text-purple-600 font-medium pl-2">Manager</span>
                {timelineData.events
                  .filter(e => e.type === 'message' && e.data.agentType === 'manager')
                  .map(event => (
                    <div
                      key={event.id}
                      className="absolute w-2 h-4 bg-purple-500 rounded"
                      style={{ 
                        left: `${event.x}px`,
                        transform: 'translateX(-50%)',
                        top: '16px'
                      }}
                      title={`Manager: ${event.data.messageType}`}
                    />
                  ))}
              </div>

              {/* Worker lane */}
              <div className="h-6">
                <span className="text-xs text-blue-600 font-medium pl-2">Worker</span>
                {timelineData.events
                  .filter(e => e.type === 'message' && e.data.agentType === 'worker')
                  .map(event => (
                    <div
                      key={event.id}
                      className="absolute w-2 h-4 bg-blue-500 rounded"
                      style={{ 
                        left: `${event.x}px`,
                        transform: 'translateX(-50%)',
                        top: '16px'
                      }}
                      title={`Worker: ${event.data.messageType}`}
                    />
                  ))}
              </div>
            </div>

            {/* Bookmarks */}
            {timelineData.bookmarks.map(bookmark => (
              <div
                key={bookmark.id}
                className="absolute top-0 bottom-0 cursor-pointer group"
                style={{ left: `${bookmark.x}px`, transform: 'translateX(-50%)' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onJumpToBookmark(bookmark.id);
                }}
              >
                <div className="w-0.5 h-full bg-yellow-500" />
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2">
                  <Bookmark size={16} className="text-yellow-600 fill-current" />
                </div>
                
                {/* Bookmark tooltip */}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                  <div className="bg-black text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                    {bookmark.title}
                    <div className="text-gray-300">
                      {formatRelativeTime(new Date(bookmark.timestamp))}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Annotations */}
            {showAnnotations && replayState.annotations.map(annotation => {
              const annotationX = timelineData.duration > 0
                ? ((new Date(annotation.timestamp).getTime() - timelineData.startTime.getTime()) / timelineData.duration) * containerWidth
                : 0;
              
              return (
                <div
                  key={annotation.id}
                  className="absolute top-0 cursor-pointer group"
                  style={{ left: `${annotationX}px`, transform: 'translateX(-50%)' }}
                >
                  <div className="w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow" />
                  
                  {/* Annotation tooltip */}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 hidden group-hover:block z-10">
                    <div className="bg-black text-white text-xs rounded py-2 px-3 max-w-48">
                      <div className="font-medium">{annotation.author}</div>
                      <div>{annotation.content}</div>
                      <div className="text-gray-300 mt-1">
                        {formatRelativeTime(new Date(annotation.timestamp))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Current position indicator */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
              style={{ left: `${currentPosition}px` }}
            >
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1">
                <div className="w-3 h-3 bg-red-500 rotate-45" />
              </div>
            </div>

            {/* Visible range indicator (when zoomed) */}
            {(visibleRange.start > 0 || visibleRange.end < 1) && (
              <div className="absolute bottom-0 left-0 right-0 h-2 bg-gray-200">
                <div
                  className="h-full bg-blue-500 opacity-50"
                  style={{
                    left: `${visibleRange.start * 100}%`,
                    width: `${(visibleRange.end - visibleRange.start) * 100}%`
                  }}
                />
              </div>
            )}
          </>
        )}

        {/* No data message */}
        {replayState.timeline.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Clock size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No timeline data available</p>
            </div>
          </div>
        )}
      </div>

      {/* Timeline legend */}
      <div className="p-2 bg-gray-50 border-t">
        <div className="flex items-center justify-center gap-6 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-purple-500 rounded" />
            <span>Manager</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded" />
            <span>Worker</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 rounded" />
            <span>Error</span>
          </div>
          <div className="flex items-center gap-1">
            <Bookmark size={12} className="text-yellow-600" />
            <span>Bookmark</span>
          </div>
          {showAnnotations && (
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <span>Annotation</span>
            </div>
          )}
        </div>
        
        <div className="text-center text-xs text-gray-500 mt-1">
          Ctrl+Wheel to zoom, Shift+Wheel to pan horizontally
        </div>
      </div>
    </div>
  );
}