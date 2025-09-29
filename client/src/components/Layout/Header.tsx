import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, Settings, Menu, X, Check, Clock, AlertTriangle, Info } from "lucide-react";
import { useNotifications } from "@/contexts/NotificationContext";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface HeaderProps {
  onMenuClick: () => void;
  showMenuButton: boolean;
}

const pageNames: Record<string, string> = {
  "/": "لوحة المعلومات",
  "/path-manager": "إدارة المسارات المحمية",
  "/applications": "إدارة التطبيقات",
  "/domains": "إدارة النطاقات",
  "/nginx": "إعدادات Nginx",
  "/ssl": "شهادات SSL",
  "/processes": "العمليات والخدمات",
  "/logs": "السجلات",
  "/terminal": "الطرفية"
};

// مكونات الإشعارات
function NotificationsPopover() {
  const { notifications, unreadCount, markAsRead, markAsResolved } = useNotifications();
  const [open, setOpen] = useState(false);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'success':
        return <Check className="h-4 w-4 text-green-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getNotificationVariant = (type: string) => {
    switch (type) {
      case 'error':
        return 'destructive' as const;
      case 'warning':
        return 'secondary' as const;
      case 'success':
        return 'default' as const;
      default:
        return 'outline' as const;
    }
  };

  const recentNotifications = notifications.slice(0, 10);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="relative"
          data-testid="button-notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <div className="notification-dot" data-testid="notification-badge">
              <span className="sr-only">{unreadCount} إشعارات غير مقروءة</span>
            </div>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" data-testid="notifications-popover">
        <div className="border-b p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">الإشعارات</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary">{unreadCount} غير مقروء</Badge>
            )}
          </div>
        </div>
        
        <ScrollArea className="h-96">
          {recentNotifications.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground" data-testid="no-notifications">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>لا توجد إشعارات</p>
            </div>
          ) : (
            <div className="p-2">
              {recentNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg mb-2 transition-colors hover:bg-accent ${
                    !notification.acknowledged ? 'bg-accent/50' : ''
                  }`}
                  data-testid={`notification-${notification.id}`}
                >
                  <div className="flex items-start gap-3">
                    {getNotificationIcon(notification.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-sm truncate">{notification.title}</p>
                        <Badge 
                          variant={getNotificationVariant(notification.type)} 
                          className="ml-2 text-xs"
                        >
                          {notification.level === 'high' ? 'عالي' : notification.level === 'medium' ? 'متوسط' : 'منخفض'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {notification.createdAt ? formatDistanceToNow(new Date(notification.createdAt), { 
                            addSuffix: true, 
                            locale: ar 
                          }) : 'الآن'}
                        </span>
                        <div className="flex gap-1">
                          {!notification.acknowledged && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => markAsRead(notification.id)}
                              data-testid={`mark-read-${notification.id}`}
                            >
                              تم القراءة
                            </Button>
                          )}
                          {!notification.resolved && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => markAsResolved(notification.id)}
                              data-testid={`resolve-${notification.id}`}
                            >
                              حل
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        
        {notifications.length > 10 && (
          <div className="border-t p-3">
            <Button variant="outline" className="w-full" size="sm">
              عرض جميع الإشعارات ({notifications.length})
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// مكونات الإعدادات
function SettingsDropdown() {
  const { logout } = useAuth();
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [language, setLanguage] = useState(localStorage.getItem('language') || 'ar');
  const [autoRefresh, setAutoRefresh] = useState(localStorage.getItem('autoRefresh') !== 'false');

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.className = newTheme;
  };

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
    localStorage.setItem('language', newLanguage);
    // يمكن إضافة تحديث الواجهة هنا
  };

  const handleAutoRefreshToggle = () => {
    const newValue = !autoRefresh;
    setAutoRefresh(newValue);
    localStorage.setItem('autoRefresh', newValue.toString());
  };

  const handleLogout = () => {
    logout();
  };

  const handleExportLogs = async () => {
    try {
      const response = await fetch('/api/system/export-logs', {
        credentials: 'include'
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `system-logs-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to export logs:', error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm"
          data-testid="button-settings"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end" data-testid="settings-dropdown">
        <DropdownMenuLabel>الإعدادات</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* إعدادات المظهر */}
        <DropdownMenuLabel className="text-xs text-muted-foreground px-2 py-1.5">المظهر</DropdownMenuLabel>
        <DropdownMenuItem 
          onClick={() => handleThemeChange('light')}
          className={theme === 'light' ? 'bg-accent' : ''}
          data-testid="theme-light"
        >
          🌞 الوضع الفاتح
          {theme === 'light' && <Check className="h-4 w-4 ml-auto" />}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleThemeChange('dark')}
          className={theme === 'dark' ? 'bg-accent' : ''}
          data-testid="theme-dark"
        >
          🌙 الوضع الداكن
          {theme === 'dark' && <Check className="h-4 w-4 ml-auto" />}
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* إعدادات اللغة */}
        <DropdownMenuLabel className="text-xs text-muted-foreground px-2 py-1.5">اللغة</DropdownMenuLabel>
        <DropdownMenuItem 
          onClick={() => handleLanguageChange('ar')}
          className={language === 'ar' ? 'bg-accent' : ''}
          data-testid="language-arabic"
        >
          🇸🇦 العربية
          {language === 'ar' && <Check className="h-4 w-4 ml-auto" />}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleLanguageChange('en')}
          className={language === 'en' ? 'bg-accent' : ''}
          data-testid="language-english"
        >
          🇺🇸 English
          {language === 'en' && <Check className="h-4 w-4 ml-auto" />}
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* إعدادات التطبيق */}
        <DropdownMenuLabel className="text-xs text-muted-foreground px-2 py-1.5">التطبيق</DropdownMenuLabel>
        <DropdownMenuItem 
          onClick={handleAutoRefreshToggle}
          data-testid="auto-refresh-toggle"
        >
          🔄 التحديث التلقائي
          {autoRefresh && <Check className="h-4 w-4 ml-auto" />}
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={handleExportLogs} data-testid="export-logs">
          📁 تصدير السجلات
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* عمليات إدارية */}
        <DropdownMenuItem onClick={handleLogout} className="text-red-600" data-testid="logout-button">
          🚪 تسجيل الخروج
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header({ onMenuClick, showMenuButton }: HeaderProps) {
  const [location] = useLocation();

  return (
    <header className="bg-card border-b border-border px-6 py-4" data-testid="header">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Notifications */}
          <NotificationsPopover />
          
          {/* Settings */}
          <SettingsDropdown />
          
          {/* Server Status */}
          <div className="flex items-center gap-2 px-3 py-2 bg-green-500/20 text-green-400 rounded-lg" data-testid="server-status">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm font-medium">متصل</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold" data-testid="page-title">
            {pageNames[location] || "لوحة التحكم"}
          </h2>
          {showMenuButton && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onMenuClick}
              data-testid="button-menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}