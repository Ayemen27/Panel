
import React from 'react'
import { Folder, FileText, Image, Music, Video, Archive, Download, MoreVertical } from 'lucide-react'

interface File {
  id: string
  name: string
  type: 'file' | 'folder'
  size: number
  modified: Date
  extension?: string
  icon?: string
}

interface FileItemProps {
  file: File
  viewMode: 'grid' | 'list'
  isSelected: boolean
  onSelect: () => void
  onClick: (file: File) => void
}

export function FileItem({ file, viewMode, isSelected, onSelect, onClick }: FileItemProps) {
  const getFileIcon = () => {
    if (file.type === 'folder') {
      return <Folder size={viewMode === 'grid' ? 32 : 20} className="text-warning" />
    }

    const ext = file.extension?.toLowerCase()
    const iconSize = viewMode === 'grid' ? 32 : 20

    switch (ext) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
        return <Image size={iconSize} className="text-green-500" />
      case 'mp3':
      case 'wav':
      case 'flac':
      case 'aac':
        return <Music size={iconSize} className="text-purple-500" />
      case 'mp4':
      case 'avi':
      case 'mkv':
      case 'mov':
        return <Video size={iconSize} className="text-red-500" />
      case 'zip':
      case 'rar':
      case '7z':
      case 'tar':
        return <Archive size={iconSize} className="text-orange-500" />
      default:
        return <FileText size={iconSize} className="text-blue-500" />
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return ''
    const k = 1024
    const sizes = ['بايت', 'كيلوبايت', 'ميجابايت', 'جيجابايت']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  if (viewMode === 'grid') {
    return (
      <div
        className={`material-design-card p-4 cursor-pointer transition-all ${
          isSelected ? 'ring-2 ring-primary bg-primary/5' : ''
        }`}
        onClick={() => onClick(file)}
      >
        <div className="text-center">
          <div className="mb-3 flex justify-center">
            {getFileIcon()}
          </div>
          <p className="text-sm font-medium truncate mb-1">{file.name}</p>
          {file.type === 'file' && (
            <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
          )}
        </div>
        
        <button
          onClick={(e) => {
            e.stopPropagation()
            onSelect()
          }}
          className={`absolute top-2 right-2 w-6 h-6 rounded-full border-2 ${
            isSelected 
              ? 'bg-primary border-primary' 
              : 'border-gray-300 bg-white'
          }`}
        >
          {isSelected && (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full"></div>
            </div>
          )}
        </button>
      </div>
    )
  }

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all hover:bg-gray-50 ${
        isSelected ? 'bg-primary/10 ring-1 ring-primary' : ''
      }`}
      onClick={() => onClick(file)}
    >
      {/* Selection checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onSelect()
        }}
        className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
          isSelected 
            ? 'bg-primary border-primary' 
            : 'border-gray-300'
        }`}
      >
        {isSelected && (
          <div className="w-2 h-2 bg-white rounded-full"></div>
        )}
      </button>

      {/* File icon */}
      <div className="flex-shrink-0">
        {getFileIcon()}
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{file.name}</p>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          {file.type === 'file' && <span>{formatFileSize(file.size)}</span>}
          <span>{formatDate(file.modified)}</span>
        </div>
      </div>

      {/* More options */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          // Handle more options
        }}
        className="p-1 rounded-full hover:bg-gray-200 transition-colors"
      >
        <MoreVertical size={16} className="text-gray-500" />
      </button>
    </div>
  )
}
