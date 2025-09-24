
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

interface SmartConnection {
  pool: Pool | null;
  db: any | null;
  source: string;
  isHealthy: boolean;
  lastChecked: Date;
}

class SmartConnectionManager {
  private connections: Map<string, SmartConnection> = new Map();
  private readonly healthCheckInterval = 30000; // 30 seconds

  constructor() {
    this.initializeConnections();
    this.startHealthCheck();
  }

  private initializeConnections() {
    // Initialize with primary connection
    this.connections.set('primary', {
      pool: null,
      db: null,
      source: 'primary',
      isHealthy: false,
      lastChecked: new Date()
    });

    console.log('🧠 تم تهيئة مدير الاتصالات الذكي');
  }

  private startHealthCheck() {
    setInterval(() => {
      this.checkConnectionsHealth();
    }, this.healthCheckInterval);
  }

  private async checkConnectionsHealth() {
    for (const [key, connection] of this.connections) {
      if (connection.pool) {
        try {
          const client = await connection.pool.connect();
          await client.query('SELECT 1');
          client.release();
          
          connection.isHealthy = true;
          connection.lastChecked = new Date();
        } catch (error) {
          console.warn(`⚠️ فقدان الاتصال مع: ${connection.source}`);
          connection.isHealthy = false;
        }
      }
    }
  }

  getSmartConnection(operationType: 'read' | 'write' | 'backup' | 'sync' = 'read'): SmartConnection {
    // للبساطة، سنعيد الاتصال الأساسي دائماً
    // يمكن تطوير هذا لاحقاً لدعم اتصالات متعددة
    
    const primaryConnection = this.connections.get('primary');
    
    if (!primaryConnection) {
      console.warn('⚠️ لا يوجد اتصال أساسي متاح');
      return {
        pool: null,
        db: null,
        source: 'fallback',
        isHealthy: false,
        lastChecked: new Date()
      };
    }

    return primaryConnection;
  }

  registerConnection(key: string, pool: Pool, db: any, source: string) {
    this.connections.set(key, {
      pool,
      db,
      source,
      isHealthy: true,
      lastChecked: new Date()
    });

    console.log(`✅ تم تسجيل اتصال جديد: ${source}`);
  }

  getConnectionStats() {
    const stats = {
      total: this.connections.size,
      healthy: 0,
      unhealthy: 0
    };

    for (const connection of this.connections.values()) {
      if (connection.isHealthy) {
        stats.healthy++;
      } else {
        stats.unhealthy++;
      }
    }

    return stats;
  }
}

export const smartConnectionManager = new SmartConnectionManager();
