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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Info,
  Settings,
  Bookmark,
  Upload,
  FolderPlus,
  FilePlus,
  Eye,
  Archive,
  FileText,
  Clock,
} from "lucide-react";
import { FileIconComponent } from "@/components/FileManager/FileIcon";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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

  const [currentPath, setCurrentPath] = useState<string>('/home/administrator');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('files');
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [showHidden, setShowHidden] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // حالات وضع الاختيار المتعدد
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // حالات النوافذ المنبثقة
  const [createFileDialog, setCreateFileDialog] = useState(false);
  const [createFolderDialog, setCreateFolderDialog] = useState(false);
  const [uploadDialog, setUploadDialog] = useState(false);
  const [viewSortDialog, setViewSortDialog] = useState(false);
  const [sortDialog, setSortDialog] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({});

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
    if (item.type === 'directory') {
      setCurrentPath(item.absolutePath);
      setBreadcrumbs(prev => [...prev, { 
        id: `path-${item.absolutePath}-${Date.now()}`, 
        name: item.name, 
        path: item.absolutePath 
      }]);
      
      // إضافة رسالة تأكيد
      toast({
        title: `تم فتح المجلد`,
        description: item.name,
      });
    }
  }, []);

  const handleBreadcrumbClick = useCallback((index: number) => {
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    const targetBreadcrumb = newBreadcrumbs[newBreadcrumbs.length - 1];
    setBreadcrumbs(newBreadcrumbs);
    setCurrentPath(targetBreadcrumb.path);
    exitSelectionMode();
  }, [breadcrumbs, exitSelectionMode]);

  const handleNavigate = useCallback((path: string) => {
    setCurrentPath(path);
    // تحديث مسار التنقل بناءً على المسار الجديد
    const pathParts = path.split('/').filter(Boolean);
    const newBreadcrumbs: BreadcrumbItem[] = [
      { id: 'root', name: 'الرئيسية', path: '/home/administrator' }
    ];

    let currentBuildPath = '/home/administrator';
    for (let i = 3; i < pathParts.length; i++) { // تخطي home/administrator
      currentBuildPath += '/' + pathParts[i];
      newBreadcrumbs.push({
        id: `path-${currentBuildPath}`,
        name: pathParts[i],
        path: currentBuildPath
      });
    }

    setBreadcrumbs(newBreadcrumbs);
    exitSelectionMode();
  }, [exitSelectionMode]);

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
    if (!newFileName.trim()) return;

    try {
      const fullPath = `${currentPath}/${newFileName.trim()}`.replace(/\/+/g, '/');

      const response = await apiRequest('POST', '/api/unified-files/create-file', {
        path: fullPath,
        content: '',
        options: { overwrite: false }
      });

      if (response.ok) {
        toast({
          title: 'تم إنشاء الملف',
          description: `تم إنشاء الملف ${newFileName} بنجاح`,
        });
        setNewFileName('');
        setCreateFileDialog(false);
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
    if (!newFolderName.trim()) return;

    try {
      const fullPath = `${currentPath}/${newFolderName.trim()}`.replace(/\/+/g, '/');

      const response = await apiRequest('POST', '/api/unified-files/create-directory', {
        path: fullPath,
        options: { recursive: false }
      });

      if (response.ok) {
        toast({
          title: 'تم إنشاء المجلد',
          description: `تم إنشاء المجلد ${newFolderName} بنجاح`,
        });
        setNewFolderName('');
        setCreateFolderDialog(false);
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

      let deleteCount = 0;
      let errors = [];

      for (const itemPath of itemsToDelete) {
        try {
          // استخدام query parameter بدلاً من body للـ DELETE request
          const url = `/api/unified-files/delete?path=${encodeURIComponent(itemPath)}`;
          const response = await apiRequest('DELETE', url);

          if (response.ok) {
            const result = await response.json();
            if (result.success) {
              deleteCount++;
            } else {
              errors.push(`${itemPath}: ${result.error}`);
            }
          } else {
            const errorData = await response.json();
            errors.push(`${itemPath}: ${errorData.error || 'فشل في الحذف'}`);
          }
        } catch (error) {
          errors.push(`${itemPath}: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
        }
      }

      if (deleteCount > 0) {
        toast({
          title: 'تم الحذف',
          description: `تم حذف ${deleteCount} عنصر بنجاح`,
        });
      }

      if (errors.length > 0) {
        console.error('Delete errors:', errors);
        toast({
          title: 'خطأ',
          description: `فشل في حذف ${errors.length} عنصر`,
          variant: 'destructive',
        });
      }

      exitSelectionMode();
      refetch();
    } catch (error) {
      console.error('Delete selected items error:', error);
      toast({
        title: 'خطأ',
        description: 'فشل في حذف العناصر المحددة',
        variant: 'destructive',
      });
    }
  };

  const deleteItem = async (item: UnifiedFileInfo) => {
    try {
      const confirmed = confirm(`هل أنت متأكد من حذف ${item.name}؟`);
      if (!confirmed) return;

      // استخدام query parameter بدلاً من body للـ DELETE request
      const url = `/api/unified-files/delete?path=${encodeURIComponent(item.absolutePath)}`;
      const response = await apiRequest('DELETE', url);

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          toast({
            title: 'تم الحذف',
            description: `تم حذف ${item.name} بنجاح`,
          });
          refetch();
        } else {
          throw new Error(result.error || 'فشل في الحذف');
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'فشل في الحذف');
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: 'خطأ',
        description: error instanceof Error ? error.message : 'فشل في حذف العنصر',
        variant: 'destructive',
      });
    }
  };

  // وظائف رفع الملفات
  const uploadFiles = async (files: FileList) => {
    if (!files || files.length === 0) return;

    try {
      const fileArray = Array.from(files);
      const uploadData = [];

      // قراءة جميع الملفات
      for (const file of fileArray) {
        const content = await readFileAsBase64(file);
        uploadData.push({
          name: file.name,
          content,
          size: file.size,
          type: file.type
        });
      }

      const response = await apiRequest('POST', '/api/unified-files/upload', {
        targetPath: currentPath,
        files: uploadData
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          const successCount = result.data.summary.success;
          const failedCount = result.data.summary.failed;
          
          toast({
            title: 'اكتمل الرفع',
            description: `تم رفع ${successCount} ملف بنجاح${failedCount > 0 ? `، وفشل ${failedCount} ملف` : ''}`,
          });
          
          if (failedCount > 0) {
            console.warn('فشل في رفع بعض الملفات:', result.data.failed);
          }
          
          refetch();
        } else {
          throw new Error(result.error || 'فشل في رفع الملفات');
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'فشل في رفع الملفات');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'خطأ',
        description: error instanceof Error ? error.message : 'فشل في رفع الملفات',
        variant: 'destructive',
      });
    } finally {
      setSelectedFiles(null);
      setUploadDialog(false);
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setSelectedFiles(files);
      setUploadDialog(true);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    
    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      setSelectedFiles(files);
      setUploadDialog(true);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const renameItem = async (item: UnifiedFileInfo) => {
    try {
      const newName = prompt('الاسم الجديد:', item.name);
      if (!newName || newName.trim() === '' || newName === item.name) return;

      // تنظيف الاسم من المسارات والأحرف الخاصة
      const cleanName = newName.trim().replace(/[\/\\:*?"<>|]/g, '');
      if (!cleanName) {
        toast({
          title: 'خطأ',
          description: 'اسم الملف يحتوي على أحرف غير صالحة',
          variant: 'destructive',
        });
        return;
      }

      const response = await apiRequest('POST', '/api/unified-files/rename', {
        oldPath: item.absolutePath,
        newName: cleanName
      });

      if (response.ok) {
        toast({
          title: 'تم التعديل',
          description: `تم تغيير اسم ${item.name} إلى ${cleanName}`,
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
    toast({
      title: 'نسخ',
      description: `تم نسخ ${selectedItems.size} عنصر`,
    });
    exitSelectionMode();
  };

  const moveSelectedItems = async () => {
    toast({
      title: 'نقل',
      description: `تم نقل ${selectedItems.size} عنصر`,
    });
    exitSelectionMode();
  };

  // Selection Mode Header
  const SelectionModeHeader = () => {
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
          <span className="font-medium text-lg">
            {selectedItems.size} محدد
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={selectAllItems}
            className="h-8 px-3 text-white hover:bg-white/20 text-sm"
          >
            تحديد الكل
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-white hover:bg-white/20"
          >
            <MoreVertical className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  };

  // Bottom Action Bar for Selection Mode
  const BottomActionBar = () => {
    if (!selectionMode) return null;

    return (
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <div className="flex items-center justify-around px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={copySelectedItems}
            className="flex flex-col items-center gap-1 h-auto p-2 hover:bg-gray-100"
          >
            <Copy className="w-5 h-5" />
            <span className="text-xs">نسخ</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={moveSelectedItems}
            className="flex flex-col items-center gap-1 h-auto p-2 hover:bg-gray-100"
          >
            <Move className="w-5 h-5" />
            <span className="text-xs">نقل</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (selectedItems.size === 1) {
                const selectedFile = currentFiles.find(f => selectedItems.has(f.absolutePath));
                if (selectedFile) renameItem(selectedFile);
              }
            }}
            disabled={selectedItems.size !== 1}
            className="flex flex-col items-center gap-1 h-auto p-2 hover:bg-gray-100 disabled:opacity-50"
          >
            <Edit className="w-5 h-5" />
            <span className="text-xs">إعادة تسمية</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={deleteSelectedItems}
            className="flex flex-col items-center gap-1 h-auto p-2 hover:bg-gray-100 text-red-600"
          >
            <Trash2 className="w-5 h-5" />
            <span className="text-xs">حذف</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="flex flex-col items-center gap-1 h-auto p-2 hover:bg-gray-100"
              >
                <MoreVertical className="w-5 h-5" />
                <span className="text-xs">المزيد</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top" className="w-48 mb-2">
              <DropdownMenuItem>
                <Info className="w-4 h-4 mr-2" />
                تفاصيل
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Bookmark className="w-4 h-4 mr-2" />
                إضافة للمفضلة
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Archive className="w-4 h-4 mr-2" />
                ضغط
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  const FileItem = ({ item }: { item: UnifiedFileInfo }) => {
    const isSelected = selectedItems.has(item.absolutePath);
    const [isLongPressing, setIsLongPressing] = useState(false);
    const [pressTimer, setPressTimer] = useState<NodeJS.Timeout | null>(null);

    // النقر الواحد - فتح الملف/المجلد
    const handleSingleClick = () => {
      if (selectionMode) {
        toggleItemSelection(item);
        return;
      }

      if (item.type === 'directory') {
        handleFolderClick(item);
      } else {
        // فتح الملف أو عرض تفاصيله
        toast({
          title: `تم فتح ${item.name}`,
          description: `الحجم: ${formatFileSize(item.size)} | تم التعديل: ${formatDate(item.modified)}`,
        });
      }
    };

    // بداية الضغط - للنقر المطول
    const handlePressStart = (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault();
      setIsLongPressing(false);
      
      const timer = setTimeout(() => {
        setIsLongPressing(true);
        if (!selectionMode) {
          enterSelectionMode(item);
          // إضافة اهتزاز خفيف للإشارة لدخول وضع التحديد
          if (navigator.vibrate) {
            navigator.vibrate(50);
          }
        }
      }, 500); // 500ms للنقر المطول
      
      setPressTimer(timer);
    };

    // إنهاء الضغط
    const handlePressEnd = () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        setPressTimer(null);
      }
      
      // إذا لم يكن نقراً مطولاً، نفذ النقر العادي
      if (!isLongPressing) {
        setTimeout(() => {
          handleSingleClick();
        }, 10);
      }
      
      setIsLongPressing(false);
    };

    // النقر بالماوس - للنقر العادي فقط
    const handleMouseClick = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      // تجاهل النقر إذا كان هناك ضغط مطول
      if (!isLongPressing && !pressTimer) {
        handleSingleClick();
      }
    };

    if (viewMode === 'grid') {
      return (
        <Card 
          className={cn(
            "p-4 cursor-pointer transition-all hover:shadow-md hover:scale-105 group relative",
            isSelected && "ring-2 ring-blue-500 bg-blue-50",
            selectionMode && "hover:bg-blue-50",
            isLongPressing && "scale-95 transition-transform duration-150"
          )}
          onClick={handleMouseClick}
          onTouchStart={handlePressStart}
          onTouchEnd={handlePressEnd}
          onContextMenu={(e) => {
            e.preventDefault();
            if (!selectionMode) {
              enterSelectionMode(item);
            }
          }}
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
          selectionMode && "hover:bg-blue-50",
          isLongPressing && "bg-gray-100 transition-colors duration-150"
        )}
        onClick={handleMouseClick}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
        onContextMenu={(e) => {
          e.preventDefault();
          if (!selectionMode) {
            enterSelectionMode(item);
          }
        }}
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
                        <Search className="w-5 h-5 text-gray-400" />
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
        {/* Selection Mode Header */}
        <SelectionModeHeader />

        {/* Main Header Bar - Normal Mode */}
        <div className={cn(
          "bg-blue-600 text-white flex-shrink-0",
          selectionMode && "hidden"
        )}>
          {/* Main Header */}
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold">
                {activeTab === 'files' ? 'الملفات' : 
                 activeTab === 'favorites' ? 'المفضلة' : 'الحديثة'}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {/* Search Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchOpen(true)}
                className="h-8 w-8 p-0 text-white hover:bg-white/20"
              >
                <Search className="w-4 h-4" />
              </Button>

              {/* Combined View/Sort Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewSortDialog(true)}
                className="h-8 w-8 p-0 text-white hover:bg-white/20"
                data-testid="button-view-sort-options"
              >
                <Filter className="w-4 h-4" />
              </Button>

              {/* Add Button */}
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
                  <DropdownMenuItem onClick={() => setCreateFileDialog(true)}>
                    <FilePlus className="w-4 h-4 mr-2" />
                    ملف جديد
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCreateFolderDialog(true)}>
                    <FolderPlus className="w-4 h-4 mr-2" />
                    مجلد جديد
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => document.getElementById('file-upload')?.click()}>
                    <Upload className="w-4 h-4 mr-2" />
                    رفع ملف
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              {/* مدخل رفع الملفات المخفي */}
              <input
                id="file-upload"
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />

              {/* More Options */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-white hover:bg-white/20"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => refetch()}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    تحديث
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowHidden(!showHidden)}>
                    <Eye className="w-4 h-4 mr-2" />
                    {showHidden ? 'إخفاء الملفات المخفية' : 'إظهار الملفات المخفية'}
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className="w-4 h-4 mr-2" />
                    الإعدادات
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* شريط المسار النحيف */}
        <div className={cn(
          "bg-gray-100 border-b border-gray-200 px-4 py-2 flex-shrink-0",
          selectionMode && "hidden"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 overflow-x-auto">
              {breadcrumbs.map((crumb, index) => (
                <div key={crumb.id} className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs font-normal whitespace-nowrap text-gray-600 hover:text-gray-900 hover:bg-gray-200"
                    onClick={() => handleBreadcrumbClick(index)}
                  >
                    {index === 0 ? <Home className="w-3 h-3" /> : crumb.name}
                  </Button>
                  {index < breadcrumbs.length - 1 && (
                    <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
            {directoryData && (
              <div className="text-xs text-gray-500 flex-shrink-0 ml-4">
                {directoryData.totalFiles} ملف • {directoryData.totalDirectories} مجلد
              </div>
            )}
          </div>
        </div>

        {/* File Content */}
        <div 
          className={cn(
            "flex-1 min-h-0 overflow-hidden relative",
            selectionMode && "pb-20"
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {/* منطقة السحب والإفلات */}
          {isDragging && (
            <div className="absolute inset-0 bg-blue-500 bg-opacity-20 border-2 border-dashed border-blue-500 flex items-center justify-center z-20">
              <div className="text-center">
                <Upload className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                <p className="text-lg font-medium text-blue-600">قم بإفلات الملفات هنا للرفع</p>
              </div>
            </div>
          )}
          
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
                <Button
                  onClick={() => document.getElementById('file-upload')?.click()}
                  className="mt-4"
                  variant="outline"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  رفع ملف
                </Button>
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

      {/* Bottom Action Bar for Selection Mode */}
      <BottomActionBar />

      {/* Create File Dialog */}
      <Dialog open={createFileDialog} onOpenChange={setCreateFileDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>إنشاء ملف</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="اسم الملف"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  createNewFile();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateFileDialog(false)}>
              إلغاء
            </Button>
            <Button onClick={createNewFile}>
              إنشاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Folder Dialog */}
      <Dialog open={createFolderDialog} onOpenChange={setCreateFolderDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>إنشاء مجلد</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="اسم المجلد"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  createNewFolder();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateFolderDialog(false)}>
              إلغاء
            </Button>
            <Button onClick={createNewFolder}>
              إنشاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Files Dialog */}
      <Dialog open={uploadDialog} onOpenChange={setUploadDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>رفع الملفات</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="mb-4">
              <p className="text-sm text-muted-foreground mb-2">
                سيتم رفع الملفات إلى: <span className="font-medium">{currentPath}</span>
              </p>
            </div>
            
            {selectedFiles && (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                <p className="text-sm font-medium">الملفات المحددة:</p>
                {Array.from(selectedFiles).map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center gap-2">
                      <FileIcon className="w-4 h-4" />
                      <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setUploadDialog(false);
              setSelectedFiles(null);
            }}>
              إلغاء
            </Button>
            <Button onClick={() => selectedFiles && uploadFiles(selectedFiles)}>
              <Upload className="w-4 h-4 mr-2" />
              رفع الملفات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View & Sort Options Bottom Sheet */}
      {viewSortDialog && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-black/50 z-[100]" 
            onClick={() => setViewSortDialog(false)}
          />
          
          {/* Bottom Sheet */}
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-[101] transform transition-transform duration-300 ease-out animate-in slide-in-from-bottom max-h-[70vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-gray-200">
              <h3 className="text-base font-medium text-gray-800">تطبق على جميع المجلدات</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewSortDialog(false)}
                className="h-7 w-7 p-0"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
            
            {/* Content */}
            <div className="p-4 space-y-4">
              {/* View Mode Section */}
              <div>
                <h4 className="text-sm font-medium mb-3 text-right text-blue-600">عرض</h4>
                
                {/* Top Row - 3 icons */}
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="text-center">
                    <button
                      onClick={() => {
                        setViewMode('list');
                        setViewSortDialog(false);
                      }}
                      className={`w-full p-3 rounded-xl border-2 transition-all duration-200 ${
                        viewMode === 'list' 
                          ? 'border-green-500 bg-green-50 shadow-md' 
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                      data-testid="view-mode-list"
                    >
                      <List className="w-6 h-6 mx-auto mb-1 text-gray-700" />
                      <div className="text-xs font-medium text-gray-700">قائمة</div>
                    </button>
                  </div>
                  <div className="text-center">
                    <button
                      onClick={() => {
                        setViewMode('grid');
                        setViewSortDialog(false);
                      }}
                      className={`w-full p-3 rounded-xl border-2 transition-all duration-200 ${
                        viewMode === 'grid' 
                          ? 'border-green-500 bg-green-50 shadow-md' 
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                      data-testid="view-mode-grid"
                    >
                      <Grid3X3 className="w-6 h-6 mx-auto mb-1 text-gray-700" />
                      <div className="text-xs font-medium text-gray-700">شبكة</div>
                    </button>
                  </div>
                  <div className="text-center">
                    <button className="w-full p-3 rounded-xl border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-200">
                      <Grid3X3 className="w-6 h-6 mx-auto mb-1 text-gray-700" />
                      <div className="text-xs font-medium text-gray-700">شبكة كبيرة</div>
                    </button>
                  </div>
                </div>
                
                {/* Bottom Row - 2 icons */}
                <div className="grid grid-cols-2 gap-3 max-w-xs">
                  <div className="text-center">
                    <button className="w-full p-3 rounded-xl border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-200">
                      <Grid3X3 className="w-6 h-6 mx-auto text-gray-700" />
                    </button>
                  </div>
                  <div className="text-center">
                    <button className="w-full p-3 rounded-xl border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-200">
                      <Grid3X3 className="w-6 h-6 mx-auto text-gray-700" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Sort Button */}
              <div className="border-t border-gray-200 pt-3">
                <button
                  onClick={() => {
                    setViewSortDialog(false);
                    setSortDialog(true);
                  }}
                  className="w-full text-right text-blue-600 font-medium py-1.5 hover:text-blue-700 transition-colors"
                  data-testid="button-sort"
                >
                  فرز
                </button>
              </div>

              {/* Other Options */}
              <div className="border-t border-gray-200 pt-3 space-y-3">
                <div className="text-right text-gray-600 font-medium text-sm">
                  غير ذلك
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={showHidden}
                      onChange={(e) => {
                        setShowHidden(e.target.checked);
                        setViewSortDialog(false);
                      }}
                      className="w-4 h-4 accent-green-600 rounded"
                      data-testid="checkbox-show-hidden"
                    />
                  </div>
                  <span className="text-gray-800 font-medium text-sm">إظهار الملفات المخفية</span>
                </div>
              </div>
            </div>
            
            {/* Safe Area for mobile */}
            <div className="h-4"></div>
          </div>
        </>
      )}

      {/* Sort Bottom Sheet */}
      {sortDialog && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-black/50 z-[100]" 
            onClick={() => setSortDialog(false)}
          />
          
          {/* Bottom Sheet */}
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-[101] transform transition-transform duration-300 ease-out animate-in slide-in-from-bottom">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-800">فرز حسب</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSortDialog(false)}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Content */}
            <div className="p-6">
              <div className="space-y-4">
                {[
                  { value: '', label: 'بدون فرز' },
                  { value: 'name-asc', label: 'الاسم ▲' },
                  { value: 'name-desc', label: 'الاسم ▼' },
                  { value: 'size-asc', label: 'الحجم ▲' },
                  { value: 'size-desc', label: 'الحجم ▼' },
                  { value: 'date-asc', label: 'التاريخ ▲' },
                  { value: 'date-desc', label: 'التاريخ ▼' },
                  { value: 'type-asc', label: 'نوع ▲' },
                  { value: 'type-desc', label: 'نوع ▼' },
                ].map((option, index) => {
                  const isSelected = index === 6 || (sortBy === 'date' && sortOrder === 'desc');
                  return (
                    <div 
                      key={index} 
                      className="flex items-center justify-between py-3 cursor-pointer hover:bg-gray-50 rounded-lg px-2 transition-colors"
                      onClick={() => {
                        if (option.value) {
                          const [newSortBy, newSortOrder] = option.value.split('-') as [SortBy, SortOrder];
                          setSortBy(newSortBy);
                          setSortOrder(newSortOrder);
                        }
                        setSortDialog(false);
                      }}
                      data-testid={`sort-option-${index}`}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                            isSelected ? 'border-green-600 bg-green-50' : 'border-gray-300'
                          }`}
                        >
                          {isSelected && (
                            <div className="w-2.5 h-2.5 rounded-full bg-green-600"></div>
                          )}
                        </div>
                        <span className="text-gray-800 font-medium">{option.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Cancel Button */}
              <div className="pt-6 border-t border-gray-200 mt-6">
                <Button 
                  variant="outline" 
                  onClick={() => setSortDialog(false)}
                  className="w-full py-3 text-gray-600 hover:text-gray-800 font-medium"
                >
                  CANCEL
                </Button>
              </div>
            </div>
            
            {/* Safe Area for mobile */}
            <div className="h-6"></div>
          </div>
        </>
      )}
    </div>
  );
}