'use client';

import Link from 'next/link';
import { useRouter } from 'next/router';
import { useLanguage } from '@/lib/i18n';
import {
  FileCheck,
  LayoutDashboard,
  Users,
  FileText,
  Menu,
} from 'lucide-react';

export function MobileBottomNav() {
  const router = useRouter();
  const { t } = useLanguage();

  const navItems = [
    { href: '/', label: t.nav.dashboard, icon: LayoutDashboard },
    { href: '/documents', label: t.nav.documents, icon: FileCheck },
    { href: '/coa-viewer', label: t.nav.coaViewer, icon: FileText },
    { href: '/chart-of-accounts', label: t.nav.accounts, icon: Users },
    { href: '/creditor-accounts', label: t.nav.creditors, icon: Menu },
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
        const isActive = router.pathname === item.href;

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

