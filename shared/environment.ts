
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
  const isReplit = !!(
    process.env.REPL_ID || 
    process.env.REPLIT_DB_URL || 
    process.env.REPL_SLUG ||
    typeof window !== 'undefined' && window.location.hostname.includes('replit.dev')
  );

  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';

  if (isReplit) {
    return {
      name: 'replit',
      isReplit: true,
      host: '0.0.0.0',
      port: parseInt(process.env.PORT || '6000'),
      hmr: {
        port: 24678,
        host: '0.0.0.0',
      },
      websocket: {
        port: parseInt(process.env.PORT || '6000'),
        host: '0.0.0.0',
        protocol: 'wss',
      },
      cors: {
        origin: [
          /^https:\/\/.*\.replit\.dev$/,
          /^https:\/\/.*\.repl\.co$/,
          'https://replit.com',
          ...(isDevelopment ? [
            'http://localhost:3000',
            'http://localhost:5173',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:5173'
          ] : [])
        ],
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
      port: parseInt(process.env.PORT || '3000'),
      hmr: {
        port: 24678,
        host: 'localhost',
      },
      websocket: {
        port: parseInt(process.env.WS_PORT || process.env.PORT || '3000'),
        host: '0.0.0.0',
        protocol: 'wss',
      },
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://yourdomain.com'],
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
    port: parseInt(process.env.PORT || '3000'),
    hmr: {
      port: 24678,
      host: 'localhost',
    },
    websocket: {
      port: parseInt(process.env.WS_PORT || '8080'),
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
    // في المتصفح
    if (ENV_CONFIG.isReplit) {
      return window.location.origin;
    }
    return `${window.location.protocol}//${window.location.host}`;
  }
  
  // في الخادم
  const protocol = ENV_CONFIG.name === 'production' ? 'https' : 'http';
  return `${protocol}://${ENV_CONFIG.host}:${ENV_CONFIG.port}`;
}

export function getWebSocketUrl(): string {
  if (typeof window !== 'undefined') {
    // في المتصفح
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  }
  
  // في الخادم
  return `${ENV_CONFIG.websocket.protocol}://${ENV_CONFIG.websocket.host}:${ENV_CONFIG.websocket.port}/ws`;
}

export function logEnvironmentInfo(): void {
  console.log('🌍 Environment Configuration:');
  console.log(`📍 Environment: ${ENV_CONFIG.name}`);
  console.log(`🔧 Replit: ${ENV_CONFIG.isReplit}`);
  console.log(`🌐 Host: ${ENV_CONFIG.host}:${ENV_CONFIG.port}`);
  console.log(`⚡ HMR: ${ENV_CONFIG.hmr.host}:${ENV_CONFIG.hmr.port}`);
  console.log(`🔌 WebSocket: ${ENV_CONFIG.websocket.protocol}://${ENV_CONFIG.websocket.host}:${ENV_CONFIG.websocket.port}`);
  console.log(`🔐 CORS Origins:`, ENV_CONFIG.cors.origin);
}
