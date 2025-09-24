
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';

const execAsync = promisify(exec);

export class DeploymentService {
  async checkDeploymentReadiness(): Promise<{
    ready: boolean;
    issues: Array<{
      severity: 'critical' | 'warning' | 'info';
      category: string;
      message: string;
      fix?: string;
    }>;
    score: number;
  }> {
    const issues = [];
    let score = 100;

    // Check Node.js version
    try {
      const { stdout } = await execAsync('node --version');
      const version = stdout.trim();
      const majorVersion = parseInt(version.substring(1).split('.')[0]);
      
      if (majorVersion < 18) {
        issues.push({
          severity: 'critical',
          category: 'Runtime',
          message: `Node.js version ${version} is too old`,
          fix: 'Update to Node.js 18 or later'
        });
        score -= 30;
      }
    } catch (error) {
      issues.push({
        severity: 'critical',
        category: 'Runtime',
        message: 'Node.js not found',
        fix: 'Install Node.js'
      });
      score -= 50;
    }

    // Check PM2
    try {
      await execAsync('pm2 --version');
    } catch (error) {
      issues.push({
        severity: 'warning',
        category: 'Process Manager',
        message: 'PM2 not installed',
        fix: 'npm install -g pm2'
      });
      score -= 15;
    }

    // Check database connection
    try {
      const { storage } = await import('../storage');
      await storage.testConnection();
    } catch (error) {
      issues.push({
        severity: 'critical',
        category: 'Database',
        message: 'Database connection failed',
        fix: 'Check DATABASE_URL and network connectivity'
      });
      score -= 40;
    }

    // Check SSL certificates directory
    try {
      await fs.access('/etc/letsencrypt');
    } catch (error) {
      issues.push({
        severity: 'warning',
        category: 'SSL',
        message: 'Let\'s Encrypt directory not found',
        fix: 'Install certbot: sudo apt install certbot'
      });
      score -= 10;
    }

    // Check backup directory
    try {
      await fs.access('/home/administrator/backups');
    } catch (error) {
      issues.push({
        severity: 'warning',
        category: 'Backup',
        message: 'Backup directory not found',
        fix: 'mkdir -p /home/administrator/backups'
      });
      score -= 5;
    }

    const ready = issues.filter(i => i.severity === 'critical').length === 0;

    return { ready, issues, score };
  }

  async setupForProduction(): Promise<{
    success: boolean;
    steps: Array<{
      name: string;
      success: boolean;
      message: string;
    }>;
  }> {
    const steps = [];

    // Create necessary directories
    try {
      await fs.mkdir('/home/administrator/backups', { recursive: true });
      await fs.mkdir('/home/administrator/logs', { recursive: true });
      steps.push({
        name: 'Create directories',
        success: true,
        message: 'Application directories created'
      });
    } catch (error) {
      steps.push({
        name: 'Create directories',
        success: false,
        message: `Failed to create directories: ${error}`
      });
    }

    // Setup PM2 startup
    try {
      await execAsync('pm2 startup');
      steps.push({
        name: 'PM2 startup',
        success: true,
        message: 'PM2 startup script configured'
      });
    } catch (error) {
      steps.push({
        name: 'PM2 startup',
        success: false,
        message: `PM2 startup failed: ${error}`
      });
    }

    // Set environment to production
    try {
      const envContent = await fs.readFile('.env', 'utf-8');
      const updatedEnv = envContent.replace(/NODE_ENV=.*/g, 'NODE_ENV=production');
      await fs.writeFile('.env', updatedEnv);
      steps.push({
        name: 'Environment setup',
        success: true,
        message: 'Environment set to production'
      });
    } catch (error) {
      steps.push({
        name: 'Environment setup',
        success: false,
        message: `Environment setup failed: ${error}`
      });
    }

    const success = steps.every(step => step.success);
    return { success, steps };
  }
}

export const deploymentService = new DeploymentService();
