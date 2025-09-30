import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Activity, Cpu, MemoryStick, Clock, RefreshCw } from "lucide-react";

export default function Processes() {
  const { data: processes, isLoading: processesLoading, refetch } = useQuery({
    queryKey: ["/api/system/processes"],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const { data: systemInfo, isLoading: systemLoading } = useQuery({
    queryKey: ["/api/system/info"],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}د ${hours}س`;
    } else if (hours > 0) {
      return `${hours}س ${minutes}د`;
    } else {
      return `${minutes}د`;
    }
  };

  const formatMemory = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb.toFixed(1)} MB`;
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'r':
      case 'running':
        return <Badge className="bg-green-500/20 text-green-400">يعمل</Badge>;
      case 's':
      case 'sleeping':
        return <Badge variant="secondary">نائم</Badge>;
      case 'z':
      case 'zombie':
        return <Badge variant="destructive">زومبي</Badge>;
      case 't':
      case 'stopped':
        return <Badge variant="outline">متوقف</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6" data-testid="processes-content">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">العمليات والخدمات</h2>
          <p className="text-muted-foreground">مراقبة العمليات وأداء النظام</p>
        </div>
        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={processesLoading}
          data-testid="button-refresh-processes"
        >
          <RefreshCw className="w-4 h-4 ml-2" />
          تحديث
        </Button>
      </div>

      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            {systemLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-6 w-12" />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">وقت التشغيل</p>
                  <p className="text-lg font-semibold">
                    {systemInfo ? formatUptime(systemInfo.uptime) : '--'}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            {systemLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-6 w-12" />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">متوسط الحمولة</p>
                  <p className="text-lg font-semibold">
                    {systemInfo?.loadAverage?.[0]?.toFixed(2) || '--'}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">العمليات النشطة</p>
                <p className="text-lg font-semibold">
                  {processes?.length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            {systemLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-6 w-12" />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <MemoryStick className="w-5 h-5 text-purple-500" />
                <div>
                  <p className="text-sm text-muted-foreground">المنصة</p>
                  <p className="text-lg font-semibold">
                    {systemInfo?.platform || '--'}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Processes Table */}
      <Card data-testid="processes-table">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            العمليات الحالية
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {processesLoading ? (
            <div className="p-6">
              <div className="space-y-4">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <div className="flex gap-4">
                      <Skeleton className="h-4 w-12" />
                      <Skeleton className="h-4 w-12" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : processes?.length === 0 ? (
            <div className="p-12 text-center">
              <Activity className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">لا توجد عمليات</h3>
              <p className="text-muted-foreground">لا يمكن الوصول إلى قائمة العمليات</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">معرف العملية</TableHead>
                    <TableHead className="text-right">اسم العملية</TableHead>
                    <TableHead className="text-right">استخدام المعالج</TableHead>
                    <TableHead className="text-right">استخدام الذاكرة</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processes?.map((process: any) => (
                    <TableRow key={process.pid} data-testid={`process-${process.pid}`}>
                      <TableCell className="font-mono">{process.pid}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{process.name}</p>
                          {process.command && (
                            <p className="text-sm text-muted-foreground truncate max-w-xs">
                              {process.command}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            process.cpu > 50 ? 'bg-red-500' : 
                            process.cpu > 20 ? 'bg-yellow-500' : 'bg-green-500'
                          }`} />
                          {process.cpu?.toFixed(1)}%
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            process.memory > 10 ? 'bg-red-500' : 
                            process.memory > 5 ? 'bg-yellow-500' : 'bg-green-500'
                          }`} />
                          {process.memory?.toFixed(1)}%
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(process.status)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Information */}
      {systemInfo && (
        <Card data-testid="system-info">
          <CardHeader>
            <CardTitle>معلومات النظام</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">تفاصيل الخادم</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">اسم المضيف:</span>
                    <span className="font-mono">{systemInfo.hostname}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">المنصة:</span>
                    <span className="font-mono">{systemInfo.platform}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">المعمارية:</span>
                    <span className="font-mono">{systemInfo.arch}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">إصدار النواة:</span>
                    <span className="font-mono">{systemInfo.kernel}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">أداء النظام</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">متوسط الحمولة (1م):</span>
                    <span className="font-mono">{systemInfo.loadAverage?.[0]?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">متوسط الحمولة (5م):</span>
                    <span className="font-mono">{systemInfo.loadAverage?.[1]?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">متوسط الحمولة (15م):</span>
                    <span className="font-mono">{systemInfo.loadAverage?.[2]?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">وقت التشغيل:</span>
                    <span className="font-mono">{formatUptime(systemInfo.uptime)}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
