import { Pool, PoolClient, QueryResult } from 'pg';
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

  // تجميع الاستعلامات لتقليل عدد الاتصالات
  private queryQueue: Array<{
    text: string;
    params?: any[];
    resolve: (result: any) => void;
    reject: (error: any) => void;
  }> = [];

  private isProcessingQueue = false;

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
    for (const [key, connection] of Array.from(this.connections.entries())) {
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

    for (const connection of Array.from(this.connections.values())) {
      if (connection.isHealthy) {
        stats.healthy++;
      } else {
        stats.unhealthy++;
      }
    }

    return stats;
  }

  // Helper to get a connection from the pool
  private async getConnection(): Promise<PoolClient> {
    const connection = this.getSmartConnection();
    if (!connection.pool) {
      throw new Error('🔴 No database pool available');
    }
    return connection.pool.connect();
  }

  // Helper to release a connection back to the pool
  private releaseConnection(client: PoolClient): void {
    client.release();
  }

  // Placeholder for metrics update (to be implemented)
  private updateMetrics(type: string, duration: number, success: boolean): void {
    // console.log(`Metric: ${type}, Duration: ${duration}ms, Success: ${success}`);
  }

  async query<T extends any = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    // تجميع استعلامات SELECT البسيطة
    if (this.shouldBatchQuery(text)) {
      return new Promise((resolve, reject) => {
        this.queryQueue.push({ text, params, resolve, reject });
        this.processQueue();
      });
    }

    // للاستعلامات المعقدة، استخدم المعالجة المباشرة
    const start = Date.now();
    let client: PoolClient | null = null;

    try {
      client = await this.getConnection();
      const result = await client.query(text, params);

      const duration = Date.now() - start;
      this.updateMetrics('query', duration, true);

      if (duration > 500) {
        console.warn(`⚠️ Slow query detected (${duration}ms):`, text.substring(0, 100));
      }

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.updateMetrics('query', duration, false);
      console.error('🔴 Database query error:', error);
      throw error;
    } finally {
      if (client) {
        this.releaseConnection(client);
      }
    }
  }
    // تجميع استعلامات SELECT البسيطة
    if (this.shouldBatchQuery(text)) {
      return new Promise((resolve, reject) => {</old_str>
    // تجميع استعلامات SELECT البسيطة
    if (this.shouldBatchQuery(text)) {
      return new Promise((resolve, reject) => {
        this.queryQueue.push({ text, params, resolve, reject });
        this.processQueue();
      });
    }

    // للاستعلامات المعقدة، استخدم المعالجة المباشرة
    const start = Date.now();
    let client: PoolClient | null = null;

    try {
      client = await this.getConnection();
      const result = await client.query(text, params);

      const duration = Date.now() - start;
      this.updateMetrics('query', duration, true);

      if (duration > 500) {
        console.warn(`⚠️ Slow query detected (${duration}ms):`, text.substring(0, 100));
      }

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.updateMetrics('query', duration, false);
      console.error('🔴 Database query error:', error);
      throw error;
    } finally {
      if (client) {
        this.releaseConnection(client);
      }
    }
  }

  private shouldBatchQuery(text: string): boolean {
    // تجميع استعلامات SELECT البسيطة
    return text.toLowerCase().startsWith('select') &&
           !text.toLowerCase().includes('for update') &&
           this.queryQueue.length < 10;
  }

  private async processQueue() {
    if (this.isProcessingQueue || this.queryQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;
    const batch = this.queryQueue.splice(0, 5); // معالجة 5 استعلامات في المرة الواحدة

    let client: PoolClient | null = null;

    try {
      client = await this.getConnection();

      for (const query of batch) {
        try {
          const result = await client.query(query.text, query.params);
          query.resolve(result);
        } catch (error) {
          query.reject(error);
        }
      }
    } catch (error) {
      batch.forEach(query => query.reject(error));
    } finally {
      if (client) {
        this.releaseConnection(client);
      }
      this.isProcessingQueue = false;

      // معالجة الاستعلامات المتبقية
      if (this.queryQueue.length > 0) {
        setTimeout(() => this.processQueue(), 10);
      }
    }
  }
}

export const smartConnectionManager = new SmartConnectionManager();