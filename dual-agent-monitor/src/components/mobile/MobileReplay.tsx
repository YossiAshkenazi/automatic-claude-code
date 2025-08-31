import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Play, Pause, SkipForward, SkipBack, Square, RotateCcw, Settings, Maximize2, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { DualAgentSession, AgentMessage } from '../../types';
import { formatDate } from '../../utils/formatters';
import { cn } from '../../lib/utils';

interface MobileReplayProps {
  session: DualAgentSession;
  onClose?: () => void;
}

interface ReplaySettings {
  speed: number;
  autoPlay: boolean;
  showTimestamps: boolean;
  filterAgent: 'all' | 'manager' | 'worker';
  soundEnabled: boolean;
}

interface TimelineEvent {
  id: string;
  timestamp: Date;
  agentType: 'manager' | 'worker';
  content: string;
  type: 'message' | 'status_change' | 'error';
  duration?: number;
}

const speedOptions = [
  { value: 0.25, label: '0.25x' },
  { value: 0.5, label: '0.5x' },
  { value: 1, label: '1x' },
  { value: 1.5, label: '1.5x' },
  { value: 2, label: '2x' },
  { value: 4, label: '4x' }
];

export function MobileReplay({ session, onClose }: MobileReplayProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<ReplaySettings>({
    speed: 1,
    autoPlay: false,
    showTimestamps: true,
    filterAgent: 'all',
    soundEnabled: false
  });
  const [progress, setProgress] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const timelineRef = useRef<HTMLDivElement>(null);
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { scrollY } = useScroll();
  const headerOpacity = useTransform(scrollY, [0, 100], [1, 0.95]);

  // Convert messages to timeline events
  const timelineEvents: TimelineEvent[] = useMemo(() => {
    let events: TimelineEvent[] = session.messages.map(msg => ({
      id: `${msg.sessionId}-${msg.timestamp}`,
      timestamp: new Date(msg.timestamp),
      agentType: msg.agentType,
      content: msg.content,
      type: 'message' as const
    }));

    // Filter by agent if needed
    if (settings.filterAgent !== 'all') {
      events = events.filter(event => event.agentType === settings.filterAgent);
    }

    // Sort by timestamp
    events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return events;
  }, [session.messages, settings.filterAgent]);

  const currentEvent = timelineEvents[currentIndex];
  const totalEvents = timelineEvents.length;

  // Auto-play logic
  useEffect(() => {
    if (isPlaying && currentIndex < totalEvents - 1) {
      const baseInterval = 2000; // 2 seconds base interval
      const interval = baseInterval / settings.speed;
      
      playbackTimerRef.current = setTimeout(() => {
        setCurrentIndex(prev => Math.min(prev + 1, totalEvents - 1));
        setProgress((currentIndex + 1) / totalEvents * 100);
      }, interval);
    } else if (currentIndex >= totalEvents - 1) {
      setIsPlaying(false);
    }

    return () => {
      if (playbackTimerRef.current) {
        clearTimeout(playbackTimerRef.current);
      }
    };
  }, [isPlaying, currentIndex, totalEvents, settings.speed]);

  // Update progress when index changes
  useEffect(() => {
    setProgress(totalEvents > 0 ? (currentIndex / (totalEvents - 1)) * 100 : 0);
  }, [currentIndex, totalEvents]);

  // Touch gesture handlers
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;
    
    if (isLeftSwipe && currentIndex < totalEvents - 1) {
      setCurrentIndex(prev => prev + 1);
    }
    if (isRightSwipe && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handlePlay = () => {
    if (currentIndex >= totalEvents - 1) {
      setCurrentIndex(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleSkipForward = () => {
    setCurrentIndex(prev => Math.min(prev + 1, totalEvents - 1));
  };

  const handleSkipBack = () => {
    setCurrentIndex(prev => Math.max(prev - 1, 0));
  };

  const handleReset = () => {
    setCurrentIndex(0);
    setIsPlaying(false);
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newIndex = Math.round((parseInt(e.target.value) / 100) * (totalEvents - 1));
    setCurrentIndex(newIndex);
    setIsPlaying(false);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div className={cn(
      "min-h-screen bg-black text-white flex flex-col",
      isFullscreen && "fixed inset-0 z-50"
    )}>
      {/* Header */}
      <motion.div 
        style={{ opacity: headerOpacity }}
        className="bg-black/90 backdrop-blur-sm border-b border-gray-800 p-4 sticky top-0 z-40"
      >
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="font-semibold text-white truncate text-sm">
              Session Replay
            </h1>
            <p className="text-xs text-gray-400 truncate">
              {session.initialTask}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={cn(
                "p-2 rounded-lg transition-colors",
                showSettings ? "bg-blue-600" : "bg-gray-800 hover:bg-gray-700"
              )}
            >
              <Settings size={18} />
            </button>
            
            <button
              onClick={toggleFullscreen}
              className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <Maximize2 size={18} />
            </button>
            
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        
        {/* Settings Panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-4 p-4 bg-gray-900 rounded-lg overflow-hidden"
            >
              <div className="grid grid-cols-2 gap-4">
                {/* Speed Control */}
                <div>
                  <label className="block text-xs text-gray-400 mb-2">Playback Speed</label>
                  <div className="flex flex-wrap gap-1">
                    {speedOptions.map(option => (
                      <button
                        key={option.value}
                        onClick={() => setSettings(prev => ({ ...prev, speed: option.value }))}
                        className={cn(
                          "px-2 py-1 text-xs rounded transition-colors",
                          settings.speed === option.value
                            ? "bg-blue-600 text-white"
                            : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Filter Control */}
                <div>
                  <label className="block text-xs text-gray-400 mb-2">Filter Agent</label>
                  <div className="flex gap-1">
                    {[
                      { value: 'all', label: 'All' },
                      { value: 'manager', label: 'Manager' },
                      { value: 'worker', label: 'Worker' }
                    ].map(option => (
                      <button
                        key={option.value}
                        onClick={() => setSettings(prev => ({ ...prev, filterAgent: option.value as any }))}
                        className={cn(
                          "px-2 py-1 text-xs rounded transition-colors",
                          settings.filterAgent === option.value
                            ? "bg-blue-600 text-white"
                            : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Toggle Options */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.showTimestamps}
                    onChange={(e) => setSettings(prev => ({ ...prev, showTimestamps: e.target.checked }))}
                    className="rounded bg-gray-800 border-gray-700"
                  />
                  <span className="text-xs text-gray-300">Show Timestamps</span>
                </label>
                
                <button
                  onClick={() => setSettings(prev => ({ ...prev, soundEnabled: !prev.soundEnabled }))}
                  className={cn(
                    "p-1 rounded transition-colors",
                    settings.soundEnabled ? "text-blue-400" : "text-gray-500"
                  )}
                >
                  {settings.soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Progress Bar */}
      <div className="px-4 py-2 bg-black/50">
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span>{currentIndex + 1}</span>
          <div className="flex-1">
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={handleProgressChange}
              className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>
          <span>{totalEvents}</span>
        </div>
      </div>

      {/* Main Content */}
      <div 
        className="flex-1 overflow-y-auto"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        ref={timelineRef}
      >
        {currentEvent ? (
          <motion.div
            key={currentEvent.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="p-6"
          >
            {/* Event Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold",
                currentEvent.agentType === 'manager'
                  ? "bg-blue-600 text-white"
                  : "bg-green-600 text-white"
              )}>
                {currentEvent.agentType === 'manager' ? 'M' : 'W'}
              </div>
              
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-white">
                  {currentEvent.agentType === 'manager' ? 'Manager Agent' : 'Worker Agent'}
                </div>
                {settings.showTimestamps && (
                  <div className="text-sm text-gray-400">
                    {formatDate(currentEvent.timestamp)}
                  </div>
                )}
              </div>
              
              <div className={cn(
                "px-2 py-1 rounded-full text-xs font-medium",
                currentEvent.type === 'message' ? "bg-gray-800 text-gray-300" :
                currentEvent.type === 'error' ? "bg-red-900 text-red-200" :
                "bg-blue-900 text-blue-200"
              )}>
                {currentEvent.type.replace('_', ' ')}
              </div>
            </div>
            
            {/* Event Content */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gray-900 rounded-lg p-4 mb-4"
            >
              <div className="text-gray-100 whitespace-pre-wrap text-sm leading-relaxed">
                {currentEvent.content}
              </div>
            </motion.div>
            
            {/* Navigation Hint */}
            <div className="text-center text-gray-500 text-xs">
              Swipe left/right or use controls to navigate
            </div>
          </motion.div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <div className="text-2xl mb-2">📱</div>
              <p>No events to display</p>
            </div>
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="bg-black/90 backdrop-blur-sm border-t border-gray-800 p-4">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={handleReset}
            className="p-3 bg-gray-800 hover:bg-gray-700 rounded-full transition-colors"
            disabled={currentIndex === 0}
          >
            <RotateCcw size={18} className={currentIndex === 0 ? 'text-gray-600' : 'text-white'} />
          </button>
          
          <button
            onClick={handleSkipBack}
            className="p-3 bg-gray-800 hover:bg-gray-700 rounded-full transition-colors"
            disabled={currentIndex === 0}
          >
            <SkipBack size={18} className={currentIndex === 0 ? 'text-gray-600' : 'text-white'} />
          </button>
          
          <button
            onClick={handlePlay}
            className="p-4 bg-blue-600 hover:bg-blue-700 rounded-full transition-colors"
            disabled={totalEvents === 0}
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>
          
          <button
            onClick={handleSkipForward}
            className="p-3 bg-gray-800 hover:bg-gray-700 rounded-full transition-colors"
            disabled={currentIndex >= totalEvents - 1}
          >
            <SkipForward size={18} className={currentIndex >= totalEvents - 1 ? 'text-gray-600' : 'text-white'} />
          </button>
          
          <button
            onClick={() => setCurrentIndex(totalEvents - 1)}
            className="p-3 bg-gray-800 hover:bg-gray-700 rounded-full transition-colors"
            disabled={currentIndex >= totalEvents - 1}
          >
            <Square size={18} className={currentIndex >= totalEvents - 1 ? 'text-gray-600' : 'text-white'} />
          </button>
        </div>
        
        {/* Speed Indicator */}
        <div className="text-center mt-3">
          <span className="text-xs text-gray-400">
            Speed: {settings.speed}x | {settings.filterAgent === 'all' ? 'All Agents' : 
              settings.filterAgent === 'manager' ? 'Manager Only' : 'Worker Only'}
          </span>
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
        }
        
        .slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
}