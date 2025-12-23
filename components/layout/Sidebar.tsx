'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useLanguage } from '@/lib/i18n';
import {
  FileCheck,
  LayoutDashboard,
  Settings,
  Users,
  BarChart3,
  FileText,
  Menu,
  CreditCard,
} from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
}

export function Sidebar({ isCollapsed }: SidebarProps) {
  const router = useRouter();
  const { t } = useLanguage();

  const navItems = [
    { href: '/', label: t.nav.dashboard, icon: LayoutDashboard },
    { href: '/documents', label: t.nav.documents, icon: FileCheck },
    // Bank Statements entry hidden from sidebar
    // { href: '/bank-statements', label: t.nav.bankStatements, icon: CreditCard },
    { href: '/coa-viewer', label: t.nav.coaViewer, icon: FileText },
    { href: '/chart-of-accounts', label: t.nav.accounts, icon: Users },
    { href: '/creditor-accounts', label: t.nav.creditors, icon: Menu },
    { href: '/settings', label: t.nav.settings, icon: Settings },
  ];

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
        className="flex items-center justify-between px-4"
      >
        {!isCollapsed && (
          <Link href="/" className="flex items-center gap-2 py-3">
            <div className="h-24 w-24 relative flex-shrink-0 rounded-lg" style={{ backgroundColor: 'white' }}>
              <Image
                src="/smartdok.png"
                alt="Smartdok.ai"
                fill
                className="object-contain"
              />
            </div>
            <span className="font-semibold text-lg" style={{ color: 'var(--foreground)' }}>
              Smartdok.ai
            </span>
          </Link>
        )}
        {isCollapsed && (
          <Link href="/" className="flex items-center justify-center w-full">
            <div className="h-20 w-20 relative rounded-lg" style={{ backgroundColor: 'white' }}>
              <Image
                src="/smartdok.png"
                alt="Smartdok.ai"
                fill
                className="object-contain"
              />
            </div>
          </Link>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = router.pathname === item.href || router.pathname.startsWith(item.href + '/');

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
