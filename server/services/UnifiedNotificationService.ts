/**
 * خدمة الإشعارات الموحدة - مثال عملي لاستخدام النظام الموحد الجديد
 * تحل محل جميع خدمات الإشعارات المتفرقة وتوفر واجهة موحدة
 */

import { BaseService, ServiceResult } from '../core/BaseService';
// Injectable decorator محظور - استخدام manual registration
import { 
  notifications, 
  users,
  insertNotificationSchema, 
  type InsertNotification, 
  type Notification 
} from '@shared/schema';
// تم إزالة الاستيراد المباشر لقاعدة البيانات - استخدام storage interface فقط

export interface NotificationListOptions {
  page?: number;
  limit?: number;
  type?: string;
  acknowledged?: boolean;
  resolved?: boolean;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byType: { type: string; count: number }[];
  last24Hours: number;
}

export class UnifiedNotificationService extends BaseService {
  
  /**
   * إنشاء إشعار جديد
   */
  async createNotification(
    notificationData: Omit<InsertNotification, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ServiceResult<Notification>> {
    return this.execute(async () => {
      // التحقق من البيانات المطلوبة
      this.validateRequired(notificationData, ['type', 'level', 'title', 'message']);

      // تنظيف البيانات
      const cleanedData = this.cleanData(notificationData);

      // التحقق من صحة البيانات باستخدام Zod
      const validatedData = insertNotificationSchema.parse(cleanedData);

      // إنشاء الإشعار
      const notification = await this.storage.createNotification(validatedData);

      this.log('info', 'تم إنشاء إشعار جديد', {
        notificationId: notification.id,
        type: notification.type,
        level: notification.level,
        targetUserId: notification.userId
      });

      return notification;
    }, 'إنشاء إشعار');
  }

  /**
   * الحصول على إشعارات المستخدم
   */
  async getUserNotifications(
    options: NotificationListOptions = {}
  ): Promise<ServiceResult<{ notifications: Notification[]; total: number; page: number; totalPages: number }>> {
    return this.execute(async () => {
      const userId = this.getCurrentUserId();
      if (!userId) {
        throw new Error('معرف المستخدم مطلوب');
      }

      const { page = 1, limit = 20, type, acknowledged, resolved } = options;

      // استخدام storage interface بدلاً من الوصول المباشر
      const storageResult = await this.storage.getUserNotificationsWithPagination({
        userId,
        page,
        limit,
        type,
        acknowledged,
        resolved
      });

      // إضافة معلومات التصفح المطلوبة
      const totalPages = Math.ceil(storageResult.total / limit);
      const result = {
        ...storageResult,
        page,
        totalPages
      };

      this.log('info', 'تم جلب إشعارات المستخدم', {
        count: result.notifications.length,
        total: result.total,
        page: result.page,
        filters: { type, acknowledged, resolved }
      });

      return result;
    }, 'جلب إشعارات المستخدم');
  }

  /**
   * تعليم إشعار كمقروء
   */
  async markAsRead(notificationId: string): Promise<ServiceResult<void>> {
    return this.execute(async () => {
      const userId = this.getCurrentUserId();
      if (!userId) {
        throw new Error('معرف المستخدم مطلوب');
      }

      // التحقق من وجود الإشعار والصلاحية باستخدام storage interface
      const notification = await this.storage.getNotificationById(notificationId);
        
      if (!notification) {
        throw new Error('الإشعار غير موجود');
      }

      if (notification.userId !== userId) {
        const user = this.requireRole('admin'); // المسؤول يمكنه تعديل جميع الإشعارات
      }

      // تحديث حالة الإشعار
      await this.storage.acknowledgeNotification(notificationId);

      this.log('info', 'تم تعليم إشعار كمقروء', {
        notificationId,
        previousState: notification.acknowledged
      });

    }, 'تعليم إشعار كمقروء');
  }

  /**
   * تعليم جميع إشعارات المستخدم كمقروءة
   */
  async markAllAsRead(): Promise<ServiceResult<number>> {
    return this.execute(async () => {
      const userId = this.getCurrentUserId();
      if (!userId) {
        throw new Error('معرف المستخدم مطلوب');
      }

      // تعليم جميع الإشعارات كمقروءة باستخدام storage interface
      const updatedCount = await this.storage.markAllNotificationsAsRead(userId);

      this.log('info', 'تم تعليم جميع الإشعارات كمقروءة', {
        count: updatedCount
      });

      return updatedCount;
    }, 'تعليم جميع الإشعارات كمقروءة');
  }

  /**
   * حل إشعار (للمسؤولين)
   */
  async resolveNotification(notificationId: string): Promise<ServiceResult<void>> {
    return this.execute(async () => {
      // التحقق من صلاحيات المسؤول
      this.requireRole('admin');

      // التحقق من وجود الإشعار باستخدام storage interface
      const notification = await this.storage.getNotificationById(notificationId);
        
      if (!notification) {
        throw new Error('الإشعار غير موجود');
      }

      // حل الإشعار
      await this.storage.resolveNotification(notificationId);

      this.log('info', 'تم حل إشعار', {
        notificationId,
        type: notification.type,
        previousState: notification.resolved
      });

    }, 'حل إشعار');
  }

  /**
   * الحصول على إحصائيات الإشعارات
   */
  async getNotificationStats(): Promise<ServiceResult<NotificationStats>> {
    return this.execute(async () => {
      const userId = this.getCurrentUserId();
      if (!userId) {
        throw new Error('معرف المستخدم مطلوب');
      }

      // استخدام storage interface بدلاً من الوصول المباشر
      const stats = await this.storage.getNotificationStats(userId);

      this.log('info', 'تم جلب إحصائيات الإشعارات', {
        total: stats.total,
        unread: stats.unread,
        typesCount: stats.byType.length
      });

      return stats;
    }, 'جلب إحصائيات الإشعارات');
  }

  /**
   * إنشاء إشعار سريع للمستخدم الحالي
   */
  async createQuickNotification(
    type: 'info' | 'success' | 'warning' | 'error',
    title: string,
    message: string,
    level: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<ServiceResult<Notification>> {
    return this.execute(async () => {
      const userId = this.getCurrentUserId();
      if (!userId) {
        throw new Error('معرف المستخدم مطلوب');
      }

      const notificationData = {
        type,
        level,
        title,
        message,
        userId,
        source: 'system'
      };

      // التحقق من البيانات المطلوبة
      this.validateRequired(notificationData, ['type', 'level', 'title', 'message']);

      // تنظيف البيانات
      const cleanedData = this.cleanData(notificationData);

      // التحقق من صحة البيانات باستخدام Zod
      const validatedData = insertNotificationSchema.parse(cleanedData);

      // إنشاء الإشعار
      const notification = await this.storage.createNotification(validatedData);

      this.log('info', 'تم إنشاء إشعار سريع', {
        notificationId: notification.id,
        type: notification.type,
        level: notification.level,
        targetUserId: notification.userId
      });

      return notification;
    }, 'إنشاء إشعار سريع');
  }

  /**
   * إنشاء إشعار للجميع (للمسؤولين)
   */
  async createBroadcastNotification(
    type: 'info' | 'success' | 'warning' | 'error',
    title: string,
    message: string,
    level: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<ServiceResult<Notification[]>> {
    return this.execute(async () => {
      // التحقق من صلاحيات المسؤول
      this.requireRole('admin');

      // جلب جميع المستخدمين - نحتاج لإنشاء طريقة أخرى للحصول على المستخدمين النشطين
      // بدلاً من إرسال إشعارات للجميع، سنرسل للمسؤولين فقط كحل مؤقت
      const currentUser = this.requireUser();
      
      const notifications: Notification[] = [];
      const result = await this.createNotification({
        type,
        level,
        title,
        message,
        userId: currentUser.id,
        source: 'admin'
      });
      
      if (result.success && result.data) {
        notifications.push(result.data);
      }

      this.log('info', 'تم إنشاء إشعار إداري', {
        recipientsCount: 1,
        successCount: notifications.length,
        type,
        level,
        note: 'مؤقتاً يتم الإرسال للمسؤول فقط - يحتاج تطوير للإرسال للجميع'
      });

      return notifications;
    }, 'إنشاء إشعار للجميع');
  }
}