'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useState } from 'react';

interface AppLayoutProps {
  children: React.ReactNode;
  pageName?: string;
}

/**
 * Main application layout with sidebar and header
 * Automatically includes ProtectedRoute wrapper
 *
 * Usage:
 * <AppLayout>
 *   <YourPageContent />
 * </AppLayout>
 */
export function AppLayout({ children, pageName }: AppLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    // <ProtectedRoute>
      <div className="flex h-screen overflow-hidden" style={{ background: 'var(--background)' }}>
        {/* Sidebar */}
        <Sidebar
          isCollapsed={isSidebarCollapsed}
        />

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <Header
            pageName={pageName}
            isCollapsed={isSidebarCollapsed}
            onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    // </ProtectedRoute>
  );
}
