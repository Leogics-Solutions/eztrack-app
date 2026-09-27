'use client';

import { AppLayout } from '@/components/layout';
import {
  approveRun,
  attachOrderSource,
  renameReturnedFile,
  assignOrderBatchFiles,
  generateRun,
  getRun,
  getCaseEmailConversation,
  getRunFile,
  getRunSource,
  previewOrderBatchEmail,
  rejectRun,
  reviewRun,
  replyToCaseEmail,
  sendOrderBatchEmail,
  sendRunToWhatsApp,
  skipSupplierVerification,
  verifySupplierDocuments,
  type AgentRun,
  type CaseEmailConversation,
  type AgentRunData,
  type OrderBatchJob,
} from '@/services/AgentsService';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  RefreshCw,
  Send,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { listWhatsAppGroups, type WhatsAppGroup } from '@/services/WhatsAppService';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type StepKey = 'received' | 'sent' | 'returned' | 'check' | 'post';

interface ExternalDocument {
  filename: string;
  file_key: string;
  kind?: string;
  content_type?: string;
}

interface VerificationCheck {
  code: string;
  label: string;
  status: 'PASSED' | 'FAILED' | string;
  expected?: unknown;
  actual?: unknown;
  line?: number | null;
}

interface VerificationDocument {
  filename?: string;
  kind?: string;
  document_number?: string;
  document_date?: string;
  grand_total?: number | null;
  status?: string;
  checks?: VerificationCheck[];
}

const STEPS: Array<{ key: StepKey; label: string }> = [
  { key: 'received', label: 'Received' },
  { key: 'sent', label: 'Request sent' },
  { key: 'returned', label: 'Partner returned' },
  { key: 'check', label: 'Check what came back' },
  { key: 'post', label: 'Post to group' },
];

const VERIFY_FIELDS = [
  { code: 'DOCUMENT_DATE', label: 'Date' },
  { code: 'DESCRIPTION', label: 'Description' },
  { code: 'QUANTITY', label: 'Quantity' },
  { code: 'UNIT_PRICE', label: 'Unit price' },
  { code: 'GRAND_TOTAL', label: 'Amount' },
];

function money(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatMalaysiaDateTime(value?: string | null, withSeconds = false) {
  if (!value) return null;
  return new Intl.DateTimeFormat('en-MY', {
    timeZone: 'Asia/Kuala_Lumpur',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: withSeconds ? '2-digit' : undefined,
    hour12: false,
  }).format(new Date(value));
}

function formatMalaysiaShort(value?: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat('en-MY', {
    timeZone: 'Asia/Kuala_Lumpur',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function daysOpen(value?: string | null) {
  if (!value) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
}

function humanKind(kind?: string | null) {
  const value = String(kind || '').toUpperCase();
  if (value.includes('DELIVERY') || value === 'DO') return 'Delivery order';
  if (value.includes('INVOICE') || value === 'INV') return 'Invoice';
  return kind ? kind.replaceAll('_', ' ').toLowerCase() : 'Returned file';
}

function captureEventId(run: AgentRun): number | null {
  const refs = (run.output_refs || {}) as Record<string, unknown>;
  const candidates = [
    refs.instruction_context_capture_event_id,
    (refs.notify as { source_target?: { capture_event_id?: number } } | undefined)?.source_target?.capture_event_id,
    ...run.events.map((event) => event.data?.capture_event_id),
  ];
  for (const value of candidates) {
    const id = Number(value);
    if (Number.isInteger(id) && id > 0) return id;
  }
  return null;
}

function fulfilmentIsOutsourced(run: AgentRun) {
  const data = run.corrected_data || run.extracted_data;
  return String(data?.fulfilment_route || data?.issuing_entity?.route || data?.issuing_entity?.fulfilment_mode || '').toUpperCase() === 'OUTSOURCED';
}

function stepState(status: string, hasReturned: boolean, posted: boolean): { done: Set<StepKey>; current: StepKey } {
  const done = new Set<StepKey>(['received']);
  if (posted) {
    return { done: new Set(STEPS.map((step) => step.key)), current: 'post' };
  }
  if (['COMPLETED', 'DELIVERY_PENDING'].includes(status) && hasReturned) {
    done.add('sent'); done.add('returned'); done.add('check');
    return { done, current: 'post' };
  }
  if (['EXTERNAL_DOCUMENTS_RECEIVED', 'AI_VERIFYING', 'VERIFICATION_FAILED', 'VERIFICATION_PASSED'].includes(status) || hasReturned) {
    done.add('sent'); done.add('returned');
    return { done, current: 'check' };
  }
  if (['WAITING_EXTERNAL_DOCUMENTS'].includes(status)) {
    done.add('sent');
    return { done, current: 'sent' };
  }
  return { done, current: 'sent' };
}

function statusBadge(status: string) {
  if (['COMPLETED'].includes(status)) return { label: 'Completed', className: 'bg-[#E4F3EA] text-[#0B5C34]' };
  if (['WAITING_EXTERNAL_DOCUMENTS', 'AI_VERIFYING'].includes(status)) {
    return { label: status === 'AI_VERIFYING' ? 'Checking' : 'Waiting on partner', className: 'bg-[#EDF1F2] text-[#3C4C53]' };
  }
  if (['FAILED', 'OUTPUT_FAILED', 'REJECTED'].includes(status)) return { label: 'Needs attention', className: 'bg-[#FBE9E7] text-[#8F1F18]' };
  return { label: 'Needs review', className: 'bg-[#FBF0D9] text-[#6B4600]' };
}

function displayValue(value: unknown) {
  if (value == null || value === '') return '—';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : money(value);
  return String(value);
}

function defaultOutgoingBody(run: AgentRun, data?: AgentRunData) {
  if (data?.outsource_message_draft?.body) return data.outsource_message_draft.body;
  const caption = String(run.source_caption || '').trim();
  if (String(data?.issuing_entity?.outbound_channel || '').toUpperCase() === 'WHATSAPP') {
    const lines = (!run.source_file_s3_key || Number(run.output_refs?.source_transaction_count || 1) > 1)
      ? (data?.lines || []).map((line, index) => `${index + 1}. ${line.name || ''} ? Qty ${line.qty ?? ''} ? Amount ${line.amount_myr ?? ''}`).join('\n') : '';
    return `Hi, please help arrange open invoice\n\n${caption || data?.customer || ''}${lines ? `\n\n${lines}` : ''}\n\nthanks`;
  }
  const customer = data?.customer || '';
  const date = data?.inv_date || '';
  const setCount = run.bundle?.total || 1;
  return [
    caption.split('\n')[0] || `${data?.issuing_entity?.legal_name || 'Partner'} / ${customer}`.trim(),
    '',
    'Please issue DO and invoice for:',
    '',
    caption || customer,
    '',
    date ? `Invoice date: ${date}` : null,
    setCount > 1 ? `Quantity: ${setCount} sets` : null,
    '',
    'PO is attached. Please reply with the DO and invoice as PDF.',
  ].filter((line) => line != null).join('\n').trim();
}

export function OutsourcedReviewCase() {
  const router = useRouter();
  const runId = Number(router.query.runId);
  const [run, setRun] = useState<AgentRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceMime, setSourceMime] = useState('');
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [filename, setFilename] = useState('');
  const [emailTo, setEmailTo] = useState('');
  const [groupJid, setGroupJid] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [preview, setPreview] = useState<OrderBatchJob | null>(null);
  const [viewer, setViewer] = useState<{ title: string; url: string } | null>(null);
  const [selectedReplyFiles, setSelectedReplyFiles] = useState<string[]>([]);
  const [conversation, setConversation] = useState<CaseEmailConversation | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [replyTarget, setReplyTarget] = useState<number | null>(null);
  const replyRequestId = useRef<string | null>(null);
  const messageEdited = useRef(false);
  const dateEdited = useRef(false);

  const load = useCallback(async () => {
    if (!runId) return;
    const loaded = await getRun(runId);
    if (!fulfilmentIsOutsourced(loaded)) {
      await router.replace(`/review/${loaded.id}`);
      return loaded;
    }
    setRun(loaded);
    return loaded;
  }, [runId, router]);

  useEffect(() => {
    if (!runId) return;
    let active = true;
    setLoading(true);
    load()
      .then((loaded) => { if (active && loaded) setError(null); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load this review'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load, runId]);

  const status = run?.status || '';
  useEffect(() => {
    if (!runId || !['EXTRACTING', 'AI_VERIFYING', 'WAITING_EXTERNAL_DOCUMENTS'].includes(status)) return undefined;
    const timer = window.setInterval(() => { void load().catch(() => undefined); }, 8000);
    return () => window.clearInterval(timer);
  }, [load, runId, status]);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    if (!runId || !run?.source_file_s3_key) {
      setSourceUrl(null);
      return undefined;
    }
    getRunSource(runId)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setSourceMime(blob.type);
        setSourceUrl(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [runId, run?.source_file_s3_key]);

  const data = run?.corrected_data || run?.extracted_data;
  const refs = (run?.output_refs || {}) as Record<string, unknown>;
  const outsourcedEmail = refs.outsourced_email as { subject?: string; to?: string[]; cc?: string[]; sent_at?: string | null; test_mode?: boolean } | undefined;
  const outsourcedWhatsApp = refs.outsourced_whatsapp as { group_name?: string; test_mode?: boolean; status?: string } | undefined;
  const previewRefs = refs.outsource_request_preview as { to?: string[]; attachment_filename?: string; attachment_file_key?: string; group_name?: string; test_mode?: boolean } | undefined;
  const externalDocuments = (refs.external_documents as ExternalDocument[] | undefined) || [];
  const supplierVerification = refs.supplier_document_verification as {
    status?: string;
    summary?: { passed?: number; failed?: number; checks?: number };
    documents?: VerificationDocument[];
    started_at?: string;
    completed_at?: string;
  } | undefined;
  const notify = refs.notify as { status?: string; group_name?: string; group_jid?: string; source_group_name?: string; source_channel_ref?: string } | undefined;
  const batchReply = refs.outsource_batch_reply as { anchor_run_id: number; files: { file_key: string; filename?: string }[] } | undefined;
  const outboundChannel = String(data?.issuing_entity?.outbound_channel || '').toUpperCase();
  const emailChannel = outboundChannel === 'EMAIL';
  const whatsappChannel = outboundChannel === 'WHATSAPP';
  const hasReturned = externalDocuments.length > 0;
  const posted = notify?.status === 'sent' || status === 'COMPLETED';
  const steps = stepState(status, hasReturned, posted);
  const badge = statusBadge(status);
  const captureId = run ? captureEventId(run) : null;
  const bundle = run?.bundle;
  const members = bundle?.members || [];
  const memberIndex = Math.max(0, members.findIndex((member) => member.id === runId));
  const verificationOverride = Boolean(refs.supplier_verification_override);
  const customerWhatsAppJid = String(notify?.group_jid || notify?.source_channel_ref || refs.source_channel_ref || '');
  const canPost = (
    status === 'VERIFICATION_PASSED'
    || (status === 'VERIFICATION_FAILED' && verificationOverride)
    || status === 'DELIVERY_PENDING'
    || (status === 'COMPLETED' && notify?.status === 'failed')
  ) && Boolean(customerWhatsAppJid);
  const invoiceDoc = (supplierVerification?.documents || []).find((document) => String(document.kind || '').toUpperCase().includes('INVOICE'))
    || supplierVerification?.documents?.[0];
  const partnerName = data?.issuing_entity?.display_name || data?.issuing_entity?.legal_name || 'partner';
  const customerGroup = notify?.group_name || notify?.source_group_name || 'source group';
  const sourceName = run?.source_filename || 'received document';
  const sourceExt = sourceName.split('.').pop()?.toLowerCase() || '';
  const sourceIsSpreadsheet = ['xls', 'xlsx', 'xlsm', 'csv'].includes(sourceExt) || sourceMime.includes('spreadsheet') || sourceMime.includes('excel');
  const sourceIsPdf = sourceExt === 'pdf' || sourceMime === 'application/pdf';
  const alreadySent = Boolean(outsourcedEmail?.sent_at || outsourcedWhatsApp || ['WAITING_EXTERNAL_DOCUMENTS', 'EXTERNAL_DOCUMENTS_RECEIVED', 'AI_VERIFYING', 'VERIFICATION_FAILED', 'VERIFICATION_PASSED', 'COMPLETED', 'DELIVERY_PENDING'].includes(status));
  const sentEvents = (run?.events || []).filter((event) => /sent|email|whatsapp|approved/i.test(`${event.event_type} ${event.message}`)).slice(-4).reverse();
  const refreshConversation = useCallback(async () => {
    if (runId) setConversation(await getCaseEmailConversation(runId));
  }, [runId]);
  useEffect(() => {
    if (!runId || !emailChannel) return undefined;
    void refreshConversation().catch(() => undefined);
    const timer = window.setInterval(() => { void refreshConversation().catch(() => undefined); }, 30000);
    return () => window.clearInterval(timer);
  }, [runId, emailChannel, refreshConversation]);
  const incomingMessages = (conversation?.messages || []).filter((item) => item.direction === 'INBOUND');
  const selectedIncoming = incomingMessages.find((item) => item.id === replyTarget) || incomingMessages[incomingMessages.length - 1];
  useEffect(() => {
    const id = Number(data?.issuing_entity?.whatsapp_connection_id);
    if (id && whatsappChannel) void listWhatsAppGroups(id).then(setGroups).catch(() => setGroups([]));
  }, [data?.issuing_entity?.whatsapp_connection_id, whatsappChannel]);
  const savedReplyFiles = JSON.stringify(refs.outsource_batch_selected_files || []);

  useEffect(() => {
    messageEdited.current = false;
    dateEdited.current = false;
  }, [runId]);

  useEffect(() => {
    if (!dateEdited.current) setInvoiceDate(String(data?.inv_date || ''));
  }, [data?.inv_date, runId]);

  useEffect(() => {
    if (!run || messageEdited.current) return;
    setSubject(outsourcedEmail?.subject || preview?.preview?.subject || `${run.source_caption?.split('\n')[0] || `INV&DO — ${partnerName}`}`);
    setBody(data?.outsource_message_draft?.body || preview?.preview?.body || defaultOutgoingBody(run, data || undefined));
    setFilename(data?.outsource_message_draft?.filename || run.source_filename || '');
    setEmailTo((data?.outsource_message_draft?.destination?.email_to || data?.issuing_entity?.email_to as string[] || []).join(', '));
    setGroupJid(data?.outsource_message_draft?.destination?.group_jid || String(data?.issuing_entity?.whatsapp_group_jid || ''));
  }, [run, data, outsourcedEmail?.subject, partnerName, preview]);

  useEffect(() => {
    setSelectedReplyFiles(JSON.parse(savedReplyFiles) as string[]);
  }, [run?.id, savedReplyFiles]);

  const verificationRows = useMemo(() => {
    const checks = invoiceDoc?.checks || [];
    return VERIFY_FIELDS.map((field) => {
      const matched = checks.filter((check) => check.code === field.code);
      if (!matched.length) return null;
      const failed = matched.filter((check) => check.status === 'FAILED');
      const sample = failed[0] || matched[0];
      return {
        ...field,
        expected: displayValue(sample.expected),
        actual: displayValue(sample.actual),
        match: failed.length === 0,
        note: failed.length > 1 ? `${failed.length} line differences` : null,
      };
    }).filter(Boolean) as Array<{ code: string; label: string; expected: string; actual: string; match: boolean; note: string | null }>;
  }, [invoiceDoc]);

  const failedCount = verificationRows.filter((row) => !row.match).length;
  const toLabel = emailChannel ? (outsourcedEmail?.to || preview?.preview?.route.to || previewRefs?.to || []).join(', ') : '';
  const whatsappTarget = outsourcedWhatsApp?.group_name || previewRefs?.group_name || partnerName;
  const attachmentName = preview?.preview?.files[0]?.filename || previewRefs?.attachment_filename || sourceName;
  const opened = formatMalaysiaDateTime(run?.received_at);
  const days = daysOpen(run?.received_at);

  async function act(task: () => Promise<unknown>, message: string) {
    setBusy(true);
    setBusyMessage(message);
    setError(null);
    try {
      await task();
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The action could not be completed.');
    } finally {
      setBusy(false);
      setBusyMessage(null);
    }
  }

  async function openFile(file: { file_key: string; filename?: string }, fromRunId = runId) {
    setBusy(true);
    setBusyMessage(`Opening ${file.filename || 'file'}…`);
    try {
      const blob = await getRunFile(fromRunId, file.file_key);
      const url = URL.createObjectURL(blob);
      setViewer({ title: file.filename || 'Returned file', url });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not open the file');
    } finally {
      setBusy(false);
      setBusyMessage(null);
    }
  }

  async function sendEmailReply() {
    if (!selectedIncoming || !replyBody.trim() || busy) return;
    replyRequestId.current ||= crypto.randomUUID();
    setBusy(true);
    setBusyMessage('Sending email reply…');
    setError(null);
    try {
      const result = await replyToCaseEmail(runId, selectedIncoming.id, replyBody.trim(), replyRequestId.current, replyFiles);
      await refreshConversation();
      await load();
      if (result.status === 'OUTBOUND') {
        setReplyBody('');
        setReplyFiles([]);
        replyRequestId.current = null;
      } else {
        setError('The previous send result is still unconfirmed. Check Sent mail before composing another reply.');
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not send the reply.');
    } finally {
      setBusy(false);
      setBusyMessage(null);
    }
  }

  async function copyInstruction() {
    const text = String(run?.source_caption || '').trim();
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  async function ensurePreview() {
    if (preview?.preview) return preview;
    const next = await previewOrderBatchEmail(runId);
    setPreview(next);
    if (next.preview) {
      setSubject(next.preview.subject);
      setBody(next.preview.body);
    }
    return next;
  }

  function draftData(): AgentRunData {
    return { ...(data || {}), inv_date: invoiceDate || undefined, order_date: invoiceDate || undefined, outsource_message_draft: { body, subject, filename, destination: whatsappChannel ? { group_jid: groupJid, group_name: groups.find((group) => group.jid === groupJid)?.name || String(data?.issuing_entity?.whatsapp_group_name || groupJid) } : { email_to: emailTo.split(/[,;]/).map((value) => value.trim()).filter(Boolean) } } };
  }

  async function sendRequest() {
    await act(async () => {
      if (run && ['PENDING_REVIEW', 'DRAFT_GENERATED'].includes(run.status)) {
        await reviewRun(runId, draftData());
      }
      if (run?.status === 'PENDING_REVIEW') {
        await generateRun(runId);
      }
      if (emailChannel && !whatsappChannel) {
        await reviewRun(runId, draftData());
        const next = await previewOrderBatchEmail(runId);
        if (!next.preview) throw new Error('Could not prepare the partner email.');
        await sendOrderBatchEmail(runId, next.id, subject.trim(), body.trim());
        setPreview(null);
        return;
      }
      await approveRun(runId, draftData());
    }, alreadySent ? 'Sending again…' : 'Sending the request to the partner…');
  }

  const backHref = router.query.returnTo === 'capture' ? '/capture' : '/capture/outsourced';
  const prevId = memberIndex > 0 ? members[memberIndex - 1]?.id : null;
  const nextId = memberIndex >= 0 && memberIndex < members.length - 1 ? members[memberIndex + 1]?.id : null;
  const setCount = bundle?.total || Number(refs.source_transaction_count || 1);
  const subtitle = [
    data?.issuing_entity?.legal_name,
    data?.customer ? `issuing for ${data.customer}` : null,
    data?.inv_date ? `invoice date ${data.inv_date}` : null,
    setCount > 1 ? `${setCount} sets` : null,
  ].filter(Boolean).join(' · ');

  return (
    <AppLayout pageName={run ? `Review #${run.id}` : 'Outsource review'} hideChrome>
      <div className="flex min-h-0 flex-1 flex-col bg-[#F5F7F7] text-[#101619]">
        <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[#E2E7E9] bg-white px-4 py-3 sm:px-6">
          <Link href={backHref} aria-label="Back to Outsource DO and Invoice" className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] border border-[#DCE3E5] text-[#3C4C53]">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-base font-semibold">Review #{runId || '—'}</span>
              <span className="inline-flex h-[21px] items-center rounded-md bg-[#F1EAF7] px-2 text-[11.5px] font-semibold text-[#563373]">Outsourced</span>
              <span className={`inline-flex h-[21px] items-center gap-1.5 rounded-md px-2 text-[11.5px] font-semibold ${badge.className}`}>
                <span className="h-[5px] w-[5px] rounded-full bg-current" />
                {badge.label}
              </span>
              {captureId && (
                <span className="inline-flex h-[21px] items-center rounded-md border border-[#DCE3E5] bg-white px-2 font-mono text-[11.5px] text-[#3C4C53]">Capture #{captureId}</span>
              )}
            </div>
            <p className="truncate text-[12.5px] text-[#5E6E75]">{subtitle || 'Outsourced DO & Invoice'}</p>
          </div>
          {setCount > 1 && (
            <div className="flex items-center gap-1">
              <button type="button" disabled={!prevId} aria-label="Previous review" onClick={() => prevId && router.push(`/review/outsourced/${prevId}`)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#DCE3E5] disabled:opacity-40">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-1 font-mono text-[12.5px] text-[#5E6E75]">{(bundle?.index || memberIndex + 1) || 1} / {setCount}</span>
              <button type="button" disabled={!nextId} aria-label="Next review" onClick={() => nextId && router.push(`/review/outsourced/${nextId}`)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#DCE3E5] disabled:opacity-40">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
          {captureId ? (
            <Link href={`/capture/messages/${captureId}`} className="inline-flex h-[34px] items-center gap-2 rounded-[9px] border border-[#DCE3E5] bg-white px-3 text-[13px] font-medium">
              <MessageCircle className="h-4 w-4 text-[#5E6E75]" /> Open WhatsApp thread
            </Link>
          ) : (
            <span className="hidden h-[34px] items-center gap-2 rounded-[9px] border border-[#DCE3E5] px-3 text-[13px] text-[#A9B4B9] sm:inline-flex">
              <MessageCircle className="h-4 w-4" /> Open WhatsApp thread
            </span>
          )}
          <div className="relative">
            <button type="button" aria-label="More actions" onClick={() => setMenuOpen((open) => !open)} className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-[#DCE3E5]">
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-[#E2E7E9] bg-white py-1 text-sm shadow-sm">
                <button type="button" className="block w-full px-3 py-2 text-left hover:bg-[#F5F7F7]" onClick={() => { setMenuOpen(false); void navigator.clipboard.writeText(window.location.href); }}>Copy link</button>
                <button type="button" className="block w-full px-3 py-2 text-left hover:bg-[#F5F7F7]" disabled={busy || !['FAILED', 'PENDING_REVIEW', 'DRAFT_GENERATED'].includes(status)} onClick={() => { setMenuOpen(false); void router.push(`/agents/runs/${runId}`); }}>Open technical run</button>
              </div>
            )}
          </div>
        </header>

        <div className="flex shrink-0 flex-wrap items-center gap-0 border-b border-[#E2E7E9] bg-white px-4 py-2 sm:px-6">
          {STEPS.map((step, index) => {
            const done = steps.done.has(step.key) && steps.current !== step.key;
            const current = steps.current === step.key;
            return (
              <div key={step.key} className="flex items-center">
                {index > 0 && <div className={`mx-1 h-px w-[22px] sm:w-[30px] ${current || done ? 'bg-[#C9931F]' : 'bg-[#DCE3E5]'}`} />}
                <div className={`flex items-center gap-2 px-2 py-1.5 sm:px-3 ${current ? 'h-[34px] rounded-[9px] border border-[#EBD7A6] bg-[#FBF0D9]' : ''}`}>
                  <span className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                    done ? 'bg-[#E4F3EA] text-[#0B5C34]' : current ? 'bg-[#C9931F] font-mono text-white' : 'border-[1.5px] border-[#DCE3E5] font-mono text-[#A9B4B9]'
                  }`}>
                    {done ? <Check className="h-3 w-3" strokeWidth={3} /> : index + 1}
                  </span>
                  <span className={`hidden text-[12.5px] sm:inline ${current ? 'font-semibold text-[#6B4600]' : done ? 'text-[#3C4C53]' : 'text-[#76858B]'}`}>{step.label}</span>
                </div>
              </div>
            );
          })}
          <div className="ml-auto pt-1 text-xs text-[#5E6E75]">
            {opened && <>Opened {opened} · <span className="font-mono">{days} day{days === 1 ? '' : 's'}</span> in this case</>}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="mx-auto flex max-w-[1180px] flex-col gap-4">
            {loading && (
              <p className="flex items-center gap-2 text-sm text-[#5E6E75]"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading this outsourced review…</p>
            )}
            {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
            {busy && busyMessage && (
              <div role="status" className="flex items-center gap-2 rounded-xl border border-[#BCD8E2] bg-[#F4F9FB] p-3 text-sm text-[#144F63]">
                <LoaderCircle className="h-4 w-4 animate-spin" /> {busyMessage}
              </div>
            )}

            {run && (
              <>
                <section className="overflow-hidden rounded-xl border border-[#E2E7E9] bg-white">
                  <div className="flex flex-wrap items-center gap-2 border-b border-[#EDF1F2] px-[18px] py-3.5">
                    <MessageCircle className="h-4 w-4 text-[#5E6E75]" />
                    <h2 className="flex-1 text-sm font-semibold">WhatsApp message / conversion instruction</h2>
                    <span className="text-xs text-[#5E6E75]">Kept exactly as it arrived — Smartdok reads from it, never rewrites it</span>
                    <button type="button" onClick={() => void copyInstruction()} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#DCE3E5] px-3 text-[12.5px] font-medium">
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="p-4">
                    <pre className="whitespace-pre-wrap break-words rounded-[9px] bg-[#EDF1F2] px-4 py-3.5 font-mono text-[12.5px] leading-[1.8] text-[#1F2A2E]">{run.source_caption?.trim() || 'No source instruction was stored with this review.'}</pre>
                  </div>
                </section>

                <section className="overflow-hidden rounded-xl border border-[#E2E7E9] bg-white">
                  <div className="flex items-center gap-3 border-b border-[#EDF1F2] px-[18px] py-3.5">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-sm font-semibold">Original PO received</h2>
                      <p className="text-xs text-[#5E6E75]">{sourceName} · {(run.source_channel || 'source').replaceAll('_', ' ').toLowerCase()}</p>
                    </div>
                    {sourceUrl && (
                      <a href={sourceUrl} download={sourceName} className="inline-flex h-8 items-center gap-2 rounded-lg border border-[#DCE3E5] px-3 text-[12.5px] font-semibold text-[#1C6C87]">
                        <Download className="h-3.5 w-3.5" /> Download original
                      </a>
                    )}
                  </div>
                  {!run.source_file_s3_key && <label className="m-4 inline-flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm">
                    <Paperclip className="h-4 w-4" /> Upload original PO
                    <input type="file" className="hidden" disabled={busy} accept=".pdf,.xls,.xlsx,.xlsm,.csv,.png,.jpg,.jpeg" onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void act(() => attachOrderSource(runId, file), 'Attaching original PO...');
                      event.target.value = '';
                    }} />
                  </label>}
                  {sourceUrl && sourceIsPdf ? (
                    <iframe title={`Preview of ${sourceName}`} src={sourceUrl} className="h-[420px] w-full bg-white" />
                  ) : (
                    <div className="flex items-center justify-center gap-3 px-5 py-8 text-[13.5px] text-[#5E6E75]">
                      <FileSpreadsheet className="h-7 w-7 text-[#0B5C34]" />
                      {run.source_file_s3_key
                        ? (sourceIsSpreadsheet ? 'Excel is retained in its original form. Download it to inspect the source cells.' : 'This file is retained in its original form. Download it to inspect the source.')
                        : 'No source attachment is stored. Use the original message above.'}
                    </div>
                  )}
                </section>

                <section className="rounded-xl border border-[#E2E7E9] bg-white px-4 py-3.5">
                  <label className="flex flex-wrap items-center gap-3 text-sm font-semibold">
                    Invoice date for this set
                    <input type="date" aria-label="Invoice date for this set" value={invoiceDate} onChange={(event) => { dateEdited.current = true; setInvoiceDate(event.target.value); }} disabled={posted || busy} className="rounded-lg border border-[#DCE3E5] px-3 py-2 font-normal" />
                  </label>
                  {!invoiceDate && <p className="mt-2 text-xs text-amber-800">Choose this set's date from the original file or instruction before sending.</p>}
                </section>

                <section className="overflow-hidden rounded-xl border border-[#E2E7E9] bg-white">
                  <div className="flex flex-wrap items-center gap-3 border-b border-[#EDF1F2] px-[18px] py-3.5">
                    {hasReturned ? <Check className="h-4 w-4 text-[#0B5C34]" strokeWidth={2.4} /> : <FileText className="h-4 w-4 text-[#5E6E75]" />}
                    <h2 className="flex-1 text-sm font-semibold">DO / Invoice returned by {partnerName}</h2>
                    <span className="text-xs text-[#5E6E75]">
                      {hasReturned ? `${externalDocuments.length} file${externalDocuments.length === 1 ? '' : 's'}` : 'Nothing back yet'}
                      {outsourcedEmail?.sent_at ? ` · ${formatMalaysiaShort(outsourcedEmail.sent_at)} · email` : ''}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2.5 p-4 sm:flex-row">
                    {hasReturned ? externalDocuments.map((document) => (
                      <div key={document.file_key} className="flex min-w-0 flex-1 items-center gap-3 rounded-[9px] border border-[#EDF1F2] bg-[#FAFBFB] px-3.5 py-3">
                        <FileText className="h-[18px] w-[18px] shrink-0 text-[#8F1F18]" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-mono text-[12.5px]">{document.filename}</p>
                          <p className="text-[11.5px] text-[#5E6E75]">{humanKind(document.kind)}</p>
                        </div>
                        {!posted && <button type="button" disabled={busy} onClick={() => {
                          const name = window.prompt('Filename (keep the file extension)', document.filename);
                          if (name?.trim()) void act(() => renameReturnedFile(runId, document.file_key, name.trim()), 'Saving filename...');
                        }} className="rounded border px-3 py-1 text-xs">Rename</button>}
                        <button type="button" disabled={busy} onClick={() => void openFile(document)} className="inline-flex h-[30px] items-center rounded-lg border border-[#DCE3E5] bg-white px-3 text-[12.5px] font-semibold">View</button>
                      </div>
                    )) : (
                      <p className="text-sm text-[#5E6E75]">The original PO above is received. No returned DO or invoice is linked to this set yet.</p>
                    )}
                  </div>
                  {batchReply?.files?.length ? (
                    <div className="border-t border-[#EDF1F2] px-4 py-3 text-sm">
                      <p className="font-medium">Shared partner reply — choose the files for this set</p>
                      <div className="mt-2 space-y-2">
                        {batchReply.files.map((file) => (
                          <label key={file.file_key} className="flex items-center gap-2">
                            <input type="checkbox" checked={selectedReplyFiles.includes(file.file_key)} onChange={(event) => setSelectedReplyFiles((current) => event.target.checked ? [...current, file.file_key] : current.filter((key) => key !== file.file_key))} />
                            <button type="button" className="underline" onClick={() => void openFile(file, batchReply.anchor_run_id)}>{file.filename || file.file_key}</button>
                          </label>
                        ))}
                      </div>
                      <button type="button" disabled={busy || selectedReplyFiles.length === 0} onClick={() => void act(() => assignOrderBatchFiles(runId, selectedReplyFiles), 'Saving files for this set…')} className="mt-3 rounded-lg border border-[#DCE3E5] px-3 py-1.5 text-xs font-semibold">Save files for this set</button>
                    </div>
                  ) : null}
                </section>

                <section className="overflow-hidden rounded-xl border border-[#E2E7E9] bg-white">
                  <div className="flex flex-wrap items-center gap-2 border-b border-[#EDF1F2] px-[18px] py-3.5">
                    <Mail className="h-4 w-4 text-[#5E6E75]" />
                    <h2 className="flex-1 text-sm font-semibold">Outgoing message</h2>
                    <span className="text-xs text-[#5E6E75]">Drafted by Smartdok from the instruction above — yours to edit</span>
                  </div>
                  <div className="flex flex-col gap-3.5 p-4">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-[12.5px] text-[#5E6E75]">Send on</span>
                      <span className={`inline-flex h-[34px] items-center gap-2 rounded-lg border px-3 text-[13px] font-semibold ${whatsappChannel ? 'border-[#BCD8E2] bg-[#E8F2F6] text-[#144F63]' : 'border-[#E2E7E9] text-[#A9B4B9]'}`}>
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </span>
                      <span className={`inline-flex h-[34px] items-center gap-2 rounded-lg border px-3 text-[13px] font-semibold ${emailChannel ? 'border-[#BCD8E2] bg-[#E8F2F6] text-[#144F63]' : 'border-[#E2E7E9] text-[#A9B4B9]'}`}>
                        <Mail className="h-3.5 w-3.5" /> Email
                      </span>
                      <span className="text-[12.5px] text-[#5E6E75]">To</span>
                      <span className="inline-flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-[#DCE3E5] px-3 py-1.5 text-[13px]">
                        <span className="font-semibold">{whatsappTarget}</span>
                        {toLabel && <span className="font-mono text-xs text-[#5E6E75]">{toLabel}</span>}
                      </span>
                    </div>
                    {whatsappChannel ? (
                      <label className="text-sm">Destination WhatsApp group
                        <select aria-label="Destination WhatsApp group" value={groupJid} onChange={(event) => { messageEdited.current = true; setGroupJid(event.target.value); }} className="mt-1 block w-full rounded border p-2">
                          {!groups.some((group) => group.jid === groupJid) && <option value={groupJid}>{String(data?.issuing_entity?.whatsapp_group_name || groupJid || 'Select group')}</option>}
                          {groups.map((group) => <option key={group.jid} value={group.jid}>{group.name} ({group.jid})</option>)}
                        </select>
                      </label>
                    ) : <label className="text-sm">Recipient email addresses<input aria-label="Recipient email addresses" value={emailTo} onChange={(event) => { messageEdited.current = true; setEmailTo(event.target.value); }} className="mt-1 block w-full rounded border p-2" /></label>}
                    {(previewRefs?.test_mode || outsourcedEmail?.test_mode || outsourcedWhatsApp?.test_mode) && (
                      <p className="text-xs font-semibold text-amber-800">Testing mode — the production partner was not contacted.</p>
                    )}
                    {emailChannel && <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-[#5E6E75]">
                      Email subject
                      <input value={subject} onChange={(event) => { messageEdited.current = true; setSubject(event.target.value); }} className="h-10 rounded-[9px] border border-[#DCE3E5] px-3 text-[13.5px] font-normal text-[#101619]" />
                    </label>}
                    <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-[#5E6E75]">
                      Message
                      <textarea value={body} onChange={(event) => { messageEdited.current = true; setBody(event.target.value); }} rows={12} className="rounded-[9px] border border-[#DCE3E5] px-3.5 py-3 font-mono text-[12.5px] leading-[1.8] text-[#101619]" />
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[12.5px] text-[#5E6E75]">Attached</span>
                      <span className="inline-flex items-center gap-2 rounded-lg border border-[#DCE3E5] px-3 py-1 font-mono text-xs text-[#3C4C53]">
                        <Paperclip className="h-3 w-3" /> <input aria-label="Attachment filename" value={filename || attachmentName} onChange={(event) => { messageEdited.current = true; setFilename(event.target.value); }} className="min-w-[240px] bg-transparent" />
                      </span>
                      {emailChannel && !preview?.preview && ['PENDING_REVIEW', 'DRAFT_GENERATED', 'WAITING_EXTERNAL_DOCUMENTS'].includes(status) && (
                        <button type="button" disabled={busy} onClick={() => void act(ensurePreview, 'Loading the partner email…')} className="text-[12.5px] font-semibold text-[#1C6C87]">Load editable email</button>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 rounded-[9px] bg-[#F5F7F7] px-4 py-3">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-[#5E6E75]" />
                      <p className="min-w-0 flex-1 text-[12.5px] text-[#3C4C53]"><strong>Nothing goes out until you press Send.</strong> {whatsappChannel && emailChannel ? 'Sending posts to the configured WhatsApp group and email at the same time.' : whatsappChannel ? 'Sending posts to the partner WhatsApp group.' : 'Sending emails the partner and tracks the thread.'}</p>
                      <button type="button" disabled={busy} onClick={() => void act(() => reviewRun(runId, draftData()), 'Saving draft…')} className="h-9 rounded-[9px] border border-[#DCE3E5] bg-white px-3.5 text-[13px] font-medium">Save draft</button>
                      <button type="button" disabled={busy || !['PENDING_REVIEW', 'DRAFT_GENERATED', 'WAITING_EXTERNAL_DOCUMENTS'].includes(status)} onClick={() => void sendRequest()} className="inline-flex h-9 items-center gap-2 rounded-[9px] bg-[#1C6C87] px-4 text-[13.5px] font-semibold text-white disabled:opacity-50">
                        <Send className="h-4 w-4" /> {alreadySent ? 'Send again' : 'Send'}
                      </button>
                    </div>
                    {sentEvents.length > 0 && (
                      <div className="border-t border-[#EDF1F2] pt-3">
                        <p className="text-[11px] font-semibold tracking-wide text-[#76858B]">ALREADY SENT</p>
                        <ul className="mt-2 space-y-2">
                          {sentEvents.map((event) => (
                            <li key={event.id} className="flex flex-wrap items-center gap-3 text-[12.5px]">
                              <span className="h-1.5 w-1.5 rounded-full bg-[#0F7A45]" />
                              <span className="shrink-0 font-mono text-[#5E6E75]">{formatMalaysiaShort(event.created_at) || '—'}</span>
                              <span className="flex-1 text-[#3C4C53]">{event.message || event.event_type}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </section>

                {emailChannel && (
                  <section className="overflow-hidden rounded-xl border border-[#BCD8E2] bg-white">
                    <div className="flex items-center gap-2 border-b border-[#DCE8ED] bg-[#F4F9FB] px-[18px] py-3.5">
                      <Mail className="h-4 w-4 text-[#144F63]" />
                      <h2 className="flex-1 text-sm font-semibold text-[#144F63]">Email conversation</h2>
                      <button type="button" onClick={() => void refreshConversation().catch((reason) => setError(String(reason)))} className="inline-flex items-center gap-1 text-xs font-semibold text-[#1C6C87]">
                        <RefreshCw className="h-3.5 w-3.5" /> Refresh
                      </button>
                    </div>
                    {!conversation?.thread ? (
                      <p className="px-4 py-5 text-sm text-[#5E6E75]">The email thread appears here after the request is sent.</p>
                    ) : (
                      <div className="space-y-4 p-4">
                        <p className="text-xs text-[#5E6E75]">From {conversation.thread.sender} · To {conversation.thread.to.join(', ')}{conversation.thread.cc.length ? ` · Cc ${conversation.thread.cc.join(', ')}` : ''}</p>
                        {conversation.messages.map((item) => (
                          <article key={item.id} className={`rounded-lg border p-4 ${item.direction === 'INBOUND' ? 'border-[#BCD8E2] bg-[#F8FCFD]' : 'border-[#E2E7E9] bg-white'}`}>
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="font-semibold text-[#144F63]">{item.direction === 'INBOUND' ? 'Received' : item.direction === 'OUTBOUND' ? 'Sent' : 'Send result unknown'}</span>
                              <span className="text-[#5E6E75]">{formatMalaysiaDateTime(item.sent_at) || 'Time unavailable'}</span>
                              <span className="min-w-0 break-all text-[#3C4C53]">{item.from} → {item.to.join(', ')}</span>
                            </div>
                            <p className="mt-2 text-sm font-semibold">{item.subject}</p>
                            <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed text-[#26363E]">{item.body}</pre>
                            {item.attachments.length > 0 && <div className="mt-3 flex flex-wrap gap-2">
                              {item.attachments.map((file, index) => (
                                <button key={`${item.id}-${index}`} type="button"
                                  disabled={!file.file_key && file.role !== 'source'}
                                  onClick={() => file.file_key ? void openFile({ file_key: file.file_key, filename: file.filename }, conversation.thread!.anchor_run_id) : void getRunSource(conversation.thread!.anchor_run_id).then((blob) => setViewer({ title: file.filename, url: URL.createObjectURL(blob) })).catch((reason) => setError(String(reason)))}
                                  className="inline-flex items-center gap-1 rounded border border-[#DCE3E5] bg-white px-2.5 py-1 text-xs text-[#144F63] disabled:text-[#5E6E75]">
                                  <Paperclip className="h-3 w-3" /> {file.filename}
                                </button>
                              ))}
                            </div>}
                            {item.direction === 'INBOUND' && <button type="button" onClick={() => { setReplyTarget(item.id); replyRequestId.current = null; }} className="mt-3 text-xs font-semibold text-[#1C6C87]">Reply to this email</button>}
                          </article>
                        ))}
                        {selectedIncoming && <div className="rounded-lg border border-[#BCD8E2] p-4">
                          <p className="text-sm font-semibold">Reply to {selectedIncoming.from}</p>
                          <p className="mt-1 text-xs text-[#5E6E75]">Your reply stays in this case and in the original email thread. Nothing is sent until you press Send reply.</p>
                          <textarea aria-label="Email reply" value={replyBody} onChange={(event) => { setReplyBody(event.target.value); replyRequestId.current = null; }} rows={5} maxLength={20000} placeholder="Write your reply…" className="mt-3 w-full rounded-lg border border-[#DCE3E5] p-3 text-sm" />
                          <div className="mt-2 flex flex-wrap items-center gap-3">
                            <label className="cursor-pointer rounded border border-[#DCE3E5] px-3 py-1.5 text-xs font-semibold">Attach files
                              <input type="file" multiple className="sr-only" onChange={(event) => { setReplyFiles(Array.from(event.target.files || [])); replyRequestId.current = null; }} />
                            </label>
                            <span className="flex-1 text-xs text-[#5E6E75]">{replyFiles.map((file) => file.name).join(', ') || 'No new attachments'} · up to 10 files / 25 MB</span>
                            <button type="button" disabled={busy || !replyBody.trim()} onClick={() => void sendEmailReply()} className="inline-flex items-center gap-2 rounded-lg bg-[#1C6C87] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Send className="h-4 w-4" /> Send reply</button>
                          </div>
                        </div>}
                      </div>
                    )}
                  </section>
                )}

                <section className="overflow-hidden rounded-xl border border-[#BCD8E2] bg-white">
                  <div className="flex flex-wrap items-center gap-3 border-b border-[#BCD8E2] bg-[#F4F9FB] px-[18px] py-3.5">
                    <RefreshCw className="h-4 w-4 text-[#144F63]" />
                    <h2 className="flex-1 text-sm font-semibold text-[#144F63]">AI verification</h2>
                    <span className="text-xs text-[#2C5A6B]">
                      {supplierVerification ? `${supplierVerification.summary?.passed || 0} passed · ${supplierVerification.summary?.failed || 0} failed` : 'Not run yet'}
                    </span>
                    <button
                      type="button"
                      disabled={busy || externalDocuments.length === 0 || status === 'AI_VERIFYING'}
                      onClick={() => void act(() => verifySupplierDocuments(runId), 'AI is checking the partner documents against the PO…')}
                      className="inline-flex h-9 items-center gap-2 rounded-[9px] bg-[#1C6C87] px-4 text-[13.5px] font-semibold text-white disabled:opacity-50"
                    >
                      {status === 'AI_VERIFYING' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      {supplierVerification ? 'Run verification again' : 'Run verification'}
                    </button>
                  </div>
                  <div className="flex flex-col gap-3.5 p-4">
                    <p className="text-[12.5px] text-[#5E6E75]">What {partnerName} sent back, against the PO and the instruction. Five fields, nothing else.</p>
                    {status === 'AI_VERIFYING' && <p className="flex items-center gap-2 text-sm text-orange-800"><LoaderCircle className="h-4 w-4 animate-spin" /> Checking supplier, customer, document numbers, lines, prices and totals…</p>}
                    {verificationRows.length > 0 ? (
                      <div className="overflow-hidden rounded-[10px] border border-[#E2E7E9]">
                        <div className="grid grid-cols-[120px_minmax(0,1fr)_minmax(0,1fr)_140px] gap-3 border-b border-[#E2E7E9] bg-[#FAFBFB] px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-wide text-[#5E6E75]">
                          <div>Field</div>
                          <div>PO and instruction</div>
                          <div className="truncate">{invoiceDoc?.filename || 'Returned invoice'}</div>
                          <div>Result</div>
                        </div>
                        {verificationRows.map((row) => (
                          <div key={row.code} className={`grid grid-cols-[120px_minmax(0,1fr)_minmax(0,1fr)_140px] items-center gap-3 border-b border-[#F1F4F5] px-4 py-3 text-[13px] last:border-0 ${row.match ? '' : 'bg-[#FFFDF7]'}`}>
                            <div className={row.match ? 'text-[#5E6E75]' : 'font-semibold text-[#6B4600]'}>{row.label}</div>
                            <div className="truncate font-mono">{row.expected}</div>
                            <div className={`truncate font-mono ${row.match ? '' : 'font-semibold text-[#6B4600]'}`}>{row.actual}</div>
                            <div className={`flex items-center gap-1.5 text-[12.5px] font-semibold ${row.match ? 'text-[#0B5C34]' : 'text-[#6B4600]'}`}>
                              {row.match ? <Check className="h-4 w-4" strokeWidth={2.4} /> : <AlertTriangle className="h-4 w-4" />}
                              {row.match ? 'Match' : 'Differs'}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-[9px] bg-[#F5F7F7] px-4 py-3 text-sm text-[#5E6E75]">
                        {hasReturned ? 'Run verification to compare dates, description, quantity, unit price and amount.' : 'Returned files are needed before verification can run.'}
                      </p>
                    )}
                    {supplierVerification && (
                      <div className="flex flex-wrap items-center gap-3">
                        <span className={`flex flex-1 items-center gap-2 text-[13px] font-semibold ${failedCount ? 'text-[#6B4600]' : 'text-[#0B5C34]'}`}>
                          {failedCount ? <AlertTriangle className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                          {failedCount ? `${verificationRows.length - failedCount} of ${verificationRows.length || 5} fields match. ${failedCount} difference${failedCount === 1 ? '' : 's'} need your decision.` : 'All compared fields match.'}
                        </span>
                        {status === 'VERIFICATION_FAILED' && !verificationOverride && (
                          <button type="button" disabled={busy} onClick={() => void act(() => skipSupplierVerification(runId), 'Recording manual acceptance…')} className="h-9 rounded-[9px] border border-[#DCE3E5] bg-white px-3.5 text-[13px] font-semibold">Accept the difference</button>
                        )}
                      </div>
                    )}
                    {verificationOverride && <p className="text-sm text-amber-800">Verification discrepancies were accepted manually. The failed checks remain recorded.</p>}
                  </div>
                </section>
              </>
            )}
          </div>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center gap-3 border-t border-[#E2E7E9] bg-white px-4 py-3 sm:px-6">
          <div className="min-w-0 leading-snug">
            <p className="text-[12.5px] text-[#3C4C53]">Automation run <span className="font-mono font-semibold">#{runId}</span> · Customer PO to DO & Invoice</p>
            <p className="text-[11.5px] text-[#6B4600]">
              {failedCount > 0 && !verificationOverride
                ? `${failedCount} verification difference${failedCount === 1 ? '' : 's'} to settle before this can be posted`
                : canPost
                  ? `Ready to post to ${customerGroup}`
                  : alreadySent
                    ? hasReturned ? 'Check the returned files, then post to the group.' : 'Waiting for the partner to return the DO and invoice.'
                    : 'Send the request to the partner first.'}
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button type="button" disabled={busy || !['PENDING_REVIEW', 'DRAFT_GENERATED'].includes(status)} onClick={() => void act(() => rejectRun(runId, 'Rejected by reviewer'), 'Rejecting…')} className="h-10 rounded-[9px] border border-[#DCE3E5] bg-white px-4 text-[13.5px] font-medium text-[#8F1F18] disabled:opacity-40">Reject</button>
            <button type="button" disabled={busy} onClick={() => void act(() => reviewRun(runId, draftData()), 'Saving draft…')} className="h-10 rounded-[9px] border border-[#DCE3E5] bg-white px-4 text-[13.5px] font-medium disabled:opacity-40">Save draft</button>
            <button
              type="button"
              disabled={busy || !canPost}
              title={!canPost ? (customerWhatsAppJid ? 'Verification must pass or be accepted before posting to the group.' : 'The source WhatsApp group is unavailable; configure it before sending.') : undefined}
              onClick={() => void act(() => sendRunToWhatsApp(runId), 'Posting verified documents to the group…')}
              className={`inline-flex h-10 items-center gap-2 rounded-[9px] px-[18px] text-[13.5px] font-semibold text-white ${canPost ? 'bg-[#1C6C87]' : 'cursor-not-allowed bg-[#A9B4B9]'}`}
            >
              <MessageCircle className="h-4 w-4" /> Post to {customerGroup}
            </button>
          </div>
        </footer>
      </div>

      {viewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" onMouseDown={() => { URL.revokeObjectURL(viewer.url); setViewer(null); }}>
          <section className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-3 border-b px-4 py-3">
              <h2 className="flex-1 truncate font-mono text-sm">{viewer.title}</h2>
              <a href={viewer.url} download={viewer.title} className="text-sm font-semibold text-[#1C6C87]">Download</a>
              <button type="button" aria-label="Close preview" onClick={() => { URL.revokeObjectURL(viewer.url); setViewer(null); }} className="rounded-md p-1 hover:bg-[#F5F7F7]"><X className="h-4 w-4" /></button>
            </div>
            <iframe title={viewer.title} src={viewer.url} className="min-h-0 flex-1 bg-[#F5F7F7]" />
          </section>
        </div>
      )}
    </AppLayout>
  );
}
