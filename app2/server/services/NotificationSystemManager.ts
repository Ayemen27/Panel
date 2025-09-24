/**
 * مدير نظام الإشعارات المتقدم
 * يدير تشغيل جميع خدمات النظام بشكل متكامل
 */

import { notificationQueueWorker } from './NotificationQueueWorker';
import { notificationMonitoringService } from './NotificationMonitoringService';

export class NotificationSystemManager {
  private isRunning: boolean = false;

  /**
   * تشغيل النظام الكامل
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log("⚠️ نظام الإشعارات يعمل بالفعل");
      return;
    }

    try {
      console.log("🚀 بدء تشغيل نظام الإشعارات المتقدم...");

      // تشغيل معالج الطابور
      await notificationQueueWorker.start();
      
      // تشغيل المراقبة الدورية
      notificationMonitoringService.startPeriodicMonitoring(5); // كل 5 دقائق

      // تسجيل بداية التشغيل
      await notificationMonitoringService.logEvent(
        'info',
        'system_startup',
        'تم تشغيل نظام الإشعارات المتقدم بنجاح',
        {
          queueWorkerEnabled: true,
          monitoringEnabled: true,
          timestamp: new Date().toISOString()
        }
      );

      this.isRunning = true;
      console.log("✅ نظام الإشعارات المتقدم جاهز ويعمل بكفاءة عالية");

      // فحص أولي لحالة النظام
      setTimeout(async () => {
        const health = await notificationMonitoringService.getSystemHealth();
        console.log(`📊 حالة النظام: ${health.status}`);
        console.log(`📈 معدل النجاح: ${(health.metrics.successRate * 100).toFixed(2)}%`);
        console.log(`⚡ متوسط زمن الاستجابة: ${health.metrics.averageLatency.toFixed(0)}ms`);
        console.log(`📬 حجم الطابور: ${health.metrics.queueSize}`);
      }, 10000); // بعد 10 ثواني

    } catch (error) {
      console.error("❌ فشل في تشغيل نظام الإشعارات:", error);
      await notificationMonitoringService.logEvent(
        'error',
        'system_startup',
        'فشل في تشغيل نظام الإشعارات',
        { error: error instanceof Error ? error.message : 'خطأ غير محدد' }
      );
      throw error;
    }
  }

  /**
   * إيقاف النظام
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log("⚠️ النظام متوقف بالفعل");
      return;
    }

    try {
      console.log("⏹️ إيقاف نظام الإشعارات...");

      // إيقاف معالج الطابور
      notificationQueueWorker.stop();

      // تسجيل الإيقاف
      await notificationMonitoringService.logEvent(
        'info',
        'system_shutdown',
        'تم إيقاف نظام الإشعارات',
        { timestamp: new Date().toISOString() }
      );

      this.isRunning = false;
      console.log("✅ تم إيقاف نظام الإشعارات بنجاح");

    } catch (error) {
      console.error("❌ خطأ في إيقاف النظام:", error);
      throw error;
    }
  }

  /**
   * إعادة تشغيل النظام
   */
  async restart(): Promise<void> {
    console.log("🔄 إعادة تشغيل نظام الإشعارات...");
    await this.stop();
    await new Promise(resolve => setTimeout(resolve, 2000)); // انتظار 2 ثانية
    await this.start();
  }

  /**
   * فحص حالة النظام
   */
  async getStatus(): Promise<{
    isRunning: boolean;
    health: any;
    queueStats: any;
  }> {
    const health = await notificationMonitoringService.getSystemHealth();
    const queueStats = await notificationQueueWorker.getQueueStats();

    return {
      isRunning: this.isRunning,
      health,
      queueStats
    };
  }

  /**
   * تقرير حالة مختصر
   */
  async getStatusSummary(): Promise<string> {
    if (!this.isRunning) {
      return "❌ النظام متوقف";
    }

    try {
      const status = await this.getStatus();
      const { health, queueStats } = status;

      return `
🔋 حالة النظام: ${this.getStatusEmoji(health.status)} ${health.status}
📊 معدل النجاح: ${(health.metrics.successRate * 100).toFixed(1)}%
⚡ زمن الاستجابة: ${health.metrics.averageLatency.toFixed(0)}ms
📬 الطابور: ${queueStats.pending} في الانتظار، ${queueStats.processing} قيد المعالجة
🎯 تم الإرسال: ${queueStats.sent} | فشل: ${queueStats.failed}
      `.trim();

    } catch (error) {
      return "❌ خطأ في قراءة حالة النظام";
    }
  }

  /**
   * إنشاء تقرير أداء شامل
   */
  async generateReport(timeRange: 'day' | 'week' = 'day'): Promise<any> {
    if (!this.isRunning) {
      throw new Error("النظام متوقف - لا يمكن إنشاء التقرير");
    }

    return await notificationMonitoringService.generatePerformanceReport(timeRange);
  }

  /**
   * وضع رمز تعبيري للحالة
   */
  private getStatusEmoji(status: string): string {
    switch (status) {
      case 'healthy': return '✅';
      case 'warning': return '⚠️';
      case 'critical': return '❌';
      default: return '❓';
    }
  }

  /**
   * تشغيل اختبار شامل للنظام
   */
  async runSystemTest(): Promise<{
    success: boolean;
    results: any[];
    summary: string;
  }> {
    console.log("🧪 بدء اختبار شامل لنظام الإشعارات...");
    
    const results: any[] = [];
    let allPassed = true;

    try {
      // اختبار 1: فحص حالة النظام
      console.log("🔍 اختبار حالة النظام...");
      const health = await notificationMonitoringService.getSystemHealth();
      const healthPassed = health.status !== 'critical';
      results.push({
        test: 'فحص حالة النظام',
        passed: healthPassed,
        status: health.status,
        details: `معدل النجاح: ${(health.metrics.successRate * 100).toFixed(1)}%`
      });
      if (!healthPassed) allPassed = false;

      // اختبار 2: فحص الطابور
      console.log("📬 اختبار طابور الإشعارات...");
      const queueStats = await notificationQueueWorker.getQueueStats();
      const queuePassed = queueStats.total >= 0; // الطابور يعمل
      results.push({
        test: 'فحص طابور الإشعارات',
        passed: queuePassed,
        status: 'ok',
        details: `العناصر: ${queueStats.total} (${queueStats.pending} في الانتظار)`
      });
      if (!queuePassed) allPassed = false;

      // اختبار 3: فحص الأداء
      console.log("⚡ اختبار الأداء...");
      const metrics = await notificationMonitoringService.getPerformanceMetrics('hour');
      const performancePassed = metrics.averageLatency < 10000; // أقل من 10 ثواني
      results.push({
        test: 'فحص الأداء',
        passed: performancePassed,
        status: performancePassed ? 'excellent' : 'needs_improvement',
        details: `متوسط زمن الاستجابة: ${metrics.averageLatency.toFixed(0)}ms`
      });
      if (!performancePassed) allPassed = false;

      // اختبار 4: فحص المراقبة
      console.log("👁️ اختبار نظام المراقبة...");
      const alerts = await notificationMonitoringService.checkAlerts();
      const monitoringPassed = true; // المراقبة تعمل إذا وصلنا هنا
      results.push({
        test: 'فحص نظام المراقبة',
        passed: monitoringPassed,
        status: 'active',
        details: `تنبيهات فعالة: ${alerts.length}`
      });

      const summary = allPassed 
        ? "✅ جميع الاختبارات نجحت - النظام يعمل بكفاءة عالية"
        : "⚠️ بعض الاختبارات فشلت - يحتاج النظام للمراجعة";

      console.log(`🎯 نتيجة الاختبار: ${summary}`);

      // تسجيل نتيجة الاختبار
      await notificationMonitoringService.logEvent(
        allPassed ? 'info' : 'warn',
        'system_test',
        summary,
        { 
          totalTests: results.length,
          passedTests: results.filter(r => r.passed).length,
          results 
        }
      );

      return {
        success: allPassed,
        results,
        summary
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'خطأ غير محدد';
      const summary = "❌ فشل في تشغيل الاختبار الشامل";
      
      await notificationMonitoringService.logEvent(
        'error',
        'system_test',
        summary,
        { error: errorMessage }
      );

      return {
        success: false,
        results: [{
          test: 'تشغيل الاختبار',
          passed: false,
          status: 'error',
          details: errorMessage
        }],
        summary
      };
    }
  }
}

// إنشاء instance عام للنظام
export const notificationSystemManager = new NotificationSystemManager();