# دليل GitHub Actions لنظام مراقبة المخطط

## نظرة عامة 🔄

يتكامل نظام مراقبة المخطط مع GitHub Actions لتوفير فحص تلقائي عند كل Pull Request والتحديثات على الفرع الرئيسي. هذا يضمن اكتشاف أي انحرافات في المخطط قبل دمج الكود.

## ملف التكوين 📋

### `.github/workflows/schema-check.yml`

```yaml
name: Schema Drift Detection
on:
  pull_request:
    branches: [ main, master ]
  push:
    branches: [ main, master ]

jobs:
  schema-check:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout Repository
      uses: actions/checkout@v4
      
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
        
    - name: Install Dependencies
      run: npm install
      
    - name: Generate Expected Schema
      run: ./scripts/run-commands.sh gen:expected
      
    - name: Compare Schemas
      env:
        DATABASE_URL: ${{ secrets.DATABASE_URL }}
      run: ./scripts/run-commands.sh schema:ci
      
    - name: Upload Schema Reports
      uses: actions/upload-artifact@v4
      if: always()
      with:
        name: schema-reports
        path: |
          scripts/expected_schema.json
          scripts/schema_comparison_report.json
          
    - name: Comment PR with Results
      if: github.event_name == 'pull_request'
      uses: actions/github-script@v7
      with:
        script: |
          const fs = require('fs');
          try {
            const report = JSON.parse(fs.readFileSync('scripts/schema_comparison_report.json', 'utf8'));
            
            let status = '✅ **مطابق تماماً**';
            let color = '28a745';
            
            if (report.status === 'drift_detected') {
              status = '⚠️ **انحراف مكتشف**';
              color = 'ffa500';
            }
            
            const comment = \`
## 🗄️ تقرير فحص مخطط قاعدة البيانات
            
**الحالة**: \${status}
**تاريخ الفحص**: \${new Date(report.compared_at).toLocaleString('ar-SA')}

### 📊 الملخص:
- **الجداول المتطابقة**: \${report.summary?.matched_tables || 'غير متاح'}
- **الجداول المفقودة**: \${report.missing_tables?.length || 0}
- **الجداول الإضافية**: \${report.extra_tables?.length || 0}
- **إجمالي المشاكل**: \${report.summary?.total_issues || 0}

\${report.missing_tables?.length > 0 ? \`
### ❌ جداول مفقودة:
\${report.missing_tables.map(table => \`- \${table}\`).join('\\n')}
\` : ''}

\${report.extra_tables?.length > 0 ? \`
### ➕ جداول إضافية:
\${report.extra_tables.map(table => \`- \${table}\`).join('\\n')}
\` : ''}

\${report.mismatches?.length > 0 ? \`
### 🔧 مشاكل الأعمدة (أول 5):
\${report.mismatches.slice(0, 5).map(issue => 
  \`- **\${issue.table}.\${issue.column}**: \${issue.description}\`
).join('\\n')}
\${report.mismatches.length > 5 ? \`\\n*... و \${report.mismatches.length - 5} مشكلة إضافية*\` : ''}
\` : ''}

### 📋 التفاصيل الكاملة:
تحقق من ملف \`schema_comparison_report.json\` في Artifacts للحصول على التقرير الكامل.

---
*تم إنشاء هذا التقرير تلقائياً بواسطة GitHub Actions*
            \`;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
          } catch (error) {
            console.error('خطأ في قراءة التقرير:', error);
          }
```

## متطلبات الإعداد ⚙️

### 1. إضافة Secrets

في إعدادات المستودع، أضف السر التالي:

**`DATABASE_URL`**
```
postgresql://username:password@host:port/database
```

### 2. أذونات GitHub Token

تأكد من أن `GITHUB_TOKEN` له الأذونات التالية:
- `contents: read` - لقراءة الكود
- `pull-requests: write` - لإضافة التعليقات
- `actions: write` - لرفع Artifacts

## كيفية العمل 🔧

### عند Pull Request:

1. **Checkout**: تحميل الكود المُقترح
2. **Setup**: تثبيت Node.js والاعتماديات
3. **Generate**: إنشاء المخطط المتوقع من الكود الجديد
4. **Compare**: مقارنة مع قاعدة البيانات الفعلية
5. **Report**: إنشاء تقرير JSON مفصل
6. **Upload**: رفع التقارير كـ Artifacts
7. **Comment**: إضافة تعليق في PR بالنتائج

### عند Push للفرع الرئيسي:

1. **Monitor**: مراقبة التغييرات المدموجة
2. **Validate**: التحقق من عدم وجود انحرافات جديدة
3. **Archive**: حفظ التقارير للمراجعة المستقبلية

## أنواع النتائج 📊

### ✅ مطابقة تامة
```
✅ **مطابق تماماً**
- الجداول المتطابقة: 37
- الجداول المفقودة: 0  
- الجداول الإضافية: 0
- إجمالي المشاكل: 0
```

### ⚠️ انحراف مكتشف
```
⚠️ **انحراف مكتشف**
- الجداول المتطابقة: 35
- الجداول المفقودة: 1
- الجداول الإضافية: 2  
- إجمالي المشاكل: 15

❌ جداول مفقودة:
- user_profiles

➕ جداول إضافية:  
- temp_logs
- old_backups

🔧 مشاكل الأعمدة:
- users.firstName: العمود firstName مفقود في جدول users
- orders.status: نوع البيانات مختلف - متوقع: text، فعلي: varchar
```

### ❌ خطأ في التنفيذ
```
❌ **فشل الفحص**
خطأ في الاتصال بقاعدة البيانات أو تحليل المخطط.
تحقق من الـ logs في GitHub Actions.
```

## تفسير Artifacts 📁

### `expected_schema.json`
- **الحجم**: ~112KB
- **المحتوى**: المخطط المتوقع من الكود
- **الاستخدام**: مراجعة تعريفات الجداول والأعمدة

### `schema_comparison_report.json`  
- **الحجم**: ~175KB
- **المحتوى**: تقرير مقارنة مفصل
- **الاستخدام**: تحليل الاختلافات وتخطيط الإصلاحات

## استكشاف الأخطاء 🔧

### فشل في الاتصال بقاعدة البيانات
```yaml
❌ Error: Error connecting to database
```
**الحلول**:
- تحقق من صحة `DATABASE_URL`
- تأكد من إمكانية الوصول للشبكة
- تحقق من أذونات المستخدم

### فشل في تحليل المخطط
```yaml
❌ Error: Cannot read property 'tables' of undefined
```
**الحلول**:
- تحقق من صحة ملف `shared/schema.ts`
- تأكد من تثبيت جميع الاعتماديات
- راجع syntax الـ TypeScript

### فشل في رفع Artifacts
```yaml
❌ Error uploading artifacts
```
**الحلول**:
- تحقق من أذونات GitHub Token
- تأكد من وجود الملفات المُراد رفعها
- راجع حدود المساحة في GitHub

## التخصيص والتطوير 🛠️

### إضافة فحوصات مخصصة

```yaml
- name: Custom Schema Validation
  run: |
    # فحص مخصص لجداول حساسة
    npx tsx scripts/validate-critical-tables.ts
    
    # فحص أداء الاستعلامات  
    npx tsx scripts/performance-check.ts
```

### تعديل تقرير PR

```javascript
// تخصيص شكل التعليق
const customComment = `
🏗️ **تقرير البناء والمخطط**

${status}

📈 **إحصائيات**:
- معدل التطابق: ${matchPercentage}%
- الجداول الحرجة: ${criticalTables}
- مستوى الخطورة: ${severity}
`;
```

### إضافة إشعارات

```yaml
- name: Notify Team  
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: failure
    channel: '#dev-alerts'
    message: 'Schema drift detected! 🚨'
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

## أفضل الممارسات 🌟

### 1. **فحص منتظم**
- تشغيل يومي في بيئة التطوير
- فحص عند كل PR مهم
- مراقبة دورية في الإنتاج

### 2. **معالجة سريعة**
- إصلاح الانحرافات فور اكتشافها
- عدم دمج PR مع انحرافات حرجة
- توثيق الأسباب والحلول

### 3. **التنسيق مع الفريق**
- إشعار الفريق بالانحرافات
- مراجعة جماعية للتقارير
- توحيد استراتيجية المعالجة

### 4. **الأرشفة والمراجعة**
- حفظ التقارير التاريخية
- تحليل الاتجاهات والأنماط
- تحسين المخططات بناءً على البيانات

## الخلاصة 📝

GitHub Actions يوفر:
- **مراقبة تلقائية** لجميع التغييرات
- **تقارير فورية** في Pull Requests
- **أرشفة شاملة** للتقارير والنتائج
- **تكامل سلس** مع سير العمل الحالي

هذا النظام يضمن جودة وتماسك قاعدة البيانات في جميع مراحل التطوير والإنتاج.

---
*للتوثيق الشامل، راجع: `docs/SCHEMA_MONITORING_SYSTEM.md`*