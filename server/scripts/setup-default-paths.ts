import { addDefaultPaths } from '../migrations/001_add_default_paths.js';

console.log('🚀 تشغيل سكريبت إضافة المسارات الافتراضية...');

addDefaultPaths()
  .then((result) => {
    console.log('✅ تم تشغيل السكريبت بنجاح:', result);
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ خطأ في تشغيل السكريبت:', error);
    process.exit(1);
  });