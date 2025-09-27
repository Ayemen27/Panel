import { nanoid } from 'nanoid';

// أنواع الأنشطة المختلفة
export type ActivityType = 'click' | 'navigation' | 'form_input' | 'form_submit' | 'search' | 'filter' | 'scroll' | 'hover' | 'focus' | 'blur' | 'key_press' | 'page_view' | 'session_start' | 'session_end' | 'file_upload' | 'file_download' | 'copy' | 'paste' | 'drag' | 'drop';
export type InteractionMode = 'mouse' | 'keyboard' | 'touch' | 'voice' | 'other';

// واجهة بيانات النشاط
export interface ActivityData {
  activityType: ActivityType;
  page: string;
  targetElement?: string;
  targetText?: string;
  targetType?: string;
  sourceElement?: string;
  interactionMode: InteractionMode;
  value?: string;
  metadata?: Record<string, any>;
  browserInfo: BrowserInfo;
  viewport?: ViewportInfo;
  coordinates?: CoordinatesInfo;
  duration?: number;
  pageDuration?: number;
  scrollPosition?: number;
  userAgent: string;
  referrer?: string;
  sessionId: string;
  batchId?: string;
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
  timezone: string;
  doNotTrack: string | null;
}

// معلومات العرض
export interface ViewportInfo {
  width: number;
  height: number;
  devicePixelRatio: number;
}

// معلومات الإحداثيات
export interface CoordinatesInfo {
  x: number;
  y: number;
  pageX?: number;
  pageY?: number;
}

// إعدادات متتبع الأنشطة
export interface ActivityTrackerConfig {
  apiEndpoint: string;
  batchEndpoint: string;
  maxRetries: number;
  retryDelay: number;
  enableConsoleLogging: boolean;
  enableLocalStorage: boolean;
  maxLocalStorageEntries: number;
  batchSize: number;
  batchTimeout: number;
  enableDebouncing: boolean;
  debounceDelay: number;
  trackScrollEvents: boolean;
  trackMouseMovements: boolean;
  trackKeystrokes: boolean;
  trackClipboardEvents: boolean;
  trackFileOperations: boolean;
  enableOfflineSupport: boolean;
  compressionEnabled: boolean;
  excludePages: string[];
  excludeElements: string[];
  sensitiveFields: string[];
}

// فئة إدارة التخزين المؤقت
class ActivityQueue {
  private queue: ActivityData[] = [];
  private processing = false;

  constructor(private config: ActivityTrackerConfig) {}

  add(activity: ActivityData): void {
    this.queue.push(activity);

    if (this.config.enableLocalStorage) {
      this.saveToLocalStorage();
    }

    if (this.queue.length >= this.config.batchSize) {
      this.flush();
    }
  }

  private saveToLocalStorage(): void {
    try {
      const stored = localStorage.getItem('userActivitiesQueue') || '[]';
      const storedQueue = JSON.parse(stored);
      const combined = [...storedQueue, ...this.queue].slice(-this.config.maxLocalStorageEntries);
      localStorage.setItem('userActivitiesQueue', JSON.stringify(combined));
    } catch (error) {
      console.warn('Failed to save activities to localStorage:', error);
    }
  }

  private loadFromLocalStorage(): ActivityData[] {
    try {
      const stored = localStorage.getItem('userActivitiesQueue');
      if (stored) {
        const activities = JSON.parse(stored);
        localStorage.removeItem('userActivitiesQueue');
        return activities;
      }
    } catch (error) {
      console.warn('Failed to load activities from localStorage:', error);
    }
    return [];
  }

  async flush(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    const activitiesToSend = [...this.queue];
    this.queue = [];

    // إضافة الأنشطة المخزنة محلياً
    const storedActivities = this.loadFromLocalStorage();
    if (storedActivities.length > 0) {
      activitiesToSend.unshift(...storedActivities);
    }

    try {
      await this.sendBatch(activitiesToSend);
    } catch (error) {
      console.error('Failed to send activities batch:', error);
      // إعادة الأنشطة للطابور في حالة الفشل
      if (this.config.enableOfflineSupport) {
        this.queue.unshift(...activitiesToSend);
        this.saveToLocalStorage();
      }
    } finally {
      this.processing = false;
    }
  }

  private async sendBatch(activities: ActivityData[]): Promise<void> {
    const endpoint = this.config.batchEndpoint;
    let attempts = 0;

    while (attempts < this.config.maxRetries) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(activities),
        });

        if (response.ok) {
          if (this.config.enableConsoleLogging) {
            console.log(`📊 Sent ${activities.length} activities to server`);
          }
          return;
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        attempts++;
        console.warn(`Attempt ${attempts} failed:`, error);

        if (attempts < this.config.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        } else {
          throw error;
        }
      }
    }
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
    if (this.config.enableLocalStorage) {
      localStorage.removeItem('userActivitiesQueue');
    }
  }
}

// فئة متتبع أنشطة المستخدم الرئيسية
export class UserActivityTracker {
  private config: ActivityTrackerConfig;
  private sessionId: string;
  private pageStartTime: number;
  private lastActivityTime: number;
  private queue: ActivityQueue;
  private initialized = false;
  private currentPage: string;
  private isVisible: boolean = true;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private flushTimer?: NodeJS.Timeout;

  constructor(config: Partial<ActivityTrackerConfig> = {}) {
    this.config = {
      apiEndpoint: '/api/user-activities',
      batchEndpoint: '/api/user-activities/batch',
      maxRetries: 3,
      retryDelay: 1000,
      enableConsoleLogging: false,
      enableLocalStorage: true,
      maxLocalStorageEntries: 1000,
      batchSize: 10,
      batchTimeout: 30000,
      enableDebouncing: true,
      debounceDelay: 500,
      trackScrollEvents: true,
      trackMouseMovements: false,
      trackKeystrokes: true,
      trackClipboardEvents: true,
      trackFileOperations: true,
      enableOfflineSupport: true,
      compressionEnabled: false,
      excludePages: ['/admin', '/api'],
      excludeElements: ['[data-no-track]', '.no-track'],
      sensitiveFields: ['password', 'creditCard', 'ssn'],
      ...config
    };

    this.sessionId = this.generateSessionId();
    this.pageStartTime = Date.now();
    this.lastActivityTime = Date.now();
    this.currentPage = typeof window !== 'undefined' ? window.location.href : '';
    this.queue = new ActivityQueue(this.config);

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
      this.setupEventListeners();
      this.startFlushTimer();
      this.trackPageView();
      this.trackSessionStart();
      this.setupVisibilityHandling();
      this.setupBeforeUnload();

      this.initialized = true;

      if (this.config.enableConsoleLogging) {
        console.log('🎯 UserActivityTracker initialized successfully');
      }
    } catch (error) {
      console.error('Failed to initialize UserActivityTracker:', error);
    }
  }

  private setupEventListeners(): void {
    // تتبع نقرات الأزرار
    document.addEventListener('click', this.handleClick.bind(this), true);

    // تتبع إدخال النماذج
    document.addEventListener('input', this.handleInput.bind(this), true);
    document.addEventListener('change', this.handleChange.bind(this), true);
    document.addEventListener('submit', this.handleSubmit.bind(this), true);

    // تتبع التركيز والعدم تركيز
    document.addEventListener('focus', this.handleFocus.bind(this), true);
    document.addEventListener('blur', this.handleBlur.bind(this), true);

    // تتبع تفاعلات الماوس
    if (this.config.trackMouseMovements) {
      document.addEventListener('mousemove', this.debounce('mousemove', this.handleMouseMove.bind(this)));
    }
    document.addEventListener('mouseenter', this.handleHover.bind(this), true);
    document.addEventListener('mouseleave', this.handleHover.bind(this), true);

    // تتبع التمرير
    if (this.config.trackScrollEvents) {
      window.addEventListener('scroll', this.debounce('scroll', this.handleScroll.bind(this)));
    }

    // تتبع ضغطات المفاتيح
    if (this.config.trackKeystrokes) {
      document.addEventListener('keydown', this.handleKeyPress.bind(this), true);
    }

    // تتبع عمليات النسخ واللصق
    if (this.config.trackClipboardEvents) {
      document.addEventListener('copy', this.handleCopy.bind(this), true);
      document.addEventListener('paste', this.handlePaste.bind(this), true);
    }

    // تتبع السحب والإفلات
    document.addEventListener('dragstart', this.handleDrag.bind(this), true);
    document.addEventListener('drop', this.handleDrop.bind(this), true);

    // تتبع تغييرات التاريخ (navigation)
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', this.handleNavigation.bind(this));
      this.interceptNavigationMethods();
    }
  }

  private handleClick = (event: MouseEvent): void => {
    if (!this.isEnabled || !event.target) return;

    try {
      const element = event.target as Element;
      if (!element || !element.tagName) return;

      const identifier = this.getElementIdentifier(element);
      this.trackActivity({
        activityType: 'click',
        page: this.currentPage,
        targetElement: identifier,
        targetText: this.getElementText(element),
        targetType: element.tagName.toLowerCase(),
        interactionMode: 'mouse',
        browserInfo: this.getBrowserInfo(),
        viewport: this.getViewportInfo(),
        coordinates: {
          x: event.clientX,
          y: event.clientY,
          pageX: event.pageX,
          pageY: event.pageY
        },
        pageDuration: Date.now() - this.pageStartTime,
        scrollPosition: window.pageYOffset,
        userAgent: navigator.userAgent,
        sessionId: this.sessionId,
        metadata: {
          ctrlKey: event.ctrlKey,
          altKey: event.altKey,
          shiftKey: event.shiftKey,
          button: event.button
        }
      });
    } catch (error) {
      console.warn('Error in click tracking:', error);
    }
  };

  private handleInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (!target || this.shouldExcludeElement(target) || this.isSensitiveField(target)) {
      return;
    }

    const activityData: ActivityData = {
      activityType: 'form_input',
      page: this.currentPage,
      targetElement: this.getElementIdentifier(target),
      targetType: target.type || 'input',
      interactionMode: 'keyboard',
      value: target.type === 'password' ? '[REDACTED]' : target.value?.slice(0, 100),
      browserInfo: this.getBrowserInfo(),
      viewport: this.getViewportInfo(),
      pageDuration: Date.now() - this.pageStartTime,
      scrollPosition: window.pageYOffset,
      userAgent: navigator.userAgent,
      sessionId: this.sessionId,
      metadata: {
        fieldName: target.name,
        fieldType: target.type,
        valueLength: target.value?.length || 0
      }
    };

    this.trackActivity(activityData);
  }

  private handleChange(event: Event): void {
    const target = event.target as HTMLSelectElement | HTMLInputElement;
    if (!target || this.shouldExcludeElement(target)) {
      return;
    }

    const activityData: ActivityData = {
      activityType: 'form_input',
      page: this.currentPage,
      targetElement: this.getElementIdentifier(target),
      targetType: target.tagName.toLowerCase(),
      interactionMode: target.tagName.toLowerCase() === 'select' ? 'mouse' : 'keyboard',
      value: this.isSensitiveField(target) ? '[REDACTED]' : target.value?.slice(0, 100),
      browserInfo: this.getBrowserInfo(),
      viewport: this.getViewportInfo(),
      pageDuration: Date.now() - this.pageStartTime,
      scrollPosition: window.pageYOffset,
      userAgent: navigator.userAgent,
      sessionId: this.sessionId,
      metadata: {
        fieldName: (target as HTMLInputElement).name,
        fieldType: (target as HTMLInputElement).type,
        changeType: 'change'
      }
    };

    this.trackActivity(activityData);
  }

  private handleSubmit(event: SubmitEvent): void {
    const target = event.target as HTMLFormElement;
    if (!target || this.shouldExcludeElement(target)) {
      return;
    }

    const formData = new FormData(target);
    const formFields = Array.from(formData.keys()).map(key => ({
      name: key,
      type: (target.querySelector(`[name="${key}"]`) as HTMLInputElement)?.type || 'unknown',
      hasValue: formData.get(key) !== null && formData.get(key) !== ''
    }));

    const activityData: ActivityData = {
      activityType: 'form_submit',
      page: this.currentPage,
      targetElement: this.getElementIdentifier(target),
      targetType: 'form',
      interactionMode: 'mouse',
      browserInfo: this.getBrowserInfo(),
      viewport: this.getViewportInfo(),
      pageDuration: Date.now() - this.pageStartTime,
      scrollPosition: window.pageYOffset,
      userAgent: navigator.userAgent,
      sessionId: this.sessionId,
      metadata: {
        formName: target.name,
        formAction: target.action,
        formMethod: target.method,
        fieldCount: formFields.length,
        fields: formFields
      }
    };

    this.trackActivity(activityData);
  }

  private handleFocus(event: FocusEvent): void {
    const target = event.target as HTMLElement;
    if (!target || this.shouldExcludeElement(target)) {
      return;
    }

    const activityData: ActivityData = {
      activityType: 'focus',
      page: this.currentPage,
      targetElement: this.getElementIdentifier(target),
      targetType: target.tagName.toLowerCase(),
      interactionMode: 'keyboard',
      browserInfo: this.getBrowserInfo(),
      viewport: this.getViewportInfo(),
      pageDuration: Date.now() - this.pageStartTime,
      scrollPosition: window.pageYOffset,
      userAgent: navigator.userAgent,
      sessionId: this.sessionId
    };

    this.trackActivity(activityData);
  }

  private handleBlur(event: FocusEvent): void {
    const target = event.target as HTMLElement;
    if (!target || this.shouldExcludeElement(target)) {
      return;
    }

    const activityData: ActivityData = {
      activityType: 'blur',
      page: this.currentPage,
      targetElement: this.getElementIdentifier(target),
      targetType: target.tagName.toLowerCase(),
      interactionMode: 'keyboard',
      browserInfo: this.getBrowserInfo(),
      viewport: this.getViewportInfo(),
      pageDuration: Date.now() - this.pageStartTime,
      scrollPosition: window.pageYOffset,
      userAgent: navigator.userAgent,
      sessionId: this.sessionId
    };

    this.trackActivity(activityData);
  }

  private handleMouseMove(event: MouseEvent): void {
    // تتبع حركة الماوس مع تقليل الأحداث
    const activityData: ActivityData = {
      activityType: 'hover',
      page: this.currentPage,
      interactionMode: 'mouse',
      browserInfo: this.getBrowserInfo(),
      viewport: this.getViewportInfo(),
      coordinates: {
        x: event.clientX,
        y: event.clientY,
        pageX: event.pageX,
        pageY: event.pageY
      },
      pageDuration: Date.now() - this.pageStartTime,
      scrollPosition: window.pageYOffset,
      userAgent: navigator.userAgent,
      sessionId: this.sessionId
    };

    this.trackActivity(activityData);
  }

  private handleHover = (event: MouseEvent): void => {
    if (!this.isEnabled || !event.target) return;

    try {
      const element = event.target as Element;
      if (!element || !element.tagName) return;

      const identifier = this.getElementIdentifier(element);
      this.trackActivity({
        activityType: 'hover',
        page: this.currentPage,
        targetElement: identifier,
        targetText: this.getElementText(element),
        targetType: element.tagName.toLowerCase(),
        interactionMode: 'mouse',
        browserInfo: this.getBrowserInfo(),
        viewport: this.getViewportInfo(),
        coordinates: {
          x: event.clientX,
          y: event.clientY,
          pageX: event.pageX,
          pageY: event.pageY
        },
        pageDuration: Date.now() - this.pageStartTime,
        scrollPosition: window.pageYOffset,
        userAgent: navigator.userAgent,
        sessionId: this.sessionId,
        metadata: {
          eventType: event.type
        }
      });
    } catch (error) {
      console.warn('Error in hover tracking:', error);
    }
  };

  private handleScroll(): void {
    const activityData: ActivityData = {
      activityType: 'scroll',
      page: this.currentPage,
      interactionMode: 'mouse',
      browserInfo: this.getBrowserInfo(),
      viewport: this.getViewportInfo(),
      pageDuration: Date.now() - this.pageStartTime,
      scrollPosition: window.pageYOffset,
      userAgent: navigator.userAgent,
      sessionId: this.sessionId,
      metadata: {
        scrollTop: window.pageYOffset,
        scrollLeft: window.pageXOffset,
        documentHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
        scrollPercentage: Math.round((window.pageYOffset / (document.documentElement.scrollHeight - window.innerHeight)) * 100)
      }
    };

    this.trackActivity(activityData);
  }

  private handleKeyPress(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;

    // تجاهل المفاتيح الحساسة
    if (this.isSensitiveKeyPress(event) || (target && this.isSensitiveField(target))) {
      return;
    }

    const activityData: ActivityData = {
      activityType: 'key_press',
      page: this.currentPage,
      targetElement: target ? this.getElementIdentifier(target) : undefined,
      targetType: target?.tagName.toLowerCase(),
      interactionMode: 'keyboard',
      value: event.key === 'Enter' ? 'Enter' : event.key.length === 1 ? '[CHAR]' : event.key,
      browserInfo: this.getBrowserInfo(),
      viewport: this.getViewportInfo(),
      pageDuration: Date.now() - this.pageStartTime,
      scrollPosition: window.pageYOffset,
      userAgent: navigator.userAgent,
      sessionId: this.sessionId,
      metadata: {
        key: event.key,
        code: event.code,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        metaKey: event.metaKey
      }
    };

    this.trackActivity(activityData);
  }

  private handleCopy(event: ClipboardEvent): void {
    const target = event.target as HTMLElement;

    const activityData: ActivityData = {
      activityType: 'copy',
      page: this.currentPage,
      targetElement: target ? this.getElementIdentifier(target) : undefined,
      targetType: target?.tagName.toLowerCase(),
      interactionMode: 'keyboard',
      browserInfo: this.getBrowserInfo(),
      viewport: this.getViewportInfo(),
      pageDuration: Date.now() - this.pageStartTime,
      scrollPosition: window.pageYOffset,
      userAgent: navigator.userAgent,
      sessionId: this.sessionId,
      metadata: {
        hasClipboardData: !!event.clipboardData,
        dataTypes: event.clipboardData ? Array.from(event.clipboardData.types) : []
      }
    };

    this.trackActivity(activityData);
  }

  private handlePaste(event: ClipboardEvent): void {
    const target = event.target as HTMLElement;

    const activityData: ActivityData = {
      activityType: 'paste',
      page: this.currentPage,
      targetElement: target ? this.getElementIdentifier(target) : undefined,
      targetType: target?.tagName.toLowerCase(),
      interactionMode: 'keyboard',
      browserInfo: this.getBrowserInfo(),
      viewport: this.getViewportInfo(),
      pageDuration: Date.now() - this.pageStartTime,
      scrollPosition: window.pageYOffset,
      userAgent: navigator.userAgent,
      sessionId: this.sessionId,
      metadata: {
        hasClipboardData: !!event.clipboardData,
        dataTypes: event.clipboardData ? Array.from(event.clipboardData.types) : []
      }
    };

    this.trackActivity(activityData);
  }

  private handleDrag(event: DragEvent): void {
    const target = event.target as HTMLElement;

    const activityData: ActivityData = {
      activityType: 'drag',
      page: this.currentPage,
      targetElement: target ? this.getElementIdentifier(target) : undefined,
      targetType: target?.tagName.toLowerCase(),
      interactionMode: 'mouse',
      browserInfo: this.getBrowserInfo(),
      viewport: this.getViewportInfo(),
      coordinates: {
        x: event.clientX,
        y: event.clientY,
        pageX: event.pageX,
        pageY: event.pageY
      },
      pageDuration: Date.now() - this.pageStartTime,
      scrollPosition: window.pageYOffset,
      userAgent: navigator.userAgent,
      sessionId: this.sessionId
    };

    this.trackActivity(activityData);
  }

  private handleDrop(event: DragEvent): void {
    const target = event.target as HTMLElement;

    const activityData: ActivityData = {
      activityType: 'drop',
      page: this.currentPage,
      targetElement: target ? this.getElementIdentifier(target) : undefined,
      targetType: target?.tagName.toLowerCase(),
      interactionMode: 'mouse',
      browserInfo: this.getBrowserInfo(),
      viewport: this.getViewportInfo(),
      coordinates: {
        x: event.clientX,
        y: event.clientY,
        pageX: event.pageX,
        pageY: event.pageY
      },
      pageDuration: Date.now() - this.pageStartTime,
      scrollPosition: window.pageYOffset,
      userAgent: navigator.userAgent,
      sessionId: this.sessionId,
      metadata: {
        dataTransferTypes: event.dataTransfer ? Array.from(event.dataTransfer.types) : [],
        files: event.dataTransfer?.files ? Array.from(event.dataTransfer.files).map(f => ({ name: f.name, size: f.size, type: f.type })) : []
      }
    };

    this.trackActivity(activityData);
  }

  private handleNavigation(): void {
    const newPage = window.location.href;
    if (newPage !== this.currentPage) {
      // تسجيل الانتقال من الصفحة السابقة
      const activityData: ActivityData = {
        activityType: 'navigation',
        page: newPage,
        interactionMode: 'other',
        browserInfo: this.getBrowserInfo(),
        viewport: this.getViewportInfo(),
        pageDuration: Date.now() - this.pageStartTime,
        scrollPosition: window.pageYOffset,
        userAgent: navigator.userAgent,
        referrer: this.currentPage,
        sessionId: this.sessionId,
        metadata: {
          from: this.currentPage,
          to: newPage,
          navigationType: 'popstate'
        }
      };

      this.trackActivity(activityData);

      // تحديث الصفحة الحالية وبدء توقيت جديد
      this.currentPage = newPage;
      this.pageStartTime = Date.now();
      this.trackPageView();
    }
  }

  private interceptNavigationMethods(): void {
    // اعتراض pushState و replaceState
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      setTimeout(() => this.handleNavigation(), 0);
    };

    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      setTimeout(() => this.handleNavigation(), 0);
    };
  }

  private setupVisibilityHandling(): void {
    document.addEventListener('visibilitychange', () => {
      this.isVisible = !document.hidden;

      if (this.isVisible) {
        // المستخدم عاد للصفحة
        this.lastActivityTime = Date.now();
      } else {
        // المستخدم غادر الصفحة - إرسال البيانات
        this.queue.flush();
      }
    });
  }

  private setupBeforeUnload(): void {
    window.addEventListener('beforeunload', () => {
      this.trackSessionEnd();
      this.queue.flush();
    });
  }

  private trackPageView(): void {
    if (this.shouldExcludePage(this.currentPage)) {
      return;
    }

    const activityData: ActivityData = {
      activityType: 'page_view',
      page: this.currentPage,
      interactionMode: 'other',
      browserInfo: this.getBrowserInfo(),
      viewport: this.getViewportInfo(),
      pageDuration: 0,
      scrollPosition: 0,
      userAgent: navigator.userAgent,
      referrer: document.referrer,
      sessionId: this.sessionId,
      metadata: {
        title: document.title,
        timestamp: new Date().toISOString()
      }
    };

    this.trackActivity(activityData);
  }

  private trackSessionStart(): void {
    const activityData: ActivityData = {
      activityType: 'session_start',
      page: this.currentPage,
      interactionMode: 'other',
      browserInfo: this.getBrowserInfo(),
      viewport: this.getViewportInfo(),
      pageDuration: 0,
      scrollPosition: 0,
      userAgent: navigator.userAgent,
      sessionId: this.sessionId,
      metadata: {
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId
      }
    };

    this.trackActivity(activityData);
  }

  private trackSessionEnd(): void {
    const activityData: ActivityData = {
      activityType: 'session_end',
      page: this.currentPage,
      interactionMode: 'other',
      browserInfo: this.getBrowserInfo(),
      viewport: this.getViewportInfo(),
      pageDuration: Date.now() - this.pageStartTime,
      scrollPosition: window.pageYOffset,
      userAgent: navigator.userAgent,
      sessionId: this.sessionId,
      metadata: {
        timestamp: new Date().toISOString(),
        sessionDuration: Date.now() - this.pageStartTime
      }
    };

    this.trackActivity(activityData);
  }

  // طرق المساعدة
  private debounce(key: string, func: Function): (...args: any[]) => void {
    return (...args: any[]) => {
      if (!this.config.enableDebouncing) {
        func(...args);
        return;
      }

      const existingTimer = this.debounceTimers.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        func(...args);
        this.debounceTimers.delete(key);
      }, this.config.debounceDelay);

      this.debounceTimers.set(key, timer);
    };
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.queue.flush();
    }, this.config.batchTimeout);
  }

  private getElementIdentifier(element: Element): string {
    try {
      // التحقق من وجود element وخصائصه
      if (!element) return 'unknown-element';

      const tagName = element.tagName ? element.tagName.toLowerCase() : 'unknown';

      // التحقق من className بطريقة آمنة
      let classes = '';
      if (element.className && typeof element.className === 'string') {
        classes = element.className.split(' ').filter(c => c).slice(0, 3).join(' ');
      } else if (element.classList && element.classList.length > 0) {
        classes = Array.from(element.classList).slice(0, 3).join(' ');
      }

      const id = element.id || '';

      if (id) {
        return `#${id}`;
      }

      if (classes) {
        return `.${classes.split(' ').join('.')}`;
      }

      // إنشاء selector فريد
      let selector = tagName;
      const parent = element.parentElement;

      if (parent) {
        const siblings = Array.from(parent.children);
        const index = siblings.indexOf(element);
        selector = `${parent.tagName.toLowerCase()} > ${selector}:nth-child(${index + 1})`;
      }

      return selector;
    } catch (error) {
      console.warn('Error getting element identifier:', error);
      return 'unknown-element';
    }
  }

  private getElementText(element: HTMLElement): string {
    const text = element.textContent || element.innerText || '';
    return text.trim().slice(0, 100);
  }

  private getBrowserInfo(): BrowserInfo {
    if (typeof window === 'undefined') {
      return {
        userAgent: 'unknown',
        language: 'unknown',
        platform: 'unknown',
        cookieEnabled: false,
        onLine: false,
        screen: { width: 0, height: 0, colorDepth: 0 },
        timezone: 'unknown',
        doNotTrack: null
      };
    }
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
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      doNotTrack: (navigator as any).doNotTrack || null
    };
  }

  private getViewportInfo(): ViewportInfo {
    if (typeof window === 'undefined') {
      return { width: 0, height: 0, devicePixelRatio: 1 };
    }
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1
    };
  }

  private shouldExcludePage(page: string): boolean {
    return this.config.excludePages.some(excludedPage => 
      page.includes(excludedPage)
    );
  }

  private shouldExcludeElement(element: HTMLElement): boolean {
    return this.config.excludeElements.some(selector => {
      try {
        return element.matches(selector) || element.closest(selector);
      } catch {
        return false;
      }
    });
  }

  private isSensitiveField(element: HTMLElement): boolean {
    const fieldName = (element as HTMLInputElement).name?.toLowerCase() || '';
    const fieldType = (element as HTMLInputElement).type?.toLowerCase() || '';
    const fieldId = element.id?.toLowerCase() || '';

    return this.config.sensitiveFields.some(sensitive => 
      fieldName.includes(sensitive) || 
      fieldType.includes(sensitive) || 
      fieldId.includes(sensitive)
    );
  }

  private isSensitiveKeyPress(event: KeyboardEvent): boolean {
    // تجاهل مفاتيح التحكم الحساسة
    return event.ctrlKey && ['c', 'v', 'x', 'a'].includes(event.key.toLowerCase());
  }

  // واجهة عامة
  public trackActivity(activityData: Partial<ActivityData>): void {
    if (!this.initialized) {
      return;
    }

    const fullActivityData: ActivityData = {
      activityType: 'click', // Default, will be overridden
      page: this.currentPage,
      interactionMode: 'other', // Default, will be overridden
      browserInfo: this.getBrowserInfo(),
      viewport: this.getViewportInfo(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      sessionId: this.sessionId,
      ...activityData
    };

    this.queue.add(fullActivityData);
    this.lastActivityTime = Date.now();
  }

  public trackCustomAction(action: string, metadata?: Record<string, any>): void {
    this.trackActivity({
      activityType: 'click', // Assuming custom actions are a form of click or interaction
      targetElement: action,
      metadata: {
        customAction: action,
        ...metadata
      }
    });
  }

  public trackSearch(query: string, results?: number): void {
    this.trackActivity({
      activityType: 'search',
      value: query,
      metadata: {
        query,
        resultsCount: results,
        searchType: 'user_search'
      }
    });
  }

  public trackFilter(filterType: string, filterValue: string): void {
    this.trackActivity({
      activityType: 'filter',
      value: filterValue,
      metadata: {
        filterType,
        filterValue
      }
    });
  }

  public trackFileUpload(fileName: string, fileSize: number, fileType: string): void {
    this.trackActivity({
      activityType: 'file_upload',
      value: fileName,
      metadata: {
        fileName,
        fileSize,
        fileType
      }
    });
  }

  public trackFileDownload(fileName: string, downloadUrl?: string): void {
    this.trackActivity({
      activityType: 'file_download',
      value: fileName,
      metadata: {
        fileName,
        downloadUrl
      }
    });
  }

  public flush(): Promise<void> {
    return this.queue.flush();
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public getQueueSize(): number {
    return this.queue.getQueueSize();
  }

  public destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();

    this.trackSessionEnd();
    this.queue.flush();
    this.queue.clear();

    this.initialized = false;
  }
}

// إنشاء instance مشترك
let globalTracker: UserActivityTracker | null = null;

export function createActivityTracker(config?: Partial<ActivityTrackerConfig>): UserActivityTracker {
  if (globalTracker) {
    globalTracker.destroy();
  }

  globalTracker = new UserActivityTracker(config);
  return globalTracker;
}

export function getActivityTracker(): UserActivityTracker | null {
  return globalTracker;
}

export function destroyActivityTracker(): void {
  if (globalTracker) {
    globalTracker.destroy();
    globalTracker = null;
  }
}

export default UserActivityTracker;