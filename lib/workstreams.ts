export type WorkstreamKey = 'ALL' | 'order_to_invoice' | 'payment_knock_off' | 'other';
export type ItemWorkstreamKey = Exclude<WorkstreamKey, 'ALL'>;

export const WORKSTREAM_LABELS: Record<WorkstreamKey, string> = {
  ALL: 'All work',
  order_to_invoice: 'PO to DO & Invoice',
  payment_knock_off: 'Payment Knock-Off',
  other: 'Other work',
};

export const WORKSTREAM_BADGE_STYLES: Record<ItemWorkstreamKey, string> = {
  order_to_invoice: 'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-100',
  payment_knock_off: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
  other: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100',
};

export function normalizeWorkstreamKey(key?: string | null, name?: string | null): ItemWorkstreamKey {
  const normalizedKey = (key || '').trim().toLowerCase();
  if (normalizedKey === 'order_to_invoice' || normalizedKey === 'payment_knock_off') return normalizedKey;
  const normalizedName = (name || '').trim().toLowerCase();
  if (normalizedName.includes('payment') && (normalizedName.includes('knock') || normalizedName.includes('reconcil') || normalizedName.includes('matching'))) {
    return 'payment_knock_off';
  }
  if (normalizedName.includes('order to invoice') || normalizedName.includes('po to') || normalizedName.includes('purchase order')) {
    return 'order_to_invoice';
  }
  return 'other';
}

export function isWorkstreamKey(value: unknown): value is WorkstreamKey {
  return value === 'ALL' || value === 'order_to_invoice' || value === 'payment_knock_off' || value === 'other';
}
