'use client';

import { AppLayout } from '@/components/layout';
import {
  ArrowRight,
  BookOpenCheck,
  Building2,
  CreditCard,
  Database,
  FileCheck2,
  FileText,
  FolderKanban,
  Landmark,
  ReceiptText,
  Scale,
  ShoppingCart,
  Users,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';

type RecordSectionKey = 'documents' | 'receivables' | 'payables' | 'banking' | 'operations';

interface RecordLink {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

interface RecordSection {
  key: RecordSectionKey;
  label: string;
  description: string;
  links: RecordLink[];
}

const SECTIONS: RecordSection[] = [
  {
    key: 'documents',
    label: 'Documents',
    description: 'Every business document Smartdok has captured, read, and retained.',
    links: [
      { href: '/documents', title: 'All finance documents', description: 'Search and manage all extracted finance documents.', icon: FileText },
      { href: '/sales-invoices', title: 'Sales invoices', description: 'Customer-facing invoices and receivable records.', icon: FileCheck2 },
      { href: '/purchase-invoices', title: 'Purchase invoices', description: 'Supplier invoices, bills, and payable records.', icon: ReceiptText },
      { href: '/supporting-documents', title: 'Supporting documents', description: 'Purchase orders, delivery orders, proofs, and attachments.', icon: BookOpenCheck },
    ],
  },
  {
    key: 'receivables',
    label: 'Receivables',
    description: 'Customer invoices, incoming money, and payment allocation work.',
    links: [
      { href: '/sales-invoices', title: 'Customer invoices', description: 'Review issued invoices and outstanding customer records.', icon: FileCheck2 },
      { href: '/bank-statements', title: 'Incoming payments', description: 'Find bank receipts and match them to open invoices.', icon: WalletCards },
      { href: '/bank-statements', title: 'Payment allocation', description: 'Review partial, combined, and unidentified customer payments.', icon: Scale },
      { href: '/creditor-accounts', title: 'Business counterparties', description: 'Browse counterparties and their related finance records.', icon: Users },
    ],
  },
  {
    key: 'payables',
    label: 'Payables',
    description: 'Supplier bills, statement matching, and outgoing payment evidence.',
    links: [
      { href: '/purchase-invoices', title: 'Supplier bills', description: 'Review extracted supplier invoices and their status.', icon: ReceiptText },
      { href: '/creditor-accounts', title: 'Suppliers and creditors', description: 'Manage supplier accounts and balances.', icon: Building2 },
      { href: '/supplier-statements', title: 'Supplier statements', description: 'Match supplier statements against recorded bills and payments.', icon: ShoppingCart },
      { href: '/settlement-documents', title: 'Settlement documents', description: 'Payment proofs and supporting settlement records.', icon: CreditCard },
    ],
  },
  {
    key: 'banking',
    label: 'Banking & reconciliation',
    description: 'Bank transactions, ledger matching, and settlement reconciliation.',
    links: [
      { href: '/bank-statements', title: 'Bank statements', description: 'Upload, inspect, and reconcile bank transactions.', icon: Landmark },
      { href: '/bank-statements', title: 'Bank reconciliation', description: 'Match bank lines to invoices, payments, and ledger entries.', icon: Scale },
      { href: '/payment-gateways', title: 'Platform reconciliation', description: 'Reconcile merchant and payment-platform settlements.', icon: WalletCards },
      { href: '/chart-of-accounts', title: 'Chart of accounts', description: 'Accounting codes used for classification and posting.', icon: Database },
    ],
  },
  {
    key: 'operations',
    label: 'Operations',
    description: 'Operational outputs and records created by company workflows.',
    links: [
      { href: '/project-gp', title: 'Project records', description: 'Project-level cost, revenue, and gross-profit reporting.', icon: FolderKanban },
      { href: '/supporting-documents', title: 'Operational evidence', description: 'Delivery orders, claims, receipts, and other evidence.', icon: BookOpenCheck },
      { href: '/coa-viewer', title: 'Account classification', description: 'Inspect how document lines map to accounting categories.', icon: Database },
    ],
  },
];

export default function RecordsPage() {
  const router = useRouter();
  const requestedSection = typeof router.query.section === 'string' ? router.query.section : 'documents';
  const activeSection = SECTIONS.some((item) => item.key === requestedSection)
    ? requestedSection as RecordSectionKey
    : 'documents';
  const section = SECTIONS.find((item) => item.key === activeSection) || SECTIONS[0];

  return (
    <AppLayout pageName="Records">
      <div className="space-y-6">
        <header>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">
            Processed business data
          </p>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Records</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">
            Find completed documents, finance transactions, reconciliation work, and operational outputs. Items waiting for a decision stay in Review.
          </p>
        </header>

        <nav className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--card)] p-1" aria-label="Record categories">
          <div className="flex min-w-max gap-1">
            {SECTIONS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => void router.push({ pathname: '/records', query: { section: item.key } }, undefined, { shallow: true })}
                className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                  activeSection === item.key
                    ? 'bg-cyan-700 text-white shadow-sm'
                    : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </nav>

        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">{section.label}</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">{section.description}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {section.links.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={`${section.key}-${item.title}`}
                  href={item.href}
                  className="group rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 transition hover:border-cyan-500 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-700 dark:text-cyan-300">
                      <Icon className="h-5 w-5" />
                    </span>
                    <ArrowRight className="h-4 w-4 text-[var(--muted-foreground)] transition group-hover:translate-x-1 group-hover:text-cyan-700" />
                  </div>
                  <h3 className="mt-5 font-semibold text-[var(--foreground)]">{item.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">{item.description}</p>
                </Link>
              );
            })}
          </div>
        </section>

        <div className="flex flex-col gap-3 rounded-xl border border-blue-300 bg-blue-50 p-4 text-sm text-blue-950 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Looking for something Smartdok has not finished?</p>
            <p className="mt-1 text-blue-900/80 dark:text-blue-100/80">Open Review for approvals and exceptions, or Inbox for the original incoming message.</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link href="/capture" className="rounded-lg border border-blue-300 bg-white px-3 py-2 font-semibold text-blue-950 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-100">Inbox</Link>
            <Link href="/review" className="rounded-lg bg-blue-800 px-3 py-2 font-semibold text-white hover:bg-blue-900 dark:bg-blue-600">Open Review</Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
