'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import {
  FileCheck,
  LayoutDashboard,
  Settings,
  Users,
  FileText,
  Menu,
  CreditCard,
  Landmark,
  Receipt,
  Briefcase,
  ChevronDown,
} from 'lucide-react';
import { CompanySwitcher } from './CompanySwitcher';

interface SidebarProps {
  isCollapsed: boolean;
}

export function Sidebar({ isCollapsed }: SidebarProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [openGroups, setOpenGroups] = useState({
    documents: true,
    accounting: true,
    operations: true,
  });
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const dashboardItem = { href: '/', label: t.nav.dashboard, icon: LayoutDashboard };

  const documentItems = [
    { href: '/sales-invoices', label: t.nav.sales, icon: FileCheck },
    { href: '/purchase-invoices', label: t.nav.purchases, icon: FileCheck },
    { href: '/supporting-documents', label: t.nav.supportingDocuments, icon: FileCheck },
  ];

  const accountingItems = [
    { href: '/chart-of-accounts', label: t.nav.accounts, icon: FileText },
    { href: '/creditor-accounts', label: t.nav.creditors, icon: Users },
    { href: '/coa-viewer', label: t.nav.coaViewer, icon: FileText },
    { href: '/bank-statements', label: t.nav.bankStatements, icon: CreditCard },
    { href: '/payment-gateways', label: t.nav.paymentGateways, icon: Landmark },
    { href: '/supplier-statements', label: t.nav.supplierStatements, icon: Receipt },
  ];

  const operationItems = [
    { href: '/project-gp', label: t.nav.projects, icon: Briefcase },
    { href: '/jobs', label: t.nav.jobs, icon: FileText },
  ];

  const settingsItem = { href: '/settings', label: t.nav.settings, icon: Settings };

  const renderNavItem = (item: { href: string; label: string; icon: typeof LayoutDashboard }) => {
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
  };

  const renderGroup = (
    groupKey: 'documents' | 'accounting' | 'operations',
    icon: React.ReactNode,
    label: string,
    items: Array<{ href: string; label: string; icon: typeof LayoutDashboard }>
  ) => {
    const isGroupOpen = openGroups[groupKey];
    const isGroupActive = items.some((item) => router.pathname === item.href);

    if (isCollapsed) {
      return (
        <li key={groupKey}>
          <button
            type="button"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors w-full justify-center"
            style={{
              background: isGroupActive ? 'var(--secondary)' : 'transparent',
              color: isGroupActive ? 'var(--secondary-foreground)' : 'var(--muted-foreground)',
            }}
            title={label}
            onClick={() => setOpenGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }))}
          >
            {icon}
          </button>
        </li>
      );
    }

    return (
      <li key={groupKey}>
        <button
          type="button"
          onClick={() => setOpenGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }))}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors"
          style={{
            background: isGroupActive ? 'var(--secondary)' : 'transparent',
            color: isGroupActive ? 'var(--secondary-foreground)' : 'var(--muted-foreground)',
          }}
        >
          {icon}
          <span className="flex-1">{label}</span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${hasMounted && isGroupOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {hasMounted && isGroupOpen && (
          <ul className="mt-1 space-y-1 pl-8">
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = router.pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors"
                    style={{
                      background: isActive ? 'var(--secondary)' : 'transparent',
                      color: isActive ? 'var(--secondary-foreground)' : 'var(--muted-foreground)',
                    }}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </li>
    );
  };

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

      {/* Company switcher */}
      <div className="px-2 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
        <CompanySwitcher compact={isCollapsed} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-2">
          {renderNavItem(dashboardItem)}
          {renderGroup('documents', <FileCheck className="h-5 w-5 flex-shrink-0" />, t.nav.documents, documentItems)}
          {renderGroup('accounting', <CreditCard className="h-5 w-5 flex-shrink-0" />, t.nav.accounting || 'Accounting & Finance', accountingItems)}
          {renderGroup('operations', <Briefcase className="h-5 w-5 flex-shrink-0" />, t.nav.operations || 'Operations', operationItems)}
          {renderNavItem(settingsItem)}
        </ul>
      </nav>

    </aside>
  );
}
