
/**
 * سكريبت لتشغيل التطبيق في وضع محاكاة السيرفر الخارجي
 * حتى لو كان يعمل في بيئة Replit
 */

import { spawn } from 'child_process';
import path from 'path';

console.log('🚀 تشغيل التطبيق في وضع السيرفر الخارجي...');

// تعيين متغيرات البيئة لمحاكاة السيرفر الخارجي
const env = {
  ...process.env,
  FORCE_EXTERNAL_SERVER: 'true',
  SERVER_MODE: 'external',
  NODE_ENV: 'production',
  // يمكنك تخصيص المسار الأساسي هنا
  SERVER_ROOT: process.env.SERVER_ROOT || process.cwd(),
};

console.log('🔧 إعدادات البيئة:');
console.log(`   FORCE_EXTERNAL_SERVER: ${env.FORCE_EXTERNAL_SERVER}`);
console.log(`   SERVER_MODE: ${env.SERVER_MODE}`);
console.log(`   NODE_ENV: ${env.NODE_ENV}`);
console.log(`   SERVER_ROOT: ${env.SERVER_ROOT}`);
console.log('');

// تشغيل الخادم
const serverProcess = spawn('tsx', ['server/index.ts'], {
  env,
  stdio: 'inherit',
  cwd: process.cwd()
});

serverProcess.on('exit', (code) => {
  console.log(`🔚 Server process exited with code ${code}`);
  process.exit(code || 0);
});

serverProcess.on('error', (error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

// معالجة إشارات الإنهاء
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping external server...');
  serverProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Terminating external server...');
  serverProcess.kill('SIGTERM');
});
