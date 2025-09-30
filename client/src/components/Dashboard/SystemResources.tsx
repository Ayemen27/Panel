import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

interface SystemResourcesProps {
  systemStats?: {
    cpu: { usage: number };
    memory: { usage: number };
    disk: { usage: number };
  };
  systemInfo?: {
    hostname: string;
    uptime: number;
    loadAverage: number[];
  };
  loading: boolean;
}

export function SystemResources({ systemStats, systemInfo, loading }: SystemResourcesProps) {
  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days} يوم، ${hours} ساعة`;
    } else if (hours > 0) {
      return `${hours} ساعة، ${minutes} دقيقة`;
    } else {
      return `${minutes} دقيقة`;
    }
  };

  const getProgressColor = (usage: number) => {
    if (usage > 80) return "bg-red-500";
    if (usage > 60) return "bg-yellow-500";
    return "bg-green-500";
  };

  if (loading) {
    return (
      <Card data-testid="system-resources-loading">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">موارد النظام</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-8" />
                </div>
                <Skeleton className="w-full h-2 rounded-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const resources = [
    {
      label: "استخدام المعالج",
      value: systemStats?.cpu?.usage || 0,
      testId: "cpu-usage"
    },
    {
      label: "استخدام الذاكرة",
      value: systemStats?.memory?.usage || 0,
      testId: "memory-usage"
    },
    {
      label: "استخدام القرص",
      value: systemStats?.disk?.usage || 0,
      testId: "disk-usage"
    }
  ];

  return (
    <Card data-testid="system-resources">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">موارد النظام</CardTitle>
        {systemInfo && (
          <p className="text-sm text-muted-foreground">
            الخادم: {systemInfo.hostname} • وقت التشغيل: {formatUptime(systemInfo.uptime)}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {resources.map((resource) => (
            <div key={resource.label} className="space-y-2" data-testid={resource.testId}>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{resource.label}</span>
                <span className="text-sm font-medium" data-testid={`${resource.testId}-value`}>
                  {resource.value.toFixed(1)}%
                </span>
              </div>
              <Progress 
                value={resource.value} 
                className="h-2"
                data-testid={`${resource.testId}-progress`}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
