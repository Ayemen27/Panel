
import fs from 'fs';
import path from 'path';
import { ENV_CONFIG } from '../../shared/environment';

const REQUIRED_DIRECTORIES = [
  'storage',
  'real-files', 
  'uploads',
  'logs',
  'config',
  'ssl',
  'nginx'
];

async function setupDirectories() {
  console.log('🏗️ Setting up required directories...');
  
  // استخدم اكتشاف البيئة المحسن
  const isReplit = !!(
    process.env.REPL_ID ||
    process.env.REPLIT_DB_URL ||
    process.env.REPL_SLUG ||
    process.env.REPLIT_CLUSTER ||
    process.env.REPLIT_ENVIRONMENT
  );
  
  const isVPS = process.env.HOSTNAME?.includes('93.127.142.144') || 
               process.env.SERVER_TYPE === 'external' ||
               !isReplit;
  
  console.log(`🔍 Environment detected: ${isReplit ? 'Replit' : (isVPS ? 'VPS' : 'Local')}`);
  
  // تحديد المسار الأساسي حسب البيئة
  let baseDir: string;
  
  if (isReplit) {
    baseDir = '/home/runner';
  } else if (isVPS) {
    // للـ VPS، استخدم مسارات محلية داخل مجلد المشروع
    baseDir = process.cwd();
    console.log(`📁 Using project directory: ${baseDir}`);
  } else {
    // للتطوير المحلي
    baseDir = process.cwd();
  }
  
  for (const dir of REQUIRED_DIRECTORIES) {
    const dirPath = path.join(baseDir, dir);
    
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true, mode: 0o755 });
        console.log(`✅ Created directory: ${dirPath}`);
      } else {
        console.log(`✓ Directory already exists: ${dirPath}`);
      }
      
      // التحقق من الصلاحيات
      try {
        fs.accessSync(dirPath, fs.constants.W_OK);
        console.log(`✅ Write permission confirmed for: ${dirPath}`);
      } catch (permError) {
        console.warn(`⚠️ No write permission for: ${dirPath}`);
        // محاولة تعديل الصلاحيات إذا كان ممكناً
        try {
          fs.chmodSync(dirPath, 0o755);
          console.log(`✅ Fixed permissions for: ${dirPath}`);
        } catch (chmodError) {
          console.warn(`❌ Could not fix permissions for: ${dirPath}`);
        }
      }
      
    } catch (error: any) {
      console.error(`❌ Failed to create directory ${dirPath}:`, error);
      
      // إذا فشل إنشاء المجلد في المسار المطلوب، أنشئه في مجلد temp
      if (!isReplit && (error as any)?.code === 'EACCES') {
        const fallbackPath = path.join('/tmp', path.basename(dirPath));
        try {
          fs.mkdirSync(fallbackPath, { recursive: true, mode: 0o755 });
          console.log(`🔄 Created fallback directory: ${fallbackPath}`);
        } catch (fallbackError) {
          console.error(`❌ Fallback also failed: ${fallbackError}`);
        }
      }
    }
  }
  
  console.log('🎉 Directory setup completed!');
  
  // طباعة ملخص المسارات المستخدمة
  console.log('\n📋 Directory Summary:');
  console.log(`   Base Directory: ${baseDir}`);
  console.log(`   Environment: ${isReplit ? 'Replit' : (isVPS ? 'VPS' : 'Local')}`);
  console.log(`   Using ENV_CONFIG paths: ${JSON.stringify(ENV_CONFIG.paths, null, 2)}`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupDirectories().catch(console.error);
}

export { setupDirectories };
