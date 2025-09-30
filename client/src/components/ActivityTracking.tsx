import { ComponentType, forwardRef, ReactNode, HTMLAttributes, FormHTMLAttributes, ButtonHTMLAttributes } from 'react';
import { usePageView, useButtonClick, useFormTracking, useUserAction, useElementInteraction } from '@/hooks/useActivityTracker';
import { useActivityContext } from '@/contexts/ActivityContext';
import { Button, ButtonProps } from '@/components/ui/button';

// Higher-Order Component لتغليف المكونات بتتبع تلقائي
export interface WithActivityTrackingOptions {
  trackClicks?: boolean;
  trackFocus?: boolean;
  trackHover?: boolean;
  trackVisibility?: boolean;
  elementId?: string;
  actionContext?: string;
  metadata?: Record<string, any>;
  excludeFromTracking?: boolean;
}

export function withActivityTracking<P extends object>(
  WrappedComponent: ComponentType<P>,
  options: WithActivityTrackingOptions = {}
) {
  const TrackedComponent = forwardRef<any, P & WithActivityTrackingOptions>((props, ref) => {
    const { isTracking } = useActivityContext();
    const { trackUserAction } = useUserAction(options.actionContext);
    
    const finalOptions = {
      trackClicks: true,
      trackFocus: false,
      trackHover: false,
      trackVisibility: false,
      ...options,
      ...props // السماح بتخصيص الخيارات لكل instance
    };

    const elementId = finalOptions.elementId || `tracked-${WrappedComponent.displayName || WrappedComponent.name || 'component'}`;
    
    const {
      trackClick,
      trackHover,
      trackFocus
    } = useElementInteraction(elementId, {
      trackClicks: finalOptions.trackClicks,
      trackHovers: finalOptions.trackHover,
      trackFocus: finalOptions.trackFocus,
      trackVisibility: finalOptions.trackVisibility,
      metadata: finalOptions.metadata
    });

    // إذا كان التتبع معطل أو مستبعد، ارجع المكون الأصلي
    if (!isTracking || finalOptions.excludeFromTracking) {
      return <WrappedComponent {...props} ref={ref} />;
    }

    // إضافة معالجات الأحداث للتتبع
    const enhancedProps = {
      ...props,
      onClick: (event: any) => {
        if (finalOptions.trackClicks) {
          trackClick(event, { componentName: WrappedComponent.displayName || WrappedComponent.name });
          trackUserAction('component_click', {
            componentName: WrappedComponent.displayName || WrappedComponent.name,
            elementId,
            ...finalOptions.metadata
          });
        }
        // استدعاء onClick الأصلي إذا وجد
        if (props.onClick) {
          (props as any).onClick(event);
        }
      },
      onMouseEnter: finalOptions.trackHover ? (event: any) => {
        trackHover(true, event);
        if (props.onMouseEnter) {
          (props as any).onMouseEnter(event);
        }
      } : props.onMouseEnter,
      onMouseLeave: finalOptions.trackHover ? (event: any) => {
        trackHover(false, event);
        if (props.onMouseLeave) {
          (props as any).onMouseLeave(event);
        }
      } : props.onMouseLeave,
      onFocus: finalOptions.trackFocus ? (event: any) => {
        trackFocus(true, event);
        if (props.onFocus) {
          (props as any).onFocus(event);
        }
      } : props.onFocus,
      onBlur: finalOptions.trackFocus ? (event: any) => {
        trackFocus(false, event);
        if (props.onBlur) {
          (props as any).onBlur(event);
        }
      } : props.onBlur,
      'data-tracked': true,
      'data-tracking-id': elementId
    };

    return <WrappedComponent {...enhancedProps} ref={ref} />;
  });

  TrackedComponent.displayName = `withActivityTracking(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return TrackedComponent;
}

// زر مع تتبع تلقائي
export interface TrackedButtonProps extends ButtonProps {
  trackingId?: string;
  trackingMetadata?: Record<string, any>;
  trackHover?: boolean;
  trackFocus?: boolean;
  actionContext?: string;
  children: ReactNode;
}

export const TrackedButton = forwardRef<HTMLButtonElement, TrackedButtonProps>(
  ({ 
    trackingId, 
    trackingMetadata, 
    trackHover = false, 
    trackFocus = false, 
    actionContext,
    children, 
    onClick, 
    onMouseEnter,
    onMouseLeave,
    onFocus,
    onBlur,
    disabled,
    ...props 
  }, ref) => {
    const { isTracking } = useActivityContext();
    
    const buttonId = trackingId || `button-${children?.toString().replace(/\s+/g, '-').toLowerCase()}`;
    
    const { trackClick, getClickProps } = useButtonClick(buttonId, {
      trackHover,
      trackFocus,
      includeCoordinates: true,
      metadata: {
        buttonText: children?.toString(),
        actionContext,
        disabled,
        ...trackingMetadata
      }
    });

    const { trackUserAction } = useUserAction(actionContext);

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (isTracking && !disabled) {
        trackClick(event, {
          buttonText: children?.toString(),
          clickType: 'button_click',
          ...trackingMetadata
        });
        
        trackUserAction('button_interaction', {
          buttonId,
          buttonText: children?.toString(),
          action: 'click',
          ...trackingMetadata
        });
      }
      
      // استدعاء onClick الأصلي
      if (onClick) {
        onClick(event);
      }
    };

    const clickProps = isTracking ? getClickProps(trackingMetadata) : {};

    return (
      <Button
        ref={ref}
        disabled={disabled}
        {...props}
        {...clickProps}
        onClick={handleClick}
        data-testid={props['data-testid'] || `button-${buttonId}`}
        data-tracked="true"
        data-tracking-id={buttonId}
      >
        {children}
      </Button>
    );
  }
);

TrackedButton.displayName = 'TrackedButton';

// نموذج مع تتبع تلقائي
export interface TrackedFormProps extends FormHTMLAttributes<HTMLFormElement> {
  formId?: string;
  trackingMetadata?: Record<string, any>;
  trackIndividualFields?: boolean;
  trackValidation?: boolean;
  excludeFields?: string[];
  sensitiveFields?: string[];
  onSubmitTracking?: boolean;
  actionContext?: string;
  children: ReactNode;
  onValidationError?: (field: string, error: string) => void;
}

export const TrackedForm = forwardRef<HTMLFormElement, TrackedFormProps>(
  ({
    formId,
    trackingMetadata,
    trackIndividualFields = true,
    trackValidation = true,
    excludeFields = [],
    sensitiveFields = ['password', 'creditCard', 'ssn'],
    onSubmitTracking = true,
    actionContext,
    children,
    onSubmit,
    onValidationError,
    ...props
  }, ref) => {
    const { isTracking } = useActivityContext();
    
    const finalFormId = formId || `form-${Date.now()}`;
    
    const {
      trackFormSubmit,
      trackValidationError,
      getFormProps,
      formData,
      fieldInteractions,
      validationErrors
    } = useFormTracking(finalFormId, {
      trackIndividualFields,
      trackValidation,
      excludeFields,
      sensitiveFields,
      onSubmitTracking,
      metadata: {
        actionContext,
        ...trackingMetadata
      }
    });

    const { trackUserAction } = useUserAction(actionContext);

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
      if (isTracking && onSubmitTracking) {
        const form = event.currentTarget;
        const formData = new FormData(form);
        const isValid = form.checkValidity();
        
        // جمع أخطاء التحقق إن وجدت
        const errors: Record<string, string> = {};
        const inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach((input) => {
          const element = input as HTMLInputElement;
          if (!element.validity.valid) {
            errors[element.name || element.id] = element.validationMessage;
          }
        });

        trackFormSubmit(event, isValid, errors);
        
        trackUserAction('form_submit', {
          formId: finalFormId,
          isValid,
          fieldCount: Array.from(formData.keys()).length,
          hasErrors: Object.keys(errors).length > 0,
          ...trackingMetadata
        });

        // إشعار بأخطاء التحقق
        if (!isValid && onValidationError) {
          Object.entries(errors).forEach(([field, error]) => {
            onValidationError(field, error);
            trackValidationError(field, error);
          });
        }
      }
      
      // استدعاء onSubmit الأصلي
      if (onSubmit) {
        onSubmit(event);
      }
    };

    const formProps = isTracking ? getFormProps() : {};

    return (
      <form
        ref={ref}
        id={finalFormId}
        {...props}
        {...formProps}
        onSubmit={handleSubmit}
        data-testid={props['data-testid'] || `form-${finalFormId}`}
        data-tracked="true"
        data-tracking-id={finalFormId}
        noValidate={props.noValidate}
      >
        {children}
      </form>
    );
  }
);

TrackedForm.displayName = 'TrackedForm';

// HOC لتتبع الصفحات تلقائياً
export interface WithPageTrackingOptions {
  pageName?: string;
  pageMetadata?: Record<string, any>;
  trackPageEvents?: boolean;
}

export function withPageTracking<P extends object>(
  WrappedComponent: ComponentType<P>,
  options: WithPageTrackingOptions = {}
) {
  const TrackedPageComponent = (props: P) => {
    const pageName = options.pageName || window.location.pathname;
    
    const { trackPageEvent } = usePageView(pageName, {
      componentName: WrappedComponent.displayName || WrappedComponent.name,
      ...options.pageMetadata
    });

    const { trackUserAction } = useUserAction('page');

    // تتبع تحميل الصفحة
    const enhancedProps = {
      ...props,
      onLoad: (event: any) => {
        if (options.trackPageEvents) {
          trackPageEvent('page_loaded', {
            componentName: WrappedComponent.displayName || WrappedComponent.name
          });
          
          trackUserAction('page_loaded', {
            pageName,
            componentName: WrappedComponent.displayName || WrappedComponent.name
          });
        }
        
        if ((props as any).onLoad) {
          (props as any).onLoad(event);
        }
      }
    };

    return <WrappedComponent {...enhancedProps} />;
  };

  TrackedPageComponent.displayName = `withPageTracking(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return TrackedPageComponent;
}

// مكون لتتبع التفاعل مع الأقسام
export interface TrackedSectionProps extends HTMLAttributes<HTMLDivElement> {
  sectionId: string;
  sectionName?: string;
  trackVisibility?: boolean;
  trackScrolling?: boolean;
  trackingMetadata?: Record<string, any>;
  children: ReactNode;
}

export const TrackedSection = forwardRef<HTMLDivElement, TrackedSectionProps>(
  ({
    sectionId,
    sectionName,
    trackVisibility = true,
    trackScrolling = false,
    trackingMetadata,
    children,
    ...props
  }, ref) => {
    const { isTracking } = useActivityContext();
    
    const { trackInteraction, isVisible } = useElementInteraction(sectionId, {
      trackVisibility,
      metadata: {
        sectionName: sectionName || sectionId,
        ...trackingMetadata
      }
    });

    const { trackUserAction } = useUserAction('section');

    // تتبع التفاعل مع القسم
    const handleSectionClick = (event: React.MouseEvent<HTMLDivElement>) => {
      if (isTracking) {
        trackInteraction('section_click', event, {
          sectionName: sectionName || sectionId
        });
        
        trackUserAction('section_interaction', {
          sectionId,
          sectionName: sectionName || sectionId,
          action: 'click',
          isVisible,
          ...trackingMetadata
        });
      }
      
      if (props.onClick) {
        props.onClick(event);
      }
    };

    return (
      <div
        ref={ref}
        id={sectionId}
        {...props}
        onClick={handleSectionClick}
        data-testid={props['data-testid'] || `section-${sectionId}`}
        data-tracked="true"
        data-tracking-id={sectionId}
        data-section-name={sectionName || sectionId}
        data-visible={isVisible}
      >
        {children}
      </div>
    );
  }
);

TrackedSection.displayName = 'TrackedSection';

// مكون لتتبع الروابط
export interface TrackedLinkProps extends HTMLAttributes<HTMLAnchorElement> {
  href: string;
  linkText?: string;
  linkCategory?: string;
  trackingMetadata?: Record<string, any>;
  external?: boolean;
  children: ReactNode;
}

export const TrackedLink = forwardRef<HTMLAnchorElement, TrackedLinkProps>(
  ({
    href,
    linkText,
    linkCategory = 'internal',
    trackingMetadata,
    external = false,
    children,
    onClick,
    ...props
  }, ref) => {
    const { isTracking } = useActivityContext();
    const { trackUserAction } = useUserAction('navigation');

    const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (isTracking) {
        trackUserAction('link_click', {
          href,
          linkText: linkText || children?.toString(),
          linkCategory,
          external,
          target: props.target,
          ...trackingMetadata
        });
      }
      
      if (onClick) {
        onClick(event);
      }
    };

    return (
      <a
        ref={ref}
        href={href}
        {...props}
        onClick={handleClick}
        data-testid={props['data-testid'] || `link-${href.replace(/[^a-zA-Z0-9]/g, '-')}`}
        data-tracked="true"
        data-tracking-category={linkCategory}
        data-external={external}
      >
        {children}
      </a>
    );
  }
);

TrackedLink.displayName = 'TrackedLink';

// Hook لتسهيل إضافة التتبع للمكونات الموجودة
export const useTrackingProps = (elementId: string, options?: {
  trackClicks?: boolean;
  trackHover?: boolean;
  trackFocus?: boolean;
  metadata?: Record<string, any>;
}) => {
  const { isTracking } = useActivityContext();
  const { trackUserAction } = useUserAction();
  
  const finalOptions = {
    trackClicks: true,
    trackHover: false,
    trackFocus: false,
    ...options
  };

  const trackingProps = isTracking ? {
    onClick: finalOptions.trackClicks ? (event: any) => {
      trackUserAction('element_click', {
        elementId,
        ...finalOptions.metadata
      });
    } : undefined,
    
    onMouseEnter: finalOptions.trackHover ? (event: any) => {
      trackUserAction('element_hover', {
        elementId,
        hoverType: 'enter',
        ...finalOptions.metadata
      });
    } : undefined,
    
    onMouseLeave: finalOptions.trackHover ? (event: any) => {
      trackUserAction('element_hover', {
        elementId,
        hoverType: 'leave',
        ...finalOptions.metadata
      });
    } : undefined,
    
    onFocus: finalOptions.trackFocus ? (event: any) => {
      trackUserAction('element_focus', {
        elementId,
        focusType: 'enter',
        ...finalOptions.metadata
      });
    } : undefined,
    
    onBlur: finalOptions.trackFocus ? (event: any) => {
      trackUserAction('element_focus', {
        elementId,
        focusType: 'leave',
        ...finalOptions.metadata
      });
    } : undefined,
    
    'data-tracked': true,
    'data-tracking-id': elementId
  } : {};

  return trackingProps;
};

// دالة مساعدة لحمل tracking props مع الحفاظ على الـ props الأصلية
export const mergeTrackingProps = (
  originalProps: any,
  trackingProps: any,
  options?: { preserveOriginal?: boolean }
) => {
  const { preserveOriginal = true } = options || {};
  
  const mergedProps = { ...originalProps };
  
  Object.keys(trackingProps).forEach(key => {
    if (key.startsWith('on') && preserveOriginal && originalProps[key]) {
      // دمج event handlers
      const originalHandler = originalProps[key];
      const trackingHandler = trackingProps[key];
      
      mergedProps[key] = (event: any) => {
        trackingHandler(event);
        originalHandler(event);
      };
    } else {
      mergedProps[key] = trackingProps[key];
    }
  });
  
  return mergedProps;
};

export default {
  withActivityTracking,
  withPageTracking,
  TrackedButton,
  TrackedForm,
  TrackedSection,
  TrackedLink,
  useTrackingProps,
  mergeTrackingProps
};