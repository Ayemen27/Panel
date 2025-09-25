import { useState, useEffect } from "react";
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
  AlertTriangle
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
  const [fileSystemMode, setFileSystemMode] = useState<FileSystemMode>('database');
  
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
    retry: (failureCount, error) => {
      // Don't retry on path validation errors
      if (error.message.includes('Path validation failed') || error.message.includes('Access denied')) {
        return false;
      }
      return failureCount < 2;
    },
    onError: (error) => {
      setPathError(error.message);
    },
    onSuccess: () => {
      setPathError(null);
    }
  });

  // Search database files
  const { data: databaseSearchResults = [], isLoading: isDatabaseSearching } = useQuery<DatabaseFileItem[]>({
    queryKey: ['/api/files/search', searchQuery],
    enabled: searchQuery.length > 0 && fileSystemMode === 'database',
  });

  // Get current files based on mode
  const currentFiles = fileSystemMode === 'database' 
    ? (searchQuery ? databaseSearchResults : databaseFiles)
    : (realFilesData?.items || []);
  
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
        <DialogContent className="sm:max-w-[425px]" data-testid="create-item-modal">
          <DialogHeader>
            <DialogTitle>إنشاء عنصر جديد</DialogTitle>
            <DialogDescription>
              اختر نوع العنصر الذي تريد إنشاؤه وأدخل اسمه
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant={itemType === 'folder' ? 'default' : 'outline'}
                onClick={() => setItemType('folder')}
                className="flex items-center gap-2"
                data-testid="button-folder-type"
              >
                <Folder className="w-4 h-4" />
                مجلد
              </Button>
              <Button
                variant={itemType === 'file' ? 'default' : 'outline'}
                onClick={() => setItemType('file')}
                className="flex items-center gap-2"
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
            <div className="flex justify-end gap-2">
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
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
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
              disabled={breadcrumbs.length <= 1}
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-xl font-bold">مدير الملفات</h1>
            
            {/* File System Mode Toggle */}
            <div className="flex items-center gap-3 mr-4 p-2 bg-muted/50 rounded-lg" data-testid="file-system-toggle">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-600" />
                <Label className="text-sm font-medium">قاعدة البيانات</Label>
              </div>
              <Switch 
                checked={fileSystemMode === 'real'}
                onCheckedChange={handleFileSystemModeChange}
                data-testid="switch-file-system"
              />
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-green-600" />
                <Label className="text-sm font-medium">ملفات النظام</Label>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => refetch()}
              data-testid="button-refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              data-testid="button-view-mode"
            >
              {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid3X3 className="w-4 h-4" />}
            </Button>
            <Button 
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
              data-testid="button-create-item"
            >
              <Plus className="w-4 h-4 mr-2" />
              جديد
            </Button>
          </div>
        </div>

        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 mb-4">
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.id || 'root'} className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-1 text-sm font-normal"
                onClick={() => handleBreadcrumbClick(index)}
                data-testid={`breadcrumb-${index}`}
              >
                {index === 0 ? <Home className="w-4 h-4" /> : crumb.name}
              </Button>
              {index < breadcrumbs.length - 1 && (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
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
          <div className="mb-4 p-3 bg-muted/30 rounded-lg" data-testid="real-files-info">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-4">
                <span>المسار: {currentPath}</span>
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
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder={fileSystemMode === 'database' ? "البحث في الملفات..." : "البحث غير متوفر لملفات النظام"}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={fileSystemMode === 'real'}
              className="pr-10"
              data-testid="input-search"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            data-testid="button-filters"
          >
            <Filter className="w-4 h-4" />
          </Button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <Card className="mt-4 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="cursor-pointer">
                <Tags className="w-3 h-3 mr-1" />
                الكل
              </Badge>
              <Badge variant="outline" className="cursor-pointer">
                <FileIcon className="w-3 h-3 mr-1" />
                ملفات
              </Badge>
              <Badge variant="outline" className="cursor-pointer">
                <Folder className="w-3 h-3 mr-1" />
                مجلدات
              </Badge>
              <Badge variant="outline" className="cursor-pointer">
                <Clock className="w-3 h-3 mr-1" />
                حديث
              </Badge>
              <Badge variant="outline" className="cursor-pointer">
                <Star className="w-3 h-3 mr-1" />
                مفضل
              </Badge>
              <Badge variant="outline" className="cursor-pointer">
                <Users className="w-3 h-3 mr-1" />
                مشترك
              </Badge>
            </div>
          </Card>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4">
            {isLoading || isSearching ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">جاري التحميل...</p>
                </div>
              </div>
            ) : currentFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Folder className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-lg font-medium mb-2">لا توجد ملفات</p>
                <p className="text-muted-foreground mb-4">ابدأ بإنشاء ملف أو مجلد جديد</p>
                <Button onClick={() => setIsCreateModalOpen(true)} data-testid="button-create-empty">
                  <Plus className="w-4 h-4 mr-2" />
                  إنشاء جديد
                </Button>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                {currentFiles.map((item) => (
                  <FileItem key={getItemKey(item)} item={item} />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {currentFiles.map((item) => (
                  <FileItem key={getItemKey(item)} item={item} />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Selection Info */}
      {selectedItems.length > 0 && (
        <div className="border-t border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              تم تحديد {selectedItems.length} عنصر
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" data-testid="button-copy-selected">
                <Copy className="w-4 h-4 mr-2" />
                نسخ
              </Button>
              <Button size="sm" variant="outline" data-testid="button-share-selected">
                <Share className="w-4 h-4 mr-2" />
                مشاركة
              </Button>
              <Button 
                size="sm" 
                variant="destructive"
                onClick={() => {
                  if (selectedItems.length === 1) {
                    handleDeleteClick(selectedItems[0]);
                  }
                }}
                data-testid="button-delete-selected"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                حذف
              </Button>
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => setSelectedItems([])}
                data-testid="button-clear-selection"
              >
                إلغاء التحديد
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modals & Dialogs */}
      <CreateItemModal />
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent data-testid="delete-confirmation-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذا العنصر؟ سيتم نقله إلى سلة المهملات.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">إلغاء</AlertDialogCancel>
            <AlertDialogAction
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