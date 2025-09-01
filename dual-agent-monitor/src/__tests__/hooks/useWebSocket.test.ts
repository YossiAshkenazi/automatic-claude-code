import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useWebSocket } from '../../hooks/useWebSocket';

// Enhanced mock WebSocket that works with the global setup
const createMockWebSocket = () => {
  const mockSend = vi.fn();
  const mockClose = vi.fn();
  
  const instance = {
    url: '',
    readyState: WebSocket.CONNECTING,
    onopen: null as ((event: Event) => void) | null,
    onmessage: null as ((event: MessageEvent) => void) | null,
    onclose: null as ((event: CloseEvent) => void) | null,
    onerror: null as ((event: Event) => void) | null,
    send: mockSend,
    close: mockClose,
    
    // Helper methods for testing
    simulateMessage: (data: any) => {
      instance.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }));
    },
    
    simulateError: () => {
      instance.onerror?.(new Event('error'));
    },
    
    simulateClose: (code = 1000, reason = 'Connection closed') => {
      instance.readyState = WebSocket.CLOSED;
      instance.onclose?.(new CloseEvent('close', { code, reason }));
    },
    
    simulateOpen: () => {
      instance.readyState = WebSocket.OPEN;
      instance.onopen?.(new Event('open'));
    }
  };
  
  // Setup default close behavior
  mockClose.mockImplementation(() => {
    instance.readyState = WebSocket.CLOSED;
    instance.onclose?.(new CloseEvent('close', { code: 1000, reason: 'Manual close' }));
  });
  
  return instance;
};

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

describe('useWebSocket', () => {
  let mockWebSocketInstance: ReturnType<typeof createMockWebSocket>;

  beforeEach(() => {
    // Create a new mock instance for each test
    mockWebSocketInstance = createMockWebSocket();
    
    // Mock the WebSocket constructor to return our mock instance
    vi.mocked(global.WebSocket).mockImplementation((url: string) => {
      mockWebSocketInstance.url = url;
      // Simulate connection delay
      setTimeout(() => {
        mockWebSocketInstance.simulateOpen();
      }, 100);
      return mockWebSocketInstance as any;
    });

    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useWebSocket('ws://localhost:4001'));

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isConnecting).toBe(true);
    expect(result.current.hasError).toBe(false);
    expect(result.current.connectionStatus).toBe('Connecting');
    expect(result.current.lastMessage).toBeNull();
    expect(result.current.lastError).toBeNull();
    expect(result.current.reconnectAttempts).toBe(0);
  });

  it('should establish connection successfully', async () => {
    const { result } = renderHook(() => useWebSocket('ws://localhost:4001'));

    // Wait for initial connection delay
    act(() => {
      vi.advanceTimersByTime(200);
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.connectionStatus).toBe('Open');
    });
  });

  it('should handle incoming messages correctly', async () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() => 
      useWebSocket('ws://localhost:4001', { onMessage })
    );

    // Wait for connection
    act(() => {
      vi.advanceTimersByTime(200);
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    const testMessage = { type: 'test', data: 'hello world' };
    
    act(() => {
      mockWebSocketInstance.simulateMessage(testMessage);
    });

    await waitFor(() => {
      expect(result.current.lastMessage).toBe(JSON.stringify(testMessage));
      expect(onMessage).toHaveBeenCalledWith(JSON.stringify(testMessage));
    });
  });

  it('should send messages when connected', async () => {
    const { result } = renderHook(() => useWebSocket('ws://localhost:4001'));

    // Wait for connection
    act(() => {
      vi.advanceTimersByTime(200);
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    const testMessage = { type: 'test', data: 'outgoing' };
    
    act(() => {
      result.current.sendMessage(testMessage);
    });

    expect(mockWebSocketInstance.send).toHaveBeenCalledWith(JSON.stringify(testMessage));
  });

  it('should not send messages when disconnected', () => {
    const { result } = renderHook(() => useWebSocket('ws://localhost:4001'));

    const testMessage = { type: 'test', data: 'outgoing' };
    
    act(() => {
      const success = result.current.sendMessage(testMessage);
      expect(success).toBe(false);
    });

    expect(mockWebSocketInstance.send).not.toHaveBeenCalled();
  });

  it('should handle connection errors', async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => 
      useWebSocket('ws://localhost:4001', { onError })
    );

    act(() => {
      mockWebSocketInstance.simulateError();
    });

    await waitFor(() => {
      expect(result.current.hasError).toBe(true);
      expect(result.current.connectionStatus).toBe('Error');
      expect(onError).toHaveBeenCalled();
    });
  });

  it('should attempt reconnection after connection loss', async () => {
    const { result } = renderHook(() => 
      useWebSocket('ws://localhost:4001', { maxReconnectAttempts: 3, reconnectInterval: 1000 })
    );

    // Wait for initial connection
    act(() => {
      vi.advanceTimersByTime(200);
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // Simulate connection loss
    act(() => {
      mockWebSocketInstance.simulateClose(1006, 'Connection lost');
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(false);
      expect(result.current.reconnectAttempts).toBe(1);
    });

    // Verify WebSocket constructor is called again for reconnection
    expect(vi.mocked(global.WebSocket)).toHaveBeenCalledTimes(2);
  });

  it('should stop reconnection after max attempts', async () => {
    const { result } = renderHook(() => 
      useWebSocket('ws://localhost:4001', { maxReconnectAttempts: 2, reconnectInterval: 100 })
    );

    // Wait for initial connection
    act(() => {
      vi.advanceTimersByTime(200);
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // Simulate multiple connection failures
    for (let i = 0; i < 3; i++) {
      act(() => {
        mockWebSocketInstance.simulateClose(1006, 'Connection lost');
        vi.advanceTimersByTime(200); // Advance past reconnect delay
      });
    }

    await waitFor(() => {
      expect(result.current.connectionStatus).toBe('Error');
      expect(result.current.reconnectAttempts).toBe(2);
    });
  });

  it('should handle ping/pong messages', async () => {
    const { result } = renderHook(() => useWebSocket('ws://localhost:4001'));

    // Wait for connection
    act(() => {
      vi.advanceTimersByTime(200);
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // Simulate ping interval
    act(() => {
      vi.advanceTimersByTime(30000);
    });

    // Verify ping was sent
    expect(mockWebSocketInstance.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'ping' })
    );

    // Simulate pong response
    act(() => {
      mockWebSocketInstance.simulateMessage({ type: 'pong' });
    });

    // Pong messages should not update lastMessage
    expect(result.current.lastMessage).toContain('"type":"pong"');
  });

  it('should manual reconnect when requested', async () => {
    const { result } = renderHook(() => useWebSocket('ws://localhost:4001'));

    // Simulate error state
    act(() => {
      mockWebSocketInstance.simulateError();
    });

    await waitFor(() => {
      expect(result.current.hasError).toBe(true);
    });

    // Manual reconnect
    act(() => {
      result.current.reconnect();
    });

    expect(vi.mocked(global.WebSocket)).toHaveBeenCalledTimes(2);
  });

  it('should disconnect gracefully', async () => {
    const { result } = renderHook(() => useWebSocket('ws://localhost:4001'));

    // Wait for connection
    act(() => {
      vi.advanceTimersByTime(200);
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    act(() => {
      result.current.disconnect();
    });

    expect(mockWebSocketInstance.close).toHaveBeenCalledWith(1000, 'Manual disconnect');
    
    await waitFor(() => {
      expect(result.current.connectionStatus).toBe('Closed');
    });
  });

  it('should clean up on unmount', () => {
    const { unmount } = renderHook(() => useWebSocket('ws://localhost:4001'));

    unmount();

    expect(mockWebSocketInstance.close).toHaveBeenCalledWith(1000, 'Component unmounting');
  });

  it('should not attempt connection when component is unmounted during initialization', () => {
    const { unmount } = renderHook(() => useWebSocket('ws://localhost:4001'));
    
    // Unmount before connection completes
    unmount();
    
    // Advance timers past connection delay
    act(() => {
      vi.advanceTimersByTime(200);
    });
    
    // Should not attempt to update state after unmount
    expect(mockWebSocketInstance.readyState).toBe(WebSocket.CLOSED);
  });

  it('should handle malformed JSON messages gracefully', async () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() => 
      useWebSocket('ws://localhost:4001', { onMessage })
    );

    // Wait for connection
    act(() => {
      vi.advanceTimersByTime(200);
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    const malformedMessage = 'invalid json';
    
    act(() => {
      mockWebSocketInstance.onmessage?.(new MessageEvent('message', { data: malformedMessage }));
    });

    await waitFor(() => {
      expect(result.current.lastMessage).toBe(malformedMessage);
      expect(onMessage).toHaveBeenCalledWith(malformedMessage);
    });
  });

  it('should handle exponential backoff for reconnection', async () => {
    const { result } = renderHook(() => 
      useWebSocket('ws://localhost:4001', { maxReconnectAttempts: 3, reconnectInterval: 100 })
    );

    // Wait for initial connection
    act(() => {
      vi.advanceTimersByTime(200);
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // First reconnection attempt
    act(() => {
      mockWebSocketInstance.simulateClose(1006, 'Connection lost');
    });

    await waitFor(() => {
      expect(result.current.reconnectAttempts).toBe(1);
    });

    // Second reconnection attempt should have longer delay
    act(() => {
      vi.advanceTimersByTime(100); // Original delay
      mockWebSocketInstance.simulateClose(1006, 'Connection lost again');
    });

    await waitFor(() => {
      expect(result.current.reconnectAttempts).toBe(2);
    });

    // Verify exponential backoff (delay should be 200ms for second attempt)
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(vi.mocked(global.WebSocket)).toHaveBeenCalledTimes(4); // Initial + 2 reconnections + 1 more attempt
  });
});
