
export interface ConnectionTestResult {
  api: boolean;
  websocket: boolean;
  errors: string[];
  warnings: string[];
}

export async function testConnections(): Promise<ConnectionTestResult> {
  const result: ConnectionTestResult = {
    api: false,
    websocket: false,
    errors: [],
    warnings: []
  };

  // اختبار API
  try {
    const apiUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/health` : '/api/health';
    const response = await fetch(apiUrl, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      result.api = true;
      console.log('✅ API connection successful');
    } else {
      result.errors.push(`API returned status: ${response.status}`);
    }
  } catch (error) {
    result.errors.push(`API connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // اختبار WebSocket
  try {
    const wsUrl = await import('../../../shared/environment').then(env => env.getWebSocketUrl());
    
    if (wsUrl.includes('undefined') || wsUrl.includes('NaN')) {
      result.errors.push('WebSocket URL contains invalid values');
      return result;
    }

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket connection timeout'));
      }, 5000);

      ws.onopen = () => {
        clearTimeout(timeout);
        result.websocket = true;
        console.log('✅ WebSocket connection successful');
        ws.close();
        resolve();
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(new Error('WebSocket connection failed'));
      };

      ws.onclose = (event) => {
        clearTimeout(timeout);
        if (event.code !== 1000) {
          reject(new Error(`WebSocket closed with code: ${event.code}`));
        }
      };
    });
  } catch (error) {
    result.errors.push(`WebSocket test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

export function logConnectionTestResults(result: ConnectionTestResult): void {
  console.log('🔍 Connection Test Results:');
  console.log(`📡 API: ${result.api ? '✅' : '❌'}`);
  console.log(`🔌 WebSocket: ${result.websocket ? '✅' : '❌'}`);
  
  if (result.errors.length > 0) {
    console.log('❌ Errors:');
    result.errors.forEach(error => console.log(`   - ${error}`));
  }
  
  if (result.warnings.length > 0) {
    console.log('⚠️ Warnings:');
    result.warnings.forEach(warning => console.log(`   - ${warning}`));
  }
}
