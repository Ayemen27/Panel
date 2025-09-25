import { Link, useLocation } from "wouter";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { 
  BarChart3, 
  Box, 
  Globe, 
  Settings, 
  MoreHorizontal,
  Shield, 
  List, 
  FileText, 
  Terminal as TerminalIcon,
  Activity
} from "lucide-react";

interface BottomNavigationProps {
  className?: string;
}

const mainNavItems = [
  { href: "/", label: "الرئيسية", icon: BarChart3 },
  { href: "/applications", label: "التطبيقات", icon: Box },
  { href: "/domains", label: "النطاقات", icon: Globe },
  { href: "/ssl", label: "الإعدادات", icon: Settings },
];

const moreNavItems = [
  { href: "/health-check", label: "فحص النظام", icon: Activity },
  { href: "/nginx", label: "Nginx", icon: Settings },
  { href: "/processes", label: "العمليات", icon: List },
  { href: "/logs", label: "السجلات", icon: FileText },
  { href: "/terminal", label: "الطرفية", icon: TerminalIcon },
  { href: "/ssl", label: "شهادات SSL", icon: Shield },
];

export function BottomNavigation({ className }: BottomNavigationProps) {
  const [location] = useLocation();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const isActiveRoute = (href: string) => {
    if (href === "/") {
      return location === "/" || location === "/dashboard";
    }
    return location === href;
  };

  const NavItem = ({ href, label, icon: Icon, onClick }: {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick?: () => void;
  }) => {
    const isActive = isActiveRoute(href);
    
    return (
      <Link href={href}>
        <div
          className={cn(
            "flex flex-col items-center justify-center min-h-[60px] px-2 py-1 transition-all duration-200 relative",
            "tap-highlight-transparent select-none cursor-pointer bottom-nav-item-bounce",
            isActive 
              ? "text-primary" 
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={onClick}
          data-testid={`bottom-nav-${href.replace('/', '') || 'dashboard'}`}
        >
          {/* Active indicator */}
          {isActive && (
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-primary rounded-full" />
          )}
          
          <Icon className={cn(
            "w-6 h-6 mb-1 transition-transform duration-200",
            isActive && "scale-110"
          )} />
          <span className={cn(
            "text-xs font-medium transition-all duration-200",
            isActive ? "text-primary" : "text-muted-foreground"
          )}>
            {label}
          </span>
        </div>
      </Link>
    );
  };

  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 z-40 lg:hidden",
      "bg-card/95 backdrop-blur-lg border-t border-border",
      "shadow-lg shadow-black/5 bottom-nav-slide-up",
      className
    )}>
      <div className="flex items-center justify-around px-2 safe-area-pb bottom-nav-transition">
        {/* Main navigation items */}
        {mainNavItems.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}
        
        {/* More button */}
        <Sheet open={isMoreOpen} onOpenChange={setIsMoreOpen}>
          <SheetTrigger asChild>
            <div
              className={cn(
                "flex flex-col items-center justify-center min-h-[60px] px-2 py-1 transition-all duration-200",
                "tap-highlight-transparent select-none cursor-pointer",
                "text-muted-foreground hover:text-foreground"
              )}
              data-testid="bottom-nav-more"
            >
              <MoreHorizontal className="w-6 h-6 mb-1 transition-transform duration-200 hover:scale-110" />
              <span className="text-xs font-medium">المزيد</span>
            </div>
          </SheetTrigger>
          
          <SheetContent side="bottom" className="h-[50vh] rounded-t-xl">
            <SheetHeader className="text-center mb-6">
              <SheetTitle className="text-lg font-semibold">جميع الصفحات</SheetTitle>
            </SheetHeader>
            
            <div className="grid grid-cols-2 gap-4 px-4">
              {moreNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = isActiveRoute(item.href);
                
                return (
                  <Link key={item.href} href={item.href}>
                    <div
                      className={cn(
                        "flex flex-col items-center justify-center p-4 rounded-xl transition-all duration-200",
                        "border border-border hover:border-primary/50",
                        "tap-highlight-transparent",
                        isActive 
                          ? "bg-primary/10 border-primary text-primary" 
                          : "bg-card hover:bg-accent/50"
                      )}
                      onClick={() => setIsMoreOpen(false)}
                      data-testid={`more-nav-${item.href.replace('/', '') || 'dashboard'}`}
                    >
                      <Icon className={cn(
                        "w-8 h-8 mb-2 transition-transform duration-200",
                        isActive && "scale-110"
                      )} />
                      <span className={cn(
                        "text-sm font-medium text-center",
                        isActive ? "text-primary" : "text-foreground"
                      )}>
                        {item.label}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}