
/**
 * Script تنظيف الملفات القديمة والمكررة
 * يقوم بحذف أو نقل الملفات غير المستخدمة بأمان
 */

import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface CleanupResult {
  deletedFiles: string[];
  movedFiles: Array<{ from: string; to: string }>;
  skippedFiles: string[];
  errors: string[];
}

class LegacyFilesCleanup {
  private projectRoot: string;
  private backupDir: string;
  private result: CleanupResult;

  constructor() {
    this.projectRoot = process.cwd();
    this.backupDir = path.join(this.projectRoot, 'cleanup-backup');
    this.result = {
      deletedFiles: [],
      movedFiles: [],
      skippedFiles: [],
      errors: []
    };
  }

  async runCleanup(dryRun: boolean = true): Promise<CleanupResult> {
    console.log(`🧹 بدء تنظيف الملفات ${dryRun ? '(وضع المحاكاة)' : '(تنفيذ حقيقي)'}...\n`);

    try {
      // إنشاء مجلد النسخ الاحتياطية
      if (!dryRun) {
        await this.ensureBackupDirectory();
      }

      // تنظيف الملفات القديمة
      await this.cleanupLegacyFiles(dryRun);

      // تنظيف الملفات المكررة
      await this.cleanupDuplicateFiles(dryRun);

      // تنظيف الملفات المؤقتة
      await this.cleanupTemporaryFiles(dryRun);

      // تنظيف node_modules إذا لزم الأمر
      await this.cleanupNodeModules(dryRun);

      console.log('\n✅ اكتمل التنظيف!');
      return this.result;

    } catch (error) {
      console.error('❌ خطأ أثناء التنظيف:', error);
      throw error;
    }
  }

  private async ensureBackupDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
      console.log(`📁 تم إنشاء مجلد النسخ الاحتياطية: ${this.backupDir}`);
    } catch (error) {
      throw new Error(`فشل في إنشاء مجلد النسخ الاحتياطية: ${error}`);
    }
  }

  private async cleanupLegacyFiles(dryRun: boolean): Promise<void> {
    console.log('🗂️ تنظيف الملفات القديمة...');

    // المجلدات القديمة المعروفة
    const legacyDirectories = [
      'oldServices',
      'legacy',
      'backup',
      'old',
      'deprecated',
      'temp',
      'archive'
    ];

    for (const dirName of legacyDirectories) {
      const dirPath = path.join(this.projectRoot, dirName);
      
      try {
        await fs.access(dirPath);
        
        if (dryRun) {
          console.log(`  🔍 سيتم نقل: ${dirName}/`);
        } else {
          const backupPath = path.join(this.backupDir, dirName);
          await fs.rename(dirPath, backupPath);
          this.result.movedFiles.push({ from: dirPath, to: backupPath });
          console.log(`  ✅ تم نقل: ${dirName}/ إلى النسخ الاحتياطية`);
        }
      } catch {
        // المجلد غير موجود - لا توجد مشكلة
      }
    }

    // الملفات القديمة بناءً على الأنماط
    await this.cleanupFilesByPattern(dryRun);
  }

  private async cleanupFilesByPattern(dryRun: boolean): Promise<void> {
    const legacyPatterns = [
      { pattern: /old-.*\.(ts|js)$/, reason: 'ملف قديم' },
      { pattern: /legacy-.*\.(ts|js)$/, reason: 'ملف تراثي' },
      { pattern: /backup-.*\.(ts|js)$/, reason: 'نسخة احتياطية' },
      { pattern: /temp-.*\.(ts|js)$/, reason: 'ملف مؤقت' },
      { pattern: /\.bak$/, reason: 'نسخة احتياطية' },
      { pattern: /\.backup$/, reason: 'نسخة احتياطية' },
      { pattern: /\.tmp$/, reason: 'ملف مؤقت' },
      { pattern: /~$/, reason: 'ملف مؤقت للمحرر' }
    ];

    await this.scanAndCleanByPatterns(this.projectRoot, legacyPatterns, dryRun);
  }

  private async scanAndCleanByPatterns(
    dir: string, 
    patterns: Array<{ pattern: RegExp; reason: string }>, 
    dryRun: boolean
  ): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isFile()) {
          for (const { pattern, reason } of patterns) {
            if (pattern.test(entry.name)) {
              if (dryRun) {
                console.log(`  🔍 سيتم حذف: ${fullPath} (${reason})`);
              } else {
                const backupPath = path.join(this.backupDir, 'files', entry.name);
                await fs.mkdir(path.dirname(backupPath), { recursive: true });
                await fs.rename(fullPath, backupPath);
                this.result.movedFiles.push({ from: fullPath, to: backupPath });
                console.log(`  ✅ تم نقل: ${entry.name} (${reason})`);
              }
              break;
            }
          }
        } else if (entry.isDirectory()) {
          await this.scanAndCleanByPatterns(fullPath, patterns, dryRun);
        }
      }
    } catch (error) {
      this.result.errors.push(`خطأ في فحص ${dir}: ${error}`);
    }
  }

  private async cleanupDuplicateFiles(dryRun: boolean): Promise<void> {
    console.log('📄 تنظيف الملفات المكررة...');

    // الملفات المكررة المعروفة من التقرير
    const knownDuplicates = [
      {
        name: 'dialog.tsx',
        locations: [
          'client/src/components/ui/dialog.tsx',
          'dialog.tsx'
        ]
      },
      {
        name: 'ecosystem.config.js',
        locations: [
          'ecosystem.config.js',
          'pm2/ecosystem.config.js'
        ]
      }
    ];

    for (const duplicate of knownDuplicates) {
      const { name, locations } = duplicate;
      
      // احتفظ بالملف الأول واحذف الباقي
      const [keepFile, ...removeFiles] = locations;
      
      for (const removeFile of removeFiles) {
        const filePath = path.join(this.projectRoot, removeFile);
        
        try {
          await fs.access(filePath);
          
          if (dryRun) {
            console.log(`  🔍 سيتم حذف الملف المكرر: ${removeFile} (الاحتفاظ بـ ${keepFile})`);
          } else {
            const backupPath = path.join(this.backupDir, 'duplicates', removeFile);
            await fs.mkdir(path.dirname(backupPath), { recursive: true });
            await fs.rename(filePath, backupPath);
            this.result.movedFiles.push({ from: filePath, to: backupPath });
            console.log(`  ✅ تم نقل الملف المكرر: ${removeFile}`);
          }
        } catch {
          console.log(`  ⚠️ الملف المكرر غير موجود: ${removeFile}`);
        }
      }
    }
  }

  private async cleanupTemporaryFiles(dryRun: boolean): Promise<void> {
    console.log('🗑️ تنظيف الملفات المؤقتة...');

    const tempPatterns = [
      '*.log',
      '*.tmp',
      '.DS_Store',
      'Thumbs.db',
      '*.swp',
      '*.swo',
      '*~'
    ];

    for (const pattern of tempPatterns) {
      try {
        const { stdout } = await execAsync(`find . -name "${pattern}" -type f -not -path "./node_modules/*" -not -path "./.git/*"`);
        const files = stdout.trim().split('\n').filter(f => f);
        
        for (const file of files) {
          if (dryRun) {
            console.log(`  🔍 سيتم حذف: ${file}`);
          } else {
            try {
              await fs.unlink(file);
              this.result.deletedFiles.push(file);
              console.log(`  ✅ تم حذف: ${file}`);
            } catch (error) {
              this.result.errors.push(`فشل حذف ${file}: ${error}`);
            }
          }
        }
      } catch {
        // لا توجد ملفات مطابقة للنمط
      }
    }
  }

  private async cleanupNodeModules(dryRun: boolean): Promise<void> {
    console.log('📦 فحص node_modules...');

    const nodeModulesPath = path.join(this.projectRoot, 'node_modules');
    
    try {
      const stats = await fs.stat(nodeModulesPath);
      const sizeInMB = Math.round(stats.size / (1024 * 1024));
      
      console.log(`  📊 حجم node_modules: ${sizeInMB} MB`);
      
      if (sizeInMB > 500) { // أكثر من 500 MB
        if (dryRun) {
          console.log(`  🔍 يُنصح بإعادة تثبيت node_modules (npm ci)`);
        } else {
          console.log(`  ⚠️ node_modules كبير جداً، يُنصح بتشغيل: npm ci`);
        }
      }
    } catch {
      console.log(`  ⚠️ node_modules غير موجود`);
    }
  }

  async generateCleanupReport(): Promise<void> {
    const timestamp = new Date().toLocaleString('ar-SA');
    
    const reportContent = `
# تقرير تنظيف الملفات القديمة

**تاريخ التنظيف:** ${timestamp}

## ملخص العمليات

- **ملفات محذوفة:** ${this.result.deletedFiles.length}
- **ملفات منقولة:** ${this.result.movedFiles.length}
- **ملفات متجاهلة:** ${this.result.skippedFiles.length}
- **أخطاء:** ${this.result.errors.length}

## الملفات المحذوفة
${this.result.deletedFiles.map(file => `- ${file}`).join('\n')}

## الملفات المنقولة
${this.result.movedFiles.map(move => `- ${move.from} → ${move.to}`).join('\n')}

## الأخطاء
${this.result.errors.map(error => `- ${error}`).join('\n')}

## التوصيات
- راجع الملفات في مجلد النسخ الاحتياطية قبل الحذف النهائي
- تشغيل \`npm ci\` إذا كان حجم node_modules كبير
- فحص دوري للملفات المؤقتة
`;

    await fs.writeFile('cleanup-report.md', reportContent);
    console.log('✅ تم إنشاء تقرير التنظيف: cleanup-report.md');
  }
}

// دالة رئيسية
async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');
  
  if (dryRun) {
    console.log('ℹ️ وضع المحاكاة - لن يتم حذف أي ملفات');
    console.log('ℹ️ لتنفيذ التنظيف الحقيقي، استخدم: tsx cleanup-legacy-files.ts --execute\n');
  }
  
  const cleanup = new LegacyFilesCleanup();
  
  try {
    const result = await cleanup.runCleanup(dryRun);
    
    console.log('\n📊 ملخص النتائج:');
    console.log(`   • ملفات محذوفة: ${result.deletedFiles.length}`);
    console.log(`   • ملفات منقولة: ${result.movedFiles.length}`);
    console.log(`   • أخطاء: ${result.errors.length}`);
    
    if (!dryRun) {
      await cleanup.generateCleanupReport();
    }
    
  } catch (error) {
    console.error('❌ فشل التنظيف:', error);
    process.exit(1);
  }
}

// تشغيل إذا تم استدعاؤه مباشرة
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { LegacyFilesCleanup };
