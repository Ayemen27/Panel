import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/Common/StatusBadge";
import { Link } from "wouter";
import { Box } from "lucide-react";
import type { Application } from "@shared/schema";

interface ApplicationsListProps {
  applications: Application[];
  loading: boolean;
}

export function ApplicationsList({ applications, loading }: ApplicationsListProps) {
  if (loading) {
    return (
      <Card data-testid="applications-list-loading">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">التطبيقات</CardTitle>
            <Skeleton className="h-4 w-16" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-2 h-2 rounded-full" />
                  <div>
                    <Skeleton className="h-4 w-32 mb-1" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <Skeleton className="h-5 w-12" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayedApps = applications.slice(0, 4);

  return (
    <Card data-testid="applications-list">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">التطبيقات</CardTitle>
          <Link href="/applications">
            <a className="text-primary hover:text-primary/80 text-sm" data-testid="link-view-all-apps">
              عرض الكل
            </a>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {displayedApps.length === 0 ? (
          <div className="text-center py-8" data-testid="no-applications">
            <Box className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">لا توجد تطبيقات مُضافة</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedApps.map((app) => (
              <div 
                key={app.id} 
                className="flex items-center justify-between p-3 hover:bg-accent rounded-lg transition-colors"
                data-testid={`app-item-${app.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    app.status === 'running' ? 'bg-green-500' : 
                    app.status === 'error' ? 'bg-red-500' : 'bg-gray-500'
                  }`} />
                  <div>
                    <p className="font-medium" data-testid={`app-name-${app.id}`}>
                      {app.name}
                    </p>
                    <p className="text-sm text-muted-foreground" data-testid={`app-port-${app.id}`}>
                      المنفذ: {app.port}
                    </p>
                  </div>
                </div>
                <StatusBadge 
                  status={app.status} 
                  data-testid={`app-status-${app.id}`}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
