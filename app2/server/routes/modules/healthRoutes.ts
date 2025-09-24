/**
 * مسارات الصحة ومراقبة النظام
 * Health & System Monitoring Routes
 */

import express from 'express';
import { Request, Response } from 'express';
import { db } from '../../db.js';

export const healthRouter = express.Router();

/**
 * فحص صحة النظام البسيط
 * Simple health check endpoint
 */
healthRouter.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: "healthy", 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '2.0.0-organized'
  });
});

/**
 * فحص الاتصال بقاعدة البيانات
 * Database connection verification
 */
healthRouter.get('/db/info', async (req: Request, res: Response) => {
  try {
    const result = await db.execute(`
      SELECT 
        current_database() as database_name, 
        current_user as username,
        version() as version_info
    `);
    res.json({ 
      success: true, 
      database: result.rows[0],
      message: "متصل بقاعدة بيانات app2data بنجاح" 
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message,
      message: "Database connection failed" 
    });
  }
});

/**
 * فحص حالة النظام التفصيلية
 * Detailed system status
 */
healthRouter.get('/status', (req: Request, res: Response) => {
  const memoryUsage = process.memoryUsage();
  res.json({
    success: true,
    data: {
      status: 'healthy',
      environment: process.env.NODE_ENV || 'development',
      uptime: {
        seconds: Math.floor(process.uptime()),
        formatted: Math.floor(process.uptime() / 3600) + 'h ' + Math.floor((process.uptime() % 3600) / 60) + 'm'
      },
      memory: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
        external: Math.round(memoryUsage.external / 1024 / 1024) + ' MB'
      },
      performance: {
        cpuUsage: process.cpuUsage(),
        version: process.version,
        platform: process.platform
      }
    },
    timestamp: new Date().toISOString()
  });
});

console.log('🏥 [HealthRouter] تم تهيئة مسارات الصحة والمراقبة');

export default healthRouter;