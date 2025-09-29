import { ReactNode, useState } from "react";
import { useLocation } from "wouter";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useMobile } from "@/hooks/use-mobile";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isMobile } = useMobile();
  const [location] = useLocation();

  // صفحة مدير الملفات تستخدم تخطيط خاص
  if (location === '/file-manager') {
    return (
      <div className="min-h-screen bg-background overflow-hidden" data-testid="main-layout">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex" data-testid="main-layout">
      <Sidebar 
        open={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        isMobile={isMobile}
      />

      <div className="flex-1 flex flex-col">
        <Header 
          onMenuClick={() => setSidebarOpen(true)}
          showMenuButton={isMobile}
        />

        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}