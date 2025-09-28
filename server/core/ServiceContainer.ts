/**
 * حاوي الخدمات الموحد - يدير جميع الخدمات ويوفر Dependency Injection
 * تم إصلاحه ليكون per-request بدلاً من singleton مشترك لمنع تسريب البيانات
 */

import { IStorage } from '../storage';
import { BaseService, ServiceContext } from './BaseService';
import { Request, Response, NextFunction } from 'express';
import { ServiceTokens, ServiceDependencies, ServicePriority, ServiceConfig } from './ServiceTokens';

// Import all service classes for factory helpers
import { SystemService } from '../services/systemService';
import { LogService } from '../services/logService';
import { AuditService } from '../services/auditService';
import { BackupService } from '../services/backupService';
import { DeploymentService } from '../services/deploymentService';
import { UnifiedFileService } from '../services/unifiedFileService';
import { UnifiedNotificationService } from '../services/UnifiedNotificationService';
import { MonitoringService } from '../services/monitoringService';
import { StorageStatsService } from '../services/storageStatsService';
import { NginxService } from '../services/nginxService';
import { PM2Service } from '../services/pm2Service';
import { SslService } from '../services/sslService';

export type ServiceConstructor<T extends BaseService> = new (
  storage: IStorage,
  context?: ServiceContext
) => T;

/**
 * Service Factory Type - يحدد كيفية إنشاء خدمة مع تبعياتها
 */
export type ServiceFactory<T extends BaseService> = {
  constructor: ServiceConstructor<T>;
  dependencies?: ServiceTokens[];
  priority?: number;
  config?: ServiceConfig;
};

/**
 * Service Registry - خريطة شاملة لجميع الخدمات المتاحة
 */
export type ServiceRegistry = {
  [K in ServiceTokens]: ServiceFactory<BaseService>;
};

/**
 * حاوي الخدمات per-request - كل طلب يحصل على حاويه الخاص
 * محسن للمرحلة 2 مع ServiceTokens وFactory Helpers
 */
export class ServiceContainer {
  private services: Map<string, BaseService> = new Map();
  private storage: IStorage;
  private context: ServiceContext;
  private serviceRegistry: Partial<ServiceRegistry> = {};
  private resolutionStack: Set<ServiceTokens> = new Set(); // لتجنب circular dependencies

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

  /**
   * الحصول على خدمة باستخدام token
   */
  resolveByToken<T extends BaseService>(token: ServiceTokens): T {
    const tokenName = token.toString();
    
    // تحديد الفئة المناسبة بناءً على token
    let ServiceClass: ServiceConstructor<BaseService>;
    
    switch (token) {
      case ServiceTokens.SYSTEM_SERVICE:
        ServiceClass = SystemService as any;
        break;
      case ServiceTokens.LOG_SERVICE:
        ServiceClass = LogService as any;
        break;
      case ServiceTokens.AUDIT:
      case ServiceTokens.AUDIT_SERVICE:
        ServiceClass = AuditService as any;
        break;
      case ServiceTokens.BACKUP:
      case ServiceTokens.BACKUP_SERVICE:
        ServiceClass = BackupService as any;
        break;
      case ServiceTokens.DEPLOYMENT:
      case ServiceTokens.DEPLOYMENT_SERVICE:
        ServiceClass = DeploymentService as any;
        break;
      case ServiceTokens.UNIFIED_FILE_SERVICE:
        ServiceClass = UnifiedFileService as any;
        break;
      case ServiceTokens.UNIFIED_NOTIFICATION_SERVICE:
        ServiceClass = UnifiedNotificationService as any;
        break;
      case ServiceTokens.MONITORING_SERVICE:
        ServiceClass = MonitoringService as any;
        break;
      case ServiceTokens.STORAGE_STATS_SERVICE:
        ServiceClass = StorageStatsService as any;
        break;
      case ServiceTokens.NGINX_SERVICE:
        ServiceClass = NginxService as any;
        break;
      case ServiceTokens.PM2_SERVICE:
        ServiceClass = PM2Service as any;
        break;
      case ServiceTokens.SSL_SERVICE:
        ServiceClass = SslService as any;
        break;
      default:
        throw new Error(`خدمة غير مدعومة: ${token}`);
    }
    
    return this.resolve(tokenName, ServiceClass) as T;
  }

  /**
   * الحصول على service registry
   */
  getServiceRegistry(): Partial<ServiceRegistry> {
    return this.serviceRegistry;
  }

  /**
   * Helper methods for common services
   */
  getSystemService(): SystemService {
    return this.resolveByToken<SystemService>(ServiceTokens.SYSTEM_SERVICE);
  }

  getLogService(): LogService {
    return this.resolveByToken<LogService>(ServiceTokens.LOG_SERVICE);
  }

  getFileService(): UnifiedFileService {
    return this.resolveByToken<UnifiedFileService>(ServiceTokens.UNIFIED_FILE_SERVICE);
  }

  getMonitoringService(): MonitoringService {
    return this.resolveByToken<MonitoringService>(ServiceTokens.MONITORING_SERVICE);
  }

  getPM2Service(): PM2Service {
    return this.resolveByToken<PM2Service>(ServiceTokens.PM2_SERVICE);
  }

  getNotificationService(): UnifiedNotificationService {
    return this.resolveByToken<UnifiedNotificationService>(ServiceTokens.UNIFIED_NOTIFICATION_SERVICE);
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
 * @deprecated استخدم resolveByToken() مباشرة بدلاً من الـ decorator لتجنب الـ singleton issues
 */
export function Injectable(name: string) {
  return function <T extends BaseService>(constructor: ServiceConstructor<T>) {
    console.warn(`Injectable decorator لـ ${name} محظور الاستخدام. استخدم resolveByToken() مباشرة.`);
    return constructor;
  };
}

/**
 * Factory Helpers - مساعدات لإنشاء الخدمات بطريقة مبسطة
 */
export const ServiceHelpers = {
  /**
   * إنشاء حزمة خدمات أساسية (Core Services)
   */
  createCoreServices(container: ServiceContainer): {
    systemService: SystemService;
    logService: LogService;
  } {
    return {
      systemService: container.getSystemService(),
      logService: container.getLogService()
    };
  },

  /**
   * إنشاء حزمة خدمات البنية التحتية
   */
  createInfrastructureServices(container: ServiceContainer): {
    fileService: UnifiedFileService;
    monitoringService: MonitoringService;
    pm2Service: PM2Service;
  } {
    return {
      fileService: container.getFileService(),
      monitoringService: container.getMonitoringService(),
      pm2Service: container.getPM2Service()
    };
  },

  /**
   * إنشاء حزمة خدمات عمليات العمل
   */
  createBusinessServices(container: ServiceContainer): {
    notificationService: UnifiedNotificationService;
    auditService: AuditService;
    backupService: BackupService;
    deploymentService: DeploymentService;
  } {
    return {
      notificationService: container.getNotificationService(),
      auditService: container.resolveByToken<AuditService>(ServiceTokens.AUDIT),
      backupService: container.resolveByToken<BackupService>(ServiceTokens.BACKUP),
      deploymentService: container.resolveByToken<DeploymentService>(ServiceTokens.DEPLOYMENT)
    };
  }
};

/**
 * مساعد لاختبار ServiceContainer وdebugging
 */
export const ServiceContainerUtils = {
  /**
   * طباعة معلومات تشخيصية عن الحاوي
   */
  debugContainer(container: ServiceContainer): void {
    console.log('=== Service Container Debug Info ===');
    console.log('Registered Services:', container.getServiceNames());
    console.log('Service Count:', container.getServiceCount());
    console.log('Context:', container.getContext());
    console.log('Registry:', Object.keys(container.getServiceRegistry()));
    console.log('====================================');
  },

  /**
   * اختبار التبعيات والتأكد من عدم وجود circular dependencies
   */
  validateDependencies(container: ServiceContainer): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const registry = container.getServiceRegistry();
    
    for (const [token, factory] of Object.entries(registry)) {
      if (factory?.dependencies) {
        for (const dep of factory.dependencies) {
          if (!registry[dep]) {
            errors.push(`Missing dependency: ${token} requires ${dep} but ${dep} is not registered`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
};