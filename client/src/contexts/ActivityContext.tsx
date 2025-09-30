import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { UserActivityTracker, ActivityTrackerConfig, createActivityTracker, getActivityTracker, destroyActivityTracker } from '@/lib/userActivityTracker';

// أنواع البيانات
export interface User {
  id: string;
  username: string;
  role: string;
  email?: string;
}

export interface SessionInfo {
  sessionId: string;
  startTime: number;
  isActive: boolean;
  userId?: string;
  userInfo?: User;
}

export interface TrackingSettings {
  enabled: boolean;
  trackClicks: boolean;
  trackNavigation: boolean;
  trackFormInputs: boolean;
  trackScrolling: boolean;
  trackMouseMovements: boolean;
  trackKeystrokes: boolean;
  trackClipboardEvents: boolean;
  trackFileOperations: boolean;
  enableOfflineSupport: boolean;
  batchSize: number;
  batchTimeout: number;
  enableDebouncing: boolean;
  enableConsoleLogging: boolean;
  enableLocalStorage: boolean;
  excludePages: string[];
  excludeElements: string[];
  sensitiveFields: string[];
}

export interface ActivityStats {
  totalActivities: number;
  activitiesThisSession: number;
  queueSize: number;
  lastFlushTime?: number;
  averageActivitiesPerMinute: number;
  topPages: Array<{ page: string; count: number }>;
  topActions: Array<{ action: string; count: number }>;
}

export interface ActivityContextType {
  // الحالة الأساسية
  isInitialized: boolean;
  isTracking: boolean;
  isOnline: boolean;
  session: SessionInfo | null;
  settings: TrackingSettings;
  stats: ActivityStats;
  tracker: UserActivityTracker | null;

  // طرق التحكم
  initializeTracking: (config?: Partial<ActivityTrackerConfig>) => void;
  startTracking: () => void;
  stopTracking: () => void;
  pauseTracking: () => void;
  resumeTracking: () => void;
  updateSettings: (newSettings: Partial<TrackingSettings>) => void;
  setUser: (user: User | null) => void;
  
  // طرق التتبع المباشر
  trackCustomAction: (action: string, metadata?: Record<string, any>) => void;
  trackSearch: (query: string, results?: number) => void;
  trackFilter: (filterType: string, filterValue: string) => void;
  trackFileUpload: (fileName: string, fileSize: number, fileType: string) => void;
  trackFileDownload: (fileName: string, downloadUrl?: string) => void;
  
  // طرق البيانات
  flushActivities: () => Promise<void>;
  clearQueue: () => void;
  getSessionStats: () => ActivityStats;
  exportSessionData: () => any[];
}

// الإعدادات الافتراضية
const DEFAULT_SETTINGS: TrackingSettings = {
  enabled: true,
  trackClicks: true,
  trackNavigation: true,
  trackFormInputs: true,
  trackScrolling: true,
  trackMouseMovements: false,
  trackKeystrokes: true,
  trackClipboardEvents: true,
  trackFileOperations: true,
  enableOfflineSupport: true,
  batchSize: 10,
  batchTimeout: 30000,
  enableDebouncing: true,
  enableConsoleLogging: false,
  enableLocalStorage: true,
  excludePages: ['/admin/system', '/api'],
  excludeElements: ['[data-no-track]', '.no-track', '.sensitive'],
  sensitiveFields: ['password', 'creditCard', 'ssn', 'token', 'key']
};

// إنشاء Context
const ActivityContext = createContext<ActivityContextType | undefined>(undefined);

// Hook للوصول للـ Context
export const useActivityContext = (): ActivityContextType => {
  const context = useContext(ActivityContext);
  if (!context) {
    throw new Error('useActivityContext must be used within an ActivityProvider');
  }
  return context;
};

// مكون Provider
export interface ActivityProviderProps {
  children: ReactNode;
  initialConfig?: Partial<ActivityTrackerConfig>;
  initialSettings?: Partial<TrackingSettings>;
  user?: User | null;
  enableByDefault?: boolean;
}

export const ActivityProvider = ({ 
  children, 
  initialConfig = {}, 
  initialSettings = {},
  user = null,
  enableByDefault = true
}: ActivityProviderProps) => {
  
  // الحالة الأساسية
  const [isInitialized, setIsInitialized] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [tracker, setTracker] = useState<UserActivityTracker | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(user);
  
  // الإعدادات والإحصائيات
  const [settings, setSettings] = useState<TrackingSettings>({
    ...DEFAULT_SETTINGS,
    ...initialSettings
  });
  
  const [stats, setStats] = useState<ActivityStats>({
    totalActivities: 0,
    activitiesThisSession: 0,
    queueSize: 0,
    averageActivitiesPerMinute: 0,
    topPages: [],
    topActions: []
  });

  // مراقبة حالة الاتصال
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // تحديث الإحصائيات بشكل دوري
  useEffect(() => {
    let statsInterval: NodeJS.Timeout;

    if (isTracking && tracker) {
      statsInterval = setInterval(() => {
        updateStats();
      }, 5000); // تحديث كل 5 ثوانِ
    }

    return () => {
      if (statsInterval) {
        clearInterval(statsInterval);
      }
    };
  }, [isTracking, tracker]);

  // تهيئة التتبع
  const initializeTracking = useCallback((config: Partial<ActivityTrackerConfig> = {}) => {
    try {
      // إنشاء إعدادات متكاملة
      const fullConfig: Partial<ActivityTrackerConfig> = {
        apiEndpoint: '/api/user-activities',
        batchEndpoint: '/api/user-activities/batch',
        enableConsoleLogging: settings.enableConsoleLogging,
        enableLocalStorage: settings.enableLocalStorage,
        batchSize: settings.batchSize,
        batchTimeout: settings.batchTimeout,
        enableDebouncing: settings.enableDebouncing,
        trackScrollEvents: settings.trackScrolling,
        trackMouseMovements: settings.trackMouseMovements,
        trackKeystrokes: settings.trackKeystrokes,
        trackClipboardEvents: settings.trackClipboardEvents,
        trackFileOperations: settings.trackFileOperations,
        enableOfflineSupport: settings.enableOfflineSupport,
        excludePages: settings.excludePages,
        excludeElements: settings.excludeElements,
        sensitiveFields: settings.sensitiveFields,
        ...initialConfig,
        ...config
      };

      const newTracker = createActivityTracker(fullConfig);
      setTracker(newTracker);

      // إنشاء جلسة جديدة
      const newSession: SessionInfo = {
        sessionId: newTracker.getSessionId(),
        startTime: Date.now(),
        isActive: true,
        userId: currentUser?.id,
        userInfo: currentUser || undefined
      };
      setSession(newSession);

      setIsInitialized(true);
      
      if (enableByDefault && settings.enabled) {
        setIsTracking(true);
      }

      if (settings.enableConsoleLogging) {
        console.log('🎯 Activity tracking initialized successfully');
      }
      
    } catch (error) {
      console.error('Failed to initialize activity tracking:', error);
    }
  }, [settings, currentUser, initialConfig, enableByDefault]);

  // بدء التتبع
  const startTracking = useCallback(() => {
    if (!isInitialized) {
      initializeTracking();
      return;
    }
    setIsTracking(true);
  }, [isInitialized, initializeTracking]);

  // إيقاف التتبع
  const stopTracking = useCallback(() => {
    setIsTracking(false);
    if (tracker) {
      tracker.flush();
    }
  }, [tracker]);

  // إيقاف مؤقت
  const pauseTracking = useCallback(() => {
    setIsTracking(false);
  }, []);

  // استئناف التتبع
  const resumeTracking = useCallback(() => {
    if (isInitialized) {
      setIsTracking(true);
    }
  }, [isInitialized]);

  // تحديث الإعدادات
  const updateSettings = useCallback((newSettings: Partial<TrackingSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
    
    // إذا كان التتبع مفعل، أعد التهيئة بالإعدادات الجديدة
    if (isInitialized && isTracking) {
      setTimeout(() => {
        initializeTracking();
      }, 100);
    }
  }, [isInitialized, isTracking, initializeTracking]);

  // تحديد المستخدم
  const setUser = useCallback((user: User | null) => {
    setCurrentUser(user);
    
    if (session) {
      setSession(prev => prev ? {
        ...prev,
        userId: user?.id,
        userInfo: user || undefined
      } : null);
    }
  }, [session]);

  // طرق التتبع المباشر
  const trackCustomAction = useCallback((action: string, metadata?: Record<string, any>) => {
    if (isTracking && tracker) {
      tracker.trackCustomAction(action, metadata);
    }
  }, [isTracking, tracker]);

  const trackSearch = useCallback((query: string, results?: number) => {
    if (isTracking && tracker) {
      tracker.trackSearch(query, results);
    }
  }, [isTracking, tracker]);

  const trackFilter = useCallback((filterType: string, filterValue: string) => {
    if (isTracking && tracker) {
      tracker.trackFilter(filterType, filterValue);
    }
  }, [isTracking, tracker]);

  const trackFileUpload = useCallback((fileName: string, fileSize: number, fileType: string) => {
    if (isTracking && tracker) {
      tracker.trackFileUpload(fileName, fileSize, fileType);
    }
  }, [isTracking, tracker]);

  const trackFileDownload = useCallback((fileName: string, downloadUrl?: string) => {
    if (isTracking && tracker) {
      tracker.trackFileDownload(fileName, downloadUrl);
    }
  }, [isTracking, tracker]);

  // طرق البيانات
  const flushActivities = useCallback(async () => {
    if (tracker) {
      await tracker.flush();
      updateStats();
    }
  }, [tracker]);

  const clearQueue = useCallback(() => {
    setStats(prev => ({ ...prev, queueSize: 0 }));
  }, []);

  const updateStats = useCallback(() => {
    if (!tracker) return;

    const queueSize = tracker.getQueueSize();
    const sessionDuration = session ? Date.now() - session.startTime : 0;
    const sessionMinutes = sessionDuration / (1000 * 60);
    
    setStats(prev => ({
      ...prev,
      queueSize,
      activitiesThisSession: prev.activitiesThisSession,
      averageActivitiesPerMinute: sessionMinutes > 0 ? prev.activitiesThisSession / sessionMinutes : 0,
      lastFlushTime: Date.now()
    }));
  }, [tracker, session]);

  const getSessionStats = useCallback((): ActivityStats => {
    updateStats();
    return stats;
  }, [stats, updateStats]);

  const exportSessionData = useCallback(() => {
    return {
      session,
      settings,
      stats,
      timestamp: new Date().toISOString()
    };
  }, [session, settings, stats]);

  // تنظيف عند إغلاق المكون
  useEffect(() => {
    return () => {
      if (tracker) {
        tracker.destroy();
      }
      destroyActivityTracker();
    };
  }, [tracker]);

  // تهيئة تلقائية عند التحميل
  useEffect(() => {
    if (!isInitialized && enableByDefault) {
      initializeTracking();
    }
  }, [isInitialized, enableByDefault, initializeTracking]);

  // قيم الـ Context
  const contextValue: ActivityContextType = {
    // الحالة الأساسية
    isInitialized,
    isTracking,
    isOnline,
    session,
    settings,
    stats,
    tracker,

    // طرق التحكم
    initializeTracking,
    startTracking,
    stopTracking,
    pauseTracking,
    resumeTracking,
    updateSettings,
    setUser,

    // طرق التتبع المباشر
    trackCustomAction,
    trackSearch,
    trackFilter,
    trackFileUpload,
    trackFileDownload,

    // طرق البيانات
    flushActivities,
    clearQueue,
    getSessionStats,
    exportSessionData
  };

  return (
    <ActivityContext.Provider value={contextValue}>
      {children}
    </ActivityContext.Provider>
  );
};

// Hook مبسط للوصول السريع للـ tracker
export const useActivityTracker = () => {
  const { tracker, isTracking } = useActivityContext();
  return {
    tracker,
    isTracking,
    isAvailable: !!tracker && isTracking
  };
};

// Hook لتتبع الأنشطة المخصصة
export const useCustomTracking = () => {
  const { 
    trackCustomAction, 
    trackSearch, 
    trackFilter, 
    trackFileUpload, 
    trackFileDownload,
    isTracking 
  } = useActivityContext();

  return {
    trackAction: trackCustomAction,
    trackSearch,
    trackFilter,
    trackFileUpload,
    trackFileDownload,
    isActive: isTracking
  };
};

// Hook لإدارة الجلسة
export const useSession = () => {
  const { session, setUser, flushActivities, exportSessionData } = useActivityContext();
  
  return {
    session,
    setUser,
    flushActivities,
    exportSessionData,
    isActive: session?.isActive || false,
    sessionId: session?.sessionId,
    userId: session?.userId,
    startTime: session?.startTime
  };
};

// Hook للإحصائيات
export const useActivityStats = () => {
  const { stats, getSessionStats } = useActivityContext();
  
  return {
    stats,
    refresh: getSessionStats,
    totalActivities: stats.totalActivities,
    sessionActivities: stats.activitiesThisSession,
    queueSize: stats.queueSize,
    averagePerMinute: stats.averageActivitiesPerMinute
  };
};

export default ActivityProvider;