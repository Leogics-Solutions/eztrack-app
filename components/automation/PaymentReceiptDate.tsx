export type ReceiptDateFields = {
  payment_date?: string | null;
  slip_date?: string | null;
  receipt_date_policy?: number;
  posted_or_date?: string;
  payment_date_source?: string;
  payment_date_evidence?: { capture_event_id?: number; received_at?: string };
  receipt_date_error?: string | null;
  receipt_date_ack?: string;
  receipt_date_edit_requested?: boolean;
  receipt_date_override_reason?: string;
};

export default function PaymentReceiptDate({ slip, editable, index, onChange }: {
  slip: ReceiptDateFields; editable: boolean; index: number;
  onChange: (change: ReceiptDateFields) => void;
}) {
  const printed = slip.slip_date || '';
  const date = slip.payment_date || '';
  const different = Boolean(printed && date && printed !== date);
  const crossMonth = different && printed.slice(0, 7) !== date.slice(0, 7);
  const key = [printed, date, slip.payment_date_evidence?.capture_event_id || ''].join('|');
  const disabled = !editable || Boolean(slip.posted_or_date);
  return <div className="min-w-[230px] space-y-2">
    <p className="text-xs text-[var(--muted-foreground)]">Slip / cheque date: {printed || 'Not recorded'}</p>
    <label className="block text-xs font-semibold">Bank receipt / OR date
      <input aria-label={`Bank receipt / OR date ${index + 1}`} type="date" value={date} disabled={disabled}
        className="mt-1 block w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-sm"
        onChange={e => onChange({ payment_date: e.target.value, receipt_date_edit_requested: true, receipt_date_ack: '' })} />
    </label>
    <p className="text-xs text-[var(--muted-foreground)]">{slip.posted_or_date ? 'Existing SQL OR date. Amend in SQL, then sync.' :
      slip.payment_date_source === 'MANUAL_RECEIPT_DATE' || slip.receipt_date_edit_requested ? 'Manually reviewed receipt date' :
      slip.payment_date_source === 'FINANCE_EXPLICIT_RECEIPT_DATE' ? 'Date stated in Finance confirmation' :
      slip.receipt_date_policy ? 'Finance confirmation date (Malaysia time)' : 'Save / refresh SQL to resolve the receipt date.'}</p>
    {slip.receipt_date_edit_requested && <label className="block text-xs">Reason for date correction
      <input aria-label={`OR date correction reason ${index + 1}`} required disabled={disabled}
        value={slip.receipt_date_override_reason || ''} placeholder="e.g. Verified bank credit on 01/10"
        className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--background)] p-2"
        onChange={e => onChange({receipt_date_override_reason: e.target.value})} />
    </label>}
    {slip.receipt_date_error && !slip.receipt_date_edit_requested && <p role="alert" className="text-xs text-red-700">{slip.receipt_date_error}</p>}
    {different && <div className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950">
      {crossMonth ? 'Different accounting months. ' : ''}The OR uses the bank receipt date, not the slip / cheque date.
      {crossMonth && !slip.posted_or_date && <label className="mt-2 flex items-start gap-2">
        <input type="checkbox" disabled={!editable} checked={slip.receipt_date_ack === key}
          onChange={e => onChange({receipt_date_ack: e.target.checked ? key : ''})} />
        I checked the bank receipt date and the OR month.
      </label>}
    </div>}
  </div>;
}
