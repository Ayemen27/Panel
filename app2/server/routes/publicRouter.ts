/**
 * Router للمسارات العامة - لا تحتاج مصادقة
 * يحتوي على مسارات الصحة، المصادقة، والبيانات العامة
 */

import express from 'express';
import { Request, Response } from 'express';
import { authRouteRateLimit } from '../config/routes.js';

export const publicRouter = express.Router();

/**
 * ===== مسارات الصحة والمراقبة =====
 */

// فحص صحة النظام
publicRouter.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'النظام يعمل بشكل طبيعي',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// فحص حالة النظام التفصيلية
publicRouter.get('/status', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      server: 'running',
      database: 'connected',
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
      },
      uptime: {
        seconds: Math.floor(process.uptime()),
        formatted: Math.floor(process.uptime() / 3600) + 'h ' + Math.floor((process.uptime() % 3600) / 60) + 'm'
      }
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * ===== مسارات المصادقة العامة =====
 */

// سيتم استيراد controllers المصادقة من مكانها الأصلي
// هذه المسارات لتنظيم فقط، التطبيق الفعلي في controllers منفصلة

// تطبيق rate limiting خاص للمصادقة
publicRouter.use('/auth/*', authRouteRateLimit);

/**
 * ===== مسارات البيانات العامة =====
 */

// مسار أنواع العمال - بيانات غير حساسة
publicRouter.get('/worker-types', async (req: Request, res: Response) => {
  try {
    // هذا المسار سيتم تفويضه للـ controller الأصلي
    // هنا للتوضيح فقط
    res.json({
      success: true,
      message: 'مسار عام - يتم التعامل معه في الـ controller الأصلي'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'خطأ في جلب أنواع العمال',
      code: 'WORKER_TYPES_ERROR'
    });
  }
});

/**
 * ===== مسارات CORS والفحص المسبق =====
 */

// دعم OPTIONS لجميع المسارات العامة
publicRouter.options('*', (req: Request, res: Response) => {
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Max-Age', '3600');
  res.sendStatus(200);
});

/**
 * ===== مسارات Autocomplete العامة (فحص مسبق فقط) =====
 */

// HEAD و OPTIONS للـ autocomplete - للفحص المسبق فقط
publicRouter.head('/autocomplete', (req: Request, res: Response) => {
  console.log('📊 [API] جلب بيانات الإكمال التلقائي');
  
  // إرسال headers فقط بدون body
  res.set({
    'Content-Type': 'application/json',
    'X-Autocomplete-Available': 'true',
    'X-Rate-Limit-Remaining': '100'
  });
  
  res.sendStatus(200);
});

// OPTIONS للـ autocomplete
publicRouter.options('/autocomplete', (req: Request, res: Response) => {
  res.header('Access-Control-Allow-Methods', 'GET, POST, HEAD, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('X-Autocomplete-Methods', 'GET,POST,HEAD');
  res.sendStatus(200);
});

/**
 * ===== middleware الإضافية للمسارات العامة =====
 */

// إضافة headers أمان للمسارات العامة
publicRouter.use((req: Request, res: Response, next) => {
  // Headers أمان أساسية للمسارات العامة
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
  });
  next();
});

console.log('🌐 [PublicRouter] تم تهيئة Router المسارات العامة');

export default publicRouter;