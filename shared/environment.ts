// تحميل متغيرات البيئة من ملف .env
import dotenv from 'dotenv';
if (typeof process !== 'undefined' && process.env) {
  dotenv.config({ path: '.env' });
}

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

  // Use import.meta.env in browser, process.env on server
  const nodeEnv = typeof window !== 'undefined'
    ? (import.meta?.env?.MODE || 'development')
    : (processEnv.NODE_ENV || 'development');

  // قراءة المنفذ من متغيرات البيئة بشكل تلقائي في المتصفح والخادم
  const getPortFromEnv = (): number => {
    if (typeof window !== 'undefined') {
      // في المتصفح - محاولة قراءة من مصادر متعددة
      const windowProcess = (window as any).process?.env;
      const importMetaEnv = import.meta?.env;
      
      // أولاً: محاولة قراءة من window.process.env
      if (windowProcess?.PORT) {
        return parseInt(windowProcess.PORT, 10);
      }
      
      // ثانياً: محاولة قراءة من import.meta.env
      if (importMetaEnv?.VITE_PORT) {
        return parseInt(importMetaEnv.VITE_PORT, 10);
      }
      
      // ثالثاً: استخدام القيمة الافتراضية
      return 5000;
    } else {
      // في الخادم - قراءة من process.env مباشرة
      return parseInt(processEnv.PORT || '5000', 10);
    }
  };

  const serverPort = getPortFromEnv();

  // تحسين اكتشاف Replit في المتصفح والخادم
  const isReplitBrowser = typeof window !== 'undefined' && window.location && (
    window.location.hostname.includes('replit.dev') ||
    window.location.hostname.includes('repl.co') ||
    window.location.hostname.includes('sisko.replit.dev') ||
    window.location.hostname.includes('pike.replit.dev') ||
    window.location.hostname.includes('worf.replit.dev')
  );

  const isReplitServer = !!(
    processEnv.REPL_ID ||
    processEnv.REPLIT_DB_URL ||
    processEnv.REPL_SLUG ||
    processEnv.REPLIT_CLUSTER ||
    processEnv.REPLIT_ENVIRONMENT ||
    (processEnv.HOSTNAME && processEnv.HOSTNAME.includes('replit'))
  );

  const isReplit = isReplitBrowser || isReplitServer;

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
      port: serverPort,
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
      // دعم شامل لجميع النطاقات الفرعية لـ Replit
      /^https:\/\/.*\.replit\.dev$/,
      /^https:\/\/.*\.repl\.co$/,
      /^http:\/\/.*\.replit\.dev$/,
      /^http:\/\/.*\.repl\.co$/,
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
      port: serverPort,
      hmr: {
        port: 24678,
        host: currentHost,
        protocol: 'wss'
      },
      websocket: {
        port: serverPort, // استخدام نفس منفذ الخادم
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
      port: serverPort,
      hmr: {
        port: 24678,
        host: 'localhost',
      },
      websocket: {
        port: parseInt(processEnv.WS_PORT || processEnv.PORT || '5000'),
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
    port: serverPort,
    hmr: {
      port: 24678,
      host: 'localhost',
    },
    websocket: {
      port: parseInt(processEnv.WS_PORT || processEnv.PORT || '5000'),
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

    // التحقق من صحة القيم مع fallback محسن
    if (!host || host === 'undefined' || host === 'null' || host.length === 0) {
      console.error('❌ Invalid hostname detected:', host);
      return protocol === 'wss:' ? 'wss://0.0.0.0:5000/ws' : 'ws://0.0.0.0:5000/ws';
    }

    // تحديد ما إذا كان هذا نطاق Replit أو مخصص
    const isReplitDomain = host.includes('replit.dev') || host.includes('repl.co');
    const isCustomDomain = host === 'panel.binarjoinanelytic.info';

    if (isReplitDomain) {
      // لنطاقات Replit، استخدم بدون منفذ (يستخدم المنفذ الافتراضي)
      // Replit يربط المنفذ المحلي بالمنفذ الخارجي تلقائياً
      const wsUrl = `${protocol}//${host}/ws`;
      console.log('🔗 Using Replit domain WebSocket URL:', wsUrl);
      return wsUrl;
    }

    if (isCustomDomain) {
      // للنطاق المخصص، استخدم بدون منفذ (يستخدم 443 افتراضياً)
      const wsUrl = `${protocol}//${host}/ws`;
      console.log('🔗 Using Custom domain WebSocket URL:', wsUrl);
      return wsUrl;
    }

    // للتطوير المحلي، استخدم المنفذ الافتراضي أو المحدد
    const currentPort = window.location.port;
    // استخدام منفذ ENV_CONFIG.websocket.port بدلاً من منفذ النافذة المحلي
    const wsPort = ENV_CONFIG.websocket.port || (protocol === 'wss:' ? '443' : '5000');
    const wsUrl = `${protocol}//${host}:${wsPort}/ws`;
    console.log('🏠 Using local WebSocket URL:', wsUrl);
    return wsUrl;
  }

  // في الخادم
  const protocol = ENV_CONFIG.websocket.protocol || 'ws';
  const host = ENV_CONFIG.websocket.host || '0.0.0.0';
  const port = ENV_CONFIG.websocket.port || 5000;

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

  // تشخيص أفضل للمشاكل
  const wsUrl = getWebSocketUrl();
  if (wsUrl.includes('undefined') || wsUrl.includes('NaN') || wsUrl.includes('null')) {
    console.error('❌ خطأ: WebSocket URL يحتوي على قيم غير صالحة!', wsUrl);
    console.error('❌ Environment Config Debug:', ENV_CONFIG);
  } else {
    console.log('✅ WebSocket URL صالح:', wsUrl);
  }

  if (typeof window !== 'undefined') {
    console.log(`🌐 Current URL: ${window.location.href}`);
    console.log(`🔒 Protocol: ${window.location.protocol}`);
    console.log(`🏠 Hostname: ${window.location.hostname}`);
    console.log(`🚪 Port: ${window.location.port || 'default'}`);

    // تشخيص اكتشاف Replit
    const isReplitDetected = window.location.hostname.includes('replit.dev') ||
                            window.location.hostname.includes('repl.co');
    console.log(`🔍 Replit Domain Detected: ${isReplitDetected}`);
  }

  // التحقق من توفر process.env (server-side only)
  if (typeof process !== 'undefined' && process.env) {
    console.log(`🔧 NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
    console.log(`🔧 PORT: ${process.env.PORT || 'undefined'}`);
    console.log(`🔧 REPL_ID: ${process.env.REPL_ID ? 'defined' : 'undefined'}`);
  } else if (typeof window !== 'undefined' && import.meta?.env) {
    console.log(`🔧 Browser MODE: ${import.meta.env.MODE || 'undefined'}`);
    console.log(`🔧 Vite DEV: ${import.meta.env.DEV ? 'true' : 'false'}`);
  }

  // معلومات إضافية للتشخيص
  console.log(`🔧 Environment: ${typeof window !== 'undefined' ? 'browser' : 'server'}`);
  console.log(`🔧 Process Available: ${typeof process !== 'undefined'}`);
  console.log(`🔧 Import.meta Available: ${typeof import.meta !== 'undefined'}`);
}