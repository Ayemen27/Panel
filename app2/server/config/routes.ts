/**
 * نظام متطور لإدارة المسارات العامة والخاصة
 * يدعم HTTP methods مختلفة، wildcards، regex، والمسارات الديناميكية
 */

import rateLimit from "express-rate-limit";

// تعريف أنواع HTTP Methods المدعومة
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS' | '*';

// تعريف نوع المسار مع معاملاته
export interface RoutePattern {
  path: string;
  methods: HttpMethod[];
  description: string;
  isRegex?: boolean;
  isWildcard?: boolean;
  parameters?: string[];
  rateLimit?: {
    windowMs: number;
    max: number;
    message: string;
  };
}

// تعريف مجموعة المسارات
export interface RouteGroup {
  name: string;
  description: string;
  routes: RoutePattern[];
  globalRateLimit?: {
    windowMs: number;
    max: number;
    message: string;
  };
}

/**
 * تكوين المسارات العامة - لا تحتاج مصادقة
 */
export const PUBLIC_ROUTES: RouteGroup[] = [
  {
    name: "auth",
    description: "مسارات المصادقة والتسجيل",
    routes: [
      {
        path: "/api/auth/login",
        methods: ["POST"],
        description: "تسجيل الدخول"
      },
      {
        path: "/api/auth/register", 
        methods: ["POST"],
        description: "إنشاء حساب جديد"
      },
      {
        path: "/api/auth/refresh",
        methods: ["POST"],
        description: "تجديد رمز المصادقة"
      },
      {
        path: "/api/auth/logout",
        methods: ["POST"],
        description: "تسجيل الخروج"
      }
    ],
    globalRateLimit: {
      windowMs: 15 * 60 * 1000, // 15 دقيقة
      max: 20, // 20 محاولة كل 15 دقيقة
      message: "تم تجاوز الحد المسموح لطلبات المصادقة"
    }
  },
  
  {
    name: "health_monitoring",
    description: "مسارات مراقبة صحة النظام",
    routes: [
      {
        path: "/api/health",
        methods: ["GET", "HEAD"],
        description: "فحص صحة النظام"
      },
      {
        path: "/api/status",
        methods: ["GET"],
        description: "حالة النظام التفصيلية"
      }
    ]
  },

  {
    name: "autocomplete_preflight",
    description: "طلبات الـ preflight والفحص للـ autocomplete",
    routes: [
      {
        path: "/api/autocomplete",
        methods: ["HEAD", "OPTIONS"],
        description: "طلبات الفحص المسبق للـ autocomplete"
      }
    ],
    globalRateLimit: {
      windowMs: 1 * 60 * 1000, // دقيقة واحدة
      max: 100, // 100 طلب فحص كل دقيقة
      message: "تم تجاوز الحد المسموح لطلبات الفحص"
    }
  },

  {
    name: "public_data",
    description: "البيانات العامة غير الحساسة",
    routes: [
      {
        path: "/api/worker-types",
        methods: ["GET"],
        description: "قائمة أنواع العمال - بيانات غير حساسة"
      }
    ]
  },

  {
    name: "cors_preflight",
    description: "طلبات CORS المسبقة",
    routes: [
      {
        path: "/api/*",
        methods: ["OPTIONS"],
        description: "طلبات OPTIONS لجميع المسارات",
        isWildcard: true
      }
    ]
  }
];

/**
 * المسارات المحمية - تحتاج مصادقة
 */
export const PROTECTED_ROUTES: RouteGroup[] = [
  {
    name: "autocomplete_data",
    description: "بيانات الـ autocomplete - محمية",
    routes: [
      {
        path: "/api/autocomplete",
        methods: ["GET", "POST"],
        description: "جلب وإرسال بيانات autocomplete"
      },
      {
        path: "/api/autocomplete/senderNames",
        methods: ["GET"],
        description: "أسماء المرسلين للـ autocomplete"
      },
      {
        path: "/api/autocomplete/transferNumbers",
        methods: ["GET"],
        description: "أرقام التحويلات للـ autocomplete"
      },
      {
        path: "/api/autocomplete/transferTypes",
        methods: ["GET"],
        description: "أنواع التحويلات للـ autocomplete"
      },
      {
        path: "/api/autocomplete/transportDescriptions",
        methods: ["GET"],
        description: "أوصاف النقل للـ autocomplete"
      },
      {
        path: "/api/autocomplete/notes",
        methods: ["GET"],
        description: "الملاحظات للـ autocomplete"
      },
      {
        path: "/api/autocomplete/workerMiscDescriptions",
        methods: ["GET"],
        description: "أوصاف مصاريف العمال للـ autocomplete"
      }
    ],
    globalRateLimit: {
      windowMs: 1 * 60 * 1000, // دقيقة واحدة
      max: 200, // 200 طلب autocomplete كل دقيقة
      message: "تم تجاوز الحد المسموح لطلبات autocomplete"
    }
  },

  {
    name: "core_data",
    description: "البيانات الأساسية المحمية",
    routes: [
      {
        path: "/api/projects",
        methods: ["GET", "POST", "PUT", "DELETE"],
        description: "إدارة المشاريع"
      },
      {
        path: "/api/projects/with-stats",
        methods: ["GET"],
        description: "قائمة المشاريع مع الإحصائيات"
      },
      {
        path: "/api/projects/:id",
        methods: ["GET", "PUT", "DELETE"],
        description: "إدارة مشروع محدد",
        parameters: ["id"]
      },
      {
        path: "/api/projects/:projectId/fund-transfers",
        methods: ["GET"],
        description: "تحويلات عهدة مشروع محدد",
        parameters: ["projectId"]
      },
      {
        path: "/api/projects/:projectId/worker-attendance",
        methods: ["GET"],
        description: "حضور عمال مشروع محدد",
        parameters: ["projectId"]
      },
      {
        path: "/api/projects/:projectId/material-purchases",
        methods: ["GET"],
        description: "مشتريات مواد مشروع محدد",
        parameters: ["projectId"]
      },
      {
        path: "/api/projects/:projectId/transportation-expenses",
        methods: ["GET"],
        description: "مصاريف نقل مشروع محدد",
        parameters: ["projectId"]
      },
      {
        path: "/api/projects/:projectId/worker-misc-expenses",
        methods: ["GET"],
        description: "مصاريف عمال متنوعة لمشروع",
        parameters: ["projectId"]
      },
      {
        path: "/api/projects/:id/daily-summary/:date",
        methods: ["GET"],
        description: "ملخص يومي لمشروع في تاريخ محدد",
        parameters: ["id", "date"]
      },
      {
        path: "/api/projects/:projectId/daily-expenses/:date",
        methods: ["GET"],
        description: "مصاريف يومية لمشروع",
        parameters: ["projectId", "date"]
      },
      {
        path: "/api/projects/:projectId/previous-balance/:date",
        methods: ["GET"],
        description: "رصيد سابق لمشروع",
        parameters: ["projectId", "date"]
      },
      {
        path: "/api/workers",
        methods: ["GET", "POST", "PUT", "DELETE"],
        description: "إدارة العمال"
      },
      {
        path: "/api/workers/:id",
        methods: ["GET", "PUT", "DELETE"],
        description: "إدارة عامل محدد",
        parameters: ["id"]
      },
      {
        path: "/api/materials",
        methods: ["GET", "POST", "PUT", "DELETE"],
        description: "إدارة المواد"
      },
      {
        path: "/api/materials/:id",
        methods: ["GET", "PUT", "DELETE"],
        description: "إدارة مادة محددة",
        parameters: ["id"]
      },
      {
        path: "/api/suppliers",
        methods: ["GET", "POST", "PUT", "DELETE"],
        description: "إدارة الموردين"
      },
      {
        path: "/api/suppliers/:id",
        methods: ["GET", "PUT", "DELETE"],
        description: "إدارة مورد محدد",
        parameters: ["id"]
      },
      {
        path: "/api/material-purchases",
        methods: ["GET", "POST"],
        description: "مشتريات المواد"
      },
      {
        path: "/api/material-purchases/:id",
        methods: ["PUT", "DELETE"],
        description: "إدارة مشترية مواد محددة",
        parameters: ["id"]
      },
      {
        path: "/api/worker-attendance",
        methods: ["GET", "POST"],
        description: "حضور العمال"
      },
      {
        path: "/api/worker-attendance/:id",
        methods: ["PUT", "DELETE"],
        description: "إدارة سجل حضور محدد",
        parameters: ["id"]
      },
      {
        path: "/api/transportation-expenses",
        methods: ["GET", "POST"],
        description: "مصاريف المواصلات"
      },
      {
        path: "/api/transportation-expenses/:id",
        methods: ["PUT", "DELETE"],
        description: "إدارة مصروف مواصلات محدد",
        parameters: ["id"]
      },
      {
        path: "/api/daily-expense-summaries",
        methods: ["GET", "POST"],
        description: "ملخص المصروفات اليومية"
      },
      {
        path: "/api/daily-expense-summaries/:id",
        methods: ["PUT", "DELETE"],
        description: "إدارة ملخص مصروف يومي محدد",
        parameters: ["id"]
      }
    ]
  },

  {
    name: "financial_data",
    description: "البيانات المالية والتحويلات",
    routes: [
      {
        path: "/api/project-fund-transfers",
        methods: ["GET", "POST", "PUT", "DELETE"],
        description: "تحويلات أموال المشاريع"
      },
      {
        path: "/api/fund-transfers",
        methods: ["GET", "POST", "PATCH", "DELETE"],
        description: "تحويلات الأموال العامة"
      },
      {
        path: "/api/fund-transfers/:id",
        methods: ["PATCH", "DELETE"],
        description: "تعديل وحذف تحويل محدد",
        parameters: ["id"]
      },
      {
        path: "/api/worker-misc-expenses",
        methods: ["GET", "POST", "PATCH", "DELETE"],
        description: "مصاريف العمال المتنوعة"
      },
      {
        path: "/api/worker-transfers",
        methods: ["GET", "POST", "PATCH", "DELETE"],
        description: "تحويلات العمال"
      },
      {
        path: "/api/worker-transfers/:id",
        methods: ["PATCH", "DELETE"],
        description: "تعديل وحذف تحويل عامل محدد",
        parameters: ["id"]
      },
      {
        path: "/api/worker-misc-expenses/:id",
        methods: ["PATCH", "DELETE"],
        description: "تعديل وحذف مصروف عامل محدد",
        parameters: ["id"]
      }
    ],
    globalRateLimit: {
      windowMs: 1 * 60 * 1000, // دقيقة واحدة
      max: 60, // 60 طلب مالي كل دقيقة
      message: "تم تجاوز الحد المسموح للطلبات المالية"
    }
  },

  {
    name: "auth_protected",
    description: "مسارات المصادقة المحمية",
    routes: [
      {
        path: "/api/auth/me",
        methods: ["GET"],
        description: "جلب بيانات المستخدم الحالي"
      },
      {
        path: "/api/auth/sessions",
        methods: ["GET", "DELETE"],
        description: "إدارة جلسات المستخدم"
      },
      {
        path: "/api/auth/sessions/:sessionId",
        methods: ["DELETE"],
        description: "إنهاء جلسة محددة",
        parameters: ["sessionId"]
      },
      {
        path: "/api/auth/password",
        methods: ["PUT"],
        description: "تغيير كلمة المرور"
      },
      {
        path: "/api/auth/logout",
        methods: ["POST"],
        description: "تسجيل الخروج"
      }
    ],
    globalRateLimit: {
      windowMs: 15 * 60 * 1000, // 15 دقيقة
      max: 50, // 50 طلب مصادقة كل 15 دقيقة
      message: "تم تجاوز الحد المسموح لطلبات المصادقة"
    }
  },

  {
    name: "management_data",
    description: "بيانات الإدارة والتقارير",
    routes: [
      {
        path: "/api/notifications",
        methods: ["GET", "POST", "PUT", "DELETE"],
        description: "إدارة الإشعارات"
      },
      {
        path: "/api/notifications/:id/read",
        methods: ["POST"],
        description: "وضع علامة قراءة على إشعار",
        parameters: ["id"]
      },
      {
        path: "/api/notifications/mark-all-read",
        methods: ["POST"],
        description: "وضع علامة قراءة على جميع الإشعارات"
      },
      {
        path: "/api/tools",
        methods: ["GET", "POST", "PUT", "DELETE"],
        description: "إدارة الأدوات"
      },
      {
        path: "/api/tool-movements",
        methods: ["GET", "POST", "PUT", "DELETE"],
        description: "حركات الأدوات"
      }
    ]
  }
];

/**
 * كلاس متقدم لإدارة المسارات
 */
export class AdvancedRouteManager {
  private publicRouteMap: Map<string, Set<HttpMethod>>;
  private protectedRouteMap: Map<string, Set<HttpMethod>>;
  private wildcardRoutes: { pattern: RegExp; methods: Set<HttpMethod>; isPublic: boolean }[];
  private rateLimiters: Map<string, any>;

  constructor() {
    this.publicRouteMap = new Map();
    this.protectedRouteMap = new Map();
    this.wildcardRoutes = [];
    this.rateLimiters = new Map();
    this.initializeRoutes();
  }

  /**
   * تهيئة المسارات وإنشاء خرائط البحث السريع
   */
  private initializeRoutes(): void {
    // معالجة المسارات العامة
    PUBLIC_ROUTES.forEach(group => {
      group.routes.forEach(route => {
        this.processRoute(route, true, group.globalRateLimit);
      });
    });

    // معالجة المسارات المحمية
    PROTECTED_ROUTES.forEach(group => {
      group.routes.forEach(route => {
        this.processRoute(route, false, group.globalRateLimit);
      });
    });

    console.log(`🗺️ [RouteManager] تم تهيئة ${this.publicRouteMap.size} مسار عام و ${this.protectedRouteMap.size} مسار محمي`);
    console.log(`🔍 [RouteManager] تم تهيئة ${this.wildcardRoutes.length} مسار wildcard`);
  }

  /**
   * معالجة مسار واحد وإضافته للخرائط المناسبة
   */
  private processRoute(route: RoutePattern, isPublic: boolean, globalRateLimit?: any): void {
    if (route.isWildcard || route.path.includes('*')) {
      // تحويل wildcard إلى regex
      const regexPattern = route.path
        .replace(/\*/g, '.*')
        .replace(/:[^/]+/g, '[^/]+'); // دعم المعاملات مثل :projectId
      
      this.wildcardRoutes.push({
        pattern: new RegExp(`^${regexPattern}$`),
        methods: new Set(route.methods),
        isPublic
      });
    } else {
      const targetMap = isPublic ? this.publicRouteMap : this.protectedRouteMap;
      const methodSet = targetMap.get(route.path) || new Set();
      
      route.methods.forEach(method => {
        if (method === '*') {
          // إضافة جميع الـ methods
          ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].forEach(m => 
            methodSet.add(m as HttpMethod)
          );
        } else {
          methodSet.add(method);
        }
      });
      
      targetMap.set(route.path, methodSet);
    }

    // إنشاء rate limiter إذا لزم الأمر
    if (route.rateLimit || globalRateLimit) {
      const rateLimitConfig = route.rateLimit || globalRateLimit;
      const limiterId = `${route.path}:${route.methods.join(',')}`;
      
      this.rateLimiters.set(limiterId, rateLimit({
        windowMs: rateLimitConfig.windowMs,
        max: rateLimitConfig.max,
        message: {
          success: false,
          error: rateLimitConfig.message,
          code: 'RATE_LIMIT_EXCEEDED'
        },
        standardHeaders: true,
        legacyHeaders: false
      }));
    }
  }

  /**
   * فحص ما إذا كان المسار عامًا (لا يحتاج مصادقة)
   */
  public isPublicRoute(path: string, method: HttpMethod): boolean {
    // فحص المسارات المباشرة أولاً
    const publicMethods = this.publicRouteMap.get(path);
    if (publicMethods && (publicMethods.has(method) || publicMethods.has('*'))) {
      return true;
    }

    // فحص wildcards
    for (const wildcardRoute of this.wildcardRoutes) {
      if (wildcardRoute.isPublic && 
          wildcardRoute.pattern.test(path) && 
          (wildcardRoute.methods.has(method) || wildcardRoute.methods.has('*'))) {
        return true;
      }
    }

    return false;
  }

  /**
   * فحص ما إذا كان المسار محميًا (يحتاج مصادقة)
   */
  public isProtectedRoute(path: string, method: HttpMethod): boolean {
    // فحص المسارات المباشرة أولاً
    const protectedMethods = this.protectedRouteMap.get(path);
    if (protectedMethods && (protectedMethods.has(method) || protectedMethods.has('*'))) {
      return true;
    }

    // فحص wildcards
    for (const wildcardRoute of this.wildcardRoutes) {
      if (!wildcardRoute.isPublic && 
          wildcardRoute.pattern.test(path) && 
          (wildcardRoute.methods.has(method) || wildcardRoute.methods.has('*'))) {
        return true;
      }
    }

    return false;
  }

  /**
   * الحصول على rate limiter للمسار إذا وجد - محسن لدعم المعاملات
   */
  public getRateLimiter(path: string, method: HttpMethod): any {
    // البحث عن rate limiter مخصص للمسار والطريقة
    for (const [limiterId, limiter] of Array.from(this.rateLimiters.entries())) {
      const [limiterPath, methods] = limiterId.split(':');
      const methodsList = methods.split(',');
      
      // تحسين مطابقة المسارات مع المعاملات
      const isPathMatch = limiterPath === path || 
        this.matchesPatternWithParams(path, limiterPath);
      
      const isMethodMatch = methodsList.includes(method) || methodsList.includes('*');
      
      if (isPathMatch && isMethodMatch) {
        return limiter;
      }
    }
    
    return null;
  }

  /**
   * فحص مطابقة المسار مع نمط يحتوي على معاملات
   */
  private matchesPatternWithParams(actualPath: string, patternPath: string): boolean {
    // تحويل :param إلى [^/]+ في regex
    const regexPattern = patternPath
      .replace(/\*/g, '.*')
      .replace(/:[^/]+/g, '[^/]+');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(actualPath);
  }

  /**
   * استخراج المعاملات من المسار
   */
  public extractParameters(routePath: string, actualPath: string): Record<string, string> {
    const parameters: Record<string, string> = {};
    
    const routeParts = routePath.split('/');
    const actualParts = actualPath.split('/');
    
    if (routeParts.length !== actualParts.length) {
      return parameters;
    }
    
    for (let i = 0; i < routeParts.length; i++) {
      const routePart = routeParts[i];
      const actualPart = actualParts[i];
      
      if (routePart.startsWith(':')) {
        const paramName = routePart.substring(1);
        parameters[paramName] = actualPart;
      }
    }
    
    return parameters;
  }

  /**
   * الحصول على إحصائيات المسارات
   */
  public getRouteStats() {
    return {
      publicRoutes: this.publicRouteMap.size,
      protectedRoutes: this.protectedRouteMap.size,
      wildcardRoutes: this.wildcardRoutes.length,
      rateLimiters: this.rateLimiters.size,
      totalRoutes: this.publicRouteMap.size + this.protectedRouteMap.size + this.wildcardRoutes.length
    };
  }

  /**
   * طباعة تفاصيل المسارات للتتبع
   */
  public logRouteDetails(): void {
    console.log('🗺️ [RouteManager] تفاصيل المسارات:');
    console.log('📂 المسارات العامة:', Array.from(this.publicRouteMap.keys()));
    console.log('🔒 المسارات المحمية:', Array.from(this.protectedRouteMap.keys()));
    console.log('🔍 مسارات Wildcard:', this.wildcardRoutes.map(r => r.pattern.source));
  }
}

// إنشاء instance مشترك للاستخدام في التطبيق
export const routeManager = new AdvancedRouteManager();

// Rate limiters عامة للمسارات العامة
export const publicRouteRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 100, // 100 طلب كل 15 دقيقة للمسارات العامة
  message: {
    success: false,
    error: 'تم تجاوز الحد المسموح للطلبات العامة',
    code: 'PUBLIC_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // تطبيق فقط على المسارات العامة
  skip: (req) => {
    const path = req.path || req.url || '';
    const method = (req.method || 'GET') as HttpMethod;
    return !routeManager.isPublicRoute(path, method);
  }
});

export const authRouteRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 10, // 10 محاولات مصادقة كل 15 دقيقة
  message: {
    success: false,
    error: 'تم تجاوز الحد المسموح لمحاولات المصادقة',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // تطبيق فقط على مسارات المصادقة
  skip: (req) => {
    const path = req.path || req.url || '';
    return !path.startsWith('/api/auth/');
  }
});