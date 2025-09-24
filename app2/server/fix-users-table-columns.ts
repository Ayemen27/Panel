
/**
 * إصلاح جدول users بإضافة الأعمدة المفقودة
 */

import { pool } from './db.js';

async function fixUsersTableColumns() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 بدء إصلاح جدول users...');
    
    // فحص الأعمدة الموجودة
    const columnsCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND table_schema = 'public'
    `);
    
    const existingColumns = columnsCheck.rows.map(row => row.column_name);
    console.log('📋 الأعمدة الموجودة:', existingColumns);
    
    // إضافة totp_secret إذا لم يكن موجود
    if (!existingColumns.includes('totp_secret')) {
      console.log('➕ إضافة عمود totp_secret...');
      await client.query(`
        ALTER TABLE users 
        ADD COLUMN totp_secret text
      `);
    }
    
    // إضافة mfa_enabled إذا لم يكن موجود
    if (!existingColumns.includes('mfa_enabled')) {
      console.log('➕ إضافة عمود mfa_enabled...');
      await client.query(`
        ALTER TABLE users 
        ADD COLUMN mfa_enabled boolean DEFAULT false NOT NULL
      `);
    }
    
    // التحقق من النتيجة
    const finalCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND table_schema = 'public'
      ORDER BY column_name
    `);
    
    console.log('✅ الأعمدة النهائية في جدول users:', finalCheck.rows.map(r => r.column_name));
    console.log('🎉 تم إصلاح جدول users بنجاح!');
    
  } catch (error) {
    console.error('❌ خطأ في إصلاح جدول users:', error);
    throw error;
  } finally {
    client.release();
  }
}

// تشغيل الإصلاح إذا تم استدعاء الملف مباشرة
if (import.meta.url === `file://${process.argv[1]}`) {
  fixUsersTableColumns()
    .then(() => {
      console.log('✅ تم الانتهاء من إصلاح جدول users');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ فشل في إصلاح جدول users:', error);
      process.exit(1);
    });
}

export { fixUsersTableColumns };
