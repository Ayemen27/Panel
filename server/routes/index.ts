/**
 * فهرس المسارات الموحد - النقطة المركزية لجميع مسارات API
 * يوفر إعداد تدريجي للبنية المعيارية مع الحفاظ على التوافق مع النظام الحالي
 */

import { Express } from 'express';
import { Server } from 'http';
import { storage } from '../storage';
import { ServiceContainer } from '../core/ServiceContainer';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { 
  errorHandler, 
  notFoundHandler,
  sanitizeInput
} from '../middleware';

// Import existing route modules
import { registerRoutes as registerLegacyRoutes } from '../routes.js';
import unifiedFileRoutes from './unifiedFileRoutes';
import unifiedNotificationRoutes from './UnifiedNotificationRoutes';

// Import for future modular routes (placeholder structure)
// import adminRoutes from './modules/admin.routes';
// import applicationRoutes from './modules/application.routes';
// import domainRoutes from './modules/domain.routes';
// import sslRoutes from './modules/ssl.routes';
// import nginxRoutes from './modules/nginx.routes';
// import notificationRoutes from './modules/notification.routes';
// import systemRoutes from './modules/system.routes';
// import dashboardRoutes from './modules/dashboard.routes';
// import userActivityRoutes from './modules/userActivity.routes';
// import frontendErrorRoutes from './modules/frontendError.routes';

/**
 * تصنيف المسارات حسب النطاق (للمرحلة القادمة من إعادة الهيكلة)
 */
export const RouteCategories = {
  ADMIN: 'admin',                    // إدارة المستخدمين والمسارات
  APPLICATIONS: 'applications',      // إدارة التطبيقات
  DOMAINS: 'domains',               // إدارة النطاقات
  SSL: 'ssl',                       // إدارة شهادات SSL
  NGINX: 'nginx',                   // إدارة إعدادات Nginx
  NOTIFICATIONS: 'notifications',    // إدارة الإشعارات
  SYSTEM: 'system',                 // مراقبة النظام والسجلات
  DASHBOARD: 'dashboard',           // لوحة التحكم والإحصائيات
  USER_ACTIVITY: 'user-activity',   // تتبع نشاط المستخدمين
  FRONTEND_ERRORS: 'frontend-errors', // أخطاء الواجهة الأمامية
  FILES: 'files',                   // إدارة الملفات (معيارية بالفعل)
  WEBSOCKET: 'websocket',          // الاتصال الفوري
  DATABASE: 'database',            // عمليات قاعدة البيانات
  BACKUP: 'backup',                // إدارة النسخ الاحتياطية
  TERMINAL: 'terminal'             // عمليات الطرفية
} as const;

/**
 * معلومات المسارات الحالية لتسهيل إعادة الهيكلة
 */
export const CurrentEndpoints = {
  [RouteCategories.ADMIN]: [
    'GET /api/admin/users',
    'PATCH /api/admin/users/:id/role',
    'GET /api/admin/paths',
    'POST /api/admin/paths',
    'PUT /api/admin/paths/:id',
    'DELETE /api/admin/paths/:id',
    'POST /api/admin/setup-default-paths'
  ],
  [RouteCategories.DASHBOARD]: [
    'GET /api/dashboard/stats'
  ],
  [RouteCategories.FRONTEND_ERRORS]: [
    'POST /api/frontend-errors',
    'POST /api/frontend-errors/batch',
    'GET /api/frontend-errors',
    'PATCH /api/frontend-errors/:id',
    'GET /api/frontend-errors/stats'
  ],
  [RouteCategories.USER_ACTIVITY]: [
    'POST /api/user-activities',
    'POST /api/user-activities/batch',
    'GET /api/user-activities',
    'GET /api/user-activities/stats',
    'GET /api/user-activities/session/:sessionId',
    'GET /api/user-activities/page-durations'
  ],
  [RouteCategories.APPLICATIONS]: [
    'GET /api/applications',
    'POST /api/applications',
    'GET /api/applications/:id',
    'PUT /api/applications/:id',
    'DELETE /api/applications/:id',
    'POST /api/applications/:id/start',
    'POST /api/applications/:id/stop',
    'POST /api/applications/:id/restart',
    'GET /api/applications/:id/status',
    'GET /api/applications/:id/logs'
  ],
  [RouteCategories.DOMAINS]: [
    'GET /api/domains',
    'POST /api/domains',
    'POST /api/domains/:id/check-dns'
  ],
  [RouteCategories.SSL]: [
    'GET /api/ssl-certificates',
    'POST /api/ssl-certificates'
  ],
  [RouteCategories.NGINX]: [
    'GET /api/nginx/configs',
    'POST /api/nginx/configs',
    'POST /api/nginx/test',
    'POST /api/nginx/reload'
  ],
  [RouteCategories.NOTIFICATIONS]: [
    'GET /api/notifications',
    'PATCH /api/notifications/:id/acknowledge',
    'PATCH /api/notifications/:id/resolve',
    'POST /api/notifications/mark-all-read',
    'GET /api/notifications/unread-count',
    'GET /api/notifications/stats'
  ],
  [RouteCategories.SYSTEM]: [
    'GET /api/system/stats',
    'GET /api/system/health',
    'GET /api/system/processes',
    'POST /api/system/cleanup',
    'POST /api/system/restart',
    'GET /api/system/logs',
    'POST /api/system/logs',
    'GET /api/system/terminal/create',
    'POST /api/system/terminal/:id/command',
    'DELETE /api/system/terminal/:id'
  ],
  [RouteCategories.FILES]: [
    // ملاحظة: مسارات الملفات معيارية بالفعل في unifiedFileRoutes
    'مسارات الملفات متوفرة في unifiedFileRoutes.ts'
  ],
  [RouteCategories.DATABASE]: [
    'POST /api/database/test',
    'GET /api/database/stats',
    'POST /api/database/query',
    'GET /api/database/schema'
  ],
  [RouteCategories.BACKUP]: [
    'GET /api/backup/list',
    'POST /api/backup/create',
    'POST /api/backup/restore',
    'DELETE /api/backup/:id',
    'GET /api/backup/status'
  ]
} as const;

/**
 * إعداد خدمة الحقن للطلبات (Dependency Injection)
 */
const setupServiceInjection = (app: Express): void => {
  app.use('/api', (req: AuthenticatedRequest, res, next) => {
    // إنشاء حاوي خدمات جديد لكل طلب لمنع تسريب البيانات
    req.services = new ServiceContainer(storage);
    next();
  });
};

/**
 * إعداد المعالجة العامة للمسارات
 */
const setupGlobalMiddleware = (app: Express): void => {
  // تنظيف المدخلات لجميع مسارات API
  app.use('/api', sanitizeInput);
  
  // معلومات إضافية للتشخيص (في بيئة التطوير فقط)
  if (process.env.NODE_ENV !== 'production') {
    app.use('/api', (req: AuthenticatedRequest, res, next) => {
      console.log(`🔄 API Request: ${req.method} ${req.path}`, {
        timestamp: new Date().toISOString(),
        userId: req.user?.id || 'anonymous',
        sessionId: req.sessionID || 'none'
      });
      next();
    });
  }
};

/**
 * تسجيل المسارات المعيارية الحالية
 */
const registerModularRoutes = (app: Express): void => {
  // المسارات المعيارية الموجودة
  app.use('/api/files', unifiedFileRoutes);
  app.use('/api/notifications', unifiedNotificationRoutes);
  
  // مسارات معيارية مستقبلية (ستتم إضافتها تدريجياً)
  // app.use('/api/admin', adminRoutes);
  // app.use('/api/applications', applicationRoutes);
  // app.use('/api/domains', domainRoutes);
  // app.use('/api/ssl', sslRoutes);
  // app.use('/api/nginx', nginxRoutes);
  // app.use('/api/system', systemRoutes);
  // app.use('/api/dashboard', dashboardRoutes);
  // app.use('/api/user-activities', userActivityRoutes);
  // app.use('/api/frontend-errors', frontendErrorRoutes);
};

/**
 * إعداد معالجة الأخطاء
 */
const setupErrorHandling = (app: Express): void => {
  // معالج 404 للمسارات غير الموجودة
  app.use(notFoundHandler);
  
  // معالج الأخطاء الرئيسي
  app.use(errorHandler);
};

/**
 * تسجيل جميع المسارات - النقطة المركزية
 */
export async function setupRoutes(app: Express): Promise<Server> {
  console.log('🚀 Setting up routes with new modular structure...');
  
  // 1. إعداد حقن الخدمات
  setupServiceInjection(app);
  
  // 2. إعداد المعالجة العامة
  setupGlobalMiddleware(app);
  
  // 3. تسجيل المسارات المعيارية الحالية
  registerModularRoutes(app);
  
  // 4. تسجيل المسارات القديمة (للتوافق المؤقت)
  // ملاحظة: سيتم إزالة هذا تدريجياً مع نقل المسارات إلى البنية المعيارية
  const server = await registerLegacyRoutes(app);
  
  // 5. إعداد معالجة الأخطاء (يجب أن يكون في النهاية)
  setupErrorHandling(app);
  
  console.log('✅ Routes setup completed successfully');
  console.log('📊 Route categories available:', Object.values(RouteCategories));
  
  return server;
}

/**
 * إعادة تصدير للتوافق
 */
export { setupRoutes as registerRoutes };

/**
 * معلومات التشخيص للمطورين
 */
export const RouteInfo = {
  categories: RouteCategories,
  endpoints: CurrentEndpoints,
  getEndpointsByCategory: (category: string) => CurrentEndpoints[category as keyof typeof CurrentEndpoints] || [],
  getAllEndpoints: () => Object.values(CurrentEndpoints).flat(),
  getModularRoutes: () => [
    '/api/files/*',
    '/api/notifications/*'
  ],
  getLegacyRoutes: () => Object.values(CurrentEndpoints).flat().filter(
    endpoint => !endpoint.includes('/api/files/') && !endpoint.includes('/api/notifications/')
  )
};

// تصدير للاستخدام الخارجي
export default setupRoutes;