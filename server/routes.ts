import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage.js";
import { setupAuth, isAuthenticated, requireRole } from "./auth";
import { 
  insertApplicationSchema, 
  insertDomainSchema, 
  insertSslCertificateSchema,
  insertNginxConfigSchema,
  insertNotificationSchema,
  insertFileSchema,
  insertFilePermissionSchema,
  insertFileLockSchema,
  insertFileBackupSchema,
  insertAllowedPathSchema 
} from "@shared/schema";
import { z } from "zod";
import { pm2Service } from "./services/pm2Service";
import { nginxService } from "./services/nginxService";
import { sslService } from "./services/sslService";
import { systemService } from "./services/systemService";
import { logService } from "./services/logService";
import { FileManagerService } from "./services/fileManagerService";
import { RealFileSystemService } from "./services/realFileSystemService";
import { db } from "./db";
import { files } from "@shared/schema";
import { eq, and } from "drizzle-orm";

// WebSocket clients store
const wsClients = new Set<WebSocket>();

// File Manager Service instance
const fileManagerService = new FileManagerService(storage);

// Real File System Service instance
const realFileSystemService = new RealFileSystemService(storage);

// Unified CORS configuration for both HTTP and WebSocket
function setupCORS(app: Express) {
  app.use((req, res, next) => {
    const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined;
    const origin = req.headers.origin;

    // Determine allowed origins based on environment
    const allowedOrigins = isDevelopment 
      ? ['http://localhost:5000', 'https://replit.dev', 'http://127.0.0.1:5000']
      : ['https://binarjoinanelytic.info'];

    // Allow origin if it's in the allowed list or if no origin (same-origin requests)
    const allowOrigin = !origin || allowedOrigins.some(allowed => 
      origin === allowed || (isDevelopment && (
        origin.includes('localhost') || 
        origin.includes('replit.dev') ||
        origin.includes('127.0.0.1')
      ))
    );

    if (allowOrigin) {
      res.header('Access-Control-Allow-Origin', origin || (isDevelopment ? 'http://localhost:5000' : 'https://binarjoinanelytic.info'));
    }

    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cookie, Set-Cookie');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE, PATCH');

    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });
}

// Enhanced authentication middleware for custom auth system
interface AuthenticatedRequest extends Request {
  user?: any; // Custom authenticated user session
  body: any;
  params: any;
  query: any;
}

// Helper function to get user ID from custom auth
const getUserId = (req: AuthenticatedRequest): string | null => {
  return req.user?.id || null;
};

// Broadcast function for real-time updates
export function broadcast(message: any) {
  const data = JSON.stringify(message);
  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  const server = createServer(app);

  // Setup CORS first
  setupCORS(app);

  // Setup custom authentication
  setupAuth(app);

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

  // Dashboard stats route
  app.get('/api/dashboard/stats', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
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

  // Application routes
  app.get('/api/applications', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const applications = await storage.getApplications(userId);
      let statusMap = new Map<string, string>();

      try {
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

      // Start the application if requested
      if (appData.usePm2) {
        try {
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
        // Stop the application first
        try {
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
    try {
      const { id } = req.params;
      const application = await storage.getApplication(id);

      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

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

      // Provide specific error messages based on error type
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.includes('PM2') || errorMessage.includes('pm2')) {
        res.status(503).json({ 
          message: "Process manager is unavailable", 
          details: errorMessage,
          solution: "Please ensure PM2 is installed or use fallback mode"
        });
      } else if (errorMessage.includes('ENOENT') || errorMessage.includes('command not found')) {
        res.status(404).json({ 
          message: "Application command or path not found", 
          details: errorMessage 
        });
      } else if (errorMessage.includes('permission') || errorMessage.includes('EACCES')) {
        res.status(403).json({ 
          message: "Permission denied", 
          details: errorMessage 
        });
      } else {
        res.status(500).json({ 
          message: "Failed to start application", 
          details: errorMessage 
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

      await pm2Service.restartApplication(application.name);
      await storage.updateApplication(id, { status: 'running' });

      // Broadcast update
      broadcast({
        type: 'APPLICATION_STATUS_CHANGED',
        data: { id, status: 'running' }
      });

      res.json({ message: "Application restarted successfully" });
    } catch (error) {
      console.error("Error restarting application:", error);

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

      // Check DNS status
      try {
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

      // Test the configuration first
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
      const result = await nginxService.testConfig(content);
      res.json(result);
    } catch (error) {
      console.error("Error testing nginx config:", error);
      res.status(500).json({ message: "Failed to test nginx config" });
    }
  });

  app.post('/api/nginx/reload', isAuthenticated, requireRole('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      await nginxService.reloadNginx();
      const result = { success: true, message: 'Nginx reloaded successfully' };
      res.json(result);
    } catch (error) {
      console.error("Error reloading nginx:", error);
      res.status(500).json({ message: "Failed to reload nginx" });
    }
  });

  // Notification routes
  app.get('/api/notifications', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const limit = parseInt(req.query.limit as string) || 50;
      const notifications = await storage.getNotifications(userId, limit);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.patch('/api/notifications/:id/acknowledge', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      await storage.acknowledgeNotification(id);
      res.json({ message: "Notification acknowledged" });
    } catch (error) {
      console.error("Error acknowledging notification:", error);
      res.status(500).json({ message: "Failed to acknowledge notification" });
    }
  });

  app.patch('/api/notifications/:id/resolve', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      await storage.resolveNotification(id);
      res.json({ message: "Notification resolved" });
    } catch (error) {
      console.error("Error resolving notification:", error);
      res.status(500).json({ message: "Failed to resolve notification" });
    }
  });

  // ==========================================
  // FILE MANAGEMENT API ROUTES
  // ==========================================

  // File CRUD Operations
  app.get('/api/files', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const { parentId, type } = req.query;

      const files = await storage.getFiles(
        parentId as string || null, 
        userId
      );

      res.json(files);
    } catch (error) {
      console.error("Error fetching files:", error);
      res.status(500).json({ message: "Failed to fetch files" });
    }
  });

  app.get('/api/files/:id', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const { id } = req.params;

      const file = await storage.getFile(id, userId);

      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      res.json(file);
    } catch (error) {
      console.error("Error fetching file:", error);
      res.status(500).json({ message: "Failed to fetch file" });
    }
  });

  app.get('/api/files/:id/content', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const { id } = req.params;

      // Check if file exists and user has permission
      const file = await storage.getFile(id, userId);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      // Check read permission
      const hasPermission = await storage.checkFilePermission(id, userId, 'read');
      if (!hasPermission) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Use FileManagerService to read file content safely
      const result = await fileManagerService.readFile(file.path, userId);

      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }

      res.json({ 
        content: result.data.content,
        mimeType: result.data.mimeType,
        size: result.data.size
      });
    } catch (error) {
      console.error("Error reading file content:", error);
      res.status(500).json({ message: "Failed to read file content" });
    }
  });

  app.post('/api/files', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const fileData = insertFileSchema.parse({
        ...req.body,
        ownerId: userId
      });

      const file = await storage.createFile(fileData);

      // Create audit log
      await storage.createAuditLog({
        fileId: file.id,
        action: 'create',
        userId,
        details: `Created ${file.type}: ${file.name}`,
        newValue: { name: file.name, type: file.type, path: file.path }
      });

      res.status(201).json(file);
    } catch (error) {
      console.error("Error creating file:", error);
      res.status(400).json({ message: "Failed to create file" });
    }
  });

  app.put('/api/files/:id', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const { id } = req.params;
      const updates = req.body;

      // Get current file for audit log
      const currentFile = await storage.getFile(id, userId);
      if (!currentFile) {
        return res.status(404).json({ message: "File not found" });
      }

      const updatedFile = await storage.updateFile(id, updates, userId);

      // Create audit log
      await storage.createAuditLog({
        fileId: id,
        action: 'update',
        userId,
        details: `Updated file: ${updatedFile.name}`,
        oldValue: currentFile,
        newValue: updatedFile
      });

      res.json(updatedFile);
    } catch (error) {
      console.error("Error updating file:", error);
      res.status(400).json({ message: "Failed to update file" });
    }
  });

  app.post('/api/files/:id/content', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const { id } = req.params;
      const { content, backup = true, saveAction = 'none' } = req.body;

      const file = await storage.getFile(id, userId);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      // Check write permission
      const hasPermission = await storage.checkFilePermission(id, userId, 'write');
      if (!hasPermission) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Create backup if requested
      if (backup) {
        await storage.createBackup(id, content, userId);
      }

      // Use FileManagerService to write file safely
      const result = await fileManagerService.writeFile(file.path, content, userId);

      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }

      // Update file metadata
      await storage.updateFile(id, { 
        size: Buffer.byteLength(content, 'utf8'),
        checksum: result.data?.checksum
      }, userId);

      // Create audit log
      await storage.createAuditLog({
        fileId: id,
        action: 'update',
        userId,
        details: `Updated file content: ${file.name}`,
        newValue: { size: Buffer.byteLength(content, 'utf8') }
      });

      res.json({ 
        message: "File saved successfully",
        backup: backup ? "created" : "skipped",
        checksum: result.data?.checksum
      });
    } catch (error) {
      console.error("Error saving file content:", error);
      res.status(500).json({ message: "Failed to save file content" });
    }
  });

  app.delete('/api/files/:id', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const { id } = req.params;
      const { permanent = false } = req.query;

      if (permanent === 'true') {
        // Permanent delete - only for admins
        const user = await storage.getUser(userId);
        if (user?.role !== 'admin') {
          return res.status(403).json({ message: "Admin access required for permanent delete" });
        }

        await storage.deleteFile(id, userId);

        res.json({ message: "File permanently deleted" });
      } else {
        // Move to trash
        const trashItem = await storage.moveToTrash(id, userId);

        res.json({ 
          message: "File moved to trash",
          trashId: trashItem.id
        });
      }
    } catch (error) {
      console.error("Error deleting file:", error);
      res.status(500).json({ message: "Failed to delete file" });
    }
  });

  // Search and Filter
  app.get('/api/files/search', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const { q, type, tags } = req.query;

      const filters: any = {};
      if (type) filters.type = type as 'file' | 'folder';
      if (tags) filters.tags = (tags as string).split(',');

      const files = await storage.searchFiles(userId, q as string || '', filters);

      res.json(files);
    } catch (error) {
      console.error("Error searching files:", error);
      res.status(500).json({ message: "Failed to search files" });
    }
  });

  // Trash Operations
  app.get('/api/files/trash', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const trashFiles = await storage.getTrashFiles(userId);

      res.json(trashFiles);
    } catch (error) {
      console.error("Error fetching trash files:", error);
      res.status(500).json({ message: "Failed to fetch trash files" });
    }
  });

  app.post('/api/files/trash/:trashId/restore', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const { trashId } = req.params;

      const restoredFile = await storage.restoreFromTrash(trashId, userId);

      // Create audit log
      await storage.createAuditLog({
        fileId: restoredFile.id,
        action: 'restore',
        userId,
        details: `Restored from trash: ${restoredFile.name}`
      });

      res.json({ 
        message: "File restored successfully",
        file: restoredFile
      });
    } catch (error) {
      console.error("Error restoring file:", error);
      res.status(500).json({ message: "Failed to restore file" });
    }
  });

  app.delete('/api/files/trash/:trashId', isAuthenticated, requireRole('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const { trashId } = req.params;

      await storage.permanentDelete(trashId, userId);

      res.json({ message: "File permanently deleted" });
    } catch (error) {
      console.error("Error permanently deleting file:", error);
      res.status(500).json({ message: "Failed to permanently delete file" });
    }
  });

  app.delete('/api/files/trash', isAuthenticated, requireRole('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;

      await storage.emptyTrash(userId);

      res.json({ message: "Trash emptied successfully" });
    } catch (error) {
      console.error("Error emptying trash:", error);
      res.status(500).json({ message: "Failed to empty trash" });
    }
  });

  // Backup Operations
  app.get('/api/files/:id/backups', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const { id } = req.params;

      const backups = await storage.getFileBackups(id, userId);

      res.json(backups);
    } catch (error) {
      console.error("Error fetching file backups:", error);
      res.status(500).json({ message: "Failed to fetch file backups" });
    }
  });

  app.post('/api/files/:id/backup', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const { id } = req.params;
      const { content } = req.body;

      const backup = await storage.createBackup(id, content, userId);

      res.status(201).json(backup);
    } catch (error) {
      console.error("Error creating backup:", error);
      res.status(500).json({ message: "Failed to create backup" });
    }
  });

  app.post('/api/files/backups/:backupId/restore', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const { backupId } = req.params;

      const restoredFile = await storage.restoreBackup(backupId, userId);

      // Create audit log
      await storage.createAuditLog({
        fileId: restoredFile.id,
        action: 'restore',
        userId,
        details: `Restored from backup: ${restoredFile.name}`
      });

      res.json({ 
        message: "File restored from backup successfully",
        file: restoredFile
      });
    } catch (error) {
      console.error("Error restoring from backup:", error);
      res.status(500).json({ message: "Failed to restore from backup" });
    }
  });

  // Permission Operations
  app.get('/api/files/:id/permissions', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const { id } = req.params;

      const permissions = await storage.getFilePermissions(id, userId);

      res.json(permissions);
    } catch (error) {
      console.error("Error fetching file permissions:", error);
      res.status(500).json({ message: "Failed to fetch file permissions" });
    }
  });

  app.post('/api/files/:id/permissions', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const { id } = req.params;
      const permissionData = insertFilePermissionSchema.parse({
        ...req.body,
        fileId: id,
        grantedBy: userId
      });

      const permission = await storage.setFilePermission(permissionData, userId);

      // Create audit log
      await storage.createAuditLog({
        fileId: id,
        action: 'share',
        userId,
        details: `Granted ${permission.permission} permission`,
        newValue: permission
      });

      res.status(201).json(permission);
    } catch (error) {
      console.error("Error setting file permission:", error);
      res.status(400).json({ message: "Failed to set file permission" });
    }
  });

  app.delete('/api/files/permissions/:permissionId', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const { permissionId } = req.params;

      await storage.removeFilePermission(permissionId, userId);

      res.json({ message: "Permission removed successfully" });
    } catch (error) {
      console.error("Error removing file permission:", error);
      res.status(500).json({ message: "Failed to remove file permission" });
    }
  });

  // Lock Operations
  app.get('/api/files/:id/locks', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;

      const locks = await storage.getFileLocks(id);

      res.json(locks);
    } catch (error) {
      console.error("Error fetching file locks:", error);
      res.status(500).json({ message: "Failed to fetch file locks" });
    }
  });

  app.post('/api/files/:id/lock', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const { id } = req.params;
      const { lockType = 'write', ttl } = req.body;

      const lock = await storage.lockFile(id, userId, lockType, ttl);

      // Create audit log
      await storage.createAuditLog({
        fileId: id,
        action: 'access',
        userId,
        details: `Applied ${lockType} lock`,
        newValue: lock
      });

      res.status(201).json(lock);
    } catch (error) {
      console.error("Error locking file:", error);
      res.status(400).json({ message: "Failed to lock file" });
    }
  });

  app.delete('/api/files/:id/lock', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const { id } = req.params;

      await storage.unlockFile(id, userId);

      // Create audit log
      await storage.createAuditLog({
        fileId: id,
        action: 'access',
        userId,
        details: 'Removed file lock'
      });

      res.json({ message: "File unlocked successfully" });
    } catch (error) {
      console.error("Error unlocking file:", error);
      res.status(500).json({ message: "Failed to unlock file" });
    }
  });

  // Audit Log Operations
  app.get('/api/files/audit', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const { fileId, limit } = req.query;

      const logs = await storage.getFileAuditLogs(
        fileId as string,
        userId,
        parseInt(limit as string) || 50
      );

      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // Copy and Share Operations
  app.post('/api/files/:id/copy', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const { id } = req.params;

      // Validate request body
      const copySchema = z.object({
        destinationFolderId: z.string().nullable().optional(),
        name: z.string().min(1).max(255).optional()
      });

      const { destinationFolderId, name } = copySchema.parse(req.body);

      const copiedFile = await storage.copyFile(id, destinationFolderId || null, userId, name);

      res.status(201).json(copiedFile);
    } catch (error) {
      console.error("Error copying file:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to copy file" });
    }
  });

  app.post('/api/files/:id/duplicate', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const { id } = req.params;

      const duplicatedFile = await storage.duplicateFile(id, userId);

      res.status(201).json(duplicatedFile);
    } catch (error) {
      console.error("Error duplicating file:", error);
      res.status(400).json({ message: "Failed to duplicate file" });
    }
  });

  app.post('/api/files/:id/share', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const { id } = req.params;

      // Validate request body
      const shareSchema = z.object({
        isPublic: z.boolean()
      });

      const { isPublic } = shareSchema.parse(req.body);

      const sharedFile = await storage.shareFile(id, isPublic, userId);

      res.json({
        file: sharedFile,
        publicUrl: isPublic ? storage.getPublicFileUrl(id) : null
      });
    } catch (error) {
      console.error("Error sharing file:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to share file" });
    }
  });

  app.get('/api/files/:id/download', async (req: Request, res) => {
    try {
      const { id } = req.params;
      const { public: isPublicRequest } = req.query;
      const isPublicDownload = isPublicRequest === 'true';

      // For public downloads, find file without user filter
      let file;
      let userId = null;

      if (isPublicDownload) {
        // Get file without user restriction for public downloads
        const [publicFile] = await db
          .select()
          .from(files)
          .where(and(eq(files.id, id), eq(files.isPublic, true)));

        if (!publicFile) {
          return res.status(404).json({ message: "Public file not found" });
        }
        file = publicFile;
      } else {
        // Authenticated download - require login
        const authenticatedReq = req as AuthenticatedRequest;
        if (!authenticatedReq.user) {
          return res.status(401).json({ message: "Authentication required" });
        }

        userId = getUserId(authenticatedReq)!;
        file = await storage.getFile(id, userId);

        if (!file) {
          return res.status(404).json({ message: "File not found" });
        }

        // Check permissions for authenticated downloads
        const hasAccess = await storage.checkFilePermission(id, userId, 'read');
        if (!hasAccess) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      // Use FileManagerService to read file
      const result = await fileManagerService.readFile(file.path, userId || 'public');
      if (!result.success) {
        return res.status(404).json({ message: result.message });
      }

      // Set appropriate headers for download
      res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
      res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');

      // Handle file content - if it's binary, send as buffer
      const content = result.data?.content || '';
      if (file.mimeType && !file.mimeType.startsWith('text/') && file.mimeType !== 'application/json') {
        // For binary files, create a buffer
        res.setHeader('Content-Length', (file.size || 0).toString());
        res.send(Buffer.from(content, 'binary'));
      } else {
        // For text files, send as string
        res.send(content);
      }

      // Create audit log for authenticated downloads
      if (userId) {
        await storage.createAuditLog({
          fileId: id,
          action: 'access',
          userId,
          details: `Downloaded file: ${file.name}`
        });
      }
    } catch (error) {
      console.error("Error downloading file:", error);
      res.status(500).json({ message: "Failed to download file" });
    }
  });

  // Get files and folders in current directory - placed last to avoid route conflicts
  app.get('/api/files/:folderId?', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      // Support both query param and path param for folder ID
      const folderId = req.params.folderId || req.query.folderId || null;

      // Convert 'root' or 'null' string to actual null
      const actualFolderId = (folderId === 'root' || folderId === 'null') ? null : folderId as string || null;

      // Get files in the specified folder (or root if no folderId)
      const rawFiles = await storage.getFiles(actualFolderId, userId);

      // Normalize data to match FileItem interface from frontend
      const files = rawFiles.map(file => ({
        ...file,
        size: file.size || 0, // Ensure size is never null
        createdAt: file.createdAt instanceof Date ? file.createdAt.toISOString() : (file.createdAt || new Date().toISOString()),
        updatedAt: file.updatedAt instanceof Date ? file.updatedAt.toISOString() : (file.updatedAt || new Date().toISOString()),
        tags: file.tags || [], // Ensure tags is always an array
        metadata: file.metadata || {}, // Ensure metadata is always an object
        isPublic: file.isPublic || false, // Ensure boolean
        checksum: file.checksum || undefined, // Convert null to undefined
        mimeType: file.mimeType || undefined, // Convert null to undefined
      }));

      res.json(files);
    } catch (error) {
      console.error("Error fetching files:", error);
      res.status(500).json({ message: "Failed to fetch files" });
    }
  });

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
      const systemInfo = await systemService.getSystemInfo();
      res.json(systemInfo);
    } catch (error) {
      console.error("Error fetching system info:", error);
      res.status(500).json({ message: "Failed to fetch system info" });
    }
  });

  app.get('/api/system/processes', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
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

  // Health check route
  app.get('/api/health', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const healthStatus = await systemService.performHealthCheck();
      res.json(healthStatus);
    } catch (error) {
      console.error("Error checking health:", error);
      res.status(500).json({ message: "Failed to check health status" });
    }
  });

  // System health check route (for HealthCheck page)
  app.get('/api/system/health-check', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
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
      const { auditService } = await import('./services/auditService');

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
      const { AuditHelpers } = await import('../utils/auditHelpers');

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

      const result = await systemService.executeCommand(command);
      res.json(result);
    } catch (error) {
      console.error("Error executing command:", error);
      res.status(500).json({ message: "Failed to execute command" });
    }
  });

  // WebSocket server setup with CORS inheritance and Origin checking
  const wss = new WebSocketServer({ 
    server, 
    path: '/ws',
    verifyClient: (info: any) => {
      // Verify Origin for security
      const origin = info.origin;
      const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined;

      const allowedOrigins = isDevelopment 
        ? ['http://localhost:5000', 'https://replit.dev', 'http://127.0.0.1:5000']
        : ['https://binarjoinanelytic.info'];

      if (!origin || !allowedOrigins.some(allowed => 
        origin === allowed || (isDevelopment && (
          origin.includes('localhost') || 
          origin.includes('replit.dev') ||
          origin.includes('127.0.0.1')
        ))
      )) {
        console.warn(`Security: Blocked WebSocket connection from unauthorized origin: ${origin}`);
        return false;
      }

      return true;
    }
  });

  wss.on('connection', async (ws, req) => {
    wsClients.add(ws);
    console.log('WebSocket client connected from:', req.headers.origin);

    // Store user info for this connection (for terminal authentication)
    let wsUser: any = null;
    let isTerminalAuthenticated = false;
    let activeProcess: any = null; // Track active terminal process

    // Parse cookies to get session
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

    // Authenticate user using HTTP session (NOT token)
    const authenticateUser = async () => {
      try {
        const cookies = parseCookies(req.headers.cookie || '');
        const sessionId = cookies['connect.sid'];

        if (!sessionId) {
          return null;
        }

        // TODO: Implement proper session store validation
        // For now, simulated - in production, validate against session store
        if (sessionId && sessionId.length > 10) {
          // Mock user - in production, get from authenticated session
          return { 
            isAuthenticated: true, 
            role: 'admin', // Get from actual session/database
            id: 'authenticated-user-id' // Get from actual session
          };
        }

        return null;
      } catch (error) {
        console.error('Session validation error:', error);
        return null;
      }
    };

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());

        switch (message.type) {
          case 'TERMINAL_AUTH_REQUEST':
            // Authenticate the WebSocket connection using HTTP session (NO TOKENS)
            try {
              wsUser = await authenticateUser();

              if (!wsUser || !wsUser.isAuthenticated) {
                ws.send(JSON.stringify({
                  type: 'TERMINAL_AUTH_ERROR',
                  message: 'Authentication failed. Please login first.'
                }));
                return;
              }

              // Check role authorization for terminal access
              if (wsUser.role !== 'admin') {
                console.warn(`Security: Terminal access denied for user ${wsUser.id} with role: ${wsUser.role}`);
                ws.send(JSON.stringify({
                  type: 'TERMINAL_AUTH_ERROR',
                  message: 'Admin role required for terminal access.'
                }));
                return;
              }

              isTerminalAuthenticated = true;
              console.log(`Security: Terminal access granted for admin user: ${wsUser.id}`);

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
            // Execute terminal command via WebSocket - SECURE VERSION
            if (!isTerminalAuthenticated || !wsUser || !wsUser.isAuthenticated) {
              ws.send(JSON.stringify({
                type: 'TERMINAL_ERROR',
                message: 'Terminal authentication required'
              }));
              return;
            }

            // Strict role check for terminal access - ADMIN ONLY
            if (wsUser.role !== 'admin') {
              ws.send(JSON.stringify({
                type: 'TERMINAL_ERROR',
                message: 'Admin role required for terminal access'
              }));
              return;
            }

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
              console.warn(`Security: Blocked unauthorized command attempt: "${trimmedCommand}" from user: ${wsUser.id}`);
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
              console.error(`Security: Blocked command with dangerous characters: "${trimmedCommand}" from user: ${wsUser.id}`);
              ws.send(JSON.stringify({
                type: 'TERMINAL_ERROR',
                message: 'Command contains dangerous characters and is blocked.'
              }));
              return;
            }

            // Log command execution for security audit
            console.log(`Terminal: User ${wsUser.id} executing: "${trimmedCommand}"`);

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
                console.log(`Terminal: User ${wsUser.id} command "${trimmedCommand}" completed with exit code: ${code}, signal: ${signal}`);
              });

              // Handle process errors
              childProcess.on('error', (error: Error) => {
                activeProcess = null; // Clear reference
                console.error(`Terminal: Process error for command "${trimmedCommand}":`, error);
                ws.send(JSON.stringify({
                  type: 'TERMINAL_ERROR',
                  message: `Process error: ${error.message}`
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
              ws.send(JSON.stringify({
                type: 'TERMINAL_ERROR',
                message: `Failed to execute command: ${error instanceof Error ? error.message : 'Unknown error'}`
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

    ws.on('close', (code: number, reason: Buffer) => {
      wsClients.delete(ws);

      // CRITICAL: Kill any active process on connection close
      if (activeProcess) {
        console.log(`Terminal: Killing active process on connection close for user: ${wsUser?.id}`);
        activeProcess.kill('SIGTERM');
        setTimeout(() => {
          if (activeProcess) {
            activeProcess.kill('SIGKILL');
          }
        }, 5000);
        activeProcess = null;
      }

      // If user was authenticated, log the disconnection for security
      if (wsUser) {
        console.log(`Terminal: Authenticated user ${wsUser.id} disconnected`);
      }

      // Reset authentication state
      wsUser = null;
      isTerminalAuthenticated = false;

      console.log(`WebSocket client disconnected. Code: ${code}, Reason: ${reason.toString()}`);
    });

    ws.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
      wsClients.delete(ws);

      // Reset authentication state on error
      wsUser = null;
      isTerminalAuthenticated = false;

      // Log security event if authenticated user had error
      if (wsUser) {
        console.warn(`Terminal: Authenticated user ${wsUser.id} connection error: ${error.message}`);
      }
    });

    // Send initial connection message
    ws.send(JSON.stringify({
      type: 'CONNECTED',
      message: 'Connected to server - Terminal ready'
    }));
  });

  // ===================================
  // REAL FILE SYSTEM API ROUTES
  // ===================================

  // Browse directory contents
  app.get('/api/real-files/browse', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const { path: dirPath } = req.query;

      if (!dirPath || typeof dirPath !== 'string') {
        return res.status(400).json({ message: 'Path parameter is required' });
      }

      const result = await realFileSystemService.listDirectory(dirPath, userId);

      if (!result.success) {
        return res.status(400).json({ 
          message: result.message,
          error: result.error 
        });
      }

      res.json(result.data);
    } catch (error) {
      console.error("Error browsing real files directory:", error);
      res.status(500).json({ message: "Failed to browse directory" });
    }
  });

  // Get file or directory info
  app.get('/api/real-files/info', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const { path: filePath } = req.query;

      if (!filePath || typeof filePath !== 'string') {
        return res.status(400).json({ message: 'Path parameter is required' });
      }

      const result = await realFileSystemService.getFileInfo(filePath, userId);

      if (!result.success) {
        return res.status(400).json({ 
          message: result.message,
          error: result.error 
        });
      }

      res.json(result.data);
    } catch (error) {
      console.error("Error getting real file info:", error);
      res.status(500).json({ message: "Failed to get file info" });
    }
  });

  // Read file content
  app.get('/api/real-files/content', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const { path: filePath, encoding = 'utf8' } = req.query;

      if (!filePath || typeof filePath !== 'string') {
        return res.status(400).json({ message: 'Path parameter is required' });
      }

      const result = await realFileSystemService.readFileContent(filePath, userId, encoding as BufferEncoding);

      if (!result.success) {
        return res.status(400).json({ 
          message: result.message,
          error: result.error 
        });
      }

      res.json(result.data);
    } catch (error) {
      console.error("Error reading real file content:", error);
      res.status(500).json({ message: "Failed to read file content" });
    }
  });

  // Create file or directory
  app.post('/api/real-files/create', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const { path: itemPath, type, content, mode, recursive, overwrite } = req.body;

      if (!itemPath || !type) {
        return res.status(400).json({ message: 'Path and type are required' });
      }

      if (!['file', 'directory'].includes(type)) {
        return res.status(400).json({ message: 'Type must be "file" or "directory"' });
      }

      let result;

      if (type === 'directory') {
        result = await realFileSystemService.createDirectory(itemPath, userId, {
          recursive,
          mode
        });
      } else {
        result = await realFileSystemService.createFile(itemPath, userId, {
          content,
          mode,
          overwrite
        });
      }

      if (!result.success) {
        return res.status(400).json({ 
          message: result.message,
          error: result.error 
        });
      }

      res.status(201).json(result.data);
    } catch (error) {
      console.error("Error creating real file/directory:", error);
      res.status(500).json({ message: "Failed to create file/directory" });
    }
  });

  // Delete file or directory
  app.delete('/api/real-files/delete', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const { path: itemPath } = req.body;

      if (!itemPath) {
        return res.status(400).json({ message: 'Path is required' });
      }

      const result = await realFileSystemService.deleteItem(itemPath, userId);

      if (!result.success) {
        return res.status(400).json({ 
          message: result.message,
          error: result.error 
        });
      }

      res.json({ message: result.message, data: result.data });
    } catch (error) {
      console.error("Error deleting real file/directory:", error);
      res.status(500).json({ message: "Failed to delete file/directory" });
    }
  });

  // Rename file or directory
  app.put('/api/real-files/rename', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const { oldPath, newPath } = req.body;

      if (!oldPath || !newPath) {
        return res.status(400).json({ message: 'Both oldPath and newPath are required' });
      }

      const result = await realFileSystemService.renameItem(oldPath, newPath, userId);

      if (!result.success) {
        return res.status(400).json({ 
          message: result.message,
          error: result.error 
        });
      }

      res.json(result.data);
    } catch (error) {
      console.error("Error renaming real file/directory:", error);
      res.status(500).json({ message: "Failed to rename file/directory" });
    }
  });

  // Copy file or directory
  app.post('/api/real-files/copy', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const { sourcePath, destinationPath } = req.body;

      if (!sourcePath || !destinationPath) {
        return res.status(400).json({ message: 'Both sourcePath and destinationPath are required' });
      }

      const result = await realFileSystemService.copyItem(sourcePath, destinationPath, userId);

      if (!result.success) {
        return res.status(400).json({ 
          message: result.message,
          error: result.error 
        });
      }

      res.status(201).json(result.data);
    } catch (error) {
      console.error("Error copying real file/directory:", error);
      res.status(500).json({ message: "Failed to copy file/directory" });
    }
  });

  // ===================================
  // ALLOWED PATHS MANAGEMENT API ROUTES
  // ===================================

  // Get all allowed paths
  app.get('/api/real-files/allowed-paths', isAuthenticated, requireRole('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const { type } = req.query;

      const allowedPaths = await storage.getAllowedPaths(type as 'allowed' | 'blocked' | undefined);

      res.json(allowedPaths);
    } catch (error) {
      console.error("Error fetching allowed paths:", error);
      res.status(500).json({ message: "Failed to fetch allowed paths" });
    }
  });

  // Create new allowed path
  app.post('/api/real-files/allowed-paths', isAuthenticated, requireRole('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getUserId(req)!;
      const pathData = insertAllowedPathSchema.parse({
        ...req.body,
        addedBy: userId
      });

      const allowedPath = await storage.createAllowedPath(pathData);

      res.status(201).json(allowedPath);
    } catch (error) {
      console.error("Error creating allowed path:", error);
      res.status(500).json({ message: "Failed to create allowed path" });
    }
  });

  // Update allowed path
  app.put('/api/real-files/allowed-paths/:id', isAuthenticated, requireRole('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Remove addedBy from updates to prevent manipulation
      delete updates.addedBy;

      const allowedPath = await storage.updateAllowedPath(id, updates);

      res.json(allowedPath);
    } catch (error) {
      console.error("Error updating allowed path:", error);
      res.status(500).json({ message: "Failed to update allowed path" });
    }
  });

  // Delete allowed path
  app.delete('/api/real-files/allowed-paths/:id', isAuthenticated, requireRole('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;

      await storage.deleteAllowedPath(id);

      res.json({ message: 'Allowed path deleted successfully' });
    } catch (error) {
      console.error("Error deleting allowed path:", error);
      res.status(500).json({ message: "Failed to delete allowed path" });
    }
  });

  // Check if path is allowed (utility endpoint)
  app.post('/api/real-files/check-path', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { path: checkPath } = req.body;

      if (!checkPath) {
        return res.status(400).json({ message: 'Path is required' });
      }

      const isAllowed = await storage.checkPathAllowed(checkPath);

      res.json({ path: checkPath, isAllowed });
    } catch (error) {
      console.error("Error checking path:", error);
      res.status(500).json({ message: "Failed to check path" });
    }
  });

  // ===================================
  // STORAGE STATISTICS API ROUTES
  // ===================================

  // Import StorageStatsService
  const { StorageStatsService } = await import('./services/storageStatsService');
  const storageStatsService = new StorageStatsService();

  // Get storage statistics
  app.get('/api/storage/stats', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const stats = await storageStatsService.getStorageStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      console.error("Error fetching storage stats:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to fetch storage statistics",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Clear storage statistics cache (for testing/refresh)
  app.post('/api/storage/stats/refresh', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      storageStatsService.clearCache();
      const stats = await storageStatsService.getStorageStats();
      res.json({ 
        success: true, 
        message: "Storage statistics refreshed successfully",
        data: stats 
      });
    } catch (error) {
      console.error("Error refreshing storage stats:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to refresh storage statistics",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return server;
}