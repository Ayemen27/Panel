import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';

const execAsync = promisify(exec);

export interface SystemStats {
  cpu: {
    usage: number;
    cores: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  uptime: number;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
  status: string;
}

export class SystemService {
  async getSystemStats(): Promise<SystemStats> {
    try {
      // Get CPU usage
      const { stdout: cpuInfo } = await execAsync("grep 'cpu ' /proc/stat | awk '{usage=($2+$4)*100/($2+$3+$4+$5)} END {print usage}'");
      const cpuUsage = parseFloat(cpuInfo.trim());
      
      // Get CPU cores
      const { stdout: coreInfo } = await execAsync("nproc");
      const cpuCores = parseInt(coreInfo.trim());
      
      // Get memory info
      const memInfo = await fs.readFile('/proc/meminfo', 'utf8');
      const memLines = memInfo.split('\n');
      const memTotal = parseInt(memLines.find(line => line.startsWith('MemTotal:'))?.split(/\s+/)[1] || '0') * 1024;
      const memFree = parseInt(memLines.find(line => line.startsWith('MemFree:'))?.split(/\s+/)[1] || '0') * 1024;
      const memAvailable = parseInt(memLines.find(line => line.startsWith('MemAvailable:'))?.split(/\s+/)[1] || '0') * 1024;
      const memUsed = memTotal - memAvailable;
      const memUsage = (memUsed / memTotal) * 100;
      
      // Get disk usage
      const { stdout: diskInfo } = await execAsync("df -B1 / | tail -1 | awk '{print $2,$3,$4}'");
      const [diskTotal, diskUsed, diskFree] = diskInfo.trim().split(' ').map(Number);
      const diskUsage = (diskUsed / diskTotal) * 100;
      
      // Get uptime
      const { stdout: uptimeInfo } = await execAsync("cat /proc/uptime | awk '{print $1}'");
      const uptime = parseFloat(uptimeInfo.trim());
      
      return {
        cpu: {
          usage: Math.round(cpuUsage * 100) / 100,
          cores: cpuCores
        },
        memory: {
          total: memTotal,
          used: memUsed,
          free: memFree,
          usage: Math.round(memUsage * 100) / 100
        },
        disk: {
          total: diskTotal,
          used: diskUsed,
          free: diskFree,
          usage: Math.round(diskUsage * 100) / 100
        },
        uptime
      };
    } catch (error) {
      throw new Error(`Failed to get system stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getSystemInfo(): Promise<{
    hostname: string;
    platform: string;
    arch: string;
    kernel: string;
    uptime: number;
    loadAverage: number[];
  }> {
    try {
      const { stdout: hostname } = await execAsync('hostname');
      const { stdout: platform } = await execAsync('uname -s');
      const { stdout: arch } = await execAsync('uname -m');
      const { stdout: kernel } = await execAsync('uname -r');
      const { stdout: uptimeInfo } = await execAsync("cat /proc/uptime | awk '{print $1}'");
      const { stdout: loadInfo } = await execAsync("cat /proc/loadavg | awk '{print $1,$2,$3}'");
      
      const uptime = parseFloat(uptimeInfo.trim());
      const loadAverage = loadInfo.trim().split(' ').map(Number);
      
      return {
        hostname: hostname.trim(),
        platform: platform.trim(),
        arch: arch.trim(),
        kernel: kernel.trim(),
        uptime,
        loadAverage
      };
    } catch (error) {
      throw new Error(`Failed to get system info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Health check interface for beginners
  async performHealthCheck(): Promise<{
    database: { status: string; message: string; details?: any };
    system: { status: string; message: string; details?: any };
    services: { status: string; message: string; details?: any };
    overall: { status: string; score: number; message: string };
  }> {
    const results = {
      database: { status: 'unknown', message: 'جاري فحص قاعدة البيانات...' },
      system: { status: 'unknown', message: 'جاري فحص النظام...' },
      services: { status: 'unknown', message: 'جاري فحص الخدمات...' },
      overall: { status: 'unknown', score: 0, message: 'جاري تقييم الحالة العامة...' }
    } as {
      database: { status: string; message: string; details?: any };
      system: { status: string; message: string; details?: any };
      services: { status: string; message: string; details?: any };
      overall: { status: string; score: number; message: string };
    };
    
    let healthScore = 0;
    const maxScore = 3;

    try {
      // Check database
      try {
        const { storage } = await import('../storage');
        await storage.testConnection();
        results.database = { 
          status: 'healthy', 
          message: '✅ قاعدة البيانات تعمل بشكل طبيعي',
          details: { connected: true, type: 'PostgreSQL' }
        };
        healthScore++;
      } catch (error) {
        results.database = { 
          status: 'error', 
          message: '❌ مشكلة في الاتصال بقاعدة البيانات',
          details: { error: error instanceof Error ? error.message : 'خطأ غير معروف' }
        };
      }

      // Check system resources
      try {
        const systemStats = await this.getSystemStats();
        const criticalIssues = [];
        
        if (systemStats.cpu.usage > 90) criticalIssues.push('استخدام المعالج مرتفع جداً');
        if (systemStats.memory.usage > 90) criticalIssues.push('استخدام الذاكرة مرتفع جداً');
        if (systemStats.disk.usage > 95) criticalIssues.push('مساحة القرص ممتلئة تقريباً');
        
        if (criticalIssues.length === 0) {
          results.system = { 
            status: 'healthy', 
            message: '✅ موارد النظام في حالة جيدة',
            details: systemStats 
          };
          healthScore++;
        } else {
          results.system = { 
            status: 'warning', 
            message: `⚠️ تحذير: ${criticalIssues.join(', ')}`,
            details: systemStats 
          };
          healthScore += 0.5;
        }
      } catch (error) {
        results.system = { 
          status: 'error', 
          message: '❌ فشل في فحص موارد النظام',
          details: { error: error instanceof Error ? error.message : 'خطأ غير معروف' }
        };
      }

      // Check core services
      try {
        const dependencies = await this.checkDependencies();
        const criticalDeps = dependencies.filter(dep => dep.category === 'critical' && !dep.installed);
        
        if (criticalDeps.length === 0) {
          results.services = { 
            status: 'healthy', 
            message: '✅ جميع الخدمات الأساسية متوفرة',
            details: { installed: dependencies.filter(d => d.installed).length, total: dependencies.length }
          };
          healthScore++;
        } else {
          results.services = { 
            status: 'warning', 
            message: `⚠️ بعض الخدمات مفقودة: ${criticalDeps.map(d => d.name).join(', ')}`,
            details: { missing: criticalDeps.length, installed: dependencies.filter(d => d.installed).length }
          };
        }
      } catch (error) {
        results.services = { 
          status: 'error', 
          message: '❌ فشل في فحص الخدمات',
          details: { error: error instanceof Error ? error.message : 'خطأ غير معروف' }
        };
      }

      // Calculate overall health
      const scorePercentage = (healthScore / maxScore) * 100;
      if (scorePercentage >= 80) {
        results.overall = { 
          status: 'healthy', 
          score: Math.round(scorePercentage),
          message: `🎉 النظام يعمل بشكل ممتاز! (${Math.round(scorePercentage)}%)`
        };
      } else if (scorePercentage >= 60) {
        results.overall = { 
          status: 'warning', 
          score: Math.round(scorePercentage),
          message: `⚠️ النظام يعمل مع بعض التحذيرات (${Math.round(scorePercentage)}%)`
        };
      } else {
        results.overall = { 
          status: 'critical', 
          score: Math.round(scorePercentage),
          message: `🔴 النظام يحتاج للإصلاح (${Math.round(scorePercentage)}%)`
        };
      }

    } catch (error) {
      results.overall = { 
        status: 'error', 
        score: 0,
        message: `❌ خطأ في فحص النظام: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`
      };
    }

    return results;
  }

  // Check dependencies and tools for beginners
  async checkDependencies(): Promise<Array<{
    name: string;
    displayName: string;
    description: string;
    category: 'critical' | 'recommended' | 'optional';
    installed: boolean;
    version?: string;
    installCommand?: string;
    checkCommand: string;
    icon: string;
    purpose: string;
    installable: boolean;
  }>> {
    const dependencies = [
      {
        name: 'node',
        displayName: 'Node.js',
        description: 'بيئة تشغيل JavaScript لتطبيقات الخادم',
        category: 'critical' as const,
        checkCommand: 'node --version',
        installCommand: 'curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs',
        icon: '⚡',
        purpose: 'تشغيل التطبيقات والخدمات المبنية بـ JavaScript',
        installable: true
      },
      {
        name: 'npm',
        displayName: 'NPM',
        description: 'مدير الحزم الخاص بـ Node.js',
        category: 'critical' as const,
        checkCommand: 'npm --version',
        installCommand: 'curl -L https://www.npmjs.com/install.sh | sudo sh',
        icon: '📦',
        purpose: 'تثبيت وإدارة مكتبات JavaScript والتبعيات',
        installable: true
      },
      {
        name: 'pm2',
        displayName: 'PM2',
        description: 'مدير العمليات لتطبيقات Node.js',
        category: 'critical' as const,
        checkCommand: 'pm2 --version',
        installCommand: 'npm install -g pm2',
        icon: '⚙️',
        purpose: 'مراقبة وإدارة تطبيقات Node.js في الخلفية',
        installable: true
      },
      {
        name: 'nginx',
        displayName: 'Nginx',
        description: 'خادم ويب وموزع للأحمال',
        category: 'recommended' as const,
        checkCommand: 'nginx -v',
        installCommand: 'sudo apt update && sudo apt install -y nginx',
        icon: '🌐',
        purpose: 'توزيع المحتوى وإدارة SSL وتوجيه الطلبات',
        installable: true
      },
      {
        name: 'certbot',
        displayName: 'Certbot',
        description: 'أداة الحصول على شهادات SSL من Let\'s Encrypt',
        category: 'recommended' as const,
        checkCommand: 'certbot --version',
        installCommand: 'sudo apt update && sudo apt install -y certbot python3-certbot-nginx',
        icon: '🔒',
        purpose: 'الحصول على شهادات SSL مجانية لتأمين المواقع',
        installable: true
      },
      {
        name: 'git',
        displayName: 'Git',
        description: 'نظام التحكم في الإصدارات',
        category: 'recommended' as const,
        checkCommand: 'git --version',
        installCommand: 'sudo apt update && sudo apt install -y git',
        icon: '📝',
        purpose: 'إدارة التحكم في إصدارات الكود والنشر',
        installable: true
      },
      {
        name: 'curl',
        displayName: 'cURL',
        description: 'أداة نقل البيانات من وإلى الخوادم',
        category: 'optional' as const,
        checkCommand: 'curl --version',
        installCommand: 'sudo apt update && sudo apt install -y curl',
        icon: '🔄',
        purpose: 'تنزيل الملفات واختبار الـ APIs',
        installable: true
      },
      {
        name: 'ufw',
        displayName: 'UFW Firewall',
        description: 'جدار حماية بسيط لنظام Linux',
        category: 'recommended' as const,
        checkCommand: 'ufw --version',
        installCommand: 'sudo apt update && sudo apt install -y ufw',
        icon: '🛡️',
        purpose: 'حماية الخادم من الوصول غير المرخص',
        installable: true
      },
      {
        name: 'htop',
        displayName: 'htop',
        description: 'مراقب العمليات التفاعلي',
        category: 'optional' as const,
        checkCommand: 'htop --version',
        installCommand: 'sudo apt update && sudo apt install -y htop',
        icon: '📊',
        purpose: 'مراقبة استخدام موارد النظام بصورة تفاعلية',
        installable: true
      }
    ];

    // Check each dependency
    const results = await Promise.all(
      dependencies.map(async (dep) => {
        try {
          const { stdout } = await execAsync(dep.checkCommand);
          const version = stdout.trim().split('\n')[0];
          return {
            ...dep,
            installed: true,
            version
          };
        } catch (error) {
          return {
            ...dep,
            installed: false
          };
        }
      })
    );

    return results;
  }

  // Install dependency for beginners
  async installDependency(dependencyName: string): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    try {
      const dependencies = await this.checkDependencies();
      const dep = dependencies.find(d => d.name === dependencyName);
      
      if (!dep) {
        return {
          success: false,
          message: 'الأداة المطلوبة غير موجودة في قائمة الأدوات المدعومة'
        };
      }

      if (dep.installed) {
        return {
          success: true,
          message: `${dep.displayName} مثبت بالفعل (${dep.version})`
        };
      }

      if (!dep.installable || !dep.installCommand) {
        return {
          success: false,
          message: `لا يمكن تثبيت ${dep.displayName} تلقائياً. يرجى التثبيت يدوياً.`
        };
      }

      console.log(`🔧 جاري تثبيت ${dep.displayName}...`);
      console.log(`📝 الأمر: ${dep.installCommand}`);
      
      const { stdout, stderr } = await execAsync(dep.installCommand);
      
      // Verify installation
      try {
        await execAsync(dep.checkCommand);
        return {
          success: true,
          message: `✅ تم تثبيت ${dep.displayName} بنجاح!`,
          details: { stdout, stderr }
        };
      } catch (verifyError) {
        return {
          success: false,
          message: `❌ فشل التحقق من تثبيت ${dep.displayName}`,
          details: { stdout, stderr, verifyError }
        };
      }

    } catch (error) {
      console.error(`خطأ في تثبيت ${dependencyName}:`, error);
      return {
        success: false,
        message: `❌ فشل في تثبيت ${dependencyName}: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`,
        details: { error: error instanceof Error ? error.message : error }
      };
    }
  }

  async getProcesses(): Promise<ProcessInfo[]> {
    try {
      const { stdout } = await execAsync("ps aux --no-headers | awk '{print $2,$11,$3,$4,$8}' | head -20");
      const lines = stdout.trim().split('\n');
      
      return lines.map(line => {
        const [pid, name, cpu, memory, status] = line.trim().split(/\s+/);
        return {
          pid: parseInt(pid),
          name,
          cpu: parseFloat(cpu),
          memory: parseFloat(memory),
          status
        };
      });
    } catch (error) {
      throw new Error(`Failed to get processes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async checkDns(domain: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`dig +short A ${domain}`);
      const ips = stdout.trim().split('\n').filter(ip => ip.match(/^\d+\.\d+\.\d+\.\d+$/));
      
      if (ips.length === 0) {
        return 'nxdomain';
      }
      
      // Check if any of the IPs match the server's public IP
      const { stdout: publicIp } = await execAsync('curl -s ifconfig.me');
      const serverIp = publicIp.trim();
      
      return ips.includes(serverIp) ? 'ok' : 'wrong_ip';
    } catch (error) {
      return 'error';
    }
  }

  async executeCommand(command: string): Promise<{ stdout: string; stderr: string; success: boolean }> {
    try {
      const { stdout, stderr } = await execAsync(command);
      return {
        stdout,
        stderr,
        success: true
      };
    } catch (error: any) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || error.message || 'Unknown error',
        success: false
      };
    }
  }

  async getNetworkConnections(): Promise<Array<{
    protocol: string;
    localAddress: string;
    localPort: number;
    remoteAddress: string;
    remotePort: number;
    state: string;
  }>> {
    try {
      const { stdout } = await execAsync("netstat -tnl | grep LISTEN");
      const lines = stdout.trim().split('\n');
      
      return lines.map(line => {
        const parts = line.trim().split(/\s+/);
        const [protocol, , , localAddr, remoteAddr, state] = parts;
        const [localAddress, localPort] = localAddr.split(':');
        const [remoteAddress, remotePort] = remoteAddr.split(':');
        
        return {
          protocol,
          localAddress,
          localPort: parseInt(localPort),
          remoteAddress,
          remotePort: parseInt(remotePort) || 0,
          state
        };
      });
    } catch (error) {
      throw new Error(`Failed to get network connections: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getServiceStatus(serviceName: string): Promise<{
    active: boolean;
    enabled: boolean;
    status: string;
  }> {
    try {
      const { stdout: activeStatus } = await execAsync(`systemctl is-active ${serviceName}`);
      const { stdout: enabledStatus } = await execAsync(`systemctl is-enabled ${serviceName}`);
      const { stdout: statusOutput } = await execAsync(`systemctl status ${serviceName} --no-pager -l`);
      
      return {
        active: activeStatus.trim() === 'active',
        enabled: enabledStatus.trim() === 'enabled',
        status: statusOutput
      };
    } catch (error) {
      return {
        active: false,
        enabled: false,
        status: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const systemService = new SystemService();
