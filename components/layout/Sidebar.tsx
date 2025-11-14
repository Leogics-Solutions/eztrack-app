'use client';

import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  FileCheck,
  LayoutDashboard,
  Settings,
  Users,
  BarChart3,
  FileText,
} from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
}

/**
 * =====================================================
 * 🔧 CUSTOMIZE YOUR NAVIGATION HERE
 * =====================================================
 * Edit the navItems array below to add/remove menu items
 */
const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/documents', label: 'Documents', icon: FileCheck },
  { href: '/coa-viewer', label: 'COA Viewer', icon: FileText },
  { href: '/chart-of-accounts', label: 'Accounts', icon: Users },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ isCollapsed }: SidebarProps) {
  const router = useRouter();

  return (
    <aside
      className={`
        relative flex flex-col transition-all duration-300
        ${isCollapsed ? 'w-16' : 'w-64'}
      `}
      style={{
        background: 'var(--card)',
        borderRight: '1px solid var(--border)',
        color: 'var(--card-foreground)'
      }}
    >
      {/* Logo / Brand */}
      <div
        className="flex h-16 items-center justify-between px-4"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        {!isCollapsed && (
          <Link href="/" className="flex items-center gap-2">
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--accent)' }}
            >
              <span className="font-bold text-sm" style={{ color: 'var(--accent-foreground)' }}>EZ</span>
            </div>
            <span className="font-semibold text-lg" style={{ color: 'var(--foreground)' }}>
              EZTrack
            </span>
          </Link>
        )}
        {isCollapsed && (
          <Link href="/" className="flex items-center justify-center w-full">
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--accent)' }}
            >
              <span className="font-bold text-sm" style={{ color: 'var(--accent-foreground)' }}>EZ</span>
            </div>
          </Link>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = router.pathname === item.href;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                  style={{
                    background: isActive ? 'var(--secondary)' : 'transparent',
                    color: isActive ? 'var(--secondary-foreground)' : 'var(--muted-foreground)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'var(--muted)';
                      e.currentTarget.style.color = 'var(--foreground)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--muted-foreground)';
                    }
                  }}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {!isCollapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

    </aside>
  );
}
