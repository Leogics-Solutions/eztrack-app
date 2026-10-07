import type { AgentRunData, AgentRunLine } from '../services/AgentsService';
const threePlaceIssuers = new Set(['FLEXERO', 'FLEXEROSDNBHD', 'MURNIRAYA', 'MURNIRAYASDNBHD', 'VISTA', 'VISTASEMANGATTRADINGSDNBHD']);
export function orderUnitPlaces(issuer: AgentRunData['issuing_entity']): 2 | 3 {
  const name = String(issuer?.legal_name || issuer?.display_name || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return threePlaceIssuers.has(name) ? 3 : 2;
}
export function formatOrderUnit(value: number | null | undefined, places: 2 | 3): string {
  return value == null ? '—' : new Intl.NumberFormat('en-MY', {minimumFractionDigits: places, maximumFractionDigits: places}).format(value);
}
export function changedSourceAmountIssue(line: AgentRunLine, original: AgentRunLine | undefined, index: number, currency: string): string | null {
  const changed = ['qty', 'unit_price_foreign', 'amount_foreign'].some(key => line[key as keyof AgentRunLine] !== original?.[key as keyof AgentRunLine]);
  if (!changed || line.qty == null || line.unit_price_foreign == null || line.amount_foreign == null) return null;
  const expected = Number(new Intl.NumberFormat('en-US', {useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: 2}).format(line.qty * line.unit_price_foreign));
  const difference = line.amount_foreign - expected;
  return Math.abs(difference) > .010001
    ? `Line ${index + 1}${line.model ? ` (${line.model})` : ''}: ${currency} quantity × unit = ${formatOrderUnit(expected, 2)}, saved amount = ${formatOrderUnit(line.amount_foreign, 2)}, difference = ${formatOrderUnit(difference, 2)}. Correct the row or enter an explicit adjustment.`
    : null;
}

export function orderMoneyScope(lines: AgentRunLine[], forex: AgentRunData['forex'], noConversion: boolean, issuerKey: string): string {
  return JSON.stringify({issuerKey, noConversion, forex: forex || null,
    lines: lines.map(line => [line.name, line.model, line.category, line.qty, line.unit_price_foreign, line.amount_foreign])});
}
