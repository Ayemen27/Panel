
import React from 'react'
import { X, HardDrive, Smartphone, Download, Image, Music, Video, FileText, Archive } from 'lucide-react'

type ViewType = 'files' | 'analysis' | 'apps' | 'transfer' | 'settings'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  currentView: ViewType
  onViewChange: (view: ViewType) => void
}

export function Sidebar({ isOpen, onClose, currentView, onViewChange }: SidebarProps) {
  const storageItems = [
    { icon: HardDrive, label: 'التخزين الداخلي', path: '/storage/emulated/0' },
    { icon: Smartphone, label: 'ذاكرة الجهاز', path: '/storage/self' },
    { icon: Download, label: 'التحميلات', path: '/storage/emulated/0/Download' },
  ]

  const categoryItems = [
    { icon: Image, label: 'الصور', type: 'images' },
    { icon: Music, label: 'الموسيقى', type: 'audio' },
    { icon: Video, label: 'الفيديو', type: 'video' },
    { icon: FileText, label: 'المستندات', type: 'documents' },
    { icon: Archive, label: 'الأرشيف', type: 'archives' },
  ]

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="fixed right-0 top-0 h-full w-80 bg-surface shadow-xl z-50 transform transition-transform">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-medium">التنقل</h2>
            <button 
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Storage Locations */}
            <div className="p-4">
              <h3 className="text-sm font-medium text-gray-600 mb-3">أماكن التخزين</h3>
              <div className="space-y-1">
                {storageItems.map(({ icon: Icon, label, path }) => (
                  <button
                    key={path}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 text-right"
                  >
                    <Icon size={20} className="text-gray-600" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Categories */}
            <div className="p-4 border-t">
              <h3 className="text-sm font-medium text-gray-600 mb-3">الفئات</h3>
              <div className="space-y-1">
                {categoryItems.map(({ icon: Icon, label, type }) => (
                  <button
                    key={type}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 text-right"
                  >
                    <Icon size={20} className="text-gray-600" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
