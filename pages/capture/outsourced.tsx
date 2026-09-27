'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileSearch,
  Inbox,
  LoaderCircle,
  Mail,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import { AppLayout } from '@/components/layout';
import { CaptureShell } from '@/components/capture/CaptureShell';
import {
  AutomationStatusBadge,
  AutomationStatusLegend,
  resolveAutomationStatus,
  type ApprovalDestination,
} from '@/components/automation/AutomationStatus';
import { useOrganization } from '@/lib/OrganizationContext';
import { useListReturnState } from '@/lib/useListReturnState';
import {
  listOutsourcedCases,
  type OutsourcedCase,
  type OutsourcedCaseState,
  type OutsourcedSet,
} from '@/services/AgentsService';

type InboxView = 'ALL' | OutsourcedCaseState;

interface OutsourcedWorkItem {
  caseId: number;
  instruction?: string;
  sourceFilename?: string;
  set: OutsourcedSet;
  state: OutsourcedCaseState;
}

const VIEW_TABS: Array<{ value: InboxView; label: string; icon: LucideIcon; countKey: InboxView }> = [
  { value: 'ALL', label: 'All incoming', icon: Inbox, countKey: 'ALL' },
  { value: 'ACTION', label: 'Needs your action', icon: ShieldAlert, countKey: 'ACTION' },
  { value: 'WAITING', label: 'Waiting on partner', icon: Clock3, countKey: 'WAITING' },
  { value: 'COMPLETED', label: 'Completed', icon: CheckCircle2, countKey: 'COMPLETED' },
];

const PAGE_SIZE = 30;

function setState(item: OutsourcedSet): OutsourcedCaseState {
  if (item.state) return item.state;
  if (item.delivered || item.status === 'COMPLETED') return 'COMPLETED';
  if (['DRAFT_GENERATED', 'EXTERNAL_DOCUMENTS_RECEIVED', 'VERIFICATION_FAILED', 'VERIFICATION_PASSED', 'PENDING_REVIEW', 'FAILED', 'OUTPUT_FAILED'].includes(item.status)) {
    return 'ACTION';
  }
  return 'WAITING';
}

function flattenCases(cases: OutsourcedCase[]): OutsourcedWorkItem[] {
  return cases.flatMap((item) => item.sets.map((set) => ({
    caseId: item.case_id,
    instruction: item.instruction,
    sourceFilename: item.source_filename,
    set,
    state: setState(set),
  })));
}

function destinationOf(item: OutsourcedSet): ApprovalDestination {
  return String(item.outbound_channel || '').toUpperCase() === 'WHATSAPP' ? 'WHATSAPP' : 'EMAIL';
}

function sourceIcon(source?: string | null) {
  const value = String(source || '').toUpperCase();
  const props = { className: 'h-4 w-4' };
  if (value.includes('GMAIL') || value.includes('EMAIL')) return <Mail {...props} />;
  if (value.includes('WHATSAPP') || value.includes('WECHAT')) return <MessageCircle {...props} />;
  return <Upload {...props} />;
}

function money(value?: number | null, currency?: string | null) {
  if (value == null) return null;
  return `${currency || 'RM'} ${value.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatMalaysiaDateTime(value?: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat('en-MY', {
    timeZone: 'Asia/Kuala_Lumpur',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function itemTitle(item: OutsourcedWorkItem) {
  const setLabel = item.set.label?.trim();
  const filename = item.sourceFilename?.trim();
  const customer = typeof item.set.customer === 'string' ? item.set.customer.trim() : '';
  const base = setLabel || filename || customer || `Review #${item.set.run_id}`;
  const setCount = item.set.set_count || 1;
  const setIndex = item.set.set_index || 1;
  return setCount > 1 ? `${base} · Set ${setIndex} of ${setCount}` : base;
}

function itemReason(item: OutsourcedWorkItem) {
  const status = item.set.status;
  if (item.set.delivered || status === 'COMPLETED') return 'The external DO and invoice were returned to the source channel.';
  if (status === 'WAITING_EXTERNAL_DOCUMENTS') return 'Request sent. Waiting for the partner to return the DO and invoice.';
  if (status === 'EXTERNAL_DOCUMENTS_RECEIVED') return 'The partner replied with returned files. Complete the package and run AI verification.';
  if (status === 'AI_VERIFYING') return 'AI is checking the partner documents against the original PO.';
  if (status === 'VERIFICATION_FAILED') return 'Document differences were found. Review the failed checks before sending to the customer.';
  if (status === 'VERIFICATION_PASSED') return 'The returned DO/Invoice matches the original PO. Approve it to send to the customer.';
  if (status === 'DRAFT_GENERATED') return 'The extracted PO is ready. Approve it to request the partner DO and invoice.';
  if (status === 'PENDING_REVIEW') return 'Review the extracted PO before requesting the partner documents.';
  if (item.instruction?.trim()) return item.instruction.trim();
  return 'Outsourced PO / DO & Invoice work that still needs a decision or is waiting on the partner.';
}

async function allOutsourcedCases() {
  const first = await listOutsourcedCases(1, 100);
  const cases = [...first.cases];
  for (let page = 2; cases.length < first.total; page += 1) {
    const next = await listOutsourcedCases(page, 100);
    if (!next.cases.length) break;
    cases.push(...next.cases);
  }
  return { cases, counts: first.counts };
}

export default function OutsourcedInboxPage() {
  const { selectedOrganizationId, isLoading: organizationLoading } = useOrganization();
  const [cases, setCases] = useState<OutsourcedCase[]>([]);
  const [serverCounts, setServerCounts] = useState<Record<OutsourcedCaseState, number> | undefined>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const listState = useListReturnState(
    selectedOrganizationId ? `smartdok.outsourced.return.${selectedOrganizationId}` : null,
    { view: 'ALL' as InboxView, search: '', page: 1 },
    loading,
  );
  const { view, search, page } = listState.value;

  useEffect(() => {
    if (organizationLoading || !selectedOrganizationId) return;
    let active = true;
    setLoading(true);
    setError('');
    allOutsourcedCases()
      .then((data) => {
        if (!active) return;
        setCases(data.cases);
        setServerCounts(data.counts);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Could not load outsourced work');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [organizationLoading, selectedOrganizationId, refreshKey]);

  const items = useMemo(() => flattenCases(cases), [cases]);
  const counts = useMemo(() => {
    const next = items.reduce<Record<OutsourcedCaseState, number>>((result, item) => {
      result[item.state] += 1;
      return result;
    }, { ACTION: 0, WAITING: 0, COMPLETED: 0 });
    return {
      ALL: items.length,
      ACTION: serverCounts?.ACTION ?? next.ACTION,
      WAITING: serverCounts?.WAITING ?? next.WAITING,
      COMPLETED: serverCounts?.COMPLETED ?? next.COMPLETED,
    };
  }, [items, serverCounts]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase().replace(/^#/, '');
    return items.filter((item) => {
      if (view !== 'ALL' && item.state !== view) return false;
      if (!needle) return true;
      return [
        item.caseId,
        item.set.run_id,
        item.set.label,
        item.set.issuing_company,
        item.set.customer,
        item.sourceFilename,
        item.instruction,
      ].some((value) => String(value || '').toLowerCase().includes(needle));
    });
  }, [items, search, view]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    if (page !== safePage) listState.update('page', safePage);
  }, [listState.update, page, safePage]);

  const emptyCopy = view === 'WAITING'
    ? ['Nothing is waiting on a partner', 'Approved requests stay here until the DO and invoice come back.']
    : view === 'COMPLETED'
      ? ['No completed outsourced work yet', 'Returned and delivered partner documents will appear here.']
      : view === 'ACTION'
        ? ['Nothing needs your action', 'Extracted POs, returned files and verification results will appear here.']
        : ['No outsourced PO / DO & Invoice work yet', 'When a PO is routed to an external partner, it appears in this inbox.'];

  return (
    <AppLayout pageName="Outsource DO & Invoice">
      <CaptureShell
        eyebrow="Inbox · External fulfilment"
        title="Outsource DO & Invoice"
        description="Inbox for outsourced purchase orders. Approve the PO, wait for the partner DO and invoice, then send the confirmed documents back to the source channel."
        actions={(
          <button
            type="button"
            onClick={() => setRefreshKey((value) => value + 1)}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-semibold hover:bg-[var(--muted)] disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        )}
      >
        <div className="space-y-6">

        <AutomationStatusLegend />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {VIEW_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = view === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => {
                  listState.update('view', tab.value);
                  listState.update('page', 1);
                }}
                className={`flex items-center justify-between rounded-xl border p-4 text-left transition ${
                  active
                    ? 'border-cyan-500 bg-cyan-500/10 ring-1 ring-cyan-500/30'
                    : 'border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]/50'
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className={`rounded-lg p-2 ${active ? 'bg-cyan-600 text-white' : 'bg-[var(--muted)] text-[var(--muted-foreground)]'}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="font-medium">{tab.label}</span>
                </span>
                <span className="text-2xl font-bold">{counts[tab.countKey]}</span>
              </button>
            );
          })}
        </div>

        <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          <div className="grid gap-3 border-b border-[var(--border)] p-4 md:grid-cols-[minmax(0,1fr)_auto]">
            <label className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <input
                value={search}
                onChange={(event) => {
                  listState.update('search', event.target.value);
                  listState.update('page', 1);
                }}
                placeholder="Search review, company, customer or source file"
                className="w-full rounded-lg border border-[var(--border)] bg-transparent py-2.5 pl-9 pr-3 text-sm outline-none focus:border-cyan-600"
              />
            </label>
          </div>

          {error && (
            <p role="alert" className="m-4 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</p>
          )}

          {loading && items.length === 0 ? (
            <p role="status" className="p-14 text-center text-sm text-[var(--muted-foreground)]">
              <LoaderCircle className="mx-auto mb-3 h-6 w-6 animate-spin" />
              Loading outsourced inbox…
            </p>
          ) : visible.length === 0 ? (
            <div className="p-14 text-center">
              <FileSearch className="mx-auto h-10 w-10 text-[var(--muted-foreground)]" />
              <h2 className="mt-3 font-semibold">{emptyCopy[0]}</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">{emptyCopy[1]}</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {visible.map((item) => {
                const destination = destinationOf(item.set);
                const amount = money(item.set.amount, item.set.currency);
                const updated = formatMalaysiaDateTime(item.set.updated_at || item.set.received_at);
                const statusDefinition = resolveAutomationStatus(item.set.status, destination);
                return (
                  <article
                    key={item.set.run_id}
                    className="grid gap-4 p-4 transition hover:bg-[var(--muted)]/40 lg:grid-cols-[44px_minmax(0,1fr)_190px_150px] lg:items-center"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-700 dark:text-cyan-300">
                      {sourceIcon(item.set.source_channel)}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold text-[var(--foreground)]">{itemTitle(item)}</h2>
                        <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-900 dark:bg-violet-950 dark:text-violet-100">Outsourced</span>
                        <span className="rounded-full border border-cyan-300 bg-cyan-50 px-2 py-0.5 text-xs font-bold text-cyan-800 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200">
                          Review #{item.set.run_id}
                        </span>
                        <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                          Case #{item.caseId}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                        {[item.set.issuing_company || 'Issuing company needs confirmation', item.set.customer || 'Customer needs confirmation', item.set.date, item.sourceFilename].filter(Boolean).join(' · ')}
                      </p>
                      <p className="mt-2 line-clamp-2 text-sm text-[var(--foreground)]">{itemReason(item)}</p>
                      {item.set.test_mode === true && (
                        <p className="mt-2 text-xs font-semibold text-amber-700">Testing mode — the production partner was not contacted.</p>
                      )}
                    </div>
                    <div>
                      <AutomationStatusBadge status={item.set.status} destination={destination} />
                      {amount && <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">{amount}</p>}
                      <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">{statusDefinition.meaning}</p>
                      {updated && <p className="mt-1 text-xs text-[var(--muted-foreground)]">Updated {updated} GMT+8</p>}
                    </div>
                    <Link
                      href={`/review/outsourced/${item.set.run_id}`}
                      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-white ${item.state === 'COMPLETED' ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-cyan-700 hover:bg-cyan-800'}`}
                    >
                      {item.state === 'COMPLETED' ? 'View completed' : 'Open Review'} <ArrowRight className="h-4 w-4" />
                    </Link>
                  </article>
                );
              })}
            </div>
          )}

          {filtered.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-[var(--border)] px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-[var(--muted-foreground)]">
                Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-40"
                  disabled={loading || safePage === 1}
                  onClick={() => listState.update('page', safePage - 1)}
                >
                  Previous
                </button>
                <span className="min-w-20 text-center text-xs text-[var(--muted-foreground)]">Page {safePage} of {totalPages}</span>
                <button
                  type="button"
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-40"
                  disabled={loading || safePage >= totalPages}
                  onClick={() => listState.update('page', safePage + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>

        <div className="flex gap-3 rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950 dark:text-cyan-100">
          <Send className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            <span className="font-semibold">Same inbox, outsourced route.</span> Internal DO & Invoice posts through SQL Accounting. This queue is the partner request, returned DO/invoice, and customer delivery for outsourced companies.
          </p>
        </div>
        </div>
      </CaptureShell>
    </AppLayout>
  );
}
