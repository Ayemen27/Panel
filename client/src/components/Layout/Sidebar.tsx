import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  Box, 
  Globe, 
  Settings, 
  Shield, 
  List, 
  FileText, 
  Terminal as TerminalIcon,
  Server,
  User,
  LogOut,
  X,
  Activity,
  Folder
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/contexts/NotificationContext";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  isMobile: boolean;
}

const navigationItems = [
  { href: "/", label: "لوحة المعلومات", icon: BarChart3 },
  { href: "/health-check", label: "فحص النظام", icon: Activity },
  { href: "/file-manager", label: "إدارة الملفات", icon: Folder },
  { href: "/path-manager", label: "إدارة المسارات", icon: Shield },
  { href: "/applications", label: "التطبيقات", icon: Box },
  { href: "/domains", label: "النطاقات", icon: Globe },
  { href: "/nginx", label: "Nginx", icon: Settings },
  { href: "/ssl", label: "شهادات SSL", icon: Shield },
  { href: "/audit", label: "الفحص الشامل", icon: Shield, requiresRole: 'admin' },
  { href: "/processes", label: "العمليات", icon: List },
  { href: "/logs", label: "السجلات", icon: FileText },
  { href: "/terminal", label: "الطرفية", icon: TerminalIcon },
];

export function Sidebar({ open, onClose, isMobile }: SidebarProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();

  const sidebarClasses = cn(
    "w-64 bg-card border-l border-border flex flex-col sidebar-transition",
    "lg:translate-x-0",
    {
      "fixed inset-y-0 right-0 z-50": isMobile,
      "sidebar-hidden": isMobile && !open,
    }
  );

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && open && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={onClose}
          data-testid="sidebar-overlay"
        />
      )}

      <aside className={sidebarClasses} data-testid="sidebar">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 gradient-bg rounded-lg flex items-center justify-center">
                <Server className="text-white text-lg" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">لوحة التحكم</h1>
                <p className="text-xs text-muted-foreground">إدارة الخادم</p>
              </div>
            </div>

            {isMobile && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onClose}
                data-testid="button-close-sidebar"
              >
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2" data-testid="navigation">
          {navigationItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;

            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors w-full",
                    isActive 
                      ? "bg-primary text-primary-foreground font-medium"
                      : "hover:bg-accent hover:text-accent-foreground"
                  )}
                  onClick={isMobile ? onClose : undefined}
                  data-testid={`nav-${item.href.replace('/', '') || 'dashboard'}`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                  {item.href === "/ssl" && unreadCount > 0 && (
                    <div className="relative mr-auto">
                      <Shield className="text-yellow-500" />
                      <div className="notification-dot" />
                    </div>
                  )}
                  {item.href === "/applications" && (
                    <span className="mr-auto bg-primary/20 text-primary text-xs px-2 py-1 rounded-full">
                      4
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-border" data-testid="sidebar-footer">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <User className="text-primary-foreground text-sm" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">
                {user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.email?.split('@')[0] || "مدير النظام"}
              </p>
              <p className="text-xs text-muted-foreground">{user?.email || "administrator"}</p> {user?.role && (
                <p className="text-xs text-primary font-medium">
                  {user.role === 'admin' ? 'مدير' : user.role === 'moderator' ? 'مشرف' : user.role === 'user' ? 'مستخدم' : 'مشاهد'}
                </p>
              )}
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={logout}
              data-testid="button-logout"
            >
              <LogOut className="text-muted-foreground h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}