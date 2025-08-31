import { useEffect, useRef, useState } from 'react';
import { WebSocketMessage } from '../types';

type ConnectionStatus = 'Connecting' | 'Open' | 'Closing' | 'Closed';

export function useWebSocket(url: string) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('Closed');
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = () => {
    try {
      // Use the provided URL directly
      ws.current = new WebSocket(url);
      setConnectionStatus('Connecting');

      ws.current.onopen = () => {
        console.log('WebSocket connected');
        setConnectionStatus('Open');
        reconnectAttempts.current = 0;
      };

      ws.current.onmessage = (event) => {
        setLastMessage(event.data);
      };

      ws.current.onclose = () => {
        console.log('WebSocket disconnected');
        setConnectionStatus('Closed');
        
        // Attempt to reconnect if we haven't exceeded max attempts
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectAttempts.current++;
          
          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('Closed');
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionStatus('Closed');
    }
  };

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [url]);

  const sendMessage = (message: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  };

  const isConnected = connectionStatus === 'Open';

  return { 
    isConnected, 
    connectionStatus, 
    lastMessage, 
    sendMessage,
    reconnect: connect 
  };
}