'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileAppLayout } from './MobileAppLayout';
import { useState, useEffect } from 'react';

interface AppLayoutProps {
  children: React.ReactNode;
  pageName?: string;
}

/**
 * Main application layout with sidebar and header
 * Automatically switches between desktop and mobile layouts based on screen size
 * Automatically includes ProtectedRoute wrapper
 *
 * Usage:
 * <AppLayout>
 *   <YourPageContent />
 * </AppLayout>
 */
export function AppLayout({ children, pageName }: AppLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if we're on mobile initially
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // 768px is the breakpoint (md in Tailwind)
    };

    // Check on mount
    checkMobile();

    // Listen for resize events
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // Render mobile layout for screens smaller than 768px
  if (isMobile) {
    return <MobileAppLayout pageName={pageName}>{children}</MobileAppLayout>;
  }

  // Desktop layout
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
