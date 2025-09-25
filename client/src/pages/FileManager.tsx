import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Users
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// Types
interface FileItem {
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

interface BreadcrumbItem {
  id: string | null;
  name: string;
  path: string;
}

// File Manager Component
export default function FileManager() {
  const { toast } = useToast();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: null, name: 'الرئيسية', path: '/' }
  ]);

  // Fetch files in current folder
  const { data: files = [], isLoading, refetch } = useQuery<FileItem[]>({
    queryKey: ['/api/files', currentFolderId],
    enabled: true,
  });

  // Search files
  const { data: searchResults = [], isLoading: isSearching } = useQuery<FileItem[]>({
    queryKey: ['/api/files/search', searchQuery],
    enabled: searchQuery.length > 0,
  });

  // Create new file/folder mutation
  const createItemMutation = useMutation({
    mutationFn: async (data: { name: string; type: 'file' | 'folder'; parentId?: string }) => {
      const response = await apiRequest('POST', '/api/files', {
        name: data.name,
        type: data.type,
        parentId: data.parentId || currentFolderId,
        size: data.type === 'file' ? 0 : undefined, // Fixed: use undefined instead of null
        isPublic: false,
        tags: []
      });
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
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
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/files/${id}`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      toast({
        title: "تم الحذف",
        description: "تم نقل العنصر إلى سلة المهملات",
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
  const handleFolderClick = (folder: FileItem) => {
    setCurrentFolderId(folder.id);
    setBreadcrumbs([...breadcrumbs, { 
      id: folder.id, 
      name: folder.name, 
      path: folder.path 
    }]);
  };

  const handleBreadcrumbClick = (index: number) => {
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(newBreadcrumbs);
    setCurrentFolderId(newBreadcrumbs[newBreadcrumbs.length - 1].id);
  };

  const handleItemSelect = (id: string) => {
    setSelectedItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const handleDeleteClick = (id: string) => {
    setItemToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const displayFiles = searchQuery ? searchResults : files;

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (file: FileItem) => {
    if (file.type === 'folder') return Folder;
    
    const ext = file.name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js':
      case 'ts':
      case 'jsx':
      case 'tsx':
        return FileIcon;
      default:
        return FileIcon;
    }
  };

  const CreateItemModal = () => {
    const [itemName, setItemName] = useState('');
    const [itemType, setItemType] = useState<'file' | 'folder'>('file');

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
        parentId: currentFolderId || undefined
      });
      
      setItemName('');
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

  const FileItem = ({ file }: { file: FileItem }) => {
    const Icon = getFileIcon(file);
    const isSelected = selectedItems.includes(file.id);

    const handleClick = () => {
      if (file.type === 'folder') {
        handleFolderClick(file);
      } else {
        // Open file in editor
        console.log('Open file:', file.name);
      }
    };

    const contextMenuItems = [
      { icon: Eye, label: 'فتح', onClick: handleClick },
      { icon: Edit, label: 'تحرير', onClick: () => console.log('Edit:', file.name) },
      { icon: Copy, label: 'نسخ', onClick: () => console.log('Copy:', file.name) },
      { icon: Share, label: 'مشاركة', onClick: () => console.log('Share:', file.name) },
      { separator: true as const },
      { icon: Download, label: 'تحميل', onClick: () => console.log('Download:', file.name) },
      { icon: History, label: 'الإصدارات', onClick: () => console.log('Versions:', file.name) },
      { separator: true as const },
      { icon: Trash2, label: 'حذف', onClick: () => handleDeleteClick(file.id), variant: 'destructive' as const },
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
              data-testid={`card-file-${file.id}`}
            >
              <div className="flex flex-col items-center gap-3">
                <div className={cn(
                  "w-12 h-12 rounded-lg flex items-center justify-center",
                  file.type === 'folder' ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"
                )}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium truncate max-w-[120px]" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {file.type === 'file' ? formatFileSize(file.size) : 'مجلد'}
                  </p>
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
            data-testid={`row-file-${file.id}`}
          >
            <div className={cn(
              "w-8 h-8 rounded flex items-center justify-center flex-shrink-0",
              file.type === 'folder' ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"
            )}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {file.type === 'file' ? formatFileSize(file.size) : 'مجلد'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {file.tags.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {file.tags[0]}
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
                  setCurrentFolderId(newBreadcrumbs[newBreadcrumbs.length - 1].id);
                }
              }}
              disabled={breadcrumbs.length <= 1}
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-xl font-bold">مدير الملفات</h1>
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

        {/* Search and Filters */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="البحث في الملفات..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
            ) : displayFiles.length === 0 ? (
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
                {displayFiles.map((file) => (
                  <FileItem key={file.id} file={file} />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {displayFiles.map((file) => (
                  <FileItem key={file.id} file={file} />
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