// تحميل متغيرات البيئة أولاً
import dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { storage } from '../storage';
import { AuditHelpers } from '../utils/auditHelpers';
import { BaseService, ServiceContext, ServiceResult } from '../core/BaseService';
import { IStorage } from '../storage';

dotenv.config({ path: path.join(process.cwd(), '.env') });
dotenv.config({ path: path.join(process.cwd(), 'server', '.env') });

const execAsync = promisify(exec);

export interface AuditIssue {
  id: string;
  title: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  category: 'Security' | 'Performance' | 'Functionality' | 'UI/UX' | 'Deployment';
  description: string;
  reproductionSteps: string[];
  affectedFiles: string[];
  suggestedFix: string;
  status: 'Open' | 'Fixed' | 'Acceptable' | 'Monitor';
  evidence?: {
    screenshots?: string[];
    logs?: string[];
    outputs?: string[];
  };
}

export interface AuditReport {
  timestamp: string;
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  readyForDeployment: boolean;
  issues: AuditIssue[];
  performance: {
    buildTime: number;
    bundleSize: number;
    apiResponseTimes: Record<string, number>;
  };
  security: {
    vulnerabilities: any[];
    unsafeConfigurations: string[];
  };
  checklist: Record<string, 'PASS' | 'FAIL'>;
}

export class AuditService extends BaseService {
  private issues: AuditIssue[] = [];
  private evidence: Record<string, any> = {};

  constructor(storage: IStorage, context?: ServiceContext) {
    super(storage, context);
  }

  async runCompleteAudit(): Promise<AuditReport> {
    console.log('🔍 بدء الفحص الشامل للتطبيق...');

    try {
      // مسح المشاكل السابقة
      this.issues = [];
      this.evidence = {};

      // A - فحص الإعداد والتشغيل
      await this.auditSetupAndBuild();

      // B - فحص APIs
      await this.auditAPIs();

      // C - فحص الواجهة الأمامية
      await this.auditFrontend();

      // D - فحص الأمان
      await this.auditSecurity();

      // E - فحص الأداء
      await this.auditPerformance();

      // F - فحص UX/UI
      await this.auditUXUI();

      // G - فحص جاهزية النشر
      const checklist = await this.auditDeploymentReadiness();

      return this.generateReport(checklist);
    } catch (error) {
      console.error('خطأ في الفحص الشامل:', error);
      throw error;
    }
  }

  private async auditSetupAndBuild(): Promise<void> {
    console.log('🔧 فحص الإعداد والبناء...');

    try {
      // فحص TypeScript
      const { stderr: tscErrors } = await execAsync('npx tsc --noEmit');
      if (tscErrors) {
        this.addIssue({
          title: 'أخطاء TypeScript',
          severity: 'High',
          category: 'Functionality',
          description: 'يوجد أخطاء في TypeScript قد تؤثر على استقرار التطبيق',
          reproductionSteps: ['تشغيل npx tsc --noEmit'],
          affectedFiles: [],
          suggestedFix: 'إصلاح أخطاء TypeScript المذكورة في المخرجات',
          evidence: { outputs: [tscErrors] }
        });
      }

      // فحص linting
      const { stdout: lintOutput, stderr: lintErrors } = await execAsync('npm run lint');
      if (lintErrors || lintOutput.includes('error')) {
        this.addIssue({
          title: 'مشاكل في Linting',
          severity: 'Medium',
          category: 'Functionality',
          description: 'يوجد مشاكل في جودة الكود',
          reproductionSteps: ['تشغيل npm run lint'],
          affectedFiles: [],
          suggestedFix: 'تشغيل npm run lint -- --fix لإصلاح المشاكل التلقائية',
          evidence: { outputs: [lintOutput, lintErrors] }
        });
      }

      // فحص البناء
      const buildStart = Date.now();
      await execAsync('npm run build');
      const buildTime = Date.now() - buildStart;

      if (buildTime > 120000) { // أكثر من دقيقتين
        this.addIssue({
          title: 'وقت بناء طويل',
          severity: 'Low',
          category: 'Performance',
          description: `وقت البناء ${buildTime}ms يُعتبر طويلاً`,
          reproductionSteps: ['تشغيل npm run build'],
          affectedFiles: ['vite.config.ts'],
          suggestedFix: 'تحسين إعدادات Vite أو تقليل حجم التبعيات'
        });
      }

    } catch (error) {
      this.addIssue({
        title: 'فشل في عملية البناء',
        severity: 'Critical',
        category: 'Functionality',
        description: 'فشل التطبيق في البناء بنجاح',
        reproductionSteps: ['تشغيل npm run build'],
        affectedFiles: [],
        suggestedFix: 'مراجعة أخطاء البناء وإصلاحها',
        evidence: { outputs: [error instanceof Error ? error.message : String(error)] }
      });
    }
  }

  private async auditAPIs(): Promise<void> {
    console.log('🌐 فحص APIs...');

    const endpoints = [
      { path: '/api/health', method: 'GET', requiresAuth: false },
      { path: '/api/user', method: 'GET', requiresAuth: true },
      { path: '/api/dashboard/stats', method: 'GET', requiresAuth: true },
      { path: '/api/applications', method: 'GET', requiresAuth: true },
      { path: '/api/files', method: 'GET', requiresAuth: true },
      { path: '/api/system/info', method: 'GET', requiresAuth: true },
      { path: '/api/notifications', method: 'GET', requiresAuth: true }
    ];

    for (const endpoint of endpoints) {
      try {
        const start = Date.now();
        const { stdout, stderr } = await execAsync(
          `curl -s -w "%{http_code}\\n%{time_total}\\n" -o /dev/null http://localhost:6000${endpoint.path}`
        );
        const responseTime = Date.now() - start;

        const lines = stdout.trim().split('\n');
        const statusCode = parseInt(lines[0]);
        const curlTime = parseFloat(lines[1]) * 1000;

        // فحص status code
        if (endpoint.requiresAuth && statusCode === 401) {
          // متوقع للendpoints التي تتطلب مصادقة
        } else if (!endpoint.requiresAuth && statusCode !== 200) {
          this.addIssue({
            title: `مشكلة في API: ${endpoint.path}`,
            severity: 'High',
            category: 'Functionality',
            description: `الـ API يرجع status code غير متوقع: ${statusCode}`,
            reproductionSteps: [`curl -i http://localhost:6000${endpoint.path}`],
            affectedFiles: ['server/routes.ts'],
            suggestedFix: 'مراجعة منطق الـ API وإصلاح المشكلة'
          });
        }

        // فحص الأداء
        if (curlTime > 5000) {
          this.addIssue({
            title: `بطء في الاستجابة: ${endpoint.path}`,
            severity: 'Medium',
            category: 'Performance',
            description: `وقت الاستجابة ${curlTime}ms يُعتبر بطيئاً`,
            reproductionSteps: [`curl -w "%{time_total}" http://localhost:6000${endpoint.path}`],
            affectedFiles: ['server/routes.ts'],
            suggestedFix: 'تحسين الاستعلامات أو إضافة caching'
          });
        }

      } catch (error) {
        this.addIssue({
          title: `خطأ في الوصول لـ API: ${endpoint.path}`,
          severity: 'Critical',
          category: 'Functionality',
          description: 'فشل في الوصول للـ API',
          reproductionSteps: [`curl -i http://localhost:6000${endpoint.path}`],
          affectedFiles: ['server/routes.ts'],
          suggestedFix: 'التأكد من أن الخادم يعمل ومراجعة الأخطاء'
        });
      }
    }
  }

  private async auditSecurity(): Promise<void> {
    console.log('🔒 فحص الأمان...');

    try {
      const securityScan = await AuditHelpers.scanForSecurityIssues();

      // فحص الثغرات الأمنية
      const criticalVulns = securityScan.vulnerabilities.filter((v: any) => v.severity === 'critical').length;
      const highVulns = securityScan.vulnerabilities.filter((v: any) => v.severity === 'high').length;

      if (criticalVulns > 0) {
        this.addIssue({
          title: 'ثغرات أمنية حرجة في التبعيات',
          severity: 'Critical',
          category: 'Security',
          description: `${criticalVulns} ثغرة أمنية حرجة في التبعيات`,
          reproductionSteps: ['npm audit'],
          affectedFiles: ['package.json'],
          suggestedFix: 'تشغيل npm audit fix أو تحديث التبعيات يدوياً'
        });
      }

      if (highVulns > 0) {
        this.addIssue({
          title: 'ثغرات أمنية عالية في التبعيات',
          severity: 'High',
          category: 'Security',
          description: `${highVulns} ثغرة أمنية عالية في التبعيات`,
          reproductionSteps: ['npm audit'],
          affectedFiles: ['package.json'],
          suggestedFix: 'تشغيل npm audit fix أو تحديث التبعيات يدوياً'
        });
      }

      // فحص الإعدادات غير الآمنة
      securityScan.unsafeConfigurations.forEach(config => {
        this.addIssue({
          title: 'إعدادات أمنية غير آمنة',
          severity: 'High',
          category: 'Security',
          description: config,
          reproductionSteps: ['فحص ملفات الإعدادات'],
          affectedFiles: [],
          suggestedFix: 'إزالة أو تأمين الإعدادات غير الآمنة'
        });
      });

      // فحص security headers المفقودة
      securityScan.missingSecurityHeaders.forEach(header => {
        this.addIssue({
          title: `Security header مفقود: ${header}`,
          severity: 'Medium',
          category: 'Security',
          description: `Security header مهم مفقود في إعدادات الخادم`,
          reproductionSteps: ['فحص security headers'],
          affectedFiles: ['server/index.ts', 'server/routes.ts'],
          suggestedFix: `إضافة ${header} header في إعدادات الخادم`
        });
      });

    } catch (error) {
      this.addIssue({
        title: 'فشل في فحص الأمان',
        severity: 'Medium',
        category: 'Security',
        description: 'تعذر إكمال فحص الأمان بالكامل',
        reproductionSteps: ['npm audit'],
        affectedFiles: [],
        suggestedFix: 'مراجعة إعدادات الأمان يدوياً'
      });
    }
  }

  private async auditPerformance(): Promise<void> {
    console.log('⚡ فحص الأداء...');

    try {
      // قياس أوقات الاستجابة للـ APIs الرئيسية
      const apiEndpoints = ['/api/health', '/api/dashboard/stats', '/api/applications'];
      const responseTimes: Record<string, number> = {};

      for (const endpoint of apiEndpoints) {
        try {
          const { stdout } = await execAsync(
            `curl -w "%{time_total}" -s -o /dev/null http://localhost:6000${endpoint}`
          );
          responseTimes[endpoint] = parseFloat(stdout) * 1000;
        } catch (error) {
          responseTimes[endpoint] = -1; // خطأ في الوصول
        }
      }

      // فحص حجم bundle
      try {
        const distStats = await fs.stat('dist');
        if (distStats.isDirectory()) {
          const { stdout } = await execAsync('du -sh dist');
          const bundleSize = stdout.split('\t')[0];

          this.evidence.bundleSize = bundleSize;

          // تحذير إذا كان الحجم كبيراً
          if (bundleSize.includes('M') && parseFloat(bundleSize) > 50) {
            this.addIssue({
              title: 'حجم bundle كبير',
              severity: 'Medium',
              category: 'Performance',
              description: `حجم البناء ${bundleSize} قد يؤثر على سرعة التحميل`,
              reproductionSteps: ['npm run build', 'du -sh dist'],
              affectedFiles: ['vite.config.ts'],
              suggestedFix: 'تحسين التبعيات أو تفعيل tree shaking'
            });
          }
        }
      } catch (error) {
        // مجلد dist غير موجود
      }

    } catch (error) {
      this.addIssue({
        title: 'فشل في فحص الأداء',
        severity: 'Low',
        category: 'Performance',
        description: 'تعذر إكمال فحص الأداء',
        reproductionSteps: [],
        affectedFiles: [],
        suggestedFix: 'مراجعة الأداء يدوياً'
      });
    }
  }

  private async auditFrontend(): Promise<void> {
    console.log('🎨 فحص الواجهة الأمامية...');

    // فحص الصفحات الرئيسية
    const pages = [
      'Dashboard.tsx',
      'Applications.tsx',
      'FileManager.tsx',
      'HealthCheck.tsx',
      'Terminal.tsx'
    ];

    for (const page of pages) {
      try {
        const pagePath = path.join('client/src/pages', page);
        const pageContent = await fs.readFile(pagePath, 'utf8');

        // فحص أساسي للمشاكل الشائعة
        if (!pageContent.includes('aria-label') && !pageContent.includes('aria-labelledby')) {
          this.addIssue({
            title: `نقص في الوصولية: ${page}`,
            severity: 'Low',
            category: 'UI/UX',
            description: 'الصفحة قد تفتقر لتسميات الوصولية',
            reproductionSteps: [`فحص ${page}`],
            affectedFiles: [pagePath],
            suggestedFix: 'إضافة aria-label أو aria-labelledby للعناصر التفاعلية'
          });
        }

        // فحص الترجمة والنصوص العربية
        if (pageContent.includes('className') && !pageContent.includes('rtl') && pageContent.includes('العربية')) {
          this.addIssue({
            title: `قد تحتاج دعم RTL: ${page}`,
            severity: 'Low',
            category: 'UI/UX',
            description: 'الصفحة تحتوي نصوص عربية لكن قد تحتاج تحسين RTL',
            reproductionSteps: [`فحص ${page} في المتصفح`],
            affectedFiles: [pagePath],
            suggestedFix: 'التأكد من CSS يدعم RTL بشكل صحيح'
          });
        }

      } catch (error) {
        // الصفحة غير موجودة
      }
    }
  }

  private async auditUXUI(): Promise<void> {
    console.log('👤 فحص تجربة المستخدم...');

    // فحص ملف CSS الرئيسي
    try {
      const cssContent = await fs.readFile('client/src/index.css', 'utf8');

      // فحص وجود CSS للـ responsive design
      if (!cssContent.includes('@media')) {
        this.addIssue({
          title: 'نقص في التصميم المتجاوب',
          severity: 'Medium',
          category: 'UI/UX',
          description: 'لا يوجد media queries للتصميم المتجاوب',
          reproductionSteps: ['فحص client/src/index.css'],
          affectedFiles: ['client/src/index.css'],
          suggestedFix: 'إضافة media queries للشاشات المختلفة'
        });
      }

      // فحص دعم RTL
      if (!cssContent.includes('rtl') && !cssContent.includes('[dir="rtl"]')) {
        this.addIssue({
          title: 'نقص في دعم RTL',
          severity: 'Medium',
          category: 'UI/UX',
          description: 'لا يوجد دعم واضح للغة العربية (RTL)',
          reproductionSteps: ['فحص client/src/index.css'],
          affectedFiles: ['client/src/index.css'],
          suggestedFix: 'إضافة CSS rules لدعم RTL'
        });
      }

    } catch (error) {
      // ملف CSS غير موجود
    }
  }

  private async auditDeploymentReadiness(): Promise<Record<string, 'PASS' | 'FAIL'>> {
    console.log('🚀 فحص جاهزية النشر...');

    const checklist: Record<string, 'PASS' | 'FAIL'> = {};

    try {
      // فحص البناء
      await execAsync('npm run build');
      checklist['Build Success'] = 'PASS';
    } catch (error) {
      checklist['Build Success'] = 'FAIL';
    }

    try {
      // فحص TypeScript
      await execAsync('npx tsc --noEmit');
      checklist['TypeScript Check'] = 'PASS';
    } catch (error) {
      checklist['TypeScript Check'] = 'FAIL';
    }

    try {
      // فحص اتصال قاعدة البيانات
      await storage.testConnection();
      checklist['Database Connection'] = 'PASS';
    } catch (error) {
      checklist['Database Connection'] = 'FAIL';
    }

    try {
      // فحص الـ health endpoint
      await execAsync('curl -f http://localhost:6000/api/health');
      checklist['Health Endpoint'] = 'PASS';
    } catch (error) {
      checklist['Health Endpoint'] = 'FAIL';
    }

    // فحص متغيرات البيئة
    const requiredEnvVars = ['DATABASE_URL'];
    let envVarsValid = true;

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        envVarsValid = false;
        break;
      }
    }

    checklist['Environment Variables'] = envVarsValid ? 'PASS' : 'FAIL';

    // فحص الثغرات الحرجة
    try {
      const { stdout } = await execAsync('npm audit --json');
      const auditData = JSON.parse(stdout);
      const criticalVulns = Object.values(auditData.vulnerabilities || {}).filter((v: any) => v.severity === 'critical').length;
      checklist['Security Vulnerabilities'] = criticalVulns === 0 ? 'PASS' : 'FAIL';
    } catch (error) {
      checklist['Security Vulnerabilities'] = 'FAIL';
    }

    return checklist;
  }

  private addIssue(issue: Omit<AuditIssue, 'id' | 'status'>): void {
    const fullIssue: AuditIssue = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: 'Open',
      ...issue
    };

    this.issues.push(fullIssue);
  }

  private generateReport(checklist: Record<string, 'PASS' | 'FAIL'>): AuditReport {
    const summary = {
      critical: this.issues.filter(i => i.severity === 'Critical').length,
      high: this.issues.filter(i => i.severity === 'High').length,
      medium: this.issues.filter(i => i.severity === 'Medium').length,
      low: this.issues.filter(i => i.severity === 'Low').length,
      total: this.issues.length
    };

    const readyForDeployment = summary.critical === 0 &&
                              Object.values(checklist).filter(v => v === 'FAIL').length === 0;

    return {
      timestamp: new Date().toISOString(),
      summary,
      readyForDeployment,
      issues: this.issues,
      performance: {
        buildTime: 0, // سيتم تحديثه
        bundleSize: 0, // سيتم تحديثه
        apiResponseTimes: {}
      },
      security: {
        vulnerabilities: [],
        unsafeConfigurations: []
      },
      checklist
    };
  }
}

// Remove singleton export - will be managed by ServiceContainer
// export const auditService = new AuditService();