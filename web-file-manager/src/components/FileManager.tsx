
import React, { useState, useEffect } from 'react'
import { FileItem } from './FileItem'
import { ViewToggle } from './ViewToggle'
import { SortDropdown } from './SortDropdown'
import { Grid, List, Plus } from 'lucide-react'

interface File {
  id: string
  name: string
  type: 'file' | 'folder'
  size: number
  modified: Date
  extension?: string
  icon?: string
}

interface FileManagerProps {
  currentPath: string
  onPathChange: (path: string) => void
}

export function FileManager({ currentPath, onPathChange }: FileManagerProps) {
  const [files, setFiles] = useState<File[]>([])
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'modified'>('name')
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  // Mock data - في التطبيق الحقيقي، ستجلب البيانات من الخادم
  useEffect(() => {
    setLoading(true)
    // محاكاة تحميل الملفات
    setTimeout(() => {
      const mockFiles: File[] = [
        {
          id: '1',
          name: 'المستندات',
          type: 'folder',
          size: 0,
          modified: new Date(),
        },
        {
          id: '2',
          name: 'الصور',
          type: 'folder',
          size: 0,
          modified: new Date(),
        },
        {
          id: '3',
          name: 'التحميلات',
          type: 'folder',
          size: 0,
          modified: new Date(),
        },
        {
          id: '4',
          name: 'مستند مهم.pdf',
          type: 'file',
          size: 1024 * 1024 * 2.5, // 2.5 MB
          modified: new Date(Date.now() - 86400000),
          extension: 'pdf',
        },
        {
          id: '5',
          name: 'صورة.jpg',
          type: 'file',
          size: 1024 * 512, // 512 KB
          modified: new Date(Date.now() - 3600000),
          extension: 'jpg',
        },
      ]
      setFiles(mockFiles)
      setLoading(false)
    }, 500)
  }, [currentPath])

  const toggleFileSelection = (fileId: string) => {
    const newSelection = new Set(selectedFiles)
    if (newSelection.has(fileId)) {
      newSelection.delete(fileId)
    } else {
      newSelection.add(fileId)
    }
    setSelectedFiles(newSelection)
  }

  const sortedFiles = [...files].sort((a, b) => {
    // المجلدات أولاً
    if (a.type !== b.type) {
      return a.type === 'folder' ? -1 : 1
    }

    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name, 'ar')
      case 'size':
        return b.size - a.size
      case 'modified':
        return b.modified.getTime() - a.modified.getTime()
      default:
        return 0
    }
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="bg-surface border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
            <SortDropdown sortBy={sortBy} onSortChange={setSortBy} />
          </div>
          
          <button className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
            <Plus size={20} />
            <span>جديد</span>
          </button>
        </div>

        {selectedFiles.size > 0 && (
          <div className="mt-3 p-3 bg-primary/10 rounded-lg">
            <p className="text-sm text-primary">
              تم تحديد {selectedFiles.size} عنصر
            </p>
          </div>
        )}
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto p-4">
        {sortedFiles.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500">لا توجد ملفات في هذا المجلد</p>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4' : 'space-y-1'}>
            {sortedFiles.map((file) => (
              <FileItem
                key={file.id}
                file={file}
                viewMode={viewMode}
                isSelected={selectedFiles.has(file.id)}
                onSelect={() => toggleFileSelection(file.id)}
                onClick={(file) => {
                  if (file.type === 'folder') {
                    onPathChange(`${currentPath}/${file.name}`)
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
