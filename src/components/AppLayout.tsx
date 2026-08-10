'use client';

import React, { useState } from 'react';
import Sidebar from './Sidebar';
import TopHeader from './TopHeader';
import { ThemeProvider } from '@/context/ThemeContext';

interface AppLayoutProps {
  children: React.ReactNode;
  activeRoute: string;
}

export default function AppLayout({ children, activeRoute }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <ThemeProvider>
      <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--background)' }}>
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(prev => !prev)}
          activeRoute={activeRoute}
        />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <TopHeader sidebarCollapsed={sidebarCollapsed} />
          <main className="flex-1 overflow-y-auto px-6 py-6 xl:px-8 2xl:px-10">
            {children}
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}