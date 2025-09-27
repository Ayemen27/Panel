import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface SslCertificate {
  domain: string;
  certPath: string;
  keyPath: string;
  expiresAt: Date;
}

export class SslService {
  async issueCertificate(domain: string): Promise<SslCertificate> {
    try {
      // Issue certificate using certbot
      let command = `sudo certbot certonly --nginx -d ${domain} -d www.${domain} --non-interactive --agree-tos --email admin@${domain}`;
      
      // For IP addresses, we need to use --preferred-challenges http
      if (/^\d+\.\d+\.\d+\.\d+$/.test(domain)) {
        command = `sudo certbot certonly --standalone --preferred-challenges http -d ${domain} --non-interactive --agree-tos --email admin@example.com`;
      }
      
      await execAsync(command);
      
      // Get certificate expiration date
      const { stdout } = await execAsync(`sudo openssl x509 -enddate -noout -in /etc/letsencrypt/live/${domain}/fullchain.pem`);
      const expiryMatch = stdout.match(/notAfter=(.+)/);
      const expiresAt = expiryMatch ? new Date(expiryMatch[1]) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
      
      return {
        domain,
        certPath: `/etc/letsencrypt/live/${domain}/fullchain.pem`,
        keyPath: `/etc/letsencrypt/live/${domain}/privkey.pem`,
        expiresAt
      };
    } catch (error) {
      throw new Error(`Failed to issue SSL certificate: ${error instanceof Error ? error.message : String(error) || 'Unknown error'}`);
    }
  }

  async renewCertificate(domain: string): Promise<void> {
    try {
      await execAsync(`sudo certbot renew --cert-name ${domain}`);
    } catch (error) {
      throw new Error(`Failed to renew SSL certificate: ${error instanceof Error ? error.message : String(error) || 'Unknown error'}`);
    }
  }

  async renewAllCertificates(): Promise<void> {
    try {
      await execAsync('sudo certbot renew');
    } catch (error) {
      throw new Error(`Failed to renew SSL certificates: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async checkCertificateExpiry(domain: string): Promise<Date | null> {
    try {
      const { stdout } = await execAsync(`sudo openssl x509 -enddate -noout -in /etc/letsencrypt/live/${domain}/fullchain.pem`);
      const expiryMatch = stdout.match(/notAfter=(.+)/);
      return expiryMatch ? new Date(expiryMatch[1]) : null;
    } catch (error) {
      return null;
    }
  }

  async listCertificates(): Promise<Array<{ domain: string; expiresAt: Date; status: string }>> {
    try {
      const { stdout } = await execAsync('sudo certbot certificates');
      const certificates: Array<{ domain: string; expiresAt: Date; status: string }> = [];
      
      // Parse certbot output (this is a simplified parser)
      const lines = stdout.split('\n');
      let currentDomain = '';
      
      for (const line of lines) {
        if (line.includes('Certificate Name:')) {
          currentDomain = line.split(':')[1].trim();
        } else if (line.includes('Expiry Date:') && currentDomain) {
          const expiryMatch = line.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
          if (expiryMatch) {
            const expiresAt = new Date(expiryMatch[1]);
            const now = new Date();
            const daysUntilExpiry = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            
            let status = 'valid';
            if (daysUntilExpiry < 0) {
              status = 'expired';
            } else if (daysUntilExpiry < 30) {
              status = 'expiring_soon';
            }
            
            certificates.push({
              domain: currentDomain,
              expiresAt,
              status
            });
          }
          currentDomain = '';
        }
      }
      
      return certificates;
    } catch (error) {
      throw new Error(`Failed to list certificates: ${error instanceof Error ? error.message : String(error) || 'Unknown error'}`);
    }
  }

  async revokeCertificate(domain: string): Promise<void> {
    try {
      await execAsync(`sudo certbot revoke --cert-path /etc/letsencrypt/live/${domain}/fullchain.pem`);
    } catch (error) {
      throw new Error(`Failed to revoke SSL certificate: ${error instanceof Error ? error.message : String(error) || 'Unknown error'}`);
    }
  }

  async testRenewal(): Promise<{ success: boolean; output: string }> {
    try {
      const { stdout } = await execAsync('sudo certbot renew --dry-run');
      return { success: true, output: stdout };
    } catch (error) {
      return { 
        success: false, 
        output: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

export const sslService = new SslService();
