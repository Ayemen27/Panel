// تحميل متغيرات البيئة أولاً قبل أي شيء آخر
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.js";
import { setupVite, serveStatic, log } from "./vite";
import { ENV_CONFIG, logEnvironmentInfo } from "../shared/environment";

// SSL certificate verification is enabled for security
// If you encounter SSL issues with database connections, configure proper certificates
// instead of disabling SSL verification globally

logEnvironmentInfo();

// تشخيص المسارات
import { pathManager } from './utils/pathManager';
import { setupDirectories } from './scripts/setup-directories';

// إنشاء المجلدات المطلوبة
await setupDirectories();

pathManager.logPathsDiagnostic();

const app = express();

// Trust proxy configuration - secure and environment-specific
// Fix for express-rate-limit security warning
if (ENV_CONFIG.name === 'development' && !ENV_CONFIG.isReplit) {
  // Local development - no proxy
  app.set('trust proxy', false);
  log('🔒 Trust proxy: disabled (local development)');
} else if (ENV_CONFIG.isReplit || ENV_CONFIG.name === 'production') {
  // Replit or external/custom domain - trust first proxy level
  app.set('trust proxy', 1);
  log('🔒 Trust proxy: 1 level (Replit/external server)');
} else {
  // Fallback for custom domains with multiple proxy levels
  app.set('trust proxy', 2);
  log('🔒 Trust proxy: 2 levels (custom domain)');
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Authentication is now handled in registerRoutes

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    if (!res.headersSent) {
      res.status(status).json({ message });
    }
    log(`Error: ${err.message}`);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified for Replit
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  console.log(`🔧 Server will start on port: ${port}`);

  // Check if port is available
  const net = await import('net');
  const checkPort = (port: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const tester = net.createServer()
        .once('error', () => resolve(false))
        .once('listening', () => {
          tester.close();
          resolve(true);
        })
        .listen(port, '0.0.0.0');
    });
  };

  const isPortAvailable = await checkPort(port);
  if (!isPortAvailable) {
    log(`⚠️ Port ${port} is already in use. Attempting to kill existing process...`);
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      await execAsync(`pkill -f "node.*${port}"`);
      log(`✅ Killed existing process on port ${port}`);
      // Wait a moment for the port to be freed
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      log(`❌ Failed to kill existing process: ${error}`);
    }
  }

  server.listen(port, "0.0.0.0", () => {
    log(`Server listening on all interfaces at port ${port}`);
    log(`WebSocket server available at ws://localhost:${port}/ws`);
  });
})();