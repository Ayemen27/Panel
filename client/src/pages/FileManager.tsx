
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
  Edit,
  Trash2,
  Copy,
  Move,
  CheckSquare,
  Square,
} from "lucide-react";
import { FileIconComponent } from "@/components/FileManager/FileIcon";
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
  
  // حالات وضع الاختيار المتعدد
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([
    'كشف ايا',
    'خيار',
    'ايار',
    'v4',
    'كشف'
  ]);
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

  // وضع الاختيار المتعدد
  const enterSelectionMode = useCallback((item: UnifiedFileInfo) => {
    setSelectionMode(true);
    setSelectedItems(new Set([item.absolutePath]));
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedItems(new Set());
  }, []);

  const toggleItemSelection = useCallback((item: UnifiedFileInfo) => {
    if (!selectionMode) return;
    
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(item.absolutePath)) {
        newSet.delete(item.absolutePath);
        if (newSet.size === 0) {
          setSelectionMode(false);
        }
      } else {
        newSet.add(item.absolutePath);
      }
      return newSet;
    });
  }, [selectionMode]);

  const selectAllItems = useCallback(() => {
    const allPaths = new Set(currentFiles.map(file => file.absolutePath));
    setSelectedItems(allPaths);
  }, [currentFiles]);

  const handleFolderClick = useCallback((item: UnifiedFileInfo) => {
    if (selectionMode) {
      toggleItemSelection(item);
      return;
    }
    
    if (item.type === 'directory') {
      setCurrentPath(item.absolutePath);
      setBreadcrumbs(prev => [...prev, { 
        id: `path-${item.absolutePath}-${Date.now()}`, 
        name: item.name, 
        path: item.absolutePath 
      }]);
    }
  }, [selectionMode, toggleItemSelection]);

  const handleBreadcrumbClick = useCallback((index: number) => {
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    const targetBreadcrumb = newBreadcrumbs[newBreadcrumbs.length - 1];
    setBreadcrumbs(newBreadcrumbs);
    setCurrentPath(targetBreadcrumb.path);
    exitSelectionMode();
  }, [breadcrumbs, exitSelectionMode]);

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

  const handleSearch = (query: string) => {
    if (query.trim() && !searchSuggestions.includes(query.trim())) {
      setSearchSuggestions(prev => [query.trim(), ...prev.slice(0, 4)]);
    }
    setSearchQuery(query);
    setSearchOpen(false);
    exitSelectionMode();
  };

  const removeSuggestion = (suggestion: string) => {
    setSearchSuggestions(prev => prev.filter(s => s !== suggestion));
  };

  // عمليات الملفات
  const createNewFile = async () => {
    try {
      const fileName = prompt('اسم الملف الجديد:');
      if (!fileName) return;

      const fullPath = `${currentPath}/${fileName}`.replace(/\/+/g, '/');

      const response = await apiRequest('POST', '/api/unified-files/create-file', {
        path: fullPath,
        content: '',
        options: { overwrite: false }
      });

      if (response.ok) {
        toast({
          title: 'تم إنشاء الملف',
          description: `تم إنشاء الملف ${fileName} بنجاح`,
        });
        refetch();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'فشل في إنشاء الملف');
      }
    } catch (error) {
      console.error('Create file error:', error);
      toast({
        title: 'خطأ',
        description: error instanceof Error ? error.message : 'فشل في إنشاء الملف',
        variant: 'destructive',
      });
    }
  };

  const createNewFolder = async () => {
    try {
      const folderName = prompt('اسم المجلد الجديد:');
      if (!folderName) return;

      const fullPath = `${currentPath}/${folderName}`.replace(/\/+/g, '/');

      const response = await apiRequest('POST', '/api/unified-files/create-directory', {
        path: fullPath,
        options: { recursive: false }
      });

      if (response.ok) {
        toast({
          title: 'تم إنشاء المجلد',
          description: `تم إنشاء المجلد ${folderName} بنجاح`,
        });
        refetch();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'فشل في إنشاء المجلد');
      }
    } catch (error) {
      console.error('Create folder error:', error);
      toast({
        title: 'خطأ',
        description: error instanceof Error ? error.message : 'فشل في إنشاء المجلد',
        variant: 'destructive',
      });
    }
  };

  const deleteSelectedItems = async () => {
    if (selectedItems.size === 0) return;
    
    try {
      const itemsToDelete = Array.from(selectedItems);
      const confirmed = confirm(`هل أنت متأكد من حذف ${itemsToDelete.length} عنصر؟`);
      if (!confirmed) return;

      for (const itemPath of itemsToDelete) {
        const response = await apiRequest('DELETE', '/api/unified-files/delete', {
          path: itemPath
        });

        if (!response.ok) {
          throw new Error(`فشل في حذف ${itemPath}`);
        }
      }

      toast({
        title: 'تم الحذف',
        description: `تم حذف ${itemsToDelete.length} عنصر بنجاح`,
      });
      exitSelectionMode();
      refetch();
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'فشل في حذف بعض العناصر',
        variant: 'destructive',
      });
    }
  };

  const deleteItem = async (item: UnifiedFileInfo) => {
    try {
      const confirmed = confirm(`هل أنت متأكد من حذف ${item.name}؟`);
      if (!confirmed) return;

      const response = await apiRequest('DELETE', '/api/unified-files/delete', {
        path: item.absolutePath
      });

      if (response.ok) {
        toast({
          title: 'تم الحذف',
          description: `تم حذف ${item.name} بنجاح`,
        });
        refetch();
      } else {
        throw new Error('فشل في الحذف');
      }
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'فشل في حذف العنصر',
        variant: 'destructive',
      });
    }
  };

  const renameItem = async (item: UnifiedFileInfo) => {
    try {
      const newName = prompt('الاسم الجديد:', item.name);
      if (!newName || newName === item.name) return;

      const response = await apiRequest('POST', '/api/unified-files/rename', {
        oldPath: item.absolutePath,
        newName
      });

      if (response.ok) {
        toast({
          title: 'تم التعديل',
          description: `تم تغيير اسم ${item.name} إلى ${newName}`,
        });
        refetch();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'فشل في إعادة التسمية');
      }
    } catch (error) {
      console.error('Rename error:', error);
      toast({
        title: 'خطأ',
        description: error instanceof Error ? error.message : 'فشل في تعديل الاسم',
        variant: 'destructive',
      });
    }
  };

  const copySelectedItems = async () => {
    // تنفيذ عملية النسخ
    toast({
      title: 'نسخ',
      description: `تم نسخ ${selectedItems.size} عنصر`,
    });
    exitSelectionMode();
  };

  const moveSelectedItems = async () => {
    // تنفيذ عملية النقل
    toast({
      title: 'نقل',
      description: `تم نقل ${selectedItems.size} عنصر`,
    });
    exitSelectionMode();
  };

  // Contextual Action Bar
  const ContextualActionBar = () => {
    if (!selectionMode) return null;

    return (
      <div className="bg-blue-600 text-white flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={exitSelectionMode}
            className="h-8 w-8 p-0 text-white hover:bg-white/20"
          >
            <X className="w-4 h-4" />
          </Button>
          <span className="font-medium">
            {selectedItems.size} عنصر محدد
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={selectAllItems}
            className="h-8 px-3 text-white hover:bg-white/20"
          >
            تحديد الكل
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={copySelectedItems}
            className="h-8 w-8 p-0 text-white hover:bg-white/20"
          >
            <Copy className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={moveSelectedItems}
            className="h-8 w-8 p-0 text-white hover:bg-white/20"
          >
            <Move className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={deleteSelectedItems}
            className="h-8 w-8 p-0 text-white hover:bg-white/20"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  };

  const FileItem = ({ item }: { item: UnifiedFileInfo }) => {
    const isSelected = selectedItems.has(item.absolutePath);

    const handleClick = () => {
      if (selectionMode) {
        toggleItemSelection(item);
        return;
      }
      
      if (item.type === 'directory') {
        handleFolderClick(item);
      } else {
        toast({
          title: item.name,
          description: `الحجم: ${formatFileSize(item.size)} | تم التعديل: ${formatDate(item.modified)}`,
        });
      }
    };

    const handleLongPress = (e: React.TouchStart | React.MouseEvent) => {
      if (selectionMode) return;
      
      if ('touches' in e) {
        // Touch event
        const timer = setTimeout(() => {
          enterSelectionMode(item);
        }, 500);
        setLongPressTimer(timer);
      } else {
        // Mouse event (for testing on desktop)
        const timer = setTimeout(() => {
          enterSelectionMode(item);
        }, 500);
        setLongPressTimer(timer);
      }
    };

    const handleTouchEnd = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        setLongPressTimer(null);
      }
    };

    const handleMouseUp = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        setLongPressTimer(null);
      }
    };

    if (viewMode === 'grid') {
      return (
        <Card 
          className={cn(
            "p-4 cursor-pointer transition-all hover:shadow-md hover:scale-105 group relative",
            isSelected && "ring-2 ring-blue-500 bg-blue-50",
            selectionMode && "hover:bg-blue-50"
          )}
          onClick={handleClick}
          onTouchStart={handleLongPress}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleLongPress}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* مؤشر الاختيار */}
          {selectionMode && (
            <div className="absolute top-2 left-2 z-10">
              {isSelected ? (
                <CheckSquare className="w-5 h-5 text-blue-600" />
              ) : (
                <Square className="w-5 h-5 text-gray-400" />
              )}
            </div>
          )}
          
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <FileIconComponent 
                type={item.type}
                extension={item.extension}
                name={item.name}
                className="w-16 h-16"
              />
              {!selectionMode && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute -top-1 -right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity bg-background border border-border"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => renameItem(item)}>
                      <Edit className="w-4 h-4 mr-2" />
                      إعادة تسمية
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => deleteItem(item)}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      حذف
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <div className="text-center w-full">
              <p className="font-medium text-sm truncate max-w-[140px] mx-auto mb-1" title={item.name}>
                {item.name}
              </p>
              <div className="flex flex-col gap-1">
                <Badge variant="outline" className="text-xs mx-auto px-2 py-1 bg-white">
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
      <div 
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all hover:bg-muted/50 hover:shadow-sm group relative",
          isSelected && "bg-blue-50 ring-1 ring-blue-500",
          selectionMode && "hover:bg-blue-50"
        )}
        onClick={handleClick}
        onTouchStart={handleLongPress}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleLongPress}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* مؤشر الاختيار */}
        {selectionMode && (
          <div className="flex-shrink-0">
            {isSelected ? (
              <CheckSquare className="w-5 h-5 text-blue-600" />
            ) : (
              <Square className="w-5 h-5 text-gray-400" />
            )}
          </div>
        )}
        
        <FileIconComponent 
          type={item.type}
          extension={item.extension}
          name={item.name}
          className="w-6 h-6 flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{item.name}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{item.type === 'directory' ? 'مجلد' : formatFileSize(item.size)}</span>
            <span>{formatDate(item.modified)}</span>
          </div>
        </div>
        
        {!selectionMode && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => renameItem(item)}>
                <Edit className="w-4 h-4 mr-2" />
                إعادة تسمية
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => deleteItem(item)}>
                <Trash2 className="w-4 h-4 mr-2" />
                حذف
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
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
                exitSelectionMode();
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
                exitSelectionMode();
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
                exitSelectionMode();
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

      {/* Search Modal */}
      {searchOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-60 flex flex-col">
          <div className="bg-gray-900 text-white p-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchOpen(false)}
                className="h-8 w-8 p-0 text-white hover:bg-white/20"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="flex-1 relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="بحث"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch(searchQuery);
                    }
                  }}
                  className="w-full pr-12 h-12 text-lg bg-transparent border-0 border-b-2 border-cyan-400 text-white placeholder:text-gray-400 rounded-none focus:ring-0 focus:border-cyan-300"
                  autoFocus
                />
              </div>
            </div>
          </div>
          
          <div className="flex-1 bg-gray-800 overflow-y-auto">
            {searchSuggestions.length > 0 && (
              <div className="p-4">
                <div className="space-y-1">
                  {searchSuggestions.map((suggestion, index) => (
                    <div key={index} className="flex items-center justify-between p-3 hover:bg-gray-700 rounded-lg transition-colors">
                      <div className="flex items-center gap-3">
                        <Clock className="w-5 h-5 text-gray-400" />
                        <span className="text-white text-lg">{suggestion}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSearch(suggestion)}
                          className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-600"
                        >
                          <Search className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSuggestion(suggestion)}
                          className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Contextual Action Bar */}
        <ContextualActionBar />

        {/* Enhanced Main Header Bar */}
        <div className={cn(
          "bg-gray-900 text-white flex-shrink-0",
          selectionMode && "hidden"
        )}>
          {/* Main Header */}
          <div className="px-4 py-2 flex items-center justify-between">
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
              {/* Search */}
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

              <MoreVertical className="w-4 h-4" />
            </div>
          </div>

          {/* Compact Breadcrumbs Bar */}
          <div className="bg-gray-800/50 px-4 py-2 border-t border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 overflow-x-auto">
                {breadcrumbs.map((crumb, index) => (
                  <div key={crumb.id} className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs font-normal whitespace-nowrap text-white/80 hover:text-white hover:bg-white/10"
                      onClick={() => handleBreadcrumbClick(index)}
                    >
                      {index === 0 ? <Home className="w-3 h-3" /> : crumb.name}
                    </Button>
                    {index < breadcrumbs.length - 1 && (
                      <ChevronRight className="w-3 h-3 text-white/40 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
              {directoryData && (
                <div className="text-xs text-white/60 flex-shrink-0 ml-4">
                  {directoryData.totalFiles} ملف • {directoryData.totalDirectories} مجلد
                </div>
              )}
            </div>
          </div>
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
                    ? "grid grid-cols-2 gap-3"
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
