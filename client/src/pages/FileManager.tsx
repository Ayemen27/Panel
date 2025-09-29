
import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Folder,
  File as FileIcon,
  Search,
  Grid3X3,
  List,
  RefreshCw,
  ChevronRight,
  Home,
  AlertTriangle,
  FolderOpen,
  Star,
  Clock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

interface UnifiedFileInfo {
  name: string;
  type: 'file' | 'directory';
  path: string;
  absolutePath: string;
  size: number;
  permissions: string;
  owner?: string;
  created: string;
  modified: string;
  isHidden: boolean;
  extension?: string;
  mimeType?: string;
}

interface DirectoryListing {
  path: string;
  items: UnifiedFileInfo[];
  totalFiles: number;
  totalDirectories: number;
  totalSize: number;
}

interface BreadcrumbItem {
  id: string;
  name: string;
  path: string;
}

type TabType = 'files' | 'favorites' | 'recent';

export default function FileManager() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [currentPath, setCurrentPath] = useState<string>('/home/administrator');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('files');
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: 'root', name: 'الرئيسية', path: '/home/administrator' }
  ]);

  // Fetch files using ONLY unified API
  const { 
    data: directoryData, 
    isLoading, 
    error, 
    refetch 
  } = useQuery<DirectoryListing>({
    queryKey: ['unified-files-browse', currentPath],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/unified-files/browse', {
        path: currentPath
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'فشل في تحميل محتويات المجلد');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'فشل في تحميل محتويات المجلد');
      }

      return result.data;
    },
    enabled: !!currentPath,
    retry: 2,
    staleTime: 30 * 1000,
  });

  const currentFiles = useMemo(() => {
    if (!directoryData?.items) return [];

    let files = directoryData.items;

    // Apply tab filter
    if (activeTab === 'favorites') {
      const favoriteExtensions = new Set(['jpg', 'png', 'pdf', 'txt', 'doc', 'docx']);
      files = files.filter(file => {
        if (file.type !== 'file') return false;
        const ext = (file.extension || '').toLowerCase().replace(/^\./, '');
        return favoriteExtensions.has(ext);
      });
    } else if (activeTab === 'recent') {
      files = [...files]
        .filter(file => file.type === 'file')
        .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime())
        .slice(0, 50);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      files = files.filter(file => 
        file.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return files.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name, 'ar');
    });
  }, [directoryData, searchQuery, activeTab]);

  const handleFolderClick = useCallback((item: UnifiedFileInfo) => {
    if (item.type === 'directory') {
      setCurrentPath(item.absolutePath);
      setBreadcrumbs(prev => [...prev, { 
        id: `path-${item.absolutePath}-${Date.now()}`, 
        name: item.name, 
        path: item.absolutePath 
      }]);
    }
  }, []);

  const handleBreadcrumbClick = useCallback((index: number) => {
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    const targetBreadcrumb = newBreadcrumbs[newBreadcrumbs.length - 1];
    setBreadcrumbs(newBreadcrumbs);
    setCurrentPath(targetBreadcrumb.path);
  }, [breadcrumbs]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const FileItem = ({ item }: { item: UnifiedFileInfo }) => {
    const Icon = item.type === 'directory' ? Folder : FileIcon;

    const handleClick = () => {
      if (item.type === 'directory') {
        handleFolderClick(item);
      } else {
        toast({
          title: item.name,
          description: `الحجم: ${formatFileSize(item.size)} | تم التعديل: ${formatDate(item.modified)}`,
        });
      }
    };

    if (viewMode === 'grid') {
      return (
        <Card className="p-4 cursor-pointer transition-all hover:shadow-md" onClick={handleClick}>
          <div className="flex flex-col items-center gap-3">
            <Icon className="w-8 h-8 text-muted-foreground" />
            <div className="text-center w-full">
              <p className="font-medium text-sm truncate max-w-[120px] mx-auto" title={item.name}>
                {item.name}
              </p>
              <div className="flex flex-col gap-1 mt-2">
                <Badge variant="outline" className="text-xs mx-auto">
                  {item.type === 'directory' ? 'مجلد' : formatFileSize(item.size)}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDate(item.modified)}
                </p>
              </div>
            </div>
          </div>
        </Card>
      );
    }

    return (
      <div className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all hover:bg-muted/50" onClick={handleClick}>
        <Icon className="w-4 h-4 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{item.name}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{item.type === 'directory' ? 'مجلد' : formatFileSize(item.size)}</span>
            <span>{formatDate(item.modified)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 w-full h-full flex flex-col bg-background text-foreground z-50">
      {/* Header */}
      <div className="bg-gray-900 text-white p-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="h-10 w-10 p-0 text-white hover:bg-white/20">
              <Search className="w-5 h-5" />
            </Button>
          </div>
          <h1 className="text-xl font-semibold">مدير الملفات +</h1>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-10 w-10 p-0 text-white hover:bg-white/20"
              onClick={() => setLocation('/')}
            >
              <Home className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center justify-center gap-8 mt-4 border-t border-white/20 pt-4">
          <button
            onClick={() => setActiveTab('files')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg transition-all",
              activeTab === 'files' 
                ? "bg-white/20 text-white" 
                : "text-white/70 hover:text-white hover:bg-white/10"
            )}
          >
            <Folder className="w-5 h-5" />
            <span>الملفات</span>
          </button>
          <button
            onClick={() => setActiveTab('favorites')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg transition-all",
              activeTab === 'favorites' 
                ? "bg-white/20 text-white" 
                : "text-white/70 hover:text-white hover:bg-white/10"
            )}
          >
            <Star className="w-5 h-5" />
            <span>المفضلة</span>
          </button>
          <button
            onClick={() => setActiveTab('recent')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg transition-all",
              activeTab === 'recent' 
                ? "bg-white/20 text-white" 
                : "text-white/70 hover:text-white hover:bg-white/10"
            )}
          >
            <Clock className="w-5 h-5" />
            <span>الحديثة</span>
          </button>
        </div>
      </div>

      {/* Breadcrumbs and Search */}
      <div className="border-b border-border bg-card p-4 flex-shrink-0">
        <div className="flex items-center gap-2 mb-4 overflow-x-auto">
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.id} className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-1 text-sm font-normal whitespace-nowrap"
                onClick={() => handleBreadcrumbClick(index)}
              >
                {index === 0 ? <Home className="w-4 h-4" /> : crumb.name}
              </Button>
              {index < breadcrumbs.length - 1 && (
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="البحث في الملفات..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10 h-10 text-sm"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          >
            {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid3X3 className="w-4 h-4" />}
          </Button>
        </div>

        {directoryData && (
          <div className="mt-4 p-3 bg-muted/30 rounded-lg">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground gap-1">
              <div className="flex items-center gap-4 flex-wrap">
                <span>المسار: {currentPath}</span>
                <span>إجمالي {directoryData.totalFiles} ملف</span>
                <span>{directoryData.totalDirectories} مجلد</span>
              </div>
              <div>
                إجمالي الحجم: {formatFileSize(directoryData.totalSize)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
              <span className="mr-2 text-muted-foreground">جاري التحميل...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-4">
              <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
              <h3 className="text-lg font-medium text-red-600 mb-2">خطأ في تحميل الملفات</h3>
              <p className="text-sm text-muted-foreground max-w-sm">{error.message}</p>
              <Button onClick={() => refetch()} className="mt-4">
                <RefreshCw className="w-4 h-4 mr-2" />
                إعادة المحاولة
              </Button>
            </div>
          ) : currentFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-4">
              <FolderOpen className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">لا توجد ملفات</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {searchQuery ? 'لم يتم العثور على ملفات تطابق البحث' : 'هذا المجلد فارغ'}
              </p>
            </div>
          ) : (
            <div className="p-4">
              <div className={cn(
                viewMode === 'grid' 
                  ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
                  : "space-y-1"
              )}>
                {currentFiles.map((item, index) => (
                  <FileItem key={`${item.absolutePath}-${index}`} item={item} />
                ))}
              </div>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
