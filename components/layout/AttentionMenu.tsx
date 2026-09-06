'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BellRing } from 'lucide-react';
import { useOrganization } from '@/lib/OrganizationContext';
import { listRuns, type AgentRunListItem } from '@/services/AgentsService';

/** Run states that a person still has to act on, with why each one is waiting. */
const ATTENTION_STATES: { status: string; reason: string }[] = [
  { status: 'EXTERNAL_DOCUMENTS_RECEIVED', reason: 'Supplier files returned' },
  { status: 'VERIFICATION_FAILED', reason: 'Verification found differences' },
  { status: 'VERIFICATION_PASSED', reason: 'Verified, ready to send' },
];

const REASON_STYLE: Record<string, string> = {
  EXTERNAL_DOCUMENTS_RECEIVED: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100',
  VERIFICATION_FAILED: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100',
  VERIFICATION_PASSED: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
};

interface AttentionItem extends AgentRunListItem {
  reason: string;
}

function describe(item: AttentionItem): string {
  return (
    item.issuing_company
    || item.po_label
    || item.source_filename
    || (item.source_caption || '').split('\n')[0]
    || 'Incoming order'
  );
}

const SEEN_STORAGE_KEY = 'smartdok.attention.seen';

function readSeen(): Set<string> {
  try {
    const raw = window.localStorage.getItem(SEEN_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

/** An item is "seen" at the state it was in, so a later change resurfaces it. */
function signature(item: { id: number; status: string; updated_at?: string | null }): string {
  return `${item.id}:${item.status}:${item.updated_at || ''}`;
}

/**
 * Header bell listing every item waiting on a person, each linking straight to
 * its own Review page. A count alone cannot be acted on: it forces the reader to
 * go hunting through the full queue for the handful that actually changed.
 */
export function AttentionMenu() {
  const { selectedOrganizationId } = useOrganization();
  const [items, setItems] = useState<AttentionItem[]>([]);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(() => {
    void Promise.all(
      ATTENTION_STATES.map(({ status, reason }) =>
        listRuns({ status, page: 1, pageSize: 10 })
          .then((result) => result.runs.map((run) => ({ ...run, reason })))
          .catch(() => [] as AttentionItem[]),
      ),
    ).then((results) => {
      const merged = results.flat();
      merged.sort((left, right) => {
        const leftTime = Date.parse(left.updated_at || left.received_at || '') || 0;
        const rightTime = Date.parse(right.updated_at || right.received_at || '') || 0;
        return rightTime - leftTime;
      });
      setItems(merged);
    });
  }, []);

  useEffect(() => {
    setSeen(readSeen());
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, [refresh, selectedOrganizationId]);

  // Opening the menu is the act of reading it, so everything listed counts as
  // seen. An item whose state later changes gets a new signature and returns.
  useEffect(() => {
    if (!open || items.length === 0) return;
    const next = new Set(items.map(signature));
    setSeen(next);
    try {
      window.localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      // Read state is a convenience; the list itself is still correct.
    }
  }, [open, items]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const unread = items.filter((item) => !seen.has(signature(item)));
  const count = items.length;
  const unreadCount = unread.length;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={unreadCount ? `${unreadCount} of ${count} items need attention` : `${count} items need attention, all seen`}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
      >
        <BellRing className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[17px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-[17px] text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2.5">
            <p className="text-sm font-semibold">Needs your attention</p>
            <span className="text-xs text-[var(--muted-foreground)]">{unreadCount > 0 ? `${unreadCount} new of ${count}` : `${count} item${count === 1 ? '' : 's'}`}</span>
          </div>

          {count === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-[var(--muted-foreground)]">
              Nothing is waiting on you.
            </p>
          ) : (
            <ul className="max-h-[22rem] overflow-y-auto">
              {items.map((item) => (
                <li key={`${item.status}-${item.id}`}>
                  <Link
                    href={`/review/${item.id}`}
                    onClick={() => setOpen(false)}
                    className="flex flex-col gap-1 border-b border-[var(--border)] px-4 py-3 last:border-b-0 hover:bg-[var(--muted)] focus:outline-none focus-visible:bg-[var(--muted)]"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        {!seen.has(signature(item)) && <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-600" />}
                        <span className="truncate text-sm font-medium">{describe(item)}</span>
                      </span>
                      <span className="shrink-0 font-mono text-xs text-[var(--muted-foreground)]">#{item.id}</span>
                    </span>
                    <span className={`w-fit rounded-md px-1.5 py-0.5 text-[11px] font-medium ${REASON_STYLE[item.status] || 'bg-[var(--muted)]'}`}>
                      {item.reason}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <Link
            href="/review?workflow=order_to_invoice"
            onClick={() => setOpen(false)}
            className="block border-t border-[var(--border)] px-4 py-2.5 text-center text-sm font-semibold text-cyan-700 hover:bg-[var(--muted)] dark:text-cyan-400"
          >
            Open Review queue
          </Link>
        </div>
      )}
    </div>
  );
}
