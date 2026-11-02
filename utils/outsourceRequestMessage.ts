import type { AgentRun, AgentRunData } from '../services/AgentsService';

function field(value: unknown): string {
  if (value && typeof value === 'object') {
    const item = value as Record<string, unknown>;
    value = item.legal_name || item.display_name || item.name;
  }
  return String(value ?? '').split(/\s+/).filter(Boolean).join(' ');
}

export function outsourceSetCount(run: AgentRun, data?: AgentRunData): number {
  const refs = run.output_refs || {};
  for (const value of [data?.set_count, refs.set_count, refs.source_transaction_count, run.bundle?.total, data?.package?.expected_set_count]) {
    if (typeof value === 'boolean') continue;
    const count = Number(value);
    if (Number.isInteger(count) && count > 0) return count;
  }
  return 1;
}

export function outsourceRequestDate(data?: AgentRunData): string {
  const value = field(data?.inv_date || data?.order_date);
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const display = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  const parts = iso ? [Number(iso[1]), Number(iso[2]), Number(iso[3])] : display ? [Number(display[3]), Number(display[2]), Number(display[1])] : null;
  if (!parts) return '';
  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

export function outsourceAttachmentName(run: AgentRun, data?: AgentRunData, previewName?: string): string {
  const refs = run.output_refs || {};
  const saved = String(data?.outsource_message_draft?.filename || '');
  if (refs.outsourced_email || refs.outsourced_whatsapp) return saved || run.source_filename || '';
  const bundle = refs.source_transaction_type === 'pdf' && Number(refs.source_transaction_count) > 1
    ? String(refs.bundle_source_filename || '') : '';
  if (saved && (!bundle || saved !== run.source_filename)) return saved;
  return previewName || bundle || run.source_filename || '';
}

export function outsourceSupplierContent(run: AgentRun, data?: AgentRunData): string {
  const issuer = data?.issuing_entity;
  const company = field(issuer?.display_name || issuer?.legal_name);
  const customer = field(data?.customer || data?.customer_name);
  const count = outsourceSetCount(run, data);
  const route = [company, customer].filter(Boolean).join(' to ');
  const lines = route ? [`${route} - ${count} ${count === 1 ? 'set' : 'sets'}`] : [];
  const date = outsourceRequestDate(data);
  if (date) lines.push(`Date: ${date}`);
  const po = field(data?.po_number);
  if (po && !['N/A', 'NONE', 'NULL', '-'].includes(po.toUpperCase())) lines.push(`PO No: ${po}`);
  if (!run.source_file_s3_key && !run.output_refs?.outsource_forward_only) {
    const details = outsourceTextOrderDetails(data);
    if (details) lines.push('', details);
  }
  return lines.join('\n');
}

export function outsourceTextOrderDetails(data?: AgentRunData): string {
  const number = (value: unknown, money = false): string => {
    if (value == null || typeof value === 'boolean' || !String(value).trim()) return '';
    const raw = String(value).trim();
    const amount = Number(raw);
    if (!Number.isFinite(amount)) return '';
    const decimal = raw.split('.')[1] || '';
    return money && decimal.length <= 2
      ? amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : String(amount);
  };
  const currency = field(data?.currency || data?.conversion?.source_currency);
  const prefix = ['MYR', 'RM'].includes(currency.toUpperCase()) ? 'RM ' : currency ? `${currency} ` : '';
  const blocks: string[] = [];
  for (const row of data?.lines || []) {
    if (['header', 'included_component'].includes(String(row.category || '').toLowerCase())) continue;
    const description = String(row.match?.en_description || row.name || row.source_description || '').trim();
    if (!description) continue;
    const fields = [`DESC: ${description}`];
    const more = String(row.more_description || '').trim();
    if (more && !description.includes(more)) fields.push(more);
    const qty = number(row.qty);
    if (qty) fields.push(`QTY: ${qty}`);
    const uom = field(row.source_unit || row.unit);
    if (uom) fields.push(`UOM: ${uom}`);
    const price = row.unit_price_foreign ?? (['MYR', 'RM'].includes(currency.toUpperCase()) ? row.unit_price_myr : undefined);
    const amount = row.amount_foreign ?? (['MYR', 'RM'].includes(currency.toUpperCase()) ? row.amount_myr : undefined);
    if (number(price)) fields.push(`UNIT PRICE: ${prefix}${number(price, true)}`);
    if (number(amount)) fields.push(`LINE TOTAL: ${prefix}${number(amount, true)}`);
    blocks.push(fields.join('\n'));
  }
  const total = data?.totals?.amount_foreign_total ?? (['MYR', 'RM'].includes(currency.toUpperCase()) ? data?.totals?.grand_total_myr : undefined);
  if (blocks.length && number(total)) blocks.push(`TOTAL: ${prefix}${number(total, true)}`);
  if (field(data?.payment_terms)) blocks.push(`CREDIT TERMS: ${field(data?.payment_terms)}`);
  return blocks.join('\n\n');
}

export function savedOutsourceBody(run: AgentRun, data?: AgentRunData): string | null {
  const value = data?.outsource_message_draft?.body;
  if (value == null) return null;
  const body = String(value).trim();
  const caption = String(run.source_caption || '').trim();
  const refs = run.output_refs || {};
  if (refs.outsourced_email || refs.outsourced_whatsapp) return body;
  if (data?.outsource_message_draft?.body_source === 'ORDER_FIELDS') return null;
  const oldDefault = caption && body.includes(caption) && /^(Hi, please help arrange open invoice|Dear,|Hi Team,)/.test(body);
  if (oldDefault || /^Orders in this request:\s*$/m.test(body)) return null;
  return run.source_file_s3_key ? body : body.replace(/for the attached purchase order/gi, 'using the order details below');
}

export function defaultOutsourceBody(run: AgentRun, data?: AgentRunData): string {
  const saved = savedOutsourceBody(run, data);
  if (saved !== null) return saved;
  const types = run.output_refs?.requested_document_types || data?.requested_document_types;
  const invoiceOnly = Array.isArray(types) && types.length === 1 && types[0] === 'invoice';
  const content = outsourceSupplierContent(run, data);
  if (String(data?.issuing_entity?.outbound_channel || '').toUpperCase() === 'WHATSAPP') {
    return `Hi, please help arrange open invoice\n\n${content}\n\n${invoiceOnly ? '' : 'Please help to issue DO also,\n'}Thanks`;
  }
  const documents = invoiceOnly ? 'Sales Invoice' : 'Delivery Order and Sales Invoice';
  const instruction = run.source_file_s3_key ? 'for the attached purchase order' : 'using the order details below';
  return `Dear,\n\nPlease prepare ${outsourceSetCount(run, data)} set ${documents} ${instruction}.\n\n${content}\n\nThank you.\n\nRegards,\nBryan`;
}
