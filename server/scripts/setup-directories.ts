

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
  'nginx',
  'pm2'
];

// مسارات إضافية خاصة ببيئة Replit
const REPLIT_SPECIFIC_DIRECTORIES = [
  'storage/apps',
  'storage/backups',
  'storage/cache',
  'logs/applications',
  'logs/system',
  'logs/nginx',
  'config/apps',
  'config/nginx',
  'ssl/certificates',
  'nginx/sites-available',
  'nginx/sites-enabled',
  'nginx/conf.d',
  'pm2/logs',
  'pm2/pids'
];

async function setupDirectories() {
  // اكتشاف البيئة المحسن
  const isReplit = !!(
    process.env.REPL_ID ||
    process.env.REPLIT_DB_URL ||
    process.env.REPL_SLUG ||
    process.env.REPLIT_CLUSTER ||
    process.env.REPLIT_ENVIRONMENT ||
    (process.env.PWD?.startsWith('/home/runner/') && !process.env.PWD?.includes('/home/administrator/')) ||
    (process.env.HOME === '/home/runner' && !process.cwd().includes('/home/administrator/'))
  );

  if (isReplit) {
    console.log('🏗️ Setting up required directories for Replit environment...');
  } else {
    console.log('🏗️ Setting up required directories for external environment...');
  }
  
  const isVPS = process.env.HOSTNAME?.includes('93.127.142.144') || 
               process.env.HOSTNAME?.includes('vps-fbaz') ||
               process.env.SERVER_TYPE === 'external' ||
               process.env.PWD?.includes('/home/administrator/Panel') ||
               process.cwd().includes('/home/administrator/Panel');
  
  console.log(`🔍 Environment detected: ${isReplit ? 'Replit' : (isVPS ? 'VPS' : 'Local')}`);
  console.log(`📁 Current working directory: ${process.cwd()}`);
  console.log(`🏠 Home directory: ${process.env.HOME || 'undefined'}`);
  console.log(`📂 PWD: ${process.env.PWD || 'undefined'}`);
  
  // تحديد المسار الأساسي حسب البيئة
  let baseDir: string = process.cwd();
  
  if (isReplit) {
    // في بيئة Replit، استخدم مجلد المشروع الحالي
    baseDir = process.cwd();
    console.log(`🔧 Using Replit project directory: ${baseDir}`);
  } else if (isVPS) {
    // للـ VPS، استخدم مسارات محلية داخل مجلد المشروع
    baseDir = process.cwd();
    console.log(`🔧 Using VPS project directory: ${baseDir}`);
  } else {
    // للتطوير المحلي
    baseDir = process.cwd();
    console.log(`🔧 Using local development directory: ${baseDir}`);
  }
  
  // إنشاء المجلدات الأساسية
  for (const dir of REQUIRED_DIRECTORIES) {
    await createDirectory(path.join(baseDir, dir), dir);
  }
  
  // إنشاء المجلدات الفرعية المخصصة لـ Replit
  if (isReplit) {
    console.log('🔧 Creating Replit-specific subdirectories...');
    for (const dir of REPLIT_SPECIFIC_DIRECTORIES) {
      await createDirectory(path.join(baseDir, dir), `Replit/${dir}`);
    }
  }
  
  // إنشاء ملفات الإعداد الأساسية
  await createConfigFiles(baseDir, isReplit);
  
  console.log('🎉 Directory setup completed!');
  
  // طباعة ملخص المسارات المستخدمة
  console.log('\n📋 Directory Summary:');
  console.log(`   Base Directory: ${baseDir}`);
  console.log(`   Environment: ${isReplit ? 'Replit' : (isVPS ? 'VPS' : 'Local')}`);
  console.log(`   Using ENV_CONFIG paths: ${JSON.stringify(ENV_CONFIG.paths, null, 2)}`);
  
  // التحقق من جميع المسارات
  await verifyDirectories(baseDir);
}

async function createDirectory(dirPath: string, displayName: string) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true, mode: 0o755 });
      console.log(`✅ Created directory: ${displayName} -> ${dirPath}`);
    } else {
      console.log(`✓ Directory already exists: ${displayName} -> ${dirPath}`);
    }
    
    // التحقق من الصلاحيات
    try {
      fs.accessSync(dirPath, fs.constants.W_OK);
      console.log(`✅ Write permission confirmed for: ${displayName}`);
    } catch (permError) {
      console.warn(`⚠️ No write permission for: ${displayName}`);
      // محاولة تعديل الصلاحيات إذا كان ممكناً
      try {
        fs.chmodSync(dirPath, 0o755);
        console.log(`✅ Fixed permissions for: ${displayName}`);
      } catch (chmodError) {
        console.warn(`❌ Could not fix permissions for: ${displayName}`);
      }
    }
    
  } catch (error: unknown) {
    // فقط اطبع الخطأ إذا كنا في بيئة Replit الفعلية
    if (isReplit && ENV_CONFIG.name === 'replit') {
      console.error(`❌ Failed to create directory ${displayName} (${dirPath}):`, error);
    }
    
    // إذا فشل إنشاء المجلد، جرب مسار بديل
    if (error && typeof error === 'object' && 'code' in error && error.code === 'EACCES') {
      const fallbackPath = path.join('/tmp', path.basename(dirPath));
      try {
        fs.mkdirSync(fallbackPath, { recursive: true, mode: 0o755 });
        console.log(`🔄 Created fallback directory: ${displayName} -> ${fallbackPath}`);
      } catch (fallbackError) {
        console.error(`❌ Fallback also failed for ${displayName}: ${fallbackError}`);
      }
    }
  }
}

async function createConfigFiles(baseDir: string, isReplit: boolean) {
  console.log('📄 Creating configuration files...');
  
  // إنشاء ملف nginx أساسي
  const nginxConfigPath = path.join(baseDir, 'nginx', 'nginx.conf');
  if (!fs.existsSync(nginxConfigPath)) {
    const nginxConfig = `
# Basic Nginx configuration for ${isReplit ? 'Replit' : 'server'} environment
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    
    sendfile        on;
    tcp_nopush      on;
    tcp_nodelay     on;
    keepalive_timeout  65;
    
    # Basic server block
    server {
        listen 80;
        server_name localhost;
        root ${baseDir}/uploads;
        index index.html index.htm;
        
        location / {
            try_files $uri $uri/ =404;
        }
    }
}
`;
    
    try {
      fs.writeFileSync(nginxConfigPath, nginxConfig);
      console.log(`✅ Created nginx configuration: ${nginxConfigPath}`);
    } catch (error) {
      console.warn(`⚠️ Could not create nginx config: ${error}`);
    }
  }
  
  // إنشاء ملف PM2 ecosystem
  const pm2ConfigPath = path.join(baseDir, 'pm2', 'ecosystem.config.js');
  if (!fs.existsSync(pm2ConfigPath)) {
    const pm2Config = `
module.exports = {
  apps: [{
    name: 'panel-app',
    script: '${baseDir}/server/index.ts',
    interpreter: 'tsx',
    watch: false,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 3000,
    env: {
      NODE_ENV: 'development',
      PORT: '5000'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: '5000'
    },
    log_file: '${baseDir}/logs/pm2-combined.log',
    out_file: '${baseDir}/logs/pm2-out.log',
    error_file: '${baseDir}/logs/pm2-error.log',
    pid_file: '${baseDir}/pm2/pids/panel-app.pid'
  }]
};
`;
    
    try {
      fs.writeFileSync(pm2ConfigPath, pm2Config);
      console.log(`✅ Created PM2 configuration: ${pm2ConfigPath}`);
    } catch (error) {
      console.warn(`⚠️ Could not create PM2 config: ${error}`);
    }
  }
  
  // إنشاء ملف gitkeep للمجلدات الفارغة
  const keepDirs = ['logs', 'uploads', 'ssl/certificates'];
  for (const dir of keepDirs) {
    const keepPath = path.join(baseDir, dir, '.gitkeep');
    if (!fs.existsSync(keepPath)) {
      try {
        fs.writeFileSync(keepPath, '# Keep this directory in git\n');
        console.log(`✅ Created .gitkeep: ${dir}`);
      } catch (error) {
        console.warn(`⚠️ Could not create .gitkeep in ${dir}: ${error}`);
      }
    }
  }
}

async function verifyDirectories(baseDir: string) {
  console.log('\n🔍 Verifying directory structure...');
  
  const allDirs = [...REQUIRED_DIRECTORIES, ...REPLIT_SPECIFIC_DIRECTORIES];
  let successCount = 0;
  let totalCount = allDirs.length;
  
  for (const dir of allDirs) {
    const dirPath = path.join(baseDir, dir);
    const exists = fs.existsSync(dirPath);
    
    if (exists) {
      try {
        const stats = fs.statSync(dirPath);
        const isWritable = fs.accessSync(dirPath, fs.constants.W_OK) === undefined;
        console.log(`✅ ${dir}: exists, ${stats.isDirectory() ? 'directory' : 'file'}, ${isWritable ? 'writable' : 'read-only'}`);
        successCount++;
      } catch {
        console.log(`✅ ${dir}: exists`);
        successCount++;
      }
    } else {
      console.log(`❌ ${dir}: missing`);
    }
  }
  
  console.log(`\n📊 Summary: ${successCount}/${totalCount} directories created successfully`);
  
  if (successCount === totalCount) {
    console.log('🎉 All directories are ready!');
  } else {
    console.log('⚠️ Some directories could not be created. Check permissions and try again.');
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupDirectories().catch(console.error);
}

export { setupDirectories };

