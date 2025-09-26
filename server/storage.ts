import {
  users,
  applications,
  domains,
  sslCertificates,
  nginxConfigs,
  notifications,
  systemLogs,
  files,
  fileTrash,
  fileBackups,
  fileAuditLogs,
  fileLocks,
  filePermissions,
  allowedPaths,
  type User,
  type UpsertUser,
  type Application,
  type InsertApplication,
  type Domain,
  type InsertDomain,
  type SslCertificate,
  type InsertSslCertificate,
  type NginxConfig,
  type InsertNginxConfig,
  type Notification,
  type InsertNotification,
  type SystemLog,
  type InsertSystemLog,
  type File,
  type InsertFile,
  type FileTrash,
  type InsertFileTrash,
  type FileBackup,
  type InsertFileBackup,
  type FileAuditLog,
  type InsertFileAuditLog,
  type FileLock,
  type InsertFileLock,
  type FilePermission,
  type InsertFilePermission,
  type AllowedPath,
  type InsertAllowedPath,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, count, gte, like, ilike, isNull, isNotNull, lt, max, sql } from "drizzle-orm";
// Assuming logger is imported from a shared module or defined elsewhere
import { logger } from "@shared/logger"; // Placeholder for actual logger import

export interface IStorage {
  // User operations (for username/password auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  createUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<UpsertUser>): Promise<User>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  updateUserRole(id: string, role: string): Promise<User>;
  updateUserPermissions(id: string, permissions: string[]): Promise<User>;
  getUsersByRole(role: string): Promise<User[]>;

  // Application operations
  getApplications(userId: string): Promise<Application[]>;
  getApplication(id: string): Promise<Application | undefined>;
  createApplication(app: InsertApplication): Promise<Application>;
  updateApplication(id: string, updates: Partial<InsertApplication>): Promise<Application>;
  deleteApplication(id: string): Promise<void>;

  // Domain operations
  getDomains(): Promise<Domain[]>;
  getDomainsByApplication(applicationId: string): Promise<Domain[]>;
  createDomain(domain: InsertDomain): Promise<Domain>;
  updateDomain(id: string, updates: Partial<InsertDomain>): Promise<Domain>;
  deleteDomain(id: string): Promise<void>;

  // SSL Certificate operations
  getSslCertificates(): Promise<SslCertificate[]>;
  getSslCertificate(domainId: string): Promise<SslCertificate | undefined>;
  createSslCertificate(cert: InsertSslCertificate): Promise<SslCertificate>;
  updateSslCertificate(id: string, updates: Partial<InsertSslCertificate>): Promise<SslCertificate>;

  // Nginx Config operations
  getNginxConfigs(): Promise<NginxConfig[]>;
  getNginxConfig(applicationId: string): Promise<NginxConfig | undefined>;
  createNginxConfig(config: InsertNginxConfig): Promise<NginxConfig>;
  updateNginxConfig(id: string, updates: Partial<InsertNginxConfig>): Promise<NginxConfig>;

  // Notification operations
  getNotifications(userId: string, limit?: number): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  acknowledgeNotification(id: string): Promise<void>;
  resolveNotification(id: string): Promise<void>;
  getUnreadNotificationCount(userId: string): Promise<number>;

  // System Log operations
  getSystemLogs(filters?: { source?: string; level?: string; applicationId?: string; limit?: number }): Promise<SystemLog[]>;
  createSystemLog(log: InsertSystemLog): Promise<SystemLog>;

  // Database connection test
  testConnection(): Promise<void>;

  // Statistics
  getApplicationStats(userId: string): Promise<{
    total: number;
    running: number;
    stopped: number;
    error: number;
  }>;
  getSslStats(): Promise<{
    total: number;
    valid: number;
    expiringSoon: number;
    expired: number;
  }>;

  // File CRUD operations
  getFile(id: string, userId: string): Promise<File | undefined>;
  getFiles(parentId: string | null, userId: string): Promise<File[]>;
  createFile(file: InsertFile): Promise<File>;
  updateFile(id: string, updates: Partial<InsertFile>, userId: string): Promise<File>;
  deleteFile(id: string, userId: string): Promise<void>;
  getUserFiles(userId: string, type?: 'file' | 'folder'): Promise<File[]>;

  // Search and filtering operations
  searchFiles(userId: string, query: string, filters?: { type?: 'file' | 'folder'; tags?: string[] }): Promise<File[]>;
  getFileByPath(path: string, userId: string): Promise<File | undefined>;

  // Trash operations
  getTrashFiles(userId: string): Promise<FileTrash[]>;
  moveToTrash(fileId: string, userId: string): Promise<FileTrash>;
  restoreFromTrash(trashId: string, userId: string): Promise<File>;
  permanentDelete(trashId: string, userId: string): Promise<void>;
  emptyTrash(userId: string): Promise<void>;

  // Backup operations
  getFileBackups(fileId: string, userId?: string): Promise<FileBackup[]>;
  createBackup(fileId: string, content: string, userId: string): Promise<FileBackup>;
  restoreBackup(backupId: string, userId: string): Promise<File>;

  // Permission operations
  getFilePermissions(fileId: string, userId?: string): Promise<FilePermission[]>;
  setFilePermission(permission: InsertFilePermission, userId: string): Promise<FilePermission>;
  removeFilePermission(permissionId: string, userId: string): Promise<void>;
  checkFilePermission(fileId: string, userId: string, permission: 'read' | 'write' | 'delete'): Promise<boolean>;

  // Lock operations
  lockFile(fileId: string, userId: string, lockType: 'read' | 'write' | 'exclusive', ttl?: number): Promise<FileLock>;
  unlockFile(fileId: string, userId: string): Promise<void>;
  getFileLocks(fileId: string): Promise<FileLock[]>;
  isFileLocked(fileId: string): Promise<boolean>;

  // Audit log operations
  createAuditLog(log: InsertFileAuditLog): Promise<FileAuditLog>;
  getFileAuditLogs(fileId?: string, userId?: string, limit?: number): Promise<FileAuditLog[]>;

  // Copy and duplicate operations
  copyFile(fileId: string, destinationFolderId: string | null, userId: string, newName?: string): Promise<File>;
  duplicateFile(fileId: string, userId: string): Promise<File>;

  // Share operations
  shareFile(fileId: string, isPublic: boolean, userId: string): Promise<File>;
  getPublicFileUrl(fileId: string): string;

  // Allowed paths operations
  getAllowedPaths(type?: 'allowed' | 'blocked'): Promise<AllowedPath[]>;
  getAllowedPath(id: string): Promise<AllowedPath | undefined>;
  createAllowedPath(path: InsertAllowedPath): Promise<AllowedPath>;
  updateAllowedPath(id: string, updates: Partial<Omit<InsertAllowedPath, 'addedBy'>>): Promise<AllowedPath>;
  deleteAllowedPath(id: string): Promise<void>;
  checkPathAllowed(path: string): Promise<boolean>;
  getActivePaths(type: 'allowed' | 'blocked'): Promise<string[]>;
}

export class DatabaseStorage implements IStorage {
  // Helper function to check user file access permissions
  private async checkUserFileAccess(fileId: string, userId: string, requiredPermission: 'read' | 'write' | 'delete' | 'admin'): Promise<boolean> {
    // First check if user owns the file
    const [file] = await db
      .select()
      .from(files)
      .where(and(eq(files.id, fileId), eq(files.ownerId, userId)));

    if (file) {
      return true; // Owner has all permissions
    }

    // Check if user is admin
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (user?.role === 'admin') {
      return true; // Admin has all permissions
    }

    // Check explicit permissions
    const [userPermission] = await db
      .select()
      .from(filePermissions)
      .where(
        and(
          eq(filePermissions.fileId, fileId),
          eq(filePermissions.userId, userId),
          or(
            eq(filePermissions.permission, requiredPermission),
            eq(filePermissions.permission, 'admin')
          ),
          or(
            isNull(filePermissions.expiresAt),
            gte(filePermissions.expiresAt, new Date())
          )
        )
      );

    return !!userPermission;
  }

  // Helper function to get next version number
  private async getNextVersionNumber(fileId: string): Promise<number> {
    const [result] = await db
      .select({ maxVersion: max(fileBackups.version) })
      .from(fileBackups)
      .where(eq(fileBackups.fileId, fileId));

    return (result.maxVersion || 0) + 1;
  }

  // Helper function to clean expired locks
  private async cleanExpiredLocks(fileId: string): Promise<void> {
    await db
      .delete(fileLocks)
      .where(
        and(
          eq(fileLocks.fileId, fileId),
          isNotNull(fileLocks.expiresAt),
          lt(fileLocks.expiresAt, new Date())
        )
      );
  }
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // DEVELOPMENT ONLY: Auto-assign admin role to new users
    // WARNING: This feature should be REMOVED before production deployment
    // Set FORCE_ADMIN_FOR_NEW_USERS=true in development to auto-assign admin role

    // Check if user already exists (only if ID is provided)
    let existingUser = null;
    let isNewUser = true;

    if (userData.id) {
      try {
        existingUser = await this.getUser(userData.id);
        isNewUser = !existingUser;
      } catch (error) {
        // If error in getting user, treat as new user
        isNewUser = true;
      }
    }

    // Prepare user data with potential admin role assignment
    let userDataToInsert = { ...userData };

    // Apply admin role only to NEW users when environment variable is set
    if (isNewUser && process.env.FORCE_ADMIN_FOR_NEW_USERS === 'true') {
      userDataToInsert.role = 'admin';

      // Security logging: Log admin role assignment for audit trail
      console.warn('🚨 SECURITY AUDIT: Auto-assigned admin role to new user', {
        userId: userData.id,
        email: userData.email,
        timestamp: new Date().toISOString(),
        reason: 'FORCE_ADMIN_FOR_NEW_USERS environment variable enabled',
        environment: 'development'
      });

      // Create audit log if the system logs are available
      try {
        await this.createSystemLog({
          source: 'auth',
          level: 'warn',
          message: `Auto-assigned admin role to new user ${userData.email || userData.id}`,
          metadata: {
            userId: userData.id,
            email: userData.email,
            autoAssignReason: 'FORCE_ADMIN_FOR_NEW_USERS',
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        // Silently handle logging errors to not break user creation
        console.error('Failed to create audit log for admin role assignment:', error);
      }
    }

    if (isNewUser) {
      // For new users, insert with all data including potential admin role
      const [user] = await db
        .insert(users)
        .values(userDataToInsert)
        .onConflictDoNothing()
        .returning();

      // If conflict happened (user was created between check and insert), get the existing user
      if (!user) {
        const [existingUser] = await db
          .select()
          .from(users)
          .where(eq(users.id, userData.id!));
        return existingUser;
      }

      return user;
    } else {
      // For existing users, only update allowed fields, preserve role
      const [user] = await db
        .update(users)
        .set({
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
          lastLogin: new Date(),
          // Note: role is intentionally NOT updated for existing users
        })
        .where(eq(users.id, userData.id!))
        .returning();
      return user;
    }
  }

  async updateUserRole(id: string, role: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ role: role as any, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateUserPermissions(id: string, permissions: string[]): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ permissions, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(eq(users.role, role as any))
      .orderBy(desc(users.createdAt));
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));
    return user;
  }

  async createUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<UpsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // Application operations
  async getApplications(userId: string): Promise<Application[]> {
    return await db
      .select()
      .from(applications)
      .where(eq(applications.userId, userId))
      .orderBy(desc(applications.createdAt));
  }

  async getApplication(id: string): Promise<Application | undefined> {
    const [app] = await db.select().from(applications).where(eq(applications.id, id));
    return app;
  }

  async createApplication(app: InsertApplication): Promise<Application> {
    const [created] = await db.insert(applications).values(app).returning();
    return created;
  }

  async updateApplication(id: string, updates: Partial<InsertApplication>): Promise<Application> {
    const [updated] = await db
      .update(applications)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(applications.id, id))
      .returning();
    return updated;
  }

  async deleteApplication(id: string): Promise<void> {
    // Delete related notifications first to avoid foreign key constraint
    await db.delete(notifications).where(eq(notifications.applicationId, id));

    // Delete related domains if any
    await db.delete(domains).where(eq(domains.applicationId, id));

    // Delete related nginx configs if any
    await db.delete(nginxConfigs).where(eq(nginxConfigs.applicationId, id));

    // Delete related system logs if any
    await db.delete(systemLogs).where(eq(systemLogs.applicationId, id));

    // Finally delete the application
    await db.delete(applications).where(eq(applications.id, id));
  }

  // Domain operations
  async getDomains(): Promise<Domain[]> {
    return await db.select().from(domains).orderBy(desc(domains.createdAt));
  }

  async getDomainsByApplication(applicationId: string): Promise<Domain[]> {
    return await db
      .select()
      .from(domains)
      .where(eq(domains.applicationId, applicationId));
  }

  async createDomain(domain: InsertDomain): Promise<Domain> {
    const [created] = await db.insert(domains).values(domain).returning();
    return created;
  }

  async updateDomain(id: string, updates: Partial<InsertDomain>): Promise<Domain> {
    const [updated] = await db
      .update(domains)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(domains.id, id))
      .returning();
    return updated;
  }

  async deleteDomain(id: string): Promise<void> {
    await db.delete(domains).where(eq(domains.id, id));
  }

  // SSL Certificate operations
  async getSslCertificates(): Promise<SslCertificate[]> {
    return await db.select().from(sslCertificates).orderBy(desc(sslCertificates.createdAt));
  }

  async getSslCertificate(domainId: string): Promise<SslCertificate | undefined> {
    const [cert] = await db
      .select()
      .from(sslCertificates)
      .where(eq(sslCertificates.domainId, domainId));
    return cert;
  }

  async createSslCertificate(cert: InsertSslCertificate): Promise<SslCertificate> {
    const [created] = await db.insert(sslCertificates).values(cert).returning();
    return created;
  }

  async updateSslCertificate(id: string, updates: Partial<InsertSslCertificate>): Promise<SslCertificate> {
    const [updated] = await db
      .update(sslCertificates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(sslCertificates.id, id))
      .returning();
    return updated;
  }

  // Nginx Config operations
  async getNginxConfigs(): Promise<NginxConfig[]> {
    return await db.select().from(nginxConfigs).orderBy(desc(nginxConfigs.createdAt));
  }

  async getNginxConfig(applicationId: string): Promise<NginxConfig | undefined> {
    const [config] = await db
      .select()
      .from(nginxConfigs)
      .where(eq(nginxConfigs.applicationId, applicationId));
    return config;
  }

  async createNginxConfig(config: InsertNginxConfig): Promise<NginxConfig> {
    const [created] = await db.insert(nginxConfigs).values(config).returning();
    return created;
  }

  async updateNginxConfig(id: string, updates: Partial<InsertNginxConfig>): Promise<NginxConfig> {
    const [updated] = await db
      .update(nginxConfigs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(nginxConfigs.id, id))
      .returning();
    return updated;
  }

  // Notification operations
  async getNotifications(userId: string, limit = 50): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(notification).returning();
    return created;
  }

  async acknowledgeNotification(id: string): Promise<void> {
    await db
      .update(notifications)
      .set({ acknowledged: true, updatedAt: new Date() })
      .where(eq(notifications.id, id));
  }

  async resolveNotification(id: string): Promise<void> {
    await db
      .update(notifications)
      .set({ resolved: true, updatedAt: new Date() })
      .where(eq(notifications.id, id));
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.acknowledged, false)
        )
      );
    return result.count;
  }

  // System Log operations
  async getSystemLogs(filters?: {
    source?: string;
    level?: string;
    applicationId?: string;
    limit?: number;
  }): Promise<SystemLog[]> {
    const conditions = [];
    if (filters?.source) {
      conditions.push(eq(systemLogs.source, filters.source));
    }
    if (filters?.level) {
      conditions.push(eq(systemLogs.level, filters.level));
    }
    if (filters?.applicationId) {
      conditions.push(eq(systemLogs.applicationId, filters.applicationId));
    }

    if (conditions.length > 0) {
      return await db
        .select()
        .from(systemLogs)
        .where(and(...conditions))
        .orderBy(desc(systemLogs.timestamp))
        .limit(filters?.limit || 100);
    }

    return await db
      .select()
      .from(systemLogs)
      .orderBy(desc(systemLogs.timestamp))
      .limit(filters?.limit || 100);
  }

  async createSystemLog(log: InsertSystemLog): Promise<SystemLog> {
    const [created] = await db.insert(systemLogs).values(log).returning();
    return created;
  }

  // Statistics
  async getApplicationStats(userId: string): Promise<{
    total: number;
    running: number;
    stopped: number;
    error: number;
  }> {
    const apps = await db
      .select()
      .from(applications)
      .where(eq(applications.userId, userId));

    return {
      total: apps.length,
      running: apps.filter(app => app.status === 'running').length,
      stopped: apps.filter(app => app.status === 'stopped').length,
      error: apps.filter(app => app.status === 'error').length,
    };
  }

  async getSslStats(): Promise<{
    total: number;
    valid: number;
    expiringSoon: number;
    expired: number;
  }> {
    const certs = await db.select().from(sslCertificates);
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    return {
      total: certs.length,
      valid: certs.filter(cert => cert.status === 'valid' && cert.expiresAt && cert.expiresAt > now).length,
      expiringSoon: certs.filter(
        cert =>
          cert.status === 'valid' &&
          cert.expiresAt &&
          cert.expiresAt <= thirtyDaysFromNow &&
          cert.expiresAt > now
      ).length,
      expired: certs.filter(cert => cert.expiresAt && cert.expiresAt <= now).length,
    };
  }

  // Test database connection
  async testConnection(): Promise<void> {
    try {
      // Use proper Drizzle query instead of raw execute
      await db.select().from(users).limit(1);
    } catch (error) {
      throw new Error(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // File CRUD operations
  async getFile(id: string, userId: string): Promise<File | undefined> {
    const [file] = await db
      .select()
      .from(files)
      .where(and(eq(files.id, id), eq(files.ownerId, userId)));
    return file;
  }

  async getFiles(parentId: string | null, userId: string): Promise<File[]> {
    const conditions = [eq(files.ownerId, userId)];
    if (parentId === null) {
      conditions.push(isNull(files.parentId));
    } else {
      conditions.push(eq(files.parentId, parentId));
    }

    return await db
      .select()
      .from(files)
      .where(and(...conditions))
      .orderBy(desc(files.createdAt));
  }

  async createFile(file: InsertFile): Promise<File> {
    const [created] = await db.insert(files).values(file).returning();
    return created;
  }

  async updateFile(id: string, updates: Partial<InsertFile>, userId: string): Promise<File> {
    // Check if user has write permission for this file
    const hasPermission = await this.checkUserFileAccess(id, userId, 'write');
    if (!hasPermission) {
      throw new Error('Access denied: You do not have permission to update this file');
    }

    const [updated] = await db
      .update(files)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(files.id, id))
      .returning();

    if (!updated) {
      throw new Error('File not found or could not be updated');
    }

    return updated;
  }

  async deleteFile(id: string, userId: string): Promise<void> {
    // Check if user has delete permission for this file
    const hasPermission = await this.checkUserFileAccess(id, userId, 'delete');
    if (!hasPermission) {
      throw new Error('Access denied: You do not have permission to delete this file');
    }

    // Use transaction to ensure data consistency
    await db.transaction(async (tx) => {
      // Delete related records first to avoid foreign key constraints
      await tx.delete(filePermissions).where(eq(filePermissions.fileId, id));
      await tx.delete(fileLocks).where(eq(fileLocks.fileId, id));
      await tx.delete(fileBackups).where(eq(fileBackups.fileId, id));
      await tx.delete(fileAuditLogs).where(eq(fileAuditLogs.fileId, id));

      // Finally delete the file
      const result = await tx.delete(files).where(eq(files.id, id));

      if (result.rowCount === 0) {
        throw new Error('File not found or could not be deleted');
      }
    });
  }

  async getUserFiles(userId: string, type?: 'file' | 'folder'): Promise<File[]> {
    const conditions = [eq(files.ownerId, userId)];
    if (type) {
      conditions.push(eq(files.type, type));
    }

    return await db
      .select()
      .from(files)
      .where(and(...conditions))
      .orderBy(desc(files.createdAt));
  }

  // Search and filtering operations
  async searchFiles(userId: string, query: string, filters?: { type?: 'file' | 'folder'; tags?: string[] }): Promise<File[]> {
    const conditions = [eq(files.ownerId, userId)];

    // Add search query condition
    if (query.trim()) {
      conditions.push(
        or(
          ilike(files.name, `%${query}%`),
          ilike(files.path, `%${query}%`)
        )!
      );
    }

    // Add type filter
    if (filters?.type) {
      conditions.push(eq(files.type, filters.type));
    }

    // Add tags filter - check if any of the provided tags exist in the file's tags array
    if (filters?.tags && filters.tags.length > 0) {
      // Use proper array operators for PostgreSQL text[] arrays
      const tagConditions = filters.tags.map(
        tag => sql`${tag} = ANY(${files.tags})`
      );
      if (tagConditions.length > 0) {
        conditions.push(or(...tagConditions)!);
      }
    }

    return await db
      .select()
      .from(files)
      .where(and(...conditions))
      .orderBy(desc(files.createdAt));
  }

  async getFileByPath(path: string, userId: string): Promise<File | undefined> {
    const [file] = await db
      .select()
      .from(files)
      .where(and(eq(files.path, path), eq(files.ownerId, userId)));
    return file;
  }

  // Trash operations
  async getTrashFiles(userId: string): Promise<FileTrash[]> {
    return await db
      .select()
      .from(fileTrash)
      .where(eq(fileTrash.ownerId, userId))
      .orderBy(desc(fileTrash.deletedAt));
  }

  async moveToTrash(fileId: string, userId: string): Promise<FileTrash> {
    // Check if user has delete permission for this file
    const hasPermission = await this.checkUserFileAccess(fileId, userId, 'delete');
    if (!hasPermission) {
      throw new Error('Access denied: You do not have permission to delete this file');
    }

    // Get the file first
    const [file] = await db
      .select()
      .from(files)
      .where(eq(files.id, fileId));

    if (!file) {
      throw new Error('File not found');
    }

    // Use transaction to ensure data consistency
    return await db.transaction(async (tx) => {
      // Create trash entry
      const [trashEntry] = await tx
        .insert(fileTrash)
        .values({
          originalFileId: file.id,
          originalPath: file.path,
          name: file.name,
          type: file.type,
          filePath: file.filePath,
          size: file.size,
          mimeType: file.mimeType,
          content: file.content,
          checksum: file.checksum,
          ownerId: file.ownerId,
          deletedBy: userId,
          metadata: file.metadata,
        })
        .returning();

      // Delete related records first to avoid foreign key constraints
      await tx.delete(filePermissions).where(eq(filePermissions.fileId, fileId));
      await tx.delete(fileLocks).where(eq(fileLocks.fileId, fileId));
      await tx.delete(fileBackups).where(eq(fileBackups.fileId, fileId));
      await tx.delete(fileAuditLogs).where(eq(fileAuditLogs.fileId, fileId));

      // Finally delete the file
      await tx.delete(files).where(eq(files.id, fileId));

      return trashEntry;
    });
  }

  async restoreFromTrash(trashId: string, userId: string): Promise<File> {
    // Get the trash entry with ownership check
    const [trashEntry] = await db
      .select()
      .from(fileTrash)
      .where(
        and(
          eq(fileTrash.id, trashId),
          eq(fileTrash.ownerId, userId)
        )
      );

    if (!trashEntry) {
      throw new Error('Trash entry not found or access denied');
    }

    // Use transaction to ensure data consistency
    return await db.transaction(async (tx) => {
      // Check if a file with the same path already exists
      const [existingFile] = await tx
        .select()
        .from(files)
        .where(
          and(
            eq(files.path, trashEntry.originalPath),
            eq(files.ownerId, userId)
          )
        );

      if (existingFile) {
        throw new Error('A file with the same path already exists. Please remove or rename it first.');
      }

      // Restore the file
      const [restoredFile] = await tx
        .insert(files)
        .values({
          name: trashEntry.name,
          type: trashEntry.type,
          path: trashEntry.originalPath,
          filePath: trashEntry.filePath,
          size: trashEntry.size,
          mimeType: trashEntry.mimeType,
          content: trashEntry.content,
          checksum: trashEntry.checksum,
          ownerId: trashEntry.ownerId,
          metadata: trashEntry.metadata,
        })
        .returning();

      // Remove from trash
      await tx.delete(fileTrash).where(eq(fileTrash.id, trashId));

      return restoredFile;
    });
  }

  async permanentDelete(trashId: string, userId: string): Promise<void> {
    // Check ownership before permanent deletion
    const [trashEntry] = await db
      .select()
      .from(fileTrash)
      .where(
        and(
          eq(fileTrash.id, trashId),
          eq(fileTrash.ownerId, userId)
        )
      );

    if (!trashEntry) {
      throw new Error('Trash entry not found or access denied');
    }

    const result = await db.delete(fileTrash).where(eq(fileTrash.id, trashId));
    if (result.rowCount === 0) {
      throw new Error('Failed to permanently delete the file');
    }
  }

  async emptyTrash(userId: string): Promise<void> {
    await db.delete(fileTrash).where(eq(fileTrash.ownerId, userId));
  }

  // Backup operations
  async getFileBackups(fileId: string, userId?: string): Promise<FileBackup[]> {
    const conditions = [eq(fileBackups.fileId, fileId)];

    // If userId is provided, ensure user has access to the file
    if (userId) {
      const hasPermission = await this.checkUserFileAccess(fileId, userId, 'read');
      if (!hasPermission) {
        throw new Error('Access denied: You do not have permission to view backups for this file');
      }
    }

    return await db
      .select()
      .from(fileBackups)
      .where(and(...conditions))
      .orderBy(desc(fileBackups.version));
  }

  async createBackup(fileId: string, content: string, userId: string): Promise<FileBackup> {
    // Check if user has write permission for this file
    const hasPermission = await this.checkUserFileAccess(fileId, userId, 'write');
    if (!hasPermission) {
      throw new Error('Access denied: You do not have permission to create backup for this file');
    }

    // Get the file first
    const [file] = await db
      .select()
      .from(files)
      .where(eq(files.id, fileId));

    if (!file) {
      throw new Error('File not found');
    }

    // Get next version number automatically
    const version = await this.getNextVersionNumber(fileId);

    const [backup] = await db
      .insert(fileBackups)
      .values({
        fileId,
        version,
        name: file.name,
        content,
        size: content.length,
        mimeType: file.mimeType,
        checksum: file.checksum,
        createdBy: userId,
        metadata: file.metadata,
      })
      .returning();

    return backup;
  }

  async restoreBackup(backupId: string, userId: string): Promise<File> {
    // Get the backup
    const [backup] = await db
      .select()
      .from(fileBackups)
      .where(eq(fileBackups.id, backupId));

    if (!backup) {
      throw new Error('Backup not found');
    }

    // Check if user has write permission for the file
    const hasPermission = await this.checkUserFileAccess(backup.fileId, userId, 'write');
    if (!hasPermission) {
      throw new Error('Access denied: You do not have permission to restore this backup');
    }

    // Update the file with backup content
    const [restoredFile] = await db
      .update(files)
      .set({
        content: backup.content,
        size: backup.size,
        checksum: backup.checksum,
        updatedAt: new Date(),
      })
      .where(eq(files.id, backup.fileId))
      .returning();

    if (!restoredFile) {
      throw new Error('Failed to restore backup - file not found');
    }

    return restoredFile;
  }

  // Permission operations
  async getFilePermissions(fileId: string, userId?: string): Promise<FilePermission[]> {
    // If userId is provided, ensure user has admin access or is the owner
    if (userId) {
      const hasPermission = await this.checkUserFileAccess(fileId, userId, 'admin');
      if (!hasPermission) {
        throw new Error('Access denied: You do not have permission to view file permissions');
      }
    }

    return await db
      .select()
      .from(filePermissions)
      .where(eq(filePermissions.fileId, fileId))
      .orderBy(desc(filePermissions.createdAt));
  }

  async setFilePermission(permission: InsertFilePermission, userId: string): Promise<FilePermission> {
    // Check if user has admin permission for this file or is the owner
    const hasPermission = await this.checkUserFileAccess(permission.fileId, userId, 'admin');
    if (!hasPermission) {
      throw new Error('Access denied: You do not have permission to set file permissions');
    }

    const [created] = await db
      .insert(filePermissions)
      .values(permission)
      .returning();

    return created;
  }

  async removeFilePermission(permissionId: string, userId: string): Promise<void> {
    // Get the permission record first to check the file
    const [permission] = await db
      .select()
      .from(filePermissions)
      .where(eq(filePermissions.id, permissionId));

    if (!permission) {
      throw new Error('Permission record not found');
    }

    // Check if user has admin permission for this file or is the owner
    const hasPermission = await this.checkUserFileAccess(permission.fileId, userId, 'admin');
    if (!hasPermission) {
      throw new Error('Access denied: You do not have permission to remove file permissions');
    }

    const result = await db.delete(filePermissions).where(eq(filePermissions.id, permissionId));
    if (result.rowCount === 0) {
      throw new Error('Failed to remove permission');
    }
  }

  async checkFilePermission(fileId: string, userId: string, permission: 'read' | 'write' | 'delete'): Promise<boolean> {
    // First check if user owns the file
    const file = await this.getFile(fileId, userId);
    if (file) {
      return true; // Owner has all permissions
    }

    // Check explicit permissions
    const [userPermission] = await db
      .select()
      .from(filePermissions)
      .where(
        and(
          eq(filePermissions.fileId, fileId),
          eq(filePermissions.userId, userId),
          eq(filePermissions.permission, permission),
          or(
            isNull(filePermissions.expiresAt),
            gte(filePermissions.expiresAt, new Date())
          )
        )
      );

    if (userPermission) {
      return true;
    }

    // Check role-based permissions (would need user role lookup)
    // For now, return false if no explicit permission found
    return false;
  }

  // Lock operations
  async lockFile(fileId: string, userId: string, lockType: 'read' | 'write' | 'exclusive', ttl?: number): Promise<FileLock> {
    // Check if user has appropriate permission for this file
    const requiredPermission = lockType === 'read' ? 'read' : 'write';
    const hasPermission = await this.checkUserFileAccess(fileId, userId, requiredPermission);
    if (!hasPermission) {
      throw new Error(`Access denied: You do not have ${requiredPermission} permission for this file`);
    }

    // Clean expired locks first
    await this.cleanExpiredLocks(fileId);

    // Check if file is already locked with conflicting lock
    const existingLocks = await this.getFileLocks(fileId);

    // Filter out expired locks
    const activeLocks = existingLocks.filter(
      lock => !lock.expiresAt || lock.expiresAt > new Date()
    );

    // Check for conflicts
    const hasConflict = activeLocks.some(lock => {
      // User can't have multiple locks of same type
      if (lock.userId === userId && lock.lockType === lockType) {
        throw new Error(`You already have a ${lockType} lock on this file`);
      }

      // Exclusive locks conflict with everything
      if (lock.lockType === 'exclusive' || lockType === 'exclusive') {
        return true;
      }

      // Write locks conflict with write/read locks
      if (lock.lockType === 'write' && (lockType === 'write' || lockType === 'read')) {
        return true;
      }

      if (lockType === 'write' && (lock.lockType === 'write' || lock.lockType === 'read')) {
        return true;
      }

      return false;
    });

    if (hasConflict) {
      throw new Error('File is already locked with a conflicting lock type');
    }

    const expiresAt = ttl ? new Date(Date.now() + ttl * 1000) : undefined;

    const [lock] = await db
      .insert(fileLocks)
      .values({
        fileId,
        lockType,
        userId,
        expiresAt,
      })
      .returning();

    return lock;
  }

  async unlockFile(fileId: string, userId: string): Promise<void> {
    // Check if user has permission to access this file
    const hasPermission = await this.checkUserFileAccess(fileId, userId, 'read');
    if (!hasPermission) {
      throw new Error('Access denied: You do not have permission to unlock this file');
    }

    // Clean expired locks first
    await this.cleanExpiredLocks(fileId);

    const result = await db
      .delete(fileLocks)
      .where(
        and(
          eq(fileLocks.fileId, fileId),
          eq(fileLocks.userId, userId)
        )
      );

    if (result.rowCount === 0) {
      throw new Error('No active lock found for this user on this file');
    }
  }

  async getFileLocks(fileId: string): Promise<FileLock[]> {
    return await db
      .select()
      .from(fileLocks)
      .where(eq(fileLocks.fileId, fileId))
      .orderBy(desc(fileLocks.createdAt));
  }

  async isFileLocked(fileId: string): Promise<boolean> {
    const locks = await this.getFileLocks(fileId);

    // Check if any non-expired locks exist
    const activeLocks = locks.filter(
      lock => !lock.expiresAt || lock.expiresAt > new Date()
    );

    return activeLocks.length > 0;
  }

  // Audit log operations
  async createAuditLog(log: InsertFileAuditLog): Promise<FileAuditLog> {
    const [created] = await db.insert(fileAuditLogs).values(log).returning();
    return created;
  }

  async getFileAuditLogs(fileId?: string, userId?: string, limit = 100): Promise<FileAuditLog[]> {
    const conditions = [];

    if (fileId) {
      conditions.push(eq(fileAuditLogs.fileId, fileId));
    }

    if (userId) {
      conditions.push(eq(fileAuditLogs.userId, userId));
    }

    if (conditions.length > 0) {
      return await db
        .select()
        .from(fileAuditLogs)
        .where(and(...conditions))
        .orderBy(desc(fileAuditLogs.timestamp))
        .limit(limit);
    }

    return await db
      .select()
      .from(fileAuditLogs)
      .orderBy(desc(fileAuditLogs.timestamp))
      .limit(limit);
  }

  // Copy and duplicate operations
  async copyFile(fileId: string, destinationFolderId: string | null, userId: string, newName?: string): Promise<File> {
    // Check user has read permission on source file
    const hasAccess = await this.checkUserFileAccess(fileId, userId, 'read');
    if (!hasAccess) {
      throw new Error('Access denied to source file');
    }

    // Get source file
    const sourceFile = await this.getFile(fileId, userId);
    if (!sourceFile) {
      throw new Error('Source file not found');
    }

    if (sourceFile.type === 'folder') {
      throw new Error('Folder copying not yet implemented');
    }

    // Get destination folder path
    let destinationPath = '';
    if (destinationFolderId) {
      const destinationFolder = await this.getFile(destinationFolderId, userId);
      if (!destinationFolder || destinationFolder.type !== 'folder') {
        throw new Error('Invalid destination folder');
      }
      destinationPath = destinationFolder.path;
    }

    // Generate new name if not provided
    const fileName = newName || `Copy of ${sourceFile.name}`;
    const fullDestinationPath = destinationPath ? `${destinationPath}/${fileName}` : fileName;

    // Create copy in database first
    const copyData: InsertFile = {
      name: fileName,
      type: sourceFile.type,
      size: 0, // Will be updated after file copy
      path: fullDestinationPath,
      parentId: destinationFolderId,
      ownerId: userId,
      isPublic: false,
      tags: sourceFile.tags,
      mimeType: sourceFile.mimeType,
    };

    const [copy] = await db.insert(files).values(copyData).returning();

    // Use FileManagerService to copy physical file
    const { FileManagerService } = await import('./services/fileManagerService');
    const fileManagerService = new FileManagerService(this);
    const copyResult = await fileManagerService.copyFile(
      sourceFile.path,
      fullDestinationPath,
      userId,
      { preserveMetadata: true }
    );

    if (!copyResult.success) {
      // Rollback database entry if file copy failed
      await db.delete(files).where(eq(files.id, copy.id));
      throw new Error(`Failed to copy file: ${copyResult.message}`);
    }

    // Update copy with actual file size and checksum
    const [updatedCopy] = await db
      .update(files)
      .set({
        size: copyResult.data?.size || sourceFile.size,
        checksum: copyResult.data?.checksum,
      })
      .where(eq(files.id, copy.id))
      .returning();

    // Create audit log
    await this.createAuditLog({
      fileId: copy.id,
      action: 'create',
      userId,
      details: `Copied from ${sourceFile.name}`,
      newValue: updatedCopy,
    });

    return updatedCopy;
  }

  async duplicateFile(fileId: string, userId: string): Promise<File> {
    const sourceFile = await this.getFile(fileId, userId);
    if (!sourceFile) {
      throw new Error('Source file not found');
    }

    return this.copyFile(fileId, sourceFile.parentId, userId, `${sourceFile.name} (Copy)`);
  }

  // Share operations
  async shareFile(fileId: string, isPublic: boolean, userId: string): Promise<File> {
    // Check user has write permission
    const hasAccess = await this.checkUserFileAccess(fileId, userId, 'write');
    if (!hasAccess) {
      throw new Error('Access denied');
    }

    const [updatedFile] = await db
      .update(files)
      .set({ isPublic })
      .where(eq(files.id, fileId))
      .returning();

    if (!updatedFile) {
      throw new Error('File not found');
    }

    // Create audit log
    await this.createAuditLog({
      fileId,
      action: 'share',
      userId,
      details: `${isPublic ? 'Made public' : 'Made private'}`,
      newValue: { isPublic },
    });

    return updatedFile;
  }

  getPublicFileUrl(fileId: string): string {
    return `/api/files/${fileId}/download?public=true`;
  }

  // ===============================
  // ALLOWED PATHS OPERATIONS
  // ===============================

  async getAllowedPaths(type?: 'allowed' | 'blocked'): Promise<AllowedPath[]> {
    const conditions = [eq(allowedPaths.isActive, true)];

    if (type) {
      conditions.push(eq(allowedPaths.type, type));
    }

    return await db
      .select()
      .from(allowedPaths)
      .where(and(...conditions))
      .orderBy(desc(allowedPaths.createdAt));
  }

  async getAllowedPath(id: string): Promise<AllowedPath | undefined> {
    const [allowedPath] = await db
      .select()
      .from(allowedPaths)
      .where(eq(allowedPaths.id, id));

    return allowedPath;
  }

  async createAllowedPath(pathData: InsertAllowedPath): Promise<AllowedPath> {
    const [allowedPath] = await db
      .insert(allowedPaths)
      .values(pathData)
      .returning();

    return allowedPath;
  }

  async updateAllowedPath(id: string, updates: Partial<Omit<InsertAllowedPath, 'addedBy'>>): Promise<AllowedPath> {
    const [allowedPath] = await db
      .update(allowedPaths)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(allowedPaths.id, id))
      .returning();

    if (!allowedPath) {
      throw new Error('Allowed path not found');
    }

    return allowedPath;
  }

  async deleteAllowedPath(id: string): Promise<void> {
    await db.delete(allowedPaths).where(eq(allowedPaths.id, id));
  }

  async checkPathAllowed(path: string): Promise<boolean> {
    try {
      // First check if path is explicitly blocked
      const blockedPath = await db
        .select()
        .from(allowedPaths)
        .where(
          and(
            eq(allowedPaths.type, 'blocked'),
            eq(allowedPaths.isActive, true),
            like(allowedPaths.path, `${path}%`) // Use LIKE for path matching
          )
        )
        .limit(1); // We only need to know if at least one blocked path matches

      if (blockedPath.length > 0) {
        return false; // Path is blocked
      }

      // Then check if path is allowed
      const allowedPathsList = await db
        .select()
        .from(allowedPaths)
        .where(
          and(
            eq(allowedPaths.type, 'allowed'),
            eq(allowedPaths.isActive, true)
          )
        );

      // Check if the given path starts with any of the allowed paths or is exactly one of them
      return allowedPathsList.some(allowedPath => {
        return path === allowedPath.path || path.startsWith(allowedPath.path + '/');
      });

    } catch (error) {
      logger.error('Error checking path allowance:', error);
      return false; // Default to false in case of error
    }
  }

  async getActivePaths(type: 'allowed' | 'blocked'): Promise<string[]> {
    const paths = await db
      .select({ path: allowedPaths.path })
      .from(allowedPaths)
      .where(
        and(
          eq(allowedPaths.type, type),
          eq(allowedPaths.isActive, true)
        )
      );

    return paths.map(p => p.path);
  }
}

export const storage = new DatabaseStorage();