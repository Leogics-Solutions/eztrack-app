'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { MobileHeader } from './MobileHeader';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileSidebar } from './MobileSidebar';
import { useState } from 'react';

interface MobileAppLayoutProps {
  children: React.ReactNode;
  pageName?: string;
}

/**
 * Mobile application layout with bottom navigation and slide-out menu
 * Automatically includes ProtectedRoute wrapper
 *
 * Usage:
 * <MobileAppLayout>
 *   <YourPageContent />
 * </MobileAppLayout>
 */
export function MobileAppLayout({ children, pageName }: MobileAppLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    // <ProtectedRoute>
      <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--background)' }}>
        {/* Header */}
        <MobileHeader
          pageName={pageName}
          onMenuClick={() => setIsSidebarOpen(true)}
        />

        {/* Mobile Sidebar (Slide-out menu) */}
        <MobileSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 pb-20">
          {children}
        </main>

        {/* Footer - Hidden on mobile, shown in bottom nav area if needed */}
        <footer className="hidden border-t border-gray-200 dark:border-gray-800 py-3 px-4">
          <div className="text-center text-xs text-gray-600 dark:text-gray-400">
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

        {/* Bottom Navigation */}
        <MobileBottomNav />
      </div>
    // </ProtectedRoute>
  );
}

