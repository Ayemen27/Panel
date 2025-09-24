
import { db } from './db.js';
import { users } from '../shared/schema.js';
import { hashPassword } from './auth/crypto-utils.js';
import { eq } from 'drizzle-orm';

async function createAdminUser() {
  const email = 'binarjoinanalytic@gmail.com';
  const password = 'Ay**--772283228';
  const firstName = 'مدير';
  const lastName = 'النظام';

  console.log('🚀 بدء إنشاء مستخدم مسؤول جديد...');
  console.log('📧 البريد الإلكتروني:', email);

  try {
    // التحقق من وجود المستخدم مسبقاً
    console.log('🔍 التحقق من وجود المستخدم...');
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      console.log('⚠️ المستخدم موجود مسبقاً:', existingUser[0].id);
      console.log('🔄 تحديث كلمة المرور للمستخدم الموجود...');
      
      // تشفير كلمة المرور الجديدة
      const hashedPassword = await hashPassword(password);
      
      // تحديث المستخدم الموجود
      await db
        .update(users)
        .set({
          password: hashedPassword,
          firstName,
          lastName,
          role: 'admin',
          isActive: true,
          updatedAt: new Date()
        })
        .where(eq(users.email, email));

      console.log('✅ تم تحديث المستخدم بنجاح');
      return;
    }

    // تشفير كلمة المرور
    console.log('🔐 تشفير كلمة المرور...');
    const hashedPassword = await hashPassword(password);

    // إنشاء المستخدم الجديد
    console.log('👤 إنشاء المستخدم الجديد...');
    const newUser = await db
      .insert(users)
      .values({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: 'admin',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    console.log('✅ تم إنشاء المستخدم المسؤول بنجاح!');
    console.log('🆔 معرف المستخدم:', newUser[0].id);
    console.log('📧 البريد الإلكتروني:', newUser[0].email);
    console.log('👤 الاسم:', `${newUser[0].firstName} ${newUser[0].lastName}`);
    console.log('🔑 الدور:', newUser[0].role);
    console.log('✅ حالة التفعيل:', newUser[0].isActive);

    console.log('\n🎉 يمكنك الآن تسجيل الدخول باستخدام:');
    console.log('📧 البريد الإلكتروني:', email);
    console.log('🔐 كلمة المرور: Ay**--772283228');

  } catch (error) {
    console.error('❌ خطأ في إنشاء المستخدم المسؤول:', error);
    throw error;
  }
}

// تشغيل الدالة إذا تم استدعاء الملف مباشرة
if (import.meta.url === `file://${process.argv[1]}`) {
  createAdminUser()
    .then(() => {
      console.log('🏁 انتهى إنشاء المستخدم المسؤول');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 فشل في إنشاء المستخدم المسؤول:', error);
      process.exit(1);
    });
}

export { createAdminUser };
