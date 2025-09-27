import { useCallback, useEffect, useRef } from 'react';
import { useErrorContext } from '@/contexts/ErrorContext';
import { errorLogger, ErrorSeverity } from '@/lib/errorLogger';

// Hook لتسجيل الأخطاء مع إدارة دورة الحياة
export function useErrorLogger(componentName?: string) {
  const errorContext = useErrorContext();
  const componentRef = useRef(componentName || 'UnknownComponent');

  // تحديث اسم المكون إذا تغير
  useEffect(() => {
    if (componentName) {
      componentRef.current = componentName;
    }
  }, [componentName]);

  // دالة لتسجيل الأخطاء العامة
  const logError = useCallback((message: string, error?: Error, severity: ErrorSeverity = 'medium') => {
    errorContext.logError(`[${componentRef.current}] ${message}`, error, componentRef.current);
  }, [errorContext]);

  // دالة لتسجيل أخطاء أفعال المستخدم
  const logUserAction = useCallback((action: string, error: Error, severity: ErrorSeverity = 'medium') => {
    errorContext.logUserAction(`${action} in ${componentRef.current}`, error, componentRef.current);
  }, [errorContext]);

  // دالة لتسجيل تفاعلات المستخدم الناجحة (للإحصائيات)
  const logUserInteraction = useCallback((action: string, data?: Record<string, any>) => {
    errorLogger.updateAppState({
      lastUserAction: {
        action,
        component: componentRef.current,
        timestamp: new Date().toISOString(),
        data
      }
    });
  }, []);

  // دالة آمنة لتنفيذ كود قد يؤدي إلى خطأ
  const safeExecute = useCallback(async <T>(
    fn: () => T | Promise<T>,
    errorMessage?: string,
    onError?: (error: Error) => void
  ): Promise<T | null> => {
    try {
      const result = await fn();
      return result;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logError(errorMessage || 'Execution failed', errorObj);
      
      if (onError) {
        try {
          onError(errorObj);
        } catch (handlerError) {
          logError('Error handler failed', handlerError instanceof Error ? handlerError : new Error(String(handlerError)));
        }
      }
      
      return null;
    }
  }, [logError]);

  // دالة لتغليف event handlers بتسجيل الأخطاء
  const wrapEventHandler = useCallback(<T extends (...args: any[]) => any>(
    handler: T,
    eventName?: string
  ): T => {
    return ((...args: any[]) => {
      return safeExecute(
        () => handler(...args),
        `Event handler failed: ${eventName || 'unknown event'}`,
        (error) => {
          logUserAction(eventName || 'unknown_event', error);
        }
      );
    }) as T;
  }, [safeExecute, logUserAction]);

  // دالة لتغليف async functions
  const wrapAsync = useCallback(<T extends (...args: any[]) => Promise<any>>(
    asyncFn: T,
    operationName?: string
  ): T => {
    return (async (...args: any[]) => {
      try {
        const result = await asyncFn(...args);
        return result;
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        logError(`Async operation failed: ${operationName || 'unknown operation'}`, errorObj);
        throw error; // Re-throw للسماح للمستدعي بمعالجة الخطأ
      }
    }) as T;
  }, [logError]);

  // دالة لتسجيل معلومات التشخيص
  const logDebugInfo = useCallback((info: Record<string, any>, message?: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 [${componentRef.current}] ${message || 'Debug Info'}:`, info);
    }
    
    errorLogger.updateAppState({
      [`debug_${componentRef.current}`]: {
        ...info,
        timestamp: new Date().toISOString()
      }
    });
  }, []);

  // تحديث حالة التطبيق عند تحميل المكون
  useEffect(() => {
    errorLogger.updateAppState({
      currentComponent: componentRef.current,
      componentLoadTime: new Date().toISOString()
    });

    // تنظيف عند إلغاء تحميل المكون
    return () => {
      errorLogger.updateAppState({
        lastComponent: componentRef.current,
        componentUnloadTime: new Date().toISOString()
      });
    };
  }, []);

  return {
    logError,
    logUserAction,
    logUserInteraction,
    logDebugInfo,
    safeExecute,
    wrapEventHandler,
    wrapAsync,
    reportError: errorContext.reportError,
    updateAppState: errorContext.updateAppState
  };
}

// Hook للحصول على إحصائيات الأخطاء
export function useErrorStats() {
  const stats = errorLogger.getStats();
  
  return {
    queueLength: stats.queueLength,
    sessionId: stats.sessionId,
    flushErrors: () => errorLogger.flushErrors()
  };
}

// Hook لمراقبة أداء العمليات
export function usePerformanceLogger(componentName?: string) {
  const { logDebugInfo } = useErrorLogger(componentName);

  const measurePerformance = useCallback((operationName: string, fn: () => void | Promise<void>) => {
    const startTime = performance.now();
    
    const cleanup = () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      logDebugInfo({
        operation: operationName,
        duration: `${duration.toFixed(2)}ms`,
        performance: {
          start: startTime,
          end: endTime,
          duration
        }
      }, `Performance: ${operationName}`);
      
      // تحذير إذا كانت العملية بطيئة
      if (duration > 1000) {
        console.warn(`⚠️ Slow operation detected: ${operationName} took ${duration.toFixed(2)}ms`);
      }
    };

    try {
      const result = fn();
      
      if (result instanceof Promise) {
        return result.finally(cleanup);
      } else {
        cleanup();
        return result;
      }
    } catch (error) {
      cleanup();
      throw error;
    }
  }, [logDebugInfo]);

  return { measurePerformance };
}

export default useErrorLogger;