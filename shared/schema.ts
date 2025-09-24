import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Application status enum
export const appStatusEnum = pgEnum('app_status', ['running', 'stopped', 'error', 'starting']);

// Applications table
export const applications = pgTable("applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  description: text("description"),
  path: text("path").notNull(),
  port: integer("port").notNull(),
  command: text("command").notNull(),
  usePm2: boolean("use_pm2").default(true),
  status: appStatusEnum("status").default('stopped'),
  envVars: jsonb("env_vars").default({}),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Domains table
export const domains = pgTable("domains", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  domain: varchar("domain").notNull().unique(),
  applicationId: varchar("application_id").references(() => applications.id),
  dnsStatus: varchar("dns_status").default('pending'), // 'ok', 'nxdomain', 'pending'
  sslStatus: varchar("ssl_status").default('none'), // 'valid', 'expired', 'none', 'pending'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// SSL Certificates table
export const sslCertificates = pgTable("ssl_certificates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  domainId: varchar("domain_id").references(() => domains.id),
  issuer: varchar("issuer").default('letsencrypt'),
  issuedAt: timestamp("issued_at"),
  expiresAt: timestamp("expires_at"),
  certPath: text("cert_path"),
  keyPath: text("key_path"),
  status: varchar("status").default('pending'), // 'valid', 'expired', 'pending', 'failed'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Nginx configurations table
export const nginxConfigs = pgTable("nginx_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => applications.id),
  configPath: text("config_path").notNull(),
  content: text("content").notNull(),
  enabled: boolean("enabled").default(false),
  lastTest: timestamp("last_test"),
  testResult: text("test_result"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Notifications table
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: varchar("type").notNull(), // 'error', 'warning', 'info', 'success'
  level: varchar("level").notNull(), // 'high', 'medium', 'low'
  title: text("title").notNull(),
  message: text("message").notNull(),
  source: varchar("source"), // 'nginx', 'pm2', 'ssl', 'system'
  applicationId: varchar("application_id").references(() => applications.id),
  acknowledged: boolean("acknowledged").default(false),
  resolved: boolean("resolved").default(false),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// System logs table
export const systemLogs = pgTable("system_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  source: varchar("source").notNull(), // 'nginx', 'pm2', 'app', 'system'
  level: varchar("level").notNull(), // 'error', 'warn', 'info', 'debug'
  message: text("message").notNull(),
  applicationId: varchar("application_id").references(() => applications.id),
  timestamp: timestamp("timestamp").defaultNow(),
  metadata: jsonb("metadata"),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  applications: many(applications),
  notifications: many(notifications),
}));

export const applicationsRelations = relations(applications, ({ one, many }) => ({
  user: one(users, {
    fields: [applications.userId],
    references: [users.id],
  }),
  domains: many(domains),
  nginxConfigs: many(nginxConfigs),
  notifications: many(notifications),
  systemLogs: many(systemLogs),
}));

export const domainsRelations = relations(domains, ({ one, many }) => ({
  application: one(applications, {
    fields: [domains.applicationId],
    references: [applications.id],
  }),
  sslCertificates: many(sslCertificates),
}));

export const sslCertificatesRelations = relations(sslCertificates, ({ one }) => ({
  domain: one(domains, {
    fields: [sslCertificates.domainId],
    references: [domains.id],
  }),
}));

export const nginxConfigsRelations = relations(nginxConfigs, ({ one }) => ({
  application: one(applications, {
    fields: [nginxConfigs.applicationId],
    references: [applications.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  application: one(applications, {
    fields: [notifications.applicationId],
    references: [applications.id],
  }),
}));

export const systemLogsRelations = relations(systemLogs, ({ one }) => ({
  application: one(applications, {
    fields: [systemLogs.applicationId],
    references: [applications.id],
  }),
}));

// Schema types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export type Application = typeof applications.$inferSelect;
export type InsertApplication = typeof applications.$inferInsert;

export type Domain = typeof domains.$inferSelect;
export type InsertDomain = typeof domains.$inferInsert;

export type SslCertificate = typeof sslCertificates.$inferSelect;
export type InsertSslCertificate = typeof sslCertificates.$inferInsert;

export type NginxConfig = typeof nginxConfigs.$inferSelect;
export type InsertNginxConfig = typeof nginxConfigs.$inferInsert;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

export type SystemLog = typeof systemLogs.$inferSelect;
export type InsertSystemLog = typeof systemLogs.$inferInsert;

// Insert schemas
export const insertApplicationSchema = createInsertSchema(applications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDomainSchema = createInsertSchema(domains).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSslCertificateSchema = createInsertSchema(sslCertificates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNginxConfigSchema = createInsertSchema(nginxConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSystemLogSchema = createInsertSchema(systemLogs).omit({
  id: true,
  timestamp: true,
});
