
import React from 'react'
import { Menu, Search, MoreVertical, ArrowRight } from 'lucide-react'

interface TopBarProps {
  onMenuClick: () => void
  currentPath: string
}

export function TopBar({ onMenuClick, currentPath }: TopBarProps) {
  const pathSegments = currentPath.split('/').filter(Boolean)
  
  return (
    <div className="bg-primary text-on-primary shadow-md">
      {/* Main toolbar */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={onMenuClick}
            className="p-2 rounded-full hover:bg-white/20 transition-colors"
          >
            <Menu size={24} />
          </button>
          <h1 className="text-lg font-medium">مدير الملفات</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-full hover:bg-white/20 transition-colors">
            <Search size={24} />
          </button>
          <button className="p-2 rounded-full hover:bg-white/20 transition-colors">
            <MoreVertical size={24} />
          </button>
        </div>
      </div>

      {/* Path breadcrumb */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-1 text-sm bg-white/10 rounded-md p-2 overflow-x-auto">
          <span className="text-white/80">المسار:</span>
          {pathSegments.length === 0 ? (
            <span>الجذر</span>
          ) : (
            pathSegments.map((segment, index) => (
              <React.Fragment key={index}>
                <ArrowRight size={16} className="text-white/60" />
                <span className="whitespace-nowrap">{segment}</span>
              </React.Fragment>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
