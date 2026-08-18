'use client';

import { AppLayout } from '@/components/layout';
import { useOrganization } from '@/lib/OrganizationContext';
import {
  listCaptureWorkInbox,
  type CaptureWorkItem,
} from '@/services/CaptureService';
import { listInvoices, type Invoice } from '@/services/InvoiceService';
import { listRuns, type AgentRunListItem } from '@/services/AgentsService';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  FileQuestion,
  Inbox,
  ListChecks,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  Split,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

type ReviewKind = 'approval' | 'matching' | 'validation' | 'missing' | 'processing' | 'rejected';

interface ReviewTask {
  id: string;
  title: string;
  subtitle: string;
  workflow: string;
  kind: ReviewKind;
  reason: string;
  href: string;
  updatedAt: string;
  amount?: string;
  source: 'inbox' | 'record' | 'automation';
  state: 'open' | 'rejected';
}

function formatMalaysiaDateTime(value: string) {
  return new Intl.DateTimeFormat('en-MY', {
    timeZone: 'Asia/Kuala_Lumpur',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date(value));
}

function automationTask(run: AgentRunListItem): ReviewTask {
  const status = run.status.toUpperCase();
  const failed = status === 'FAILED' || status === 'OUTPUT_FAILED';
  const readyToApprove = status === 'DRAFT_GENERATED';
  const deliveryPending = status === 'DELIVERY_PENDING';
  const rejected = status === 'REJECTED';
  const baseTitle = run.po_label?.trim() || run.source_caption?.trim() || run.source_filename || `Automation run #${run.id}`;
  const setLabel = run.source_bundle_count && run.source_bundle_count > 1
    ? ` · Invoice set ${run.source_bundle_index || 1} of ${run.source_bundle_count}`
    : '';
  const title = `${baseTitle}${setLabel}`;
  const issuer = run.issuing_company?.trim();
  return {
    id: `automation-${run.id}`,
    title,
    subtitle: [issuer ? `Issuer: ${issuer}` : '', run.source_filename || humanize(run.source_channel || 'automation')].filter(Boolean).join(' · '),
    workflow: run.agent_name || `Automation #${run.agent_id}`,
    kind: rejected ? 'rejected' : failed ? 'processing' : readyToApprove ? 'approval' : deliveryPending ? 'processing' : 'validation',
    reason: rejected
      ? run.error_message || 'Rejected by reviewer.'
      : failed
      ? 'The automation could not finish. Open it to inspect the error and retry.'
      : readyToApprove
        ? 'The extracted data is ready for approval.'
        : deliveryPending
          ? 'SQL Accounting created the records, but official PDF delivery is still pending.'
          : 'Review the extracted data before the automation creates external records.',
    href: `/review/${run.id}`,
    updatedAt: run.updated_at || run.completed_at || run.received_at || new Date(0).toISOString(),
    source: 'automation',
    state: rejected ? 'rejected' : 'open',
  };
}

const KIND_META: Record<ReviewKind, { label: string; icon: LucideIcon; style: string }> = {
  approval: { label: 'Approval', icon: CheckCircle2, style: 'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-100' },
  matching: { label: 'Matching', icon: Split, style: 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100' },
  validation: { label: 'Validation', icon: ShieldAlert, style: 'bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100' },
  missing: { label: 'Missing information', icon: FileQuestion, style: 'bg-orange-100 text-orange-950 dark:bg-orange-950 dark:text-orange-100' },
  processing: { label: 'Processing issue', icon: AlertTriangle, style: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100' },
  rejected: { label: 'Rejected', icon: XCircle, style: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100' },
};

function humanize(value: string) {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function captureTask(item: CaptureWorkItem): ReviewTask {
  const failed = item.status === 'FAILED' || Boolean(item.reason?.toLowerCase().includes('fail'));
  return {
    id: `capture-${item.id}`,
    title: item.title,
    subtitle: item.sender || item.filenames[0] || humanize(item.source_type),
    workflow: item.workflow_name || 'Incoming work',
    kind: failed ? 'processing' : item.result_id ? 'validation' : 'approval',
    reason: item.reason || (item.result_id ? 'Smartdok prepared a result that needs confirmation.' : 'This incoming item needs a decision before processing can continue.'),
    href: item.review_url || (item.capture_event_id ? `/capture/messages/${item.capture_event_id}` : '/capture'),
    updatedAt: item.updated_at,
    source: 'inbox',
    state: 'open',
  };
}

function invoiceIssues(invoice: Invoice) {
  const issues: string[] = [];
  if (invoice.is_duplicate) issues.push('Possible duplicate document');
  if (invoice.missing_do) issues.push('Delivery order is missing');
  if (invoice.missing_custom_form) issues.push('Required supporting form is missing');
  if (invoice.payment_proof_status && ['needs_review', 'mismatch', 'partial'].includes(invoice.payment_proof_status)) {
    issues.push(`Payment evidence is ${invoice.payment_proof_status.replaceAll('_', ' ')}`);
  }
  if (invoice.compliance_status && ['warning', 'fail', 'needs_review'].includes(invoice.compliance_status)) {
    issues.push(`Compliance check returned ${invoice.compliance_status.replaceAll('_', ' ')}`);
  }
  if (invoice.requires_wht_review) issues.push('Withholding tax needs review');
  if (invoice.requires_k1_review) issues.push('K1 documentation needs review');
  if (invoice.requires_sst_review) issues.push('SST treatment needs review');
  if (invoice.requires_einvoice_review) issues.push('E-invoice readiness needs review');
  return issues;
}

function invoiceTask(invoice: Invoice): ReviewTask | null {
  const issues = invoiceIssues(invoice);
  if (issues.length === 0) return null;
  const matchingIssue = invoice.payment_proof_status && ['needs_review', 'mismatch', 'partial'].includes(invoice.payment_proof_status);
  const missingIssue = invoice.missing_do || invoice.missing_custom_form;
  return {
    id: `invoice-${invoice.id}`,
    title: invoice.invoice_no || `Document #${invoice.id}`,
    subtitle: invoice.vendor_name || invoice.customer_name || invoice.original_filename || 'Finance document',
    workflow: matchingIssue ? 'Payment matching' : 'Finance document',
    kind: matchingIssue ? 'matching' : missingIssue ? 'missing' : 'validation',
    reason: issues.join(' · '),
    href: `/documents/${invoice.id}`,
    updatedAt: invoice.created_at || invoice.invoice_date,
    amount: `${invoice.currency || 'MYR'} ${Number(invoice.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    source: 'record',
    state: 'open',
  };
}

export default function ReviewPage() {
  const { selectedOrganizationId } = useOrganization();
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<'ALL' | ReviewKind>('ALL');
  const [workflow, setWorkflow] = useState('ALL');
  const [view, setView] = useState<'OPEN' | 'REJECTED'>('OPEN');

  const load = useCallback(async () => {
    const [captureResult, invoiceResult, runResult, rejectedRunResult] = await Promise.allSettled([
      listCaptureWorkInbox({ view: 'TO_REVIEW', page: 1, pageSize: 100, sourceType: 'ALL', search: '', includeIgnored: false }),
      listInvoices({ page: 1, page_size: 100 }),
      listRuns({ page: 1, pageSize: 100 }),
      listRuns({ status: 'REJECTED', page: 1, pageSize: 100 }),
    ]);

    const next: ReviewTask[] = [];
    if (captureResult.status === 'fulfilled') {
      next.push(...captureResult.value.items.filter((item) => item.result_type !== 'automation_run').map(captureTask));
    }
    if (invoiceResult.status === 'fulfilled') {
      next.push(...invoiceResult.value.data.invoices.map(invoiceTask).filter((task): task is ReviewTask => Boolean(task)));
    }
    if (runResult.status === 'fulfilled') {
      next.push(...runResult.value.runs
        .filter((run) => ['PENDING_REVIEW', 'DRAFT_GENERATED', 'DELIVERY_PENDING', 'FAILED', 'OUTPUT_FAILED'].includes(run.status.toUpperCase()))
        .map(automationTask));
    }
    if (rejectedRunResult.status === 'fulfilled') {
      next.push(...rejectedRunResult.value.runs.map(automationTask));
    }
    next.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    setTasks(next);

    const rejectedSources = [captureResult, invoiceResult, runResult, rejectedRunResult].filter((result) => result.status === 'rejected').length;
    if (rejectedSources === 4) {
      setError('Review items could not be loaded. Check the API connection and try again.');
    } else if (rejectedSources > 0) {
      setError('Some review sources could not be loaded. The available tasks are shown below.');
    } else {
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load, selectedOrganizationId]);

  const workflows = useMemo(() => Array.from(new Set(tasks.map((task) => task.workflow))).sort(), [tasks]);
  const openTasks = useMemo(() => tasks.filter((task) => task.state === 'open'), [tasks]);
  const rejectedTasks = useMemo(() => tasks.filter((task) => task.state === 'rejected'), [tasks]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (view === 'OPEN' && task.state !== 'open') return false;
      if (view === 'REJECTED' && task.state !== 'rejected') return false;
      if (kind !== 'ALL' && task.kind !== kind) return false;
      if (workflow !== 'ALL' && task.workflow !== workflow) return false;
      if (!query) return true;
      return [task.title, task.subtitle, task.workflow, task.reason].some((value) => value.toLowerCase().includes(query));
    });
  }, [kind, search, tasks, view, workflow]);

  const metric = (value: ReviewKind) => openTasks.filter((task) => task.kind === value).length;

  return (
    <AppLayout pageName="Review">
      <div className="space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">Human decisions</p>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Review</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">
              Approvals, matching questions, missing information, and exceptions across every workflow. Work that passes automatically does not appear here.
            </p>
          </div>
          <button type="button" onClick={() => { setLoading(true); void load(); }} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-semibold hover:bg-[var(--muted)] disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="Needs action" value={openTasks.length} icon={ListChecks} tone="cyan" />
          <Metric label="Approvals" value={metric('approval')} icon={CheckCircle2} tone="violet" />
          <Metric label="Matching" value={metric('matching')} icon={Split} tone="blue" />
          <Metric label="Exceptions" value={metric('validation') + metric('missing') + metric('processing')} icon={ShieldAlert} tone="amber" />
          <Metric label="Rejected" value={rejectedTasks.length} icon={XCircle} tone="red" />
        </div>

        {error && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-medium text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">{error}</div>}

        <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          <div className="flex gap-2 border-b border-[var(--border)] p-4">
            <button type="button" onClick={() => { setView('OPEN'); setKind('ALL'); }} className={`rounded-lg px-3 py-2 text-sm font-semibold ${view === 'OPEN' ? 'bg-cyan-700 text-white' : 'border border-[var(--border)]'}`}>Open reviews ({openTasks.length})</button>
            <button type="button" onClick={() => { setView('REJECTED'); setKind('ALL'); }} className={`rounded-lg px-3 py-2 text-sm font-semibold ${view === 'REJECTED' ? 'bg-red-700 text-white' : 'border border-[var(--border)]'}`}>Rejected ({rejectedTasks.length})</button>
          </div>
          <div className="grid gap-3 border-b border-[var(--border)] p-4 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
            <label className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search task, company, workflow, or reason" className="w-full rounded-lg border border-[var(--border)] bg-transparent py-2.5 pl-9 pr-3 text-sm outline-none focus:border-cyan-600" />
            </label>
            <select value={workflow} onChange={(event) => setWorkflow(event.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-[var(--foreground)]">
              <option value="ALL">All workflows</option>
              {workflows.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={kind} onChange={(event) => setKind(event.target.value as 'ALL' | ReviewKind)} className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-[var(--foreground)]">
              <option value="ALL">All task types</option>
              {Object.entries(KIND_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
            </select>
          </div>

          {loading && tasks.length === 0 ? (
            <div className="p-14 text-center text-sm text-[var(--muted-foreground)]"><LoaderCircle className="mx-auto mb-3 h-6 w-6 animate-spin" />Loading review work…</div>
          ) : filtered.length === 0 ? (
            <div className="p-14 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
              <h2 className="mt-3 font-semibold text-[var(--foreground)]">{view === 'REJECTED' && rejectedTasks.length === 0 ? 'No rejected items' : openTasks.length === 0 && view === 'OPEN' ? 'You are all caught up' : 'No tasks match these filters'}</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">{view === 'REJECTED' && rejectedTasks.length === 0 ? 'Rejected automation reviews will be retained and listed here.' : openTasks.length === 0 && view === 'OPEN' ? 'New approvals and exceptions will appear here automatically.' : 'Try another workflow, task type, or search.'}</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {filtered.map((task) => <ReviewRow key={task.id} task={task} />)}
            </div>
          )}
        </section>

        <div className="flex gap-3 rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950 dark:text-cyan-100">
          <Inbox className="mt-0.5 h-5 w-5 shrink-0" />
          <p><span className="font-semibold">Inbox is the source; Review is the decision.</span> Open the original message from a task when you need source context. Once resolved, the resulting document or transaction remains in Records.</p>
        </div>
      </div>
    </AppLayout>
  );
}

function Metric({ label, value, icon: Icon, tone }: { label: string; value: number; icon: LucideIcon; tone: 'cyan' | 'violet' | 'blue' | 'amber' | 'red' }) {
  const tones = { cyan: 'text-cyan-700 dark:text-cyan-300', violet: 'text-violet-700 dark:text-violet-300', blue: 'text-blue-700 dark:text-blue-300', amber: 'text-amber-700 dark:text-amber-300', red: 'text-red-700 dark:text-red-300' };
  return <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"><div className="flex items-center justify-between"><p className="text-sm font-medium text-[var(--muted-foreground)]">{label}</p><Icon className={`h-5 w-5 ${tones[tone]}`} /></div><p className="mt-2 text-2xl font-bold text-[var(--foreground)]">{value}</p></div>;
}

function ReviewRow({ task }: { task: ReviewTask }) {
  const meta = KIND_META[task.kind];
  const Icon = meta.icon;
  return (
    <article className="grid gap-4 p-4 transition hover:bg-[var(--muted)]/40 lg:grid-cols-[44px_minmax(0,1fr)_180px_150px] lg:items-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-700 dark:text-cyan-300"><Icon className="h-5 w-5" /></span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-[var(--foreground)]">{task.title}</h2><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${meta.style}`}>{meta.label}</span></div>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">{task.subtitle}</p>
        <p className="mt-2 line-clamp-2 text-sm text-[var(--foreground)]">{task.reason}</p>
      </div>
      <div>
        <p className="text-sm font-medium text-[var(--foreground)]">{task.workflow}</p>
        {task.amount && <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-[var(--foreground)]"><CircleDollarSign className="h-4 w-4" />{task.amount}</p>}
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">Updated {formatMalaysiaDateTime(task.updatedAt)} GMT+8</p>
      </div>
      <Link href={task.href} className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-white ${task.state === 'rejected' ? 'bg-slate-700 hover:bg-slate-800' : 'bg-cyan-700 hover:bg-cyan-800'}`}>{task.state === 'rejected' ? 'View rejected' : 'Review task'} <ArrowRight className="h-4 w-4" /></Link>
    </article>
  );
}
