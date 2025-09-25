import { useQuery } from "@tanstack/react-query";
import { StatsCard } from "@/components/Dashboard/StatsCard";
import { QuickActions } from "@/components/Dashboard/QuickActions";
import { ApplicationsList } from "@/components/Dashboard/ApplicationsList";
import { NotificationsList } from "@/components/Dashboard/NotificationsList";
import { SystemResources } from "@/components/Dashboard/SystemResources";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Application } from "@shared/schema";

// API Response Types
interface DashboardStats {
  applications: {
    total: number;
    running: number;
    stopped: number;
    error: number;
  };
  ssl: {
    total: number;
    valid: number;
    expiringSoon: number;
  };
  system: {
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
  };
}

interface SystemInfo {
  hostname: string;
  platform: string;
  arch: string;
  kernel: string;
  uptime: number;
  loadAverage: number[];
}

export default function Dashboard() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "غير مخول",
        description: "أنت غير مسجل دخول. جاري تسجيل الدخول مرة أخرى...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: stats, isLoading: statsLoading, error } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    enabled: isAuthenticated,
    refetchInterval: 60000, // Refresh every 60 seconds
    staleTime: 45000, // Data is considered fresh for 45 seconds
    gcTime: 300000, // Keep in cache for 5 minutes
  });

  const { data: applications, isLoading: appsLoading } = useQuery<Application[]>({
    queryKey: ["/api/applications"],
    enabled: isAuthenticated,
    refetchInterval: 60000, // Refresh every 60 seconds
    staleTime: 45000, // Data is considered fresh for 45 seconds
    gcTime: 300000, // Keep in cache for 5 minutes
  });

  const { data: systemInfo, isLoading: systemLoading } = useQuery<SystemInfo>({
    queryKey: ["/api/system/info"],
    enabled: isAuthenticated,
    refetchInterval: 120000, // Refresh every 2 minutes
    staleTime: 90000, // Data is considered fresh for 90 seconds
    gcTime: 600000, // Keep in cache for 10 minutes
  });

  if (error && isUnauthorizedError(error as Error)) {
    return null; // The useEffect will handle the redirect
  }

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="dashboard-content">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="التطبيقات النشطة"
          value={stats?.applications?.running || 0}
          total={stats?.applications?.total || 0}
          icon="cube"
          trend={(stats?.applications?.running || 0) > 0 ? "up" : "neutral"}
          loading={statsLoading}
          data-testid="stat-active-apps"
        />
        
        <StatsCard
          title="شهادات SSL"
          value={stats?.ssl?.valid || 0}
          total={stats?.ssl?.total || 0}
          icon="shield"
          trend={(stats?.ssl?.expiringSoon || 0) > 0 ? "warning" : "up"}
          warning={stats?.ssl?.expiringSoon}
          loading={statsLoading}
          data-testid="stat-ssl-certificates"
        />
        
        <StatsCard
          title="استخدام المعالج"
          value={`${stats?.system?.cpu?.usage || 0}%`}
          icon="activity"
          trend={
            (stats?.system?.cpu?.usage || 0) > 80 ? "warning" : 
            (stats?.system?.cpu?.usage || 0) > 60 ? "neutral" : "up"
          }
          loading={statsLoading}
          data-testid="stat-cpu-usage"
        />
        
        <StatsCard
          title="استخدام الذاكرة"
          value={`${stats?.system?.memory?.usage || 0}%`}
          icon="server"
          trend={
            (stats?.system?.memory?.usage || 0) > 80 ? "warning" : 
            (stats?.system?.memory?.usage || 0) > 60 ? "neutral" : "up"
          }
          loading={statsLoading}
          data-testid="stat-memory-usage"
        />
      </div>

      {/* Quick Actions */}
      <QuickActions data-testid="quick-actions" />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Applications Overview */}
        <ApplicationsList 
          applications={applications || []} 
          loading={appsLoading}
          data-testid="applications-list"
        />
        
        {/* Recent Notifications */}
        <NotificationsList data-testid="notifications-list" />
      </div>

      {/* System Resources */}
      <SystemResources 
        systemStats={stats?.system}
        systemInfo={systemInfo}
        loading={systemLoading}
        data-testid="system-resources"
      />
    </div>
  );
}
