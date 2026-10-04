import { useEffect, useRef, useState } from 'react';
import { getPaymentAutoStatus, setPaymentAutoPolicy, type PaymentAutoStatus, type PaymentAutoMode, type PaymentAutomationRules } from '@/services/AgentsService';

const categories: Record<string, string> = {
  DISABLED: 'Workflow off', EXISTING_RECORD: 'Existing record', STATE: 'Current status',
  PRIOR_SUBMISSION: 'Previous SQL submission', NEW_EVIDENCE: 'New evidence', INVOICE_WAIT: 'Waiting for invoice',
  VALIDATION: 'Payment check', COMPANY: 'Receiving company', CUSTOMER: 'Customer', BANK: 'Receiving bank',
  EVIDENCE: 'Slip / receipt confirmation', SPECIAL_ALLOCATION: 'Special allocation', DECISION: 'Payment decision',
  WAITING_INVOICE: 'Waiting for invoice', INVOICE: 'Invoice selection', ALLOCATION: 'Allocation',
  PARTIAL_PAYMENT: 'Partial payment', INVALID_DATA: 'Missing / invalid data', SQL_UNAVAILABLE: 'SQL connection',
  DUPLICATE: 'Possible duplicate', AUTHORIZATION: 'Authorization', BUSY_OR_CHANGED: 'Check in progress / data changed',
  SUBMISSION: 'Submission or delivery needs attention',
  WAITING_SLIP: 'Waiting for slip', WAITING_RECEIPT: 'Waiting for Finance receipt confirmation', RECEIPT_DATE: 'Bank receipt date',
};

const defaults: PaymentAutomationRules = { version: 2, name_suffix_tolerance: true, partial_payments: true,
  foreign_invoices: true, unapplied_balance: true, receipt_before_invoice: true, finance_receipt_date: true,
  chase_missing_slip: true, reminder_interval_hours: 24, sql_refresh_seconds: 300, customer_rules: [] };
const states: Record<string, string> = { WAITING_SLIP: 'Waiting for slip / 等待 slip',
  WAITING_RECEIPT: 'Waiting for bank receipt / 等待到账确认', WAITING_INVOICE: 'Waiting for invoice / 等待发票',
  WAITING_SQL: 'Waiting for SQL recovery / 等待 SQL 恢复', READY: 'Ready for automatic processing / 可自动处理',
  HUMAN_REVIEW: 'Human decision required / 需要人工判断', SQL_QUEUED: 'Queued for SQL / SQL 排队中',
  OR_POSTED_PENDING_INVOICE: 'OR saved; waiting for invoice / OR 已开，等待发票', DELIVERY_PENDING: 'Confirmation delivery pending / 确认消息待发送', CLOSED: 'Closed / 已关闭' };

export function PaymentAutoKnockoff({ runId, jobId, onJob }: {
  runId: number; jobId: string; onJob: () => void;
}) {
  const [value, setValue] = useState<PaymentAutoStatus | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [rules, setRules] = useState<PaymentAutomationRules>(defaults);
  const [includeIds, setIncludeIds] = useState('');
  const [fifo, setFifo] = useState(false);
  const [bank, setBank] = useState('');
  const initialized = useRef<number | null>(null);
  const callback = useRef(onJob);
  callback.current = onJob;
  useEffect(() => {
    let active = true;
    if (initialized.current !== runId) setValue(null);
    const load = async () => {
      try {
        const result = await getPaymentAutoStatus(runId);
        if (!active) return;
        setValue(result); setError('');
        if (initialized.current !== runId) {
          initialized.current = runId;
          setExpanded(!!result.policy.rules); setRules(result.policy.rules || defaults);
          setIncludeIds((result.policy.include_run_ids || []).join(', '));
          const scope = result.customer_scope;
          const rule = result.policy.rules?.customer_rules.find(r => r.connection_id === scope?.connection_id && r.customer_code === scope?.customer_code);
          setFifo(!!rule?.oldest_open_first); setBank(rule?.default_payment_method || '');
        }
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
    const ids = includeIds.trim() ? includeIds.split(',').map(s => Number(s.trim())) : [];
    if (ids.some(id => !Number.isSafeInteger(id) || id <= 0)) { setError('Enter positive Review IDs separated by commas.'); return; }
    if (mode === 'ENABLED' && !window.confirm(`Enable automatic knock-off for this payment workflow? Matched payments can create ORs and send confirmations. ${expanded ? 'Configured partial payments and OR-before-invoice cases are included.' : 'The original full-match rules apply.'} Historical reviews are included only by the IDs entered below.`)) return;
    setSaving(true);
    try {
      const scope = value?.customer_scope;
      let configured = rules;
      if (expanded && scope?.connection_id && scope.customer_code) {
        configured = { ...rules, customer_rules: [
          ...rules.customer_rules.filter(r => r.connection_id !== scope.connection_id || r.customer_code !== scope.customer_code),
          { connection_id: scope.connection_id, customer_code: scope.customer_code, oldest_open_first: fifo, default_payment_method: bank || null },
        ] };
      }
      await setPaymentAutoPolicy(runId, mode, { ...(expanded ? { rules: configured } : { use_original_rules: true }), include_run_ids: ids });
      setValue(await getPaymentAutoStatus(runId)); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save policy.'); }
    finally { setSaving(false); }
  };
  const failed = value?.last_result?.status === 'REVIEW_REQUIRED' && value.last_result.reasons.some(r => ['SUBMISSION', 'AUTHORIZATION', 'BUSY_OR_CHANGED'].includes(r.code));
  const reasons = failed ? value.last_result?.reasons : value?.assessment.reasons;
  return <section className="rounded-xl border border-cyan-300 bg-cyan-50 p-4 text-sm text-cyan-950">
    <h2 className="font-semibold">Automatic knock-off · {!value ? 'Checking status…' : value.policy.mode === 'ENABLED' ? 'Enabled' : value.policy.mode === 'PREVIEW' ? 'Preview only' : 'Off'}</h2>
    <p className="mt-1">Matched payments validate, create OR and send confirmation through the SQL queue. Missing evidence waits for completion; conflicting evidence requires a human decision.</p>
    <p className="mt-1">Workflow rules apply only to this payment automation. Turning off stops queued automatic work before submission. A saved OR remains saved.</p>
    {value?.can_configure && <div className="my-3 space-y-3">
      <label className="flex items-center gap-2"><input type="checkbox" checked={expanded} disabled={saving} onChange={e => setExpanded(e.target.checked)} />Use expanded payment rules / 启用等待及自动继续规则</label>
      {expanded && <div className="space-y-2 rounded border border-cyan-200 bg-white p-3">
        {(['name_suffix_tolerance', 'partial_payments', 'foreign_invoices', 'unapplied_balance', 'receipt_before_invoice', 'finance_receipt_date', 'chase_missing_slip'] as const).map(key => <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={rules[key]} onChange={e => setRules({ ...rules, [key]: e.target.checked })} />{{ name_suffix_tolerance: 'Allow company suffix differences after invoice/customer checks', partial_payments: 'Allow partial invoice payments', foreign_invoices: 'Allow invoices with verified currency conversion', unapplied_balance: 'Allow remaining customer credit', receipt_before_invoice: 'Create OR first and chase invoice immediately', finance_receipt_date: 'Use authoritative Finance receipt date, including cross-month receipt', chase_missing_slip: 'Chase missing slip until supplied' }[key]}</label>)}
        <label className="flex items-center gap-2">Slip reminder interval (hours)<input aria-label="Slip reminder interval" type="number" min={1} max={168} value={rules.reminder_interval_hours} onChange={e => setRules({ ...rules, reminder_interval_hours: Number(e.target.value) })} className="w-20 rounded border p-1" /></label>
        {value.customer_scope?.customer_code && <div className="border-t pt-2">
          <p className="font-medium">Defaults for {value.customer_scope.company_name} · {value.customer_scope.customer_name} ({value.customer_scope.customer_code})</p>
          <label className="flex items-center gap-2"><input type="checkbox" checked={fifo} onChange={e => setFifo(e.target.checked)} />Use oldest open invoice(s) unless this payment gives a different explicit instruction</label>
          <label className="mt-2 flex items-center gap-2">Default receiving bank<select aria-label="Default receiving bank" value={bank} onChange={e => setBank(e.target.value)} className="rounded border p-1"><option value="">Require evidence match</option>{value.customer_scope.payment_methods.map(m => <option key={m.code} value={m.code}>{m.code} · {m.description}</option>)}</select></label>
          <p className="mt-1 text-xs">Default applies only to the sole live receiving account. Conflicting slip evidence requires review.</p>
        </div>}
      </div>}
      <label className="block">Include historical waiting Review IDs<input aria-label="Historical waiting Review IDs" value={includeIds} onChange={e => setIncludeIds(e.target.value)} placeholder="e.g. 1360, 1418" className="ml-2 rounded border bg-white p-2" /></label>
      <div className="flex flex-wrap gap-2">{(['OFF', 'PREVIEW', 'ENABLED'] as const).map(mode => <button key={mode} disabled={saving} onClick={() => void change(mode)} className="rounded border border-cyan-600 bg-white px-3 py-2 disabled:opacity-50">{mode === 'OFF' ? 'Turn off' : mode === 'PREVIEW' ? 'Save & preview without posting' : 'Save & enable automatic knock-off'}</button>)}</div>
    </div>}
    {error && <p role="alert" className="mt-2 text-red-800">{error}</p>}
    {!error && value && <div aria-live="polite" className="mt-2">
      {value.classification && <div className="mb-3 rounded border border-cyan-200 bg-white p-3">
        <p className="font-semibold">{states[value.classification.status] || value.classification.status}</p>
        <p>Reason / 原因: {value.classification.reason.join(' ') || 'All checks passed.'}</p>
        <p>Evidence / 证据: Review #{value.classification.evidence.review_id} · SQL customer {value.classification.evidence.customer_code || 'not resolved'}{value.classification.evidence.capture_ids.filter(Boolean).length ? ` · Messages ${value.classification.evidence.capture_ids.filter(Boolean).join(', ')}` : ''}</p>
        <p>Responsible / 负责人: {value.classification.responsible_role}</p><p>Next / 下一步: {value.classification.next_action}</p>
      </div>}
      {value.last_result?.status === 'COMPLETED' ? <p>Automatically completed. See the saved OR and confirmation result.</p>
        : value.last_result?.status === 'QUEUED' ? <p>Automatic processing started. Progress appears above.</p>
        : <><p className="font-medium">{value.assessment.eligible && !failed ? value.policy.mode === 'PREVIEW' ? 'Eligible in preview — no OR or message will be created.' : 'Eligible — awaiting the next background check.' : 'Manual review / waiting reasons'}</p>
          <ul className="mt-1 list-disc pl-5">{reasons?.map((r, i) => <li key={`${r.code}-${i}`}><b>{categories[r.code] || 'Review required'}</b>: {r.detail}</li>)}</ul></>}
    </div>}
  </section>;
}
