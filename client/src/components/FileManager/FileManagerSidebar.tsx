
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Folder,
  Star,
  Clock,
  Home,
  Trash2,
  HardDrive,
  Download,
  Upload,
  Settings,
  X,
  ChevronRight
} from "lucide-react";

interface FileManagerSidebarProps {
  open: boolean;
  onClose: () => void;
  activeTab: 'files' | 'favorites' | 'recent';
  onTabChange: (tab: 'files' | 'favorites' | 'recent') => void;
  currentPath: string;
  onNavigate: (path: string) => void;
}

const quickAccessItems = [
  { id: 'home', name: 'الرئيسية', path: '/home/administrator', icon: Home },
  { id: 'downloads', name: 'التنزيلات', path: '/home/administrator/Downloads', icon: Download },
  { id: 'uploads', name: 'الرفوعات', path: '/uploads', icon: Upload },
];

const storageItems = [
  { id: 'internal', name: 'التخزين الداخلي', size: '32 جيجا', used: '24 جيجا', icon: HardDrive },
  { id: 'external', name: 'تخزين خارجي', size: '64 جيجا', used: '12 جيجا', icon: HardDrive },
];

export function FileManagerSidebar({ 
  open, 
  onClose, 
  activeTab, 
  onTabChange, 
  currentPath,
  onNavigate 
}: FileManagerSidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside 
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-80 bg-white border-l border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0",
          open ? "translate-x-0" : "translate-x-full",
          "lg:static lg:z-auto"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">مدير الملفات</h2>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClose}
              className="lg:hidden"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-6">
              {/* التبويبات الرئيسية */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-500 mb-3">التصفح</h3>
                
                <button
                  onClick={() => onTabChange('files')}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-right rounded-lg transition-colors",
                    activeTab === 'files' 
                      ? "bg-blue-100 text-blue-700 font-medium" 
                      : "hover:bg-gray-100 text-gray-700"
                  )}
                >
                  <Folder className="w-5 h-5" />
                  <span>الملفات</span>
                  <ChevronRight className="w-4 h-4 mr-auto" />
                </button>

                <button
                  onClick={() => onTabChange('favorites')}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-right rounded-lg transition-colors",
                    activeTab === 'favorites' 
                      ? "bg-blue-100 text-blue-700 font-medium" 
                      : "hover:bg-gray-100 text-gray-700"
                  )}
                >
                  <Star className="w-5 h-5" />
                  <span>المفضلة</span>
                  <ChevronRight className="w-4 h-4 mr-auto" />
                </button>

                <button
                  onClick={() => onTabChange('recent')}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-right rounded-lg transition-colors",
                    activeTab === 'recent' 
                      ? "bg-blue-100 text-blue-700 font-medium" 
                      : "hover:bg-gray-100 text-gray-700"
                  )}
                >
                  <Clock className="w-5 h-5" />
                  <span>الحديثة</span>
                  <ChevronRight className="w-4 h-4 mr-auto" />
                </button>
              </div>

              {/* الوصول السريع */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-500 mb-3">الوصول السريع</h3>
                {quickAccessItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onNavigate(item.path)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 text-right rounded-lg transition-colors hover:bg-gray-100 text-gray-700",
                        currentPath === item.path && "bg-blue-100 text-blue-700 font-medium"
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* التخزين */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-500 mb-3">التخزين</h3>
                {storageItems.map((item) => {
                  const Icon = item.icon;
                  const usedPercent = (parseInt(item.used) / parseInt(item.size)) * 100;
                  
                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-lg border border-gray-200 bg-gray-50"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <Icon className="w-5 h-5 text-gray-600" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{item.name}</p>
                          <p className="text-xs text-gray-500">{item.used} من {item.size}</p>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${usedPercent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* سلة المحذوفات */}
              <div className="space-y-2">
                <button
                  onClick={() => onNavigate('/trash')}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-right rounded-lg transition-colors hover:bg-gray-100 text-gray-700"
                >
                  <Trash2 className="w-5 h-5" />
                  <span>سلة المحذوفات</span>
                </button>
              </div>

              {/* الإعدادات */}
              <div className="space-y-2 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {}}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-right rounded-lg transition-colors hover:bg-gray-100 text-gray-700"
                >
                  <Settings className="w-5 h-5" />
                  <span>إعدادات مدير الملفات</span>
                </button>
              </div>
            </div>
          </ScrollArea>
        </div>
      </aside>
    </>
  );
}
