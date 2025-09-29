
import React, { useState } from 'react'
import { Search, Grid, List, Download, Settings } from 'lucide-react'

interface App {
  id: string
  name: string
  package: string
  size: string
  version: string
  icon: string
  isSystem: boolean
}

export function AppManager() {
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [filter, setFilter] = useState<'all' | 'user' | 'system'>('all')

  const apps: App[] = [
    {
      id: '1',
      name: 'مدير الملفات',
      package: 'com.filemanager.app',
      size: '25.4 ميجابايت',
      version: '2.1.0',
      icon: '📁',
      isSystem: false,
    },
    {
      id: '2',
      name: 'معرض الصور',
      package: 'com.android.gallery',
      size: '12.8 ميجابايت',
      version: '1.5.2',
      icon: '🖼️',
      isSystem: true,
    },
    {
      id: '3',
      name: 'المتصفح',
      package: 'com.android.browser',
      size: '45.2 ميجابايت',
      version: '3.2.1',
      icon: '🌐',
      isSystem: false,
    },
  ]

  const filteredApps = apps.filter(app => {
    const matchesSearch = app.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = filter === 'all' || 
                         (filter === 'user' && !app.isSystem) || 
                         (filter === 'system' && app.isSystem)
    return matchesSearch && matchesFilter
  })

  return (
    <div className="h-full bg-background flex flex-col">
      {/* Header */}
      <div className="bg-surface border-b p-4">
        <h1 className="text-xl font-semibold mb-4">إدارة التطبيقات</h1>
        
        {/* Search */}
        <div className="relative mb-4">
          <Search size={20} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="البحث في التطبيقات..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        {/* Filters and View Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {[
              { key: 'all', label: 'الكل' },
              { key: 'user', label: 'المستخدم' },
              { key: 'system', label: 'النظام' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key as any)}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                  filter === key
                    ? 'bg-primary text-on-primary'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'list' 
                  ? 'bg-white shadow-sm text-primary' 
                  : 'text-gray-600'
              }`}
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'grid' 
                  ? 'bg-white shadow-sm text-primary' 
                  : 'text-gray-600'
              }`}
            >
              <Grid size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Apps List */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredApps.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500">لا توجد تطبيقات مطابقة</p>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4' : 'space-y-3'}>
            {filteredApps.map((app) => (
              <div key={app.id} className={viewMode === 'grid' ? 'material-design-card p-4 text-center' : 'material-design-card p-4'}>
                {viewMode === 'grid' ? (
                  <>
                    <div className="text-4xl mb-3">{app.icon}</div>
                    <h3 className="font-medium mb-2 truncate">{app.name}</h3>
                    <p className="text-sm text-gray-500 mb-1">{app.size}</p>
                    <p className="text-xs text-gray-400">{app.version}</p>
                    <div className="flex gap-2 mt-3">
                      <button className="flex-1 bg-primary text-on-primary py-1 rounded text-xs">
                        فتح
                      </button>
                      <button className="p-1 border border-gray-300 rounded">
                        <Settings size={14} />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="text-3xl">{app.icon}</div>
                    <div className="flex-1">
                      <h3 className="font-medium">{app.name}</h3>
                      <p className="text-sm text-gray-500">{app.package}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-400 mt-1">
                        <span>{app.size}</span>
                        <span>{app.version}</span>
                        {app.isSystem && <span className="bg-gray-100 px-2 py-1 rounded">نظام</span>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button className="bg-primary text-on-primary px-4 py-1 rounded text-sm">
                        فتح
                      </button>
                      <button className="border border-gray-300 px-4 py-1 rounded text-sm">
                        إعدادات
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
