import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import { Textarea } from "@/components/ui/textarea";

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

  // Add comprehensive logging
  const log = (action: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.log(`🔍 [FileManager ${timestamp}] ${action}:`, data || '');
  };

  // File System Mode State
  const [fileSystemMode, setFileSystemMode] = useState<FileSystemMode>('real');

  // Log initial component mount
  useEffect(() => {
    log('FileManager Component Mounted', {
      initialFileSystemMode: fileSystemMode,
      currentPath: currentPath,
      userAgent: navigator.userAgent,
      location: window.location.href
    });
  }, []);

  // Database Files State
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  // Real Files State
  const [currentPath, setCurrentPath] = useState<string>('/home/administrator');

  // Common State
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
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
  const [showMainLibraries, setShowMainLibraries] = useState(true);
  const [activeTab, setActiveTab] = useState<'files' | 'favorites' | 'recent'>('files');

  // File Preview State
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isFilePreviewOpen, setIsFilePreviewOpen] = useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);

  // Drag & Drop State
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: 'root', name: 'الرئيسية', path: '/home/administrator' }
  ]);

  // Initialize real files with default allowed path
  useEffect(() => {
    log('File System Mode Changed', {
      oldMode: fileSystemMode,
      newMode: fileSystemMode,
      isReal: fileSystemMode === 'real'
    });

    if (fileSystemMode === 'real') {
      // Use administrator home directory
      const initialPath = '/home/administrator';
      log('Setting Initial Real Path', {
        path: initialPath,
        reason: 'Real file system mode activated'
      });
      setCurrentPath(initialPath);
      setBreadcrumbs([{ id: 'root', name: 'الرئيسية', path: initialPath }]);
    } else {
      log('Setting Initial Database Path', {
        path: '/',
        reason: 'Database file system mode activated'
      });
      setBreadcrumbs([{ id: 'root', name: 'الرئيسية', path: '/' }]);
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
      log('API Query Started', {
        endpoint: '/api/real-files/browse',
        path: currentPath,
        fileSystemMode: fileSystemMode,
        timestamp: new Date().toISOString()
      });
      console.log('🔍 Fetching directory contents for:', currentPath);
      
      try {
        const response = await apiRequest('GET', '/api/real-files/browse', {
          path: currentPath
        }, {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });

        console.log('📡 API Response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ API Error response:', errorText);
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        console.log('✅ API Success response:', result);

        // Handle different response formats more gracefully
        let directoryData: DirectoryListing;

        if (result.success === false) {
          throw new Error(result.error || result.message || 'API returned failure status');
        }

        // Check if result has success property and data
        if (result.success && result.data) {
          directoryData = result.data;
        }
        // Check if result is direct directory data
        else if (result.path && result.items) {
          directoryData = result;
        }
        // Check if result.data exists without success flag
        else if (result.data && result.data.path && result.data.items) {
          directoryData = result.data;
        }
        else {
          console.error('❌ Unexpected response format:', result);
          throw new Error('Invalid directory data format received');
        }

        if (!directoryData.items || !Array.isArray(directoryData.items)) {
          console.error('❌ Invalid items array:', directoryData.items);
          throw new Error('Directory items is not a valid array');
        }

        console.log(`📁 Found ${directoryData.items.length} items in directory: ${directoryData.path}`);
        console.log('📋 Items preview:', directoryData.items.slice(0, 3).map(item => item.name));
        
        log('API Query Success', {
          endpoint: '/api/real-files/browse',
          path: directoryData.path,
          itemCount: directoryData.items.length,
          totalSize: directoryData.totalSize,
          items: directoryData.items.map(item => ({
            name: item.name,
            type: item.type,
            size: item.size,
            permissions: item.permissions
          }))
        });
        
        return directoryData;

      } catch (error: any) {
        console.error('❌ Directory fetch error:', error);
        console.error('❌ Error details:', {
          message: error.message,
          stack: error.stack,
          currentPath,
          fileSystemMode
        });
        
        log('API Query Error', {
          endpoint: '/api/real-files/browse',
          error: error.message,
          stack: error.stack,
          currentPath,
          fileSystemMode,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        });
        
        throw new Error(error.message || 'Failed to load directory contents');
      }
    },
    enabled: fileSystemMode === 'real' && !!currentPath && currentPath.length > 0,
    retry: (failureCount, error: Error) => {
      console.log(`🔄 Retry attempt ${failureCount} for error:`, error.message);
      
      // Don't retry on path validation errors
      if (error.message.includes('Path validation failed') || 
          error.message.includes('Access denied') ||
          error.message.includes('404') ||
          error.message.includes('403') ||
          error.message.includes('Invalid directory data format')) {
        console.log('🚫 Not retrying due to permanent error:', error.message);
        return false;
      }
      return failureCount < 2;
    },
    staleTime: 0, // Always fetch fresh data
    gcTime: 1000 * 60 * 5, // Keep in cache for 5 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: true
  });

  // Search database files
  const { data: databaseSearchResults = [], isLoading: isDatabaseSearching } = useQuery<DatabaseFileItem[]>({
    queryKey: ['/api/files/search', searchQuery],
    enabled: searchQuery.length > 0 && fileSystemMode === 'database',
  });

  // Read file content query with timeout and retry
  const readFileContentQuery = useMutation({
    mutationFn: async (filePath: string) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      try {
        const response = await apiRequest('GET', `/api/real-files/content?path=${encodeURIComponent(filePath)}`);
        clearTimeout(timeoutId);
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || result.message || 'فشل في قراءة الملف');
        }

        return result.data;
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('انتهت مهلة الاتصال - تجاوز الطلب الوقت المحدد');
        }
        throw error;
      }
    },
    retry: (failureCount, error: Error) => {
      // Retry up to 2 times for network errors, but not for file access errors
      if (failureCount < 2 && 
          !error.message.includes('Path validation failed') && 
          !error.message.includes('Access denied') &&
          !error.message.includes('not found')) {
        return true;
      }
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000), // Exponential backoff
  });

  // Define isSearching variable for loading states
  const isSearching = searchQuery.length > 0 && fileSystemMode === 'database' && isDatabaseSearching;

  // File content reader function
  const readFileContent = useCallback(async (file: FileItem) => {
    log('User Action: Read File Content', {
      fileName: file.name,
      fileSize: file.size,
      fileSystemMode,
      filePath: (file as RealFileItem).absolutePath
    });

    if (fileSystemMode !== 'real') {
      log('File Read Error: Wrong File System Mode', {
        currentMode: fileSystemMode,
        requiredMode: 'real'
      });
      toast({
        title: "غير مدعوم",
        description: "قراءة المحتوى متوفرة فقط للملفات الحقيقية",
        variant: "destructive"
      });
      return;
    }

    const realFile = file as RealFileItem;

    // Check if file is too large (>5MB)
    if (realFile.size > 5 * 1024 * 1024) {
      log('File Read Error: File Too Large', {
        fileName: realFile.name,
        fileSize: realFile.size,
        maxSize: 5 * 1024 * 1024
      });
      toast({
        title: "ملف كبير جداً",
        description: "لا يمكن معاينة الملفات الأكبر من 5 ميجابايت",
        variant: "destructive"
      });
      return;
    }

    log('File Read: Starting', {
      fileName: realFile.name,
      filePath: realFile.absolutePath,
      fileSize: realFile.size,
      mimeType: realFile.mimeType
    });

    setSelectedFile(file);
    setIsLoadingContent(true);
    setContentError(null);
    setFileContent('');
    setIsFilePreviewOpen(true);

    try {
      log('File Read: API Call Started', {
        filePath: realFile.absolutePath
      });
      const contentData = await readFileContentQuery.mutateAsync(realFile.absolutePath);
      log('File Read: Success', {
        contentLength: contentData.content?.length || 0,
        hasContent: !!contentData.content
      });
      setFileContent(contentData.content || '');
    } catch (error: any) {
      log('File Read: Error', {
        error: error.message,
        filePath: realFile.absolutePath,
        stack: error.stack
      });
      setContentError(error.message || 'فشل في قراءة الملف');
      toast({
        title: "خطأ في القراءة",
        description: error.message || 'فشل في قراءة الملف',
        variant: "destructive"
      });
    } finally {
      setIsLoadingContent(false);
      log('File Read: Completed', {
        fileName: realFile.name,
        success: !contentError
      });
    }
  }, [fileSystemMode, readFileContentQuery, toast]);

  // Create new file/folder mutation with improved error handling (moved up to fix dependency)
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
    onError: (error: any) => {
      const errorMessage = error?.message || 'فشل في إنشاء العنصر';
      toast({
        title: "خطأ في الإنشاء",
        description: errorMessage,
        variant: "destructive"
      });
    }
  });

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
    log('Computing Current Files', {
      fileSystemMode,
      searchQuery,
      activeTab,
      sortBy,
      sortOrder,
      realFilesDataExists: !!realFilesData,
      realFilesDataItems: realFilesData?.items?.length || 0,
      realFilesDataPath: realFilesData?.path,
      databaseFilesCount: databaseFiles?.length || 0,
      databaseSearchResultsCount: databaseSearchResults?.length || 0
    });
    console.log('🔍 Computing currentFiles:', {
      fileSystemMode,
      searchQuery,
      realFilesDataExists: !!realFilesData,
      realFilesDataItems: realFilesData?.items?.length || 0,
      realFilesDataPath: realFilesData?.path
    });

    let files = fileSystemMode === 'database' 
      ? (searchQuery ? databaseSearchResults : databaseFiles)
      : (realFilesData?.items || []);

    console.log('📁 Files before filtering:', files.length);

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

  // Pull to refresh handler
  const handlePullToRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  // Drag & Drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    dragCounter.current = 0;

    if (fileSystemMode !== 'real') {
      toast({
        title: "غير مدعوم",
        description: "رفع الملفات متوفر فقط في وضع الملفات الحقيقية",
        variant: "destructive"
      });
      return;
    }

    const files = Array.from(e.dataTransfer.files);

    for (const file of files) {
      if (file.size > 50 * 1024 * 1024) { // 50MB limit
        toast({
          title: "ملف كبير جداً",
          description: `الملف ${file.name} أكبر من 50 ميجابايت`,
          variant: "destructive"
        });
        continue;
      }

      try {
        const content = await file.text();
        await createItemMutation.mutateAsync({
          name: file.name,
          type: 'file',
          content
        });

        toast({
          title: "تم الرفع",
          description: `تم رفع ${file.name} بنجاح`
        });
      } catch (error: any) {
        toast({
          title: "فشل الرفع",
          description: `فشل في رفع ${file.name}: ${error.message}`,
          variant: "destructive"
        });
      }
    }
  }, [fileSystemMode, createItemMutation, toast]);

  const handleFileInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    for (const file of files) {
      try {
        const content = await file.text();
        await createItemMutation.mutateAsync({
          name: file.name,
          type: 'file',
          content
        });

        toast({
          title: "تم الرفع",
          description: `تم رفع ${file.name} بنجاح`
        });
      } catch (error: any) {
        toast({
          title: "فشل الرفع",
          description: `فشل في رفع ${file.name}: ${error.message}`,
          variant: "destructive"
        });
      }
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [createItemMutation, toast]);

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

      // If returning to home, show main libraries
      if (newBreadcrumbs.length === 1) {
        setShowMainLibraries(true);
        setStorageSection('main');
        return;
      }

      if (fileSystemMode === 'database') {
        setCurrentFolderId(newBreadcrumbs[newBreadcrumbs.length - 1].id);
      } else {
        setCurrentPath(newBreadcrumbs[newBreadcrumbs.length - 1].path);
      }
    }
  };


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
    log('User Action: Folder Click', {
      fileSystemMode,
      itemName: item.name,
      itemType: getItemType(item),
      currentPath: fileSystemMode === 'real' ? currentPath : currentFolderId,
      newPath: fileSystemMode === 'database' ? (item as DatabaseFileItem).id : (item as RealFileItem).absolutePath
    });

    if (fileSystemMode === 'database') {
      const dbItem = item as DatabaseFileItem;
      log('Database Navigation', {
        from: currentFolderId,
        to: dbItem.id,
        folderName: dbItem.name
      });
      setCurrentFolderId(dbItem.id);
      setBreadcrumbs([...breadcrumbs, { 
        id: dbItem.id, 
        name: dbItem.name, 
        path: dbItem.path 
      }]);
    } else {
      const realItem = item as RealFileItem;
      if (realItem.type === 'directory') {
        log('Real File Navigation', {
          from: currentPath,
          to: realItem.absolutePath,
          folderName: realItem.name,
          permissions: realItem.permissions
        });
        setCurrentPath(realItem.absolutePath);
        setBreadcrumbs([...breadcrumbs, { 
          id: `path-${realItem.absolutePath}-${Date.now()}`, 
          name: realItem.name, 
          path: realItem.absolutePath 
        }]);
      }
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    const targetBreadcrumb = newBreadcrumbs[newBreadcrumbs.length - 1];
    
    log('User Action: Breadcrumb Click', {
      clickedIndex: index,
      totalBreadcrumbs: breadcrumbs.length,
      targetBreadcrumb: targetBreadcrumb,
      isHome: index === 0,
      fileSystemMode
    });

    setBreadcrumbs(newBreadcrumbs);

    // If clicking on the first breadcrumb (home), return to main libraries
    if (index === 0) {
      log('Navigation: Return to Home', {
        from: fileSystemMode === 'real' ? currentPath : currentFolderId,
        action: 'show_main_libraries'
      });
      setShowMainLibraries(true);
      setStorageSection('main');
      return;
    }

    if (fileSystemMode === 'database') {
      log('Database Breadcrumb Navigation', {
        from: currentFolderId,
        to: targetBreadcrumb.id,
        targetName: targetBreadcrumb.name
      });
      setCurrentFolderId(targetBreadcrumb.id);
    } else {
      log('Real File Breadcrumb Navigation', {
        from: currentPath,
        to: targetBreadcrumb.path,
        targetName: targetBreadcrumb.name
      });
      setCurrentPath(targetBreadcrumb.path);
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
    
    log('User Action: File System Mode Change', {
      from: fileSystemMode,
      to: newMode,
      checked,
      currentPath: fileSystemMode === 'real' ? currentPath : currentFolderId,
      selectedItemsCount: selectedItems.length,
      searchQuery
    });

    setFileSystemMode(newMode);
    setSelectedItems([]);
    setSearchQuery('');
    setPathError(null);
    // Reset to main libraries view when changing file system mode
    setShowMainLibraries(true);
    setStorageSection('main');
    setBreadcrumbs([{ id: null, name: 'الرئيسية', path: '/' }]);

    log('File System Mode Changed', {
      newMode,
      resetToMainLibraries: true,
      clearedState: {
        selectedItems: true,
        searchQuery: true,
        pathError: true
      }
    });
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

  const getSectionTitle = (section: string): string => {
    const titles: { [key: string]: string } = {
      'main': 'الرئيسية',
      'main-storage': 'التخزين الرئيسي',
      'downloads': 'التحميلات',
      'analysis': 'تحليل التخزين',
      'pictures': 'الصور',
      'music': 'الصوت',
      'video': 'الفيديو',
      'documents': 'الوثائق',
      'apps': 'التطبيقات',
      'recent': 'الملفات الحديثة',
      'cloud': 'السحابة',
      'remote': 'البعيد',
      'network': 'الوصول من الشبكة',
      'trash': 'سلة المحذوفات'
    };
    return titles[section] || 'التخزين الرئيسي';
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

  // Storage Statistics Types
  interface StorageStats {
    totalSpace: number;
    usedSpace: number;
    freeSpace: number;
    usagePercentage: number;
  }

  interface CategoryStats {
    id: string;
    name: string;
    size: number;
    fileCount: number;
    icon: string;
    iconColor: string;
    bgColor: string;
  }

  interface SystemStats {
    mainStorage: StorageStats;
    categories: CategoryStats[];
    recentFiles: CategoryStats;
    trash: CategoryStats;
  }

  // Fetch storage statistics
  const { data: storageStats, isLoading: isStorageLoading } = useQuery<{ success: boolean; data: SystemStats }>({
    queryKey: ['/api/storage/stats'],
    enabled: showMainLibraries
  });

  // Helper function to format bytes
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Main Libraries Grid Component
  const MainLibrariesGrid = () => {
    // Get icon component from string name
    const getIconComponent = (iconName: string) => {
      const icons: { [key: string]: React.ComponentType<{ className?: string }> } = {
        'HardDrive': HardDrive,
        'Download': Download,
        'Database': Database,
        'Image': Image,
        'Music': Music,
        'Video': Video,
        'FileText': FileText,
        'Smartphone': Smartphone,
        'Clock': Clock,
        'Cloud': Cloud,
        'Trash2': Trash2
      };
      return icons[iconName] || HardDrive;
    };

    if (isStorageLoading) {
      return (
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
            {Array.from({ length: 12 }).map((_, index) => (
              <div
                key={index}
                className="flex flex-col items-center text-center p-4 sm:p-6 rounded-2xl bg-gray-100 animate-pulse"
              >
                <div className="w-12 h-12 rounded-full bg-gray-300 mb-3"></div>
                <div className="w-16 h-4 bg-gray-300 rounded mb-2"></div>
                <div className="w-12 h-3 bg-gray-300 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    const stats = storageStats?.data;
    if (!stats) {
      return (
        <div className="p-4 sm:p-6">
          <div className="text-center text-gray-500">
            فشل في تحميل إحصائيات التخزين
          </div>
        </div>
      );
    }

    // Build libraries array from real data
    const libraries = [
      {
        id: 'main-storage',
        name: 'التخزين الرئيسي',
        subtitle: `${formatBytes(stats.mainStorage.usedSpace)} / ${formatBytes(stats.mainStorage.totalSpace)}`,
        icon: HardDrive,
        iconColor: 'text-gray-600',
        bgColor: 'bg-gray-100',
        showProgress: true,
        progress: stats.mainStorage.usagePercentage,
        onClick: () => {
          setShowMainLibraries(false);
          setStorageSection('main-storage');
          setBreadcrumbs([
            { id: null, name: 'الرئيسية', path: '/' },
            { id: null, name: 'التخزين الرئيسي', path: '/main-storage' }
          ]);
        }
      },
      ...stats.categories.map(category => ({
        id: category.id,
        name: category.name,
        subtitle: `${formatBytes(category.size)} (${category.fileCount})`,
        icon: getIconComponent(category.icon),
        iconColor: category.iconColor,
        bgColor: category.bgColor,
        onClick: () => {
          setShowMainLibraries(false);
          setStorageSection(category.id);
          setBreadcrumbs([
            { id: null, name: 'الرئيسية', path: '/' },
            { id: null, name: category.name, path: `/${category.id}` }
          ]);
        }
      })),
      {
        id: 'analysis',
        name: 'تحليل التخزين',
        subtitle: `مستخدم ${stats.mainStorage.usagePercentage}%`,
        icon: Database,
        iconColor: 'text-gray-600',
        bgColor: 'bg-gray-100',
        onClick: () => {
          setShowMainLibraries(false);
          setStorageSection('analysis');
          setBreadcrumbs([
            { id: null, name: 'الرئيسية', path: '/' },
            { id: null, name: 'تحليل التخزين', path: '/analysis' }
          ]);
        }
      },
      {
        id: 'recent',
        name: stats.recentFiles.name,
        subtitle: `${formatBytes(stats.recentFiles.size)} (${stats.recentFiles.fileCount})`,
        icon: Clock,
        iconColor: stats.recentFiles.iconColor,
        bgColor: stats.recentFiles.bgColor,
        onClick: () => {
          setShowMainLibraries(false);
          setStorageSection('recent');
          setBreadcrumbs([
            { id: null, name: 'الرئيسية', path: '/' },
            { id: null, name: 'الملفات الحديثة', path: '/recent' }
          ]);
        }
      },
      {
        id: 'cloud',
        name: 'سحابة',
        subtitle: '',
        icon: Cloud,
        iconColor: 'text-blue-600',
        bgColor: 'bg-blue-100',
        onClick: () => {
          setShowMainLibraries(false);
          setStorageSection('cloud');
          setBreadcrumbs([
            { id: null, name: 'الرئيسية', path: '/' },
            { id: null, name: 'السحابة', path: '/cloud' }
          ]);
        }
      },
      {
        id: 'remote',
        name: 'بعيد',
        subtitle: '(0)',
        icon: HardDrive,
        iconColor: 'text-gray-600',
        bgColor: 'bg-gray-100',
        onClick: () => {
          setShowMainLibraries(false);
          setStorageSection('remote');
          setBreadcrumbs([
            { id: null, name: 'الرئيسية', path: '/' },
            { id: null, name: 'البعيد', path: '/remote' }
          ]);
        }
      },
      {
        id: 'network',
        name: 'الوصول من الشبكة',
        subtitle: '',
        icon: Cloud,
        iconColor: 'text-green-600',
        bgColor: 'bg-green-100',
        onClick: () => {
          setShowMainLibraries(false);
          setStorageSection('network');
          setBreadcrumbs([
            { id: null, name: 'الرئيسية', path: '/' },
            { id: null, name: 'الوصول من الشبكة', path: '/network' }
          ]);
        }
      },
      {
        id: 'trash',
        name: stats.trash.name,
        subtitle: formatBytes(stats.trash.size),
        icon: Trash2,
        iconColor: stats.trash.iconColor,
        bgColor: stats.trash.bgColor,
        onClick: () => {
          setShowMainLibraries(false);
          setStorageSection('trash');
          setBreadcrumbs([
            { id: null, name: 'الرئيسية', path: '/' },
            { id: null, name: 'سلة المحذوفات', path: '/trash' }
          ]);
        }
      }
    ];

    return (
      <div className="p-4 sm:p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
          {libraries.map((library) => (
            <div
              key={library.id}
              className="flex flex-col items-center text-center cursor-pointer p-4 sm:p-6 rounded-2xl hover:bg-gray-50 transition-colors duration-200 touch-manipulation"
              onClick={library.onClick}
              data-testid={`library-${library.id}`}
            >
              <div className={cn(
                "w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-2xl flex items-center justify-center mb-3 sm:mb-4 shadow-sm",
                library.bgColor
              )}>
                <library.icon className={cn("w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12", library.iconColor)} />
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-1 leading-tight">
                {library.name}
              </h3>
              {library.subtitle && (
                <p className="text-xs sm:text-sm text-gray-600 font-medium leading-tight">
                  {library.subtitle}
                </p>
              )}
              {(library as any).showProgress && (
                <div className="w-full mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div 
                      className="bg-gray-700 h-1.5 rounded-full transition-all duration-300" 
                      style={{ width: `${(library as any).progress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

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
        <DialogContent className="sm:max-w-[400px] mx-4 rounded-lg" data-testid="create-item-modal">
          <DialogHeader>
            <DialogTitle className="text-center">
              {itemType === 'folder' ? 'إنشاء مجلد' : 'إنشاء ملف'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Input
                placeholder={itemType === 'folder' ? 'اسم المجلد' : 'اسم الملف'}
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className="w-full"
                data-testid="input-item-name"
                autoFocus
              />
            </div>

            {/* File Content (only for real files) */}
            {itemType === 'file' && fileSystemMode === 'real' && (
              <div>
                <textarea
                  placeholder="محتوى الملف (اختياري)"
                  value={fileContent}
                  onChange={(e) => setFileContent(e.target.value)}
                  className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="textarea-file-content"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
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
        // Open file preview/content viewer
        readFileContent(item);
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
        // Open file in edit mode
        readFileContent(item);
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
        { icon: History, label: 'الإصدارات', onClick: () => {
          toast({
            title: "قريباً",
            description: "سيتم إضافة إدارة الإصدارات قريباً",
          });
        }, disabled: itemType === 'folder' },
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
      className="h-screen w-full flex flex-col bg-background text-foreground"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleFileDrop}
    >
      {/* File Manager Header */}
      <div className="bg-gray-900 dark:bg-black text-white p-3 sm:p-4">
        <div className="flex items-center justify-between">
          {/* Left: Action Icons */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-10 w-10 p-0 text-white hover:bg-white/20 touch-manipulation"
              onClick={() => setShowSidebar(true)}
              data-testid="button-menu"
            >
              <Menu className="w-5 h-5" />
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
              onClick={() => {
                const searchInput = document.querySelector('[data-testid="input-search"]') as HTMLInputElement;
                searchInput?.focus();
              }}
              data-testid="button-search"
            >
              <Search className="w-5 h-5" />
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-10 w-10 p-0 text-white hover:bg-white/20 touch-manipulation"
                  data-testid="button-add"
                >
                  <Plus className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-auto rounded-t-lg">
                <div className="p-4">
                  <h3 className="text-lg font-medium text-center mb-4 text-gray-900">جديد</h3>
                  <div className="space-y-3">
                    <Button
                      onClick={() => {
                        setItemType('file');
                        setIsCreateModalOpen(true);
                      }}
                      className="w-full flex items-center justify-start gap-4 h-14 bg-transparent border-0 text-gray-900 hover:bg-gray-50"
                      variant="ghost"
                      data-testid="button-create-file"
                    >
                      <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center">
                        <FileIcon className="w-5 h-5 text-gray-600" />
                      </div>
                      <span className="text-base">ملف</span>
                    </Button>
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center justify-start gap-4 h-14 bg-transparent border-0 text-gray-900 hover:bg-gray-50"
                      variant="ghost"
                      data-testid="button-upload-file"
                    >
                      <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center">
                        <Upload className="w-5 h-5 text-gray-600" />
                      </div>
                      <span className="text-base">رفع ملف</span>
                    </Button>
                    <Button
                      onClick={() => {
                        setItemType('folder');
                        setIsCreateModalOpen(true);
                      }}
                      className="w-full flex items-center justify-start gap-4 h-14 bg-transparent border-0 text-gray-900 hover:bg-gray-50"
                      variant="ghost"
                      data-testid="button-create-folder"
                    >
                      <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center">
                        <Folder className="w-5 h-5 text-gray-600" />
                      </div>
                      <span className="text-base">مجلد</span>
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Center: Title */}
          <div className="flex items-center justify-center flex-1 mx-4">
            <h1 className="text-lg sm:text-xl font-semibold text-center">
              مدير الملفات +
            </h1>
          </div>

          {/* Right: Home and Refresh Icons */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-10 w-10 p-0 text-white hover:bg-white/20 touch-manipulation"
              onClick={handlePullToRefresh}
              disabled={isRefreshing}
              data-testid="button-refresh"
              title="تحديث"
            >
              <RefreshCw className={cn("w-5 h-5", isRefreshing && "animate-spin")} />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-10 w-10 p-0 text-white hover:bg-white/20 touch-manipulation"
              onClick={() => {
                // Navigate to main screen/home
                setShowMainLibraries(true);
                setStorageSection('main');
                setBreadcrumbs([{ id: null, name: 'الرئيسية', path: '/home/administrator' }]);
                setActiveTab('files');
                if (fileSystemMode === 'database') {
                  setCurrentFolderId(null);
                } else {
                  const initialPath = '/home/administrator';
                  setCurrentPath(initialPath);
                }
              }}
              data-testid="button-home"
              title="الرئيسية"
            >
              <Home className="w-5 h-5" />
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
            <div key={crumb.id || `breadcrumb-${index}`} className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
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
          <Alert className="mb-4 mx-2 sm:mx-0" data-testid="path-error-alert" variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>خطأ في المسار:</strong> {pathError}
              <div className="mt-2 text-xs text-gray-600">
                <p>المسار الحالي: {currentPath}</p>
                <p>نوع النظام: {fileSystemMode}</p>
                <p>تحميل البيانات: {isRealFilesLoading ? 'جاري...' : 'منتهي'}</p>
              </div>
              <div className="mt-2 flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => {
                    setCurrentPath('/home/administrator');
                    setPathError(null);
                    setBreadcrumbs([{ id: 'root', name: 'الرئيسية', path: '/home/administrator' }]);
                  }}
                  className="h-6 text-xs"
                >
                  العودة للمجلد الرئيسي
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={handlePullToRefresh}
                  disabled={isRefreshing}
                  className="h-6 text-xs"
                >
                  إعادة المحاولة
                </Button>
              </div>
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

        {/* Search and Filters - Only show when not in main libraries view */}
        {!showMainLibraries && (
          <>
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
          </>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        {showMainLibraries ? (
          /* Main Libraries Grid */
          <MainLibrariesGrid />
        ) : (
          /* Files Content */
          <ScrollArea className="h-full">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
                <span className="mr-2 text-muted-foreground">جاري التحميل...</span>
              </div>
            ) : currentFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center mb-4">
                  <FolderOpen className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-muted-foreground mb-2">
                  لا توجد ملفات
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  {searchQuery ? 'لم يتم العثور على ملفات تطابق البحث' : 'هذا المجلد فارغ'}
                </p>
              </div>
            ) : (
              <div className="p-2 sm:p-4">
                {/* View Mode Controls */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={viewMode === 'grid' ? 'default' : 'outline'}
                      onClick={() => setViewMode('grid')}
                      className="touch-manipulation"
                      data-testid="button-grid-view"
                    >
                      <Grid3X3 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant={viewMode === 'list' ? 'default' : 'outline'}
                      onClick={() => setViewMode('list')}
                      className="touch-manipulation"
                      data-testid="button-list-view"
                    >
                      <List className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Advanced Sort Options */}
                  <div className="flex items-center gap-1">
                    {/* No Sort Option */}
                    <Button
                      size="sm"
                      variant={sortBy === 'none' ? 'default' : 'outline'}
                      onClick={() => setSortBy('none')}
                      className="touch-manipulation text-xs"
                      data-testid="button-sort-none"
                    >
                      بدون فرز
                    </Button>

                    {/* Name Sort */}
                    <Button
                      size="sm"
                      variant={sortBy === 'name' ? 'default' : 'outline'}
                      onClick={() => {
                        if (sortBy === 'name') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('name');
                          setSortOrder('asc');
                        }
                      }}
                      className="touch-manipulation text-xs flex items-center gap-1"
                      data-testid="button-sort-name"
                    >
                      الاسم
                      {sortBy === 'name' && (
                        sortOrder === 'asc' ? <span>▲</span> : <span>▼</span>
                      )}
                    </Button>

                    {/* Size Sort */}
                    <Button
                      size="sm"
                      variant={sortBy === 'size' ? 'default' : 'outline'}
                      onClick={() => {
                        if (sortBy === 'size') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('size');
                          setSortOrder('asc');
                        }
                      }}
                      className="touch-manipulation text-xs flex items-center gap-1"
                      data-testid="button-sort-size"
                    >
                      الحجم
                      {sortBy === 'size' && (
                        sortOrder === 'asc' ? <span>▲</span> : <span>▼</span>
                      )}
                    </Button>

                    {/* Date Sort */}
                    <Button
                      size="sm"
                      variant={sortBy === 'date' ? 'default' : 'outline'}
                      onClick={() => {
                        if (sortBy === 'date') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('date');
                          setSortOrder('asc');
                        }
                      }}
                      className="touch-manipulation text-xs flex items-center gap-1"
                      data-testid="button-sort-date"
                    >
                      التاريخ
                      {sortBy === 'date' && (
                        sortOrder === 'asc' ? <span>▲</span> : <span>▼</span>
                      )}
                    </Button>

                    {/* Type Sort */}
                    <Button
                      size="sm"
                      variant={sortBy === 'type' ? 'default' : 'outline'}
                      onClick={() => {
                        if (sortBy === 'type') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('type');
                          setSortOrder('asc');
                        }
                      }}
                      className="touch-manipulation text-xs flex items-center gap-1"
                      data-testid="button-sort-type"
                    >
                      النوع
                      {sortBy === 'type' && (
                        sortOrder === 'asc' ? <span>▲</span> : <span>▼</span>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Files Grid/List View */}
                <div className={cn(
                  viewMode === 'grid' 
                    ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4"
                    : "space-y-1"
                )}>
                  {currentFiles.map((item) => (
                    <FileItem key={getItemKey(item)} item={item} />
                  ))}
                </div>
              </div>
            )}
          </ScrollArea>
        )}
      </div>

      {/* Hidden file input for drag & drop */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
        accept="*/*"
      />

      {/* Drag overlay */}
      {isDragOver && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-white rounded-lg p-8 text-center shadow-xl">
            <Upload className="w-16 h-16 mx-auto mb-4 text-blue-600" />
            <h3 className="text-xl font-semibold mb-2">اترك الملفات هنا</h3>
            <p className="text-gray-600">سيتم رفع الملفات إلى المجلد الحالي</p>
          </div>
        </div>
      )}

      {/* Modals & Dialogs */}
      <CreateItemModal />

      {/* File Preview Dialog */}
      <Dialog open={isFilePreviewOpen} onOpenChange={setIsFilePreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" data-testid="file-preview-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              معاينة الملف: {selectedFile?.name}
            </DialogTitle>
            <DialogDescription>
              المسار: {(selectedFile as RealFileItem)?.absolutePath}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            {isLoadingContent ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
                  <p>جاري قراءة الملف...</p>
                </div>
              </div>
            ) : contentError ? (
              <Alert variant="destructive" className="h-64 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
                <AlertDescription className="ml-2">
                  <strong>خطأ في قراءة الملف:</strong><br />
                  {contentError}
                </AlertDescription>
              </Alert>
            ) : (
              <ScrollArea className="h-[60vh] w-full border rounded-md">
                <div className="p-4">
                  {selectedFile && (selectedFile as RealFileItem).mimeType?.startsWith('image/') ? (
                    <div className="text-center">
                      <img 
                        src={`/api/real-files/content?path=${encodeURIComponent((selectedFile as RealFileItem).absolutePath)}`}
                        alt={selectedFile.name}
                        className="max-w-full max-h-[50vh] mx-auto rounded-lg shadow-md"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          setContentError('فشل في تحميل الصورة');
                        }}
                      />
                    </div>
                  ) : (
                    <Textarea 
                      value={fileContent}
                      onChange={(e) => setFileContent(e.target.value)}
                      className="min-h-[50vh] font-mono text-sm"
                      placeholder="محتوى الملف..."
                      data-testid="textarea-file-content-viewer"
                    />
                  )}
                </div>
              </ScrollArea>
            )}
          </div>

          <div className="flex justify-between items-center pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {selectedFile && (
                <>
                  <span>الحجم: {formatFileSize(selectedFile.size)}</span>
                  {(selectedFile as RealFileItem).mimeType && (
                    <span className="border-l pl-2 ml-2">النوع: {(selectedFile as RealFileItem).mimeType}</span>
                  )}
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setIsFilePreviewOpen(false)}
                data-testid="button-close-preview"
              >
                إغلاق
              </Button>
              {selectedFile && !isLoadingContent && !contentError && (
                <Button 
                  onClick={() => {
                    const realFile = selectedFile as RealFileItem;
                    window.open(`/api/real-files/content?path=${encodeURIComponent(realFile.absolutePath)}`, '_blank');
                  }}
                  data-testid="button-download-preview"
                >
                  <Download className="w-4 h-4 mr-2" />
                  تحميل
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

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