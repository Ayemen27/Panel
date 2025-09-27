import { ENV_CONFIG, getPath, pathExists } from "../../shared/environment";
import fs from 'fs';
import path from 'path';

export class PathManager {
  private static instance: PathManager;

  private constructor() {}

  static getInstance(): PathManager {
    if (!PathManager.instance) {
      PathManager.instance = new PathManager();
    }
    return PathManager.instance;
  }

  // الحصول على مسار صالح، مع fallback إلى مسار افتراضي
  getValidPath(pathType: keyof typeof ENV_CONFIG.paths, fallback?: string): string {
    const configPath = ENV_CONFIG.paths[pathType];

    // للمسارات النسبية، قم بحلها مع مجلد المشروع الحالي
    const resolvedPath = path.isAbsolute(configPath)
      ? configPath
      : path.resolve(process.cwd(), configPath);

    // التحقق من وجود المسار
    if (fs.existsSync(resolvedPath)) {
      return resolvedPath;
    }

    // إذا لم يوجد المسار، محاولة إنشاؤه
    try {
      fs.mkdirSync(resolvedPath, { recursive: true, mode: 0o755 });
      console.log(`✅ Created path: ${resolvedPath}`);
      return resolvedPath;
    } catch (error) {
      console.warn(`⚠️ Could not create directory ${resolvedPath}:`, error);

      // استخدام fallback إذا تم توفيره
      if (fallback) {
        const resolvedFallback = path.isAbsolute(fallback)
          ? fallback
          : path.resolve(process.cwd(), fallback);
        try {
          fs.mkdirSync(resolvedFallback, { recursive: true, mode: 0o755 });
          console.log(`✅ Created fallback path: ${resolvedFallback}`);
          return resolvedFallback;
        } catch (fallbackError) {
          console.warn(`⚠️ Fallback also failed ${resolvedFallback}:`, fallbackError);
        }
      }

      // آخر محاولة: استخدام مجلد محلي
      const localPath = path.join(process.cwd(), path.basename(configPath));
      try {
        fs.mkdirSync(localPath, { recursive: true, mode: 0o755 });
        console.log(`✅ Created local path: ${localPath}`);
        return localPath;
      } catch (localError) {
        console.error(`❌ All path attempts failed for ${pathType}:`, localError);
        return resolvedPath; // إرجاع المسار المحلول حتى لو فشل
      }
    }
  }

  // الحصول على مسار السجلات
  getLogsPath(): string {
    return this.getValidPath('logs', './logs');
  }

  // الحصول على مسار الرفوعات
  getUploadsPath(): string {
    return this.getValidPath('uploads', './uploads');
  }

  // الحصول على مسار الإعدادات
  getConfigPath(): string {
    return this.getValidPath('config', './.config');
  }

  // الحصول على مسار SSL
  getSSLPath(): string {
    return this.getValidPath('ssl', './ssl');
  }

  // الحصول على مسار Nginx
  getNginxPath(): string {
    // Nginx له مسارات خاصة حسب البيئة
    const possiblePaths = [
      getPath('nginx'),
      '/etc/nginx',
      '/usr/local/etc/nginx',
      '/opt/nginx/conf',
      './nginx'
    ];

    for (const nginxPath of possiblePaths) {
      if (fs.existsSync(nginxPath)) {
        return nginxPath;
      }
    }

    // إنشاء مجلد nginx محلي إذا لم توجد المسارات الأخرى
    const localNginxPath = './nginx';
    try {
      if (!fs.existsSync(localNginxPath)) {
        fs.mkdirSync(localNginxPath, { recursive: true });
      }
      return localNginxPath;
    } catch (error) {
      return './nginx';
    }
  }

  // الحصول على مسار PM2
  getPM2Path(): string {
    return this.getValidPath('pm2', './.pm2');
  }

  // دالة للحصول على مسار ملف معين
  getFilePath(pathType: keyof typeof ENV_CONFIG.paths, filename: string): string {
    const basePath = this.getValidPath(pathType);
    return path.join(basePath, filename);
  }

  // التحقق من صلاحيات الكتابة في مسار معين
  isWritable(dirPath: string): boolean {
    try {
      fs.accessSync(dirPath, fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  // التحقق من صلاحيات القراءة في مسار معين
  isReadable(dirPath: string): boolean {
    try {
      fs.accessSync(dirPath, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  // الحصول على معلومات المسار
  getPathInfo(pathType: keyof typeof ENV_CONFIG.paths) {
    const path = this.getValidPath(pathType);
    return {
      path,
      exists: fs.existsSync(path),
      isWritable: this.isWritable(path),
      isReadable: this.isReadable(path),
      environment: ENV_CONFIG.name
    };
  }

  // طباعة تشخيص المسارات
  logPathsDiagnostic() {
    console.log('📁 تشخيص المسارات:');
    console.log(`🌍 البيئة: ${ENV_CONFIG.name}`);
    console.log(`🔧 نوع الخادم: ${ENV_CONFIG.isReplit ? 'Replit' : 'External/Local'}`);

    const pathTypes = ['root', 'logs', 'uploads', 'config', 'ssl', 'nginx', 'pm2'] as const;

    pathTypes.forEach(pathType => {
      const info = this.getPathInfo(pathType);
      console.log(`   📂 ${pathType}: ${info.path}`);
      console.log(`      - موجود: ${info.exists ? '✅' : '❌'}`);
      console.log(`      - قابل للقراءة: ${info.isReadable ? '✅' : '❌'}`);
      console.log(`      - قابل للكتابة: ${info.isWritable ? '✅' : '❌'}`);
    });
  }
}

// تصدير singleton instance
export const pathManager = PathManager.getInstance();

// دوال مساعدة سريعة
export const getLogsPath = () => pathManager.getLogsPath();
export const getUploadsPath = () => pathManager.getUploadsPath();
export const getConfigPath = () => pathManager.getConfigPath();
export const getSSLPath = () => pathManager.getSSLPath();
export const getNginxPath = () => pathManager.getNginxPath();
export const getPM2Path = () => pathManager.getPM2Path();