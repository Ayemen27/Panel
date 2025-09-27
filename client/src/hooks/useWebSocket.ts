import { useState, useEffect, useRef, useCallback } from 'react';
import { getWebSocketUrl, ENV_CONFIG } from '../../../shared/environment';

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
  const isMountedRef = useRef(true);
  const maxReconnectAttempts = 5;
  const baseReconnectInterval = 1000; // Start with 1 second
  const maxReconnectInterval = 30000; // Max 30 seconds

  // Helper function to determine if we should attempt reconnection based on close code
  const shouldAttemptReconnect = (code: number, attempts: number): boolean => {
    // Don't reconnect if we've reached max attempts
    if (attempts >= maxReconnectAttempts) return false;
    
    // Normal closure codes - don't reconnect
    if (code === 1000 || code === 1001) return false;
    
    // Server errors that might be temporary - attempt reconnect
    if (code === 1006 || code === 1005 || code === 1011) return true;
    
    // Protocol errors - might be worth a few tries
    if (code === 1002 || code === 1003 || code === 1007) return attempts < 2;
    
    // Policy violations - don't reconnect
    if (code === 1008) return false;
    
    // TLS failure - might be temporary
    if (code === 1015) return attempts < 2;
    
    // For unknown codes, try a few times
    return attempts < 3;
  };

  // Helper function to calculate progressive reconnection delay
  const calculateReconnectDelay = (attempt: number): number => {
    // Exponential backoff with jitter
    const exponentialDelay = baseReconnectInterval * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 1000; // Add up to 1 second of jitter
    return Math.min(exponentialDelay + jitter, maxReconnectInterval);
  };

  // Helper function to handle WebSocket handshake errors (like status 200)
  const handleHandshakeError = (wsUrl: string): void => {
    console.error('🤝 WebSocket handshake failed for URL:', wsUrl);
    console.error('💡 This might indicate:');
    console.error('   - Server returned HTTP 200 instead of 101 (Switching Protocols)');
    console.error('   - CORS issues');
    console.error('   - Server doesn\'t support WebSocket protocol');
    console.error('   - Firewall or proxy blocking WebSocket connections');
    
    setLastMessage({
      type: 'HANDSHAKE_ERROR',
      message: 'فشل في مصافحة WebSocket - قد يكون السيرفر لا يدعم WebSocket أو مشكلة في CORS',
      url: wsUrl,
      timestamp: Date.now()
    });
  };

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
      // Use the current domain for WebSocket connection with proper error handling
      const wsUrl = getWebSocketUrl();

      // تحسين التحقق من صحة URL مع fallback ذكي
      if (!wsUrl || 
          wsUrl.includes('undefined') || 
          wsUrl.includes('NaN') || 
          wsUrl.includes('null') ||
          wsUrl === 'wss:///ws' ||
          wsUrl === 'ws:///ws' ||
          wsUrl.length < 10) {
        console.error('❌ Invalid WebSocket URL detected:', wsUrl);
        console.error('❌ Environment config:', ENV_CONFIG);
        console.error('❌ Current location:', typeof window !== 'undefined' ? window.location : 'server');
        
        // محاولة إنشاء URL احتياطي ذكي
        if (typeof window !== 'undefined') {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const hostname = window.location.hostname;
          
          // تحديد المنفذ بناءً على البيئة
          let fallbackUrl;
          if (hostname.includes('replit.dev') || hostname.includes('repl.co')) {
            fallbackUrl = `${protocol}//${hostname}/ws`;
          } else {
            const port = window.location.port || (protocol === 'wss:' ? '443' : '6000');
            fallbackUrl = `${protocol}//${hostname}:${port}/ws`;
          }
          
          console.log('🔄 Trying fallback URL:', fallbackUrl);
          console.log('🔑 WebSocket token:', token);
          const url = `${ENV_CONFIG.websocket.protocol}://${ENV_CONFIG.websocket.host}:${ENV_CONFIG.websocket.port}/ws?token=${token}`;
          wsRef.current = new WebSocket(url);
          //wsRef.current = new WebSocket(fallbackUrl);
        } else {
          console.error('❌ Cannot create fallback URL in server environment');
          return;
        }
      } else {
        console.log('🔌 Connecting to WebSocket:', wsUrl);
        wsRef.current = new WebSocket(wsUrl);
      }

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        if (isMountedRef.current) {
          setIsConnected(true);
          reconnectAttemptsRef.current = 0;

          // مسح أي timeout لإعادة الاتصال
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }
        }
      };

      wsRef.current.onmessage = (event) => {
        if (!isMountedRef.current) return;
        
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        const closeReasonMap: { [key: number]: string } = {
          1000: 'إغلاق طبيعي',
          1001: 'انتهى الاتصال - الصفحة يتم تحديثها أو إغلاقها',
          1002: 'خطأ في البروتوكول',
          1003: 'نوع بيانات غير مدعوم',
          1005: 'لم يتم استلام رمز الحالة',
          1006: 'إغلاق غير طبيعي - انقطاع الاتصال المفاجئ',
          1007: 'بيانات غير صالحة',
          1008: 'انتهاك السياسة',
          1009: 'رسالة كبيرة جداً',
          1010: 'امتداد مطلوب',
          1011: 'خطأ خادم داخلي',
          1015: 'فشل تشفير TLS'
        };

        const closeReason = closeReasonMap[event.code] || `كود غير معروف: ${event.code}`;
        console.log(`🔌 WebSocket disconnected - Code: ${event.code}, Reason: ${closeReason}`);
        
        if (event.reason) {
          console.log(`📝 Additional info: ${event.reason}`);
        }

        // Special handling for specific error codes
        if (event.code === 1006) {
          console.warn('⚠️ Abnormal closure detected - this might indicate network issues or server problems');
        } else if (event.code === 1005) {
          console.warn('⚠️ No status code received - connection may have been dropped unexpectedly');
        }

        setIsConnected(false);
        wsRef.current = null;

        // Clear last message to reset any authentication state
        setLastMessage({
          type: 'CONNECTION_CLOSED',
          message: `Connection closed: ${closeReason}`,
          code: event.code,
          reason: event.reason,
          timestamp: Date.now()
        });

        // تحسين منطق إعادة الاتصال بناءً على كود الخطأ
        const shouldReconnect = shouldAttemptReconnect(event.code, reconnectAttemptsRef.current);
        
        if (shouldReconnect) {
          reconnectAttemptsRef.current++;
          const delay = calculateReconnectDelay(reconnectAttemptsRef.current);

          console.log(`🔄 Attempting to reconnect in ${Math.round(delay)}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
          console.log(`📊 Connection failure type: ${closeReason}`);

          reconnectTimeoutRef.current = setTimeout(() => {
            if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
              connect();
            }
          }, delay);
        } else if (!shouldReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
          console.log(`❌ Not attempting reconnect for code ${event.code}: ${closeReason}`);
        } else {
          console.log(`❌ Max reconnection attempts (${maxReconnectAttempts}) reached`);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('🚨 WebSocket error occurred:');
        console.error('📍 Error details:', error);
        console.error('📊 WebSocket state:', wsRef.current?.readyState);
        console.error('🔗 Current URL:', wsRef.current?.url);
        
        // تسجيل معلومات إضافية للتشخيص
        if (typeof window !== 'undefined') {
          console.error('🌐 Current location:', window.location.href);
          console.error('🔌 Network status:', navigator.onLine ? 'Online' : 'Offline');
          console.error('🕒 Timestamp:', new Date().toISOString());
        }
        
        // Check if this might be a handshake error (status 200)
        if (wsRef.current?.url) {
          handleHandshakeError(wsRef.current.url);
        }
        
        setIsConnected(false);
        
        // إرسال رسالة خطأ مفصلة
        setLastMessage({
          type: 'CONNECTION_ERROR',
          message: 'خطأ في اتصال WebSocket - يتم المحاولة مرة أخرى',
          error: true,
          timestamp: Date.now(),
          networkOnline: typeof window !== 'undefined' ? navigator.onLine : undefined
        });
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
    isMountedRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;
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