/**
 * مسارات الإشعارات الموحدة - مثال عملي لاستخدام النظام الموحد الجديد
 * يستخدم BaseService و ResponseHandler و ServiceContainer
 */

import { Router } from 'express';
import { ResponseHandler } from '../core/ResponseHandler';
import { ServiceContainer } from '../core/ServiceContainer';
import { UnifiedNotificationService } from '../services/UnifiedNotificationService';
import { serviceInjectionMiddleware } from '../core/ServiceContainer';
import { storage } from '../storage';

// إنشاء Router
const router = Router();

// تطبيق middleware لحقن الخدمات
router.use(serviceInjectionMiddleware(storage));

/**
 * جلب إشعارات المستخدم مع تصفح
 * GET /api/unified/notifications
 */
router.get('/', async (req: any, res) => {
  try {
    // الحصول على خدمة الإشعارات من الحاوي
    const notificationService = req.services.resolve(
      'notificationService', 
      UnifiedNotificationService
    );

    // المعاملات من query string
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100); // حد أقصى 100
    const type = req.query.type;
    const acknowledged = req.query.acknowledged === 'true' ? true : 
                        req.query.acknowledged === 'false' ? false : undefined;
    const resolved = req.query.resolved === 'true' ? true : 
                     req.query.resolved === 'false' ? false : undefined;

    // جلب الإشعارات
    const result = await notificationService.getUserNotifications({
      page,
      limit,
      type,
      acknowledged,
      resolved
    });

    // إرسال استجابة مع تصفح
    ResponseHandler.fromServiceResult(
      res,
      result,
      'تم جلب الإشعارات بنجاح'
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطأ غير معروف';
    ResponseHandler.error(res, message, 500, 'INTERNAL_ERROR');
  }
});

/**
 * إنشاء إشعار جديد (للمسؤولين)
 * POST /api/unified/notifications
 */
router.post('/', async (req: any, res) => {
  try {
    const notificationService = req.services.resolve(
      'notificationService', 
      UnifiedNotificationService
    );

    // إنشاء الإشعار
    const result = await notificationService.createNotification(req.body);

    ResponseHandler.fromServiceResult(
      res,
      result,
      'تم إنشاء الإشعار بنجاح',
      201
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطأ غير معروف';
    ResponseHandler.error(res, message, 500, 'INTERNAL_ERROR');
  }
});

/**
 * تعليم إشعار كمقروء
 * PUT /api/unified/notifications/:id/read
 */
router.put('/:id/read', async (req: any, res) => {
  try {
    const notificationService = req.services.resolve(
      'notificationService', 
      UnifiedNotificationService
    );

    const result = await notificationService.markAsRead(req.params.id);

    ResponseHandler.fromServiceResult(
      res,
      result,
      'تم تعليم الإشعار كمقروء'
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطأ غير معروف';
    ResponseHandler.error(res, message, 500, 'INTERNAL_ERROR');
  }
});

/**
 * تعليم جميع الإشعارات كمقروءة
 * PUT /api/unified/notifications/read-all
 */
router.put('/read-all', async (req: any, res) => {
  try {
    const notificationService = req.services.resolve(
      'notificationService', 
      UnifiedNotificationService
    );

    const result = await notificationService.markAllAsRead();

    ResponseHandler.fromServiceResult(
      res,
      result,
      `تم تعليم ${result.data} إشعار كمقروء`
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطأ غير معروف';
    ResponseHandler.error(res, message, 500, 'INTERNAL_ERROR');
  }
});

/**
 * حل إشعار (للمسؤولين)
 * PUT /api/unified/notifications/:id/resolve
 */
router.put('/:id/resolve', async (req: any, res) => {
  try {
    const notificationService = req.services.resolve(
      'notificationService', 
      UnifiedNotificationService
    );

    const result = await notificationService.resolveNotification(req.params.id);

    ResponseHandler.fromServiceResult(
      res,
      result,
      'تم حل الإشعار بنجاح'
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطأ غير معروف';
    ResponseHandler.error(res, message, 500, 'INTERNAL_ERROR');
  }
});

/**
 * الحصول على إحصائيات الإشعارات
 * GET /api/unified/notifications/stats
 */
router.get('/stats', async (req: any, res) => {
  try {
    const notificationService = req.services.resolve(
      'notificationService', 
      UnifiedNotificationService
    );

    const result = await notificationService.getNotificationStats();

    ResponseHandler.fromServiceResult(
      res,
      result,
      'تم جلب إحصائيات الإشعارات'
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطأ غير معروف';
    ResponseHandler.error(res, message, 500, 'INTERNAL_ERROR');
  }
});

/**
 * إنشاء إشعار سريع
 * POST /api/unified/notifications/quick
 */
router.post('/quick', async (req: any, res) => {
  try {
    const notificationService = req.services.resolve(
      'notificationService', 
      UnifiedNotificationService
    );

    const { type, title, message, level = 'medium' } = req.body;

    if (!type || !title || !message) {
      return ResponseHandler.error(
        res, 
        'البيانات المطلوبة: type, title, message', 
        400, 
        'MISSING_REQUIRED_FIELDS'
      );
    }

    const result = await notificationService.createQuickNotification(
      type, title, message, level
    );

    ResponseHandler.fromServiceResult(
      res,
      result,
      'تم إنشاء الإشعار السريع بنجاح',
      201
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطأ غير معروف';
    ResponseHandler.error(res, message, 500, 'INTERNAL_ERROR');
  }
});

/**
 * إنشاء إشعار للجميع (للمسؤولين)
 * POST /api/unified/notifications/broadcast
 */
router.post('/broadcast', async (req: any, res) => {
  try {
    const notificationService = req.services.resolve(
      'notificationService', 
      UnifiedNotificationService
    );

    const { type, title, message, level = 'medium' } = req.body;

    if (!type || !title || !message) {
      return ResponseHandler.error(
        res, 
        'البيانات المطلوبة: type, title, message', 
        400, 
        'MISSING_REQUIRED_FIELDS'
      );
    }

    const result = await notificationService.createBroadcastNotification(
      type, title, message, level
    );

    ResponseHandler.fromServiceResult(
      res,
      result,
      `تم إنشاء إشعار للجميع - وصل إلى ${result.data?.length || 0} مستخدم`,
      201
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطأ غير معروف';
    ResponseHandler.error(res, message, 500, 'INTERNAL_ERROR');
  }
});

export default router;