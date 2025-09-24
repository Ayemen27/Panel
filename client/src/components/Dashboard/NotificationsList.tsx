import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotifications } from "@/contexts/NotificationContext";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

export function NotificationsList() {
  const { notifications, markAsRead } = useNotifications();

  const displayedNotifications = notifications.slice(0, 5);

  return (
    <Card data-testid="notifications-list">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">الإشعارات الأخيرة</CardTitle>
          <Button variant="ghost" size="sm" data-testid="button-view-all-notifications">
            عرض الكل
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {displayedNotifications.length === 0 ? (
          <div className="text-center py-8" data-testid="no-notifications">
            <p className="text-muted-foreground">لا توجد إشعارات</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedNotifications.map((notification) => (
              <div 
                key={notification.id} 
                className="flex items-start gap-3 p-3 hover:bg-accent rounded-lg transition-colors cursor-pointer"
                onClick={() => markAsRead(notification.id)}
                data-testid={`notification-${notification.id}`}
              >
                <div className={`w-2 h-2 rounded-full mt-2 ${
                  notification.type === 'error' ? 'bg-red-500' :
                  notification.type === 'warning' ? 'bg-yellow-500' :
                  notification.type === 'success' ? 'bg-green-500' :
                  'bg-blue-500'
                }`} />
                <div className="flex-1">
                  <p className="text-sm" data-testid={`notification-message-${notification.id}`}>
                    {notification.message}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1" data-testid={`notification-time-${notification.id}`}>
                    {formatDistanceToNow(new Date(notification.createdAt), { 
                      addSuffix: true, 
                      locale: ar 
                    })}
                  </p>
                </div>
                {!notification.acknowledged && (
                  <div className="w-2 h-2 bg-primary rounded-full" />
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
