import type { AgentRunLine, SqlAccountStockItemProposal } from '../services/AgentsService';

const nonStock = new Set(['header', 'deduction', 'included_component']);
export const validNewStockCode = (code: string): boolean => /^[A-Za-z0-9_. /-]{2,30}$/.test(code.trim());

export function selectSqlStock(line: AgentRunLine): AgentRunLine {
  if (nonStock.has(line.category || '')) return line;
  const code = String(line.source_part_no || line.model || '').trim().replace(/^'/, '');
  return { ...line, sql_item_mode: 'stock', sql_stock_required: true,
    sql_allow_free_text_fallback: false, use_source_part_no_as_item_code: Boolean(code),
    ...(code ? { source_part_no: code } : {}),
    sql_stock_requirement_evidence: 'Reviewer selected SQL item matching for this order line.',
    match: { confidence: 0, ...line.match, matched: Boolean(line.match?.sku_code) } };
}

export function sqlStockChoices(lines: AgentRunLine[], proposals: SqlAccountStockItemProposal[], freeTextOrder: boolean): SqlAccountStockItemProposal[] {
  if (freeTextOrder) return [];
  return lines.flatMap((line, index) => {
    const proposal = proposals.find(item => item.source_index === index);
    if (nonStock.has(line.category || '') || line.sql_item_mode === 'free_text' || line.match?.sku_code
      || (!line.sql_stock_required && line.sql_item_mode !== 'stock' && !line.use_source_part_no_as_item_code && !proposal)) return [];
    return [{ source_index: index, code: String(proposal?.code || line.source_part_no || line.model || '').replace(/^'/, ''),
      description: String(proposal?.description || line.source_description || line.more_description || line.name || ''),
      uom: line.omit_document_uom ? '' : line.unit || '' }];
  });
}
