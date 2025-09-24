import { exec, spawn } from 'child_process';
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

// Store for tracking processes when PM2 is not available
interface ProcessInfo {
  pid: number;
  name: string;
  startTime: Date;
  status: 'running' | 'stopped' | 'error';
  command: string;
  path: string;
}

export class PM2Service {
  private fallbackProcesses: Map<string, ProcessInfo> = new Map();
  private pm2Available: boolean | null = null;

  // Check if PM2 is available in the system
  async checkPM2Availability(): Promise<boolean> {
    if (this.pm2Available !== null) {
      return this.pm2Available;
    }

    try {
      // Try multiple paths for PM2
      const possiblePaths = [
        'pm2',
        '/usr/local/bin/pm2',
        '/usr/bin/pm2',
        process.env.HOME + '/.npm/bin/pm2',
        '/home/runner/.config/npm/node_global/bin/pm2'
      ];

      let pm2Found = false;
      for (const path of possiblePaths) {
        try {
          await execAsync(`${path} --version`);
          pm2Found = true;
          break;
        } catch {
          continue;
        }
      }

      if (pm2Found) {
        this.pm2Available = true;
        console.log('✅ PM2 is available');
        return true;
      } else {
        throw new Error('PM2 not found in any expected location');
      }
    } catch (error) {
      console.warn('PM2 is not available, using fallback process management');
      this.pm2Available = false;
      return false;
    }
  }

  // Fallback method to start application without PM2
  async startApplicationFallback(application: Application): Promise<void> {
    try {
      // Ensure the directory exists and is accessible
      const fs = await import('fs').then(m => m.promises);
      try {
        await fs.access(application.path);
      } catch {
        throw new Error(`Application path does not exist: ${application.path}`);
      }

      const child = spawn('sh', ['-c', application.command], {
        cwd: application.path,
        detached: true,
        stdio: 'pipe' // Change to pipe to capture errors
      });

      if (!child.pid) {
        throw new Error('Failed to spawn process');
      }

      child.unref();

      this.fallbackProcesses.set(application.name, {
        pid: child.pid,
        name: application.name,
        startTime: new Date(),
        status: 'running',
        command: application.command,
        path: application.path
      });

      // Check if process started successfully
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (child.killed || child.exitCode !== null) {
            reject(new Error('Process failed to start or exited immediately'));
          } else {
            resolve(void 0);
          }
        }, 2000);

        child.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });

        child.on('exit', (code) => {
          if (code !== null && code !== 0) {
            clearTimeout(timeout);
            reject(new Error(`Process exited with code ${code}`));
          }
        });
      });
    } catch (error) {
      throw new Error(`Failed to start application using fallback: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Fallback method to stop application without PM2
  async stopApplicationFallback(name: string): Promise<void> {
    const processInfo = this.fallbackProcesses.get(name);
    if (!processInfo) {
      throw new Error(`Application ${name} not found in fallback processes`);
    }

    try {
      process.kill(processInfo.pid, 'SIGTERM');
      processInfo.status = 'stopped';
      this.fallbackProcesses.set(name, processInfo);
    } catch (error) {
      throw new Error(`Failed to stop application using fallback: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async startApplication(application: Application): Promise<void> {
    const pm2Available = await this.checkPM2Availability();
    
    if (pm2Available) {
      try {
        const command = `cd ${application.path} && pm2 start "${application.command}" --name "${application.name}"`;
        await execAsync(command);
      } catch (error) {
        throw new Error(`Failed to start application with PM2: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      await this.startApplicationFallback(application);
    }
  }

  async stopApplication(name: string): Promise<void> {
    const pm2Available = await this.checkPM2Availability();
    
    if (pm2Available) {
      try {
        await execAsync(`pm2 stop ${name}`);
      } catch (error) {
        throw new Error(`Failed to stop application with PM2: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      await this.stopApplicationFallback(name);
    }
  }

  async restartApplication(name: string): Promise<void> {
    const pm2Available = await this.checkPM2Availability();
    
    if (pm2Available) {
      try {
        await execAsync(`pm2 restart ${name}`);
      } catch (error) {
        throw new Error(`Failed to restart application with PM2: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // For fallback, stop and start the application
      await this.stopApplicationFallback(name);
      // We need the application object to restart, so we'll throw an error for now
      throw new Error('Restart not available in fallback mode. Please stop and start the application manually.');
    }
  }

  async deleteApplication(name: string): Promise<void> {
    const pm2Available = await this.checkPM2Availability();
    
    if (pm2Available) {
      try {
        await execAsync(`pm2 delete ${name}`);
      } catch (error) {
        throw new Error(`Failed to delete application with PM2: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // For fallback, just stop the application and remove from tracking
      await this.stopApplicationFallback(name);
      this.fallbackProcesses.delete(name);
    }
  }

  async getApplicationStatus(name: string): Promise<string> {
    const pm2Available = await this.checkPM2Availability();
    
    if (pm2Available) {
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
    } else {
      // Use fallback process tracking
      const processInfo = this.fallbackProcesses.get(name);
      if (!processInfo) {
        return 'stopped';
      }
      
      // Check if process is still running
      try {
        process.kill(processInfo.pid, 0); // Signal 0 checks if process exists
        return processInfo.status;
      } catch (error) {
        // Process no longer exists
        processInfo.status = 'stopped';
        this.fallbackProcesses.set(name, processInfo);
        return 'stopped';
      }
    }
  }

  async listProcesses(): Promise<PM2Process[]> {
    const pm2Available = await this.checkPM2Availability();
    
    if (pm2Available) {
      try {
        const { stdout } = await execAsync('pm2 jlist');
        return JSON.parse(stdout);
      } catch (error) {
        throw new Error(`Failed to list PM2 processes: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // Return empty array for fallback mode
      return [];
    }
  }

  async getApplicationLogs(name: string, lines = 100): Promise<string[]> {
    const pm2Available = await this.checkPM2Availability();
    
    if (pm2Available) {
      try {
        const { stdout } = await execAsync(`pm2 logs ${name} --lines ${lines} --nostream`);
        return stdout.split('\n').filter(line => line.trim() !== '');
      } catch (error) {
        throw new Error(`Failed to get PM2 logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // For fallback mode, return basic info
      const processInfo = this.fallbackProcesses.get(name);
      if (!processInfo) {
        return ['Application not found in fallback mode'];
      }
      return [
        `Application: ${processInfo.name}`,
        `PID: ${processInfo.pid}`,
        `Status: ${processInfo.status}`,
        `Started: ${processInfo.startTime.toISOString()}`,
        `Command: ${processInfo.command}`,
        `Note: Detailed logs not available in fallback mode`
      ];
    }
  }

  async getApplicationMetrics(name: string): Promise<{ cpu: number; memory: number; uptime: number; restarts: number }> {
    const pm2Available = await this.checkPM2Availability();
    
    if (pm2Available) {
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
        throw new Error(`Failed to get PM2 metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // For fallback mode, return basic metrics
      const processInfo = this.fallbackProcesses.get(name);
      if (!processInfo) {
        throw new Error('Application not found in fallback mode');
      }
      
      const uptime = Date.now() - processInfo.startTime.getTime();
      return {
        cpu: 0, // Not available in fallback mode
        memory: 0, // Not available in fallback mode
        uptime: uptime,
        restarts: 0 // Not tracked in fallback mode
      };
    }
  }

  async saveConfiguration(): Promise<void> {
    const pm2Available = await this.checkPM2Availability();
    
    if (pm2Available) {
      try {
        await execAsync('pm2 save');
      } catch (error) {
        throw new Error(`Failed to save PM2 configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // In fallback mode, configuration is automatically persisted in memory
      console.log('Configuration save not needed in fallback mode');
    }
  }

  async resurrectProcesses(): Promise<void> {
    const pm2Available = await this.checkPM2Availability();
    
    if (pm2Available) {
      try {
        await execAsync('pm2 resurrect');
      } catch (error) {
        throw new Error(`Failed to resurrect PM2 processes: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // In fallback mode, no resurrection is needed as processes are managed in memory
      console.log('Process resurrection not available in fallback mode');
    }
  }
}

export const pm2Service = new PM2Service();
