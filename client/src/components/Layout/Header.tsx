import { Button } from "@/components/ui/button";
import { Bell, Settings, Menu } from "lucide-react";
import { useNotifications } from "@/contexts/NotificationContext";
import { useLocation } from "wouter";

interface HeaderProps {
  onMenuClick: () => void;
  showMenuButton: boolean;
}

const pageNames: Record<string, string> = {
  "/": "لوحة المعلومات",
  "/applications": "إدارة التطبيقات",
  "/domains": "إدارة النطاقات",
  "/nginx": "إعدادات Nginx",
  "/ssl": "شهادات SSL",
  "/processes": "العمليات والخدمات",
  "/logs": "السجلات",
  "/terminal": "الطرفية"
};

export function Header({ onMenuClick, showMenuButton }: HeaderProps) {
  const { unreadCount } = useNotifications();
  const [location] = useLocation();

  return (
    <header className="bg-card border-b border-border px-6 py-4" data-testid="header">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
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
          <h2 className="text-xl font-semibold" data-testid="page-title">
            {pageNames[location] || "لوحة التحكم"}
          </h2>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Notifications */}
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
          
          {/* Settings */}
          <Button 
            variant="ghost" 
            size="sm"
            data-testid="button-settings"
          >
            <Settings className="h-5 w-5" />
          </Button>
          
          {/* Server Status */}
          <div className="flex items-center gap-2 px-3 py-2 bg-green-500/20 text-green-400 rounded-lg" data-testid="server-status">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm font-medium">متصل</span>
          </div>
        </div>
      </div>
    </header>
  );
}
