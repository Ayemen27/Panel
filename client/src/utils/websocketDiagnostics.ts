
export interface WebSocketDiagnosticResult {
  success: boolean;
  url: string;
  responseTime: number;
  errors: string[];
  warnings: string[];
  tokenSupported: boolean;
  customDomainSupported: boolean;
  connectionDetails: {
    protocol: string;
    host: string;
    port?: string;
    path: string;
    hasToken: boolean;
    environment: string;
  };
}

export async function runWebSocketDiagnostics(token?: string): Promise<WebSocketDiagnosticResult> {
  const startTime = Date.now();
  const result: WebSocketDiagnosticResult = {
    success: false,
    url: '',
    responseTime: 0,
    errors: [],
    warnings: [],
    tokenSupported: false,
    customDomainSupported: false,
    connectionDetails: {
      protocol: '',
      host: '',
      path: '/ws',
      hasToken: !!token,
      environment: 'unknown'
    }
  };

  console.log('🔍 Starting WebSocket diagnostics...');

  try {
    // استخدام نفس منطق getWebSocketUrl
    const { getWebSocketUrl, ENV_CONFIG } = await import('../../../shared/environment');
    const wsUrl = getWebSocketUrl(token);
    result.url = wsUrl;

    // تحليل URL
    const urlObj = new URL(wsUrl);
    result.connectionDetails = {
      protocol: urlObj.protocol,
      host: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      hasToken: urlObj.searchParams.has('token'),
      environment: ENV_CONFIG.name
    };

    console.log('🔗 Testing WebSocket URL:', wsUrl.replace(/token=[^&]+/, 'token=***'));
    console.log('📊 Connection details:', result.connectionDetails);

    // اختبار الاتصال
    const connectResult = await testWebSocketConnection(wsUrl);
    result.success = connectResult.success;
    result.errors = connectResult.errors;
    result.warnings = connectResult.warnings;
    result.tokenSupported = connectResult.tokenAccepted;

    // اختبار دعم النطاق المخصص
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      result.customDomainSupported = hostname.includes('binarjoinanelytic.info');
      
      if (result.customDomainSupported) {
        console.log('✅ Custom domain detected and supported');
      }
    }

    result.responseTime = Date.now() - startTime;

    console.log('📈 WebSocket diagnostics completed:', {
      success: result.success,
      responseTime: result.responseTime,
      tokenSupported: result.tokenSupported,
      customDomainSupported: result.customDomainSupported
    });

  } catch (error) {
    result.errors.push(`Diagnostics failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    result.responseTime = Date.now() - startTime;
  }

  return result;
}

async function testWebSocketConnection(wsUrl: string): Promise<{
  success: boolean;
  errors: string[];
  warnings: string[];
  tokenAccepted: boolean;
}> {
  return new Promise((resolve) => {
    const result = {
      success: false,
      errors: [] as string[],
      warnings: [] as string[],
      tokenAccepted: false
    };

    try {
      const ws = new WebSocket(wsUrl);
      let messageReceived = false;
      let authMessageSent = false;

      const timeout = setTimeout(() => {
        if (!result.success) {
          result.errors.push('Connection timeout (10s)');
          ws.close();
          resolve(result);
        }
      }, 10000);

      ws.onopen = () => {
        console.log('🔌 WebSocket test connection opened');
        result.success = true;
        
        // إرسال رسالة اختبار التوكن
        ws.send(JSON.stringify({
          type: 'DIAGNOSTIC_TEST',
          message: 'Token validation test',
          timestamp: Date.now()
        }));
        authMessageSent = true;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          messageReceived = true;
          
          if (message.type === 'CONNECTED' || message.type === 'CONNECTION_SUCCESS') {
            result.tokenAccepted = true;
            console.log('✅ Token validation successful');
          }
          
          console.log('📨 Received test message:', message.type);
        } catch (error) {
          result.warnings.push('Received non-JSON message');
        }
      };

      ws.onclose = (event) => {
        clearTimeout(timeout);
        console.log(`🔌 WebSocket test connection closed: ${event.code}`);
        
        if (!messageReceived && authMessageSent) {
          result.warnings.push('No response to test message');
        }
        
        if (event.code !== 1000 && result.success) {
          result.warnings.push(`Unexpected close code: ${event.code}`);
        }
        
        resolve(result);
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        console.error('❌ WebSocket test error:', error);
        result.errors.push('Connection error occurred');
        result.success = false;
        resolve(result);
      };

    } catch (error) {
      result.errors.push(`Failed to create WebSocket: ${error instanceof Error ? error.message : 'Unknown error'}`);
      resolve(result);
    }
  });
}

// دالة مساعدة لتشغيل التشخيص من وحدة التحكم
export async function diagnoseWebSocket(token?: string) {
  console.log('🚀 Running comprehensive WebSocket diagnostics...');
  const result = await runWebSocketDiagnostics(token);
  
  console.log('📋 Diagnostic Results:');
  console.log('   Success:', result.success);
  console.log('   Response Time:', result.responseTime + 'ms');
  console.log('   Token Support:', result.tokenSupported);
  console.log('   Custom Domain Support:', result.customDomainSupported);
  console.log('   Environment:', result.connectionDetails.environment);
  
  if (result.errors.length > 0) {
    console.log('❌ Errors:');
    result.errors.forEach(error => console.log('   -', error));
  }
  
  if (result.warnings.length > 0) {
    console.log('⚠️ Warnings:');
    result.warnings.forEach(warning => console.log('   -', warning));
  }
  
  return result;
}
