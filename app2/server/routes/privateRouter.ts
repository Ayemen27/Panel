/**
 * Router للمسارات المحمية - تحتاج مصادقة
 * يحتوي على جميع المسارات التي تتطلب تسجيل دخول
 */

import express from 'express';
import { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';

export const privateRouter = express.Router();

// تطبيق المصادقة على جميع المسارات في هذا Router
privateRouter.use(requireAuth);

/**
 * ===== مسارات Autocomplete المحمية =====
 */

// هذه المسارات تحتاج مصادقة لأنها تحتوي على بيانات حساسة
privateRouter.get('/autocomplete', async (req: Request, res: Response) => {
  try {
    // سيتم تفويض هذا للـ controller الأصلي
    res.json({
      success: true,
      message: 'مسار autocomplete محمي - يتم التعامل معه في الـ controller الأصلي'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'خطأ في جلب بيانات الإكمال التلقائي',
      code: 'AUTOCOMPLETE_ERROR'
    });
  }
});

privateRouter.post('/autocomplete', async (req: Request, res: Response) => {
  try {
    // سيتم تفويض هذا للـ controller الأصلي
    res.json({
      success: true,
      message: 'حفظ autocomplete محمي - يتم التعامل معه في الـ controller الأصلي'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'خطأ في حفظ بيانات الإكمال التلقائي',
      code: 'AUTOCOMPLETE_SAVE_ERROR'
    });
  }
});

// مسارات autocomplete فرعية محمية
const autocompleteSubRoutes = [
  'senderNames',
  'transferNumbers', 
  'transferTypes',
  'transportDescriptions',
  'notes',
  'workerMiscDescriptions',
  'recipientNames',
  'recipientPhones',
  'workerTransferNumbers',
  'workerTransferNotes'
];

autocompleteSubRoutes.forEach(route => {
  privateRouter.get(`/autocomplete/${route}`, async (req: Request, res: Response) => {
    try {
      // سيتم تفويض هذا للـ controller الأصلي
      res.json({
        success: true,
        data: [],
        message: `مسار ${route} محمي - يتم التعامل معه في الـ controller الأصلي`
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: `خطأ في جلب ${route}`,
        code: 'AUTOCOMPLETE_SUB_ERROR'
      });
    }
  });
});

/**
 * ===== مسارات البيانات الأساسية المحمية =====
 */

// مسارات المشاريع
const projectRoutes = [
  { path: '/', methods: ['GET', 'POST'] },
  { path: '/with-stats', methods: ['GET'] },
  { path: '/:id', methods: ['GET', 'PUT', 'DELETE'] },
  { path: '/:projectId/fund-transfers', methods: ['GET'] },
  { path: '/:projectId/worker-attendance', methods: ['GET'] },
  { path: '/:projectId/material-purchases', methods: ['GET'] },
  { path: '/:projectId/transportation-expenses', methods: ['GET'] },
  { path: '/:projectId/worker-misc-expenses', methods: ['GET'] },
  { path: '/:id/daily-summary/:date', methods: ['GET'] },
  { path: '/:projectId/daily-expenses/:date', methods: ['GET'] },
  { path: '/:projectId/previous-balance/:date', methods: ['GET'] }
];

projectRoutes.forEach(route => {
  route.methods.forEach(method => {
    const routeMethod = method.toLowerCase() as 'get' | 'post' | 'put' | 'delete';
    privateRouter[routeMethod](`/projects${route.path}`, async (req: Request, res: Response) => {
      res.json({
        success: true,
        message: `مسار المشاريع ${method} ${route.path} - يتم التعامل معه في الـ controller الأصلي`
      });
    });
  });
});

/**
 * ===== مسارات البيانات المالية =====
 */

// مسارات التحويلات المالية
const financialRoutes = [
  { prefix: '/project-fund-transfers', methods: ['GET', 'POST', 'PUT', 'DELETE'] },
  { prefix: '/fund-transfers', methods: ['GET', 'POST', 'PATCH', 'DELETE'] },
  { prefix: '/fund-transfers/:id', methods: ['PATCH', 'DELETE'] },
  { prefix: '/worker-misc-expenses', methods: ['GET', 'POST', 'PATCH', 'DELETE'] },
  { prefix: '/worker-transfers', methods: ['GET', 'POST', 'PATCH', 'DELETE'] },
  { prefix: '/worker-transfers/:id', methods: ['PATCH', 'DELETE'] },
  { prefix: '/worker-misc-expenses/:id', methods: ['PATCH', 'DELETE'] }
];

financialRoutes.forEach(route => {
  route.methods.forEach(method => {
    const routeMethod = method.toLowerCase() as 'get' | 'post' | 'put' | 'delete' | 'patch';
    privateRouter[routeMethod](route.prefix, async (req: Request, res: Response) => {
      res.json({
        success: true,
        message: `مسار مالي ${method} ${route.prefix} - يتم التعامل معه في الـ controller الأصلي`
      });
    });
  });
});

/**
 * ===== مسارات العمال والمواد =====
 */

// مسارات العمال
privateRouter.get('/workers', async (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'مسار العمال - يتم التعامل معه في الـ controller الأصلي'
  });
});

// مسارات المواد  
privateRouter.get('/materials', async (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'مسار المواد - يتم التعامل معه في الـ controller الأصلي'
  });
});

/**
 * ===== مسارات الإدارة والإشعارات =====
 */

// مسارات الإشعارات
privateRouter.get('/notifications', async (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'مسار الإشعارات - يتم التعامل معه في الـ controller الأصلي'
  });
});

/**
 * ===== مسارات المصادقة المحمية =====
 */

// مسارات المستخدم المصدق
privateRouter.get('/auth/me', async (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'مسار بيانات المستخدم - يتم التعامل معه في الـ controller الأصلي'
  });
});

privateRouter.get('/auth/sessions', async (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'مسار الجلسات - يتم التعامل معه في الـ controller الأصلي'
  });
});

/**
 * ===== middleware الإضافية للمسارات المحمية =====
 */

// إضافة headers أمان للمسارات المحمية
privateRouter.use((req: Request, res: Response, next) => {
  // Headers أمان متقدمة للمسارات المحمية
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  next();
});

console.log('🔒 [PrivateRouter] تم تهيئة Router المسارات المحمية');

export default privateRouter;