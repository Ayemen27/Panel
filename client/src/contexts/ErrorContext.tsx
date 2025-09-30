import { createContext, useContext, ReactNode, Component, ErrorInfo } from 'react';
import { errorLogger, logReactError, updateAppState } from '@/lib/errorLogger';

// واجهة السياق
interface ErrorContextValue {
  logError: (message: string, error?: Error, component?: string) => void;
  logUserAction: (action: string, error: Error, component?: string) => void;
  updateAppState: (state: Record<string, any>) => void;
  reportError: (error: Error, component?: string) => void;
}

// إنشاء السياق
const ErrorContext = createContext<ErrorContextValue | undefined>(undefined);

// Props لمزود السياق
interface ErrorProviderProps {
  children: ReactNode;
}

// Error Boundary Component
class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    console.error('Component stack:', errorInfo.componentStack);
    console.error('Error stack:', error.stack);

    // Log to console for debugging
    console.group('🚨 React Error Boundary');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('Component Stack:', errorInfo.componentStack);
    console.groupEnd();

    if (typeof window !== 'undefined' && window.errorLogger) {
      window.errorLogger.logReactError(error, errorInfo, 'ErrorBoundary');
    }
  }

  render() {
    if (this.state.hasError) {
      // يمكن تخصيص واجهة الخطأ هنا
      return this.props.fallback || (
        <div className="error-boundary-fallback min-h-screen flex items-center justify-center bg-background">
          <div className="max-w-md mx-auto text-center p-6">
            <div className="mb-4">
              <div className="w-16 h-16 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-destructive"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              حدث خطأ غير متوقع
            </h2>
            <p className="text-muted-foreground mb-4">
              لقد واجه التطبيق خطأاً. تم تسجيل تفاصيل الخطأ وسيتم إصلاحه قريباً.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: undefined });
                window.location.reload();
              }}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
              data-testid="error-boundary-reload"
            >
              إعادة تحميل الصفحة
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// مزود السياق
export function ErrorProvider({ children }: ErrorProviderProps) {
  // دالات السياق
  const logError = (message: string, error?: Error, component?: string) => {
    errorLogger.logComponentError(message, component || 'Unknown', error);
  };

  const logUserAction = (action: string, error: Error, component?: string) => {
    errorLogger.logUserActionError(action, error, component);
  };

  const updateAppStateValue = (state: Record<string, any>) => {
    errorLogger.updateAppState(state);
  };

  const reportError = (error: Error, component?: string) => {
    errorLogger.logComponentError(error.message, component || 'Manual Report', error, 'high');
  };

  const value: ErrorContextValue = {
    logError,
    logUserAction,
    updateAppState: updateAppStateValue,
    reportError
  };

  return (
    <ErrorContext.Provider value={value}>
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
    </ErrorContext.Provider>
  );
}

// Hook لاستخدام السياق
export function useErrorContext(): ErrorContextValue {
  const context = useContext(ErrorContext);
  if (context === undefined) {
    throw new Error('useErrorContext must be used within an ErrorProvider');
  }
  return context;
}

// تصدير العناصر المطلوبة
export { ErrorBoundary };
export default ErrorProvider;