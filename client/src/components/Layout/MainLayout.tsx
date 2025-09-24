import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar 
        open={sidebarOpen} 
        onClose={() => setSidebarOpen(false)}
        isMobile={isMobile}
      />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header 
          onMenuClick={() => setSidebarOpen(true)}
          showMenuButton={isMobile}
        />
        
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
