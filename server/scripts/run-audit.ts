
import { auditService } from '../services/auditService';
import { AuditHelpers } from '../utils/auditHelpers';
import { promises as fs } from 'fs';
import * as path from 'path';

async function runAudit() {
  console.log('🔍 بدء الفحص الشامل للتطبيق...\n');

  try {
    // تشغيل الفحص الشامل
    const auditReport = await auditService.runCompleteAudit();

    // إنشاء مجلد النتائج
    const outputDir = path.join(process.cwd(), 'audit-results');
    await fs.mkdir(outputDir, { recursive: true });

    // إنشاء التقارير
    const timestamp = new Date().toISOString().split('T')[0];
    
    // تقرير JSON
    const jsonReport = JSON.stringify(auditReport, null, 2);
    await fs.writeFile(path.join(outputDir, `audit-report-${timestamp}.json`), jsonReport);

    // تقرير Markdown
    const markdownReport = await AuditHelpers.generateMarkdownReport(auditReport);
    await fs.writeFile(path.join(outputDir, `audit-report-${timestamp}.md`), markdownReport);

    // تقرير CSV (ملخص المشاكل)
    let csvContent = 'ID,Title,Severity,Category,Description,Affected Files,Status\n';
    auditReport.issues.forEach(issue => {
      csvContent += `"${issue.id}","${issue.title}","${issue.severity}","${issue.category}","${issue.description}","${issue.affectedFiles.join(';')}","${issue.status}"\n`;
    });
    await fs.writeFile(path.join(outputDir, `audit-issues-${timestamp}.csv`), csvContent);

    // طباعة الملخص
    console.log('📊 ملخص الفحص:');
    console.log(`   • مشاكل حرجة: ${auditReport.summary.critical}`);
    console.log(`   • مشاكل مهمة: ${auditReport.summary.high}`);
    console.log(`   • مشاكل متوسطة: ${auditReport.summary.medium}`);
    console.log(`   • مشاكل منخفضة: ${auditReport.summary.low}`);
    console.log(`   • المجموع: ${auditReport.summary.total}\n`);

    console.log(`🚀 حالة النشر: ${auditReport.readyForDeployment ? '✅ جاهز' : '❌ غير جاهز'}\n`);

    console.log('📂 تم حفظ التقارير في:');
    console.log(`   • ${path.join(outputDir, `audit-report-${timestamp}.json`)}`);
    console.log(`   • ${path.join(outputDir, `audit-report-${timestamp}.md`)}`);
    console.log(`   • ${path.join(outputDir, `audit-issues-${timestamp}.csv`)}\n`);

    // طباعة قائمة فحص النشر
    console.log('📋 قائمة فحص النشر:');
    Object.entries(auditReport.checklist).forEach(([item, status]) => {
      const icon = status === 'PASS' ? '✅' : '❌';
      console.log(`   ${icon} ${item}`);
    });

    // التوصيات العاجلة
    const criticalIssues = auditReport.issues.filter(i => i.severity === 'Critical');
    if (criticalIssues.length > 0) {
      console.log('\n🚨 مشاكل حرجة تحتاج إصلاح فوري:');
      criticalIssues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue.title}`);
        console.log(`      الحل: ${issue.suggestedFix}`);
      });
    }

    // إنهاء العملية بالحالة المناسبة
    const exitCode = auditReport.summary.critical > 0 ? 1 : 0;
    process.exit(exitCode);

  } catch (error) {
    console.error('❌ خطأ في تشغيل الفحص الشامل:', error);
    process.exit(1);
  }
}

// تشغيل الفحص إذا تم استدعاء الملف مباشرة
if (require.main === module) {
  runAudit();
}

export { runAudit };
