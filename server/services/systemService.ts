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
