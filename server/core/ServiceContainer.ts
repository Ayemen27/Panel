/**
 * حاوي الخدمات الموحد - يدير جميع الخدمات ويوفر Dependency Injection
 * تم إصلاحه ليكون per-request بدلاً من singleton مشترك لمنع تسريب البيانات
 */

import { IStorage } from '../storage';
import { BaseService, ServiceContext } from './BaseService';
import { Request, Response, NextFunction } from 'express';

export type ServiceConstructor<T extends BaseService> = new (
  storage: IStorage,
  context?: ServiceContext
) => T;

/**
 * حاوي الخدمات per-request - كل طلب يحصل على حاويه الخاص
 */
export class ServiceContainer {
  private services: Map<string, BaseService> = new Map();
  private storage: IStorage;
  private context: ServiceContext;

  constructor(storage: IStorage, context: ServiceContext = {}) {
    this.storage = storage;
    this.context = context;
  }

  /**
   * إنشاء حاوي جديد per-request
   */
  static createNew(storage: IStorage, context: ServiceContext = {}): ServiceContainer {
    return new ServiceContainer(storage, context);
  }

  /**
   * تحديث السياق للحاوي
   */
  updateContext(newContext: ServiceContext): void {
    this.context = { ...this.context, ...newContext };
    
    // تحديث السياق في جميع الخدمات المُنشأة
    for (const service of this.services.values()) {
      service.setContext(this.context);
    }
  }

  /**
   * تسجيل خدمة جديدة
   */
  register<T extends BaseService>(
    name: string,
    ServiceClass: ServiceConstructor<T>,
    additionalContext?: ServiceContext
  ): T {
    const serviceContext = { ...this.context, ...additionalContext };
    const service = new ServiceClass(this.storage, serviceContext);
    this.services.set(name, service);
    return service;
  }

  /**
   * الحصول على خدمة مسجلة
   */
  get<T extends BaseService>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`الخدمة غير مسجلة: ${name}`);
    }
    return service as T;
  }

  /**
   * الحصول على خدمة مع إنشائها تلقائياً إذا لم تكن موجودة
   */
  resolve<T extends BaseService>(
    name: string,
    ServiceClass: ServiceConstructor<T>,
    additionalContext?: ServiceContext
  ): T {
    if (this.services.has(name)) {
      const existingService = this.get<T>(name);
      // تحديث السياق إذا تم تمرير سياق إضافي
      if (additionalContext) {
        const updatedContext = { ...this.context, ...additionalContext };
        existingService.setContext(updatedContext);
      }
      return existingService;
    }
    return this.register(name, ServiceClass, additionalContext);
  }

  /**
   * التحقق من وجود خدمة
   */
  has(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * إزالة خدمة من الحاوي
   */
  remove(name: string): boolean {
    return this.services.delete(name);
  }

  /**
   * مسح جميع الخدمات
   */
  clear(): void {
    this.services.clear();
  }

  /**
   * الحصول على أسماء جميع الخدمات المسجلة
   */
  getServiceNames(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * الحصول على عدد الخدمات المسجلة
   */
  getServiceCount(): number {
    return this.services.size;
  }

  /**
   * الحصول على السياق الحالي
   */
  getContext(): ServiceContext {
    return { ...this.context };
  }

  /**
   * الحصول على Storage
   */
  getStorage(): IStorage {
    return this.storage;
  }
}

/**
 * توسيع Request interface لإضافة services
 */
declare global {
  namespace Express {
    interface Request {
      services: ServiceContainer;
    }
  }
}

/**
 * Middleware لحقن الخدمات في كل طلب
 * ينشئ حاوي خدمات جديد لكل طلب لمنع تسريب البيانات
 */
export function serviceInjectionMiddleware(storage: IStorage) {
  return (req: Request, res: Response, next: NextFunction) => {
    // استخراج السياق من الطلب
    const context: ServiceContext = {
      user: req.user || undefined,
      sessionId: req.sessionID || undefined,
      ipAddress: req.ip || req.connection.remoteAddress || undefined,
      userAgent: req.get('User-Agent') || undefined
    };

    // إنشاء حاوي خدمات جديد per-request
    req.services = ServiceContainer.createNew(storage, context);

    next();
  };
}

/**
 * Decorator للتسجيل التلقائي للخدمات (محظور الاستخدام الآن)
 * @deprecated استخدم resolve() مباشرة بدلاً من الـ decorator لتجنب الـ singleton issues
 */
export function Injectable(name: string) {
  return function <T extends BaseService>(constructor: ServiceConstructor<T>) {
    console.warn(`Injectable decorator لـ ${name} محظور الاستخدام. استخدم resolve() مباشرة.`);
    return constructor;
  };
}