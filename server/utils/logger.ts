import { storage } from '../storage';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';
export type LogSource = 'system' | 'api' | 'pm2' | 'nginx' | 'auth' | 'database' | 'ssl' | 'application';

export interface LogOptions {
  source?: LogSource;
  level?: LogLevel;
  applicationId?: string;
  metadata?: Record<string, any>;
  skipDatabase?: boolean; // لتجنب حلقة مفرغة عند تسجيل أخطاء قاعدة البيانات
}

class Logger {
  private formatMessage(level: LogLevel, source: LogSource, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] [${source}] ${message}`;
  }

  async log(message: string, options: LogOptions = {}): Promise<void> {
    const {
      source = 'system',
      level = 'info',
      applicationId,
      metadata,
      skipDatabase = false
    } = options;

    // دائماً اكتب إلى console للتطوير
    const formattedMessage = this.formatMessage(level, source, message);
    
    switch (level) {
      case 'error':
        console.error(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      case 'debug':
        console.debug(formattedMessage);
        break;
      default:
        console.log(formattedMessage);
    }

    // اكتب إلى قاعدة البيانات إذا لم يكن محظوراً
    if (!skipDatabase) {
      try {
        await storage.createSystemLog({
          source,
          level,
          message,
          applicationId,
          metadata: metadata ? JSON.stringify(metadata) : null,
          timestamp: new Date()
        });
      } catch (error) {
        // تجنب حلقة مفرغة - لا تسجل أخطاء قاعدة البيانات في قاعدة البيانات
        console.error(`Failed to save log to database: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  async info(message: string, source: LogSource = 'system', options?: Omit<LogOptions, 'level' | 'source'>): Promise<void> {
    return this.log(message, { ...options, level: 'info', source });
  }

  async warn(message: string, source: LogSource = 'system', options?: Omit<LogOptions, 'level' | 'source'>): Promise<void> {
    return this.log(message, { ...options, level: 'warn', source });
  }

  async error(message: string, source: LogSource = 'system', options?: Omit<LogOptions, 'level' | 'source'>): Promise<void> {
    return this.log(message, { ...options, level: 'error', source });
  }

  async debug(message: string, source: LogSource = 'system', options?: Omit<LogOptions, 'level' | 'source'>): Promise<void> {
    return this.log(message, { ...options, level: 'debug', source });
  }

  // وظائف خاصة للمصادر المختلفة
  async apiLog(message: string, level: LogLevel = 'info', metadata?: Record<string, any>): Promise<void> {
    return this.log(message, { level, source: 'api', metadata });
  }

  async apiError(message: string, error?: Error): Promise<void> {
    const metadata = error ? {
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack
    } : undefined;

    return this.log(message, { level: 'error', source: 'api', metadata });
  }

  async applicationLog(message: string, applicationId: string, level: LogLevel = 'info'): Promise<void> {
    return this.log(message, { level, source: 'application', applicationId });
  }

  async applicationError(message: string, applicationId: string, error?: Error): Promise<void> {
    const metadata = error ? {
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack
    } : undefined;

    return this.log(message, { level: 'error', source: 'application', applicationId, metadata });
  }

  async systemError(message: string, error?: Error): Promise<void> {
    const metadata = error ? {
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack
    } : undefined;

    return this.log(message, { level: 'error', source: 'system', metadata });
  }

  async authLog(message: string, level: LogLevel = 'info', userId?: string): Promise<void> {
    const metadata = userId ? { userId } : undefined;
    return this.log(message, { level, source: 'auth', metadata });
  }

  async databaseError(message: string, error?: Error): Promise<void> {
    const metadata = error ? {
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack
    } : undefined;

    // استخدم skipDatabase لتجنب حلقة مفرغة
    return this.log(message, { level: 'error', source: 'database', metadata, skipDatabase: true });
  }
}

export const logger = new Logger();

// وظائف مساعدة للاستخدام السريع
export const logInfo = (message: string, source?: LogSource) => logger.info(message, source);
export const logWarn = (message: string, source?: LogSource) => logger.warn(message, source);
export const logError = (message: string, source?: LogSource) => logger.error(message, source);
export const logDebug = (message: string, source?: LogSource) => logger.debug(message, source);