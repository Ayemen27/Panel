import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
  RefreshCw,
  ChevronRight,
  Home,
  Eye,
  Download,
  Trash2,
  AlertTriangle,
  FolderOpen,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import React from "react";

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): { hasError: boolean; error: Error } {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("FileManager Error Boundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
          <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-red-600 mb-2">حدث خطأ في مدير الملفات</h2>
          <p className="text-gray-600 text-center mb-4">
            {this.state.error?.message || "خطأ غير معروف"}
          </p>
          <Button
            onClick={() => {
              this.setState({ hasError: false, error: undefined });
              window.location.reload();
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            إعادة تحميل الصفحة
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
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

interface BreadcrumbItem {
  id: string | null;
  name: string;
  path: string;
}

// Simple debug logging (can be easily disabled)
const debugLog = (message: string, data?: any) => {
  if (import.meta.env.DEV) {
    console.log(`🔍 [FileManager Debug] ${message}:`, data || '');
  }
};

// Main FileManager Component
function FileManagerCore() {
  const { toast } = useToast();

  // State
  const [currentPath, setCurrentPath] = useState<string>('/home/administrator');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [pathError, setPathError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<RealFileItem | null>(null);
  const [isFilePreviewOpen, setIsFilePreviewOpen] = useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [fileContent, setFileContent] = useState<string>('');
  const [contentError, setContentError] = useState<string | null>(null);

  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: 'root', name: 'الرئيسية', path: '/home/administrator' }
  ]);

  debugLog('FileManager initialized', {
    currentPath,
    viewMode,
    breadcrumbsLength: breadcrumbs.length
  });

  // Fetch real files
  const { 
    data: realFilesData, 
    isLoading: isRealFilesLoading, 
    error: realFilesError, 
    refetch: refetchRealFiles 
  } = useQuery<DirectoryListing>({
    queryKey: ['/api/real-files/browse', currentPath],
    queryFn: async () => {
      debugLog('API Query Started', { currentPath });

      try {
        const response = await apiRequest('GET', '/api/real-files/browse', {
          path: currentPath
        });

        debugLog('API Response status', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          debugLog('API Error response', errorText);
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        debugLog('API Success response', result);

        // Handle different response formats
        let directoryData: DirectoryListing;

        if (result.success === false) {
          throw new Error(result.error || result.message || 'API returned failure status');
        }

        if (result.success && result.data) {
          directoryData = result.data;
        } else if (result.path && result.items) {
          directoryData = result;
        } else if (result.data && result.data.path && result.data.items) {
          directoryData = result.data;
        } else {
          debugLog('Unexpected response format', result);
          throw new Error('Invalid directory data format received');
        }

        if (!directoryData.items || !Array.isArray(directoryData.items)) {
          debugLog('Invalid items array', directoryData.items);
          throw new Error('Directory items is not a valid array');
        }

        debugLog('Directory data processed successfully', {
          path: directoryData.path,
          itemCount: directoryData.items.length,
          totalSize: directoryData.totalSize
        });

        return directoryData;

      } catch (error: any) {
        debugLog('API Query Error', {
          error: error.message,
          stack: error.stack,
          currentPath
        });

        throw new Error(error.message || 'Failed to load directory contents');
      }
    },
    enabled: !!currentPath && currentPath.length > 0,
    retry: (failureCount, error: Error) => {
      debugLog('Query retry attempt', { failureCount, error: error.message });

      if (error.message.includes('Path validation failed') || 
          error.message.includes('Access denied') ||
          error.message.includes('404') ||
          error.message.includes('403')) {
        debugLog('Not retrying due to permanent error', error.message);
        return false;
      }
      return failureCount < 2;
    },
    staleTime: 0,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: true,
    refetchOnMount: true
  });

  // Handle path errors
  useEffect(() => {
    if (realFilesError) {
      debugLog('Real files error detected', realFilesError.message);
      setPathError(realFilesError.message);
    } else if (!isRealFilesLoading && realFilesData) {
      setPathError(null);
    }
  }, [realFilesError, isRealFilesLoading, realFilesData]);

  // Get current files with error handling
  const currentFiles = useMemo(() => {
    try {
      debugLog('Computing current files', {
        realFilesDataExists: !!realFilesData,
        itemsLength: realFilesData?.items?.length || 0,
        searchQuery
      });

      if (!realFilesData || !realFilesData.items) {
        debugLog('No real files data available');
        return [];
      }

      let files = realFilesData.items;

      // Apply search filter if needed
      if (searchQuery.trim()) {
        files = files.filter(file => 
          file.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
        debugLog('Applied search filter', {
          searchQuery,
          filteredCount: files.length,
          originalCount: realFilesData.items.length
        });
      }

      debugLog('Current files computed', {
        totalFiles: files.length,
        fileTypes: files.reduce((acc, file) => {
          acc[file.type] = (acc[file.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      });

      return files;
    } catch (error: any) {
      debugLog('Error computing current files', {
        error: error.message,
        stack: error.stack
      });
      return [];
    }
  }, [realFilesData, searchQuery]);

  // Handlers
  const handleFolderClick = useCallback((item: RealFileItem) => {
    try {
      debugLog('Folder click', {
        itemName: item.name,
        itemType: item.type,
        absolutePath: item.absolutePath
      });

      if (item.type === 'directory') {
        setCurrentPath(item.absolutePath);
        setBreadcrumbs(prev => [...prev, { 
          id: `path-${item.absolutePath}-${Date.now()}`, 
          name: item.name, 
          path: item.absolutePath 
        }]);
        debugLog('Navigation updated', {
          newPath: item.absolutePath,
          breadcrumbsLength: breadcrumbs.length + 1
        });
      }
    } catch (error: any) {
      debugLog('Error in folder click', {
        error: error.message,
        itemName: item.name
      });
      toast({
        title: "خطأ في التنقل",
        description: error.message,
        variant: "destructive"
      });
    }
  }, [breadcrumbs.length, toast]);

  const handleBreadcrumbClick = useCallback((index: number) => {
    try {
      const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
      const targetBreadcrumb = newBreadcrumbs[newBreadcrumbs.length - 1];

      debugLog('Breadcrumb click', {
        clickedIndex: index,
        targetPath: targetBreadcrumb.path,
        newBreadcrumbsLength: newBreadcrumbs.length
      });

      setBreadcrumbs(newBreadcrumbs);
      setCurrentPath(targetBreadcrumb.path);
    } catch (error: any) {
      debugLog('Error in breadcrumb click', {
        error: error.message,
        index
      });
      toast({
        title: "خطأ في التنقل",
        description: error.message,
        variant: "destructive"
      });
    }
  }, [breadcrumbs, toast]);

  const handlePullToRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      debugLog('Manual refresh started');
      await refetchRealFiles();
      debugLog('Manual refresh completed');
    } catch (error: any) {
      debugLog('Manual refresh error', error.message);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchRealFiles]);

  // Helper functions
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
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

  const getFileIcon = (item: RealFileItem) => {
    if (item.type === 'directory') {
      return item.name.startsWith('.') ? FolderOpen : Folder;
    }
    return FileIcon;
  };

  // File Item Component
  const FileItem = ({ item }: { item: RealFileItem }) => {
    const Icon = getFileIcon(item);

    const handleClick = () => {
      if (item.type === 'directory') {
        handleFolderClick(item);
      } else {
        // For files, just show info for now
        toast({
          title: item.name,
          description: `الحجم: ${formatFileSize(item.size)} | تم التعديل: ${formatDate(item.modified)}`,
        });
      }
    };

    if (viewMode === 'grid') {
      return (
        <Card
          className="p-4 cursor-pointer transition-all hover:shadow-md"
          onClick={handleClick}
        >
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

    // List view
    return (
      <div
        className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all hover:bg-muted/50"
        onClick={handleClick}
      >
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

  // Render component
  try {
    debugLog('Rendering FileManager', {
      isLoading: isRealFilesLoading,
      hasData: !!realFilesData,
      filesCount: currentFiles.length,
      hasError: !!pathError
    });

    return (
      <div className="h-screen w-full flex flex-col bg-background text-foreground">
        {/* Header */}
        <div className="bg-gray-900 text-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-10 w-10 p-0 text-white hover:bg-white/20"
                onClick={() => setSearchQuery('')}
              >
                <Search className="w-5 h-5" />
              </Button>
            </div>

            <h1 className="text-xl font-semibold">مدير الملفات</h1>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-10 w-10 p-0 text-white hover:bg-white/20"
                onClick={handlePullToRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={cn("w-5 h-5", isRefreshing && "animate-spin")} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-10 w-10 p-0 text-white hover:bg-white/20"
                onClick={() => {
                  setCurrentPath('/home/administrator');
                  setBreadcrumbs([{ id: 'root', name: 'الرئيسية', path: '/home/administrator' }]);
                }}
              >
                <Home className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Breadcrumbs */}
        <div className="border-b border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-4 overflow-x-auto">
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.id || `breadcrumb-${index}`} className="flex items-center gap-2 flex-shrink-0">
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

          {/* Search */}
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

          {/* Path Error */}
          {pathError && (
            <Alert className="mt-4" variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>خطأ في المسار:</strong> {pathError}
                <div className="mt-2">
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
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Real Files Info */}
          {realFilesData && (
            <div className="mt-4 p-3 bg-muted/30 rounded-lg">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground gap-1">
                <div className="flex items-center gap-4 flex-wrap">
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
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            {isRealFilesLoading ? (
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
                <span className="mr-2 text-muted-foreground">جاري التحميل...</span>
              </div>
            ) : currentFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                <FolderOpen className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">
                  لا توجد ملفات
                </h3>
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
  } catch (error: any) {
    debugLog('Render error caught', {
      error: error.message,
      stack: error.stack
    });

    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-red-600 mb-2">خطأ في عرض مدير الملفات</h2>
        <p className="text-gray-600 text-center mb-4">
          {error.message}
        </p>
        <Button
          onClick={() => window.location.reload()}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          إعادة تحميل الصفحة
        </Button>
      </div>
    );
  }
}

// Main export with Error Boundary
export default function FileManager() {
  debugLog('FileManager wrapper mounted');

  return (
    <ErrorBoundary>
      <FileManagerCore />
    </ErrorBoundary>
  );
}