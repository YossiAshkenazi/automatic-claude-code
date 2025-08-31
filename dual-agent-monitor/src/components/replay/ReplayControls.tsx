import React, { useState } from 'react';
import { 
  Play, 
  Pause, 
  Square, 
  SkipBack, 
  SkipForward, 
  ChevronLeft, 
  ChevronRight, 
  Bookmark,
  RotateCcw,
  RotateCw,
  Gauge,
  Clock,
  Target
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { formatDuration } from '../../utils/formatters';

interface ReplayState {
  currentIndex: number;
  totalEvents: number;
  isPlaying: boolean;
  playbackSpeed: number;
  timeline: Array<{
    timestamp: Date;
    type: string;
    data: any;
  }>;
}

interface ReplayControlsProps {
  replayState: ReplayState;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onStepForward: () => void;
  onStepBackward: () => void;
  onSeek: (position: number) => void;
  onSpeedChange: (speed: number) => void;
  onAddBookmark: () => void;
  showAdvancedControls?: boolean;
}

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0, 4.0];

export function ReplayControls({
  replayState,
  onPlay,
  onPause,
  onStop,
  onStepForward,
  onStepBackward,
  onSeek,
  onSpeedChange,
  onAddBookmark,
  showAdvancedControls = true
}: ReplayControlsProps) {
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  
  const progress = replayState.totalEvents > 0 
    ? (replayState.currentIndex / (replayState.totalEvents - 1)) * 100 
    : 0;

  const currentEvent = replayState.timeline[replayState.currentIndex];
  const firstEvent = replayState.timeline[0];
  const lastEvent = replayState.timeline[replayState.timeline.length - 1];
  
  const getCurrentTime = () => {
    if (!currentEvent || !firstEvent) return 0;
    return new Date(currentEvent.timestamp).getTime() - new Date(firstEvent.timestamp).getTime();
  };
  
  const getTotalDuration = () => {
    if (!firstEvent || !lastEvent) return 0;
    return new Date(lastEvent.timestamp).getTime() - new Date(firstEvent.timestamp).getTime();
  };

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const position = parseFloat(event.target.value);
    const targetIndex = Math.round((position / 100) * (replayState.totalEvents - 1));
    onSeek(targetIndex);
  };

  const handleSpeedSelect = (speed: number) => {
    onSpeedChange(speed);
    setShowSpeedMenu(false);
  };

  const jumpToStart = () => {
    onSeek(0);
  };

  const jumpToEnd = () => {
    onSeek(replayState.totalEvents - 1);
  };

  const skipToNextAgent = () => {
    if (!currentEvent || currentEvent.type !== 'message') return;
    
    const currentAgent = currentEvent.data.agentType;
    for (let i = replayState.currentIndex + 1; i < replayState.timeline.length; i++) {
      const event = replayState.timeline[i];
      if (event.type === 'message' && event.data.agentType !== currentAgent) {
        onSeek(i);
        break;
      }
    }
  };

  const skipToPrevAgent = () => {
    if (!currentEvent || currentEvent.type !== 'message') return;
    
    const currentAgent = currentEvent.data.agentType;
    for (let i = replayState.currentIndex - 1; i >= 0; i--) {
      const event = replayState.timeline[i];
      if (event.type === 'message' && event.data.agentType !== currentAgent) {
        onSeek(i);
        break;
      }
    }
  };

  const skipToNextTool = () => {
    for (let i = replayState.currentIndex + 1; i < replayState.timeline.length; i++) {
      const event = replayState.timeline[i];
      if (event.type === 'message' && event.data.messageType === 'tool_call') {
        onSeek(i);
        break;
      }
    }
  };

  const skipToNextError = () => {
    for (let i = replayState.currentIndex + 1; i < replayState.timeline.length; i++) {
      const event = replayState.timeline[i];
      if (event.type === 'message' && event.data.messageType === 'error') {
        onSeek(i);
        break;
      }
    }
  };

  const canStepBackward = replayState.currentIndex > 0;
  const canStepForward = replayState.currentIndex < replayState.totalEvents - 1;
  const isAtStart = replayState.currentIndex === 0;
  const isAtEnd = replayState.currentIndex === replayState.totalEvents - 1;

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            Event {replayState.currentIndex + 1} of {replayState.totalEvents}
          </span>
          <span>
            {formatDuration(getCurrentTime())} / {formatDuration(getTotalDuration())}
          </span>
        </div>
        
        <div className="relative">
          <input
            type="range"
            min="0"
            max="100"
            value={progress}
            onChange={handleSeek}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
          />
          <div 
            className="absolute top-0 left-0 h-2 bg-blue-500 rounded-lg pointer-events-none"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Main controls */}
      <div className="flex items-center justify-center gap-2">
        {/* Jump to start */}
        <Button
          variant="outline"
          size="sm"
          onClick={jumpToStart}
          disabled={isAtStart}
          title="Jump to start"
        >
          <SkipBack size={16} />
        </Button>

        {/* Step backward */}
        <Button
          variant="outline"
          size="sm"
          onClick={onStepBackward}
          disabled={!canStepBackward}
          title="Step backward"
        >
          <ChevronLeft size={16} />
        </Button>

        {/* Play/Pause */}
        <Button
          variant={replayState.isPlaying ? "secondary" : "primary"}
          size="lg"
          onClick={replayState.isPlaying ? onPause : onPlay}
          disabled={replayState.totalEvents === 0}
          title={replayState.isPlaying ? "Pause" : "Play"}
        >
          {replayState.isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </Button>

        {/* Stop */}
        <Button
          variant="outline"
          size="sm"
          onClick={onStop}
          title="Stop and reset to start"
        >
          <Square size={16} />
        </Button>

        {/* Step forward */}
        <Button
          variant="outline"
          size="sm"
          onClick={onStepForward}
          disabled={!canStepForward}
          title="Step forward"
        >
          <ChevronRight size={16} />
        </Button>

        {/* Jump to end */}
        <Button
          variant="outline"
          size="sm"
          onClick={jumpToEnd}
          disabled={isAtEnd}
          title="Jump to end"
        >
          <SkipForward size={16} />
        </Button>
      </div>

      {/* Speed control and additional controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Speed control */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              className="flex items-center gap-1"
            >
              <Gauge size={14} />
              {replayState.playbackSpeed}x
            </Button>
            
            {showSpeedMenu && (
              <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-10 min-w-20">
                {SPEED_OPTIONS.map(speed => (
                  <button
                    key={speed}
                    onClick={() => handleSpeedSelect(speed)}
                    className={`w-full text-left px-3 py-1 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                      speed === replayState.playbackSpeed ? 'bg-blue-50 text-blue-600' : ''
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Current event type indicator */}
          {currentEvent && (
            <Badge 
              variant={
                currentEvent.type === 'message' 
                  ? currentEvent.data.agentType === 'manager' 
                    ? 'default' 
                    : 'secondary'
                  : 'outline'
              }
              className="text-xs"
            >
              {currentEvent.type === 'message' 
                ? `${currentEvent.data.agentType} ${currentEvent.data.messageType}`
                : currentEvent.type.replace('_', ' ')
              }
            </Badge>
          )}

          {/* Playback status */}
          {replayState.isPlaying && (
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Playing
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Bookmark current position */}
          <Button
            variant="outline"
            size="sm"
            onClick={onAddBookmark}
            title="Bookmark current position"
          >
            <Bookmark size={14} />
          </Button>

          {showAdvancedControls && (
            <>
              {/* Skip to next agent */}
              <Button
                variant="outline"
                size="sm"
                onClick={skipToNextAgent}
                disabled={!currentEvent || currentEvent.type !== 'message'}
                title="Skip to next agent"
                className="hidden sm:flex"
              >
                <Target size={14} />
                Agent
              </Button>

              {/* Skip to next tool call */}
              <Button
                variant="outline"
                size="sm"
                onClick={skipToNextTool}
                title="Skip to next tool call"
                className="hidden md:flex"
              >
                <RotateCw size={14} />
                Tool
              </Button>

              {/* Skip to next error */}
              <Button
                variant="outline"
                size="sm"
                onClick={skipToNextError}
                title="Skip to next error"
                className="hidden md:flex"
              >
                <RotateCcw size={14} />
                Error
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Time display */}
      {currentEvent && (
        <div className="text-center">
          <div className="inline-flex items-center gap-1 text-sm text-gray-500 bg-gray-50 px-3 py-1 rounded-full">
            <Clock size={12} />
            {new Date(currentEvent.timestamp).toLocaleString()}
          </div>
        </div>
      )}

      {/* Keyboard shortcuts hint */}
      <div className="text-xs text-gray-400 text-center">
        <div className="flex items-center justify-center gap-4">
          <span>Space: Play/Pause</span>
          <span>← →: Step</span>
          <span>Home/End: Jump</span>
          <span>B: Bookmark</span>
        </div>
      </div>

      {/* Custom CSS for slider */}
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        
        .slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
      `}</style>
    </div>
  );
}