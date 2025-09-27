import { useEffect, useCallback, useRef, useState } from 'react';
import { useActivityContext, useCustomTracking } from '@/contexts/ActivityContext';
import { ActivityData } from '@/lib/userActivityTracker';

// Hook لتسجيل زيارة الصفحة
export const usePageView = (pageName?: string, metadata?: Record<string, any>) => {
  const { tracker, isTracking } = useActivityContext();
  const pageStartTimeRef = useRef<number>(Date.now());
  const pageNameRef = useRef<string>(pageName || window.location.pathname);

  useEffect(() => {
    if (!isTracking || !tracker) return;

    // تسجيل بداية زيارة الصفحة
    const currentPage = pageName || window.location.pathname;
    pageNameRef.current = currentPage;
    pageStartTimeRef.current = Date.now();

    tracker.trackActivity({
      activityType: 'page_view',
      page: currentPage,
      metadata: {
        ...metadata,
        pageTitle: document.title,
        referrer: document.referrer,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
      }
    });

    // دالة لتسجيل مغادرة الصفحة
    const handlePageLeave = () => {
      const duration = Date.now() - pageStartTimeRef.current;
      tracker.trackActivity({
        activityType: 'navigation',
        page: currentPage,
        metadata: {
          ...metadata,
          pageTitle: document.title,
          pageDuration: duration,
          exitTimestamp: new Date().toISOString(),
          exitReason: 'page_change'
        }
      });
    };

    // مراقبة تغيير الصفحة
    const handlePopState = () => {
      handlePageLeave();
    };

    const handleBeforeUnload = () => {
      handlePageLeave();
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // تنظيف عند إلغاء التحميل
    return () => {
      handlePageLeave();
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [pageName, metadata, isTracking, tracker]);

  return {
    trackPageEvent: useCallback((eventType: string, eventData?: Record<string, any>) => {
      if (isTracking && tracker) {
        tracker.trackActivity({
          activityType: 'click',
          page: pageNameRef.current,
          targetElement: eventType,
          metadata: {
            pageEvent: eventType,
            pageDuration: Date.now() - pageStartTimeRef.current,
            ...eventData
          }
        });
      }
    }, [isTracking, tracker]),

    getPageDuration: useCallback(() => {
      return Date.now() - pageStartTimeRef.current;
    }, [])
  };
};

// Hook لتتبع نقرات الأزرار
export const useButtonClick = (buttonId?: string, options?: {
  trackHover?: boolean;
  trackFocus?: boolean;
  includeCoordinates?: boolean;
  metadata?: Record<string, any>;
}) => {
  const { tracker, isTracking } = useActivityContext();
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const hoverStartTime = useRef<number>(0);
  const focusStartTime = useRef<number>(0);

  const trackClick = useCallback((event: React.MouseEvent<HTMLElement>, customMetadata?: Record<string, any>) => {
    if (!isTracking || !tracker) return;

    const target = event.currentTarget;
    const elementId = buttonId || target.id || target.className || 'unknown-button';

    const coordinates = options?.includeCoordinates ? {
      x: event.clientX,
      y: event.clientY,
      pageX: event.pageX,
      pageY: event.pageY
    } : undefined;

    tracker.trackActivity({
      activityType: 'click',
      page: window.location.pathname,
      targetElement: elementId,
      targetText: target.textContent?.trim() || '',
      targetType: target.tagName.toLowerCase(),
      interactionMode: 'mouse',
      coordinates,
      metadata: {
        buttonId: elementId,
        buttonText: target.textContent?.trim(),
        buttonType: target.getAttribute('type'),
        wasHovered: isHovered,
        wasFocused: isFocused,
        hoverDuration: isHovered ? Date.now() - hoverStartTime.current : 0,
        focusDuration: isFocused ? Date.now() - focusStartTime.current : 0,
        ...options?.metadata,
        ...customMetadata
      }
    });
  }, [isTracking, tracker, buttonId, options, isHovered, isFocused]);

  const trackHover = useCallback((isEntering: boolean, event: React.MouseEvent<HTMLElement>) => {
    if (!isTracking || !tracker || !options?.trackHover) return;

    const target = event.currentTarget;
    const elementId = buttonId || target.id || target.className || 'unknown-button';

    if (isEntering) {
      setIsHovered(true);
      hoverStartTime.current = Date.now();
    } else {
      setIsHovered(false);
      const hoverDuration = Date.now() - hoverStartTime.current;

      tracker.trackActivity({
        activityType: 'hover',
        page: window.location.pathname,
        targetElement: elementId,
        targetType: target.tagName.toLowerCase(),
        interactionMode: 'mouse',
        metadata: {
          buttonId: elementId,
          hoverDuration,
          hoverType: 'exit',
          ...options?.metadata
        }
      });
    }
  }, [isTracking, tracker, buttonId, options]);

  const trackFocus = useCallback((isFocusing: boolean, event: React.FocusEvent<HTMLElement>) => {
    if (!isTracking || !tracker || !options?.trackFocus) return;

    const target = event.currentTarget;
    const elementId = buttonId || target.id || target.className || 'unknown-button';

    if (isFocusing) {
      setIsFocused(true);
      focusStartTime.current = Date.now();

      tracker.trackActivity({
        activityType: 'focus',
        page: window.location.pathname,
        targetElement: elementId,
        targetType: target.tagName.toLowerCase(),
        interactionMode: 'keyboard',
        metadata: {
          buttonId: elementId,
          focusType: 'enter',
          ...options?.metadata
        }
      });
    } else {
      setIsFocused(false);
      const focusDuration = Date.now() - focusStartTime.current;

      tracker.trackActivity({
        activityType: 'blur',
        page: window.location.pathname,
        targetElement: elementId,
        targetType: target.tagName.toLowerCase(),
        interactionMode: 'keyboard',
        metadata: {
          buttonId: elementId,
          focusDuration,
          focusType: 'exit',
          ...options?.metadata
        }
      });
    }
  }, [isTracking, tracker, buttonId, options]);

  return {
    trackClick,
    trackHover,
    trackFocus,
    isHovered,
    isFocused,
    
    // دوال لربط الأحداث بسهولة
    getClickProps: useCallback((customMetadata?: Record<string, any>) => ({
      onClick: (event: React.MouseEvent<HTMLElement>) => trackClick(event, customMetadata),
      onMouseEnter: options?.trackHover ? (event: React.MouseEvent<HTMLElement>) => trackHover(true, event) : undefined,
      onMouseLeave: options?.trackHover ? (event: React.MouseEvent<HTMLElement>) => trackHover(false, event) : undefined,
      onFocus: options?.trackFocus ? (event: React.FocusEvent<HTMLElement>) => trackFocus(true, event) : undefined,
      onBlur: options?.trackFocus ? (event: React.FocusEvent<HTMLElement>) => trackFocus(false, event) : undefined,
    }), [trackClick, trackHover, trackFocus, options])
  };
};

// Hook لتتبع استخدام النماذج
export const useFormTracking = (formId?: string, options?: {
  trackIndividualFields?: boolean;
  trackValidation?: boolean;
  excludeFields?: string[];
  sensitiveFields?: string[];
  onSubmitTracking?: boolean;
  metadata?: Record<string, any>;
}) => {
  const { tracker, isTracking } = useActivityContext();
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [fieldInteractions, setFieldInteractions] = useState<Record<string, number>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const formStartTime = useRef<number>(Date.now());

  const trackFieldChange = useCallback((fieldName: string, value: any, event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    if (!isTracking || !tracker || !options?.trackIndividualFields) return;

    const target = event.target;
    const isExcluded = options?.excludeFields?.includes(fieldName);
    const isSensitive = options?.sensitiveFields?.includes(fieldName) || 
                       ['password', 'creditCard', 'ssn'].includes(fieldName.toLowerCase());

    if (isExcluded) return;

    const processedValue = isSensitive ? '[REDACTED]' : value;

    // تحديث الحالة المحلية
    setFormData(prev => ({ ...prev, [fieldName]: processedValue }));
    setFieldInteractions(prev => ({ ...prev, [fieldName]: (prev[fieldName] || 0) + 1 }));

    tracker.trackActivity({
      activityType: 'form_input',
      page: window.location.pathname,
      targetElement: fieldName,
      targetType: target.tagName.toLowerCase(),
      interactionMode: 'keyboard',
      value: processedValue,
      metadata: {
        formId: formId || 'unknown-form',
        fieldName,
        fieldType: target.type || 'unknown',
        fieldRequired: target.hasAttribute('required'),
        valueLength: isSensitive ? 0 : String(value).length,
        interactionCount: fieldInteractions[fieldName] || 1,
        formDuration: Date.now() - formStartTime.current,
        ...options?.metadata
      }
    });
  }, [isTracking, tracker, formId, options, fieldInteractions]);

  const trackFieldFocus = useCallback((fieldName: string, event: React.FocusEvent<HTMLElement>) => {
    if (!isTracking || !tracker) return;

    const target = event.target;

    tracker.trackActivity({
      activityType: 'focus',
      page: window.location.pathname,
      targetElement: fieldName,
      targetType: target.tagName.toLowerCase(),
      interactionMode: 'keyboard',
      metadata: {
        formId: formId || 'unknown-form',
        fieldName,
        fieldType: (target as HTMLInputElement).type || 'unknown',
        formDuration: Date.now() - formStartTime.current,
        ...options?.metadata
      }
    });
  }, [isTracking, tracker, formId, options]);

  const trackFieldBlur = useCallback((fieldName: string, event: React.FocusEvent<HTMLElement>) => {
    if (!isTracking || !tracker) return;

    const target = event.target;

    tracker.trackActivity({
      activityType: 'blur',
      page: window.location.pathname,
      targetElement: fieldName,
      targetType: target.tagName.toLowerCase(),
      interactionMode: 'keyboard',
      metadata: {
        formId: formId || 'unknown-form',
        fieldName,
        fieldType: (target as HTMLInputElement).type || 'unknown',
        formDuration: Date.now() - formStartTime.current,
        ...options?.metadata
      }
    });
  }, [isTracking, tracker, formId, options]);

  const trackFormSubmit = useCallback((event: React.FormEvent<HTMLFormElement>, isValid: boolean = true, errors?: Record<string, string>) => {
    if (!isTracking || !tracker) return;

    const target = event.currentTarget;
    const formDataForTracking = new FormData(target);
    const fields: Array<{name: string, type: string, hasValue: boolean, isRequired: boolean}> = [];

    // جمع معلومات الحقول
    for (const [key, value] of formDataForTracking.entries()) {
      const field = target.querySelector(`[name="${key}"]`) as HTMLInputElement;
      if (field) {
        fields.push({
          name: key,
          type: field.type || 'unknown',
          hasValue: value !== null && value !== '',
          isRequired: field.hasAttribute('required')
        });
      }
    }

    const formDuration = Date.now() - formStartTime.current;

    tracker.trackActivity({
      activityType: 'form_submit',
      page: window.location.pathname,
      targetElement: formId || target.id || 'unknown-form',
      targetType: 'form',
      interactionMode: 'mouse',
      metadata: {
        formId: formId || target.id || 'unknown-form',
        formAction: target.action,
        formMethod: target.method,
        isValid,
        fieldCount: fields.length,
        fields,
        errors: errors || validationErrors,
        formDuration,
        totalInteractions: Object.values(fieldInteractions).reduce((sum, count) => sum + count, 0),
        ...options?.metadata
      }
    });

    // إعادة تعيين الحالة بعد الإرسال
    if (isValid) {
      setFormData({});
      setFieldInteractions({});
      setValidationErrors({});
      formStartTime.current = Date.now();
    }
  }, [isTracking, tracker, formId, validationErrors, fieldInteractions, options]);

  const trackValidationError = useCallback((fieldName: string, errorMessage: string) => {
    if (!isTracking || !tracker || !options?.trackValidation) return;

    setValidationErrors(prev => ({ ...prev, [fieldName]: errorMessage }));

    tracker.trackActivity({
      activityType: 'form_input',
      page: window.location.pathname,
      targetElement: fieldName,
      targetType: 'validation_error',
      interactionMode: 'other',
      value: errorMessage,
      metadata: {
        formId: formId || 'unknown-form',
        fieldName,
        errorType: 'validation',
        errorMessage,
        formDuration: Date.now() - formStartTime.current,
        ...options?.metadata
      }
    });
  }, [isTracking, tracker, formId, options]);

  return {
    trackFieldChange,
    trackFieldFocus,
    trackFieldBlur,
    trackFormSubmit,
    trackValidationError,
    formData,
    fieldInteractions,
    validationErrors,
    
    // دوال لربط الأحداث بسهولة
    getFieldProps: useCallback((fieldName: string) => ({
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => 
        trackFieldChange(fieldName, event.target.value, event),
      onFocus: (event: React.FocusEvent<HTMLElement>) => trackFieldFocus(fieldName, event),
      onBlur: (event: React.FocusEvent<HTMLElement>) => trackFieldBlur(fieldName, event),
    }), [trackFieldChange, trackFieldFocus, trackFieldBlur]),

    getFormProps: useCallback((isValid?: boolean, errors?: Record<string, string>) => ({
      onSubmit: (event: React.FormEvent<HTMLFormElement>) => {
        if (options?.onSubmitTracking !== false) {
          trackFormSubmit(event, isValid, errors);
        }
      }
    }), [trackFormSubmit, options])
  };
};

// Hook لتسجيل الأفعال المخصصة
export const useUserAction = (actionContext?: string) => {
  const { trackAction, isActive } = useCustomTracking();
  const [actionHistory, setActionHistory] = useState<Array<{action: string, timestamp: number, metadata?: Record<string, any>}>>([]);

  const trackUserAction = useCallback((action: string, metadata?: Record<string, any>) => {
    if (!isActive) return;

    const actionData = {
      action,
      timestamp: Date.now(),
      metadata: {
        context: actionContext,
        ...metadata
      }
    };

    // تتبع الفعل
    trackAction(action, actionData.metadata);

    // إضافة للتاريخ المحلي
    setActionHistory(prev => [...prev, actionData].slice(-50)); // الاحتفاظ بآخر 50 فعل

  }, [isActive, trackAction, actionContext]);

  const trackButtonAction = useCallback((buttonText: string, buttonId?: string, metadata?: Record<string, any>) => {
    trackUserAction('button_click', {
      buttonText,
      buttonId,
      actionType: 'button_interaction',
      ...metadata
    });
  }, [trackUserAction]);

  const trackLinkAction = useCallback((linkText: string, linkUrl: string, metadata?: Record<string, any>) => {
    trackUserAction('link_click', {
      linkText,
      linkUrl,
      actionType: 'navigation',
      ...metadata
    });
  }, [trackUserAction]);

  const trackMenuAction = useCallback((menuItem: string, menuPath?: string[], metadata?: Record<string, any>) => {
    trackUserAction('menu_interaction', {
      menuItem,
      menuPath,
      actionType: 'menu_navigation',
      ...metadata
    });
  }, [trackUserAction]);

  const trackModalAction = useCallback((modalId: string, action: 'open' | 'close' | 'interact', metadata?: Record<string, any>) => {
    trackUserAction('modal_interaction', {
      modalId,
      modalAction: action,
      actionType: 'modal',
      ...metadata
    });
  }, [trackUserAction]);

  const trackTabAction = useCallback((tabId: string, tabLabel: string, metadata?: Record<string, any>) => {
    trackUserAction('tab_change', {
      tabId,
      tabLabel,
      actionType: 'tab_navigation',
      ...metadata
    });
  }, [trackUserAction]);

  return {
    trackUserAction,
    trackButtonAction,
    trackLinkAction,
    trackMenuAction,
    trackModalAction,
    trackTabAction,
    actionHistory,
    isActive,
    
    // مساعدات للإحصائيات
    getActionCount: useCallback((action?: string) => {
      if (action) {
        return actionHistory.filter(a => a.action === action).length;
      }
      return actionHistory.length;
    }, [actionHistory]),

    getRecentActions: useCallback((count: number = 10) => {
      return actionHistory.slice(-count);
    }, [actionHistory]),

    clearHistory: useCallback(() => {
      setActionHistory([]);
    }, [])
  };
};

// Hook لتتبع التفاعل مع العناصر
export const useElementInteraction = (elementId: string, options?: {
  trackClicks?: boolean;
  trackHovers?: boolean;
  trackFocus?: boolean;
  trackVisibility?: boolean;
  metadata?: Record<string, any>;
}) => {
  const { tracker, isTracking } = useActivityContext();
  const [isVisible, setIsVisible] = useState(false);
  const [isInteracted, setIsInteracted] = useState(false);
  const interactionCount = useRef(0);

  const trackInteraction = useCallback((interactionType: string, event?: any, customMetadata?: Record<string, any>) => {
    if (!isTracking || !tracker) return;

    interactionCount.current += 1;
    setIsInteracted(true);

    tracker.trackActivity({
      activityType: 'click',
      page: window.location.pathname,
      targetElement: elementId,
      interactionMode: 'mouse',
      metadata: {
        elementId,
        interactionType,
        interactionCount: interactionCount.current,
        isFirstInteraction: interactionCount.current === 1,
        ...options?.metadata,
        ...customMetadata
      }
    });
  }, [isTracking, tracker, elementId, options]);

  // مراقبة الرؤية
  useEffect(() => {
    if (!options?.trackVisibility) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isNowVisible = entry.isIntersecting;
        setIsVisible(isNowVisible);

        if (isTracking && tracker) {
          tracker.trackActivity({
            activityType: 'hover',
            page: window.location.pathname,
            targetElement: elementId,
            interactionMode: 'other',
            metadata: {
              elementId,
              visibilityChange: isNowVisible ? 'visible' : 'hidden',
              intersectionRatio: entry.intersectionRatio,
              ...options?.metadata
            }
          });
        }
      },
      { threshold: [0, 0.5, 1] }
    );

    const element = document.getElementById(elementId);
    if (element) {
      observer.observe(element);
    }

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [elementId, isTracking, tracker, options]);

  return {
    trackInteraction,
    isVisible,
    isInteracted,
    interactionCount: interactionCount.current,
    
    // دوال مساعدة
    trackClick: useCallback((event: React.MouseEvent, metadata?: Record<string, any>) => {
      if (options?.trackClicks !== false) {
        trackInteraction('click', event, metadata);
      }
    }, [trackInteraction, options]),

    trackHover: useCallback((isEntering: boolean, event: React.MouseEvent, metadata?: Record<string, any>) => {
      if (options?.trackHovers !== false) {
        trackInteraction(isEntering ? 'hover_enter' : 'hover_exit', event, metadata);
      }
    }, [trackInteraction, options]),

    trackFocus: useCallback((isFocusing: boolean, event: React.FocusEvent, metadata?: Record<string, any>) => {
      if (options?.trackFocus !== false) {
        trackInteraction(isFocusing ? 'focus' : 'blur', event, metadata);
      }
    }, [trackInteraction, options])
  };
};

// Hook لتتبع الجلسة والأداء
export const useSessionTracking = () => {
  const { session, flushActivities, exportSessionData } = useActivityContext();
  const [sessionStats, setSessionStats] = useState({
    duration: 0,
    activitiesCount: 0,
    pagesVisited: new Set<string>(),
    lastActivity: Date.now()
  });

  // تحديث إحصائيات الجلسة
  useEffect(() => {
    const interval = setInterval(() => {
      if (session) {
        setSessionStats(prev => ({
          ...prev,
          duration: Date.now() - session.startTime,
          lastActivity: Date.now()
        }));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [session]);

  const endSession = useCallback(async () => {
    await flushActivities();
    const data = exportSessionData();
    return data;
  }, [flushActivities, exportSessionData]);

  return {
    session,
    sessionStats,
    endSession,
    isActive: session?.isActive || false,
    duration: sessionStats.duration,
    
    // دوال مساعدة
    getDurationMinutes: useCallback(() => {
      return Math.floor(sessionStats.duration / (1000 * 60));
    }, [sessionStats.duration]),

    getDurationFormatted: useCallback(() => {
      const minutes = Math.floor(sessionStats.duration / (1000 * 60));
      const seconds = Math.floor((sessionStats.duration % (1000 * 60)) / 1000);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }, [sessionStats.duration])
  };
};

export default {
  usePageView,
  useButtonClick,
  useFormTracking,
  useUserAction,
  useElementInteraction,
  useSessionTracking
};