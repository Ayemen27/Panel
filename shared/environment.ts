
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
    origin: (string | RegExp)[];
    credentials: boolean;
  };
  database: {
    ssl: boolean;
    connectionPooling: boolean;
  };
}

export function detectEnvironment(): EnvironmentConfig {
  // Safe process access for browser/server compatibility
  const processEnv = (typeof process !== 'undefined' && process.env) ? process.env : {};
  const nodeEnv = processEnv.NODE_ENV || 'development';
  
  const isReplit = !!(
    processEnv.REPL_ID || 
    processEnv.REPLIT_DB_URL || 
    processEnv.REPL_SLUG ||
    // في المتصفح، اكتشف Replit من النطاق
    (typeof window !== 'undefined' && window.location && (
      window.location.hostname.includes('replit.dev') ||
      window.location.hostname.includes('repl.co') ||
      window.location.hostname.includes('sisko.replit.dev') ||
      window.location.hostname.includes('pike.replit.dev') ||
      window.location.hostname.includes('worf.replit.dev')
    )) ||
    // في الخادم، تحقق من متغيرات النظام الإضافية
    (typeof process !== 'undefined' && (
      process.env.REPLIT_CLUSTER || 
      process.env.REPLIT_ENVIRONMENT ||
      process.env.NODE_ENV === 'development' && 
      (process.env.HOSTNAME && process.env.HOSTNAME.includes('replit'))
    ))
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
    
    // إنشاء قائمة CORS ديناميكية مرنة لدعم جميع نطاقات Replit
    const corsOrigins: (string | RegExp)[] = [
      // دعم جميع النطاقات الفرعية لـ Replit باستخدام Regex
      /^https:\/\/.*\.replit\.dev$/,
      /^https:\/\/.*\.repl\.co$/,
      /^https:\/\/.*\.sisko\.replit\.dev$/,
      /^https:\/\/.*\.pike\.replit\.dev$/,
      /^https:\/\/.*\.worf\.replit\.dev$/,
      'https://replit.com',
      'https://panel.binarjoinanelytic.info',
      'http://panel.binarjoinanelytic.info'
    ];

    // إضافة النطاق الحالي بشكل صريح إذا كان من Replit
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
        origin: (processEnv.ALLOWED_ORIGINS?.split(',') || ['https://yourdomain.com']).map(origin => origin.trim()),
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
    const port = window.location.port;
    
    // التحقق من صحة القيم
    if (!host || host === 'undefined' || host === 'null' || host.length === 0) {
      console.warn('Invalid hostname detected, using fallback');
      return 'wss://localhost:6000/ws';
    }
    
    // للنطاق المخصص أو Replit، استخدم الهوست الحالي بدون منفذ إضافي
    if (host.includes('replit.dev') || host.includes('repl.co') || host === 'panel.binarjoinanelytic.info') {
      // استخدم نفس المنفذ المستخدم في المتصفح أو المنفذ الافتراضي
      const finalPort = port || (protocol === 'wss:' ? '443' : '80');
      const wsUrl = finalPort === '443' || finalPort === '80' ? 
        `${protocol}//${host}/ws` : 
        `${protocol}//${host}:${finalPort}/ws`;
      console.log('Using Replit/Custom domain WebSocket URL:', wsUrl);
      return wsUrl;
    }
    
    // للتطوير المحلي
    const wsPort = ENV_CONFIG.websocket.port || 6000;
    if (!wsPort || wsPort === 0 || isNaN(wsPort)) {
      console.warn('Invalid WebSocket port, using default 6000');
      return `${protocol}//${host}:6000/ws`;
    }
    
    return `${protocol}//${host}:${wsPort}/ws`;
  }
  
  // في الخادم - التحقق من صحة القيم
  const protocol = ENV_CONFIG.websocket.protocol || 'ws';
  const host = ENV_CONFIG.websocket.host || 'localhost';
  const port = ENV_CONFIG.websocket.port || 6000;
  
  return `${protocol}://${host}:${port}/ws`;
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
  
  // إضافة تشخيص للمشاكل الشائعة
  const wsUrl = getWebSocketUrl();
  if (wsUrl.includes('undefined') || wsUrl.includes('NaN')) {
    console.error('❌ خطأ: WebSocket URL يحتوي على قيم غير صالحة!');
  }
  
  if (typeof window !== 'undefined') {
    console.log(`🌐 Current URL: ${window.location.href}`);
    console.log(`🔒 Protocol: ${window.location.protocol}`);
    console.log(`🏠 Hostname: ${window.location.hostname}`);
    console.log(`🚪 Port: ${window.location.port}`);
  }
  
  // التحقق من توفر process.env
  const processEnv = (typeof process !== 'undefined' && process.env) ? process.env : {};
  console.log(`🔧 NODE_ENV: ${processEnv.NODE_ENV || 'undefined'}`);
  console.log(`🔧 PORT: ${processEnv.PORT || 'undefined'}`);
  console.log(`🔧 REPL_ID: ${processEnv.REPL_ID ? 'defined' : 'undefined'}`);
}
