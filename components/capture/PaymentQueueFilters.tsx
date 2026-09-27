import Link from 'next/link';

export const PAYMENT_CATEGORIES = ['CONFIRM_RECEIVED', 'PENDING_SLIP', 'SLIP_UPDATED', 'NOT_RECEIVED', 'PENDING_RESPONSE', 'NOISE', 'OTHERS', 'PENDING_INVOICE_NUMBER', 'PAYABLE', 'PENDING_CLEARANCE', 'AWAITING_INVOICE_ISSUE'];
export const PAYMENT_FLAGS = ['FILE_UNAVAILABLE', 'SQL_TIMEOUT', 'SQL_FAILURE', 'AI_NOT_RUN', 'DUPLICATE_SUSPECTED', 'CUSTOMER_CONFIRMATION_REQUIRED', 'PAYMENT_METHOD_REQUIRED', 'MANUAL_OR', 'CROSS_COMPANY', 'PENDING_SLIP', 'PENDING_INVOICE_NUMBER'];
export type PaymentQueueSummary = { category_counts?: Record<string, number>; flag_counts?: Record<string, number>; eligible_cases?: number; completed_cases?: number; fault_excluded_cases?: number; awaiting_invoice_issue_cases?: number; completion_rate?: number | null };
const label = (value: string) => value === 'AWAITING_INVOICE_ISSUE' ? '等开票 / Awaiting invoice issue' : value.toLowerCase().replaceAll('_', ' ');

export function PaymentQueueFilters({ category, flags, onCategory, onFlags, summary, truncated = false, countScope = 'Matching cases' }: {
  category: string; flags: string[]; onCategory: (value: string) => void; onFlags: (value: string[]) => void;
  summary?: PaymentQueueSummary; truncated?: boolean; countScope?: string;
}) {
  return <section className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4" aria-label="Payment workflow filters">
    <p className="text-sm font-semibold">Payment status — one category per case</p>
    <div className="flex flex-wrap gap-2">{['ALL', ...PAYMENT_CATEGORIES].map((value, index) => <button key={value} type="button" aria-pressed={category === value} onClick={() => onCategory(value)} className={`rounded-lg border px-3 py-2 text-xs capitalize ${category === value ? 'border-cyan-600 bg-cyan-50 text-cyan-950' : 'border-[var(--border)]'}`}>
      {index ? `${index} · ${label(value)}` : 'All payments'} {summary?.category_counts && <b>({value === 'ALL' ? Object.values(summary.category_counts).reduce((a, b) => a + b, 0) : summary.category_counts[value] || 0})</b>}
    </button>)}</div>
    <p className="text-xs font-semibold">Flags — match all selected flags</p>
    <div className="flex flex-wrap gap-2">{PAYMENT_FLAGS.map(flag => <label key={flag} className="flex items-center gap-1 rounded border border-[var(--border)] px-2 py-1 text-xs capitalize"><input type="checkbox" checked={flags.includes(flag)} onChange={event => onFlags(event.target.checked ? [...flags, flag] : flags.filter(value => value !== flag))} />{label(flag)} {summary?.flag_counts && `(${summary.flag_counts[flag] || 0})`}</label>)}</div>
    {flags.length > 0 && <button type="button" onClick={() => onFlags([])} className="text-xs underline">Clear flags</button>}
    {summary && <p className="text-xs text-[var(--muted-foreground)]">{countScope}: {summary.completed_cases || 0} completed / {summary.eligible_cases || 0} eligible ({summary.completion_rate == null ? '—' : `${summary.completion_rate}%`}). {summary.fault_excluded_cases || 0} cases excluded for system faults. Noise, Others and Payable are excluded. This is completion progress, not AI accuracy.{truncated && ' Counts cover the current server window, not all historical records.'}</p>}
    {summary && <p className="text-xs text-cyan-800">{summary.awaiting_invoice_issue_cases || 0} cases awaiting invoice issue, counted separately and excluded from the knock-off completion denominator.</p>}
    {category === 'PAYABLE' && <Link href="/records?section=payables" className="inline-block text-sm font-semibold text-cyan-700 underline">Open Records / Payables</Link>}
  </section>;
}
