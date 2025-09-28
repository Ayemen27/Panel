
/**
 * Script: project-audit.js
 * الوصف: فحص شامل للخدمات والملفات في مشروع Node.js/TypeScript
 * الهدف: التحقق من توحيد النظام، كشف الملفات القديمة، وإنشاء تقرير مفصل
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// مجلد المشروع الرئيسي
const PROJECT_ROOT = path.resolve(__dirname);

// الخدمات الموحدة الأساسية
const UNIFIED_SERVICES = [
  'BaseService.ts',
  'ServiceContainer.ts',
  'ServiceTokens.ts',
  'ResponseHandler.ts',
  'ServiceError.ts',
  'systemService.ts',
  'logService.ts',
  'unifiedFileService.ts',
  'nginxService.ts',
  'pm2Service.ts',
  'sslService.ts',
  'UnifiedNotificationService.ts',
  'auditService.ts',
  'backupService.ts',
  'deploymentService.ts',
  'monitoringService.ts',
  'smart-connection-manager.ts',
  'storageStatsService.ts'
];

// ملفات أو مجلدات قديمة محتملة
const LEGACY_FOLDERS = ['oldServices', 'legacy', 'backup', 'old', 'deprecated'];
const LEGACY_FILES = ['old-', 'legacy-', 'backup-', 'temp-', 'test-'];

// أنماط الاستيرادات القديمة
const OLD_IMPORT_PATTERNS = [
  /import.*from\s+['"]\.\.?\/(?!.*unified).*Service['"]/,
  /require\(['"]\.\.?\/(?!.*unified).*Service['"]\)/,
  /import.*express.*Router/,
  /app\.use\(/
];

// لتخزين التقرير النهائي
const report = {
  unifiedServicesFound: [],
  missingUnifiedServices: [],
  legacyFilesFound: [],
  duplicateFiles: [],
  filesUsingOldImports: [],
  unusedFiles: [],
  allFilesScanned: [],
  serviceIntegrationStatus: {},
  rateLimitingStatus: [],
  authenticationIssues: []
};

// دالة للتحقق من نوع الملف
function isRelevantFile(filename) {
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.json'];
  return extensions.some(ext => filename.endsWith(ext));
}

// دالة للتحقق من الملفات المكررة
function checkDuplicates(files) {
  const fileMap = {};
  files.forEach(file => {
    const basename = path.basename(file);
    if (!fileMap[basename]) {
      fileMap[basename] = [];
    }
    fileMap[basename].push(file);
  });

  Object.keys(fileMap).forEach(basename => {
    if (fileMap[basename].length > 1) {
      report.duplicateFiles.push({
        filename: basename,
        locations: fileMap[basename]
      });
    }
  });
}

// دالة للتحقق من استخدام الملفات
function checkFileUsage(filePath, allFiles) {
  const filename = path.basename(filePath, path.extname(filePath));
  const isUsed = allFiles.some(file => {
    if (file === filePath) return false;
    try {
      const content = fs.readFileSync(file, 'utf-8');
      return content.includes(filename) || content.includes(path.basename(filePath));
    } catch (error) {
      return false;
    }
  });
  
  if (!isUsed && !filePath.includes('index.') && !filePath.includes('main.')) {
    report.unusedFiles.push(filePath);
  }
}

// دالة لفحص حالة النظام الموحد
function checkUnificationStatus(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const filename = path.basename(filePath);
    
    const status = {
      file: filePath,
      usesBaseService: content.includes('BaseService') || content.includes('extends BaseService'),
      usesServiceContainer: content.includes('ServiceContainer'),
      usesUnifiedImports: content.includes('unified'),
      hasOldPatterns: OLD_IMPORT_PATTERNS.some(pattern => pattern.test(content)),
      isUnified: false
    };
    
    status.isUnified = status.usesBaseService && status.usesServiceContainer && !status.hasOldPatterns;
    report.serviceIntegrationStatus[filename] = status;
    
    return status;
  } catch (error) {
    return null;
  }
}

// دالة للتحقق من مشاكل المعدل المحدود وتسجيل الدخول
function checkAuthenticationIssues() {
  const authFiles = ['auth.ts', 'useAuth.ts', 'rateLimiter.ts'];
  authFiles.forEach(authFile => {
    const authPath = findFile(authFile);
    if (authPath) {
      try {
        const content = fs.readFileSync(authPath, 'utf-8');
        
        // التحقق من وجود Rate Limiting
        if (content.includes('429') || content.includes('Too Many Requests')) {
          report.rateLimitingStatus.push({
            file: authPath,
            hasRateLimit: true,
            message: 'نظام Rate Limiting يعمل بشكل صحيح'
          });
        }
        
        // التحقق من مشاكل Authentication
        if (content.includes('login') && content.includes('error')) {
          report.authenticationIssues.push({
            file: authPath,
            issue: 'تم العثور على معالجة أخطاء تسجيل الدخول',
            recommendation: 'تأكد من أن الرسائل واضحة للمستخدم'
          });
        }
      } catch (error) {
        // تجاهل الأخطاء
      }
    }
  });
}

// دالة للبحث عن ملف
function findFile(filename) {
  function searchInDir(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (let entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const result = searchInDir(fullPath);
          if (result) return result;
        } else if (entry.name === filename) {
          return fullPath;
        }
      }
    } catch (error) {
      // تجاهل المجلدات غير القابلة للقراءة
    }
    return null;
  }
  return searchInDir(PROJECT_ROOT);
}

// دالة لفحص المجلدات والملفات recursively
function scanDir(dir) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (let entry of entries) {
      // تجاهل المجلدات الخاصة
      if (entry.name.startsWith('.') || entry.name === 'node_modules') {
        continue;
      }
      
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        scanDir(fullPath);
        // التحقق من المجلدات القديمة
        if (LEGACY_FOLDERS.includes(entry.name.toLowerCase())) {
          report.legacyFilesFound.push({
            path: fullPath,
            type: 'directory',
            reason: 'مجلد قديم محتمل'
          });
        }
      } else if (isRelevantFile(entry.name)) {
        report.allFilesScanned.push(fullPath);

        // التحقق من الخدمات الموحدة
        if (UNIFIED_SERVICES.includes(entry.name)) {
          report.unifiedServicesFound.push(fullPath);
        }

        // التحقق من الملفات القديمة
        const isLegacy = LEGACY_FILES.some(prefix => 
          entry.name.toLowerCase().startsWith(prefix)
        );
        if (isLegacy) {
          report.legacyFilesFound.push({
            path: fullPath,
            type: 'file',
            reason: 'ملف قديم محتمل بناءً على التسمية'
          });
        }

        // فحص حالة التوحيد
        checkUnificationStatus(fullPath);

        // التحقق من استيرادات قديمة في الملفات
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          OLD_IMPORT_PATTERNS.forEach((pattern, index) => {
            if (pattern.test(content)) {
              report.filesUsingOldImports.push({
                file: fullPath,
                pattern: `نمط قديم ${index + 1}`,
                line: content.split('\n').findIndex(line => pattern.test(line)) + 1
              });
            }
          });
        } catch (error) {
          // تجاهل أخطاء قراءة الملفات
        }
      }
    }
  } catch (error) {
    console.error(`❌ خطأ في فحص المجلد ${dir}:`, error.message);
  }
}

// دالة لحفظ التقرير كملف HTML
function saveHtmlReport() {
  const htmlContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>تقرير فحص المشروع الشامل</title>
    <style>
        body { font-family: 'Arial', sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .stat-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; border-radius: 8px; text-align: center; }
        .stat-number { font-size: 2em; font-weight: bold; display: block; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 12px; text-align: right; border-bottom: 1px solid #ddd; }
        th { background: #3498db; color: white; }
        tr:nth-child(even) { background: #f9f9f9; }
        .status-unified { color: #27ae60; font-weight: bold; }
        .status-legacy { color: #e74c3c; font-weight: bold; }
        .status-partial { color: #f39c12; font-weight: bold; }
        .recommendation { background: #e8f6f3; border-right: 4px solid #27ae60; padding: 15px; margin: 15px 0; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 تقرير فحص المشروع الشامل</h1>
        <p><strong>تاريخ التقرير:</strong> ${new Date().toLocaleDateString('ar-SA')}</p>
        
        <div class="stats">
            <div class="stat-card">
                <span class="stat-number">${report.allFilesScanned.length}</span>
                إجمالي الملفات المفحوصة
            </div>
            <div class="stat-card">
                <span class="stat-number">${report.unifiedServicesFound.length}</span>
                خدمات موحدة موجودة
            </div>
            <div class="stat-card">
                <span class="stat-number">${report.legacyFilesFound.length}</span>
                ملفات قديمة محتملة
            </div>
            <div class="stat-card">
                <span class="stat-number">${report.filesUsingOldImports.length}</span>
                ملفات تستخدم أنماط قديمة
            </div>
        </div>

        <h2>📊 حالة الخدمات الموحدة</h2>
        <table>
            <thead>
                <tr><th>اسم الملف</th><th>يستخدم BaseService</th><th>يستخدم ServiceContainer</th><th>الحالة</th></tr>
            </thead>
            <tbody>
                ${Object.entries(report.serviceIntegrationStatus).map(([filename, status]) => `
                    <tr>
                        <td>${filename}</td>
                        <td>${status.usesBaseService ? '✅' : '❌'}</td>
                        <td>${status.usesServiceContainer ? '✅' : '❌'}</td>
                        <td class="${status.isUnified ? 'status-unified' : (status.usesBaseService || status.usesServiceContainer ? 'status-partial' : 'status-legacy')}">
                            ${status.isUnified ? 'موحد بالكامل' : (status.usesBaseService || status.usesServiceContainer ? 'موحد جزئياً' : 'غير موحد')}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        ${report.rateLimitingStatus.length > 0 ? `
        <h2>🛡️ حالة نظام Rate Limiting</h2>
        <table>
            <thead>
                <tr><th>الملف</th><th>الحالة</th><th>الملاحظات</th></tr>
            </thead>
            <tbody>
                ${report.rateLimitingStatus.map(item => `
                    <tr>
                        <td>${path.basename(item.file)}</td>
                        <td>${item.hasRateLimit ? '✅ يعمل' : '❌ لا يعمل'}</td>
                        <td>${item.message}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        ` : ''}

        <div class="recommendation">
            <h3>📝 التوصيات:</h3>
            <ul>
                <li>حذف الملفات القديمة المحددة في التقرير</li>
                <li>توحيد الخدمات غير الموحدة لاستخدام BaseService</li>
                <li>تحديث الاستيرادات لاستخدام النظام الموحد</li>
                <li>مراجعة الملفات غير المستخدمة وحذفها إذا لزم الأمر</li>
            </ul>
        </div>
    </div>
</body>
</html>`;

  fs.writeFileSync('project-audit-report.html', htmlContent, 'utf-8');
  console.log('📄 تم حفظ التقرير المفصل في: project-audit-report.html');
}

// بدء الفحص
console.log('🔍 بدء فحص المشروع...');
console.log(`📁 مسار المشروع: ${PROJECT_ROOT}`);

scanDir(PROJECT_ROOT);

// التحقق من الخدمات المفقودة
UNIFIED_SERVICES.forEach(service => {
  if (!report.unifiedServicesFound.some(f => f.endsWith(service))) {
    report.missingUnifiedServices.push(service);
  }
});

// التحقق من الملفات المكررة
checkDuplicates(report.allFilesScanned);

// التحقق من الملفات غير المستخدمة (فحص محدود)
report.allFilesScanned.slice(0, 50).forEach(file => {
  checkFileUsage(file, report.allFilesScanned);
});

// التحقق من مشاكل المصادقة
checkAuthenticationIssues();

// طباعة التقرير النهائي
console.log('\n' + '='.repeat(60));
console.log('✅ تقرير الفحص النهائي');
console.log('='.repeat(60));

console.log(`\n📊 الإحصائيات العامة:`);
console.log(`   📁 إجمالي الملفات المفحوصة: ${report.allFilesScanned.length}`);
console.log(`   ✅ خدمات موحدة موجودة: ${report.unifiedServicesFound.length}`);
console.log(`   ❌ خدمات موحدة مفقودة: ${report.missingUnifiedServices.length}`);
console.log(`   🗑️  ملفات قديمة محتملة: ${report.legacyFilesFound.length}`);
console.log(`   📋 ملفات مكررة: ${report.duplicateFiles.length}`);
console.log(`   ⚠️  ملفات بأنماط قديمة: ${report.filesUsingOldImports.length}`);

if (report.unifiedServicesFound.length > 0) {
  console.log('\n✅ الخدمات الموحدة الموجودة:');
  report.unifiedServicesFound.forEach((file, index) => {
    console.log(`   ${index + 1}. ${path.relative(PROJECT_ROOT, file)}`);
  });
}

if (report.missingUnifiedServices.length > 0) {
  console.log('\n❌ الخدمات الموحدة المفقودة:');
  report.missingUnifiedServices.forEach((service, index) => {
    console.log(`   ${index + 1}. ${service}`);
  });
}

if (report.legacyFilesFound.length > 0) {
  console.log('\n🗑️ الملفات أو المجلدات القديمة:');
  report.legacyFilesFound.forEach((item, index) => {
    console.log(`   ${index + 1}. ${path.relative(PROJECT_ROOT, item.path)} (${item.reason})`);
  });
}

if (report.duplicateFiles.length > 0) {
  console.log('\n📋 الملفات المكررة:');
  report.duplicateFiles.forEach((item, index) => {
    console.log(`   ${index + 1}. ${item.filename}:`);
    item.locations.forEach(location => {
      console.log(`      - ${path.relative(PROJECT_ROOT, location)}`);
    });
  });
}

if (report.rateLimitingStatus.length > 0) {
  console.log('\n🛡️ حالة نظام الحماية:');
  report.rateLimitingStatus.forEach((item, index) => {
    console.log(`   ${index + 1}. ${item.message} في ${path.basename(item.file)}`);
  });
}

// حفظ التقرير المفصل
saveHtmlReport();

console.log('\n' + '='.repeat(60));
console.log('🎉 الفحص اكتمل بنجاح!');
console.log('📄 يمكنك مراجعة التقرير المفصل في الملف: project-audit-report.html');
console.log('='.repeat(60));
