
import { Request, Response, Router } from 'express';
import { ResponseHandler } from '../core/ResponseHandler';
import { ServiceContainer } from '../core/ServiceContainer';
import { UnifiedFileService } from '../services/unifiedFileService';
import { ServiceTokens } from '../core/ServiceTokens';
import { serviceInjectionMiddleware } from '../core/ServiceContainer';
import { storage } from '../storage';
import { isAuthenticated } from '../auth';
import { logger } from '../utils/logger';

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

    const { path } = req.query;
    const userId = req.user?.id;

    if (!path || typeof path !== 'string') {
      return ResponseHandler.error(res, 'مسار المجلد مطلوب', 400, 'MISSING_REQUIRED_FIELD');
    }

    const result = await unifiedFileService.listDirectory(path, userId);
    
    ResponseHandler.fromServiceResult(
      res,
      result,
      'تم جلب محتويات المجلد بنجاح'
    );

  } catch (error) {
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

    const { oldPath, newPath } = req.body;
    const userId = req.user?.id;

    if (!oldPath || !newPath) {
      return ResponseHandler.error(res, 'المسار القديم والجديد مطلوبان', 400, 'MISSING_REQUIRED_FIELD');
    }

    const result = await unifiedFileService.renameItem(oldPath, newPath, userId);
    
    ResponseHandler.fromServiceResult(
      res,
      result,
      'تم إعادة تسمية العنصر بنجاح'
    );

  } catch (error) {
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

    const { path } = req.body;
    const userId = req.user?.id;

    if (!path) {
      return ResponseHandler.error(res, 'مسار الملف مطلوب', 400, 'MISSING_REQUIRED_FIELD');
    }

    const result = await unifiedFileService.deleteItem(path, userId);
    
    ResponseHandler.fromServiceResult(
      res,
      result,
      'تم حذف العنصر بنجاح'
    );

  } catch (error) {
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
