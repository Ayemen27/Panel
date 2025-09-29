
import React from 'react'
import { Grid, List } from 'lucide-react'

interface ViewToggleProps {
  viewMode: 'grid' | 'list'
  onViewModeChange: (mode: 'grid' | 'list') => void
}

export function ViewToggle({ viewMode, onViewModeChange }: ViewToggleProps) {
  return (
    <div className="flex bg-gray-100 rounded-lg p-1">
      <button
        onClick={() => onViewModeChange('list')}
        className={`p-2 rounded-md transition-colors ${
          viewMode === 'list' 
            ? 'bg-white shadow-sm text-primary' 
            : 'text-gray-600 hover:text-gray-800'
        }`}
      >
        <List size={18} />
      </button>
      <button
        onClick={() => onViewModeChange('grid')}
        className={`p-2 rounded-md transition-colors ${
          viewMode === 'grid' 
            ? 'bg-white shadow-sm text-primary' 
            : 'text-gray-600 hover:text-gray-800'
        }`}
      >
        <Grid size={18} />
      </button>
    </div>
  )
}
