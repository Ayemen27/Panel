import React, { useState, useEffect } from "react";
import { Bell, X, CheckCircle, AlertTriangle, Info, MessageCircle, Zap, Clock, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { showSuccessToast, showErrorToast } from "@/utils/enhanced-toast";


interface Notification {
  id: string;
  type: 'safety' | 'task' | 'payroll' | 'announcement' | 'system';
  title: string;
  message: string;
  priority: number;
  createdAt: string;
  isRead?: boolean;
  actionRequired?: boolean;
}

interface NotificationCenterProps {
  className?: string;
}

const notificationIcons = {
  safety: AlertTriangle,
  task: CheckCircle,
  payroll: MessageCircle,
  announcement: Info,
  system: Bell,
};

const notificationColors = {
  safety: "text-red-600 bg-gradient-to-r from-red-50 to-red-100",
  task: "text-blue-600 bg-gradient-to-r from-blue-50 to-blue-100",
  payroll: "text-green-600 bg-gradient-to-r from-green-50 to-green-100",
  announcement: "text-purple-600 bg-gradient-to-r from-purple-50 to-purple-100",
  system: "text-gray-600 bg-gradient-to-r from-gray-50 to-gray-100",
};

const priorityLabels = {
  1: { label: "حرج", color: "bg-gradient-to-r from-red-500 to-red-600" },
  2: { label: "عالية", color: "bg-gradient-to-r from-orange-500 to-orange-600" },
  3: { label: "متوسطة", color: "bg-gradient-to-r from-yellow-500 to-yellow-600" },
  4: { label: "منخفضة", color: "bg-gradient-to-r from-blue-500 to-blue-600" },
  5: { label: "معلومة", color: "bg-gradient-to-r from-gray-500 to-gray-600" },
};

export function NotificationCenter({ className }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();

  // جلب الإشعارات من API
  const fetchNotifications = async () => {
    setLoading(true);
    try {
      // استخدام نظام المصادقة المتقدم JWT
      const token = localStorage.getItem('accessToken');

      if (!token) {
        console.warn('لا يوجد رمز مصادقة - تخطي جلب الإشعارات');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/notifications?limit=50', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        console.log('🔍 [NotificationCenter] استجابة API:', data);

        // التعامل مع الشكل الجديد للاستجابة { success, data, unreadCount }
        if (data.success && Array.isArray(data.data)) {
          // تحويل البيانات للشكل المتوقع من NotificationCenter
          const transformedNotifications = data.data.map((n: any) => ({
            id: n.id,
            type: n.type || 'system',
            title: n.title,
            message: n.message,
            priority: n.priority === 'critical' ? 1 :
                      n.priority === 'high' ? 2 :
                      n.priority === 'medium' ? 3 :
                      n.priority === 'low' ? 4 : 5,
            createdAt: n.createdAt,
            isRead: n.status === 'read',
            actionRequired: n.actionRequired || false
          }));

          setNotifications(transformedNotifications);
          setUnreadCount(data.unreadCount || 0);
          console.log('✅ [NotificationCenter] تم تحويل وحفظ الإشعارات:', transformedNotifications.length);
        }
        // إذا كان التنسيق القديم (مصفوفة مباشرة)
        else if (Array.isArray(data)) {
          setNotifications(data.map((n: any) => ({
            ...n,
            isRead: n.status === 'read'
          })));
          setUnreadCount(data.filter((n: any) => n.status !== 'read').length);
        }
      } else {
        console.error('فشل في جلب الإشعارات');
        // استخدام بيانات تجريبية في حالة الفشل
        setNotifications([
          {
            id: 'system-welcome',
            type: 'system',
            title: 'مرحباً بك',
            message: 'مرحباً بك في نظام إدارة المشاريع الإنشائية',
            priority: 3,
            createdAt: new Date().toISOString(),
            isRead: false,
          }
        ]);
        setUnreadCount(1);
      }
    } catch (error) {
      console.error('خطأ في جلب الإشعارات:', error);
    } finally {
      setLoading(false);
    }
  };

  // تعليم إشعار كمقروء
  const markAsRead = async (notificationId: string) => {
    try {
      // استخدام نظام المصادقة المتقدم JWT
      const token = localStorage.getItem('accessToken');

      if (!token) {
        console.warn('لا يوجد رمز مصادقة - لا يمكن تحديد الإشعار كمقروء');
        showErrorToast("لا يمكنك تحديد الإشعارات كمقروءة بدون تسجيل الدخول.");
        return;
      }

      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n =>
            n.id === notificationId ? { ...n, isRead: true } : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
        showSuccessToast("تم تحديد الإشعار كمقروء.");
      } else {
        showErrorToast("فشل في تحديد الإشعار كمقروء.");
      }
    } catch (error) {
      console.error('خطأ في تعليم الإشعار كمقروء:', error);
      showErrorToast("حدث خطأ أثناء تحديد الإشعار كمقروء.");
    }
  };

  // تعليم جميع الإشعارات كمقروءة
  const markAllAsRead = async () => {
    try {
      // استخدام نظام المصادقة المتقدم JWT
      const token = localStorage.getItem('accessToken');

      if (!token) {
        console.warn('لا يوجد رمز مصادقة - لا يمكن تعليم الإشعارات كمقروءة');
        showErrorToast("لا يمكنك تحديد جميع الإشعارات كمقروءة بدون تسجيل الدخول.");
        return;
      }

      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });

      if (response.ok) {
        // إعادة جلب البيانات من الخادم لضمان التزامن
        await fetchNotifications();
        showSuccessToast("تم تحديد جميع الإشعارات كمقروءة.");
      } else {
        showErrorToast("فشل في تحديد جميع الإشعارات كمقروءة.");
      }
    } catch (error) {
      console.error('خطأ في تعليم جميع الإشعارات كمقروءة:', error);
      showErrorToast("حدث خطأ أثناء تحديد جميع الإشعارات كمقروءة.");
    }
  };

  // جلب الإشعارات عند تحميل المكون
  useEffect(() => {
    fetchNotifications();

    // تحديث الإشعارات كل 5 دقائق لتقليل الحمولة
    const interval = setInterval(fetchNotifications, 300000);
    return () => clearInterval(interval);
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return `منذ ${diffInMinutes} دقيقة`;
    } else if (diffInHours < 24) {
      return `منذ ${Math.floor(diffInHours)} ساعة`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `منذ ${diffInDays} يوم`;
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "relative p-2 h-10 w-10 rounded-xl transition-all duration-300 hover:bg-blue-50 hover:shadow-lg border border-transparent hover:border-blue-200",
            className,
            unreadCount > 0 && "bg-blue-50 border-blue-200 shadow-md"
          )}
          data-testid="notification-bell"
        >
          <Bell className={cn(
            "h-5 w-5 transition-all duration-300",
            unreadCount > 0 ? "text-blue-600 animate-pulse" : "text-gray-600"
          )} />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 text-xs font-bold bg-gradient-to-r from-red-500 to-red-600 shadow-lg animate-bounce"
              data-testid="notification-badge"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 sm:w-96 p-0 border-0 shadow-2xl rounded-2xl bg-white" align="end" data-testid="notification-popover">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <Bell className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-bold text-base">الإشعارات</h3>
                <p className="text-xs text-blue-100">
                  {unreadCount > 0 ? `${unreadCount} إشعار جديد` : 'جميع الإشعارات مقروءة'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-8 text-white hover:bg-white/20 rounded-lg"
                  onClick={markAllAsRead}
                  data-testid="mark-all-read-button"
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  تعليم الكل
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-white hover:bg-white/20 rounded-lg"
                onClick={() => setIsOpen(false)}
                data-testid="close-notification-button"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
              <div className="text-sm text-gray-500">جاري التحميل...</div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                <Bell className="h-8 w-8 text-gray-400" />
              </div>
              <div className="text-sm font-medium text-gray-600 mb-1">لا توجد إشعارات</div>
              <div className="text-xs text-gray-400">ستظهر إشعاراتك الجديدة هنا</div>
            </div>
          ) : (
            <div className="p-2">
              {notifications.map((notification, index) => {
                const Icon = notificationIcons[notification.type] || Bell;
                const colorClasses = notificationColors[notification.type] || notificationColors.system;
                const priority = priorityLabels[notification.priority as keyof typeof priorityLabels] || priorityLabels[3];

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "group p-3 mb-2 last:mb-0 rounded-xl cursor-pointer transition-all duration-300 border",
                      !notification.isRead
                        ? "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 hover:from-blue-100 hover:to-indigo-100 shadow-sm hover:shadow-md"
                        : "bg-white border-gray-100 hover:bg-gray-50 hover:border-gray-200"
                    )}
                    onClick={() => !notification.isRead && markAsRead(notification.id)}
                    data-testid={`notification-item-${index}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm transition-all duration-300 group-hover:scale-105",
                        colorClasses
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className={cn(
                            "text-sm leading-tight",
                            !notification.isRead ? "font-bold text-gray-900" : "font-medium text-gray-700"
                          )}>
                            {notification.title}
                          </h4>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {!notification.isRead && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                            )}
                            <Badge
                              className={cn(
                                "text-xs px-2 py-0.5 text-white font-medium",
                                priority.color
                              )}
                            >
                              {priority.label}
                            </Badge>
                          </div>
                        </div>

                        <p className="text-xs text-gray-600 mb-2 line-clamp-2 leading-relaxed">
                          {notification.message}
                        </p>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Clock className="h-3 w-3" />
                            <span>{formatDate(notification.createdAt)}</span>
                          </div>

                          {notification.actionRequired && (
                            <Badge variant="outline" className="text-xs bg-orange-50 text-orange-600 border-orange-200">
                              <Zap className="h-3 w-3 mr-1" />
                              إجراء مطلوب
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {notifications.length > 0 && (
          <>
            <div className="border-t border-gray-100 p-3">
              <Button
                variant="ghost"
                className="w-full text-sm font-medium bg-gradient-to-r from-gray-50 to-gray-100 hover:from-blue-50 hover:to-indigo-50 border border-gray-200 hover:border-blue-200 transition-all duration-300 rounded-xl h-10"
                onClick={() => {
                  setIsOpen(false);
                  setLocation('/notifications');
                }}
                data-testid="view-all-notifications-button"
              >
                <User className="h-4 w-4 mr-2" />
                عرض جميع الإشعارات
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}