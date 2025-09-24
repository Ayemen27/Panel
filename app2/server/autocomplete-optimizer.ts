import { db } from "./db";
import { autocompleteData } from "@shared/schema";
import { eq, and, lt, sql } from "drizzle-orm";

/**
 * نظام تحسين وتنظيف بيانات الإكمال التلقائي
 * AutoComplete System Optimizer
 */

export class AutocompleteOptimizer {
  // الحد الأقصى لعدد الاقتراحات لكل فئة
  private readonly MAX_SUGGESTIONS_PER_CATEGORY = 100;
  
  // الحد الأدنى لعدد الاستخدام للاحتفاظ بالبيانات (6 أشهر)
  private readonly MIN_USAGE_COUNT = 3;
  
  // مدة الاحتفاظ بالبيانات بالأشهر
  private readonly RETENTION_MONTHS = 6;

  /**
   * تنظيف البيانات القديمة وغير المستخدمة
   * Clean up old and unused data
   */
  async cleanupOldData(): Promise<{ deletedCount: number; categories: string[] }> {
    try {
      // حساب تاريخ الحد الأدنى (6 أشهر سابقة)
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - this.RETENTION_MONTHS);

      console.log(`🧹 بدء تنظيف البيانات القديمة - تاريخ الحد الأدنى: ${cutoffDate.toISOString()}`);

      // جلب البيانات القديمة قبل الحذف لحساب الإحصائيات
      const oldDataQuery = await db
        .select({ category: autocompleteData.category })
        .from(autocompleteData)
        .where(and(
          lt(autocompleteData.lastUsed, cutoffDate),
          lt(autocompleteData.usageCount, this.MIN_USAGE_COUNT)
        ));

      // حذف البيانات القديمة
      const deleteResult = await db
        .delete(autocompleteData)
        .where(and(
          lt(autocompleteData.lastUsed, cutoffDate),
          lt(autocompleteData.usageCount, this.MIN_USAGE_COUNT)
        ));

      // حساب الفئات المتأثرة
      const uniqueCategories = new Set(oldDataQuery.map(item => item.category));
      const affectedCategories = Array.from(uniqueCategories);

      console.log(`✅ تم حذف ${deleteResult.rowCount || 0} سجل قديم من ${affectedCategories.length} فئة`);

      return {
        deletedCount: deleteResult.rowCount || 0,
        categories: affectedCategories
      };
    } catch (error) {
      console.error('❌ خطأ في تنظيف البيانات القديمة:', error);
      throw error;
    }
  }

  /**
   * تطبيق حدود على عدد الاقتراحات لكل فئة
   * Apply limits to suggestions per category
   */
  async enforceCategoryLimits(category?: string): Promise<{ trimmedCategories: string[]; deletedCount: number }> {
    try {
      console.log(`📊 بدء تطبيق الحدود على الفئات${category ? ` - الفئة: ${category}` : ''}`);

      // جلب الفئات المطلوب معالجتها
      const categoriesToProcess = category 
        ? [category] 
        : await this.getAllCategories();

      let totalDeleted = 0;
      const trimmedCategories: string[] = [];

      for (const cat of categoriesToProcess) {
        // عد السجلات في هذه الفئة
        const countResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(autocompleteData)
          .where(eq(autocompleteData.category, cat));

        const currentCount = countResult[0]?.count || 0;

        if (currentCount > this.MAX_SUGGESTIONS_PER_CATEGORY) {
          // جلب السجلات الأقل استخداماً للحذف
          const recordsToDelete = await db
            .select({ id: autocompleteData.id })
            .from(autocompleteData)
            .where(eq(autocompleteData.category, cat))
            .orderBy(
              sql`${autocompleteData.usageCount} ASC, ${autocompleteData.lastUsed} ASC`
            )
            .limit(currentCount - this.MAX_SUGGESTIONS_PER_CATEGORY);

          if (recordsToDelete.length > 0) {
            const idsToDelete = recordsToDelete.map(r => r.id);
            const deleteResult = await db
              .delete(autocompleteData)
              .where(sql`id = ANY(${JSON.stringify(idsToDelete)})`);

            totalDeleted += deleteResult.rowCount || 0;
            trimmedCategories.push(cat);

            console.log(`✂️ تم تقليم فئة ${cat}: حذف ${deleteResult.rowCount || 0} سجل`);
          }
        }
      }

      console.log(`✅ تم تطبيق الحدود - إجمالي المحذوف: ${totalDeleted} من ${trimmedCategories.length} فئة`);

      return {
        trimmedCategories,
        deletedCount: totalDeleted
      };
    } catch (error) {
      console.error('❌ خطأ في تطبيق حدود الفئات:', error);
      throw error;
    }
  }

  /**
   * تحسين استعلامات البحث مع ذاكرة تخزين مؤقت
   * Optimize search queries with caching
   */
  async getOptimizedSuggestions(category: string, searchTerm?: string, limit: number = 10): Promise<any[]> {
    try {
      let query = db
        .select()
        .from(autocompleteData)
        .where(eq(autocompleteData.category, category))
        .orderBy(
          sql`${autocompleteData.usageCount} DESC, ${autocompleteData.lastUsed} DESC`
        )
        .limit(limit);

      // إضافة البحث النصي إذا تم توفير مصطلح البحث
      if (searchTerm && searchTerm.length >= 2) {
        query = db
          .select()
          .from(autocompleteData)
          .where(and(
            eq(autocompleteData.category, category),
            sql`LOWER(${autocompleteData.value}) LIKE LOWER(${'%' + searchTerm + '%'})`
          ))
          .orderBy(
            sql`${autocompleteData.usageCount} DESC, ${autocompleteData.lastUsed} DESC`
          )
          .limit(limit);
      }

      const results = await query;
      
      console.log(`🔍 البحث في فئة ${category}: ${results.length} نتيجة${searchTerm ? ` للبحث "${searchTerm}"` : ''}`);
      
      return results;
    } catch (error) {
      console.error('❌ خطأ في البحث المحسن:', error);
      return [];
    }
  }

  /**
   * تشغيل صيانة شاملة للنظام
   * Run comprehensive system maintenance
   */
  async runMaintenance(): Promise<{
    cleanupResult: { deletedCount: number; categories: string[] };
    limitResult: { trimmedCategories: string[]; deletedCount: number };
    totalProcessed: number;
  }> {
    try {
      console.log('🔧 بدء الصيانة الشاملة لنظام الإكمال التلقائي...');

      // تنظيف البيانات القديمة
      const cleanupResult = await this.cleanupOldData();

      // تطبيق حدود الفئات
      const limitResult = await this.enforceCategoryLimits();

      const totalProcessed = cleanupResult.deletedCount + limitResult.deletedCount;

      console.log(`✅ اكتملت الصيانة - إجمالي المعالج: ${totalProcessed} سجل`);

      return {
        cleanupResult,
        limitResult,
        totalProcessed
      };
    } catch (error) {
      console.error('❌ خطأ في الصيانة الشاملة:', error);
      throw error;
    }
  }

  /**
   * جلب جميع الفئات المتاحة
   * Get all available categories
   */
  private async getAllCategories(): Promise<string[]> {
    try {
      const result = await db
        .select({ category: autocompleteData.category })
        .from(autocompleteData)
        .groupBy(autocompleteData.category);

      return result.map(r => r.category);
    } catch (error) {
      console.error('❌ خطأ في جلب الفئات:', error);
      return [];
    }
  }

  /**
   * إحصائيات النظام
   * System statistics
   */
  async getSystemStats(): Promise<{
    totalRecords: number;
    categoriesCount: number;
    categoryBreakdown: { category: string; count: number; avgUsage: number }[];
    oldRecordsCount: number;
  }> {
    try {
      // إجمالي السجلات
      const totalResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(autocompleteData);

      const totalRecords = totalResult[0]?.count || 0;

      // عدد الفئات
      const categoriesResult = await db
        .select({ count: sql<number>`count(distinct category)` })
        .from(autocompleteData);

      const categoriesCount = categoriesResult[0]?.count || 0;

      // تفصيل الفئات
      const categoryBreakdown = await db
        .select({
          category: autocompleteData.category,
          count: sql<number>`count(*)`,
          avgUsage: sql<number>`avg(usage_count)`
        })
        .from(autocompleteData)
        .groupBy(autocompleteData.category);

      // السجلات القديمة
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - this.RETENTION_MONTHS);

      const oldRecordsResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(autocompleteData)
        .where(and(
          lt(autocompleteData.lastUsed, cutoffDate),
          lt(autocompleteData.usageCount, this.MIN_USAGE_COUNT)
        ));

      const oldRecordsCount = oldRecordsResult[0]?.count || 0;

      return {
        totalRecords,
        categoriesCount,
        categoryBreakdown: categoryBreakdown.map(item => ({
          category: item.category,
          count: Number(item.count),
          avgUsage: Number(item.avgUsage)
        })),
        oldRecordsCount
      };
    } catch (error) {
      console.error('❌ خطأ في جلب إحصائيات النظام:', error);
      throw error;
    }
  }
}

// إنشاء مثيل واحد للاستخدام في جميع أنحاء التطبيق
export const autocompleteOptimizer = new AutocompleteOptimizer();