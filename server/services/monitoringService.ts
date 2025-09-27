import { exec } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';

const execAsync = promisify(exec);

export interface SystemMetrics {
  timestamp: number;
  cpu: {
    usage: number;
    loadAverage: number[];
    processes: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number;
    cached: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usage: number;
    inodesUsed: number;
    inodesTotal: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
  };
  processes: {
    total: number;
    running: number;
    sleeping: number;
    zombie: number;
  };
}

export class MonitoringService extends EventEmitter {
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastNetworkStats: any = null;

  constructor() {
    super();
    this.setMaxListeners(100); // Allow many clients to listen
  }

  async startMonitoring(intervalMs = 5000): Promise<void> {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    console.log('🔍 Starting system monitoring...');

    this.monitoringInterval = setInterval(async () => {
      try {
        const metrics = await this.collectMetrics();
        this.emit('metrics', metrics);
      } catch (error: any) {
        console.error('Error collecting metrics:', error);
        this.emit('error', error);
      }
    }, intervalMs);

    // Initial metrics collection
    try {
      const metrics = await this.collectMetrics();
      this.emit('metrics', metrics);
    } catch (error: any) {
      console.error('Error collecting initial metrics:', error);
    }
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    console.log('🛑 Stopped system monitoring');
  }

  private async collectMetrics(): Promise<SystemMetrics> {
    const [cpuInfo, memInfo, diskInfo, networkInfo, processInfo] = await Promise.all([
      this.getCPUInfo(),
      this.getMemoryInfo(),
      this.getDiskInfo(),
      this.getNetworkInfo(),
      this.getProcessInfo()
    ]);

    return {
      timestamp: Date.now(),
      cpu: cpuInfo,
      memory: memInfo,
      disk: diskInfo,
      network: networkInfo,
      processes: processInfo
    };
  }

  private async getCPUInfo(): Promise<SystemMetrics['cpu']> {
    try {
      // Get CPU usage
      const { stdout: cpuUsage } = await execAsync(
        "top -bn1 | grep '%Cpu' | awk '{print $2}' | sed 's/%us,//'"
      );

      // Get load average
      const { stdout: loadAvg } = await execAsync("uptime | awk -F'load average:' '{print $2}'");
      const loadAverage = loadAvg.trim().split(',').map(x => parseFloat(x.trim()));

      // Get process count
      const { stdout: processCount } = await execAsync("ps aux | wc -l");

      return {
        usage: parseFloat(cpuUsage.trim()) || 0,
        loadAverage: loadAverage.slice(0, 3),
        processes: parseInt(processCount.trim()) - 1 // Subtract header line
      };
    } catch (error: any) {
      return { usage: 0, loadAverage: [0, 0, 0], processes: 0 };
    }
  }

  private async getMemoryInfo(): Promise<SystemMetrics['memory']> {
    try {
      const { stdout } = await execAsync("free -b | grep '^Mem:'");
      const parts = stdout.trim().split(/\s+/);

      const total = parseInt(parts[1]);
      const used = parseInt(parts[2]);
      const free = parseInt(parts[3]);
      const cached = parseInt(parts[6]) || 0;

      return {
        total,
        used,
        free,
        usage: (used / total) * 100,
        cached
      };
    } catch (error: any) {
      return { total: 0, used: 0, free: 0, usage: 0, cached: 0 };
    }
  }

  private async getDiskInfo(): Promise<SystemMetrics['disk']> {
    try {
      const { stdout } = await execAsync("df -B1 / | tail -1");
      const parts = stdout.trim().split(/\s+/);

      const total = parseInt(parts[1]);
      const used = parseInt(parts[2]);
      const free = parseInt(parts[3]);

      // Get inode info
      const { stdout: inodeInfo } = await execAsync("df -i / | tail -1");
      const inodeParts = inodeInfo.trim().split(/\s+/);
      const inodesTotal = parseInt(inodeParts[1]);
      const inodesUsed = parseInt(inodeParts[2]);

      return {
        total,
        used,
        free,
        usage: (used / total) * 100,
        inodesTotal,
        inodesUsed
      };
    } catch (error: any) {
      return { total: 0, used: 0, free: 0, usage: 0, inodesUsed: 0, inodesTotal: 0 };
    }
  }

  private async getNetworkInfo(): Promise<SystemMetrics['network']> {
    try {
      const { stdout } = await execAsync("cat /proc/net/dev | grep -E 'eth0|ens|enp' | head -1");
      const parts = stdout.trim().split(/\s+/);

      const bytesIn = parseInt(parts[1]) || 0;
      const packetsIn = parseInt(parts[2]) || 0;
      const bytesOut = parseInt(parts[9]) || 0;
      const packetsOut = parseInt(parts[10]) || 0;

      // Calculate delta if we have previous stats
      let deltaIn = 0, deltaOut = 0;
      if (this.lastNetworkStats) {
        deltaIn = bytesIn - this.lastNetworkStats.bytesIn;
        deltaOut = bytesOut - this.lastNetworkStats.bytesOut;
      }

      this.lastNetworkStats = { bytesIn, bytesOut };

      return {
        bytesIn: deltaIn,
        bytesOut: deltaOut,
        packetsIn,
        packetsOut
      };
    } catch (error: any) {
      return { bytesIn: 0, bytesOut: 0, packetsIn: 0, packetsOut: 0 };
    }
  }

  private async getProcessInfo(): Promise<SystemMetrics['processes']> {
    try {
      const { stdout } = await execAsync("ps -eo stat --no-headers | sort | uniq -c");
      const lines = stdout.trim().split('\n');

      let total = 0, running = 0, sleeping = 0, zombie = 0;

      for (const line of lines) {
        const [count, state] = line.trim().split(/\s+/);
        const num = parseInt(count);
        total += num;

        if (state.startsWith('R')) running += num;
        else if (state.startsWith('S') || state.startsWith('I')) sleeping += num;
        else if (state.startsWith('Z')) zombie += num;
      }

      return { total, running, sleeping, zombie };
    } catch (error: any) {
      return { total: 0, running: 0, sleeping: 0, zombie: 0 };
    }
  }

  async getAlerts(): Promise<Array<{
    type: 'warning' | 'critical';
    category: string;
    message: string;
    value: number;
    threshold: number;
  }>> {
    const alerts = [];

    try {
      const metrics = await this.collectMetrics();

      // CPU alerts
      if (metrics.cpu.usage > 90) {
        alerts.push({
          type: 'critical' as const,
          category: 'CPU',
          message: 'استخدام المعالج مرتفع جداً',
          value: metrics.cpu.usage,
          threshold: 90
        });
      } else if (metrics.cpu.usage > 75) {
        alerts.push({
          type: 'warning' as const,
          category: 'CPU',
          message: 'استخدام المعالج مرتفع',
          value: metrics.cpu.usage,
          threshold: 75
        });
      }

      // Memory alerts
      if (metrics.memory.usage > 95) {
        alerts.push({
          type: 'critical' as const,
          category: 'Memory',
          message: 'الذاكرة ممتلئة تقريباً',
          value: metrics.memory.usage,
          threshold: 95
        });
      } else if (metrics.memory.usage > 85) {
        alerts.push({
          type: 'warning' as const,
          category: 'Memory',
          message: 'استخدام الذاكرة مرتفع',
          value: metrics.memory.usage,
          threshold: 85
        });
      }

      // Disk alerts
      if (metrics.disk.usage > 95) {
        alerts.push({
          type: 'critical' as const,
          category: 'Disk',
          message: 'مساحة القرص ممتلئة تقريباً',
          value: metrics.disk.usage,
          threshold: 95
        });
      } else if (metrics.disk.usage > 85) {
        alerts.push({
          type: 'warning' as const,
          category: 'Disk',
          message: 'مساحة القرص منخفضة',
          value: metrics.disk.usage,
          threshold: 85
        });
      }

      // Process alerts
      if (metrics.processes.zombie > 10) {
        alerts.push({
          type: 'warning' as const,
          category: 'Processes',
          message: 'عدد كبير من العمليات الزومبي',
          value: metrics.processes.zombie,
          threshold: 10
        });
      }

    } catch (error: any) {
      console.error('Error generating alerts:', error);
    }

    return alerts;
  }
}

export const monitoringService = new MonitoringService();