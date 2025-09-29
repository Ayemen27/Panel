
import React from 'react'
import { FolderOpen, BarChart3, Grid3X3, RefreshCw, Settings } from 'lucide-react'

type ViewType = 'files' | 'analysis' | 'apps' | 'transfer' | 'settings'

interface BottomNavigationProps {
  currentView: ViewType
  onViewChange: (view: ViewType) => void
}

export function BottomNavigation({ currentView, onViewChange }: BottomNavigationProps) {
  const tabs = [
    { id: 'files' as ViewType, icon: FolderOpen, label: 'الملفات' },
    { id: 'analysis' as ViewType, icon: BarChart3, label: 'التحليل' },
    { id: 'apps' as ViewType, icon: Grid3X3, label: 'التطبيقات' },
    { id: 'transfer' as ViewType, icon: RefreshCw, label: 'النقل' },
    { id: 'settings' as ViewType, icon: Settings, label: 'الإعدادات' },
  ]

  return (
    <div className="bg-surface border-t border-gray-200 p-2">
      <div className="flex items-center justify-around">
        {tabs.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => onViewChange(id)}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
              currentView === id
                ? 'text-primary bg-primary/10'
                : 'text-gray-600 hover:text-primary hover:bg-gray-100'
            }`}
          >
            <Icon size={20} />
            <span className="text-xs">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
