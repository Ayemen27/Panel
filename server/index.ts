// تحميل متغيرات البيئة أولاً قبل أي شيء آخر
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.js";
import { setupVite, serveStatic, log } from "./vite.js";
import { ENV_CONFIG, logEnvironmentInfo } from "../shared/environment";

// SSL certificate verification is enabled for security
// If you encounter SSL issues with database connections, configure proper certificates
// instead of disabling SSL verification globally

logEnvironmentInfo();

// تشخيص المسارات
import { pathManager } from './utils/pathManager';
import { setupDirectories } from './scripts/setup-directories.js';

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

// إعداد حدود حجم الطلبات لتجنب "Request entity too large"
app.use(express.json({ 
  limit: '50mb',
  verify: (req, res, buf) => {
    // تحقق من صحة JSON قبل المعالجة
    try {
      JSON.parse(buf.toString());
    } catch (e) {
      res.status(400).json({ 
        success: false, 
        error: 'Invalid JSON format',
        message: 'البيانات المرسلة غير صحيحة' 
      });
      return;
    }
  }
}));
app.use(express.urlencoded({ 
  limit: '50mb', 
  extended: true,
  parameterLimit: 10000
}));

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
  // إعداد المجلدات المطلوبة قبل بدء الخادم
  console.log('🏗️ Setting up directories...');
  try {
    await setupDirectories();
    console.log('✅ Directory setup completed');
  } catch (error) {
    console.warn('⚠️ Directory setup failed, continuing anyway:', error);
  }

  // إعداد PM2 بشكل صحيح
  console.log('🔧 Setting up PM2...');
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    // التحقق من وجود PM2 وإعداده
    try {
      await execAsync('pm2 --version');
      console.log('✅ PM2 is available');
      
      // تنظيف أي عمليات معلقة
      await execAsync('pm2 delete all').catch(() => {});
      await execAsync('pm2 save --force').catch(() => {});
      console.log('✅ PM2 cleaned and ready');
    } catch (pm2Error) {
      console.warn('⚠️ PM2 setup issues, using fallback mode');
    }
  } catch (error) {
    console.warn('⚠️ PM2 setup failed:', error);
  }

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
  let port = parseInt(process.env.PORT || '5001', 10);
  console.log(`🔧 Server will start on port: ${port}`);

  // سيتم معالجة port conflicts في tryStartServer function

  // معالجة أخطاء بدء السيرفر
  const startServer = (targetPort: number) => {
    return new Promise<void>((resolve, reject) => {
      // تسجيل error handler قبل بدء الاستماع
      server.once('error', (error: any) => {
        log(`❌ Server error on port ${targetPort}: ${error.message || error}`);
        if (error.code === 'EADDRINUSE') {
          log(`❌ Port ${targetPort} is already in use`);
          reject(new Error(`Port ${targetPort} is already in use`));
        } else {
          reject(error);
        }
      });
      
      const serverInstance = server.listen(targetPort, "0.0.0.0", () => {
        log(`Server listening on all interfaces at port ${targetPort}`);
        log(`WebSocket server available at ws://localhost:${targetPort}/ws`);
        resolve();
      });
    });
  };

  // محاولة بدء السيرفر مع fallback للمنافذ البديلة
  const tryStartServer = async () => {
    log(`🚀 Starting server on port ${port}...`);
    try {
      await startServer(port);
    } catch (error) {
      log(`❌ Server failed to start on port ${port}: ${error}`);
      // إذا كنا في Replit وفشل المنفذ الأساسي، جرب منافذ بديلة
      if (ENV_CONFIG.isReplit) {
        const fallbackPorts = [5001, 5002, 8080, 8000, 3000];
        let serverStarted = false;
        
        for (const fallbackPort of fallbackPorts) {
          try {
            log(`🚨 Attempting fallback to port ${fallbackPort}`);
            await startServer(fallbackPort);
            serverStarted = true;
            break;
          } catch (fallbackError) {
            log(`❌ Fallback port ${fallbackPort} also failed`);
          }
        }
        
        if (!serverStarted) {
          log(`💥 All ports failed, server cannot start`);
          process.exit(1);
        }
      } else {
        log(`💥 Server failed to start: ${error}`);
        process.exit(1);
      }
    }
  };

  log(`🔄 About to call tryStartServer...`);
  await tryStartServer();
  log(`✅ Server startup process completed`);
})();