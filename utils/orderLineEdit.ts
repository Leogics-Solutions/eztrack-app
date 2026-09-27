import type { AgentRunLine } from '../services/AgentsService';

// Text edits must not replace authoritative source amounts with rounded prices.
export function editOrderLine(line: AgentRunLine, patch: Partial<AgentRunLine>): AgentRunLine {
  const next = { ...line, ...patch };
  if ("unit" in patch) {
    next.source_unit = patch.unit || "";
    next.omit_document_uom = !patch.unit?.trim();
  }
  if ('qty' in patch || 'unit_price_foreign' in patch) {
    next.amount_foreign = next.qty != null && next.unit_price_foreign != null
      ? Math.round((next.qty * next.unit_price_foreign + Number.EPSILON) * 100) / 100
      : null;
  }
  return next;
}
