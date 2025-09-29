
import React, { useState, useEffect } from 'react'
import { FileManager } from './components/FileManager'
import { TopBar } from './components/TopBar'
import { BottomNavigation } from './components/BottomNavigation'
import { Sidebar } from './components/Sidebar'
import { StorageAnalysis } from './components/StorageAnalysis'
import { AppManager } from './components/AppManager'
import { TransferManager } from './components/TransferManager'

type ViewType = 'files' | 'analysis' | 'apps' | 'transfer' | 'settings'

function App() {
  const [currentView, setCurrentView] = useState<ViewType>('files')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [currentPath, setCurrentPath] = useState('/storage/emulated/0')

  const renderCurrentView = () => {
    switch (currentView) {
      case 'files':
        return <FileManager currentPath={currentPath} onPathChange={setCurrentPath} />
      case 'analysis':
        return <StorageAnalysis />
      case 'apps':
        return <AppManager />
      case 'transfer':
        return <TransferManager />
      default:
        return <FileManager currentPath={currentPath} onPathChange={setCurrentPath} />
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Bar */}
      <TopBar 
        onMenuClick={() => setSidebarOpen(true)}
        currentPath={currentPath}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar 
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          currentView={currentView}
          onViewChange={setCurrentView}
        />

        {/* Main Content */}
        <main className="flex-1 overflow-hidden">
          {renderCurrentView()}
        </main>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation 
        currentView={currentView}
        onViewChange={setCurrentView}
      />
    </div>
  )
}

export default App
