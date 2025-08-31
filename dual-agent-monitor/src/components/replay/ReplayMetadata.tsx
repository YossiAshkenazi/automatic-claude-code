import React, { useState } from 'react';
import { 
  Info, 
  Clock, 
  MessageSquare, 
  DollarSign, 
  AlertCircle, 
  CheckCircle,
  Users,
  Hash,
  Calendar,
  BarChart3,
  Settings,
  Download,
  Share2,
  Tag,
  Bookmark,
  FileText,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { formatDuration, formatCost, formatRelativeTime } from '../../utils/formatters';

interface ReplayMetadata {
  sessionId: string;
  title: string;
  description?: string;
  duration: number;
  totalEvents: number;
  startTime: Date;
  endTime: Date;
  tags: string[];
  keyMoments: Array<{
    timestamp: Date;
    description: string;
    importance: 'low' | 'medium' | 'high';
  }>;
}

interface ReplayState {
  sessionId: string;
  currentIndex: number;
  totalEvents: number;
  timeline: Array<{
    type: string;
    data: any;
  }>;
  bookmarks: Array<{
    id: string;
    title: string;
    tags: string[];
  }>;
  annotations: Array<{
    id: string;
    author: string;
    content: string;
  }>;
  segments: Array<{
    id: string;
    title: string;
    tags: string[];
  }>;
}

interface ReplayMetadataProps {
  metadata: ReplayMetadata;
  replayState: ReplayState;
  onViewModeChange: (mode: 'timeline' | 'step' | 'comparison') => void;
  selectedViewMode: 'timeline' | 'step' | 'comparison';
  onExport?: (format: 'json' | 'csv' | 'markdown') => void;
  onShare?: () => void;
}

interface SessionStats {
  messageStats: {
    total: number;
    manager: number;
    worker: number;
    prompts: number;
    responses: number;
    tools: number;
    errors: number;
  };
  timing: {
    totalDuration: number;
    avgEventSpacing: number;
    quickestResponse: number;
    slowestResponse: number;
  };
  performance: {
    totalCost: number;
    errorRate: number;
    efficiency: number;
  };
}

export function ReplayMetadata({ 
  metadata, 
  replayState, 
  onViewModeChange, 
  selectedViewMode,
  onExport,
  onShare 
}: ReplayMetadataProps) {
  const [expandedSections, setExpandedSections] = useState({
    overview: true,
    statistics: true,
    bookmarks: false,
    annotations: false,
    segments: false,
    keyMoments: false
  });

  // Calculate session statistics
  const sessionStats: SessionStats = React.useMemo(() => {
    const messageEvents = replayState.timeline.filter(e => e.type === 'message');
    
    const messageStats = {
      total: messageEvents.length,
      manager: messageEvents.filter(e => e.data.agentType === 'manager').length,
      worker: messageEvents.filter(e => e.data.agentType === 'worker').length,
      prompts: messageEvents.filter(e => e.data.messageType === 'prompt').length,
      responses: messageEvents.filter(e => e.data.messageType === 'response').length,
      tools: messageEvents.filter(e => e.data.messageType === 'tool_call').length,
      errors: messageEvents.filter(e => e.data.messageType === 'error').length,
    };

    // Calculate timing statistics
    const eventTimestamps = replayState.timeline.map(e => new Date(e.data.timestamp || metadata.startTime).getTime());
    const spacings = eventTimestamps.slice(1).map((t, i) => t - eventTimestamps[i]);
    const avgEventSpacing = spacings.length > 0 ? spacings.reduce((a, b) => a + b, 0) / spacings.length : 0;

    const timing = {
      totalDuration: metadata.duration,
      avgEventSpacing,
      quickestResponse: spacings.length > 0 ? Math.min(...spacings) : 0,
      slowestResponse: spacings.length > 0 ? Math.max(...spacings) : 0,
    };

    // Calculate performance metrics
    const totalCost = messageEvents.reduce((sum, e) => sum + (e.data.metadata?.cost || 0), 0);
    const errorRate = messageStats.total > 0 ? messageStats.errors / messageStats.total : 0;
    const efficiency = messageStats.total > 0 ? (messageStats.tools + messageStats.responses) / messageStats.total : 0;

    const performance = {
      totalCost,
      errorRate,
      efficiency
    };

    return { messageStats, timing, performance };
  }, [replayState.timeline, metadata]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getImportanceColor = (importance: 'low' | 'medium' | 'high') => {
    switch (importance) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
    }
  };

  const renderSection = (
    key: keyof typeof expandedSections,
    title: string,
    icon: React.ReactNode,
    content: React.ReactNode,
    badge?: React.ReactNode
  ) => (
    <div className="border-b last:border-b-0">
      <button
        onClick={() => toggleSection(key)}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 text-left"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-sm">{title}</span>
          {badge}
        </div>
        {expandedSections[key] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {expandedSections[key] && (
        <div className="px-3 pb-3">
          {content}
        </div>
      )}
    </div>
  );

  return (
    <div className="h-full overflow-auto bg-white">
      {/* Header */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{metadata.title}</h3>
            {metadata.description && (
              <p className="text-xs text-gray-600 mt-1">{metadata.description}</p>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-2">
          {onExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onExport('json')}
              className="text-xs"
            >
              <Download size={12} />
              Export
            </Button>
          )}
          
          {onShare && (
            <Button
              variant="outline"
              size="sm"
              onClick={onShare}
              className="text-xs"
            >
              <Share2 size={12} />
              Share
            </Button>
          )}
        </div>

        {/* View mode selector */}
        <div className="mt-3">
          <div className="flex rounded-lg bg-gray-100 p-1">
            {[
              { key: 'timeline', label: 'Timeline' },
              { key: 'step', label: 'Step' },
              { key: 'comparison', label: 'Compare' }
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => onViewModeChange(key as any)}
                className={`flex-1 text-xs py-1 px-2 rounded transition-colors ${
                  selectedViewMode === key
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content sections */}
      <div className="divide-y">
        {/* Overview */}
        {renderSection(
          'overview',
          'Overview',
          <Info size={16} />,
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-gray-500">Session ID</div>
                <div className="font-mono text-xs">{metadata.sessionId.split('-')[0]}</div>
              </div>
              <div>
                <div className="text-gray-500">Duration</div>
                <div>{formatDuration(metadata.duration)}</div>
              </div>
              <div>
                <div className="text-gray-500">Started</div>
                <div>{formatRelativeTime(new Date(metadata.startTime))}</div>
              </div>
              <div>
                <div className="text-gray-500">Events</div>
                <div>{metadata.totalEvents.toLocaleString()}</div>
              </div>
            </div>

            {metadata.tags.length > 0 && (
              <div>
                <div className="text-gray-500 mb-1">Tags</div>
                <div className="flex flex-wrap gap-1">
                  {metadata.tags.map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Statistics */}
        {renderSection(
          'statistics',
          'Statistics',
          <BarChart3 size={16} />,
          <div className="space-y-3 text-xs">
            {/* Message breakdown */}
            <div>
              <div className="text-gray-500 mb-2">Message Breakdown</div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Total Messages</span>
                  <span className="font-medium">{sessionStats.messageStats.total}</span>
                </div>
                <div className="flex justify-between text-purple-600">
                  <span>Manager</span>
                  <span>{sessionStats.messageStats.manager}</span>
                </div>
                <div className="flex justify-between text-blue-600">
                  <span>Worker</span>
                  <span>{sessionStats.messageStats.worker}</span>
                </div>
                <div className="flex justify-between">
                  <span>Prompts</span>
                  <span>{sessionStats.messageStats.prompts}</span>
                </div>
                <div className="flex justify-between">
                  <span>Responses</span>
                  <span>{sessionStats.messageStats.responses}</span>
                </div>
                <div className="flex justify-between text-orange-600">
                  <span>Tool Calls</span>
                  <span>{sessionStats.messageStats.tools}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Errors</span>
                  <span>{sessionStats.messageStats.errors}</span>
                </div>
              </div>
            </div>

            {/* Performance metrics */}
            <div>
              <div className="text-gray-500 mb-2">Performance</div>
              <div className="space-y-1">
                {sessionStats.performance.totalCost > 0 && (
                  <div className="flex justify-between">
                    <span>Total Cost</span>
                    <span className="font-medium">{formatCost(sessionStats.performance.totalCost)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Error Rate</span>
                  <span className={sessionStats.performance.errorRate > 0.1 ? 'text-red-600' : 'text-green-600'}>
                    {(sessionStats.performance.errorRate * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Efficiency</span>
                  <span className="text-blue-600">
                    {(sessionStats.performance.efficiency * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Avg Event Spacing</span>
                  <span>{formatDuration(sessionStats.timing.avgEventSpacing)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bookmarks */}
        {renderSection(
          'bookmarks',
          'Bookmarks',
          <Bookmark size={16} />,
          <div className="space-y-2">
            {replayState.bookmarks.length > 0 ? (
              replayState.bookmarks.map(bookmark => (
                <div key={bookmark.id} className="p-2 bg-gray-50 rounded text-xs">
                  <div className="font-medium">{bookmark.title}</div>
                  {bookmark.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {bookmark.tags.map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-gray-500 text-xs">No bookmarks yet</div>
            )}
          </div>,
          <Badge variant="secondary" className="text-xs">
            {replayState.bookmarks.length}
          </Badge>
        )}

        {/* Annotations */}
        {renderSection(
          'annotations',
          'Annotations',
          <MessageSquare size={16} />,
          <div className="space-y-2">
            {replayState.annotations.length > 0 ? (
              replayState.annotations.map(annotation => (
                <div key={annotation.id} className="p-2 bg-gray-50 rounded text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-4 h-4 bg-green-500 rounded-full text-white flex items-center justify-center text-xs">
                      {annotation.author[0].toUpperCase()}
                    </div>
                    <span className="font-medium">{annotation.author}</span>
                  </div>
                  <div className="text-gray-700">{annotation.content}</div>
                </div>
              ))
            ) : (
              <div className="text-gray-500 text-xs">No annotations yet</div>
            )}
          </div>,
          <Badge variant="secondary" className="text-xs">
            {replayState.annotations.length}
          </Badge>
        )}

        {/* Segments */}
        {renderSection(
          'segments',
          'Segments',
          <Hash size={16} />,
          <div className="space-y-2">
            {replayState.segments.length > 0 ? (
              replayState.segments.map(segment => (
                <div key={segment.id} className="p-2 bg-gray-50 rounded text-xs">
                  <div className="font-medium">{segment.title}</div>
                  {segment.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {segment.tags.map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-gray-500 text-xs">No segments defined</div>
            )}
          </div>,
          <Badge variant="secondary" className="text-xs">
            {replayState.segments.length}
          </Badge>
        )}

        {/* Key Moments */}
        {renderSection(
          'keyMoments',
          'Key Moments',
          <AlertCircle size={16} />,
          <div className="space-y-2">
            {metadata.keyMoments.length > 0 ? (
              metadata.keyMoments
                .sort((a, b) => b.importance.localeCompare(a.importance))
                .map((moment, index) => (
                  <div key={index} className="p-2 bg-gray-50 rounded text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${getImportanceColor(moment.importance)}`}
                      >
                        {moment.importance}
                      </Badge>
                      <span className="text-gray-500">
                        {formatRelativeTime(new Date(moment.timestamp))}
                      </span>
                    </div>
                    <div className="text-gray-700">{moment.description}</div>
                  </div>
                ))
            ) : (
              <div className="text-gray-500 text-xs">No key moments identified</div>
            )}
          </div>,
          <Badge 
            variant={metadata.keyMoments.some(m => m.importance === 'high') ? 'destructive' : 'secondary'} 
            className="text-xs"
          >
            {metadata.keyMoments.length}
          </Badge>
        )}
      </div>

      {/* Current position info */}
      <div className="p-4 border-t bg-gray-50">
        <div className="text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-500">Current Position</span>
            <span className="font-medium">
              {replayState.currentIndex + 1} / {replayState.totalEvents}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Progress</span>
            <span className="font-medium">
              {replayState.totalEvents > 0 
                ? ((replayState.currentIndex / (replayState.totalEvents - 1)) * 100).toFixed(1)
                : 0}%
            </span>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
          <div 
            className="bg-blue-500 h-1.5 rounded-full transition-all duration-200"
            style={{ 
              width: replayState.totalEvents > 0 
                ? `${(replayState.currentIndex / (replayState.totalEvents - 1)) * 100}%` 
                : '0%' 
            }}
          />
        </div>
      </div>
    </div>
  );
}