import { useState, useEffect, useCallback, useMemo } from "react";
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
  Cloud,
  X
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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [itemType, setItemType] = useState<'file' | 'folder'>('file');
  const [showFilters, setShowFilters] = useState(false);
  const [pathError, setPathError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [sortBy, setSortBy] = useState<'none' | 'name' | 'size' | 'date' | 'type'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [storageSection, setStorageSection] = useState('main');
  const [showMainLibraries, setShowMainLibraries] = useState(false);
  const [activeTab, setActiveTab] = useState<'files' | 'favorites' | 'recent'>('files');
  const [showCreateSheet, setShowCreateSheet] = useState(false);

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

  // Get current files based on mode, tab, and sorting
  const currentFiles = useMemo(() => {
    let files = fileSystemMode === 'database' 
      ? (searchQuery ? databaseSearchResults : databaseFiles)
      : (realFilesData?.items || []);

    // Apply tab-based filtering
    switch (activeTab) {
      case 'favorites':
        // Filter for favorite files (assuming tags include 'favorite' or there's a star system)
        files = files.filter(file => {
          if ('tags' in file) {
            return file.tags.includes('favorite') || file.tags.includes('starred');
          }
          // For real files, we'll check if name contains star or if it's marked somehow
          return file.name.includes('⭐') || file.name.includes('★');
        }) as typeof files;
        break;
      case 'recent':
        // Get recent files (last 7 days) and sort by date
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        files = files.filter(file => {
          const fileDate = 'modified' in file ? new Date(file.modified) : 
                          'updatedAt' in file ? new Date(file.updatedAt) : new Date(0);
          return fileDate >= sevenDaysAgo;
        }).sort((a, b) => {
          const aDate = 'modified' in a ? new Date(a.modified).getTime() : 
                       'updatedAt' in a ? new Date(a.updatedAt).getTime() : 0;
          const bDate = 'modified' in b ? new Date(b.modified).getTime() : 
                       'updatedAt' in b ? new Date(b.updatedAt).getTime() : 0;
          return bDate - aDate; // Most recent first
        }) as typeof files;
        break;
      case 'files':
      default:
        // Show all files (default behavior)
        break;
    }

    // Apply sorting if not 'none' and not already sorted by recent tab
    if (sortBy !== 'none' && activeTab !== 'recent') {
      // Create a copy to avoid mutating original array
      const sortedFiles = [...files];

      // Apply sorting based on sortBy and sortOrder
      sortedFiles.sort((a, b) => {
        let comparison = 0;

        switch (sortBy) {
          case 'name':
            comparison = a.name.localeCompare(b.name, 'ar');
            break;
          case 'size':
            const aSize = 'size' in a ? a.size : 0;
            const bSize = 'size' in b ? b.size : 0;
            comparison = aSize - bSize;
            break;
          case 'date':
            const aDate = 'modified' in a ? new Date(a.modified).getTime() : 
                         'updatedAt' in a ? new Date(a.updatedAt).getTime() : 0;
            const bDate = 'modified' in b ? new Date(b.modified).getTime() : 
                         'updatedAt' in b ? new Date(b.updatedAt).getTime() : 0;
            comparison = aDate - bDate;
            break;
          case 'type':
            const aType = 'type' in a ? a.type : 'extension' in a ? ((a as any).extension || '') : '';
            const bType = 'type' in b ? b.type : 'extension' in b ? ((b as any).extension || '') : '';
            comparison = String(aType).localeCompare(String(bType), 'ar');
            break;
          default:
            return 0;
        }

        // Apply sort order
        return sortOrder === 'asc' ? comparison : -comparison;
      });

      return sortedFiles;
    }

    return files;
  }, [fileSystemMode, searchQuery, databaseSearchResults, databaseFiles, realFilesData?.items, sortBy, sortOrder, activeTab]);

  const isLoading = fileSystemMode === 'database' 
    ? (searchQuery ? isDatabaseSearching : isDatabaseLoading)
    : isRealFilesLoading;

  const refetch = fileSystemMode === 'database' ? refetchDatabase : refetchRealFiles;

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
      setShowCreateSheet(false);
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

  const handleDeleteClick = (itemKey: string) => {
    setItemToDelete(itemKey);
    setIsDeleteDialogOpen(true);
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
      day: '2-digit'
    });
  };

  const getFileIcon = (item: FileItem) => {
    if (getItemType(item) === 'folder') {
      return '📁';
    }

    const name = getItemName(item);
    const ext = name.split('.').pop()?.toLowerCase();

    switch (ext) {
      case 'txt':
      case 'md':
        return '📄';
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
        return '🖼️';
      case 'pdf':
        return '📄';
      case 'zip':
      case 'tar':
      case 'gz':
        return '📦';
      case 'mp4':
      case 'avi':
      case 'mov':
        return '🎬';
      case 'mp3':
      case 'wav':
        return '🎵';
      default:
        return '📄';
    }
  };

  // Create Item Modal
  const CreateItemModal = () => {
    const [itemName, setItemName] = useState('');
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
        <DialogContent className="w-[90vw] max-w-[400px] rounded-xl bg-white" data-testid="create-item-modal">
          <div className="p-1">
            {/* Header */}
            <div className="text-center mb-6 relative">
              <Button
                variant="ghost"
                size="sm"
                className="absolute left-0 top-0 h-6 w-6 p-0"
                onClick={() => setIsCreateModalOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-medium text-gray-900">
                {itemType === 'folder' ? 'إنشاء مجلد' : 'إنشاء ملف'}
              </h2>
            </div>

            {/* Input Field */}
            <div className="mb-8">
              <Input
                placeholder={itemType === 'folder' ? 'اسم المجلد' : 'اسم الملف'}
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className="w-full px-4 py-3 text-base border-2 border-teal-500 rounded-lg focus:border-teal-600 focus:ring-0 text-right"
                data-testid="input-item-name"
                autoFocus
              />
            </div>

            {/* File Content (only for real files) */}
            {itemType === 'file' && fileSystemMode === 'real' && (
              <div className="mb-6">
                <textarea
                  placeholder="محتوى الملف (اختياري)"
                  value={fileContent}
                  onChange={(e) => setFileContent(e.target.value)}
                  className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-right"
                  data-testid="textarea-file-content"
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-4">
              <Button 
                variant="ghost" 
                onClick={() => setIsCreateModalOpen(false)}
                className="px-6 py-2 text-teal-600 hover:bg-teal-50"
                data-testid="button-cancel"
              >
                CANCEL
              </Button>
              <Button 
                onClick={handleCreate}
                disabled={createItemMutation.isPending}
                className="px-8 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg"
                data-testid="button-create"
              >
                {createItemMutation.isPending ? 'جاري الإنشاء...' : 'OK'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  const FileItem = ({ item }: { item: FileItem }) => {
    const itemKey = getItemKey(item);
    const itemName = getItemName(item);
    const itemType = getItemType(item);
    const itemSize = getItemSize(item);
    const isSelected = selectedItems.includes(itemKey);
    const icon = getFileIcon(item);

    const handleClick = () => {
      if (itemType === 'folder') {
        handleFolderClick(item);
      }
    };

    const getDateForItem = (item: FileItem) => {
      if ('modified' in item) {
        return formatDate(item.modified);
      } else if ('updatedAt' in item) {
        return formatDate(item.updatedAt);
      }
      return '';
    };

    return (
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 border-b border-gray-100"
        onClick={handleClick}
        data-testid={`row-file-${itemKey}`}
      >
        <div className="text-2xl flex-shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-medium text-gray-900 mb-1">{itemName}</p>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>{itemType === 'file' ? formatFileSize(itemSize) : `${itemSize} عناصر`}</span>
            <span>{getDateForItem(item)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen w-full flex flex-col bg-white">
      {/* File Manager Header */}
      <div className="bg-black text-white p-4">
        <div className="flex items-center justify-between">
          {/* Left: Menu and Actions */}
          <div className="flex items-center gap-4">
            <Button
              size="sm"
              variant="ghost"
              className="h-10 w-10 p-0 text-white hover:bg-white/20"
              onClick={() => setShowSidebar(true)}
              data-testid="button-menu"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-medium">+ مدير الملفات</h1>
          </div>

          {/* Right: Action Icons */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-10 w-10 p-0 text-white hover:bg-white/20"
              onClick={() => {}}
              data-testid="button-search"
            >
              <Search className="w-5 h-5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-10 w-10 p-0 text-white hover:bg-white/20"
              onClick={() => setShowFilters(!showFilters)}
              data-testid="button-filter-toggle"
            >
              <Filter className="w-5 h-5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-10 w-10 p-0 text-white hover:bg-white/20"
              onClick={() => setShowCreateSheet(true)}
              data-testid="button-add"
            >
              <Plus className="w-5 h-5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-10 w-10 p-0 text-white hover:bg-white/20"
              onClick={() => {}}
              data-testid="button-home"
            >
              <Home className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Top Navigation Tabs */}
      <div className="bg-gray-100 border-b border-gray-200">
        <div className="flex items-center justify-around px-4 py-3">
          {/* Files Tab */}
          <button
            onClick={() => setActiveTab('files')}
            className={cn(
              "flex flex-col items-center py-2 px-4 rounded-lg transition-colors",
              activeTab === 'files' 
                ? "text-blue-600 bg-blue-50" 
                : "text-gray-600 hover:text-gray-900"
            )}
            data-testid="tab-files"
          >
            <Clock className="w-6 h-6 mb-1" />
            <span className="text-xs">التاريخ</span>
          </button>

          {/* Favorites Tab */}
          <button
            onClick={() => setActiveTab('favorites')}
            className={cn(
              "flex flex-col items-center py-2 px-4 rounded-lg transition-colors",
              activeTab === 'favorites' 
                ? "text-blue-600 bg-blue-50" 
                : "text-gray-600 hover:text-gray-900"
            )}
            data-testid="tab-favorites"
          >
            <Star className="w-6 h-6 mb-1" />
            <span className="text-xs">النجمة</span>
          </button>

          {/* Recent Tab */}
          <button
            onClick={() => setActiveTab('recent')}
            className={cn(
              "flex flex-col items-center py-2 px-4 rounded-lg transition-colors",
              activeTab === 'recent' 
                ? "text-blue-600 bg-blue-50" 
                : "text-gray-600 hover:text-gray-900"
            )}
            data-testid="tab-recent"
          >
            <FileIcon className="w-6 h-6 mb-1" />
            <span className="text-xs">الملفات</span>
          </button>
        </div>
      </div>

      {/* Breadcrumbs */}
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Home className="w-4 h-4 text-gray-600" />
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-600">59% مستخدم</span>
        </div>
      </div>

      {/* Path Error Alert */}
      {pathError && (
        <Alert className="m-4" data-testid="path-error-alert">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <strong>خطأ في المسار:</strong> {pathError}
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
              <span className="mr-2 text-gray-500">جاري التحميل...</span>
            </div>
          ) : currentFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-4">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <FolderOpen className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-500 mb-2">
                لا توجد ملفات
              </h3>
              <p className="text-sm text-gray-400 max-w-sm">
                {searchQuery ? 'لم يتم العثور على ملفات تطابق البحث' : 'هذا المجلد فارغ'}
              </p>
            </div>
          ) : (
            <div className="bg-white">
              {currentFiles.map((item) => (
                <FileItem key={getItemKey(item)} item={item} />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Storage Info Footer */}
      <div className="bg-gray-50 p-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-3xl mb-1">⬇️</div>
              <div className="text-xs text-gray-600">التحميلات</div>
              <div className="text-xs text-gray-500">B (0) 0</div>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-1">💾</div>
              <div className="text-xs text-gray-600">التخزين الرئيسي</div>
              <div className="text-xs text-gray-500">GB / 49.1 GB 30.4</div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Sheet */}
      <Sheet open={showCreateSheet} onOpenChange={setShowCreateSheet}>
        <SheetContent side="bottom" className="h-auto rounded-t-xl bg-white">
          <div className="p-6">
            <div className="text-center mb-6">
              <h3 className="text-lg font-medium text-gray-900">جديد</h3>
            </div>
            <div className="space-y-4">
              <Button
                onClick={() => {
                  setItemType('file');
                  setIsCreateModalOpen(true);
                  setShowCreateSheet(false);
                }}
                className="w-full flex items-center justify-start gap-4 h-16 bg-transparent border-0 text-gray-900 hover:bg-gray-50 text-right"
                variant="ghost"
                data-testid="button-create-file"
              >
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                  <FileIcon className="w-6 h-6 text-gray-600" />
                </div>
                <span className="text-base">ملف</span>
              </Button>
              <Button
                onClick={() => {
                  setItemType('folder');
                  setIsCreateModalOpen(true);
                  setShowCreateSheet(false);
                }}
                className="w-full flex items-center justify-start gap-4 h-16 bg-transparent border-0 text-gray-900 hover:bg-gray-50 text-right"
                variant="ghost"
                data-testid="button-create-folder"
              >
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Folder className="w-6 h-6 text-gray-600" />
                </div>
                <span className="text-base">مجلد</span>
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

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
            <AlertDialogCancel className="w-full sm:w-auto" data-testid="button-cancel-delete">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="w-full sm:w-auto"
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