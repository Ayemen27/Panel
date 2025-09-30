import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { 
  Box, 
  Shield, 
  Activity, 
  Server, 
  Globe, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle
} from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  total?: number;
  icon: 'cube' | 'shield' | 'activity' | 'server' | 'globe';
  trend?: 'up' | 'down' | 'neutral' | 'warning';
  warning?: number;
  loading?: boolean;
  className?: string;
}

const iconMap = {
  cube: Box,
  shield: Shield,
  activity: Activity,
  server: Server,
  globe: Globe,
};

const trendConfig = {
  up: {
    icon: TrendingUp,
    className: 'text-green-500',
    bgClassName: 'bg-green-500/20'
  },
  down: {
    icon: TrendingUp,
    className: 'text-red-500 rotate-180',
    bgClassName: 'bg-red-500/20'
  },
  warning: {
    icon: AlertTriangle,
    className: 'text-yellow-500',
    bgClassName: 'bg-yellow-500/20'
  },
  neutral: {
    icon: CheckCircle,
    className: 'text-blue-500',
    bgClassName: 'bg-blue-500/20'
  }
};

export function StatsCard({ 
  title, 
  value, 
  total,
  icon, 
  trend = 'neutral', 
  warning,
  loading = false,
  className 
}: StatsCardProps) {
  const Icon = iconMap[icon];
  const TrendIcon = trendConfig[trend].icon;

  if (loading) {
    return (
      <Card className={cn("card-hover", className)} data-testid="stats-card-loading">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-12" />
            </div>
            <Skeleton className="w-12 h-12 rounded-lg" />
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 w-24" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("card-hover", className)} data-testid="stats-card">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-sm" data-testid="stats-title">
              {title}
            </p>
            <p className="text-2xl font-bold text-foreground" data-testid="stats-value">
              {value}
              {total && <span className="text-muted-foreground text-base">/{total}</span>}
            </p>
          </div>
          <div className={cn(
            "w-12 h-12 rounded-lg flex items-center justify-center",
            trendConfig[trend].bgClassName
          )}>
            <Icon className={cn("text-lg", trendConfig[trend].className)} />
          </div>
        </div>
        
        <div className="mt-4 flex items-center gap-2" data-testid="stats-trend">
          <TrendIcon className={cn("w-4 h-4", trendConfig[trend].className)} />
          {warning ? (
            <span className="text-yellow-500 text-sm">⚠ {warning}</span>
          ) : trend === 'up' ? (
            <span className="text-green-500 text-sm">↗ نشط</span>
          ) : trend === 'neutral' ? (
            <span className="text-blue-500 text-sm">✓ مستقر</span>
          ) : (
            <span className="text-muted-foreground text-sm">--</span>
          )}
          <span className="text-muted-foreground text-sm">
            {warning ? 'تحتاج انتباه' : 'الحالة الحالية'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
