import { exec } from 'child_process';
import { promises as fs } from 'fs';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export class NginxService {
  private readonly sitesAvailablePath = '/etc/nginx/sites-available';
  private readonly sitesEnabledPath = '/etc/nginx/sites-enabled';

  async testConfig(content?: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (content) {
        // Write content to temporary file and test
        const tempFile = `/tmp/nginx-test-${Date.now()}.conf`;
        await fs.writeFile(tempFile, content);
        
        try {
          // Try without sudo first, then with NOPASSWD sudo if available
          let testCommand = `nginx -t -c ${tempFile}`;
          try {
            await execAsync(testCommand);
          } catch (e) {
            testCommand = `sudo -n nginx -t -c ${tempFile}`;
            await execAsync(testCommand);
          }
          await fs.unlink(tempFile);
          return { success: true };
        } catch (error) {
          await fs.unlink(tempFile);
          return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unable to test nginx config (permission denied)' 
          };
        }
      } else {
        // Test current configuration
        try {
          await execAsync('nginx -t');
          return { success: true };
        } catch (e) {
          try {
            await execAsync('sudo -n nginx -t');
            return { success: true };
          } catch (error) {
            return { 
              success: false, 
              error: 'Unable to test nginx config (permission denied)' 
            };
          }
        }
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async reloadNginx(): Promise<void> {
    try {
      // Try without sudo first
      try {
        await execAsync('systemctl reload nginx');
        return;
      } catch (e) {
        // Try with non-interactive sudo
        await execAsync('sudo -n systemctl reload nginx');
        return;
      }
    } catch (error) {
      // If both fail, check if nginx service exists and is running
      try {
        const { stdout } = await execAsync('systemctl is-active nginx');
        if (stdout.trim() === 'active') {
          throw new Error('Nginx reload failed: Permission denied. Please configure passwordless sudo for nginx operations.');
        } else {
          throw new Error('Nginx service is not running or not installed.');
        }
      } catch (checkError) {
        throw new Error(`Failed to reload nginx: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  async writeConfig(configPath: string, content: string): Promise<void> {
    try {
      const fullPath = path.join(this.sitesAvailablePath, configPath);
      await execAsync(`echo '${content.replace(/'/g, "'\\''")}' | sudo tee ${fullPath} > /dev/null`);
    } catch (error) {
      throw new Error(`Failed to write nginx config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async enableSite(configName: string): Promise<void> {
    try {
      const sourcePath = path.join(this.sitesAvailablePath, configName);
      const targetPath = path.join(this.sitesEnabledPath, configName);
      
      await execAsync(`sudo ln -sf ${sourcePath} ${targetPath}`);
    } catch (error) {
      throw new Error(`Failed to enable site: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async disableSite(configName: string): Promise<void> {
    try {
      const targetPath = path.join(this.sitesEnabledPath, configName);
      await execAsync(`sudo rm -f ${targetPath}`);
    } catch (error) {
      throw new Error(`Failed to disable site: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  generateConfig(domain: string, port: number, sslEnabled = false): string {
    let config = `server {
    listen 80;
    server_name ${domain} www.${domain};
    
    location / {
        proxy_pass http://127.0.0.1:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}`;

    if (sslEnabled) {
      config += `

server {
    listen 443 ssl http2;
    server_name ${domain} www.${domain};
    
    ssl_certificate /etc/letsencrypt/live/${domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${domain}/privkey.pem;
    
    ssl_session_timeout 1d;
    ssl_session_cache shared:MozTLS:10m;
    ssl_session_tickets off;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    add_header Strict-Transport-Security "max-age=63072000" always;
    
    location / {
        proxy_pass http://127.0.0.1:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}`;
    }

    return config;
  }

  async getStatus(): Promise<{ active: boolean; enabled: boolean }> {
    try {
      let active = false;
      let enabled = false;
      
      try {
        const { stdout } = await execAsync('systemctl is-active nginx');
        active = stdout.trim() === 'active';
      } catch (e) {
        try {
          const { stdout } = await execAsync('sudo -n systemctl is-active nginx');
          active = stdout.trim() === 'active';
        } catch (err) {
          active = false;
        }
      }
      
      try {
        const { stdout } = await execAsync('systemctl is-enabled nginx');
        enabled = stdout.trim() === 'enabled';
      } catch (e) {
        try {
          const { stdout } = await execAsync('sudo -n systemctl is-enabled nginx');
          enabled = stdout.trim() === 'enabled';
        } catch (err) {
          enabled = false;
        }
      }
      
      return { active, enabled };
    } catch (error) {
      return { active: false, enabled: false };
    }
  }
}

export const nginxService = new NginxService();
