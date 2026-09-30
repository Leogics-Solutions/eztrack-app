import { useEffect, useRef, useState } from 'react';
import { getPaymentAutoStatus, setPaymentAutoPolicy, type PaymentAutoStatus, type PaymentAutoMode } from '@/services/AgentsService';

const categories: Record<string, string> = {
  DISABLED: 'Workflow off', EXISTING_RECORD: 'Existing record', STATE: 'Current status',
  PRIOR_SUBMISSION: 'Previous SQL submission', NEW_EVIDENCE: 'New evidence', INVOICE_WAIT: 'Waiting for invoice',
  VALIDATION: 'Payment check', COMPANY: 'Receiving company', CUSTOMER: 'Customer', BANK: 'Receiving bank',
  EVIDENCE: 'Slip / receipt confirmation', SPECIAL_ALLOCATION: 'Special allocation', DECISION: 'Payment decision',
  WAITING_INVOICE: 'Waiting for invoice', INVOICE: 'Invoice selection', ALLOCATION: 'Allocation',
  PARTIAL_PAYMENT: 'Partial payment', INVALID_DATA: 'Missing / invalid data', SQL_UNAVAILABLE: 'SQL connection',
  DUPLICATE: 'Possible duplicate', AUTHORIZATION: 'Authorization', BUSY_OR_CHANGED: 'Check in progress / data changed',
  SUBMISSION: 'Submission or delivery needs attention',
};

export function PaymentAutoKnockoff({ runId, jobId, onJob }: {
  runId: number; jobId: string; onJob: () => void;
}) {
  const [value, setValue] = useState<PaymentAutoStatus | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const callback = useRef(onJob);
  callback.current = onJob;
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const result = await getPaymentAutoStatus(runId);
        if (!active) return;
        setValue(result); setError('');
        if (result.job_id && result.job_id !== jobId) callback.current();
      } catch {
        if (active) setError('Automatic processing status is unavailable. Refresh before changing the policy.');
      }
    };
    void load();
    const timer = setInterval(() => void load(), 10000);
    return () => { active = false; clearInterval(timer); };
  }, [runId, jobId]);
  const change = async (mode: PaymentAutoMode) => {
    if (mode === 'ENABLED' && !window.confirm('Enable automatic knock-off for this entire payment workflow? Eligible records received after activation can create ORs and send confirmations without a click. Existing records remain manual.')) return;
    setSaving(true);
    try {
      await setPaymentAutoPolicy(runId, mode);
      setValue(await getPaymentAutoStatus(runId)); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save policy.'); }
    finally { setSaving(false); }
  };
  const failed = value?.last_result?.status === 'REVIEW_REQUIRED' && value.last_result.reasons.some(r => ['SUBMISSION', 'AUTHORIZATION', 'BUSY_OR_CHANGED'].includes(r.code));
  const reasons = failed ? value.last_result?.reasons : value?.assessment.reasons;
  return <section className="rounded-xl border border-cyan-300 bg-cyan-50 p-4 text-sm text-cyan-950">
    <h2 className="font-semibold">Automatic knock-off · {!value ? 'Checking status…' : value.policy.mode === 'ENABLED' ? 'Enabled' : value.policy.mode === 'PREVIEW' ? 'Preview only' : 'Off'}</h2>
    <p className="mt-1">Fully matched new payments can validate, create OR and send confirmation in the background. Exceptions stay in Review with the reasons below.</p>
    <p className="mt-1">This setting applies to the whole payment workflow. Existing records, partial payments, missing invoices and uncertain prior submissions remain manual. Disabling stops queued automatic work before SQL submission; it does not undo a submitted OR.</p>
    {value?.can_configure && <div className="my-3 flex flex-wrap gap-2">{(['OFF', 'PREVIEW', 'ENABLED'] as const).map(mode => <button key={mode} disabled={saving || !!error || value.policy.mode === mode} onClick={() => void change(mode)} className="rounded border border-cyan-600 bg-white px-3 py-2 disabled:opacity-50">{mode === 'OFF' ? 'Turn off' : mode === 'PREVIEW' ? 'Preview without posting' : 'Enable automatic knock-off'}</button>)}</div>}
    {error && <p role="alert" className="mt-2 text-red-800">{error}</p>}
    {!error && value && <div aria-live="polite" className="mt-2">
      {value.last_result?.status === 'COMPLETED' ? <p>Automatically completed. See the saved OR and confirmation result.</p>
        : value.last_result?.status === 'QUEUED' ? <p>Automatic processing started. Progress appears above.</p>
        : <><p className="font-medium">{value.assessment.eligible && !failed ? value.policy.mode === 'PREVIEW' ? 'Eligible in preview — no OR or message will be created.' : 'Eligible — awaiting the next background check.' : 'Manual review / waiting reasons'}</p>
          <ul className="mt-1 list-disc pl-5">{reasons?.map((r, i) => <li key={`${r.code}-${i}`}><b>{categories[r.code] || 'Review required'}</b>: {r.detail}</li>)}</ul></>}
    </div>}
  </section>;
}
