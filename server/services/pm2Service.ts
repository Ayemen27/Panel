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
        '/home/runner/.config/npm/node_global/bin/pm2',
        'npx pm2'
      ];

      let pm2Found = false;
      let workingPath = '';
      
      for (const path of possiblePaths) {
        try {
          const { stdout } = await execAsync(`${path} --version`);
          if (stdout && stdout.trim()) {
            pm2Found = true;
            workingPath = path;
            console.log(`✅ PM2 found at: ${path}, version: ${stdout.trim()}`);
            break;
          }
        } catch (error) {
          continue;
        }
      }

      if (pm2Found) {
        this.pm2Available = true;
        console.log('✅ PM2 is available and working');
        
        // Try to save and resurrect any existing processes
        try {
          await execAsync(`${workingPath} resurrect`);
          console.log('✅ PM2 processes resurrected');
        } catch (error) {
          console.log('ℹ️ No PM2 processes to resurrect');
        }
        
        return true;
      } else {
        throw new Error('PM2 not found in any expected location');
      }
    } catch (error) {
      console.warn('⚠️ PM2 is not available, using fallback process management');
      console.warn('💡 Consider installing PM2: npm install -g pm2');
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
        // Extract the main file from command if it's a node command
        let startCommand = application.command;
        let mainFile = '';
        
        // Check if command is empty or only contains flags
        if (!startCommand || startCommand.trim() === '') {
          // Try common entry points
          const commonFiles = ['index.js', 'server.js', 'app.js', 'main.js'];
          const fs = await import('fs').then(m => m.promises);
          
          for (const file of commonFiles) {
            try {
              await fs.access(`${application.path}/${file}`);
              mainFile = file;
              break;
            } catch {
              continue;
            }
          }
          
          if (!mainFile) {
            throw new Error('No main file found. Please specify a valid command.');
          }
          startCommand = `node ${mainFile}`;
        }
        
        // If command starts with npm/yarn, use it directly with ecosystem file
        if (startCommand.startsWith('npm ') || startCommand.startsWith('yarn ')) {
          const command = `cd ${application.path} && pm2 start --name "${application.name}" -- ${startCommand}`;
          await execAsync(command);
        } else {
          // For node commands, extract the file name
          const nodeMatch = startCommand.match(/^node\s+(.+)$/);
          if (nodeMatch) {
            mainFile = nodeMatch[1].trim();
          } else {
            // If not a node command, assume it's the file directly
            mainFile = startCommand.split(' ')[0];
          }
          
          const command = `cd ${application.path} && pm2 start "${mainFile}" --name "${application.name}"`;
          await execAsync(command);
        }
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

  async restartApplication(name: string, application?: Application): Promise<void> {
    const pm2Available = await this.checkPM2Availability();
    
    if (pm2Available) {
      try {
        // First try to restart existing process
        await execAsync(`pm2 restart ${name}`);
      } catch (error) {
        // If restart fails, try to delete and start fresh if application data is provided
        if (application) {
          try {
            await execAsync(`pm2 delete ${name}`).catch(() => {}); // Ignore delete errors
            await this.startApplication(application);
          } catch (startError) {
            throw new Error(`Failed to restart application with PM2: ${startError instanceof Error ? startError.message : 'Unknown error'}`);
          }
        } else {
          throw new Error(`Failed to restart application with PM2: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    } else {
      // For fallback, stop and start the application
      if (application) {
        await this.stopApplicationFallback(name);
        await this.startApplicationFallback(application);
      } else {
        throw new Error('Restart not available in fallback mode without application data. Please stop and start the application manually.');
      }
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

  // Cache PM2 processes for 10 seconds to avoid multiple calls
  private pm2ProcessCache: { data: PM2Process[], timestamp: number } | null = null;
  private readonly CACHE_DURATION = 10000; // 10 seconds

  async getAllApplicationStatuses(): Promise<Map<string, string>> {
    const pm2Available = await this.checkPM2Availability();
    const statusMap = new Map<string, string>();
    
    if (pm2Available) {
      try {
        const processes = await this.getCachedPM2Processes();
        processes.forEach(process => {
          if (process && process.name && process.pm2_env) {
            statusMap.set(process.name, this.translatePM2Status(process.pm2_env.status));
          }
        });
      } catch (error) {
        console.warn('Failed to get PM2 processes, using fallback:', error);
        // Fall back to checking individual processes
        this.fallbackProcesses.forEach((processInfo, name) => {
          statusMap.set(name, processInfo.status);
        });
      }
    } else {
      // Use fallback processes
      this.fallbackProcesses.forEach((processInfo, name) => {
        statusMap.set(name, processInfo.status);
      });
    }
    
    return statusMap;
  }

  private async getCachedPM2Processes(): Promise<PM2Process[]> {
    const now = Date.now();
    
    if (this.pm2ProcessCache && (now - this.pm2ProcessCache.timestamp) < this.CACHE_DURATION) {
      return this.pm2ProcessCache.data;
    }
    
    try {
      const { stdout } = await execAsync(`pm2 jlist`);
      
      // Clean and validate JSON output - handle PM2 update messages
      let cleanOutput = stdout.trim();
      
      // Remove PM2 update messages and ASCII art
      const lines = cleanOutput.split('\n');
      const jsonLines: string[] = [];
      let inJsonSection = false;
      
      for (const line of lines) {
        // Skip PM2 update messages and status lines
        if (line.includes('In-memory PM2 is out-of-date') ||
            line.includes('$ pm2 update') ||
            line.includes('PM2 version:') ||
            line.includes('Local PM2 version:') ||
            line.includes('>>>>') ||
            line.match(/^[\s\-_\/\\|]+$/)) {
          continue;
        }
        
        // Look for JSON start
        if (line.trim().startsWith('[')) {
          inJsonSection = true;
        }
        
        if (inJsonSection) {
          jsonLines.push(line);
        }
      }
      
      // If we found JSON lines, join them back
      if (jsonLines.length > 0) {
        cleanOutput = jsonLines.join('\n').trim();
      }
      
      // Fallback: Extract JSON using brackets if the above didn't work
      if (!cleanOutput.startsWith('[')) {
        const jsonStart = cleanOutput.indexOf('[');
        const jsonEnd = cleanOutput.lastIndexOf(']');
        
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          cleanOutput = cleanOutput.substring(jsonStart, jsonEnd + 1);
        }
      }
      
      // Try to parse JSON with better error handling
      let processes: PM2Process[] = [];
      
      try {
        if (cleanOutput.trim()) {
          processes = JSON.parse(cleanOutput);
          
          // Validate that it's an array
          if (!Array.isArray(processes)) {
            console.warn('PM2 jlist did not return an array, falling back to empty array');
            processes = [];
          }
        }
      } catch (parseError) {
        console.error('Failed to parse PM2 JSON output:', parseError);
        console.error('Raw output:', stdout);
        console.error('Cleaned output:', cleanOutput);
        
        // Try alternative command with force update
        try {
          // Try updating PM2 first if needed
          if (stdout.includes('In-memory PM2 is out-of-date')) {
            console.log('Attempting PM2 update...');
            try {
              await execAsync('pm2 update');
              console.log('PM2 updated successfully');
            } catch (updateError) {
              console.warn('PM2 update failed, continuing with current version');
            }
          }
          
          const { stdout: altOutput } = await execAsync(`pm2 list --format json`);
          let altCleanOutput = altOutput.trim();
          
          // Clean alternative output too
          const altJsonStart = altCleanOutput.indexOf('[');
          const altJsonEnd = altCleanOutput.lastIndexOf(']');
          
          if (altJsonStart !== -1 && altJsonEnd !== -1 && altJsonEnd > altJsonStart) {
            altCleanOutput = altCleanOutput.substring(altJsonStart, altJsonEnd + 1);
          }
          
          processes = JSON.parse(altCleanOutput);
        } catch (altError) {
          console.error('Alternative PM2 command also failed:', altError);
          processes = [];
        }
      }
      
      this.pm2ProcessCache = {
        data: processes,
        timestamp: now
      };
      
      return processes;
    } catch (error) {
      console.error('Error getting PM2 processes:', error);
      return [];
    }
  }

  private translatePM2Status(pm2Status: string): string {
    switch (pm2Status) {
      case 'online': return 'running';
      case 'stopped': return 'stopped';
      case 'errored': case 'error': return 'error';
      case 'stopping': return 'stopping';
      case 'launching': return 'starting';
      default: return 'unknown';
    }
  }

  async getApplicationStatus(name: string): Promise<string> {
    const pm2Available = await this.checkPM2Availability();
    
    if (pm2Available) {
      try {
        const processes = await this.getCachedPM2Processes();
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
        return await this.getCachedPM2Processes();
      } catch (error) {
        console.error('Failed to list PM2 processes:', error);
        return [];
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
