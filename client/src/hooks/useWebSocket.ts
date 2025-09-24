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

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = url || `${protocol}//${window.location.host}/ws`;

    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        setError(null);
        console.log('WebSocket connected');
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      wsRef.current.onclose = () => {
        setIsConnected(false);
        console.log('WebSocket disconnected');
        
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      wsRef.current.onerror = (error) => {
        setError('WebSocket connection error');
        console.error('WebSocket error:', error);
      };
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
