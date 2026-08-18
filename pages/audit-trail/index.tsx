'use client';

import { AppLayout } from '@/components/layout';
import { useOrganization } from '@/lib/OrganizationContext';
import { listAuditTrail, type AgentAuditEvent } from '@/services/AgentsService';
import { AlertTriangle, ChevronLeft, ChevronRight, Clock3, Database, FileText, Filter, LoaderCircle, RefreshCw, Search, ShieldCheck, Workflow } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

const PAGE_SIZE = 50;
const EVENT_TYPES = ['ALL', 'STATUS_CHANGE', 'REVIEW', 'REVIEW_CORRECTED', 'REVIEW_CORRECTION', 'REVIEW_OVERRIDE', 'EXTRACTION_CORRECTED', 'SKILL', 'OUTPUT', 'ERROR', 'PACKAGE', 'AGENT_PLAN', 'AGENT_TOOL'];

function titleCase(value: string) {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat('en-MY', {
    dateStyle: 'medium', timeStyle: 'short', hour12: true,
  }).format(date);
}

function eventTone(event: AgentAuditEvent) {
  const type = event.event_type.toUpperCase();
  const status = (event.status || '').toUpperCase();
  if (type === 'ERROR' || status.includes('FAIL') || status === 'REJECTED') return 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200';
  if (type === 'OUTPUT' || status === 'APPROVED' || status === 'COMPLETED') return 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200';
  if (type === 'SKILL' || type === 'AGENT_TOOL') return 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200';
  return 'border-slate-300 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';
}

export default function AuditTrailPage() {
  const { selectedOrganizationId } = useOrganization();
  const [events, setEvents] = useState<AgentAuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [eventType, setEventType] = useState('ALL');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listAuditTrail({
        eventType: eventType === 'ALL' ? undefined : eventType,
        search: appliedSearch || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setEvents(response.events);
      setTotal(response.total);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load the audit trail.');
      setEvents([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, eventType, page]);

  useEffect(() => { void load(); }, [load, selectedOrganizationId]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const summary = useMemo(() => ({
    outputs: events.filter((event) => event.event_type === 'OUTPUT').length,
    issues: events.filter((event) => event.event_type === 'ERROR' || (event.status || '').toUpperCase().includes('FAIL')).length,
  }), [events]);

  const applySearch = () => {
    setPage(1);
    setAppliedSearch(search.trim());
  };

  return (
    <AppLayout pageName="Audit Trail">
      <div className="space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-cyan-800 dark:text-cyan-300">Company activity history</p>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Audit Trail</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">Chronological evidence of this company&apos;s automation, review, delivery and SQL Accounting activity. Open the related review item to see the original document and full result.</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-600 px-4 py-2.5 text-sm font-semibold text-cyan-800 hover:bg-cyan-50 disabled:opacity-60 dark:text-cyan-200 dark:hover:bg-cyan-950">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </header>

        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard label="Matching events" value={total} icon={Clock3} />
          <SummaryCard label="Output events on this page" value={summary.outputs} icon={Database} tone="emerald" />
          <SummaryCard label="Issues on this page" value={summary.issues} icon={AlertTriangle} tone={summary.issues ? 'red' : 'slate'} />
        </div>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          <div className="flex flex-col gap-3 border-b border-[var(--border)] p-4 lg:flex-row lg:items-center lg:justify-between">
            <form className="flex flex-1 flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); applySearch(); }}>
              <label className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search workflow, file, document label or activity" className="w-full rounded-lg border border-[var(--border)] bg-transparent py-2 pl-9 pr-3 text-sm outline-none focus:border-cyan-700" /></label>
              <button type="submit" className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800">Search</button>
            </form>
            <label className="flex items-center gap-2 text-sm font-medium text-[var(--muted-foreground)]"><Filter className="h-4 w-4" /><select value={eventType} onChange={(event) => { setEventType(event.target.value); setPage(1); }} className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-cyan-700">{EVENT_TYPES.map((type) => <option key={type} value={type}>{type === 'ALL' ? 'All activity types' : titleCase(type)}</option>)}</select></label>
          </div>

          {error && <div role="alert" className="m-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-medium text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200">{error}</div>}

          {loading ? <div className="p-12 text-center text-sm text-[var(--muted-foreground)]"><LoaderCircle className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading company activity…</div> : events.length === 0 ? <div className="p-12 text-center"><ShieldCheck className="mx-auto h-10 w-10 text-slate-500" /><h2 className="mt-3 font-semibold text-[var(--foreground)]">No audit activity found</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Try another filter, or process a document to begin recording workflow activity.</p></div> : <div className="divide-y divide-[var(--border)]">{events.map((event) => <AuditRow key={event.id} event={event} expanded={expandedId === event.id} onToggle={() => setExpandedId((current) => current === event.id ? null : event.id)} />)}</div>}

          <div className="flex flex-col gap-3 border-t border-[var(--border)] p-4 text-sm text-[var(--muted-foreground)] sm:flex-row sm:items-center sm:justify-between">
            <span>{total === 0 ? 'No entries' : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total} entries`}</span>
            <div className="flex items-center gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /> Previous</button><span>Page {page} of {totalPages}</span><button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((current) => current + 1)} className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-2 disabled:opacity-40">Next <ChevronRight className="h-4 w-4" /></button></div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

function SummaryCard({ label, value, icon: Icon, tone = 'cyan' }: { label: string; value: number; icon: typeof Clock3; tone?: 'cyan' | 'emerald' | 'red' | 'slate' }) {
  const colors = { cyan: 'text-cyan-700 dark:text-cyan-300', emerald: 'text-emerald-700 dark:text-emerald-300', red: 'text-red-700 dark:text-red-300', slate: 'text-slate-600 dark:text-slate-300' };
  return <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"><div className="flex items-center justify-between"><p className="text-sm font-medium text-[var(--muted-foreground)]">{label}</p><Icon className={`h-5 w-5 ${colors[tone]}`} /></div><p className="mt-2 text-2xl font-bold text-[var(--foreground)]">{value}</p></div>;
}

function AuditRow({ event, expanded, onToggle }: { event: AgentAuditEvent; expanded: boolean; onToggle: () => void }) {
  const title = event.po_label || event.source_caption || event.source_filename || `Review item #${event.run_id}`;
  return <article className="p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${eventTone(event)}`}>{titleCase(event.event_type)}</span>{event.status && <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] font-bold text-[var(--muted-foreground)]">{titleCase(event.status)}</span>}<span className="text-xs text-[var(--muted-foreground)]">{formatDate(event.created_at)}</span></div><p className="mt-2 text-sm font-semibold text-[var(--foreground)]">{event.message || 'Automation activity recorded'}</p><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--muted-foreground)]"><span className="inline-flex items-center gap-1"><Workflow className="h-3.5 w-3.5" />{event.agent_name || `Automation #${event.agent_id}`}</span><span className="inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{title}</span>{event.source_channel && <span>{titleCase(event.source_channel)}</span>}</div></div><div className="flex shrink-0 items-center gap-2"><button type="button" onClick={onToggle} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold hover:bg-[var(--muted)]">{expanded ? 'Hide details' : 'Details'}</button><Link href={`/review/${event.run_id}`} className="rounded-lg border border-cyan-600 px-3 py-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-50 dark:text-cyan-200 dark:hover:bg-cyan-950">Open review</Link></div></div>{expanded && <pre className="mt-3 max-h-72 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--muted)] p-3 text-xs leading-5 text-[var(--foreground)]">{JSON.stringify(event.data || { message: event.message, status: event.status }, null, 2)}</pre>}</article>;
}
