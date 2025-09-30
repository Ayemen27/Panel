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

export function useWebSocket(token?: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [connectionDiagnostics, setConnectionDiagnostics] = useState<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isMountedRef = useRef(true);
  const maxReconnectAttempts = 5;
  const baseReconnectInterval = 1000; // Start with 1 second
  const maxReconnectInterval = 30000; // Max 30 seconds
  const tokenRef = useRef(token);

  // State to track connection status explicitly for reconnection logic
  const [connectionState, setConnectionState] = useState<'connecting' | 'open' | 'closed' | 'failed'>('closed');

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
    // Only attempt to connect if not already connecting or open
    if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) {
      console.log('WebSocket already connecting/connected, skipping connect call.');
      return;
    }

    // Clear any existing reconnection timeouts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setConnectionState('connecting');
    setIsConnected(false); // Ensure this is false while connecting

    // 🔧 KIWI COMPATIBILITY: جرب مصادر متعددة للتوكن
    let currentToken = tokenRef.current;
    
    // إذا لم يكن لدينا توكن، جرب localStorage
    if (!currentToken || currentToken.length === 0) {
      currentToken = localStorage.getItem('authToken');
    }

    // إذا لم نجد في localStorage، جرب الكوكيز
    if (!currentToken || currentToken.length === 0) {
      const cookieToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('authToken='))
        ?.split('=')[1];
      if (cookieToken) {
        currentToken = cookieToken;
        // حفظه في localStorage للمرات القادمة
        localStorage.setItem('authToken', cookieToken);
      }
    }

    // 🔧 KIWI FALLBACK: حتى بدون توكن، جرب الاتصال
    if (!currentToken || currentToken.length === 0) {
      console.log('⚠️ No token found, attempting connection without token...');
      // لا نُرجع مبكراً، ندع WebSocket يحاول الاتصال
    }

    try {
      const wsUrl = getWebSocketUrl();
      const wsUrlWithToken = currentToken ? `${wsUrl}?token=${currentToken}` : wsUrl;

      const diagnostics = {
        url: wsUrlWithToken,
        hasToken: !!currentToken,
        environment: ENV_CONFIG.name,
        timestamp: new Date().toISOString(),
        hostname: typeof window !== 'undefined' ? window.location.hostname : 'server'
      };
      setConnectionDiagnostics(diagnostics);
      console.log('🔍 WebSocket connection diagnostics:', diagnostics);

      if (!wsUrlWithToken ||
          wsUrlWithToken.includes('undefined') ||
          wsUrlWithToken.includes('NaN') ||
          wsUrlWithToken.includes('null') ||
          wsUrlWithToken === 'wss:///ws' ||
          wsUrlWithToken === 'ws:///ws' ||
          wsUrlWithToken.length < 10) {
        console.error('❌ Invalid WebSocket URL detected:', wsUrlWithToken);
        console.error('❌ Environment config:', ENV_CONFIG);
        console.error('❌ Current location:', typeof window !== 'undefined' ? window.location : 'server');

        if (typeof window !== 'undefined') {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const hostname = window.location.hostname;
          let fallbackUrl;
          if (hostname.includes('replit.dev') || hostname.includes('repl.co')) {
            fallbackUrl = `${protocol}//${hostname}/ws`;
          } else {
            const port = window.location.port || (protocol === 'wss:' ? '443' : '6000');
            fallbackUrl = `${protocol}//${hostname}:${port}/ws`;
          }
          console.log('🔄 Trying fallback URL:', fallbackUrl);
          wsRef.current = new WebSocket(fallbackUrl);
        } else {
          console.error('❌ Cannot create fallback URL in server environment');
          setConnectionState('failed');
          return;
        }
      } else {
        console.log('🔌 Connecting to WebSocket:', wsUrlWithToken.replace(/token=[^&]+/, 'token=***'));
        wsRef.current = new WebSocket(wsUrlWithToken);
      }

      wsRef.current.onopen = () => {
        console.log('✅ WebSocket connected successfully');
        console.log('🔗 Connection URL:', wsUrlWithToken.replace(/token=[^&]+/, 'token=***'));
        console.log('🌐 Domain:', typeof window !== 'undefined' ? window.location.hostname : 'server');

        if (isMountedRef.current) {
          setIsConnected(true);
          setConnectionState('open');
          reconnectAttemptsRef.current = 0; // Reset attempts on successful connection

          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }

          setLastMessage({
            type: 'CONNECTION_SUCCESS',
            message: 'تم الاتصال بـ WebSocket بنجاح',
            timestamp: Date.now(),
            diagnostics: connectionDiagnostics
          });
        }
      };

      wsRef.current.onmessage = (event) => {
        if (!isMountedRef.current) return;

        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          if (message.type === 'CONNECTION_SUCCESS' || message.type === 'CONNECTED') {
            console.log('✅ WebSocket authentication successful');
          }

          setLastMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          // Optionally set an error message for the user
          setLastMessage({
            type: 'PARSE_ERROR',
            message: 'Failed to parse incoming WebSocket message.',
            error: true,
            timestamp: Date.now()
          });
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

        if (event.code === 1006) {
          console.warn('⚠️ Abnormal closure detected - this might indicate network issues or server problems');
        } else if (event.code === 1005) {
          console.warn('⚠️ No status code received - connection may have been dropped unexpectedly');
        }

        setIsConnected(false);
        setConnectionState('closed');
        wsRef.current = null;

        setLastMessage({
          type: 'CONNECTION_CLOSED',
          message: `Connection closed: ${closeReason}`,
          code: event.code,
          reason: event.reason,
          timestamp: Date.now()
        });

        const shouldReconnect = shouldAttemptReconnect(event.code, reconnectAttemptsRef.current);

        if (shouldReconnect) {
          reconnectAttemptsRef.current++;
          const delay = calculateReconnectDelay(reconnectAttemptsRef.current);

          console.log(`🔄 Attempting to reconnect in ${Math.round(delay)}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
          console.log(`📊 Connection failure type: ${closeReason}`);

          reconnectTimeoutRef.current = setTimeout(() => {
            // Check if the component is still mounted and if we should proceed
            if (isMountedRef.current && (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED)) {
              connect();
            }
          }, delay);
        } else if (!shouldReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
          console.log(`❌ Not attempting reconnect for code ${event.code}: ${closeReason}`);
          setConnectionState('failed'); // Mark as failed if not reconnecting
        } else {
          console.log(`❌ Max reconnection attempts (${maxReconnectAttempts}) reached`);
          setConnectionState('failed'); // Mark as failed after max attempts
          // Reset reconnection attempts counter after a significant delay to allow for manual reconnects or restarts
          setTimeout(() => {
            reconnectAttemptsRef.current = 0;
            console.log('🔄 Reset reconnection attempts counter after prolonged idle period');
          }, 60000); // Reset after 1 minute
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('🚨 WebSocket error occurred:');
        console.error('📍 Error details:', error);
        console.error('📊 WebSocket state:', wsRef.current?.readyState);
        console.error('🔗 Current URL:', wsRef.current?.url);

        if (typeof window !== 'undefined') {
          console.error('🌐 Current location:', window.location.href);
          console.error('🔌 Network status:', navigator.onLine ? 'Online' : 'Offline');
          console.error('🕒 Timestamp:', new Date().toISOString());
        }

        if (wsRef.current?.url) {
          handleHandshakeError(wsRef.current.url);
        }

        setIsConnected(false);
        setConnectionState('failed'); // Set state to failed on error

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
      setConnectionState('failed');
      setLastMessage({
        type: 'CONNECTION_INIT_ERROR',
        message: 'Failed to initialize WebSocket connection.',
        error: true,
        timestamp: Date.now()
      });
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
    setConnectionState('closed');
    reconnectAttemptsRef.current = maxReconnectAttempts; // Prevent automatic reconnection on manual disconnect
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    console.warn('WebSocket is not open. Cannot send message:', message);
    return false;
  }, []);

  // Reconnection logic hook
  // Moved the reconnect logic into a separate useEffect to manage its lifecycle independently
  useEffect(() => {
    // This effect will manage the reconnection attempts based on the connection state
    const handleReconnect = () => {
      // Only attempt to reconnect if the connection is not open and not already connecting
      if (connectionState === 'closed' || connectionState === 'failed') {
        // Check if we should attempt to reconnect based on max attempts
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = calculateReconnectDelay(reconnectAttemptsRef.current);
          console.log(`RECONNECT_MANAGER: Scheduling reconnect in ${delay}ms (Attempt ${reconnectAttemptsRef.current + 1})`);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current && (connectionState === 'closed' || connectionState === 'failed')) {
              connect();
            }
          }, delay);
        } else {
          console.log('RECONNECT_MANAGER: Max reconnection attempts reached.');
          setConnectionState('failed'); // Ensure state is 'failed' if max attempts are reached
        }
      }
    };

    // If connection closed or failed, schedule a reconnect attempt
    if (connectionState === 'closed' || connectionState === 'failed') {
      handleReconnect();
    }

    // Cleanup function to clear timeout if component unmounts or state changes
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connectionState, connect]); // Depend on connectionState and connect function


  // Initial connection and cleanup
  useEffect(() => {
    isMountedRef.current = true;

    // Initial connection attempt based on token availability
    if (tokenRef.current && tokenRef.current.length > 0) {
      console.log('INITIAL_CONNECT: Token available, attempting WebSocket connection...');
      connect();
    } else {
      console.log('INITIAL_CONNECT: No valid token, skipping WebSocket connection.');
      setIsConnected(false);
      setConnectionState('closed');
    }

    return () => {
      isMountedRef.current = false;
      console.log('CLEANUP: Disconnecting WebSocket...');
      disconnect(); // Ensure disconnect is called on unmount
    };
  }, [connect, disconnect]); // Ensure connect and disconnect are stable

  // Reconnect on window focus if not connected and within retry limits
  useEffect(() => {
    const handleFocus = () => {
      if (!isConnected && reconnectAttemptsRef.current < maxReconnectAttempts && connectionState !== 'connecting') {
        console.log('FOCUS_EVENT: Window focused, attempting to reconnect...');
        connect();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isConnected, connect, connectionState]);

  // Update token and handle reconnection/disconnection
  const updateToken = useCallback((newToken: string) => {
    const previousToken = tokenRef.current;
    tokenRef.current = newToken;

    if (newToken && !previousToken) {
      console.log('UPDATE_TOKEN: Token received for the first time, connecting...');
      connect();
    } else if (newToken && previousToken && newToken !== previousToken) {
      console.log('UPDATE_TOKEN: Token changed, reconnecting...');
      // Disconnect and then connect to establish a new connection with the updated token
      disconnect();
      // Small delay to ensure previous connection is fully closed before establishing new one
      setTimeout(() => connect(), 200);
    } else if (!newToken && previousToken) {
      console.log('UPDATE_TOKEN: Token removed, disconnecting...');
      disconnect();
    }
  }, [disconnect, connect]);

  return {
    isConnected,
    lastMessage,
    connectionDiagnostics,
    sendMessage,
    reconnect: connect, // Expose connect as reconnect
    disconnect,
    updateToken,
    connectionState // Expose connectionState for external use
  };
}