import { nanoid } from 'nanoid';

// أنواع الأخطاء المختلفة
export type ErrorType = 'javascript' | 'react' | 'network' | 'navigation' | 'user_action' | 'component';
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

// واجهة بيانات الخطأ
export interface ErrorData {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  stack?: string;
  url: string;
  component?: string;
  action?: string;
  userAgent: string;
  browserInfo: BrowserInfo;
  appState?: Record<string, any>;
  errorBoundary?: boolean;
  sessionId: string;
  timestamp: Date;
}

// معلومات المتصفح
export interface BrowserInfo {
  userAgent: string;
  language: string;
  platform: string;
  cookieEnabled: boolean;
  onLine: boolean;
  screen: {
    width: number;
    height: number;
    colorDepth: number;
  };
  viewport: {
    width: number;
    height: number;
  };
}

// إعدادات خدمة تسجيل الأخطاء
export interface ErrorLoggerConfig {
  apiEndpoint: string;
  maxRetries: number;
  retryDelay: number;
  enableConsoleLogging: boolean;
  enableLocalStorage: boolean;
  maxLocalStorageEntries: number;
  enableBatchSending: boolean;
  batchSize: number;
  batchTimeout: number;
}

class ErrorLogger {
  private config: ErrorLoggerConfig;
  private sessionId: string;
  private errorQueue: ErrorData[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private initialized = false;
  private currentAppState: Record<string, any> = {};

  constructor(config: Partial<ErrorLoggerConfig> = {}) {
    this.config = {
      apiEndpoint: '/api/frontend-errors',
      maxRetries: 3,
      retryDelay: 1000,
      enableConsoleLogging: true,
      enableLocalStorage: true,
      maxLocalStorageEntries: 100,
      enableBatchSending: true,
      batchSize: 10,
      batchTimeout: 5000,
      ...config
    };

    this.sessionId = this.generateSessionId();
    this.init();
  }

  private generateSessionId(): string {
    return `session_${nanoid()}_${Date.now()}`;
  }

  private init(): void {
    if (this.initialized || typeof window === 'undefined') {
      return;
    }

    try {
      // تسجيل أخطاء JavaScript العامة
      window.addEventListener('error', this.handleWindowError.bind(this));

      // تسجيل أخطاء Promise غير المعالجة
      window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));

      // تسجيل أخطاء التنقل
      this.setupNavigationErrorHandling();

      // تسجيل أخطاء الشبكة
      this.setupNetworkErrorHandling();

      // استعادة الأخطاء من localStorage
      this.restoreFromLocalStorage();

      this.initialized = true;

      if (this.config.enableConsoleLogging) {
        console.log('🔍 ErrorLogger initialized successfully');
      }
    } catch (error) {
      console.error('Failed to initialize ErrorLogger:', error);
    }
  }

  private handleWindowError(event: ErrorEvent): void {
    const errorData: ErrorData = {
      type: 'javascript',
      severity: 'high',
      message: event.message || 'Unknown JavaScript error',
      stack: event.error?.stack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      browserInfo: this.getBrowserInfo(),
      appState: this.getCurrentAppState(),
      sessionId: this.sessionId,
      timestamp: new Date()
    };

    this.logError(errorData);
  }

  private handleUnhandledRejection(event: PromiseRejectionEvent): void {
    const errorData: ErrorData = {
      type: 'javascript',
      severity: 'high',
      message: `Unhandled Promise Rejection: ${event.reason}`,
      stack: event.reason?.stack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      browserInfo: this.getBrowserInfo(),
      appState: this.getCurrentAppState(),
      sessionId: this.sessionId,
      timestamp: new Date()
    };

    this.logError(errorData);
  }

  private setupNavigationErrorHandling(): void {
    // تسجيل أخطاء التنقل
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = (...args) => {
      try {
        originalPushState.apply(history, args);
      } catch (error) {
        this.logNavigationError('pushState', error as Error);
      }
    };

    history.replaceState = (...args) => {
      try {
        originalReplaceState.apply(history, args);
      } catch (error) {
        this.logNavigationError('replaceState', error as Error);
      }
    };

    window.addEventListener('popstate', (event) => {
      try {
        // يمكن إضافة معالجة إضافية هنا
      } catch (error) {
        this.logNavigationError('popstate', error as Error);
      }
    });
  }

  private setupNetworkErrorHandling(): void {
    // معالجة أخطاء fetch
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        
        // تسجيل الاستجابات غير الناجحة
        if (!response.ok) {
          this.logNetworkError('fetch', args[0] as string, response.status, response.statusText);
        }
        
        return response;
      } catch (error) {
        this.logNetworkError('fetch', args[0] as string, 0, (error as Error).message);
        throw error;
      }
    };

    // معالجة أخطاء XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(...args) {
      this.addEventListener('error', () => {
        errorLogger.logNetworkError('xhr', args[1] as string, this.status, this.statusText);
      });

      this.addEventListener('timeout', () => {
        errorLogger.logNetworkError('xhr', args[1] as string, 0, 'Request timeout');
      });

      return originalXHROpen.apply(this, args);
    };
  }

  private logNavigationError(action: string, error: Error): void {
    const errorData: ErrorData = {
      type: 'navigation',
      severity: 'medium',
      message: `Navigation error in ${action}: ${error.message}`,
      stack: error.stack,
      url: window.location.href,
      action,
      userAgent: navigator.userAgent,
      browserInfo: this.getBrowserInfo(),
      appState: this.getCurrentAppState(),
      sessionId: this.sessionId,
      timestamp: new Date()
    };

    this.logError(errorData);
  }

  private logNetworkError(type: string, url: string, status: number, message: string): void {
    const errorData: ErrorData = {
      type: 'network',
      severity: status >= 500 ? 'high' : 'medium',
      message: `Network error (${type}): ${status} ${message} for ${url}`,
      url: window.location.href,
      action: `${type}_request`,
      userAgent: navigator.userAgent,
      browserInfo: this.getBrowserInfo(),
      appState: {
        ...this.getCurrentAppState(),
        requestUrl: url,
        statusCode: status
      },
      sessionId: this.sessionId,
      timestamp: new Date()
    };

    this.logError(errorData);
  }

  // تسجيل أخطاء React Components
  public logReactError(error: Error, errorInfo: any, componentName?: string): void {
    const errorData: ErrorData = {
      type: 'react',
      severity: 'high',
      message: `React Component Error: ${error.message}`,
      stack: error.stack,
      url: window.location.href,
      component: componentName,
      errorBoundary: true,
      userAgent: navigator.userAgent,
      browserInfo: this.getBrowserInfo(),
      appState: {
        ...this.getCurrentAppState(),
        componentStack: errorInfo.componentStack,
        errorBoundary: true
      },
      sessionId: this.sessionId,
      timestamp: new Date()
    };

    this.logError(errorData);
  }

  // تسجيل أخطاء أفعال المستخدم (مثل نقرات الأزرار الفاشلة)
  public logUserActionError(action: string, error: Error, component?: string, severity: ErrorSeverity = 'medium'): void {
    const errorData: ErrorData = {
      type: 'user_action',
      severity,
      message: `User action error in ${action}: ${error.message}`,
      stack: error.stack,
      url: window.location.href,
      component,
      action,
      userAgent: navigator.userAgent,
      browserInfo: this.getBrowserInfo(),
      appState: this.getCurrentAppState(),
      sessionId: this.sessionId,
      timestamp: new Date()
    };

    this.logError(errorData);
  }

  // تسجيل أخطاء عامة للمكونات
  public logComponentError(message: string, component: string, error?: Error, severity: ErrorSeverity = 'medium'): void {
    const errorData: ErrorData = {
      type: 'component',
      severity,
      message: `Component error in ${component}: ${message}`,
      stack: error?.stack,
      url: window.location.href,
      component,
      userAgent: navigator.userAgent,
      browserInfo: this.getBrowserInfo(),
      appState: this.getCurrentAppState(),
      sessionId: this.sessionId,
      timestamp: new Date()
    };

    this.logError(errorData);
  }

  // تحديث حالة التطبيق
  public updateAppState(newState: Record<string, any>): void {
    this.currentAppState = { ...this.currentAppState, ...newState };
  }

  // إزالة مفاتيح من حالة التطبيق
  public removeFromAppState(keys: string[]): void {
    keys.forEach(key => {
      delete this.currentAppState[key];
    });
  }

  private getCurrentAppState(): Record<string, any> {
    return {
      ...this.currentAppState,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      online: navigator.onLine
    };
  }

  private getBrowserInfo(): BrowserInfo {
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    };
  }

  private logError(errorData: ErrorData): void {
    try {
      if (this.config.enableConsoleLogging) {
        console.error(`🚨 [ErrorLogger] ${errorData.type}:`, errorData.message, errorData);
      }

      // إضافة إلى طابور الأخطاء
      this.errorQueue.push(errorData);

      // حفظ في localStorage
      if (this.config.enableLocalStorage) {
        this.saveToLocalStorage(errorData);
      }

      // إرسال فوري أو مجمع
      if (this.config.enableBatchSending) {
        this.scheduleBatchSend();
      } else {
        this.sendError(errorData);
      }
    } catch (error) {
      console.error('Failed to log error:', error);
    }
  }

  private scheduleBatchSend(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    if (this.errorQueue.length >= this.config.batchSize) {
      this.sendBatch();
    } else {
      this.batchTimer = setTimeout(() => {
        this.sendBatch();
      }, this.config.batchTimeout);
    }
  }

  private async sendBatch(): void {
    if (this.errorQueue.length === 0) return;

    const batch = [...this.errorQueue];
    this.errorQueue = [];

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    try {
      await this.sendToAPI('/api/frontend-errors/batch', batch);
    } catch (error) {
      console.error('Failed to send error batch:', error);
      // إعادة الأخطاء إلى الطابور للمحاولة مرة أخرى
      this.errorQueue.unshift(...batch);
    }
  }

  private async sendError(errorData: ErrorData, retryCount = 0): Promise<void> {
    try {
      await this.sendToAPI(this.config.apiEndpoint, errorData);
    } catch (error) {
      if (retryCount < this.config.maxRetries) {
        setTimeout(() => {
          this.sendError(errorData, retryCount + 1);
        }, this.config.retryDelay * Math.pow(2, retryCount));
      } else {
        console.error('Failed to send error after max retries:', error);
      }
    }
  }

  private async sendToAPI(endpoint: string, data: ErrorData | ErrorData[]): Promise<void> {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  private saveToLocalStorage(errorData: ErrorData): void {
    try {
      const key = 'errorLogger_errors';
      const stored = localStorage.getItem(key);
      const errors: ErrorData[] = stored ? JSON.parse(stored) : [];
      
      errors.push(errorData);
      
      // حذف الأخطاء القديمة
      if (errors.length > this.config.maxLocalStorageEntries) {
        errors.splice(0, errors.length - this.config.maxLocalStorageEntries);
      }
      
      localStorage.setItem(key, JSON.stringify(errors));
    } catch (error) {
      console.error('Failed to save error to localStorage:', error);
    }
  }

  private restoreFromLocalStorage(): void {
    try {
      const key = 'errorLogger_errors';
      const stored = localStorage.getItem(key);
      
      if (stored) {
        const errors: ErrorData[] = JSON.parse(stored);
        // إرسال الأخطاء المحفوظة مسبقاً
        errors.forEach(error => this.errorQueue.push(error));
        
        // تنظيف localStorage
        localStorage.removeItem(key);
        
        if (this.config.enableConsoleLogging) {
          console.log(`🔄 Restored ${errors.length} errors from localStorage`);
        }
      }
    } catch (error) {
      console.error('Failed to restore errors from localStorage:', error);
    }
  }

  // إرسال فوري لجميع الأخطاء المعلقة
  public async flushErrors(): Promise<void> {
    if (this.errorQueue.length > 0) {
      await this.sendBatch();
    }
  }

  // إحصائيات
  public getStats(): { queueLength: number; sessionId: string } {
    return {
      queueLength: this.errorQueue.length,
      sessionId: this.sessionId
    };
  }
}

// إنشاء instance واحد مشترك
export const errorLogger = new ErrorLogger();

// تصدير كلاس للاستخدام المتقدم
export { ErrorLogger };

// دالات مساعدة للاستخدام السريع
export const logError = (message: string, error?: Error, component?: string) => {
  errorLogger.logComponentError(message, component || 'Unknown', error);
};

export const logUserAction = (action: string, error: Error, component?: string) => {
  errorLogger.logUserActionError(action, error, component);
};

export const logReactError = (error: Error, errorInfo: any, componentName?: string) => {
  errorLogger.logReactError(error, errorInfo, componentName);
};

export const updateAppState = (state: Record<string, any>) => {
  errorLogger.updateAppState(state);
};