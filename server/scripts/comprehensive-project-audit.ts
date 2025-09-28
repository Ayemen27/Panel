
/**
 * Script شامل لفحص المشروع وضمان توحيد النظام
 * يفحص الخدمات، الملفات القديمة، التكامل، والأخطاء
 */

import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface AuditResult {
  unifiedServices: {
    total: number;
    usingBaseService: string[];
    notUsingBaseService: string[];
    usingServiceContainer: string[];
    notUsingServiceContainer: string[];
  };
  legacyFiles: {
    total: number;
    files: string[];
    directories: string[];
  };
  duplicateFiles: {
    total: number;
    duplicates: Array<{
      name: string;
      locations: string[];
    }>;
  };
  routesIntegration: {
    total: number;
    integrated: string[];
    needsIntegration: string[];
  };
  unusedFiles: string[];
  systemHealth: {
    buildStatus: 'pass' | 'fail';
    lintStatus: 'pass' | 'fail';
    serverStatus: 'running' | 'stopped' | 'error';
  };
  recommendations: string[];
}

class ComprehensiveProjectAuditor {
  private projectRoot: string;
  private result: AuditResult;

  constructor() {
    this.projectRoot = process.cwd();
    this.result = {
      unifiedServices: {
        total: 0,
        usingBaseService: [],
        notUsingBaseService: [],
        usingServiceContainer: [],
        notUsingServiceContainer: []
      },
      legacyFiles: {
        total: 0,
        files: [],
        directories: []
      },
      duplicateFiles: {
        total: 0,
        duplicates: []
      },
      routesIntegration: {
        total: 0,
        integrated: [],
        needsIntegration: []
      },
      unusedFiles: [],
      systemHealth: {
        buildStatus: 'fail',
        lintStatus: 'fail',
        serverStatus: 'stopped'
      },
      recommendations: []
    };
  }

  async runComprehensiveAudit(): Promise<AuditResult> {
    console.log('🔍 بدء الفحص الشامل للمشروع...\n');

    try {
      // المهمة 1: فحص بنية المشروع
      await this.auditProjectStructure();

      // المهمة 2: فحص توحيد الخدمات
      await this.auditServiceUnification();

      // المهمة 3: فحص الملفات القديمة والمكررة
      await this.auditLegacyAndDuplicateFiles();

      // المهمة 4: فحص تكامل المسارات
      await this.auditRoutesIntegration();

      // المهمة 5: فحص الملفات غير المستخدمة
      await this.auditUnusedFiles();

      // المهمة 6: فحص صحة النظام
      await this.auditSystemHealth();

      // المهمة 7: إنشاء التوصيات
      this.generateRecommendations();

      console.log('✅ اكتمل الفحص الشامل!\n');
      return this.result;

    } catch (error) {
      console.error('❌ خطأ أثناء الفحص:', error);
      throw error;
    }
  }

  private async auditProjectStructure(): Promise<void> {
    console.log('📁 المهمة 1: فحص بنية المشروع...');

    const requiredFiles = [
      'server/core/BaseService.ts',
      'server/core/ServiceContainer.ts',
      'server/core/ServiceTokens.ts',
      'server/core/ResponseHandler.ts',
      'server/core/ServiceError.ts'
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(this.projectRoot, file);
      try {
        await fs.access(filePath);
        console.log(`  ✅ ${file} موجود`);
      } catch {
        console.log(`  ❌ ${file} مفقود`);
        this.result.recommendations.push(`إنشاء الملف المطلوب: ${file}`);
      }
    }
  }

  private async auditServiceUnification(): Promise<void> {
    console.log('🔧 المهمة 2: فحص توحيد الخدمات...');

    const servicesDir = path.join(this.projectRoot, 'server/services');
    
    try {
      const serviceFiles = await this.getServiceFiles(servicesDir);
      this.result.unifiedServices.total = serviceFiles.length;

      for (const serviceFile of serviceFiles) {
        const content = await fs.readFile(serviceFile, 'utf-8');
        const fileName = path.basename(serviceFile);

        // فحص استخدام BaseService
        if (content.includes('extends BaseService') || content.includes('BaseService')) {
          this.result.unifiedServices.usingBaseService.push(fileName);
          console.log(`  ✅ ${fileName} يستخدم BaseService`);
        } else {
          this.result.unifiedServices.notUsingBaseService.push(fileName);
          console.log(`  ⚠️ ${fileName} لا يستخدم BaseService`);
        }

        // فحص استخدام ServiceContainer
        if (content.includes('ServiceContainer') || content.includes('resolveByToken')) {
          this.result.unifiedServices.usingServiceContainer.push(fileName);
          console.log(`  ✅ ${fileName} يستخدم ServiceContainer`);
        } else {
          this.result.unifiedServices.notUsingServiceContainer.push(fileName);
          console.log(`  ⚠️ ${fileName} لا يستخدم ServiceContainer`);
        }
      }
    } catch (error) {
      console.log(`  ❌ خطأ في فحص الخدمات: ${error}`);
    }
  }

  private async auditLegacyAndDuplicateFiles(): Promise<void> {
    console.log('🗂️ المهمة 3: فحص الملفات القديمة والمكررة...');

    // البحث عن المجلدات القديمة
    const legacyDirs = ['oldServices', 'legacy', 'backup', 'old', 'deprecated'];
    
    for (const dir of legacyDirs) {
      const dirPath = path.join(this.projectRoot, dir);
      try {
        await fs.access(dirPath);
        this.result.legacyFiles.directories.push(dir);
        this.result.legacyFiles.total++;
        console.log(`  ⚠️ مجلد قديم موجود: ${dir}`);
      } catch {
        // المجلد غير موجود - هذا جيد
      }
    }

    // البحث عن الملفات القديمة
    await this.findLegacyFiles(this.projectRoot);

    // البحث عن الملفات المكررة
    await this.findDuplicateFiles();
  }

  private async auditRoutesIntegration(): Promise<void> {
    console.log('🛣️ المهمة 4: فحص تكامل المسارات...');

    const routesFiles = [
      'server/routes.ts',
      'server/routes/unifiedFileRoutes.ts',
      'server/routes/UnifiedNotificationRoutes.ts'
    ];

    for (const routeFile of routesFiles) {
      const filePath = path.join(this.projectRoot, routeFile);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        this.result.routesIntegration.total++;

        if (content.includes('req.services') || content.includes('ServiceContainer')) {
          this.result.routesIntegration.integrated.push(routeFile);
          console.log(`  ✅ ${routeFile} مدمج مع النظام الموحد`);
        } else {
          this.result.routesIntegration.needsIntegration.push(routeFile);
          console.log(`  ⚠️ ${routeFile} يحتاج تكامل مع النظام الموحد`);
        }
      } catch {
        console.log(`  ❌ لا يمكن قراءة ${routeFile}`);
      }
    }
  }

  private async auditUnusedFiles(): Promise<void> {
    console.log('📄 المهمة 5: فحص الملفات غير المستخدمة...');

    // هذا فحص أساسي - يمكن تطويره أكثر
    const potentialUnusedFiles = [
      'server/services/old-*.ts',
      'client/src/components/Common/ErrorBoundaryButton.tsx',
      'client/src/components/Common/LoadingSpinner.tsx',
      'client/src/components/FileManager/FileManagerCore.tsx'
    ];

    for (const pattern of potentialUnusedFiles) {
      // هنا يمكن إضافة منطق أكثر تعقيداً للبحث
      if (pattern.includes('*')) {
        // البحث بالنمط
        continue;
      }
      
      const filePath = path.join(this.projectRoot, pattern);
      try {
        await fs.access(filePath);
        // فحص إذا كان الملف مستخدم في مكان آخر
        const isUsed = await this.checkFileUsage(pattern);
        if (!isUsed) {
          this.result.unusedFiles.push(pattern);
          console.log(`  ⚠️ ملف غير مستخدم: ${pattern}`);
        }
      } catch {
        // الملف غير موجود
      }
    }
  }

  private async auditSystemHealth(): Promise<void> {
    console.log('🏥 المهمة 6: فحص صحة النظام...');

    // فحص البناء
    try {
      console.log('  🔧 فحص البناء...');
      await execAsync('npm run build', { timeout: 120000 });
      this.result.systemHealth.buildStatus = 'pass';
      console.log('  ✅ البناء يعمل بنجاح');
    } catch (error) {
      this.result.systemHealth.buildStatus = 'fail';
      console.log('  ❌ البناء فشل');
      this.result.recommendations.push('إصلاح أخطاء البناء');
    }

    // فحص TypeScript
    try {
      console.log('  📝 فحص TypeScript...');
      await execAsync('npx tsc --noEmit', { timeout: 60000 });
      console.log('  ✅ TypeScript بدون أخطاء');
    } catch (error) {
      console.log('  ❌ أخطاء TypeScript موجودة');
      this.result.recommendations.push('إصلاح أخطاء TypeScript');
    }

    // فحص حالة الخادم
    try {
      console.log('  🖥️ فحص حالة الخادم...');
      const response = await execAsync('curl -s http://localhost:5000/api/health', { timeout: 5000 });
      if (response.stdout.includes('healthy')) {
        this.result.systemHealth.serverStatus = 'running';
        console.log('  ✅ الخادم يعمل بنجاح');
      } else {
        this.result.systemHealth.serverStatus = 'error';
        console.log('  ⚠️ الخادم يعمل لكن مع مشاكل');
      }
    } catch (error) {
      this.result.systemHealth.serverStatus = 'stopped';
      console.log('  ❌ الخادم متوقف أو لا يستجيب');
      this.result.recommendations.push('تشغيل الخادم والتأكد من عمله');
    }
  }

  private generateRecommendations(): void {
    console.log('💡 المهمة 7: إنشاء التوصيات...');

    // توصيات بناءً على النتائج
    if (this.result.unifiedServices.notUsingBaseService.length > 0) {
      this.result.recommendations.push(
        `تحديث ${this.result.unifiedServices.notUsingBaseService.length} خدمة لاستخدام BaseService`
      );
    }

    if (this.result.legacyFiles.total > 0) {
      this.result.recommendations.push(
        `تنظيف ${this.result.legacyFiles.total} ملف/مجلد قديم`
      );
    }

    if (this.result.duplicateFiles.total > 0) {
      this.result.recommendations.push(
        `حل ${this.result.duplicateFiles.total} ملف مكرر`
      );
    }

    if (this.result.routesIntegration.needsIntegration.length > 0) {
      this.result.recommendations.push(
        `تحديث ${this.result.routesIntegration.needsIntegration.length} ملف مسارات للنظام الموحد`
      );
    }
  }

  // دوال مساعدة
  private async getServiceFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.log(`❌ خطأ في قراءة مجلد الخدمات: ${error}`);
    }
    
    return files;
  }

  private async findLegacyFiles(dir: string): Promise<void> {
    const legacyPatterns = [
      /old-.*\.(ts|js)$/,
      /legacy-.*\.(ts|js)$/,
      /backup-.*\.(ts|js)$/,
      /temp-.*\.(ts|js)$/,
      /\.bak$/,
      /\.backup$/
    ];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isFile()) {
          const isLegacy = legacyPatterns.some(pattern => pattern.test(entry.name));
          if (isLegacy) {
            this.result.legacyFiles.files.push(fullPath);
            this.result.legacyFiles.total++;
            console.log(`  ⚠️ ملف قديم: ${fullPath}`);
          }
        } else if (entry.isDirectory() && !entry.name.includes('node_modules')) {
          await this.findLegacyFiles(fullPath);
        }
      }
    } catch (error) {
      // تجاهل الأخطاء في المجلدات غير القابلة للقراءة
    }
  }

  private async findDuplicateFiles(): Promise<void> {
    const fileMap: Map<string, string[]> = new Map();
    
    await this.buildFileMap(this.projectRoot, fileMap);
    
    for (const [fileName, locations] of fileMap.entries()) {
      if (locations.length > 1) {
        // تصفية الملفات المكررة الحقيقية
        const realDuplicates = locations.filter(loc => 
          !loc.includes('node_modules') && 
          !loc.includes('dist') && 
          !loc.includes('.git')
        );
        
        if (realDuplicates.length > 1) {
          this.result.duplicateFiles.duplicates.push({
            name: fileName,
            locations: realDuplicates
          });
          this.result.duplicateFiles.total++;
          console.log(`  ⚠️ ملف مكرر: ${fileName} في ${realDuplicates.length} أماكن`);
        }
      }
    }
  }

  private async buildFileMap(dir: string, fileMap: Map<string, string[]>): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isFile()) {
          const fileName = entry.name;
          if (!fileMap.has(fileName)) {
            fileMap.set(fileName, []);
          }
          fileMap.get(fileName)!.push(fullPath);
        } else if (entry.isDirectory()) {
          await this.buildFileMap(fullPath, fileMap);
        }
      }
    } catch (error) {
      // تجاهل الأخطاء
    }
  }

  private async checkFileUsage(filePath: string): Promise<boolean> {
    // فحص أساسي - يمكن تطويره
    const fileName = path.basename(filePath, path.extname(filePath));
    
    try {
      const { stdout } = await execAsync(`grep -r "${fileName}" . --exclude-dir=node_modules --exclude-dir=dist`, {
        timeout: 10000
      });
      return stdout.split('\n').length > 2; // أكثر من مرجعين
    } catch {
      return false;
    }
  }

  // إنشاء تقرير HTML
  async generateHtmlReport(): Promise<void> {
    const timestamp = new Date().toLocaleString('ar-SA');
    
    const htmlContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>تقرير الفحص الشامل للمشروع</title>
    <style>
        body { font-family: 'Arial', sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .stat-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; border-radius: 8px; text-align: center; }
        .stat-number { font-size: 2em; font-weight: bold; display: block; }
        .status-good { color: #27ae60; font-weight: bold; }
        .status-warning { color: #f39c12; font-weight: bold; }
        .status-error { color: #e74c3c; font-weight: bold; }
        .recommendation { background: #e8f6f3; border-right: 4px solid #27ae60; padding: 15px; margin: 15px 0; border-radius: 4px; }
        ul { list-style-type: none; padding-right: 0; }
        li { padding: 5px 0; }
        .check-pass::before { content: "✅ "; }
        .check-fail::before { content: "❌ "; }
        .check-warning::before { content: "⚠️ "; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 تقرير الفحص الشامل للمشروع</h1>
        <p><strong>تاريخ التقرير:</strong> ${timestamp}</p>
        
        <div class="stats">
            <div class="stat-card">
                <span class="stat-number">${this.result.unifiedServices.total}</span>
                إجمالي الخدمات
            </div>
            <div class="stat-card">
                <span class="stat-number">${this.result.unifiedServices.usingBaseService.length}</span>
                خدمات موحدة
            </div>
            <div class="stat-card">
                <span class="stat-number">${this.result.legacyFiles.total}</span>
                ملفات قديمة
            </div>
            <div class="stat-card">
                <span class="stat-number">${this.result.duplicateFiles.total}</span>
                ملفات مكررة
            </div>
        </div>

        <h2>📊 حالة توحيد الخدمات</h2>
        <ul>
            <li class="check-pass">خدمات تستخدم BaseService: ${this.result.unifiedServices.usingBaseService.length}</li>
            <li class="check-${this.result.unifiedServices.notUsingBaseService.length > 0 ? 'warning' : 'pass'}">خدمات تحتاج تحديث: ${this.result.unifiedServices.notUsingBaseService.length}</li>
            <li class="check-pass">خدمات تستخدم ServiceContainer: ${this.result.unifiedServices.usingServiceContainer.length}</li>
        </ul>

        <h2>🏥 حالة النظام</h2>
        <ul>
            <li class="check-${this.result.systemHealth.buildStatus === 'pass' ? 'pass' : 'fail'}">حالة البناء: ${this.result.systemHealth.buildStatus === 'pass' ? 'ناجح' : 'فاشل'}</li>
            <li class="check-${this.result.systemHealth.serverStatus === 'running' ? 'pass' : (this.result.systemHealth.serverStatus === 'error' ? 'warning' : 'fail')}">حالة الخادم: ${this.result.systemHealth.serverStatus === 'running' ? 'يعمل' : (this.result.systemHealth.serverStatus === 'error' ? 'مشاكل' : 'متوقف')}</li>
        </ul>

        ${this.result.recommendations.length > 0 ? `
        <div class="recommendation">
            <h3>📝 التوصيات:</h3>
            <ul>
                ${this.result.recommendations.map(rec => `<li>• ${rec}</li>`).join('')}
            </ul>
        </div>
        ` : ''}
    </div>
</body>
</html>`;

    await fs.writeFile('comprehensive-audit-report.html', htmlContent);
    console.log('✅ تم إنشاء التقرير: comprehensive-audit-report.html');
  }
}

// تشغيل الفحص
async function main() {
  const auditor = new ComprehensiveProjectAuditor();
  
  try {
    const result = await auditor.runComprehensiveAudit();
    
    // طباعة ملخص النتائج
    console.log('\n📊 ملخص النتائج:');
    console.log(`   • إجمالي الخدمات: ${result.unifiedServices.total}`);
    console.log(`   • خدمات موحدة: ${result.unifiedServices.usingBaseService.length}`);
    console.log(`   • ملفات قديمة: ${result.legacyFiles.total}`);
    console.log(`   • ملفات مكررة: ${result.duplicateFiles.total}`);
    console.log(`   • توصيات: ${result.recommendations.length}`);
    
    // إنشاء التقرير HTML
    await auditor.generateHtmlReport();
    
    // حفظ النتائج كـ JSON
    await fs.writeFile('comprehensive-audit-results.json', JSON.stringify(result, null, 2));
    console.log('✅ تم حفظ النتائج: comprehensive-audit-results.json');
    
  } catch (error) {
    console.error('❌ فشل الفحص:', error);
    process.exit(1);
  }
}

// تشغيل التطبيق إذا تم استدعاؤه مباشرة
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { ComprehensiveProjectAuditor };
