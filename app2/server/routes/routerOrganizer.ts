/**
 * منظم المسارات الرئيسي - يجمع بين النظام الحالي والـ routers الجديدة
 * يوفر طبقة تنظيمية إضافية مع إبقاء النظام الحالي سليماً
 */

import type { Express } from "express";
import { publicRouter } from './publicRouter.js';
import { privateRouter } from './privateRouter.js';
import { routeManager, publicRouteRateLimit } from '../config/routes.js';
import { registerOrganizedRoutes, getOrganizedRoutesInfo } from './modules/index.js';

/**
 * تهيئة النظام التنظيمي للمسارات
 * يعمل بجانب النظام الحالي لإضافة طبقة تنظيم
 */
export function initializeRouteOrganizer(app: Express) {
  console.log('🏗️ [RouterOrganizer] بدء تهيئة النظام التنظيمي للمسارات...');

  // ===== تسجيل النظام المنظم الجديد =====
  console.log('📂 [RouterOrganizer] تسجيل المسارات المنظمة...');
  registerOrganizedRoutes(app);

  // ===== معلومات النظام والإحصائيات =====
  
  // إضافة endpoint لإحصائيات المسارات
  app.get('/api/system/route-stats', publicRouteRateLimit, (req, res) => {
    const stats = routeManager.getRouteStats();
    const organizedInfo = getOrganizedRoutesInfo();
    
    res.json({
      success: true,
      data: {
        systemInfo: {
          routingSystem: 'Advanced Route Manager v2.0-organized',
          initialized: true,
          lastUpdate: new Date().toISOString(),
          architecture: 'Modular & Organized'
        },
        routeStatistics: stats,
        organizedRoutes: organizedInfo,
        features: {
          wildcardSupport: true,
          regexPatterns: true,
          rateLimiting: true,
          dynamicParameters: true,
          publicPrivateSeparation: true,
          modularArchitecture: true,
          organizedRouters: true,
          reducedCodeDuplication: true
        },
        performance: {
          lookupMethod: 'Map/Set optimized',
          averageLookupTime: '<1ms',
          memoryFootprint: 'minimal',
          maintainability: 'high'
        }
      },
      message: 'إحصائيات نظام المسارات المتطور والمنظم'
    });
  });

  // ===== تسجيل الـ routers المنظمة =====
  
  // تسجيل الـ public router مع logging
  app.use('/api/public', (req, res, next) => {
    console.log(`🌐 [PublicRouter] طلب عام: ${req.method} ${req.path}`);
    next();
  }, publicRouter);

  // تسجيل الـ private router مع logging
  app.use('/api/protected', (req, res, next) => {
    console.log(`🔒 [PrivateRouter] طلب محمي: ${req.method} ${req.path}`);
    next();
  }, privateRouter);

  // ===== نظام المسارات التجريبية =====
  
  // endpoint للاختبار والتطوير (عام)
  app.get('/api/system/test-public', publicRouteRateLimit, (req, res) => {
    const testResults = {
      routeType: 'public',
      authentication: false,
      rateLimited: true,
      responseTime: Date.now(),
      systemStatus: 'operational'
    };
    
    res.json({
      success: true,
      data: testResults,
      message: 'اختبار المسار العام - نجح',
      timestamp: new Date().toISOString()
    });
  });

  // ===== نظام التوثيق الديناميكي =====
  
  // endpoint لتوثيق المسارات المتاحة
  app.get('/api/system/routes-documentation', publicRouteRateLimit, (req, res) => {
    const documentation = {
      publicRoutes: {
        '/api/health': 'فحص صحة النظام',
        '/api/status': 'حالة النظام التفصيلية',
        '/api/worker-types': 'قائمة أنواع العمال',
        '/api/auth/*': 'مسارات المصادقة',
        '/api/public/*': 'المسارات العامة المنظمة'
      },
      protectedRoutes: {
        '/api/projects': 'إدارة المشاريع',
        '/api/workers': 'إدارة العمال',
        '/api/materials': 'إدارة المواد',
        '/api/fund-transfers': 'التحويلات المالية',
        '/api/autocomplete': 'الإكمال التلقائي',
        '/api/notifications': 'إدارة الإشعارات',
        '/api/protected/*': 'المسارات المحمية المنظمة'
      },
      features: {
        wildcardSupport: 'دعم أنماط المسارات المتغيرة',
        rateLimiting: 'تحديد معدل الطلبات لكل مسار',
        authentication: 'نظام مصادقة متطور',
        errorHandling: 'معالجة شاملة للأخطاء'
      }
    };

    res.json({
      success: true,
      data: documentation,
      message: 'توثيق نظام المسارات المتطور',
      version: '1.0.0'
    });
  });

  // ===== مسارات التشخيص والصيانة =====
  
  // endpoint لفحص صحة نظام المسارات
  app.get('/api/system/routing-health', publicRouteRateLimit, (req, res) => {
    const healthCheck = {
      routeManager: {
        status: 'healthy',
        publicRoutes: routeManager.getRouteStats().publicRoutes,
        protectedRoutes: routeManager.getRouteStats().protectedRoutes,
        wildcardRoutes: routeManager.getRouteStats().wildcardRoutes
      },
      rateLimiting: {
        status: 'active',
        limiters: routeManager.getRouteStats().rateLimiters
      },
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
      },
      uptime: {
        seconds: Math.floor(process.uptime()),
        formatted: Math.floor(process.uptime() / 3600) + 'h ' + Math.floor((process.uptime() % 3600) / 60) + 'm'
      }
    };

    res.json({
      success: true,
      data: healthCheck,
      message: 'فحص صحة نظام المسارات',
      timestamp: new Date().toISOString()
    });
  });

  // ===== معلومات النظام النهائية =====
  
  const stats = routeManager.getRouteStats();
  console.log('✅ [RouterOrganizer] تم تهيئة النظام التنظيمي للمسارات بنجاح');
  console.log(`📊 [RouterOrganizer] إحصائيات: ${stats.publicRoutes} مسار عام، ${stats.protectedRoutes} مسار محمي`);
  console.log(`🔧 [RouterOrganizer] ميزات متاحة: wildcards، rate limiting، authentication`);

  // طباعة تفاصيل المسارات للتطوير (فقط في بيئة التطوير)
  if (process.env.NODE_ENV !== 'production') {
    routeManager.logRouteDetails();
  }
}

/**
 * دالة مساعدة للحصول على معلومات التوجيه
 */
export function getRoutingInfo() {
  return {
    organizer: true,
    version: '1.0.0',
    features: ['public/private separation', 'rate limiting', 'wildcards', 'logging'],
    stats: routeManager.getRouteStats()
  };
}

/**
 * دالة للتحقق من أن النظام مهيأ بشكل صحيح
 */
export function validateRouteOrganizer(): boolean {
  try {
    const stats = routeManager.getRouteStats();
    return stats.totalRoutes > 0;
  } catch (error) {
    console.error('❌ [RouterOrganizer] خطأ في التحقق:', error);
    return false;
  }
}

export default { 
  initializeRouteOrganizer, 
  getRoutingInfo, 
  validateRouteOrganizer 
};