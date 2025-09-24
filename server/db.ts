import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import fs from 'fs';
import * as schema from "@shared/schema";
import { envLoader, initializeEnvironment } from './utils/env-loader';
import { smartConnectionManager } from './services/smart-connection-manager';

// تهيئة متغيرات البيئة عند تحميل الموديول
initializeEnvironment();

// إنشاء رابط قاعدة البيانات مع الأولوية الصحيحة
function createDatabaseUrl(): string {
  const databaseUrl = envLoader.get('DATABASE_URL');

  if (databaseUrl) {
    console.log('✅ تم العثور على DATABASE_URL');
    console.log('🔧 Connection string:', databaseUrl.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));
    return databaseUrl;
  }

  console.error('❌ DATABASE_URL غير موجود في أي من المصادر:');
  console.error('   - ملف .env');
  console.error('   - ecosystem.config.json');
  console.error('   - متغيرات بيئة النظام');
  throw new Error('DATABASE_URL is required');
}

// 🔧 **إعداد SSL محسّن وآمن للاتصال**
function setupSSLConfig() {
  const connectionString = createDatabaseUrl();

  // التحقق من نوع الاتصال
  const isLocalConnection = connectionString.includes('localhost') || 
                           connectionString.includes('127.0.0.1') ||
                           connectionString.includes('@localhost/');

  if (isLocalConnection) {
    console.log('🔓 اتصال محلي - تعطيل SSL');
    return false;
  }

  console.log('🔐 اتصال خارجي - إعداد SSL آمن ومرن');

  // 🛡️ **SSL Configuration آمن ومحسن**
  const sslConfig: any = {
    // الافتراضي: تفعيل التحقق من الشهادات (أمان قوي)
    rejectUnauthorized: true,
    // تطلب تشفير قوي
    minVersion: 'TLSv1.2' as const,
    maxVersion: 'TLSv1.3' as const,
  };
  
  // محاولة استخدام شهادة SSL من متغيرات البيئة أولاً
  try {
    const sslCert = envLoader.get('PGSSLROOTCERT');
    
    if (sslCert) {
      console.log('📜 [SSL] استخدام شهادة SSL من متغيرات البيئة');
      sslConfig.ca = sslCert;
      // تعطيل التحقق للاختبار حتى مع وجود شهادة
      sslConfig.rejectUnauthorized = false;
      console.log('✅ [SSL] تم تحميل الشهادة - تعطيل التحقق للاختبار');
    } else {
      // إذا لم توجد شهادة في متغيرات البيئة، تحقق من الملف
      const certPath = './pg_cert.pem';
      if (fs.existsSync(certPath)) {
        console.log('📜 [SSL] استخدام شهادة SSL من الملف');
        sslConfig.ca = fs.readFileSync(certPath);
        console.log('✅ [SSL] تم تحميل الشهادة من الملف - تفعيل التحقق الكامل');
      } else {
        // للخوادم الخاصة المعروفة والموثوقة فقط أو الاختبار
        console.log('🔧 [SSL] تعطيل التحقق للاختبار');
        sslConfig.rejectUnauthorized = false;
        
        if (connectionString.includes('93.127.142.144') || 
            connectionString.includes('binarjoinanelytic.info')) {
          console.log('⚠️ [SSL] خادم خاص موثوق - تعطيل التحقق مؤقتاً');
          
          // إضافة تحقق مخصص للخوادم الموثوقة
          sslConfig.checkServerIdentity = (hostname: string, cert: any) => {
            console.log(`🔍 [SSL] التحقق المخصص للخادم: ${hostname}`);
            if (hostname && (
              hostname.includes('93.127.142.144') || 
              hostname.includes('binarjoinanelytic.info')
            )) {
              console.log('✅ [SSL] خادم خاص معروف ومسموح');
              return undefined; // تمرير التحقق
            }
            // للخوادم غير المعروفة، رفض الاتصال
            throw new Error(`خادم غير مسموح: ${hostname}`);
          };
        }
      }
    }
  } catch (error) {
    console.error('❌ [SSL] خطأ في إعداد SSL:', error);
    throw error;
  }

  return sslConfig;
}

// SSL configuration is handled per connection in setupSSLConfig()

const connectionString = createDatabaseUrl(); // Re-fetch to ensure we have the correct string for config
const sslConfig = setupSSLConfig();

// تكوين اتصال قاعدة البيانات
// Remove SSL parameters from connection string to avoid conflicts
const cleanConnectionString = connectionString.replace(/[?&]sslmode=[^&]*/g, '').replace(/[?&]ssl=[^&]*/g, '');

export const pool = new Pool({ 
  connectionString: cleanConnectionString,
  ssl: sslConfig,
  // إعدادات الاتصال المحسنة
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
  keepAlive: true,
  statement_timeout: 30000,
  query_timeout: 30000
});

export const db = drizzle(pool, { schema });

// اختبار الاتصال عند تحميل الموديول
(async () => {
  try {
    const client = await pool.connect();
    const res = await client.query('SELECT version(), current_database(), current_user');
    console.log('✅ نجح الاتصال بقاعدة البيانات');
    console.log('📊 إصدار PostgreSQL:', res.rows[0].version?.split(' ')[0] || 'غير معروف');
    console.log('🗃️ قاعدة البيانات:', res.rows[0].current_database);
    console.log('👤 المستخدم:', res.rows[0].current_user);
    client.release();
  } catch (err) {
    console.error('❌ فشل الاتصال بقاعدة البيانات:', err);
  }
})();

// 🧠 الدوال الذكية لإدارة الاتصالات
export function getSmartDB(operationType: 'read' | 'write' | 'backup' | 'sync' = 'read') {
  const connection = smartConnectionManager.getSmartConnection(operationType);
  
  console.log(`🎯 [Smart DB] توجيه ${operationType} إلى: ${connection.source || 'لا يوجد اتصال'}`);
  
  return connection.db || db; // fallback to default db
}

export function getSmartPool(operationType: 'read' | 'write' | 'backup' | 'sync' = 'read') {
  const connection = smartConnectionManager.getSmartConnection(operationType);
  
  console.log(`🎯 [Smart Pool] توجيه ${operationType} إلى: ${connection.source || 'لا يوجد اتصال'}`);
  
  return connection.pool || pool; // fallback to default pool
}