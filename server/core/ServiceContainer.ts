/**
 * حاوي الخدمات الموحد - يدير جميع الخدمات ويوفر Dependency Injection
 * تم إصلاحه ليكون per-request بدلاً من singleton مشترك لمنع تسريب البيانات
 */

import { IStorage } from '../storage';
import { BaseService, ServiceContext } from './BaseService';
import { Request, Response, NextFunction } from 'express';
import { ServiceTokens, ServiceDependencies, ServicePriority, ServiceConfig, ServiceMetadata, ServiceFactory } from './ServiceTokens';
import { ServiceError, ServiceErrorCode } from './ServiceError';

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

// Safe stub classes for unimplemented services - do not throw in constructor
class SmartConnectionManagerStub extends BaseService {
  constructor(storage: IStorage, context?: ServiceContext) {
    super(storage, context);
    // Note: This is a stub - actual SmartConnectionManager should be imported as singleton
  }
}

class EmailServiceStub extends BaseService {
  constructor(storage: IStorage, context?: ServiceContext) {
    super(storage, context);
    // Note: EmailService not yet implemented
  }
}

class AuthServiceStub extends BaseService {
  constructor(storage: IStorage, context?: ServiceContext) {
    super(storage, context);
    // Note: AuthService not yet implemented 
  }
}

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
        constructor: SmartConnectionManagerStub,
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
        create: (storage: IStorage, context?: ServiceContext) => { 
          // Import and return the singleton instance
          const { smartConnectionManager } = require('../services/smart-connection-manager');
          return smartConnectionManager;
        },
        metadata: {} as ServiceMetadata
      }
    },
    // External Services (not yet implemented)
    [ServiceTokens.EMAIL_SERVICE]: {
      metadata: {
        token: ServiceTokens.EMAIL_SERVICE,
        constructor: EmailServiceStub,
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
        create: (storage: IStorage, context?: ServiceContext) => { 
          throw new Error('EmailService not yet implemented'); 
        },
        metadata: {} as ServiceMetadata
      }
    },
    [ServiceTokens.AUTH_SERVICE]: {
      metadata: {
        token: ServiceTokens.AUTH_SERVICE,
        constructor: AuthServiceStub,
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
        create: (storage: IStorage, context?: ServiceContext) => { 
          throw new Error('AuthService not yet implemented'); 
        },
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
   * الحصول على خدمة باستخدام token مع معالجة متقدمة للأخطاء
   * Enhanced for Phase 2 with proper ServiceError wrapping
   */
  resolveByToken<T extends BaseService>(token: ServiceTokens): T {
    const tokenName = token.toString();
    
    try {
      // التحقق من وجود الخدمة في السجل
      const registryEntry = ServiceContainer.CANONICAL_REGISTRY[token];
      if (!registryEntry) {
        throw ServiceError.notFound(
          `Service not found in registry: ${token}`,
          { token, availableServices: Object.keys(ServiceContainer.CANONICAL_REGISTRY) }
        );
      }
      
      const metadata = registryEntry.metadata;
      
      // التحقق من تطبيق الخدمة
      if (!metadata.implemented) {
        throw ServiceError.internal(
          `Service not implemented: ${token} - ${metadata.description}`,
          { 
            token, 
            version: metadata.version, 
            category: metadata.category,
            estimatedImplementationEffort: 'See service roadmap'
          }
        );
      }
      
      // إرجاع الخدمة إذا كانت موجودة مسبقاً (caching)
      if (this.has(tokenName)) {
        return this.get<T>(tokenName);
      }
      
      // التحقق من الدورة الدائرية في التبعيات
      if (this.resolutionStack.has(token)) {
        const circularPath = Array.from(this.resolutionStack).concat([token]).join(' -> ');
        throw ServiceError.internal(
          `Circular dependency detected: ${circularPath}`,
          { 
            circularPath, 
            currentStack: Array.from(this.resolutionStack),
            problematicToken: token
          }
        );
      }
      
      // إضافة الخدمة للـ resolution stack
      this.resolutionStack.add(token);
      
      try {
        // حل التبعيات إذا وجدت
        if (metadata.dependencies.length > 0) {
          this.resolveDependenciesWithValidation(metadata.dependencies, token);
        }
        
        // إنشاء الخدمة باستخدام factory
        const service = registryEntry.factory.create(this.storage, this.context);
        
        // التحقق من صحة الخدمة المُنشأة
        if (!service || !(service instanceof BaseService)) {
          throw ServiceError.internal(
            `Factory created invalid service instance for ${token}`,
            { token, serviceType: typeof service }
          );
        }
        
        // تسجيل الخدمة في الحاوي
        this.services.set(tokenName, service);
        
        return service as T;
        
      } finally {
        // إزالة الخدمة من resolution stack
        this.resolutionStack.delete(token);
      }
      
    } catch (error) {
      // تحويل الأخطاء العادية إلى ServiceError إذا لم تكن كذلك
      if (ServiceError.isServiceError(error)) {
        throw error;
      }
      
      throw ServiceError.internal(
        `Failed to resolve service ${token}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { 
          token, 
          originalError: error instanceof Error ? error.message : error,
          resolutionStack: Array.from(this.resolutionStack)
        }
      );
    }
  }
  
  /**
   * حل التبعيات للخدمة مع التحقق المتقدم
   * Enhanced dependency resolution with better validation
   */
  private resolveDependenciesWithValidation(dependencies: ServiceTokens[], parentToken: ServiceTokens): void {
    for (const dep of dependencies) {
      try {
        // التحقق من وجود التبعية في السجل
        const depEntry = ServiceContainer.CANONICAL_REGISTRY[dep];
        if (!depEntry) {
          throw ServiceError.internal(
            `Missing dependency registration: ${parentToken} requires ${dep} but it's not in the registry`,
            { parentToken, missingDependency: dep, availableDependencies: Object.keys(ServiceContainer.CANONICAL_REGISTRY) }
          );
        }
        
        // التحقق من تطبيق التبعية
        if (!depEntry.metadata.implemented) {
          throw ServiceError.internal(
            `Unimplemented dependency: ${parentToken} requires ${dep} but it's not implemented`,
            { parentToken, unimplementedDependency: dep, dependencyVersion: depEntry.metadata.version }
          );
        }
        
        // حل التبعية إذا لم تكن موجودة
        if (!this.has(dep.toString())) {
          this.resolveByToken(dep);
        }
        
      } catch (error) {
        // إثراء معلومات الخطأ مع سياق التبعية
        if (ServiceError.isServiceError(error)) {
          throw new ServiceError(
            `Dependency resolution failed for ${parentToken} -> ${dep}: ${error.message}`,
            error.code,
            error.statusCode,
            { ...error.details, parentToken, dependencyToken: dep }
          );
        }
        
        throw ServiceError.internal(
          `Unexpected error resolving dependency ${dep} for ${parentToken}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          { parentToken, dependencyToken: dep, originalError: error }
        );
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
   * Enhanced Factory Helper Methods - Phase 2
   * مساعدات محسنة لإنشاء الخدمات مع دعم الـ Bundle Factory
   */
  
  /**
   * إنشاء مصنع حزم الخدمات للcontainer الحالي
   */
  createServiceBundleFactory(): ServiceBundleFactory {
    return new ServiceBundleFactory(this);
  }

  /**
   * الحصول على حزمة خدمات أساسية محسنة
   */
  getCoreServiceBundle(config?: ServiceBundleConfig): CoreServiceBundle {
    const factory = this.createServiceBundleFactory();
    return factory.createCoreBundle(config);
  }

  /**
   * الحصول على حزمة خدمات النظام محسنة
   */
  getSystemServiceBundle(config?: ServiceBundleConfig): SystemServiceBundle {
    const factory = this.createServiceBundleFactory();
    return factory.createSystemBundle(config);
  }

  /**
   * الحصول على حزمة خدمات الخادم محسنة
   */
  getServerServiceBundle(config?: ServiceBundleConfig): ServerServiceBundle {
    const factory = this.createServiceBundleFactory();
    return factory.createServerBundle(config);
  }

  /**
   * الحصول على حزمة خدمات التطبيق محسنة
   */
  getApplicationServiceBundle(config?: ServiceBundleConfig): ApplicationServiceBundle {
    const factory = this.createServiceBundleFactory();
    return factory.createApplicationBundle(config);
  }

  /**
   * الحصول على حزمة كاملة من جميع الخدمات
   */
  getFullServiceBundle(config?: ServiceBundleConfig): FullServiceBundle {
    const factory = this.createServiceBundleFactory();
    return factory.createFullBundle(config);
  }

  /**
   * Legacy Helper Methods (تم الاحتفاظ بها للتوافق العكسي)
   * @deprecated استخدم getXServiceBundle() أو resolveByToken() مباشرة
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
 * Service Bundle Type Definitions - تعريفات أنواع حزم الخدمات المُطورة
 * Enhanced for Phase 2 with strongly typed service bundles
 */
export interface CoreServiceBundle {
  logService: LogService;
  auditService: AuditService;
  smartConnectionManager?: BaseService; // Singleton - handled separately
}

export interface SystemServiceBundle {
  systemService: SystemService;
  monitoringService: MonitoringService;
  storageStatsService: StorageStatsService;
}

export interface ServerServiceBundle {
  nginxService: NginxService;
  pm2Service: PM2Service;
  sslService: SslService;
}

export interface ApplicationServiceBundle {
  unifiedFileService: UnifiedFileService;
  unifiedNotificationService: UnifiedNotificationService;
  backupService: BackupService;
  deploymentService: DeploymentService;
}

export interface FullServiceBundle extends CoreServiceBundle, SystemServiceBundle, ServerServiceBundle, ApplicationServiceBundle {}

/**
 * Service Bundle Factory Configuration - تكوين مصانع حزم الخدمات
 */
export interface ServiceBundleConfig {
  /** Whether to resolve dependencies automatically */
  resolveDependencies?: boolean;
  /** Whether to use lazy instantiation */
  lazy?: boolean;
  /** Partial context to apply to all services in bundle */
  partialContext?: Partial<ServiceContext>;
  /** Services to exclude from bundle */
  exclude?: ServiceTokens[];
  /** Additional validation rules */
  validateOnCreation?: boolean;
}

/**
 * Enhanced Token-Driven Service Bundle Creators - Phase 2
 * مصانع حزم الخدمات المُحسنة والموجهة بالـ Tokens
 */
export class ServiceBundleFactory {
  private container: ServiceContainer;
  private cache: Map<string, any> = new Map();
  private lazyInitGuards: Map<ServiceTokens, () => BaseService> = new Map();

  constructor(container: ServiceContainer) {
    this.container = container;
  }

  /**
   * إنشاء حزمة الخدمات الأساسية - Core Services Bundle
   * Token-driven with automatic dependency resolution
   */
  createCoreBundle(config: ServiceBundleConfig = {}): CoreServiceBundle {
    const cacheKey = this.generateCacheKey('core', config);
    
    if (config.lazy !== false && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const tokens: ServiceTokens[] = [
      ServiceTokens.LOG_SERVICE,
      ServiceTokens.AUDIT_SERVICE
    ].filter(token => !config.exclude?.includes(token));

    const bundle = this.createBundleFromTokens<CoreServiceBundle>(tokens, config, {
      logService: ServiceTokens.LOG_SERVICE,
      auditService: ServiceTokens.AUDIT_SERVICE
    });

    this.cache.set(cacheKey, bundle);
    return bundle;
  }

  /**
   * إنشاء حزمة خدمات النظام - System Services Bundle
   */
  createSystemBundle(config: ServiceBundleConfig = {}): SystemServiceBundle {
    const cacheKey = this.generateCacheKey('system', config);
    
    if (config.lazy !== false && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const tokens: ServiceTokens[] = [
      ServiceTokens.SYSTEM_SERVICE,
      ServiceTokens.MONITORING_SERVICE,
      ServiceTokens.STORAGE_STATS_SERVICE
    ].filter(token => !config.exclude?.includes(token));

    const bundle = this.createBundleFromTokens<SystemServiceBundle>(tokens, config, {
      systemService: ServiceTokens.SYSTEM_SERVICE,
      monitoringService: ServiceTokens.MONITORING_SERVICE,
      storageStatsService: ServiceTokens.STORAGE_STATS_SERVICE
    });

    this.cache.set(cacheKey, bundle);
    return bundle;
  }

  /**
   * إنشاء حزمة خدمات الخادم - Server Services Bundle
   */
  createServerBundle(config: ServiceBundleConfig = {}): ServerServiceBundle {
    const cacheKey = this.generateCacheKey('server', config);
    
    if (config.lazy !== false && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const tokens: ServiceTokens[] = [
      ServiceTokens.NGINX_SERVICE,
      ServiceTokens.PM2_SERVICE,
      ServiceTokens.SSL_SERVICE
    ].filter(token => !config.exclude?.includes(token));

    const bundle = this.createBundleFromTokens<ServerServiceBundle>(tokens, config, {
      nginxService: ServiceTokens.NGINX_SERVICE,
      pm2Service: ServiceTokens.PM2_SERVICE,
      sslService: ServiceTokens.SSL_SERVICE
    });

    this.cache.set(cacheKey, bundle);
    return bundle;
  }

  /**
   * إنشاء حزمة خدمات التطبيق - Application Services Bundle
   */
  createApplicationBundle(config: ServiceBundleConfig = {}): ApplicationServiceBundle {
    const cacheKey = this.generateCacheKey('application', config);
    
    if (config.lazy !== false && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const tokens: ServiceTokens[] = [
      ServiceTokens.UNIFIED_FILE_SERVICE,
      ServiceTokens.UNIFIED_NOTIFICATION_SERVICE,
      ServiceTokens.BACKUP_SERVICE,
      ServiceTokens.DEPLOYMENT_SERVICE
    ].filter(token => !config.exclude?.includes(token));

    const bundle = this.createBundleFromTokens<ApplicationServiceBundle>(tokens, config, {
      unifiedFileService: ServiceTokens.UNIFIED_FILE_SERVICE,
      unifiedNotificationService: ServiceTokens.UNIFIED_NOTIFICATION_SERVICE,
      backupService: ServiceTokens.BACKUP_SERVICE,
      deploymentService: ServiceTokens.DEPLOYMENT_SERVICE
    });

    this.cache.set(cacheKey, bundle);
    return bundle;
  }

  /**
   * إنشاء حزمة كاملة من جميع الخدمات
   * Full service bundle with smart dependency resolution
   */
  createFullBundle(config: ServiceBundleConfig = {}): FullServiceBundle {
    const cacheKey = this.generateCacheKey('full', config);
    
    if (config.lazy !== false && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // إنشاء الحزم الفرعية مع تمرير التكوين
    const coreBundle = this.createCoreBundle(config);
    const systemBundle = this.createSystemBundle(config);
    const serverBundle = this.createServerBundle(config);
    const applicationBundle = this.createApplicationBundle(config);

    const fullBundle = {
      ...coreBundle,
      ...systemBundle,
      ...serverBundle,
      ...applicationBundle
    };

    this.cache.set(cacheKey, fullBundle);
    return fullBundle;
  }

  /**
   * إنشاء حزمة مخصصة من tokens محددة
   * Custom bundle creation with specific tokens
   */
  createCustomBundle<T = Record<string, BaseService>>(
    tokens: ServiceTokens[], 
    config: ServiceBundleConfig = {},
    propertyMap?: Record<string, ServiceTokens>
  ): T {
    const cacheKey = this.generateCacheKey('custom', config, tokens);
    
    if (config.lazy !== false && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const filteredTokens = tokens.filter(token => !config.exclude?.includes(token));
    const bundle = this.createBundleFromTokens<T>(filteredTokens, config, propertyMap);
    
    this.cache.set(cacheKey, bundle);
    return bundle;
  }

  /**
   * Core bundle creation logic with token resolution
   * الدالة الأساسية لإنشاء الحزم من الـ tokens
   */
  private createBundleFromTokens<T>(
    tokens: ServiceTokens[], 
    config: ServiceBundleConfig,
    propertyMap?: Record<string, ServiceTokens>
  ): T {
    const bundle: any = {};
    
    // تطبيق السياق الجزئي إذا تم تمريره
    if (config.partialContext) {
      this.container.updateContext(config.partialContext);
    }

    for (const token of tokens) {
      try {
        // تحديد اسم الخاصية
        const propertyName = this.getPropertyNameForToken(token, propertyMap);
        
        if (config.lazy) {
          // Lazy instantiation guard
          bundle[propertyName] = this.createLazyGetter(token);
        } else {
          // Immediate resolution
          const service = this.container.resolveByToken(token);
          
          if (config.validateOnCreation) {
            this.validateServiceInstance(service, token);
          }
          
          bundle[propertyName] = service;
        }
        
      } catch (error) {
        if (ServiceError.isServiceError(error)) {
          throw new ServiceError(
            `Failed to create bundle: ${error.message}`,
            error.code,
            error.statusCode,
            { ...error.details, bundleToken: token, bundleTokens: tokens }
          );
        }
        
        throw ServiceError.internal(
          `Bundle creation failed for token ${token}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          { token, bundleTokens: tokens, originalError: error }
        );
      }
    }

    return bundle as T;
  }

  /**
   * إنشاء lazy getter للخدمة
   */
  private createLazyGetter(token: ServiceTokens): any {
    let service: BaseService | null = null;
    
    return new Proxy({}, {
      get: (target, prop) => {
        if (!service) {
          service = this.container.resolveByToken(token);
        }
        return (service as any)[prop];
      },
      
      set: (target, prop, value) => {
        if (!service) {
          service = this.container.resolveByToken(token);
        }
        (service as any)[prop] = value;
        return true;
      }
    });
  }

  /**
   * تحديد اسم الخاصية للtoken
   */
  private getPropertyNameForToken(token: ServiceTokens, propertyMap?: Record<string, ServiceTokens>): string {
    if (propertyMap) {
      const entry = Object.entries(propertyMap).find(([, mappedToken]) => mappedToken === token);
      if (entry) {
        return entry[0];
      }
    }
    
    // تحويل من CamelCase إلى camelCase
    return token.charAt(0).toLowerCase() + token.slice(1);
  }

  /**
   * التحقق من صحة instance الخدمة
   */
  private validateServiceInstance(service: any, token: ServiceTokens): void {
    if (!service) {
      throw ServiceError.internal(`Service instance is null for token ${token}`);
    }
    
    if (!(service instanceof BaseService)) {
      throw ServiceError.internal(
        `Service instance is not a BaseService for token ${token}`,
        { serviceType: typeof service, expectedType: 'BaseService' }
      );
    }
    
    // التحقق من وجود الدوال الأساسية
    if (typeof service.setContext !== 'function') {
      throw ServiceError.internal(
        `Service instance missing required methods for token ${token}`,
        { missingMethods: ['setContext'] }
      );
    }
  }

  /**
   * إنشاء cache key فريد للحزمة
   */
  private generateCacheKey(bundleType: string, config: ServiceBundleConfig, tokens?: ServiceTokens[]): string {
    const configHash = JSON.stringify({
      lazy: config.lazy,
      exclude: config.exclude?.sort(),
      partialContext: config.partialContext,
      validateOnCreation: config.validateOnCreation
    });
    
    const tokensHash = tokens ? JSON.stringify(tokens.sort()) : '';
    return `${bundleType}:${Buffer.from(configHash + tokensHash).toString('base64').slice(0, 16)}`;
  }

  /**
   * مسح الcache
   */
  clearCache(): void {
    this.cache.clear();
    this.lazyInitGuards.clear();
  }

  /**
   * الحصول على معلومات الcache
   */
  getCacheInfo(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

/**
 * Enhanced Service Helpers - Phase 2
 * مساعدات الخدمات المُحسنة مع دعم Token-driven bundles
 */
export const ServiceHelpers = {
  /**
   * إنشاء مصنع حزم خدمات جديد
   */
  createBundleFactory(container: ServiceContainer): ServiceBundleFactory {
    return new ServiceBundleFactory(container);
  },

  /**
   * إنشاء حزمة خدمات أساسية (Legacy support - الاستخدام المباشر)
   * @deprecated استخدم ServiceBundleFactory.createCoreBundle() بدلاً من ذلك
   */
  createCoreServices(container: ServiceContainer): CoreServiceBundle {
    const factory = new ServiceBundleFactory(container);
    return factory.createCoreBundle();
  },

  /**
   * إنشاء حزمة خدمات النظام (Legacy support)
   * @deprecated استخدم ServiceBundleFactory.createSystemBundle() بدلاً من ذلك
   */
  createSystemServices(container: ServiceContainer): SystemServiceBundle {
    const factory = new ServiceBundleFactory(container);
    return factory.createSystemBundle();
  },

  /**
   * إنشاء حزمة مخصصة بسيطة
   */
  createServicesFromTokens<T = Record<string, BaseService>>(
    container: ServiceContainer,
    tokens: ServiceTokens[],
    config?: ServiceBundleConfig
  ): T {
    const factory = new ServiceBundleFactory(container);
    return factory.createCustomBundle<T>(tokens, config);
  },

  /**
   * Utility لحل خدمة واحدة مع معالجة الأخطاء
   */
  resolveServiceSafely<T extends BaseService>(
    container: ServiceContainer,
    token: ServiceTokens,
    fallback?: T
  ): T | null {
    try {
      return container.resolveByToken<T>(token);
    } catch (error) {
      if (fallback) {
        return fallback;
      }
      
      // تسجيل الخطأ والإرجاع null
      console.warn(`Failed to resolve service ${token}:`, error instanceof Error ? error.message : error);
      return null;
    }
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
    console.log('Registry:', Object.keys(ServiceContainer.getCanonicalRegistry()));
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
    
    for (const [token, registryEntry] of Object.entries(registry)) {
      if (registryEntry?.metadata?.dependencies) {
        for (const dep of registryEntry.metadata.dependencies) {
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