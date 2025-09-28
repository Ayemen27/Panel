/**
 * معالج الاستجابات الموحد - يوفر تنسيقاً موحداً لجميع استجابات API
 * يقلل التكرار في معالجة الأخطاء والاستجابات
 */

import { Response } from 'express';
import { ServiceResult } from './BaseService';
import { ServiceError, ServiceErrorCode } from './ServiceError';
import { logger } from '../utils/logger';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  message?: string;
  metadata?: {
    timestamp: string;
    requestId?: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export class ResponseHandler {
  /**
   * إرسال استجابة ناجحة
   */
  static success<T>(
    res: Response,
    data?: T,
    message?: string,
    statusCode: number = 200,
    metadata?: Record<string, any>
  ): void {
    const response: ApiResponse<T> = {
      success: true,
      data,
      message,
      metadata: {
        timestamp: new Date().toISOString(),
        ...metadata
      }
    };

    res.status(statusCode).json(response);
  }

  /**
   * إرسال استجابة خطأ
   */
  static error(
    res: Response,
    error: string,
    statusCode: number = 500,
    code?: string,
    metadata?: Record<string, any>
  ): void {
    const response: ApiResponse = {
      success: false,
      error,
      code,
      metadata: {
        timestamp: new Date().toISOString(),
        ...metadata
      }
    };

    // تسجيل الخطأ
    logger.error('API Error Response', {
      error,
      code,
      statusCode,
      metadata
    });

    res.status(statusCode).json(response);
  }

  /**
   * إرسال استجابة مع نتيجة خدمة
   */
  static fromServiceResult<T>(
    res: Response,
    result: ServiceResult<T>,
    successMessage?: string,
    successStatusCode: number = 200
  ): void {
    if (result.success) {
      this.success(
        res,
        result.data,
        successMessage,
        successStatusCode,
        result.metadata
      );
    } else {
      const statusCode = this.getStatusCodeFromError(result.code);
      this.error(
        res,
        result.error || 'حدث خطأ غير متوقع',
        statusCode,
        result.code,
        result.metadata
      );
    }
  }

  /**
   * إرسال استجابة مع بيانات مقسمة (pagination)
   */
  static paginated<T>(
    res: Response,
    data: T[],
    pagination: {
      page: number;
      limit: number;
      total: number;
    },
    message?: string,
    statusCode: number = 200
  ): void {
    const totalPages = Math.ceil(pagination.total / pagination.limit);

    this.success(
      res,
      data,
      message,
      statusCode,
      {
        pagination: {
          ...pagination,
          totalPages
        }
      }
    );
  }

  /**
   * معالجة الأخطاء الشائعة وتحديد رمز الحالة المناسب
   */
  private static getStatusCodeFromError(code?: string): number {
    if (!code) return 500;

    // تحقق من كون الكود من ServiceErrorCode
    if (Object.values(ServiceErrorCode).includes(code as ServiceErrorCode)) {
      // استخدم ServiceError لتحديد StatusCode
      const tempError = new ServiceError('temp', code as ServiceErrorCode);
      return tempError.statusCode;
    }

    // خريطة fallback للأكواد القديمة
    const errorCodes: Record<string, number> = {
      // أخطاء المصادقة
      'UNAUTHORIZED': 401,
      'INVALID_CREDENTIALS': 401,
      'TOKEN_EXPIRED': 401,
      'INVALID_TOKEN': 401,

      // أخطاء الصلاحيات
      'FORBIDDEN': 403,
      'INSUFFICIENT_PERMISSIONS': 403,
      'ROLE_REQUIRED': 403,

      // أخطاء البيانات
      'NOT_FOUND': 404,
      'RESOURCE_NOT_FOUND': 404,
      'USER_NOT_FOUND': 404,

      // أخطاء التحقق
      'VALIDATION_ERROR': 400,
      'INVALID_INPUT': 400,
      'MISSING_REQUIRED_FIELD': 400,
      'INVALID_FORMAT': 400,

      // أخطاء التضارب
      'CONFLICT': 409,
      'DUPLICATE_ENTRY': 409,
      'RESOURCE_EXISTS': 409,

      // أخطاء الخادم
      'DATABASE_ERROR': 500,
      'INTERNAL_ERROR': 500,
      'SERVICE_UNAVAILABLE': 503,

      // أخطاء الشبكة
      'TIMEOUT': 408,
      'RATE_LIMIT': 429
    };

    return errorCodes[code] || 500;
  }

  /**
   * معالجة الأخطاء الشائعة في Express
   */
  static handleCommonErrors(error: any): { message: string; code: string; statusCode: number } {
    // أخطاء قاعدة البيانات
    if (error.code === '23505') { // PostgreSQL unique violation
      return {
        message: 'البيانات موجودة مسبقاً',
        code: 'DUPLICATE_ENTRY',
        statusCode: 409
      };
    }

    if (error.code === '23503') { // PostgreSQL foreign key violation
      return {
        message: 'العنصر المرتبط غير موجود',
        code: 'REFERENCE_ERROR',
        statusCode: 400
      };
    }

    if (error.code === '23502') { // PostgreSQL not null violation
      return {
        message: 'حقل مطلوب مفقود',
        code: 'MISSING_REQUIRED_FIELD',
        statusCode: 400
      };
    }

    // أخطاء JSON
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      return {
        message: 'تنسيق JSON غير صحيح',
        code: 'INVALID_JSON',
        statusCode: 400
      };
    }

    // أخطاء التحقق من Zod
    if (error.name === 'ZodError') {
      return {
        message: 'بيانات الإدخال غير صحيحة',
        code: 'VALIDATION_ERROR',
        statusCode: 400
      };
    }

    // خطأ افتراضي
    return {
      message: error.message || 'حدث خطأ غير متوقع',
      code: 'INTERNAL_ERROR',
      statusCode: 500
    };
  }

  /**
   * Middleware لمعالجة الأخطاء العامة
   */
  static errorMiddleware() {
    return (error: any, req: any, res: Response, next: any) => {
      const { message, code, statusCode } = this.handleCommonErrors(error);
      
      // تسجيل معلومات إضافية عن الطلب
      logger.error('Unhandled API Error', {
        error: message,
        code,
        method: req.method,
        url: req.url,
        userId: req.user?.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        stack: error.stack
      });

      this.error(res, message, statusCode, code, {
        method: req.method,
        url: req.url
      });
    };
  }

  /**
   * Middleware للطلبات غير الموجودة
   */
  static notFoundMiddleware() {
    return (req: any, res: Response) => {
      this.error(res, 'المسار غير موجود', 404, 'NOT_FOUND', {
        method: req.method,
        url: req.url
      });
    };
  }
}