
#!/bin/bash

echo "🧹 بدء عملية تنظيف مشروع app2..."

# الانتقال إلى مجلد app2
cd "$(dirname "$0")" || exit 1

echo "📁 المجلد الحالي: $(pwd)"

# تنظيف الملفات المضغوطة والمؤقتة
echo "🗑️  حذف الملفات المضغوطة والمؤقتة..."
rm -f client.zip
rm -f *.zip
rm -f *.tar.gz
rm -f *.rar

# تنظيف ملفات TypeScript وJavaScript المؤقتة في الجذر
echo "🗑️  حذف ملفات TS/JS المؤقتة في الجذر..."
rm -f *.ts
rm -f *.js
rm -f *.d.ts

# تنظيف الصور المؤقتة والنصوص
echo "🗑️  تنظيف مجلد attached_assets..."
rm -f attached_assets/Screenshot_*.jpg
rm -f attached_assets/Screenshot_*.png
rm -f attached_assets/*.txt
rm -f attached_assets/*.log

# تنظيف ملفات Node.js
echo "🗑️  تنظيف ملفات Node.js المؤقتة..."
rm -rf node_modules/.cache
rm -rf .npm
rm -rf .yarn
rm -f npm-debug.log*
rm -f yarn-debug.log*
rm -f yarn-error.log*
rm -f .pnpm-debug.log*

# تنظيف ملفات التطوير
echo "🗑️  تنظيف ملفات التطوير المؤقتة..."
rm -rf .next
rm -rf .nuxt
rm -rf dist
rm -rf build
rm -rf coverage
rm -rf .nyc_output

# تنظيف ملفات المحررات
echo "🗑️  تنظيف ملفات المحررات المؤقتة..."
rm -rf .vscode/settings.json
rm -f .DS_Store
rm -f Thumbs.db
rm -f *.swp
rm -f *.swo
rm -f *~
rm -f .#*

# تنظيف logs
echo "🗑️  تنظيف ملفات السجلات..."
rm -f *.log
rm -f logs/*.log 2>/dev/null || true

# تنظيف ملفات النسخ الاحتياطية
echo "🗑️  تنظيف ملفات النسخ الاحتياطية..."
rm -f *.bak
rm -f *.backup
rm -f *.old
rm -f *~

# تنظيف متقدم - حذف المجلدات الفارغة
echo "🗑️  حذف المجلدات الفارغة..."
find . -type d -empty -delete 2>/dev/null || true

# إحصائيات بعد التنظيف
echo ""
echo "📊 إحصائيات المشروع بعد التنظيف:"
echo "عدد الملفات: $(find . -type f | wc -l)"
echo "عدد المجلدات: $(find . -type d | wc -l)"
echo "حجم المشروع: $(du -sh . | cut -f1)"

echo ""
echo "✅ تم انتهاء عملية التنظيف بنجاح!"
echo "🎯 المشروع جاهز للنشر!"
