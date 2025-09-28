
import { Request, Response, Router } from 'express';
import { UnifiedFileService } from '../services/unifiedFileService';
import { storage } from '../storage';
import { logger } from '../utils/logger';

const router = Router();
const unifiedFileService = new UnifiedFileService(storage);

// استعراض محتويات المجلد
router.get('/browse', async (req: Request, res: Response) => {
  try {
    const { path } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'المستخدم غير مصادق عليه'
      });
    }

    if (!path || typeof path !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'مسار المجلد مطلوب'
      });
    }

    const result = await unifiedFileService.listDirectory(path, userId);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || result.message
      });
    }

  } catch (error) {
    logger.error('Error in unified browse:', error);
    res.status(500).json({
      success: false,
      error: 'خطأ داخلي في الخادم'
    });
  }
});

// قراءة محتوى الملف
router.get('/content', async (req: Request, res: Response) => {
  try {
    const { path } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'المستخدم غير مصادق عليه'
      });
    }

    if (!path || typeof path !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'مسار الملف مطلوب'
      });
    }

    const result = await unifiedFileService.readFileContent(path, userId);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || result.message
      });
    }

  } catch (error) {
    logger.error('Error in unified content:', error);
    res.status(500).json({
      success: false,
      error: 'خطأ داخلي في الخادم'
    });
  }
});

// إنشاء مجلد جديد
router.post('/create-directory', async (req: Request, res: Response) => {
  try {
    const { path, options } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'المستخدم غير مصادق عليه'
      });
    }

    if (!path) {
      return res.status(400).json({
        success: false,
        error: 'مسار المجلد مطلوب'
      });
    }

    const result = await unifiedFileService.createDirectory(path, userId, options || {});
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || result.message
      });
    }

  } catch (error) {
    logger.error('Error in unified create directory:', error);
    res.status(500).json({
      success: false,
      error: 'خطأ داخلي في الخادم'
    });
  }
});

// إنشاء ملف جديد
router.post('/create-file', async (req: Request, res: Response) => {
  try {
    const { path, content, options } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'المستخدم غير مصادق عليه'
      });
    }

    if (!path) {
      return res.status(400).json({
        success: false,
        error: 'مسار الملف مطلوب'
      });
    }

    const result = await unifiedFileService.createFile(path, userId, {
      content: content || '',
      ...options
    });
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || result.message
      });
    }

  } catch (error) {
    logger.error('Error in unified create file:', error);
    res.status(500).json({
      success: false,
      error: 'خطأ داخلي في الخادم'
    });
  }
});

// كتابة محتوى ملف
router.post('/write-file', async (req: Request, res: Response) => {
  try {
    const { path, content } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'المستخدم غير مصادق عليه'
      });
    }

    if (!path) {
      return res.status(400).json({
        success: false,
        error: 'مسار الملف مطلوب'
      });
    }

    const result = await unifiedFileService.writeFile(path, content || '', userId);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || result.message
      });
    }

  } catch (error) {
    logger.error('Error in unified write file:', error);
    res.status(500).json({
      success: false,
      error: 'خطأ داخلي في الخادم'
    });
  }
});

// إعادة تسمية ملف أو مجلد
router.post('/rename', async (req: Request, res: Response) => {
  try {
    const { oldPath, newPath } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'المستخدم غير مصادق عليه'
      });
    }

    if (!oldPath || !newPath) {
      return res.status(400).json({
        success: false,
        error: 'المسار القديم والجديد مطلوبان'
      });
    }

    const result = await unifiedFileService.renameItem(oldPath, newPath, userId);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || result.message
      });
    }

  } catch (error) {
    logger.error('Error in unified rename:', error);
    res.status(500).json({
      success: false,
      error: 'خطأ داخلي في الخادم'
    });
  }
});

// نسخ ملف أو مجلد
router.post('/copy', async (req: Request, res: Response) => {
  try {
    const { sourcePath, destinationPath } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'المستخدم غير مصادق عليه'
      });
    }

    if (!sourcePath || !destinationPath) {
      return res.status(400).json({
        success: false,
        error: 'مسار المصدر والوجهة مطلوبان'
      });
    }

    const result = await unifiedFileService.copyItem(sourcePath, destinationPath, userId);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || result.message
      });
    }

  } catch (error) {
    logger.error('Error in unified copy:', error);
    res.status(500).json({
      success: false,
      error: 'خطأ داخلي في الخادم'
    });
  }
});

// حذف ملف أو مجلد
router.delete('/delete', async (req: Request, res: Response) => {
  try {
    const { path } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'المستخدم غير مصادق عليه'
      });
    }

    if (!path) {
      return res.status(400).json({
        success: false,
        error: 'مسار الملف مطلوب'
      });
    }

    const result = await unifiedFileService.deleteItem(path, userId);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || result.message
      });
    }

  } catch (error) {
    logger.error('Error in unified delete:', error);
    res.status(500).json({
      success: false,
      error: 'خطأ داخلي في الخادم'
    });
  }
});

// الحصول على معلومات ملف أو مجلد
router.get('/info', async (req: Request, res: Response) => {
  try {
    const { path } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'المستخدم غير مصادق عليه'
      });
    }

    if (!path || typeof path !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'مسار الملف مطلوب'
      });
    }

    const result = await unifiedFileService.getFileInfo(path, userId);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || result.message
      });
    }

  } catch (error) {
    logger.error('Error in unified info:', error);
    res.status(500).json({
      success: false,
      error: 'خطأ داخلي في الخادم'
    });
  }
});

export default router;
