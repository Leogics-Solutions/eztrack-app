import { useEffect, useState } from 'react';
import { getCaptureAttachmentPreview, type CaptureAttachmentPreview } from '../../services/CaptureService';

export type PaymentMessageAnalysis = {
  customer_name?: string | null; amount?: number | null; currency?: string | null;
  invoice_numbers?: string[]; bank_references?: string[]; payment_dates?: string[];
  component_amounts?: number[]; evidence_summary?: string; reason?: string;
  workflow_category?: string; confidence?: number;
  printed_payer_name?: string | null; printed_beneficiary_name?: string | null;
  printed_beneficiary_account?: string | null; direction_basis?: string; direction_evidence?: string;
  intent?: { intent_type?: string; funds_status?: string; confirms_receipt?: boolean };
};

// Capture retains attachments even before a Review has an extracted payment plan.
// Its preview endpoint checks organization ownership and issues a short-lived URL.
export function PaymentMessageAttachment({ eventId, index, filename }: { eventId: number; index: number; filename: string }) {
  const [attempt, setAttempt] = useState(0);
  const key = `${eventId}:${index}:${attempt}`;
  const [result, setResult] = useState<{ key: string; preview?: CaptureAttachmentPreview; error?: string }>();
  const current = result?.key === key ? result : undefined;
  useEffect(() => {
    let active = true;
    getCaptureAttachmentPreview(eventId, index).then(preview => {
      if (active) setResult({ key, preview });
    }).catch(error => {
      if (active) setResult({ key, error: error instanceof Error ? error.message : 'Could not load the original attachment.' });
    });
    return () => { active = false; };
  }, [eventId, index, key]);
  const preview = current?.preview;
  const image = preview?.content_type?.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(filename);
  const pdf = preview?.content_type === 'application/pdf' || /\.pdf$/i.test(filename);
  return <div className="overflow-hidden rounded-lg border border-[var(--border)]" data-testid="message-attachment">
    {current?.error ? <div role="alert" className="p-3 text-xs text-red-700"><p>{current.error}</p><button type="button" className="mt-2 underline" onClick={() => setAttempt(value => value + 1)}>Retry preview</button></div>
      : !preview ? <p className="p-3 text-xs" role="status">Loading original attachment…</p>
      : image ? <a href={preview.preview_url} target="_blank" rel="noreferrer" aria-label={`Open original ${filename}`}><img src={preview.preview_url} alt={filename} className="max-h-80 w-full bg-white object-contain" onError={() => setResult({ key, error: 'Image preview failed. Retry to refresh its link.' })} /></a>
      : pdf ? <iframe src={preview.preview_url} title={`Preview of ${filename}`} className="h-80 w-full bg-white" /> : null}
    <div className="break-all p-2 text-xs">{preview ? <a href={preview.preview_url} target="_blank" rel="noreferrer" className="underline">Open original · {filename}</a> : filename}</div>
  </div>;
}

export function PaymentMessageAnalysisDetails({ analysis }: { analysis?: PaymentMessageAnalysis | null }) {
  if (!analysis) return null;
  const money = (value: number) => `${analysis.currency || 'Currency unknown'} ${value.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fields: Array<[string, string | null | undefined]> = [
    ['Workflow classification', analysis.workflow_category],
    ['Customer / payer inferred by AI', analysis.customer_name],
    ['Amount', analysis.amount == null ? null : money(analysis.amount)],
    ['Component amounts', analysis.component_amounts?.map(money).join(' + ')],
    ['Payment dates', analysis.payment_dates?.join(', ')],
    ['Invoice numbers from message / context', analysis.invoice_numbers?.join(', ')],
    ['Bank references', analysis.bank_references?.join(', ')],
    ['Payer interpreted from image', analysis.printed_payer_name],
    ['Beneficiary interpreted from image', analysis.printed_beneficiary_name],
    ['Beneficiary account interpreted from image', analysis.printed_beneficiary_account],
    ['Direction basis', analysis.direction_basis],
    ['Direction evidence', analysis.direction_evidence],
  ];
  return <details className="mt-3 rounded-lg border border-[var(--border)] p-3 text-xs" open={analysis.workflow_category === 'PAYABLE'}>
    <summary className="cursor-pointer font-semibold">AI extracted details & reasoning</summary>
    <p className="mt-2 text-[var(--muted-foreground)]">AI interpretation of this message and its context; compare with the original. Confidence is not verification. This is separate from the saved SQL allocation.</p>
    {analysis.workflow_category === 'PAYABLE' && analysis.intent?.confirms_receipt && <p role="alert" className="mt-2 rounded bg-amber-50 p-2 text-amber-950">Conflicting interpretation: receipt confirmation was recognized, but AI classified the transaction as outgoing. Direction needs review.</p>}
    <dl className="mt-3 space-y-2">{fields.filter(([, value]) => value).map(([label, value]) => <div key={label}><dt className="text-[var(--muted-foreground)]">{label}</dt><dd className="break-words font-medium">{value}</dd></div>)}</dl>
    {analysis.evidence_summary && <div className="mt-3"><b>Evidence read by AI</b><p className="mt-1 whitespace-pre-wrap">{analysis.evidence_summary}</p></div>}
    {analysis.reason && <div className="mt-3"><b>Why AI made this decision</b><p className="mt-1 whitespace-pre-wrap">{analysis.reason}</p></div>}
  </details>;
}
