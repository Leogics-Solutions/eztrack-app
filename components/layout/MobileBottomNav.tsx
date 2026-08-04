'use client';

import Link from 'next/link';
import { useRouter } from 'next/router';
import { useLanguage } from '@/lib/i18n';
import { Database, Inbox, LayoutDashboard, ListChecks, Workflow } from 'lucide-react';
import { isNavigationItemActive } from './navigation';

export function MobileBottomNav() {
  const router = useRouter();
  const { t } = useLanguage();

  const navItems = [
    { href: '/', label: t.nav.dashboard, icon: LayoutDashboard },
    { href: '/capture', label: t.nav.capture, icon: Inbox },
    { href: '/review', label: t.nav.review, icon: ListChecks },
    { href: '/automations', label: t.nav.automations, icon: Workflow },
    { href: '/records', label: t.nav.records, icon: Database },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around h-16 border-t"
      style={{
        background: 'var(--card)',
        borderTopColor: 'var(--border)',
        color: 'var(--card-foreground)',
      }}
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = isNavigationItemActive(router.pathname, item);

        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center justify-center flex-1 h-full transition-colors"
            style={{
              color: isActive ? 'var(--primary)' : 'var(--muted-foreground)',
            }}
          >
            <Icon className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

