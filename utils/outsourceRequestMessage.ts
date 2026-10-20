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
  return lines.join('\n');
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
  return oldDefault || /^Orders in this request:\s*$/m.test(body) ? null : body;
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
  return `Dear,\n\nPlease prepare ${outsourceSetCount(run, data)} set ${documents} for the attached purchase order.\n\n${content}\n\nThank you.\n\nRegards,\nBryan`;
}
