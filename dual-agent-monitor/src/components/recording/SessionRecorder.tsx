import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Record, 
  Square, 
  Pause, 
  Play, 
  Settings, 
  Eye, 
  EyeOff, 
  Mic, 
  MicOff, 
  Camera, 
  CameraOff,
  Save,
  AlertCircle,
  CheckCircle,
  Clock,
  HardDrive,
  Activity
} from 'lucide-react';
import { SessionRecording, AgentMessage, SystemEvent, AgentCommunication } from '../../types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';

interface SessionRecorderProps {
  sessionId: string;
  onRecordingStart?: (recordingId: string) => void;
  onRecordingStop?: (recordingId: string) => void;
  onRecordingUpdate?: (recording: SessionRecording) => void;
  onInteractionCapture?: (interaction: any) => void;
  autoStart?: boolean;
  recordingQuality?: 'low' | 'medium' | 'high' | 'lossless';
  className?: string;
}

interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  startTime?: Date;
  pausedTime?: Date;
  totalPauseTime: number;
  currentRecordingId?: string;
}

interface RecordingStats {
  duration: number;
  interactionCount: number;
  sizeBytes: number;
  messagesRecorded: number;
  eventsRecorded: number;
  errorsRecorded: number;
}

interface RecordingSettings {
  captureMessages: boolean;
  captureSystemEvents: boolean;
  captureAgentCommunications: boolean;
  capturePerformanceMetrics: boolean;
  captureScreenshots: boolean;
  compressionEnabled: boolean;
  qualityLevel: 'low' | 'medium' | 'high' | 'lossless';
  maxRecordingSize: number; // in MB
  autoStopOnError: boolean;
  enableLivePreview: boolean;
}

export const SessionRecorder: React.FC<SessionRecorderProps> = ({
  sessionId,
  onRecordingStart,
  onRecordingStop,
  onRecordingUpdate,
  onInteractionCapture,
  autoStart = false,
  recordingQuality = 'high',
  className = ''
}) => {
  // State management
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    totalPauseTime: 0
  });

  const [recordingStats, setRecordingStats] = useState<RecordingStats>({
    duration: 0,
    interactionCount: 0,
    sizeBytes: 0,
    messagesRecorded: 0,
    eventsRecorded: 0,
    errorsRecorded: 0
  });

  const [settings, setSettings] = useState<RecordingSettings>({
    captureMessages: true,
    captureSystemEvents: true,
    captureAgentCommunications: true,
    capturePerformanceMetrics: true,
    captureScreenshots: false,
    compressionEnabled: true,
    qualityLevel: recordingQuality,
    maxRecordingSize: 500, // 500MB
    autoStopOnError: false,
    enableLivePreview: true
  });

  const [showSettings, setShowSettings] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Refs for tracking and cleanup
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const statsUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventListenersRef = useRef<(() => void)[]>([]);
  const interactionBufferRef = useRef<any[]>([]);
  const lastFlushTimeRef = useRef<number>(Date.now());

  // Initialize recording system
  useEffect(() => {
    const initialize = async () => {
      try {
        // Check if recording API is available
        if (typeof window !== 'undefined') {
          await setupEventListeners();
          setIsInitialized(true);
          
          if (autoStart) {
            await startRecording();
          }
        }
      } catch (error) {
        console.error('Failed to initialize session recorder:', error);
        setLastError('Failed to initialize recording system');
      }
    };

    initialize();

    return () => {
      cleanup();
    };
  }, [sessionId, autoStart]);

  // Setup event listeners for capturing interactions
  const setupEventListeners = useCallback(async () => {
    if (typeof window === 'undefined') return;

    // Listen for WebSocket messages (agent communications)
    const handleWebSocketMessage = (event: MessageEvent) => {
      if (recordingState.isRecording && !recordingState.isPaused) {
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          captureInteraction({
            type: 'agent_communication',
            content: data,
            timestamp: new Date(),
            metadata: {
              source: 'websocket',
              messageType: data.type
            }
          });
        } catch (error) {
          console.warn('Failed to capture WebSocket message:', error);
        }
      }
    };

    // Listen for fetch requests (API calls)
    const originalFetch = window.fetch;
    const fetchWrapper = async (input: RequestInfo | URL, init?: RequestInit) => {
      const startTime = Date.now();
      const response = await originalFetch(input, init);
      const endTime = Date.now();

      if (recordingState.isRecording && !recordingState.isPaused) {
        captureInteraction({
          type: 'api_call',
          content: {
            url: input.toString(),
            method: init?.method || 'GET',
            status: response.status,
            duration: endTime - startTime
          },
          timestamp: new Date(),
          durationMs: endTime - startTime,
          metadata: {
            source: 'fetch_api',
            requestInit: init
          }
        });
      }

      return response;
    };
    window.fetch = fetchWrapper;

    // Listen for console messages (errors, logs)
    const originalConsole = { ...console };
    ['log', 'error', 'warn', 'info'].forEach(method => {
      (console as any)[method] = (...args: any[]) => {
        if (recordingState.isRecording && !recordingState.isPaused) {
          captureInteraction({
            type: method === 'error' ? 'error' : 'system_event',
            content: {
              level: method,
              message: args.join(' '),
              args
            },
            timestamp: new Date(),
            metadata: {
              source: 'console',
              level: method
            }
          });
        }
        originalConsole[method as keyof typeof originalConsole](...args);
      };
    });

    // Listen for errors
    const handleError = (event: ErrorEvent) => {
      if (recordingState.isRecording && !recordingState.isPaused) {
        captureInteraction({
          type: 'error',
          content: {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            error: event.error?.toString()
          },
          timestamp: new Date(),
          metadata: {
            source: 'window_error',
            type: 'javascript_error'
          }
        });
      }
    };
    window.addEventListener('error', handleError);

    // Store cleanup functions
    eventListenersRef.current = [
      () => {
        window.fetch = originalFetch;
        Object.assign(console, originalConsole);
        window.removeEventListener('error', handleError);
      }
    ];
  }, [recordingState.isRecording, recordingState.isPaused]);

  // Capture interaction and buffer it
  const captureInteraction = useCallback((interaction: any) => {
    if (!recordingState.isRecording || recordingState.isPaused) return;

    const enrichedInteraction = {
      ...interaction,
      id: `interaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      recordingId: recordingState.currentRecordingId,
      relativeTimeMs: Date.now() - (recordingState.startTime?.getTime() || Date.now()),
      sequenceNumber: recordingStats.interactionCount + interactionBufferRef.current.length,
      capturedAt: new Date().toISOString()
    };

    // Add to buffer
    interactionBufferRef.current.push(enrichedInteraction);

    // Update stats
    setRecordingStats(prev => ({
      ...prev,
      interactionCount: prev.interactionCount + 1,
      sizeBytes: prev.sizeBytes + JSON.stringify(enrichedInteraction).length,
      messagesRecorded: prev.messagesRecorded + (interaction.type === 'message' ? 1 : 0),
      eventsRecorded: prev.eventsRecorded + (interaction.type === 'system_event' ? 1 : 0),
      errorsRecorded: prev.errorsRecorded + (interaction.type === 'error' ? 1 : 0)
    }));

    // Notify parent component
    if (onInteractionCapture) {
      onInteractionCapture(enrichedInteraction);
    }

    // Flush buffer if needed (every 5 seconds or 100 interactions)
    const now = Date.now();
    if (
      interactionBufferRef.current.length >= 100 || 
      now - lastFlushTimeRef.current > 5000
    ) {
      flushInteractionBuffer();
    }
  }, [recordingState, sessionId, recordingStats.interactionCount, onInteractionCapture]);

  // Flush interaction buffer to storage
  const flushInteractionBuffer = useCallback(async () => {
    if (interactionBufferRef.current.length === 0) return;

    try {
      const interactions = [...interactionBufferRef.current];
      interactionBufferRef.current = [];
      lastFlushTimeRef.current = Date.now();

      // Send to API
      await fetch('/api/recordings/interactions/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordingId: recordingState.currentRecordingId,
          interactions
        })
      });
    } catch (error) {
      console.error('Failed to flush interaction buffer:', error);
      // Put interactions back in buffer for retry
      interactionBufferRef.current.unshift(...interactionBufferRef.current);
    }
  }, [recordingState.currentRecordingId]);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setLastError(null);
      
      // Create recording via API
      const response = await fetch('/api/recordings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          recordingName: `Session Recording ${new Date().toLocaleString()}`,
          description: `Automated recording of session ${sessionId}`,
          recordingQuality: settings.qualityLevel,
          settings
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to start recording: ${response.statusText}`);
      }

      const { recordingId } = await response.json();

      const startTime = new Date();
      setRecordingState({
        isRecording: true,
        isPaused: false,
        startTime,
        totalPauseTime: 0,
        currentRecordingId: recordingId
      });

      // Reset stats
      setRecordingStats({
        duration: 0,
        interactionCount: 0,
        sizeBytes: 0,
        messagesRecorded: 0,
        eventsRecorded: 0,
        errorsRecorded: 0
      });

      // Start update intervals
      recordingIntervalRef.current = setInterval(() => {
        setRecordingStats(prev => ({
          ...prev,
          duration: Date.now() - startTime.getTime() - recordingState.totalPauseTime
        }));
      }, 1000);

      statsUpdateIntervalRef.current = setInterval(() => {
        flushInteractionBuffer();
      }, 10000); // Flush every 10 seconds

      if (onRecordingStart) {
        onRecordingStart(recordingId);
      }

      console.log(`Started recording session ${sessionId} with ID ${recordingId}`);
    } catch (error) {
      console.error('Failed to start recording:', error);
      setLastError(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }, [sessionId, settings, onRecordingStart, recordingState.totalPauseTime, flushInteractionBuffer]);

  // Stop recording
  const stopRecording = useCallback(async () => {
    try {
      if (!recordingState.currentRecordingId) return;

      // Flush any remaining interactions
      await flushInteractionBuffer();

      // Stop recording via API
      await fetch(`/api/recordings/${recordingState.currentRecordingId}/stop`, {
        method: 'POST'
      });

      // Clear intervals
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      if (statsUpdateIntervalRef.current) {
        clearInterval(statsUpdateIntervalRef.current);
        statsUpdateIntervalRef.current = null;
      }

      const recordingId = recordingState.currentRecordingId;
      setRecordingState({
        isRecording: false,
        isPaused: false,
        totalPauseTime: 0
      });

      if (onRecordingStop) {
        onRecordingStop(recordingId);
      }

      console.log(`Stopped recording ${recordingId}`);
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setLastError(error instanceof Error ? error.message : 'Failed to stop recording');
    }
  }, [recordingState.currentRecordingId, onRecordingStop, flushInteractionBuffer]);

  // Pause/Resume recording
  const togglePause = useCallback(() => {
    if (recordingState.isPaused) {
      // Resume
      const pausedDuration = Date.now() - (recordingState.pausedTime?.getTime() || Date.now());
      setRecordingState(prev => ({
        ...prev,
        isPaused: false,
        pausedTime: undefined,
        totalPauseTime: prev.totalPauseTime + pausedDuration
      }));
    } else {
      // Pause
      setRecordingState(prev => ({
        ...prev,
        isPaused: true,
        pausedTime: new Date()
      }));
    }
  }, [recordingState.isPaused, recordingState.pausedTime]);

  // Cleanup function
  const cleanup = useCallback(() => {
    // Stop recording if active
    if (recordingState.isRecording) {
      stopRecording();
    }

    // Clear intervals
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
    if (statsUpdateIntervalRef.current) {
      clearInterval(statsUpdateIntervalRef.current);
    }

    // Remove event listeners
    eventListenersRef.current.forEach(cleanup => cleanup());
    eventListenersRef.current = [];

    // Flush remaining interactions
    flushInteractionBuffer();
  }, [recordingState.isRecording, stopRecording, flushInteractionBuffer]);

  // Format duration for display
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000) % 60;
    const minutes = Math.floor(ms / 60000) % 60;
    const hours = Math.floor(ms / 3600000);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  };

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!isInitialized) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="flex items-center justify-center space-x-2 text-gray-500">
          <Activity className="w-4 h-4 animate-spin" />
          <span>Initializing recording system...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`${className}`}>
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${recordingState.isRecording ? (recordingState.isPaused ? 'bg-yellow-500 animate-pulse' : 'bg-red-500 animate-pulse') : 'bg-gray-300'}`} />
            <h3 className="font-semibold text-gray-900">
              Session Recorder
            </h3>
            {recordingState.isRecording && (
              <Badge variant={recordingState.isPaused ? 'secondary' : 'destructive'}>
                {recordingState.isPaused ? 'Paused' : 'Recording'}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {recordingState.isRecording && (
              <div className="text-sm text-gray-600">
                {formatDuration(recordingStats.duration)}
              </div>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {lastError && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center space-x-2 text-red-700">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{lastError}</span>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4">
        <div className="flex items-center justify-center space-x-3 mb-4">
          {!recordingState.isRecording ? (
            <Button
              onClick={startRecording}
              className="bg-red-600 hover:bg-red-700 text-white"
              size="lg"
            >
              <Record className="w-5 h-5 mr-2" />
              Start Recording
            </Button>
          ) : (
            <>
              <Button
                onClick={togglePause}
                variant={recordingState.isPaused ? 'default' : 'secondary'}
                size="lg"
              >
                {recordingState.isPaused ? (
                  <>
                    <Play className="w-5 h-5 mr-2" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="w-5 h-5 mr-2" />
                    Pause
                  </>
                )}
              </Button>
              
              <Button
                onClick={stopRecording}
                variant="destructive"
                size="lg"
              >
                <Square className="w-5 h-5 mr-2" />
                Stop
              </Button>
            </>
          )}
        </div>

        {/* Stats */}
        {recordingState.isRecording && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <div>
                  <p className="text-xs text-blue-900">Duration</p>
                  <p className="text-sm font-semibold text-blue-600">
                    {formatDuration(recordingStats.duration)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4 text-green-600" />
                <div>
                  <p className="text-xs text-green-900">Interactions</p>
                  <p className="text-sm font-semibold text-green-600">
                    {recordingStats.interactionCount}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <HardDrive className="w-4 h-4 text-purple-600" />
                <div>
                  <p className="text-xs text-purple-900">Size</p>
                  <p className="text-sm font-semibold text-purple-600">
                    {formatFileSize(recordingStats.sizeBytes)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-orange-50 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-orange-600" />
                <div>
                  <p className="text-xs text-orange-900">Quality</p>
                  <p className="text-sm font-semibold text-orange-600">
                    {settings.qualityLevel.toUpperCase()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Detailed Stats */}
        {recordingState.isRecording && (
          <div className="text-xs text-gray-500 space-y-1">
            <div className="flex justify-between">
              <span>Messages:</span>
              <span>{recordingStats.messagesRecorded}</span>
            </div>
            <div className="flex justify-between">
              <span>Events:</span>
              <span>{recordingStats.eventsRecorded}</span>
            </div>
            <div className="flex justify-between">
              <span>Errors:</span>
              <span className={recordingStats.errorsRecorded > 0 ? 'text-red-500' : ''}>
                {recordingStats.errorsRecorded}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Buffer:</span>
              <span>{interactionBufferRef.current.length} pending</span>
            </div>
          </div>
        )}
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <h4 className="font-medium text-gray-900 mb-3">Recording Settings</h4>
          
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={settings.captureMessages}
                  onChange={(e) => setSettings(prev => ({ ...prev, captureMessages: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm">Capture Messages</span>
              </label>
              
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={settings.captureSystemEvents}
                  onChange={(e) => setSettings(prev => ({ ...prev, captureSystemEvents: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm">Capture System Events</span>
              </label>
              
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={settings.capturePerformanceMetrics}
                  onChange={(e) => setSettings(prev => ({ ...prev, capturePerformanceMetrics: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm">Performance Metrics</span>
              </label>
              
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={settings.compressionEnabled}
                  onChange={(e) => setSettings(prev => ({ ...prev, compressionEnabled: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm">Compression</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quality Level
              </label>
              <select
                value={settings.qualityLevel}
                onChange={(e) => setSettings(prev => ({ ...prev, qualityLevel: e.target.value as any }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                <option value="low">Low (Fastest)</option>
                <option value="medium">Medium (Balanced)</option>
                <option value="high">High (Detailed)</option>
                <option value="lossless">Lossless (Largest)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Recording Size: {settings.maxRecordingSize}MB
              </label>
              <input
                type="range"
                min="100"
                max="2000"
                step="100"
                value={settings.maxRecordingSize}
                onChange={(e) => setSettings(prev => ({ ...prev, maxRecordingSize: parseInt(e.target.value) }))}
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default SessionRecorder;