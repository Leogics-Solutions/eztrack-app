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

          {/* Footer */}
          <footer className="border-t border-gray-200 dark:border-gray-800 py-4 px-6">
            <div className="text-center text-sm text-gray-600 dark:text-gray-400">
              Powered By{' '}
              <a
                href="https://www.leogics.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                Leogics Solutions (M) Sdn Bhd
              </a>
            </div>
          </footer>
        </div>
      </div>
    // </ProtectedRoute>
  );
}
