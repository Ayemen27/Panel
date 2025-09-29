/**
 * المتحكم الأساسي الموحد - يجب أن ترث منه جميع المتحكمات
 * يوفر وظائف مشتركة مثل معالجة الطلبات، التحقق من الصلاحيات، ومعالجة الردود
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { ServiceContainer } from '../core/ServiceContainer';
import { ServiceTokens } from '../core/ServiceTokens';
import { BaseService, ServiceContext, ServiceResult } from '../core/BaseService';
import { ServiceError } from '../core/ServiceError';
import { IStorage } from '../storage';
import { User } from '@shared/schema';
import { ZodSchema } from 'zod';

// Controller response interface
export interface ControllerResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: string;
  pagination?: PaginationInfo;
  metadata?: Record<string, any>;
}

// Pagination interface
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Request pagination parameters
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Filter parameters
export interface FilterParams {
  search?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  type?: string;
  [key: string]: any;
}

export abstract class BaseController {
  protected storage: IStorage;
  protected services: ServiceContainer;

  constructor(storage: IStorage, services: ServiceContainer) {
    this.storage = storage;
    this.services = services;
  }

  /**
   * الحصول على سياق المستخدم من الطلب
   */
  protected getContext(req: AuthenticatedRequest): ServiceContext {
    return {
      user: req.user,
      sessionId: req.sessionID,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    };
  }

  /**
   * الحصول على معرف المستخدم الحالي
   */
  protected getCurrentUserId(req: AuthenticatedRequest): string | null {
    return req.user?.id || null;
  }

  /**
   * التحقق من وجود المستخدم
   */
  protected requireUser(req: AuthenticatedRequest): User {
    if (!req.user) {
      throw ServiceError.unauthorized('المستخدم غير مصادق عليه');
    }
    return req.user;
  }

  /**
   * التحقق من صلاحية المستخدم
   */
  protected requireRole(req: AuthenticatedRequest, role: string): User {
    const user = this.requireUser(req);
    if (user.role !== role && user.role !== 'admin') {
      throw ServiceError.forbidden(`الصلاحية مطلوبة: ${role}`);
    }
    return user;
  }

  /**
   * التحقق من الصلاحيات المخصصة
   */
  protected requirePermission(req: AuthenticatedRequest, permission: string): User {
    const user = this.requireUser(req);
    if (user.role === 'admin') {
      return user; // المسؤول له جميع الصلاحيات
    }
    
    if (!user.permissions?.includes(permission)) {
      throw ServiceError.forbidden(`الصلاحية مطلوبة: ${permission}`);
    }
    return user;
  }

  /**
   * إرسال رد ناجح
   */
  protected sendSuccess<T>(
    res: Response, 
    data?: T, 
    message?: string, 
    pagination?: PaginationInfo,
    metadata?: Record<string, any>
  ): void {
    const response: ControllerResponse<T> = {
      success: true,
      data,
      message,
      pagination,
      metadata
    };

    res.json(response);
  }

  /**
   * إرسال رد بالبيانات فقط (للتوافق مع APIs الحالية)
   */
  protected sendData<T>(res: Response, data: T): void {
    res.json(data);
  }

  /**
   * إرسال رد بالخطأ
   */
  protected sendError(
    res: Response, 
    error: string, 
    statusCode: number = 500, 
    code?: string,
    details?: any
  ): void {
    const response: ControllerResponse = {
      success: false,
      error,
      code,
      metadata: details
    };

    res.status(statusCode).json(response);
  }

  /**
   * معالجة نتيجة الخدمة وإرسال الرد المناسب
   */
  protected handleServiceResult<T>(
    res: Response,
    result: ServiceResult<T>,
    successMessage?: string,
    successStatusCode: number = 200
  ): void {
    if (result.success) {
      res.status(successStatusCode).json({
        success: true,
        data: result.data,
        message: successMessage,
        metadata: result.metadata
      });
    } else {
      // تحديد رمز الحالة بناءً على نوع الخطأ
      let statusCode = 500;
      if (result.code === 'UNAUTHORIZED') statusCode = 401;
      else if (result.code === 'FORBIDDEN') statusCode = 403;
      else if (result.code === 'NOT_FOUND') statusCode = 404;
      else if (result.code === 'VALIDATION_ERROR') statusCode = 400;
      else if (result.code === 'CONFLICT') statusCode = 409;

      res.status(statusCode).json({
        success: false,
        error: result.error,
        code: result.code,
        metadata: result.metadata
      });
    }
  }

  /**
   * استخراج معاملات التصفح من الطلب
   */
  protected getPaginationParams(req: AuthenticatedRequest): PaginationParams {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100); // حد أقصى 100
    const sortBy = req.query.sortBy as string;
    const sortOrder = (req.query.sortOrder as string)?.toLowerCase() === 'desc' ? 'desc' : 'asc';

    return { page, limit, sortBy, sortOrder };
  }

  /**
   * استخراج معاملات التصفية من الطلب
   */
  protected getFilterParams(req: AuthenticatedRequest): FilterParams {
    const { page, limit, sortBy, sortOrder, ...filters } = req.query;
    
    // تنظيف القيم الفارغة
    const cleanFilters: FilterParams = {};
    for (const [key, value] of Object.entries(filters)) {
      if (value && value !== '') {
        cleanFilters[key] = value as string;
      }
    }

    return cleanFilters;
  }

  /**
   * إنشاء معلومات التصفح
   */
  protected createPagination(
    page: number,
    limit: number,
    total: number
  ): PaginationInfo {
    const totalPages = Math.ceil(total / limit);
    
    return {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    };
  }

  /**
   * التحقق من صحة البيانات باستخدام Zod
   */
  protected async validateData<T>(
    schema: ZodSchema<T>,
    data: any
  ): Promise<T> {
    try {
      return await schema.parseAsync(data);
    } catch (error) {
      throw ServiceError.validation('بيانات غير صحيحة', error);
    }
  }

  /**
   * معالجة الأخطاء بشكل موحد
   */
  protected handleError = (
    error: any,
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    console.error('Controller Error:', error);

    if (error instanceof ServiceError) {
      this.sendError(res, error.message, error.statusCode, error.code, error.details);
    } else if (error.name === 'ZodError') {
      this.sendError(res, 'بيانات غير صحيحة', 400, 'VALIDATION_ERROR', error.errors);
    } else {
      this.sendError(res, 'خطأ داخلي في الخادم', 500, 'INTERNAL_ERROR');
    }
  };

  /**
   * تنفيذ عملية مع معالجة الأخطاء التلقائية
   */
  protected asyncHandler = (
    fn: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>
  ) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch((error) => 
        this.handleError(error, req, res, next)
      );
    };
  };

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
  protected createMetadata(
    req: AuthenticatedRequest,
    additional?: Record<string, any>
  ): Record<string, any> {
    return {
      timestamp: new Date().toISOString(),
      userId: this.getCurrentUserId(req),
      sessionId: req.sessionID,
      controller: this.constructor.name,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      ...additional
    };
  }

  /**
   * تسجيل العمليات المهمة
   */
  protected logOperation(
    req: AuthenticatedRequest,
    operation: string,
    result: 'success' | 'error',
    details?: any
  ): void {
    const logData = {
      operation,
      result,
      controller: this.constructor.name,
      userId: this.getCurrentUserId(req),
      sessionId: req.sessionID,
      method: req.method,
      path: req.path,
      ip: req.ip,
      timestamp: new Date().toISOString(),
      details
    };

    if (result === 'success') {
      console.log('✅ Controller Operation Success:', logData);
    } else {
      console.error('❌ Controller Operation Error:', logData);
    }
  }

  /**
   * تحديد خدمة معينة من الحاوي
   */
  protected resolveService<T extends BaseService>(token: ServiceTokens): T {
    return this.services.resolveByToken<T>(token);
  }

  /**
   * تحديث سياق خدمة معينة
   */
  protected updateServiceContext<T extends { setContext: (context: ServiceContext) => void }>(
    service: T,
    req: AuthenticatedRequest
  ): T {
    service.setContext(this.getContext(req));
    return service;
  }
}