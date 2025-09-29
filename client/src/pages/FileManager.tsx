
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
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
  ArrowLeft,
  X,
  Plus,
  Filter,
  SortAsc,
  SortDesc,
  Calendar,
  HardDrive,
  FileType,
  Menu,
  MoreVertical,
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
type SortBy = 'name' | 'size' | 'date' | 'type';
type SortOrder = 'asc' | 'desc';

export default function FileManager() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [currentPath, setCurrentPath] = useState<string>('/home/administrator');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('files');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [showHidden, setShowHidden] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
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

    // Apply hidden files filter
    if (!showHidden) {
      files = files.filter(file => !file.isHidden);
    }

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

    // Apply sorting
    files = [...files].sort((a, b) => {
      // Always put directories first unless sorting by type
      if (sortBy !== 'type' && a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }

      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name, 'ar');
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'date':
          comparison = new Date(a.modified).getTime() - new Date(b.modified).getTime();
          break;
        case 'type':
          if (a.type !== b.type) {
            comparison = a.type === 'directory' ? -1 : 1;
          } else {
            comparison = a.name.localeCompare(b.name, 'ar');
          }
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return files;
  }, [directoryData, searchQuery, activeTab, sortBy, sortOrder, showHidden]);

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
        day: '2-digit'
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
        <Card className="p-3 cursor-pointer transition-all hover:shadow-md" onClick={handleClick}>
          <div className="flex flex-col items-center gap-2">
            <Icon className="w-8 h-8 text-muted-foreground" />
            <div className="text-center w-full">
              <p className="font-medium text-xs truncate max-w-[100px] mx-auto" title={item.name}>
                {item.name}
              </p>
              <div className="flex flex-col gap-1 mt-1">
                <Badge variant="outline" className="text-xs mx-auto px-1 py-0">
                  {item.type === 'directory' ? 'مجلد' : formatFileSize(item.size)}
                </Badge>
                <p className="text-xs text-muted-foreground">
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
        <Icon className="w-5 h-5 flex-shrink-0" />
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
    <div className="fixed inset-0 w-full h-full flex bg-background text-foreground z-50">
      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 right-0 w-64 bg-card border-l border-border transform transition-transform duration-300 z-50",
        sidebarOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">مدير الملفات</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="p-4 space-y-2">
            <button
              onClick={() => {
                setActiveTab('files');
                setSidebarOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-right",
                activeTab === 'files' 
                  ? "bg-primary text-primary-foreground" 
                  : "hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Folder className="w-5 h-5" />
              <span>الملفات</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('favorites');
                setSidebarOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-right",
                activeTab === 'favorites' 
                  ? "bg-primary text-primary-foreground" 
                  : "hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Star className="w-5 h-5" />
              <span>المفضلة</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('recent');
                setSidebarOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-right",
                activeTab === 'recent' 
                  ? "bg-primary text-primary-foreground" 
                  : "hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Clock className="w-5 h-5" />
              <span>الحديثة</span>
            </button>
          </div>

          {/* Quick Actions */}
          <div className="p-4 border-t border-border">
            <h3 className="text-sm font-medium mb-3">إجراءات سريعة</h3>
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => setLocation('/')}
              >
                <Home className="w-4 h-4 mr-2" />
                العودة للرئيسية
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => refetch()}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                تحديث
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Enhanced Header with Search and Filters */}
        <div className="bg-gray-900 text-white p-3 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(true)}
                className="h-8 w-8 p-0 text-white hover:bg-white/20"
              >
                <Menu className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation('/')}
                className="h-8 w-8 p-0 text-white hover:bg-white/20"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </div>
            
            <h1 className="text-lg font-semibold">التخزين الرئيسي</h1>
            
            <div className="flex items-center gap-2">
              {/* Plus Button with Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-white hover:bg-white/20"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem>
                    <FileIcon className="w-4 h-4 mr-2" />
                    ملف جديد
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Folder className="w-4 h-4 mr-2" />
                    مجلد جديد
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <MoreVertical className="w-4 h-4" />
            </div>
          </div>

          {/* Search Bar and Filters Row */}
          <div className="flex items-center gap-2">
            {/* Search Toggle */}
            {!searchOpen ? (
              <div className="flex items-center gap-2">
                {/* Search Icon */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchOpen(true)}
                  className="h-8 w-8 p-0 text-white hover:bg-white/20"
                >
                  <Search className="w-4 h-4" />
                </Button>

                {/* Sort/Filter Button */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-white hover:bg-white/20"
                    >
                      <Filter className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <div className="px-2 py-1.5 text-sm font-semibold">فرز حسب</div>
                    <DropdownMenuRadioGroup value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
                      const [newSortBy, newSortOrder] = value.split('-') as [SortBy, SortOrder];
                      setSortBy(newSortBy);
                      setSortOrder(newSortOrder);
                    }}>
                      <DropdownMenuRadioItem value="name-asc">
                        <SortAsc className="w-4 h-4 mr-2" />
                        الاسم ▲
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="name-desc">
                        <SortDesc className="w-4 h-4 mr-2" />
                        الاسم ▼
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="size-asc">
                        <HardDrive className="w-4 h-4 mr-2" />
                        الحجم ▲
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="size-desc">
                        <HardDrive className="w-4 h-4 mr-2" />
                        الحجم ▼
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="date-asc">
                        <Calendar className="w-4 h-4 mr-2" />
                        التاريخ ▲
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="date-desc">
                        <Calendar className="w-4 h-4 mr-2" />
                        التاريخ ▼
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="type-asc">
                        <FileType className="w-4 h-4 mr-2" />
                        النوع ▲
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="type-desc">
                        <FileType className="w-4 h-4 mr-2" />
                        النوع ▼
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setShowHidden(!showHidden)}>
                      {showHidden ? '✓' : '○'} إظهار الملفات المخفية
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* View Mode Toggle */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                  className="h-8 w-8 p-0 text-white hover:bg-white/20"
                >
                  {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid3X3 className="w-4 h-4" />}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-1">
                {/* Search Input */}
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="البحث..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-10 h-8 text-sm bg-white/10 border-white/20 text-white placeholder:text-gray-400"
                    autoFocus
                  />
                </div>
                
                {/* Cancel Search */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchQuery('');
                  }}
                  className="h-8 w-8 p-0 text-white hover:bg-white/20"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Breadcrumbs */}
        <div className="border-b border-border bg-card p-3 flex-shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto">
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

          {directoryData && (
            <div className="mt-2 text-xs text-muted-foreground">
              {directoryData.totalFiles} ملف, {directoryData.totalDirectories} مجلد
            </div>
          )}
        </div>

        {/* File Content */}
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
              <div className="p-3">
                <div className={cn(
                  viewMode === 'grid' 
                    ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2"
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
    </div>
  );
}
