import { forwardRef, ButtonHTMLAttributes, ComponentType } from 'react';
import { Button } from '@/components/ui/button';
import { useErrorLogger } from '@/hooks/useErrorLogger';

// واجهة خصائص الزر مع معالجة الأخطاء
interface ErrorBoundaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  errorMessage?: string;
  onError?: (error: Error) => void;
  componentName?: string;
  action?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

// Higher-Order Component لتغليف الأزرار
export function withErrorBoundary<P extends object>(
  WrappedComponent: ComponentType<P>,
  defaultComponentName?: string
) {
  const WithErrorBoundaryComponent = forwardRef<HTMLButtonElement, P & ErrorBoundaryButtonProps>(
    (props, ref) => {
      const {
        onClick,
        onError,
        errorMessage,
        componentName,
        action,
        ...restProps
      } = props;

      const { logUserAction, wrapEventHandler, logUserInteraction } = useErrorLogger(
        componentName || defaultComponentName || 'Button'
      );

      // تغليف onClick بمعالجة الأخطاء
      const handleClick = wrapEventHandler(
        async (event: React.MouseEvent<HTMLButtonElement>) => {
          const actionName = action || restProps['data-testid'] || 'button_click';
          
          try {
            // تسجيل تفاعل المستخدم
            logUserInteraction(actionName, {
              target: event.currentTarget.tagName,
              disabled: restProps.disabled,
              variant: (restProps as any).variant,
              timestamp: new Date().toISOString()
            });

            // تنفيذ onClick الأصلي
            if (onClick) {
              await onClick(event);
            }
          } catch (error) {
            const errorObj = error instanceof Error ? error : new Error(String(error));
            
            // تسجيل خطأ فعل المستخدم
            logUserAction(actionName, errorObj);
            
            // استدعاء معالج الخطأ المخصص
            if (onError) {
              try {
                onError(errorObj);
              } catch (handlerError) {
                console.error('Error handler failed:', handlerError);
              }
            }
            
            // عدم رفع الخطأ مرة أخرى لتجنب كسر التطبيق
            console.error(`Button action failed: ${actionName}`, errorObj);
          }
        },
        action || 'click'
      );

      return (
        <WrappedComponent
          ref={ref}
          {...restProps}
          onClick={handleClick}
        />
      );
    }
  );

  WithErrorBoundaryComponent.displayName = `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return WithErrorBoundaryComponent;
}

// زر محمي بمعالجة الأخطاء (يستخدم shadcn Button)
export const ErrorBoundaryButton = withErrorBoundary(Button, 'ErrorBoundaryButton');

// مكون زر مخصص مع معالجة أخطاء محسنة
export const SafeButton = forwardRef<HTMLButtonElement, ErrorBoundaryButtonProps>(
  ({ 
    children, 
    onClick, 
    onError, 
    errorMessage, 
    componentName = 'SafeButton',
    action,
    disabled,
    className,
    ...props 
  }, ref) => {
    const { logUserAction, wrapEventHandler, logUserInteraction } = useErrorLogger(componentName);

    const handleClick = wrapEventHandler(
      async (event: React.MouseEvent<HTMLButtonElement>) => {
        const actionName = action || props['data-testid'] || 'safe_button_click';
        
        try {
          // منع النقر المتعدد
          if (disabled) {
            logUserInteraction('attempted_disabled_click', {
              actionName,
              disabled: true
            });
            return;
          }

          // تعطيل الزر مؤقتاً لمنع النقر المتعدد
          (event.currentTarget as HTMLButtonElement).disabled = true;

          logUserInteraction(actionName, {
            buttonText: typeof children === 'string' ? children : 'complex_content',
            timestamp: new Date().toISOString()
          });

          if (onClick) {
            await onClick(event);
          }
        } catch (error) {
          const errorObj = error instanceof Error ? error : new Error(String(error));
          
          logUserAction(actionName, errorObj);
          
          if (onError) {
            onError(errorObj);
          } else {
            // عرض رسالة خطأ افتراضية للمستخدم
            console.error(`Action failed: ${errorMessage || 'Operation could not be completed'}`, errorObj);
          }
        } finally {
          // إعادة تفعيل الزر
          setTimeout(() => {
            if (event.currentTarget) {
              (event.currentTarget as HTMLButtonElement).disabled = disabled || false;
            }
          }, 100);
        }
      },
      action || 'click'
    );

    return (
      <Button
        ref={ref}
        onClick={handleClick}
        disabled={disabled}
        className={className}
        {...props}
      >
        {children}
      </Button>
    );
  }
);

SafeButton.displayName = 'SafeButton';

// Hook لمعالجة الأخطاء في النماذج
export function useFormErrorHandling(formName: string) {
  const { logUserAction, logError, updateAppState } = useErrorLogger(`Form_${formName}`);

  const handleFormError = (error: Error, fieldName?: string) => {
    logUserAction(
      `form_error_${fieldName || 'unknown_field'}`,
      error
    );

    updateAppState({
      lastFormError: {
        form: formName,
        field: fieldName,
        error: error.message,
        timestamp: new Date().toISOString()
      }
    });
  };

  const handleSubmitError = (error: Error) => {
    logUserAction('form_submit', error);
  };

  const handleValidationError = (errors: Record<string, any>) => {
    const errorCount = Object.keys(errors).length;
    
    logError(`Form validation failed with ${errorCount} errors`, undefined, 'medium');
    
    updateAppState({
      lastValidationErrors: {
        form: formName,
        errors,
        count: errorCount,
        timestamp: new Date().toISOString()
      }
    });
  };

  return {
    handleFormError,
    handleSubmitError,
    handleValidationError
  };
}

export default ErrorBoundaryButton;