'use client';

import { CaptureShell } from '@/components/capture/CaptureShell';
import { AppLayout } from '@/components/layout';
import { useOrganization } from '@/lib/OrganizationContext';
import {
  getCaptureEvent,
  updateCaptureEventDecision,
  type CaptureEvent,
} from '@/services/CaptureService';
import {
  ArrowLeft,
  File,
  Mail,
  MessageSquareText,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function CaptureMessageDetailPage() {
  const router = useRouter();
  const { selectedOrganizationId } = useOrganization();
  const eventId = Number(router.query.id);
  const [item, setItem] = useState<CaptureEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    getCaptureEvent(eventId)
      .then((event) => {
        setItem(event);
        setError(null);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load the message.'))
      .finally(() => setLoading(false));
  }, [eventId, selectedOrganizationId]);

  const decide = async (action: 'IGNORE' | 'RESTORE') => {
    if (!item) return;
    setUpdating(true);
    try {
      setItem(await updateCaptureEventDecision(item.id, action));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update the message.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <AppLayout pageName="Capture item">
      <CaptureShell
        title={item?.subject || item?.attachments[0]?.filename || 'Incoming item'}
        description="Original channel context, filtering decision and files associated with this capture."
        actions={(
          <Link href="/capture" className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--muted)]">
            <ArrowLeft className="h-4 w-4" /> Back to inbox
          </Link>
        )}
      >
        {loading && <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-10 text-center text-sm text-[var(--muted-foreground)]">Loading item…</div>}
        {error && <div className="rounded-xl border border-red-300/50 bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-100">{error}</div>}
        {item && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="rounded-xl border border-[var(--border)] bg-[var(--card)]">
              <div className="border-b border-[var(--border)] p-5">
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-cyan-600" />
                  <h2 className="font-semibold">Message context</h2>
                </div>
              </div>
              <dl className="grid gap-4 p-5 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-[var(--muted-foreground)]">Source</dt><dd className="mt-1 font-medium">{item.source_type.replaceAll('_', ' ')}</dd></div>
                <div><dt className="text-xs text-[var(--muted-foreground)]">Received</dt><dd className="mt-1 font-medium">{new Date(item.received_at || item.created_at).toLocaleString()}</dd></div>
                <div><dt className="text-xs text-[var(--muted-foreground)]">Sender</dt><dd className="mt-1 break-all font-medium">{item.sender || 'Not provided'}</dd></div>
                <div><dt className="text-xs text-[var(--muted-foreground)]">Recipients</dt><dd className="mt-1 break-all font-medium">{item.recipients.join(', ') || 'Not provided'}</dd></div>
                <div className="sm:col-span-2"><dt className="text-xs text-[var(--muted-foreground)]">Subject</dt><dd className="mt-1 font-medium">{item.subject || 'No subject'}</dd></div>
              </dl>
              <div className="border-t border-[var(--border)] p-5">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium"><MessageSquareText className="h-4 w-4" /> Message preview</div>
                <p className="whitespace-pre-wrap rounded-lg bg-[var(--muted)] p-4 text-sm leading-6">{item.body_preview || 'No message body was retained.'}</p>
              </div>
              <div className="border-t border-[var(--border)] p-5">
                <h3 className="mb-3 text-sm font-medium">Attachments</h3>
                <div className="space-y-2">
                  {item.attachments.map((attachment) => (
                    <div key={`${attachment.external_id}-${attachment.filename}`} className="flex items-center gap-3 rounded-lg border border-[var(--border)] p-3">
                      <File className="h-5 w-5 text-cyan-600" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{attachment.filename}</p>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {attachment.content_type || 'Unknown type'}
                          {attachment.size_bytes ? ` · ${(attachment.size_bytes / 1024).toFixed(1)} KB` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                  {item.attachments.length === 0 && <p className="text-sm text-[var(--muted-foreground)]">No supported attachment was found.</p>}
                </div>
              </div>
            </section>

            <aside className="space-y-4">
              <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
                <p className="text-xs text-[var(--muted-foreground)]">Current status</p>
                <p className="mt-1 text-lg font-semibold">{item.status.replaceAll('_', ' ')}</p>
                {item.decision_reason && <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">{item.decision_reason}</p>}
                {item.error_message && <p className="mt-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">{item.error_message}</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  {!['IGNORED', 'FILTERED'].includes(item.status) ? (
                    <button disabled={updating} onClick={() => void decide('IGNORE')} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--muted)] disabled:opacity-50">Ignore</button>
                  ) : (
                    <button disabled={updating} onClick={() => void decide('RESTORE')} className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50"><RefreshCw className="h-4 w-4" /> Restore for review</button>
                  )}
                </div>
              </section>
              <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
                <p className="text-xs text-[var(--muted-foreground)]">Processing jobs</p>
                <div className="mt-2 space-y-2">
                  {item.job_ids.map((jobId) => <code key={jobId} className="block break-all rounded bg-[var(--muted)] p-2 text-xs">{jobId}</code>)}
                  {item.job_ids.length === 0 && <p className="text-sm text-[var(--muted-foreground)]">No AI processing job was created, so this item consumed no extraction cost.</p>}
                </div>
              </section>
            </aside>
          </div>
        )}
      </CaptureShell>
    </AppLayout>
  );
}
