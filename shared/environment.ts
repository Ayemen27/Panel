
// ملاحظة: تحميل متغيرات البيئة يجب أن يتم في ملفات الخادم، ليس هنا

// Type declarations for server-side compatibility
declare global {
  namespace NodeJS {
    interface Global {
      window?: any;
      navigator?: any;
      WebSocket?: any;
    }
  }
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
  paths: {
    root: string;
    logs: string;
    uploads: string;
    config: string;
    ssl: string;
    nginx: string;
    pm2: string;
  };
}

// دالة ذكية لاكتشاف البيئة من جانب الخادم
function detectServerEnvironment(): {
  isReplit: boolean;
  isProduction: boolean;
  isDevelopment: boolean;
  isCustomDomain: boolean;
  serverType: 'replit' | 'external' | 'local';
} {
  const processEnv = (typeof process !== 'undefined' && process.env) ? process.env : {};
  
  // اكتشاف Replit من متغيرات البيئة المختلفة
  const replitIndicators = [
    'REPL_ID',
    'REPLIT_DB_URL', 
    'REPL_SLUG',
    'REPLIT_CLUSTER',
    'REPLIT_ENVIRONMENT',
    'REPLIT_URL'
  ];
  
  const isReplitServer = replitIndicators.some(indicator => processEnv[indicator]);
  
  // اكتشاف إضافي من hostname
  const hostname = processEnv.HOSTNAME || '';
  const isReplitByHostname = hostname.includes('replit') || hostname.includes('nix');
  
  // اكتشاف السيرفر الخارجي من IP أو hostname
  const isExternalServer = hostname.includes('93.127.142.144') || 
                          processEnv.EXTERNAL_SERVER === 'true' ||
                          processEnv.SERVER_TYPE === 'external';
  
  const nodeEnv = processEnv.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const isDevelopment = nodeEnv === 'development';
  
  // اكتشاف النطاق المخصص
  const isCustomDomain = processEnv.CUSTOM_DOMAIN === 'true' ||
                        processEnv.DOMAIN === 'panel.binarjoinanelytic.info';
  
  let serverType: 'replit' | 'external' | 'local' = 'local';
  
  if (isReplitServer || isReplitByHostname) {
    serverType = 'replit';
  } else if (isExternalServer || isCustomDomain) {
    serverType = 'external';
  }
  
  return {
    isReplit: isReplitServer || isReplitByHostname,
    isProduction,
    isDevelopment,
    isCustomDomain,
    serverType
  };
}

// دالة لتحديد المسارات حسب البيئة
function getEnvironmentPaths(serverType: 'replit' | 'external' | 'local'): EnvironmentConfig['paths'] {
  const basePaths = {
    replit: {
      root: '/home/runner',
      logs: '/home/runner/logs',
      uploads: '/home/runner/uploads',
      config: '/home/runner/.config',
      ssl: '/home/runner/ssl',
      nginx: '/etc/nginx',
      pm2: '/home/runner/.pm2'
    },
    external: {
      root: '/home/administrator',
      logs: '/var/log',
      uploads: '/home/administrator/uploads',
      config: '/home/administrator/.config',
      ssl: '/etc/ssl',
      nginx: '/etc/nginx',
      pm2: '/home/administrator/.pm2'
    },
    local: {
      root: (() => {
        try {
          return typeof process !== 'undefined' && 
                 process.cwd && 
                 typeof process.cwd === 'function' && 
                 typeof window === 'undefined' ? process.cwd() : '.';
        } catch {
          return '.';
        }
      })(),
      logs: './logs',
      uploads: './uploads',
      config: './.config',
      ssl: './ssl',
      nginx: '/usr/local/etc/nginx',
      pm2: './pm2'
    }
  };
  
  return basePaths[serverType];
}

export function detectEnvironment(): EnvironmentConfig {
  // Safe process access for browser/server compatibility
  const processEnv = (typeof process !== 'undefined' && process.env) ? process.env : {};

  // Use import.meta.env in browser, process.env on server
  // Use simple environment detection - avoid import.meta on server
  const nodeEnv = typeof window !== 'undefined'
    ? 'development' // Browser environment - will be set by Vite
    : (processEnv.NODE_ENV || 'development');

  // قراءة المنفذ من متغيرات البيئة بشكل تلقائي في المتصفح والخادم
  const getPortFromEnv = (): number => {
    if (typeof window !== 'undefined') {
      // في المتصفح - محاولة قراءة من مصادر متعددة
      const windowProcess = (window as any).process?.env;
      // In browser, environment variables are injected by Vite
      // Check for common Vite environment variables in window object
      const viteEnv = (window as any).__VITE_ENV__ || {};
      const importMetaEnv = viteEnv;
      
      // أولاً: محاولة قراءة من window.process.env
      if (windowProcess?.PORT) {
        return parseInt(windowProcess.PORT, 10);
      }
      
      // ثانياً: محاولة قراءة من import.meta.env
      if (importMetaEnv && (importMetaEnv as any).VITE_PORT) {
        return parseInt((importMetaEnv as any).VITE_PORT, 10);
      }
      
      // ثالثاً: استخدام القيمة الافتراضية
      return 5000;
    } else {
      // في الخادم - قراءة من process.env مباشرة
      return parseInt(processEnv.PORT || '5000', 10);
    }
  };

  // قراءة منفذ WebSocket من متغيرات البيئة
  const getWSPortFromEnv = (): number => {
    if (typeof window !== 'undefined') {
      const windowProcess = (window as any).process?.env;
      // In browser, environment variables are injected by Vite
      // Check for common Vite environment variables in window object
      const viteEnv = (window as any).__VITE_ENV__ || {};
      const importMetaEnv = viteEnv;
      
      if (windowProcess?.WS_PORT) {
        return parseInt(windowProcess.WS_PORT, 10);
      }
      
      if (importMetaEnv && (importMetaEnv as any).WS_PORT) {
        return parseInt((importMetaEnv as any).WS_PORT, 10);
      }
      
      return 5000; // استخدام نفس منفذ HTTP server
    } else {
      return parseInt(processEnv.WS_PORT || processEnv.PORT || '5000', 10);
    }
  };

  // قراءة منفذ HMR من متغيرات البيئة
  const getHMRPortFromEnv = (): number => {
    if (typeof window !== 'undefined') {
      const windowProcess = (window as any).process?.env;
      // In browser, environment variables are injected by Vite
      // Check for common Vite environment variables in window object
      const viteEnv = (window as any).__VITE_ENV__ || {};
      const importMetaEnv = viteEnv;
      
      if (windowProcess?.HMR_PORT) {
        return parseInt(windowProcess.HMR_PORT, 10);
      }
      
      if (importMetaEnv && (importMetaEnv as any).HMR_PORT) {
        return parseInt((importMetaEnv as any).HMR_PORT, 10);
      }
      
      return 24678;
    } else {
      return parseInt(processEnv.HMR_PORT || '24678', 10);
    }
  };

  const serverPort = getPortFromEnv();
  const wsPort = getWSPortFromEnv();
  const hmrPort = getHMRPortFromEnv();

  // اكتشاف البيئة من جانب المتصفح
  const isReplitBrowser = typeof window !== 'undefined' && window.location && (
    window.location.hostname.includes('replit.dev') ||
    window.location.hostname.includes('repl.co') ||
    window.location.hostname.includes('sisko.replit.dev') ||
    window.location.hostname.includes('pike.replit.dev') ||
    window.location.hostname.includes('worf.replit.dev')
  );

  // اكتشاف البيئة من جانب الخادم (أكثر دقة)
  const serverEnvDetection = typeof window === 'undefined' ? detectServerEnvironment() : null;
  
  const isReplitServer = serverEnvDetection?.isReplit || !!(
    processEnv.REPL_ID ||
    processEnv.REPLIT_DB_URL ||
    processEnv.REPL_SLUG ||
    processEnv.REPLIT_CLUSTER ||
    processEnv.REPLIT_ENVIRONMENT ||
    (processEnv.HOSTNAME && processEnv.HOSTNAME.includes('replit'))
  );

  const isReplit = isReplitBrowser || isReplitServer;

  // اكتشاف النطاق المخصص - إضافة دعم أكثر شمولية
  const isCustomDomain = (typeof window !== 'undefined' &&
    (window.location.hostname === 'panel.binarjoinanelytic.info' ||
     window.location.hostname.includes('binarjoinanelytic.info'))) ||
    (serverEnvDetection?.isCustomDomain) ||
    (processEnv.CUSTOM_DOMAIN === 'true') ||
    (processEnv.DOMAIN?.includes('binarjoinanelytic.info'));

  const isDevelopment = nodeEnv === 'development';
  const isProduction = nodeEnv === 'production';

  // تحديد نوع السيرفر والمسارات
  const serverType = serverEnvDetection?.serverType || 
    (isReplit ? 'replit' : (isCustomDomain ? 'external' : 'local'));
  
  const paths = getEnvironmentPaths(serverType);

  // إذا كان النطاق المخصص، استخدم إعدادات الإنتاج
  if (isCustomDomain) {
    return {
      name: 'production',
      isReplit: false,
      host: '0.0.0.0',
      port: serverPort,
      hmr: {
        port: 443, // HTTPS port للنطاق المخصص
        host: 'panel.binarjoinanelytic.info',
        protocol: 'wss'
      },
      websocket: {
        port: 443, // HTTPS port للنطاق المخصص
        host: 'panel.binarjoinanelytic.info',
        protocol: 'wss',
      },
      cors: {
        origin: [
          'https://panel.binarjoinanelytic.info',
          'http://panel.binarjoinanelytic.info',
          'https://binarjoinanelytic.info',
          'http://binarjoinanelytic.info',
          /^https:\/\/.*\.binarjoinanelytic\.info$/,
          /^http:\/\/.*\.binarjoinanelytic\.info$/,
        ],
        credentials: true,
      },
      database: {
        ssl: true,
        connectionPooling: true,
      },
      paths
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
        port: hmrPort,
        host: currentHost,
        protocol: 'wss'
      },
      websocket: {
        port: serverPort, // استخدام نفس منفذ HTTP server
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
      paths
    };
  }

  if (isProduction) {
    return {
      name: 'production',
      isReplit: false,
      host: '0.0.0.0',
      port: serverPort,
      hmr: {
        port: hmrPort,
        host: 'localhost',
      },
      websocket: {
        port: wsPort,
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
      paths
    };
  }

  // Development environment
  return {
    name: 'development',
    isReplit: false,
    host: 'localhost',
    port: serverPort,
    hmr: {
      port: hmrPort,
      host: 'localhost',
    },
    websocket: {
      port: wsPort,
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
    paths
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

// Helper function to validate WebSocket URL
function validateWebSocketUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const validProtocols = ['ws:', 'wss:'];
    return validProtocols.includes(urlObj.protocol) && 
           urlObj.hostname !== '' && 
           urlObj.hostname !== 'undefined' && 
           urlObj.hostname !== 'null';
  } catch {
    return false;
  }
}

// Helper function to get fallback URLs in order of preference
function getFallbackUrls(originalHost: string, originalProtocol: string): string[] {
  const fallbacks: string[] = [];
  
  // Try different port configurations
  const ports = originalProtocol === 'wss:' ? ['', ':443', ':5001', ':5000'] : [':5001', ':5000', ':6000', ''];
  
  ports.forEach(port => {
    fallbacks.push(`${originalProtocol}//${originalHost}${port}/ws`);
  });
  
  // If original host fails, try localhost as last resort (for development)
  if (originalHost !== 'localhost' && originalHost !== '127.0.0.1') {
    const localhostProtocol = originalProtocol === 'wss:' ? 'ws:' : originalProtocol;
    fallbacks.push(`${localhostProtocol}//localhost:5001/ws`);
    fallbacks.push(`${localhostProtocol}//127.0.0.1:5001/ws`);
  }
  
  return fallbacks;
}

export function getWebSocketUrl(token?: string): string {
  if (typeof window !== 'undefined') {
    // في المتصفح - استخدم الهوست الحالي مع البروتوكول المناسب
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = window.location.port;

    // التحقق من صحة القيم الأساسية
    if (!host || host === 'undefined' || host === 'null' || host.length === 0) {
      console.error('❌ Invalid hostname detected:', host);
      console.error('❌ Window location:', window.location);
      
      // محاولة استخدام fallback ذكي
      const fallbackUrl = protocol === 'wss:' ? 'wss://localhost:5001/ws' : 'ws://localhost:5001/ws';
      console.warn('🔄 Using emergency fallback URL:', fallbackUrl);
      return fallbackUrl;
    }

    // تحديد نوع النطاق مع تحسينات
    const isReplitDomain = host.includes('replit.dev') || 
                          host.includes('repl.co') ||
                          host.includes('sisko.replit.dev') ||
                          host.includes('pike.replit.dev') ||
                          host.includes('worf.replit.dev');
                          
    const isCustomDomain = host === 'panel.binarjoinanelytic.info';
    const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.');

    let primaryUrl: string;
    
    if (isReplitDomain) {
      // لنطاقات Replit، استخدم منفذ الخادم الحالي
      const wsPort = window.location.port || (protocol === 'wss:' ? '443' : '80');
      primaryUrl = `${protocol}//${host}:${wsPort}/ws`;
      console.log('🔗 Using Replit domain WebSocket URL:', primaryUrl);
    } else if (isCustomDomain) {
      // للنطاق المخصص، استخدم بدون منفذ (يستخدم 443/80 افتراضياً)
      primaryUrl = `${protocol}//${host}/ws`;
      console.log('🔗 Using Custom domain WebSocket URL:', primaryUrl);
    } else if (isLocalhost) {
      // للتطوير المحلي، استخدم منفذ مخصص
      const wsPort = ENV_CONFIG.websocket.port || 5001;
      primaryUrl = `${protocol}//${host}:${wsPort}/ws`;
      console.log('🏠 Using localhost WebSocket URL:', primaryUrl);
    } else {
      // للحالات الأخرى، حاول استخدام المنفذ الحالي أو الافتراضي
      const wsPort = port || ENV_CONFIG.websocket.port || (protocol === 'wss:' ? 443 : 5001);
      primaryUrl = `${protocol}//${host}:${wsPort}/ws`;
      console.log('🌐 Using generic WebSocket URL:', primaryUrl);
    }

    // إضافة التوكن إذا كان متاحاً
    if (token) {
      const separator = primaryUrl.includes('?') ? '&' : '?';
      primaryUrl += `${separator}token=${encodeURIComponent(token)}`;
      console.log('🔑 Added token to WebSocket URL');
    }

    // التحقق من صحة URL الأساسي
    if (validateWebSocketUrl(primaryUrl)) {
      return primaryUrl;
    } else {
      console.error('❌ Primary WebSocket URL validation failed:', primaryUrl);
      
      // جرب URLs احتياطية
      const fallbackUrls = getFallbackUrls(host, protocol);
      
      for (const fallbackUrl of fallbackUrls) {
        if (validateWebSocketUrl(fallbackUrl)) {
          console.warn('🔄 Using fallback WebSocket URL:', fallbackUrl);
          return fallbackUrl;
        }
      }
      
      // إذا فشل كل شيء، استخدم URL طوارئ
      const emergencyUrl = protocol === 'wss:' ? 'wss://localhost:5001/ws' : 'ws://localhost:5001/ws';
      console.error('❌ All WebSocket URLs failed validation, using emergency URL:', emergencyUrl);
      return emergencyUrl;
    }
  }

  // في الخادم
  const protocol = ENV_CONFIG.websocket.protocol || 'ws';
  const host = ENV_CONFIG.websocket.host || '0.0.0.0';
  const port = ENV_CONFIG.websocket.port || 5001;

  const serverUrl = `${protocol}://${host}:${port}/ws`;
  
  // التحقق من صحة URL الخادم
  if (!validateWebSocketUrl(serverUrl)) {
    console.error('❌ Server WebSocket URL validation failed:', serverUrl);
    console.error('❌ ENV_CONFIG.websocket:', ENV_CONFIG.websocket);
  }
  
  return serverUrl;
}

// دالة للحصول على المسار الصحيح حسب البيئة
export function getPath(pathType: keyof EnvironmentConfig['paths']): string {
  return ENV_CONFIG.paths[pathType];
}

// دالة للتحقق من وجود مسار في البيئة الحالية
export function pathExists(pathType: keyof EnvironmentConfig['paths']): boolean {
  if (typeof window !== 'undefined') {
    // في المتصفح، لا يمكن التحقق من المسارات
    return false;
  }
  
  try {
    const fs = require('fs');
    const path = getPath(pathType);
    return fs.existsSync(path);
  } catch {
    return false;
  }
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

  // عرض المسارات المكتشفة
  console.log(`📁 Environment Paths:`);
  Object.entries(ENV_CONFIG.paths).forEach(([key, value]) => {
    const exists = pathExists(key as keyof EnvironmentConfig['paths']);
    console.log(`   ${key}: ${value} ${exists ? '✅' : '❓'}`);
  });

  // تشخيص محسن للمشاكل مع اختبار URL
  const wsUrl = getWebSocketUrl();
  const isValidUrl = validateWebSocketUrl(wsUrl);
  
  if (wsUrl.includes('undefined') || wsUrl.includes('NaN') || wsUrl.includes('null')) {
    console.error('❌ خطأ: WebSocket URL يحتوي على قيم غير صالحة!', wsUrl);
    console.error('❌ Environment Config Debug:', ENV_CONFIG);
  } else if (!isValidUrl) {
    console.error('❌ خطأ: WebSocket URL غير صالح!', wsUrl);
    console.error('❌ URL Validation Failed - checking fallbacks...');
    
    // اختبار URLs احتياطية
    if (typeof window !== 'undefined') {
      const fallbacks = getFallbackUrls(window.location.hostname, window.location.protocol === 'https:' ? 'wss:' : 'ws:');
      console.log('🔄 Available fallback URLs:');
      fallbacks.forEach((url, index) => {
        const isValid = validateWebSocketUrl(url);
        console.log(`   ${index + 1}. ${url} ${isValid ? '✅' : '❌'}`);
      });
    }
  } else {
    console.log('✅ WebSocket URL صالح:', wsUrl);
  }

  if (typeof window !== 'undefined') {
    console.log(`🌐 Current URL: ${window.location.href}`);
    console.log(`🔒 Protocol: ${window.location.protocol}`);
    console.log(`🏠 Hostname: ${window.location.hostname}`);
    console.log(`🚪 Port: ${window.location.port || 'default'}`);

    // تشخيص اكتشاف النطاقات المختلفة
    const isReplitDetected = window.location.hostname.includes('replit.dev') ||
                            window.location.hostname.includes('repl.co');
    const isLocalhostDetected = window.location.hostname === 'localhost' || 
                               window.location.hostname === '127.0.0.1' ||
                               window.location.hostname.startsWith('192.168.') ||
                               window.location.hostname.startsWith('10.');
    const isCustomDetected = window.location.hostname === 'panel.binarjoinanelytic.info';
    
    console.log(`🔍 Domain Type Analysis:`);
    console.log(`   - Replit Domain: ${isReplitDetected}`);
    console.log(`   - Custom Domain: ${isCustomDetected}`);
    console.log(`   - Localhost/Private: ${isLocalhostDetected}`);
    console.log(`   - Network Online: ${typeof navigator !== 'undefined' ? navigator.onLine : 'unknown'}`);
  }

  // التحقق من توفر process.env (server-side only)
  if (typeof process !== 'undefined' && process.env) {
    console.log(`🔧 NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
    console.log(`🔧 PORT: ${process.env.PORT || 'undefined'}`);
    console.log(`🔧 REPL_ID: ${process.env.REPL_ID ? 'defined' : 'undefined'}`);
    
    // معلومات اكتشاف البيئة على الخادم
    const serverDetection = detectServerEnvironment();
    console.log(`🔧 Server Type: ${serverDetection.serverType}`);
    console.log(`🔧 Is External Server: ${serverDetection.serverType === 'external'}`);
    console.log(`🔧 Custom Domain Detected: ${serverDetection.isCustomDomain}`);
  } else if (typeof window !== 'undefined') {
    // In browser, try to detect Vite environment
    const isDev = window.location.hostname === 'localhost' || window.location.hostname.includes('replit');
    console.log(`🔧 Browser MODE: ${isDev ? 'development' : 'production'}`);
    console.log(`🔧 Vite DEV: ${isDev ? 'true' : 'false'}`);
  }

  // معلومات إضافية للتشخيص
  console.log(`🔧 Environment: ${typeof window !== 'undefined' ? 'browser' : 'server'}`);
  console.log(`🔧 Process Available: ${typeof process !== 'undefined'}`);
  console.log(`🔧 Import.meta Available: ${typeof window !== 'undefined'}`);
  console.log(`🔧 WebSocket Constructor Available: ${typeof WebSocket !== 'undefined' || (typeof window !== 'undefined' && typeof (window as any).WebSocket !== 'undefined')}`);
}
