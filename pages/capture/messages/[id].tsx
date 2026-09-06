'use client';

import { CaptureShell } from '@/components/capture/CaptureShell';
import { AppLayout } from '@/components/layout';
import { AutomationStatusBadge } from '@/components/automation/AutomationStatus';
import { useOrganization } from '@/lib/OrganizationContext';
import {
  createCapturePaymentReview,
  getCaptureAttachmentPreview,
  getCaptureEvent,
  uploadMissingCaptureAttachment,
  updateCaptureEventDecision,
  type CaptureAttachmentPreview,
  type CaptureEvent,
} from '@/services/CaptureService';
import { addPaymentEvidence } from '@/services/AgentsService';
import {
  ArrowLeft,
  ExternalLink,
  File as FileIcon,
  LoaderCircle,
  Mail,
  MessageSquareText,
  RefreshCw,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
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
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [creatingReview, setCreatingReview] = useState(false);
  const [missingFile, setMissingFile] = useState<File | null>(null);
  const [uploadingMissingFile, setUploadingMissingFile] = useState(false);
  const [attachmentPreviews, setAttachmentPreviews] = useState<Record<number, CaptureAttachmentPreview>>({});

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    getCaptureEvent(eventId)
      .then(async (event) => {
        setItem(event);
        setError(null);
        const previews = await Promise.all(event.attachments.map(async (_attachment, index) => {
          try {
            return [index, await getCaptureAttachmentPreview(event.id, index)] as const;
          } catch {
            return null;
          }
        }));
        setAttachmentPreviews(Object.fromEntries(
          previews.filter((preview): preview is readonly [number, CaptureAttachmentPreview] => preview !== null)
        ));
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load the message.'))
      .finally(() => setLoading(false));
  }, [eventId, selectedOrganizationId]);

  const decide = async (action: 'IGNORE' | 'RESTORE') => {
    if (!item) return;
    const reason = action === 'IGNORE'
      ? window.prompt('Why is this message being ignored? This note will be kept for the PIC audit trail.')?.trim()
      : undefined;
    if (action === 'IGNORE' && !reason) return;
    setUpdating(true);
    try {
      setItem(await updateCaptureEventDecision(item.id, action, reason));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update the message.');
    } finally {
      setUpdating(false);
    }
  };

  const uploadPaymentEvidence = async () => {
    if (!item?.automation_run_id || evidenceFiles.length === 0) return;
    setUploadingEvidence(true);
    try {
      await addPaymentEvidence(item.automation_run_id, evidenceFiles);
      setEvidenceFiles([]);
      await router.push(item.review_url || `/review/${item.automation_run_id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not add the payment evidence.');
    } finally {
      setUploadingEvidence(false);
    }
  };

  const createPaymentReview = async () => {
    if (!item) return;
    setCreatingReview(true);
    try {
      const created = await createCapturePaymentReview(item.id);
      if (evidenceFiles.length > 0) {
        await addPaymentEvidence(created.run_id, evidenceFiles);
      }
      setEvidenceFiles([]);
      await router.push(created.review_url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create the payment review.');
    } finally {
      setCreatingReview(false);
    }
  };

  const uploadMissingFile = async () => {
    if (!item || !missingFile) return;
    setUploadingMissingFile(true);
    try {
      const updated = await uploadMissingCaptureAttachment(item.id, missingFile);
      setItem(updated);
      setMissingFile(null);
      if (updated.review_url) await router.push(updated.review_url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not upload the missing attachment.');
    } finally {
      setUploadingMissingFile(false);
    }
  };

  const failedAttachment = item?.attachments.find(
    (attachment) => String(attachment.download_status || '').toUpperCase() === 'FAILED'
  );

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
                <div><dt className="text-xs text-[var(--muted-foreground)]">Sender</dt><dd className="mt-1 break-all font-medium">{item.sender_name || item.sender || 'Not provided'}{item.sender_name && item.sender && item.sender_name !== item.sender ? <span className="mt-0.5 block text-xs font-normal text-[var(--muted-foreground)]">{item.sender}</span> : null}</dd></div>
                <div><dt className="text-xs text-[var(--muted-foreground)]">Group</dt><dd className="mt-1 break-all font-medium">{item.group_name || item.recipients.join(', ') || 'Not provided'}</dd></div>
                <div><dt className="text-xs text-[var(--muted-foreground)]">Payment company</dt><dd className="mt-1 font-medium">{item.company_name || 'Not resolved yet'}</dd></div>
                <div><dt className="text-xs text-[var(--muted-foreground)]">Channel message ID</dt><dd className="mt-1 break-all font-mono text-xs">{item.channel_message_id || 'Not provided'}</dd></div>
                <div className="sm:col-span-2"><dt className="text-xs text-[var(--muted-foreground)]">Subject</dt><dd className="mt-1 font-medium">{item.subject || 'No subject'}</dd></div>
              </dl>
              {(item.quoted_message_id || item.quoted_channel_message_id) && <div className="border-t border-[var(--border)] p-5"><div className="mb-2 flex items-center gap-2 text-sm font-medium"><MessageSquareText className="h-4 w-4" /> Quoted message detected</div><div className="rounded-lg border border-cyan-300 bg-cyan-50 p-4 text-sm text-cyan-950"><p className="text-xs font-semibold uppercase tracking-wide">{item.quoted_type ? item.quoted_type.replaceAll('_', ' ') : `${item.source_type.replaceAll('_', ' ')} reply`}{item.quoted_sender_name ? ` · ${item.quoted_sender_name}` : ''}</p><p className="mt-2 whitespace-pre-wrap">{item.quoted_preview || 'The connector supplied the quoted message identity without a text preview.'}</p><p className="mt-2 break-all font-mono text-[11px] opacity-70">{item.quoted_message_id || item.quoted_channel_message_id}</p></div></div>}
              <div className="border-t border-[var(--border)] p-5">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium"><MessageSquareText className="h-4 w-4" /> Message preview</div>
                <p className="whitespace-pre-wrap rounded-lg bg-[var(--muted)] p-4 text-sm leading-6">{item.body_preview || 'No message body was retained.'}</p>
              </div>
              <div className="border-t border-[var(--border)] p-5">
                <h3 className="mb-3 text-sm font-medium">Attachments</h3>
                <div className="space-y-2">
                  {item.attachments.map((attachment, index) => {
                    const preview = attachmentPreviews[index];
                    const contentType = preview?.content_type || attachment.content_type || '';
                    const isImage = contentType.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(attachment.filename);
                    const isPdf = contentType === 'application/pdf' || /\.pdf$/i.test(attachment.filename);
                    return (
                    <div key={`${attachment.external_id}-${attachment.filename}`} className="overflow-hidden rounded-lg border border-[var(--border)]">
                      <div className="flex items-center gap-3 p-3">
                        <FileIcon className="h-5 w-5 text-cyan-600" />
                        <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{attachment.filename}</p>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {attachment.content_type || 'Unknown type'}
                          {attachment.size_bytes ? ` · ${(attachment.size_bytes / 1024).toFixed(1)} KB` : ''}
                        </p>
                        {attachment.download_status === 'FAILED' && (
                          <p className="mt-1 text-xs font-semibold text-red-700 dark:text-red-300">File download failed - upload required</p>
                        )}
                        </div>
                        {preview && <a href={preview.preview_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs font-semibold hover:bg-[var(--muted)]">Open <ExternalLink className="h-3.5 w-3.5" /></a>}
                      </div>
                      {preview && isImage && <a href={preview.preview_url} target="_blank" rel="noreferrer" className="block border-t border-[var(--border)] bg-slate-100 p-3 dark:bg-slate-950"><Image src={preview.preview_url} alt={`Preview of ${attachment.filename}`} width={1200} height={900} unoptimized className="mx-auto max-h-[620px] w-full rounded-md object-contain" /></a>}
                      {preview && isPdf && <iframe src={preview.preview_url} title={`Preview of ${attachment.filename}`} className="h-[620px] w-full border-t border-[var(--border)] bg-white" />}
                    </div>
                  );})}
                  {item.attachments.length === 0 && <p className="text-sm text-[var(--muted-foreground)]">No supported attachment was found.</p>}
                </div>
              </div>
            </section>

            <aside className="space-y-4">
              <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
                <p className="text-xs text-[var(--muted-foreground)]">Current status</p>
                <div className="mt-2"><AutomationStatusBadge status={item.status} showMeaning /></div>
                {item.decision_reason && <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">{item.decision_reason}</p>}
                {item.error_message && <p className="mt-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">{item.error_message}</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  {!['IGNORED', 'FILTERED'].includes(item.status) ? (
                    <button disabled={updating} onClick={() => void decide('IGNORE')} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--muted)] disabled:opacity-50">{failedAttachment ? 'Hide until payment update' : 'Ignore'}</button>
                  ) : (
                    <button disabled={updating} onClick={() => void decide('RESTORE')} className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50"><RefreshCw className="h-4 w-4" /> Restore for review</button>
                  )}
                </div>
              </section>
              {failedAttachment && (
                <section className="rounded-xl border border-red-300 bg-red-50 p-5 text-red-950 dark:border-red-800 dark:bg-red-950/30 dark:text-red-100">
                  <h3 className="font-semibold">Upload the missing {String(item.source_type || 'channel').replaceAll('_', ' ')} file</h3>
                  <p className="mt-1 text-sm">
                    Smartdok received the message details, but the channel connector could not supply the original file. Expected file: <strong>{failedAttachment.filename}</strong>
                  </p>
                  <p className="mt-2 text-xs">You may hide this item while the payment is not received. A later quoted payment confirmation will restore it automatically if the file is still missing.</p>
                  <label className="mt-4 flex cursor-pointer items-center gap-2 rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-800 dark:bg-red-950/40 dark:text-red-100">
                    <Upload className="h-4 w-4" /> Choose original file
                    <input type="file" className="sr-only" onChange={(event) => setMissingFile(event.target.files?.[0] || null)} />
                  </label>
                  {missingFile && <p className="mt-2 break-words text-xs">Selected: {missingFile.name}</p>}
                  <button
                    type="button"
                    disabled={!missingFile || uploadingMissingFile}
                    onClick={() => void uploadMissingFile()}
                    className="mt-3 inline-flex items-center gap-2 rounded-md bg-red-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {uploadingMissingFile ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    Upload and continue processing
                  </button>
                </section>
              )}
              {item.can_create_payment_review && !item.automation_run_id && (
                <section className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                  <h3 className="font-semibold">AI payment analysis available</h3>
                  <p className="mt-1 text-sm">Reanalyse the original message, quote and retained image/PDF with AI. A Receivable review is created only after the structured result is validated.</p>
                  <label className="mt-4 flex cursor-pointer items-center gap-2 rounded-md border border-amber-400 bg-white px-3 py-2 text-sm font-semibold text-amber-900">
                    <Upload className="h-4 w-4" /> Add clearer slip files (optional)
                    <input type="file" accept="image/*,application/pdf" multiple className="sr-only" onChange={(event) => setEvidenceFiles(Array.from(event.target.files || []))} />
                  </label>
                  {evidenceFiles.length > 0 && <p className="mt-2 break-words text-xs">{evidenceFiles.map((file) => file.name).join(', ')}</p>}
                  <button type="button" disabled={creatingReview} onClick={() => void createPaymentReview()} className="mt-3 inline-flex items-center gap-2 rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    {creatingReview ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Reanalyse with AI &amp; create review
                  </button>
                </section>
              )}
              {item.automation_run_id && (
                <section className="rounded-xl border border-cyan-300 bg-cyan-50 p-5 text-cyan-950 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-100">
                  <h3 className="font-semibold">Payment actions</h3>
                  <p className="mt-1 text-sm">This message is linked to payment review #{item.automation_run_id}{item.run_status ? ` (${item.run_status.replaceAll('_', ' ').toLowerCase()})` : ''}.</p>
                  <Link href={item.review_url || `/review/${item.automation_run_id}`} className="mt-3 inline-flex items-center gap-2 rounded-md bg-cyan-700 px-3 py-2 text-sm font-semibold text-white">
                    Open payment review <ExternalLink className="h-4 w-4" />
                  </Link>
                  <div className="mt-4 border-t border-cyan-300 pt-4">
                    <p className="text-sm font-semibold">Add clearer slip photos or PDFs</p>
                    <p className="mt-1 text-xs opacity-75">Files are added to the same payment; the original WeChat audit record is retained.</p>
                    <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-md border border-cyan-400 bg-white px-3 py-2 text-sm font-semibold text-cyan-800">
                      <Upload className="h-4 w-4" /> Choose files
                      <input type="file" accept="image/*,application/pdf" multiple className="sr-only" onChange={(event) => setEvidenceFiles(Array.from(event.target.files || []))} />
                    </label>
                    {evidenceFiles.length > 0 && <p className="mt-2 break-words text-xs">{evidenceFiles.map((file) => file.name).join(', ')}</p>}
                    <button type="button" disabled={uploadingEvidence || evidenceFiles.length === 0} onClick={() => void uploadPaymentEvidence()} className="mt-3 inline-flex items-center gap-2 rounded-md bg-cyan-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                      {uploadingEvidence ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      Upload & open review
                    </button>
                  </div>
                </section>
              )}
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
