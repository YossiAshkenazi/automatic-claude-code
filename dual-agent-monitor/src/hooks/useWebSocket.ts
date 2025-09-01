import { useEffect, useRef, useState, useCallback } from 'react';
import { WebSocketMessage } from '../types';
import { toast } from 'sonner';
import { getGlobalConnectionMonitor, resetGlobalConnectionMonitor } from '../utils/connectionMonitor';
import { createDualAgentFallbackPoller, FallbackPoller } from '../utils/fallbackPoller';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error' | 'closed';

interface ConnectionHealthMetrics {
  connectionAttempts: number;
  successfulConnections: number;
  failedConnections: number;
  totalReconnects: number;
  averageLatency: number;
  lastConnectionTime?: Date;
  lastDisconnectionTime?: Date;
  connectionUptime: number;
  packetLoss: number;
}

interface UseWebSocketOptions {
  maxReconnectAttempts?: number;
  reconnectInterval?: number;
  exponentialBackoff?: boolean;
  maxBackoffDelay?: number;
  heartbeatInterval?: number;
  heartbeatTimeout?: number;
  enableFallback?: boolean;
  fallbackPollInterval?: number;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  onMessage?: (message: string) => void;
  onReconnectAttempt?: (attempt: number) => void;
  onFallbackActivated?: () => void;
  onHealthUpdate?: (health: ConnectionHealthMetrics) => void;
}

export function useWebSocket(url: string, options: UseWebSocketOptions = {}) {
  const {
    maxReconnectAttempts = 5,
    reconnectInterval = 1000,
    exponentialBackoff = true,
    maxBackoffDelay = 30000,
    heartbeatInterval = 30000,
    heartbeatTimeout = 10000,
    enableFallback = true,
    fallbackPollInterval = 5000,
    onOpen,
    onClose,
    onError,
    onMessage,
    onReconnectAttempt,
    onFallbackActivated,
    onHealthUpdate
  } = options;

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [connectionHealth, setConnectionHealth] = useState<ConnectionHealthMetrics>({
    connectionAttempts: 0,
    successfulConnections: 0,
    failedConnections: 0,
    totalReconnects: 0,
    averageLatency: 0,
    connectionUptime: 0,
    packetLoss: 0
  });
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttempts = useRef(0);
  const shouldReconnect = useRef(true);
  const pingIntervalRef = useRef<NodeJS.Timeout>();
  const pongTimeoutRef = useRef<NodeJS.Timeout>();
  const fallbackIntervalRef = useRef<NodeJS.Timeout>();
  const isConnecting = useRef(false);
  const isMounted = useRef(false);
  const connectionStartTime = useRef<Date>();
  const lastPingTime = useRef<Date>();
  const latencyHistory = useRef<number[]>([]);
  const missedPings = useRef(0);
  const totalPings = useRef(0);
  const fallbackPoller = useRef<FallbackPoller | null>(null);
  const connectionMonitor = useRef(getGlobalConnectionMonitor());
  
  // Store callbacks in refs to avoid recreating connect function
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);
  const onErrorRef = useRef(onError);
  const onMessageRef = useRef(onMessage);
  
  useEffect(() => {
    onOpenRef.current = onOpen;
    onCloseRef.current = onClose;
    onErrorRef.current = onError;
    onMessageRef.current = onMessage;
  }, [onOpen, onClose, onError, onMessage]);

  // Update connection health metrics
  const updateConnectionHealth = useCallback((updates: Partial<ConnectionHealthMetrics>) => {
    setConnectionHealth(prev => {
      const updated = { ...prev, ...updates };
      onHealthUpdate?.(updated);
      return updated;
    });
  }, [onHealthUpdate]);

  // Initialize connection monitor with events
  const initializeConnectionMonitor = useCallback(() => {
    resetGlobalConnectionMonitor({
      onQualityChange: (quality) => {
        console.log(`Connection quality changed to: ${quality}`);
        if (quality === 'critical' || quality === 'poor') {
          toast.warning(`Connection quality is ${quality}`);
        }
      },
      onLatencyAlert: (latency) => {
        console.warn(`High latency detected: ${latency}ms`);
        toast.warning(`High latency: ${latency}ms`);
      },
      onPacketLossAlert: (loss) => {
        console.warn(`Packet loss detected: ${loss}%`);
        if (loss > 10) {
          toast.error(`High packet loss: ${loss.toFixed(1)}%`);
        }
      },
      onReconnectRequired: () => {
        console.error('Connection monitor recommends reconnection');
        if (shouldReconnect.current && !isConnecting.current) {
          toast.error('Connection quality critical - reconnecting...');
          setTimeout(() => connect(), 1000);
        }
      }
    });
    
    connectionMonitor.current = getGlobalConnectionMonitor();
  }, []);

  // Calculate exponential backoff delay
  const calculateBackoffDelay = useCallback((attempt: number): number => {
    if (!exponentialBackoff) {
      return reconnectInterval;
    }
    const delay = Math.min(
      reconnectInterval * Math.pow(2, attempt - 1),
      maxBackoffDelay
    );
    // Add jitter to prevent thundering herd
    return delay + (Math.random() * 1000);
  }, [exponentialBackoff, reconnectInterval, maxBackoffDelay]);

  // Start heartbeat mechanism
  const startHeartbeat = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    
    pingIntervalRef.current = setInterval(() => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        lastPingTime.current = new Date();
        totalPings.current++;
        ws.current.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        
        // Set timeout for pong response
        if (pongTimeoutRef.current) {
          clearTimeout(pongTimeoutRef.current);
        }
        
        pongTimeoutRef.current = setTimeout(() => {
          console.warn('Heartbeat timeout - no pong received');
          missedPings.current++;
          
          // Update packet loss metrics
          const packetLoss = totalPings.current > 0 ? 
            (missedPings.current / totalPings.current) * 100 : 0;
          updateConnectionHealth({ packetLoss });
          
          // If we've missed too many pings, consider connection dead
          if (missedPings.current >= 3) {
            console.error('Connection appears dead - forcing reconnection');
            ws.current?.close(1000, 'Heartbeat failed');
          }
        }, heartbeatTimeout);
      }
    }, heartbeatInterval);
  }, [heartbeatInterval, heartbeatTimeout, updateConnectionHealth]);

  // Stop heartbeat mechanism
  const stopHeartbeat = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = undefined;
    }
    if (pongTimeoutRef.current) {
      clearTimeout(pongTimeoutRef.current);
      pongTimeoutRef.current = undefined;
    }
  }, []);

  // HTTP polling fallback mechanism
  const startFallbackPolling = useCallback(async () => {
    if (!enableFallback || isUsingFallback) return;
    
    console.log('Activating HTTP polling fallback');
    setIsUsingFallback(true);
    onFallbackActivated?.();
    toast.info('Using backup connection mode');
    
    if (fallbackIntervalRef.current) {
      clearInterval(fallbackIntervalRef.current);
    }
    
    fallbackIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`${url.replace('ws://', 'http://').replace('wss://', 'https://')}/api/health`);
        if (response.ok) {
          const data = await response.json();
          // Simulate WebSocket message for fallback data
          onMessageRef.current?.(JSON.stringify({
            type: 'fallback_health',
            data: data,
            timestamp: new Date().toISOString()
          }));
        }
      } catch (error) {
        console.error('Fallback polling failed:', error);
      }
    }, fallbackPollInterval);
  }, [url, enableFallback, isUsingFallback, fallbackPollInterval, onFallbackActivated]);

  // Stop fallback polling
  const stopFallbackPolling = useCallback(() => {
    if (fallbackIntervalRef.current) {
      clearInterval(fallbackIntervalRef.current);
      fallbackIntervalRef.current = undefined;
    }
    if (isUsingFallback) {
      setIsUsingFallback(false);
      console.log('Deactivated HTTP polling fallback');
    }
  }, [isUsingFallback]);

  const connect = useCallback(() => {
    // Don't attempt to connect if we shouldn't reconnect or if already connecting
    if (!shouldReconnect.current || isConnecting.current || !isMounted.current) {
      return;
    }

    // Prevent concurrent connection attempts
    isConnecting.current = true;

    try {
      // Close existing connection if any
      if (ws.current && ws.current.readyState !== WebSocket.CLOSED) {
        ws.current.close();
        ws.current = null;
      }

      setConnectionStatus('connecting');
      updateConnectionHealth({
        connectionAttempts: connectionHealth.connectionAttempts + 1
      });
      setLastError(null);
      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        console.log('WebSocket connected');
        isConnecting.current = false;
        setConnectionStatus('connected');
        const connectionTime = new Date();
        connectionStartTime.current = connectionTime;
        
        // Reset connection state
        reconnectAttempts.current = 0;
        missedPings.current = 0;
        totalPings.current = 0;
        setLastError(null);
        
        // Update health metrics
        updateConnectionHealth({
          successfulConnections: connectionHealth.successfulConnections + 1,
          lastConnectionTime: connectionTime,
          totalReconnects: reconnectAttempts.current > 0 ? connectionHealth.totalReconnects + 1 : connectionHealth.totalReconnects
        });
        
        // Stop fallback and start heartbeat
        stopFallbackPolling();
        startHeartbeat();
        onOpenRef.current?.();
        
        if (reconnectAttempts.current > 0) {
          toast.success('Connection restored');
        }
      };

      ws.current.onmessage = (event) => {
        try {
          const data = event.data;
          setLastMessage(data);
          onMessageRef.current?.(data);
          
          // Handle pong responses
          const parsed = JSON.parse(data);
          if (parsed.type === 'pong') {
            if (pongTimeoutRef.current) {
              clearTimeout(pongTimeoutRef.current);
            }
            
            // Calculate latency if timestamp is available
            if (parsed.timestamp && lastPingTime.current) {
              const latency = Date.now() - parsed.timestamp;
              latencyHistory.current.push(latency);
              
              // Keep only last 10 measurements for average
              if (latencyHistory.current.length > 10) {
                latencyHistory.current.shift();
              }
              
              const averageLatency = latencyHistory.current.reduce((a, b) => a + b, 0) / latencyHistory.current.length;
              updateConnectionHealth({ averageLatency });
            }
            return;
          }
        } catch (error) {
          console.warn('Failed to parse WebSocket message:', error);
          setLastMessage(event.data);
          onMessageRef.current?.(event.data);
        }
      };

      ws.current.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        isConnecting.current = false;
        setConnectionStatus('disconnected');
        
        // Update connection metrics
        const disconnectionTime = new Date();
        let uptime = 0;
        if (connectionStartTime.current) {
          uptime = disconnectionTime.getTime() - connectionStartTime.current.getTime();
        }
        
        updateConnectionHealth({
          lastDisconnectionTime: disconnectionTime,
          connectionUptime: connectionHealth.connectionUptime + uptime
        });
        
        stopHeartbeat();
        onCloseRef.current?.();
        
        // Attempt to reconnect if we should and haven't exceeded max attempts
        if (shouldReconnect.current && reconnectAttempts.current < maxReconnectAttempts && isMounted.current) {
          reconnectAttempts.current++;
          const delay = calculateBackoffDelay(reconnectAttempts.current);
          
          // Record reconnection in monitor
          connectionMonitor.current.recordReconnection();
          
          setConnectionStatus('reconnecting');
          console.log(`Reconnecting in ${Math.round(delay)}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
          
          onReconnectAttempt?.(reconnectAttempts.current);
          
          if (reconnectAttempts.current === 1) {
            toast.error('Connection lost, attempting to reconnect...');
          }
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          setConnectionStatus('error');
          const errorMsg = `Failed to reconnect after ${maxReconnectAttempts} attempts`;
          setLastError(errorMsg);
          
          updateConnectionHealth({
            failedConnections: connectionHealth.failedConnections + 1
          });
          
          // Activate fallback polling if enabled
          if (enableFallback) {
            startFallbackPolling();
          }
          
          toast.error(errorMsg + (enableFallback ? '. Using backup connection.' : ''));
        }
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        isConnecting.current = false;
        const errorMsg = 'WebSocket connection error';
        setLastError(errorMsg);
        setConnectionStatus('error');
        
        updateConnectionHealth({
          failedConnections: connectionHealth.failedConnections + 1
        });
        
        stopHeartbeat();
        onErrorRef.current?.(error);
        
        if (reconnectAttempts.current === 0) {
          toast.error('Failed to connect to server');
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      isConnecting.current = false;
      const errorMsg = error instanceof Error ? error.message : 'Connection failed';
      setLastError(errorMsg);
      setConnectionStatus('Error');
      toast.error(errorMsg);
    }
  }, [url, maxReconnectAttempts, reconnectInterval, startPing, stopPing]);

  const disconnect = useCallback(() => {
    shouldReconnect.current = false;
    isConnecting.current = false;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    stopHeartbeat();
    stopFallbackPolling();
    
    if (ws.current) {
      ws.current.close(1000, 'Manual disconnect');
    }
    
    setConnectionStatus('closed');
  }, [stopHeartbeat, stopFallbackPolling]);

  const manualReconnect = useCallback(() => {
    shouldReconnect.current = true;
    reconnectAttempts.current = 0;
    setLastError(null);
    isConnecting.current = false;
    connect();
  }, [connect]);

  useEffect(() => {
    isMounted.current = true;
    shouldReconnect.current = true;
    
    // Delay initial connection to avoid rapid reconnects during component mount
    const connectTimeout = setTimeout(() => {
      if (isMounted.current) {
        connect();
      }
    }, 100);

    return () => {
      isMounted.current = false;
      shouldReconnect.current = false;
      isConnecting.current = false;
      
      clearTimeout(connectTimeout);
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      stopHeartbeat();
      stopFallbackPolling();
      
      // Cleanup connection monitor
      if (connectionMonitor.current) {
        connectionMonitor.current.destroy();
      }
      
      if (ws.current) {
        ws.current.close(1000, 'Component unmounting');
      }
    };
  }, [connect, stopHeartbeat, stopFallbackPolling, initializeConnectionMonitor]);

  const sendMessage = useCallback((message: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      try {
        ws.current.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error('Failed to send WebSocket message:', error);
        toast.error('Failed to send message');
        return false;
      }
    } else {
      console.warn('WebSocket is not connected, message queued or dropped');
      toast.warning('Not connected to server');
      return false;
    }
  }, []);

  const isConnected = connectionStatus === 'connected';
  const isConnectingStatus = connectionStatus === 'connecting';
  const isReconnecting = connectionStatus === 'reconnecting';
  const hasError = connectionStatus === 'error';
  const canReconnect = hasError || connectionStatus === 'disconnected' || connectionStatus === 'closed';

  // Calculate connection reliability percentage
  const connectionReliability = connectionHealth.connectionAttempts > 0 ? 
    ((connectionHealth.successfulConnections / connectionHealth.connectionAttempts) * 100) : 100;
  
  // Get real-time quality metrics from monitor
  const qualityMetrics = connectionMonitor.current ? connectionMonitor.current.getMetrics() : {
    latency: 0,
    jitter: 0,
    packetLoss: 0,
    reliability: 100,
    uptime: 0,
    reconnectCount: 0
  };

  return { 
    isConnected,
    isConnecting: isConnectingStatus,
    isReconnecting,
    hasError,
    canReconnect,
    connectionStatus, 
    lastMessage,
    lastError,
    reconnectAttempts: reconnectAttempts.current,
    maxReconnectAttempts,
    connectionHealth,
    connectionReliability,
    qualityMetrics,
    isUsingFallback,
    sendMessage,
    reconnect: manualReconnect,
    disconnect,
    connectionMonitor: connectionMonitor.current
  };
}