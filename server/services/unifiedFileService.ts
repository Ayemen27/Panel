import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { existsSync, statSync, constants as fsConstants } from 'fs';
import { IStorage, storage } from '../storage';
import { logger } from '../utils/logger';
import { BaseService, ServiceContext, ServiceResult } from '../core/BaseService';

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
 * الخدمة الموحدة الوحيدة لإدارة جميع أنواع الملفات
 * تحل محل جميع الخدمات القديمة: FileManagerService, RealFileSystemService
 * هذه هي الخدمة الوحيدة المستخدمة في النظام
 */
export class UnifiedFileService extends BaseService {
  constructor(storage: IStorage, context?: ServiceContext) {
    super(storage, context);
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
   * إنشاء ملف جديد
   */
  async createFile(filePath: string, userId: string, options: { content?: string; mode?: string | number; overwrite?: boolean } = {}): Promise<FileOperationResult> {
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

      if (existsSync(normalizedPath) && !options.overwrite) {
        return {
          success: false,
          message: 'الملف موجود بالفعل',
          error: 'يوجد ملف بهذا الاسم'
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

      await fs.writeFile(normalizedPath, options.content || '', {
        mode: options.mode || 0o644
      });

      const stats = await fs.stat(normalizedPath);
      await this.createAuditLog('create', userId, normalizedPath, 'إنشاء ملف جديد');

      return {
        success: true,
        message: 'تم إنشاء الملف بنجاح',
        data: {
          path: normalizedPath,
          created: stats.birthtime.toISOString(),
          size: stats.size,
          permissions: this.formatPermissions(stats.mode)
        }
      };

    } catch (error) {
      logger.error(`Error creating file ${filePath}: ${error}`);
      return {
        success: false,
        message: 'فشل في إنشاء الملف',
        error: error instanceof Error ? error.message : 'خطأ غير معروف'
      };
    }
  }

  /**
   * إعادة تسمية ملف أو مجلد
   */
  async renameItem(oldPath: string, newPath: string, userId: string): Promise<FileOperationResult> {
    try {
      const oldPathValidation = await this.validatePath(oldPath);
      const newPathValidation = await this.validatePath(newPath);

      if (!oldPathValidation.isValid) {
        return {
          success: false,
          message: 'فشل في التحقق من المسار القديم',
          error: oldPathValidation.error
        };
      }

      if (!newPathValidation.isValid) {
        return {
          success: false,
          message: 'فشل في التحقق من المسار الجديد',
          error: newPathValidation.error
        };
      }

      const oldNormalizedPath = oldPathValidation.normalizedPath;
      const newNormalizedPath = newPathValidation.normalizedPath;

      if (!existsSync(oldNormalizedPath)) {
        return {
          success: false,
          message: 'الملف أو المجلد غير موجود',
          error: 'المسار القديم غير موجود'
        };
      }

      if (existsSync(newNormalizedPath)) {
        return {
          success: false,
          message: 'الملف أو المجلد موجود بالفعل في الوجهة',
          error: 'المسار الجديد موجود بالفعل'
        };
      }

      const oldParentDir = path.dirname(oldNormalizedPath);
      const newParentDir = path.dirname(newNormalizedPath);

      const hasOldWritePermission = await this.checkPermissions(oldParentDir, 'write');
      const hasNewWritePermission = await this.checkPermissions(newParentDir, 'write');

      if (!hasOldWritePermission || !hasNewWritePermission) {
        return {
          success: false,
          message: 'الوصول مرفوض',
          error: 'لا توجد صلاحية كتابة في أحد المجلدات'
        };
      }

      await fs.rename(oldNormalizedPath, newNormalizedPath);

      const stats = await fs.stat(newNormalizedPath);
      await this.createAuditLog('rename', userId, oldNormalizedPath, `إعادة تسمية من ${oldNormalizedPath} إلى ${newNormalizedPath}`);

      return {
        success: true,
        message: 'تم إعادة تسمية العنصر بنجاح',
        data: {
          oldPath: oldNormalizedPath,
          newPath: newNormalizedPath,
          name: path.basename(newNormalizedPath),
          type: stats.isDirectory() ? 'directory' : 'file',
          size: stats.size
        }
      };

    } catch (error) {
      logger.error(`Error renaming item from ${oldPath} to ${newPath}: ${error}`);
      return {
        success: false,
        message: 'فشل في إعادة تسمية العنصر',
        error: error instanceof Error ? error.message : 'خطأ غير معروف'
      };
    }
  }

  /**
   * نسخ ملف أو مجلد
   */
  async copyItem(sourcePath: string, destinationPath: string, userId: string): Promise<FileOperationResult> {
    try {
      const sourceValidation = await this.validatePath(sourcePath);
      const destValidation = await this.validatePath(destinationPath);

      if (!sourceValidation.isValid) {
        return {
          success: false,
          message: 'فشل في التحقق من مسار المصدر',
          error: sourceValidation.error
        };
      }

      if (!destValidation.isValid) {
        return {
          success: false,
          message: 'فشل في التحقق من مسار الوجهة',
          error: destValidation.error
        };
      }

      const sourceNormalizedPath = sourceValidation.normalizedPath;
      const destNormalizedPath = destValidation.normalizedPath;

      if (!existsSync(sourceNormalizedPath)) {
        return {
          success: false,
          message: 'الملف أو المجلد المصدر غير موجود',
          error: 'مسار المصدر غير موجود'
        };
      }

      if (existsSync(destNormalizedPath)) {
        return {
          success: false,
          message: 'الملف أو المجلد موجود بالفعل في الوجهة',
          error: 'مسار الوجهة موجود بالفعل'
        };
      }

      const hasReadPermission = await this.checkPermissions(sourceNormalizedPath, 'read');
      const destParentDir = path.dirname(destNormalizedPath);
      const hasWritePermission = await this.checkPermissions(destParentDir, 'write');

      if (!hasReadPermission || !hasWritePermission) {
        return {
          success: false,
          message: 'الوصول مرفوض',
          error: 'لا توجد صلاحية للقراءة أو الكتابة'
        };
      }

      const stats = await fs.stat(sourceNormalizedPath);

      if (stats.isDirectory()) {
        await fs.cp(sourceNormalizedPath, destNormalizedPath, { recursive: true });
      } else {
        await fs.copyFile(sourceNormalizedPath, destNormalizedPath);
      }

      const destStats = await fs.stat(destNormalizedPath);
      await this.createAuditLog('copy', userId, sourceNormalizedPath, `نسخ من ${sourceNormalizedPath} إلى ${destNormalizedPath}`);

      return {
        success: true,
        message: 'تم نسخ العنصر بنجاح',
        data: {
          sourcePath: sourceNormalizedPath,
          destinationPath: destNormalizedPath,
          name: path.basename(destNormalizedPath),
          type: destStats.isDirectory() ? 'directory' : 'file',
          size: destStats.size
        }
      };

    } catch (error) {
      logger.error(`Error copying item from ${sourcePath} to ${destinationPath}: ${error}`);
      return {
        success: false,
        message: 'فشل في نسخ العنصر',
        error: error instanceof Error ? error.message : 'خطأ غير معروف'
      };
    }
  }

  /**
   * الحصول على معلومات ملف أو مجلد
   */
  async getFileInfo(filePath: string, userId: string): Promise<FileOperationResult> {
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
      const hasReadPermission = await this.checkPermissions(normalizedPath, 'read');

      if (!hasReadPermission) {
        return {
          success: false,
          message: 'الوصول مرفوض',
          error: 'لا توجد صلاحية قراءة للملف'
        };
      }

      const isDirectory = stats.isDirectory();
      const fileName = path.basename(normalizedPath);

      const fileInfo: UnifiedFileInfo = {
        name: fileName,
        type: isDirectory ? 'directory' : 'file',
        path: path.relative(process.cwd(), normalizedPath),
        absolutePath: normalizedPath,
        size: stats.size,
        permissions: this.formatPermissions(stats.mode),
        created: stats.birthtime.toISOString(),
        modified: stats.mtime.toISOString(),
        isHidden: fileName.startsWith('.'),
        extension: isDirectory ? undefined : path.extname(fileName),
        mimeType: isDirectory ? undefined : this.getMimeType(fileName)
      };

      await this.createAuditLog('access', userId, normalizedPath, 'عرض معلومات الملف');

      return {
        success: true,
        message: 'تم الحصول على معلومات الملف بنجاح',
        data: fileInfo
      };

    } catch (error) {
      logger.error(`Error getting file info ${filePath}: ${error}`);
      return {
        success: false,
        message: 'فشل في الحصول على معلومات الملف',
        error: error instanceof Error ? error.message : 'خطأ غير معروف'
      };
    }
  }

  /**
   * كتابة محتوى في ملف
   */
  async writeFile(filePath: string, content: string, userId: string): Promise<FileOperationResult> {
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
          error: 'لا يمكن الكتابة في المجلد'
        };
      }

      const hasWritePermission = await this.checkPermissions(normalizedPath, 'write');
      if (!hasWritePermission) {
        return {
          success: false,
          message: 'الوصول مرفوض',
          error: 'لا توجد صلاحية كتابة للملف'
        };
      }

      await fs.writeFile(normalizedPath, content, 'utf8');

      // Generate checksum for verification
      const checksum = crypto.createHash('md5').update(content).digest('hex');

      await this.createAuditLog('update', userId, normalizedPath, `كتابة محتوى في الملف (${content.length} حرف)`);

      return {
        success: true,
        message: 'تم حفظ محتوى الملف بنجاح',
        data: {
          checksum,
          size: Buffer.byteLength(content, 'utf8')
        }
      };

    } catch (error) {
      logger.error(`Error writing file ${filePath}: ${error}`);
      return {
        success: false,
        message: 'فشل في حفظ الملف',
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