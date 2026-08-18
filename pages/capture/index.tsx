'use client';

import { AppLayout } from '@/components/layout';
import { CaptureShell } from '@/components/capture/CaptureShell';
import { useOrganization } from '@/lib/OrganizationContext';
import {
  listCaptureWorkInbox,
  updateCaptureEventDecision,
  updateCaptureEventsBulkDecision,
  type CaptureInboxView,
  type CaptureWorkInboxResponse,
  type CaptureWorkItem,
} from '@/services/CaptureService';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  File,
  FolderOpen,
  Info,
  Inbox,
  Mail,
  MessageCircle,
  RefreshCw,
  Search,
  Settings2,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';

const EMPTY_RESPONSE: CaptureWorkInboxResponse = {
  items: [],
  counts: { all: 0, to_review: 0, in_progress: 0, completed: 0 },
  total: 0,
  page: 1,
  page_size: 30,
};

const VIEW_TABS: Array<{
  value: CaptureInboxView;
  label: string;
  countKey: 'all' | 'in_progress' | 'completed';
  icon: typeof Inbox;
}> = [
  { value: 'ALL', label: 'All incoming', countKey: 'all', icon: Inbox },
  { value: 'IN_PROGRESS', label: 'In progress', countKey: 'in_progress', icon: Clock3 },
  { value: 'COMPLETED', label: 'Completed', countKey: 'completed', icon: CheckCircle2 },
];

const STAGE_STYLES = {
  TO_REVIEW: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100',
  IN_PROGRESS: 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100',
  COMPLETED: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
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

function primaryDescription(item: CaptureWorkItem) {
  return [item.sender, item.preview].filter(Boolean).join(' · ') || 'File received for processing';
}

function formatMalaysiaDateTime(value: string) {
  return new Intl.DateTimeFormat('en-MY', {
    timeZone: 'Asia/Kuala_Lumpur',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date(value));
}

export default function CaptureInboxPage() {
  const { selectedOrganizationId } = useOrganization();
  const [response, setResponse] = useState<CaptureWorkInboxResponse>(EMPTY_RESPONSE);
  const [view, setView] = useState<CaptureInboxView>('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<number>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [includeIgnored, setIncludeIgnored] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await listCaptureWorkInbox({
        view,
        page,
        pageSize,
        sourceType: sourceFilter,
        search: deferredSearch,
        includeIgnored: view === 'COMPLETED' && includeIgnored,
      });
      setResponse(next);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load the Inbox.');
    } finally {
      setLoading(false);
    }
  }, [deferredSearch, includeIgnored, page, pageSize, sourceFilter, view]);

  useEffect(() => {
    void load();
  }, [load, selectedOrganizationId]);

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, pageSize, sourceFilter, view, selectedOrganizationId]);

  const totalPages = Math.max(1, Math.ceil(response.total / response.page_size));
  const firstItem = response.total === 0 ? 0 : (response.page - 1) * response.page_size + 1;
  const lastItem = Math.min(response.page * response.page_size, response.total);

  const emptyCopy = useMemo(() => {
    if (view === 'IN_PROGRESS') return ['Nothing is processing', 'New uploads and channel items appear here while Smartdok is working.'];
    if (view === 'COMPLETED') return ['No completed work yet', 'Filtered, ignored and completed items will appear here.'];
    return ['Nothing has arrived yet', 'New uploads and connected-channel messages will appear here.'];
  }, [view]);

  const selectableEventIds = useMemo(
    () => response.items
      .filter((item) => view === 'ALL' && item.capture_event_id && item.stage !== 'COMPLETED')
      .map((item) => item.capture_event_id as number),
    [response.items, view],
  );
  const allPageItemsSelected = selectableEventIds.length > 0
    && selectableEventIds.every((eventId) => selectedEventIds.has(eventId));

  const toggleEvent = (eventId: number) => {
    setSelectedEventIds((current) => {
      const next = new Set(current);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  const togglePage = () => {
    setSelectedEventIds((current) => {
      const next = new Set(current);
      if (allPageItemsSelected) selectableEventIds.forEach((eventId) => next.delete(eventId));
      else selectableEventIds.forEach((eventId) => next.add(eventId));
      return next;
    });
  };

  const ignoreSelected = async () => {
    const eventIds = Array.from(selectedEventIds);
    if (eventIds.length === 0) return;
    setBulkUpdating(true);
    try {
      await updateCaptureEventsBulkDecision(eventIds, 'IGNORE');
      setSelectedEventIds(new Set());
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not ignore the selected messages.');
    } finally {
      setBulkUpdating(false);
    }
  };

  const decide = async (eventId: number, action: 'IGNORE' | 'RESTORE') => {
    setUpdatingId(eventId);
    try {
      await updateCaptureEventDecision(eventId, action);
      setSelectedEventIds((current) => {
        const next = new Set(current);
        next.delete(eventId);
        return next;
      });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update the item.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <AppLayout pageName="Inbox">
      <CaptureShell
        title="Inbox"
        description="Review incoming work, follow processing, and open the results Smartdok prepared."
        actions={(
          <>
            <Link
              href="/integrations"
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--muted)]"
            >
              <Settings2 className="h-4 w-4" /> Integrations
            </Link>
            <Link
              href="/documents/new"
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700"
            >
              <Upload className="h-4 w-4" /> Upload documents
            </Link>
          </>
        )}
      >
        <div className="space-y-6">

        <div className="grid gap-3 md:grid-cols-3">
          {VIEW_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = view === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => {
                  setView(tab.value);
                  setPage(1);
                  setSelectedEventIds(new Set());
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
                <span className="text-2xl font-bold">{response.counts[tab.countKey]}</span>
              </button>
            );
          })}
        </div>

        {response.counts.to_review > 0 && (
          <div className="flex flex-col gap-3 rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-100 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-cyan-600" />
              <div>
                <p className="font-semibold">{response.counts.to_review} item{response.counts.to_review === 1 ? '' : 's'} need a decision</p>
                <p className="mt-1 leading-6 text-cyan-900/80 dark:text-cyan-100/80">
                  Inbox shows what arrived. Approvals, corrections, and matching exceptions are handled in Review.
                </p>
              </div>
            </div>
            <Link href="/review" className="inline-flex shrink-0 items-center justify-center rounded-lg bg-cyan-700 px-3 py-2 font-semibold text-white hover:bg-cyan-800">Open Review</Link>
          </div>
        )}

        <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <div className="grid gap-3 border-b border-[var(--border)] p-4 lg:grid-cols-[minmax(0,1fr)_210px_auto]">
            <label className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--muted-foreground)]" />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                  setSelectedEventIds(new Set());
                }}
                placeholder="Search sender, workflow, subject or filename"
                className="w-full rounded-lg border border-[var(--border)] bg-transparent py-2 pl-9 pr-3 text-sm outline-none focus:border-cyan-500"
              />
            </label>
            <select
              value={sourceFilter}
              onChange={(event) => {
                setSourceFilter(event.target.value);
                setPage(1);
                setSelectedEventIds(new Set());
              }}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
            >
              <option value="ALL">All sources</option>
              <option value="UPLOAD">Upload</option>
              <option value="INBOUND_EMAIL">Inbound email</option>
              <option value="GMAIL">Gmail</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="DRIVE">Google Drive</option>
              <option value="TELEGRAM">Telegram</option>
            </select>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--muted)] disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            {view === 'COMPLETED' && (
              <label className="flex items-center gap-2 text-sm text-[var(--muted-foreground)] lg:col-span-3">
                <input
                  type="checkbox"
                  checked={includeIgnored}
                  onChange={(event) => {
                    setIncludeIgnored(event.target.checked);
                    setPage(1);
                  }}
                  className="h-4 w-4 rounded border-[var(--border)] accent-cyan-600"
                />
                Show ignored and automatically filtered messages
              </label>
            )}
          </div>

          {error && (
            <div className="m-4 rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              {error}
            </div>
          )}

          {view === 'ALL' && selectableEventIds.length > 0 && (
            <div className="flex flex-col gap-3 border-b border-[var(--border)] bg-[var(--muted)]/35 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={allPageItemsSelected}
                  onChange={togglePage}
                  className="h-4 w-4 rounded border-[var(--border)] accent-cyan-600"
                />
                Select this page
                {selectedEventIds.size > 0 && (
                  <span className="font-normal text-[var(--muted-foreground)]">· {selectedEventIds.size} selected</span>
                )}
              </label>
              {selectedEventIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => void ignoreSelected()}
                  disabled={bulkUpdating}
                  className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-medium hover:bg-[var(--muted)] disabled:opacity-50"
                >
                  {bulkUpdating ? 'Ignoring…' : `Ignore ${selectedEventIds.size} selected`}
                </button>
              )}
            </div>
          )}

          {loading && response.items.length === 0 ? (
            <div className="p-12 text-center text-sm text-[var(--muted-foreground)]">Loading Inbox…</div>
          ) : response.items.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
              <h2 className="mt-3 font-semibold">{emptyCopy[0]}</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">{emptyCopy[1]}</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {response.items.map((item) => {
                // Older Inbox records predate review_run_ids.  Their result_id is
                // still the review task ID, so surface it in exactly the same way.
                const reviewRunIds = item.review_run_ids?.length
                  ? item.review_run_ids
                  : item.result_id ? [item.result_id] : [];

                return (
                <article
                  key={item.id}
                  className="grid gap-3 p-4 transition hover:bg-[var(--muted)]/40 lg:grid-cols-[24px_42px_minmax(0,1fr)_190px_160px] lg:items-center"
                >
                  <div className="flex items-center justify-center">
                    {view === 'ALL' && item.capture_event_id && item.stage !== 'COMPLETED' ? (
                      <input
                        type="checkbox"
                        aria-label={`Select ${item.title}`}
                        checked={selectedEventIds.has(item.capture_event_id)}
                        onChange={() => toggleEvent(item.capture_event_id as number)}
                        className="h-4 w-4 rounded border-[var(--border)] accent-cyan-600"
                      />
                    ) : null}
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-700 dark:text-cyan-300">
                    {sourceIcon(item.source_type)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{item.title}</p>
                      <span className="rounded-full bg-[var(--muted)] px-2 py-0.5 text-xs text-[var(--muted-foreground)]">
                        {item.workflow_name}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-[var(--muted-foreground)]">
                      {primaryDescription(item)}
                    </p>
                    {item.filenames.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {item.filenames.slice(0, 3).map((filename) => (
                          <span key={filename} className="inline-flex max-w-[260px] items-center gap-1 truncate rounded-md bg-[var(--muted)] px-2 py-1 text-xs">
                            <File className="h-3 w-3 shrink-0" /> {filename}
                          </span>
                        ))}
                        {item.filenames.length > 3 && (
                          <span className="rounded-md bg-[var(--muted)] px-2 py-1 text-xs">+{item.filenames.length - 3}</span>
                        )}
                      </div>
                    )}
                    {reviewRunIds.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-[var(--muted-foreground)]">Open this review:</span>
                        {reviewRunIds.map((runId) => (
                          <Link key={runId} href={`/review/${runId}`} className="rounded-md bg-cyan-700 px-3 py-1.5 font-bold text-white shadow-sm ring-2 ring-cyan-200 hover:bg-cyan-800 dark:ring-cyan-900">
                            Review #{runId}
                          </Link>
                        ))}
                      </div>
                    )}
                    {item.reason && (
                      <p className={`mt-2 line-clamp-2 text-xs ${item.status === 'FAILED' ? 'text-red-700 dark:text-red-300' : 'text-[var(--muted-foreground)]'}`}>
                        {item.reason}
                      </p>
                    )}
                  </div>
                  <div>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STAGE_STYLES[item.stage]}`}>
                      {item.status_label}
                    </span>
                    <p className="hidden">
                      {humanize(item.source_type)} · {new Date(item.received_at).toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      {humanize(item.source_type)} · {formatMalaysiaDateTime(item.received_at)} GMT+8
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    {reviewRunIds.length > 0 ? (
                      reviewRunIds.map((runId) => (
                        <Link key={runId} href={`/review/${runId}`} className="rounded-md bg-cyan-700 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-cyan-800">
                          Open Review #{runId}
                        </Link>
                      ))
                    ) : item.review_url && (
                      <Link
                        href={item.review_url}
                        className="rounded-md bg-cyan-700 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-cyan-800"
                      >
                        {item.result_id ? `Open Review #${item.result_id}` : 'Open review'}
                      </Link>
                    )}
                    {item.capture_event_id && item.stage !== 'COMPLETED' && (
                      <button
                        type="button"
                        disabled={updatingId === item.capture_event_id}
                        onClick={() => void decide(item.capture_event_id!, 'IGNORE')}
                        className="rounded-md px-2.5 py-1.5 text-xs font-medium text-[var(--muted-foreground)] hover:bg-[var(--card)] disabled:opacity-50"
                      >
                        Ignore
                      </button>
                    )}
                    {item.capture_event_id && ['IGNORED', 'FILTERED'].includes(item.status) && (
                      <button
                        type="button"
                        disabled={updatingId === item.capture_event_id}
                        onClick={() => void decide(item.capture_event_id!, 'RESTORE')}
                        className="rounded-md px-2.5 py-1.5 text-xs font-medium text-cyan-700 hover:bg-cyan-500/10 dark:text-cyan-300 disabled:opacity-50"
                      >
                        Restore
                      </button>
                    )}
                  </div>
                </article>
                );
              })}
            </div>
          )}

          {response.total > 0 && (
            <div className="flex flex-col gap-3 border-t border-[var(--border)] px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3 text-[var(--muted-foreground)]">
                <label className="flex items-center gap-2">
                  Rows per page
                  <select
                    value={pageSize}
                    onChange={(event) => {
                      setPageSize(Number(event.target.value));
                      setPage(1);
                      setSelectedEventIds(new Set());
                    }}
                    className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-sm text-[var(--foreground)]"
                  >
                    <option value={30}>30</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </label>
                <span>Showing {firstItem}–{lastItem} of {response.total}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPage((current) => Math.max(1, current - 1));
                    setSelectedEventIds(new Set());
                  }}
                  disabled={response.page === 1}
                  className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </button>
                <span className="min-w-20 text-center text-xs text-[var(--muted-foreground)]">
                  Page {response.page} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setPage((current) => Math.min(totalPages, current + 1));
                    setSelectedEventIds(new Set());
                  }}
                  disabled={response.page >= totalPages}
                  className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </section>
        </div>
      </CaptureShell>
    </AppLayout>
  );
}
