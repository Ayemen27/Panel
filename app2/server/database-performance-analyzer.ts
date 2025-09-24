import { db } from './db';
import { sql } from 'drizzle-orm';

/**
 * محلل أداء قاعدة البيانات المتقدم
 * Advanced Database Performance Analyzer
 */

export class DatabasePerformanceAnalyzer {

  /**
   * تحليل أسباب البطء في عمليات INSERT
   * Analyze slow INSERT operations
   */
  async analyzeSlowInserts(): Promise<{
    issues: string[];
    recommendations: string[];
    performanceMetrics: any;
  }> {
    console.log('🔍 تحليل أسباب البطء في عمليات INSERT...');
    
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    try {
      // 1. فحص الفهارس المفقودة
      const missingIndexes = await this.checkMissingIndexes();
      if (missingIndexes.length > 0) {
        issues.push(`فهارس مفقودة على الجداول: ${missingIndexes.join(', ')}`);
        recommendations.push('إضافة فهارس على الأعمدة المستخدمة بكثرة');
      }

      // 2. فحص القيود والمحفزات
      const constraintIssues = await this.checkConstraints();
      if (constraintIssues.length > 0) {
        issues.push('قيود قاعدة البيانات تسبب بطء في INSERT');
        recommendations.push('مراجعة وتحسين القيود والمحفزات');
      }

      // 3. فحص حجم الجداول
      const tableSizes = await this.checkTableSizes();
      const largeTables = tableSizes.filter(t => t.size_mb > 100);
      if (largeTables.length > 0) {
        issues.push(`جداول كبيرة الحجم: ${largeTables.map(t => t.table_name).join(', ')}`);
        recommendations.push('تقسيم الجداول الكبيرة أو أرشفة البيانات القديمة');
      }

      // 4. فحص الـ Connection Pool
      const connectionIssues = await this.checkConnectionPool();
      if (connectionIssues) {
        issues.push('مشكلة في تجمع الاتصالات (Connection Pool)');
        recommendations.push('تحسين إعدادات Connection Pool في قاعدة البيانات');
      }

      const performanceMetrics = {
        avgInsertTime: await this.measureInsertPerformance(),
        indexCount: await this.getIndexCount(),
        tableStats: tableSizes
      };

      return { issues, recommendations, performanceMetrics };

    } catch (error) {
      console.error('خطأ في تحليل عمليات INSERT:', error);
      return {
        issues: ['خطأ في تحليل الأداء'],
        recommendations: ['التحقق من اتصال قاعدة البيانات'],
        performanceMetrics: {}
      };
    }
  }

  /**
   * تحليل أسباب البطء في عمليات DELETE
   * Analyze slow DELETE operations
   */
  async analyzeSlowDeletes(): Promise<{
    issues: string[];
    recommendations: string[];
    performanceMetrics: any;
  }> {
    console.log('🔍 تحليل أسباب البطء في عمليات DELETE...');
    
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // 1. فحص المراجع الخارجية
      const foreignKeyIssues = await this.checkForeignKeyConstraints();
      if (foreignKeyIssues.length > 0) {
        issues.push('مراجع خارجية معقدة تبطئ عمليات الحذف');
        recommendations.push('مراجعة القيود المرجعية وتحسينها');
      }

      // 2. فحص عمليات الحذف المتتالية
      const cascadeIssues = await this.checkCascadeDeletes();
      if (cascadeIssues) {
        issues.push('عمليات حذف متتالية (CASCADE) معقدة');
        recommendations.push('استخدام Batch Delete بدلاً من الحذف الفردي');
      }

      // 3. فحص المحفزات (Triggers)
      const triggerIssues = await this.checkTriggers();
      if (triggerIssues.length > 0) {
        issues.push(`محفزات قاعدة البيانات تسبب بطء: ${triggerIssues.join(', ')}`);
        recommendations.push('تحسين أو تعطيل المحفزات غير الضرورية');
      }

      // 4. فحص الـ Locking
      const lockingIssues = await this.checkLocking();
      if (lockingIssues) {
        issues.push('تضارب في الأقفال (Row Locking) يسبب تأخير');
        recommendations.push('تحسين تسلسل العمليات لتجنب تضارب الأقفال');
      }

      const performanceMetrics = {
        avgDeleteTime: await this.measureDeletePerformance(),
        foreignKeyCount: await this.getForeignKeyCount(),
        triggerCount: await this.getTriggerCount()
      };

      return { issues, recommendations, performanceMetrics };

    } catch (error) {
      console.error('خطأ في تحليل عمليات DELETE:', error);
      return {
        issues: ['خطأ في تحليل الأداء'],
        recommendations: ['التحقق من اتصال قاعدة البيانات'],
        performanceMetrics: {}
      };
    }
  }

  /**
   * فحص الفهارس المفقودة
   */
  private async checkMissingIndexes(): Promise<string[]> {
    try {
      // فحص الجداول التي تفتقر للفهارس المناسبة
      const result = await db.execute(sql`
        SELECT 
          schemaname, 
          tablename,
          attname,
          n_distinct,
          correlation
        FROM pg_stats 
        WHERE schemaname = 'public'
        AND n_distinct > 100
        AND correlation < 0.1
        ORDER BY n_distinct DESC
        LIMIT 10
      `);

      const tablesNeedingIndexes: string[] = [];
      if (result.rows && result.rows.length > 0) {
        result.rows.forEach((row: any) => {
          if (!tablesNeedingIndexes.includes(row.tablename)) {
            tablesNeedingIndexes.push(row.tablename);
          }
        });
      }

      return tablesNeedingIndexes;
    } catch (error) {
      console.log('تعذر فحص الفهارس المفقودة');
      return [];
    }
  }

  /**
   * فحص القيود والمحفزات
   */
  private async checkConstraints(): Promise<string[]> {
    try {
      const result = await db.execute(sql`
        SELECT 
          conname,
          contype,
          confupdtype,
          confdeltype
        FROM pg_constraint 
        WHERE contype IN ('f', 'c', 't')
        AND confupdtype = 'a' OR confdeltype = 'a'
      `);

      return result.rows?.map((row: any) => row.conname) || [];
    } catch (error) {
      console.log('تعذر فحص القيود');
      return [];
    }
  }

  /**
   * فحص أحجام الجداول
   */
  private async checkTableSizes(): Promise<any[]> {
    try {
      const result = await db.execute(sql`
        SELECT 
          schemaname,
          tablename as table_name,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          pg_total_relation_size(schemaname||'.'||tablename)/1024/1024 as size_mb
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        LIMIT 10
      `);

      return result.rows || [];
    } catch (error) {
      console.log('تعذر فحص أحجام الجداول');
      return [];
    }
  }

  /**
   * فحص تجمع الاتصالات
   */
  private async checkConnectionPool(): Promise<boolean> {
    try {
      const result = await db.execute(sql`
        SELECT 
          count(*) as active_connections,
          max_conn
        FROM pg_stat_activity, 
        (SELECT setting::int as max_conn FROM pg_settings WHERE name = 'max_connections') as mc
        WHERE state = 'active'
        GROUP BY max_conn
      `);

      const row = result.rows?.[0] as any;
      if (row && row.active_connections > row.max_conn * 0.8) {
        return true; // مشكلة في Connection Pool
      }
      return false;
    } catch (error) {
      console.log('تعذر فحص Connection Pool');
      return false;
    }
  }

  /**
   * قياس أداء INSERT
   */
  private async measureInsertPerformance(): Promise<number> {
    try {
      const startTime = Date.now();
      
      // محاكاة عملية INSERT بسيطة
      await db.execute(sql`
        INSERT INTO autocomplete_data (category, value, usage_count, last_used, created_at)
        VALUES ('performance_test', 'test_value', 1, NOW(), NOW())
        ON CONFLICT (category, value) DO NOTHING
      `);
      
      const endTime = Date.now();
      
      // حذف البيانات التجريبية
      await db.execute(sql`
        DELETE FROM autocomplete_data 
        WHERE category = 'performance_test' AND value = 'test_value'
      `);
      
      return endTime - startTime;
    } catch (error) {
      console.log('تعذر قياس أداء INSERT');
      return 0;
    }
  }

  /**
   * قياس أداء DELETE
   */
  private async measureDeletePerformance(): Promise<number> {
    try {
      // إدخال بيانات تجريبية أولاً
      await db.execute(sql`
        INSERT INTO autocomplete_data (category, value, usage_count, last_used, created_at)
        VALUES ('delete_test', 'test_value', 1, NOW() - INTERVAL '1 year', NOW())
        ON CONFLICT (category, value) DO NOTHING
      `);
      
      const startTime = Date.now();
      
      // عملية DELETE
      await db.execute(sql`
        DELETE FROM autocomplete_data 
        WHERE category = 'delete_test' AND value = 'test_value'
      `);
      
      const endTime = Date.now();
      return endTime - startTime;
    } catch (error) {
      console.log('تعذر قياس أداء DELETE');
      return 0;
    }
  }

  /**
   * فحص المراجع الخارجية
   */
  private async checkForeignKeyConstraints(): Promise<string[]> {
    try {
      const result = await db.execute(sql`
        SELECT 
          tc.constraint_name,
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
      `);

      return result.rows?.map((row: any) => row.constraint_name) || [];
    } catch (error) {
      console.log('تعذر فحص المراجع الخارجية');
      return [];
    }
  }

  /**
   * فحص عمليات الحذف المتتالية
   */
  private async checkCascadeDeletes(): Promise<boolean> {
    try {
      const result = await db.execute(sql`
        SELECT COUNT(*) as cascade_count
        FROM information_schema.referential_constraints
        WHERE constraint_schema = 'public'
        AND delete_rule = 'CASCADE'
      `);

      const row = result.rows?.[0] as any;
      return row && row.cascade_count > 0;
    } catch (error) {
      console.log('تعذر فحص CASCADE deletes');
      return false;
    }
  }

  /**
   * فحص المحفزات
   */
  private async checkTriggers(): Promise<string[]> {
    try {
      const result = await db.execute(sql`
        SELECT 
          trigger_name,
          event_manipulation,
          event_object_table
        FROM information_schema.triggers
        WHERE trigger_schema = 'public'
      `);

      return result.rows?.map((row: any) => row.trigger_name) || [];
    } catch (error) {
      console.log('تعذر فحص المحفزات');
      return [];
    }
  }

  /**
   * فحص الأقفال
   */
  private async checkLocking(): Promise<boolean> {
    try {
      const result = await db.execute(sql`
        SELECT COUNT(*) as blocked_queries
        FROM pg_stat_activity
        WHERE wait_event_type = 'Lock'
      `);

      const row = result.rows?.[0] as any;
      return row && row.blocked_queries > 0;
    } catch (error) {
      console.log('تعذر فحص الأقفال');
      return false;
    }
  }

  /**
   * عد الفهارس
   */
  private async getIndexCount(): Promise<number> {
    try {
      const result = await db.execute(sql`
        SELECT COUNT(*) as index_count
        FROM pg_indexes
        WHERE schemaname = 'public'
      `);

      const row = result.rows?.[0] as any;
      return row ? row.index_count : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * عد المراجع الخارجية
   */
  private async getForeignKeyCount(): Promise<number> {
    try {
      const result = await db.execute(sql`
        SELECT COUNT(*) as fk_count
        FROM information_schema.table_constraints
        WHERE constraint_type = 'FOREIGN KEY'
        AND table_schema = 'public'
      `);

      const row = result.rows?.[0] as any;
      return row ? row.fk_count : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * عد المحفزات
   */
  private async getTriggerCount(): Promise<number> {
    try {
      const result = await db.execute(sql`
        SELECT COUNT(*) as trigger_count
        FROM information_schema.triggers
        WHERE trigger_schema = 'public'
      `);

      const row = result.rows?.[0] as any;
      return row ? row.trigger_count : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * تحليل شامل للأداء
   */
  async runComprehensiveAnalysis(): Promise<{
    insertAnalysis: any;
    deleteAnalysis: any;
    summary: string;
    criticalIssues: string[];
    quickFixes: string[];
  }> {
    console.log('🔍 بدء التحليل الشامل لأداء قاعدة البيانات...');

    const [insertAnalysis, deleteAnalysis] = await Promise.all([
      this.analyzeSlowInserts(),
      this.analyzeSlowDeletes()
    ]);

    const allIssues = [...insertAnalysis.issues, ...deleteAnalysis.issues];
    const criticalIssues = allIssues.filter(issue => 
      issue.includes('كبيرة الحجم') || 
      issue.includes('فهارس مفقودة') ||
      issue.includes('Connection Pool')
    );

    const quickFixes = [
      'إضافة فهارس على autocomplete_data (category, usage_count)',
      'تفعيل التنظيف الدوري للبيانات القديمة',
      'استخدام Batch operations للعمليات المتعددة',
      'تحسين استعلامات WHERE clause'
    ];

    let summary = '📊 ملخص تحليل الأداء:\n';
    summary += `🔍 مشاكل INSERT: ${insertAnalysis.issues.length}\n`;
    summary += `🗑️ مشاكل DELETE: ${deleteAnalysis.issues.length}\n`;
    summary += `⚠️ مشاكل حرجة: ${criticalIssues.length}\n`;
    summary += `⏱️ متوسط وقت INSERT: ${insertAnalysis.performanceMetrics.avgInsertTime}ms\n`;
    summary += `⏱️ متوسط وقت DELETE: ${deleteAnalysis.performanceMetrics.avgDeleteTime}ms\n`;

    return {
      insertAnalysis,
      deleteAnalysis,
      summary,
      criticalIssues,
      quickFixes
    };
  }
}

export const databasePerformanceAnalyzer = new DatabasePerformanceAnalyzer();