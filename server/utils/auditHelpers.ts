
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

export interface SecurityScanResult {
  vulnerabilities: any[];
  unsafeConfigurations: string[];
  missingSecurityHeaders: string[];
}

export interface PerformanceScanResult {
  bundleSize: number;
  buildTime: number;
  apiResponseTimes: Record<string, number>;
  recommendations: string[];
}

export interface AccessibilityScanResult {
  issues: Array<{
    file: string;
    line: number;
    issue: string;
    severity: 'low' | 'medium' | 'high';
    fix: string;
  }>;
  score: number;
}

export class AuditHelpers {
  
  static async scanForSecurityIssues(): Promise<SecurityScanResult> {
    const result: SecurityScanResult = {
      vulnerabilities: [],
      unsafeConfigurations: [],
      missingSecurityHeaders: []
    };

    try {
      // فحص npm audit
      const { stdout: auditOutput } = await execAsync('npm audit --json');
      const auditData = JSON.parse(auditOutput);
      result.vulnerabilities = Object.values(auditData.vulnerabilities || {});

      // فحص الإعدادات غير الآمنة
      const unsafePatterns = [
        'NODE_TLS_REJECT_UNAUTHORIZED.*0',
        'ssl.*false',
        'verify.*false',
        'password.*=.*[\'"][^\'"]*[\'"]',
        'secret.*=.*[\'"][^\'"]*[\'"]'
      ];

      for (const pattern of unsafePatterns) {
        try {
          const { stdout } = await execAsync(`grep -r "${pattern}" . --exclude-dir=node_modules --include="*.ts" --include="*.js"`);
          if (stdout.trim()) {
            result.unsafeConfigurations.push(`Found unsafe pattern: ${pattern}`);
          }
        } catch (error) {
          // لا يوجد نتائج - هذا جيد
        }
      }

      // فحص security headers
      const securityHeaders = [
        'Content-Security-Policy',
        'X-Frame-Options',
        'X-Content-Type-Options',
        'Referrer-Policy'
      ];

      // البحث في ملفات الخادم عن security headers
      try {
        const serverFiles = ['server/index.ts', 'server/routes.ts'];
        for (const file of serverFiles) {
          try {
            const content = await fs.readFile(file, 'utf8');
            for (const header of securityHeaders) {
              if (!content.includes(header)) {
                result.missingSecurityHeaders.push(header);
              }
            }
          } catch (error) {
            // الملف غير موجود
          }
        }
      } catch (error) {
        // خطأ في الفحص
      }

    } catch (error) {
      console.error('خطأ في فحص الأمان:', error);
    }

    return result;
  }

  static async scanForPerformanceIssues(): Promise<PerformanceScanResult> {
    const result: PerformanceScanResult = {
      bundleSize: 0,
      buildTime: 0,
      apiResponseTimes: {},
      recommendations: []
    };

    try {
      // قياس وقت البناء
      const buildStart = Date.now();
      await execAsync('npm run build');
      result.buildTime = Date.now() - buildStart;

      // قياس حجم البناء
      try {
        const { stdout } = await execAsync('du -sb dist');
        result.bundleSize = parseInt(stdout.split('\t')[0]);
      } catch (error) {
        // مجلد dist غير موجود
      }

      // قياس أوقات الاستجابة للـ APIs
      const apiEndpoints = [
        '/api/health',
        '/api/dashboard/stats',
        '/api/applications',
        '/api/files',
        '/api/system/info'
      ];

      for (const endpoint of apiEndpoints) {
        try {
          const { stdout } = await execAsync(
            `curl -w "%{time_total}" -s -o /dev/null http://localhost:5000${endpoint}`
          );
          result.apiResponseTimes[endpoint] = parseFloat(stdout) * 1000;
        } catch (error) {
          result.apiResponseTimes[endpoint] = -1;
        }
      }

      // توصيات الأداء
      if (result.bundleSize > 5 * 1024 * 1024) { // أكثر من 5MB
        result.recommendations.push('حجم البناء كبير - يُنصح بتحسين التبعيات');
      }

      if (result.buildTime > 60000) { // أكثر من دقيقة
        result.recommendations.push('وقت البناء طويل - يُنصح بتحسين إعدادات البناء');
      }

      Object.entries(result.apiResponseTimes).forEach(([endpoint, time]) => {
        if (time > 2000) {
          result.recommendations.push(`${endpoint} يستجيب ببطء (${time}ms)`);
        }
      });

    } catch (error) {
      console.error('خطأ في فحص الأداء:', error);
    }

    return result;
  }

  static async scanForAccessibilityIssues(): Promise<AccessibilityScanResult> {
    const result: AccessibilityScanResult = {
      issues: [],
      score: 100
    };

    try {
      // فحص ملفات React للمشاكل الشائعة في الوصولية
      const reactFiles = await this.getReactFiles();

      for (const file of reactFiles) {
        try {
          const content = await fs.readFile(file, 'utf8');
          const lines = content.split('\n');

          lines.forEach((line, index) => {
            // فحص عناصر img بدون alt
            if (line.includes('<img') && !line.includes('alt=')) {
              result.issues.push({
                file,
                line: index + 1,
                issue: 'صورة بدون نص بديل (alt)',
                severity: 'medium',
                fix: 'أضف خاصية alt للصورة'
              });
            }

            // فحص أزرار بدون aria-label
            if (line.includes('<button') && !line.includes('aria-label') && !line.includes('children')) {
              result.issues.push({
                file,
                line: index + 1,
                issue: 'زر قد يحتاج تسمية للوصولية',
                severity: 'low',
                fix: 'أضف aria-label أو نص واضح للزر'
              });
            }

            // فحص form inputs بدون labels
            if (line.includes('<input') && !line.includes('aria-label') && !line.includes('placeholder')) {
              result.issues.push({
                file,
                line: index + 1,
                issue: 'حقل إدخال قد يحتاج تسمية',
                severity: 'medium',
                fix: 'أضف aria-label أو label للحقل'
              });
            }
          });

        } catch (error) {
          // خطأ في قراءة الملف
        }
      }

      // حساب النتيجة بناء على عدد المشاكل
      const criticalIssues = result.issues.filter(i => i.severity === 'high').length;
      const mediumIssues = result.issues.filter(i => i.severity === 'medium').length;
      const lowIssues = result.issues.filter(i => i.severity === 'low').length;

      result.score = Math.max(0, 100 - (criticalIssues * 20) - (mediumIssues * 10) - (lowIssues * 5));

    } catch (error) {
      console.error('خطأ في فحص الوصولية:', error);
    }

    return result;
  }

  static async getReactFiles(): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const { stdout } = await execAsync('find client/src -name "*.tsx" -o -name "*.jsx"');
      files.push(...stdout.trim().split('\n').filter(f => f.trim()));
    } catch (error) {
      // خطأ في البحث عن الملفات
    }

    return files;
  }

  static async generateMarkdownReport(auditData: any): Promise<string> {
    const timestamp = new Date().toLocaleString('ar-SA');
    
    let report = `# تقرير الفحص الشامل للتطبيق

**تاريخ الفحص:** ${timestamp}

## ملخص النتائج

| الفئة | العدد |
|-------|------|
| مشاكل حرجة | ${auditData.summary.critical} |
| مشاكل مهمة | ${auditData.summary.high} |
| مشاكل متوسطة | ${auditData.summary.medium} |
| مشاكل منخفضة | ${auditData.summary.low} |
| **المجموع** | **${auditData.summary.total}** |

## حالة جاهزية النشر

${auditData.readyForDeployment ? '✅ **التطبيق جاهز للنشر**' : '❌ **التطبيق غير جاهز للنشر - يحتاج إصلاحات**'}

## قائمة فحص النشر

`;

    Object.entries(auditData.checklist).forEach(([item, status]) => {
      const icon = status === 'PASS' ? '✅' : '❌';
      report += `- ${icon} ${item}\n`;
    });

    report += `\n## المشاكل المكتشفة\n\n`;

    auditData.issues.forEach((issue: any, index: number) => {
      const severityIcons: Record<string, string> = {
        'Critical': '🔴',
        'High': '🟠',
        'Medium': '🟡',
        'Low': '🔵'
      };
      const severityIcon = severityIcons[issue.severity] || '⚪';

      report += `### ${index + 1}. ${issue.title}

**الشدة:** ${severityIcon} ${issue.severity}  
**الفئة:** ${issue.category}

**الوصف:** ${issue.description}

**خطوات إعادة الإنتاج:**
${issue.reproductionSteps.map((step: string, i: number) => `${i + 1}. ${step}`).join('\n')}

${issue.affectedFiles.length > 0 ? `**الملفات المتأثرة:** ${issue.affectedFiles.join(', ')}` : ''}

**الحل المقترح:** ${issue.suggestedFix}

---

`;
    });

    report += `## التوصيات العامة

### الأمان 🔒
- تحديث التبعيات بانتظام
- استخدام HTTPS في الإنتاج
- مراجعة صلاحيات المستخدمين
- تفعيل CSRF protection

### الأداء ⚡
- تحسين أحجام الصور
- استخدام lazy loading
- تفعيل caching للـ APIs
- ضغط الـ bundle

### تجربة المستخدم 👥
- تحسين الوصولية (a11y)
- دعم أفضل للـ RTL
- تحسين التصميم المتجاوب
- رسائل خطأ أوضح

### النشر 🚀
- إعداد النسخ الاحتياطية
- مراقبة النظام
- إعداد alerts
- وثائق النشر

---

## English Executive Summary

**Audit Date:** ${new Date().toISOString()}

**Overall Status:** ${auditData.readyForDeployment ? 'READY FOR DEPLOYMENT' : 'NOT READY - REQUIRES FIXES'}

**Issues Summary:**
- Critical: ${auditData.summary.critical}
- High: ${auditData.summary.high}  
- Medium: ${auditData.summary.medium}
- Low: ${auditData.summary.low}
- **Total: ${auditData.summary.total}**

**Key Recommendations:**
1. Address all critical and high severity issues before deployment
2. Implement security best practices
3. Optimize performance bottlenecks
4. Improve accessibility compliance
5. Set up monitoring and backup systems

---
*تم إنشاء هذا التقرير تلقائياً بواسطة أداة الفحص الشامل*
`;

    return report;
  }
}
