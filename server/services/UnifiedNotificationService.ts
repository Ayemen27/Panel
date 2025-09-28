/**
 * خدمة الإشعارات الموحدة - مثال عملي لاستخدام النظام الموحد الجديد
 * تحل محل جميع خدمات الإشعارات المتفرقة وتوفر واجهة موحدة
 */

import { BaseService, ServiceResult } from '../core/BaseService';
import { Injectable } from '../core/ServiceContainer';
import { 
  notifications, 
  users,
  insertNotificationSchema, 
  type InsertNotification, 
  type Notification 
} from '@shared/schema';
import { eq, desc, and, count, gte } from 'drizzle-orm';
import { db } from '../db';

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

@Injectable('notificationService')
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

      // بناء شروط البحث
      const conditions = [eq(notifications.userId, userId)];
      
      if (type) {
        conditions.push(eq(notifications.type, type));
      }
      
      if (acknowledged !== undefined) {
        conditions.push(eq(notifications.acknowledged, acknowledged));
      }
      
      if (resolved !== undefined) {
        conditions.push(eq(notifications.resolved, resolved));
      }

      // حساب العدد الإجمالي
      const [{ total }] = await db
        .select({ total: count() })
        .from(notifications)
        .where(and(...conditions));

      // جلب البيانات مع التصفح
      const notificationsList = await db
        .select()
        .from(notifications)
        .where(and(...conditions))
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset((page - 1) * limit);

      const totalPages = Math.ceil(total / limit);

      this.log('info', 'تم جلب إشعارات المستخدم', {
        count: notificationsList.length,
        total,
        page,
        filters: { type, acknowledged, resolved }
      });

      return {
        notifications: notificationsList,
        total,
        page,
        totalPages
      };
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

      // التحقق من وجود الإشعار والصلاحية
      const [notification] = await db
        .select()
        .from(notifications)
        .where(eq(notifications.id, notificationId));
        
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

      // جلب الإشعارات غير المقروءة
      const unreadNotifications = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.acknowledged, false)
          )
        );

      // تعليم جميع الإشعارات كمقروءة
      for (const notification of unreadNotifications) {
        await this.storage.acknowledgeNotification(notification.id);
      }

      this.log('info', 'تم تعليم جميع الإشعارات كمقروءة', {
        count: unreadNotifications.length
      });

      return unreadNotifications.length;
    }, 'تعليم جميع الإشعارات كمقروءة');
  }

  /**
   * حل إشعار (للمسؤولين)
   */
  async resolveNotification(notificationId: string): Promise<ServiceResult<void>> {
    return this.execute(async () => {
      // التحقق من صلاحيات المسؤول
      this.requireRole('admin');

      // التحقق من وجود الإشعار
      const [notification] = await db
        .select()
        .from(notifications)
        .where(eq(notifications.id, notificationId));
        
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

      // العدد الإجمالي
      const [{ total }] = await db
        .select({ total: count() })
        .from(notifications)
        .where(eq(notifications.userId, userId));

      // عدد غير المقروءة
      const [{ unread }] = await db
        .select({ unread: count() })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.acknowledged, false)
          )
        );

      // الإحصائيات حسب النوع
      const byType = await db
        .select({
          type: notifications.type,
          count: count()
        })
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .groupBy(notifications.type);

      // إشعارات آخر 24 ساعة
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const [{ last24Hours }] = await db
        .select({ last24Hours: count() })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            gte(notifications.createdAt, yesterday)
          )
        );

      this.log('info', 'تم جلب إحصائيات الإشعارات', {
        total,
        unread,
        typesCount: byType.length
      });

      return {
        total,
        unread,
        byType,
        last24Hours
      };
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

      // جلب جميع المستخدمين النشطين
      const activeUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.isActive, true));

      // إنشاء إشعار لكل مستخدم
      const notifications: Notification[] = [];
      for (const user of activeUsers) {
        const result = await this.createNotification({
          type,
          level,
          title,
          message,
          userId: user.id,
          source: 'admin'
        });
        
        if (result.success && result.data) {
          notifications.push(result.data);
        }
      }

      this.log('info', 'تم إنشاء إشعار للجميع', {
        recipientsCount: activeUsers.length,
        successCount: notifications.length,
        type,
        level
      });

      return notifications;
    }, 'إنشاء إشعار للجميع');
  }
}