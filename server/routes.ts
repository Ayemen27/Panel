import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { 
  insertApplicationSchema, 
  insertDomainSchema, 
  insertSslCertificateSchema,
  insertNginxConfigSchema,
  insertNotificationSchema 
} from "@shared/schema";
import { z } from "zod";
import { pm2Service } from "./services/pm2Service";
import { nginxService } from "./services/nginxService";
import { sslService } from "./services/sslService";
import { systemService } from "./services/systemService";
import { logService } from "./services/logService";

// WebSocket clients store
const wsClients = new Set<WebSocket>();

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

// Enhanced authentication middleware for Replit OIDC with role-based access
interface AuthenticatedRequest extends Express.Request {
  user?: any; // Replit OIDC user session
}

const requireRole = (roles: string[]) => {
  return async (req: AuthenticatedRequest, res: any, next: any) => {
    if (!req.user || !req.user.claims) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    try {
      // Get user from database to check role
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !user.isActive) {
        return res.status(401).json({ message: 'User not found or inactive' });
      }

      if (roles.length > 0 && !roles.includes(user.role || 'user')) {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }

      // Add user data to request for downstream use
      req.user.dbUser = user;
      next();
    } catch (error) {
      console.error('Role check error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };
};

// Helper function to get user ID from Replit OIDC
const getUserId = (req: AuthenticatedRequest): string | null => {
  return req.user?.claims?.sub || null;
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

  // Setup Replit authentication
  await setupAuth(app);

  // Auth routes for Replit OIDC
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json(user);
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Admin routes with role-based access
  app.get('/api/admin/users', isAuthenticated, requireRole(['admin']), async (req: any, res) => {
    try {
      const users = await storage.getUsersByRole('user');
      res.json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.patch('/api/admin/users/:id/role', isAuthenticated, requireRole(['admin']), async (req: any, res) => {
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

      // Get real-time status for each application
      const appsWithStatus = await Promise.all(
        applications.map(async (app) => {
          const status = await pm2Service.getApplicationStatus(app.name);
          return { ...app, status };
        })
      );

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
        testResult: testResult.message
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

  app.post('/api/nginx/reload', isAuthenticated, requireRole(['admin']), async (req: AuthenticatedRequest, res) => {
    try {
      const result = await nginxService.reload();
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
      res.status(500).json({ message: "Failed to fetch processes" });
    }
  });

  // Health check route
  app.get('/api/health', isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const healthStatus = await systemService.getHealthStatus();
      res.json(healthStatus);
    } catch (error) {
      console.error("Error checking health:", error);
      res.status(500).json({ message: "Failed to check health status" });
    }
  });

  // Database connection test
  app.get('/api/db/test', isAuthenticated, requireRole(['admin']), async (req: AuthenticatedRequest, res) => {
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

  // Terminal commands (restricted)
  app.post('/api/terminal/execute', isAuthenticated, requireRole(['admin']), async (req: AuthenticatedRequest, res) => {
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

  // WebSocket server setup with CORS inheritance
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    wsClients.add(ws);

    ws.on('close', () => {
      wsClients.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      wsClients.delete(ws);
    });

    // Send initial connection message
    ws.send(JSON.stringify({
      type: 'CONNECTED',
      message: 'Connected to server'
    }));
  });

  return server;
}