import { useEffect, useRef, useState, useCallback } from 'react';
import { WebSocketMessage } from '../types';
import { toast } from 'sonner';

type ConnectionStatus = 'Connecting' | 'Open' | 'Closing' | 'Closed' | 'Error';

interface UseWebSocketOptions {
  maxReconnectAttempts?: number;
  reconnectInterval?: number;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  onMessage?: (message: string) => void;
}

export function useWebSocket(url: string, options: UseWebSocketOptions = {}) {
  const {
    maxReconnectAttempts = 5,
    reconnectInterval = 1000,
    onOpen,
    onClose,
    onError,
    onMessage
  } = options;

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('Closed');
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttempts = useRef(0);
  const shouldReconnect = useRef(true);
  const pingIntervalRef = useRef<NodeJS.Timeout>();

  const startPing = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    
    pingIntervalRef.current = setInterval(() => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // Ping every 30 seconds
  }, []);

  const stopPing = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = undefined;
    }
  }, []);

  const connect = useCallback(() => {
    // Don't attempt to connect if we shouldn't reconnect or if already connecting
    if (!shouldReconnect.current || connectionStatus === 'Connecting') {
      return;
    }

    try {
      // Close existing connection if any
      if (ws.current) {
        ws.current.close();
      }

      setConnectionStatus('Connecting');
      setLastError(null);
      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        console.log('WebSocket connected');
        setConnectionStatus('Open');
        reconnectAttempts.current = 0;
        setLastError(null);
        startPing();
        onOpen?.();
        
        if (reconnectAttempts.current > 0) {
          toast.success('Connection restored');
        }
      };

      ws.current.onmessage = (event) => {
        try {
          const data = event.data;
          setLastMessage(data);
          onMessage?.(data);
          
          // Handle pong responses
          const parsed = JSON.parse(data);
          if (parsed.type === 'pong') {
            // Keep connection alive
            return;
          }
        } catch (error) {
          console.warn('Failed to parse WebSocket message:', error);
          setLastMessage(event.data);
          onMessage?.(event.data);
        }
      };

      ws.current.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setConnectionStatus('Closed');
        stopPing();
        onClose?.();
        
        // Attempt to reconnect if we should and haven't exceeded max attempts
        if (shouldReconnect.current && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(reconnectInterval * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectAttempts.current++;
          
          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
          
          if (reconnectAttempts.current === 1) {
            toast.error('Connection lost, attempting to reconnect...');
          }
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          setConnectionStatus('Error');
          const errorMsg = `Failed to reconnect after ${maxReconnectAttempts} attempts`;
          setLastError(errorMsg);
          toast.error(errorMsg);
        }
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        const errorMsg = 'WebSocket connection error';
        setLastError(errorMsg);
        setConnectionStatus('Error');
        stopPing();
        onError?.(error);
        
        if (reconnectAttempts.current === 0) {
          toast.error('Failed to connect to server');
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      const errorMsg = error instanceof Error ? error.message : 'Connection failed';
      setLastError(errorMsg);
      setConnectionStatus('Error');
      toast.error(errorMsg);
    }
  }, [url, connectionStatus, maxReconnectAttempts, reconnectInterval, onOpen, onClose, onError, onMessage, startPing, stopPing]);

  const disconnect = useCallback(() => {
    shouldReconnect.current = false;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    stopPing();
    
    if (ws.current) {
      ws.current.close(1000, 'Manual disconnect');
    }
    
    setConnectionStatus('Closed');
  }, [stopPing]);

  const manualReconnect = useCallback(() => {
    shouldReconnect.current = true;
    reconnectAttempts.current = 0;
    setLastError(null);
    connect();
  }, [connect]);

  useEffect(() => {
    shouldReconnect.current = true;
    connect();

    return () => {
      shouldReconnect.current = false;
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      stopPing();
      
      if (ws.current) {
        ws.current.close(1000, 'Component unmounting');
      }
    };
  }, [connect, stopPing]);

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

  const isConnected = connectionStatus === 'Open';
  const isConnecting = connectionStatus === 'Connecting';
  const hasError = connectionStatus === 'Error';
  const canReconnect = hasError || connectionStatus === 'Closed';

  return { 
    isConnected,
    isConnecting,
    hasError,
    canReconnect,
    connectionStatus, 
    lastMessage,
    lastError,
    reconnectAttempts: reconnectAttempts.current,
    maxReconnectAttempts,
    sendMessage,
    reconnect: manualReconnect,
    disconnect
  };
}