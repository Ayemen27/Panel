import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Folder,
  File as FileIcon,
  Plus,
  Search,
  Grid3X3,
  List,
  Filter,
  Upload,
  MoreVertical,
  Edit,
  Copy,
  Share,
  Trash2,
  Download,
  Eye,
  Lock,
  Unlock,
  History,
  Settings,
  RefreshCw,
  ChevronRight,
  Home,
  ArrowLeft,
  Star,
  Clock,
  Tags,
  Users,
  FolderOpen,
  Shield,
  Calendar,
  Info,
  Database,
  HardDrive,
  AlertTriangle,
  Menu,
  SortAsc,
  SortDesc,
  Camera,
  Video,
  Music,
  FileText,
  Image,
  Smartphone,
  BookOpen,
  Cloud
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// Types for Database Files
interface DatabaseFileItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  size: number;
  path: string;
  parentId?: string;
  ownerId: string;
  isPublic: boolean;
  tags: string[];
  checksum?: string;
  mimeType?: string;
  createdAt: string;
  updatedAt: string;
}

// Types for Real System Files
interface RealFileItem {
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
  items: RealFileItem[];
  totalFiles: number;
  totalDirectories: number;
  totalSize: number;
}

// Unified File Item Type
type FileItem = DatabaseFileItem | RealFileItem;

interface BreadcrumbItem {
  id: string | null;
  name: string;
  path: string;
}

type FileSystemMode = 'database' | 'real';

// File Manager Component
export default function FileManager() {
  const { toast } = useToast();
  
  // File System Mode State
  const [fileSystemMode, setFileSystemMode] = useState<FileSystemMode>('real');
  
  // Database Files State
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  
  // Real Files State
  const [currentPath, setCurrentPath] = useState<string>('/');
  
  // Common State
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [pathError, setPathError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'date' | 'type'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [storageSection, setStorageSection] = useState('main');
  
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: null, name: 'الرئيسية', path: '/' }
  ]);
  
  // Initialize real files with default allowed path
  useEffect(() => {
    if (fileSystemMode === 'real') {
      // Set initial path to a safe default
      const initialPath = process.env.NODE_ENV === 'development' ? '/workspace' : '/app';
      setCurrentPath(initialPath);
      setBreadcrumbs([{ id: null, name: 'الرئيسية', path: initialPath }]);
    } else {
      setBreadcrumbs([{ id: null, name: 'الرئيسية', path: '/' }]);
    }
  }, [fileSystemMode]);

  // Fetch database files in current folder
  const { data: databaseFiles = [], isLoading: isDatabaseLoading, refetch: refetchDatabase } = useQuery<DatabaseFileItem[]>({
    queryKey: ['/api/files', currentFolderId],
    enabled: fileSystemMode === 'database',
  });

  // Fetch real files in current directory
  const { data: realFilesData, isLoading: isRealFilesLoading, error: realFilesError, refetch: refetchRealFiles } = useQuery<DirectoryListing>({
    queryKey: ['/api/real-files/browse', currentPath],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/real-files/browse', {
        path: currentPath
      });
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || result.message);
      }
      
      return result.data;
    },
    enabled: fileSystemMode === 'real',
    retry: (failureCount, error: Error) => {
      // Don't retry on path validation errors
      if (error.message.includes('Path validation failed') || error.message.includes('Access denied')) {
        return false;
      }
      return failureCount < 2;
    }
  });

  // Search database files
  const { data: databaseSearchResults = [], isLoading: isDatabaseSearching } = useQuery<DatabaseFileItem[]>({
    queryKey: ['/api/files/search', searchQuery],
    enabled: searchQuery.length > 0 && fileSystemMode === 'database',
  });

  // Define isSearching variable for loading states
  const isSearching = searchQuery.length > 0 && fileSystemMode === 'database' && isDatabaseSearching;

  // Handle path errors for real files (since onError is not available in TanStack Query v5)
  useEffect(() => {
    if (realFilesError) {
      setPathError(realFilesError.message);
    } else if (!isRealFilesLoading && fileSystemMode === 'real') {
      setPathError(null);
    }
  }, [realFilesError, isRealFilesLoading, fileSystemMode]);

  // Get current files based on mode
  const currentFiles = fileSystemMode === 'database' 
    ? (searchQuery ? databaseSearchResults : databaseFiles)
    : (realFilesData?.items || []);
  
  const isLoading = fileSystemMode === 'database' 
    ? (searchQuery ? isDatabaseSearching : isDatabaseLoading)
    : isRealFilesLoading;
  
  const refetch = fileSystemMode === 'database' ? refetchDatabase : refetchRealFiles;

  // Pull to refresh handler
  const handlePullToRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  // Touch gesture handling
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 150;
    const isRightSwipe = distance < -150;

    if (isRightSwipe && breadcrumbs.length > 1) {
      // Navigate back
      const newBreadcrumbs = breadcrumbs.slice(0, -1);
      setBreadcrumbs(newBreadcrumbs);
      
      if (fileSystemMode === 'database') {
        setCurrentFolderId(newBreadcrumbs[newBreadcrumbs.length - 1].id);
      } else {
        setCurrentPath(newBreadcrumbs[newBreadcrumbs.length - 1].path);
      }
    }
  };

  // Create new file/folder mutation
  const createItemMutation = useMutation({
    mutationFn: async (data: { name: string; type: 'file' | 'folder'; parentId?: string; content?: string }) => {
      if (fileSystemMode === 'database') {
        const response = await apiRequest('POST', '/api/files', {
          name: data.name,
          type: data.type,
          parentId: data.parentId || currentFolderId,
          size: data.type === 'file' ? 0 : undefined,
          isPublic: false,
          tags: []
        });
        return await response.json();
      } else {
        // Real file system
        const itemPath = `${currentPath}/${data.name}`;
        const response = await apiRequest('POST', '/api/real-files/create', {
          path: itemPath,
          type: data.type === 'folder' ? 'directory' : 'file',
          content: data.content || '',
          mode: data.type === 'folder' ? '0755' : '0644'
        });
        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.error || result.message);
        }
        
        return result;
      }
    },
    onSuccess: () => {
      if (fileSystemMode === 'database') {
        queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['/api/real-files/browse'] });
      }
      toast({
        title: "تم الإنشاء",
        description: "تم إنشاء العنصر بنجاح",
      });
      setIsCreateModalOpen(false);
    },
    onError: (error) => {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (itemPath: string) => {
      if (fileSystemMode === 'database') {
        const response = await apiRequest('DELETE', `/api/files/${itemPath}`);
        return await response.json();
      } else {
        // Real file system
        const response = await apiRequest('DELETE', '/api/real-files/delete', {
          path: itemPath
        });
        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.error || result.message);
        }
        
        return result;
      }
    },
    onSuccess: () => {
      if (fileSystemMode === 'database') {
        queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['/api/real-files/browse'] });
      }
      toast({
        title: "تم الحذف",
        description: fileSystemMode === 'database' ? "تم نقل العنصر إلى سلة المهملات" : "تم حذف العنصر بنجاح",
      });
      setIsDeleteDialogOpen(false);
      setItemToDelete(null);
    },
    onError: (error) => {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Copy mutation
  const copyMutation = useMutation({
    mutationFn: async ({ sourcePath, destinationPath }: { sourcePath: string; destinationPath?: string }) => {
      if (fileSystemMode === 'database') {
        const response = await apiRequest('POST', `/api/files/${sourcePath}/copy`, {
          destinationFolderId: destinationPath || currentFolderId
        });
        return await response.json();
      } else {
        // Real file system
        const destPath = destinationPath || currentPath;
        const response = await apiRequest('POST', '/api/real-files/copy', {
          sourcePath,
          destinationPath: destPath
        });
        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.error || result.message);
        }
        
        return result;
      }
    },
    onSuccess: () => {
      if (fileSystemMode === 'database') {
        queryClient.invalidateQueries({ queryKey: ['/api/files', currentFolderId] });
        queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['/api/real-files/browse'] });
      }
      toast({
        title: "تم النسخ",
        description: "تم نسخ العنصر بنجاح",
      });
    },
    onError: (error) => {
      toast({
        title: "خطأ",
        description: "فشل في نسخ العنصر",
        variant: "destructive"
      });
    }
  });

  // Share mutation (only for database files)
  const shareMutation = useMutation({
    mutationFn: async ({ fileId, isPublic }: { fileId: string; isPublic: boolean }) => {
      if (fileSystemMode !== 'database') {
        throw new Error('المشاركة غير مدعومة في نظام الملفات الحقيقي');
      }
      const response = await apiRequest('POST', `/api/files/${fileId}/share`, {
        isPublic
      });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/files', currentFolderId] });
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      toast({
        title: data.file.isPublic ? "تم جعل الملف عاماً" : "تم جعل الملف خاصاً",
        description: data.publicUrl ? `الرابط العام: ${window.location.origin}${data.publicUrl}` : "الملف أصبح خاصاً",
      });
      if (data.publicUrl) {
        navigator.clipboard.writeText(`${window.location.origin}${data.publicUrl}`);
      }
    },
    onError: (error) => {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Rename mutation (for real files)
  const renameMutation = useMutation({
    mutationFn: async ({ oldPath, newName }: { oldPath: string; newName: string }) => {
      if (fileSystemMode === 'database') {
        // For database files, use update endpoint
        const response = await apiRequest('PUT', `/api/files/${oldPath}`, {
          name: newName
        });
        return await response.json();
      } else {
        // Real file system
        const directory = oldPath.substring(0, oldPath.lastIndexOf('/'));
        const newPath = `${directory}/${newName}`;
        const response = await apiRequest('PUT', '/api/real-files/rename', {
          oldPath,
          newPath
        });
        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.error || result.message);
        }
        
        return result;
      }
    },
    onSuccess: () => {
      if (fileSystemMode === 'database') {
        queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['/api/real-files/browse'] });
      }
      toast({
        title: "تم إعادة التسمية",
        description: "تم إعادة تسمية العنصر بنجاح",
      });
    },
    onError: (error) => {
      toast({
        title: "خطأ",
        description: "فشل في إعادة التسمية",
        variant: "destructive"
      });
    }
  });

  // Handlers
  const handleFolderClick = (item: FileItem) => {
    if (fileSystemMode === 'database') {
      const dbItem = item as DatabaseFileItem;
      setCurrentFolderId(dbItem.id);
      setBreadcrumbs([...breadcrumbs, { 
        id: dbItem.id, 
        name: dbItem.name, 
        path: dbItem.path 
      }]);
    } else {
      const realItem = item as RealFileItem;
      if (realItem.type === 'directory') {
        setCurrentPath(realItem.absolutePath);
        setBreadcrumbs([...breadcrumbs, { 
          id: null, 
          name: realItem.name, 
          path: realItem.absolutePath 
        }]);
      }
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(newBreadcrumbs);
    
    if (fileSystemMode === 'database') {
      setCurrentFolderId(newBreadcrumbs[newBreadcrumbs.length - 1].id);
    } else {
      setCurrentPath(newBreadcrumbs[newBreadcrumbs.length - 1].path);
    }
  };

  const handleItemSelect = (itemKey: string) => {
    setSelectedItems(prev => 
      prev.includes(itemKey) 
        ? prev.filter(item => item !== itemKey)
        : [...prev, itemKey]
    );
  };

  const handleDeleteClick = (itemKey: string) => {
    setItemToDelete(itemKey);
    setIsDeleteDialogOpen(true);
  };

  const handleFileSystemModeChange = (checked: boolean) => {
    const newMode = checked ? 'real' : 'database';
    setFileSystemMode(newMode);
    setSelectedItems([]);
    setSearchQuery('');
    setPathError(null);
  };

  // Helper functions
  const getItemKey = (item: FileItem): string => {
    if (fileSystemMode === 'database') {
      return (item as DatabaseFileItem).id;
    } else {
      return (item as RealFileItem).absolutePath;
    }
  };

  const getItemName = (item: FileItem): string => {
    return item.name;
  };

  const getItemType = (item: FileItem): 'file' | 'folder' => {
    if (fileSystemMode === 'database') {
      return (item as DatabaseFileItem).type;
    } else {
      return (item as RealFileItem).type === 'directory' ? 'folder' : 'file';
    }
  };

  const getItemSize = (item: FileItem): number => {
    return item.size;
  };

  const isItemPublic = (item: FileItem): boolean => {
    if (fileSystemMode === 'database') {
      return (item as DatabaseFileItem).isPublic;
    }
    return false; // Real files don't have public/private concept
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFileIcon = (item: FileItem) => {
    if (getItemType(item) === 'folder') {
      if (fileSystemMode === 'real') {
        const realItem = item as RealFileItem;
        return realItem.name.startsWith('.') ? FolderOpen : Folder;
      }
      return Folder;
    }
    
    const name = getItemName(item);
    const ext = name.split('.').pop()?.toLowerCase();
    
    switch (ext) {
      case 'js':
      case 'ts':
      case 'jsx':
      case 'tsx':
        return FileIcon;
      case 'json':
        return Settings;
      case 'md':
      case 'txt':
        return FileIcon;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
        return FileIcon;
      case 'pdf':
        return FileIcon;
      case 'zip':
      case 'tar':
      case 'gz':
        return FileIcon;
      default:
        return FileIcon;
    }
  };

  const getFileDetails = (item: FileItem) => {
    if (fileSystemMode === 'database') {
      const dbItem = item as DatabaseFileItem;
      return {
        created: formatDate(dbItem.createdAt),
        modified: formatDate(dbItem.updatedAt),
        permissions: null,
        owner: null,
        mimeType: dbItem.mimeType,
        tags: dbItem.tags
      };
    } else {
      const realItem = item as RealFileItem;
      return {
        created: formatDate(realItem.created),
        modified: formatDate(realItem.modified),
        permissions: realItem.permissions,
        owner: realItem.owner,
        mimeType: realItem.mimeType,
        tags: []
      };
    }
  };

  const CreateItemModal = () => {
    const [itemName, setItemName] = useState('');
    const [itemType, setItemType] = useState<'file' | 'folder'>('file');
    const [fileContent, setFileContent] = useState('');

    const handleCreate = () => {
      if (!itemName.trim()) {
        toast({
          title: "خطأ",
          description: "يجب إدخال اسم العنصر",
          variant: "destructive"
        });
        return;
      }
      
      createItemMutation.mutate({
        name: itemName.trim(),
        type: itemType,
        parentId: fileSystemMode === 'database' ? (currentFolderId || undefined) : undefined,
        content: itemType === 'file' && fileSystemMode === 'real' ? fileContent : undefined
      });
      
      setItemName('');
      setFileContent('');
    };

    return (
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-[425px] mx-2 max-h-[90vh] overflow-y-auto" data-testid="create-item-modal">
          <DialogHeader>
            <DialogTitle>إنشاء عنصر جديد</DialogTitle>
            <DialogDescription>
              اختر نوع العنصر الذي تريد إنشاؤه وأدخل اسمه
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-2 sm:gap-4">
              <Button
                variant={itemType === 'folder' ? 'default' : 'outline'}
                onClick={() => setItemType('folder')}
                className="flex items-center gap-2 h-12 text-sm"
                data-testid="button-folder-type"
              >
                <Folder className="w-4 h-4" />
                مجلد
              </Button>
              <Button
                variant={itemType === 'file' ? 'default' : 'outline'}
                onClick={() => setItemType('file')}
                className="flex items-center gap-2 h-12 text-sm"
                data-testid="button-file-type"
              >
                <FileIcon className="w-4 h-4" />
                ملف
              </Button>
            </div>
            <Input
              placeholder="اسم العنصر"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              data-testid="input-item-name"
            />
            {itemType === 'file' && fileSystemMode === 'real' && (
              <textarea
                placeholder="محتوى الملف (اختياري)"
                value={fileContent}
                onChange={(e) => setFileContent(e.target.value)}
                className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                data-testid="textarea-file-content"
              />
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button 
                variant="outline" 
                onClick={() => setIsCreateModalOpen(false)}
                data-testid="button-cancel"
              >
                إلغاء
              </Button>
              <Button 
                onClick={handleCreate}
                disabled={createItemMutation.isPending}
                data-testid="button-create"
              >
                {createItemMutation.isPending ? 'جاري الإنشاء...' : 'إنشاء'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  const FileItem = ({ item }: { item: FileItem }) => {
    const Icon = getFileIcon(item);
    const itemKey = getItemKey(item);
    const itemName = getItemName(item);
    const itemType = getItemType(item);
    const itemSize = getItemSize(item);
    const details = getFileDetails(item);
    const isSelected = selectedItems.includes(itemKey);
    const isPublic = isItemPublic(item);

    const handleClick = () => {
      if (itemType === 'folder') {
        handleFolderClick(item);
      } else {
        // Open file in editor or viewer
        console.log('Open file:', itemName);
        toast({
          title: "فتح الملف",
          description: `فتح ${itemName}`,
        });
      }
    };

    const handleCopy = () => {
      if (fileSystemMode === 'database') {
        copyMutation.mutate({ sourcePath: itemKey });
      } else {
        const realItem = item as RealFileItem;
        copyMutation.mutate({ sourcePath: realItem.absolutePath });
      }
    };

    const handleShare = () => {
      if (fileSystemMode === 'database') {
        shareMutation.mutate({ fileId: itemKey, isPublic: !isPublic });
      } else {
        toast({
          title: "غير مدعوم",
          description: "المشاركة غير متوفرة لملفات النظام",
          variant: "destructive"
        });
      }
    };

    const handleDownload = () => {
      if (fileSystemMode === 'database') {
        window.open(`/api/files/${itemKey}/download`, '_blank');
      } else {
        // For real files, we could implement download via content API
        const realItem = item as RealFileItem;
        window.open(`/api/real-files/content?path=${encodeURIComponent(realItem.absolutePath)}`, '_blank');
      }
    };

    const handleRename = () => {
      const newName = prompt('أدخل الاسم الجديد:', itemName);
      if (newName && newName.trim() && newName !== itemName) {
        if (fileSystemMode === 'real') {
          const realItem = item as RealFileItem;
          renameMutation.mutate({ oldPath: realItem.absolutePath, newName: newName.trim() });
        } else {
          // Database files use update mutation
          // This would need to be implemented separately
          toast({
            title: "قريباً",
            description: "سيتم إضافة إعادة التسمية لملفات قاعدة البيانات قريباً",
          });
        }
      }
    };

    const handleEdit = () => {
      if (itemType === 'file') {
        // TODO: Open file editor
        console.log('Edit:', itemName);
        toast({
          title: "قريباً",
          description: "سيتم إضافة محرر الملفات قريباً",
        });
      }
    };

    // Context menu items based on file system mode
    const contextMenuItems = [
      { icon: Eye, label: 'فتح', onClick: handleClick },
      { icon: Edit, label: 'تحرير', onClick: handleEdit, disabled: itemType === 'folder' },
      { icon: Copy, label: 'نسخ', onClick: handleCopy, disabled: itemType === 'folder' },
      ...(fileSystemMode === 'database' ? [
        { 
          icon: Share, 
          label: isPublic ? 'إلغاء المشاركة' : 'مشاركة', 
          onClick: handleShare 
        },
      ] : [
        { icon: Edit, label: 'إعادة تسمية', onClick: handleRename },
      ]),
      { separator: true as const },
      { icon: Download, label: 'تحميل', onClick: handleDownload, disabled: itemType === 'folder' },
      ...(fileSystemMode === 'database' ? [
        { icon: History, label: 'الإصدارات', onClick: () => console.log('Versions:', itemName), disabled: itemType === 'folder' },
      ] : [
        { icon: Info, label: 'خصائص', onClick: () => {
          const realItem = item as RealFileItem;
          toast({
            title: 'خصائص الملف',
            description: `الصلاحيات: ${realItem.permissions}${realItem.owner ? `\nالمالك: ${realItem.owner}` : ''}`,
          });
        }},
      ]),
      { separator: true as const },
      { icon: Trash2, label: 'حذف', onClick: () => handleDeleteClick(itemKey), variant: 'destructive' as const },
    ];

    if (viewMode === 'grid') {
      return (
        <ContextMenu>
          <ContextMenuTrigger>
            <Card
              className={cn(
                "p-4 cursor-pointer transition-all hover:shadow-md",
                isSelected && "ring-2 ring-primary"
              )}
              onClick={handleClick}
              data-testid={`card-file-${itemKey}`}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <Icon className="w-8 h-8 text-muted-foreground" />
                  {fileSystemMode === 'database' && isPublic && (
                    <Badge className="absolute -top-1 -right-1 w-4 h-4 p-0 flex items-center justify-center text-xs">
                      <Share className="w-2 h-2" />
                    </Badge>
                  )}
                  {fileSystemMode === 'real' && (item as RealFileItem).isHidden && (
                    <Badge variant="secondary" className="absolute -top-1 -right-1 w-4 h-4 p-0 flex items-center justify-center text-xs">
                      <Eye className="w-2 h-2" />
                    </Badge>
                  )}
                </div>
                <div className="text-center w-full">
                  <p className="font-medium text-sm truncate max-w-[120px] mx-auto" title={itemName}>
                    {itemName}
                  </p>
                  <div className="flex flex-col gap-1 mt-2">
                    <Badge variant="outline" className="text-xs mx-auto">
                      {itemType === 'folder' ? 'مجلد' : formatFileSize(itemSize)}
                    </Badge>
                    {fileSystemMode === 'database' && isPublic && (
                      <Badge variant="secondary" className="text-xs mx-auto">
                        <Share className="w-3 h-3 mr-1" />
                        عام
                      </Badge>
                    )}
                    {fileSystemMode === 'real' && details.permissions && (
                      <Badge variant="outline" className="text-xs mx-auto font-mono">
                        {details.permissions}
                      </Badge>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {details.modified}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </ContextMenuTrigger>
          <ContextMenuContent>
            {contextMenuItems.map((item, index) => 
              'separator' in item ? (
                <ContextMenuSeparator key={index} />
              ) : (
                <ContextMenuItem
                  key={index}
                  onClick={item.onClick}
                  className={item.variant === 'destructive' ? 'text-destructive focus:text-destructive' : ''}
                >
                  <item.icon className="w-4 h-4 mr-2" />
                  {item.label}
                </ContextMenuItem>
              )
            )}
          </ContextMenuContent>
        </ContextMenu>
      );
    }

    // List view
    return (
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all hover:bg-muted/50",
              isSelected && "bg-primary/10 border border-primary/20"
            )}
            onClick={handleClick}
            data-testid={`row-file-${itemKey}`}
          >
            <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{itemName}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{itemType === 'file' ? formatFileSize(itemSize) : 'مجلد'}</span>
                {fileSystemMode === 'real' && details.permissions && (
                  <Badge variant="outline" className="text-xs font-mono">
                    {details.permissions}
                  </Badge>
                )}
                <span>{details.modified}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {fileSystemMode === 'database' && details.tags.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {details.tags[0]}
                </Badge>
              )}
              {fileSystemMode === 'database' && isPublic && (
                <Badge variant="secondary" className="text-xs">
                  <Share className="w-3 h-3 mr-1" />
                  عام
                </Badge>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="w-8 h-8 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  // Show options menu
                }}
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {contextMenuItems.map((item, index) => 
            'separator' in item ? (
              <ContextMenuSeparator key={index} />
            ) : (
              <ContextMenuItem
                key={index}
                onClick={item.onClick}
                disabled={item.disabled}
                className={cn(
                  item.variant === 'destructive' ? 'text-destructive focus:text-destructive' : '',
                  item.disabled ? 'opacity-50 cursor-not-allowed' : ''
                )}
              >
                <item.icon className="w-4 h-4 mr-2" />
                {item.label}
              </ContextMenuItem>
            )
          )}
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  return (
    <div 
      className="h-full flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* New Black Header */}
      <div className="bg-gray-900 text-white p-3 sm:p-4">
        <div className="flex items-center justify-between">
          {/* Left: Menu Button */}
          <Button
            size="sm"
            variant="ghost"
            className="h-10 w-10 p-0 text-white hover:bg-white/20 touch-manipulation"
            onClick={() => setShowSidebar(true)}
            data-testid="button-menu"
          >
            <Menu className="w-5 h-5" />
          </Button>
          
          {/* Center: Title with Back Button */}
          <div className="flex items-center justify-center flex-1 mx-4">
            {breadcrumbs.length > 1 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-white hover:bg-white/20 touch-manipulation mr-3"
                onClick={() => {
                  if (breadcrumbs.length > 1) {
                    const newBreadcrumbs = breadcrumbs.slice(0, -1);
                    setBreadcrumbs(newBreadcrumbs);
                    
                    if (fileSystemMode === 'database') {
                      setCurrentFolderId(newBreadcrumbs[newBreadcrumbs.length - 1].id);
                    } else {
                      setCurrentPath(newBreadcrumbs[newBreadcrumbs.length - 1].path);
                    }
                  }
                }}
                data-testid="button-back-header"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <h1 className="text-lg sm:text-xl font-semibold text-center">
              التخزين الرئيسي
            </h1>
          </div>
          
          {/* Right: Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-10 w-10 p-0 text-white hover:bg-white/20 touch-manipulation"
              onClick={() => {
                const searchInput = document.querySelector('[data-testid="input-search"]') as HTMLInputElement;
                searchInput?.focus();
              }}
              data-testid="button-search"
            >
              <Search className="w-5 h-5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-10 w-10 p-0 text-white hover:bg-white/20 touch-manipulation"
              onClick={() => setShowFilters(!showFilters)}
              data-testid="button-filter-toggle"
            >
              <Filter className="w-5 h-5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-10 w-10 p-0 text-white hover:bg-white/20 touch-manipulation"
              onClick={() => setShowMobileMenu(true)}
              data-testid="button-more"
            >
              <MoreVertical className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <Sheet open={showSidebar} onOpenChange={setShowSidebar}>
        <SheetContent side="left" className="w-80 p-0 bg-white" data-testid="sidebar">
          <div className="flex flex-col h-full">
            {/* Sidebar Header */}
            <div className="bg-teal-600 text-white p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">التخزين الرئيسي</h2>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-white hover:bg-white/20"
                onClick={() => setShowSidebar(false)}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Storage Usage */}
            <div className="p-4 border-b">
              <div className="mb-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">مستخدم 59%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div className="bg-gray-700 h-2 rounded-full" style={{ width: '59%' }}></div>
                </div>
              </div>
            </div>
            
            {/* Storage Categories */}
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-3 gap-4 p-4">
                {/* Video */}
                <div className="flex flex-col items-center text-center cursor-pointer p-3 rounded-lg hover:bg-gray-50" 
                     onClick={() => {
                       setStorageSection('video');
                       setShowSidebar(false);
                     }}
                     data-testid="sidebar-video">
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-2">
                    <Video className="w-6 h-6 text-red-600" />
                  </div>
                  <span className="text-xs font-medium">فيديو</span>
                  <span className="text-xs text-gray-500">195 GB (1189)</span>
                </div>

                {/* Recent Files */}
                <div className="flex flex-col items-center text-center cursor-pointer p-3 rounded-lg hover:bg-gray-50"
                     onClick={() => {
                       setStorageSection('recent');
                       setShowSidebar(false);
                     }}
                     data-testid="sidebar-recent">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                    <Clock className="w-6 h-6 text-blue-600" />
                  </div>
                  <span className="text-xs font-medium">ملفات حديثة</span>
                  <span className="text-xs text-gray-500">1.01 MB (216)</span>
                </div>

                {/* Network Access */}
                <div className="flex flex-col items-center text-center cursor-pointer p-3 rounded-lg hover:bg-gray-50"
                     onClick={() => {
                       setStorageSection('network');
                       setShowSidebar(false);
                     }}
                     data-testid="sidebar-network">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-2">
                    <Cloud className="w-6 h-6 text-green-600" />
                  </div>
                  <span className="text-xs font-medium">الوصول من الشبكة</span>
                </div>

                {/* Documents */}
                <div className="flex flex-col items-center text-center cursor-pointer p-3 rounded-lg hover:bg-gray-50"
                     onClick={() => {
                       setStorageSection('documents');
                       setShowSidebar(false);
                     }}
                     data-testid="sidebar-documents">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                  <span className="text-xs font-medium">وثائق</span>
                  <span className="text-xs text-gray-500">4.9 GB (2113)</span>
                </div>

                {/* Apps */}
                <div className="flex flex-col items-center text-center cursor-pointer p-3 rounded-lg hover:bg-gray-50"
                     onClick={() => {
                       setStorageSection('apps');
                       setShowSidebar(false);
                     }}
                     data-testid="sidebar-apps">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-2">
                    <Smartphone className="w-6 h-6 text-green-600" />
                  </div>
                  <span className="text-xs font-medium">تطبيقات</span>
                  <span className="text-xs text-gray-500">42 GB (159)</span>
                </div>

                {/* Pictures */}
                <div className="flex flex-col items-center text-center cursor-pointer p-3 rounded-lg hover:bg-gray-50"
                     onClick={() => {
                       setStorageSection('pictures');
                       setShowSidebar(false);
                     }}
                     data-testid="sidebar-pictures">
                  <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mb-2">
                    <Image className="w-6 h-6 text-purple-600" />
                  </div>
                  <span className="text-xs font-medium">صور</span>
                  <span className="text-xs text-gray-500">9.2 GB (1165)</span>
                </div>

                {/* Music */}
                <div className="flex flex-col items-center text-center cursor-pointer p-3 rounded-lg hover:bg-gray-50"
                     onClick={() => {
                       setStorageSection('music');
                       setShowSidebar(false);
                     }}
                     data-testid="sidebar-music">
                  <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center mb-2">
                    <Music className="w-6 h-6 text-teal-600" />
                  </div>
                  <span className="text-xs font-medium">صوتي</span>
                  <span className="text-xs text-gray-500">787 MB (78)</span>
                </div>

                {/* Cloud */}
                <div className="flex flex-col items-center text-center cursor-pointer p-3 rounded-lg hover:bg-gray-50"
                     onClick={() => {
                       setStorageSection('cloud');
                       setShowSidebar(false);
                     }}
                     data-testid="sidebar-cloud">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                    <Cloud className="w-6 h-6 text-blue-600" />
                  </div>
                  <span className="text-xs font-medium">سحابة</span>
                </div>

                {/* Remote */}
                <div className="flex flex-col items-center text-center cursor-pointer p-3 rounded-lg hover:bg-gray-50"
                     onClick={() => {
                       setStorageSection('remote');
                       setShowSidebar(false);
                     }}
                     data-testid="sidebar-remote">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                    <HardDrive className="w-6 h-6 text-gray-600" />
                  </div>
                  <span className="text-xs font-medium">بعيد</span>
                  <span className="text-xs text-gray-500">(0)</span>
                </div>
              </div>

              {/* Trash */}
              <div className="border-t p-4">
                <div className="flex items-center cursor-pointer p-3 rounded-lg hover:bg-gray-50"
                     onClick={() => {
                       setStorageSection('trash');
                       setShowSidebar(false);
                     }}
                     data-testid="sidebar-trash">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mr-3">
                    <Trash2 className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <span className="text-sm font-medium block">سلة المحذوفات</span>
                    <span className="text-xs text-gray-500">1.09 kB</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Options Menu */}
      <Sheet open={showMobileMenu} onOpenChange={setShowMobileMenu}>
        <SheetContent side="left" className="w-80">
          <SheetHeader>
            <SheetTitle>إعدادات مدير الملفات</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            {/* File System Mode Toggle for Mobile */}
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">نوع نظام الملفات</Label>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">قاعدة البيانات</Label>
                <Switch 
                  checked={fileSystemMode === 'real'}
                  onCheckedChange={handleFileSystemModeChange}
                  data-testid="switch-mobile-file-system"
                />
                <Label className="text-xs text-muted-foreground">ملفات النظام</Label>
              </div>
            </div>
            
            {/* View Mode Toggle for Mobile */}
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">عرض الملفات</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                className="touch-manipulation"
              >
                {viewMode === 'grid' ? (
                  <><List className="w-4 h-4 mr-2" />قائمة</>
                ) : (
                  <><Grid3X3 className="w-4 h-4 mr-2" />شبكة</>
                )}
              </Button>
            </div>

            {/* File System Mode Toggle */}
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">نوع نظام الملفات</Label>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">قاعدة البيانات</Label>
                <Switch 
                  checked={fileSystemMode === 'real'}
                  onCheckedChange={handleFileSystemModeChange}
                  data-testid="switch-file-system-mobile"
                />
                <Label className="text-xs text-muted-foreground">ملفات النظام</Label>
              </div>
            </div>
            
            {/* Create New */}
            <Button 
              onClick={() => {
                setIsCreateModalOpen(true);
                setShowMobileMenu(false);
              }}
              className="w-full touch-manipulation"
              data-testid="button-create-mobile"
            >
              <Plus className="w-4 h-4 mr-2" />
              إنشاء جديد
            </Button>

            {/* Refresh */}
            <Button 
              variant="outline"
              onClick={() => {
                handlePullToRefresh();
                setShowMobileMenu(false);
              }}
              disabled={isRefreshing}
              className="w-full touch-manipulation"
              data-testid="button-refresh-mobile"
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
              تحديث
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Breadcrumbs */}
      <div className="border-b border-border bg-card p-2 sm:p-4">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-1 sm:gap-2 mb-2 sm:mb-4 overflow-x-auto scrollbar-hide px-2 sm:px-0">
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.id || 'root'} className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-1 text-xs sm:text-sm font-normal whitespace-nowrap touch-manipulation"
                onClick={() => handleBreadcrumbClick(index)}
                data-testid={`breadcrumb-${index}`}
              >
                {index === 0 ? <Home className="w-3 h-3 sm:w-4 sm:h-4" /> : (
                  <span className="max-w-[80px] sm:max-w-none truncate">{crumb.name}</span>
                )}
              </Button>
              {index < breadcrumbs.length - 1 && (
                <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
              )}
            </div>
          ))}
        </div>

        {/* Path Error Alert */}
        {pathError && (
          <Alert className="mb-4" data-testid="path-error-alert">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>خطأ في المسار:</strong> {pathError}
            </AlertDescription>
          </Alert>
        )}
        
        {/* Real Files Info */}
        {fileSystemMode === 'real' && realFilesData && (
          <div className="mb-2 sm:mb-4 p-2 sm:p-3 bg-muted/30 rounded-lg mx-2 sm:mx-0" data-testid="real-files-info">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs sm:text-sm text-muted-foreground gap-1 sm:gap-0">
              <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                <span className="truncate max-w-[200px] sm:max-w-none">المسار: {currentPath}</span>
                <span>إجمالي {realFilesData.totalFiles} ملف</span>
                <span>{realFilesData.totalDirectories} مجلد</span>
              </div>
              <div>
                إجمالي الحجم: {formatFileSize(realFilesData.totalSize)}
              </div>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="flex items-center gap-2 px-2 sm:px-0">
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder={fileSystemMode === 'database' ? "البحث في الملفات..." : "البحث غير متوفر لملفات النظام"}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={fileSystemMode === 'real'}
              className="pr-10 h-9 sm:h-10 text-sm"
              data-testid="input-search"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-9 w-9 sm:h-10 sm:w-10 p-0 touch-manipulation"
            onClick={() => setShowFilters(!showFilters)}
            data-testid="button-filters"
          >
            <Filter className="w-4 h-4" />
          </Button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <Card className="mt-2 sm:mt-4 p-2 sm:p-4 mx-2 sm:mx-0">
            <div className="flex flex-wrap items-center gap-1 sm:gap-2">
              <Badge variant="outline" className="cursor-pointer touch-manipulation h-8 px-2 text-xs">
                <Tags className="w-2 h-2 sm:w-3 sm:h-3 mr-1" />
                الكل
              </Badge>
              <Badge variant="outline" className="cursor-pointer touch-manipulation h-8 px-2 text-xs">
                <FileIcon className="w-2 h-2 sm:w-3 sm:h-3 mr-1" />
                ملفات
              </Badge>
              <Badge variant="outline" className="cursor-pointer touch-manipulation h-8 px-2 text-xs">
                <Folder className="w-2 h-2 sm:w-3 sm:h-3 mr-1" />
                مجلدات
              </Badge>
              <Badge variant="outline" className="cursor-pointer touch-manipulation h-8 px-2 text-xs">
                <Clock className="w-2 h-2 sm:w-3 sm:h-3 mr-1" />
                حديث
              </Badge>
              <Badge variant="outline" className="cursor-pointer touch-manipulation h-8 px-2 text-xs">
                <Star className="w-2 h-2 sm:w-3 sm:h-3 mr-1" />
                مفضل
              </Badge>
              <Badge variant="outline" className="cursor-pointer touch-manipulation h-8 px-2 text-xs">
                <Users className="w-2 h-2 sm:w-3 sm:h-3 mr-1" />
                مشترك
              </Badge>
            </div>
          </Card>
        )}
      </div>

      {/* Modals & Dialogs */}
      <CreateItemModal />
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="mx-2 max-w-[calc(100vw-1rem)] sm:max-w-[425px]" data-testid="delete-confirmation-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذا العنصر؟ سيتم نقله إلى سلة المهملات.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="w-full sm:w-auto touch-manipulation" data-testid="button-cancel-delete">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="w-full sm:w-auto touch-manipulation"
              onClick={() => {
                if (itemToDelete) {
                  deleteMutation.mutate(itemToDelete);
                }
              }}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? 'جاري الحذف...' : 'حذف'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}