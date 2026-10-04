/** Keep SQL document currency visible; proposed allocations are MYR. */
export function PaymentInvoiceBalance({ currency, balance, rate, localContract }: {
  currency?: string; balance?: number | null; rate?: number | null; localContract?: boolean;
}) {
  if (balance == null || !Number.isFinite(Number(balance))) return <span>—</span>;
  const code = currency?.toUpperCase();
  const foreign = !!code && !['MYR', 'RM', '----'].includes(code);
  const format = (n: number) => n.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
  return <span>
    {foreign ? `${code} ${format(Number(balance))}` : `RM ${format(Number(balance))}`}
    {foreign && localContract && Number.isFinite(Number(rate)) && Number(rate) > 0 &&
      <small className="block text-xs text-[var(--muted-foreground)]">MYR {format(Number(balance) * Number(rate))} · SQL rate {rate}</small>}
  </span>;
}
