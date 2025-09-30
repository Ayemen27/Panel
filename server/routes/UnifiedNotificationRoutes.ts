/**
 * مسارات الإشعارات الموحدة - مثال عملي لاستخدام النظام الموحد الجديد
 * يستخدم BaseService و ResponseHandler و ServiceContainer
 */

import { Router, Request, Response } from 'express';
import { ResponseHandler } from '../core/ResponseHandler';
import { ServiceContainer } from '../core/ServiceContainer';
import { UnifiedNotificationService } from '../services/UnifiedNotificationService';
import { ServiceTokens } from '../core/ServiceTokens';
import { serviceInjectionMiddleware } from '../core/ServiceContainer';
import { storage } from '../storage';
import { isAuthenticated, requireRole } from '../auth';

// Enhanced Request interface with services
interface AuthenticatedRequest extends Request {
  services: ServiceContainer;
  user?: any;
}

// إنشاء Router
const router = Router();

// تطبيق middleware لحقن الخدمات
router.use(serviceInjectionMiddleware(storage));

/**
 * جلب إشعارات المستخدم مع تصفح
 * GET /api/unified/notifications
 */
router.get('/', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // الحصول على خدمة الإشعارات من الحاوي
    const notificationService = req.services.resolveByToken<UnifiedNotificationService>(
      ServiceTokens.UNIFIED_NOTIFICATION_SERVICE
    );

    // المعاملات من query string
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100); // حد أقصى 100
    const type = req.query.type as string;
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
router.post('/', isAuthenticated, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const notificationService = req.services.resolveByToken<UnifiedNotificationService>(
      ServiceTokens.UNIFIED_NOTIFICATION_SERVICE
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
router.put('/:id/read', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const notificationService = req.services.resolveByToken<UnifiedNotificationService>(
      ServiceTokens.UNIFIED_NOTIFICATION_SERVICE
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
router.put('/read-all', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const notificationService = req.services.resolveByToken<UnifiedNotificationService>(
      ServiceTokens.UNIFIED_NOTIFICATION_SERVICE
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
router.put('/:id/resolve', isAuthenticated, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const notificationService = req.services.resolveByToken<UnifiedNotificationService>(
      ServiceTokens.UNIFIED_NOTIFICATION_SERVICE
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
router.get('/stats', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const notificationService = req.services.resolveByToken<UnifiedNotificationService>(
      ServiceTokens.UNIFIED_NOTIFICATION_SERVICE
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
router.post('/quick', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const notificationService = req.services.resolveByToken<UnifiedNotificationService>(
      ServiceTokens.UNIFIED_NOTIFICATION_SERVICE
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
router.post('/broadcast', isAuthenticated, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const notificationService = req.services.resolveByToken<UnifiedNotificationService>(
      ServiceTokens.UNIFIED_NOTIFICATION_SERVICE
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