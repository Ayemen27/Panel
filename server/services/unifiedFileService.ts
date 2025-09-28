
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { existsSync, statSync, constants as fsConstants } from 'fs';
import { IStorage } from '../storage';
import { logger } from '../utils/logger';

export interface UnifiedFileInfo {
  id?: string;
  name: string;
  type: 'file' | 'directory';
  path: string;
  absolutePath: string;
  size: number;
  permissions: string;
  owner?: string;
  created: string;
  modified: string;
  isHidden: boolean;
  extension?: string;
  mimeType?: string;
}

export interface DirectoryListing {
  path: string;
  items: UnifiedFileInfo[];
  totalFiles: number;
  totalDirectories: number;
  totalSize: number;
}

export interface FileOperationResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

/**
 * خدمة موحدة لإدارة الملفات - تجمع وظائف FileManagerService و RealFileSystemService
 */
export class UnifiedFileService {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * التحقق من صحة وأمان المسار
   */
  private async validatePath(inputPath: string): Promise<{ 
    isValid: boolean; 
    normalizedPath: string; 
    error?: string 
  }> {
    try {
      const normalizedPath = path.resolve(path.normalize(inputPath));
      
      // فحص محاولات التسلل
      if (inputPath.includes('..') || inputPath.includes('./') || inputPath.includes('.\\')) {
        logger.warn(`Directory traversal attempt: ${inputPath}`);
        return { 
          isValid: false, 
          normalizedPath, 
          error: 'محاولة تسلل في المجلدات - مسار غير آمن' 
        };
      }

      // فحص الأحرف غير المسموحة
      if (normalizedPath.includes('\0')) {
        return { 
          isValid: false, 
          normalizedPath, 
          error: 'مسار غير صحيح - يحتوي على أحرف غير مسموحة' 
        };
      }

      // فحص طول المسار
      if (normalizedPath.length > 4096) {
        return { 
          isValid: false, 
          normalizedPath, 
          error: 'المسار طويل جداً' 
        };
      }

      // التحقق من المسارات المسموحة في قاعدة البيانات
      const isAllowed = await this.storage.checkPathAllowed(normalizedPath);
      if (!isAllowed) {
        logger.warn(`Access denied to path: ${normalizedPath}`);
        return { 
          isValid: false, 
          normalizedPath, 
          error: 'الوصول مرفوض - المسار غير مدرج في القائمة المسموحة' 
        };
      }

      return { isValid: true, normalizedPath };
    } catch (error) {
      logger.error(`Path validation error: ${error}`);
      return { 
        isValid: false, 
        normalizedPath: inputPath, 
        error: 'فشل في التحقق من المسار' 
      };
    }
  }

  /**
   * فحص الصلاحيات
   */
  private async checkPermissions(filePath: string, requiredPermission: 'read' | 'write' | 'execute'): Promise<boolean> {
    try {
      let mode: number;
      switch (requiredPermission) {
        case 'read': mode = fsConstants.R_OK; break;
        case 'write': mode = fsConstants.W_OK; break;
        case 'execute': mode = fsConstants.X_OK; break;
        default: return false;
      }
      await fs.access(filePath, mode);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * تنسيق الصلاحيات
   */
  private formatPermissions(mode: number): string {
    const permissions = [];
    permissions.push(mode & 0o400 ? 'r' : '-');
    permissions.push(mode & 0o200 ? 'w' : '-');
    permissions.push(mode & 0o100 ? 'x' : '-');
    permissions.push(mode & 0o040 ? 'r' : '-');
    permissions.push(mode & 0o020 ? 'w' : '-');
    permissions.push(mode & 0o010 ? 'x' : '-');
    permissions.push(mode & 0o004 ? 'r' : '-');
    permissions.push(mode & 0o002 ? 'w' : '-');
    permissions.push(mode & 0o001 ? 'x' : '-');
    return permissions.join('');
  }

  /**
   * الحصول على نوع MIME
   */
  private getMimeType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.json': 'application/json',
      '.js': 'application/javascript',
      '.ts': 'application/typescript',
      '.html': 'text/html',
      '.css': 'text/css',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.pdf': 'application/pdf',
      '.zip': 'application/zip'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * تسجيل العمليات
   */
  private async createAuditLog(action: string, userId: string, filePath: string, details?: string): Promise<void> {
    try {
      await this.storage.createAuditLog({
        fileId: null,
        action: action as any,
        userId,
        details: `File operation: ${action} on ${filePath}. ${details || ''}`,
        oldValue: null,
        newValue: null,
        ipAddress: null,
        userAgent: null,
      });
    } catch (error) {
      logger.error(`Failed to create audit log: ${error}`);
    }
  }

  /**
   * عرض محتويات المجلد
   */
  async listDirectory(dirPath: string, userId: string): Promise<FileOperationResult> {
    try {
      const pathValidation = await this.validatePath(dirPath);
      if (!pathValidation.isValid) {
        return {
          success: false,
          message: 'فشل في التحقق من المسار',
          error: pathValidation.error
        };
      }

      const normalizedPath = pathValidation.normalizedPath;

      if (!existsSync(normalizedPath)) {
        return {
          success: false,
          message: 'المجلد غير موجود',
          error: 'المجلد المطلوب غير موجود'
        };
      }

      const stats = await fs.stat(normalizedPath);
      if (!stats.isDirectory()) {
        return {
          success: false,
          message: 'المسار ليس مجلداً',
          error: 'المسار المحدد ليس مجلداً'
        };
      }

      const hasReadPermission = await this.checkPermissions(normalizedPath, 'read');
      if (!hasReadPermission) {
        return {
          success: false,
          message: 'الوصول مرفوض',
          error: 'لا توجد صلاحية قراءة للمجلد'
        };
      }

      const entries = await fs.readdir(normalizedPath);
      const items: UnifiedFileInfo[] = [];
      let totalFiles = 0;
      let totalDirectories = 0;
      let totalSize = 0;

      for (const entry of entries) {
        const itemPath = path.join(normalizedPath, entry);
        try {
          const itemStats = await fs.stat(itemPath);
          const isDirectory = itemStats.isDirectory();
          const isHidden = entry.startsWith('.');

          const fileInfo: UnifiedFileInfo = {
            name: entry,
            type: isDirectory ? 'directory' : 'file',
            path: path.relative(process.cwd(), itemPath),
            absolutePath: itemPath,
            size: itemStats.size,
            permissions: this.formatPermissions(itemStats.mode),
            created: itemStats.birthtime.toISOString(),
            modified: itemStats.mtime.toISOString(),
            isHidden,
            extension: isDirectory ? undefined : path.extname(entry),
            mimeType: isDirectory ? undefined : this.getMimeType(entry)
          };

          items.push(fileInfo);

          if (isDirectory) {
            totalDirectories++;
          } else {
            totalFiles++;
            totalSize += itemStats.size;
          }
        } catch (itemError) {
          logger.warn(`Could not stat item ${itemPath}: ${itemError}`);
        }
      }

      const directoryListing: DirectoryListing = {
        path: normalizedPath,
        items: items.sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        }),
        totalFiles,
        totalDirectories,
        totalSize
      };

      await this.createAuditLog('access', userId, normalizedPath, 'عرض محتويات المجلد');

      return {
        success: true,
        message: 'تم عرض محتويات المجلد بنجاح',
        data: directoryListing
      };

    } catch (error) {
      logger.error(`Error listing directory ${dirPath}: ${error}`);
      return {
        success: false,
        message: 'فشل في عرض محتويات المجلد',
        error: error instanceof Error ? error.message : 'خطأ غير معروف'
      };
    }
  }

  /**
   * قراءة محتوى الملف
   */
  async readFileContent(filePath: string, userId: string, encoding: BufferEncoding = 'utf8'): Promise<FileOperationResult> {
    try {
      const pathValidation = await this.validatePath(filePath);
      if (!pathValidation.isValid) {
        return {
          success: false,
          message: 'فشل في التحقق من المسار',
          error: pathValidation.error
        };
      }

      const normalizedPath = pathValidation.normalizedPath;

      if (!existsSync(normalizedPath)) {
        return {
          success: false,
          message: 'الملف غير موجود',
          error: 'الملف المطلوب غير موجود'
        };
      }

      const stats = await fs.stat(normalizedPath);
      if (stats.isDirectory()) {
        return {
          success: false,
          message: 'المسار مجلد وليس ملف',
          error: 'لا يمكن قراءة المجلد كملف'
        };
      }

      const hasReadPermission = await this.checkPermissions(normalizedPath, 'read');
      if (!hasReadPermission) {
        return {
          success: false,
          message: 'الوصول مرفوض',
          error: 'لا توجد صلاحية قراءة للملف'
        };
      }

      if (stats.size > 10 * 1024 * 1024) {
        return {
          success: false,
          message: 'الملف كبير جداً',
          error: 'حجم الملف يتجاوز 10 ميجابايت'
        };
      }

      const content = await fs.readFile(normalizedPath, encoding);
      await this.createAuditLog('read', userId, normalizedPath, `قراءة ملف (${stats.size} بايت)`);

      return {
        success: true,
        message: 'تم قراءة محتوى الملف بنجاح',
        data: {
          content,
          size: stats.size,
          encoding,
          mimeType: this.getMimeType(path.basename(normalizedPath))
        }
      };

    } catch (error) {
      logger.error(`Error reading file ${filePath}: ${error}`);
      return {
        success: false,
        message: 'فشل في قراءة الملف',
        error: error instanceof Error ? error.message : 'خطأ غير معروف'
      };
    }
  }

  /**
   * إنشاء مجلد جديد
   */
  async createDirectory(dirPath: string, userId: string, options: { recursive?: boolean; mode?: string | number } = {}): Promise<FileOperationResult> {
    try {
      const pathValidation = await this.validatePath(dirPath);
      if (!pathValidation.isValid) {
        return {
          success: false,
          message: 'فشل في التحقق من المسار',
          error: pathValidation.error
        };
      }

      const normalizedPath = pathValidation.normalizedPath;

      if (existsSync(normalizedPath)) {
        return {
          success: false,
          message: 'المجلد موجود بالفعل',
          error: 'يوجد ملف أو مجلد بهذا الاسم'
        };
      }

      const parentDir = path.dirname(normalizedPath);
      const hasWritePermission = await this.checkPermissions(parentDir, 'write');
      if (!hasWritePermission) {
        return {
          success: false,
          message: 'الوصول مرفوض',
          error: 'لا توجد صلاحية كتابة في المجلد الأب'
        };
      }

      await fs.mkdir(normalizedPath, {
        recursive: options.recursive || false,
        mode: options.mode || 0o755
      });

      const stats = await fs.stat(normalizedPath);
      await this.createAuditLog('create', userId, normalizedPath, 'إنشاء مجلد جديد');

      return {
        success: true,
        message: 'تم إنشاء المجلد بنجاح',
        data: {
          path: normalizedPath,
          created: stats.birthtime.toISOString(),
          permissions: this.formatPermissions(stats.mode)
        }
      };

    } catch (error) {
      logger.error(`Error creating directory ${dirPath}: ${error}`);
      return {
        success: false,
        message: 'فشل في إنشاء المجلد',
        error: error instanceof Error ? error.message : 'خطأ غير معروف'
      };
    }
  }

  /**
   * حذف ملف أو مجلد
   */
  async deleteItem(filePath: string, userId: string): Promise<FileOperationResult> {
    try {
      const pathValidation = await this.validatePath(filePath);
      if (!pathValidation.isValid) {
        return {
          success: false,
          message: 'فشل في التحقق من المسار',
          error: pathValidation.error
        };
      }

      const normalizedPath = pathValidation.normalizedPath;

      if (!existsSync(normalizedPath)) {
        return {
          success: false,
          message: 'الملف أو المجلد غير موجود',
          error: 'المسار المطلوب غير موجود'
        };
      }

      const stats = await fs.stat(normalizedPath);
      const isDirectory = stats.isDirectory();
      const itemName = path.basename(normalizedPath);

      const parentDir = path.dirname(normalizedPath);
      const hasWritePermission = await this.checkPermissions(parentDir, 'write');
      if (!hasWritePermission) {
        return {
          success: false,
          message: 'الوصول مرفوض',
          error: 'لا توجد صلاحية كتابة في المجلد الأب'
        };
      }

      if (isDirectory) {
        await fs.rmdir(normalizedPath, { recursive: true });
      } else {
        await fs.unlink(normalizedPath);
      }

      await this.createAuditLog('delete', userId, normalizedPath, `حذف ${isDirectory ? 'مجلد' : 'ملف'}: ${itemName}`);

      return {
        success: true,
        message: `تم حذف ${isDirectory ? 'المجلد' : 'الملف'} بنجاح`,
        data: {
          path: normalizedPath,
          name: itemName,
          type: isDirectory ? 'directory' : 'file',
          size: stats.size
        }
      };

    } catch (error) {
      logger.error(`Error deleting item ${filePath}: ${error}`);
      return {
        success: false,
        message: 'فشل في حذف العنصر',
        error: error instanceof Error ? error.message : 'خطأ غير معروف'
      };
    }
  }
}
