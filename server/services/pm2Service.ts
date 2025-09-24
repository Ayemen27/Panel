import { exec } from 'child_process';
import { promisify } from 'util';
import type { Application } from '@shared/schema';

const execAsync = promisify(exec);

export interface PM2Process {
  pid: number;
  name: string;
  pm_id: number;
  monit: {
    memory: number;
    cpu: number;
  };
  pm2_env: {
    status: string;
    restart_time: number;
    unstable_restarts: number;
    created_at: number;
    pm_uptime: number;
  };
}

export class PM2Service {
  async startApplication(application: Application): Promise<void> {
    try {
      const command = `cd ${application.path} && pm2 start ${application.command} --name ${application.name}`;
      await execAsync(command);
    } catch (error) {
      throw new Error(`Failed to start application: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async stopApplication(name: string): Promise<void> {
    try {
      await execAsync(`pm2 stop ${name}`);
    } catch (error) {
      throw new Error(`Failed to stop application: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async restartApplication(name: string): Promise<void> {
    try {
      await execAsync(`pm2 restart ${name}`);
    } catch (error) {
      throw new Error(`Failed to restart application: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteApplication(name: string): Promise<void> {
    try {
      await execAsync(`pm2 delete ${name}`);
    } catch (error) {
      throw new Error(`Failed to delete application: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getApplicationStatus(name: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`pm2 jlist`);
      const processes: PM2Process[] = JSON.parse(stdout);
      
      const process = processes.find(p => p.name === name);
      if (!process) {
        return 'stopped';
      }
      
      switch (process.pm2_env.status) {
        case 'online':
          return 'running';
        case 'stopped':
          return 'stopped';
        case 'errored':
          return 'error';
        case 'stopping':
          return 'stopping';
        case 'launching':
          return 'starting';
        default:
          return 'unknown';
      }
    } catch (error) {
      return 'error';
    }
  }

  async listProcesses(): Promise<PM2Process[]> {
    try {
      const { stdout } = await execAsync('pm2 jlist');
      return JSON.parse(stdout);
    } catch (error) {
      throw new Error(`Failed to list processes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getApplicationLogs(name: string, lines = 100): Promise<string[]> {
    try {
      const { stdout } = await execAsync(`pm2 logs ${name} --lines ${lines} --nostream`);
      return stdout.split('\n').filter(line => line.trim() !== '');
    } catch (error) {
      throw new Error(`Failed to get application logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getApplicationMetrics(name: string): Promise<{ cpu: number; memory: number; uptime: number; restarts: number }> {
    try {
      const { stdout } = await execAsync('pm2 jlist');
      const processes: PM2Process[] = JSON.parse(stdout);
      
      const process = processes.find(p => p.name === name);
      if (!process) {
        throw new Error('Application not found');
      }
      
      return {
        cpu: process.monit.cpu,
        memory: process.monit.memory,
        uptime: process.pm2_env.pm_uptime,
        restarts: process.pm2_env.restart_time
      };
    } catch (error) {
      throw new Error(`Failed to get application metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async saveConfiguration(): Promise<void> {
    try {
      await execAsync('pm2 save');
    } catch (error) {
      throw new Error(`Failed to save PM2 configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async resurrectProcesses(): Promise<void> {
    try {
      await execAsync('pm2 resurrect');
    } catch (error) {
      throw new Error(`Failed to resurrect processes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const pm2Service = new PM2Service();
