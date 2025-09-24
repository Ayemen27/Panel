import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const execAsync = promisify(exec);

// Security utility functions for input validation and shell escaping
class SecurityUtils {
  /**
   * Validates application name to prevent command injection
   * Only allows alphanumeric characters, hyphens, and underscores
   */
  static validateAppName(appName: string): string {
    if (!appName || typeof appName !== 'string') {
      throw new Error('Application name must be a non-empty string');
    }
    
    // Only allow safe characters: letters, numbers, hyphens, underscores
    if (!/^[a-zA-Z0-9_-]+$/.test(appName)) {
      throw new Error('Application name contains invalid characters');
    }
    
    if (appName.length > 50) {
      throw new Error('Application name too long');
    }
    
    return appName;
  }

  /**
   * Validates and sanitizes line count parameter
   */
  static validateLines(lines: number): number {
    const numLines = parseInt(String(lines), 10);
    if (isNaN(numLines) || numLines < 1 || numLines > 10000) {
      throw new Error('Lines parameter must be a number between 1 and 10000');
    }
    return numLines;
  }

  /**
   * Validates service name for systemd services
   */
  static validateServiceName(service: string): string {
    if (!service || typeof service !== 'string') {
      throw new Error('Service name must be a non-empty string');
    }
    
    // Allow letters, numbers, hyphens, dots, and @ symbols (systemd naming)
    if (!/^[a-zA-Z0-9_.-]+(@[a-zA-Z0-9_.-]+)?$/.test(service)) {
      throw new Error('Service name contains invalid characters');
    }
    
    if (service.length > 100) {
      throw new Error('Service name too long');
    }
    
    return service;
  }

  /**
   * Validates and sanitizes search query to prevent command injection
   */
  static validateSearchQuery(query: string): string {
    if (!query || typeof query !== 'string') {
      throw new Error('Search query must be a non-empty string');
    }
    
    if (query.length > 500) {
      throw new Error('Search query too long');
    }
    
    // Remove dangerous characters that could be used for command injection
    // Allow letters, numbers, spaces, basic punctuation, but not shell metacharacters
    const sanitized = query.replace(/[`$()\\|&;<>"']/g, '');
    
    if (sanitized !== query) {
      console.warn('Search query contained potentially dangerous characters and was sanitized');
    }
    
    return sanitized;
  }

  /**
   * Validates log source parameter
   */
  static validateLogSource(source: string): string {
    const validSources = ['nginx', 'system', 'pm2'];
    if (!validSources.includes(source)) {
      throw new Error(`Invalid log source. Must be one of: ${validSources.join(', ')}`);
    }
    return source;
  }

  /**
   * Escapes shell arguments to prevent injection
   */
  static escapeShellArg(arg: string): string {
    // Use single quotes and escape any single quotes in the argument
    return `'${arg.replace(/'/g, "'\\''")}'`;
  }

  /**
   * Validates file path to prevent directory traversal
   */
  static validateLogPath(logPath: string): string {
    const normalizedPath = path.normalize(logPath);
    
    // Prevent directory traversal
    if (normalizedPath.includes('..')) {
      throw new Error('Invalid log path: directory traversal detected');
    }
    
    // Only allow specific log directories
    const allowedPaths = [
      '/var/log/nginx/',
      '/home/administrator/',
      '/var/log/',
    ];
    
    const isAllowed = allowedPaths.some(allowedPath => 
      normalizedPath.startsWith(allowedPath)
    );
    
    if (!isAllowed) {
      throw new Error('Access to this log path is not allowed');
    }
    
    return normalizedPath;
  }
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  source: string;
}

export class LogService {
  async getApplicationLogs(appName: string, lines = 100): Promise<LogEntry[]> {
    try {
      // Validate inputs to prevent command injection
      const validatedAppName = SecurityUtils.validateAppName(appName);
      const validatedLines = SecurityUtils.validateLines(lines);
      
      // Try PM2 logs first - use escaped parameters
      const escapedAppName = SecurityUtils.escapeShellArg(validatedAppName);
      const { stdout } = await execAsync(`pm2 logs ${escapedAppName} --lines ${validatedLines} --nostream --raw`);
      
      return this.parsePM2Logs(stdout);
    } catch (error) {
      // Fallback to application log file if it exists
      try {
        const validatedAppName = SecurityUtils.validateAppName(appName);
        const logPath = `/home/administrator/${validatedAppName}/logs/app.log`;
        const validatedLogPath = SecurityUtils.validateLogPath(logPath);
        const content = await fs.readFile(validatedLogPath, 'utf8');
        return this.parseGenericLogs(content, lines);
      } catch (fileError) {
        return [];
      }
    }
  }

  async getNginxLogs(type: 'access' | 'error' = 'error', lines = 100): Promise<LogEntry[]> {
    try {
      // Validate inputs
      const validatedLines = SecurityUtils.validateLines(lines);
      const logPath = type === 'access' ? '/var/log/nginx/access.log' : '/var/log/nginx/error.log';
      const validatedLogPath = SecurityUtils.validateLogPath(logPath);
      
      // Use escaped parameters for shell command
      const escapedLogPath = SecurityUtils.escapeShellArg(validatedLogPath);
      const { stdout } = await execAsync(`sudo tail -n ${validatedLines} ${escapedLogPath}`);
      
      return this.parseNginxLogs(stdout, type);
    } catch (error) {
      console.warn(`Failed to get nginx logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Return empty array instead of throwing error
      return [];
    }
  }

  async getSystemLogs(service?: string, lines = 100): Promise<LogEntry[]> {
    try {
      // Validate inputs
      const validatedLines = SecurityUtils.validateLines(lines);
      let command = `journalctl --no-pager -n ${validatedLines}`;
      
      if (service) {
        const validatedService = SecurityUtils.validateServiceName(service);
        const escapedService = SecurityUtils.escapeShellArg(validatedService);
        command += ` -u ${escapedService}`;
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
      // Validate and sanitize inputs - CRITICAL for preventing command injection
      const validatedQuery = SecurityUtils.validateSearchQuery(query);
      const escapedQuery = SecurityUtils.escapeShellArg(validatedQuery);
      
      let grepCommand = `grep -i ${escapedQuery}`;
      
      if (source === 'nginx') {
        SecurityUtils.validateLogSource(source);
        grepCommand = `sudo ${grepCommand} /var/log/nginx/*.log`;
      } else if (source === 'system') {
        SecurityUtils.validateLogSource(source);
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
        
        try {
          // Validate source parameter
          const validatedSource = SecurityUtils.validateLogSource(source);
          
          if (validatedSource === 'nginx') {
            command = 'sudo tail -f /var/log/nginx/error.log';
          } else if (validatedSource === 'system') {
            command = 'journalctl -f --no-pager';
          } else if (validatedSource === 'pm2' && appName) {
            // Validate and escape appName to prevent injection
            const validatedAppName = SecurityUtils.validateAppName(appName);
            const escapedAppName = SecurityUtils.escapeShellArg(validatedAppName);
            command = `pm2 logs ${escapedAppName} --raw --lines 0`;
          }
          
          if (!command) {
            console.warn('Invalid log source or missing app name for PM2 logs');
            return;
          }
        
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
                      source: validatedSource
                    };
                  }
                }
              }
            }
          } catch (error) {
            // Handle process termination
          }
        } catch (error) {
          console.warn('Failed to setup log tailing:', error);
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
