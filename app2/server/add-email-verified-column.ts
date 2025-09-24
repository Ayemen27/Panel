
/**
 * Migration script لإضافة حقل email_verified_at لجدول users
 */

import { db } from './db.js';

async function addEmailVerifiedColumn() {
  try {
    console.log('🔧 [Migration] بدء إضافة حقل email_verified_at...');

    // إضافة الحقل الجديد
    await db.execute(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP
    `);

    console.log('✅ [Migration] تم إضافة حقل email_verified_at بنجاح');

    // تحديث المستخدمين الموجودين (اختياري - يمكن تفعيلهم يدوياً)
    // await db.execute(`
    //   UPDATE users 
    //   SET email_verified_at = created_at 
    //   WHERE email_verified_at IS NULL AND role = 'admin'
    // `);

    console.log('🎯 [Migration] Migration مكتمل - يجب على المستخدمين الجدد التحقق من البريد الإلكتروني');

  } catch (error) {
    console.error('❌ [Migration] خطأ في إضافة حقل email_verified_at:', error);
    throw error;
  }
}

// تشغيل المهمة
if (import.meta.url === `file://${process.argv[1]}`) {
  addEmailVerifiedColumn()
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

export { addEmailVerifiedColumn };
