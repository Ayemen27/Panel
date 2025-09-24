import { useLocation } from "wouter";
import { useState } from "react";
import { 
  Home, Users, Receipt, BarChart, CreditCard, Building2, Truck, Filter, FileText,
  MoreHorizontal, Calculator, FileSpreadsheet, UserCheck, DollarSign, Package,
  ClipboardCheck, TrendingUp, Settings, PlusCircle, ArrowLeftRight, Target,
  BookOpen, Calendar, Wrench, User, MapPin, Globe, X, Bell, Brain, Shield,
  Database
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/components/AuthProvider";

const navigationItems = [
  { path: "/", icon: Home, label: "الرئيسية", key: "dashboard" },
  { path: "/projects", icon: Building2, label: "المشاريع", key: "projects" },
  { path: "/workers", icon: Users, label: "العمال", key: "workers" },
  { path: "/suppliers-pro", icon: Truck, label: "الموردين", key: "suppliers" },
];

// قائمة الصفحات مع مستوى الحماية المطلوب
const allPagesData = [
  // الصفحات الرئيسية - متاحة للجميع
  {
    category: "الصفحات الرئيسية",
    pages: [
      { path: "/", icon: Home, label: "لوحة التحكم", description: "عرض شامل للمشاريع والإحصائيات", requireAdmin: false },
      { path: "/projects", icon: Building2, label: "إدارة المشاريع", description: "إضافة وإدارة المشاريع", requireAdmin: false },
      { path: "/workers", icon: Users, label: "إدارة العمال", description: "إضافة وإدارة العمال والحرفيين", requireAdmin: false },
      { path: "/suppliers-pro", icon: Truck, label: "إدارة الموردين", description: "إدارة الموردين والموزعين", requireAdmin: false },
    ]
  },
  // العمليات اليومية - مختلطة
  {
    category: "العمليات اليومية",
    pages: [
      { path: "/worker-attendance", icon: UserCheck, label: "حضور العمال", description: "تسجيل حضور وغياب العمال", requireAdmin: false },
      { path: "/daily-expenses", icon: Calculator, label: "المصاريف اليومية", description: "تسجيل المصاريف اليومية للمشاريع", requireAdmin: false },
      { path: "/material-purchase", icon: Package, label: "شراء المواد", description: "إدارة مشتريات مواد البناء", requireAdmin: false },
      { path: "/worker-accounts", icon: DollarSign, label: "حسابات العمال", description: "إدارة حوالات وتحويلات العمال", requireAdmin: true },
      { path: "/equipment", icon: Settings, label: "إدارة المعدات", description: "إدارة المعدات مع النقل والتتبع", requireAdmin: true },
      { path: "/project-transfers", icon: ArrowLeftRight, label: "تحويلات العهدة", description: "إدارة تحويلات الأموال بين المشاريع", requireAdmin: true },
      { path: "/project-transactions", icon: FileText, label: "سجل العمليات", description: "عرض شامل لجميع المعاملات المالية", requireAdmin: true },
    ]
  },
  // إدارة الموردين - للمسؤولين فقط
  {
    category: "إدارة الموردين", 
    pages: [
      { path: "/supplier-accounts", icon: CreditCard, label: "حسابات الموردين", description: "إدارة حسابات ودفعات الموردين", requireAdmin: true },
    ]
  },
  // الإشعارات والتنبيهات - متاحة للجميع
  {
    category: "الإشعارات والتنبيهات",
    pages: [
      { path: "/notifications", icon: Bell, label: "الإشعارات", description: "عرض وإدارة إشعارات النظام", requireAdmin: false },
    ]
  },
  // النظام الذكي والأمان - للمسؤولين فقط
  {
    category: "الأمان والمراقبة",
    pages: [
      { path: "/security-policies", icon: Shield, label: "السياسات الأمنية", description: "إدارة السياسات الأمنية والامتثال", requireAdmin: true },
      { path: "/smart-errors", icon: Database, label: "كشف الأخطاء الذكي", description: "مراقبة وتحليل أخطاء قاعدة البيانات بذكاء اصطناعي", requireAdmin: true },
    ]
  },
  // الإعدادات والإدارة - للمسؤولين فقط
  {
    category: "الإعدادات والإدارة",
    pages: [
      { path: "/autocomplete-admin", icon: Wrench, label: "إعدادات الإكمال التلقائي", description: "إدارة بيانات الإكمال التلقائي", requireAdmin: true },
      { path: "/admin-notifications", icon: Bell, label: "إشعارات المسؤولين", description: "إدارة وإرسال إشعارات للمستخدمين", requireAdmin: true },
    ]
  }
];

export default function BottomNavigation() {
  const [location, setLocation] = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user } = useAuth();
  
  // فلترة الصفحات حسب دور المستخدم
  const isAdmin = user?.role === 'admin';
  const allPages = allPagesData.map(category => ({
    ...category,
    pages: category.pages.filter(page => !page.requireAdmin || isAdmin)
  })).filter(category => category.pages.length > 0);

  const handlePageNavigation = (path: string) => {
    setLocation(path);
    setIsMenuOpen(false);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-primary/95 backdrop-blur-sm border-t border-primary-foreground/20 z-[100] shadow-lg">
      <div className="grid grid-cols-5 h-16">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path;
          
          return (
            <Button
              key={item.key}
              variant="ghost"
              className={`flex flex-col items-center justify-center space-y-1 h-full rounded-none ${
                isActive ? "text-primary-foreground bg-primary-foreground/10" : "text-primary-foreground/70 hover:text-primary-foreground"
              }`}
              onClick={() => setLocation(item.path)}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs">{item.label}</span>
            </Button>
          );
        })}
        
        {/* زر المزيد */}
        <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              className="flex flex-col items-center justify-center space-y-1 h-full rounded-none text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
            >
              <MoreHorizontal className="h-5 w-5" />
              <span className="text-xs">المزيد</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[85vh] max-w-full px-3">
            <SheetHeader className="mb-4 px-1">
              <SheetTitle className="text-right text-lg">جميع الصفحات</SheetTitle>
            </SheetHeader>
            
            <ScrollArea className="h-full">
              <div className="space-y-3 pb-20 px-1">
                {allPages.map((category, categoryIndex) => (
                  <div key={categoryIndex} className="w-full">
                    <h3 className="font-semibold text-sm mb-2 text-primary text-right border-b border-border pb-1 pr-2 truncate">
                      {category.category}
                    </h3>
                    <div className="space-y-1">
                      {category.pages.map((page, pageIndex) => {
                        const Icon = page.icon;
                        const isActive = location === page.path;
                        
                        return (
                          <Button
                            key={pageIndex}
                            variant={isActive ? "default" : "ghost"}
                            className="w-full justify-start h-auto p-3 min-h-[60px] text-right"
                            onClick={() => handlePageNavigation(page.path)}
                          >
                            <div className="flex items-start gap-3 w-full text-right">
                              <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${isActive ? 'text-primary-foreground' : 'text-primary'}`} />
                              <div className="flex-1 min-w-0 text-right overflow-hidden">
                                <div className={`font-medium text-sm leading-snug text-right truncate ${isActive ? 'text-primary-foreground' : ''}`}>
                                  {page.label}
                                </div>
                                <div className={`text-xs mt-1 leading-tight text-right break-words hyphens-auto ${isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'}`} style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}>
                                  {page.description}
                                </div>
                              </div>
                            </div>
                          </Button>
                        );
                      })}
                    </div>
                    {categoryIndex < allPages.length - 1 && (
                      <Separator className="my-3" />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
