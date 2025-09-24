import { db } from './db';
import { sql } from 'drizzle-orm';

/**
 * مدير العروض المادية - Materialized View Manager
 * تطبيق توصية استخدام Materialized Views بدلاً من Triggers المباشرة
 */

export class MaterializedViewManager {

  /**
   * إنشاء Materialized View للملخص اليومي
   */
  async createDailySummaryView(): Promise<boolean> {
    try {
      console.log('📊 إنشاء Materialized View للملخص اليومي...');

      // إنشاء Materialized View للملخص اليومي بالهيكل الصحيح
      await db.execute(sql`
        CREATE MATERIALIZED VIEW IF NOT EXISTS daily_summary_mv AS
        SELECT 
          des.id,
          des.project_id,
          des.date as summary_date,
          des.carried_forward_amount,
          des.total_fund_transfers,
          des.total_worker_wages,
          des.total_material_costs,
          des.total_transportation_expenses,
          des.total_worker_transfers,
          des.total_worker_misc_expenses,
          des.total_income,
          des.total_expenses,
          des.remaining_balance,
          des.notes,
          des.created_at,
          des.updated_at,
          p.name as project_name
        FROM daily_expense_summaries des
        LEFT JOIN projects p ON des.project_id = p.id
        WHERE des.date >= CURRENT_DATE - INTERVAL '30 days'
      `);

      // إنشاء فهرس فريد للـ Materialized View
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_summary_mv_unique 
        ON daily_summary_mv (project_id, summary_date)
      `);

      // إنشاء فهارس إضافية للأداء
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_daily_summary_mv_project 
        ON daily_summary_mv (project_id)
      `);

      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_daily_summary_mv_date 
        ON daily_summary_mv (summary_date DESC)
      `);

      console.log('✅ تم إنشاء Materialized View بنجاح');
      return true;

    } catch (error) {
      console.error('❌ خطأ في إنشاء Materialized View:', error);
      return false;
    }
  }

  /**
   * تحديث Materialized View
   */
  async refreshDailySummaryView(): Promise<{
    success: boolean;
    executionTime: number;
    rowsAffected: number;
  }> {
    const startTime = Date.now();
    
    try {
      console.log('🔄 تحديث Materialized View...');

      // تحديث متزامن للـ Materialized View
      const result = await db.execute(sql`
        REFRESH MATERIALIZED VIEW CONCURRENTLY daily_summary_mv
      `);

      const endTime = Date.now();

      // حساب عدد الصفوف في الـ View
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as row_count FROM daily_summary_mv
      `);

      const rowCount = (countResult.rows?.[0] as any)?.row_count || 0;

      console.log(`✅ تم تحديث Materialized View - ${rowCount} صف في ${endTime - startTime}ms`);

      return {
        success: true,
        executionTime: endTime - startTime,
        rowsAffected: parseInt(rowCount)
      };

    } catch (error) {
      console.error('❌ خطأ في تحديث Materialized View:', error);
      
      // fallback: تحديث كامل (غير متزامن)
      try {
        console.log('🔄 محاولة تحديث كامل...');
        await db.execute(sql`REFRESH MATERIALIZED VIEW daily_summary_mv`);
        
        const endTime = Date.now();
        return {
          success: true,
          executionTime: endTime - startTime,
          rowsAffected: 0
        };
      } catch (fallbackError) {
        console.error('❌ فشل التحديث الكامل أيضاً:', fallbackError);
        return {
          success: false,
          executionTime: Date.now() - startTime,
          rowsAffected: 0
        };
      }
    }
  }

  /**
   * إنشاء Materialized View لإحصائيات الإكمال التلقائي
   */
  async createAutocompleteStatsView(): Promise<boolean> {
    try {
      console.log('📊 إنشاء Materialized View لإحصائيات الإكمال التلقائي...');

      await db.execute(sql`
        CREATE MATERIALIZED VIEW IF NOT EXISTS autocomplete_stats_mv AS
        SELECT 
          category,
          COUNT(*) as total_suggestions,
          AVG(usage_count) as avg_usage_count,
          MAX(usage_count) as max_usage_count,
          MIN(usage_count) as min_usage_count,
          COUNT(*) FILTER (WHERE usage_count >= 5) as popular_suggestions,
          COUNT(*) FILTER (WHERE last_used >= CURRENT_DATE - INTERVAL '7 days') as recent_suggestions,
          COUNT(*) FILTER (WHERE last_used < CURRENT_DATE - INTERVAL '6 months') as old_suggestions,
          MAX(last_used) as latest_usage,
          MIN(created_at) as earliest_created
        FROM autocomplete_data
        GROUP BY category
        ORDER BY total_suggestions DESC
      `);

      // فهرس فريد على الفئة
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_autocomplete_stats_mv_category 
        ON autocomplete_stats_mv (category)
      `);

      console.log('✅ تم إنشاء Materialized View للإحصائيات بنجاح');
      return true;

    } catch (error) {
      console.error('❌ خطأ في إنشاء Materialized View للإحصائيات:', error);
      return false;
    }
  }

  /**
   * جدولة تحديث تلقائي (للمحاكاة - في الواقع يتم عبر Supabase Cron)
   */
  async scheduleAutoRefresh(): Promise<void> {
    console.log('⏰ جدولة التحديث التلقائي للـ Materialized Views...');

    // محاكاة Cron job - تحديث كل 6 ساعات
    setInterval(async () => {
      console.log('🔄 تحديث تلقائي مجدول للـ Materialized Views...');
      
      try {
        // تحديث view الملخص اليومي
        await this.refreshDailySummaryView();
        
        // تحديث view إحصائيات الإكمال التلقائي
        await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY autocomplete_stats_mv`);
        
        console.log('✅ تم التحديث التلقائي بنجاح');
      } catch (error) {
        console.error('❌ خطأ في التحديث التلقائي:', error);
      }
    }, 6 * 60 * 60 * 1000); // كل 6 ساعات

    console.log('✅ تم تفعيل التحديث التلقائي');
  }

  /**
   * حذف Materialized Views (للصيانة)
   */
  async dropMaterializedViews(): Promise<boolean> {
    try {
      console.log('🗑️ حذف Materialized Views...');

      await db.execute(sql`DROP MATERIALIZED VIEW IF EXISTS daily_summary_mv`);
      await db.execute(sql`DROP MATERIALIZED VIEW IF EXISTS autocomplete_stats_mv`);

      console.log('✅ تم حذف Materialized Views بنجاح');
      return true;

    } catch (error) {
      console.error('❌ خطأ في حذف Materialized Views:', error);
      return false;
    }
  }

  /**
   * إحصائيات Materialized Views
   */
  async getMaterializedViewStats(): Promise<{
    dailySummaryView: any;
    autocompleteStatsView: any;
    recommendations: string[];
  }> {
    try {
      // إحصائيات view الملخص اليومي
      const dailyViewStats = await db.execute(sql`
        SELECT 
          schemaname,
          matviewname,
          hasindexes,
          ispopulated,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname)) as size
        FROM pg_matviews 
        WHERE matviewname = 'daily_summary_mv'
      `);

      // إحصائيات view الإحصائيات
      const statsViewStats = await db.execute(sql`
        SELECT 
          schemaname,
          matviewname,
          hasindexes,
          ispopulated,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname)) as size
        FROM pg_matviews 
        WHERE matviewname = 'autocomplete_stats_mv'
      `);

      const recommendations: string[] = [];

      const dailyView = dailyViewStats.rows?.[0] as any;
      const statsView = statsViewStats.rows?.[0] as any;

      if (!dailyView?.ispopulated) {
        recommendations.push('تحديث view الملخص اليومي مطلوب');
      }

      if (!statsView?.ispopulated) {
        recommendations.push('تحديث view الإحصائيات مطلوب');
      }

      if (dailyView || statsView) {
        recommendations.push('جدولة تحديث تلقائي موصى بها');
      }

      return {
        dailySummaryView: dailyView || null,
        autocompleteStatsView: statsView || null,
        recommendations
      };

    } catch (error) {
      console.error('خطأ في جلب إحصائيات Materialized Views:', error);
      return {
        dailySummaryView: null,
        autocompleteStatsView: null,
        recommendations: ['فحص حالة قاعدة البيانات']
      };
    }
  }

  /**
   * إعداد شامل للـ Materialized Views
   */
  async setupMaterializedViews(): Promise<{
    success: boolean;
    viewsCreated: string[];
    errors: string[];
  }> {
    const viewsCreated: string[] = [];
    const errors: string[] = [];

    try {
      // إنشاء view الملخص اليومي
      if (await this.createDailySummaryView()) {
        viewsCreated.push('daily_summary_mv');
      } else {
        errors.push('فشل إنشاء daily_summary_mv');
      }

      // إنشاء view الإحصائيات
      if (await this.createAutocompleteStatsView()) {
        viewsCreated.push('autocomplete_stats_mv');
      } else {
        errors.push('فشل إنشاء autocomplete_stats_mv');
      }

      // تحديث Views الأولي
      await this.refreshDailySummaryView();
      await db.execute(sql`REFRESH MATERIALIZED VIEW autocomplete_stats_mv`);

      // تفعيل التحديث التلقائي
      this.scheduleAutoRefresh();

      return {
        success: errors.length === 0,
        viewsCreated,
        errors
      };

    } catch (error) {
      console.error('خطأ في إعداد Materialized Views:', error);
      return {
        success: false,
        viewsCreated,
        errors: [...errors, `خطأ عام: ${error}`]
      };
    }
  }
}

export const materializedViewManager = new MaterializedViewManager();