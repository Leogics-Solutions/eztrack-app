type Line = { category?: string | null; qty?: number | null; unit_price_myr?: number | null; unit_price_foreign?: number | null };
export type SstTotalsState = { applicable: boolean; ready: boolean; status: string; configured_rate: number; rate: number };
const cents = (value: number) => Math.round((value + Number.EPSILON) * 100);

export function orderSstTotals(subtotal: number | null | undefined, lines: Line[], state: SstTotalsState | null, noConversion: boolean) {
  if (subtotal == null || !Number.isFinite(subtotal)) return null;
  const applied = !!state?.applicable && state.ready && state.status === 'NOT_GROUP_J';
  const rate = applied ? state!.rate : 0;
  const taxFor = (r: number) => lines.reduce((sum, line) => {
    if (['header','included_component','sample','deduction'].includes(line.category || '')) return sum;
    const price = Number(noConversion ? line.unit_price_foreign ?? line.unit_price_myr ?? 0 : line.unit_price_myr ?? 0);
    if (!Number.isFinite(price) || price < 0) return sum;
    return sum + cents(price * Number(line.qty || 0) * r / 100);
  }, 0);
  const taxCents = applied ? taxFor(rate) : 0;
  return { subtotal: cents(subtotal)/100, rate, tax: taxCents/100,
    grandTotal: (cents(subtotal)+taxCents)/100,
    candidateTax: state?.applicable ? taxFor(state.configured_rate)/100 : 0,
    confirmed: !!state?.ready && state.status !== 'UNVERIFIED', applied };
}

export function orderSstReconciliation<T extends {status?: string; expected_foreign_total?: number | null; currency_matches?: boolean | null; [key: string]: unknown}>(rec: T | undefined, summary: ReturnType<typeof orderSstTotals>, domestic: boolean) {
  if (!rec || !summary || !domestic || rec.currency_matches === false || rec.expected_foreign_total == null) return { reconciliation:rec, sstDifference:false };
  const expected = cents(rec.expected_foreign_total);
  const sstDifference = summary.candidateTax > 0 && expected - cents(summary.subtotal) === cents(summary.candidateTax);
  if (summary.confirmed && summary.applied && expected === cents(summary.grandTotal)) {
    return { reconciliation:{...rec, status:'MATCHED', extracted_foreign_total:summary.grandTotal, variance_foreign:0, requires_review:false}, sstDifference:false };
  }
  return { reconciliation:rec, sstDifference };
}
