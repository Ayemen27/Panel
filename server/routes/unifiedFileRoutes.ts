import { Request, Response, Router } from 'express';
import { ResponseHandler } from '../core/ResponseHandler';
import { ServiceContainer } from '../core/ServiceContainer';
import { UnifiedFileService } from '../services/unifiedFileService';
import { ServiceTokens } from '../core/ServiceTokens';
import { serviceInjectionMiddleware } from '../core/ServiceContainer';
import { storage } from '../storage';
import { isAuthenticated } from '../auth';
import { logger } from '../utils/logger';
import path from 'path';

// Enhanced Request interface with services
interface AuthenticatedRequest extends Request {
  services: ServiceContainer;
  user?: any;
}

const router = Router();

// تطبيق middleware لحقن الخدمات
router.use(serviceInjectionMiddleware(storage));

// استعراض محتويات المجلد
router.get('/browse', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // الحصول على خدمة الملفات الموحدة من الحاوي
    const unifiedFileService = req.services.resolveByToken<UnifiedFileService>(
      ServiceTokens.UNIFIED_FILE_SERVICE
    );

    let { path } = req.query;
    const userId = req.user?.id;

    // إذا لم يتم تمرير مسار، استخدم المسار الافتراضي
    if (!path || typeof path !== 'string') {
      path = '/home/administrator';
    }

    logger.info(`[UnifiedFiles] Browsing directory: ${path} for user: ${userId}`);

    const result = await unifiedFileService.listDirectory(path, userId);

    if (!result.success) {
      logger.error(`[UnifiedFiles] Browse failed: ${result.error}`);
    }

    ResponseHandler.fromServiceResult(
      res,
      result,
      'تم جلب محتويات المجلد بنجاح'
    );

  } catch (error) {
    logger.error(`[UnifiedFiles] Browse error: ${error}`);
    const message = error instanceof Error ? error.message : 'خطأ غير معروف';
    ResponseHandler.error(res, message, 500, 'INTERNAL_ERROR');
  }
});

// قراءة محتوى الملف
router.get('/content', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // الحصول على خدمة الملفات الموحدة من الحاوي
    const unifiedFileService = req.services.resolveByToken<UnifiedFileService>(
      ServiceTokens.UNIFIED_FILE_SERVICE
    );

    const { path } = req.query;
    const userId = req.user?.id;

    if (!path || typeof path !== 'string') {
      return ResponseHandler.error(res, 'مسار الملف مطلوب', 400, 'MISSING_REQUIRED_FIELD');
    }

    const result = await unifiedFileService.readFileContent(path, userId);

    ResponseHandler.fromServiceResult(
      res,
      result,
      'تم قراءة محتوى الملف بنجاح'
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطأ غير معروف';
    ResponseHandler.error(res, message, 500, 'INTERNAL_ERROR');
  }
});

// إنشاء مجلد جديد
router.post('/create-directory', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // الحصول على خدمة الملفات الموحدة من الحاوي
    const unifiedFileService = req.services.resolveByToken<UnifiedFileService>(
      ServiceTokens.UNIFIED_FILE_SERVICE
    );

    const { path, options } = req.body;
    const userId = req.user?.id;

    if (!path) {
      return ResponseHandler.error(res, 'مسار المجلد مطلوب', 400, 'MISSING_REQUIRED_FIELD');
    }

    const result = await unifiedFileService.createDirectory(path, userId, options || {});

    ResponseHandler.fromServiceResult(
      res,
      result,
      'تم إنشاء المجلد بنجاح',
      201
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطأ غير معروف';
    ResponseHandler.error(res, message, 500, 'INTERNAL_ERROR');
  }
});

// إنشاء ملف جديد
router.post('/create-file', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // الحصول على خدمة الملفات الموحدة من الحاوي
    const unifiedFileService = req.services.resolveByToken<UnifiedFileService>(
      ServiceTokens.UNIFIED_FILE_SERVICE
    );

    const { path, content, options } = req.body;
    const userId = req.user?.id;

    if (!path) {
      return ResponseHandler.error(res, 'مسار الملف مطلوب', 400, 'MISSING_REQUIRED_FIELD');
    }

    const result = await unifiedFileService.createFile(path, userId, {
      content: content || '',
      ...options
    });

    ResponseHandler.fromServiceResult(
      res,
      result,
      'تم إنشاء الملف بنجاح',
      201
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطأ غير معروف';
    ResponseHandler.error(res, message, 500, 'INTERNAL_ERROR');
  }
});

// كتابة محتوى ملف
router.post('/write-file', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // الحصول على خدمة الملفات الموحدة من الحاوي
    const unifiedFileService = req.services.resolveByToken<UnifiedFileService>(
      ServiceTokens.UNIFIED_FILE_SERVICE
    );

    const { path, content } = req.body;
    const userId = req.user?.id;

    if (!path) {
      return ResponseHandler.error(res, 'مسار الملف مطلوب', 400, 'MISSING_REQUIRED_FIELD');
    }

    const result = await unifiedFileService.writeFile(path, content || '', userId);

    ResponseHandler.fromServiceResult(
      res,
      result,
      'تم حفظ الملف بنجاح'
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطأ غير معروف';
    ResponseHandler.error(res, message, 500, 'INTERNAL_ERROR');
  }
});

// إعادة تسمية ملف أو مجلد
router.post('/rename', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // الحصول على خدمة الملفات الموحدة من الحاوي
    const unifiedFileService = req.services.resolveByToken<UnifiedFileService>(
      ServiceTokens.UNIFIED_FILE_SERVICE
    );

    const { oldPath, newName, newPath } = req.body;
    const userId = req.user?.id;

    if (!oldPath) {
      return ResponseHandler.error(res, 'المسار القديم مطلوب', 400, 'MISSING_REQUIRED_FIELD');
    }

    let finalNewPath = newPath;
    
    // إذا تم تمرير اسم جديد فقط، قم ببناء المسار الكامل
    if (newName && !newPath) {
      const oldDir = path.dirname(oldPath);
      finalNewPath = path.join(oldDir, newName);
    }

    if (!finalNewPath) {
      return ResponseHandler.error(res, 'الاسم الجديد أو المسار الجديد مطلوب', 400, 'MISSING_REQUIRED_FIELD');
    }

    logger.info(`[UnifiedFiles] Renaming from: ${oldPath} to: ${finalNewPath} for user: ${userId}`);

    const result = await unifiedFileService.renameItem(oldPath, finalNewPath, userId);

    if (!result.success) {
      logger.error(`[UnifiedFiles] Rename failed: ${result.error}`);
    }

    ResponseHandler.fromServiceResult(
      res,
      result,
      'تم إعادة تسمية العنصر بنجاح'
    );

  } catch (error) {
    logger.error(`[UnifiedFiles] Rename error: ${error}`);
    const message = error instanceof Error ? error.message : 'خطأ غير معروف';
    ResponseHandler.error(res, message, 500, 'INTERNAL_ERROR');
  }
});

// نسخ ملف أو مجلد
router.post('/copy', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // الحصول على خدمة الملفات الموحدة من الحاوي
    const unifiedFileService = req.services.resolveByToken<UnifiedFileService>(
      ServiceTokens.UNIFIED_FILE_SERVICE
    );

    const { sourcePath, destinationPath } = req.body;
    const userId = req.user?.id;

    if (!sourcePath || !destinationPath) {
      return ResponseHandler.error(res, 'مسار المصدر والوجهة مطلوبان', 400, 'MISSING_REQUIRED_FIELD');
    }

    const result = await unifiedFileService.copyItem(sourcePath, destinationPath, userId);

    ResponseHandler.fromServiceResult(
      res,
      result,
      'تم نسخ العنصر بنجاح'
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطأ غير معروف';
    ResponseHandler.error(res, message, 500, 'INTERNAL_ERROR');
  }
});

// حذف ملف أو مجلد
router.delete('/delete', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // الحصول على خدمة الملفات الموحدة من الحاوي
    const unifiedFileService = req.services.resolveByToken<UnifiedFileService>(
      ServiceTokens.UNIFIED_FILE_SERVICE
    );

    // تجربة الحصول على المسار من query parameters أو body أو req.query
    let filePath = req.query.path as string || req.body.path;
    const userId = req.user?.id;

    // إذا لم يوجد المسار، تحقق من وجوده في الـ body كـ JSON
    if (!filePath && req.body) {
      // في حالة إرسال البيانات كـ JSON في الـ body
      if (typeof req.body === 'object' && req.body.path) {
        filePath = req.body.path;
      }
      // في حالة إرسال البيانات كـ query string في الـ URL
      else if (typeof req.body === 'string') {
        try {
          const parsed = JSON.parse(req.body);
          filePath = parsed.path;
        } catch {
          // إذا فشل الـ parsing، استخدم القيمة كما هي
          filePath = req.body;
        }
      }
    }

    // تنظيف المسار من الأحرف غير المرغوبة
    if (filePath && typeof filePath === 'string') {
      filePath = filePath.trim();
      // إزالة علامات الاقتباس إذا كانت موجودة
      if ((filePath.startsWith('"') && filePath.endsWith('"')) || 
          (filePath.startsWith("'") && filePath.endsWith("'"))) {
        filePath = filePath.slice(1, -1);
      }
    }

    if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') {
      logger.warn(`[UnifiedFiles] Delete failed - invalid path: ${JSON.stringify({
        queryPath: req.query.path,
        bodyPath: req.body?.path,
        fullBody: req.body,
        computedPath: filePath
      })}`);
      return ResponseHandler.error(res, 'مسار الملف مطلوب وصحيح', 400, 'MISSING_REQUIRED_FIELD');
    }

    logger.info(`[UnifiedFiles] Deleting item: ${filePath} for user: ${userId}`);

    const result = await unifiedFileService.deleteItem(filePath, userId);

    if (!result.success) {
      logger.error(`[UnifiedFiles] Delete failed: ${result.error}`);
    }

    ResponseHandler.fromServiceResult(
      res,
      result,
      'تم حذف العنصر بنجاح'
    );

  } catch (error) {
    logger.error(`[UnifiedFiles] Delete error: ${error}`);
    const message = error instanceof Error ? error.message : 'خطأ غير معروف';
    ResponseHandler.error(res, message, 500, 'INTERNAL_ERROR');
  }
});

// الحصول على معلومات ملف أو مجلد
router.get('/info', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // الحصول على خدمة الملفات الموحدة من الحاوي
    const unifiedFileService = req.services.resolveByToken<UnifiedFileService>(
      ServiceTokens.UNIFIED_FILE_SERVICE
    );

    const { path } = req.query;
    const userId = req.user?.id;

    if (!path || typeof path !== 'string') {
      return ResponseHandler.error(res, 'مسار الملف مطلوب', 400, 'MISSING_REQUIRED_FIELD');
    }

    const result = await unifiedFileService.getFileInfo(path, userId);

    ResponseHandler.fromServiceResult(
      res,
      result,
      'تم جلب معلومات الملف بنجاح'
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطأ غير معروف';
    ResponseHandler.error(res, message, 500, 'INTERNAL_ERROR');
  }
});

// رفع ملف أو عدة ملفات
router.post('/upload', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const unifiedFileService = req.services.resolveByToken<UnifiedFileService>(
      ServiceTokens.UNIFIED_FILE_SERVICE
    );

    const { targetPath, files } = req.body;
    const userId = req.user?.id;

    if (!targetPath || typeof targetPath !== 'string') {
      return ResponseHandler.error(res, 'مسار الرفع مطلوب', 400, 'MISSING_REQUIRED_FIELD');
    }

    if (!files || !Array.isArray(files) || files.length === 0) {
      return ResponseHandler.error(res, 'يجب تحديد ملف واحد على الأقل للرفع', 400, 'MISSING_REQUIRED_FIELD');
    }

    const results = [];
    const errors = [];

    for (const file of files) {
      try {
        const fullPath = `${targetPath}/${file.name}`.replace(/\/+/g, '/');
        
        const result = await unifiedFileService.createFile(fullPath, userId, {
          content: file.content,
          overwrite: false
        });

        if (result.success) {
          results.push({
            name: file.name,
            path: fullPath,
            size: file.size || 0,
            success: true
          });
        } else {
          errors.push({
            name: file.name,
            error: result.error || 'فشل في رفع الملف'
          });
        }
      } catch (error) {
        errors.push({
          name: file.name,
          error: error instanceof Error ? error.message : 'خطأ غير معروف'
        });
      }
    }

    const successCount = results.length;
    const errorCount = errors.length;

    if (successCount > 0 && errorCount === 0) {
      ResponseHandler.success(res, {
        uploaded: results,
        summary: {
          success: successCount,
          failed: errorCount
        }
      }, `تم رفع ${successCount} ملف بنجاح`, 201);
    } else if (successCount > 0 && errorCount > 0) {
      ResponseHandler.success(res, {
        uploaded: results,
        failed: errors,
        summary: {
          success: successCount,
          failed: errorCount
        }
      }, `تم رفع ${successCount} ملف، وفشل ${errorCount} ملف`);
    } else {
      ResponseHandler.error(res, 'فشل في رفع جميع الملفات', 400, 'UPLOAD_FAILED', {
        failed: errors,
        summary: {
          success: successCount,
          failed: errorCount
        }
      });
    }

  } catch (error) {
    logger.error(`[UnifiedFiles] Upload error: ${error}`);
    const message = error instanceof Error ? error.message : 'خطأ غير معروف';
    ResponseHandler.error(res, message, 500, 'INTERNAL_ERROR');
  }
});

export default router;