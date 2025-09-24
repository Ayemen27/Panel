import {
  users,
  applications,
  domains,
  sslCertificates,
  nginxConfigs,
  notifications,
  systemLogs,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, count, gte } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

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
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
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
    limit?: number 
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
      expiringSoon: certs.filter(cert => 
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
}

export const storage = new DatabaseStorage();
