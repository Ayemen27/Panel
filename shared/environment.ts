
export interface EnvironmentConfig {
  name: 'replit' | 'production' | 'development';
  isReplit: boolean;
  host: string;
  port: number;
  hmr: {
    port: number;
    host: string;
    protocol?: string;
  };
  websocket: {
    port: number;
    host: string;
    protocol: string;
  };
  cors: {
    origin: string[];
    credentials: boolean;
  };
  database: {
    ssl: boolean;
    connectionPooling: boolean;
  };
}

export function detectEnvironment(): EnvironmentConfig {
  // Safe process access for browser/server compatibility
  const processEnv = typeof process !== 'undefined' ? process.env : {};
  const nodeEnv = processEnv.NODE_ENV || 'development';
  
  const isReplit = !!(
    processEnv.REPL_ID || 
    processEnv.REPLIT_DB_URL || 
    processEnv.REPL_SLUG ||
    (typeof window !== 'undefined' && window.location.hostname.includes('replit.dev'))
  );

  // اكتشاف النطاق المخصص
  const isCustomDomain = typeof window !== 'undefined' && 
    window.location.hostname === 'panel.binarjoinanelytic.info';
  
  const isDevelopment = nodeEnv === 'development';
  const isProduction = nodeEnv === 'production';

  // إذا كان النطاق المخصص، استخدم إعدادات الإنتاج
  if (isCustomDomain) {
    return {
      name: 'production',
      isReplit: false,
      host: '0.0.0.0',
      port: parseInt(processEnv.PORT || '6000'),
      hmr: {
        port: 443,
        host: 'panel.binarjoinanelytic.info',
        protocol: 'wss'
      },
      websocket: {
        port: 443,
        host: 'panel.binarjoinanelytic.info',
        protocol: 'wss',
      },
      cors: {
        origin: [
          'https://panel.binarjoinanelytic.info',
          'http://panel.binarjoinanelytic.info',
        ],
        credentials: true,
      },
      database: {
        ssl: true,
        connectionPooling: true,
      },
    };
  }

  if (isReplit) {
    const currentHost = typeof window !== 'undefined' ? window.location.hostname : '0.0.0.0';
    
    // إنشاء قائمة CORS ديناميكية تدعم جميع نطاقات Replit
    const corsOrigins = [
      'https://*.replit.dev',
      'https://*.repl.co', 
      'https://replit.com',
      'https://panel.binarjoinanelytic.info',
      'http://panel.binarjoinanelytic.info'
    ];

    // إضافة النطاق الحالي إذا كان من Replit
    if (typeof window !== 'undefined' && currentHost) {
      const currentOrigin = `${window.location.protocol}//${currentHost}`;
      if (currentHost.includes('replit.dev') || currentHost.includes('repl.co')) {
        corsOrigins.push(currentOrigin);
      }
    }

    // إضافة نطاقات التطوير إذا لزم الأمر  
    if (isDevelopment) {
      corsOrigins.push(
        'http://localhost:3000',
        'http://localhost:5173', 
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173'
      );
    }
    
    return {
      name: 'replit',
      isReplit: true,
      host: '0.0.0.0',
      port: parseInt(processEnv.PORT || '6000'),
      hmr: {
        port: 24678,
        host: currentHost,
        protocol: 'wss'
      },
      websocket: {
        port: parseInt(processEnv.PORT || '6000'),
        host: currentHost,
        protocol: 'wss',
      },
      cors: {
        origin: corsOrigins,
        credentials: true,
      },
      database: {
        ssl: true,
        connectionPooling: true,
      },
    };
  }

  if (isProduction) {
    return {
      name: 'production',
      isReplit: false,
      host: '0.0.0.0',
      port: parseInt(processEnv.PORT || '3000'),
      hmr: {
        port: 24678,
        host: 'localhost',
      },
      websocket: {
        port: parseInt(processEnv.WS_PORT || processEnv.PORT || '3000'),
        host: '0.0.0.0',
        protocol: 'wss',
      },
      cors: {
        origin: processEnv.ALLOWED_ORIGINS?.split(',') || ['https://yourdomain.com'],
        credentials: true,
      },
      database: {
        ssl: true,
        connectionPooling: true,
      },
    };
  }

  // Development environment
  return {
    name: 'development',
    isReplit: false,
    host: 'localhost',
    port: parseInt(processEnv.PORT || '3000'),
    hmr: {
      port: 24678,
      host: 'localhost',
    },
    websocket: {
      port: parseInt(processEnv.WS_PORT || '8080'),
      host: 'localhost',
      protocol: 'ws',
    },
    cors: {
      origin: [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173'
      ],
      credentials: true,
    },
    database: {
      ssl: false,
      connectionPooling: false,
    },
  };
}

export const ENV_CONFIG = detectEnvironment();

// Helper functions
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // في المتصفح - استخدم الرابط الحالي دائماً
    return window.location.origin;
  }
  
  // في الخادم
  const protocol = ENV_CONFIG.name === 'production' ? 'https' : 'http';
  return `${protocol}://${ENV_CONFIG.host}:${ENV_CONFIG.port}`;
}

export function getWebSocketUrl(): string {
  if (typeof window !== 'undefined') {
    // في المتصفح - استخدم الهوست الحالي مع البروتوكول المناسب
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = ENV_CONFIG.websocket.port;
    
    // للنطاق المخصص أو Replit، استخدم المنفذ من النافذة
    if (host.includes('replit.dev') || host === 'panel.binarjoinanelytic.info') {
      return `${protocol}//${window.location.host}/ws`;
    }
    
    return `${protocol}//${host}:${port}/ws`;
  }
  
  // في الخادم
  return `${ENV_CONFIG.websocket.protocol}://${ENV_CONFIG.websocket.host}:${ENV_CONFIG.websocket.port}/ws`;
}

export function logEnvironmentInfo(): void {
  const isCustomDomain = typeof window !== 'undefined' && 
    window.location.hostname === 'panel.binarjoinanelytic.info';
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'server';
    
  console.log('🌍 Environment Configuration:');
  console.log(`📍 Environment: ${ENV_CONFIG.name}`);
  console.log(`🔧 Replit: ${ENV_CONFIG.isReplit}`);
  console.log(`💻 Current Host: ${currentHost}`);
  
  if (isCustomDomain) {
    console.log(`🌟 Custom Domain: panel.binarjoinanelytic.info`);
    console.log(`🔗 External Server: 93.127.142.144`);
  }
  
  console.log(`🌐 Server: ${ENV_CONFIG.host}:${ENV_CONFIG.port}`);
  console.log(`⚡ HMR: ${ENV_CONFIG.hmr.protocol || 'ws'}://${ENV_CONFIG.hmr.host}:${ENV_CONFIG.hmr.port}`);
  console.log(`🔌 WebSocket: ${ENV_CONFIG.websocket.protocol}://${ENV_CONFIG.websocket.host}:${ENV_CONFIG.websocket.port}`);
  console.log(`📡 API Base: ${getApiBaseUrl()}`);
  console.log(`🔌 WS URL: ${getWebSocketUrl()}`);
  console.log(`🔐 CORS Origins:`, ENV_CONFIG.cors.origin);
}
