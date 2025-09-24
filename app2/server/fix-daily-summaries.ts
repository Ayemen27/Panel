import { db } from './db';
import { sql } from 'drizzle-orm';

export class DailySummariesFix {
  /**
   * إصلاح عمود carried_forward_amount في جدول daily_expense_summaries
   */
  static async fixCarriedForwardColumn(): Promise<boolean> {
    try {
      console.log("🔧 بدء إصلاح عمود carried_forward_amount...");
      
      // فحص وجود العمود أولاً
      const columnExists = await this.checkColumnExists();
      
      if (!columnExists) {
        console.log("⚠️ العمود غير موجود - جاري إضافته...");
        
        // إضافة العمود
        await db.execute(sql`
          ALTER TABLE daily_expense_summaries 
          ADD COLUMN IF NOT EXISTS carried_forward_amount DECIMAL(12,2) DEFAULT 0.00
        `);
        
        // تحديث القيم الافتراضية
        await db.execute(sql`
          UPDATE daily_expense_summaries 
          SET carried_forward_amount = 0.00 
          WHERE carried_forward_amount IS NULL
        `);
        
        console.log("✅ تم إضافة عمود carried_forward_amount بنجاح");
      } else {
        console.log("✅ العمود موجود بالفعل - لا حاجة للإصلاح");
      }
      
      return true;
    } catch (error) {
      console.error("❌ خطأ في إصلاح العمود:", error);
      return false;
    }
  }
  
  /**
   * فحص وجود عمود carried_forward_amount
   */
  static async checkColumnExists(): Promise<boolean> {
    try {
      const result = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'daily_expense_summaries' 
        AND column_name = 'carried_forward_amount'
      `);
      
      return result.rows.length > 0;
    } catch (error) {
      console.error("❌ خطأ في فحص العمود:", error);
      return false;
    }
  }
  
  /**
   * اختبار وظيفة ملخص المصروفات اليومية
   */
  static async testDailySummaryOperations(): Promise<boolean> {
    try {
      console.log("🧪 اختبار عمليات ملخص المصروفات اليومية...");
      
      // التحقق من إمكانية قراءة الجدول
      const summaries = await db.execute(sql`
        SELECT * FROM daily_expense_summaries LIMIT 1
      `);
      
      console.log("✅ تم قراءة جدول daily_expense_summaries بنجاح");
      console.log("📊 عدد السجلات:", summaries.rows.length);
      
      return true;
    } catch (error) {
      console.error("❌ خطأ في اختبار العمليات:", error);
      return false;
    }
  }
}