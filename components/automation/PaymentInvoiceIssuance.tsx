import type { AgentRun } from '@/services/AgentsService';

type Issuance = { status?: string; reason?: string; invoice_numbers?: string[] };
type Watch = { status?: string; next_check_at?: string; detail?: string; delivery_error?: string };

export function PaymentInvoiceIssuance({ run, busy, onApprove }: {
  run: AgentRun; busy: boolean; onApprove: (enabled: boolean) => void;
}) {
  const data = run.corrected_data || run.extracted_data || {};
  const issuance = data.invoice_issuance as Issuance | undefined;
  const watch = run.output_refs?.invoice_issuance_watch as Watch | undefined;
  const approval = run.output_refs?.invoice_wait_approval as { enabled?: boolean } | undefined;
  if (!issuance) return null;
  const waiting = issuance.status === 'AWAITING_INVOICE_ISSUE';
  return <section className="rounded-xl border border-cyan-300 bg-cyan-50 p-4 text-sm text-cyan-950">
    <h3 className="font-semibold">{waiting ? '等开票 · Awaiting invoice issue' : issuance.status === 'READY' ? 'Invoice issued · Ready to continue' : 'Invoice issue check'}</h3>
    <p className="mt-2">{issuance.reason}</p>
    <p className="mt-1">{issuance.invoice_numbers?.join(', ')}</p>
    {waiting && <p className="mt-2">The same Review will be checked against SQL every 5 minutes. Description reminders quote the payment in its original group, once a day during 09:00–18:00 Malaysia time. This wait is counted separately from knock-off completion.</p>}
    {watch?.next_check_at && <p className="mt-1">Next SQL check: {new Date(watch.next_check_at).toLocaleString()}</p>}
    {watch?.delivery_error && <p className="mt-2 text-amber-800">Description reminder pending: {watch.delivery_error}</p>}
    {watch?.detail && <p className="mt-2 text-amber-800">{watch.detail}</p>}
    {run.status === 'PENDING_REVIEW' && (waiting || approval?.enabled) && <div className="mt-3">
      <p>{approval?.enabled ? 'Automatic continuation approved. Any change in the saved payment, customer or amount requires PIC review.' : 'Save and verify the customer, payment method and payment details before approving automatic continuation. No OR is created while the invoice is missing.'}</p>
      <button type="button" disabled={busy} onClick={() => onApprove(!approval?.enabled)} className="mt-2 rounded-lg bg-cyan-800 px-3 py-2 font-semibold text-white disabled:opacity-50">
        {approval?.enabled ? 'Cancel automatic continuation' : 'Approve automatic knock-off after invoice matches'}
      </button>
    </div>}
  </section>;
}
