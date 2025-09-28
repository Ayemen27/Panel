/**
 * الخدمة الأساسية الموحدة - يجب أن ترث منها جميع الخدمات
 * توفر وظائف مشتركة مثل تسجيل الأحداث، التحقق من الصلاحيات، ومعالجة الأخطاء
 */

import { IStorage } from '../storage';
import { logger } from '../utils/logger';
import { User } from '@shared/schema';
import { ServiceError, ServiceErrorCode } from './ServiceError';

export interface ServiceContext {
  user?: User;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ServiceResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  metadata?: Record<string, any>;
}

export abstract class BaseService {
  protected storage: IStorage;
  protected context: ServiceContext;

  constructor(storage: IStorage, context: ServiceContext = {}) {
    this.storage = storage;
    this.context = context;
  }

  /**
   * تحديث السياق للخدمة
   */
  setContext(context: ServiceContext): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * الحصول على معرف المستخدم الحالي
   */
  protected getCurrentUserId(): string | null {
    return this.context.user?.id || null;
  }

  /**
   * التحقق من وجود المستخدم
   */
  protected requireUser(): User {
    if (!this.context.user) {
      throw ServiceError.unauthorized('المستخدم غير مصادق عليه');
    }
    return this.context.user;
  }

  /**
   * التحقق من صلاحية المستخدم
   */
  protected requireRole(role: string): User {
    const user = this.requireUser();
    if (user.role !== role && user.role !== 'admin') {
      throw ServiceError.forbidden(`الصلاحية مطلوبة: ${role}`);
    }
    return user;
  }

  /**
   * التحقق من الصلاحيات المخصصة
   */
  protected requirePermission(permission: string): User {
    const user = this.requireUser();
    if (user.role === 'admin') {
      return user; // المسؤول له جميع الصلاحيات
    }
    
    if (!user.permissions?.includes(permission)) {
      throw ServiceError.forbidden(`الصلاحية مطلوبة: ${permission}`);
    }
    return user;
  }

  /**
   * تسجيل الأحداث مع السياق
   */
  protected log(level: 'info' | 'warn' | 'error', message: string, metadata?: any): void {
    const logData = {
      service: this.constructor.name,
      userId: this.getCurrentUserId(),
      sessionId: this.context.sessionId,
      message,
      metadata
    };

    logger[level](message, 'system', { metadata: logData });
  }

  /**
   * معالجة الأخطاء بشكل موحد
   */
  protected handleError(error: any, operation: string): ServiceResult {
    // تحويل إلى ServiceError إن لم يكن كذلك
    const serviceError = ServiceError.isServiceError(error) 
      ? error 
      : ServiceError.fromError(error);
    
    this.log('error', `فشل في ${operation}`, {
      error: serviceError.message,
      code: serviceError.code,
      statusCode: serviceError.statusCode,
      stack: serviceError.stack
    });

    return {
      success: false,
      error: serviceError.message,
      code: serviceError.code
    };
  }

  /**
   * إنشاء نتيجة ناجحة
   */
  protected success<T>(data?: T, metadata?: Record<string, any>): ServiceResult<T> {
    return {
      success: true,
      data,
      metadata
    };
  }

  /**
   * إنشاء نتيجة فاشلة
   */
  protected failure(error: string, code?: string, metadata?: Record<string, any>): ServiceResult {
    return {
      success: false,
      error,
      code,
      metadata
    };
  }

  /**
   * تنفيذ عملية مع معالجة الأخطاء التلقائية
   */
  protected async execute<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<ServiceResult<T>> {
    try {
      this.log('info', `بدء ${operationName}`);
      const result = await operation();
      this.log('info', `تم إنجاز ${operationName} بنجاح`);
      return this.success(result);
    } catch (error) {
      return this.handleError(error, operationName);
    }
  }

  /**
   * التحقق من صحة البيانات
   */
  protected validateRequired(data: any, fields: string[]): void {
    for (const field of fields) {
      if (!data[field]) {
        throw new Error(`الحقل مطلوب: ${field}`);
      }
    }
  }

  /**
   * تنظيف البيانات من القيم الفارغة
   */
  protected cleanData<T extends Record<string, any>>(data: T): Partial<T> {
    const cleaned: Partial<T> = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (value !== null && value !== undefined && value !== '') {
        cleaned[key as keyof T] = value;
      }
    }
    
    return cleaned;
  }

  /**
   * إنشاء metadata للعمليات
   */
  protected createMetadata(additional?: Record<string, any>): Record<string, any> {
    return {
      timestamp: new Date().toISOString(),
      userId: this.getCurrentUserId(),
      sessionId: this.context.sessionId,
      service: this.constructor.name,
      ...additional
    };
  }
}