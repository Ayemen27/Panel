
import compression from 'compression';
import { Request, Response, NextFunction } from 'express';

// إعدادات الضغط المحسنة
export const compressionMiddleware = compression({
  // مستوى الضغط (1-9، 6 هو الافتراضي)
  level: 6,
  
  // حد أدنى لحجم الملف للضغط (بالبايت)
  threshold: 1024,
  
  // تصفية الملفات التي يجب ضغطها
  filter: (req: Request, res: Response) => {
    // لا تضغط إذا كان العميل لا يدعم الضغط
    if (req.headers['x-no-compression']) {
      return false;
    }
    
    // استخدم الفلتر الافتراضي لـ compression
    return compression.filter(req, res);
  },
  
  // إعدادات إضافية للأداء
  windowBits: 15,
  memLevel: 8,
  
  // ضغط الاستجابات الصغيرة أيضاً
  chunkSize: 1024,
});

// Middleware إضافي لتحسين headers
export const cacheHeaders = (req: Request, res: Response, next: NextFunction) => {
  // إعداد cache headers للملفات الثابتة
  if (req.url.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (req.url.match(/\.(html|htm)$/)) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=300');
  }
  
  next();
};

// Middleware لتحسين الأداء
export const performanceHeaders = (req: Request, res: Response, next: NextFunction) => {
  // إضافة headers لتحسين الأداء
  res.setHeader('X-DNS-Prefetch-Control', 'on');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  
  next();
};
