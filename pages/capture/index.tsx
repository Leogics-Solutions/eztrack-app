'use client';

import { AppLayout } from '@/components/layout';
import { CaptureShell } from '@/components/capture/CaptureShell';
import { useOrganization } from '@/lib/OrganizationContext';
import {
  listCaptureInbox,
  updateCaptureEventDecision,
  type CaptureEvent,
} from '@/services/CaptureService';
import {
  listBatchJobs,
  type BatchJobListItem,
} from '@/services/InvoiceService';
import {
  AlertTriangle,
  CheckCircle2,
  File,
  FileClock,
  FolderOpen,
  Inbox,
  Mail,
  MessageCircle,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

type InboxItem = {
  key: string;
  eventId?: number;
  sourceType: string;
  sender?: string | null;
  title: string;
  preview?: string | null;
  filenames: string[];
  status: string;
  reason?: string | null;
  receivedAt?: string | null;
  jobId?: string;
};

const STATUS_STYLES: Record<string, string> = {
  RECEIVED: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  ACCEPTED: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200',
  QUEUED: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  RUNNING: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
  PROCESSING: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
  SUCCESS: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  COMPLETED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  FILTERED: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200',
  IGNORED: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
  FAILED: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
};

function sourceIcon(source: string) {
  const props = { className: 'h-4 w-4' };
  if (source === 'GMAIL' || source === 'INBOUND_EMAIL') return <Mail {...props} />;
  if (source === 'WHATSAPP') return <MessageCircle {...props} />;
  if (source === 'DRIVE') return <FolderOpen {...props} />;
  return <Upload {...props} />;
}

function humanize(value: string) {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function mapEvent(event: CaptureEvent): InboxItem {
  return {
    key: `event-${event.id}`,
    eventId: event.id,
    sourceType: event.source_type,
    sender: event.sender,
    title: event.subject || event.attachments[0]?.filename || 'Incoming item',
    preview: event.body_preview,
    filenames: event.attachments.map((attachment) => attachment.filename),
    status: event.status,
    reason: event.error_message || event.decision_reason,
    receivedAt: event.received_at || event.created_at,
    jobId: event.job_ids[0],
  };
}

function mapJob(job: BatchJobListItem): InboxItem {
  return {
    key: `job-${job.id}`,
    sourceType: 'UPLOAD',
    title: job.original_filename || 'Uploaded document',
    filenames: job.original_filename ? [job.original_filename] : [],
    status: job.status,
    receivedAt: job.created_at,
    jobId: job.id,
  };
}

function linkedJobStatus(
  event: CaptureEvent,
  jobsById: Map<string, BatchJobListItem>
): string {
  const statuses = event.job_ids
    .map((jobId) => jobsById.get(jobId)?.status)
    .filter((status): status is BatchJobListItem['status'] => Boolean(status));

  if (statuses.length === 0) return event.status;
  if (statuses.some((status) => status === 'FAILED')) return 'FAILED';
  if (statuses.some((status) => status === 'RUNNING')) return 'RUNNING';
  if (statuses.some((status) => status === 'PENDING')) return 'PENDING';
  if (statuses.every((status) => status === 'SUCCESS')) return 'SUCCESS';
  return event.status;
}

export default function CaptureInboxPage() {
  const { selectedOrganizationId } = useOrganization();
  const [events, setEvents] = useState<CaptureEvent[]>([]);
  const [jobs, setJobs] = useState<BatchJobListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [captureResult, jobsResult] = await Promise.allSettled([
      listCaptureInbox({ pageSize: 100 }),
      listBatchJobs(),
    ]);

    if (captureResult.status === 'fulfilled') {
      setEvents(captureResult.value.items || []);
      setError(null);
    } else {
      setEvents([]);
      setError(captureResult.reason?.message || 'Could not load channel messages.');
    }
    if (jobsResult.status === 'fulfilled') {
      setJobs(jobsResult.value.data?.jobs || []);
    } else {
      setJobs([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load, selectedOrganizationId]);

  const items = useMemo(() => {
    const jobsById = new Map(jobs.map((job) => [job.id, job]));
    const linkedJobs = new Set(events.flatMap((event) => event.job_ids || []));
    const combined = [
      ...events.map((event) => ({
        ...mapEvent(event),
        status: linkedJobStatus(event, jobsById),
      })),
      ...jobs.filter((job) => !linkedJobs.has(job.id)).map(mapJob),
    ];
    const query = search.trim().toLowerCase();
    return combined
      .filter((item) => sourceFilter === 'ALL' || item.sourceType === sourceFilter)
      .filter((item) => statusFilter === 'ALL' || item.status === statusFilter)
      .filter((item) => {
        if (!query) return true;
        return [
          item.title,
          item.sender,
          item.preview,
          item.reason,
          ...item.filenames,
        ].some((value) => value?.toLowerCase().includes(query));
      })
      .sort((a, b) => {
        const aTime = a.receivedAt ? new Date(a.receivedAt).getTime() : 0;
        const bTime = b.receivedAt ? new Date(b.receivedAt).getTime() : 0;
        return bTime - aTime;
      });
  }, [events, jobs, search, sourceFilter, statusFilter]);

  const counts = useMemo(() => ({
    total: items.length,
    filtered: items.filter((item) => ['FILTERED', 'IGNORED'].includes(item.status)).length,
    action: items.filter((item) => ['FAILED', 'RECEIVED'].includes(item.status)).length,
    processing: items.filter((item) => ['QUEUED', 'PENDING', 'RUNNING', 'PROCESSING'].includes(item.status)).length,
  }), [items]);

  const decide = async (eventId: number, action: 'IGNORE' | 'RESTORE') => {
    setUpdatingId(eventId);
    try {
      const updated = await updateCaptureEventDecision(eventId, action);
      setEvents((current) => current.map((event) => event.id === eventId ? updated : event));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update the item.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <AppLayout pageName="Capture">
      <CaptureShell
        title="Smart Inbox"
        description="One queue for messages and files received from every configured input channel."
        actions={(
          <>
            <Link
              href="/documents/new"
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700"
            >
              <Upload className="h-4 w-4" /> Upload file
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--muted)] disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Visible items', value: counts.total, icon: Inbox, color: 'text-cyan-600' },
            { label: 'Filtered without AI', value: counts.filtered, icon: SlidersHorizontal, color: 'text-violet-600' },
            { label: 'Needs attention', value: counts.action, icon: AlertTriangle, color: 'text-red-600' },
            { label: 'In progress', value: counts.processing, icon: FileClock, color: 'text-amber-600' },
          ].map((metric) => {
            const Icon = metric.icon;
            return (
              <div key={metric.label} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-[var(--muted-foreground)]">{metric.label}</p>
                  <Icon className={`h-5 w-5 ${metric.color}`} />
                </div>
                <p className="mt-2 text-2xl font-bold">{metric.value}</p>
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <div className="grid gap-3 border-b border-[var(--border)] p-4 lg:grid-cols-[1fr_180px_180px]">
            <label className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--muted-foreground)]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search sender, subject, filename or reason"
                className="w-full rounded-lg border border-[var(--border)] bg-transparent py-2 pl-9 pr-3 text-sm outline-none focus:border-cyan-500"
              />
            </label>
            <select
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
            >
              <option value="ALL">All channels</option>
              <option value="UPLOAD">Upload</option>
              <option value="INBOUND_EMAIL">Inbound email</option>
              <option value="GMAIL">Gmail</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="DRIVE">Google Drive</option>
              <option value="TELEGRAM">Telegram</option>
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
            >
              <option value="ALL">All statuses</option>
              <option value="RECEIVED">Received</option>
              <option value="FILTERED">Filtered</option>
              <option value="QUEUED">Queued</option>
              <option value="RUNNING">Processing</option>
              <option value="SUCCESS">Completed</option>
              <option value="FAILED">Failed</option>
              <option value="IGNORED">Ignored</option>
            </select>
          </div>

          {error && (
            <div className="m-4 rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              {error}
            </div>
          )}

          {loading ? (
            <div className="p-12 text-center text-sm text-[var(--muted-foreground)]">Loading incoming work…</div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
              <h2 className="mt-3 font-semibold">No incoming items match these filters</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Upload a document or sync a connected channel to populate the inbox.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {items.map((item) => (
                <div key={item.key} className="grid gap-3 p-4 hover:bg-[var(--muted)]/40 lg:grid-cols-[42px_minmax(0,1fr)_170px_150px] lg:items-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-700 dark:text-cyan-300">
                    {sourceIcon(item.sourceType)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{item.title}</p>
                      <span className="text-xs text-[var(--muted-foreground)]">{humanize(item.sourceType)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-[var(--muted-foreground)]">
                      {[item.sender, item.preview].filter(Boolean).join(' · ') || 'File received for processing'}
                    </p>
                    {item.filenames.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {item.filenames.slice(0, 3).map((filename) => (
                          <span key={filename} className="inline-flex max-w-[260px] items-center gap-1 truncate rounded-md bg-[var(--muted)] px-2 py-1 text-xs">
                            <File className="h-3 w-3 shrink-0" /> {filename}
                          </span>
                        ))}
                      </div>
                    )}
                    {item.reason && (
                      <p className="mt-2 text-xs text-[var(--muted-foreground)]">{item.reason}</p>
                    )}
                  </div>
                  <div>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[item.status] || STATUS_STYLES.RECEIVED}`}>
                      {humanize(item.status)}
                    </span>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      {item.receivedAt ? new Date(item.receivedAt).toLocaleString() : 'Time unavailable'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    {item.eventId && (
                      <Link href={`/capture/messages/${item.eventId}`} className="rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--card)]">
                        View
                      </Link>
                    )}
                    {item.eventId && !['IGNORED', 'FILTERED'].includes(item.status) && (
                      <button
                        type="button"
                        disabled={updatingId === item.eventId}
                        onClick={() => void decide(item.eventId!, 'IGNORE')}
                        className="rounded-md px-2.5 py-1.5 text-xs font-medium text-[var(--muted-foreground)] hover:bg-[var(--card)] disabled:opacity-50"
                      >
                        Ignore
                      </button>
                    )}
                    {item.eventId && ['IGNORED', 'FILTERED'].includes(item.status) && (
                      <button
                        type="button"
                        disabled={updatingId === item.eventId}
                        onClick={() => void decide(item.eventId!, 'RESTORE')}
                        className="rounded-md px-2.5 py-1.5 text-xs font-medium text-cyan-700 hover:bg-cyan-500/10 dark:text-cyan-300 disabled:opacity-50"
                      >
                        Restore
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CaptureShell>
    </AppLayout>
  );
}
