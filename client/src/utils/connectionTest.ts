export interface ConnectionTestResult {
  api: boolean;
  websocket: boolean;
  errors: string[];
  warnings: string[];
  diagnostics: {
    apiUrl?: string;
    apiStatus?: number;
    apiResponseTime?: number;
    wsUrl?: string;
    wsCloseCode?: number;
    wsCloseReason?: string;
    networkOnline?: boolean;
    timestamp: number;
    fallbacksAttempted?: string[];
    environment?: string;
  };
}

export async function testConnections(): Promise<ConnectionTestResult> {
  const startTime = Date.now();
  const result: ConnectionTestResult = {
    api: false,
    websocket: false,
    errors: [],
    warnings: [],
    diagnostics: {
      timestamp: startTime,
      networkOnline: typeof window !== 'undefined' ? navigator.onLine : true
    }
  };

  // إضافة معلومات البيئة
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname.includes('replit.dev') || hostname.includes('repl.co')) {
      result.diagnostics.environment = 'replit';
    } else if (hostname === 'panel.binarjoinanelytic.info') {
      result.diagnostics.environment = 'custom-domain';
    } else if (hostname === 'localhost' || hostname === '127.0.0.1') {
      result.diagnostics.environment = 'localhost';
    } else {
      result.diagnostics.environment = 'unknown';
    }
  }

  console.log('🔍 Starting comprehensive connection tests...');
  console.log(`🌐 Environment: ${result.diagnostics.environment}`);
  console.log(`🔌 Network Status: ${result.diagnostics.networkOnline ? 'Online' : 'Offline'}`);

  // اختبار API مع تشخيص مفصل
  const apiTestStart = Date.now();
  try {
    const apiUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/health` : '/api/health';
    result.diagnostics.apiUrl = apiUrl;
    
    console.log('📡 Testing API connection to:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      // إضافة timeout للـ API test
      signal: AbortSignal.timeout(10000)
    });
    
    result.diagnostics.apiStatus = response.status;
    result.diagnostics.apiResponseTime = Date.now() - apiTestStart;
    
    if (response.ok) {
      result.api = true;
      console.log(`✅ API connection successful (${result.diagnostics.apiResponseTime}ms)`);
      
      // محاولة قراءة الاستجابة لمعلومات إضافية
      try {
        const data = await response.json();
        if (data.database && data.database.status !== 'healthy') {
          result.warnings.push(`Database status: ${data.database.status}`);
        }
      } catch (e) {
        // تجاهل أخطاء قراءة الاستجابة
      }
    } else {
      const errorMsg = `API returned status: ${response.status} ${response.statusText}`;
      result.errors.push(errorMsg);
      
      // إضافة رسائل تشخيص محددة بناءً على كود الاستجابة
      if (response.status === 404) {
        result.errors.push('API endpoint not found - server might not be running or misconfigured');
      } else if (response.status === 500) {
        result.errors.push('Internal server error - check server logs');
      } else if (response.status === 502 || response.status === 503) {
        result.errors.push('Server unavailable - service might be starting up or overloaded');
      } else if (response.status === 401 || response.status === 403) {
        result.warnings.push('Authentication/authorization issue - might be expected for health endpoint');
      }
    }
  } catch (error) {
    result.diagnostics.apiResponseTime = Date.now() - apiTestStart;
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        result.errors.push('API connection timeout (10s) - server might be slow or unreachable');
      } else if (error.message.includes('Failed to fetch')) {
        result.errors.push('API connection failed - network error or CORS issue');
        result.warnings.push('Check if server is running and CORS is properly configured');
      } else {
        result.errors.push(`API connection failed: ${error.message}`);
      }
    } else {
      result.errors.push('API connection failed: Unknown error');
    }
  }

  // اختبار WebSocket مع تشخيص مفصل وتجربة fallbacks
  console.log('🔌 Starting WebSocket connection tests...');
  
  try {
    const { getWebSocketUrl } = await import('../../../shared/environment');
    const primaryWsUrl = getWebSocketUrl();
    result.diagnostics.wsUrl = primaryWsUrl;
    
    console.log('🔗 Primary WebSocket URL:', primaryWsUrl);
    
    // التحقق من صحة URL أولاً
    if (primaryWsUrl.includes('undefined') || primaryWsUrl.includes('NaN') || primaryWsUrl.includes('null')) {
      result.errors.push('WebSocket URL contains invalid values');
      result.errors.push(`Invalid URL: ${primaryWsUrl}`);
      return result;
    }

    // اختبار الـ URL الأساسي
    const wsTestResult = await testSingleWebSocketUrl(primaryWsUrl);
    
    if (wsTestResult.success) {
      result.websocket = true;
      result.diagnostics.wsCloseCode = wsTestResult.closeCode;
      result.diagnostics.wsCloseReason = wsTestResult.closeReason;
      console.log('✅ WebSocket connection successful');
    } else {
      result.errors.push(`Primary WebSocket failed: ${wsTestResult.error}`);
      result.diagnostics.wsCloseCode = wsTestResult.closeCode;
      result.diagnostics.wsCloseReason = wsTestResult.closeReason;
      
      // تجربة URLs احتياطية
      console.log('🔄 Trying fallback WebSocket URLs...');
      const fallbackUrls: string[] = [];
      
      if (typeof window !== 'undefined') {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const hostname = window.location.hostname;
        
        // إنشاء قائمة fallbacks
        const ports = protocol === 'wss:' ? ['', ':443', ':5001', ':5000'] : [':5001', ':5000', ':6000'];
        ports.forEach(port => {
          const fallbackUrl = `${protocol}//${hostname}${port}/ws`;
          if (fallbackUrl !== primaryWsUrl) {
            fallbackUrls.push(fallbackUrl);
          }
        });
        
        result.diagnostics.fallbacksAttempted = fallbackUrls;
        
        // تجربة كل fallback URL
        for (const fallbackUrl of fallbackUrls) {
          console.log('🔄 Trying fallback:', fallbackUrl);
          const fallbackResult = await testSingleWebSocketUrl(fallbackUrl, 3000); // timeout أقل للـ fallbacks
          
          if (fallbackResult.success) {
            result.websocket = true;
            result.diagnostics.wsUrl = fallbackUrl;
            result.diagnostics.wsCloseCode = fallbackResult.closeCode;
            result.diagnostics.wsCloseReason = fallbackResult.closeReason;
            result.warnings.push(`Primary WebSocket failed, but fallback succeeded: ${fallbackUrl}`);
            console.log('✅ Fallback WebSocket connection successful:', fallbackUrl);
            break;
          } else {
            console.log('❌ Fallback failed:', fallbackUrl, fallbackResult.error);
          }
        }
        
        if (!result.websocket) {
          result.errors.push('All WebSocket connection attempts failed (primary + fallbacks)');
        }
      }
    }
  } catch (error) {
    result.errors.push(`WebSocket test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // إضافة تحليل نهائي وتوصيات
  const totalTime = Date.now() - startTime;
  console.log(`🏁 Connection tests completed in ${totalTime}ms`);
  
  if (!result.api && !result.websocket) {
    result.errors.push('Complete connectivity failure - check if server is running');
  } else if (!result.api && result.websocket) {
    result.warnings.push('WebSocket works but API fails - unusual configuration');
  } else if (result.api && !result.websocket) {
    result.warnings.push('API works but WebSocket fails - check WebSocket server configuration');
  }
  
  return result;
}

// دالة مساعدة لاختبار WebSocket URL واحد
async function testSingleWebSocketUrl(wsUrl: string, timeout: number = 5000): Promise<{
  success: boolean;
  error?: string;
  closeCode?: number;
  closeReason?: string;
}> {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(wsUrl);
      let resolved = false;
      
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          ws.close();
          resolve({
            success: false,
            error: `Connection timeout after ${timeout}ms`
          });
        }
      }, timeout);

      ws.onopen = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          ws.close(1000, 'Test completed');
          resolve({
            success: true
          });
        }
      };

      ws.onerror = (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          resolve({
            success: false,
            error: 'WebSocket error event triggered'
          });
        }
      };

      ws.onclose = (event) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          
          // إذا كان الإغلاق طبيعي، فالاتصال نجح
          if (event.code === 1000) {
            resolve({
              success: true,
              closeCode: event.code,
              closeReason: event.reason
            });
          } else {
            resolve({
              success: false,
              error: `Connection closed with code: ${event.code}`,
              closeCode: event.code,
              closeReason: event.reason
            });
          }
        }
      };
    } catch (error) {
      resolve({
        success: false,
        error: `Failed to create WebSocket: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  });
}

export function logConnectionTestResults(result: ConnectionTestResult): void {
  console.log('🔍 نتائج اختبار الاتصال:');
  console.log(`📡 API: ${result.api ? '✅' : '❌'}`);
  console.log(`🔌 WebSocket: ${result.websocket ? '✅' : '❌'}`);
  
  // طباعة معلومات التشخيص
  if (result.diagnostics) {
    console.log('📊 معلومات التشخيص:');
    
    if (result.diagnostics.environment) {
      console.log(`   🌍 البيئة: ${result.diagnostics.environment}`);
    }
    
    if (result.diagnostics.networkOnline !== undefined) {
      console.log(`   🔌 حالة الشبكة: ${result.diagnostics.networkOnline ? '✅ متصل' : '❌ غير متصل'}`);
    }
    
    if (result.diagnostics.apiUrl) {
      console.log(`   📡 API URL: ${result.diagnostics.apiUrl}`);
    }
    
    if (result.diagnostics.apiStatus) {
      console.log(`   📊 API Status: ${result.diagnostics.apiStatus}`);
    }
    
    if (result.diagnostics.apiResponseTime) {
      console.log(`   ⏱️ API Response Time: ${result.diagnostics.apiResponseTime}ms`);
    }
    
    if (result.diagnostics.wsUrl) {
      console.log(`   🔌 WebSocket URL: ${result.diagnostics.wsUrl}`);
    }
    
    if (result.diagnostics.wsCloseCode !== undefined) {
      console.log(`   🔌 WebSocket Close Code: ${result.diagnostics.wsCloseCode}`);
    }
    
    if (result.diagnostics.wsCloseReason) {
      console.log(`   📝 WebSocket Close Reason: ${result.diagnostics.wsCloseReason}`);
    }
    
    if (result.diagnostics.fallbacksAttempted && result.diagnostics.fallbacksAttempted.length > 0) {
      console.log(`   🔄 Fallbacks Attempted: ${result.diagnostics.fallbacksAttempted.length}`);
      result.diagnostics.fallbacksAttempted.forEach((url, index) => {
        console.log(`      ${index + 1}. ${url}`);
      });
    }
  }
  
  if (result.errors.length > 0) {
    console.log('❌ الأخطاء:');
    result.errors.forEach(error => console.log(`   - ${error}`));
  }
  
  if (result.warnings.length > 0) {
    console.log('⚠️ التحذيرات:');
    result.warnings.forEach(warning => console.log(`   - ${warning}`));
  }
  
  // إضافة توصيات بناءً على النتائج
  console.log('💡 التوصيات:');
  
  if (!result.api && !result.websocket) {
    console.log('   - تأكد من تشغيل الخادم');
    console.log('   - تحقق من إعدادات الشبكة والجدار الناري');
  } else if (!result.api) {
    console.log('   - تحقق من تشغيل API server');
    console.log('   - تأكد من إعدادات CORS');
  } else if (!result.websocket) {
    console.log('   - تحقق من تشغيل WebSocket server');
    console.log('   - تأكد من صحة WebSocket URL');
    console.log('   - تحقق من إعدادات الProxy أو الجدار الناري');
  } else {
    console.log('   ✅ جميع الاتصالات تعمل بشكل صحيح!');
  }
}

// دالة لإجراء اختبار سريع للاتصال
export async function quickConnectionTest(): Promise<{ api: boolean; websocket: boolean }> {
  const result = { api: false, websocket: false };
  
  // اختبار API سريع
  try {
    const apiUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/health` : '/api/health';
    const response = await fetch(apiUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    });
    result.api = response.ok;
  } catch {
    result.api = false;
  }
  
  // اختبار WebSocket سريع
  try {
    const { getWebSocketUrl } = await import('../../../shared/environment');
    const wsUrl = getWebSocketUrl();
    const wsResult = await testSingleWebSocketUrl(wsUrl, 2000);
    result.websocket = wsResult.success;
  } catch {
    result.websocket = false;
  }
  
  return result;
}