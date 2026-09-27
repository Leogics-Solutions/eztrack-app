import {
  ArrowLeftRight,
  Database,
  FileCheck2,
  LayoutDashboard,
  ListChecks,
  Send,
  ScrollText,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import type { Translations } from '@/lib/i18n/types';

export interface AppNavigationItem {
  href: string;
  label: string;
  icon: LucideIcon;
  relatedRoutes?: string[];
  children?: AppNavigationChild[];
  excludeQueryKeys?: string[];
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
    { href: '/capture?workflow=payment_knock_off', label: 'Payment knock-off', icon: ArrowLeftRight },
    { href: '/capture?workflow=order_to_invoice', label: 'Internal DO & Invoice', icon: FileCheck2 },
    { href: '/capture/outsourced', label: 'Outsource DO & Invoice', icon: Send },
    { href: '/review', label: t.nav.review, icon: ListChecks, excludeQueryKeys: ['workflow'] },
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
    { href: '/audit-trail', label: 'Audit Trail', icon: ScrollText },
  ];
}

export function getSettingsNavigation(t: Translations): AppNavigationItem {
  return {
    href: '/settings',
    label: t.nav.settings,
    icon: Settings,
    relatedRoutes: ['/automations', '/integrations', '/capture/rules', '/capture/playground', '/knowledge-base'],
    children: [
      { href: '/automations', label: t.nav.automations },
      { href: '/integrations', label: t.nav.integrations, relatedRoutes: ['/capture/channels'] },
      { href: '/capture/rules', label: 'Filtering rules' },
      { href: '/capture/playground', label: 'Playground' },
      { href: '/knowledge-base', label: t.nav.knowledgeBase },
      { href: '/settings', label: 'Company' },
    ],
  };
}

export function isNavigationItemActive(pathname: string, item: AppNavigationItem, asPath = pathname) {
  if (item.href === '/') return pathname === '/';
  if ((item.excludeQueryKeys || []).some((key) => asPath.includes(`${key}=`))) return false;
  const [itemPath, query] = item.href.split('?');
  if (pathname === itemPath && (!query || asPath.includes(query))) return true;
  return (item.relatedRoutes || []).some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function isNavigationChildActive(pathname: string, asPath: string, item: AppNavigationChild) {
  const [childPath, query] = item.href.split('?');
  if (pathname === childPath && (!query || asPath.includes(query))) return true;
  return (item.relatedRoutes || []).some((route) => pathname === route || pathname.startsWith(`${route}/`));
}
