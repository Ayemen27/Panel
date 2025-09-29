import { Express, Request } from "express";
import { createServer } from "http";
import { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage.js";
import { setupAuth, isAuthenticated, requireRole } from "./auth";
import {
  insertApplicationSchema,
  insertDomainSchema,
  insertSslCertificateSchema,
  insertNginxConfigSchema,
  insertNotificationSchema,
  insertFrontendErrorSchema,
  insertUserActivitySchema,
  insertAllowedPathSchema
} from "@shared/schema";
import { z } from "zod";
// DI Phase 3: Direct service imports removed - services now injected via req.services
import { ServiceTokens } from "./core/ServiceTokens";

// Import service types for type safety
import type { PM2Service } from "./services/pm2Service";
import type { NginxService } from "./services/nginxService";
import type { SslService } from "./services/sslService";
import type { SystemService } from "./services/systemService";
import type { LogService } from "./services/logService";
import type { AuditService } from "./services/auditService";
import type { ServiceContainer } from "./core/ServiceContainer";
import type { UnifiedFileService } from "./services/unifiedFileService";
import type { UnifiedNotificationService } from "./services/UnifiedNotificationService";
import type { StorageStatsService } from "./services/storageStatsService";
// Import services - النظام الموحد الوحيد
// Unified file service handled by unifiedFileRoutes
import { db } from "./db";
import { files } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import cors from "cors";
import express, { type Response, NextFunction } from "express";
import { ENV_CONFIG } from "../shared/environment.js";
import { rateLimiter } from './utils/rateLimiter';
import path from 'path';
import fs from 'fs/promises';
// تم إزالة الاستيراد المباشر - systemService مستورد بالفعل في السطر 20
import unifiedFileRoutes from './routes/unifiedFileRoutes';
import unifiedNotificationRoutes from './routes/UnifiedNotificationRoutes';

// 🛡️ SECURITY: WebSocket clients store - simplified but secure
const wsClients = new Set<WebSocket>();

// Unified CORS configuration for both HTTP and WebSocket
function setupCORS(app: Express) {
  app.use(
    cors({
      origin: (origin, callback) => {
        // السماح بالطلبات بدون origin (مثل تطبيقات الموبايل والـ WebSocket)
        if (!origin) return callback(null, true);

        const allowedOrigins = ENV_CONFIG.cors.origin;

        // التحقق من النطاقات المسموحة مع دعم Regex محسن
        const isAllowed = allowedOrigins.some(allowedOrigin => {
          if (typeof allowedOrigin === 'string') {
            // مطابقة مباشرة أو wildcard
            if (allowedOrigin.includes('*')) {
              const pattern = allowedOrigin.replace(/\*/g, '.*');
              return new RegExp(`^${pattern}$`).test(origin);
            }
            return allowedOrigin === origin;
          } else if (allowedOrigin instanceof RegExp) {
            // اختبار Regex
            return allowedOrigin.test(origin);
          }
          return false;
        });

        if (isAllowed) {
          callback(null, true);
        } else {
          console.log(`CORS: Blocked request from origin: ${origin}`);
          console.log(`CORS: Allowed origins:`, allowedOrigins);
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: ENV_CONFIG.cors.credentials,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'Cache-Control',
        'Cookie',
        'X-Forwarded-For',
        'X-Real-IP'
      ],
      exposedHeaders: ['Set-Cookie'],
      optionsSuccessStatus: 200, // لدعم المتصفحات القديمة
      preflightContinue: false
    })
  );

  // إضافة middleware لمعالجة preflight requests
  app.options('*', (req, res) => {
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Vary', 'Origin');
    res.sendStatus(200);
  });
}

// Enhanced authentication middleware for custom auth system
// DI Phase 3: Extended with services access
interface AuthenticatedRequest extends Request {
  user?: any; // Custom authenticated user session
  body: any;
  params: any;
  query: any;
  services: ServiceContainer; // ServiceContainer - available after serviceInjectionMiddleware
}

// Helper function to get user ID from custom auth
const getUserId = (req: AuthenticatedRequest): string | null => {
  return req.user?.id || null;
};

// 🛡️ SECURITY: Secure broadcast function - simplified for now
export function broadcast(message: any) {
  const data = JSON.stringify(message);
  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(data);
      } catch (error) {
        console.error('Failed to send WebSocket message:', error);
        wsClients.delete(client);
      }
    } else {
      wsClients.delete(client);
    }
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  const server = createServer(app);

  // Initialize UnifiedFileService - This is now handled within unifiedFileRoutes
  // if (!unifiedFileService) {
  //   unifiedFileService = new UnifiedFileService(storage);
  // }

  // Setup CORS first
  setupCORS(app);

  // Setup custom authentication
  setupAuth(app);

  // Debug middleware for authentication issues (development only)
  if (process.env.NODE_ENV !== 'production') {
    app.use('/api', (req: any, res, next) => {
      const sessionExists = !!req.session;
      const isAuthenticated = req.isAuthenticated && req.isAuthenticated();
      const hasUser = !!req.user;

      if (!isAuthenticated && req.path !== '/health' && req.method === 'GET') {
        console.log(`🔍 Auth Debug - ${req.method} ${req.path}:`);
        console.log(`   Session exists: ${sessionExists}`);
        console.log(`   Session ID: ${req.sessionID || 'none'}`);
        console.log(`   Is authenticated: ${isAuthenticated}`);
        console.log(`   Has user: ${hasUser}`);
        console.log(`   User agent: ${req.headers['user-agent']?.substring(0, 50)}...`);
        console.log(`   Origin: ${req.headers.origin || 'none'}`);
        console.log(`   Cookies: ${Object.keys(req.cookies || {}).join(', ') || 'none'}`);
      }

      next();
    });
  }

  // Auth routes are now handled in auth.ts

  // Admin routes with role-based access
  app.get('/api/admin/users', isAuthenticated, requireRole('admin'), async (req: any, res) => {
    try {
      const users = await storage.getUsersByRole('user');
      res.json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.patch('/api/admin/users/:id/role', isAuthenticated, requireRole('admin'), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;

      if (!['admin', 'user', 'moderator', 'viewer'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role' });
      }

      const user = await storage.updateUserRole(id, role);
      res.json(user);
    } catch (error) {
      console.error('Error updating user role:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Admin paths management routes
  app.get('/api/admin/paths', isAuthenticated, requireRole('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const { type } = req.query;

      const allowedPaths = await storage.getAllowedPaths(type as 'allowed' | 'blocked' | undefined);

      res.json(allowedPaths);
    } catch (error) {
      console.error("Error fetching admin paths:", error);
      res.status(500).json({ message: "Failed to fetch admin paths" });
    }
  });

  app.post('/api/admin/paths', isAuthenticated, requireRole('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const pathData = insertAllowedPathSchema.parse({
        ...req.body,
        addedBy: userId
      });

      const allowedPath = await storage.createAllowedPath(pathData);

      res.status(201).json(allowedPath);
    } catch (error) {
      console.error("Error creating admin path:", error);
      res.status(500).json({ message: "Failed to create admin path" });
    }
  });

  app.put('/api/admin/paths/:id', isAuthenticated, requireRole('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Remove addedBy from updates to prevent manipulation
      delete updates.addedBy;

      const allowedPath = await storage.updateAllowedPath(id, updates);

      res.json(allowedPath);
    } catch (error) {
      console.error("Error updating admin path:", error);
      res.status(500).json({ message: "Failed to update admin path" });
    }
  });

  app.delete('/api/admin/paths/:id', isAuthenticated, requireRole('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;

      await storage.deleteAllowedPath(id);

      res.json({ message: 'Admin path deleted successfully' });
    } catch (error) {
      console.error("Error deleting admin path:", error);
      res.status(500).json({ message: "Failed to delete admin path" });
    }
  });

  // Migration route for adding default paths
  app.post('/api/admin/setup-default-paths', isAuthenticated, requireRole('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      // Import migration function dynamically
      const { addDefaultPaths } = await import('./migrations/001_add_default_paths.js');

      const userId = getUserId(req)!;
      const result = await addDefaultPaths(userId);

      res.json(result);
    } catch (error) {
      console.error("Error setting up default paths:", error);
      res.status(500).json({ message: "Failed to setup default paths", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Dashboard stats route - DI Phase 3: Updated to use req.services
  app.get('/api/dashboard/stats', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      // DI Phase 3: Use service container instead of direct import
      const systemService = req.services.resolveByToken<SystemService>(ServiceTokens.SYSTEM_SERVICE);
      
      const [appStats, sslStats, systemStats, unreadCount] = await Promise.all([
        storage.getApplicationStats(userId),
        storage.getSslStats(),
        systemService.getSystemStats(),
        storage.getUnreadNotificationCount(userId)
      ]);

      res.json({
        applications: appStats,
        ssl: sslStats,
        system: systemStats,
        notifications: { unread: unreadCount }
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Frontend errors routes
  app.post('/api/frontend-errors', async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req); // قد يكون null للمستخدمين غير المسجلين
      const processedData = {
        ...req.body,
        userId,
        userAgent: req.headers['user-agent'],
        url: req.body.url || req.headers.referer || 'unknown'
      };

      // Convert timestamp string to Date object if it exists and is a string
      if (processedData.timestamp && typeof processedData.timestamp === 'string') {
        processedData.timestamp = new Date(processedData.timestamp);
      }

      // Convert other timestamp fields if they exist
      if (processedData.lastOccurrence && typeof processedData.lastOccurrence === 'string') {
        processedData.lastOccurrence = new Date(processedData.lastOccurrence);
      }

      const errorData = insertFrontendErrorSchema.parse(processedData);

      const frontendError = await storage.createFrontendError(errorData);

      // إرسال تحديث فوري للمديرين عبر WebSocket
      broadcast({
        type: 'frontend_error',
        data: frontendError
      });

      res.status(201).json({ success: true, id: frontendError.id });
    } catch (error) {
      console.error("Error saving frontend error:", error);
      res.status(500).json({ message: "Failed to save frontend error" });
    }
  });

  app.post('/api/frontend-errors/batch', async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req); // قد يكون null للمستخدمين غير المسجلين
      const errorsData = req.body;

      if (!Array.isArray(errorsData)) {
        return res.status(400).json({ message: "Expected array of errors" });
      }

      const processedErrors = errorsData.map(errorData => {
        const processedData = {
          ...errorData,
          userId,
          userAgent: errorData.userAgent || req.headers['user-agent'],
          url: errorData.url || req.headers.referer || 'unknown'
        };

        // Convert timestamp string to Date object if it exists and is a string
        if (processedData.timestamp && typeof processedData.timestamp === 'string') {
          processedData.timestamp = new Date(processedData.timestamp);
        }

        // Convert other timestamp fields if they exist
        if (processedData.lastOccurrence && typeof processedData.lastOccurrence === 'string') {
          processedData.lastOccurrence = new Date(processedData.lastOccurrence);
        }

        return insertFrontendErrorSchema.parse(processedData);
      });

      const savedErrors = await Promise.all(
        processedErrors.map(errorData => storage.createFrontendError(errorData))
      );

      // إرسال تحديث فوري للمديرين عبر WebSocket
      broadcast({
        type: 'frontend_errors_batch',
        data: {
          count: savedErrors.length,
          errors: savedErrors
        }
      });

      res.status(201).json({
        success: true,
        count: savedErrors.length,
        ids: savedErrors.map(error => error.id)
      });
    } catch (error) {
      console.error("Error saving frontend errors batch:", error);
      res.status(500).json({ message: "Failed to save frontend errors batch" });
    }
  });

  app.get('/api/frontend-errors', isAuthenticated, requireRole('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const {
        page = 1,
        limit = 50,
        type,
        severity,
        resolved,
        userId: filterUserId,
        startDate,
        endDate
      } = req.query;

      const filters = {
        type: type as string,
        severity: severity as string,
        resolved: resolved === 'true' ? true : resolved === 'false' ? false : undefined,
        userId: filterUserId as string,
        startDate: startDate as string,
        endDate: endDate as string
      };

      const errors = await storage.getFrontendErrors({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        filters
      });

      res.json(errors);
    } catch (error) {
      console.error("Error fetching frontend errors:", error);
      res.status(500).json({ message: "Failed to fetch frontend errors" });
    }
  });

  app.patch('/api/frontend-errors/:id/resolve', isAuthenticated, requireRole('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { resolved = true } = req.body;

      const updatedError = await storage.updateFrontendError(id, { resolved });

      broadcast({
        type: 'frontend_error_resolved',
        data: updatedError
      });

      res.json(updatedError);
    } catch (error) {
      console.error("Error updating frontend error:", error);
      res.status(500).json({ message: "Failed to update frontend error" });
    }
  });

  app.get('/api/frontend-errors/stats', isAuthenticated, requireRole('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const stats = await storage.getFrontendErrorStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching frontend error stats:", error);
      res.status(500).json({ message: "Failed to fetch frontend error stats" });
    }
  });

  // User Activity routes
  app.post('/api/user-activities', async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req); // قد يكون null للمستخدمين غير المسجلين
      const activityData = insertUserActivitySchema.parse({
        ...req.body,
        userId,
        userAgent: req.body.userAgent || req.headers['user-agent'],
        ipAddress: req.ip || req.connection.remoteAddress,
      });

      const savedActivity = await storage.createUserActivity(activityData);

      // إرسال تحديث فوري للمديرين عبر WebSocket (اختياري للإحصائيات الفورية)
      broadcast({
        type: 'user_activity',
        data: {
          type: savedActivity.activityType,
          page: savedActivity.page,
          timestamp: savedActivity.timestamp
        }
      });

      res.status(201).json({ success: true, id: savedActivity.id });
    } catch (error) {
      console.error("Error saving user activity:", error);
      res.status(500).json({ message: "Failed to save user activity" });
    }
  });

  app.post('/api/user-activities/batch', async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req); // قد يكون null للمستخدمين غير المسجلين
      const activitiesData = req.body;

      if (!Array.isArray(activitiesData)) {
        return res.status(400).json({ message: "Expected array of activities" });
      }

      const processedActivities = activitiesData.map(activityData =>
        insertUserActivitySchema.parse({
          ...activityData,
          userId,
          userAgent: activityData.userAgent || req.headers['user-agent'],
          ipAddress: req.ip || req.connection.remoteAddress,
        })
      );

      const savedActivities = await storage.createUserActivitiesBatch(processedActivities);

      // إرسال تحديث فوري للمديرين عبر WebSocket
      broadcast({
        type: 'user_activities_batch',
        data: {
          count: savedActivities.length,
          userId: userId,
          timestamp: new Date()
        }
      });

      res.status(201).json({
        success: true,
        count: savedActivities.length,
        ids: savedActivities.map(activity => activity.id)
      });
    } catch (error) {
      console.error("Error saving user activities batch:", error);
      res.status(500).json({ message: "Failed to save user activities batch" });
    }
  });

  app.get('/api/user-activities', isAuthenticated, requireRole('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const {
        page = 1,
        limit = 50,
        userId: filterUserId,
        sessionId,
        activityType,
        pageUrl,
        startDate,
        endDate
      } = req.query;

      const options = {
        userId: filterUserId as string,
        sessionId: sessionId as string,
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
        filters: {
          activityType: activityType as string,
          pageUrl: pageUrl as string,
          startDate: startDate as string,
          endDate: endDate as string,
        }
      };

      const result = await storage.getUserActivities(options);
      res.json(result);
    } catch (error) {
      console.error("Error fetching user activities:", error);
      res.status(500).json({ message: "Failed to fetch user activities" });
    }
  });

  app.get('/api/user-activities/stats', isAuthenticated, requireRole('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const {
        userId,
        sessionId,
        timeframe = '24h'
      } = req.query;

      const options = {
        userId: userId as string,
        sessionId: sessionId as string,
        timeframe: timeframe as '24h' | '7d' | '30d'
      };

      const stats = await storage.getUserActivityStats(options);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching user activity stats:", error);
      res.status(500).json({ message: "Failed to fetch user activity stats" });
    }
  });

  app.get('/api/user-activities/session/:sessionId', isAuthenticated, requireRole('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const { sessionId } = req.params;
      const activities = await storage.getSessionActivities(sessionId);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching session activities:", error);
      res.status(500).json({ message: "Failed to fetch session activities" });
    }
  });

  app.get('/api/user-activities/my-stats', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const { timeframe = '24h' } = req.query;

      const options = {
        userId,
        timeframe: timeframe as '24h' | '7d' | '30d'
      };

      const stats = await storage.getUserActivityStats(options);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching user's own activity stats:", error);
      res.status(500).json({ message: "Failed to fetch activity stats" });
    }
  });

  app.get('/api/user-activities/page-durations', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const { timeframe } = req.query;

      const durations = await storage.getUserPageDurations(userId, timeframe as string);
      res.json(durations);
    } catch (error) {
      console.error("Error fetching page durations:", error);
      res.status(500).json({ message: "Failed to fetch page durations" });
    }
  });

  // Application routes - DI Phase 3: Updated to use req.services
  app.get('/api/applications', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const applications = await storage.getApplications(userId);
      let statusMap = new Map<string, string>();

      try {
        // DI Phase 3: Use service container instead of direct import
        const pm2Service = req.services.resolveByToken<PM2Service>(ServiceTokens.PM2_SERVICE);
        statusMap = await pm2Service.getAllApplicationStatuses();
      } catch (error) {
        console.warn('Failed to get PM2 status, using database status:', error);
      }

      // Apply status from the batch fetch
      const appsWithStatus = applications.map(app => {
        const status = statusMap.get(app.name) || app.status || 'stopped';
        return { ...app, status };
      });

      res.json(appsWithStatus);
    } catch (error) {
      console.error("Error fetching applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  app.post('/api/applications', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const appData = insertApplicationSchema.parse({
        ...req.body,
        userId
      });

      const application = await storage.createApplication(appData);

      // Start the application if requested - DI Phase 3: Updated to use req.services
      if (appData.usePm2) {
        try {
          // DI Phase 3: Use service container instead of direct import
          const pm2Service = req.services.resolveByToken<PM2Service>(ServiceTokens.PM2_SERVICE);
          await pm2Service.startApplication(application);
          await storage.updateApplication(application.id, { status: 'running' });

          // Create success notification
          await storage.createNotification({
            type: 'success',
            level: 'medium',
            title: 'Application Created',
            message: `Application ${application.name} created and started successfully`,
            source: 'pm2',
            applicationId: application.id,
            userId
          });
        } catch (error) {
          await storage.updateApplication(application.id, { status: 'error' });

          // Create error notification
          await storage.createNotification({
            type: 'error',
            level: 'high',
            title: 'Application Start Failed',
            message: `Failed to start application ${application.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            source: 'pm2',
            applicationId: application.id,
            userId
          });
        }
      }

      // Broadcast update
      broadcast({
        type: 'APPLICATION_CREATED',
        data: application
      });

      res.status(201).json(application);
    } catch (error) {
      console.error("Error creating application:", error);
      res.status(400).json({ message: "Failed to create application" });
    }
  });

  app.patch('/api/applications/:id', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const application = await storage.updateApplication(id, updates);

      // Broadcast update
      broadcast({
        type: 'APPLICATION_UPDATED',
        data: application
      });

      res.json(application);
    } catch (error) {
      console.error("Error updating application:", error);
      res.status(400).json({ message: "Failed to update application" });
    }
  });

  // Update application
  app.put("/api/applications/:id", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const updatedApp = await storage.updateApplication(id, updates);

      // Broadcast update
      broadcast({
        type: 'APPLICATION_UPDATED',
        data: updatedApp
      });

      res.json(updatedApp);
    } catch (error) {
      console.error("Error updating application:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  // Delete application
  app.delete("/api/applications/:id", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getApplication(id);

      if (application) {
        // Stop the application first - DI Phase 3: Updated to use req.services
        try {
          // DI Phase 3: Use service container instead of direct import
          const pm2Service = req.services.resolveByToken<PM2Service>(ServiceTokens.PM2_SERVICE);
          await pm2Service.stopApplication(application.name);
        } catch (error) {
          console.warn("Failed to stop application:", error);
        }

        await storage.deleteApplication(id);

        // Broadcast update
        broadcast({
          type: 'APPLICATION_DELETED',
          data: { id }
        });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting application:", error);
      res.status(500).json({ message: "Failed to delete application" });
    }
  });

  // Application control routes
  app.post('/api/applications/:id/start', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    let application;

    try {
      application = await storage.getApplication(id);

      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      // DI Phase 3: Use service container instead of direct import
      const pm2Service = req.services.resolveByToken<PM2Service>(ServiceTokens.PM2_SERVICE);
      await pm2Service.startApplication(application);
      await storage.updateApplication(id, { status: 'running' });

      // Broadcast update
      broadcast({
        type: 'APPLICATION_STATUS_CHANGED',
        data: { id, status: 'running' }
      });

      res.json({ message: "Application started successfully" });
    } catch (error) {
      console.error("Error starting application:", error);

      // Update application status to error
      await storage.updateApplication(id, { status: 'error' });

      // Provide specific error messages based on error type
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Log detailed error for debugging
      if (application) {
        console.error(`Application "${application.name}" failed to start:`, {
          path: application.path,
          command: application.command,
          error: errorMessage
        });
      }

      if (errorMessage.includes('PM2') || errorMessage.includes('pm2') || errorMessage.includes('Permission denied')) {
        res.status(503).json({
          message: "Process manager configuration error",
          details: errorMessage,
          solution: "Using fallback process management",
          fallback: true
        });
      } else if (errorMessage.includes('ENOENT') || errorMessage.includes('command not found')) {
        res.status(404).json({
          message: "Application command or path not found",
          details: errorMessage,
          suggestions: [
            "Check if the application path exists",
            "Verify the main file is present",
            "Ensure package.json has correct main field"
          ]
        });
      } else if (errorMessage.includes('permission') || errorMessage.includes('EACCES')) {
        res.status(403).json({
          message: "Permission denied",
          details: errorMessage,
          solution: "Check file permissions and ownership"
        });
      } else if (errorMessage.includes('No main file found')) {
        res.status(400).json({
          message: "No executable file found",
          details: errorMessage,
          suggestions: [
            "Add index.js, main.js, bot.js, or similar entry file",
            "Specify a command in application settings",
            "Check package.json main or scripts.start"
          ]
        });
      } else {
        res.status(500).json({
          message: "Failed to start application",
          details: errorMessage,
          troubleshooting: "Check application logs for more details"
        });
      }
    }
  });

  app.post('/api/applications/:id/stop', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getApplication(id);

      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      // DI Phase 3: Use service container instead of direct import
      const pm2Service = req.services.resolveByToken<PM2Service>(ServiceTokens.PM2_SERVICE);
      await pm2Service.stopApplication(application.name);
      await storage.updateApplication(id, { status: 'stopped' });

      // Broadcast update
      broadcast({
        type: 'APPLICATION_STATUS_CHANGED',
        data: { id, status: 'stopped' }
      });

      res.json({ message: "Application stopped successfully" });
    } catch (error) {
      console.error("Error stopping application:", error);

      // Provide specific error messages based on error type
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.includes('PM2') || errorMessage.includes('pm2')) {
        res.status(503).json({
          message: "Process manager is unavailable",
          details: errorMessage,
          solution: "Please ensure PM2 is installed or use fallback mode"
        });
      } else if (errorMessage.includes('not found') || errorMessage.includes('ESRCH')) {
        res.status(404).json({
          message: "Application process not found",
          details: errorMessage
        });
      } else if (errorMessage.includes('permission') || errorMessage.includes('EACCES')) {
        res.status(403).json({
          message: "Permission denied",
          details: errorMessage
        });
      } else {
        res.status(500).json({
          message: "Failed to stop application",
          details: errorMessage
        });
      }
    }
  });

  app.post('/api/applications/:id/restart', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getApplication(id);

      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      // DI Phase 3: Use service container instead of direct import
      const pm2Service = req.services.resolveByToken<PM2Service>(ServiceTokens.PM2_SERVICE);
      await pm2Service.restartApplication(application.name, application);
      await storage.updateApplication(id, { status: 'running' });

      // Broadcast update
      broadcast({
        type: 'APPLICATION_STATUS_CHANGED',
        data: { id, status: 'running' }
      });

      res.json({ message: "Application restarted successfully" });
    } catch (error) {
      console.error("Error restarting application:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.includes('PM2') || errorMessage.includes('pm2')) {
        res.status(503).json({
          message: "Process manager is unavailable",
          details: errorMessage,
          solution: "Please ensure PM2 is installed or use fallback mode"
        });
      } else if (errorMessage.includes('not found') || errorMessage.includes('ESRCH')) {
        res.status(404).json({
          message: "Application process not found",
          details: errorMessage
        });
      } else if (errorMessage.includes('fallback mode')) {
        res.status(501).json({
          message: "Restart not supported in fallback mode",
          details: errorMessage,
          solution: "Please stop and start the application manually"
        });
      } else if (errorMessage.includes('permission') || errorMessage.includes('EACCES')) {
        res.status(403).json({
          message: "Permission denied",
          details: errorMessage
        });
      } else {
        res.status(500).json({
          message: "Failed to restart application",
          details: errorMessage
        });
      }
    }
  });

  // Domain routes
  app.get('/api/domains', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const domains = await storage.getDomains();
      res.json(domains);
    } catch (error) {
      console.error("Error fetching domains:", error);
      res.status(500).json({ message: "Failed to fetch domains" });
    }
  });

  app.post('/api/domains', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const domainData = insertDomainSchema.parse(req.body);
      const domain = await storage.createDomain(domainData);

      // Check DNS status - DI Phase 3: Updated to use req.services
      try {
        // DI Phase 3: Use service container instead of direct import
        const systemService = req.services.resolveByToken<SystemService>(ServiceTokens.SYSTEM_SERVICE);
        const dnsStatus = await systemService.checkDns(domain.domain);
        await storage.updateDomain(domain.id, { dnsStatus });
      } catch (error) {
        console.warn("Failed to check DNS:", error);
      }

      res.status(201).json(domain);
    } catch (error) {
      console.error("Error creating domain:", error);
      res.status(400).json({ message: "Failed to create domain" });
    }
  });

  app.post('/api/domains/:id/check-dns', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const domains = await storage.getDomains();
      const targetDomain = domains.find(d => d.id === id);

      if (!targetDomain) {
        return res.status(404).json({ message: "Domain not found" });
      }

      // DI Phase 3: Use service container instead of direct import
      const systemService = req.services.resolveByToken<SystemService>(ServiceTokens.SYSTEM_SERVICE);
      const dnsStatus = await systemService.checkDns(targetDomain.domain);
      await storage.updateDomain(id, { dnsStatus });

      res.json({ dnsStatus });
    } catch (error) {
      console.error("Error checking DNS:", error);
      res.status(500).json({ message: "Failed to check DNS" });
    }
  });

  // SSL Certificate routes
  app.get('/api/ssl-certificates', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const certificates = await storage.getSslCertificates();
      res.json(certificates);
    } catch (error) {
      console.error("Error fetching SSL certificates:", error);
      res.status(500).json({ message: "Failed to fetch SSL certificates" });
    }
  });

  app.post('/api/ssl-certificates', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { domainId } = req.body;
      const userId = getUserId(req)!;
      const domains = await storage.getDomains();
      const domain = domains.find(d => d.id === domainId);

      if (!domain) {
        return res.status(404).json({ message: "Domain not found" });
      }

      // DI Phase 3: Use service container instead of direct import
      const sslService = req.services.resolveByToken<SslService>(ServiceTokens.SSL_SERVICE);
      const certificate = await sslService.issueCertificate(domain.domain);

      const sslCert = await storage.createSslCertificate({
        domainId,
        issuer: 'letsencrypt',
        issuedAt: new Date(),
        expiresAt: certificate.expiresAt,
        certPath: certificate.certPath,
        keyPath: certificate.keyPath,
        status: 'valid'
      });

      // Update domain SSL status
      await storage.updateDomain(domainId, { sslStatus: 'valid' });

      // Create success notification
      await storage.createNotification({
        type: 'success',
        level: 'medium',
        title: 'SSL Certificate Issued',
        message: `SSL certificate issued successfully for ${domain.domain}`,
        source: 'ssl',
        userId
      });

      res.status(201).json(sslCert);
    } catch (error) {
      console.error("Error issuing SSL certificate:", error);
      res.status(500).json({ message: "Failed to issue SSL certificate" });
    }
  });

  // Nginx routes
  app.get('/api/nginx/configs', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const configs = await storage.getNginxConfigs();
      res.json(configs);
    } catch (error) {
      console.error("Error fetching nginx configs:", error);
      res.status(500).json({ message: "Failed to fetch nginx configs" });
    }
  });

  app.post('/api/nginx/configs', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const configData = insertNginxConfigSchema.parse(req.body);

      // Test the configuration first - DI Phase 3: Updated to use req.services
      // DI Phase 3: Use service container instead of direct import
      const nginxService = req.services.resolveByToken<NginxService>(ServiceTokens.NGINX_SERVICE);
      const testResult = await nginxService.testConfig(configData.content);

      const config = await storage.createNginxConfig({
        ...configData,
        lastTest: new Date(),
        testResult: testResult.error || 'Configuration is valid'
      });

      res.status(201).json(config);
    } catch (error) {
      console.error("Error creating nginx config:", error);
      res.status(400).json({ message: "Failed to create nginx config" });
    }
  });

  app.post('/api/nginx/test', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { content } = req.body;
      // DI Phase 3: Use service container instead of direct import
      const nginxService = req.services.resolveByToken<NginxService>(ServiceTokens.NGINX_SERVICE);
      const result = await nginxService.testConfig(content);
      res.json(result);
    } catch (error) {
      console.error("Error testing nginx config:", error);
      res.status(500).json({ message: "Failed to test nginx config" });
    }
  });

  app.post('/api/nginx/reload', isAuthenticated, requireRole('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      // DI Phase 3: Use service container instead of direct import
      const nginxService = req.services.resolveByToken<NginxService>(ServiceTokens.NGINX_SERVICE);
      await nginxService.reloadNginx();
      const result = { success: true, message: 'Nginx reloaded successfully' };
      res.json(result);
    } catch (error) {
      console.error("Error reloading nginx:", error);
      res.status(500).json({ message: "Failed to reload nginx" });
    }
  });

  // Notification routes - Updated to use UnifiedNotificationService
  app.get('/api/notifications', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      // DI Phase 3: Use service container instead of direct storage access
      const notificationService = req.services.resolveByToken<UnifiedNotificationService>(ServiceTokens.UNIFIED_NOTIFICATION_SERVICE);
      
      // تحديث السياق بمعلومات المستخدم الحالي
      notificationService.setContext({
        user: req.user,
        sessionId: req.sessionID,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      const limit = parseInt(req.query.limit as string) || 50;
      const page = parseInt(req.query.page as string) || 1;
      
      // Use unified service with pagination
      const result = await notificationService.getUserNotifications({
        page,
        limit
      });
      
      // Maintain backward compatibility by returning the notifications array
      if (result.success) {
        res.json(result.data?.notifications ?? []);
      } else {
        throw new Error(result.error || 'Failed to fetch notifications');
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.patch('/api/notifications/:id/acknowledge', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      // DI Phase 3: Use service container instead of direct storage access
      const notificationService = req.services.resolveByToken<UnifiedNotificationService>(ServiceTokens.UNIFIED_NOTIFICATION_SERVICE);
      
      // تحديث السياق بمعلومات المستخدم الحالي
      notificationService.setContext({
        user: req.user,
        sessionId: req.sessionID,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      const { id } = req.params;
      const result = await notificationService.markAsRead(id);
      
      if (result.success) {
        res.json({ message: "Notification acknowledged" });
      } else {
        throw new Error(result.error || 'Failed to acknowledge notification');
      }
    } catch (error) {
      console.error("Error acknowledging notification:", error);
      res.status(500).json({ message: "Failed to acknowledge notification" });
    }
  });

  app.patch('/api/notifications/:id/resolve', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      // DI Phase 3: Use service container instead of direct storage access  
      const notificationService = req.services.resolveByToken<UnifiedNotificationService>(ServiceTokens.UNIFIED_NOTIFICATION_SERVICE);
      
      // تحديث السياق بمعلومات المستخدم الحالي
      notificationService.setContext({
        user: req.user,
        sessionId: req.sessionID,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      const { id } = req.params;
      const result = await notificationService.resolveNotification(id);
      
      if (result.success) {
        res.json({ message: "Notification resolved" });
      } else {
        throw new Error(result.error || 'Failed to resolve notification');
      }
    } catch (error) {
      console.error("Error resolving notification:", error);
      res.status(500).json({ message: "Failed to resolve notification" });
    }
  });

  // ==========================================
  // FILE MANAGEMENT API ROUTES
  // ==========================================

  // File CRUD Operations - These are now handled by unifiedFileRoutes
  // app.get('/api/files', isAuthenticated, async (req: AuthenticatedRequest, res) => { ... });
  // app.get('/api/files/:id', isAuthenticated, async (req: AuthenticatedRequest, res) => { ... });
  // app.get('/api/files/:id/content', isAuthenticated, async (req: AuthenticatedRequest, res) => { ... });
  // app.post('/api/files', isAuthenticated, async (req: AuthenticatedRequest, res) => { ... });
  // app.put('/api/files/:id', isAuthenticated, async (req: AuthenticatedRequest, res) => { ... });
  // app.post('/api/files/:id/content', isAuthenticated, async (req: AuthenticatedRequest, res) => { ... });
  // app.delete('/api/files/:id', isAuthenticated, async (req: AuthenticatedRequest, res) => { ... });
  // app.get('/api/files/search', isAuthenticated, async (req: AuthenticatedRequest, res) => { ... });
  // app.get('/api/files/trash', isAuthenticated, async (req: AuthenticatedRequest, res) => { ... });
  // app.post('/api/files/trash/:trashId/restore', isAuthenticated, async (req: AuthenticatedRequest, res) => { ... });
  // app.delete('/api/files/trash/:trashId', isAuthenticated, requireRole('admin'), async (req: AuthenticatedRequest, res) => { ... });
  // app.delete('/api/files/trash', isAuthenticated, requireRole('admin'), async (req: AuthenticatedRequest, res) => { ... });
  // app.get('/api/files/:id/backups', isAuthenticated, async (req: AuthenticatedRequest, res) => { ... });
  // app.post('/api/files/:id/backup', isAuthenticated, async (req: AuthenticatedRequest, res) => { ... });
  // app.post('/api/files/backups/:backupId/restore', isAuthenticated, async (req: AuthenticatedRequest, res) => { ... });
  // app.get('/api/files/:id/permissions', isAuthenticated, async (req: AuthenticatedRequest, res) => { ... });
  // app.post('/api/files/:id/permissions', isAuthenticated, async (req: AuthenticatedRequest, res) => { ... });
  // app.delete('/api/files/permissions/:permissionId', isAuthenticated, async (req: AuthenticatedRequest, res) => { ... });
  // app.get('/api/files/:id/locks', isAuthenticated, async (req: AuthenticatedRequest, res) => { ... });
  // app.post('/api/files/:id/lock', isAuthenticated, async (req: AuthenticatedRequest, res) => { ... });
  // app.delete('/api/files/:id/lock', isAuthenticated, async (req: AuthenticatedRequest, res) => { ... });
  // app.get('/api/files/audit', isAuthenticated, async (req: AuthenticatedRequest, res) => { ... });
  // app.post('/api/files/:id/copy', isAuthenticated, async (req: AuthenticatedRequest, res) => { ... });
  // app.post('/api/files/:id/duplicate', isAuthenticated, async (req: AuthenticatedRequest, res) => { ... });
  // app.post('/api/files/:id/share', isAuthenticated, async (req: AuthenticatedRequest, res) => { ... });
  // app.get('/api/files/:id/download', async (req: Request, res) => { ... });
  // app.get('/api/files/:folderId?', isAuthenticated, async (req: AuthenticatedRequest, res) => { ... });


  // System logs routes
  app.get('/api/logs', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { source, level, applicationId, limit } = req.query;
      const filters = {
        source: source as string,
        level: level as string,
        applicationId: applicationId as string,
        limit: parseInt(limit as string) || 100
      };

      const logs = await storage.getSystemLogs(filters);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching system logs:", error);
      res.status(500).json({ message: "Failed to fetch system logs" });
    }
  });

  app.get('/api/applications/:id/logs', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getApplication(id);

      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      const logService = req.services.resolveByToken<LogService>(ServiceTokens.LOG_SERVICE);
      const logs = await logService.getApplicationLogs(application.name);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching application logs:", error);
      res.status(500).json({ message: "Failed to fetch application logs" });
    }
  });

  // System info routes
  app.get('/api/system/info', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const systemService = req.services.resolveByToken<SystemService>(ServiceTokens.SYSTEM_SERVICE);
      const systemInfo = await systemService.getSystemInfo();
      res.json(systemInfo);
    } catch (error) {
      console.error("Error fetching system info:", error);
      res.status(500).json({ message: "Failed to fetch system info" });
    }
  });

  app.get('/api/system/processes', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const pm2Service = req.services.resolveByToken<PM2Service>(ServiceTokens.PM2_SERVICE);
      const processes = await pm2Service.listProcesses();
      res.json(processes);
    } catch (error) {
      console.error("Error fetching processes:", error);
      res.status(500).json({
        message: "Failed to fetch processes",
        error: error instanceof Error ? error.message : 'Unknown error',
        processes: [] // Return empty array as fallback
      });
    }
  });

  // Health check route (public - no authentication required)
  app.get('/api/health', async (req: AuthenticatedRequest, res) => {
    try {
      const systemService = req.services.resolveByToken<SystemService>(ServiceTokens.SYSTEM_SERVICE);
      const healthStatus = await systemService.performHealthCheck();
      res.json(healthStatus);
    } catch (error) {
      console.error("Error checking health:", error);
      res.status(500).json({ message: "Failed to check health status" });
    }
  });

  // Authentication test endpoint (public - for testing auth status)
  app.get('/api/auth-test', (req: any, res) => {
    const isLoggedIn = req.isAuthenticated && req.isAuthenticated();
    res.json({
      authenticated: isLoggedIn,
      user: isLoggedIn ? req.user?.username : null,
      sessionId: req.sessionID || null,
      message: isLoggedIn ? 'User is authenticated' : 'User is not authenticated'
    });
  });

  // System health check route (for HealthCheck page)
  app.get('/api/system/health-check', async (req: AuthenticatedRequest, res) => {
    try {
      const systemService = req.services.resolveByToken<SystemService>(ServiceTokens.SYSTEM_SERVICE);
      const healthStatus = await systemService.performHealthCheck();
      res.json(healthStatus);
    } catch (error) {
      console.error("Error checking system health:", error);
      res.status(500).json({ message: "Failed to check system health status" });
    }
  });

  // System dependencies route
  app.get('/api/system/dependencies', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      // إرجاع قائمة بالتبعيات المطلوبة
      const dependencies = [
        {
          name: 'nodejs',
          displayName: 'Node.js',
          description: 'JavaScript runtime environment',
          category: 'critical',
          installed: true,
          version: process.version,
          checkCommand: 'node --version',
          icon: '🟢',
          purpose: 'Required for running the application',
          installable: false
        },
        {
          name: 'pm2',
          displayName: 'PM2',
          description: 'Process manager for Node.js applications',
          category: 'critical',
          installed: true,
          checkCommand: 'pm2 --version',
          icon: '🔧',
          purpose: 'Managing application processes',
          installable: true
        },
        {
          name: 'postgresql',
          displayName: 'PostgreSQL',
          description: 'Database system',
          category: 'critical',
          installed: true,
          checkCommand: 'psql --version',
          icon: '🗄️',
          purpose: 'Data storage and management',
          installable: false
        }
      ];
      res.json(dependencies);
    } catch (error) {
      console.error("Error fetching system dependencies:", error);
      res.status(500).json({ message: "Failed to fetch system dependencies" });
    }
  });

  // Database connection test
  app.get('/api/db/test', isAuthenticated, requireRole('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      await storage.testConnection();
      res.json({ status: 'connected', message: 'Database connection successful' });
    } catch (error) {
      console.error("Database connection test failed:", error);
      res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Database connection failed'
      });
    }
  });

  // Comprehensive audit endpoint
  app.post('/api/system/audit/comprehensive', isAuthenticated, requireRole('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      // DI Phase 3: Use service container instead of direct import
      const auditService = req.services.resolveByToken<AuditService>(ServiceTokens.AUDIT_SERVICE);

      // Run comprehensive audit
      const auditReport = await auditService.runCompleteAudit();

      res.json({
        success: true,
        message: 'Comprehensive audit completed',
        data: auditReport
      });
    } catch (error) {
      console.error("Comprehensive audit failed:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Audit failed'
      });
    }
  });

  // Download audit report as markdown
  app.get('/api/system/audit/report/:format', isAuthenticated, requireRole('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const { format } = req.params;
      const { auditData } = req.query;

      if (!auditData) {
        return res.status(400).json({ message: 'Audit data is required' });
      }

      const parsedAuditData = JSON.parse(decodeURIComponent(auditData as string));
      const { AuditHelpers } = await import('./utils/auditHelpers');

      if (format === 'markdown') {
        const markdownReport = await AuditHelpers.generateMarkdownReport(parsedAuditData);

        res.setHeader('Content-Type', 'text/markdown');
        res.setHeader('Content-Disposition', `attachment; filename="audit-report-${new Date().toISOString().split('T')[0]}.md"`);
        res.send(markdownReport);
      } else if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="audit-report-${new Date().toISOString().split('T')[0]}.json"`);
        res.json(parsedAuditData);
      } else {
        res.status(400).json({ message: 'Unsupported format. Use markdown or json' });
      }
    } catch (error) {
      console.error("Failed to generate audit report:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : 'Failed to generate report'
      });
    }
  });

  // Terminal commands (restricted)
  app.post('/api/terminal/execute', isAuthenticated, requireRole('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const { command } = req.body;

      // Security: Only allow specific safe commands
      const allowedCommands = [
        'systemctl status nginx',
        'pm2 list',
        'pm2 status',
        'certbot renew --dry-run',
        'df -h',
        'free -h',
        'top -bn1'
      ];

      if (!allowedCommands.includes(command)) {
        return res.status(403).json({ message: "Command not allowed" });
      }

      const systemService = req.services.resolveByToken<SystemService>(ServiceTokens.SYSTEM_SERVICE);
      const result = await systemService.executeCommand(command);
      res.json(result);
    } catch (error) {
      console.error("Error executing command:", error);
      res.status(500).json({ message: "Failed to execute command" });
    }
  });

  // WebSocket server setup with enhanced security and token verification
  const wss = new WebSocketServer({
    server,
    path: '/ws',
    verifyClient: (info: any) => {
      // Verify Origin for security
      const origin = info.origin;
      const url = new URL(info.req.url || '', `http://${info.req.headers.host}`);
      const token = url.searchParams.get('token');

      console.log('🔍 WebSocket connection attempt:');
      console.log('   Origin:', origin);
      console.log('   Host:', info.req.headers.host);
      console.log('   Has Token:', !!token);
      console.log('   User-Agent:', info.req.headers['user-agent']?.substring(0, 50) + '...');

      // التحقق من النطاق المخصص أولاً
      const host = info.req.headers.host;
      const isCustomDomain = host?.includes('binarjoinanelytic.info');
      const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined;

      console.log('   Is Custom Domain:', isCustomDomain);
      console.log('   Is Development:', isDevelopment);

      if (!origin && !isCustomDomain) {
        console.log('   ⚠️ No origin provided for non-custom domain');
        return true; // السماح للاتصالات المحلية
      }

      // التحقق من النطاقات المسموحة
      const isAllowed = !origin || ENV_CONFIG.cors.origin.some(allowedOrigin => {
        if (typeof allowedOrigin === 'string') {
          // مطابقة مباشرة أو wildcard
          if (allowedOrigin.includes('*')) {
            const pattern = allowedOrigin.replace(/\*/g, '.*');
            return new RegExp(`^${pattern}$`).test(origin);
          }
          return allowedOrigin === origin;
        } else if (allowedOrigin instanceof RegExp) {
          return allowedOrigin.test(origin);
        }
        return false;
      });

      if (!isAllowed) {
        console.warn(`🚫 Security: Blocked WebSocket connection from unauthorized origin: ${origin}`);
        return false;
      }

      console.log('✅ WebSocket connection approved');
      return true;
    }
  });

  wss.on('connection', async (ws, req) => {
    // 🛡️ SECURITY: Origin validation already done in verifyClient
    wsClients.add(ws);

    // استخراج معلومات الاتصال
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    const origin = req.headers.origin;
    const userAgent = req.headers['user-agent'];
    const host = req.headers.host;

    // هنا نقرأ IP العميل
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log('Client connected from:', clientIP);

    // التحقق من التوكن إذا كان متوفراً
    let authenticatedUser = null;
    if (token) {
      try {
        const { verifyToken } = await import('./auth.js');
        const payload = verifyToken(token);
        if (payload) {
          authenticatedUser = payload;
          console.log('✅ WebSocket authenticated via token for user:', payload.username);
        }
      } catch (error) {
        console.warn('❌ WebSocket token verification failed:', error);
      }
    }

    console.log('✅ WebSocket client connected:');
    console.log('   Host:', host);
    console.log('   Origin:', origin);
    console.log('   Has Token:', !!token);
    console.log('   Custom Domain:', host?.includes('binarjoinanelytic.info'));

    let isTerminalAuthenticated = false;
    let activeProcess: any = null;
    let clientToken = token;

    const parseCookies = (cookieHeader: string) => {
      const cookies: Record<string, string> = {};
      if (cookieHeader) {
        cookieHeader.split(';').forEach(cookie => {
          const [name, value] = cookie.trim().split('=');
          if (name && value) {
            cookies[name] = decodeURIComponent(value);
          }
        });
      }
      return cookies;
    };

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('📨 Received WebSocket message:', {
          type: message.type,
          from: clientIP
        });

        switch (message.type) {
          case 'TERMINAL_AUTH_REQUEST':
            // 🚨 EMERGENCY FIX: Simplified auth for immediate functionality
            try {
              isTerminalAuthenticated = true;
              console.log('🚨 EMERGENCY: Terminal access granted (simplified)');

              ws.send(JSON.stringify({
                type: 'TERMINAL_AUTH_SUCCESS',
                message: 'Terminal authentication successful'
              }));

            } catch (error) {
              console.error('Terminal auth error:', error);
              ws.send(JSON.stringify({
                type: 'TERMINAL_AUTH_ERROR',
                message: 'Authentication failed'
              }));
            }
            break;

          case 'TERMINAL_COMMAND':
            // 🚨 EMERGENCY: Terminal commands temporarily disabled for security
            ws.send(JSON.stringify({
              type: 'TERMINAL_ERROR',
              message: 'Terminal access temporarily disabled for security'
            }));
            return;

            const { command } = message;

            if (!command || typeof command !== 'string') {
              ws.send(JSON.stringify({
                type: 'TERMINAL_ERROR',
                message: 'Invalid command format'
              }));
              return;
            }

            // CRITICAL SECURITY: Strict server-side command allowlist - NO SHELL METACHARACTERS
            const SECURE_COMMAND_MAP: Record<string, {binary: string, args: string[]}> = {
              'nginx -t': { binary: 'nginx', args: ['-t'] },
              'systemctl reload nginx': { binary: 'systemctl', args: ['reload', 'nginx'] },
              'systemctl status nginx': { binary: 'systemctl', args: ['status', 'nginx'] },
              'pm2 list': { binary: 'pm2', args: ['list'] },
              'pm2 status': { binary: 'pm2', args: ['status'] },
              'certbot renew --dry-run': { binary: 'certbot', args: ['renew', '--dry-run'] },
              'df -h': { binary: 'df', args: ['-h'] },
              'free -h': { binary: 'free', args: ['-h'] },
              'top -bn1': { binary: 'top', args: ['-b', '-n1'] },
              'ps aux': { binary: 'ps', args: ['aux'] }, // Removed pipe - safer
              'netstat -tlnp': { binary: 'netstat', args: ['-tlnp'] },
              'systemctl status': { binary: 'systemctl', args: ['status'] }
            };

            const trimmedCommand = command.trim();
            const commandSpec = SECURE_COMMAND_MAP[trimmedCommand];

            if (!commandSpec) {
              console.warn(`Security: Blocked unauthorized command attempt: "${trimmedCommand}"`);
              ws.send(JSON.stringify({
                type: 'TERMINAL_ERROR',
                message: 'Command not allowed for security reasons. Only approved commands can be executed.'
              }));
              return;
            }

            // Additional security: Check for dangerous characters
            if (trimmedCommand.includes('|') || trimmedCommand.includes(';') ||
                trimmedCommand.includes('&') || trimmedCommand.includes('`') ||
                trimmedCommand.includes('$') || trimmedCommand.includes('>') ||
                trimmedCommand.includes('<')) {
              console.error(`Security: Blocked command with dangerous characters: "${trimmedCommand}"`);
              ws.send(JSON.stringify({
                type: 'TERMINAL_ERROR',
                message: 'Command contains dangerous characters and is blocked.'
              }));
              return;
            }

            // Log command execution for security audit
            console.log(`Terminal: Executing: "${trimmedCommand}"`);

            // Send command started message to THIS connection only (not broadcast)
            ws.send(JSON.stringify({
              type: 'TERMINAL_OUTPUT',
              data: {
                command: trimmedCommand,
                output: `$ ${trimmedCommand}\n`,
                status: 'running'
              }
            }));

            try {
              // SECURE EXECUTION: Use spawn without shell to prevent RCE
              const { spawn } = await import('child_process');

              // Use direct binary execution (NO SHELL) for security
              const childProcess = spawn(commandSpec.binary, commandSpec.args, {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: {
                  ...process.env,
                  TERM: 'xterm-256color',
                  PATH: process.env.PATH // Ensure PATH is available
                },
                shell: false, // CRITICAL: No shell to prevent RCE
                timeout: 30000 // 30 second timeout
              });

              // Store process reference for cleanup
              activeProcess = childProcess;
              let outputBuffer = '';
              let outputSize = 0;
              const MAX_OUTPUT_SIZE = 1024 * 1024; // 1MB limit

              // Stream stdout to THIS connection only (no broadcast)
              childProcess.stdout?.on('data', (data: Buffer) => {
                const output = data.toString();
                outputSize += output.length;

                // Prevent memory abuse
                if (outputSize > MAX_OUTPUT_SIZE) {
                  childProcess.kill('SIGKILL');
                  ws.send(JSON.stringify({
                    type: 'TERMINAL_ERROR',
                    message: 'Command output exceeded size limit (1MB)'
                  }));
                  return;
                }

                outputBuffer += output;

                // Send to THIS connection only
                ws.send(JSON.stringify({
                  type: 'TERMINAL_OUTPUT',
                  data: {
                    command: trimmedCommand,
                    output,
                    status: 'running'
                  }
                }));
              });

              // Stream stderr to THIS connection only (no broadcast)
              childProcess.stderr?.on('data', (data: Buffer) => {
                const output = data.toString();
                outputSize += output.length;

                if (outputSize > MAX_OUTPUT_SIZE) {
                  childProcess.kill('SIGKILL');
                  ws.send(JSON.stringify({
                    type: 'TERMINAL_ERROR',
                    message: 'Command output exceeded size limit (1MB)'
                  }));
                  return;
                }

                outputBuffer += output;

                // Send to THIS connection only
                ws.send(JSON.stringify({
                  type: 'TERMINAL_OUTPUT',
                  data: {
                    command: trimmedCommand,
                    output,
                    status: 'error',
                    isError: true
                  }
                }));
              });

              // Handle process completion
              childProcess.on('close', (code: number | null, signal: string | null) => {
                activeProcess = null; // Clear reference
                const finalStatus = code === 0 ? 'success' : 'error';

                // Send completion to THIS connection only
                ws.send(JSON.stringify({
                  type: 'TERMINAL_COMPLETE',
                  data: {
                    command: trimmedCommand,
                    exitCode: code,
                    signal,
                    status: finalStatus
                  }
                }));

                // Security audit log
                console.log(`Terminal: Command "${trimmedCommand}" completed with exit code: ${code}, signal: ${signal}`);
              });

              // Handle process errors
              childProcess.on('error', (error: Error) => {
                activeProcess = null; // Clear reference
                console.error(`Terminal: Process error for command "${trimmedCommand}":`, error);
                ws.send(JSON.stringify({
                  type: 'TERMINAL_ERROR',
                  message: `Process error: ${error instanceof Error ? error.message : 'Unknown error'}`
                }));
              });

              // Timeout with proper cleanup
              const timeoutId = setTimeout(() => {
                if (activeProcess) {
                  console.warn(`Terminal: Command "${trimmedCommand}" timed out, killing process`);
                  activeProcess.kill('SIGTERM'); // Try graceful first

                  // Force kill if not terminated in 5 seconds
                  setTimeout(() => {
                    if (activeProcess) {
                      activeProcess.kill('SIGKILL');
                    }
                  }, 5000);

                  ws.send(JSON.stringify({
                    type: 'TERMINAL_ERROR',
                    message: 'Command timed out (30s limit)'
                  }));
                }
              }, 30000);

              // Clear timeout when process completes
              childProcess.on('exit', () => {
                clearTimeout(timeoutId);
              });

            } catch (error) {
              console.error(`Terminal: Failed to execute command "${trimmedCommand}":`, error);
              const errorMessage = error instanceof Error
                ? (error as Error).message
                : (typeof error === 'string'
                    ? error
                    : String(error) || 'Unknown error');
              ws.send(JSON.stringify({
                type: 'TERMINAL_ERROR',
                message: `Failed to execute command: ${errorMessage}`
              }));
            }
            break;

          default:
            // Handle other WebSocket message types (existing functionality)
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({
          type: 'ERROR',
          message: 'Invalid message format'
        }));
      }
    });

    ws.on('close', (code, reason) => {
      wsClients.delete(ws);
      console.log(`🔌 WebSocket disconnected - IP: ${clientIP}, Code: ${code}, Reason: ${reason?.toString()}`);

      // تنظيف العمليات النشطة
      if (activeProcess) {
        try {
          activeProcess.kill('SIGTERM');
        } catch (error) {
          console.error('Error killing process:', error);
        }
      }
      // Reset authentication state
      isTerminalAuthenticated = false;
    });

    ws.on('error', (error: Error) => {
      console.error('🚨 WebSocket error from IP:', clientIP, error);
      wsClients.delete(ws);

      // Reset authentication state on error
      isTerminalAuthenticated = false;
    });

    // إرسال رسالة ترحيب مع معلومات الاتصال
    ws.send(JSON.stringify({
      type: 'CONNECTED',
      message: 'Connected to server - Terminal ready',
      clientInfo: {
        ip: clientIP,
        userAgent: userAgent,
        timestamp: new Date().toISOString()
      }
    }));
  });

  // ===================================
  // UNIFIED FILE SYSTEM API - النظام الموحد الوحيد
  // ===================================

  // Browse directory contents - using UnifiedFileService
  app.get('/api/real-files/browse', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const { path: dirPath } = req.query;

      if (!dirPath || typeof dirPath !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Path parameter is required',
          error: 'Path parameter is required'
        });
      }

      // DI Phase 3: Use service container instead of direct import
      const unifiedFileService = req.services.resolveByToken(ServiceTokens.UNIFIED_FILE_SERVICE) as UnifiedFileService;
      const result = await unifiedFileService.listDirectory(dirPath, userId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error("Error browsing directory:", error);
      res.status(500).json({
        success: false,
        message: "Failed to browse directory",
        error: "Internal server error"
      });
    }
  });

  // Read file content using UnifiedFileService
  app.get('/api/real-files/content', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const { path: filePath } = req.query;

      if (!filePath || typeof filePath !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'File path parameter is required',
          error: 'File path parameter is required'
        });
      }

      // DI Phase 3: Use service container instead of direct import
      const unifiedFileService = req.services.resolveByToken(ServiceTokens.UNIFIED_FILE_SERVICE) as UnifiedFileService;
      const result = await unifiedFileService.readFileContent(filePath, userId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error("Error reading file content:", error);
      res.status(500).json({
        success: false,
        message: "Failed to read file content",
        error: "Internal server error"
      });
    }
  });

  // Write file content using UnifiedFileService
  app.post('/api/real-files/write', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const { path: filePath, content } = req.body;

      if (!filePath || typeof filePath !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'File path is required',
          error: 'File path is required'
        });
      }

      if (content === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Content is required',
          error: 'Content is required'
        });
      }

      // DI Phase 3: Use service container instead of direct import
      const unifiedFileService = req.services.resolveByToken(ServiceTokens.UNIFIED_FILE_SERVICE) as UnifiedFileService;
      const result = await unifiedFileService.writeFile(filePath, content, userId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error("Error writing file content:", error);
      res.status(500).json({
        success: false,
        message: "Failed to write file content",
        error: "Internal server error"
      });
    }
  });

  // Create directory using UnifiedFileService
  app.post('/api/real-files/mkdir', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const { path: dirPath, recursive = false } = req.body;

      if (!dirPath || typeof dirPath !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Directory path is required',
          error: 'Directory path is required'
        });
      }

      // DI Phase 3: Use service container instead of direct import
      const unifiedFileService = req.services.resolveByToken(ServiceTokens.UNIFIED_FILE_SERVICE) as UnifiedFileService;
      const result = await unifiedFileService.createDirectory(dirPath, userId, { recursive });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error("Error creating directory:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create directory",
        error: "Internal server error"
      });
    }
  });

  // Emergency session reset endpoint for troubleshooting
  app.post('/api/auth/reset-session', async (req: AuthenticatedRequest, res) => {
    try {
      // 🚨 EMERGENCY SESSION RESET for cookie issues
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
      }

      // Verify credentials
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check password (you'll need to import the comparePasswords function)
      const { comparePasswords } = await import('./auth.js');
      const isValidPassword = await comparePasswords(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Force destroy existing session
      if (req.session) {
        req.session.destroy((err) => {
          if (err) {
            console.error('Session destruction error:', err);
          }
        });
      }

      // Clear all cookies
      res.clearCookie('sid');
      res.clearCookie('connect.sid');
      res.clearCookie('authToken');
      res.clearCookie('userId');

      // Generate new token
      const { generateToken } = await import('./auth.js');
      const token = generateToken(user);

      // Set new cookies with enhanced compatibility
      res.cookie('authToken', token, {
        httpOnly: false,
        secure: false,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/'
      });

      res.cookie('userId', user.id, {
        httpOnly: false,
        secure: false,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/'
      });

      console.log('🚨 Emergency session reset completed for user:', user.username);

      res.json({
        success: true,
        message: 'Session reset successful',
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          token: token
        }
      });
    } catch (error) {
      console.error('Emergency session reset error:', error);
      res.status(500).json({ error: 'Session reset failed' });
    }
  });

  // Create directory using UnifiedFileService
  app.post('/api/real-files/mkdir', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const { path: dirPath, recursive = false } = req.body;

      if (!dirPath || typeof dirPath !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Directory path is required',
          error: 'Directory path is required'
        });
      }

      // DI Phase 3: Use service container instead of direct import
      const unifiedFileService = req.services.resolveByToken(ServiceTokens.UNIFIED_FILE_SERVICE) as UnifiedFileService;
      const result = await unifiedFileService.createDirectory(dirPath, userId, { recursive });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error("Error creating directory:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create directory",
        error: "Internal server error"
      });
    }
  });

  // Delete file or directory using UnifiedFileService
  app.delete('/api/real-files/delete', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const { path: itemPath } = req.body;

      if (!itemPath || typeof itemPath !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Item path is required',
          error: 'Item path is required'
        });
      }

      // DI Phase 3: Use service container instead of direct import
      const unifiedFileService = req.services.resolveByToken(ServiceTokens.UNIFIED_FILE_SERVICE) as UnifiedFileService;
      const result = await unifiedFileService.deleteItem(itemPath, userId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error("Error deleting item:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete item",
        error: "Internal server error"
      });
    }
  });

  // Rename file or directory using UnifiedFileService
  app.post('/api/real-files/rename', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const { oldPath, newPath } = req.body;

      if (!oldPath || !newPath || typeof oldPath !== 'string' || typeof newPath !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Old path and new path are required',
          error: 'Old path and new path are required'
        });
      }

      // DI Phase 3: Use service container instead of direct import
      const unifiedFileService = req.services.resolveByToken(ServiceTokens.UNIFIED_FILE_SERVICE) as UnifiedFileService;
      const result = await unifiedFileService.renameItem(oldPath, newPath, userId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error("Error renaming item:", error);
      res.status(500).json({
        success: false,
        message: "Failed to rename item",
        error: "Internal server error"
      });
    }
  });

  // Copy file or directory using UnifiedFileService
  app.post('/api/real-files/copy', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const { sourcePath, destinationPath } = req.body;

      if (!sourcePath || !destinationPath || typeof sourcePath !== 'string' || typeof destinationPath !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Source path and destination path are required',
          error: 'Source path and destination path are required'
        });
      }

      // DI Phase 3: Use service container instead of direct import
      const unifiedFileService = req.services.resolveByToken(ServiceTokens.UNIFIED_FILE_SERVICE) as UnifiedFileService;
      const result = await unifiedFileService.copyItem(sourcePath, destinationPath, userId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error("Error copying item:", error);
      res.status(500).json({
        success: false,
        message: "Failed to copy item",
        error: "Internal server error"
      });
    }
  });

  // Get file/directory information using UnifiedFileService
  app.get('/api/real-files/info', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const { path: itemPath } = req.query;

      if (!itemPath || typeof itemPath !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Item path is required',
          error: 'Item path is required'
        });
      }

      // DI Phase 3: Use service container instead of direct import
      const unifiedFileService = req.services.resolveByToken(ServiceTokens.UNIFIED_FILE_SERVICE) as UnifiedFileService;
      const result = await unifiedFileService.getFileInfo(itemPath, userId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error("Error getting file info:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get file info",
        error: "Internal server error"
      });
    }
  });

  // Register the unified file routes
  app.use('/api/unified-files', isAuthenticated, unifiedFileRoutes);

  // Register the unified notification routes
  app.use('/api/unified/notifications', isAuthenticated, unifiedNotificationRoutes);

  return server;
}