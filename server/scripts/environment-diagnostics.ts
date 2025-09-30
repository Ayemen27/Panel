
import { ENV_CONFIG, logEnvironmentInfo } from '../../shared/environment.js';

async function runEnvironmentDiagnostics() {
  console.log('🔍 Starting Environment Diagnostics...\n');
  
  // معلومات النظام الأساسية
  console.log('=== SYSTEM INFORMATION ===');
  console.log(`Operating System: ${process.platform}`);
  console.log(`Node.js Version: ${process.version}`);
  console.log(`Process ID: ${process.pid}`);
  console.log(`Current Working Directory: ${process.cwd()}`);
  console.log(`Home Directory: ${process.env.HOME || 'undefined'}`);
  console.log(`User: ${process.env.USER || process.env.USERNAME || 'undefined'}`);
  
  // متغيرات البيئة المهمة
  console.log('\n=== ENVIRONMENT VARIABLES ===');
  const importantEnvVars = [
    'NODE_ENV',
    'PORT',
    'PWD',
    'HOME',
    'USER',
    'HOSTNAME',
    'REPL_ID',
    'REPLIT_DB_URL',
    'REPL_SLUG',
    'REPLIT_CLUSTER',
    'REPLIT_ENVIRONMENT',
    'DATABASE_URL',
    'SESSION_SECRET'
  ];
  
  importantEnvVars.forEach(envVar => {
    const value = process.env[envVar];
    if (value) {
      // إخفاء المعلومات الحساسة
      const sensitiveVars = ['DATABASE_URL', 'SESSION_SECRET', 'REPLIT_DB_URL'];
      const displayValue = sensitiveVars.includes(envVar) 
        ? `${value.substring(0, 10)}...` 
        : value;
      console.log(`${envVar}: ${displayValue}`);
    } else {
      console.log(`${envVar}: undefined`);
    }
  });
  
  // اكتشاف نوع البيئة
  console.log('\n=== ENVIRONMENT DETECTION ===');
  const isReplit = !!(
    process.env.REPL_ID ||
    process.env.REPLIT_DB_URL ||
    process.env.REPL_SLUG ||
    process.env.PWD?.startsWith('/home/runner/') ||
    process.env.HOME === '/home/runner'
  );
  
  const isVPS = !!(
    process.env.HOSTNAME?.includes('93.127.142.144') || 
    process.env.HOSTNAME?.includes('vps-fbaz') ||
    process.env.PWD?.includes('/home/administrator/')
  );
  
  console.log(`Is Replit Environment: ${isReplit ? '✅ YES' : '❌ NO'}`);
  console.log(`Is VPS Environment: ${isVPS ? '✅ YES' : '❌ NO'}`);
  console.log(`Is Local Development: ${!isReplit && !isVPS ? '✅ YES' : '❌ NO'}`);
  
  // معلومات إعدادات البيئة
  console.log('\n=== ENVIRONMENT CONFIGURATION ===');
  logEnvironmentInfo();
  
  // فحص المسارات
  console.log('\n=== PATH VERIFICATION ===');
  const fs = await import('fs');
  const path = await import('path');
  
  const pathsToCheck = [
    ENV_CONFIG.paths.root,
    ENV_CONFIG.paths.logs,
    ENV_CONFIG.paths.uploads,
    ENV_CONFIG.paths.config,
    ENV_CONFIG.paths.ssl,
    ENV_CONFIG.paths.nginx
  ];
  
  pathsToCheck.forEach(pathToCheck => {
    try {
      const exists = fs.existsSync(pathToCheck);
      const stats = exists ? fs.statSync(pathToCheck) : null;
      const isDirectory = stats?.isDirectory() || false;
      
      let accessInfo = '';
      if (exists) {
        try {
          fs.accessSync(pathToCheck, fs.constants.R_OK);
          accessInfo += 'R';
        } catch {}
        
        try {
          fs.accessSync(pathToCheck, fs.constants.W_OK);
          accessInfo += 'W';
        } catch {}
        
        try {
          fs.accessSync(pathToCheck, fs.constants.X_OK);
          accessInfo += 'X';
        } catch {}
      }
      
      console.log(`${exists ? '✅' : '❌'} ${pathToCheck} ${isDirectory ? '[DIR]' : '[FILE]'} ${accessInfo ? `(${accessInfo})` : ''}`);
    } catch (error) {
      console.log(`❌ ${pathToCheck} [ERROR: ${error}]`);
    }
  });
  
  // فحص الشبكة
  console.log('\n=== NETWORK CONFIGURATION ===');
  console.log(`Server Host: ${ENV_CONFIG.host}`);
  console.log(`Server Port: ${ENV_CONFIG.port}`);
  console.log(`WebSocket Host: ${ENV_CONFIG.websocket.host}`);
  console.log(`WebSocket Port: ${ENV_CONFIG.websocket.port}`);
  console.log(`WebSocket Protocol: ${ENV_CONFIG.websocket.protocol}`);
  
  // فحص قاعدة البيانات
  console.log('\n=== DATABASE CONFIGURATION ===');
  console.log(`Database SSL: ${ENV_CONFIG.database.ssl ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`Connection Pooling: ${ENV_CONFIG.database.connectionPooling ? '✅ Enabled' : '❌ Disabled'}`);
  
  if (process.env.DATABASE_URL) {
    try {
      const url = new URL(process.env.DATABASE_URL);
      console.log(`Database Host: ${url.hostname}`);
      console.log(`Database Port: ${url.port || 'default'}`);
      console.log(`Database Name: ${url.pathname.substring(1)}`);
      console.log(`Database User: ${url.username}`);
    } catch (error) {
      console.log(`❌ Invalid DATABASE_URL format`);
    }
  } else {
    console.log(`❌ DATABASE_URL not configured`);
  }
  
  // توصيات
  console.log('\n=== RECOMMENDATIONS ===');
  
  if (!isReplit && !isVPS) {
    console.log('💡 Detected local development environment');
    console.log('   - Make sure all required directories exist');
    console.log('   - Consider using development database settings');
  } else if (isReplit) {
    console.log('💡 Detected Replit environment');
    console.log('   - Using project-relative paths');
    console.log('   - WebSocket configured for Replit domains');
    console.log('   - SSL enabled for secure connections');
  } else if (isVPS) {
    console.log('💡 Detected VPS environment');
    console.log('   - Using absolute paths for production');
    console.log('   - SSL certificates should be configured');
    console.log('   - Consider PM2 for process management');
  }
  
  console.log('\n🎉 Environment diagnostics completed!');
}

// تشغيل التشخيص إذا تم استدعاؤه مباشرة
if (import.meta.url === `file://${process.argv[1]}`) {
  runEnvironmentDiagnostics().catch(console.error);
}

export { runEnvironmentDiagnostics };
