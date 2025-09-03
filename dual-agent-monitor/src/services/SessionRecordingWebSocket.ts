import React from 'react';
import { SessionRecording, RecordingInteraction, RecordingAnnotation, RecordingBookmark } from '../types';

export interface SessionRecordingWebSocketMessage {
  type: 'recording_started' | 'recording_stopped' | 'recording_updated' | 
        'interaction_added' | 'annotation_added' | 'bookmark_added' |
        'playback_state_changed' | 'export_completed' | 'error';
  data: {
    recordingId?: string;
    sessionId?: string;
    recording?: SessionRecording;
    interaction?: RecordingInteraction;
    annotation?: RecordingAnnotation;
    bookmark?: RecordingBookmark;
    playbackState?: {
      currentPosition: number;
      isPlaying: boolean;
      playbackSpeed: number;
    };
    error?: {
      message: string;
      code?: string;
    };
    [key: string]: any;
  };
  timestamp: string;
}

export interface SessionRecordingWebSocketHandlers {
  onRecordingStarted?: (recording: SessionRecording) => void;
  onRecordingStopped?: (recordingId: string) => void;
  onRecordingUpdated?: (recording: SessionRecording) => void;
  onInteractionAdded?: (interaction: RecordingInteraction) => void;
  onAnnotationAdded?: (annotation: RecordingAnnotation) => void;
  onBookmarkAdded?: (bookmark: RecordingBookmark) => void;
  onPlaybackStateChanged?: (recordingId: string, playbackState: any) => void;
  onExportCompleted?: (recordingId: string, exportId: string) => void;
  onError?: (error: { message: string; code?: string }) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onReconnect?: (attempt: number) => void;
}

export class SessionRecordingWebSocket {
  private ws: WebSocket | null = null;
  private handlers: SessionRecordingWebSocketHandlers = {};
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private shouldReconnect = true;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private connectionTimeout: NodeJS.Timeout | null = null;
  
  // Subscription management
  private subscriptions = new Set<string>();
  
  constructor(url?: string) {
    this.url = url || this.getWebSocketUrl();
  }

  private getWebSocketUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/ws/recordings`;
  }

  public connect(handlers?: SessionRecordingWebSocketHandlers): Promise<void> {
    if (handlers) {
      this.handlers = { ...this.handlers, ...handlers };
    }

    return new Promise((resolve, reject) => {
      if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
        resolve();
        return;
      }

      this.isConnecting = true;
      this.shouldReconnect = true;

      try {
        this.ws = new WebSocket(this.url);

        this.connectionTimeout = setTimeout(() => {
          if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
            this.ws.close();
            reject(new Error('WebSocket connection timeout'));
          }
        }, 10000);

        this.ws.onopen = () => {
          console.log('SessionRecording WebSocket connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;

          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
          }

          // Start heartbeat
          this.startHeartbeat();

          // Resubscribe to previous subscriptions
          this.resubscribe();

          this.handlers.onConnect?.();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: SessionRecordingWebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
            this.handlers.onError?.({ 
              message: 'Failed to parse WebSocket message',
              code: 'PARSE_ERROR'
            });
          }
        };

        this.ws.onclose = (event) => {
          console.log('SessionRecording WebSocket disconnected:', event.code, event.reason);
          this.isConnecting = false;
          
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
          }

          this.stopHeartbeat();
          this.handlers.onDisconnect?.();

          if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.handlers.onError?.({
              message: 'Maximum reconnection attempts reached',
              code: 'MAX_RECONNECT_ATTEMPTS'
            });
          }
        };

        this.ws.onerror = (error) => {
          console.error('SessionRecording WebSocket error:', error);
          this.handlers.onError?.({ 
            message: 'WebSocket connection error',
            code: 'CONNECTION_ERROR'
          });
          
          if (this.isConnecting) {
            reject(error);
          }
        };

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  public disconnect(): void {
    this.shouldReconnect = false;
    
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'Intentional disconnect');
      this.ws = null;
    }
    
    this.subscriptions.clear();
  }

  public subscribe(recordingId: string): void {
    this.subscriptions.add(recordingId);
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: 'subscribe',
        recordingId
      });
    }
  }

  public unsubscribe(recordingId: string): void {
    this.subscriptions.delete(recordingId);
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: 'unsubscribe',
        recordingId
      });
    }
  }

  public updatePlaybackState(recordingId: string, playbackState: {
    currentPosition: number;
    isPlaying: boolean;
    playbackSpeed: number;
  }): void {
    this.send({
      type: 'playback_state_update',
      recordingId,
      playbackState
    });
  }

  private send(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket not connected, unable to send message:', data);
    }
  }

  private handleMessage(message: SessionRecordingWebSocketMessage): void {
    console.log('Received WebSocket message:', message.type, message.data);

    switch (message.type) {
      case 'recording_started':
        if (message.data.recording) {
          this.handlers.onRecordingStarted?.(message.data.recording);
        }
        break;

      case 'recording_stopped':
        if (message.data.recordingId) {
          this.handlers.onRecordingStopped?.(message.data.recordingId);
        }
        break;

      case 'recording_updated':
        if (message.data.recording) {
          this.handlers.onRecordingUpdated?.(message.data.recording);
        }
        break;

      case 'interaction_added':
        if (message.data.interaction) {
          this.handlers.onInteractionAdded?.(message.data.interaction);
        }
        break;

      case 'annotation_added':
        if (message.data.annotation) {
          this.handlers.onAnnotationAdded?.(message.data.annotation);
        }
        break;

      case 'bookmark_added':
        if (message.data.bookmark) {
          this.handlers.onBookmarkAdded?.(message.data.bookmark);
        }
        break;

      case 'playback_state_changed':
        if (message.data.recordingId && message.data.playbackState) {
          this.handlers.onPlaybackStateChanged?.(
            message.data.recordingId,
            message.data.playbackState
          );
        }
        break;

      case 'export_completed':
        if (message.data.recordingId && message.data.exportId) {
          this.handlers.onExportCompleted?.(
            message.data.recordingId,
            message.data.exportId
          );
        }
        break;

      case 'error':
        if (message.data.error) {
          this.handlers.onError?.(message.data.error);
        }
        break;

      default:
        console.warn('Unknown WebSocket message type:', message.type);
    }
  }

  private scheduleReconnect(): void {
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), 30000);
    
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts + 1} in ${delay}ms`);
    
    setTimeout(() => {
      if (this.shouldReconnect) {
        this.reconnectAttempts++;
        this.handlers.onReconnect?.(this.reconnectAttempts);
        this.connect().catch(error => {
          console.error('Reconnection failed:', error);
        });
      }
    }, delay);
  }

  private resubscribe(): void {
    for (const recordingId of this.subscriptions) {
      this.send({
        type: 'subscribe',
        recordingId
      });
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 30000); // 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public getConnectionState(): string {
    if (!this.ws) return 'disconnected';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'connected';
      case WebSocket.CLOSING: return 'closing';
      case WebSocket.CLOSED: return 'disconnected';
      default: return 'unknown';
    }
  }

  public updateHandlers(handlers: Partial<SessionRecordingWebSocketHandlers>): void {
    this.handlers = { ...this.handlers, ...handlers };
  }
}

// Global instance for easy access
let globalSessionRecordingWebSocket: SessionRecordingWebSocket | null = null;

export const getSessionRecordingWebSocket = (): SessionRecordingWebSocket => {
  if (!globalSessionRecordingWebSocket) {
    globalSessionRecordingWebSocket = new SessionRecordingWebSocket();
  }
  return globalSessionRecordingWebSocket;
};

// React hook for using the WebSocket service
export const useSessionRecordingWebSocket = (
  handlers?: SessionRecordingWebSocketHandlers
) => {
  const wsService = React.useMemo(() => getSessionRecordingWebSocket(), []);
  
  React.useEffect(() => {
    if (handlers) {
      wsService.updateHandlers(handlers);
    }
  }, [wsService, handlers]);

  React.useEffect(() => {
    wsService.connect().catch(error => {
      console.error('Failed to connect to SessionRecording WebSocket:', error);
    });

    return () => {
      // Don't disconnect on unmount, keep the global connection alive
      // wsService.disconnect();
    };
  }, [wsService]);

  return {
    subscribe: wsService.subscribe.bind(wsService),
    unsubscribe: wsService.unsubscribe.bind(wsService),
    updatePlaybackState: wsService.updatePlaybackState.bind(wsService),
    isConnected: wsService.isConnected.bind(wsService),
    getConnectionState: wsService.getConnectionState.bind(wsService),
    disconnect: wsService.disconnect.bind(wsService)
  };
};