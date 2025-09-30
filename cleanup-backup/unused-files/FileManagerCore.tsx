
import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { logger } from "@/utils/logger";

interface UnifiedFileInfo {
  id?: string;
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

interface UseFileManagerProps {
  initialPath?: string;
  userId: string;
}

export function useFileManager({ initialPath = '/home/administrator', userId }: UseFileManagerProps) {
  const [currentPath, setCurrentPath] = useState<string>(initialPath);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<UnifiedFileInfo[]>([]);

  // Fetch directory listing
  const { 
    data: directoryData, 
    isLoading, 
    error, 
    refetch 
  } = useQuery<DirectoryListing>({
    queryKey: ['unified-files', currentPath],
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
    enabled: !!currentPath && !!userId,
    retry: 2,
    staleTime: 30 * 1000,
  });

  // Filter files based on search and other criteria
  const filteredFiles = useMemo(() => {
    if (!directoryData?.items) return [];

    let files = directoryData.items;

    // Apply search filter
    if (searchQuery.trim()) {
      files = files.filter(file => 
        file.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort: directories first, then files, both alphabetically
    return files.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name, 'ar');
    });
  }, [directoryData, searchQuery]);

  // Navigation functions
  const navigateToPath = useCallback((newPath: string) => {
    setCurrentPath(newPath);
    setSelectedItems([]);
  }, []);

  const navigateUp = useCallback(() => {
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
    navigateToPath(parentPath);
  }, [currentPath, navigateToPath]);

  // File operations
  const createDirectory = useCallback(async (name: string): Promise<boolean> => {
    try {
      const newPath = `${currentPath}/${name}`;
      const response = await apiRequest('POST', '/api/unified-files/create-directory', {
        path: newPath
      });

      if (response.ok) {
        refetch();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error creating directory:', error);
      return false;
    }
  }, [currentPath, refetch]);

  const createFile = useCallback(async (name: string, content: string = ''): Promise<boolean> => {
    try {
      const newPath = `${currentPath}/${name}`;
      const response = await apiRequest('POST', '/api/unified-files/create-file', {
        path: newPath,
        content
      });

      if (response.ok) {
        refetch();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error creating file:', error);
      return false;
    }
  }, [currentPath, refetch]);

  const deleteItem = useCallback(async (item: UnifiedFileInfo): Promise<boolean> => {
    try {
      const response = await apiRequest('DELETE', '/api/unified-files/delete', {
        path: item.absolutePath
      });

      if (response.ok) {
        refetch();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting item:', error);
      return false;
    }
  }, [refetch]);

  const renameItem = useCallback(async (item: UnifiedFileInfo, newName: string): Promise<boolean> => {
    try {
      const newPath = `${currentPath}/${newName}`;
      const response = await apiRequest('POST', '/api/unified-files/rename', {
        oldPath: item.absolutePath,
        newPath
      });

      if (response.ok) {
        refetch();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error renaming item:', error);
      return false;
    }
  }, [currentPath, refetch]);

  // Selection management
  const toggleItemSelection = useCallback((item: UnifiedFileInfo) => {
    setSelectedItems(prev => {
      const isSelected = prev.some(selected => selected.absolutePath === item.absolutePath);
      if (isSelected) {
        return prev.filter(selected => selected.absolutePath !== item.absolutePath);
      } else {
        return [...prev, item];
      }
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedItems([]);
  }, []);

  return {
    // State
    currentPath,
    searchQuery,
    selectedItems,
    directoryData,
    filteredFiles,
    isLoading,
    error,

    // Actions
    setSearchQuery,
    navigateToPath,
    navigateUp,
    createDirectory,
    createFile,
    deleteItem,
    renameItem,
    toggleItemSelection,
    clearSelection,
    refetch
  };
}
