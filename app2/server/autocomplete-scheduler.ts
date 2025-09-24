import { autocompleteOptimizer } from './autocomplete-optimizer';

/**
 * مجدول صيانة نظام الإكمال التلقائي
 * Autocomplete System Maintenance Scheduler
 */

export class AutocompleteScheduler {
  private cleanupInterval: NodeJS.Timeout | null = null;
  private maintenanceInterval: NodeJS.Timeout | null = null;

  /**
   * بدء جدولة الصيانة الدورية
   * Start periodic maintenance scheduling
   */
  startScheduledMaintenance(): void {
    console.log('🕒 بدء جدولة صيانة نظام الإكمال التلقائي...');

    // تنظيف يومي للبيانات القديمة (كل 24 ساعة)
    this.cleanupInterval = setInterval(async () => {
      try {
        console.log('🧹 بدء التنظيف اليومي المجدول...');
        const result = await autocompleteOptimizer.cleanupOldData();
        
        if (result.deletedCount > 0) {
          console.log(`✅ التنظيف اليومي: تم حذف ${result.deletedCount} سجل من ${result.categories.length} فئة`);
        } else {
          console.log('✅ التنظيف اليومي: لا توجد بيانات قديمة للحذف');
        }
      } catch (error) {
        console.error('❌ خطأ في التنظيف اليومي:', error);
      }
    }, 24 * 60 * 60 * 1000); // كل 24 ساعة

    // صيانة شاملة أسبوعية (كل 7 أيام)
    this.maintenanceInterval = setInterval(async () => {
      try {
        console.log('🔧 بدء الصيانة الأسبوعية المجدولة...');
        const result = await autocompleteOptimizer.runMaintenance();
        
        console.log(`✅ الصيانة الأسبوعية: معالجة ${result.totalProcessed} سجل`);
        console.log(`   - تنظيف: ${result.cleanupResult.deletedCount} سجل`);
        console.log(`   - تقليم: ${result.limitResult.deletedCount} سجل من ${result.limitResult.trimmedCategories.length} فئة`);
      } catch (error) {
        console.error('❌ خطأ في الصيانة الأسبوعية:', error);
      }
    }, 7 * 24 * 60 * 60 * 1000); // كل 7 أيام

    console.log('✅ تم تفعيل جدولة الصيانة الدورية');
  }

  /**
   * إيقاف جدولة الصيانة الدورية
   * Stop periodic maintenance scheduling
   */
  stopScheduledMaintenance(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
      this.maintenanceInterval = null;
    }

    console.log('🛑 تم إيقاف جدولة صيانة نظام الإكمال التلقائي');
  }

  /**
   * تشغيل صيانة فورية عند الطلب
   * Run immediate on-demand maintenance
   */
  async runImmediateMaintenance(): Promise<void> {
    try {
      console.log('⚡ بدء صيانة فورية لنظام الإكمال التلقائي...');
      
      const result = await autocompleteOptimizer.runMaintenance();
      
      console.log(`✅ الصيانة الفورية اكتملت: معالجة ${result.totalProcessed} سجل`);
    } catch (error) {
      console.error('❌ خطأ في الصيانة الفورية:', error);
      throw error;
    }
  }

  /**
   * فحص صحة النظام والحاجة للصيانة
   * Check system health and maintenance needs
   */
  async checkSystemHealth(): Promise<{
    needsAttention: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    try {
      const stats = await autocompleteOptimizer.getSystemStats();
      
      const issues: string[] = [];
      const recommendations: string[] = [];
      
      // فحص البيانات القديمة
      if (stats.oldRecordsCount > 100) {
        issues.push(`يوجد ${stats.oldRecordsCount} سجل قديم يحتاج حذف`);
        recommendations.push('تشغيل تنظيف البيانات القديمة');
      }
      
      // فحص الفئات الكبيرة
      const largeCategoriesCount = stats.categoryBreakdown.filter(cat => cat.count > 100).length;
      if (largeCategoriesCount > 0) {
        issues.push(`يوجد ${largeCategoriesCount} فئة تتجاوز الحد الأقصى (100 سجل)`);
        recommendations.push('تطبيق حدود الفئات وتقليم البيانات الزائدة');
      }
      
      // فحص كفاءة الاستخدام
      const lowUsageCategories = stats.categoryBreakdown.filter(cat => cat.avgUsage < 2).length;
      if (lowUsageCategories > stats.categoriesCount * 0.3) {
        issues.push('معظم الفئات لديها معدل استخدام منخفض');
        recommendations.push('مراجعة وتنظيف الفئات قليلة الاستخدام');
      }
      
      return {
        needsAttention: issues.length > 0,
        issues,
        recommendations
      };
    } catch (error) {
      console.error('❌ خطأ في فحص صحة النظام:', error);
      return {
        needsAttention: true,
        issues: ['خطأ في فحص صحة النظام'],
        recommendations: ['إعادة تشغيل النظام والتحقق من قاعدة البيانات']
      };
    }
  }
}

// إنشاء مثيل واحد للاستخدام في جميع أنحاء التطبيق
export const autocompleteScheduler = new AutocompleteScheduler();