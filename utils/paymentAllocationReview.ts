type Invoice = { invoice_number?: string | null; requested_amount?: number | null; requested_amount_source?: string };
type Allocation = { invoice_number?: string | null; amount_to_allocate?: number | null };

/** A reviewer-entered split is an instruction, not yet an OR allocation.
 * Refresh it before offering to leave money as unapplied credit. The backend
 * remains responsible for live balances, validation and approval.
 */
export function paymentAllocationNeedsRefresh(invoices: Invoice[], allocations: Allocation[]): boolean {
  const key = (value?: string | null) => String(value || '').trim().toUpperCase();
  const cents = (value?: number | null) => {
    if (value == null || !Number.isFinite(value) || value < 0) return null;
    const result = Math.round(value * 100);
    return Number.isSafeInteger(result) && Math.abs(value * 100 - result) < 0.00001 ? result : null;
  };
  const manual = invoices.filter(row => row.requested_amount_source === 'MANUAL');
  if (!manual.length) return false;
  const totals = new Map<string, number>();
  for (const row of allocations) {
    const amount = cents(row.amount_to_allocate);
    if (!key(row.invoice_number) || amount == null) return true;
    totals.set(key(row.invoice_number), (totals.get(key(row.invoice_number)) || 0) + amount);
  }
  const selected = new Set(invoices.map(row => key(row.invoice_number)));
  if ([...totals.keys()].some(number => !selected.has(number))) return true;
  const seen = new Set<string>();
  return manual.some(row => {
    const number = key(row.invoice_number);
    const amount = cents(row.requested_amount);
    if (!number || seen.has(number) || amount == null) return true;
    seen.add(number);
    return (totals.get(number) || 0) !== amount;
  });
}
