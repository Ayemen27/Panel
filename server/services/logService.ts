import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  source: string;
}

export class LogService {
  async getApplicationLogs(appName: string, lines = 100): Promise<LogEntry[]> {
    try {
      // Try PM2 logs first
      const { stdout } = await execAsync(`pm2 logs ${appName} --lines ${lines} --nostream --raw`);
      
      return this.parsePM2Logs(stdout);
    } catch (error) {
      // Fallback to application log file if it exists
      try {
        const logPath = `/home/administrator/${appName}/logs/app.log`;
        const content = await fs.readFile(logPath, 'utf8');
        return this.parseGenericLogs(content, lines);
      } catch (fileError) {
        return [];
      }
    }
  }

  async getNginxLogs(type: 'access' | 'error' = 'error', lines = 100): Promise<LogEntry[]> {
    try {
      const logPath = type === 'access' ? '/var/log/nginx/access.log' : '/var/log/nginx/error.log';
      const { stdout } = await execAsync(`sudo tail -n ${lines} ${logPath}`);
      
      return this.parseNginxLogs(stdout, type);
    } catch (error) {
      console.warn(`Failed to get nginx logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Return empty array instead of throwing error
      return [];
    }
  }

  async getSystemLogs(service?: string, lines = 100): Promise<LogEntry[]> {
    try {
      let command = `journalctl --no-pager -n ${lines}`;
      if (service) {
        command += ` -u ${service}`;
      }
      
      const { stdout } = await execAsync(command);
      return this.parseJournalLogs(stdout);
    } catch (error) {
      console.warn(`Failed to get system logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Return empty array instead of throwing error
      return [];
    }
  }

  async searchLogs(query: string, source?: string, level?: string): Promise<LogEntry[]> {
    try {
      let grepCommand = `grep -i "${query}"`;
      
      if (source === 'nginx') {
        grepCommand = `sudo ${grepCommand} /var/log/nginx/*.log`;
      } else if (source === 'system') {
        grepCommand = `journalctl --no-pager | ${grepCommand}`;
      } else {
        // Search PM2 logs
        grepCommand = `pm2 logs --raw | ${grepCommand}`;
      }
      
      const { stdout } = await execAsync(grepCommand);
      return this.parseGenericLogs(stdout);
    } catch (error) {
      return []; // Return empty array if no matches found
    }
  }

  async tailLogs(source: string, appName?: string): Promise<AsyncIterable<LogEntry>> {
    const controller = new AbortController();
    
    return {
      [Symbol.asyncIterator]: async function* () {
        let command = '';
        
        if (source === 'nginx') {
          command = 'sudo tail -f /var/log/nginx/error.log';
        } else if (source === 'system') {
          command = 'journalctl -f --no-pager';
        } else if (source === 'pm2' && appName) {
          command = `pm2 logs ${appName} --raw --lines 0`;
        }
        
        if (!command) return;
        
        try {
          const process = exec(command, { signal: controller.signal });
          
          if (process.stdout) {
            for await (const chunk of process.stdout) {
              const lines = chunk.toString().split('\n');
              for (const line of lines) {
                if (line.trim()) {
                  yield {
                    timestamp: new Date().toISOString(),
                    level: 'info',
                    message: line.trim(),
                    source
                  };
                }
              }
            }
          }
        } catch (error) {
          // Handle process termination
        }
      }
    };
  }

  private parsePM2Logs(content: string): LogEntry[] {
    const lines = content.split('\n').filter(line => line.trim());
    
    return lines.map(line => {
      // PM2 log format: timestamp|level|app|message
      const match = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\s*\|\s*(\w+)\s*\|\s*(\w+)\s*\|\s*(.+)$/);
      
      if (match) {
        return {
          timestamp: match[1],
          level: match[2].toLowerCase(),
          message: match[4],
          source: 'pm2'
        };
      }
      
      return {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: line,
        source: 'pm2'
      };
    });
  }

  private parseNginxLogs(content: string, type: 'access' | 'error'): LogEntry[] {
    const lines = content.split('\n').filter(line => line.trim());
    
    return lines.map(line => {
      if (type === 'error') {
        // Nginx error log format: timestamp [level] message
        const match = line.match(/^(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}) \[(\w+)\] (.+)$/);
        
        if (match) {
          return {
            timestamp: new Date(match[1]).toISOString(),
            level: match[2],
            message: match[3],
            source: 'nginx'
          };
        }
      } else {
        // Nginx access log - treat as info level
        return {
          timestamp: new Date().toISOString(),
          level: 'info',
          message: line,
          source: 'nginx'
        };
      }
      
      return {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: line,
        source: 'nginx'
      };
    });
  }

  private parseJournalLogs(content: string): LogEntry[] {
    const lines = content.split('\n').filter(line => line.trim());
    
    return lines.map(line => {
      // Journal log format: timestamp hostname service[pid]: message
      const match = line.match(/^(\w{3} \d{2} \d{2}:\d{2}:\d{2}) (\w+) (.+?)\[(\d+)\]: (.+)$/);
      
      if (match) {
        const currentYear = new Date().getFullYear();
        const timestamp = new Date(`${currentYear} ${match[1]}`).toISOString();
        
        return {
          timestamp,
          level: 'info',
          message: match[5],
          source: 'system'
        };
      }
      
      return {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: line,
        source: 'system'
      };
    });
  }

  private parseGenericLogs(content: string, lines?: number): LogEntry[] {
    const logLines = content.split('\n').filter(line => line.trim());
    
    if (lines) {
      logLines.splice(0, Math.max(0, logLines.length - lines));
    }
    
    return logLines.map(line => ({
      timestamp: new Date().toISOString(),
      level: this.detectLogLevel(line),
      message: line,
      source: 'generic'
    }));
  }

  private detectLogLevel(message: string): string {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('error') || lowerMessage.includes('err')) {
      return 'error';
    } else if (lowerMessage.includes('warn') || lowerMessage.includes('warning')) {
      return 'warn';
    } else if (lowerMessage.includes('debug')) {
      return 'debug';
    } else {
      return 'info';
    }
  }
}

export const logService = new LogService();
