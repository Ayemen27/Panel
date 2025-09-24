
import { db } from './db';
import { sql } from 'drizzle-orm';
import * as schema from '@shared/schema';

interface DatabaseCheckResult {
  success: boolean;
  message: string;
  details?: any;
}

class DatabaseManager {
  
  /**
   * فحص الاتصال بقاعدة بيانات VSP Server
   */
  async checkConnection(): Promise<DatabaseCheckResult> {
    try {
      console.log('🔍 جاري فحص الاتصال بقاعدة بيانات VSP Server...');
      
      const result = await db.execute(sql`SELECT 1 as test, version() as db_version, current_database() as db_name, current_user as db_user`);
      
      console.log('✅ تم الاتصال بقاعدة بيانات VSP Server بنجاح');
      console.log('📊 معلومات قاعدة البيانات:', result.rows?.[0]);
      return {
        success: true,
        message: 'الاتصال بقاعدة بيانات VSP Server ناجح',
        details: result.rows?.[0]
      };
    } catch (error) {
      console.error('❌ فشل الاتصال بقاعدة بيانات VSP Server:', error);
      return {
        success: false,
        message: 'فشل الاتصال بقاعدة بيانات VSP Server',
        details: error
      };
    }
  }

  /**
   * فحص وجود الجداول المطلوبة في VSP Server
   */
  async checkTablesExist(): Promise<DatabaseCheckResult> {
    try {
      console.log('🔍 جاري فحص الجداول في قاعدة بيانات VSP Server...');
      
      const tablesQuery = await db.execute(sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);
      
      let existingTables: string[] = [];
      
      if (tablesQuery && tablesQuery.rows && Array.isArray(tablesQuery.rows)) {
        existingTables = tablesQuery.rows.map((row: any) => {
          return row.table_name || row.TABLE_NAME;
        }).filter(Boolean);
      }
      
      console.log('📋 الجداول الموجودة في VSP Server:', existingTables);
      
      const requiredTables = [
        'projects',
        'workers', 
        'worker_attendance',
        'daily_expenses',
        'material_purchases',
        'equipment',
        'autocomplete_data'
      ];
      
      const missingTables = requiredTables.filter(table => !existingTables.includes(table));
      
      if (missingTables.length > 0) {
        console.log('⚠️ الجداول المفقودة في قاعدة بيانات VSP Server:', missingTables);
        return {
          success: false,
          message: `الجداول التالية مفقودة: ${missingTables.join(', ')}`,
          details: { existingTables, missingTables, requiredTables }
        };
      }
      
      console.log('✅ جميع الجداول المطلوبة موجودة في VSP Server');
      return {
        success: true,
        message: 'جميع الجداول المطلوبة موجودة في VSP Server',
        details: { existingTables, requiredTables }
      };
    } catch (error) {
      console.error('❌ خطأ في فحص جداول VSP Server:', error);
      return {
        success: false,
        message: 'خطأ في فحص جداول VSP Server',
        details: error
      };
    }
  }

  /**
   * إنشاء الجداول المطلوبة إذا كانت مفقودة
   */
  async createTables(): Promise<DatabaseCheckResult> {
    try {
      console.log('🔧 بدء إنشاء الجداول في VSP Server...');
      
      // إنشاء جدول المشاريع
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS projects (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          status TEXT DEFAULT 'active',
          start_date TIMESTAMP,
          end_date TIMESTAMP,
          budget DECIMAL(12,2),
          location TEXT,
          client_name TEXT,
          client_phone TEXT,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
      `);

      // إنشاء جدول العمال
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS workers (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          phone TEXT,
          type TEXT NOT NULL,
          daily_wage DECIMAL(10,2) NOT NULL,
          status TEXT DEFAULT 'active',
          hired_date TIMESTAMP,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
      `);

      // إنشاء جدول حضور العمال
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS worker_attendance (
          id SERIAL PRIMARY KEY,
          worker_id INTEGER REFERENCES workers(id) NOT NULL,
          project_id INTEGER REFERENCES projects(id) NOT NULL,
          attendance_date TIMESTAMP NOT NULL,
          hours_worked DECIMAL(4,2) DEFAULT 8.00,
          overtime DECIMAL(4,2) DEFAULT 0.00,
          daily_wage DECIMAL(10,2) NOT NULL,
          overtime_rate DECIMAL(10,2) DEFAULT 0.00,
          total_pay DECIMAL(10,2) NOT NULL,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
      `);

      // إنشاء جدول المصروفات اليومية
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS daily_expenses (
          id SERIAL PRIMARY KEY,
          project_id INTEGER REFERENCES projects(id) NOT NULL,
          expense_date TIMESTAMP NOT NULL,
          category TEXT NOT NULL,
          description TEXT NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          receipt_number TEXT,
          supplier_name TEXT,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
      `);

      // إنشاء جدول شراء المواد
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS material_purchases (
          id SERIAL PRIMARY KEY,
          project_id INTEGER REFERENCES projects(id) NOT NULL,
          purchase_date TIMESTAMP NOT NULL,
          material_name TEXT NOT NULL,
          quantity DECIMAL(10,3) NOT NULL,
          unit TEXT NOT NULL,
          unit_price DECIMAL(10,2) NOT NULL,
          total_amount DECIMAL(10,2) NOT NULL,
          supplier_name TEXT,
          receipt_number TEXT,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
      `);

      // إنشاء جدول المعدات
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS equipment (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          serial_number TEXT,
          category TEXT NOT NULL,
          purchase_date TIMESTAMP,
          purchase_price DECIMAL(10,2),
          current_value DECIMAL(10,2),
          status TEXT DEFAULT 'available',
          location TEXT,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
      `);

      // إنشاء جدول الإكمال التلقائي
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS autocomplete_data (
          id SERIAL PRIMARY KEY,
          category TEXT NOT NULL,
          value TEXT NOT NULL,
          frequency INTEGER DEFAULT 1,
          last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
      `);

      console.log('✅ تم إنشاء جميع الجداول بنجاح في VSP Server');
      return {
        success: true,
        message: 'تم إنشاء جميع الجداول بنجاح في VSP Server'
      };
    } catch (error) {
      console.error('❌ خطأ في إنشاء الجداول في VSP Server:', error);
      return {
        success: false,
        message: 'خطأ في إنشاء الجداول في VSP Server',
        details: error
      };
    }
  }

  /**
   * فحص وإعداد قاعدة بيانات VSP Server
   */
  async initializeDatabase(): Promise<DatabaseCheckResult> {
    console.log('🔄 بدء إعداد قاعدة بيانات VSP Server...');
    
    // 1. فحص الاتصال
    const connectionCheck = await this.checkConnection();
    if (!connectionCheck.success) {
      console.error('❌ فشل الاتصال بقاعدة بيانات VSP Server');
      return connectionCheck;
    }
    
    // 2. فحص الجداول
    const tablesCheck = await this.checkTablesExist();
    
    // 3. إنشاء الجداول المفقودة
    if (!tablesCheck.success) {
      console.log('🔧 إنشاء الجداول المفقودة...');
      const createResult = await this.createTables();
      if (!createResult.success) {
        return createResult;
      }
      
      // إعادة فحص الجداول بعد الإنشاء
      const recheckResult = await this.checkTablesExist();
      if (!recheckResult.success) {
        return recheckResult;
      }
    }
    
    console.log('✅ قاعدة بيانات VSP Server جاهزة للاستخدام');
    return {
      success: true,
      message: 'قاعدة بيانات VSP Server جاهزة ومتصلة'
    };
  }

  /**
   * اختبار العمليات الأساسية على VSP Server
   */
  async testBasicOperations(): Promise<DatabaseCheckResult> {
    try {
      console.log('🧪 جاري اختبار العمليات الأساسية على VSP Server...');
      
      // اختبار إنشاء مشروع تجريبي
      const testProject = await db.insert(schema.projects).values({
        name: 'مشروع تجريبي VSP - ' + Date.now(),
        status: 'active'
      }).returning();
      
      console.log('✅ تم إنشاء مشروع تجريبي في VSP Server:', testProject[0]);
      
      // اختبار قراءة المشاريع
      const projects = await db.select().from(schema.projects).limit(1);
      console.log('✅ تم قراءة المشاريع من VSP Server:', projects.length);
      
      // حذف المشروع التجريبي
      await db.delete(schema.projects).where(sql`id = ${testProject[0].id}`);
      console.log('✅ تم حذف المشروع التجريبي من VSP Server');
      
      return {
        success: true,
        message: 'جميع العمليات الأساسية تعمل بشكل صحيح على VSP Server'
      };
    } catch (error) {
      console.error('❌ خطأ في اختبار العمليات الأساسية على VSP Server:', error);
      return {
        success: false,
        message: 'خطأ في اختبار العمليات الأساسية على VSP Server',
        details: error
      };
    }
  }
}

export const databaseManager = new DatabaseManager();
