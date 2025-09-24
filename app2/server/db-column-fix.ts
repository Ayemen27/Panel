import { db } from "./db";
import { sql } from "drizzle-orm";

// إصلاح مباشر لعمود carried_forward_amount
export async function fixCarriedForwardColumn() {
  console.log("🔧 بدء إصلاح عمود carried_forward_amount...");
  
  try {
    // فحص وجود العمود
    const columnCheck = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'daily_expense_summaries' 
      AND column_name = 'carried_forward_amount'
    `);
    
    if (columnCheck.rows.length === 0) {
      console.log("❌ العمود carried_forward_amount غير موجود، جاري إضافته...");
      
      // إضافة العمود
      await db.execute(sql`
        ALTER TABLE daily_expense_summaries 
        ADD COLUMN IF NOT EXISTS carried_forward_amount DECIMAL(10,2) DEFAULT 0 NOT NULL
      `);
      
      console.log("✅ تم إضافة العمود carried_forward_amount");
    } else {
      console.log("✅ العمود carried_forward_amount موجود بالفعل");
    }
    
    // التحقق النهائي
    const finalCheck = await db.execute(sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'daily_expense_summaries'
      ORDER BY ordinal_position
    `);
    
    console.log("📊 هيكل جدول daily_expense_summaries:");
    finalCheck.rows.forEach((row: any) => {
      console.log(`   - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable}, default: ${row.column_default})`);
    });
    
    return true;
  } catch (error) {
    console.error("❌ خطأ في إصلاح العمود:", error);
    return false;
  }
}

// تشغيل الإصلاح إذا تم استدعاء الملف مباشرة
if (import.meta.url === `file://${process.argv[1]}`) {
  fixCarriedForwardColumn().then(success => {
    console.log(success ? "🎉 تم الإصلاح بنجاح" : "❌ فشل في الإصلاح");
    process.exit(success ? 0 : 1);
  });
}