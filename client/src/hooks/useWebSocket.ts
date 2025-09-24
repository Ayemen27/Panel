import { useEffect, useRef, useState } from 'react';

export interface WebSocketMessage {
  type: string;
  data?: any;
  message?: string;
}

export function useWebSocket(url?: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const setupWebSocketHandlers = (ws: WebSocket) => {
    ws.onopen = () => {
      setIsConnected(true);
      setError(null);
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        setLastMessage(message);
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('WebSocket disconnected');

      // Attempt to reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      
      // Handle SSL certificate errors specifically
      if (error.toString().includes('certificate') || error.toString().includes('TLS')) {
        setError('SSL Certificate Error - Using fallback connection');
        
        // Attempt to reconnect with HTTP if HTTPS fails
        if (url && url.startsWith('wss://')) {
          const httpUrl = url.replace('wss://', 'ws://');
          console.log('Attempting HTTP fallback:', httpUrl);
          setTimeout(() => {
            if (wsRef.current?.readyState !== WebSocket.OPEN) {
              try {
                wsRef.current = new WebSocket(httpUrl);
                setupWebSocketHandlers(wsRef.current);
              } catch (fallbackError) {
                console.error('HTTP fallback failed:', fallbackError);
                setError('WebSocket connection failed completely');
              }
            }
          }, 1000);
        }
      } else {
        setError('WebSocket connection error');
      }
    };
  };

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    // Use the same host as the current page to avoid SSL issues
    const wsUrl = url || `${protocol}//${window.location.host}/ws`;

    try {
      wsRef.current = new WebSocket(wsUrl);
      setupWebSocketHandlers(wsRef.current);
    } catch (err) {
      setError('Failed to create WebSocket connection');
      console.error('WebSocket creation error:', err);
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const sendMessage = (message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  };

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [url]);

  return {
    isConnected,
    lastMessage,
    error,
    sendMessage,
    connect,
    disconnect
  };
}