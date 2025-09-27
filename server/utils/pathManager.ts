
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
  
  // الحصول على المسار الصحيح مع التحقق من الوجود
  getValidPath(pathType: keyof typeof ENV_CONFIG.paths, fallbackPath?: string): string {
    const primaryPath = getPath(pathType);
    
    // محاولة إنشاء المسار إذا لم يكن موجوداً
    try {
      if (!fs.existsSync(primaryPath)) {
        fs.mkdirSync(primaryPath, { recursive: true, mode: 0o755 });
        console.log(`📁 تم إنشاء المسار: ${primaryPath}`);
        
        // التأكد من الصلاحيات الصحيحة
        try {
          fs.chmodSync(primaryPath, 0o755);
        } catch (chmodError) {
          console.warn(`⚠️ تعذر تعديل صلاحيات المسار: ${primaryPath}`);
        }
      }
      return primaryPath;
    } catch (error) {
      console.warn(`⚠️ فشل في إنشاء المسار الأساسي: ${primaryPath}`);
      
      // محاولة استخدام مسار احتياطي
      if (fallbackPath) {
        try {
          if (!fs.existsSync(fallbackPath)) {
            fs.mkdirSync(fallbackPath, { recursive: true, mode: 0o755 });
          }
          console.log(`🔄 استخدام المسار الاحتياطي: ${fallbackPath}`);
          return fallbackPath;
        } catch (fallbackError) {
          console.error(`❌ فشل في استخدام المسار الاحتياطي: ${fallbackPath}`);
        }
      }
      
      // استخدام مسار نسبي كملاذ أخير
      const relativePath = `./${pathType}`;
      try {
        if (!fs.existsSync(relativePath)) {
          fs.mkdirSync(relativePath, { recursive: true, mode: 0o755 });
        }
        console.log(`🏠 استخدام المسار النسبي: ${relativePath}`);
        return relativePath;
      } catch (relativeError) {
        console.error(`❌ فشل في جميع المسارات، استخدام المجلد الحالي`);
        return process.cwd();
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
