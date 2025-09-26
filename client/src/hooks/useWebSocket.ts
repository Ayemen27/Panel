
import { useState, useEffect, useRef, useCallback } from 'react';

interface WebSocketMessage {
  type: string;
  data?: any;
  message?: string;
  token?: string;
  command?: string;
  [key: string]: any; // Allow additional properties
}

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectInterval = 3000;

  const connect = useCallback(() => {
    // منع الاتصالات المتعددة بشكل أكثر صرامة
    if (wsRef.current?.readyState === WebSocket.CONNECTING || 
        wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connecting/connected, skipping...');
      return;
    }

    // إلغاء أي محاولة إعادة اتصال سابقة
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      console.log('Connecting to WebSocket:', wsUrl);
      
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        
        // مسح أي timeout لإعادة الاتصال
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      wsRef.current.onclose = (event) => {
        console.log('WebSocket disconnected', event.code, event.reason);
        setIsConnected(false);
        wsRef.current = null;
        
        // Clear last message to reset any authentication state
        setLastMessage({
          type: 'CONNECTION_CLOSED',
          message: 'Connection closed'
        });
        
        // تقليل عدد محاولات إعادة الاتصال وزيادة الفترات الزمنية
        if (reconnectAttemptsRef.current < 3 && 
            event.code !== 1000 && 
            event.code !== 1001) { // تجنب إعادة الاتصال للإغلاق الطبيعي
          
          reconnectAttemptsRef.current++;
          const delay = Math.min(reconnectInterval * Math.pow(2, reconnectAttemptsRef.current - 1), 30000);
          
          console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current}/3)`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
              connect();
            }
          }, delay);
        }
      };
      
      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };
      
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setIsConnected(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }
    
    setIsConnected(false);
    reconnectAttemptsRef.current = maxReconnectAttempts; // منع إعادة الاتصال
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // إعادة الاتصال عند استعادة التركيز على النافذة
  useEffect(() => {
    const handleFocus = () => {
      if (!isConnected && reconnectAttemptsRef.current < maxReconnectAttempts) {
        connect();
      }
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isConnected, connect]);

  return {
    isConnected,
    lastMessage,
    sendMessage,
    reconnect: connect,
    disconnect
  };
}
