/**
 * حاوي الخدمات الموحد - يدير جميع الخدمات ويوفر Dependency Injection
 * تم إصلاحه ليكون per-request بدلاً من singleton مشترك لمنع تسريب البيانات
 */

import { IStorage } from '../storage';
import { BaseService, ServiceContext } from './BaseService';
import { Request, Response, NextFunction } from 'express';
import { ServiceTokens, ServiceDependencies, ServicePriority, ServiceConfig, ServiceMetadata, ServiceFactory } from './ServiceTokens';

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
 * Service Constructor Factory Type - يحدد كيفية إنشاء خدمة مع تبعياتها
 */
export type ServiceConstructorFactory<T extends BaseService> = {
  constructor: ServiceConstructor<T>;
  dependencies?: ServiceTokens[];
  priority?: number;
  config?: ServiceConfig;
};

/**
 * Service Registry Entry - المُدخل الكامل للخدمة في السجل
 */
export interface ServiceRegistryEntry {
  metadata: ServiceMetadata;
  factory: ServiceFactory;
}

/**
 * Service Registry Map - خريطة شاملة لجميع الخدمات المتاحة
 */
export type ServiceRegistryMap = {
  [K in ServiceTokens]: ServiceRegistryEntry;
};

/**
 * حاوي الخدمات per-request - كل طلب يحصل على حاويه الخاص
 * محسن للمرحلة 2 مع ServiceTokens وFactory Helpers
 */
export class ServiceContainer {
  private services: Map<string, BaseService> = new Map();
  private storage: IStorage;
  private context: ServiceContext;
  private resolutionStack: Set<ServiceTokens> = new Set(); // لتجنب circular dependencies
  
  /**
   * Canonical Service Registry - السجل الموحد لجميع الخدمات
   * يحتوي على metadata كاملة لكل service token
   */
  private static readonly CANONICAL_REGISTRY: ServiceRegistryMap = {
    [ServiceTokens.LOG_SERVICE]: {
      metadata: {
        token: ServiceTokens.LOG_SERVICE,
        constructor: LogService,
        dependencies: [],
        priority: 1,
        singleton: false,
        name: 'Log Service',
        description: 'خدمة تسجيل الأحداث وإدارة السجلات للنظام',
        category: 'core',
        version: '1.0.0',
        implemented: true
      },
      factory: {
        create: (storage: IStorage, context?: ServiceContext) => new LogService(storage, context),
        metadata: {} as ServiceMetadata // Will be filled from metadata above
      }
    },
    [ServiceTokens.AUDIT_SERVICE]: {
      metadata: {
        token: ServiceTokens.AUDIT_SERVICE,
        constructor: AuditService,
        dependencies: [],
        priority: 1,
        singleton: false,
        name: 'Audit Service',
        description: 'خدمة التدقيق والفحص الشامل للتطبيق',
        category: 'core',
        version: '1.0.0',
        implemented: true
      },
      factory: {
        create: (storage: IStorage, context?: ServiceContext) => new AuditService(storage, context),
        metadata: {} as ServiceMetadata
      }
    },
    [ServiceTokens.SYSTEM_SERVICE]: {
      metadata: {
        token: ServiceTokens.SYSTEM_SERVICE,
        constructor: SystemService,
        dependencies: [ServiceTokens.LOG_SERVICE],
        priority: 2,
        singleton: false,
        name: 'System Service',
        description: 'خدمة معلومات النظام والموارد',
        category: 'system',
        version: '1.0.0',
        implemented: true
      },
      factory: {
        create: (storage: IStorage, context?: ServiceContext) => new SystemService(storage, context),
        metadata: {} as ServiceMetadata
      }
    },
    [ServiceTokens.MONITORING_SERVICE]: {
      metadata: {
        token: ServiceTokens.MONITORING_SERVICE,
        constructor: MonitoringService,
        dependencies: [ServiceTokens.LOG_SERVICE, ServiceTokens.SYSTEM_SERVICE],
        priority: 3,
        singleton: false,
        name: 'Monitoring Service',
        description: 'خدمة مراقبة الأداء والموارد',
        category: 'system',
        version: '1.0.0',
        implemented: true
      },
      factory: {
        create: (storage: IStorage, context?: ServiceContext) => new MonitoringService(storage, context),
        metadata: {} as ServiceMetadata
      }
    },
    [ServiceTokens.NGINX_SERVICE]: {
      metadata: {
        token: ServiceTokens.NGINX_SERVICE,
        constructor: NginxService,
        dependencies: [ServiceTokens.LOG_SERVICE, ServiceTokens.SYSTEM_SERVICE],
        priority: 3,
        singleton: false,
        name: 'Nginx Service',
        description: 'خدمة إدارة Nginx وإعداد الخوادم',
        category: 'server',
        version: '1.0.0',
        implemented: true
      },
      factory: {
        create: (storage: IStorage, context?: ServiceContext) => new NginxService(storage, context),
        metadata: {} as ServiceMetadata
      }
    },
    [ServiceTokens.PM2_SERVICE]: {
      metadata: {
        token: ServiceTokens.PM2_SERVICE,
        constructor: PM2Service,
        dependencies: [ServiceTokens.LOG_SERVICE, ServiceTokens.SYSTEM_SERVICE],
        priority: 3,
        singleton: false,
        name: 'PM2 Service',
        description: 'خدمة إدارة العمليات باستخدام PM2',
        category: 'server',
        version: '1.0.0',
        implemented: true
      },
      factory: {
        create: (storage: IStorage, context?: ServiceContext) => new PM2Service(storage, context),
        metadata: {} as ServiceMetadata
      }
    },
    [ServiceTokens.SSL_SERVICE]: {
      metadata: {
        token: ServiceTokens.SSL_SERVICE,
        constructor: SslService,
        dependencies: [ServiceTokens.LOG_SERVICE, ServiceTokens.SYSTEM_SERVICE, ServiceTokens.NGINX_SERVICE],
        priority: 4,
        singleton: false,
        name: 'SSL Service',
        description: 'خدمة إدارة شهادات SSL',
        category: 'server',
        version: '1.0.0',
        implemented: true
      },
      factory: {
        create: (storage: IStorage, context?: ServiceContext) => new SslService(storage, context),
        metadata: {} as ServiceMetadata
      }
    },
    [ServiceTokens.UNIFIED_FILE_SERVICE]: {
      metadata: {
        token: ServiceTokens.UNIFIED_FILE_SERVICE,
        constructor: UnifiedFileService,
        dependencies: [ServiceTokens.LOG_SERVICE, ServiceTokens.AUDIT_SERVICE],
        priority: 2,
        singleton: false,
        name: 'Unified File Service',
        description: 'خدمة إدارة الملفات الموحدة',
        category: 'application',
        version: '1.0.0',
        implemented: true
      },
      factory: {
        create: (storage: IStorage, context?: ServiceContext) => new UnifiedFileService(storage, context),
        metadata: {} as ServiceMetadata
      }
    },
    [ServiceTokens.UNIFIED_NOTIFICATION_SERVICE]: {
      metadata: {
        token: ServiceTokens.UNIFIED_NOTIFICATION_SERVICE,
        constructor: UnifiedNotificationService,
        dependencies: [ServiceTokens.LOG_SERVICE, ServiceTokens.UNIFIED_FILE_SERVICE],
        priority: 3,
        singleton: false,
        name: 'Unified Notification Service',
        description: 'خدمة الإشعارات الموحدة',
        category: 'application',
        version: '1.0.0',
        implemented: true
      },
      factory: {
        create: (storage: IStorage, context?: ServiceContext) => new UnifiedNotificationService(storage, context),
        metadata: {} as ServiceMetadata
      }
    },
    [ServiceTokens.BACKUP_SERVICE]: {
      metadata: {
        token: ServiceTokens.BACKUP_SERVICE,
        constructor: BackupService,
        dependencies: [ServiceTokens.LOG_SERVICE, ServiceTokens.UNIFIED_FILE_SERVICE, ServiceTokens.SYSTEM_SERVICE],
        priority: 4,
        singleton: false,
        name: 'Backup Service',
        description: 'خدمة النسخ الاحتياطي',
        category: 'application',
        version: '1.0.0',
        implemented: true
      },
      factory: {
        create: (storage: IStorage, context?: ServiceContext) => new BackupService(storage, context),
        metadata: {} as ServiceMetadata
      }
    },
    [ServiceTokens.DEPLOYMENT_SERVICE]: {
      metadata: {
        token: ServiceTokens.DEPLOYMENT_SERVICE,
        constructor: DeploymentService,
        dependencies: [ServiceTokens.LOG_SERVICE, ServiceTokens.PM2_SERVICE, ServiceTokens.NGINX_SERVICE],
        priority: 4,
        singleton: false,
        name: 'Deployment Service',
        description: 'خدمة النشر وإعداد البيئة',
        category: 'application',
        version: '1.0.0',
        implemented: true
      },
      factory: {
        create: (storage: IStorage, context?: ServiceContext) => new DeploymentService(storage, context),
        metadata: {} as ServiceMetadata
      }
    },
    [ServiceTokens.STORAGE_STATS_SERVICE]: {
      metadata: {
        token: ServiceTokens.STORAGE_STATS_SERVICE,
        constructor: StorageStatsService,
        dependencies: [ServiceTokens.LOG_SERVICE, ServiceTokens.SYSTEM_SERVICE],
        priority: 3,
        singleton: false,
        name: 'Storage Stats Service',
        description: 'خدمة إحصائيات التخزين',
        category: 'system',
        version: '1.0.0',
        implemented: true
      },
      factory: {
        create: (storage: IStorage, context?: ServiceContext) => new StorageStatsService(storage, context),
        metadata: {} as ServiceMetadata
      }
    },
    [ServiceTokens.SMART_CONNECTION_MANAGER]: {
      metadata: {
        token: ServiceTokens.SMART_CONNECTION_MANAGER,
        constructor: () => { throw new Error('SmartConnectionManager is singleton - use imported instance'); },
        dependencies: [],
        priority: 1,
        singleton: true,
        name: 'Smart Connection Manager',
        description: 'مدير الاتصالات الذكي لقاعدة البيانات',
        category: 'connection',
        version: '1.0.0',
        implemented: true
      },
      factory: {
        create: () => { throw new Error('SmartConnectionManager is singleton - use imported instance'); },
        metadata: {} as ServiceMetadata
      }
    },
    // External Services (not yet implemented)
    [ServiceTokens.EMAIL_SERVICE]: {
      metadata: {
        token: ServiceTokens.EMAIL_SERVICE,
        constructor: () => { throw new Error('EmailService not yet implemented'); },
        dependencies: [ServiceTokens.LOG_SERVICE],
        priority: 2,
        singleton: false,
        name: 'Email Service',
        description: 'خدمة البريد الإلكتروني',
        category: 'external',
        version: '0.0.0',
        implemented: false
      },
      factory: {
        create: () => { throw new Error('EmailService not yet implemented'); },
        metadata: {} as ServiceMetadata
      }
    },
    [ServiceTokens.AUTH_SERVICE]: {
      metadata: {
        token: ServiceTokens.AUTH_SERVICE,
        constructor: () => { throw new Error('AuthService not yet implemented'); },
        dependencies: [ServiceTokens.LOG_SERVICE],
        priority: 2,
        singleton: false,
        name: 'Auth Service',
        description: 'خدمة المصادقة والترخيص',
        category: 'external',
        version: '0.0.0',
        implemented: false
      },
      factory: {
        create: () => { throw new Error('AuthService not yet implemented'); },
        metadata: {} as ServiceMetadata
      }
    }
  };

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
    
    // الحصول على معلومات الخدمة من السجل الموحد
    const registryEntry = ServiceContainer.CANONICAL_REGISTRY[token];
    if (!registryEntry) {
      throw new Error(`خدمة غير موجودة في السجل: ${token}`);
    }
    
    const metadata = registryEntry.metadata;
    if (!metadata.implemented) {
      throw new Error(`خدمة غير مُطبقة: ${token} - ${metadata.description}`);
    }
    
    // التحقق من وجود الخدمة في الحاوي
    if (this.has(tokenName)) {
      return this.get<T>(tokenName);
    }
    
    // التحقق من التبعيات أولاً
    if (metadata.dependencies.length > 0) {
      this.resolveDependencies(metadata.dependencies);
    }
    
    // إنشاء الخدمة باستخدام factory
    try {
      const service = registryEntry.factory.create(this.storage, this.context);
      
      // تسجيل الخدمة في الحاوي
      this.services.set(tokenName, service);
      
      return service as T;
    } catch (error) {
      throw new Error(`فشل في إنشاء خدمة ${token}: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
    }
  }
  
  /**
   * حل التبعيات للخدمة
   */
  private resolveDependencies(dependencies: ServiceTokens[]): void {
    for (const dep of dependencies) {
      if (this.resolutionStack.has(dep)) {
        throw new Error(`اكتشاف تبعية دائرية: ${Array.from(this.resolutionStack).join(' -> ')} -> ${dep}`);
      }
      
      this.resolutionStack.add(dep);
      
      try {
        if (!this.has(dep.toString())) {
          this.resolveByToken(dep);
        }
      } finally {
        this.resolutionStack.delete(dep);
      }
    }
  }

  /**
   * الحصول على service registry الكامل
   */
  static getCanonicalRegistry(): ServiceRegistryMap {
    // Initialize factory metadata references
    Object.values(ServiceContainer.CANONICAL_REGISTRY).forEach(entry => {
      entry.factory.metadata = entry.metadata;
    });
    return ServiceContainer.CANONICAL_REGISTRY;
  }
  
  /**
   * الحصول على معلومات خدمة معينة
   */
  static getServiceMetadata(token: ServiceTokens): ServiceMetadata | null {
    const entry = ServiceContainer.CANONICAL_REGISTRY[token];
    return entry ? entry.metadata : null;
  }
  
  /**
   * التحقق من تطبيق خدمة معينة
   */
  static isServiceImplemented(token: ServiceTokens): boolean {
    const metadata = ServiceContainer.getServiceMetadata(token);
    return metadata ? metadata.implemented : false;
  }
  
  /**
   * الحصول على جميع الخدمات المطبقة
   */
  static getImplementedServices(): ServiceTokens[] {
    return Object.values(ServiceTokens).filter(token => 
      ServiceContainer.isServiceImplemented(token)
    );
  }
  
  /**
   * الحصول على جميع الخدمات غير المطبقة
   */
  static getUnimplementedServices(): ServiceTokens[] {
    return Object.values(ServiceTokens).filter(token => 
      !ServiceContainer.isServiceImplemented(token)
    );
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
      auditService: container.resolveByToken<AuditService>(ServiceTokens.AUDIT_SERVICE),
      backupService: container.resolveByToken<BackupService>(ServiceTokens.BACKUP_SERVICE),
      deploymentService: container.resolveByToken<DeploymentService>(ServiceTokens.DEPLOYMENT_SERVICE)
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
    const registry = ServiceContainer.getCanonicalRegistry();
    
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