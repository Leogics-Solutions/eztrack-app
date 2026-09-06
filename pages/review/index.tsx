'use client';

import { AppLayout } from '@/components/layout';
import {
  AUTOMATION_STATUS_LEGEND,
  AutomationStatusBadge,
  AutomationStatusLegend,
  resolveAutomationStatus,
  type ApprovalDestination,
} from '@/components/automation/AutomationStatus';
import { useOrganization } from '@/lib/OrganizationContext';
import {
  normalizeWorkstreamKey,
  WORKSTREAM_BADGE_STYLES,
  WORKSTREAM_LABELS,
  type ItemWorkstreamKey,
  type WorkstreamKey,
} from '@/lib/workstreams';
import { useStickyWorkstream } from '@/lib/useStickyWorkstream';
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
  MailCheck,
  Inbox,
  Layers3,
  ListChecks,
  LoaderCircle,
  RefreshCw,
  ReceiptText,
  Search,
  ShieldAlert,
  Split,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState } from 'react';

type ReviewKind = 'approval' | 'matching' | 'validation' | 'missing' | 'returned' | 'processing' | 'completed' | 'rejected';

interface ReviewTask {
  id: string;
  title: string;
  subtitle: string;
  workflow: string;
  workflowKey: ItemWorkstreamKey;
  kind: ReviewKind;
  reason: string;
  href: string;
  updatedAt: string;
  amount?: string;
  source: 'inbox' | 'record' | 'automation';
  state: 'open' | 'completed' | 'rejected';
  status: string;
  approvalDestination: ApprovalDestination;
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
  const waitingForInstruction = Boolean(run.awaiting_instruction);
  const failed = status === 'FAILED' || status === 'OUTPUT_FAILED' || status === 'VERIFICATION_FAILED';
  const readyToApprove = status === 'DRAFT_GENERATED';
  const deliveryPending = status === 'DELIVERY_PENDING';
  const rejected = status === 'REJECTED';
  const completed = status === 'COMPLETED';
  const externalDocumentsReceived = status === 'EXTERNAL_DOCUMENTS_RECEIVED';
  const aiVerifying = status === 'AI_VERIFYING';
  const verificationPassed = status === 'VERIFICATION_PASSED';
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
    workflowKey: normalizeWorkstreamKey(run.template_key, run.agent_name),
    kind: waitingForInstruction ? 'missing' : completed ? 'completed' : rejected ? 'rejected' : verificationPassed ? 'approval' : externalDocumentsReceived ? 'returned' : failed ? 'validation' : aiVerifying ? 'validation' : readyToApprove ? 'approval' : deliveryPending ? 'processing' : 'validation',
    reason: waitingForInstruction
      ? 'Waiting for instruction / 待补文字资料 — the payment image is received; send the related payment or invoice details in the same chat to continue.'
      : rejected
      ? run.error_message || 'Rejected by reviewer.'
      : completed
      ? 'This automation is completed. Open it to view its final documents and activity.'
      : externalDocumentsReceived
      ? 'The supplier replied with returned files. Complete the package and run AI verification.'
      : verificationPassed
      ? 'The returned DO/Invoice matches the original PO. Approve it to send to the customer.'
      : aiVerifying
      ? 'AI is checking the supplier documents against the original PO.'
      : status === 'VERIFICATION_FAILED'
      ? 'Supplier document discrepancies were found. Review the failed checks and request corrections before sending.'
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
    state: completed ? 'completed' : rejected ? 'rejected' : 'open',
    status: waitingForInstruction ? 'WAITING_FOR_INSTRUCTION' : status,
    approvalDestination: run.approval_destination || 'SQL',
  };
}

const KIND_META: Record<ReviewKind, { label: string; icon: LucideIcon; style: string }> = {
  approval: { label: 'Approval', icon: CheckCircle2, style: 'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-100' },
  matching: { label: 'Matching', icon: Split, style: 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100' },
  validation: { label: 'Validation', icon: ShieldAlert, style: 'bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100' },
  missing: { label: 'Missing information', icon: FileQuestion, style: 'bg-orange-100 text-orange-950 dark:bg-orange-950 dark:text-orange-100' },
  returned: { label: 'Supplier replied', icon: MailCheck, style: 'bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100' },
  processing: { label: 'Processing issue', icon: AlertTriangle, style: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100' },
  completed: { label: 'Completed', icon: CheckCircle2, style: 'bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100' },
  rejected: { label: 'Rejected', icon: XCircle, style: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100' },
};

const WORKSTREAM_TABS = [
  { value: 'ALL' as const, icon: Layers3 },
  { value: 'order_to_invoice' as const, icon: ReceiptText },
  { value: 'payment_knock_off' as const, icon: CircleDollarSign },
  { value: 'other' as const, icon: Inbox },
];

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
    workflowKey: normalizeWorkstreamKey(item.workflow_key, item.workflow_name),
    kind: failed ? 'processing' : item.result_id ? 'validation' : 'approval',
    reason: item.reason || (item.result_id ? 'Smartdok prepared a result that needs confirmation.' : 'This incoming item needs a decision before processing can continue.'),
    href: item.review_url || (item.capture_event_id ? `/capture/messages/${item.capture_event_id}` : '/capture'),
    updatedAt: item.updated_at,
    source: 'inbox',
    state: 'open',
    status: item.status,
    approvalDestination: item.approval_destination || 'SQL',
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
    workflowKey: matchingIssue ? 'payment_knock_off' : 'other',
    kind: matchingIssue ? 'matching' : missingIssue ? 'missing' : 'validation',
    reason: issues.join(' · '),
    href: `/documents/${invoice.id}`,
    updatedAt: invoice.created_at || invoice.invoice_date,
    amount: `${invoice.currency || 'MYR'} ${Number(invoice.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    source: 'record',
    state: 'open',
    status: 'PENDING_REVIEW',
    approvalDestination: 'SQL',
  };
}

export default function ReviewPage() {
  const { selectedOrganizationId } = useOrganization();
  const router = useRouter();
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<'ALL' | ReviewKind>('ALL');
  const [workflow, setWorkflow] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [workstream, setWorkstream] = useStickyWorkstream('smartdok.review.workstream');
  const [view, setView] = useState<'OPEN' | 'COMPLETED' | 'REJECTED'>('OPEN');

  const load = useCallback(async () => {
    const [captureResult, invoiceResult, runResult, completedRunResult, rejectedRunResult] = await Promise.allSettled([
      listCaptureWorkInbox({ view: 'TO_REVIEW', page: 1, pageSize: 100, sourceType: 'ALL', search: '', includeIgnored: false }),
      listInvoices({ page: 1, page_size: 100 }),
      listRuns({ page: 1, pageSize: 100 }),
      listRuns({ status: 'COMPLETED', page: 1, pageSize: 100 }),
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
        .filter((run) => ['PENDING_REVIEW', 'DRAFT_GENERATED', 'DELIVERY_PENDING', 'EXTERNAL_DOCUMENTS_RECEIVED', 'AI_VERIFYING', 'VERIFICATION_FAILED', 'VERIFICATION_PASSED', 'FAILED', 'OUTPUT_FAILED'].includes(run.status.toUpperCase()))
        .map(automationTask));
    }
    if (rejectedRunResult.status === 'fulfilled') {
      next.push(...rejectedRunResult.value.runs.map(automationTask));
    }
    if (completedRunResult.status === 'fulfilled') {
      next.push(...completedRunResult.value.runs.map(automationTask));
    }
    next.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    setTasks(next);

    const results = [captureResult, invoiceResult, runResult, completedRunResult, rejectedRunResult];
    const rejectedSources = results.filter((result) => result.status === 'rejected').length;
    if (rejectedSources === results.length) {
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
    const refreshTimer = window.setInterval(() => void load(), 60_000);
    return () => { window.clearTimeout(timer); window.clearInterval(refreshTimer); };
  }, [load, selectedOrganizationId]);

  useEffect(() => {
    if (!router.isReady || typeof router.query.workflow !== 'string') return;
    const requested = router.query.workflow;
    if (requested === 'order_to_invoice' || requested === 'payment_knock_off' || requested === 'other') {
      const timer = window.setTimeout(() => setWorkstream(requested), 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [router.isReady, router.query.workflow]);

  const scopedTasks = useMemo(
    () => tasks.filter((task) => workstream === 'ALL' || task.workflowKey === workstream),
    [tasks, workstream],
  );
  const workflows = useMemo(() => Array.from(new Set(scopedTasks.map((task) => task.workflow))).sort(), [scopedTasks]);
  const openTasks = useMemo(() => scopedTasks.filter((task) => task.state === 'open'), [scopedTasks]);
  const completedTasks = useMemo(() => scopedTasks.filter((task) => task.state === 'completed'), [scopedTasks]);
  const rejectedTasks = useMemo(() => scopedTasks.filter((task) => task.state === 'rejected'), [scopedTasks]);
  const visibleStateTasks = useMemo(
    () => tasks.filter((task) => task.state === (view === 'OPEN' ? 'open' : view === 'COMPLETED' ? 'completed' : 'rejected')),
    [tasks, view],
  );
  const workstreamCount = (value: WorkstreamKey) => (
    value === 'ALL'
      ? visibleStateTasks.length
      : visibleStateTasks.filter((task) => task.workflowKey === value).length
  );
  const statusScopedTasks = useMemo(
    () => tasks.filter((task) => {
      if (task.state !== (view === 'OPEN' ? 'open' : view === 'COMPLETED' ? 'completed' : 'rejected')) return false;
      return workstream === 'ALL' || task.workflowKey === workstream;
    }),
    [tasks, view, workstream],
  );
  const statusCounts = useMemo(
    () => statusScopedTasks.reduce<Record<string, number>>((counts, task) => {
      const key = resolveAutomationStatus(task.status, task.approvalDestination).key;
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {}),
    [statusScopedTasks],
  );
  const availableStatuses = useMemo(
    () => AUTOMATION_STATUS_LEGEND.filter((definition) => (statusCounts[definition.key] || 0) > 0 || statusFilter === definition.key),
    [statusCounts, statusFilter],
  );
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (view === 'OPEN' && task.state !== 'open') return false;
      if (view === 'COMPLETED' && task.state !== 'completed') return false;
      if (view === 'REJECTED' && task.state !== 'rejected') return false;
      if (workstream !== 'ALL' && task.workflowKey !== workstream) return false;
      if (kind !== 'ALL' && task.kind !== kind) return false;
      if (workflow !== 'ALL' && task.workflow !== workflow) return false;
      if (statusFilter !== 'ALL' && resolveAutomationStatus(task.status, task.approvalDestination).key !== statusFilter) return false;
      if (!query) return true;
      const values = [task.id, task.href, task.title, task.subtitle, task.workflow, task.reason].map((value) => value.toLowerCase());
      return values.some((value) => value.includes(query))
        || (query.startsWith('#') && values.some((value) => value.includes(query.slice(1))));
    });
  }, [kind, search, statusFilter, tasks, view, workflow, workstream]);

  const metric = (value: ReviewKind) => openTasks.filter((task) => task.kind === value).length;

  const selectWorkstream = (value: WorkstreamKey) => {
    setWorkstream(value);
    setWorkflow('ALL');
    setKind('ALL');
    setStatusFilter('ALL');
    const nextQuery = { ...router.query };
    if (value === 'ALL') delete nextQuery.workflow;
    else nextQuery.workflow = value;
    void router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true });
  };

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

        <AutomationStatusLegend selectedStatus={statusFilter} statusCounts={statusCounts} onStatusSelect={setStatusFilter} />

        <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="mb-3">
            <p className="text-sm font-semibold text-[var(--foreground)]">Review by workflow</p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">Each workflow has its own review queue and count; task types remain available as a second filter.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {WORKSTREAM_TABS.filter((tab) => tab.value !== 'other' || workstreamCount('other') > 0 || workstream === 'other').map((tab) => {
              const Icon = tab.icon;
              const active = workstream === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => selectWorkstream(tab.value)}
                  className={`flex items-center justify-between rounded-lg border px-3 py-3 text-left transition ${active ? 'border-cyan-500 bg-cyan-500/10 ring-1 ring-cyan-500/30' : 'border-[var(--border)] hover:bg-[var(--muted)]/50'}`}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4" />{WORKSTREAM_LABELS[tab.value]}</span>
                  <span className="rounded-full bg-[var(--muted)] px-2 py-0.5 text-xs font-bold">{workstreamCount(tab.value)}</span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="Needs action" value={openTasks.length} icon={ListChecks} tone="cyan" />
          <Metric label="Approvals" value={metric('approval')} icon={CheckCircle2} tone="violet" />
          <Metric label="Matching" value={metric('matching')} icon={Split} tone="blue" />
          <Metric label="Exceptions" value={metric('validation') + metric('missing') + metric('returned') + metric('processing')} icon={ShieldAlert} tone="amber" />
          <Metric label="Rejected" value={rejectedTasks.length} icon={XCircle} tone="red" />
        </div>

        {error && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-medium text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">{error}</div>}

        <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          <div className="flex gap-2 border-b border-[var(--border)] p-4">
            <button type="button" onClick={() => { setView('OPEN'); setKind('ALL'); setStatusFilter('ALL'); }} className={`rounded-lg px-3 py-2 text-sm font-semibold ${view === 'OPEN' ? 'bg-cyan-700 text-white' : 'border border-[var(--border)]'}`}>Open reviews ({openTasks.length})</button>
            <button type="button" onClick={() => { setView('COMPLETED'); setKind('ALL'); setStatusFilter('ALL'); }} className={`rounded-lg px-3 py-2 text-sm font-semibold ${view === 'COMPLETED' ? 'bg-emerald-700 text-white' : 'border border-[var(--border)]'}`}>Completed ({completedTasks.length})</button>
            <button type="button" onClick={() => { setView('REJECTED'); setKind('ALL'); setStatusFilter('ALL'); }} className={`rounded-lg px-3 py-2 text-sm font-semibold ${view === 'REJECTED' ? 'bg-red-700 text-white' : 'border border-[var(--border)]'}`}>Rejected ({rejectedTasks.length})</button>
          </div>
          <div className="grid gap-3 border-b border-[var(--border)] p-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_220px_200px_220px]">
            <label className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search task, company, workflow, or reason" className="w-full rounded-lg border border-[var(--border)] bg-transparent py-2.5 pl-9 pr-3 text-sm outline-none focus:border-cyan-600" />
            </label>
            <select value={workflow} onChange={(event) => setWorkflow(event.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-[var(--foreground)]">
              <option value="ALL">All automations in this workflow</option>
              {workflows.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status" className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-[var(--foreground)]">
              <option value="ALL">All statuses ({statusScopedTasks.length})</option>
              {availableStatuses.map((definition) => <option key={definition.key} value={definition.key}>{definition.label} ({statusCounts[definition.key] || 0})</option>)}
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
              <h2 className="mt-3 font-semibold text-[var(--foreground)]">{view === 'REJECTED' && rejectedTasks.length === 0 ? 'No rejected items' : view === 'COMPLETED' && completedTasks.length === 0 ? 'No completed items' : openTasks.length === 0 && view === 'OPEN' ? 'You are all caught up' : 'No tasks match these filters'}</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">{view === 'REJECTED' && rejectedTasks.length === 0 ? 'Rejected automation reviews will be retained and listed here.' : view === 'COMPLETED' && completedTasks.length === 0 ? 'Completed automation reviews will be retained and searchable here.' : openTasks.length === 0 && view === 'OPEN' ? 'New approvals and exceptions will appear here automatically.' : 'Try another workflow, task type, or search.'}</p>
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
        <div className="flex flex-wrap gap-2">
          <AutomationStatusBadge status={task.status} destination={task.approvalDestination} />
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${WORKSTREAM_BADGE_STYLES[task.workflowKey]}`}>{WORKSTREAM_LABELS[task.workflowKey]}</span>
        </div>
        <p className="text-sm font-medium text-[var(--foreground)]">{task.workflow}</p>
        {task.amount && <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-[var(--foreground)]"><CircleDollarSign className="h-4 w-4" />{task.amount}</p>}
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">Updated {formatMalaysiaDateTime(task.updatedAt)} GMT+8</p>
      </div>
      <Link href={task.href} className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-white ${task.state === 'rejected' ? 'bg-slate-700 hover:bg-slate-800' : task.state === 'completed' ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-cyan-700 hover:bg-cyan-800'}`}>{task.state === 'rejected' ? 'View rejected' : task.state === 'completed' ? 'View completed' : 'Review task'} <ArrowRight className="h-4 w-4" /></Link>
    </article>
  );
}
