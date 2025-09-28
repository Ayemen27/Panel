/**
 * مسارات الإشعارات الموحدة - مثال عملي لاستخدام النظام الموحد الجديد
 * يستخدم BaseService, ResponseHandler, و ServiceContainer
 */

import { Router } from 'express';
import { ResponseHandler } from '../../core/ResponseHandler';
import { UnifiedNotificationService } from '../../services/UnifiedNotificationService';
import { serviceInjectionMiddleware } from '../../core/ServiceContainer';
import { requireAuth } from '../../middleware/auth';
import { storage } from '../../storage';

const router = Router();

// تطبيق middleware حقن الخدمات
router.use(serviceInjectionMiddleware(storage));

// تطبيق middleware المصادقة على جميع مسارات الإشعارات
router.use(requireAuth);

/**
 * GET /api/notifications - الحصول على إشعارات المستخدم
 */
router.get('/', async (req, res) => {
  const notificationService = req.services.resolve(
    'notificationService', 
    UnifiedNotificationService
  );

  const { page, limit, type, acknowledged, resolved } = req.query;
  
  const options = {
    page: page ? parseInt(page as string) : undefined,
    limit: limit ? parseInt(limit as string) : undefined,
    type: type as string,
    acknowledged: acknowledged === 'true' ? true : acknowledged === 'false' ? false : undefined,
    resolved: resolved === 'true' ? true : resolved === 'false' ? false : undefined,
  };

  const result = await notificationService.getUserNotifications(options);
  
  if (result.success) {
    ResponseHandler.paginated(
      res,
      result.data!.notifications,
      {
        page: result.data!.page,
        limit: parseInt(limit as string) || 20,
        total: result.data!.total
      },
      'تم جلب الإشعارات بنجاح'
    );
  } else {
    ResponseHandler.fromServiceResult(res, result);
  }
});

/**
 * POST /api/notifications - إنشاء إشعار جديد
 */
router.post('/', async (req, res) => {
  const notificationService = req.services.resolve(
    'notificationService', 
    UnifiedNotificationService
  );

  const result = await notificationService.createNotification(req.body);
  ResponseHandler.fromServiceResult(res, result, 'تم إنشاء الإشعار بنجاح', 201);
});

/**
 * PUT /api/notifications/:id/read - تعليم إشعار كمقروء
 */
router.put('/:id/read', async (req, res) => {
  const notificationService = req.services.resolve(
    'notificationService', 
    UnifiedNotificationService
  );

  const result = await notificationService.markAsRead(req.params.id);
  ResponseHandler.fromServiceResult(res, result, 'تم تعليم الإشعار كمقروء');
});

/**
 * PUT /api/notifications/mark-all-read - تعليم جميع الإشعارات كمقروءة
 */
router.put('/mark-all-read', async (req, res) => {
  const notificationService = req.services.resolve(
    'notificationService', 
    UnifiedNotificationService
  );

  const result = await notificationService.markAllAsRead();
  
  if (result.success) {
    ResponseHandler.success(
      res, 
      { count: result.data }, 
      `تم تعليم ${result.data} إشعار كمقروء`
    );
  } else {
    ResponseHandler.fromServiceResult(res, result);
  }
});

/**
 * PUT /api/notifications/:id/resolve - حل إشعار (للمسؤولين)
 */
router.put('/:id/resolve', async (req, res) => {
  const notificationService = req.services.resolve(
    'notificationService', 
    UnifiedNotificationService
  );

  const result = await notificationService.resolveNotification(req.params.id);
  ResponseHandler.fromServiceResult(res, result, 'تم حل الإشعار بنجاح');
});

/**
 * GET /api/notifications/stats - الحصول على إحصائيات الإشعارات
 */
router.get('/stats', async (req, res) => {
  const notificationService = req.services.resolve(
    'notificationService', 
    UnifiedNotificationService
  );

  const result = await notificationService.getNotificationStats();
  ResponseHandler.fromServiceResult(res, result, 'تم جلب الإحصائيات بنجاح');
});

/**
 * POST /api/notifications/quick - إنشاء إشعار سريع
 */
router.post('/quick', async (req, res) => {
  const notificationService = req.services.resolve(
    'notificationService', 
    UnifiedNotificationService
  );

  const { type, title, message, level } = req.body;
  const result = await notificationService.createQuickNotification(type, title, message, level);
  ResponseHandler.fromServiceResult(res, result, 'تم إنشاء الإشعار السريع بنجاح', 201);
});

/**
 * POST /api/notifications/broadcast - إنشاء إشعار للجميع (للمسؤولين)
 */
router.post('/broadcast', async (req, res) => {
  const notificationService = req.services.resolve(
    'notificationService', 
    UnifiedNotificationService
  );

  const { type, title, message, level } = req.body;
  const result = await notificationService.createBroadcastNotification(type, title, message, level);
  
  if (result.success) {
    ResponseHandler.success(
      res, 
      { count: result.data!.length, notifications: result.data }, 
      `تم إرسال الإشعار إلى ${result.data!.length} مستخدم`, 
      201
    );
  } else {
    ResponseHandler.fromServiceResult(res, result);
  }
});

export { router as notificationRoutes };