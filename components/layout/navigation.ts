import {
  BookOpen,
  Database,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Plug,
  Settings,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import type { Translations } from '@/lib/i18n/types';

export interface AppNavigationItem {
  href: string;
  label: string;
  icon: LucideIcon;
  relatedRoutes?: string[];
  children?: AppNavigationChild[];
}

export interface AppNavigationChild {
  href: string;
  label: string;
  relatedRoutes?: string[];
}

const RECORD_ROUTES = [
  '/documents',
  '/sales-invoices',
  '/purchase-invoices',
  '/supporting-documents',
  '/settlement-documents',
  '/chart-of-accounts',
  '/coa-viewer',
  '/creditor-accounts',
  '/bank-statements',
  '/payment-gateways',
  '/supplier-statements',
  '/project-gp',
];

export function getPrimaryNavigation(t: Translations): AppNavigationItem[] {
  return [
    { href: '/', label: t.nav.dashboard, icon: LayoutDashboard },
    { href: '/capture', label: t.nav.capture, icon: Inbox },
    { href: '/automations', label: t.nav.automations, icon: Workflow },
    { href: '/review', label: t.nav.review, icon: ListChecks },
    {
      href: '/records',
      label: t.nav.records,
      icon: Database,
      relatedRoutes: RECORD_ROUTES,
      children: [
        { href: '/records?section=documents', label: 'Documents', relatedRoutes: ['/documents', '/supporting-documents'] },
        { href: '/records?section=receivables', label: 'Receivables', relatedRoutes: ['/sales-invoices'] },
        { href: '/records?section=payables', label: 'Payables', relatedRoutes: ['/purchase-invoices', '/creditor-accounts', '/supplier-statements', '/settlement-documents'] },
        { href: '/records?section=banking', label: 'Banking & reconciliation', relatedRoutes: ['/bank-statements', '/payment-gateways', '/chart-of-accounts', '/coa-viewer'] },
        { href: '/records?section=operations', label: 'Operations', relatedRoutes: ['/project-gp'] },
      ],
    },
    { href: '/knowledge-base', label: t.nav.knowledgeBase, icon: BookOpen },
    {
      href: '/integrations',
      label: t.nav.integrations,
      icon: Plug,
      relatedRoutes: ['/capture/channels'],
    },
  ];
}

export function getSettingsNavigation(t: Translations): AppNavigationItem {
  return { href: '/settings', label: t.nav.settings, icon: Settings, relatedRoutes: ['/billing'] };
}

export function isNavigationItemActive(pathname: string, item: AppNavigationItem) {
  if (item.href === '/') return pathname === '/';
  const routes = [item.href, ...(item.relatedRoutes || [])];
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function isNavigationChildActive(pathname: string, asPath: string, item: AppNavigationChild) {
  const [childPath, query] = item.href.split('?');
  if (pathname === childPath && (!query || asPath.includes(query))) return true;
  return (item.relatedRoutes || []).some((route) => pathname === route || pathname.startsWith(`${route}/`));
}
