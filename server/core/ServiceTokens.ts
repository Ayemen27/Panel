/**
 * Service Tokens for Dependency Injection
 * تحديد tokens لجميع الخدمات المستخدمة في النظام
 */
export enum ServiceTokens {
  // Core System Services
  SYSTEM_SERVICE = 'SystemService',
  LOG_SERVICE = 'LogService',
  AUDIT_SERVICE = 'AuditService',
  MONITORING_SERVICE = 'MonitoringService',
  
  // Server Management Services  
  NGINX_SERVICE = 'NginxService',
  PM2_SERVICE = 'PM2Service',
  SSL_SERVICE = 'SslService',
  
  // Application Services
  UNIFIED_NOTIFICATION_SERVICE = 'UnifiedNotificationService',
  UNIFIED_FILE_SERVICE = 'UnifiedFileService',
  BACKUP_SERVICE = 'BackupService',
  DEPLOYMENT_SERVICE = 'DeploymentService',
  STORAGE_STATS_SERVICE = 'StorageStatsService',
  
  // Connection Management
  SMART_CONNECTION_MANAGER = 'SmartConnectionManager',
  
  // External Services (for future use)
  EMAIL_SERVICE = 'EmailService',
  AUTH_SERVICE = 'AuthService'
}

/**
 * Service Dependencies Map
 * خريطة التبعيات بين الخدمات لإدارة dependency graph
 */
export const ServiceDependencies: Record<ServiceTokens, ServiceTokens[]> = {
  // Core Services - no dependencies
  [ServiceTokens.LOG_SERVICE]: [],
  [ServiceTokens.AUDIT_SERVICE]: [],
  [ServiceTokens.SMART_CONNECTION_MANAGER]: [],
  
  // System Services - depend on core services
  [ServiceTokens.SYSTEM_SERVICE]: [ServiceTokens.LOG_SERVICE],
  [ServiceTokens.MONITORING_SERVICE]: [ServiceTokens.LOG_SERVICE, ServiceTokens.SYSTEM_SERVICE],
  
  // Server Management - depend on system services
  [ServiceTokens.NGINX_SERVICE]: [ServiceTokens.LOG_SERVICE, ServiceTokens.SYSTEM_SERVICE],
  [ServiceTokens.PM2_SERVICE]: [ServiceTokens.LOG_SERVICE, ServiceTokens.SYSTEM_SERVICE],
  [ServiceTokens.SSL_SERVICE]: [ServiceTokens.LOG_SERVICE, ServiceTokens.SYSTEM_SERVICE, ServiceTokens.NGINX_SERVICE],
  
  // Application Services - complex dependencies
  [ServiceTokens.UNIFIED_FILE_SERVICE]: [ServiceTokens.LOG_SERVICE, ServiceTokens.AUDIT_SERVICE],
  [ServiceTokens.UNIFIED_NOTIFICATION_SERVICE]: [ServiceTokens.LOG_SERVICE, ServiceTokens.UNIFIED_FILE_SERVICE],
  [ServiceTokens.BACKUP_SERVICE]: [ServiceTokens.LOG_SERVICE, ServiceTokens.UNIFIED_FILE_SERVICE, ServiceTokens.SYSTEM_SERVICE],
  [ServiceTokens.DEPLOYMENT_SERVICE]: [ServiceTokens.LOG_SERVICE, ServiceTokens.PM2_SERVICE, ServiceTokens.NGINX_SERVICE],
  [ServiceTokens.STORAGE_STATS_SERVICE]: [ServiceTokens.LOG_SERVICE, ServiceTokens.SYSTEM_SERVICE],
  
  // External Services (for future use)
  [ServiceTokens.EMAIL_SERVICE]: [ServiceTokens.LOG_SERVICE],
  [ServiceTokens.AUTH_SERVICE]: [ServiceTokens.LOG_SERVICE]
};

/**
 * Service Priority Levels for Registration Order
 * أولويات تسجيل الخدمات لضمان ترتيب صحيح
 */
export const ServicePriority: Record<ServiceTokens, number> = {
  // Core services first (highest priority)
  [ServiceTokens.LOG_SERVICE]: 1,
  [ServiceTokens.AUDIT_SERVICE]: 1,
  [ServiceTokens.SMART_CONNECTION_MANAGER]: 1,
  
  // System services second
  [ServiceTokens.SYSTEM_SERVICE]: 2,
  [ServiceTokens.MONITORING_SERVICE]: 3,
  
  // Server management third
  [ServiceTokens.NGINX_SERVICE]: 3,
  [ServiceTokens.PM2_SERVICE]: 3,
  [ServiceTokens.SSL_SERVICE]: 4,
  
  // Application services last
  [ServiceTokens.UNIFIED_FILE_SERVICE]: 2,
  [ServiceTokens.UNIFIED_NOTIFICATION_SERVICE]: 3,
  [ServiceTokens.BACKUP_SERVICE]: 4,
  [ServiceTokens.DEPLOYMENT_SERVICE]: 4,
  [ServiceTokens.STORAGE_STATS_SERVICE]: 3,
  
  // External services
  [ServiceTokens.EMAIL_SERVICE]: 2,
  [ServiceTokens.AUTH_SERVICE]: 2
};

/**
 * Service Metadata Interface - الواجهة الأساسية لبيانات الخدمة
 * تحتوي على جميع المعلومات اللازمة لإدارة الخدمة في النظام
 */
export interface ServiceMetadata {
  /** Service token identifier */
  token: ServiceTokens;
  /** Constructor function for the service */
  constructor: new (storage: any, context?: any) => any;
  /** List of dependency tokens this service requires */
  dependencies: ServiceTokens[];
  /** Registration priority (lower number = higher priority) */
  priority: number;
  /** Whether this service should be singleton per container */
  singleton: boolean;
  /** Human-readable name for the service */
  name: string;
  /** Description of what this service does */
  description: string;
  /** Category for grouping services */
  category: 'core' | 'system' | 'server' | 'application' | 'connection' | 'external';
  /** Version of the service implementation */
  version: string;
  /** Whether this service is currently implemented */
  implemented: boolean;
}

/**
 * Service Factory Interface - لتعريف مصنع الخدمة
 */
export interface ServiceFactory {
  /** Creates a new instance of the service */
  create: (storage: any, context?: any) => any;
  /** Service metadata */
  metadata: ServiceMetadata;
}

/**
 * Service Configuration Interface - للتكوين المتقدم
 */
export interface ServiceConfig {
  token: ServiceTokens;
  factory: (container: any) => any;
  dependencies: ServiceTokens[];
  singleton?: boolean; // false by default for per-request safety
  priority: number;
}