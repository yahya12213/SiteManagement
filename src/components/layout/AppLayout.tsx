import React, { useState, useEffect } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

// Clé localStorage pour persister l'état du sidebar
const SIDEBAR_COLLAPSED_KEY = 'sidebar_collapsed';

export const AppLayout: React.FC<AppLayoutProps> = ({ children, title, subtitle }) => {
  // Initialiser depuis localStorage
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return saved === 'true';
  });

  // Sauvegarder dans localStorage quand ça change
  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => !prev);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Fixed at top */}
      <Header title={title} subtitle={subtitle} />

      {/* Main Content Area */}
      <div className="flex">
        {/* Sidebar - Only visible on desktop (lg+) */}
        <Sidebar isCollapsed={sidebarCollapsed} onToggle={toggleSidebar} />

        {/* Page Content */}
        <main className={`flex-1 p-4 sm:p-6 lg:pl-4 lg:pr-4 lg:py-6 transition-all duration-300`}>
          <div className="w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
