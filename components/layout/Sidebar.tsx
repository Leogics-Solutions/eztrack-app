'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { ChevronDown } from 'lucide-react';
import { CompanySwitcher } from './CompanySwitcher';
import {
  getPrimaryNavigation,
  getSettingsNavigation,
  isNavigationChildActive,
  isNavigationItemActive,
  type AppNavigationItem,
} from './navigation';

interface SidebarProps {
  isCollapsed: boolean;
}

export function Sidebar({ isCollapsed }: SidebarProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [recordsOpen, setRecordsOpen] = useState(true);
  const primaryItems = getPrimaryNavigation(t);
  const settingsItem = getSettingsNavigation(t);

  const renderNavItem = (item: AppNavigationItem) => {
    const Icon = item.icon;
    const isActive = isNavigationItemActive(router.pathname, item);

    if (item.children?.length) {
      if (isCollapsed) {
        return (
          <li key={item.href}>
            <Link href={item.href} title={item.label} className="flex items-center justify-center rounded-lg px-3 py-2 transition-colors" style={{ background: isActive ? 'var(--secondary)' : 'transparent', color: isActive ? 'var(--secondary-foreground)' : 'var(--muted-foreground)' }}>
              <Icon className="h-5 w-5" />
            </Link>
          </li>
        );
      }
      return (
        <li key={item.href}>
          <button type="button" onClick={() => setRecordsOpen((open) => !open)} aria-expanded={recordsOpen} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors" style={{ background: isActive ? 'var(--secondary)' : 'transparent', color: isActive ? 'var(--secondary-foreground)' : 'var(--muted-foreground)' }}>
            <Icon className="h-5 w-5 shrink-0" />
            <span className="flex-1">{item.label}</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${recordsOpen ? 'rotate-180' : ''}`} />
          </button>
          {recordsOpen && (
            <ul className="mt-1 space-y-1 border-l border-[var(--border)] pl-3 ml-5">
              {item.children.map((child) => {
                const childActive = isNavigationChildActive(router.pathname, router.asPath, child);
                return <li key={child.href}><Link href={child.href} className="block rounded-md px-3 py-1.5 text-sm transition-colors" style={{ background: childActive ? 'var(--secondary)' : 'transparent', color: childActive ? 'var(--secondary-foreground)' : 'var(--muted-foreground)' }}>{child.label}</Link></li>;
              })}
            </ul>
          )}
        </li>
      );
    }

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
          {primaryItems.map(renderNavItem)}
        </ul>
      </nav>
      <div className="border-t px-2 py-3" style={{ borderColor: 'var(--border)' }}>
        <ul>{renderNavItem(settingsItem)}</ul>
      </div>
    </aside>
  );
}
