type Order = { lines?: Array<{ name?: string; category?: string | null; amount_foreign?: unknown; amount_myr?: unknown }> };

// Inspect decimal values as text, avoiding binary-float false warnings for 1.01.
function beyondCents(value: unknown): boolean {
  if (value == null || value === '' || !Number.isFinite(Number(value))) return false;
  const match = String(value).match(/^[+-]?(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);
  if (!match) return false;
  const fraction = match[2] || '';
  const trailing = ((match[1] + fraction).match(/0+$/) || [''])[0].length;
  return fraction.length - Number(match[3] || 0) - trailing > 2;
}

export function sourceAmountPrecisionWarnings(data?: Order | null) {
  return (data?.lines || []).flatMap((line, index) => {
    if (['header', 'included_component'].includes(line.category || '')) return [];
    // Unit prices can legitimately use three decimals. Warn about line amounts.
    const value = line.amount_foreign ?? line.amount_myr;
    return beyondCents(value) ? [{ line: index + 1, name: line.name || 'Item', amount: String(value) }] : [];
  });
}
