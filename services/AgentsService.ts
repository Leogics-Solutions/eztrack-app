/**
 * Smartdok Agents Service — API client for configurable automation agents + runs.
 * (Distinct from AgentService.ts, which is the conversational chat agent.)
 */

import { BASE_URL } from './config';
import { getScopedHeaders, getScopedHeadersForFormData } from './apiHelpers';

// ------------------------------- Types ---------------------------------

export interface AgentChannel {
  id: number;
  agent_id: number;
  channel_type: string;
  channel_ref?: string | null;
  config?: Record<string, unknown> | null;
  is_active: boolean;
}

export interface AgentOutput {
  id: number;
  agent_id: number;
  output_type: string;
  sort_order: number;
  config?: Record<string, unknown> | null;
  is_active: boolean;
}

export interface Agent {
  id: number;
  user_id: number;
  organization_id?: number | null;
  name: string;
  description?: string | null;
  record_type: string;
  extraction_profile?: string | null;
  skills?: string[] | null;
  instructions?: string | null;
  approval_required: boolean;
  config?: Record<string, unknown> | null;
  is_active: boolean;
  channels: AgentChannel[];
  outputs: AgentOutput[];
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AgentListResponse {
  agents: Agent[];
  total: number;
}

export interface AgentDesignCapability {
  title: string;
  description: string;
  skill: string;
}

export interface AgentDesignPreview {
  summary: string;
  capabilities: AgentDesignCapability[];
  workflow: string[];
  skills: string[];
  recommended_outputs: string[];
  record_type: string;
  extraction_profile?: string | null;
  approval_required: boolean;
}

export interface WhatsAppConnection {
  status: 'disconnected' | 'connecting' | 'awaiting_qr_scan' | 'connected' | 'reconnecting' | 'logged_out' | 'error';
  group_jid?: string | null;
  qr_data_url?: string | null;
  phone_number?: string | null;
  last_error?: string | null;
}

export interface AgentRunLine {
  sql_item_mode?: "free_text" | "stock";
  sql_item_resolution?: { action: string; code: string };
  source_part_no?: string | null;
  source_description?: string | null;
  line_mapping_mode?: string;
  use_source_part_no_as_item_code?: boolean;
  name?: string;
  more_description?: string | null;
  model?: string;
  unit?: string;
  source_unit?: string | null;
  color?: string | null;
  source_color?: string | null;
  remember_description_mapping?: boolean;
  approved_description_mapping?: {
    id: number;
    revision: number;
    state: string;
    approved_run_id?: number;
  };
  sql_account_uom?: string | null;
  omit_document_uom?: boolean;
  qty?: number | null;
  category?: string | null;
  parent_group?: string | null;
  pricing_scope?: string | null;
  unit_price_foreign?: number | null;
  amount_foreign?: number | null;
  unit_price_myr?: number | null;
  amount_myr?: number | null;
  match?: {
    matched: boolean;
    confidence: number;
    sku_code?: string | null;
    en_description?: string | null;
    matched_alias?: string | null;
    match_method?: string;
    item_id?: number | null;
    translation_source?: string | null;
  };
}

export interface AgentRunForex {
  calculation_mode?: 'target' | 'rate' | null;
  force_expected_total?: boolean;
  document_total_override?: number | null;
  currency?: string | null;
  amount?: number | null;
  operator?: string | null;
  rate?: number | null;
  flat_fee?: number | null;
  adjustments?: Array<{ operator?: string | null; currency?: string | null; amount?: number | null }>;
  computed_total?: number | null;
  expected_total?: number | null;
  matches?: boolean | null;
  raw?: string | null;
  inferred_from_declared_myr_total?: boolean;
  target_source?: string | null;
}

export interface AgentRunData {
  customer?: string | null;
  customer_code?: string | null;
  code?: string | null;
  source_reference?: string | null;
  inv_date?: string | null;
  payment_terms?: string | null;
  sql_customer_validation?: {
    status: 'MATCHED' | 'NOT_FOUND' | 'AMBIGUOUS' | 'UNAVAILABLE';
    message: string;
    review_customer?: string | null;
    review_code?: string | null;
    issuer_key?: string | null;
    connection_id?: number | null;
    checked_at?: string;
  };
  currency?: string | null;
  no_conversion?: boolean;
  issuing_entity?: {
    status?: 'RESOLVED' | 'AMBIGUOUS' | 'UNRESOLVED' | 'NOT_CONFIGURED' | string;
    entity_key?: string | null;
    key?: string | null;
    legal_name?: string | null;
    display_name?: string | null;
    role?: 'ISSUER' | 'CONSIGNEE' | string | null;
    route?: 'INTERNAL' | 'OUTSOURCED' | string | null;
    fulfilment_mode?: 'INTERNAL' | 'OUTSOURCED' | string | null;
    aliases?: string[];
    sql_connection_id?: number | null;
    template_sources?: Array<Record<string, unknown>>;
    [key: string]: unknown;
  } | null;
  outsource_message_draft?: { body: string; subject?: string; filename?: string; destination?: { email_to?: string[]; group_jid?: string; group_name?: string } };
  fulfilment_route?: 'INTERNAL' | 'OUTSOURCED' | string | null;
  forex?: AgentRunForex | null;
  conversion?: {
    status?: 'NOT_REQUIRED' | 'PENDING_RATE' | 'INCOMPLETE' | 'CONVERTED' | string;
    source_currency?: string | null;
    target_currency?: string | null;
    rate_required?: boolean;
    priced_line_count?: number;
    converted_line_count?: number;
    reason?: string | null;
  };
  lines?: AgentRunLine[];
  totals?: Record<string, number | null>;
  source?: Record<string, unknown>;
  reconciliation?: {
    status?: 'MATCHED' | 'MISMATCH' | 'NOT_DECLARED' | string;
    expected_foreign_total?: number | null;
    extracted_foreign_total?: number | null;
    variance_foreign?: number | null;
    currency?: string | null;
    currency_matches?: boolean | null;
    requires_review?: boolean;
  };
  package?: {
    status?: 'COMPLETE' | 'WAITING_FOR_DOCUMENTS' | 'NEEDS_REVIEW' | 'NOT_REQUIRED' | string;
    expected_set_count?: number | null;
    received_primary_document_count?: number;
    remaining_foreign_total?: number | null;
    supporting_document_count?: number;
    source_run_ids?: number[];
    manually_combined?: boolean;
  };
  documents?: Array<{
    sheet?: string;
    document_type?: string;
    role?: string;
    priced?: boolean;
    row_count?: number;
    run_id?: number;
    filename?: string;
  }>;
  [key: string]: unknown;
}

export interface ReviewFieldDefinition {
  key: string;
  label?: string;
  description?: string;
  type?: string;
  structure?: 'SCALAR' | 'TABLE' | string;
  required?: boolean;
  children?: ReviewFieldDefinition[];
}

export interface AgentRunReviewSchema {
  template_key?: string | null;
  document_types?: string[];
  fields?: ReviewFieldDefinition[];
  approval?: Record<string, unknown>;
}

export interface AgentRunEvent {
  id: number;
  run_id: number;
  event_type: string;
  status?: string | null;
  message?: string | null;
  data?: Record<string, unknown> | null;
  created_at?: string | null;
}

export interface AgentRunBundle {
  total: number;
  index: number | null;
  run_ids: number[];
  pending_run_ids: number[];
  pending_count: number;
  all_ready: boolean;
  members: { id: number; label?: string | null; status: string; ready: boolean }[];
}

export interface AgentRun {
  display_status?: string | null;
  bundle?: AgentRunBundle | null;
  id: number;
  agent_id: number;
  user_id: number;
  organization_id?: number | null;
  status: string;
  revision?: number;
  updated_at?: string | null;
  po_label?: string | null;
  agent_name?: string | null;
  record_type?: string | null;
  review_schema?: AgentRunReviewSchema;
  source_channel?: string | null;
  source_ref?: string | null;
  source_filename?: string | null;
  source_file_s3_key?: string | null;
  source_caption?: string | null;
  extracted_data?: AgentRunData | null;
  corrected_data?: AgentRunData | null;
  output_refs?: Record<string, unknown> | null;
  awaiting_instruction?: boolean;
  error_message?: string | null;
  received_at?: string | null;
  extracted_at?: string | null;
  reviewed_at?: string | null;
  approved_at?: string | null;
  completed_at?: string | null;
  events: AgentRunEvent[];
}

export interface AgentRunListItem {
  display_status?: string | null;
  payment_category?: string | null;
  payment_flags?: string[];
  funds_status?: string | null;
  slip_status?: string | null;
  invoice_status?: string | null;
  id: number;
  agent_id: number;
  status: string;
  source_channel?: string | null;
  source_filename?: string | null;
  source_caption?: string | null;
  error_message?: string | null;
  po_label?: string | null;
  agent_name?: string | null;
  template_key?: string | null;
  issuing_company?: string | null;
  approval_destination?: 'SQL' | 'EMAIL' | 'WHATSAPP' | null;
  source_bundle_index?: number | null;
  source_bundle_count?: number | null;
  awaiting_instruction?: boolean;
  received_at?: string | null;
  completed_at?: string | null;
  updated_at?: string | null;
}

export interface AgentRunListResponse {
  runs: AgentRunListItem[];
  total: number;
}

export interface AgentAuditEvent {
  id: number;
  run_id: number;
  agent_id: number;
  agent_name?: string | null;
  event_type: string;
  status?: string | null;
  message?: string | null;
  data?: Record<string, unknown> | null;
  source_channel?: string | null;
  source_filename?: string | null;
  source_caption?: string | null;
  po_label?: string | null;
  created_at?: string | null;
}

export interface AgentAuditEventListResponse {
  events: AgentAuditEvent[];
  total: number;
}

// ------------------------------ Helpers ---------------------------------

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || err.detail || 'Request failed');
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

// ------------------------------- Agents ---------------------------------

export async function listAgents(): Promise<AgentListResponse> {
  const res = await fetch(`${BASE_URL}/agents`, { headers: getScopedHeaders() });
  return handle<AgentListResponse>(res);
}

export async function getAgent(agentId: number): Promise<Agent> {
  const res = await fetch(`${BASE_URL}/agents/${agentId}`, { headers: getScopedHeaders() });
  return handle<Agent>(res);
}

export async function createAgent(payload: Partial<Agent>): Promise<Agent> {
  const res = await fetch(`${BASE_URL}/agents`, {
    method: 'POST', headers: getScopedHeaders(), body: JSON.stringify(payload),
  });
  return handle<Agent>(res);
}

export async function previewAgentDesign(payload: {
  name?: string;
  description?: string;
  instructions: string;
  channels: Partial<AgentChannel>[];
}): Promise<AgentDesignPreview> {
  const res = await fetch(`${BASE_URL}/agents/preview`, {
    method: 'POST', headers: getScopedHeaders(), body: JSON.stringify(payload),
  });
  return handle<AgentDesignPreview>(res);
}

export async function updateAgent(agentId: number, payload: Partial<Agent>): Promise<Agent> {
  const res = await fetch(`${BASE_URL}/agents/${agentId}`, {
    method: 'PATCH', headers: getScopedHeaders(), body: JSON.stringify(payload),
  });
  return handle<Agent>(res);
}

export async function deleteAgent(agentId: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/agents/${agentId}`, {
    method: 'DELETE', headers: getScopedHeaders(),
  });
  return handle<void>(res);
}

export async function getWhatsAppConnection(agentId: number): Promise<WhatsAppConnection> {
  const res = await fetch(`${BASE_URL}/agents/${agentId}/whatsapp-connection`, { headers: getScopedHeaders() });
  return handle<WhatsAppConnection>(res);
}

export async function connectWhatsApp(agentId: number): Promise<WhatsAppConnection> {
  const res = await fetch(`${BASE_URL}/agents/${agentId}/whatsapp-connection/connect`, {
    method: 'POST', headers: getScopedHeaders(),
  });
  return handle<WhatsAppConnection>(res);
}

export async function disconnectWhatsApp(agentId: number): Promise<WhatsAppConnection> {
  const res = await fetch(`${BASE_URL}/agents/${agentId}/whatsapp-connection`, {
    method: 'DELETE', headers: getScopedHeaders(),
  });
  return handle<WhatsAppConnection>(res);
}

// Channels
export async function addChannel(agentId: number, payload: Partial<AgentChannel>): Promise<AgentChannel> {
  const res = await fetch(`${BASE_URL}/agents/${agentId}/channels`, {
    method: 'POST', headers: getScopedHeaders(), body: JSON.stringify(payload),
  });
  return handle<AgentChannel>(res);
}

export async function updateChannel(agentId: number, channelId: number, payload: Partial<AgentChannel>): Promise<AgentChannel> {
  const res = await fetch(`${BASE_URL}/agents/${agentId}/channels/${channelId}`, {
    method: 'PATCH', headers: getScopedHeaders(), body: JSON.stringify(payload),
  });
  return handle<AgentChannel>(res);
}

export async function deleteChannel(agentId: number, channelId: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/agents/${agentId}/channels/${channelId}`, {
    method: 'DELETE', headers: getScopedHeaders(),
  });
  return handle<void>(res);
}

// Outputs
export async function addOutput(agentId: number, payload: Partial<AgentOutput>): Promise<AgentOutput> {
  const res = await fetch(`${BASE_URL}/agents/${agentId}/outputs`, {
    method: 'POST', headers: getScopedHeaders(), body: JSON.stringify(payload),
  });
  return handle<AgentOutput>(res);
}

export async function updateOutput(agentId: number, outputId: number, payload: Partial<AgentOutput>): Promise<AgentOutput> {
  const res = await fetch(`${BASE_URL}/agents/${agentId}/outputs/${outputId}`, {
    method: 'PATCH', headers: getScopedHeaders(), body: JSON.stringify(payload),
  });
  return handle<AgentOutput>(res);
}

export async function deleteOutput(agentId: number, outputId: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/agents/${agentId}/outputs/${outputId}`, {
    method: 'DELETE', headers: getScopedHeaders(),
  });
  return handle<void>(res);
}

// -------------------------------- Runs ----------------------------------

export async function listRuns(params: { agentId?: number; status?: string; templateKey?: 'order_to_invoice' | 'payment_knock_off'; page?: number; pageSize?: number } = {}): Promise<AgentRunListResponse> {
  const q = new URLSearchParams();
  if (params.agentId != null) q.set('agent_id', String(params.agentId));
  if (params.status) q.set('status', params.status);
  if (params.templateKey) q.set('template_key', params.templateKey);
  if (params.page) q.set('page', String(params.page));
  if (params.pageSize) q.set('page_size', String(params.pageSize));
  const res = await fetch(`${BASE_URL}/agents/runs?${q.toString()}`, { headers: getScopedHeaders() });
  return handle<AgentRunListResponse>(res);
}

export async function listAuditTrail(params: { eventType?: string; search?: string; page?: number; pageSize?: number } = {}): Promise<AgentAuditEventListResponse> {
  const q = new URLSearchParams();
  if (params.eventType) q.set('event_type', params.eventType);
  if (params.search?.trim()) q.set('search', params.search.trim());
  if (params.page) q.set('page', String(params.page));
  if (params.pageSize) q.set('page_size', String(params.pageSize));
  const res = await fetch(`${BASE_URL}/agents/audit-trail?${q.toString()}`, { headers: getScopedHeaders() });
  return handle<AgentAuditEventListResponse>(res);
}

export async function getRun(runId: number): Promise<AgentRun> {
  const res = await fetch(`${BASE_URL}/agents/runs/${runId}`, { headers: getScopedHeaders() });
  return handle<AgentRun>(res);
}

export interface CaseEmailMessage {
  id: number;
  direction: string;
  from: string | null;
  to: string[];
  subject: string | null;
  body: string;
  attachments: Array<{ filename: string; file_key?: string; role?: string; size?: number }>;
  sent_at: string | null;
}

export interface CaseEmailConversation {
  thread: null | { subject: string; to: string[]; cc: string[]; anchor_run_id: number; sender: string; status: string };
  messages: CaseEmailMessage[];
}

export async function getCaseEmailConversation(runId: number): Promise<CaseEmailConversation> {
  return handle<CaseEmailConversation>(await fetch(`${BASE_URL}/agents/runs/${runId}/email-conversation`, { headers: getScopedHeaders() }));
}

export async function replyToCaseEmail(runId: number, replyToId: number, body: string, requestId: string, files: File[]) {
  const form = new FormData();
  form.append('reply_to_id', String(replyToId));
  form.append('body', body);
  form.append('request_id', requestId);
  files.forEach((file) => form.append('files', file));
  return handle<{ status: string; message_id: string }>(await fetch(`${BASE_URL}/agents/runs/${runId}/email-conversation/reply`, {
    method: 'POST', headers: getScopedHeadersForFormData(), body: form,
  }));
}

/** Fetch the original intake attachment through the authenticated API. */
export async function getRunSource(runId: number): Promise<Blob> {
  const res = await fetch(`${BASE_URL}/agents/runs/${runId}/source`, { headers: getScopedHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || err.detail || 'Unable to load the received file');
  }
  return res.blob();
}

export async function getRunFile(runId: number, fileKey: string): Promise<Blob> {
  const query = new URLSearchParams({ file_key: fileKey });
  const res = await fetch(`${BASE_URL}/agents/runs/${runId}/file?${query.toString()}`, { headers: getScopedHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || err.detail || 'Could not download the run file.');
  }
  return res.blob();
}

export async function uploadRun(agentId: number, file: File, caption = ''): Promise<AgentRun> {
  const form = new FormData();
  form.append('file', file);
  form.append('caption', caption);
  const res = await fetch(`${BASE_URL}/agents/${agentId}/runs/upload`, {
    method: 'POST', headers: getScopedHeadersForFormData(), body: form,
  });
  return handle<AgentRun>(res);
}

export async function uploadPaymentBundle(
  agentId: number,
  files: File[],
  caption: string,
  context: { channelId: number; sqlConnectionId: number },
): Promise<AgentRun> {
  const form = new FormData();
  files.forEach((file) => form.append('files', file));
  form.append('caption', caption);
  form.append('channel_id', String(context.channelId));
  form.append('sql_connection_id', String(context.sqlConnectionId));
  const res = await fetch(`${BASE_URL}/agents/${agentId}/runs/payment-bundle`, { method: 'POST', headers: getScopedHeadersForFormData(), body: form });
  return handle<AgentRun>(res);
}

export async function reviewRun(runId: number, correctedData: AgentRunData): Promise<AgentRun> {
  const res = await fetch(`${BASE_URL}/agents/runs/${runId}/review`, {
    method: 'POST', headers: getScopedHeaders(), body: JSON.stringify({ corrected_data: correctedData }),
  });
  return handle<AgentRun>(res);
}

/** Re-run AI extraction against the retained PO/message without creating another review item. */
export async function reanalyzeRun(runId: number): Promise<AgentRun> {
  const res = await fetch(`${BASE_URL}/agents/runs/${runId}/reanalyze`, {
    method: 'POST', headers: getScopedHeaders(),
  });
  return handle<AgentRun>(res);
}

export async function refreshPaymentPreview(runId: number): Promise<AgentRun> {
  const res = await fetch(`${BASE_URL}/agents/runs/${runId}/payment-sql-check`, {
    method: 'POST', headers: getScopedHeaders(),
  });
  return handle<AgentRun>(res);
}

export async function setInvoiceWaitApproval(runId: number, enabled: boolean): Promise<AgentRun> {
  return handle<AgentRun>(await fetch(`${BASE_URL}/agents/runs/${runId}/invoice-wait-approval?enabled=${enabled}`, {
    method: 'POST', headers: getScopedHeaders(),
  }));
}

export async function paymentSqlCheckStatus(runId: number): Promise<import('../utils/paymentSqlJob').PaymentSqlJob> {
  return handle(await fetch(`${BASE_URL}/agents/runs/${runId}/payment-sql-check`, {headers:getScopedHeaders()}));
}
export async function resolvePayment(runId:number, body:Record<string,unknown>):Promise<AgentRun> {
  return handle(await fetch(`${BASE_URL}/agents/runs/${runId}/payment-resolution`,{method:'POST',headers:getScopedHeaders(),body:JSON.stringify(body)}));
}
export async function linkPaymentCase(runId:number,source_case_id:number,reason:string):Promise<AgentRun> {
  return handle(await fetch(`${BASE_URL}/agents/runs/${runId}/link-payment-case`,{method:'POST',headers:getScopedHeaders(),body:JSON.stringify({source_case_id,reason})}));
}

export async function analyzePaymentEvidence(runId:number):Promise<AgentRun> {
  return handle(await fetch(`${BASE_URL}/agents/runs/${runId}/analyze-payment-evidence`,{method:'POST',headers:getScopedHeaders()}));
}

export interface PaymentFollowUp {
  kind:string; reason:string; assignee?:string; due_at?:string; run_id?:number; case_id?:number;
  delivery_mode?:string; interval_hours?:number; schedule_status?:string; last_sent_at?:string;
}

export type OutsourcedCaseState = 'ACTION' | 'WAITING' | 'COMPLETED';

export interface OutsourcedSet {
  run_id: number;
  status: string;
  label?: string;
  issuing_company?: string;
  customer?: string;
  date?: string;
  currency?: string;
  amount?: number;
  line_count: number;
  verification_status?: string;
  test_mode?: boolean;
  delivered: boolean;
  source_channel?: string | null;
  outbound_channel?: string | null;
  updated_at?: string | null;
  received_at?: string | null;
  set_index?: number;
  set_count?: number;
  state?: OutsourcedCaseState;
}

export interface OutsourcedCase {
  case_id: number;
  instruction?: string;
  source_filename?: string;
  sets: OutsourcedSet[];
}

export async function listOutsourcedCases(page = 1, pageSize = 100): Promise<{
  cases: OutsourcedCase[];
  total: number;
  counts?: Record<OutsourcedCaseState, number>;
}> {
  return handle(await fetch(`${BASE_URL}/agents/outsourced-cases?page=${page}&page_size=${pageSize}`, { headers: getScopedHeaders() }));
}
export async function listPaymentFollowUps():Promise<{items:PaymentFollowUp[]}> {
  return handle(await fetch(`${BASE_URL}/agents/payment-follow-ups`,{headers:getScopedHeaders()}));
}
export async function updatePaymentCaseTask(caseId:number,body:Record<string,unknown>):Promise<unknown> {
  return handle(await fetch(`${BASE_URL}/agents/payment-cases/${caseId}/follow-up`,{method:'POST',headers:getScopedHeaders(),body:JSON.stringify(body)}));
}

export async function addPaymentEvidence(runId: number, files: File[]): Promise<AgentRun> {
  const form = new FormData();
  files.forEach((file) => form.append('files', file));
  const res = await fetch(`${BASE_URL}/agents/runs/${runId}/payment-evidence`, {
    method: 'POST', headers: getScopedHeadersForFormData(), body: form,
  });
  return handle<AgentRun>(res);
}

export async function combineRuns(targetRunId: number, sourceRunId: number): Promise<AgentRun> {
  const res = await fetch(`${BASE_URL}/agents/runs/${targetRunId}/combine/${sourceRunId}`, {
    method: 'POST', headers: getScopedHeaders(),
  });
  return handle<AgentRun>(res);
}

export async function generateRun(runId: number): Promise<AgentRun> {
  const res = await fetch(`${BASE_URL}/agents/runs/${runId}/generate`, {
    method: 'POST', headers: getScopedHeaders(),
  });
  return handle<AgentRun>(res);
}

export interface OrderSSTState {
  applicable: boolean; required: boolean; ready: boolean;
  status: 'GROUP_J' | 'NOT_GROUP_J' | 'UNVERIFIED'; source: string | null;
  identity: Record<string, unknown>; configured_rate: number; rate: number; can_remember: boolean; message: string;
  confirmation: { checked_on: string; note: string; confirmed_at: string; confirmed_by_user_id: number } | null;
}
export async function getOrderSST(runId: number): Promise<OrderSSTState> {
  return handle<OrderSSTState>(await fetch(`${BASE_URL}/agents/runs/${runId}/sst-confirmation`, { headers: getScopedHeaders() }));
}
export async function saveOrderSST(runId: number, body: Record<string, unknown>): Promise<AgentRun> {
  return handle<AgentRun>(await fetch(`${BASE_URL}/agents/runs/${runId}/sst-confirmation`, {
    method:'POST', headers:getScopedHeaders(), body:JSON.stringify(body),
  }));
}

export async function updateRunDocumentNumbers(
  runId: number,
  deliveryOrderNo: string,
  invoiceNo: string,
  existingDoConfirmation?: string,
  reservationOnly = false,
): Promise<AgentRun> {
  const res = await fetch(`${BASE_URL}/agents/runs/${runId}/document-numbers`, {
    method: 'PATCH', headers: getScopedHeaders(),
    body: JSON.stringify({ delivery_order_no: deliveryOrderNo, invoice_no: invoiceNo, existing_do_confirmation: existingDoConfirmation, reservation_only: reservationOnly }),
  });
  return handle<AgentRun>(res);
}

export type ReservedDoPreview = {
  confirmation: string;
  snapshot: { found: boolean; truncated?: boolean; cancelled?: boolean; linked_invoice?: unknown;
    document?: { document_no: string; customer_code: string; customer_name: string; document_amount: string; document_date: string };
    lines: { description: string; more_description?: string; item_code: string; qty: number; uom: string; unit_price: number; amount: number }[];
  };
};
export async function previewReservedDo(runId: number, documentNo: string): Promise<ReservedDoPreview> {
  const res = await fetch(`${BASE_URL}/agents/runs/${runId}/reserved-do-preview?document_no=${encodeURIComponent(documentNo)}`, { headers: getScopedHeaders() });
  return handle<ReservedDoPreview>(res);
}

export async function approveRun(runId: number, correctedData?: AgentRunData): Promise<AgentRun> {
  const res = await fetch(`${BASE_URL}/agents/runs/${runId}/approve`, {
    method: 'POST', headers: getScopedHeaders(),
    body: JSON.stringify({ corrected_data: correctedData ?? null }),
  });
  return handle<AgentRun>(res);
}

export type PaymentSubmitJob = {
  id?: string; status: string; error_message?: string;
  created_at?: string; started_at?: string;
  result?: { stage?: string; detail?: string; run_status?: string };
};

export async function submitPayment(run: AgentRun, correctedData: AgentRunData, requestId: string): Promise<AgentRun> {
  const res = await fetch(`${BASE_URL}/agents/runs/${run.id}/payment-submit`, {
    method: 'POST', headers: getScopedHeaders(),
    body: JSON.stringify({ request_id: requestId, expected_updated_at: run.updated_at, corrected_data: correctedData }),
  });
  return handle<AgentRun>(res);
}

export async function paymentSubmitStatus(runId: number): Promise<PaymentSubmitJob> {
  return handle<PaymentSubmitJob>(await fetch(`${BASE_URL}/agents/runs/${runId}/payment-submit`, { headers: getScopedHeaders() }));
}

export async function sendRunToWhatsApp(runId: number): Promise<AgentRun> {
  const res = await fetch(`${BASE_URL}/agents/runs/${runId}/send-whatsapp`, {
    method: 'POST', headers: getScopedHeaders(),
  });
  return handle<AgentRun>(res);
}

export async function verifySupplierDocuments(runId: number): Promise<AgentRun> {
  const res = await fetch(`${BASE_URL}/agents/runs/${runId}/verify-supplier-documents`, {
    method: 'POST', headers: getScopedHeaders(),
  });
  return handle<AgentRun>(res);
}

/** Retry only official-file retrieval and source delivery; accounting writes are never repeated. */
export async function retryRunDelivery(runId: number): Promise<AgentRun> {
  const res = await fetch(`${BASE_URL}/agents/runs/${runId}/retry-delivery`, {
    method: 'POST', headers: getScopedHeaders(),
  });
  return handle<AgentRun>(res);
}

/** Retry only the SQL Account DO + Invoice push for a completed run. */
export async function repushRunToSqlAccount(runId: number): Promise<AgentRun> {
  const res = await fetch(`${BASE_URL}/agents/runs/${runId}/repush-sql-account`, {
    method: 'POST', headers: getScopedHeaders(),
  });
  return handle<AgentRun>(res);
}

export interface SqlAccountCustomerProposal {
  /** SQL Account customer codes are limited to ten characters in this company. */
  code: string;
  company_name: string;
  address?: string | null;
}

export interface SqlAccountStockItemProposal {
  source_index: number;
  code: string;
  description: string;
  uom?: string | null;
}

export interface SqlAccountStockItemChoice extends SqlAccountStockItemProposal {
  action: 'match_existing' | 'create_new';
}

export async function resolveSqlAccountItems(runId: number, items: SqlAccountStockItemChoice[], expectedUpdatedAt: string): Promise<AgentRun> {
  const res = await fetch(`${BASE_URL}/agents/runs/${runId}/resolve-sql-account-items`, {
    method: 'POST', headers: getScopedHeaders(), body: JSON.stringify({ items, expected_updated_at: expectedUpdatedAt }),
  });
  return handle<AgentRun>(res);
}

export async function checkSqlAccountItems(runId: number): Promise<AgentRun> {
  const res = await fetch(`${BASE_URL}/agents/runs/${runId}/check-sql-account-items`, {
    method: 'POST', headers: getScopedHeaders(),
  });
  return handle<AgentRun>(res);
}

/** Create a reviewer-approved SQL Account customer, then retry only this run's SQL push. */
export async function createSqlAccountCustomerAndRepush(runId: number, customer: SqlAccountCustomerProposal): Promise<AgentRun> {
  const res = await fetch(`${BASE_URL}/agents/runs/${runId}/create-sql-account-customer`, {
    method: 'POST', headers: getScopedHeaders(), body: JSON.stringify(customer),
  });
  return handle<AgentRun>(res);
}

export async function createSqlAccountItemsAndRepush(runId: number, items: SqlAccountStockItemProposal[]): Promise<AgentRun> {
  const res = await fetch(`${BASE_URL}/agents/runs/${runId}/create-sql-account-items`, { method: 'POST', headers: getScopedHeaders(), body: JSON.stringify({ items }) });
  return handle<AgentRun>(res);
}

export async function rejectRun(runId: number, reason?: string): Promise<AgentRun> {
  const res = await fetch(`${BASE_URL}/agents/runs/${runId}/reject`, {
    method: 'POST', headers: getScopedHeaders(), body: JSON.stringify({ reason: reason ?? null }),
  });
  return handle<AgentRun>(res);
}

export interface OrderBatchJob {
  id: string;
  status: string;
  action: 'PREPARE' | 'APPROVE' | 'EMAIL';
  result: { items?: { run_id: number; status: string; message: string }[];
    progress?: { run_id: number; stage: string; total_lines?: number; completed_orders?: number; total_orders?: number;
      updated_at?: string; sdk_activity?: { stage?: string; stage_elapsed_seconds?: number; timed_out?: boolean } } };
  queue_position?: number;
  total_orders?: number;
  estimated_wait_seconds?: number;
  started_at?: string;
  created_at?: string;
  error?: string;
  preview?: {
    run_ids: number[]; set_count: number; subject: string; body: string;
    route: { to: string[]; cc: string[]; test_mode: boolean; intended_to?: string[] };
    files: { file_key: string; filename: string }[];
  };
}

export async function getOrderBatch(runId: number): Promise<OrderBatchJob | null> {
  return handle(await fetch(`${BASE_URL}/agents/runs/${runId}/batch`, { headers: getScopedHeaders() }));
}

export async function startOrderBatch(runId: number, action: 'PREPARE' | 'APPROVE', single = false, correctedData?: AgentRunData): Promise<OrderBatchJob> {
  return handle(await fetch(`${BASE_URL}/agents/runs/${runId}/batch`, {
    method: 'POST', headers: getScopedHeaders(), body: JSON.stringify({ action, single, corrected_data: correctedData }),
  }));
}

export async function previewOrderBatchEmail(runId: number): Promise<OrderBatchJob> {
  return handle(await fetch(`${BASE_URL}/agents/runs/${runId}/outsource-batch/preview`, {
    method: 'POST', headers: getScopedHeaders(),
  }));
}

export async function sendOrderBatchEmail(runId: number, previewId: string, subject: string, body: string): Promise<OrderBatchJob> {
  return handle(await fetch(`${BASE_URL}/agents/runs/${runId}/outsource-batch/send`, {
    method: 'POST', headers: getScopedHeaders(), body: JSON.stringify({ preview_id: previewId, subject, body }),
  }));
}

export async function assignOrderBatchFiles(runId: number, fileKeys: string[]): Promise<{ status: string }> {
  return handle(await fetch(`${BASE_URL}/agents/runs/${runId}/outsource-batch/files`, {
    method: 'POST', headers: getScopedHeaders(), body: JSON.stringify({ file_keys: fileKeys }),
  }));
}

export async function skipSupplierVerification(runId: number): Promise<AgentRun> {
  const res = await fetch(`${BASE_URL}/agents/runs/${runId}/skip-supplier-verification`, {
    method: 'POST', headers: getScopedHeaders(),
  });
  return handle<AgentRun>(res);
}

export async function attachOrderSource(runId: number, file: File): Promise<{ run_id: number; filename: string }> {
  const form = new FormData(); form.append('file', file);
  const headers = new Headers(getScopedHeaders()); headers.delete('Content-Type');
  return handle(await fetch(`${BASE_URL}/agents/runs/${runId}/source-attachment`, { method: 'POST', headers, body: form }));
}

export async function renameReturnedFile(runId: number, fileKey: string, filename: string): Promise<{ filename: string }> {
  return handle(await fetch(`${BASE_URL}/agents/runs/${runId}/returned-filename`, {
    method: 'PATCH', headers: getScopedHeaders(), body: JSON.stringify({ file_key: fileKey, filename }),
  }));
}
