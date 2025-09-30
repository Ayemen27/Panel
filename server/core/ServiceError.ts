/**
 * ServiceError - فئة أخطاء الخدمات الموحدة
 * تقدم رموز أخطاء موحدة للاستجابات المناسبة
 */

export enum ServiceErrorCode {
  // أخطاء المصادقة والصلاحيات (4xx)
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  
  // أخطاء التحقق من البيانات (4xx)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELDS = 'MISSING_REQUIRED_FIELDS',
  INVALID_INPUT = 'INVALID_INPUT',
  
  // أخطاء الموارد (4xx)
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  CONFLICT = 'CONFLICT',
  
  // أخطاء العمليات (4xx)
  OPERATION_NOT_ALLOWED = 'OPERATION_NOT_ALLOWED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // أخطاء النظام (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  TIMEOUT = 'TIMEOUT',
  
  // أخطاء عامة
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export class ServiceError extends Error {
  public readonly code: ServiceErrorCode;
  public readonly statusCode: number;
  public readonly details?: any;

  constructor(
    message: string, 
    code: ServiceErrorCode = ServiceErrorCode.INTERNAL_ERROR,
    statusCode?: number,
    details?: any
  ) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.statusCode = statusCode || this.getDefaultStatusCode(code);
    this.details = details;

    // للحفاظ على stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ServiceError);
    }
  }

  /**
   * الحصول على رمز HTTP المناسب لنوع الخطأ
   */
  private getDefaultStatusCode(code: ServiceErrorCode): number {
    switch (code) {
      case ServiceErrorCode.UNAUTHORIZED:
      case ServiceErrorCode.INVALID_CREDENTIALS:
        return 401;
      
      case ServiceErrorCode.FORBIDDEN:
        return 403;
      
      case ServiceErrorCode.NOT_FOUND:
        return 404;
      
      case ServiceErrorCode.VALIDATION_ERROR:
      case ServiceErrorCode.MISSING_REQUIRED_FIELDS:
      case ServiceErrorCode.INVALID_INPUT:
        return 400;
      
      case ServiceErrorCode.ALREADY_EXISTS:
      case ServiceErrorCode.CONFLICT:
        return 409;
      
      case ServiceErrorCode.OPERATION_NOT_ALLOWED:
        return 405;
      
      case ServiceErrorCode.RATE_LIMIT_EXCEEDED:
        return 429;
      
      case ServiceErrorCode.DATABASE_ERROR:
      case ServiceErrorCode.EXTERNAL_SERVICE_ERROR:
      case ServiceErrorCode.TIMEOUT:
      case ServiceErrorCode.INTERNAL_ERROR:
        return 500;
      
      case ServiceErrorCode.UNKNOWN_ERROR:
      default:
        return 500;
    }
  }

  /**
   * إنشاء خطأ مصادقة
   */
  static unauthorized(message: string = 'المستخدم غير مصادق عليه', details?: any): ServiceError {
    return new ServiceError(message, ServiceErrorCode.UNAUTHORIZED, 401, details);
  }

  /**
   * إنشاء خطأ صلاحيات
   */
  static forbidden(message: string = 'ليس لديك صلاحية للوصول لهذا المورد', details?: any): ServiceError {
    return new ServiceError(message, ServiceErrorCode.FORBIDDEN, 403, details);
  }

  /**
   * إنشاء خطأ عدم وجود المورد
   */
  static notFound(message: string = 'المورد المطلوب غير موجود', details?: any): ServiceError {
    return new ServiceError(message, ServiceErrorCode.NOT_FOUND, 404, details);
  }

  /**
   * إنشاء خطأ تحقق من البيانات
   */
  static validation(message: string, details?: any): ServiceError {
    return new ServiceError(message, ServiceErrorCode.VALIDATION_ERROR, 400, details);
  }

  /**
   * إنشاء خطأ حقول مطلوبة
   */
  static missingFields(fields: string[], details?: any): ServiceError {
    const message = `الحقول المطلوبة: ${fields.join(', ')}`;
    return new ServiceError(message, ServiceErrorCode.MISSING_REQUIRED_FIELDS, 400, details);
  }

  /**
   * إنشاء خطأ صراع
   */
  static conflict(message: string, details?: any): ServiceError {
    return new ServiceError(message, ServiceErrorCode.CONFLICT, 409, details);
  }

  /**
   * إنشاء خطأ داخلي
   */
  static internal(message: string = 'خطأ داخلي في الخادم', details?: any): ServiceError {
    return new ServiceError(message, ServiceErrorCode.INTERNAL_ERROR, 500, details);
  }

  /**
   * إنشاء خطأ قاعدة بيانات
   */
  static database(message: string, details?: any): ServiceError {
    return new ServiceError(message, ServiceErrorCode.DATABASE_ERROR, 500, details);
  }

  /**
   * التحقق من كون الخطأ ServiceError
   */
  static isServiceError(error: any): error is ServiceError {
    return error instanceof ServiceError;
  }

  /**
   * تحويل خطأ عادي إلى ServiceError
   */
  static fromError(error: any): ServiceError {
    if (ServiceError.isServiceError(error)) {
      return error;
    }

    if (error instanceof Error) {
      return new ServiceError(
        error.message, 
        ServiceErrorCode.INTERNAL_ERROR, 
        500, 
        { originalError: error.name }
      );
    }

    return new ServiceError(
      'خطأ غير معروف', 
      ServiceErrorCode.UNKNOWN_ERROR, 
      500, 
      { originalError: error }
    );
  }

  /**
   * تحويل لكائن JSON
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details
    };
  }
}