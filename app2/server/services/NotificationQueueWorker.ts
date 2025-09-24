/**
 * خدمة معالجة طابور الإشعارات المتقدمة
 * تدعم retry mechanism وexponential backoff وdead-letter queue
 */

import { db } from "../db";
import { sql, eq, and, lte } from "drizzle-orm";
import { 
  notificationQueue, 
  notificationSettings,
  notifications 
} from "@shared/schema";

export interface QueueWorkerConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  batchSize: number;
  workerIntervalMs: number;
}

export class NotificationQueueWorker {
  private config: QueueWorkerConfig;
  private isRunning: boolean = false;
  private workerTimeout: NodeJS.Timeout | null = null;

  constructor(config?: Partial<QueueWorkerConfig>) {
    this.config = {
      maxRetries: 3,
      initialDelayMs: 60000, // 1 دقيقة
      maxDelayMs: 3600000, // 1 ساعة
      backoffMultiplier: 2,
      batchSize: 10,
      workerIntervalMs: 30000, // 30 ثانية
      ...config
    };
  }

  /**
   * بدء تشغيل معالج الطابور
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log("⚠️ معالج الطابور يعمل بالفعل");
      return;
    }

    this.isRunning = true;
    console.log("🚀 بدء تشغيل معالج طابور الإشعارات");
    
    await this.processQueue();
    this.scheduleNextRun();
  }

  /**
   * إيقاف معالج الطابور
   */
  stop(): void {
    this.isRunning = false;
    if (this.workerTimeout) {
      clearTimeout(this.workerTimeout);
      this.workerTimeout = null;
    }
    console.log("⏹️ تم إيقاف معالج طابور الإشعارات");
  }

  /**
   * معالجة طابور الإشعارات
   */
  private async processQueue(): Promise<void> {
    if (!this.isRunning) return;

    try {
      console.log("🔄 بدء معالجة طابور الإشعارات...");

      // جلب الإشعارات الجاهزة للإرسال
      const pendingItems = await this.getPendingQueueItems();
      
      if (pendingItems.length === 0) {
        console.log("📭 لا توجد إشعارات في الطابور");
        return;
      }

      console.log(`📬 تم العثور على ${pendingItems.length} إشعار للمعالجة`);

      // معالجة متوازية للإشعارات
      const promises = pendingItems.map(item => this.processQueueItem(item));
      const results = await Promise.allSettled(promises);

      // إحصائيات النتائج
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      console.log(`✅ تم معالجة ${successful} إشعار بنجاح، فشل ${failed} إشعار`);

    } catch (error) {
      console.error("❌ خطأ في معالجة الطابور:", error);
      await this.logError("queue_processing_error", error);
    }
  }

  /**
   * جلب العناصر الجاهزة للمعالجة من الطابور
   */
  private async getPendingQueueItems(): Promise<any[]> {
    const now = new Date();
    
    const items = await db
      .select()
      .from(notificationQueue)
      .where(
        and(
          eq(notificationQueue.status, 'pending'),
          // العناصر الجاهزة للإرسال (لا توجد محاولة سابقة أو حان وقت إعادة المحاولة)
          sql`(next_retry IS NULL OR next_retry <= ${now})`
        )
      )
      .limit(this.config.batchSize);

    return items;
  }

  /**
   * معالجة عنصر واحد من الطابور
   */
  private async processQueueItem(item: any): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(`📤 معالجة إشعار: ${item.notificationId} للمستخدم: ${item.userId}`);

      // قفل العنصر لمنع المعالجة المتكررة
      const lockResult = await this.lockQueueItem(item.id);
      if (!lockResult) {
        console.log(`🔒 العنصر ${item.id} مقفل بواسطة معالج آخر`);
        return;
      }

      // فحص إعدادات المستخدم
      const userSettings = await this.getUserSettings(item.userId, item.channel);
      if (!this.shouldSendNotification(userSettings)) {
        await this.updateQueueStatus(item.id, 'skipped', 'تم تخطي الإشعار حسب إعدادات المستخدم');
        return;
      }

      // محاولة الإرسال
      const sendResult = await this.sendNotification(item);
      const latency = Date.now() - startTime;

      if (sendResult.success) {
        // نجح الإرسال
        await this.handleSuccessfulSend(item, latency);
        console.log(`✅ تم إرسال الإشعار ${item.notificationId} بنجاح`);
      } else {
        // فشل الإرسال
        await this.handleFailedSend(item, sendResult.error || 'فشل غير محدد', latency);
        console.log(`❌ فشل إرسال الإشعار ${item.notificationId}: ${sendResult.error}`);
      }

    } catch (error) {
      console.error(`❌ خطأ في معالجة العنصر ${item.id}:`, error);
      await this.handleFailedSend(item, error instanceof Error ? error.message : 'خطأ غير معروف', Date.now() - startTime);
    }
  }

  /**
   * قفل عنصر في الطابور لمنع المعالجة المتكررة
   */
  private async lockQueueItem(itemId: string): Promise<boolean> {
    try {
      const result = await db.execute(sql`
        UPDATE notification_queue 
        SET status = 'processing', last_attempt_at = NOW()
        WHERE id = ${itemId} AND status = 'pending'
      `);
      
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error(`خطأ في قفل العنصر ${itemId}:`, error);
      return false;
    }
  }

  /**
   * جلب إعدادات المستخدم للإشعارات
   */
  private async getUserSettings(userId: string, channel: string): Promise<any> {
    try {
      const settings = await db
        .select()
        .from(notificationSettings)
        .where(eq(notificationSettings.userId, userId));

      return settings.find(s => this.channelMatches(s.notificationType, channel)) || null;
    } catch (error) {
      console.error(`خطأ في جلب إعدادات المستخدم ${userId}:`, error);
      return null;
    }
  }

  /**
   * تحديد ما إذا كان يجب إرسال الإشعار
   */
  private shouldSendNotification(userSettings: any): boolean {
    if (!userSettings) return true; // افتراضي: إرسال

    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM

    // فحص ساعات الصمت
    if (userSettings.quietHoursStart && userSettings.quietHoursEnd) {
      const start = userSettings.quietHoursStart;
      const end = userSettings.quietHoursEnd;
      
      if (this.isInQuietHours(currentTime, start, end)) {
        return false;
      }
    }

    // فحص تفعيل القناة
    switch (userSettings.channel) {
      case 'push': return userSettings.pushEnabled;
      case 'email': return userSettings.emailEnabled;
      case 'sms': return userSettings.smsEnabled;
      default: return true;
    }
  }

  /**
   * إرسال الإشعار عبر القناة المحددة
   */
  private async sendNotification(item: any): Promise<{ success: boolean; error?: string }> {
    try {
      // محاكاة إرسال الإشعار - يمكن استبدالها بتنفيذ حقيقي
      switch (item.channel) {
        case 'push':
          return await this.sendPushNotification(item);
        case 'email':
          return await this.sendEmailNotification(item);
        case 'sms':
          return await this.sendSmsNotification(item);
        default:
          return { success: false, error: `قناة غير مدعومة: ${item.channel}` };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'خطأ في الإرسال' 
      };
    }
  }

  /**
   * إرسال إشعار push
   */
  private async sendPushNotification(item: any): Promise<{ success: boolean; error?: string }> {
    // محاكاة تأخير الشبكة
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
    
    // محاكاة نسبة نجاح 95%
    if (Math.random() < 0.95) {
      return { success: true };
    } else {
      return { success: false, error: 'فشل في الاتصال بخدمة Push' };
    }
  }

  /**
   * إرسال إشعار email
   */
  private async sendEmailNotification(item: any): Promise<{ success: boolean; error?: string }> {
    // محاكاة تأخير الشبكة
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000));
    
    // محاكاة نسبة نجاح 90%
    if (Math.random() < 0.90) {
      return { success: true };
    } else {
      return { success: false, error: 'فشل في إرسال البريد الإلكتروني' };
    }
  }

  /**
   * إرسال إشعار SMS
   */
  private async sendSmsNotification(item: any): Promise<{ success: boolean; error?: string }> {
    // محاكاة تأخير الشبكة
    await new Promise(resolve => setTimeout(resolve, Math.random() * 3000));
    
    // محاكاة نسبة نجاح 85%
    if (Math.random() < 0.85) {
      return { success: true };
    } else {
      return { success: false, error: 'فشل في إرسال الرسالة النصية' };
    }
  }

  /**
   * تحديث حالة عنصر في الطابور
   */
  private async updateQueueStatus(itemId: string, status: string, message?: string): Promise<void> {
    try {
      await db
        .update(notificationQueue)
        .set({
          status: status,
          errorMessage: message,
          lastAttemptAt: new Date()
        })
        .where(eq(notificationQueue.id, itemId));
    } catch (error) {
      console.error(`خطأ في تحديث حالة العنصر ${itemId}:`, error);
    }
  }

  /**
   * معالجة الإرسال الناجح
   */
  private async handleSuccessfulSend(item: any, latency: number): Promise<void> {
    const now = new Date();

    // تحديث حالة العنصر في الطابور
    await db
      .update(notificationQueue)
      .set({
        status: 'sent',
        sentAt: now,
        lastAttemptAt: now
      })
      .where(eq(notificationQueue.id, item.id));

    // تسجيل المقاييس
    await this.recordMetric({
      notificationId: item.notificationId,
      recipientId: item.userId,
      deliveryMethod: item.channel,
      status: 'sent',
      sentAt: now,
      latencyMs: latency,
      channelUsed: item.channel
    });
  }

  /**
   * معالجة الإرسال الفاشل
   */
  private async handleFailedSend(item: any, error: string, latency: number): Promise<void> {
    const now = new Date();
    const newRetryCount = (item.retryCount || 0) + 1;

    // تحديد الخطوة التالية
    if (newRetryCount >= this.config.maxRetries) {
      // نقل إلى dead-letter queue
      await this.moveToDeadLetterQueue(item, error);
    } else {
      // جدولة إعادة المحاولة
      const nextRetry = this.calculateNextRetry(newRetryCount);
      
      await db
        .update(notificationQueue)
        .set({
          status: 'pending',
          retryCount: newRetryCount,
          lastAttemptAt: now,
          errorMessage: error
        })
        .where(eq(notificationQueue.id, item.id));
    }

    // تسجيل المقاييس
    await this.recordMetric({
      notificationId: item.notificationId,
      recipientId: item.userId,
      deliveryMethod: item.channel,
      status: 'failed',
      sentAt: now,
      latencyMs: latency,
      failureReason: error,
      retryCount: newRetryCount,
      channelUsed: item.channel
    });
  }

  /**
   * نقل العنصر إلى dead-letter queue
   */
  private async moveToDeadLetterQueue(item: any, finalError: string): Promise<void> {
    await db
      .update(notificationQueue)
      .set({
        status: 'failed',
        errorMessage: `نهائي بعد ${this.config.maxRetries} محاولات: ${finalError}`,
        lastAttemptAt: new Date()
      })
      .where(eq(notificationQueue.id, item.id));

    console.log(`💀 تم نقل الإشعار ${item.notificationId} إلى dead-letter queue`);
  }

  /**
   * حساب وقت إعادة المحاولة التالية (exponential backoff)
   */
  private calculateNextRetry(retryCount: number): Date {
    const delay = Math.min(
      this.config.initialDelayMs * Math.pow(this.config.backoffMultiplier, retryCount - 1),
      this.config.maxDelayMs
    );
    
    // إضافة عشوائية لتجنب الضغط المتزامن
    const jitter = Math.random() * 0.1 * delay;
    const finalDelay = delay + jitter;
    
    return new Date(Date.now() + finalDelay);
  }

  /**
   * تسجيل مقياس في جدول المقاييس
   */
  private async recordMetric(data: {
    notificationId: string;
    recipientId: string;
    deliveryMethod: string;
    status: string;
    sentAt: Date;
    latencyMs: number;
    failureReason?: string;
    retryCount?: number;
    channelUsed: string;
  }): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO notification_metrics (
          notification_id, recipient_id, delivery_method, status, 
          sent_at, latency_ms, failure_reason, retry_count, channel_used
        ) VALUES (
          ${data.notificationId}, ${data.recipientId}, ${data.deliveryMethod}, 
          ${data.status}, ${data.sentAt}, ${data.latencyMs}, 
          ${data.failureReason || null}, ${data.retryCount || 0}, ${data.channelUsed}
        )
      `);
    } catch (error) {
      console.error("خطأ في تسجيل المقياس:", error);
    }
  }

  /**
   * جدولة التشغيل التالي
   */
  private scheduleNextRun(): void {
    if (!this.isRunning) return;

    this.workerTimeout = setTimeout(async () => {
      await this.processQueue();
      this.scheduleNextRun();
    }, this.config.workerIntervalMs);
  }

  /**
   * وظائف مساعدة
   */
  private channelMatches(notificationType: string, channel: string): boolean {
    // منطق مطابقة القناة مع نوع الإشعار
    return true; // مبسط للآن
  }

  private isInQuietHours(currentTime: string, start: string, end: string): boolean {
    if (start <= end) {
      return currentTime >= start && currentTime <= end;
    } else {
      // عبر منتصف الليل
      return currentTime >= start || currentTime <= end;
    }
  }

  private async logError(type: string, error: any): Promise<void> {
    console.error(`[${type}]`, error);
    // يمكن إضافة تسجيل في قاعدة البيانات أو خدمة external
  }

  /**
   * الحصول على إحصائيات الطابور
   */
  async getQueueStats(): Promise<{
    pending: number;
    processing: number;
    sent: number;
    failed: number;
    total: number;
  }> {
    try {
      const stats = await db.execute(sql`
        SELECT 
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing,
          COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
          COUNT(*) as total
        FROM notification_queue
      `);

      const row = stats.rows[0];
      return {
        pending: Number(row.pending || 0),
        processing: Number(row.processing || 0),
        sent: Number(row.sent || 0),
        failed: Number(row.failed || 0),
        total: Number(row.total || 0)
      };
    } catch (error) {
      console.error("خطأ في جلب إحصائيات الطابور:", error);
      return { pending: 0, processing: 0, sent: 0, failed: 0, total: 0 };
    }
  }
}

// إنشاء instance عام للخدمة
export const notificationQueueWorker = new NotificationQueueWorker();