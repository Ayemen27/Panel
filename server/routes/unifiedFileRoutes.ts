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

    // تجربة الحصول على المسار من query parameters أو body
    const path = req.query.path as string || req.body.path;
    const userId = req.user?.id;

    if (!path) {
      return ResponseHandler.error(res, 'مسار الملف مطلوب', 400, 'MISSING_REQUIRED_FIELD');
    }

    logger.info(`[UnifiedFiles] Deleting item: ${path} for user: ${userId}`);

    const result = await unifiedFileService.deleteItem(path, userId);

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

export default router;