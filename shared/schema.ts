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
  unique,
  check,
  foreignKey,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for authentication
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User roles enum
export const userRoleEnum = pgEnum('user_role', ['admin', 'user', 'moderator', 'viewer']);

// User storage table with username/password authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username").unique(),
  email: varchar("email").unique(),
  password: varchar("password").notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: userRoleEnum("role").default('user'),
  isActive: boolean("is_active").default(true),
  permissions: text("permissions").array().default(sql`'{}'::text[]`),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});


// Application status enum
export const appStatusEnum = pgEnum('app_status', ['running', 'stopped', 'error', 'starting']);

// File management enums
export const fileTypeEnum = pgEnum('file_type', ['file', 'folder']);
export const permissionLevelEnum = pgEnum('permission_level', ['read', 'write', 'delete', 'admin']);
export const auditActionEnum = pgEnum('audit_action', ['create', 'update', 'delete', 'copy', 'move', 'rename', 'share', 'access', 'restore']);
export const lockTypeEnum = pgEnum('lock_type', ['read', 'write', 'exclusive']);
export const pathTypeEnum = pgEnum('path_type', ['allowed', 'blocked']);

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

// Files table for tracking files and folders
export const files = pgTable("files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  type: fileTypeEnum("type").notNull(),
  path: text("path").notNull(),
  parentId: varchar("parent_id"),
  filePath: text("file_path"), // Physical file path on disk for better security and performance
  size: integer("size").default(0), // Size in bytes
  mimeType: varchar("mime_type"),
  content: text("content"), // Only for small sensitive text files, encrypted
  checksum: varchar("checksum"), // File integrity check
  ownerId: varchar("owner_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  isPublic: boolean("is_public").default(false),
  tags: text("tags").array().default(sql`'{}'::text[]`),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_files_path").on(table.path),
  index("IDX_files_parent").on(table.parentId),
  index("IDX_files_owner").on(table.ownerId),
  index("IDX_files_type").on(table.type),
  index("IDX_files_owner_parent").on(table.ownerId, table.parentId), // Composite index for performance
  unique("UQ_files_owner_parent_name").on(table.ownerId, table.parentId, table.name), // Prevent duplicate names in same folder
  foreignKey({
    columns: [table.parentId],
    foreignColumns: [table.id],
    name: "FK_files_parent",
  }).onDelete("cascade"), // Cascade delete when parent folder is deleted
]);

// File trash table for deleted files
export const fileTrash = pgTable("file_trash", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  originalFileId: varchar("original_file_id").notNull(),
  originalPath: text("original_path").notNull(),
  name: varchar("name").notNull(),
  type: fileTypeEnum("type").notNull(),
  filePath: text("file_path"), // Physical file path for deleted files
  size: integer("size").default(0),
  mimeType: varchar("mime_type"),
  content: text("content"), // Only for small sensitive text files, encrypted
  checksum: varchar("checksum"),
  ownerId: varchar("owner_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  deletedBy: varchar("deleted_by").references(() => users.id, { onDelete: "cascade" }).notNull(),
  deletedAt: timestamp("deleted_at").defaultNow(),
  metadata: jsonb("metadata").default({}),
}, (table) => [
  index("IDX_file_trash_owner").on(table.ownerId),
  index("IDX_file_trash_deleted_by").on(table.deletedBy),
  index("IDX_file_trash_deleted_at").on(table.deletedAt),
  index("IDX_file_trash_owner_deleted").on(table.ownerId, table.deletedAt), // Composite index for performance
]);

// File backups table for file versions
export const fileBackups = pgTable("file_backups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fileId: varchar("file_id").references(() => files.id, { onDelete: "cascade" }).notNull(),
  version: integer("version").notNull(),
  name: varchar("name").notNull(),
  filePath: text("file_path"), // Physical backup file path on disk
  size: integer("size").default(0),
  mimeType: varchar("mime_type"),
  content: text("content"), // Only for small sensitive text files, encrypted
  checksum: varchar("checksum"),
  comment: text("comment"), // Version comment
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  metadata: jsonb("metadata").default({}),
}, (table) => [
  index("IDX_file_backups_file").on(table.fileId),
  index("IDX_file_backups_version").on(table.fileId, table.version),
  index("IDX_file_backups_created_by").on(table.createdBy),
  unique("UQ_file_backups_file_version").on(table.fileId, table.version), // Prevent duplicate versions
]);

// File audit logs table for tracking operations
export const fileAuditLogs = pgTable("file_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fileId: varchar("file_id").references(() => files.id, { onDelete: "set null" }), // Can be null for system-wide operations
  action: auditActionEnum("action").notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  details: text("details"), // Additional operation details
  oldValue: jsonb("old_value"), // Previous state
  newValue: jsonb("new_value"), // New state
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  sessionId: varchar("session_id"),
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => [
  index("IDX_audit_logs_file").on(table.fileId),
  index("IDX_audit_logs_user").on(table.userId),
  index("IDX_audit_logs_action").on(table.action),
  index("IDX_audit_logs_timestamp").on(table.timestamp),
  index("IDX_audit_logs_user_timestamp").on(table.userId, table.timestamp), // Composite index for performance
]);

// File locks table for preventing conflicts
export const fileLocks = pgTable("file_locks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fileId: varchar("file_id").references(() => files.id, { onDelete: "cascade" }).notNull(),
  lockType: lockTypeEnum("lock_type").notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  sessionId: varchar("session_id"),
  reason: text("reason"), // Why the file is locked
  expiresAt: timestamp("expires_at"), // When the lock expires
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_file_locks_file").on(table.fileId),
  index("IDX_file_locks_user").on(table.userId),
  index("IDX_file_locks_expires").on(table.expiresAt),
  unique("UQ_file_locks_file_active").on(table.fileId, table.lockType), // Prevent multiple active locks of same type on same file
]);

// File permissions table for access control
export const filePermissions = pgTable("file_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fileId: varchar("file_id").references(() => files.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }), // Can be null for role-based permissions
  userRole: userRoleEnum("user_role"), // Role-based permission
  permission: permissionLevelEnum("permission").notNull(),
  grantedBy: varchar("granted_by").references(() => users.id, { onDelete: "cascade" }).notNull(),
  expiresAt: timestamp("expires_at"), // When permission expires
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_file_permissions_file").on(table.fileId),
  index("IDX_file_permissions_user").on(table.userId),
  index("IDX_file_permissions_role").on(table.userRole),
  index("IDX_file_permissions_granted_by").on(table.grantedBy),
  unique("UQ_file_permissions_file_user").on(table.fileId, table.userId, table.permission), // Prevent duplicate user permissions
  unique("UQ_file_permissions_file_role").on(table.fileId, table.userRole, table.permission), // Prevent duplicate role permissions
  check("CHK_file_permissions_user_or_role", sql`(user_id IS NOT NULL AND user_role IS NULL) OR (user_id IS NULL AND user_role IS NOT NULL)`), // Ensure only one of userId or userRole is set
]);

// Allowed paths table for file manager access control
export const allowedPaths = pgTable("allowed_paths", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  path: text("path").notNull(),
  type: pathTypeEnum("type").notNull(),
  description: text("description"),
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),
  addedBy: varchar("added_by").references(() => users.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_allowed_paths_path").on(table.path),
  index("IDX_allowed_paths_type").on(table.type),
  index("IDX_allowed_paths_added_by").on(table.addedBy),
  index("IDX_allowed_paths_active").on(table.isActive),
  index("IDX_allowed_paths_default").on(table.isDefault),
  index("IDX_allowed_paths_type_active").on(table.type, table.isActive), // Composite index for performance
  unique("UQ_allowed_paths_path_type").on(table.path, table.type), // Prevent duplicate path-type combinations
]);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  applications: many(applications),
  notifications: many(notifications),
  files: many(files),
  deletedFiles: many(fileTrash),
  fileBackups: many(fileBackups),
  auditLogs: many(fileAuditLogs),
  fileLocks: many(fileLocks),
  grantedPermissions: many(filePermissions, { relationName: "grantedPermissions" }),
  receivedPermissions: many(filePermissions, { relationName: "receivedPermissions" }),
  allowedPaths: many(allowedPaths),
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

// File management relations
export const filesRelations = relations(files, ({ one, many }) => ({
  owner: one(users, {
    fields: [files.ownerId],
    references: [users.id],
  }),
  parent: one(files, {
    fields: [files.parentId],
    references: [files.id],
    relationName: "parentChild",
  }),
  children: many(files, { relationName: "parentChild" }),
  backups: many(fileBackups),
  auditLogs: many(fileAuditLogs),
  locks: many(fileLocks),
  permissions: many(filePermissions),
}));

export const fileTrashRelations = relations(fileTrash, ({ one }) => ({
  owner: one(users, {
    fields: [fileTrash.ownerId],
    references: [users.id],
    relationName: "ownedDeletedFiles",
  }),
  deletedBy: one(users, {
    fields: [fileTrash.deletedBy],
    references: [users.id],
    relationName: "deletedFiles",
  }),
}));

export const fileBackupsRelations = relations(fileBackups, ({ one }) => ({
  file: one(files, {
    fields: [fileBackups.fileId],
    references: [files.id],
  }),
  createdBy: one(users, {
    fields: [fileBackups.createdBy],
    references: [users.id],
  }),
}));

export const fileAuditLogsRelations = relations(fileAuditLogs, ({ one }) => ({
  file: one(files, {
    fields: [fileAuditLogs.fileId],
    references: [files.id],
  }),
  user: one(users, {
    fields: [fileAuditLogs.userId],
    references: [users.id],
  }),
}));

export const fileLocksRelations = relations(fileLocks, ({ one }) => ({
  file: one(files, {
    fields: [fileLocks.fileId],
    references: [files.id],
  }),
  user: one(users, {
    fields: [fileLocks.userId],
    references: [users.id],
  }),
}));

export const filePermissionsRelations = relations(filePermissions, ({ one }) => ({
  file: one(files, {
    fields: [filePermissions.fileId],
    references: [files.id],
  }),
  user: one(users, {
    fields: [filePermissions.userId],
    references: [users.id],
    relationName: "receivedPermissions",
  }),
  grantedBy: one(users, {
    fields: [filePermissions.grantedBy],
    references: [users.id],
    relationName: "grantedPermissions",
  }),
}));

export const allowedPathsRelations = relations(allowedPaths, ({ one }) => ({
  addedBy: one(users, {
    fields: [allowedPaths.addedBy],
    references: [users.id],
  }),
}));

// Schema types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

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

// File management types
export type File = typeof files.$inferSelect;
export type InsertFile = typeof files.$inferInsert;

export type FileTrash = typeof fileTrash.$inferSelect;
export type InsertFileTrash = typeof fileTrash.$inferInsert;

export type FileBackup = typeof fileBackups.$inferSelect;
export type InsertFileBackup = typeof fileBackups.$inferInsert;

export type FileAuditLog = typeof fileAuditLogs.$inferSelect;
export type InsertFileAuditLog = typeof fileAuditLogs.$inferInsert;

export type FileLock = typeof fileLocks.$inferSelect;
export type InsertFileLock = typeof fileLocks.$inferInsert;

export type FilePermission = typeof filePermissions.$inferSelect;
export type InsertFilePermission = typeof filePermissions.$inferInsert;

export type AllowedPath = typeof allowedPaths.$inferSelect;
export type InsertAllowedPath = typeof allowedPaths.$inferInsert;

// Log entry type for application logs
export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  source: string;
}

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

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

// File management insert schemas
export const insertFileSchema = createInsertSchema(files).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFileTrashSchema = createInsertSchema(fileTrash).omit({
  id: true,
  deletedAt: true,
});

export const insertFileBackupSchema = createInsertSchema(fileBackups).omit({
  id: true,
  createdAt: true,
});

export const insertFileAuditLogSchema = createInsertSchema(fileAuditLogs).omit({
  id: true,
  timestamp: true,
});

export const insertFileLockSchema = createInsertSchema(fileLocks).omit({
  id: true,
  createdAt: true,
});

export const insertFilePermissionSchema = createInsertSchema(filePermissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAllowedPathSchema = createInsertSchema(allowedPaths).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
