
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import { promisify } from 'util';
import path from 'path';
import { BaseService, ServiceContext, ServiceResult } from '../core/BaseService';
import { IStorage } from '../storage';

const execAsync = promisify(exec);

export interface BackupConfig {
  id: string;
  name: string;
  type: 'database' | 'files' | 'full';
  schedule: string; // cron format
  retention: number; // days
  enabled: boolean;
  paths?: string[];
  excludePaths?: string[];
}

export class BackupService extends BaseService {
  private backupDir = '/home/administrator/backups';

  constructor(storage: IStorage, context?: ServiceContext) {
    super(storage, context);
    this.ensureBackupDirectory();
  }

  private async ensureBackupDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
      console.log('✅ Backup directory ready:', this.backupDir);
    } catch (error) {
      console.error('❌ Failed to create backup directory:', error);
    }
  }

  async createDatabaseBackup(name?: string): Promise<{
    success: boolean;
    path?: string;
    size?: number;
    error?: string;
  }> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = name || `database-backup-${timestamp}`;
      const backupPath = path.join(this.backupDir, `${backupName}.sql`);

      // Get database connection details from environment
      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) {
        throw new Error('DATABASE_URL not found');
      }

      // Parse connection string
      const url = new URL(dbUrl);
      const dbName = url.pathname.substring(1);
      const host = url.hostname;
      const port = url.port || '5432';
      const username = url.username;
      const password = url.password;

      // Create backup command
      const command = `PGPASSWORD="${password}" pg_dump -h ${host} -p ${port} -U ${username} -d ${dbName} --clean --if-exists > "${backupPath}"`;
      
      console.log('🔄 Creating database backup...');
      await execAsync(command);

      // Get backup file size
      const stats = await fs.stat(backupPath);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

      console.log(`✅ Database backup created: ${backupPath} (${sizeInMB} MB)`);

      return {
        success: true,
        path: backupPath,
        size: stats.size
      };

    } catch (error) {
      console.error('❌ Database backup failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async createFilesBackup(paths: string[], name?: string): Promise<{
    success: boolean;
    path?: string;
    size?: number;
    error?: string;
  }> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = name || `files-backup-${timestamp}`;
      const backupPath = path.join(this.backupDir, `${backupName}.tar.gz`);

      // Validate paths
      const validPaths = [];
      for (const filePath of paths) {
        try {
          await fs.access(filePath);
          validPaths.push(filePath);
        } catch (error) {
          console.warn(`⚠️ Path not accessible: ${filePath}`);
        }
      }

      if (validPaths.length === 0) {
        throw new Error('No valid paths to backup');
      }

      // Create tar command
      const pathsString = validPaths.map(p => `"${p}"`).join(' ');
      const command = `tar -czf "${backupPath}" ${pathsString}`;

      console.log('🔄 Creating files backup...');
      await execAsync(command);

      // Get backup file size
      const stats = await fs.stat(backupPath);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

      console.log(`✅ Files backup created: ${backupPath} (${sizeInMB} MB)`);

      return {
        success: true,
        path: backupPath,
        size: stats.size
      };

    } catch (error) {
      console.error('❌ Files backup failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async restoreDatabaseBackup(backupPath: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Verify backup file exists
      await fs.access(backupPath);

      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) {
        throw new Error('DATABASE_URL not found');
      }

      // Parse connection string
      const url = new URL(dbUrl);
      const dbName = url.pathname.substring(1);
      const host = url.hostname;
      const port = url.port || '5432';
      const username = url.username;
      const password = url.password;

      // Create restore command
      const command = `PGPASSWORD="${password}" psql -h ${host} -p ${port} -U ${username} -d ${dbName} < "${backupPath}"`;
      
      console.log('🔄 Restoring database backup...');
      await execAsync(command);

      console.log('✅ Database backup restored successfully');

      return { success: true };

    } catch (error) {
      console.error('❌ Database restore failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async listBackups(): Promise<Array<{
    name: string;
    path: string;
    size: number;
    created: Date;
    type: 'database' | 'files' | 'unknown';
  }>> {
    try {
      const files = await fs.readdir(this.backupDir);
      const backups = [];

      for (const file of files) {
        try {
          const filePath = path.join(this.backupDir, file);
          const stats = await fs.stat(filePath);

          if (stats.isFile()) {
            let type: 'database' | 'files' | 'unknown' = 'unknown';
            if (file.endsWith('.sql')) type = 'database';
            else if (file.endsWith('.tar.gz')) type = 'files';

            backups.push({
              name: file,
              path: filePath,
              size: stats.size,
              created: stats.ctime,
              type
            });
          }
        } catch (error) {
          console.warn(`⚠️ Error reading backup file ${file}:`, error);
        }
      }

      return backups.sort((a, b) => b.created.getTime() - a.created.getTime());

    } catch (error) {
      console.error('❌ Failed to list backups:', error);
      return [];
    }
  }

  async deleteBackup(backupPath: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Ensure the path is within backup directory for security
      const normalizedPath = path.normalize(backupPath);
      if (!normalizedPath.startsWith(this.backupDir)) {
        throw new Error('Invalid backup path');
      }

      await fs.unlink(backupPath);
      console.log('✅ Backup deleted:', backupPath);

      return { success: true };

    } catch (error) {
      console.error('❌ Failed to delete backup:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async cleanupOldBackups(retentionDays = 30): Promise<{
    deleted: number;
    errors: string[];
  }> {
    const result = { deleted: 0, errors: [] as string[] };
    
    try {
      const backups = await this.listBackups();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      for (const backup of backups) {
        if (backup.created < cutoffDate) {
          try {
            await this.deleteBackup(backup.path);
            result.deleted++;
          } catch (error) {
            result.errors.push(`Failed to delete ${backup.name}: ${error}`);
          }
        }
      }

      console.log(`🧹 Cleanup completed: ${result.deleted} backups deleted`);

    } catch (error) {
      result.errors.push(`Cleanup failed: ${error}`);
    }

    return result;
  }
}

// Remove singleton export - will be managed by ServiceContainer
// export const backupService = new BackupService();
